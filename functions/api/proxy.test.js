import { afterEach, describe, expect, it, vi } from "vitest";

import { onRequest } from "./[[path]].js";

describe("api proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards the public Pages API base to the backend", async () => {
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
      request: new Request("https://app.pullwise.dev/api/auth/email/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "dev@example.com" }),
        headers: { "Content-Type": "application/json" },
      }),
    });

    expect(forwardedHeaders.get("X-Forwarded-Proto")).toBe("https");
    expect(forwardedHeaders.get("X-Forwarded-Host")).toBe("app.pullwise.dev");
    expect(forwardedHeaders.get("X-Forwarded-Prefix")).toBe("/api");
  });
});
