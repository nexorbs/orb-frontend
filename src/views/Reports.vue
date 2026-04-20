<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { salesApi } from "../api";
import { fmtDate, fmtDateOnly } from "../utils/date";
import type { SaleResponse } from "../api/types";
import { usePosStore } from "../stores/pos";

const pos = usePosStore();
const sales = ref<SaleResponse[]>([]);
const loading = ref(false);
const error = ref("");

onMounted(load);

async function load() {
  if (!pos.selectedStore) return;
  loading.value = true;
  error.value = "";
  try {
    sales.value = await salesApi.listByStore(pos.selectedStore.id);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

const completed = computed(() => sales.value.filter((s) => s.status === "completed"));
const totalRevenue = computed(() => completed.value.reduce((s, sale) => s + sale.total, 0));
const avgTicket = computed(() => completed.value.length ? totalRevenue.value / completed.value.length : 0);

// Group by date (using created_at if available, else first 10 chars of id as fallback)
const byDate = computed(() => {
  const map: Record<string, { count: number; total: number }> = {};
  for (const sale of completed.value) {
    const day = sale.created_at
      ? sale.created_at.slice(0, 10)
      : "Sin fecha";
    if (!map[day]) map[day] = { count: 0, total: 0 };
    map[day].count += 1;
    map[day].total += sale.total;
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14);
});

const maxDayTotal = computed(() =>
  byDate.value.reduce((m, [, d]) => Math.max(m, d.total), 0)
);

function barHeight(total: number) {
  if (!maxDayTotal.value) return "4px";
  return Math.max(4, (total / maxDayTotal.value) * 120) + "px";
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtChartDate(d: string) {
  if (d === "Sin fecha") return d;
  return new Date(d + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", month: "short", day: "numeric" });
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Reportes</h1>
        <p class="text-muted" style="font-size:13px;margin-top:2px">
          {{ pos.selectedStore?.name ?? "Sin sucursal" }}
        </p>
      </div>
      <button class="btn btn-secondary" @click="load" :disabled="loading">
        <span v-if="loading" class="spinner"></span>
        {{ loading ? "Cargando..." : "↻ Actualizar" }}
      </button>
    </div>

    <div v-if="!pos.selectedStore" class="empty">
      <div class="empty-icon">◌</div>
      <h3>Sin sucursal</h3>
      <p>Configura tu sucursal en el módulo de POS.</p>
    </div>

    <template v-else>
      <div v-if="error" class="error-bar">{{ error }}</div>

      <div v-if="loading" class="loading-center" style="height:200px">
        <div class="spinner"></div> Cargando datos...
      </div>

      <template v-else>
        <!-- KPI cards -->
        <div class="kpi-grid">
          <div class="kpi-card card">
            <div class="kpi-label">Ventas totales</div>
            <div class="kpi-val">{{ completed.length }}</div>
            <div class="kpi-sub">transacciones completadas</div>
          </div>
          <div class="kpi-card card">
            <div class="kpi-label">Ingresos totales</div>
            <div class="kpi-val kpi-primary">{{ fmt(totalRevenue) }}</div>
            <div class="kpi-sub">en ventas completadas</div>
          </div>
          <div class="kpi-card card">
            <div class="kpi-label">Ticket promedio</div>
            <div class="kpi-val">{{ fmt(avgTicket) }}</div>
            <div class="kpi-sub">por venta</div>
          </div>
          <div class="kpi-card card">
            <div class="kpi-label">Total registradas</div>
            <div class="kpi-val">{{ sales.length }}</div>
            <div class="kpi-sub">incluyendo canceladas</div>
          </div>
        </div>

        <!-- Revenue chart -->
        <div class="card" style="margin-top:20px" v-if="byDate.length > 0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h2>Ventas por día</h2>
            <span class="text-muted text-sm">Últimos {{ byDate.length }} días</span>
          </div>
          <div class="chart">
            <div v-for="[date, data] in byDate" :key="date" class="chart-bar-wrap">
              <div class="chart-bar-col">
                <div class="chart-val">{{ fmt(data.total) }}</div>
                <div class="chart-bar" :style="{ height: barHeight(data.total) }"></div>
              </div>
              <div class="chart-label">{{ fmtChartDate(date) }}</div>
            </div>
          </div>
        </div>

        <!-- Recent sales table -->
        <div class="card" style="padding:0;overflow:hidden;margin-top:20px" v-if="sales.length > 0">
          <div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <h2>Ventas recientes</h2>
            <span class="badge badge-neutral">{{ sales.length }} total</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sales.slice(0, 50)" :key="s.id">
                  <td>
                    <span class="mono" style="font-size:12px">{{ s.folio ?? s.id.slice(0, 8) + "..." }}</span>
                  </td>
                  <td>
                    <span class="badge" :class="s.status === 'completed' ? 'badge-success' : s.status === 'cancelled' ? 'badge-danger' : 'badge-warning'">
                      {{ s.status === "completed" ? "Completada" : s.status === "cancelled" ? "Cancelada" : s.status }}
                    </span>
                  </td>
                  <td class="mono" style="font-weight:700">{{ fmt(s.total) }}</td>
                  <td class="text-muted">{{ fmtDate(s.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="sales.length === 0" class="empty">
          <div class="empty-icon">◌</div>
          <h3>Sin ventas</h3>
          <p>Las ventas registradas aparecerán aquí.</p>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.kpi-val {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.2;
}

.kpi-primary { color: var(--primary); }

.kpi-sub {
  font-size: 12px;
  color: var(--text-faint);
}

/* Chart */
.chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  min-height: 160px;
}

.chart-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-width: 60px;
}

.chart-bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  height: 140px;
}

.chart-val {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}

.chart-bar {
  width: 36px;
  background: var(--primary);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  min-height: 4px;
  opacity: 0.85;
}

.chart-label {
  font-size: 10px;
  color: var(--text-faint);
  text-align: center;
  white-space: nowrap;
}
</style>
