<script setup lang="ts">
import { ref, onMounted } from "vue";
import { iamApi, storesApi } from "../api";
import type { User, Role, Store } from "../api/types";

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const stores = ref<Store[]>([]);
const tab = ref<"users" | "roles" | "stores">("stores");
const loading = ref(false);
const error = ref("");

// Modals
const showCreateRole = ref(false);
const showCreateStore = ref(false);
const showCreateUser = ref(false);
const processing = ref(false);

const roleForm = ref({ name: "" });
const storeForm = ref({ name: "", address: "" });
const userForm = ref({ name: "", first_surname: "", second_surname: "", email: "", password: "" });

onMounted(load);

async function load() {
  loading.value = true;
  try {
    [users.value, roles.value, stores.value] = await Promise.all([
      iamApi.listUsers(),
      iamApi.listRoles(),
      storesApi.list(),
    ]);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function createRole() {
  processing.value = true;
  error.value = "";
  try {
    const r = await iamApi.createRole(roleForm.value.name);
    roles.value.push(r);
    showCreateRole.value = false;
  } catch (e: any) { error.value = e.message; } finally { processing.value = false; }
}

async function createStore() {
  processing.value = true;
  error.value = "";
  try {
    const s = await storesApi.create(storeForm.value.name, storeForm.value.address || undefined);
    stores.value.push(s);
    showCreateStore.value = false;
  } catch (e: any) { error.value = e.message; } finally { processing.value = false; }
}

async function createUser() {
  processing.value = true;
  error.value = "";
  try {
    const u = await iamApi.registerUser({ ...userForm.value, second_surname: userForm.value.second_surname || undefined });
    users.value.push(u);
    showCreateUser.value = false;
  } catch (e: any) { error.value = e.message; } finally { processing.value = false; }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-MX", { dateStyle: "medium" });
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Configuración</h1>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'stores' }" @click="tab = 'stores'">Sucursales</button>
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
      <div class="card" style="padding:0;overflow:hidden" v-if="stores.length">
        <table>
          <thead><tr><th>Nombre</th><th>Dirección</th><th>Creada</th></tr></thead>
          <tbody>
            <tr v-for="s in stores" :key="s.id">
              <td style="font-weight:600">{{ s.name }}</td>
              <td class="text-muted">{{ s.address ?? "—" }}</td>
              <td class="text-muted">{{ fmtDate(s.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty"><div class="empty-icon">◎</div><h3>Sin sucursales</h3></div>
    </template>

    <!-- Users -->
    <template v-else-if="tab === 'users'">
      <div class="page-header" style="margin-bottom:14px">
        <h3 style="color:var(--text-muted)">{{ users.length }} usuarios</h3>
        <button class="btn btn-primary btn-sm" @click="showCreateUser = true">+ Usuario</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden" v-if="users.length">
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Registrado</th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td style="font-weight:600">{{ u.name }} {{ u.first_surname }}</td>
              <td class="text-muted">{{ u.email }}</td>
              <td class="text-muted">{{ fmtDate(u.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty"><div class="empty-icon">◉</div><h3>Sin usuarios</h3></div>
    </template>

    <!-- Roles -->
    <template v-else-if="tab === 'roles'">
      <div class="page-header" style="margin-bottom:14px">
        <h3 style="color:var(--text-muted)">{{ roles.length }} roles</h3>
        <button class="btn btn-primary btn-sm" @click="showCreateRole = true">+ Rol</button>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap" v-if="roles.length">
        <span v-for="r in roles" :key="r.id" class="badge badge-primary" style="padding:6px 14px;font-size:13px">
          {{ r.name }}
        </span>
      </div>
      <div v-else class="empty"><div class="empty-icon">◎</div><h3>Sin roles</h3></div>
    </template>

    <!-- Modals -->
    <div v-if="showCreateStore" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Nueva sucursal</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field"><label>Nombre *</label><input v-model="storeForm.name" class="input" placeholder="Sucursal Centro" /></div>
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

    <div v-if="showCreateRole" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Nuevo rol</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field"><label>Nombre *</label><input v-model="roleForm.name" class="input" placeholder="admin" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateRole = false">Cancelar</button>
          <button class="btn btn-primary" @click="createRole" :disabled="processing || !roleForm.name">
            <span v-if="processing" class="spinner"></span> Crear
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCreateUser" class="modal-overlay">
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
</style>
