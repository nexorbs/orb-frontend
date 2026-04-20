<script setup lang="ts">
import { ref, onMounted } from "vue";
import { customersApi } from "../api";
import type { Customer } from "../api/types";

const customers = ref<Customer[]>([]);
const loading = ref(false);
const error = ref("");
const showCreate = ref(false);
const processing = ref(false);

const form = ref({ name: "", phone: "", email: "" });

onMounted(load);

async function load() {
  loading.value = true;
  try {
    customers.value = await customersApi.list();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = { name: "", phone: "", email: "" };
  error.value = "";
  showCreate.value = true;
}

async function create() {
  processing.value = true;
  error.value = "";
  try {
    const c = await customersApi.create({
      name: form.value.name,
      phone: form.value.phone || undefined,
      email: form.value.email || undefined,
    });
    customers.value.unshift(c);
    showCreate.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Clientes</h1>
      <button class="btn btn-primary" @click="openCreate">+ Nuevo cliente</button>
    </div>

    <div v-if="error && !showCreate" class="error-bar">{{ error }}</div>

    <div v-if="loading" class="loading-center" style="height:200px">
      <div class="spinner"></div> Cargando...
    </div>

    <div v-else-if="customers.length === 0" class="empty">
      <div class="empty-icon">◉</div>
      <h3>Sin clientes</h3>
      <p>Registra el primer cliente.</p>
    </div>

    <div v-else class="customer-list">
      <div v-for="c in customers" :key="c.id" class="customer-row card card-sm">
        <div class="customer-avatar">{{ initials(c.name) }}</div>
        <div class="customer-info">
          <div class="customer-name">{{ c.name }}</div>
          <div class="customer-meta">
            <span v-if="c.phone" class="text-muted">📞 {{ c.phone }}</span>
            <span v-if="c.email" class="text-muted">✉ {{ c.email }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Nuevo cliente</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Nombre *</label>
            <input v-model="form.name" class="input" placeholder="Juan García" required />
          </div>
          <div class="field">
            <label>Teléfono</label>
            <input v-model="form.phone" class="input" placeholder="8112345678" />
          </div>
          <div class="field">
            <label>Correo electrónico</label>
            <input v-model="form.email" type="email" class="input" placeholder="juan@ejemplo.com" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreate = false">Cancelar</button>
          <button class="btn btn-primary" @click="create" :disabled="processing || !form.name">
            <span v-if="processing" class="spinner"></span> Crear
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.customer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.customer-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.customer-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.customer-name {
  font-weight: 600;
  font-size: 14px;
}

.customer-meta {
  display: flex;
  gap: 14px;
  margin-top: 2px;
  font-size: 12px;
}
</style>
