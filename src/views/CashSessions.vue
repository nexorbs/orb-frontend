<script setup lang="ts">
import { ref, onMounted } from "vue";
import { cashApi } from "../api";
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

async function closeSession() {
  if (!pos.activeSession) return;
  processing.value = true;
  error.value = "";
  try {
    const updated = await cashApi.closeSession(pos.activeSession.id, {
      closing_amount: closeAmount.value,
      expected_amount: pos.activeSession.opening_amount,
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

function openCloseModal() {
  closeAmount.value = 0;
  showClose.value = true;
}

function statusBadge(status: string) {
  return status === "open" ? "badge-success" : "badge-neutral";
}

function fmt(n: number | undefined) {
  if (n === undefined) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
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
      <div>
        <div class="session-banner-label">Sesión activa</div>
        <div class="session-banner-id">{{ pos.activeSession.id }}</div>
      </div>
      <div class="session-stat">
        <div class="session-stat-label">Apertura</div>
        <div class="session-stat-val">{{ fmt(pos.activeSession.opening_amount) }}</div>
      </div>
      <div class="session-stat">
        <div class="session-stat-label">Abierta</div>
        <div class="session-stat-val">{{ fmtDate(pos.activeSession.opened_at) }}</div>
      </div>
      <span class="badge badge-success">Abierta</span>
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
        <p>Abre la primera sesión de caja.</p>
      </div>

      <div v-else class="card" style="padding:0;overflow:hidden">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estado</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Monto apertura</th>
                <th>Monto cierre</th>
                <th>Abierta</th>
                <th>Cerrada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions" :key="s.id">
                <td><span class="badge" :class="statusBadge(s.status)">{{ s.status === 'open' ? 'Abierta' : 'Cerrada' }}</span></td>
                <td class="mono">{{ fmt(s.opening_amount) }}</td>
                <td class="mono">{{ fmt(s.closing_amount) }}</td>
                <td class="mono">{{ fmt(s.expected_amount) }}</td>
                <td class="mono">{{ fmt(s.closing_amount) }}</td>
                <td>{{ fmtDate(s.opened_at) }}</td>
                <td>{{ s.closed_at ? fmtDate(s.closed_at) : "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Open session modal -->
    <div v-if="showOpen" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Abrir caja</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Monto de apertura (MXN)</label>
            <input v-model.number="openAmount" type="number" min="0" step="0.01" class="input" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showOpen = false">Cancelar</button>
          <button class="btn btn-success" @click="openSession" :disabled="processing">
            <span v-if="processing" class="spinner"></span> Abrir
          </button>
        </div>
      </div>
    </div>

    <!-- Close session modal -->
    <div v-if="showClose" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Cerrar caja</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Monto de cierre (MXN)</label>
            <input v-model.number="closeAmount" type="number" min="0" step="0.01" class="input" />
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
}

.session-banner-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--success);
}

.session-banner-id {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  margin-top: 2px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-stat { flex: 1; }

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
</style>
