<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { cashApi, salesApi } from "../api";
import { fmtDate } from "../utils/date";
import type { CashSession } from "../api/types";
import { usePosStore } from "../stores/pos";
import { useAuthStore } from "../stores/auth";

const pos = usePosStore();
const auth = useAuthStore();

const sessions = ref<CashSession[]>([]);
const loading = ref(false);
const error = ref("");
const showOpen = ref(false);
const showClose = ref(false);
const openAmount = ref(500);
const closeAmount = ref(0);
const processing = ref(false);

// For expected amount on close
const salesTotal = ref(0);
const loadingSales = ref(false);

const expectedOnClose = computed(() =>
  (pos.activeSession?.opening_amount ?? 0) + salesTotal.value
);

const closeDiff = computed(() => closeAmount.value - expectedOnClose.value);

onMounted(load);

async function load() {
  if (!pos.selectedStore) return;
  loading.value = true;
  try {
    sessions.value = await cashApi.listByStore(pos.selectedStore.id);
    const open = sessions.value.find((s) => s.status === "open");
    if (open) pos.setSession(open);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function openSession() {
  if (!pos.selectedStore || !pos.selectedDevice) return;
  processing.value = true;
  error.value = "";
  try {
    const session = await cashApi.openSession({
      store_id: pos.selectedStore.id,
      user_id: auth.user?.sub ?? "",
      device_id: pos.selectedDevice.id,
      opening_amount: openAmount.value,
    });
    pos.setSession(session);
    sessions.value.unshift(session);
    showOpen.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

async function openCloseModal() {
  closeAmount.value = 0;
  salesTotal.value = 0;
  showClose.value = true;
  // Load sales to compute expected
  if (pos.selectedStore) {
    loadingSales.value = true;
    try {
      const allSales = await salesApi.listByStore(pos.selectedStore.id);
      const openedAt = pos.activeSession?.opened_at ?? "";
      const sessionSales = allSales.filter(
        (s) => s.status === "completed" && (!openedAt || !s.created_at || s.created_at >= openedAt)
      );
      salesTotal.value = sessionSales.reduce((sum, s) => sum + s.total, 0);
    } catch {
      salesTotal.value = 0;
    } finally {
      loadingSales.value = false;
    }
  }
}

async function closeSession() {
  if (!pos.activeSession) return;
  processing.value = true;
  error.value = "";
  try {
    const updated = await cashApi.closeSession(pos.activeSession.id, {
      closing_amount: closeAmount.value,
      expected_amount: expectedOnClose.value,
    });
    pos.setSession(null);
    const idx = sessions.value.findIndex((s) => s.id === updated.id);
    if (idx !== -1) sessions.value[idx] = updated;
    showClose.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function statusBadge(status: string) {
  return status === "open" ? "badge-success" : "badge-neutral";
}

function fmt(n: number | undefined) {
  if (n === undefined) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Caja</h1>
        <p class="text-muted" style="font-size:13px;margin-top:2px">
          {{ pos.selectedStore?.name ?? "Sin sucursal seleccionada" }}
        </p>
      </div>
      <div class="flex gap-2">
        <button
          v-if="pos.activeSession"
          class="btn btn-danger"
          @click="openCloseModal"
        >Cerrar caja</button>
        <button
          v-else
          class="btn btn-success"
          @click="showOpen = true"
          :disabled="!pos.selectedStore || !pos.selectedDevice"
        >Abrir caja</button>
      </div>
    </div>

    <!-- Active session banner -->
    <div v-if="pos.activeSession" class="session-banner">
      <div class="flex items-center gap-2">
        <div class="session-pulse"></div>
        <div>
          <div class="session-banner-label">Sesión activa</div>
          <div class="session-banner-id mono">{{ pos.activeSession.id.slice(0, 12) }}...</div>
        </div>
      </div>
      <div class="session-stat">
        <div class="session-stat-label">Monto apertura</div>
        <div class="session-stat-val">{{ fmt(pos.activeSession.opening_amount) }}</div>
      </div>
      <div class="session-stat">
        <div class="session-stat-label">Abierta</div>
        <div class="session-stat-val" style="font-size:13px">{{ fmtDate(pos.activeSession.opened_at) }}</div>
      </div>
      <span class="badge badge-success" style="font-size:12px;padding:4px 12px">Abierta</span>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div v-if="loading" class="loading-center" style="height:200px">
      <div class="spinner"></div> Cargando sesiones...
    </div>

    <div v-else>
      <div v-if="!pos.selectedStore" class="empty">
        <div class="empty-icon">◈</div>
        <h3>Sin sucursal</h3>
        <p>Configura tu sucursal en el módulo de Punto de Venta.</p>
      </div>

      <div v-else-if="sessions.length === 0" class="empty">
        <div class="empty-icon">◈</div>
        <h3>Sin sesiones</h3>
        <p>Abre la primera sesión de caja para comenzar a vender.</p>
        <button class="btn btn-success" style="margin-top:14px" @click="showOpen = true" :disabled="!pos.selectedDevice">
          Abrir caja
        </button>
      </div>

      <div v-else class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Diferencia</th>
                <th>Abierta</th>
                <th>Cerrada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions" :key="s.id">
                <td>
                  <span class="badge" :class="statusBadge(s.status)">
                    {{ s.status === 'open' ? 'Abierta' : 'Cerrada' }}
                  </span>
                </td>
                <td class="mono" style="font-weight:600">{{ fmt(s.opening_amount) }}</td>
                <td class="mono" style="font-weight:600">{{ fmt(s.closing_amount) }}</td>
                <td>
                  <template v-if="s.closing_amount !== undefined && s.expected_amount !== undefined">
                    <span
                      class="mono diff-badge"
                      :class="s.closing_amount >= s.expected_amount ? 'diff-pos' : 'diff-neg'"
                    >
                      {{ s.closing_amount >= s.expected_amount ? '+' : '' }}{{ fmt(s.closing_amount - s.expected_amount) }}
                    </span>
                  </template>
                  <span v-else class="text-faint">—</span>
                </td>
                <td class="text-muted">{{ fmtDate(s.opened_at) }}</td>
                <td class="text-muted">{{ s.closed_at ? fmtDate(s.closed_at) : "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Open session modal -->
    <div v-if="showOpen" class="modal-overlay" @click.self="showOpen = false">
      <div class="modal">
        <h2 class="modal-title">Abrir caja</h2>
        <p class="text-muted" style="margin-bottom:18px;font-size:13px">
          Ingresa el efectivo inicial en la caja.
        </p>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Monto de apertura (MXN)</label>
            <input
              v-model.number="openAmount"
              type="number"
              min="0"
              step="0.01"
              class="input"
              style="font-size:1.3rem;font-weight:700;text-align:right"
              @keydown.enter="openSession"
            />
          </div>
          <div class="quick-amounts">
            <button v-for="amt in [200, 500, 1000, 2000]" :key="amt" class="quick-btn" @click="openAmount = amt" type="button">
              {{ fmt(amt) }}
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showOpen = false">Cancelar</button>
          <button class="btn btn-success" @click="openSession" :disabled="processing">
            <span v-if="processing" class="spinner"></span> Abrir caja
          </button>
        </div>
      </div>
    </div>

    <!-- Close session modal -->
    <div v-if="showClose" class="modal-overlay" @click.self="showClose = false">
      <div class="modal">
        <h2 class="modal-title">Cerrar caja</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>

          <!-- Session stats -->
          <div class="close-stats">
            <div class="close-stat">
              <div class="close-stat-label">Apertura</div>
              <div class="close-stat-val">{{ fmt(pos.activeSession?.opening_amount) }}</div>
            </div>
            <div class="close-stat">
              <div class="close-stat-label">Ventas en sesión</div>
              <div class="close-stat-val" style="color:var(--success)">
                <span v-if="loadingSales" class="spinner" style="width:14px;height:14px"></span>
                <span v-else>{{ fmt(salesTotal) }}</span>
              </div>
            </div>
            <div class="close-stat">
              <div class="close-stat-label">Esperado en caja</div>
              <div class="close-stat-val" style="color:var(--primary)">{{ fmt(expectedOnClose) }}</div>
            </div>
          </div>

          <div class="field">
            <label>Efectivo real en caja (MXN)</label>
            <input
              v-model.number="closeAmount"
              type="number"
              min="0"
              step="0.01"
              class="input"
              style="font-size:1.3rem;font-weight:700;text-align:right"
              @keydown.enter="closeSession"
            />
          </div>

          <!-- Difference -->
          <div v-if="closeAmount > 0" class="diff-row" :class="closeDiff >= 0 ? 'diff-surplus' : 'diff-short'">
            <span>{{ closeDiff >= 0 ? 'Sobrante' : 'Faltante' }}</span>
            <span class="diff-val">
              {{ closeDiff >= 0 ? '+' : '' }}{{ fmt(closeDiff) }}
            </span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showClose = false">Cancelar</button>
          <button class="btn btn-danger" @click="closeSession" :disabled="processing">
            <span v-if="processing" class="spinner"></span> Cerrar caja
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-banner {
  display: flex;
  align-items: center;
  gap: 24px;
  background: var(--success-bg);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: var(--radius);
  padding: 16px 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.session-pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
  animation: pulse 2s infinite;
  flex-shrink: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.session-banner-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--success);
}

.session-banner-id {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.session-stat { flex: 1; min-width: 100px; }

.session-stat-label {
  font-size: 11px;
  color: var(--text-muted);
}

.session-stat-val {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin-top: 2px;
}

/* Diff badge in table */
.diff-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}

.diff-pos { background: var(--success-bg); color: var(--success); }
.diff-neg { background: var(--danger-bg); color: var(--danger); }

/* Close modal stats */
.close-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px;
  margin-bottom: 4px;
}

.close-stat-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 4px;
}

.close-stat-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

/* Diff row */
.diff-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
}

.diff-surplus { background: var(--success-bg); color: var(--success); }
.diff-short { background: var(--danger-bg); color: var(--danger); }

.diff-val { font-size: 1.1rem; font-weight: 800; }

/* Quick amounts */
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

.text-faint { color: var(--text-faint); }
</style>
