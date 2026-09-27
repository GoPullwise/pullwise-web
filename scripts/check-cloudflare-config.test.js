import { describe, expect, it } from "vitest";
import { validateWorkerConfig } from "./check-cloudflare-config.mjs";

const valid = {
  name: "pullwise-web",
  main: "./worker-entry.js",
  routes: [{ pattern: "pull-wise.com", custom_domain: true }],
  assets: { directory: "./dist", not_found_handling: "single-page-application", run_worker_first: ["/api/*"] },
  vars: { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" },
};

describe("Web Cloudflare config guard", () => {
  it("accepts the reviewed proxy shape", () => {
    expect(validateWorkerConfig(valid, "VITE_API_BASE_URL=/api\n")).toEqual([]);
  });

  it("rejects missing API-first routing, cross-origin browser base and plaintext upstream", () => {
    const broken = structuredClone(valid);
    broken.assets.run_worker_first = [];
    broken.vars.PULLWISE_API_ORIGIN = "http://api.pull-wise.com";
    expect(validateWorkerConfig(broken, "VITE_API_BASE_URL=https://api.pull-wise.com\n").length).toBe(3);
  });
});
