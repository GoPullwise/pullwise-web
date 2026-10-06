import { afterEach, describe, expect, it, vi } from "vitest";

import worker, { backendPath } from "./worker.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Cloudflare Worker API proxy", () => {
  it("uses the Server service binding instead of same-zone route fetch for GitHub login", async () => {
    const network = vi.fn(async () => new Response("origin connection refused", { status: 521 }));
    globalThis.fetch = network;
    const service = { fetch: vi.fn(async () => new Response('{"error":{"code":"D1_ACCESS_PAUSED"}}',
      { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })) };
    const response = await worker.fetch(new Request("https://pull-wise.com/api/auth/github/authorize?redirectTo=%2Fprojects",
      { headers: { Cookie: "pw_session=opaque", Origin: "https://pull-wise.com" } }),
      { PULLWISE_API_ORIGIN: "https://api.pull-wise.com", PULLWISE_SERVER: service });
    expect(service.fetch).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
    const forwarded = service.fetch.mock.calls[0][0];
    expect(forwarded.url).toBe("https://api.pull-wise.com/auth/github/authorize?redirectTo=%2Fprojects");
    expect(forwarded.headers.get("Cookie")).toBe("pw_session=opaque");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "D1_ACCESS_PAUSED" } });
  });

  it("does not fall back to external origin after a service-binding failure", async () => {
    const network = vi.fn();
    globalThis.fetch = network;
    const response = await worker.fetch(new Request("https://pull-wise.com/api/auth/github/authorize"),
      { PULLWISE_API_ORIGIN: "https://api.pull-wise.com", PULLWISE_SERVER: { fetch: vi.fn(async () => { throw new Error("unavailable"); }) } });
    expect(response.status).toBe(502);
    expect(network).not.toHaveBeenCalled();
  });

  it("keeps each Edge visitor IP over the service binding without trusting client forwarding headers", async () => {
    const network = vi.fn();
    globalThis.fetch = network;
    const service = { fetch: vi.fn(async () => new Response("{}")) };
    for (const ip of ["198.51.100.1", "2001:db8::2"]) {
      await worker.fetch(new Request("https://preview.pull-wise.com/api/auth/session", {
        headers: {
          "CF-Connecting-IP": ip,
          "X-Forwarded-For": "127.0.0.1",
          "X-Real-IP": "127.0.0.1",
          "True-Client-IP": "127.0.0.1",
          "CF-Connecting-IPv6": "::1",
          Forwarded: "for=127.0.0.1",
        },
      }), { PULLWISE_API_ORIGIN: "https://preview-api.pull-wise.com", PULLWISE_SERVER: service });
    }
    const forwarded = service.fetch.mock.calls.map(([request]) => request.headers);
    expect(forwarded.map((headers) => headers.get("CF-Connecting-IP"))).toEqual([
      "198.51.100.1", "2001:db8::2",
    ]);
    for (const headers of forwarded) {
      for (const name of ["X-Forwarded-For", "X-Real-IP", "True-Client-IP", "CF-Connecting-IPv6", "Forwarded"])
        expect(headers.get(name)).toBeNull();
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("preserves body, trusted Origin, redirect and cookies over the service binding", async () => {
    const service = { fetch: vi.fn(async (forwarded) => {
      expect(forwarded.method).toBe("POST");
      expect(await forwarded.text()).toBe('{"amount":"1.00"}');
      expect(forwarded.headers.get("Origin")).toBe("https://pull-wise.com");
      return new Response(null, { status: 302, headers: {
        Location: "https://pull-wise.com/projects", "Set-Cookie": "pw_session=opaque; HttpOnly; Secure; SameSite=None" } });
    }) };
    const response = await worker.fetch(new Request("https://pull-wise.com/api/billing/change-interval", {
      method: "POST", body: '{"amount":"1.00"}', headers: { Origin: "https://pull-wise.com" },
    }), { PULLWISE_API_ORIGIN: "https://api.pull-wise.com", PULLWISE_SERVER: service });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://pull-wise.com/projects");
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=None");
  });
  it("keeps the Server /api/v1 path and forwards bearer credentials", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    globalThis.fetch = fetchMock;
    await worker.fetch(new Request("https://pull-wise.com/api/api/v1/expenses?target=shared", {
      headers: { Authorization: "Bearer pwk_test" },
    }), { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.pull-wise.com/api/v1/expenses?target=shared");
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer pwk_test");
  });

  it("preserves OAuth callback path, redirect and session cookie", async () => {
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: "https://pull-wise.com/projects", "Set-Cookie": "pw_session=opaque; Path=/; HttpOnly; Secure; SameSite=None" },
    }));
    globalThis.fetch = fetchMock;
    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/auth/github/callback?code=sample", { headers: { Origin: "https://pull-wise.com" } }),
      { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" }
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.pull-wise.com/auth/github/callback?code=sample");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://pull-wise.com/projects");
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=None");
  });
  it("streams CSV response bytes through the proxy", async () => {
    let supply;
    const body = new ReadableStream({
      start(controller) { supply = controller; },
    });
    globalThis.fetch = vi.fn(async () => new Response(body, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="expenses.csv"' },
    }));
    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/api/v1/expenses/export"),
      { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" });
    expect(response.headers.get("Content-Disposition")).toContain("expenses.csv");
    const reader = response.body.getReader();
    supply.enqueue(new TextEncoder().encode("id,amount\n"));
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("id,amount\n");
    supply.close();
    expect((await reader.read()).done).toBe(true);
  });
  it("routes api requests to the configured backend origin", async () => {
    const fetchMock = vi.fn(
      async (url, init) =>
        new Response(JSON.stringify({ ok: true, url: String(url), prefix: init.headers.get("X-Forwarded-Prefix") }), {
          headers: { "Content-Type": "application/json" },
        })
    );
    globalThis.fetch = fetchMock;

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

  });

  it("strips spoofable client forwarding headers before proxying to the backend", async () => {
    let forwardedHeaders;
    const fetchMock = vi.fn(async (_url, init) => {
      forwardedHeaders = init.headers;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    globalThis.fetch = fetchMock;

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

  });

  it("serves static assets for non-api requests", async () => {
    const assets = { fetch: vi.fn(async () => new Response("asset")) };

    const response = await worker.fetch(new Request("https://pull-wise.com/dashboard"), { ASSETS: assets });

    expect(await response.text()).toBe("asset");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("adds shell cache and anti-framing headers to html assets served through the worker", async () => {
    const assets = {
      fetch: vi.fn(
        async () =>
          new Response("<!doctype html>", {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=3600",
            },
          })
      ),
    };

    const response = await worker.fetch(new Request("https://pull-wise.com/dashboard"), { ASSETS: assets });

    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("fails closed when the backend origin is missing", async () => {
    const response = await worker.fetch(new Request("https://pull-wise.com/api/health"), {});

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "PULLWISE_API_ORIGIN is not configured.",
    });
  });

  it("rejects remote plaintext upstreams before forwarding credentials", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/auth/session", {
        headers: {
          authorization: "Bearer browser-secret",
          cookie: "pw_session=ses_1",
        },
      }),
      { PULLWISE_API_ORIGIN: "http://api.pull-wise.com" }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      message: "PULLWISE_API_ORIGIN must use HTTPS or loopback HTTP.",
    });
    expect(fetchMock).not.toHaveBeenCalled();

  });

  it("returns a structured 502 when the backend fetch fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("connection failed"));
    globalThis.fetch = fetchMock;

    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/auth/session"),
      { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" }
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "Unable to reach Pullwise API upstream.",
    });

  });

  it("retries an explicit fallback origin for credentialless safe Cloudflare 1003 requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<html>error code: 1003</html>", {
          status: 403,
          headers: { "content-type": "text/html" },
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: false }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/auth/session"),
      {
        PULLWISE_API_ORIGIN: "https://198.51.100.10",
        PULLWISE_API_FALLBACK_ORIGIN: "https://api.internal",
      }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(1, new URL("https://198.51.100.10/auth/session"), expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, new URL("https://api.internal/auth/session"), expect.any(Object));
  });

  it("does not retry fallback origins for credentialed Cloudflare 1003 requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html>error code: 1003</html>", {
        status: 403,
        headers: { "content-type": "text/html" },
      })
    );
    globalThis.fetch = fetchMock;

    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/auth/session", {
        headers: { cookie: "pw_session=secret" },
      }),
      {
        PULLWISE_API_ORIGIN: "https://198.51.100.10",
        PULLWISE_API_FALLBACK_ORIGIN: "https://api.internal",
      }
    );

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects oversized proxied request bodies before forwarding", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/scans", {
        method: "POST",
        body: "0123456789",
        headers: { "Content-Length": "10" },
      }),
      { PULLWISE_API_ORIGIN: "https://api.pull-wise.com", PULLWISE_PROXY_MAX_BODY_BYTES: "4" }
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ message: "Request body is too large." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects oversized proxied request bodies when Content-Length is missing", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const response = await worker.fetch(
      new Request("https://pull-wise.com/api/scans", {
        method: "POST",
        body: "0123456789",
      }),
      { PULLWISE_API_ORIGIN: "https://api.pull-wise.com", PULLWISE_PROXY_MAX_BODY_BYTES: "4" }
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ message: "Request body is too large." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams proxied request bodies without buffering them first", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const request = new Request("https://pull-wise.com/api/scans", {
      method: "POST",
      body: JSON.stringify({ repo: "owner/repo" }),
      headers: { "Content-Type": "application/json", "Content-Length": "21" },
    });

    const response = await worker.fetch(request, { PULLWISE_API_ORIGIN: "https://api.pull-wise.com" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].body).toBe(request.body);
  });

  it("strips the api prefix for backend paths", () => {
    expect(backendPath("/api")).toBe("/");
    expect(backendPath("/api/")).toBe("/");
    expect(backendPath("/api/scans/sc_1")).toBe("/scans/sc_1");
  });
});
