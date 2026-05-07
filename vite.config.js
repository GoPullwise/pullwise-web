import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function copyLegacyRuntimeFiles() {
  return {
    name: "copy-legacy-runtime-files",
    closeBundle() {
      const outDir = resolve("dist");

      for (const dir of ["src", "styles"]) {
        if (existsSync(dir)) {
          cpSync(resolve(dir), resolve(outDir, dir), {
            recursive: true,
            force: true,
          });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyLegacyRuntimeFiles()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        review: resolve(__dirname, "review.html"),
      },
    },
  },
});
