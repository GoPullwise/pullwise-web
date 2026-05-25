import { describe, expect, it } from "vitest";
import { ApiError } from "./http.js";

describe("ApiError", () => {
  it("preserves structured backend error codes", () => {
    const error = new ApiError("Repository quota exceeded", {
      status: 429,
      payload: { code: "QUOTA_EXCEEDED_REPOSITORY" },
    });

    expect(error.code).toBe("QUOTA_EXCEEDED_REPOSITORY");
  });
});
