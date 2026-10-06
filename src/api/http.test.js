// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { ApiError, SERVER_REQUEST_TIMEOUT_MS, http, request } from "./http.js";

describe("ApiError", () => {
  it("preserves structured backend error codes", () => {
    const error = new ApiError("Request rate limit exceeded", {
      status: 429,
      payload: { code: "RATE_LIMITED" },
    });

    expect(error.code).toBe("RATE_LIMITED");
  });
});

describe("request", () => {
  it("uses a 5 minute default request timeout", () => {
    expect(http.defaults.timeout).toBe(SERVER_REQUEST_TIMEOUT_MS);
  });

  it("passes per-request timeout overrides through to the transport", async () => {
    const httpRequest = vi.spyOn(http, "request").mockResolvedValueOnce({ data: "csv" });

    await expect(
      request("/api/v1/expenses/export", {
        responseType: "blob",
        timeout: SERVER_REQUEST_TIMEOUT_MS,
      })
    ).resolves.toBe("csv");

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/expenses/export",
        responseType: "blob",
        timeout: SERVER_REQUEST_TIMEOUT_MS,
      })
    );

    httpRequest.mockRestore();
  });

  it("preserves abort errors so callers can ignore aborted requests", async () => {
    const canceled = new DOMException("canceled", "AbortError");
    const httpRequest = vi.spyOn(http, "request").mockRejectedValueOnce(canceled);

    await expect(
      request("/api/v1/expenses", { signal: new AbortController().signal })
    ).rejects.toBe(canceled);

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

  it("reports a paused service clearly instead of a generic 503 status", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ error: { code: "D1_ACCESS_PAUSED" } }, { status: 503 }));
    try {
      const error = await request("/auth/github/authorize").catch((failure) => failure);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.code).toBe("D1_ACCESS_PAUSED");
      expect(error.message).toBe("Service is temporarily paused. Please try again later.");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { fetchMock.mockRestore(); }
  });

  it("serializes params and drops empty values", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ ok: 1 }));

    await request("/api/v1/expenses", {
      params: { target: "project", projectId: "", limit: 50, owner: undefined },
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/expenses?target=project&limit=50");
    fetchMock.mockRestore();
  });

  it("sends a JSON body only when one is supplied", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ ok: 1 }));

    await request("/api/v1/expenses/exp_1", { method: "PATCH", body: { amount: "20.00" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ amount: "20.00" }));
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.credentials).toBe("include");

    fetchMock.mockRestore();
  });

  it("maps a non-2xx payload onto ApiError with its structured code", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          { message: "Request rate limit exceeded", code: "RATE_LIMITED" },
          { status: 429 }
        )
      );

    const error = await request("/api/v1/expenses", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.message).toBe("Request rate limit exceeded");

    fetchMock.mockRestore();
  });

  it("returns binary downloads as a blob rather than parsed JSON", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("csv-bytes", {
        status: 200,
        headers: { "content-type": "application/zip" },
      })
    );

    // Exercise downloads with the runtime's own fetch and Blob implementations.
    const result = await request("/api/v1/expenses/export", { responseType: "blob" });
    expect(typeof result.arrayBuffer).toBe("function");
    await expect(result.text()).resolves.toBe("csv-bytes");

    fetchMock.mockRestore();
  });

  it("returns null for an empty 204 response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(request("/api-keys/key_1", { method: "DELETE" })).resolves.toBeNull();
    fetchMock.mockRestore();
  });
});
