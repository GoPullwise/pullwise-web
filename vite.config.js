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
      },
      "/health": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/auth": {
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
    },
  },
});
