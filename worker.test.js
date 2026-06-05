import { describe, expect, it, vi } from "vitest";

import worker, { backendPath } from "./worker.js";

describe("Cloudflare Worker API proxy", () => {
  it("routes api requests to the configured backend origin", async () => {
    const fetchMock = vi.fn(
      async (url, init) =>
        new Response(JSON.stringify({ ok: true, url: String(url), prefix: init.headers.get("X-Forwarded-Prefix") }), {
          headers: { "Content-Type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://pull-wise.com/api/auth/session?fresh=1", {
      headers: { Connection: "keep-alive", Host: "pull-wise.com" },
    });
    const response = await worker.fetch(request, { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" });
    const payload = await response.json();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.pull-wise.com/auth/session?fresh=1");
    expect(fetchMock.mock.calls[0][1].headers.get("connection")).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers.get("host")).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers.get("X-Forwarded-Proto")).toBe("https");
    expect(fetchMock.mock.calls[0][1].headers.get("X-Forwarded-Host")).toBe("pull-wise.com");
    expect(payload.prefix).toBe("/api");

    vi.unstubAllGlobals();
  });

  it("strips spoofable client forwarding headers before proxying to the backend", async () => {
    let forwardedHeaders;
    const fetchMock = vi.fn(async (_url, init) => {
      forwardedHeaders = init.headers;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://pull-wise.com/api/health", {
      headers: {
        Forwarded: "for=127.0.0.1;host=evil.example;proto=http",
        "X-Forwarded-For": "127.0.0.1",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "http",
        "X-Forwarded-Prefix": "/evil",
        "X-Real-IP": "127.0.0.1",
        "CF-Connecting-IP": "127.0.0.1",
        "True-Client-IP": "127.0.0.1",
        "Fastly-Client-IP": "127.0.0.1",
        "X-Client-IP": "127.0.0.1",
        "X-Cluster-Client-IP": "127.0.0.1",
        "X-Original-Forwarded-For": "127.0.0.1",
      },
    });

    await worker.fetch(request, { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" });

    expect(forwardedHeaders.get("Forwarded")).toBeNull();
    expect(forwardedHeaders.get("X-Forwarded-For")).toBeNull();
    expect(forwardedHeaders.get("X-Real-IP")).toBeNull();
    expect(forwardedHeaders.get("CF-Connecting-IP")).toBeNull();
    expect(forwardedHeaders.get("True-Client-IP")).toBeNull();
    expect(forwardedHeaders.get("Fastly-Client-IP")).toBeNull();
    expect(forwardedHeaders.get("X-Client-IP")).toBeNull();
    expect(forwardedHeaders.get("X-Cluster-Client-IP")).toBeNull();
    expect(forwardedHeaders.get("X-Original-Forwarded-For")).toBeNull();
    expect(forwardedHeaders.get("X-Forwarded-Proto")).toBe("https");
    expect(forwardedHeaders.get("X-Forwarded-Host")).toBe("pull-wise.com");
    expect(forwardedHeaders.get("X-Forwarded-Prefix")).toBe("/api");

    vi.unstubAllGlobals();
  });

  it("serves static assets for non-api requests", async () => {
    const assets = { fetch: vi.fn(async () => new Response("asset")) };

    const response = await worker.fetch(new Request("https://pull-wise.com/dashboard"), { ASSETS: assets });

    expect(await response.text()).toBe("asset");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("fails closed when the backend origin is missing", async () => {
    const response = await worker.fetch(new Request("https://pull-wise.com/api/health"), {});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "PULLWISE_API_ORIGIN is not configured.",
    });
  });

  it("strips the api prefix for backend paths", () => {
    expect(backendPath("/api")).toBe("/");
    expect(backendPath("/api/")).toBe("/");
    expect(backendPath("/api/scans/sc_1")).toBe("/scans/sc_1");
  });
});
