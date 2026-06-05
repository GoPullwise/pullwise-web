import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./pullwise.js";
import { request } from "./http.js";

vi.mock("./http.js", () => ({
  request: vi.fn(),
}));

describe("pullwiseApi issue fix endpoints", () => {
  beforeEach(() => {
    request.mockReset();
  });

  it("calls preview and pull request endpoints", async () => {
    request.mockResolvedValue({});

    await pullwiseApi.issues.previewFix("f_123");
    await pullwiseApi.issues.createPullRequest("f_123");

    expect(request).toHaveBeenNthCalledWith(1, "/issues/f_123/fixes/preview", { method: "POST" });
    expect(request).toHaveBeenNthCalledWith(2, "/issues/f_123/pull-requests", { method: "POST" });
  });

  it("encodes dynamic path segments before calling routed endpoints", async () => {
    request.mockResolvedValue({});

    await pullwiseApi.scans.get("scan/with spaces#1");
    await pullwiseApi.scans.auditBundle("scan/with spaces#1");
    await pullwiseApi.scans.auditBundleArchive("scan/with spaces#1");
    await pullwiseApi.scans.cancel("scan/with spaces#1");
    await pullwiseApi.issues.get("issue/with spaces#1");
    await pullwiseApi.issues.updateStatus("issue/with spaces#1", { status: "fixed" });
    await pullwiseApi.issues.previewFix("issue/with spaces#1");
    await pullwiseApi.issues.createPullRequest("issue/with spaces#1");
    await pullwiseApi.integrations.disconnect("slack/custom");
    await pullwiseApi.integrations.createGitHubInstallationManageSession("install/999", {
      githubIdentityId: "ghi_1",
    });
    await pullwiseApi.apiKeys.revoke("key/with spaces#1");

    expect(request).toHaveBeenNthCalledWith(1, "/scans/scan%2Fwith%20spaces%231");
    expect(request).toHaveBeenNthCalledWith(2, "/scans/scan%2Fwith%20spaces%231/audit-bundle");
    expect(request).toHaveBeenNthCalledWith(3, "/scans/scan%2Fwith%20spaces%231/audit-bundle.zip", {
      responseType: "blob",
    });
    expect(request).toHaveBeenNthCalledWith(4, "/scans/scan%2Fwith%20spaces%231/cancel", {
      method: "POST",
    });
    expect(request).toHaveBeenNthCalledWith(5, "/issues/issue%2Fwith%20spaces%231");
    expect(request).toHaveBeenNthCalledWith(6, "/issues/issue%2Fwith%20spaces%231/status", {
      method: "PATCH",
      body: { status: "fixed" },
    });
    expect(request).toHaveBeenNthCalledWith(7, "/issues/issue%2Fwith%20spaces%231/fixes/preview", {
      method: "POST",
    });
    expect(request).toHaveBeenNthCalledWith(8, "/issues/issue%2Fwith%20spaces%231/pull-requests", {
      method: "POST",
    });
    expect(request).toHaveBeenNthCalledWith(9, "/integrations/slack%2Fcustom", {
      method: "DELETE",
    });
    expect(request).toHaveBeenNthCalledWith(
      10,
      "/integrations/github/installations/install%2F999/manage-sessions",
      {
        method: "POST",
        body: { githubIdentityId: "ghi_1" },
      }
    );
    expect(request).toHaveBeenNthCalledWith(11, "/api-keys/key%2Fwith%20spaces%231", {
      method: "DELETE",
    });
  });

  it("calls API key endpoints", async () => {
    request.mockResolvedValue({});

    await pullwiseApi.apiKeys.list();
    await pullwiseApi.apiKeys.create({ name: "CI" });

    expect(request).toHaveBeenNthCalledWith(1, "/api-keys");
    expect(request).toHaveBeenNthCalledWith(2, "/api-keys", {
      method: "POST",
      body: { name: "CI" },
    });
  });

  it("rejects empty dynamic path segments before making a request", () => {
    expect(() => pullwiseApi.scans.get("")).toThrow(/path segment/i);
    expect(() => pullwiseApi.scans.auditBundle("")).toThrow(/path segment/i);
    expect(() => pullwiseApi.scans.auditBundleArchive("")).toThrow(/path segment/i);
    expect(() => pullwiseApi.scans.cancel(null)).toThrow(/path segment/i);
    expect(() => pullwiseApi.issues.get(undefined)).toThrow(/path segment/i);
    expect(() => pullwiseApi.issues.updateStatus("", { status: "fixed" })).toThrow(/path segment/i);
    expect(() => pullwiseApi.issues.previewFix("")).toThrow(/path segment/i);
    expect(() => pullwiseApi.issues.createPullRequest("")).toThrow(/path segment/i);
    expect(() => pullwiseApi.integrations.disconnect("")).toThrow(/path segment/i);
    expect(() => pullwiseApi.integrations.createGitHubInstallationManageSession("", {})).toThrow(
      /path segment/i
    );
    expect(() => pullwiseApi.apiKeys.revoke("")).toThrow(/path segment/i);

    expect(request).not.toHaveBeenCalled();
  });
});
