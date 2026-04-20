<script setup lang="ts">
import { ref, onMounted } from "vue";
import { catalogApi } from "../api";
import type { Product, Category } from "../api/types";

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(false);
const error = ref("");
const showCreate = ref(false);
const processing = ref(false);

const form = ref({ name: "", barcode: "", description: "", cost: "" });

onMounted(async () => {
  loading.value = true;
  try {
    [products.value, categories.value] = await Promise.all([
      catalogApi.listProducts(),
      catalogApi.listCategories(),
    ]);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});

function openCreate() {
  form.value = { name: "", barcode: "", description: "", cost: "" };
  error.value = "";
  showCreate.value = true;
}

async function create() {
  processing.value = true;
  error.value = "";
  try {
    const p = await catalogApi.createProduct({
      name: form.value.name,
      barcode: form.value.barcode || undefined,
      description: form.value.description || undefined,
      cost: form.value.cost ? parseFloat(form.value.cost) : undefined,
    });
    products.value.unshift(p);
    showCreate.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function fmt(n?: number) {
  if (n === undefined) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Productos</h1>
      <button class="btn btn-primary" @click="openCreate">+ Nuevo producto</button>
    </div>

    <div v-if="error && !showCreate" class="error-bar">{{ error }}</div>

    <div v-if="loading" class="loading-center" style="height:200px">
      <div class="spinner"></div> Cargando...
    </div>

    <div v-else-if="products.length === 0" class="empty">
      <div class="empty-icon">▣</div>
      <h3>Sin productos</h3>
      <p>Crea el primer producto del catálogo.</p>
    </div>

    <div v-else class="product-list">
      <div v-for="p in products" :key="p.id" class="product-row card card-sm">
        <div class="product-row-icon">{{ p.name[0].toUpperCase() }}</div>
        <div class="product-row-info">
          <div class="product-row-name">{{ p.name }}</div>
          <div class="product-row-meta">
            <span v-if="p.barcode" class="mono text-muted" style="font-size:11px">{{ p.barcode }}</span>
            <span v-if="p.description" class="text-muted" style="font-size:12px">{{ p.description }}</span>
          </div>
        </div>
        <div class="product-row-cost">{{ fmt(p.cost) }}</div>
      </div>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-overlay">
      <div class="modal">
        <h2 class="modal-title">Nuevo producto</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Nombre *</label>
            <input v-model="form.name" class="input" placeholder="Nombre del producto" required />
          </div>
          <div class="field">
            <label>Código de barras</label>
            <input v-model="form.barcode" class="input" placeholder="7501055361013" />
          </div>
          <div class="field">
            <label>Descripción</label>
            <input v-model="form.description" class="input" placeholder="Descripción opcional" />
          </div>
          <div class="field">
            <label>Costo (MXN)</label>
            <input v-model="form.cost" type="number" min="0" step="0.01" class="input" placeholder="0.00" />
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
.product-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.product-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.product-row-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.product-row-info {
  flex: 1;
  min-width: 0;
}

.product-row-name {
  font-weight: 600;
  font-size: 14px;
}

.product-row-meta {
  display: flex;
  gap: 12px;
  margin-top: 2px;
}

.product-row-cost {
  font-weight: 700;
  color: var(--primary);
  font-size: 15px;
  white-space: nowrap;
}
</style>
