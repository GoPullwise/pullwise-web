import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api(?=\/|$)/, "") || "/",
      },
      "/health": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/webhooks": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, "/");
          if (!normalized.includes("/node_modules/")) return undefined;
          if (normalized.includes("/react/") || normalized.includes("/react-dom/") || normalized.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (normalized.includes("/lucide-react/")) return "vendor-icons";
          if (normalized.includes("/date-fns/")) return "vendor-date";
          if (normalized.includes("/axios/")) return "vendor-http";
          if (normalized.includes("/react-router-dom/") || normalized.includes("/react-router/")) return "vendor-router";
          return "vendor";
        },
      },
    },
  },
});
