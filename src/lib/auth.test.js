import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import {
  connectGitHubRepositories,
  requestMagicLink,
  startGitHubLogin,
} from "./auth.js";
import { openGitHubInstallPopup } from "./install-popup.js";

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
    repositories: {
      sync: vi.fn(),
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

function redirectParam(call, name) {
  const redirectTo = call[0].redirectTo;
  return new URL(redirectTo).searchParams.get(name);
}

describe("auth redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/?screen=login#ignored");
  });

  it("returns from GitHub login to the landing page, not the dashboard", async () => {
    pullwiseApi.auth.getGitHubAuthorizeUrl.mockRejectedValueOnce(new Error("stop"));

    await expect(startGitHubLogin()).rejects.toThrow("stop");

    expect(redirectScreen(pullwiseApi.auth.getGitHubAuthorizeUrl.mock.calls[0])).toBe("landing");
  });

  it("returns from email magic links to the landing page", async () => {
    pullwiseApi.auth.requestMagicLink.mockResolvedValueOnce({ ok: true });

    await requestMagicLink({ email: "dev@example.com" });

    expect(redirectScreen(pullwiseApi.auth.requestMagicLink.mock.calls[0])).toBe("landing");
  });

  it("keeps repository authorization scoped to the repositories flow", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockRejectedValueOnce(new Error("stop"));

    await expect(connectGitHubRepositories()).rejects.toThrow("stop");

    expect(redirectScreen(pullwiseApi.integrations.getGitHubAuthorizeUrl.mock.calls[0])).toBe("repos");
  });

  it("starts GitHub login first when repository authorization requires a GitHub identity", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockRejectedValueOnce(
      Object.assign(new Error("Sign in with GitHub before authorizing repositories."), { status: 401 })
    );
    pullwiseApi.auth.getGitHubAuthorizeUrl.mockRejectedValueOnce(new Error("login-started"));

    await expect(connectGitHubRepositories()).rejects.toThrow("login-started");

    expect(redirectScreen(pullwiseApi.auth.getGitHubAuthorizeUrl.mock.calls[0])).toBe("repos");
    expect(redirectParam(pullwiseApi.auth.getGitHubAuthorizeUrl.mock.calls[0], "repoAuth")).toBe("1");
    expect(openGitHubInstallPopup).not.toHaveBeenCalled();
  });

  it("does not open the GitHub install popup when an existing app installation is connected", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockResolvedValueOnce({
      connected: true,
      mode: "github-app-existing",
    });
    pullwiseApi.repositories.sync.mockResolvedValueOnce({
      needsAuthorization: false,
      items: [{ fullName: "octocat/private-repo" }],
    });

    await expect(connectGitHubRepositories()).resolves.toBeUndefined();

    expect(openGitHubInstallPopup).not.toHaveBeenCalled();
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
  });

  it("opens GitHub installation settings and syncs repositories for connected app installations", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockResolvedValueOnce({
      connected: true,
      mode: "github-app-existing",
      url: "https://github.com/settings/installations/999",
    });
    openGitHubInstallPopup.mockResolvedValueOnce(undefined);
    pullwiseApi.repositories.sync.mockResolvedValueOnce({
      needsAuthorization: false,
      items: [{ fullName: "octocat/private-repo" }],
    });

    await expect(connectGitHubRepositories()).resolves.toBeUndefined();

    expect(openGitHubInstallPopup).toHaveBeenCalledWith("https://github.com/settings/installations/999");
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
  });

  it("does not treat connected responses as successful until repositories are actually available", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockResolvedValueOnce({
      connected: true,
      mode: "github-app-existing",
    });
    pullwiseApi.repositories.sync.mockResolvedValueOnce({
      needsAuthorization: true,
      items: [],
      repositories: [],
    });

    await expect(connectGitHubRepositories()).rejects.toMatchObject({
      code: "no_authorized_repositories",
    });

    expect(openGitHubInstallPopup).not.toHaveBeenCalled();
  });
});
