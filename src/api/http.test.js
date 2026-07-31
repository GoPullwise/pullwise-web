import { describe, expect, it, vi } from "vitest";
import { ApiError, SERVER_REQUEST_TIMEOUT_MS, http, request } from "./http.js";

describe("ApiError", () => {
  it("preserves structured backend error codes", () => {
    const error = new ApiError("Repository quota exceeded", {
      status: 429,
      payload: { code: "QUOTA_EXCEEDED_REPOSITORY" },
    });

    expect(error.code).toBe("QUOTA_EXCEEDED_REPOSITORY");
  });
});

describe("request", () => {
  it("uses a 5 minute default request timeout", () => {
    expect(http.defaults.timeout).toBe(SERVER_REQUEST_TIMEOUT_MS);
  });

  it("passes per-request timeout overrides through to the transport", async () => {
    const httpRequest = vi.spyOn(http, "request").mockResolvedValueOnce({ data: "zip" });

    await expect(
      request("/scans/sc_done/audit-bundle.zip", {
        responseType: "blob",
        timeout: SERVER_REQUEST_TIMEOUT_MS,
      })
    ).resolves.toBe("zip");

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/scans/sc_done/audit-bundle.zip",
        responseType: "blob",
        timeout: SERVER_REQUEST_TIMEOUT_MS,
      })
    );

    httpRequest.mockRestore();
  });

  it("preserves abort errors so callers can ignore aborted requests", async () => {
    const canceled = new DOMException("canceled", "AbortError");
    const httpRequest = vi.spyOn(http, "request").mockRejectedValueOnce(canceled);

    await expect(request("/scans", { signal: new AbortController().signal })).rejects.toBe(
      canceled
    );

    httpRequest.mockRestore();
  });
});

describe("fetch transport", () => {
  function jsonResponse(body, { status = 200 } = {}) {
    return new Response(body === null ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("serializes params and drops empty values", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ ok: 1 }));

    await request("/scans", { params: { status: "done", repo: "", limit: 50, owner: undefined } });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/scans?status=done&limit=50");
    fetchMock.mockRestore();
  });

  it("sends a JSON body only when one is supplied", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ ok: 1 }));

    await request("/issues/i_1/status", { method: "PATCH", body: { status: "fixed" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ status: "fixed" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.credentials).toBe("include");

    fetchMock.mockRestore();
  });

  it("maps a non-2xx payload onto ApiError with its structured code", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ message: "Repository quota exceeded", code: "QUOTA_EXCEEDED_REPOSITORY" }, { status: 429 })
      );

    const error = await request("/scans", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(error.code).toBe("QUOTA_EXCEEDED_REPOSITORY");
    expect(error.message).toBe("Repository quota exceeded");

    fetchMock.mockRestore();
  });

  it("returns binary downloads as a blob rather than parsed JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("zip-bytes", {
          status: 200,
          headers: { "content-type": "application/zip" },
        })
      );

    // jsdom's Blob global and undici's Response.blob() are different realms,
    // so assert on shape and content rather than instanceof.
    const result = await request("/scans/sc_done/audit-bundle.zip", { responseType: "blob" });
    expect(typeof result.arrayBuffer).toBe("function");
    await expect(result.text()).resolves.toBe("zip-bytes");

    fetchMock.mockRestore();
  });

  it("returns null for an empty 204 response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(request("/sessions", { method: "DELETE" })).resolves.toBeNull();
    fetchMock.mockRestore();
  });
});
