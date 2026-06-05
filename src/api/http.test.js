import { describe, expect, it, vi } from "vitest";
import { ApiError, http, request } from "./http.js";

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
  it("passes per-request timeout overrides through to axios", async () => {
    const httpRequest = vi.spyOn(http, "request").mockResolvedValueOnce({ data: "zip" });

    await expect(
      request("/scans/sc_done/audit-bundle.zip", {
        responseType: "blob",
        timeout: 120000,
      })
    ).resolves.toBe("zip");

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/scans/sc_done/audit-bundle.zip",
        responseType: "blob",
        timeout: 120000,
      })
    );

    httpRequest.mockRestore();
  });
});
