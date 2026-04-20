<script setup lang="ts">
import { ref, onMounted } from "vue";
import { catalogApi } from "../api";
import type { Product, Category } from "../api/types";
import { usePosStore } from "../stores/pos";

const pos = usePosStore();

const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(false);
const error = ref("");
const showCreate = ref(false);
const showAssignCat = ref(false);
const showSetPrice = ref(false);
const processing = ref(false);
const selectedProduct = ref<Product | null>(null);

const form = ref({ name: "", barcode: "", description: "", cost: "", category_ids: [] as string[] });
const editForm = ref({ name: "", barcode: "", description: "", cost: "" });
const showEdit = ref(false);
const assignCatId = ref("");
const priceInput = ref("");

// Local maps persisted to localStorage
const productCatMap = ref<Record<string, string[]>>(
  JSON.parse(localStorage.getItem("product_categories") ?? "{}")
);
const priceMap = ref<Record<string, number>>(
  JSON.parse(localStorage.getItem("product_prices") ?? "{}")
);

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
  form.value = { name: "", barcode: "", description: "", cost: "", category_ids: [] };
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
      category_ids: form.value.category_ids.length > 0 ? form.value.category_ids : undefined,
    });
    // Update local category map if categories were assigned
    if (form.value.category_ids.length > 0) {
      const map = { ...productCatMap.value };
      map[p.id] = [...form.value.category_ids];
      productCatMap.value = map;
      localStorage.setItem("product_categories", JSON.stringify(map));
    }
    products.value.unshift(p);
    showCreate.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function openEdit(p: Product) {
  selectedProduct.value = p;
  editForm.value = {
    name: p.name,
    barcode: p.barcode ?? "",
    description: p.description ?? "",
    cost: p.cost?.toString() ?? "",
  };
  error.value = "";
  showEdit.value = true;
}

