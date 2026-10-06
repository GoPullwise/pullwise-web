import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, http } from "./http.js";
import { createLedgerApi, ledgerApi } from "./ledger.js";

afterEach(() => vi.restoreAllMocks());

describe("ledger REST paths", () => {
  it("uses one versioned Server path and the same-origin proxy base", async () => {
    const oldBase = http.defaults.baseURL;
    http.defaults.baseURL = "/api";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        headers: { "content-type": "application/json" },
      })
    );
    try {
      await ledgerApi.expenses({ target: "shared", from: "2026-09-01" });
      expect(fetchMock.mock.calls[0][0]).toBe("/api/api/v1/expenses?target=shared&from=2026-09-01");
      expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    } finally {
      http.defaults.baseURL = oldBase;
    }
  });

  it("carries revision and idempotency headers on writes", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    await ledgerApi.createExpense({ purpose: "agent" }, "create-1");
    await ledgerApi.updateExpense("exp/1", 3, { purpose: "agent" });
    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: "/api/v1/expenses",
        method: "POST",
        headers: { "Idempotency-Key": "create-1" },
      })
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: "/api/v1/expenses/exp%2F1",
        method: "PATCH",
        headers: { "If-Match": '"3"' },
      })
    );
  });

  it("captures independent workspace headers through writes and exports", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const alice = createLedgerApi("alice");
    const bob = createLedgerApi("bob");
    await alice.createExpense({ purpose: "team" }, "key");
    await bob.updateExpense("exp_1", 2, {});
    await alice.exportExpenses({ target: "shared" });
    expect(send.mock.calls.map(([call]) => call.headers["X-Pullwise-Workspace"])).toEqual([
      "alice",
      "bob",
      "alice",
    ]);
    expect(send.mock.calls[0][0].headers["Idempotency-Key"]).toBe("key");
    expect(send.mock.calls[1][0].headers["If-Match"]).toBe('"2"');
    expect(send.mock.calls[2][0].responseType).toBe("blob");
  });

  it("keeps pending reads bound to their captured ledger and preserves abort signals", async () => {
    let finishFirst;
    const first = new Promise((resolve) => {
      finishFirst = resolve;
    });
    const send = vi
      .spyOn(http, "request")
      .mockReturnValueOnce(first)
      .mockResolvedValue({ data: { items: [{ name: "Team project" }] } });
    const personal = createLedgerApi("alice");
    const controller = new AbortController();
    const options = {
      signal: controller.signal,
      headers: { "X-Pullwise-Workspace": "caller-other", "X-Trace": "read" },
    };
    const oldRead = personal.projects({}, options);
    const team = createLedgerApi("team");
    await team.projects();
    await personal.reportSummary();
    expect(send.mock.calls.map(([call]) => call.headers["X-Pullwise-Workspace"])).toEqual([
      "alice",
      "team",
      "alice",
    ]);
    expect(send.mock.calls[0][0].signal).toBe(controller.signal);
    expect(send.mock.calls[0][0].headers["X-Trace"]).toBe("read");
    expect(options.headers["X-Pullwise-Workspace"]).toBe("caller-other");
    finishFirst({ data: { items: [{ name: "Alice project" }] } });
    await expect(oldRead).resolves.toEqual({ items: [{ name: "Alice project" }] });
  });

  it("sends member and invitation revisions to the scoped REST resources without changing caller options", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const api = createLedgerApi("team/1");
    const controller = new AbortController();
    const options = { signal: controller.signal, headers: { "X-Trace": "membership" } };
    await api.members("team/1", options);
    await api.invites("team/1", options);
    await api.updateMember("team/1", "user/2", 3, { role: "viewer" }, options);
    await api.removeMember("team/1", "user/2", 4, options);
    await api.inviteMember("team/1", { githubLogin: "bob", role: "editor" }, options);
    await api.revokeInvite("team/1", "invite/5", 6, options);
    expect(
      send.mock.calls.map(([call]) => [call.method, call.url, call.headers["If-Match"]])
    ).toEqual([
      ["GET", "/api/v1/workspaces/team%2F1/members", undefined],
      ["GET", "/api/v1/workspaces/team%2F1/invites", undefined],
      ["PATCH", "/api/v1/workspaces/team%2F1/members/user%2F2", '"3"'],
      ["DELETE", "/api/v1/workspaces/team%2F1/members/user%2F2", '"4"'],
      ["POST", "/api/v1/workspaces/team%2F1/invites", undefined],
      ["DELETE", "/api/v1/workspaces/team%2F1/invites/invite%2F5", '"6"'],
    ]);
    for (const [call] of send.mock.calls) {
      expect(call.signal).toBe(controller.signal);
      expect(call.headers["X-Pullwise-Workspace"]).toBe("team/1");
    }
    expect(send.mock.calls[2][0].data).toEqual({ role: "viewer" });
    expect(send.mock.calls[4][0].data).toEqual({ githubLogin: "bob", role: "editor" });
    expect(options.headers).toEqual({ "X-Trace": "membership" });
  });

  it("posts invitation tokens in request bodies and carries the caller's abort signal", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const api = createLedgerApi("personal");
    const controller = new AbortController();
    const fields = { token: "synthetic-token" };
    await api.previewInvitation(fields, { signal: controller.signal });
    await api.acceptInvitation(fields, { signal: controller.signal });
    expect(send.mock.calls.map(([call]) => call.url)).toEqual([
      "/api/v1/workspace-invitations/preview",
      "/api/v1/workspace-invitations/accept",
    ]);
    for (const [call] of send.mock.calls) {
      expect(call.method).toBe("POST");
      expect(call.data).toEqual(fields);
      expect(call.signal).toBe(controller.signal);
      expect(call.params).toBeUndefined();
    }
  });

  it("surfaces revoked membership once and retains the caller error", async () => {
    const notify = vi.fn();
    const send = vi.spyOn(http, "request").mockRejectedValue(new Error("transport"));
    await expect(createLedgerApi("alice", notify).expenses()).rejects.toThrow("transport");
    expect(notify).not.toHaveBeenCalled();
    const denied = Object.assign(new Error("revoked"), {
      code: "WORKSPACE_MEMBERSHIP_CHANGED",
      status: 403,
    });
    send.mockRejectedValue(denied);
    await expect(createLedgerApi("alice", notify).expenses()).rejects.toBe(denied);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(denied);
  });

  it.each([
    ["previewInvitation", 404, "WORKSPACE_NOT_FOUND"],
    ["acceptInvitation", 404, "WORKSPACE_NOT_FOUND"],
    ["previewInvitation", 403, "WORKSPACE_FORBIDDEN"],
    ["acceptInvitation", 403, "AUTHORIZATION_CHANGED"],
  ])(
    "keeps %s %s %s local to the invitation instead of invalidating the selected ledger",
    async (method, status, code) => {
      const denied = new ApiError("Invitation unavailable", {
        status,
        payload: { error: { code } },
      });
      vi.spyOn(http, "request").mockRejectedValue(denied);
      const notify = vi.fn();
      await expect(
        createLedgerApi("personal", notify)[method]({ token: "synthetic-token" })
      ).rejects.toBe(denied);
      expect(notify).not.toHaveBeenCalled();
    }
  );

  it.each([
    [404, "PROJECT_NOT_FOUND"],
    [403, "INVITATION_RECIPIENT_MISMATCH"],
    [404, "INVITATION_NOT_FOUND"],
  ])("retains resource %s %s without reloading membership", async (status, code) => {
    const denied = new ApiError("Resource unavailable", { status, payload: { error: { code } } });
    vi.spyOn(http, "request").mockRejectedValue(denied);
    const notify = vi.fn();
    await expect(createLedgerApi("team", notify).project("old-project")).rejects.toBe(denied);
    expect(notify).not.toHaveBeenCalled();
  });
});
