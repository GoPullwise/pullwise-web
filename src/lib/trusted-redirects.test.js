import { beforeEach, describe, expect, it } from "vitest";
import { safeGitHubAuthorizeUrl } from "./trusted-redirects.js";

describe("trusted GitHub authorize redirects", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/dashboard/overview");
  });

  it("accepts GitHub OAuth authorize URLs", () => {
    const url = "https://github.com/login/oauth/authorize?client_id=pullwise&state=abc";

    expect(safeGitHubAuthorizeUrl(url, "GitHub authorize URL")).toBe(url);
  });

  it("accepts trusted first-party GitHub authorize endpoints", () => {
    const url = `${window.location.origin}/api/auth/github/authorize?redirectTo=%2Fdashboard`;

    expect(safeGitHubAuthorizeUrl(url, "GitHub authorize URL")).toBe(url);
  });

  it("rejects non-authorize GitHub paths", () => {
    expect(() =>
      safeGitHubAuthorizeUrl("https://github.com/settings/profile", "GitHub authorize URL")
    ).toThrow(/safe GitHub authorize URL/i);
  });

  it("rejects non-trusted authorize hosts", () => {
    expect(() =>
      safeGitHubAuthorizeUrl("https://evil.example/phish", "GitHub authorize URL")
    ).toThrow(/safe GitHub authorize URL/i);
  });
});
