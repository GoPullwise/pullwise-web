import axios from "axios";
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

  it("passes per-request timeout overrides through to axios", async () => {
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

  it("preserves axios cancellation errors so callers can ignore aborted requests", async () => {
    const canceled = new axios.CanceledError("canceled");
    const httpRequest = vi.spyOn(http, "request").mockRejectedValueOnce(canceled);

    await expect(request("/scans", { signal: new AbortController().signal })).rejects.toBe(
      canceled
    );

    httpRequest.mockRestore();
  });
});
