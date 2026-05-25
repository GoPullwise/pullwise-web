import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { openGitHubInstallPopup } from "./install-popup.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getSession: vi.fn(),
    },
    repositories: {
      sync: vi.fn(),
    },
  },
}));

describe("openGitHubInstallPopup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "open").mockReturnValue({
      closed: true,
      close: vi.fn(),
      focus: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("treats a closed popup as successful when the backend session has GitHub repositories", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      github: {
        repositoriesConnected: true,
      },
    });

    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", {
      installationId: "999",
      githubIdentityId: "ghi_1",
    });

    await vi.advanceTimersByTimeAsync(400);

    await expect(completion).resolves.toBeUndefined();
  });

  it("syncs repositories after a closed popup so GitHub configure pages can bind existing installations", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      github: {
        repositoriesConnected: false,
      },
    });
    pullwiseApi.repositories.sync.mockResolvedValue({
      needsAuthorization: false,
      items: [{ id: "repo_1", fullName: "octocat/private-repo" }],
    });

    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", {
      installationId: "999",
      githubIdentityId: "ghi_1",
    });

    await vi.advanceTimersByTimeAsync(400);

    await expect(completion).resolves.toBeUndefined();
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledWith({
      installationId: "999",
      githubIdentityId: "ghi_1",
    });
  });

  it("preserves repository sync issue codes after a closed popup", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      github: {
        repositoriesConnected: false,
      },
    });
    pullwiseApi.repositories.sync.mockResolvedValue({
      needsAuthorization: true,
      repositoriesNeedSync: true,
      authorizationIssue: "github_app_api_unconfigured",
      message: "GitHub App API is not configured.",
    });

    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
    const expectation = expect(completion).rejects.toMatchObject({
      code: "github_app_api_unconfigured",
      message: "GitHub App API is not configured.",
    });

    await vi.advanceTimersByTimeAsync(400);

    await expectation;
  });

  it("preserves backend github_error codes from popup returns", async () => {
    const popup = {
      closed: false,
      close: vi.fn(),
      focus: vi.fn(),
    };
    window.open.mockReturnValueOnce(popup);
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "pullwise:github-install",
          ok: false,
          error: "missing_installation_id",
        },
      })
    );

    await expect(completion).rejects.toMatchObject({
      code: "missing_installation_id",
      message: "missing_installation_id",
    });
  });

  it("rejects unsafe popup URLs before opening a browser window", () => {
    expect(() => openGitHubInstallPopup("javascript:alert(1)")).toThrow(
      /safe GitHub installation popup URL/i
    );

    expect(window.open).not.toHaveBeenCalled();
  });
});
