import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const envRoot = path.resolve(__dirname, "..");
  const env = loadEnv(mode, envRoot, "");
  const port = Number(env.VITE_DEV_PORT ?? 5173);
  const apiTarget = env.VITE_API_PROXY_TARGET ?? "http://localhost:3001";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      host: true,
      port,
      strictPort: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
