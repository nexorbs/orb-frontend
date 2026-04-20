<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    router.push("/app/pos");
  } catch (e: any) {
    error.value = e.message ?? "Error al iniciar sesión";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-root">
    <div class="login-card">
      <div class="login-logo">
        <span class="logo-icon">◎</span>
        <span class="logo-text">ORB</span>
      </div>
      <h1 class="login-title">Bienvenido</h1>
      <p class="login-sub">Inicia sesión en tu cuenta</p>

      <form @submit.prevent="submit" class="login-form">
        <div v-if="error" class="error-bar">{{ error }}</div>

        <div class="field">
          <label>Correo electrónico</label>
          <input v-model="email" type="email" class="input" placeholder="tu@correo.com" required autocomplete="email" />
        </div>

        <div class="field">
          <label>Contraseña</label>
          <input v-model="password" type="password" class="input" placeholder="••••••••" required autocomplete="current-password" />
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? "Entrando..." : "Iniciar sesión" }}</span>
        </button>
      </form>
    </div>

    <p class="login-footer">ORB — Sistema de Punto de Venta</p>
  </div>
</template>

<style scoped>
.login-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  background-image:
    radial-gradient(ellipse at 20% 50%, var(--primary-glow) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 20%, var(--primary-glow) 0%, transparent 45%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 40px 36px;
  box-shadow: var(--shadow-lg);
}

.login-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}

.logo-icon {
  font-size: 28px;
  color: var(--primary);
  line-height: 1;
}

.logo-text {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--text);
}

.login-title {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.login-sub {
  color: var(--text-muted);
  font-size: 13px;
  margin-bottom: 28px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-footer {
  margin-top: 24px;
  color: var(--text-faint);
  font-size: 12px;
}
</style>
