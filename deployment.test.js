import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf-8"));

describe("web Worker deployment", () => {
  it("routes API requests through the Worker before the SPA assets fallback", () => {
    expect(Array.isArray(wrangler.assets?.run_worker_first)).toBe(true);
    expect(wrangler.assets?.run_worker_first).toContain("/api/*");
  });
});
