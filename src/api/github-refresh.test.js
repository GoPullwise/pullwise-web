import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "./http.js";
import {
  captureGitHubRefreshScope,
  setGitHubRefreshIdentity,
  withGitHubRefresh,
} from "./github-refresh.js";
import { createLedgerApi } from "./ledger.js";
import { pullwiseApi } from "./pullwise.js";

vi.mock("./http.js", () => ({ request: vi.fn() }));

const required = {
  githubRefreshRequired: true,
  githubAccess: "reauthorization_required",
  items: [],
  nextCursor: null,
};
const available = { githubAccess: "authorized", items: [], nextCursor: null };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  request.mockReset();
  setGitHubRefreshIdentity(null);
  setGitHubRefreshIdentity("usr_one");
});
afterEach(() => setGitHubRefreshIdentity(null));

describe("bounded GitHub credential renewal", () => {
  it("refreshes once and repeats only the original scoped GET with its lifecycle signal", async () => {
    request
      .mockResolvedValueOnce(required)
      .mockResolvedValueOnce({ ok: true, refreshed: true })
      .mockResolvedValueOnce(available);
    const controller = new AbortController();
    const api = createLedgerApi("ledger_one", undefined, captureGitHubRefreshScope());
    const params = { cursor: "next-page" };
    await expect(api.repositories(params, { signal: controller.signal })).resolves.toBe(available);
    expect(request).toHaveBeenCalledTimes(3);
    const [initial, refresh, repeated] = request.mock.calls;
    expect(initial).toEqual([
      "/api/v1/repositories",
      {
        params,
        signal: controller.signal,
        headers: { "X-Pullwise-Workspace": "ledger_one" },
      },
    ]);
    expect(repeated).toEqual(initial);
    expect(refresh).toEqual([
      "/integrations/github/refresh",
      {
        method: "POST",
        body: {},
        signal: expect.any(AbortSignal),
      },
    ]);
    expect(refresh[1].signal).not.toBe(controller.signal);
    expect(refresh[1].headers).toBeUndefined();
  });

  it.each([undefined, false, "true"])(
    "does not refresh without the explicit true signal (%s)",
    async (value) => {
      const payload = { ...required, githubRefreshRequired: value };
      const read = vi.fn().mockResolvedValue(payload);
      await expect(withGitHubRefresh(read)).resolves.toBe(payload);
      expect(read).toHaveBeenCalledTimes(1);
      expect(request).not.toHaveBeenCalled();
    }
  );

  it("requires a confirmed account ID rather than a provider failure or browser session guess", async () => {
    setGitHubRefreshIdentity(null);
    const read = vi.fn().mockResolvedValue(required);
    await expect(withGitHubRefresh(read)).resolves.toBe(required);
    expect(read).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 503])(
    "does not refresh an initial read error with status %s",
    async (status) => {
      const failure = Object.assign(new Error("Read unavailable"), { status });
      const read = vi.fn().mockRejectedValue(failure);
      await expect(withGitHubRefresh(read)).rejects.toBe(failure);
      expect(read).toHaveBeenCalledTimes(1);
      expect(request).not.toHaveBeenCalled();
    }
  );

  it("stops after the one repeated GET even when the provider still requests renewal", async () => {
    const read = vi.fn().mockResolvedValue(required);
    request.mockResolvedValue({ ok: true, refreshed: true });
    await expect(withGitHubRefresh(read)).resolves.toBe(required);
    expect(read).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rechecks access when another refresh already completed", async () => {
    const read = vi.fn().mockResolvedValueOnce(required).mockResolvedValueOnce(available);
    request.mockResolvedValue({ ok: true, refreshed: false });
    await expect(withGitHubRefresh(read)).resolves.toBe(available);
    expect(read).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("retains manual reauthorization when the refresh grant was revoked", async () => {
    const read = vi.fn().mockResolvedValue(required);
    request.mockRejectedValue({ status: 409, code: "GITHUB_REAUTHORIZATION_REQUIRED" });
    await expect(withGitHubRefresh(read)).resolves.toBe(required);
    expect(read).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("handles a busy refresh with only one repeated GET and no repeated POST", async () => {
    const read = vi.fn().mockResolvedValueOnce(required).mockResolvedValueOnce(available);
    request.mockRejectedValue({ status: 409, code: "GITHUB_REFRESH_PENDING" });
    await expect(withGitHubRefresh(read)).resolves.toBe(available);
    expect(read).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([403, 429, 503])(
    "preserves financial history and binding IDs on a refresh %s",
    async (status) => {
      const payload = {
        githubRefreshRequired: true,
        items: [
          {
            id: "prj_one",
            githubRepoIds: [123],
            githubOrganizationId: 456,
            githubAccess: "reauthorization_required",
            repositories: [{ githubRepoId: 123, githubAccess: "reauthorization_required" }],
            githubOrganization: { id: 456, githubAccess: "reauthorization_required" },
            totals: [{ currency: "USD", amountMinor: "100000000000000000001" }],
          },
        ],
      };
      const failure = Object.assign(new Error("GitHub unavailable"), {
        status,
        code:
          status === 403
            ? "GITHUB_PERMISSION_DENIED"
            : status === 429
              ? "GITHUB_RATE_LIMITED"
              : "GITHUB_UNAVAILABLE",
      });
      const read = vi.fn().mockResolvedValue(payload);
      request.mockRejectedValue(failure);
      const result = await withGitHubRefresh(read);
      expect(result.githubRefreshError).toBe(failure);
      expect(result.githubRefreshRequired).toBe(false);
      expect(result.items[0]).toMatchObject({
        id: "prj_one",
        githubRepoIds: [123],
        githubOrganizationId: 456,
        githubAccess: "unavailable",
        repositories: [{ githubRepoId: 123, githubAccess: "unavailable" }],
        githubOrganization: { id: 456, githubAccess: "unavailable" },
        totals: payload.items[0].totals,
      });
      expect(payload.items[0].githubAccess).toBe("reauthorization_required");
      expect(read).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
    }
  );

  it.each([401, 403])(
    "does not conceal a lost Pullwise session or role with status %s",
    async (status) => {
      const failure = Object.assign(new Error("Access lost"), { status, code: "ROLE_FORBIDDEN" });
      const read = vi.fn().mockResolvedValue(required);
      request.mockRejectedValue(failure);
      await expect(withGitHubRefresh(read)).rejects.toBe(failure);
      expect(read).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
    }
  );

  it("preserves the successful original history when the repeated GET has a provider outage", async () => {
    const failure = Object.assign(new Error("GitHub unavailable"), {
      status: 503,
      code: "GITHUB_UNAVAILABLE",
    });
    const read = vi.fn().mockResolvedValueOnce(required).mockRejectedValueOnce(failure);
    request.mockResolvedValue({ ok: true, refreshed: true });
    await expect(withGitHubRefresh(read)).resolves.toMatchObject({
      githubAccess: "unavailable",
      githubRefreshError: failure,
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    [404, "NOT_FOUND"],
    [422, "VALIDATION_ERROR"],
    [409, "ACCOUNT_CHANGED"],
    [403, "ROLE_FORBIDDEN"],
    [401, "UNAUTHENTICATED"],
  ])(
    "does not resurrect old history after the repeated GET fails with %s %s",
    async (status, code) => {
      const failure = Object.assign(new Error("Resource or authority changed"), { status, code });
      const read = vi.fn().mockResolvedValueOnce(required).mockRejectedValueOnce(failure);
      request.mockResolvedValue({ ok: true, refreshed: true });
      await expect(withGitHubRefresh(read)).rejects.toBe(failure);
      expect(read).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    new TypeError("Failed to fetch"),
    new DOMException("Request timed out", "TimeoutError"),
  ])(
    "preserves the original successful read on a renewal network or timeout failure (%s)",
    async (failure) => {
      const read = vi.fn().mockResolvedValue(required);
      request.mockRejectedValue(failure);
      await expect(withGitHubRefresh(read)).resolves.toMatchObject({
        githubAccess: "unavailable",
        githubRefreshError: failure,
      });
      expect(read).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
    }
  );

  it("shares one round across concurrent reads, including a late first response", async () => {
    const late = deferred();
    const readA = vi.fn().mockResolvedValueOnce(required).mockResolvedValueOnce(available);
    const readB = vi.fn().mockReturnValueOnce(late.promise).mockResolvedValueOnce(available);
    request.mockResolvedValue({ ok: true, refreshed: true });
    const first = withGitHubRefresh(readA);
    const second = withGitHubRefresh(readB);
    await expect(first).resolves.toBe(available);
    late.resolve(required);
    await expect(second).resolves.toBe(available);
    expect(request).toHaveBeenCalledTimes(1);
    expect(readA).toHaveBeenCalledTimes(2);
    expect(readB).toHaveBeenCalledTimes(2);
  });

  it("shares the completed failure with late concurrent reads without another POST", async () => {
    const late = deferred();
    const failure = Object.assign(new Error("GitHub unavailable"), {
      status: 503,
      code: "GITHUB_UNAVAILABLE",
    });
    request.mockRejectedValue(failure);
    const first = withGitHubRefresh(vi.fn().mockResolvedValue(required));
    const second = withGitHubRefresh(() => late.promise);
    await expect(first).resolves.toHaveProperty("githubRefreshError", failure);
    late.resolve(required);
    await expect(second).resolves.toHaveProperty("githubRefreshError", failure);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("lets one consumer abort without aborting another consumer's shared renewal", async () => {
    const renewal = deferred();
    request.mockReturnValue(renewal.promise);
    const controller = new AbortController();
    const readA = vi.fn().mockResolvedValueOnce(required).mockResolvedValueOnce(available);
    const readB = vi.fn().mockResolvedValueOnce(required).mockResolvedValueOnce(available);
    const first = withGitHubRefresh(readA, { signal: controller.signal });
    const aborted = expect(first).rejects.toMatchObject({ name: "AbortError" });
    const second = withGitHubRefresh(readB);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const sharedSignal = request.mock.calls[0][1].signal;
    controller.abort();
    await aborted;
    expect(sharedSignal.aborted).toBe(false);
    renewal.resolve({ ok: true, refreshed: true });
    await expect(second).resolves.toBe(available);
    expect(readA).toHaveBeenCalledTimes(1);
    expect(readB).toHaveBeenCalledTimes(2);
  });

  it("does not start reads or renewal for an already aborted consumer", async () => {
    const controller = new AbortController();
    controller.abort();
    const read = vi.fn();
    await expect(withGitHubRefresh(read, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(read).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("does not send a queued original read after its lifecycle was aborted", async () => {
    const controller = new AbortController();
    const read = vi.fn();
    const result = withGitHubRefresh(read, { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(read).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("does not renew after its original read was abandoned", async () => {
    const initial = deferred();
    const controller = new AbortController();
    const read = vi.fn().mockReturnValue(initial.promise);
    const result = withGitHubRefresh(read, { signal: controller.signal });
    const aborted = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    controller.abort();
    await aborted;
    initial.resolve(required);
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("does not renew the new account from an old account's late initial response", async () => {
    const initial = deferred();
    const read = vi.fn().mockReturnValue(initial.promise);
    const result = withGitHubRefresh(read);
    const abandoned = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    setGitHubRefreshIdentity("usr_two");
    await abandoned;
    initial.resolve(required);
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("rejects old-account renewal and does not reuse it for a new account", async () => {
    const renewal = deferred();
    request
      .mockReturnValueOnce(renewal.promise)
      .mockResolvedValueOnce({ ok: true, refreshed: true });
    const oldScope = captureGitHubRefreshScope();
    const readA = vi.fn().mockResolvedValue(required);
    const old = withGitHubRefresh(readA);
    const abandoned = expect(old).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    setGitHubRefreshIdentity("usr_two");
    await abandoned;
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    const readB = vi.fn().mockResolvedValueOnce(required).mockResolvedValueOnce(available);
    await expect(withGitHubRefresh(readB)).resolves.toBe(available);
    await expect(withGitHubRefresh(readA, { scope: oldScope })).rejects.toMatchObject({
      name: "AbortError",
    });
    renewal.resolve({ ok: true, refreshed: true });
    await Promise.resolve();
    expect(readA).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("ends the generation on sign-out even if the same account signs back in", async () => {
    const renewal = deferred();
    request.mockReturnValueOnce(renewal.promise).mockResolvedValueOnce({ ok: true });
    const oldScope = captureGitHubRefreshScope();
    const old = withGitHubRefresh(vi.fn().mockResolvedValue(required));
    const abandoned = expect(old).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await pullwiseApi.auth.signOut();
    await abandoned;
    expect(captureGitHubRefreshScope()).toBeNull();
    setGitHubRefreshIdentity("usr_one");
    expect(captureGitHubRefreshScope()).not.toBe(oldScope);
    renewal.resolve({ ok: true, refreshed: true });
  });

  it("keeps the existing ledger client able to read and renew after sign-out fails", async () => {
    const scope = captureGitHubRefreshScope();
    const api = createLedgerApi("ledger_one", undefined, scope);
    const failure = Object.assign(new Error("Sign-out unavailable"), { status: 503 });
    request.mockRejectedValueOnce(failure);
    await expect(pullwiseApi.auth.signOut()).rejects.toBe(failure);
    expect(captureGitHubRefreshScope()).toBe(scope);
    expect(scope.controller.signal.aborted).toBe(false);
    request
      .mockResolvedValueOnce(required)
      .mockResolvedValueOnce({ ok: true, refreshed: true })
      .mockResolvedValueOnce(available);
    await expect(api.projects({})).resolves.toBe(available);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      "/auth/sign-out",
      "/api/v1/projects",
      "/integrations/github/refresh",
      "/api/v1/projects",
    ]);
  });

  it("ends the sign-out generation only after service confirmation", async () => {
    const result = deferred();
    const scope = captureGitHubRefreshScope();
    request.mockReturnValue(result.promise);
    const signOut = pullwiseApi.auth.signOut();
    expect(captureGitHubRefreshScope()).toBe(scope);
    expect(scope.controller.signal.aborted).toBe(false);
    result.resolve({ ok: true });
    await signOut;
    expect(captureGitHubRefreshScope()).toBeNull();
    expect(scope.controller.signal.aborted).toBe(true);
  });

  it("does not clear a new account's renewal scope after an old sign-out completes", async () => {
    const result = deferred();
    request.mockReturnValue(result.promise);
    const signOut = pullwiseApi.auth.signOut();
    setGitHubRefreshIdentity("usr_two");
    const newScope = captureGitHubRefreshScope();
    result.resolve({ ok: true });
    await signOut;
    expect(captureGitHubRefreshScope()).toBe(newScope);
    expect(newScope.controller.signal.aborted).toBe(false);
  });
});

describe("GitHub read endpoints and write isolation", () => {
  it.each([
    ["ledger repositories", "/api/v1/repositories", () => createLedgerApi("team").repositories({})],
    ["ledger projects", "/api/v1/projects", () => createLedgerApi("team").projects({})],
    ["ledger project", "/api/v1/projects/prj_1", () => createLedgerApi("team").project("prj_1")],
    ["account repositories", "/repositories", () => pullwiseApi.repositories.list()],
    ["account integrations", "/integrations", () => pullwiseApi.integrations.list()],
    ["read-only repository sync", "/repositories/sync", () => pullwiseApi.repositories.sync()],
  ])("renews credentials for %s and rereads the same endpoint", async (_label, path, run) => {
    request
      .mockResolvedValueOnce(required)
      .mockResolvedValueOnce({ ok: true, refreshed: true })
      .mockResolvedValueOnce(available);
    await expect(run()).resolves.toBe(available);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      path,
      "/integrations/github/refresh",
      path,
    ]);
  });

  it("shares one renewal between ledger and account reads for the same actor", async () => {
    const renewal = deferred();
    let reads = 0;
    request.mockImplementation((url) => {
      if (url === "/integrations/github/refresh") return renewal.promise;
      reads += 1;
      return Promise.resolve(reads <= 2 ? required : available);
    });
    const first = createLedgerApi("shared_team").projects({});
    const second = pullwiseApi.integrations.list();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    renewal.resolve({ ok: true, refreshed: true });
    await expect(Promise.all([first, second])).resolves.toEqual([available, available]);
    expect(
      request.mock.calls.filter(([url]) => url === "/integrations/github/refresh")
    ).toHaveLength(1);
  });

  it("never retries business writes or starts renewal from their responses", async () => {
    request.mockResolvedValue(required);
    const api = createLedgerApi("team");
    await api.createExpense({ purpose: "Hosting" }, "once");
    await api.updateProject("prj_1", 2, { name: "New name" });
    await api.removeProject("prj_1", 2);
    await pullwiseApi.integrations.disconnect("github");
    await pullwiseApi.billing.createCheckoutSession({ plan: "pro" });
    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls.map(([, options]) => options.method)).toEqual([
      "POST",
      "PATCH",
      "DELETE",
      "DELETE",
      "POST",
    ]);
    expect(request.mock.calls.some(([url]) => url === "/integrations/github/refresh")).toBe(false);
  });
});
