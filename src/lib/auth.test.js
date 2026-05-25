import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { connectGitHubRepositories, startGitHubLogin } from "./auth.js";
import { openGitHubInstallPopup } from "./install-popup.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getGitHubAuthorizeUrl: vi.fn(),
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

  it("keeps repository authorization scoped to the repositories flow", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockRejectedValueOnce(new Error("stop"));

    await expect(connectGitHubRepositories()).rejects.toThrow("stop");

    expect(redirectScreen(pullwiseApi.integrations.getGitHubAuthorizeUrl.mock.calls[0])).toBe(
      "repos"
    );
  });

  it("starts GitHub login first when repository authorization requires a GitHub identity", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockRejectedValueOnce(
      Object.assign(new Error("Sign in with GitHub before authorizing repositories."), {
        status: 401,
      })
    );
    pullwiseApi.auth.getGitHubAuthorizeUrl.mockRejectedValueOnce(new Error("login-started"));

    await expect(connectGitHubRepositories()).rejects.toThrow("login-started");

    expect(redirectScreen(pullwiseApi.auth.getGitHubAuthorizeUrl.mock.calls[0])).toBe("repos");
    expect(redirectParam(pullwiseApi.auth.getGitHubAuthorizeUrl.mock.calls[0], "repoAuth")).toBe(
      "1"
    );
    expect(openGitHubInstallPopup).not.toHaveBeenCalled();
  });

  it("rejects unsafe GitHub login URLs before navigating", async () => {
    pullwiseApi.auth.getGitHubAuthorizeUrl.mockResolvedValueOnce({
      url: "javascript:alert(1)",
    });

    await expect(startGitHubLogin()).rejects.toThrow(/safe GitHub authorize URL/i);
  });

  it("rejects unsafe repository authorization URLs before opening a popup", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockResolvedValueOnce({
      url: "javascript:alert(1)",
      mode: "github-app-install",
    });

    await expect(connectGitHubRepositories()).rejects.toThrow(
      /safe GitHub repository authorization URL/i
    );

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

  it("opens GitHub installation settings and syncs repositories when managing connected app installations", async () => {
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

    await expect(connectGitHubRepositories({ manage: true })).resolves.toBeUndefined();

    expect(pullwiseApi.integrations.getGitHubAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({ manage: "1" })
    );
    expect(openGitHubInstallPopup).toHaveBeenCalledWith(
      "https://github.com/settings/installations/999"
    );
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
  });

  it("opens the GitHub install URL when adding another account or organization", async () => {
    pullwiseApi.integrations.getGitHubAuthorizeUrl.mockResolvedValueOnce({
      mode: "github-app-add",
      url: "https://github.com/apps/pullwise/installations/new?state=abc",
    });
    openGitHubInstallPopup.mockResolvedValueOnce(undefined);
    pullwiseApi.repositories.sync.mockResolvedValueOnce({
      needsAuthorization: false,
      items: [{ fullName: "acme/service" }],
    });

    await expect(connectGitHubRepositories({ add: true })).resolves.toBeUndefined();

    expect(pullwiseApi.integrations.getGitHubAuthorizeUrl).toHaveBeenCalledWith(
      expect.objectContaining({ add: "1", manage: undefined })
    );
    expect(openGitHubInstallPopup).toHaveBeenCalledWith(
      "https://github.com/apps/pullwise/installations/new?state=abc"
    );
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
