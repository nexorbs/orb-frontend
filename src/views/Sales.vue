<script setup lang="ts">
import { ref, onMounted } from "vue";
import { salesApi } from "../api";
import type { SaleResponse, SaleDetailResponse } from "../api/types";
import { usePosStore } from "../stores/pos";

const pos = usePosStore();
const sales = ref<SaleResponse[]>([]);
const loading = ref(false);
const error = ref("");
const detail = ref<SaleDetailResponse | null>(null);
const loadingDetail = ref(false);

onMounted(load);

async function load() {
  if (!pos.selectedStore) return;
  loading.value = true;
  try {
    sales.value = await salesApi.listByStore(pos.selectedStore.id);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function viewDetail(id: string) {
  loadingDetail.value = true;
  detail.value = null;
  try {
    detail.value = await salesApi.getDetail(id);
  } finally {
    loadingDetail.value = false;
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function statusBadge(s: string) {
  return s === "completed" ? "badge-success" : s === "cancelled" ? "badge-danger" : "badge-warning";
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Ventas</h1>
        <p class="text-muted" style="font-size:13px;margin-top:2px">
          {{ pos.selectedStore?.name ?? "Sin sucursal" }}
        </p>
      </div>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div v-if="loading" class="loading-center" style="height:200px">
      <div class="spinner"></div> Cargando ventas...
    </div>

    <div v-else-if="!pos.selectedStore" class="empty">
      <div class="empty-icon">◇</div>
      <h3>Sin sucursal</h3>
      <p>Configura tu sucursal en el módulo de POS.</p>
    </div>

    <div v-else-if="sales.length === 0" class="empty">
      <div class="empty-icon">◇</div>
      <h3>Sin ventas</h3>
      <p>Las ventas realizadas aparecerán aquí.</p>
    </div>

    <div v-else class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sales" :key="s.id">
              <td>
                <span class="mono" style="font-size:12px">{{ s.folio ?? s.id.slice(0, 8) + "..." }}</span>
              </td>
              <td><span class="badge" :class="statusBadge(s.status)">{{ s.status }}</span></td>
              <td class="mono" style="font-weight:700">{{ fmt(s.total) }}</td>
              <td>
                <button class="btn btn-ghost btn-sm" @click="viewDetail(s.id)">Ver detalle</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="detail || loadingDetail" class="modal-overlay" @click.self="detail = null">
      <div class="modal" style="max-width:560px">
        <div v-if="loadingDetail" class="loading-center" style="height:120px">
          <div class="spinner"></div>
        </div>
        <template v-else-if="detail">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:20px">
            <div>
              <h2 class="modal-title" style="margin-bottom:4px">Detalle de venta</h2>
              <div class="mono text-muted" style="font-size:11px">{{ detail.sale.folio ?? detail.sale.id }}</div>
            </div>
            <span class="badge" :class="statusBadge(detail.sale.status)">{{ detail.sale.status }}</span>
          </div>

          <h3 style="margin-bottom:10px;color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Productos</h3>
          <div class="table-wrap" style="margin-bottom:16px">
            <table>
              <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
              <tbody>
                <tr v-for="item in detail.items" :key="item.id">
                  <td class="mono" style="font-size:11px">{{ item.product_id.slice(0,8) }}...</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ fmt(item.price) }}</td>
                  <td style="font-weight:700">{{ fmt(item.subtotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style="margin-bottom:10px;color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Pagos</h3>
          <div class="table-wrap" style="margin-bottom:20px">
            <table>
              <thead><tr><th>Método</th><th>Monto</th></tr></thead>
              <tbody>
                <tr v-for="p in detail.payments" :key="p.id">
                  <td>{{ p.method }}</td>
                  <td style="font-weight:700">{{ fmt(p.amount) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--border)">
            <span class="text-muted">Total</span>
            <span style="font-size:1.4rem;font-weight:800;color:var(--primary)">{{ fmt(detail.sale.total) }}</span>
          </div>
          <div class="modal-footer" style="margin-top:16px">
            <button class="btn btn-secondary" @click="detail = null">Cerrar</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
