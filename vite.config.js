import { cpSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const legacyBabelSources = new Set([
  "/src/i18n.jsx",
  "/src/icons.jsx",
  "/src/data.jsx",
  "/src/shell.jsx",
  "/src/screens/public.jsx",
  "/src/screens/flow.jsx",
  "/src/screens/dashboard.jsx",
  "/src/screens/issues.jsx",
]);

function serveLegacyBabelSources() {
  return {
    name: "serve-legacy-babel-sources",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = decodeURIComponent((req.url || "").split("?")[0]);

        if (!legacyBabelSources.has(pathname)) {
          next();
          return;
        }

        const filePath = resolve(pathname.slice(1));
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(readFileSync(filePath, "utf8"));
      });
    },
  };
}

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
  plugins: [serveLegacyBabelSources(), react(), copyLegacyRuntimeFiles()],
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
