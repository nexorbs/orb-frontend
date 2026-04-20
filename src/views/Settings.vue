<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { iamApi, storesApi } from "../api";
import { fmtDate } from "../utils/date";
import type { User, Role, Store, Device } from "../api/types";

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const stores = ref<Store[]>([]);
const devices = ref<Device[]>([]);
const tab = ref<"stores" | "devices" | "users" | "roles">("stores");
const loading = ref(false);
const error = ref("");

const showCreateRole = ref(false);
const showCreateStore = ref(false);
const showCreateUser = ref(false);
const showCreateDevice = ref(false);
const processing = ref(false);

const roleForm = ref({ name: "" });
const storeForm = ref({ name: "", address: "" });
const userForm = ref({ name: "", first_surname: "", second_surname: "", email: "", password: "" });
const deviceForm = ref({ name: "", store_id: "" });
const selectedStoreForDevices = ref("");

onMounted(load);

async function load() {
  loading.value = true;
  try {
    [users.value, roles.value, stores.value] = await Promise.all([
      iamApi.listUsers(),
      iamApi.listRoles(),
      storesApi.list(),
    ]);
    if (stores.value.length > 0 && !selectedStoreForDevices.value) {
      selectedStoreForDevices.value = stores.value[0].id;
      await loadDevices(selectedStoreForDevices.value);
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadDevices(storeId: string) {
  if (!storeId) { devices.value = []; return; }
  try {
    devices.value = await storesApi.listDevices(storeId);
  } catch {
    devices.value = [];
  }
}

watch(selectedStoreForDevices, (id) => loadDevices(id));

async function createRole() {
  processing.value = true; error.value = "";
  try {
    const r = await iamApi.createRole(roleForm.value.name);
    roles.value.push(r);
    showCreateRole.value = false;
  } catch (e: any) { error.value = e.message; } finally { processing.value = false; }
}

async function createStore() {
  processing.value = true; error.value = "";
  try {
    const s = await storesApi.create(storeForm.value.name, storeForm.value.address || undefined);
    stores.value.push(s);
    if (stores.value.length === 1) selectedStoreForDevices.value = s.id;
    showCreateStore.value = false;
  } catch (e: any) { error.value = e.message; } finally { processing.value = false; }
}

async function createUser() {
  processing.value = true; error.value = "";
  try {
    const u = await iamApi.registerUser({ ...userForm.value, second_surname: userForm.value.second_surname || undefined });
    users.value.push(u);
    showCreateUser.value = false;
  } catch (e: any) { error.value = e.message; } finally { processing.value = false; }
}

async function createDevice() {
  if (!deviceForm.value.store_id) return;
  processing.value = true; error.value = "";
  try {
    const d = await storesApi.createDevice(deviceForm.value.store_id, deviceForm.value.name);
    if (deviceForm.value.store_id === selectedStoreForDevices.value) {
      devices.value.push(d);
    }
    showCreateDevice.value = false;
  } catch (e: any) { error.value = e.message; } finally { processing.value = false; }
}

function openCreateDevice() {
  deviceForm.value = { name: "", store_id: selectedStoreForDevices.value };
  error.value = "";
  showCreateDevice.value = true;
}

</script>

<template>
  <div>
    <div class="page-header">
      <h1>Configuración</h1>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'stores' }" @click="tab = 'stores'">Sucursales</button>
      <button class="tab" :class="{ active: tab === 'devices' }" @click="tab = 'devices'">Dispositivos</button>
      <button class="tab" :class="{ active: tab === 'users' }" @click="tab = 'users'">Usuarios</button>
      <button class="tab" :class="{ active: tab === 'roles' }" @click="tab = 'roles'">Roles</button>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>
    <div v-if="loading" class="loading-center" style="height:200px"><div class="spinner"></div></div>

    <!-- Stores -->
    <template v-else-if="tab === 'stores'">
      <div class="page-header" style="margin-bottom:14px">
        <h3 style="color:var(--text-muted)">{{ stores.length }} sucursales</h3>
        <button class="btn btn-primary btn-sm" @click="showCreateStore = true">+ Sucursal</button>
      </div>
      <div v-if="stores.length === 0" class="empty">
        <div class="empty-icon">◎</div>
        <h3>Sin sucursales</h3>
        <p>Crea la primera sucursal.</p>
      </div>
      <div v-else class="card" style="padding:0;overflow:hidden">
        <table>
          <thead><tr><th>Nombre</th><th>Dirección</th><th>Creada</th></tr></thead>
          <tbody>
            <tr v-for="s in stores" :key="s.id">
              <td>
                <div class="flex items-center gap-2">
                  <div class="store-icon">{{ s.name[0].toUpperCase() }}</div>
                  <span style="font-weight:600">{{ s.name }}</span>
                </div>
              </td>
              <td class="text-muted">{{ s.address ?? "—" }}</td>
              <td class="text-muted">{{ fmtDate(s.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Devices -->
    <template v-else-if="tab === 'devices'">
      <div class="page-header" style="margin-bottom:14px">
        <div class="flex items-center gap-3">
          <h3 style="color:var(--text-muted)">Dispositivos de</h3>
          <select v-model="selectedStoreForDevices" class="input" style="width:200px;padding:6px 10px">
            <option v-for="s in stores" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <button class="btn btn-primary btn-sm" @click="openCreateDevice" :disabled="!selectedStoreForDevices">+ Dispositivo</button>
      </div>

      <div v-if="stores.length === 0" class="empty">
        <div class="empty-icon">◈</div>
        <h3>Sin sucursales</h3>
        <p>Crea una sucursal primero.</p>
      </div>
      <div v-else-if="devices.length === 0" class="empty">
        <div class="empty-icon">◈</div>
        <h3>Sin dispositivos</h3>
        <p>Agrega el primer dispositivo (caja) a esta sucursal.</p>
        <button class="btn btn-primary" style="margin-top:14px" @click="openCreateDevice">+ Agregar dispositivo</button>
      </div>
      <div v-else class="card" style="padding:0;overflow:hidden">
        <table>
          <thead><tr><th>Nombre</th><th>Sucursal</th><th>Creado</th></tr></thead>
          <tbody>
            <tr v-for="d in devices" :key="d.id">
              <td>
                <div class="flex items-center gap-2">
                  <div class="device-icon">◈</div>
                  <span style="font-weight:600">{{ d.name }}</span>
                </div>
              </td>
              <td class="text-muted">{{ stores.find(s => s.id === d.store_id)?.name ?? "—" }}</td>
              <td class="text-muted">{{ fmtDate(d.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Users -->
    <template v-else-if="tab === 'users'">
      <div class="page-header" style="margin-bottom:14px">
        <h3 style="color:var(--text-muted)">{{ users.length }} usuarios</h3>
        <button class="btn btn-primary btn-sm" @click="showCreateUser = true">+ Usuario</button>
      </div>
      <div v-if="users.length === 0" class="empty">
        <div class="empty-icon">◉</div>
        <h3>Sin usuarios</h3>
      </div>
      <div v-else class="card" style="padding:0;overflow:hidden">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Registrado</th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>
                <div class="flex items-center gap-2">
                  <div class="user-mini-avatar">{{ u.name[0].toUpperCase() }}</div>
                  <span style="font-weight:600">{{ u.name }} {{ u.first_surname }}</span>
                </div>
              </td>
              <td class="text-muted">{{ u.email }}</td>
              <td class="text-muted">{{ fmtDate(u.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Roles -->
    <template v-else-if="tab === 'roles'">
      <div class="page-header" style="margin-bottom:14px">
        <h3 style="color:var(--text-muted)">{{ roles.length }} roles</h3>
        <button class="btn btn-primary btn-sm" @click="showCreateRole = true">+ Rol</button>
      </div>
      <div v-if="roles.length === 0" class="empty">
        <div class="empty-icon">◎</div>
        <h3>Sin roles</h3>
      </div>
      <div v-else class="roles-grid">
        <div v-for="r in roles" :key="r.id" class="role-card card card-sm">
          <div class="role-icon">◎</div>
          <div>
            <div style="font-weight:600;font-size:14px">{{ r.name }}</div>
            <div class="text-muted text-sm">Creado {{ fmtDate(r.created_at) }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Modals ── -->

    <div v-if="showCreateStore" class="modal-overlay" @click.self="showCreateStore = false">
      <div class="modal">
        <h2 class="modal-title">Nueva sucursal</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field"><label>Nombre *</label><input v-model="storeForm.name" class="input" placeholder="Sucursal Centro" @keydown.enter="createStore" /></div>
          <div class="field"><label>Dirección</label><input v-model="storeForm.address" class="input" placeholder="Av. Juárez 123" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateStore = false">Cancelar</button>
          <button class="btn btn-primary" @click="createStore" :disabled="processing || !storeForm.name">
            <span v-if="processing" class="spinner"></span> Crear
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCreateDevice" class="modal-overlay" @click.self="showCreateDevice = false">
      <div class="modal">
        <h2 class="modal-title">Nuevo dispositivo</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Sucursal *</label>
            <select v-model="deviceForm.store_id" class="input">
              <option value="">Selecciona...</option>
              <option v-for="s in stores" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Nombre del dispositivo *</label>
            <input v-model="deviceForm.name" class="input" placeholder="Caja 1" @keydown.enter="createDevice" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateDevice = false">Cancelar</button>
          <button class="btn btn-primary" @click="createDevice" :disabled="processing || !deviceForm.name || !deviceForm.store_id">
            <span v-if="processing" class="spinner"></span> Crear
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCreateRole" class="modal-overlay" @click.self="showCreateRole = false">
      <div class="modal">
        <h2 class="modal-title">Nuevo rol</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field"><label>Nombre *</label><input v-model="roleForm.name" class="input" placeholder="admin, cajero..." @keydown.enter="createRole" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateRole = false">Cancelar</button>
          <button class="btn btn-primary" @click="createRole" :disabled="processing || !roleForm.name">
            <span v-if="processing" class="spinner"></span> Crear
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCreateUser" class="modal-overlay" @click.self="showCreateUser = false">
      <div class="modal">
        <h2 class="modal-title">Nuevo usuario</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="field"><label>Nombre *</label><input v-model="userForm.name" class="input" placeholder="Juan" /></div>
            <div class="field"><label>Apellido paterno *</label><input v-model="userForm.first_surname" class="input" placeholder="García" /></div>
          </div>
          <div class="field"><label>Apellido materno</label><input v-model="userForm.second_surname" class="input" placeholder="López" /></div>
          <div class="field"><label>Correo *</label><input v-model="userForm.email" type="email" class="input" placeholder="juan@ejemplo.com" /></div>
          <div class="field"><label>Contraseña *</label><input v-model="userForm.password" type="password" class="input" placeholder="••••••••" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateUser = false">Cancelar</button>
          <button class="btn btn-primary" @click="createUser" :disabled="processing || !userForm.name || !userForm.email || !userForm.password">
            <span v-if="processing" class="spinner"></span> Crear
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  margin-bottom: 20px;
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

.store-icon, .device-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-mini-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.role-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.role-icon {
  font-size: 18px;
  color: var(--primary);
  flex-shrink: 0;
}
</style>
