import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  // @ts-expect-error process is a nodejs global
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [vue()],
    define: {
      __API_URL__: JSON.stringify(env.BACKEND_API_URL ?? "http://localhost:8000"),
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? { protocol: "ws", host, port: 1421 }
        : undefined,
      watch: { ignored: ["**/src-tauri/**"] },
    },
  };
});
