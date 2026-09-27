import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./pullwise.js";
import { request } from "./http.js";

vi.mock("./http.js", () => ({ request: vi.fn() }));

describe("pullwiseApi current product endpoints", () => {
  beforeEach(() => request.mockReset());

  it("does not expose the retired scan and issue clients", () => {
    expect(pullwiseApi.scans).toBeUndefined();
    expect(pullwiseApi.issues).toBeUndefined();
    expect(pullwiseApi.apiKeys.createAuditBundleKey).toBeUndefined();
  });

  it("encodes dynamic path segments for current account operations", async () => {
    request.mockResolvedValue({});

    await pullwiseApi.integrations.disconnect("github/custom");
    await pullwiseApi.integrations.createGitHubInstallationManageSession("install/999", {
      githubIdentityId: "ghi_1",
    });
    await pullwiseApi.apiKeys.revoke("key/with spaces#1");

    expect(request).toHaveBeenNthCalledWith(1, "/integrations/github%2Fcustom", {
      method: "DELETE",
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/integrations/github/installations/install%2F999/manage-sessions",
      { method: "POST", body: { githubIdentityId: "ghi_1" } }
    );
    expect(request).toHaveBeenNthCalledWith(3, "/api-keys/key%2Fwith%20spaces%231", {
      method: "DELETE",
    });
  });

  it("calls current API key endpoints", async () => {
    request.mockResolvedValue({});

    await pullwiseApi.apiKeys.list();
    await pullwiseApi.apiKeys.create({ name: "Automation" });

    expect(request).toHaveBeenNthCalledWith(1, "/api-keys");
    expect(request).toHaveBeenNthCalledWith(2, "/api-keys", {
      method: "POST",
      body: { name: "Automation" },
    });
  });

  it("passes abort signals to health and billing requests", async () => {
    request.mockResolvedValue({});
    const controller = new AbortController();

    await pullwiseApi.system.health({ signal: controller.signal });
    await pullwiseApi.billing.createCheckoutSession({ plan: "pro" }, { signal: controller.signal });

    expect(request).toHaveBeenNthCalledWith(1, "/health", { signal: controller.signal });
    expect(request).toHaveBeenNthCalledWith(2, "/billing/checkout-sessions", {
      method: "POST",
      body: { plan: "pro" },
      signal: controller.signal,
    });
  });

  it("rejects empty dynamic account path segments", () => {
    expect(() => pullwiseApi.integrations.disconnect("")).toThrow(/path segment/i);
    expect(() => pullwiseApi.integrations.createGitHubInstallationManageSession("", {})).toThrow(/path segment/i);
    expect(() => pullwiseApi.apiKeys.revoke("")).toThrow(/path segment/i);
    expect(request).not.toHaveBeenCalled();
  });
});
