<script setup lang="ts">
import { ref, onMounted } from "vue";
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

const form = ref({ product_id: "", type: "purchase", quantity: "" });

const TYPES = [
  { value: "purchase", label: "Compra", badge: "badge-success" },
  { value: "sale", label: "Venta", badge: "badge-danger" },
  { value: "adjustment", label: "Ajuste", badge: "badge-warning" },
  { value: "return", label: "Devolución", badge: "badge-info" },
];

onMounted(load);

async function load() {
  loading.value = true;
  try {
    [products.value] = await Promise.all([catalogApi.listProducts()]);
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

function typeBadge(t: string) {
  return TYPES.find((x) => x.value === t)?.badge ?? "badge-neutral";
}

function typeLabel(t: string) {
  return TYPES.find((x) => x.value === t)?.label ?? t;
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
      <button class="btn btn-primary" @click="openCreate" :disabled="!pos.selectedStore">
        + Movimiento
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

    <div v-else-if="movements.length === 0" class="empty">
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
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in movements" :key="m.id">
              <td>
                <span class="badge" :class="typeBadge(m.type)">{{ typeLabel(m.type) }}</span>
              </td>
              <td>{{ productName(m.product_id) }}</td>
              <td class="mono" style="font-weight:700">
                <span :style="{ color: m.type === 'sale' ? 'var(--danger)' : 'var(--success)' }">
                  {{ m.type === 'sale' ? '-' : '+' }}{{ m.quantity }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Nuevo movimiento</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Producto *</label>
            <select v-model="form.product_id" class="input">
              <option value="">Selecciona...</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Tipo</label>
            <div class="type-grid">
              <button
                v-for="t in TYPES"
                :key="t.value"
                class="type-btn"
                :class="{ active: form.type === t.value }"
                @click="form.type = t.value"
                type="button"
              >{{ t.label }}</button>
            </div>
          </div>
          <div class="field">
            <label>Cantidad *</label>
            <input v-model="form.quantity" type="number" min="0.01" step="0.01" class="input" placeholder="0" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreate = false">Cancelar</button>
          <button class="btn btn-primary" @click="create" :disabled="processing || !form.product_id || !form.quantity">
            <span v-if="processing" class="spinner"></span> Registrar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.type-btn {
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
}

.type-btn:hover { border-color: var(--primary); color: var(--text); }
.type-btn.active { border-color: var(--primary); background: var(--primary-glow); color: var(--primary); font-weight: 600; }
</style>
