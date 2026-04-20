<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { inventoryApi, catalogApi } from "../api";
import type { InventoryMovement, Product } from "../api/types";
import { usePosStore } from "../stores/pos";

const pos = usePosStore();
const movements = ref<InventoryMovement[]>([]);
const products = ref<Product[]>([]);
const loading = ref(false);
const error = ref("");
const showCreate = ref(false);
const processing = ref(false);
const view = ref<"stock" | "movements">("stock");

const form = ref({ product_id: "", type: "purchase", quantity: "" });

const TYPES = [
  { value: "purchase",   label: "Compra",     badge: "badge-success", group: "purchase" },
  { value: "return_in",  label: "Devolución", badge: "badge-info",    group: "return"   },
  { value: "return_out", label: "Devolución", badge: "badge-info",    group: "return"   },
  { value: "adjustment", label: "Ajuste",     badge: "badge-warning", group: "adjustment" },
  { value: "sale",       label: "Venta",      badge: "badge-danger",  group: "sale"     },
];

const RETURN_TABS = [
  { value: "return_in",  label: "Entrada" },
  { value: "return_out", label: "Salida"  },
];

const isReturn = computed(() => form.value.type === "return_in" || form.value.type === "return_out");

function selectGroup(group: string) {
  if (group === "return") {
    form.value.type = "return_in";
  } else {
    form.value.type = group === "purchase" ? "purchase"
                    : group === "adjustment" ? "adjustment"
                    : "sale";
  }
}

// Compute stock per product from movements
const stockMap = computed(() => {
  const map: Record<string, number> = {};
  for (const m of movements.value) {
    if (!(m.product_id in map)) map[m.product_id] = 0;
    map[m.product_id] += m.quantity;
  }
  return map;
});

const stockRows = computed(() =>
  products.value.map((p) => ({
    product: p,
    stock: stockMap.value[p.id] ?? 0,
  }))
);

function stockStatus(qty: number) {
  if (qty <= 0) return { label: "Sin stock", badge: "badge-danger", cls: "stock-out" };
  if (qty <= 10) return { label: "Stock bajo", badge: "badge-warning", cls: "stock-low" };
  return { label: "OK", badge: "badge-success", cls: "stock-ok" };
}

onMounted(load);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    products.value = await catalogApi.listProducts();
    if (pos.selectedStore) {
      movements.value = await inventoryApi.listByStore(pos.selectedStore.id);
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = { product_id: "", type: "purchase", quantity: "" };
  error.value = "";
  showCreate.value = true;
}

