<script setup lang="ts">
import { ref, onMounted } from "vue";
import { catalogApi } from "../api";
import type { Category } from "../api/types";

const categories = ref<Category[]>([]);
const loading = ref(false);
const error = ref("");
const showCreate = ref(false);
const processing = ref(false);
const form = ref({ name: "" });
const nameInput = ref<HTMLInputElement | null>(null);

onMounted(load);

async function load() {
  loading.value = true;
  try {
    categories.value = await catalogApi.listCategories();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  form.value = { name: "" };
  error.value = "";
  showCreate.value = true;
  setTimeout(() => nameInput.value?.focus(), 60);
}

async function create() {
  if (!form.value.name.trim()) return;
  processing.value = true;
  error.value = "";
  try {
    const c = await catalogApi.createCategory(form.value.name.trim());
    categories.value.push(c);
    showCreate.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-MX", { dateStyle: "medium" });
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Categorías</h1>
        <p class="text-muted" style="font-size:13px;margin-top:2px">Organiza tus productos por categoría</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ Nueva categoría</button>
    </div>

    <div v-if="error && !showCreate" class="error-bar">{{ error }}</div>

    <div v-if="loading" class="loading-center" style="height:200px">
      <div class="spinner"></div> Cargando...
    </div>

    <div v-else-if="categories.length === 0" class="empty">
      <div class="empty-icon">⊞</div>
      <h3>Sin categorías</h3>
      <p>Crea la primera categoría para organizar tu catálogo.</p>
      <button class="btn btn-primary" style="margin-top:14px" @click="openCreate">Crear categoría</button>
    </div>

    <div v-else class="cat-grid">
      <div v-for="c in categories" :key="c.id" class="cat-card card">
        <div class="cat-icon">{{ c.name[0].toUpperCase() }}</div>
        <div class="cat-info">
          <div class="cat-name">{{ c.name }}</div>
          <div class="cat-date text-muted text-sm">Creada {{ fmtDate(c.created_at) }}</div>
        </div>
        <span class="badge badge-primary">Activa</span>
      </div>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h2 class="modal-title">Nueva categoría</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Nombre *</label>
            <input
              ref="nameInput"
              v-model="form.name"
              class="input"
              placeholder="Bebidas, Lácteos, Carnes..."
              @keydown.enter="create"
              @keydown.escape="showCreate = false"
              required
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreate = false">Cancelar</button>
          <button class="btn btn-primary" @click="create" :disabled="processing || !form.name.trim()">
            <span v-if="processing" class="spinner"></span> Crear
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

.cat-card {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cat-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cat-info { flex: 1; min-width: 0; }

.cat-name {
  font-weight: 600;
  font-size: 14px;
}
</style>
