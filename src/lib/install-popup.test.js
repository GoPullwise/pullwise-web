import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { captureGitHubRefreshScope, setGitHubRefreshIdentity } from "../api/github-refresh.js";
import { ApiError } from "../api/http.js";
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
    pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true, user: { id: "usr_one" } });
    pullwiseApi.repositories.sync.mockResolvedValue({ needsAuthorization: true, githubAccess: "not_connected", items: [] });
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

  it("checks current access instead of treating a cached connection as this popup completing", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      user: { id: "usr_one" },
      github: {
        repositoriesConnected: true,
      },
    });

    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", {
      installationId: "999",
      githubIdentityId: "ghi_1",
    });

    await vi.advanceTimersByTimeAsync(400);

    await expect(completion).resolves.toMatchObject({ status: "closed_unverified" });
  });

  it("refreshes repositories when a GitHub configure page closes without claiming a new installation", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      user: { id: "usr_one" },
      github: {
        repositoriesConnected: false,
      },
    });
    pullwiseApi.repositories.sync.mockResolvedValue({
      needsAuthorization: false,
      githubAccess: "authorized",
      items: [{ id: "repo_1", fullName: "octocat/private-repo", installationId: "999" }],
    });

    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", {
      installationId: "999",
      githubIdentityId: "ghi_1",
    });

    await vi.advanceTimersByTimeAsync(400);

    await expect(completion).resolves.toMatchObject({ status: "closed_unverified" });
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledWith(
      { installationId: "999", githubIdentityId: "ghi_1" },
      { scope: captureGitHubRefreshScope(), signal: undefined }
    );
  });

  it("refreshes current access but does not confirm a manage popup without its trusted continuation", async () => {
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", {
      installationId: "999", githubIdentityId: "ghi_1", requireCloseSyncReady: true,
    });
    await vi.advanceTimersByTimeAsync(400);
    await expect(completion).resolves.toMatchObject({ status: "closed_unverified" });
    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
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
      user: { id: "usr_one" },
      github: {
        repositoriesConnected: false,
      },
    });
    pullwiseApi.repositories.sync.mockResolvedValue({
      needsAuthorization: false,
      githubAccess: "authorized",
      items: [{ id: "repo_1", fullName: "octocat/private-repo", installationId: "999" }],
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

    await expect(completion).resolves.toMatchObject({ status: "closed_unverified" });
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledWith(
      { installationId: "999", githubIdentityId: "ghi_1" },
      { scope: captureGitHubRefreshScope(), signal: undefined }
    );
  });

  it("preserves repository sync issue codes after a closed popup", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      user: { id: "usr_one" },
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
    receiveSession({ authenticated: true, user: { id: "usr_one" }, github: { repositoriesConnected: false } });
    await Promise.resolve();
    await Promise.resolve();

    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a repository verification that completes after its account changed", async () => {
    pullwiseApi.auth.getSession.mockResolvedValueOnce({ authenticated: true, user: { id: "usr_one" } });
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

  it("returns a neutral close outcome when no repository authorization completed", async () => {
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
    await vi.advanceTimersByTimeAsync(2400);
    await expect(completion).resolves.toMatchObject({
      status: "closed_unverified",
      repositories: { githubAccess: "not_connected", needsAuthorization: true, items: [] },
    });
    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a manage continuation unconfirmed when only another installation is available", async () => {
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() };
    window.open.mockReturnValueOnce(popup);
    pullwiseApi.repositories.sync.mockResolvedValue({
      githubAccess: "authorized", needsAuthorization: false,
      items: [{ installationId: "other", fullName: "old/repository" }],
    });
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", {
      installationId: "999", requireCloseSyncReady: true,
    }, { nonce: "this-attempt" });
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin, source: popup,
      data: { type: "pullwise:github-install", ok: true, closeSyncReady: true, nonce: "this-attempt" },
    }));
    popup.closed = true;
    await vi.advanceTimersByTimeAsync(400);
    await expect(completion).resolves.toMatchObject({ status: "closed_unverified" });
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
  });

  it.each(["origin", "source", "nonce"])("ignores a completion with the wrong %s", async (wrong) => {
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() };
    window.open.mockReturnValueOnce(popup);
    const controller = new AbortController();
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", undefined, {
      signal: controller.signal, nonce: "this-attempt",
    });
    const aborted = expect(completion).rejects.toMatchObject({ name: "AbortError" });
    window.dispatchEvent(new MessageEvent("message", {
      origin: wrong === "origin" ? "https://other.example" : window.location.origin,
      source: wrong === "source" ? window : popup,
      data: { type: "pullwise:github-install", ok: true, nonce: wrong === "nonce" ? "old-attempt" : "this-attempt" },
    }));
    expect(popup.close).not.toHaveBeenCalled();
    controller.abort();
    await aborted;
    expect(pullwiseApi.auth.getSession).not.toHaveBeenCalled();
    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
  });

  it("preserves an explicit provider cancellation while treating ordinary close separately", async () => {
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() };
    window.open.mockReturnValueOnce(popup);
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new", undefined, {
      nonce: "this-attempt",
    });
    window.dispatchEvent(new MessageEvent("message", {
      origin: window.location.origin, source: popup,
      data: { type: "pullwise:github-install", ok: false, error: "access_denied", nonce: "this-attempt" },
    }));
    await expect(completion).rejects.toMatchObject({ code: "access_denied" });
    expect(pullwiseApi.auth.getSession).not.toHaveBeenCalled();
    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
  });

  it.each([false, "usr_other"])("rejects a changed cookie session %s before reading grants", async (account) => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: Boolean(account), user: account ? { id: account } : null,
      github: { repositoriesConnected: true },
    });
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
    const aborted = expect(completion).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(400);
    await aborted;
    expect(pullwiseApi.repositories.sync).not.toHaveBeenCalled();
  });

  it.each(["session", "sync"])("keeps %s API verification failures distinct from ordinary close", async (step) => {
    const failure = new ApiError("GitHub temporarily unavailable", {
      status: 503, payload: { error: { code: "GITHUB_UNAVAILABLE" } },
    });
    if (step === "session") pullwiseApi.auth.getSession.mockRejectedValue(failure);
    else pullwiseApi.repositories.sync.mockRejectedValue(failure);
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
    const failed = expect(completion).rejects.toMatchObject({ code: "GITHUB_UNAVAILABLE", status: 503, cause: failure });
    await vi.advanceTimersByTimeAsync(400);
    await failed;
    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(step === "sync" ? 1 : 0);
  });

  it.each([{}, { needsAuthorization: false }, { needsAuthorization: false, githubAccess: "authorized", items: [null] }])(
    "rejects malformed close verification instead of reporting a refresh: %j", async (payload) => {
      pullwiseApi.repositories.sync.mockResolvedValue(payload);
      const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
      const failed = expect(completion).rejects.toMatchObject({ code: "GITHUB_RESPONSE_INVALID" });
      await vi.advanceTimersByTimeAsync(400);
      await failed;
    }
  );

  it("requires reconnecting when grants could not be read instead of claiming no access was found", async () => {
    pullwiseApi.repositories.sync.mockResolvedValue({
      githubAccess: "reauthorization_required", needsAuthorization: true, items: [],
    });
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");
    const failed = expect(completion).rejects.toMatchObject({ code: "GITHUB_REAUTHORIZATION_REQUIRED" });
    await vi.advanceTimersByTimeAsync(400);
    await failed;
    expect(pullwiseApi.repositories.sync).toHaveBeenCalledTimes(1);
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
        nonce: null,
      },
      window.location.origin
    );
  });
});
