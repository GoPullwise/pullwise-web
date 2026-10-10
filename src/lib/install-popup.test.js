import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { captureGitHubRefreshScope, setGitHubRefreshIdentity } from "../api/github-refresh.js";
import { notifyOpenerAndClose, openGitHubInstallPopup } from "./install-popup.js";

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
    vi.clearAllMocks();
    setGitHubRefreshIdentity(null);
    setGitHubRefreshIdentity("usr_one");
    vi.spyOn(window, "open").mockReturnValue({
      closed: true,
      close: vi.fn(),
      focus: vi.fn(),
    });
  });

  afterEach(() => {
    setGitHubRefreshIdentity(null);
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
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledWith(
      { installationId: "999", githubIdentityId: "ghi_1" },
      { scope: captureGitHubRefreshScope(), signal: undefined }
    );
  });

  it("does not sync a manage popup that closes before the manage flow is verified", async () => {
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", {
      installationId: "999",
      githubIdentityId: "ghi_1",
      requireCloseSyncReady: true,
    });
    const expectation = expect(completion).rejects.toMatchObject({
      code: "popup_closed",
    });

    await vi.advanceTimersByTimeAsync(400);

    await expectation;
    expect(pullwiseApi.auth.getSession).not.toHaveBeenCalled();
    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
  });

  it("syncs a manage popup after the same-origin manage continuation is reached", async () => {
    const popup = {
      closed: false,
      close: vi.fn(),
      focus: vi.fn(),
    };
    window.open.mockReturnValueOnce(popup);
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
      requireCloseSyncReady: true,
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source: popup,
        data: {
          type: "pullwise:github-install",
          ok: true,
          closeSyncReady: true,
        },
      })
    );
    popup.closed = true;
    await vi.advanceTimersByTimeAsync(400);

    await expect(completion).resolves.toBeUndefined();
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledWith(
      { installationId: "999", githubIdentityId: "ghi_1" },
      { scope: captureGitHubRefreshScope(), signal: undefined }
    );
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
        source: popup,
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

  it("rejects non-trusted popup hosts before opening a browser window", () => {
    expect(() => openGitHubInstallPopup("https://evil.example/phish")).toThrow(
      /safe GitHub installation popup URL/i
    );

    expect(window.open).not.toHaveBeenCalled();
  });

  it("ignores same-origin install completion messages from windows other than the opened popup", async () => {
    const popup = {
      closed: false,
      close: vi.fn(),
      focus: vi.fn(),
    };
    window.open.mockReturnValueOnce(popup);

    const controller = new AbortController();
    const completion = openGitHubInstallPopup(
      "https://github.com/apps/pullwise/installations/new",
      undefined,
      { signal: controller.signal }
    );
    const aborted = expect(completion).rejects.toMatchObject({ name: "AbortError" });

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        source: window,
        data: {
          type: "pullwise:github-install",
          ok: true,
        },
      })
    );

    expect(popup.close).not.toHaveBeenCalled();
    controller.abort();
    await aborted;
  });

  it("closes an old account's pending popup without verifying or renewing the new account", async () => {
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() };
    window.open.mockReturnValueOnce(popup);
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
    const aborted = expect(completion).rejects.toMatchObject({ name: "AbortError" });

    setGitHubRefreshIdentity("usr_two");
    const newScope = captureGitHubRefreshScope();
    await aborted;
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin,
      source: popup,
      data: { type: "pullwise:github-install", ok: true },
    }));
    await vi.advanceTimersByTimeAsync(800);

    expect(popup.close).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.auth.getSession).not.toHaveBeenCalled();
    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
    expect(newScope.controller.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("discards a closed-popup session result received after the account changed", async () => {
    let receiveSession;
    pullwiseApi.auth.getSession.mockReturnValueOnce(new Promise((resolve) => { receiveSession = resolve; }));
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
    const aborted = expect(completion).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(400);
    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);

    setGitHubRefreshIdentity("usr_two");
    await aborted;
    receiveSession({ authenticated: true, github: { repositoriesConnected: false } });
    await Promise.resolve();
    await Promise.resolve();

    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a repository verification that completes after its account changed", async () => {
    pullwiseApi.auth.getSession.mockResolvedValueOnce({ authenticated: true });
    let receiveRepositories;
    pullwiseApi.repositories.sync.mockReturnValueOnce(new Promise((resolve) => { receiveRepositories = resolve; }));
    const scope = captureGitHubRefreshScope();
    const controller = new AbortController();
    const completion = openGitHubInstallPopup(
      "https://github.com/apps/pullwise/installations/new",
      undefined,
      { signal: controller.signal }
    );
    const aborted = expect(completion).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(400);
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledWith(undefined, { scope, signal: controller.signal });

    setGitHubRefreshIdentity("usr_two");
    await aborted;
    receiveRepositories({ needsAuthorization: false });
    await Promise.resolve();
    await Promise.resolve();

    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a caller abort distinct from a GitHub verification error", async () => {
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() };
    window.open.mockReturnValueOnce(popup);
    const controller = new AbortController();
    const completion = openGitHubInstallPopup(
      "https://github.com/apps/pullwise/installations/new",
      undefined,
      { signal: controller.signal }
    );
    const aborted = expect(completion).rejects.toMatchObject({ name: "AbortError" });

    controller.abort();
    await aborted;
    expect(popup.close).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.auth.getSession).not.toHaveBeenCalled();
    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("notifyOpenerAndClose", () => {
  const originalName = window.name;
  const originalOpener = window.opener;

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    window.name = originalName;
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: originalOpener,
    });
    vi.restoreAllMocks();
  });

  it("rejects external manage continuation URLs instead of redirecting the popup", () => {
    const opener = {
      postMessage: vi.fn(),
      closed: false,
    };
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: opener,
    });
    window.history.replaceState(
      {},
      "",
      "/?github_manage_continue_url=https%3A%2F%2Fevil.example%2Fphish"
    );
    vi.spyOn(window, "close").mockImplementation(() => {});

    notifyOpenerAndClose();

    expect(opener.postMessage).toHaveBeenCalledWith(
      {
        type: "pullwise:github-install",
        ok: false,
        error: "invalid_manage_continue_url",
        closeSyncReady: false,
      },
      window.location.origin
    );
  });
});
