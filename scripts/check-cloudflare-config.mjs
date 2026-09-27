import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function validateWorkerConfig(config, productionEnv) {
  const errors = [];
  const routes = config.routes || [];
  if (config.name !== "pullwise-web" || config.main !== "./worker-entry.js") {
    errors.push("Web Worker entry or name is missing");
  }
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
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("Web Worker configuration check passed (local only).");
  }
}
