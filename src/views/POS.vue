<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { catalogApi, salesApi, storesApi } from "../api";
import type { Product, Store, Device, Category } from "../api/types";
import { usePosStore } from "../stores/pos";
import { useAuthStore } from "../stores/auth";

const pos = usePosStore();
const auth = useAuthStore();

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const stores = ref<Store[]>([]);
const devices = ref<Device[]>([]);
const search = ref("");
const activeCategory = ref<string | null>(null);
const error = ref("");
const success = ref("");
const showPayment = ref(false);
const showSetup = ref(false);
const paymentMethod = ref<"cash" | "card">("cash");
const cashReceived = ref(0);
const cardReference = ref("");
const processing = ref(false);
const setupStore = ref("");
const setupDevice = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const cashInput = ref<HTMLInputElement | null>(null);

// localStorage: product → categories map
const productCatMap = ref<Record<string, string[]>>(
  JSON.parse(localStorage.getItem("product_categories") ?? "{}")
);

const filtered = computed(() => {
  let list = products.value;
  if (activeCategory.value) {
    list = list.filter((p) =>
      (productCatMap.value[p.id] ?? []).includes(activeCategory.value!)
    );
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q)
    );
  }
  return list;
});

const change = computed(() =>
  paymentMethod.value === "cash" ? Math.max(0, cashReceived.value - pos.cartTotal) : 0
);

const canPay = computed(() =>
  pos.cart.length > 0 &&
  !!pos.activeSession &&
  pos.activeSession.status === "open" &&
  !!pos.selectedStore &&
  !!pos.selectedDevice
);

// Folio counter
let folioCounter = parseInt(localStorage.getItem("folio_counter") ?? "0");
function nextFolio() {
  folioCounter += 1;
  localStorage.setItem("folio_counter", String(folioCounter));
  return `T-${String(folioCounter).padStart(4, "0")}`;
}

// Barcode exact match — scanner fires full barcode then Enter or just fast input
watch(search, (val) => {
  if (!val.trim()) return;
  const exact = products.value.find(
    (p) => p.barcode && p.barcode === val.trim()
  );
  if (exact) {
    addProduct(exact);
    search.value = "";
  }
});

onMounted(async () => {
  if (!pos.selectedStore || !pos.selectedDevice) {
    showSetup.value = true;
    stores.value = await storesApi.list().catch(() => []);
  }
  const [prods, cats] = await Promise.all([
    catalogApi.listProducts().catch(() => []),
    catalogApi.listCategories().catch(() => []),
  ]);
  products.value = prods;
  categories.value = cats;
  await nextTick();
  if (!showSetup.value) searchInput.value?.focus();
  document.addEventListener("keydown", handleGlobalKey);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleGlobalKey);
});

function handleGlobalKey(e: KeyboardEvent) {
  const tag = (document.activeElement as HTMLElement)?.tagName;
  const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  if (e.key === "F2") {
    e.preventDefault();
    searchInput.value?.focus();
  }
  if (e.key === "Escape" && !showPayment.value && !showSetup.value) {
    search.value = "";
    activeCategory.value = null;
    searchInput.value?.focus();
  }
  // Any printable key outside input = jump to search
  if (!inInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    searchInput.value?.focus();
  }
}

async function loadDevices() {
  if (!setupStore.value) { devices.value = []; return; }
  devices.value = await storesApi.listDevices(setupStore.value).catch(() => []);
  setupDevice.value = "";
}

async function saveSetup() {
  const store = stores.value.find((s) => s.id === setupStore.value);
  const device = devices.value.find((d) => d.id === setupDevice.value);
  if (!store || !device) return;
  pos.setStore(store);
  pos.setDevice(device);
  showSetup.value = false;
  await nextTick();
  searchInput.value?.focus();
}

function addProduct(p: Product) {
  pos.addToCart(p, p.cost ?? 0);
  // Clear search if it was a specific search (not browsing)
  if (search.value && filtered.value.length <= 3) {
    search.value = "";
  }
  searchInput.value?.focus();
}

function handleSearchEnter() {
  if (filtered.value.length > 0) {
    addProduct(filtered.value[0]);
  }
}

function openPayment() {
  if (!canPay.value) return;
  cashReceived.value = Math.ceil(pos.cartTotal);
  cardReference.value = "";
  showPayment.value = true;
  nextTick(() => {
    if (paymentMethod.value === "cash") cashInput.value?.select();
  });
}

