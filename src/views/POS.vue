<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { catalogApi, salesApi, storesApi } from "../api";
import type { Product, Store, Device } from "../api/types";
import { usePosStore } from "../stores/pos";
import { useAuthStore } from "../stores/auth";

const pos = usePosStore();
const auth = useAuthStore();

const products = ref<Product[]>([]);
const stores = ref<Store[]>([]);
const devices = ref<Device[]>([]);
const search = ref("");
const error = ref("");
const success = ref("");
const showPayment = ref(false);
const showSetup = ref(false);
const paymentMethod = ref<"cash" | "card" | "transfer">("cash");
const paymentAmount = ref(0);
const processing = ref(false);
const setupStore = ref("");
const setupDevice = ref("");

const filtered = computed(() =>
  products.value.filter((p) =>
    !search.value || p.name.toLowerCase().includes(search.value.toLowerCase()) ||
    p.barcode?.includes(search.value)
  )
);

onMounted(async () => {
  if (!pos.selectedStore || !pos.selectedDevice) {
    showSetup.value = true;
    stores.value = await storesApi.list().catch(() => []);
  }
  products.value = await catalogApi.listProducts().catch(() => []);
});

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
}

function openPayment() {
  if (!pos.cart.length) return;
  paymentAmount.value = pos.cartTotal;
  showPayment.value = true;
}

async function confirmSale() {
  if (!pos.selectedStore || !pos.selectedDevice) return;
  processing.value = true;
  error.value = "";
  try {
    const userId = auth.user?.sub ?? "";
    await salesApi.create({
      store_id: pos.selectedStore.id,
      user_id: userId,
      device_id: pos.selectedDevice.id,
      items: pos.cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        price: i.price,
      })),
      payments: [{ method: paymentMethod.value, amount: paymentAmount.value }],
    });
    pos.clearCart();
    showPayment.value = false;
    success.value = "Venta registrada exitosamente";
    setTimeout(() => (success.value = ""), 4000);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
</script>

