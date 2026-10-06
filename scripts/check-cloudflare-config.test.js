import { describe, expect, it } from "vitest";
import { validateWorkerConfig } from "./check-cloudflare-config.mjs";

const valid = {
  name: "pullwise-web",
  main: "./worker-entry.js",
  routes: [{ pattern: "pull-wise.com", custom_domain: true }],
  assets: { directory: "./dist", binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/*", "!/assets/*"] },
  vars: { PULLWISE_MODE: "production", PULLWISE_API_ORIGIN: "https://api.pull-wise.com" },
  services: [{ binding: "PULLWISE_SERVER", service: "pullwise-server-production" }],
};

describe("Web Cloudflare config guard", () => {
  it("accepts the reviewed proxy shape", () => {
    expect(validateWorkerConfig(valid, "VITE_API_BASE_URL=/api\n")).toEqual([]);
  });

  it("accepts only the isolated paused-preview proxy target", () => {
    const preview = structuredClone(valid);
    preview.name = "pullwise-web-preview";
    preview.workers_dev = false;
    preview.preview_urls = false;
    preview.routes = [{ pattern: "preview.pull-wise.com", custom_domain: true }];
    preview.vars = { PULLWISE_MODE: "preview", PULLWISE_API_ORIGIN: "https://preview-api.pull-wise.com" };
    preview.services = [{ binding: "PULLWISE_SERVER", service: "pullwise-server-preview" }];
    preview.assets.binding = "ASSETS";
    preview.assets.run_worker_first = ["/*", "!/assets/*"];
    expect(validateWorkerConfig(preview, "VITE_API_BASE_URL=/api\n", "preview")).toEqual([]);
    preview.vars.PULLWISE_API_ORIGIN = "https://api.pull-wise.com";
    expect(validateWorkerConfig(preview, "VITE_API_BASE_URL=/api\n", "preview").length).toBeGreaterThan(0);
  });

  it("rejects preview HTML that bypasses noindex middleware or lacks its assets binding", () => {
    const preview = structuredClone(valid);
    preview.name = "pullwise-web-preview";
    preview.workers_dev = false;
    preview.preview_urls = false;
    preview.routes = [{ pattern: "preview.pull-wise.com", custom_domain: true }];
    preview.vars = { PULLWISE_MODE: "preview", PULLWISE_API_ORIGIN: "https://preview-api.pull-wise.com" };
    preview.services = [{ binding: "PULLWISE_SERVER", service: "pullwise-server-preview" }];
    preview.assets.run_worker_first = ["/api/*"];
    delete preview.assets.binding;
    expect(validateWorkerConfig(preview, "VITE_API_BASE_URL=/api\n", "preview"))
      .toContain("preview HTML must run noindex middleware with an ASSETS binding and asset exclusion");
    preview.assets.binding = "ASSETS";
    preview.assets.run_worker_first = ["/*", "!/assets/*"];
    expect(validateWorkerConfig(preview, "VITE_API_BASE_URL=/api\n", "preview")).toEqual([]);
  });

  it.each([
    ["API-only routing", (config) => { config.assets.run_worker_first = ["/api/*"]; }],
    ["missing asset binding", (config) => { delete config.assets.binding; }],
    ["hashed assets running middleware", (config) => { config.assets.run_worker_first = ["/*"]; }],
  ])("rejects production %s that bypasses or misroutes HTML middleware", (_, breakConfig) => {
    const production = structuredClone(valid);
    breakConfig(production);
    expect(validateWorkerConfig(production, "VITE_API_BASE_URL=/api\n"))
      .toContain("production HTML must run SEO middleware with an ASSETS binding and asset exclusion");
  });

  it("rejects preview mode on production so public HTML stays indexable", () => {
    const production = structuredClone(valid);
    production.vars.PULLWISE_MODE = "preview";
    expect(validateWorkerConfig(production, "VITE_API_BASE_URL=/api\n"))
      .toContain("production must use production mode to preserve public indexing");
  });

  it("rejects missing or cross-environment Server service bindings", () => {
    const missing = structuredClone(valid);
    missing.services = [];
    expect(validateWorkerConfig(missing, "VITE_API_BASE_URL=/api\n")).toContain("Server service binding is missing or targets another environment");
  });

  it("rejects missing API-first routing, cross-origin browser base and plaintext upstream", () => {
    const broken = structuredClone(valid);
    broken.assets.run_worker_first = [];
    broken.vars.PULLWISE_API_ORIGIN = "http://api.pull-wise.com";
    expect(validateWorkerConfig(broken, "VITE_API_BASE_URL=https://api.pull-wise.com\n")).toEqual(expect.arrayContaining([
      "API-first static asset routing is missing",
      "production browser API base must be /api",
      "PULLWISE_API_ORIGIN must be an HTTPS origin",
    ]));
  });
});