async function confirmSale() {
  if (!pos.selectedStore || !pos.selectedDevice) return;
  processing.value = true;
  error.value = "";
  try {
    const userId = auth.user?.sub ?? "";
    const folio = nextFolio();
    const amount =
      paymentMethod.value === "cash" ? cashReceived.value : pos.cartTotal;
    await salesApi.create({
      store_id: pos.selectedStore.id,
      user_id: userId,
      device_id: pos.selectedDevice.id,
      folio,
      items: pos.cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        price: i.price,
      })),
      payments: [{
        method: paymentMethod.value,
        amount,
        reference: paymentMethod.value === "card" && cardReference.value ? cardReference.value : undefined,
      }],
    });
    pos.clearCart();
    showPayment.value = false;
    success.value = `✓ Venta ${folio} registrada`;
    setTimeout(() => (success.value = ""), 4000);
    await nextTick();
    searchInput.value?.focus();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}
</script>

<template>
  <div class="pos-root">
    <!-- Setup modal -->
    <div v-if="showSetup" class="modal-overlay">
      <div class="modal">
        <div class="modal-logo">◎ ORB</div>
        <h2 class="modal-title">Configurar sucursal</h2>
        <p class="text-muted" style="margin-bottom:20px;font-size:13px">
          Selecciona tu sucursal y dispositivo para continuar.
        </p>
        <div class="modal-form">
          <div class="field">
            <label>Sucursal</label>
            <select v-model="setupStore" @change="loadDevices" class="input">
              <option value="">Selecciona una sucursal...</option>
              <option v-for="s in stores" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Dispositivo / Caja</label>
            <select v-model="setupDevice" class="input" :disabled="!setupStore">
              <option value="">Selecciona un dispositivo...</option>
              <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button
            class="btn btn-primary btn-block"
            style="padding:12px"
            @click="saveSetup"
            :disabled="!setupStore || !setupDevice"
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>

    <!-- Payment modal -->
    <div v-if="showPayment" class="modal-overlay" @click.self="showPayment = false">
      <div class="modal payment-modal">
        <div class="payment-header">
          <span class="text-muted" style="font-size:13px">Total a cobrar</span>
          <div class="payment-total">{{ fmt(pos.cartTotal) }}</div>
        </div>

        <div class="modal-form">
          <!-- Payment method -->
          <div class="field">
            <label>Método de pago</label>
            <div class="pay-methods">
              <button
                v-for="[val, label, icon] in [['cash','Efectivo','💵'],['card','Tarjeta','💳']] as const"
                :key="val"
                class="pay-btn"
                :class="{ active: paymentMethod === val }"
                @click="paymentMethod = val"
                type="button"
              >
                <span class="pay-icon">{{ icon }}</span>
                <span>{{ label }}</span>
              </button>
            </div>
          </div>

          <!-- Card authorization reference -->
          <div v-if="paymentMethod === 'card'" class="field">
            <label>Referencia de autorización</label>
            <input
              v-model="cardReference"
              class="input"
              placeholder="Ej. AUT 001039"
              autocomplete="off"
            />
          </div>

          <!-- Cash received -->
          <div v-if="paymentMethod === 'cash'" class="field">
            <label>Efectivo recibido</label>
            <input
              ref="cashInput"
              v-model.number="cashReceived"
              type="number"
              min="0"
              step="0.50"
              class="input cash-input"
            />
          </div>

          <!-- Quick cash amounts -->
          <div v-if="paymentMethod === 'cash'" class="quick-amounts">
            <button
              v-for="amt in [20, 50, 100, 200, 500]"
              :key="amt"
              class="quick-btn"
              :class="{ active: cashReceived === amt }"
              @click="cashReceived = amt"
              type="button"
            >
              ${{ amt }}
            </button>
            <button class="quick-btn" @click="cashReceived = Math.ceil(pos.cartTotal / 10) * 10" type="button">
              Exacto
            </button>
          </div>

          <!-- Change -->
          <div v-if="paymentMethod === 'cash' && cashReceived > pos.cartTotal" class="change-row">
            <span>Cambio</span>
            <span class="change-amount">{{ fmt(change) }}</span>
          </div>
          <div v-if="paymentMethod === 'cash' && cashReceived > 0 && cashReceived < pos.cartTotal" class="insufficient-row">
            <span>⚠ Falta</span>
            <span>{{ fmt(pos.cartTotal - cashReceived) }}</span>
          </div>

          <div v-if="error" class="error-bar">{{ error }}</div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showPayment = false">Cancelar</button>
          <button
            class="btn btn-success btn-lg"
            style="flex:1;justify-content:center"
            @click="confirmSale"
            :disabled="processing || (paymentMethod === 'cash' && cashReceived < pos.cartTotal)"
          >
            <span v-if="processing" class="spinner"></span>
            <span>{{ processing ? "Procesando..." : "✓ Confirmar venta" }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Left: products -->
    <div class="pos-left">
      <!-- Search bar -->
      <div class="search-wrap">
        <span class="search-icon-sym">⌕</span>
        <input
          ref="searchInput"
          v-model="search"
          class="search-input"
          placeholder="Buscar producto o escanear código de barras..."
          autocomplete="off"
          @keydown.enter="handleSearchEnter"
          @keydown.escape="search = ''"
        />
        <button v-if="search" class="search-clear" @click="search = ''; searchInput?.focus()" tabindex="-1">✕</button>
        <span class="search-hint-badge">F2</span>
      </div>

      <!-- Category pills -->
      <div class="cat-pills" v-if="categories.length > 0">
        <button
          class="cat-pill"
          :class="{ active: !activeCategory }"
          @click="activeCategory = null"
        >Todos</button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="cat-pill"
          :class="{ active: activeCategory === cat.id }"
          @click="activeCategory = activeCategory === cat.id ? null : cat.id"
        >{{ cat.name }}</button>
      </div>

      <!-- Success -->
      <div v-if="success" class="success-flash">{{ success }}</div>

      <!-- Products -->
      <div v-if="filtered.length === 0 && !search" class="empty" style="flex:1">
        <div class="empty-icon">▣</div>
        <h3>Sin productos</h3>
        <p>Agrega productos en el módulo de Productos.</p>
      </div>

      <div v-else-if="filtered.length === 0 && search" class="empty" style="flex:1">
        <div class="empty-icon" style="font-size:1.8rem">🔍</div>
        <h3>Sin resultados</h3>
        <p>No hay productos para "{{ search }}"</p>
      </div>

      <div class="product-grid" v-else>
        <button
          v-for="p in filtered"
          :key="p.id"
          class="product-card"
          @click="addProduct(p)"
          :title="p.barcode ?? ''"
        >
          <div class="product-avatar">{{ p.name[0].toUpperCase() }}</div>
          <div class="product-name">{{ p.name }}</div>
          <div class="product-price">{{ p.cost ? fmt(p.cost) : "—" }}</div>
          <div v-if="p.barcode" class="product-barcode">{{ p.barcode }}</div>
        </button>
      </div>
    </div>

    <!-- Right: cart -->
    <div class="pos-right">
      <div class="cart-header">
        <div class="flex items-center gap-2">
          <h2>Carrito</h2>
          <span class="badge badge-primary">{{ pos.cartCount }}</span>
        </div>
        <button
          v-if="pos.cart.length"
          class="btn btn-ghost btn-sm btn-icon"
          @click="pos.clearCart"
          title="Limpiar carrito"
        >✕</button>
      </div>

      <div v-if="pos.cart.length === 0" class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Carrito vacío</p>
        <p class="text-sm text-muted">Busca o escanea un producto</p>
      </div>

      <div class="cart-items" v-else>
        <div v-for="item in pos.cart" :key="item.product.id" class="cart-item">
          <div class="cart-item-top">
            <div class="cart-item-name">{{ item.product.name }}</div>
            <button
              class="cart-remove"
              @click="pos.removeFromCart(item.product.id)"
              title="Eliminar"
            >✕</button>
          </div>
          <div class="cart-item-bottom">
            <div class="cart-item-unit">{{ fmt(item.price) }} c/u</div>
            <div class="qty-row">
              <button class="qty-btn" @click="pos.updateQuantity(item.product.id, item.quantity - 1)">−</button>
              <input
                class="qty-val"
                type="number"
                :value="item.quantity"
                min="1"
                @change="(e) => pos.updateQuantity(item.product.id, +((e.target as HTMLInputElement).value || 1))"
                @focus="(e) => (e.target as HTMLInputElement).select()"
              />
              <button class="qty-btn" @click="pos.updateQuantity(item.product.id, item.quantity + 1)">+</button>
            </div>
            <div class="cart-item-sub">{{ fmt(item.quantity * item.price) }}</div>
          </div>
        </div>
      </div>

      <div class="cart-footer">
        <div class="cart-total-row">
          <span class="cart-total-label">Total</span>
          <span class="cart-total">{{ fmt(pos.cartTotal) }}</span>
        </div>

        <div v-if="!pos.activeSession || pos.activeSession.status !== 'open'" class="session-warn">
          ⚠ Abre una sesión de caja para cobrar
        </div>

        <button
          class="btn checkout-btn"
          :class="canPay ? 'btn-primary' : 'btn-secondary'"
          :disabled="!canPay"
          @click="openPayment"
        >
          <span>Cobrar</span>
          <span v-if="pos.cartTotal">{{ fmt(pos.cartTotal) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pos-root {
  display: flex;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

/* ── Left panel ── */
.pos-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

/* Search */
.search-wrap {
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  padding: 0 12px;
  transition: border-color var(--transition);
  flex-shrink: 0;
}

.search-wrap:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow);
}

.search-icon-sym {
  font-size: 18px;
  color: var(--text-faint);
  flex-shrink: 0;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 15px;
  padding: 13px 0;
  font-family: inherit;
}

.search-input::placeholder { color: var(--text-faint); }

.search-clear {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 4px 6px;
  font-size: 14px;
  border-radius: 4px;
  transition: all var(--transition);
}
.search-clear:hover { color: var(--text); background: var(--surface3); }

.search-hint-badge {
  background: var(--surface3);
  color: var(--text-faint);
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  flex-shrink: 0;
}

/* Category pills */
.cat-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex-shrink: 0;
  padding-bottom: 2px;
}

.cat-pills::-webkit-scrollbar { height: 3px; }

.cat-pill {
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition);
  font-family: inherit;
  flex-shrink: 0;
}