async function create() {
  if (!pos.selectedStore) return;
  processing.value = true;
  error.value = "";
  try {
    const m = await inventoryApi.createMovement({
      product_id: form.value.product_id,
      store_id: pos.selectedStore.id,
      type: form.value.type,
      quantity: parseFloat(form.value.quantity),
    });
    movements.value.unshift(m);
    showCreate.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function productName(id: string) {
  return products.value.find((p) => p.id === id)?.name ?? id.slice(0, 8) + "...";
}

function typeMeta(t: string) {
  if (t === "return_in")  return { label: "Dev. Entrada", badge: "badge-info" };
  if (t === "return_out") return { label: "Dev. Salida",  badge: "badge-info" };
  return TYPES.find((x) => x.value === t) ?? { label: t, badge: "badge-neutral" };
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Inventario</h1>
        <p class="text-muted" style="font-size:13px;margin-top:2px">
          {{ pos.selectedStore?.name ?? "Sin sucursal" }}
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-secondary btn-sm" @click="load" :disabled="loading">↻ Actualizar</button>
        <button class="btn btn-primary" @click="openCreate" :disabled="!pos.selectedStore">
          + Movimiento
        </button>
      </div>
    </div>

    <!-- View toggle -->
    <div class="tabs" style="margin-bottom:20px">
      <button class="tab" :class="{ active: view === 'stock' }" @click="view = 'stock'">
        Niveles de stock
      </button>
      <button class="tab" :class="{ active: view === 'movements' }" @click="view = 'movements'">
        Historial de movimientos
      </button>
    </div>

    <div v-if="error && !showCreate" class="error-bar">{{ error }}</div>

    <div v-if="loading" class="loading-center" style="height:200px">
      <div class="spinner"></div> Cargando...
    </div>

    <div v-else-if="!pos.selectedStore" class="empty">
      <div class="empty-icon">◫</div>
      <h3>Sin sucursal</h3>
      <p>Configura tu sucursal en el módulo de POS.</p>
    </div>

    <!-- Stock view -->
    <template v-else-if="view === 'stock'">
      <!-- Summary cards -->
      <div class="stock-summary">
        <div class="stock-stat card">
          <div class="stat-val">{{ stockRows.filter(r => r.stock > 10).length }}</div>
          <div class="stat-label">Con stock</div>
          <div class="stat-dot dot-ok"></div>
        </div>
        <div class="stock-stat card">
          <div class="stat-val" style="color:var(--warning)">{{ stockRows.filter(r => r.stock > 0 && r.stock <= 10).length }}</div>
          <div class="stat-label">Stock bajo</div>
          <div class="stat-dot dot-low"></div>
        </div>
        <div class="stock-stat card">
          <div class="stat-val" style="color:var(--danger)">{{ stockRows.filter(r => r.stock <= 0).length }}</div>
          <div class="stat-label">Sin stock</div>
          <div class="stat-dot dot-out"></div>
        </div>
      </div>

      <div v-if="products.length === 0" class="empty" style="margin-top:20px">
        <div class="empty-icon">◫</div>
        <h3>Sin productos</h3>
        <p>Agrega productos en el módulo de Productos.</p>
      </div>

      <div v-else class="card" style="padding:0;overflow:hidden;margin-top:16px">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th style="text-align:right">Stock actual</th>
                <th>Estado</th>
                <th>Acción rápida</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in stockRows"
                :key="row.product.id"
                :class="stockStatus(row.stock).cls"
              >
                <td>
                  <div class="flex items-center gap-2">
                    <div class="prod-mini-icon">{{ row.product.name[0].toUpperCase() }}</div>
                    <span style="font-weight:600">{{ row.product.name }}</span>
                  </div>
                </td>
                <td>
                  <span v-if="row.product.barcode" class="mono text-muted" style="font-size:11px">{{ row.product.barcode }}</span>
                  <span v-else class="text-faint">—</span>
                </td>
                <td style="text-align:right">
                  <span
                    class="stock-qty mono"
                    :style="{
                      color: row.stock <= 0 ? 'var(--danger)' : row.stock <= 10 ? 'var(--warning)' : 'var(--success)'
                    }"
                  >{{ row.stock }}</span>
                </td>
                <td>
                  <span class="badge" :class="stockStatus(row.stock).badge">
                    {{ stockStatus(row.stock).label }}
                  </span>
                </td>
                <td>
                  <button
                    class="btn btn-ghost btn-sm"
                    @click="form.product_id = row.product.id; form.type = 'purchase'; showCreate = true"
                  >+ Agregar stock</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Movements view -->
    <template v-else>
      <div v-if="movements.length === 0" class="empty">
        <div class="empty-icon">◫</div>
        <h3>Sin movimientos</h3>
        <p>Registra el primer movimiento de inventario.</p>
      </div>

      <div v-else class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Producto</th>
                <th style="text-align:right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movements" :key="m.id">
                <td>
                  <span class="badge" :class="typeMeta(m.type).badge">{{ typeMeta(m.type).label }}</span>
                </td>
                <td style="font-weight:500">{{ productName(m.product_id) }}</td>
                <td style="text-align:right">
                  <span
                    class="mono"
                    style="font-weight:700;font-size:13px"
                    :style="{ color: m.type === 'sale' ? 'var(--danger)' : 'var(--success)' }"
                  >
                    {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Create movement modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h2 class="modal-title">Nuevo movimiento</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Producto *</label>
            <select v-model="form.product_id" class="input">
              <option value="">Selecciona un producto...</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Tipo de movimiento</label>
            <div class="type-grid">
              <button class="type-btn" :class="{ active: form.type === 'purchase' }"   @click="selectGroup('purchase')"    type="button">Compra</button>
              <button class="type-btn" :class="{ active: isReturn }"                   @click="selectGroup('return')"      type="button">Devolución</button>
              <button class="type-btn" :class="{ active: form.type === 'adjustment' }" @click="selectGroup('adjustment')"  type="button">Ajuste</button>
              <button class="type-btn" :class="{ active: form.type === 'sale' }"       @click="selectGroup('sale')"        type="button">Venta</button>
            </div>
          </div>
          <div v-if="isReturn" class="field">
            <div class="return-tabs">
              <button
                v-for="tab in RETURN_TABS"
                :key="tab.value"
                class="return-tab"
                :class="{ active: form.type === tab.value }"
                @click="form.type = tab.value"
                type="button"
              >{{ tab.label }}</button>
            </div>
          </div>
          <div class="field">
            <label>Cantidad *</label>
            <input
              v-model="form.quantity"
              type="number"
              min="0.01"
              step="1"
              class="input"
              placeholder="0"
              @keydown.enter="create"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreate = false">Cancelar</button>
          <button
            class="btn btn-primary"
            @click="create"
            :disabled="processing || !form.product_id || !form.quantity"
          >
            <span v-if="processing" class="spinner"></span> Registrar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stock-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 4px;
}

.stock-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  overflow: hidden;
}

.stat-val {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
}

.stat-dot {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-ok { background: var(--success); }
.dot-low { background: var(--warning); }
.dot-out { background: var(--danger); }

.prod-mini-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stock-qty {
  font-size: 15px;
  font-weight: 800;
}

/* Row highlights */
tr.stock-out td { background: rgba(239, 68, 68, 0.04); }
tr.stock-low td { background: rgba(245, 158, 11, 0.04); }

.type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.type-btn {
  padding: 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
  font-weight: 500;
}

.type-btn:hover { border-color: var(--primary); color: var(--text); }
.type-btn.active { border-color: var(--primary); background: var(--primary-glow); color: var(--primary); font-weight: 600; }

.return-tabs {
  display: flex;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 3px;
  gap: 3px;
}

.return-tab {
  flex: 1;
  padding: 7px;
  border-radius: calc(var(--radius-sm) - 2px);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}
.return-tab:hover { color: var(--text); }
.return-tab.active { background: var(--surface); color: var(--primary); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }

.tabs {
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  width: fit-content;
}

.tab {
  padding: 7px 18px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.tab:hover { color: var(--text); }
.tab.active { background: var(--surface3); color: var(--text); font-weight: 600; }

.text-faint { color: var(--text-faint); }
</style>
