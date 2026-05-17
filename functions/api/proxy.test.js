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
      request: new Request("https://app.pullwise.dev/api/auth/email/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "dev@example.com" }),
        headers: { "Content-Type": "application/json" },
      }),
    });

    expect(forwardedHeaders.get("X-Forwarded-Proto")).toBe("https");
    expect(forwardedHeaders.get("X-Forwarded-Host")).toBe("app.pullwise.dev");
    expect(forwardedHeaders.get("X-Forwarded-Prefix")).toBe("/api");
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
      request: new Request("https://app.pullwise.dev/api/health", {
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
});