.cat-pill:hover { border-color: var(--primary); color: var(--text); }
.cat-pill.active { background: var(--primary-glow); border-color: var(--primary); color: var(--primary); font-weight: 600; }

/* Success flash */
.success-flash {
  background: var(--success-bg);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: var(--radius-sm);
  color: var(--success);
  font-size: 13px;
  font-weight: 600;
  padding: 10px 14px;
  flex-shrink: 0;
}

/* Product grid */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
  align-content: start;
}

.product-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 10px 10px;
  cursor: pointer;
  transition: all var(--transition);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 100px;
}

.product-card:hover {
  border-color: var(--primary);
  background: var(--surface2);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.15);
}

.product-card:active { transform: scale(0.97); }

.product-avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.product-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.product-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
}

.product-barcode {
  font-size: 9px;
  color: var(--text-faint);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Right panel (cart) ── */
.pos-right {
  width: 320px;
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cart-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.cart-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-faint);
}

.cart-empty-icon { font-size: 2.4rem; opacity: 0.4; }

.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cart-item {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 10px 8px;
}

.cart-item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 8px;
}

.cart-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  flex: 1;
  min-width: 0;
}

.cart-remove {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 3px;
  transition: all var(--transition);
  flex-shrink: 0;
  line-height: 1;
}
.cart-remove:hover { background: var(--danger-bg); color: var(--danger); }

