import { beforeEach, describe, expect, it } from "vitest";
import {
  safeBillingRedirectUrl,
  safeGitHubAuthorizeUrl,
  safeGitHubInstallationUrl,
} from "./trusted-redirects.js";

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

  it("accepts loopback local-mock GitHub callback endpoints", () => {
    const url = `${window.location.origin}/auth/github/callback?redirectTo=%2Fdashboard`;

    expect(safeGitHubAuthorizeUrl(url, "GitHub authorize URL")).toBe(url);
  });

  it("rejects non-loopback first-party GitHub callback endpoints", () => {
    expect(() =>
      safeGitHubAuthorizeUrl(
        "https://api.pull-wise.com/auth/github/callback?redirectTo=%2Fdashboard",
        "GitHub authorize URL"
      )
    ).toThrow(/safe GitHub authorize URL/i);
  });

  it("accepts same-origin GitHub installation endpoints", () => {
    const url = `${window.location.origin}/api/integrations/github/install/start?state=abc`;

    expect(safeGitHubInstallationUrl(url, "GitHub installation URL")).toBe(url);
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

describe("trusted billing redirects", () => {
  it.each(["checkout.creem.io", "test-checkout.creem.io", "creem.io"])(
    "accepts the exact HTTPS provider host %s",
    (host) => {
      const url = `https://${host}/checkout/ch_1`;
      expect(safeBillingRedirectUrl(url, "billing checkout URL")).toBe(url);
    }
  );

  it.each([
    "https://checkout.creem.io.evil.example/ch_1",
    "https://user:password@checkout.creem.io/ch_1",
    "https://checkout.creem.io:444/ch_1",
    "https://pull-wise.com:444/billing",
    "\r\nhttps://checkout.creem.io/ch_1",
    "https://checkout.creem.io/ch_1\n",
  ])("rejects unsafe redirect %s", (url) => {
    expect(() => safeBillingRedirectUrl(url, "billing checkout URL")).toThrow(
      /safe billing checkout URL/i
    );
  });

  it("allows same-origin returns while rejecting embedded credentials", () => {
    const url = `${window.location.origin}/billing?billing=success`;
    expect(safeBillingRedirectUrl(url, "billing return URL")).toBe(url);
    const credentials = new URL(url);
    credentials.username = "user";
    expect(() => safeBillingRedirectUrl(credentials.toString(), "billing return URL")).toThrow(
      /safe billing return URL/i
    );
  });
});
