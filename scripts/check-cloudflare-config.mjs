import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function validateWorkerConfig(config, productionEnv, environment = "production") {
  const errors = [];
  const routes = config.routes || [];
  const workerName = environment === "preview" ? "pullwise-web-preview" : "pullwise-web";
  if (config.name !== workerName || config.main !== "./worker-entry.js") {
    errors.push("Web Worker entry or name is missing");
  }
  if (environment === "preview" && (config.workers_dev !== false || config.preview_urls !== false ||
      config.vars?.PULLWISE_MODE !== "preview" || config.vars?.PULLWISE_API_ORIGIN !== "https://preview-api.pull-wise.com" ||
      routes.length !== 1 || routes[0].pattern !== "preview.pull-wise.com")) {
    errors.push("preview must use isolated reviewed hosts without public Worker URLs");
  }
  if (config.triggers?.crons?.length) errors.push("cron is forbidden");
  if (!routes.length || routes.some((route) => !route.custom_domain || !route.pattern)) {
    errors.push("Web custom domains are missing");
  }
  if (config.assets?.directory !== "./dist" ||
      config.assets?.not_found_handling !== "single-page-application" ||
      !config.assets?.run_worker_first?.includes("/api/*")) {
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
