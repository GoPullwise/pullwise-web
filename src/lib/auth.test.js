import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import {
  connectGitHubRepositories,
  requestMagicLink,
  startGitHubLogin,
} from "./auth.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getGitHubAuthorizeUrl: vi.fn(),
      requestMagicLink: vi.fn(),
      signOut: vi.fn(),
    },
    integrations: {
      getGitHubAuthorizeUrl: vi.fn(),
    },
  },
}));

vi.mock("./install-popup.js", () => ({
  openGitHubInstallPopup: vi.fn(),
}));

function redirectScreen(call) {
  const redirectTo = call[0].redirectTo;
  return new URL(redirectTo).searchParams.get("screen");
}

describe("auth redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/?screen=login#ignored");
  });

  it("returns from GitHub login to the dashboard, not repository authorization", async () => {
    pullwiseApi.auth.getGitHubAuthorizeUrl.mockRejectedValueOnce(new Error("stop"));

    await expect(startGitHubLogin()).rejects.toThrow("stop");

    expect(redirectScreen(pullwiseApi.auth.getGitHubAuthorizeUrl.mock.calls[0])).toBe("dashboard");
  });

  it("returns from email magic links to the dashboard", async () => {
    pullwiseApi.auth.requestMagicLink.mockResolvedValueOnce({ ok: true });

    await requestMagicLink({ email: "dev@example.com" });

    expect(redirectScreen(pullwiseApi.auth.requestMagicLink.mock.calls[0])).toBe("dashboard");
  });

  it("keeps repository authorization scoped to the repositories flow", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockRejectedValueOnce(new Error("stop"));

    await expect(connectGitHubRepositories()).rejects.toThrow("stop");

    expect(redirectScreen(pullwiseApi.integrations.getGitHubAuthorizeUrl.mock.calls[0])).toBe("repos");
  });
});