async function saveEdit() {
  if (!selectedProduct.value) return;
  processing.value = true;
  error.value = "";
  try {
    const updated = await catalogApi.updateProduct(selectedProduct.value.id, {
      name: editForm.value.name || undefined,
      barcode: editForm.value.barcode || undefined,
      description: editForm.value.description || undefined,
      cost: editForm.value.cost ? parseFloat(editForm.value.cost) : undefined,
    });
    const idx = products.value.findIndex((p) => p.id === updated.id);
    if (idx !== -1) products.value[idx] = updated;
    showEdit.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function openAssignCat(p: Product) {
  selectedProduct.value = p;
  assignCatId.value = "";
  error.value = "";
  showAssignCat.value = true;
}

async function assignCategory() {
  if (!selectedProduct.value || !assignCatId.value) return;
  processing.value = true;
  error.value = "";
  try {
    await catalogApi.assignCategory(selectedProduct.value.id, assignCatId.value);
    const map = { ...productCatMap.value };
    if (!map[selectedProduct.value.id]) map[selectedProduct.value.id] = [];
    if (!map[selectedProduct.value.id].includes(assignCatId.value)) {
      map[selectedProduct.value.id] = [...map[selectedProduct.value.id], assignCatId.value];
    }
    productCatMap.value = map;
    localStorage.setItem("product_categories", JSON.stringify(map));
    assignCatId.value = "";
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

async function removeCategory(catId: string) {
  if (!selectedProduct.value) return;
  processing.value = true;
  error.value = "";
  try {
    await catalogApi.removeCategory(selectedProduct.value.id, catId);
    const map = { ...productCatMap.value };
    map[selectedProduct.value.id] = (map[selectedProduct.value.id] ?? []).filter((id) => id !== catId);
    productCatMap.value = map;
    localStorage.setItem("product_categories", JSON.stringify(map));
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function openSetPrice(p: Product) {
  if (!pos.selectedStore) return;
  selectedProduct.value = p;
  priceInput.value = priceMap.value[p.id]?.toString() ?? p.cost?.toString() ?? "";
  error.value = "";
  showSetPrice.value = true;
}

async function setPrice() {
  if (!selectedProduct.value || !pos.selectedStore || !priceInput.value) return;
  processing.value = true;
  error.value = "";
  try {
    await catalogApi.setPrice(selectedProduct.value.id, pos.selectedStore.id, parseFloat(priceInput.value));
    const map = { ...priceMap.value };
    map[selectedProduct.value.id] = parseFloat(priceInput.value);
    priceMap.value = map;
    localStorage.setItem("product_prices", JSON.stringify(map));
    showSetPrice.value = false;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    processing.value = false;
  }
}

function productPrice(productId: string): string {
  const p = priceMap.value[productId];
  return p !== undefined ? fmt(p) : "—";
}

function fmt(n?: number) {
  if (n === undefined) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Productos</h1>
        <p class="text-muted" style="font-size:13px;margin-top:2px">{{ products.length }} productos en catálogo</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ Nuevo producto</button>
    </div>

    <div v-if="error && !showCreate && !showAssignCat && !showSetPrice" class="error-bar">{{ error }}</div>

    <div v-if="loading" class="loading-center" style="height:200px">
      <div class="spinner"></div> Cargando...
    </div>

    <div v-else-if="products.length === 0" class="empty">
      <div class="empty-icon">▣</div>
      <h3>Sin productos</h3>
      <p>Crea el primer producto del catálogo.</p>
      <button class="btn btn-primary" style="margin-top:14px" @click="openCreate">Crear producto</button>
    </div>

    <div v-else class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Código de barras</th>
              <th>Costo</th>
              <th>Precio (sucursal)</th>
              <th>Categorías</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id">
              <td>
                <div class="prod-cell">
                  <div class="prod-icon">{{ p.name[0].toUpperCase() }}</div>
                  <div>
                    <div style="font-weight:600">{{ p.name }}</div>
                    <div v-if="p.description" class="text-muted text-sm">{{ p.description }}</div>
                  </div>
                </div>
              </td>
              <td>
                <span v-if="p.barcode" class="mono text-muted" style="font-size:12px">{{ p.barcode }}</span>
                <span v-else class="text-faint">—</span>
              </td>
              <td class="mono" style="font-weight:600">{{ fmt(p.cost) }}</td>
              <td class="mono" style="color:var(--primary);font-weight:600">{{ productPrice(p.id) }}</td>
              <td>
                <span v-if="(productCatMap[p.id] ?? []).length === 0" class="text-faint text-sm">Sin categoría</span>
                <div v-else class="cat-badges">
                  <span
                    v-for="catId in productCatMap[p.id]"
                    :key="catId"
                    class="badge badge-neutral"
                  >{{ categories.find(c => c.id === catId)?.name ?? catId.slice(0,6) }}</span>
                </div>
              </td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm" @click="openEdit(p)">Editar</button>
                  <button class="btn btn-ghost btn-sm" @click="openAssignCat(p)">Categoría</button>
                  <button
                    class="btn btn-ghost btn-sm"
                    @click="openSetPrice(p)"
                    :disabled="!pos.selectedStore"
                    :title="!pos.selectedStore ? 'Selecciona una sucursal primero' : 'Establecer precio'"
                  >Precio</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create product modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h2 class="modal-title">Nuevo producto</h2>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Nombre *</label>
            <input v-model="form.name" class="input" placeholder="Coca-Cola 600ml" required @keydown.escape="showCreate = false" />
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
          <div class="field" v-if="categories.length > 0">
            <label>Categorías</label>
            <div class="cat-check-list">
              <label v-for="c in categories" :key="c.id" class="cat-check-item">
                <input type="checkbox" :value="c.id" v-model="form.category_ids" />
                {{ c.name }}
              </label>
            </div>
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

    <!-- Edit product modal -->
    <div v-if="showEdit" class="modal-overlay" @click.self="showEdit = false">
      <div class="modal">
        <h2 class="modal-title">Editar producto</h2>
        <p class="text-muted" style="margin-bottom:16px;font-size:13px">
          <strong>{{ selectedProduct?.name }}</strong>
        </p>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Nombre *</label>
            <input v-model="editForm.name" class="input" placeholder="Nombre del producto" />
          </div>
          <div class="field">
            <label>Código de barras</label>
            <input v-model="editForm.barcode" class="input" placeholder="7501055361013" />
          </div>
          <div class="field">
            <label>Descripción</label>
            <input v-model="editForm.description" class="input" placeholder="Descripción opcional" />
          </div>
          <div class="field">
            <label>Costo (MXN)</label>
            <input v-model="editForm.cost" type="number" min="0" step="0.01" class="input" placeholder="0.00" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showEdit = false">Cancelar</button>
          <button class="btn btn-primary" @click="saveEdit" :disabled="processing || !editForm.name">
            <span v-if="processing" class="spinner"></span> Guardar
          </button>
        </div>
      </div>
    </div>

    <!-- Assign category modal -->
    <div v-if="showAssignCat" class="modal-overlay" @click.self="showAssignCat = false">
      <div class="modal">
        <h2 class="modal-title">Asignar categoría</h2>
        <p class="text-muted" style="margin-bottom:16px;font-size:13px">
          Producto: <strong>{{ selectedProduct?.name }}</strong>
        </p>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Categoría *</label>
            <select v-model="assignCatId" class="input">
              <option value="">Selecciona...</option>
              <option
                v-for="c in categories"
                :key="c.id"
                :value="c.id"
                :disabled="(productCatMap[selectedProduct?.id ?? ''] ?? []).includes(c.id)"
              >{{ c.name }}{{ (productCatMap[selectedProduct?.id ?? ''] ?? []).includes(c.id) ? ' (ya asignada)' : '' }}</option>
            </select>
          </div>
          <!-- Current categories -->
          <div v-if="(productCatMap[selectedProduct?.id ?? ''] ?? []).length > 0">
            <div class="text-muted text-sm" style="margin-bottom:6px">Categorías actuales:</div>
            <div class="cat-badges">
              <span
                v-for="catId in productCatMap[selectedProduct?.id ?? '']"
                :key="catId"
                class="badge badge-primary cat-badge-removable"
              >
                {{ categories.find(c => c.id === catId)?.name }}
                <button class="cat-remove-btn" @click="removeCategory(catId)" :disabled="processing" title="Quitar categoría">✕</button>
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAssignCat = false">Cerrar</button>
          <button class="btn btn-primary" @click="assignCategory" :disabled="processing || !assignCatId">
            <span v-if="processing" class="spinner"></span> Asignar
          </button>
        </div>
      </div>
    </div>

    <!-- Set price modal -->
    <div v-if="showSetPrice" class="modal-overlay" @click.self="showSetPrice = false">
      <div class="modal">
        <h2 class="modal-title">Fijar precio</h2>
        <p class="text-muted" style="margin-bottom:16px;font-size:13px">
          <strong>{{ selectedProduct?.name }}</strong> · Sucursal: {{ pos.selectedStore?.name }}
        </p>
        <div class="modal-form">
          <div v-if="error" class="error-bar">{{ error }}</div>
          <div class="field">
            <label>Precio de venta (MXN) *</label>
            <input
              v-model="priceInput"
              type="number"
              min="0"
              step="0.01"
              class="input"
              style="font-size:1.2rem;font-weight:700"
              placeholder="0.00"
              @keydown.enter="setPrice"
            />
          </div>
          <div v-if="selectedProduct?.cost" class="text-muted text-sm">
            Costo: {{ fmt(selectedProduct.cost) }}
            <span v-if="priceInput && parseFloat(priceInput) > 0" style="margin-left:8px">
              · Margen: {{ Math.round(((parseFloat(priceInput) - selectedProduct.cost) / selectedProduct.cost) * 100) }}%
            </span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showSetPrice = false">Cancelar</button>
          <button class="btn btn-primary" @click="setPrice" :disabled="processing || !priceInput">
            <span v-if="processing" class="spinner"></span> Guardar precio
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prod-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.prod-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  background: var(--primary-glow);
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cat-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.text-faint { color: var(--text-faint); }

.cat-badge-removable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cat-remove-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  color: inherit;
  opacity: 0.6;
  padding: 0 1px;
  line-height: 1;
  transition: opacity var(--transition);
}
.cat-remove-btn:hover { opacity: 1; }

.cat-check-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
  padding: 4px 0;
}

.cat-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}
</style>