.cart-item-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cart-item-unit {
  font-size: 11px;
  color: var(--text-faint);
  flex: 1;
  min-width: 0;
}

.qty-row {
  display: flex;
  align-items: center;
  gap: 3px;
}

.qty-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface3);
  color: var(--text);
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  line-height: 1;
  font-family: inherit;
}
.qty-btn:hover { background: var(--primary); border-color: var(--primary); color: #fff; }

.qty-val {
  width: 38px;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  padding: 3px 2px;
  outline: none;
  font-family: inherit;
}
.qty-val:focus { border-color: var(--primary); }
.qty-val::-webkit-inner-spin-button,
.qty-val::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.qty-val { -moz-appearance: textfield; }

.cart-item-sub {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  white-space: nowrap;
}

/* Cart footer */
.cart-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.cart-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cart-total-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}

.cart-total {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.02em;
}

.session-warn {
  font-size: 11px;
  color: var(--warning);
  background: var(--warning-bg);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  text-align: center;
}

.checkout-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 13px 16px;
  font-size: 15px;
  font-weight: 700;
  border-radius: var(--radius);
  width: 100%;
}

/* ── Payment modal ── */
.payment-modal { max-width: 420px; }

.payment-header {
  text-align: center;
  margin-bottom: 24px;
}

.payment-total {
  font-size: 2.6rem;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin-top: 6px;
}

.pay-methods {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.pay-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.pay-icon { font-size: 20px; }
.pay-btn:hover { border-color: var(--primary); color: var(--text); }
.pay-btn.active { border-color: var(--primary); background: var(--primary-glow); color: var(--primary); font-weight: 600; }

.cash-input {
  font-size: 1.4rem !important;
  font-weight: 700 !important;
  text-align: right;
  padding: 12px 14px !important;
}

.quick-amounts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.quick-btn {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}
.quick-btn:hover { border-color: var(--primary); color: var(--text); }
.quick-btn.active { background: var(--primary-glow); border-color: var(--primary); color: var(--primary); }

.change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--success-bg);
  border: 1px solid rgba(34,197,94,0.25);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
}
.change-amount { color: var(--success); font-size: 1.2rem; font-weight: 800; }

.insufficient-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--warning-bg);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  color: var(--warning);
}

.modal-logo {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--primary);
  margin-bottom: 16px;
}
</style>
