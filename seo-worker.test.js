import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./worker-entry.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("SEO Worker shell", () => {
  it.each([
    ["http://preview.pull-wise.com/signin?redirectTo=%2Fprojects", "GET",
      "https://preview.pull-wise.com/signin?redirectTo=%2Fprojects"],
    ["http://preview.pull-wise.com/projects", "HEAD", "https://preview.pull-wise.com/projects"],
    ["http://pull-wise.com/signin", "GET", "https://pull-wise.com/signin"],
    ["http://www.pull-wise.com/pricing?ref=launch", "GET", "https://pull-wise.com/pricing?ref=launch"],
    ["http://preview.pull-wise.com:8080//other.example/signin?redirectTo=https%3A%2F%2Fother.example", "GET",
      "https://preview.pull-wise.com//other.example/signin?redirectTo=https%3A%2F%2Fother.example"],
  ])("upgrades a deployed HTTP navigation before serving the page: %s", async (source, method, target) => {
    const assets = { fetch: vi.fn() };
    const service = { fetch: vi.fn() };
    const network = vi.fn();
    globalThis.fetch = network;

    const response = await worker.fetch(new Request(source, { method }), {
      PULLWISE_MODE: "preview", ASSETS: assets, PULLWISE_SERVER: service,
    });

    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe(target);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(assets.fetch).not.toHaveBeenCalled();
    expect(service.fetch).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "does not redirect or dispatch an insecure %s authentication request", async (method) => {
      const assets = { fetch: vi.fn() };
      const service = { fetch: vi.fn() };
      const network = vi.fn();
      globalThis.fetch = network;
      const response = await worker.fetch(
        new Request("http://preview.pull-wise.com/api/auth/email/request-code", {
          method, headers: { Origin: "http://preview.pull-wise.com" },
          body: JSON.stringify({ email: "member@example.com", purpose: "login" }),
        }), { ASSETS: assets, PULLWISE_SERVER: service }
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: { code: "HTTPS_REQUIRED" } });
      expect(response.headers.get("Location")).toBeNull();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(assets.fetch).not.toHaveBeenCalled();
      expect(service.fetch).not.toHaveBeenCalled();
      expect(network).not.toHaveBeenCalled();
    }
  );

  it("keeps trusted HTTPS email requests intact over the service binding", async () => {
    const service = { fetch: vi.fn(async (request) => {
      expect(request.url).toBe("https://preview-api.pull-wise.com/auth/email/request-code");
      expect(request.method).toBe("POST");
      expect(request.headers.get("Origin")).toBe("https://preview.pull-wise.com");
      expect(request.headers.get("Referer")).toBe("https://preview.pull-wise.com/signin");
      expect(await request.json()).toEqual({ email: "member@example.com", purpose: "login" });
      return Response.json({ challengeId: "local-only", expiresIn: 600 }, { status: 202 });
    }) };
    const response = await worker.fetch(new Request("https://preview.pull-wise.com/api/auth/email/request-code", {
      method: "POST", headers: {
        Origin: "https://preview.pull-wise.com", Referer: "https://preview.pull-wise.com/signin",
      }, body: JSON.stringify({ email: "member@example.com", purpose: "login" }),
    }), { PULLWISE_API_ORIGIN: "https://preview-api.pull-wise.com", PULLWISE_SERVER: service });

    expect(response.status).toBe(202);
    expect(service.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["http://127.0.0.1:4248/", "http://localhost:4248/", "http://unrelated.example/"])(
    "preserves HTTP development and unrelated hosts: %s", async (source) => {
      const assets = { fetch: vi.fn(async () => new Response("local asset")) };
      const response = await worker.fetch(new Request(source), { ASSETS: assets });
      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();
      expect(assets.fetch).toHaveBeenCalledTimes(1);
    }
  );

  it("keeps preview pages out of indexing", async () => {
    const response = await worker.fetch(new Request("https://preview.pull-wise.com/pricing"), {
      PULLWISE_MODE: "preview",
      ASSETS: { fetch: async () => new Response("<html><head></head><body></body></html>",
        { headers: { "Content-Type": "text/html" } }) },
    });
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
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

    expect(html).toContain("Pullwise Pricing — Project Expense Ledger");
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
