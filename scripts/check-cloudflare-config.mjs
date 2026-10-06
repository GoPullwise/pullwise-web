import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function validateWorkerConfig(config, productionEnv, environment = "production") {
  const errors = [];
  const routes = config.routes || [];
  const workerName = environment === "preview" ? "pullwise-web-preview" : "pullwise-web";
  const serverName = environment === "preview" ? "pullwise-server-preview" : "pullwise-server-production";
  const serverBindings = (config.services || []).filter((service) => service.binding === "PULLWISE_SERVER");
  if (serverBindings.length !== 1 || serverBindings[0].service !== serverName) {
    errors.push("Server service binding is missing or targets another environment");
  }
  if (config.name !== workerName || config.main !== "./worker-entry.js") {
    errors.push("Web Worker entry or name is missing");
  }
  if (environment === "preview" && (config.workers_dev !== false || config.preview_urls !== false ||
      config.vars?.PULLWISE_MODE !== "preview" || config.vars?.PULLWISE_API_ORIGIN !== "https://preview-api.pull-wise.com" ||
      routes.length !== 1 || routes[0].pattern !== "preview.pull-wise.com")) {
    errors.push("preview must use isolated reviewed hosts without public Worker URLs");
  }
  if (environment === "production" && config.vars?.PULLWISE_MODE !== "production") {
    errors.push("production must use production mode to preserve public indexing");
  }
  if (config.triggers?.crons?.length) errors.push("cron is forbidden");
  const workerFirst = config.assets?.run_worker_first;
  if (config.assets?.binding !== "ASSETS" ||
      !Array.isArray(workerFirst) || workerFirst.length !== 2 ||
      !workerFirst.includes("/*") || !workerFirst.includes("!/assets/*")) {
    errors.push(environment === "preview"
      ? "preview HTML must run noindex middleware with an ASSETS binding and asset exclusion"
      : "production HTML must run SEO middleware with an ASSETS binding and asset exclusion");
  }
  if (!routes.length || routes.some((route) => !route.custom_domain || !route.pattern)) {
    errors.push("Web custom domains are missing");
  }
  if (config.assets?.directory !== "./dist" ||
      config.assets?.not_found_handling !== "single-page-application" ||
      !Array.isArray(workerFirst) ||
      !(workerFirst.includes("/api/*") || workerFirst.includes("/*"))) {
    errors.push("API-first static asset routing is missing");
  }
  try {
    const origin = new URL(config.vars?.PULLWISE_API_ORIGIN);
    if (origin.protocol !== "https:" || !origin.hostname || origin.pathname !== "/" || origin.search || origin.hash) {
      errors.push("PULLWISE_API_ORIGIN must be an HTTPS origin");
    }
  } catch {
    errors.push("PULLWISE_API_ORIGIN must be an HTTPS origin");
  }
  if (!/^VITE_API_BASE_URL=\/api\s*$/m.test(productionEnv)) {
    errors.push("production browser API base must be /api");
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const config = JSON.parse(readFileSync(resolve(root, "wrangler.jsonc"), "utf8"));
  const productionEnv = readFileSync(resolve(root, ".env.production"), "utf8");
  const errors = validateWorkerConfig(config, productionEnv);
  const preview = JSON.parse(readFileSync(resolve(root, "wrangler.preview.jsonc"), "utf8"));
  errors.push(...validateWorkerConfig(preview, productionEnv, "preview"));
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("Web Worker configuration check passed (local only).");
  }
}
