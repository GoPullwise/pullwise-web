import { describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./pullwise.js";
import { request } from "./http.js";

vi.mock("./http.js", () => ({
  request: vi.fn(),
}));

describe("pullwiseApi issue fix endpoints", () => {
  it("calls preview and pull request endpoints", async () => {
    request.mockResolvedValue({});

    await pullwiseApi.issues.previewFix("f_123");
    await pullwiseApi.issues.createPullRequest("f_123");

    expect(request).toHaveBeenNthCalledWith(1, "/issues/f_123/fixes/preview", { method: "POST" });
    expect(request).toHaveBeenNthCalledWith(2, "/issues/f_123/pull-requests", { method: "POST" });
  });
});
