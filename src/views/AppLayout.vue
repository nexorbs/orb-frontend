<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter, RouterView } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { usePosStore } from "../stores/pos";
import { useTheme } from "../composables/useTheme";

const auth = useAuthStore();
const pos = usePosStore();
const route = useRoute();
const router = useRouter();
const { theme, toggle: toggleTheme } = useTheme();

const nav = [
  { path: "/app/pos", label: "Punto de Venta", icon: "⊕" },
  { path: "/app/cash", label: "Caja", icon: "◈" },
  { path: "/app/sales", label: "Ventas", icon: "◇" },
  { path: "/app/products", label: "Productos", icon: "▣" },
  { path: "/app/categories", label: "Categorías", icon: "⊞" },
  { path: "/app/inventory", label: "Inventario", icon: "◫" },
  { path: "/app/reports", label: "Reportes", icon: "◌" },
  { path: "/app/customers", label: "Clientes", icon: "◉" },
  { path: "/app/settings", label: "Configuración", icon: "◎" },
];

function isActive(path: string) {
  return route.path === path;
}

function logout() {
  auth.logout();
  router.push("/");
}

const storeName = computed(() => pos.selectedStore?.name ?? "Sin sucursal");
const sessionStatus = computed(() => pos.activeSession?.status === "open");
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <span class="brand-icon">◎</span>
        <span class="brand-name">ORB</span>
      </div>

      <div class="store-badge">
        <div class="store-dot" :class="{ active: sessionStatus }"></div>
        <div>
          <div class="store-name">{{ storeName }}</div>
          <div class="store-status">{{ sessionStatus ? "Caja abierta" : "Caja cerrada" }}</div>
        </div>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="user-row">
          <div class="user-avatar">{{ auth.user?.sub?.slice(0, 2).toUpperCase() ?? "US" }}</div>
          <div class="user-info">
            <div class="user-name text-sm">Usuario</div>
            <div class="user-email text-sm text-muted" style="font-size:11px">{{ auth.user?.email ?? "–" }}</div>
          </div>
        </div>
        <div class="footer-actions">
          <button
            class="btn btn-ghost btn-sm btn-icon theme-btn"
            @click="toggleTheme"
            :title="theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          >
            <span v-if="theme === 'dark'">☀</span>
            <span v-else>☾</span>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" @click="logout" title="Cerrar sesión">⏻</button>
        </div>
      </div>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 18px 16px;
  border-bottom: 1px solid var(--border);
}

.brand-icon {
  font-size: 20px;
  color: var(--primary);
}

.brand-name {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.store-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin: 10px 10px 4px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.store-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-faint);
  flex-shrink: 0;
}

.store-dot.active {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
}

.store-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 130px;
}

.store-status {
  font-size: 11px;
  color: var(--text-muted);
}

.nav {
  flex: 1;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  transition: all var(--transition);
}

.nav-item:hover {
  background: var(--surface2);
  color: var(--text);
}

.nav-item.active {
  background: var(--primary-glow);
  color: var(--primary);
  font-weight: 600;
}

.nav-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-footer {
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.theme-btn {
  font-size: 14px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.user-avatar {
  width: 30px;
  height: 30px;
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

.user-info { min-width: 0; }

.user-name, .user-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg);
  padding: 24px;
}
</style>
