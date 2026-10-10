import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, http } from "./http.js";
import { createLedgerApi, ledgerApi } from "./ledger.js";

afterEach(() => vi.restoreAllMocks());

describe("ledger REST paths", () => {
  it("reads account-wide pending recurring notifications with the caller's abort signal", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: { items: [] } });
    const controller = new AbortController();
    await ledgerApi.recurringExpenseNotifications({ signal: controller.signal });
    const call = send.mock.calls[0][0];
    expect(call.url).toBe("/api/v1/recurring-expense-notifications");
    expect(call.method).toBe("GET");
    expect(call.signal).toBe(controller.signal);
    expect(call.headers?.["X-Pullwise-Workspace"]).toBeUndefined();
    expect(call.data).toBeUndefined();
  });
  it("includes removed category metadata only when explicitly requested for scoped history", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: [] });
    const api = createLedgerApi("ledger_current");
    const controller = new AbortController();
    await api.categories({ signal: controller.signal });
    await api.categories({
      signal: controller.signal,
      params: { includeRemoved: true },
    });
    const calls = send.mock.calls.map(([call]) => call);
    expect(calls.map((call) => call.url)).toEqual([
      "/api/v1/categories",
      "/api/v1/categories",
    ]);
    expect(calls[0].params).toBeUndefined();
    expect(calls[1].params).toEqual({ includeRemoved: true });
    for (const call of calls) {
      expect(call.signal).toBe(controller.signal);
      expect(call.headers["X-Pullwise-Workspace"]).toBe("ledger_current");
      expect(call.method).toBe("GET");
      expect(call.data).toBeUndefined();
    }
  });
  it("reviews a saved expense with an empty body and captured workspace, revision and abort signal", async () => {
    const result = {
      expenseId: "exp_1",
      revision: 7,
      questionVersion: "ledger-suggest-v2",
      modelVersion: null,
      checks: {
        category: { status: "unavailable", current: "cat_1", reason: "disabled" },
        target: { status: "unavailable", current: { kind: "shared" }, reason: "disabled" },
        duplicate: { status: "issue", candidate: { id: "exp_2", revision: 3 } },
      },
    };
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: result });
    const controller = new AbortController();
    const options = {
      signal: controller.signal,
      headers: { "X-Pullwise-Workspace": "other", "If-Match": '"99"', "X-Trace": "review" },
      body: { purpose: "Client text must not be sent", categoryId: "cat_other" },
    };
    await expect(createLedgerApi("owner/1").reviewExpense("exp/1", 7, options)).resolves.toBe(
      result
    );
    expect(send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        method: "POST",
        url: "/api/v1/expenses/exp%2F1/review",
        signal: controller.signal,
        headers: { "X-Pullwise-Workspace": "owner/1", "If-Match": '"7"', "X-Trace": "review" },
        data: {},
      })
    );
    expect(send.mock.calls[0][0].headers).not.toHaveProperty("Idempotency-Key");
    expect(options.headers).toEqual({
      "X-Pullwise-Workspace": "other",
      "If-Match": '"99"',
      "X-Trace": "review",
    });
    expect(options.body).toEqual({
      purpose: "Client text must not be sent",
      categoryId: "cat_other",
    });
  });

  it.each([
    [412, "PRECONDITION_FAILED"],
    [429, "RATE_LIMITED"],
    [429, "JEV_BUDGET_LIMIT"],
    [403, "JEV_PLAN_REQUIRED"],
  ])("does not retry or write an expense after a review fails with %s %s", async (status, code) => {
    const error = new ApiError("Review unavailable", { status, payload: { error: { code } } });
    const send = vi.spyOn(http, "request").mockRejectedValue(error);
    const accessChanged = vi.fn();
    await expect(createLedgerApi("team", accessChanged).reviewExpense("exp_1", 2)).rejects.toBe(
      error
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      url: "/api/v1/expenses/exp_1/review",
      method: "POST",
      headers: { "X-Pullwise-Workspace": "team", "If-Match": '"2"' },
      data: {},
    });
    expect(accessChanged).not.toHaveBeenCalled();
  });

  it("uses the existing access-change callback for a revoked review permission", async () => {
    const error = new ApiError("Role changed", {
      status: 403,
      payload: { error: { code: "ROLE_FORBIDDEN" } },
    });
    const send = vi.spyOn(http, "request").mockRejectedValue(error);
    const accessChanged = vi.fn();
    await expect(createLedgerApi("team", accessChanged).reviewExpense("exp_1", 2)).rejects.toBe(
      error
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(accessChanged).toHaveBeenCalledExactlyOnceWith(error);
  });

  it("removes one project with its captured ledger and revision without replaying the request", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: undefined });
    const controller = new AbortController();
    const options = {
      signal: controller.signal,
      headers: { "X-Pullwise-Workspace": "other", "If-Match": '"99"', "X-Trace": "remove" },
    };
    const api = createLedgerApi("owner/1");
    await expect(api.removeProject("prj/2", 7, options)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        method: "DELETE",
        url: "/api/v1/projects/prj%2F2",
        signal: controller.signal,
        headers: { "X-Pullwise-Workspace": "owner/1", "If-Match": '"7"', "X-Trace": "remove" },
      })
    );
    expect(send.mock.calls[0][0].data).toBeUndefined();
    expect(options.headers).toEqual({
      "X-Pullwise-Workspace": "other",
      "If-Match": '"99"',
      "X-Trace": "remove",
    });
    const conflict = new ApiError("Project changed", {
      status: 412,
      payload: { error: { code: "PRECONDITION_FAILED" } },
    });
    send.mockRejectedValueOnce(conflict);
    await expect(api.removeProject("prj/2", 7, options)).rejects.toBe(conflict);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("reads bounded activity for the captured workspace and carries the abort signal", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const controller = new AbortController();
    const params = { target: "project", projectId: "prj/1", limit: 50, cursor: "opaque-next" };
    await createLedgerApi("team/2").activity(params, { signal: controller.signal });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/api/v1/activity",
        params,
        signal: controller.signal,
        headers: { "X-Pullwise-Workspace": "team/2" },
      })
    );
  });
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

  it("removes a category without changing the existing archive resource", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: null });
    const api = createLedgerApi("team/1");
    const controller = new AbortController();
    const options = { signal: controller.signal, headers: { "X-Trace": "category" } };
    await api.removeCategory("cat/2", 7, options);
    await api.archiveCategory("cat/2", 8, options);
    expect(
      send.mock.calls.map(([call]) => [call.method, call.url, call.headers["If-Match"]])
    ).toEqual([
      ["POST", "/api/v1/categories/cat%2F2/remove", '"7"'],
      ["DELETE", "/api/v1/categories/cat%2F2", '"8"'],
    ]);
    for (const [call] of send.mock.calls) {
      expect(call.signal).toBe(controller.signal);
      expect(call.headers["X-Pullwise-Workspace"]).toBe("team/1");
      expect(call.headers["X-Trace"]).toBe("category");
    }
    expect(send.mock.calls[0][0].data).toEqual({});
    expect(options.headers).toEqual({ "X-Trace": "category" });
  });

  it("keeps recurring rule paths, scope, abort and concurrency headers on the real API", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const api = createLedgerApi("team");
    const controller = new AbortController();
    await api.recurringRules(
      { target: "project", projectId: "prj_1" },
      { signal: controller.signal }
    );
    await api.createRecurringRule(
      { target: { kind: "shared" }, schedule: { frequency: "monthly" } },
      "rule-1"
    );
    await api.updateRecurringRule("rul/1", 4, { status: "paused" });
    await api.removeRecurringRule("rul/1", 5);
    expect(send.mock.calls[0][0]).toMatchObject({
      url: "/api/v1/expense-recurring-rules",
      params: { target: "project", projectId: "prj_1" },
      signal: controller.signal,
    });
    expect(send.mock.calls[1][0]).toMatchObject({
      method: "POST",
      headers: { "Idempotency-Key": "rule-1" },
      data: { target: { kind: "shared" }, schedule: { frequency: "monthly" } },
    });
    expect(send.mock.calls[2][0]).toMatchObject({
      url: "/api/v1/expense-recurring-rules/rul%2F1",
      method: "PATCH",
      headers: { "If-Match": '"4"' },
      data: { status: "paused" },
    });
    expect(send.mock.calls[3][0]).toMatchObject({
      method: "DELETE",
      headers: { "If-Match": '"5"' },
    });
    expect(send.mock.calls.map(([call]) => call.headers["X-Pullwise-Workspace"])).toEqual([
      "team",
      "team",
      "team",
      "team",
    ]);
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
    await api.inviteMember("team/1", { role: "editor" }, options);
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
    expect(send.mock.calls[4][0].data).toEqual({ role: "editor" });
    expect(options.headers).toEqual({ "X-Trace": "membership" });
  });

  it("lists invitation requests and reviews one with its own current revision", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const api = createLedgerApi("team/1");
    const controller = new AbortController();
    const options = { signal: controller.signal, headers: { "X-Trace": "review" } };
    await api.invitationRequests(options);
    await api.workspaceInvitationRequests("team/1", options);
    await api.inviteRequests("team/1", "invite/2", options);
    await api.approveInviteRequest("team/1", "invite/2", "request/3", 4, options);
    await api.rejectInviteRequest("team/1", "invite/2", "request/5", 6, options);
    expect(
      send.mock.calls.map(([call]) => [call.method, call.url, call.headers["If-Match"]])
    ).toEqual([
      ["GET", "/api/v1/workspace-invitation-requests", undefined],
      ["GET", "/api/v1/workspaces/team%2F1/join-requests", undefined],
      ["GET", "/api/v1/workspaces/team%2F1/invites/invite%2F2/requests", undefined],
      [
        "POST",
        "/api/v1/workspaces/team%2F1/invites/invite%2F2/requests/request%2F3/approve",
        '"4"',
      ],
      ["POST", "/api/v1/workspaces/team%2F1/invites/invite%2F2/requests/request%2F5/reject", '"6"'],
    ]);
    for (const [call] of send.mock.calls) {
      expect(call.signal).toBe(controller.signal);
      expect(call.headers["X-Trace"]).toBe("review");
      expect(call.headers["X-Pullwise-Workspace"]).toBe("team/1");
    }
    expect(send.mock.calls[3][0].data).toEqual({});
    expect(send.mock.calls[4][0].data).toEqual({});
    expect(options.headers).toEqual({ "X-Trace": "review" });
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
