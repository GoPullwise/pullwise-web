import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./worker-entry.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("SEO Worker shell", () => {
  it("redirects the www hostname to the canonical apex domain", async () => {
    const assets = { fetch: vi.fn() };

    const response = await worker.fetch(
      new Request("https://www.pull-wise.com/pricing?ref=launch"),
      { ASSETS: assets }
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe("https://pull-wise.com/pricing?ref=launch");
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("injects route-specific metadata into the HTML shell", async () => {
    const assets = {
      fetch: vi.fn(
        async () =>
          new Response(
            '<!doctype html><html><head><title data-seo-managed="true">Old</title></head><body></body></html>',
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
      ),
    };

    const response = await worker.fetch(new Request("https://pull-wise.com/pricing"), {
      ASSETS: assets,
    });
    const html = await response.text();

    expect(html).toContain("Pullwise Pricing — AI Repository Review Plans");
    expect(html).toContain('<link rel="canonical" href="https://pull-wise.com/pricing"');
    expect(html).toContain('<meta name="robots" content="index,follow"');
  });

  it("injects noindex metadata for private app routes", async () => {
    const assets = {
      fetch: vi.fn(
        async () =>
          new Response(
            '<!doctype html><html><head><title data-seo-managed="true">Old</title></head><body></body></html>',
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
      ),
    };

    const response = await worker.fetch(new Request("https://pull-wise.com/dashboard/overview"), {
      ASSETS: assets,
    });

    expect(await response.text()).toContain('<meta name="robots" content="noindex,nofollow"');
  });
});
