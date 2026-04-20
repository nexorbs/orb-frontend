import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authApi } from "../api";

interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  exp?: number;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const accessToken = ref<string | null>(localStorage.getItem("access_token"));
  const refreshToken = ref<string | null>(localStorage.getItem("refresh_token"));

  const user = computed<JwtPayload | null>(() =>
    accessToken.value ? parseJwt(accessToken.value) : null
  );

  const isLoggedIn = computed(() => !!accessToken.value);

  async function login(email: string, password: string) {
    const res = await authApi.login(email, password);
    accessToken.value = res.access_token;
    refreshToken.value = res.refresh_token;
    localStorage.setItem("access_token", res.access_token);
    localStorage.setItem("refresh_token", res.refresh_token);
  }

  function logout() {
    accessToken.value = null;
    refreshToken.value = null;
    localStorage.clear();
  }

  return { accessToken, refreshToken, user, isLoggedIn, login, logout };
});