<template>
  <div class="pos-root">
    <!-- Setup modal -->
    <div v-if="showSetup" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Configurar sucursal</h2>
        <p class="text-muted" style="margin-bottom:18px;font-size:13px">Selecciona tu sucursal y dispositivo para continuar.</p>
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
          <button class="btn btn-primary" @click="saveSetup" :disabled="!setupStore || !setupDevice">
            Confirmar
          </button>
        </div>
      </div>
    </div>

    <!-- Payment modal -->
    <div v-if="showPayment" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Cobrar venta</h2>
        <div class="payment-total">{{ fmt(pos.cartTotal) }}</div>
        <div class="modal-form">
          <div class="field">
            <label>Método de pago</label>
            <div class="pay-methods">
              <button
                v-for="m in [['cash','Efectivo','💵'],['card','Tarjeta','💳'],['transfer','Transferencia','🏦']]"
                :key="m[0]"
                class="pay-btn"
                :class="{ active: paymentMethod === m[0] }"
                @click="paymentMethod = m[0] as any"
              >
                <span>{{ m[2] }}</span>
                <span>{{ m[1] }}</span>
              </button>
            </div>
          </div>
          <div class="field">
            <label>Monto recibido</label>
            <input v-model.number="paymentAmount" type="number" min="0" step="0.01" class="input" />
          </div>
          <div v-if="paymentMethod === 'cash' && paymentAmount > pos.cartTotal" class="change-row">
            <span>Cambio</span>
            <span class="change-amount">{{ fmt(paymentAmount - pos.cartTotal) }}</span>
          </div>
          <div v-if="error" class="error-bar">{{ error }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showPayment = false">Cancelar</button>
          <button class="btn btn-success btn-lg" @click="confirmSale" :disabled="processing || paymentAmount < pos.cartTotal">
            <span v-if="processing" class="spinner"></span>
            <span>{{ processing ? "Procesando..." : "Confirmar venta" }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main POS -->
    <div class="pos-left">
      <div class="pos-toolbar">
        <input v-model="search" class="input" placeholder="Buscar producto o código de barras..." style="max-width:320px" />
        <div v-if="success" class="badge badge-success">{{ success }}</div>
      </div>

      <div v-if="filtered.length === 0" class="empty">
        <div class="empty-icon">▣</div>
        <h3>Sin productos</h3>
        <p>Agrega productos en el módulo de Catálogo.</p>
      </div>

      <div class="product-grid">
        <button
          v-for="p in filtered"
          :key="p.id"
          class="product-card"
          @click="pos.addToCart(p, p.cost ?? 0)"
        >
          <div class="product-icon">{{ p.name[0].toUpperCase() }}</div>
          <div class="product-name">{{ p.name }}</div>
          <div class="product-price">{{ p.cost ? fmt(p.cost) : "—" }}</div>
          <div v-if="p.barcode" class="product-barcode">{{ p.barcode }}</div>
        </button>
      </div>
    </div>

    <div class="pos-right">
      <div class="cart-header">
        <h2>Carrito</h2>
        <span class="badge badge-primary">{{ pos.cartCount }} items</span>
      </div>

      <div v-if="pos.cart.length === 0" class="cart-empty">
        <span>⊕</span>
        <p>Agrega productos</p>
      </div>

      <div class="cart-items" v-else>
        <div v-for="item in pos.cart" :key="item.product.id" class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">{{ item.product.name }}</div>
            <div class="cart-item-price">{{ fmt(item.price) }}</div>
          </div>
          <div class="cart-item-controls">
            <button class="qty-btn" @click="pos.updateQuantity(item.product.id, item.quantity - 1)">−</button>
            <span class="qty-val">{{ item.quantity }}</span>
            <button class="qty-btn" @click="pos.updateQuantity(item.product.id, item.quantity + 1)">+</button>
          </div>
          <div class="cart-item-sub">{{ fmt(item.quantity * item.price) }}</div>
        </div>
      </div>

      <div class="cart-footer">
        <div class="cart-total-row">
          <span class="text-muted">Total</span>
          <span class="cart-total">{{ fmt(pos.cartTotal) }}</span>
        </div>
        <button
          class="btn btn-primary btn-block btn-lg"
          :disabled="!pos.cart.length || !pos.activeSession || pos.activeSession.status !== 'open'"
          @click="openPayment"
          style="margin-top:12px"
        >
          Cobrar
        </button>
        <div v-if="!pos.activeSession || pos.activeSession.status !== 'open'" class="hint-text">
          Abre una sesión de caja para cobrar
        </div>
        <button v-if="pos.cart.length" class="btn btn-ghost btn-sm btn-block" @click="pos.clearCart" style="margin-top:6px">
          Limpiar carrito
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
}

.pos-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.pos-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  overflow-y: auto;
  flex: 1;
  padding-bottom: 8px;
}

.product-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 12px;
  cursor: pointer;
  transition: all var(--transition);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-card:hover {
  border-color: var(--primary);
  background: var(--surface2);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.15);
}

.product-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.product-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}

.product-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
}

.product-barcode {
  font-size: 10px;
  color: var(--text-faint);
  font-family: monospace;
}

/* Cart */
.pos-right {
  width: 300px;
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cart-header {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cart-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-faint);
  font-size: 2rem;
}
.cart-empty p { font-size: 13px; }

.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cart-item {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 8px;
}

.cart-item-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cart-item-price {
  font-size: 11px;
  color: var(--text-muted);
}

.cart-item-sub {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  white-space: nowrap;
}

.cart-item-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.qty-btn {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--surface3);
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}
.qty-btn:hover { background: var(--primary); border-color: var(--primary); }

.qty-val {
  font-size: 13px;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.cart-footer {
  padding: 16px;
  border-top: 1px solid var(--border);
}

.cart-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cart-total {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text);
}

.hint-text {
  text-align: center;
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 6px;
}

/* Payment modal extras */
.payment-total {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--primary);
  text-align: center;
  margin: 10px 0 20px;
}

.pay-methods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
  cursor: pointer;
  transition: all var(--transition);
}
.pay-btn span:first-child { font-size: 20px; }
.pay-btn:hover { border-color: var(--primary); color: var(--text); }
.pay-btn.active { border-color: var(--primary); background: var(--primary-glow); color: var(--primary); }

.change-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--success-bg);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
}

.change-amount { color: var(--success); font-size: 1.1rem; }
</style>
