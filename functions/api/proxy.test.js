import { afterEach, describe, expect, it, vi } from "vitest";

import { onRequest } from "./[[path]].js";

describe("api proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the public Pages API base to the backend", async () => {
    let forwardedHeaders;
    let forwardedInit;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        forwardedHeaders = init.headers;
        forwardedInit = init;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    await onRequest({
      env: { PULLWISE_API_ORIGIN: "https://api.internal" },
      request: new Request("https://pull-wise.com/api/auth/github/authorize", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
        headers: { "Content-Type": "application/json" },
      }),
    });

    expect(forwardedHeaders.get("X-Forwarded-Proto")).toBe("https");
    expect(forwardedHeaders.get("X-Forwarded-Host")).toBe("pull-wise.com");
    expect(forwardedHeaders.get("X-Forwarded-Prefix")).toBeNull();
    expect(forwardedInit.duplex).toBe("half");
  });

  it("removes hop-by-hop headers while proxying requests and responses", async () => {
    let forwardedHeaders;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        forwardedHeaders = init.headers;
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            Connection: "X-Backend-Hop",
            "Keep-Alive": "timeout=5",
            "X-Backend-Hop": "drop-me",
            "X-Request-Id": "req_1",
          },
        });
      })
    );

    const response = await onRequest({
      env: { PULLWISE_API_ORIGIN: "https://api.internal" },
      request: new Request("https://pull-wise.com/api/health", {
        headers: {
          Connection: "X-Client-Hop",
          "X-Client-Hop": "drop-me",
          "X-Request-Id": "req_1",
        },
      }),
    });

    expect(forwardedHeaders.get("Connection")).toBeNull();
    expect(forwardedHeaders.get("X-Client-Hop")).toBeNull();
    expect(forwardedHeaders.get("X-Request-Id")).toBe("req_1");
    expect(response.headers.get("Connection")).toBeNull();
    expect(response.headers.get("Keep-Alive")).toBeNull();
    expect(response.headers.get("X-Backend-Hop")).toBeNull();
    expect(response.headers.get("X-Request-Id")).toBe("req_1");
  });

  it("removes spoofable forwarding headers while preserving canonical proxy metadata", async () => {
    let forwardedHeaders;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        forwardedHeaders = init.headers;
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    await onRequest({
      env: { PULLWISE_API_ORIGIN: "https://api.internal" },
      request: new Request("https://pull-wise.com/api/health", {
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
      }),
    });

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
    expect(forwardedHeaders.get("X-Forwarded-Prefix")).toBeNull();
  });

  it("keeps malformed api-prefixed absolute URLs on the configured backend origin", async () => {
    let forwardedUrl;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        forwardedUrl = String(url);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    await onRequest({
      env: { PULLWISE_API_ORIGIN: "https://api.internal" },
      request: new Request("https://pull-wise.com/apihttps://evil.example/steal?x=1"),
    });

    expect(forwardedUrl).toBe("https://api.internal/https://evil.example/steal?x=1");
  });
});
