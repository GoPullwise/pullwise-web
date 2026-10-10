import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App.jsx";
import { pullwiseApi } from "./api/pullwise.js";
import { createLedgerApi, ledgerApi } from "./api/ledger.js";
import { NotificationProvider } from "./components/notifications.jsx";
import { screenFromPath } from "./lib/navigation.js";

vi.mock("./api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getSession: vi.fn(),
      getGitHubAuthorizeUrl: vi.fn(),
      requestEmailCode: vi.fn(),
      verifyEmailCode: vi.fn(),
    },
    account: {
      getJev: vi.fn(),
      updateJev: vi.fn(),
      getExpenseRetention: vi.fn(),
      updateExpenseRetention: vi.fn(),
    },
    integrations: { list: vi.fn(), getGitHubAuthorizeUrl: vi.fn() },
  },
}));
const harness = vi.hoisted(() => ({ enabled: false, apis: {}, captures: [] }));
vi.mock("./screens/ledger.jsx", async () => {
  const { useEffect, useState } = await import("react");
  const { Topbar } = await import("./shell.jsx");
  function ScopedLedger({ api, workspace, mode, projectId, go }) {
    const [record, setRecord] = useState("");
    const [failure, setFailure] = useState("");
    const [draft, setDraft] = useState("");
    useEffect(() => {
      const controller = new AbortController();
      const result =
        mode === "project"
          ? api.project(projectId, { signal: controller.signal })
          : api.projects({}, { signal: controller.signal });
      result
        .then((value) => {
          if (!controller.signal.aborted) setRecord(value?.name || value?.items?.[0]?.name || "");
        })
        .catch((error) => {
          if (!controller.signal.aborted) setFailure(error?.code || "Unavailable");
        });
      return () => controller.abort();
    }, [api, mode, projectId]);
    return (
      <>
        <Topbar go={go} breadcrumbs={[{ label: "Projects" }]} />
        <h1>Projects</h1>
        <p>Scope: {workspace.id}</p>
        {mode !== "projects" && (
          <section id="recurring-plans">
            <article data-recurring-rule-id="rule-one">Recurring target: {mode}</article>
          </section>
        )}
        <p>{record}</p>
        {failure && <p role="alert">{failure}</p>}
        <label htmlFor="protected-draft">Unsaved scope draft</label>
        <input
          id="protected-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </>
    );
  }
  return {
    LedgerScreen: (props) => (harness.enabled ? <ScopedLedger {...props} /> : <h1>Projects</h1>),
  };
});
vi.mock("./api/ledger.js", () => ({
  ledgerApi: {
    workspaces: vi.fn(),
    invitationRequests: vi.fn(),
    recurringExpenseNotifications: vi.fn(),
  },
  createLedgerApi: vi.fn(() => ({})),
}));

beforeEach(() => {
  vi.resetAllMocks();
  harness.enabled = false;
  harness.apis = {};
  harness.captures = [];
  createLedgerApi.mockImplementation((id, notify) => {
    harness.captures.push({ id, notify });
    return harness.apis[id] || {};
  });
  window.history.replaceState({}, "", "/");
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: false });
  pullwiseApi.account.getExpenseRetention.mockResolvedValue({
    autoRemoveOldestExpense: false,
    revision: 1,
  });
  pullwiseApi.account.getJev.mockResolvedValue({
    enabled: true,
    revision: 7,
    eligible: true,
    available: true,
    monthlyBudgetUsd: "3",
  });
  pullwiseApi.auth.requestEmailCode.mockResolvedValue({
    challengeId: "email_challenge",
    expiresIn: 600,
    retryAfter: 0,
  });
  pullwiseApi.auth.verifyEmailCode.mockResolvedValue({
    authenticated: true,
    user: { id: "alice", email: "alice@example.com", emailVerified: true, providers: ["email"] },
  });
  pullwiseApi.integrations.list.mockResolvedValue({
    github: { connected: false, repositories: [], installations: [] },
  });
  ledgerApi.workspaces.mockResolvedValue({
    items: [{ id: "local-focus", name: "Personal ledger", role: "owner", revision: 1 }],
  });
  ledgerApi.invitationRequests.mockResolvedValue({ items: [] });
  ledgerApi.recurringExpenseNotifications.mockResolvedValue({ items: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function pending() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function enterEmailCode(email = "alice@example.com") {
  fireEvent.change(await screen.findByRole("textbox", { name: "Email" }, { timeout: 4000 }), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  const code = await screen.findByRole("textbox", { name: "6-digit code" });
  fireEvent.change(code, { target: { value: "012345" } });
  return code;
}

async function openMembersManagement() {
  const toggle = await screen.findByRole("button", { name: "Invite member", exact: true });
  await waitFor(() => expect(toggle).toBeEnabled());
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
  const create = await screen.findByRole("button", { name: "Create invitation", exact: true });
  await waitFor(() => expect(create).toBeEnabled());
  return create;
}

it("accepts an email session directly, aborts a stale session read and opens Projects without a focus event", async () => {
  window.history.replaceState({}, "", "/login");
  const staleSession = pending();
  render(<App />);
  await enterEmailCode();
  const readsBeforeVerify = pullwiseApi.auth.getSession.mock.calls.length;
  pullwiseApi.auth.getSession.mockReturnValueOnce(staleSession.promise);
  act(() => window.dispatchEvent(new Event("focus")));
  const staleSignal = pullwiseApi.auth.getSession.mock.calls.at(-1)[0].signal;
  fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
  expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/projects");
  expect(staleSignal.aborted).toBe(true);
  expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(readsBeforeVerify + 1);
  expect(pullwiseApi.auth.verifyEmailCode).toHaveBeenCalledWith(
    { email: "alice@example.com", challengeId: "email_challenge", code: "012345" },
    { signal: expect.any(AbortSignal) }
  );
  await act(async () => staleSession.resolve({ authenticated: false }));
  expect(screen.queryByRole("button", { name: "Verify and sign in" })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe("/projects");
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
});

it("preserves an email-only guest invitation and submits a pending request without granting membership", async () => {
  window.history.replaceState({}, "", `/members#invite=${inviteToken}`);
  const emailRequest = {
    ...joinRequest,
    applicant: { userId: "alice", name: "alice@example.com" },
  };
  const submitted = pending();
  harness.apis.alice = membersApi({
    previewInvitation: vi
      .fn()
      .mockResolvedValueOnce({ ...invite, workspace: team })
      .mockResolvedValue({ ...invite, workspace: team, request: emailRequest }),
    acceptInvitation: vi.fn().mockReturnValue(submitted.promise),
  });
  ledgerApi.workspaces.mockResolvedValue({ items: [personal] });
  render(<App />);
  await enterEmailCode();
  expect(window.location.pathname).toBe("/login");
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
  const request = await screen.findByRole("button", { name: "Request to join" });
  expect(request).toBeVisible();
  expect(window.location.pathname).toBe("/members");
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  expect(harness.apis.alice.acceptInvitation).not.toHaveBeenCalled();
  expect(screen.queryByText(/GitHub account:/)).not.toBeInTheDocument();
  fireEvent.click(request);
  fireEvent.click(request);
  expect(harness.apis.alice.acceptInvitation).toHaveBeenCalledExactlyOnceWith(
    { token: inviteToken },
    {}
  );
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeDisabled();
  await act(async () => submitted.resolve({ ...invite, workspace: team, request: emailRequest }));
  expect(
    await screen.findByText("Your request was sent. Waiting for the inviter's approval.")
  ).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("alice");
  expect(screen.queryByRole("option", { name: /Team ledger/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Open shared ledger" })).not.toBeInTheDocument();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Check status" }));
  await waitFor(() => expect(harness.apis.alice.previewInvitation).toHaveBeenCalledTimes(2));
  expect(harness.apis.alice.acceptInvitation).toHaveBeenCalledTimes(1);
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
});

it.each(["send", "verify"])(
  "blocks same-event notification review while the Settings email %s operation starts",
  async (stage) => {
    window.history.replaceState({}, "", "/settings");
    const managedTeam = {
      ...team,
      role: "admin",
      permissions: { manageMembers: true, manageAdmins: false },
    };
    const session = {
      authenticated: true,
      user: { id: "alice", name: "Alice", providers: ["github"] },
    };
    pullwiseApi.auth.getSession.mockResolvedValue(session);
    ledgerApi.workspaces.mockResolvedValue({ items: [personal, managedTeam] });
    ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
    harness.apis.team = membersApi({
      workspaceInvitationRequests: vi.fn().mockResolvedValue({ items: [joinRequest] }),
    });
    const operation = pending();
    render(<App />);
    const email = await screen.findByRole("textbox", { name: "Email" });
    const review = await screen.findByRole("button", { name: "Review request" });
    let form;
    if (stage === "send") {
      pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(operation.promise);
      fireEvent.change(email, { target: { value: "alice@example.com" } });
      form = email.closest("form");
    } else {
      const code = await enterEmailCode();
      pullwiseApi.auth.verifyEmailCode.mockReturnValueOnce(operation.promise);
      form = code.closest("form");
    }
    act(() => {
      fireEvent.submit(form);
      // The DOM has not reflected React's batched busy update yet.
      expect(screen.getByRole("link", { name: "Go to Pullwise home" })).not.toHaveAttribute(
        "aria-disabled"
      );
      fireEvent.click(review);
    });
    expect(window.location.pathname).toBe("/settings");
    expect(harness.apis.team.members).not.toHaveBeenCalled();
    expect(review).toBeDisabled();
    expect(screen.getByRole("link", { name: "Projects", exact: true })).not.toHaveAttribute("href");
    expect(screen.getByRole("button", { name: "Connect repositories" })).toBeDisabled();
    await act(async () => operation.reject(new Error("Local email boundary")));
    expect(review).toBeEnabled();
    expect(screen.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute(
      "href",
      "/projects"
    );
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    const inbox = await screen.findByRole("dialog", { name: "Inbox" });
    fireEvent.click(within(inbox).getByRole("button", { name: "Review request" }));
    expect(await screen.findByRole("button", { name: "Approve request from bob" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
    expect(window.location.pathname).toBe("/members");
  }
);

it("blocks same-event Login navigation while an email request starts and releases it on failure", async () => {
  window.history.replaceState({}, "", "/login");
  const operation = pending();
  pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(operation.promise);
  render(<App />);
  const email = await screen.findByRole("textbox", { name: "Email" }, { timeout: 4000 });
  fireEvent.change(email, { target: { value: "alice@example.com" } });
  const terms = screen.getByRole("link", { name: "Terms of Service" });
  act(() => {
    fireEvent.submit(email.closest("form"));
    expect(terms).toHaveAttribute("href", "/terms");
    fireEvent.click(terms);
  });
  expect(window.location.pathname).toBe("/login");
  expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeDisabled();
  await act(async () => operation.reject(new Error("Local mail boundary")));
  fireEvent.click(terms);
  expect(window.location.pathname).toBe("/terms");
});

it("releases an abandoned Login operation before reusing the public screen key", async () => {
  window.history.replaceState({}, "", "/login");
  const operation = pending();
  pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(operation.promise);
  render(<App />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Email" }, { timeout: 4000 }), {
    target: { value: "alice@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  const abandonedSignal = pullwiseApi.auth.requestEmailCode.mock.calls.at(-1)[1].signal;
  act(() => {
    window.history.replaceState({}, "", "/terms");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("heading", { name: "Terms of Service" });
  expect(abandonedSignal.aborted).toBe(true);
  act(() => {
    window.history.replaceState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("textbox", { name: "Email" });
  await act(async () =>
    operation.resolve({ challengeId: "abandoned", expiresIn: 600, retryAfter: 60 })
  );
  expect(screen.queryByRole("textbox", { name: "6-digit code" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Terms of Service" }));
  expect(window.location.pathname).toBe("/terms");
});

it("retains a legacy GitHub-targeted invitation as an explicit pending request", async () => {
  window.history.replaceState({}, "", `/login#invite=${inviteToken}`);
  authenticatedLedgers([personal]);
  pullwiseApi.auth.getSession.mockResolvedValue({
    authenticated: true,
    user: { id: "alice", githubId: "101", githubLogin: "alice", providers: ["github"] },
  });
  const legacyInvite = {
    ...invite,
    recipient: { githubId: "101", login: "alice" },
    workspace: team,
  };
  harness.apis.alice = membersApi({
    previewInvitation: vi.fn().mockResolvedValue(legacyInvite),
    acceptInvitation: vi.fn().mockResolvedValue({
      ...legacyInvite,
      request: {
        ...joinRequest,
        applicant: { userId: "alice", githubId: "101", githubLogin: "alice" },
      },
    }),
  });
  render(<App />);
  const request = await screen.findByRole("button", { name: "Request to join" });
  expect(screen.getByText(/GitHub account:/)).toHaveTextContent("alice");
  expect(harness.apis.alice.acceptInvitation).not.toHaveBeenCalled();
  fireEvent.click(request);
  expect(
    await screen.findByText("Your request was sent. Waiting for the inviter's approval.")
  ).toBeVisible();
  expect(screen.queryByRole("option", { name: /Team ledger/ })).not.toBeInTheDocument();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
});

it("keeps a new Settings operation locked after an old screen's GitHub action finishes", async () => {
  window.history.replaceState({}, "", "/settings");
  pullwiseApi.auth.getSession.mockResolvedValue({
    authenticated: true,
    user: { id: "alice", name: "Alice", providers: ["github"] },
  });
  ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
  const oldAction = pending();
  const newAction = pending();
  pullwiseApi.integrations.getGitHubAuthorizeUrl.mockReturnValueOnce(oldAction.promise);
  render(<App />);
  await screen.findByRole("textbox", { name: "Email" });
  const review = await screen.findByRole("button", { name: "Review request" });
  fireEvent.click(screen.getByRole("button", { name: "Connect repositories" }));
  act(() => {
    window.history.pushState({}, "", "/projects");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("heading", { name: "Projects" });
  act(() => {
    window.history.pushState({}, "", "/settings");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const email = await screen.findByRole("textbox", { name: "Email" });
  fireEvent.change(email, { target: { value: "alice@example.com" } });
  pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(newAction.promise);
  await act(async () => {
    fireEvent.submit(email.closest("form"));
    oldAction.reject(new Error("Old GitHub action failed"));
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.click(review);
  });
  expect(window.location.pathname).toBe("/settings");
  expect(screen.getByRole("button", { name: "Connect repositories" })).toBeDisabled();
  expect(screen.queryByText("Old GitHub action failed")).not.toBeInTheDocument();
  await act(async () => newAction.reject(new Error("New email action failed")));
  expect(screen.getByRole("button", { name: "Connect repositories" })).toBeEnabled();
});

it("allows navigation during a Settings read and ignores its late signed-out response", async () => {
  window.history.replaceState({}, "", "/settings");
  pullwiseApi.auth.getSession.mockResolvedValue({
    authenticated: true,
    user: { id: "alice", name: "Alice", providers: ["github"] },
  });
  render(<App />);
  await screen.findByRole("textbox", { name: "Email" });
  const read = pending();
  pullwiseApi.auth.getSession.mockReturnValueOnce(read.promise);
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  const signal = pullwiseApi.auth.getSession.mock.calls.at(-1)[0].signal;
  fireEvent.click(screen.getByRole("link", { name: "Projects", exact: true }));
  expect(await screen.findByRole("heading", { name: "Projects" })).toBeVisible();
  expect(signal.aborted).toBe(true);
  await act(async () => read.resolve({ authenticated: false }));
  expect(window.location.pathname).toBe("/projects");
  expect(screen.queryByRole("button", { name: "Continue with GitHub" })).not.toBeInTheDocument();
});

it("keeps the current ledger and user identity after first email binding from Settings", async () => {
  window.history.replaceState({}, "", "/projects");
  const githubSession = {
    authenticated: true,
    user: { id: "alice", name: "Alice", email: "profile@example.com", providers: ["github"] },
  };
  pullwiseApi.auth.getSession.mockResolvedValue(githubSession);
  ledgerApi.workspaces.mockResolvedValue({ items: [personal, team] });
  pullwiseApi.auth.verifyEmailCode.mockResolvedValue({
    ...githubSession,
    user: {
      ...githubSession.user,
      email: "alice@example.com",
      emailVerified: true,
      providers: ["github", "email"],
    },
  });
  harness.enabled = true;
  harness.apis.alice = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Alice project" }] }),
  };
  harness.apis.team = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Team project" }] }),
  };
  render(<App />);
  await screen.findByText("Alice project");
  fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
    target: { value: "team" },
  });
  await screen.findByText("Team project");
  // The fixture renders only the topbar; navigate by the real route event.
  act(() => {
    window.history.pushState({}, "", "/settings");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await enterEmailCode();
  fireEvent.click(screen.getByRole("button", { name: "Verify and link email" }));
  expect(await screen.findByText("Verified email")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/settings");
  const refreshedLedgers = pending();
  ledgerApi.workspaces.mockReturnValueOnce(refreshedLedgers.promise);
  const workspaceReads = ledgerApi.workspaces.mock.calls.length;
  const aliceProjectReads = harness.apis.alice.projects.mock.calls.length;
  fireEvent.click(screen.getByRole("link", { name: "Projects", exact: true }));
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(workspaceReads + 1));
  await act(async () => refreshedLedgers.resolve({ items: [personal, team] }));
  expect(await screen.findByText("Team project")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
  expect(harness.apis.alice.projects).toHaveBeenCalledTimes(aliceProjectReads);
  expect(pullwiseApi.auth.requestEmailCode).toHaveBeenCalledWith(
    { email: "alice@example.com", purpose: "link" },
    { signal: expect.any(AbortSignal) }
  );
});

const personal = {
  id: "alice",
  name: "Alice ledger",
  role: "owner",
  revision: 1,
  permissions: { manageMembers: true, manageAdmins: true },
};
const team = {
  id: "team",
  name: "Team ledger",
  role: "viewer",
  revision: 2,
  permissions: { manageMembers: false, manageAdmins: false },
};
const invite = {
  id: "inv_1",
  recipient: null,
  role: "viewer",
  expiresAt: "2026-10-16T12:00:00Z",
  revision: 1,
  status: "pending",
};
const joinRequest = {
  id: "req_1",
  invitationId: invite.id,
  workspaceId: team.id,
  workspace: { id: team.id, name: team.name },
  invitation: invite,
  applicant: { userId: "bob", githubId: "202", githubLogin: "bob", name: "Bob" },
  role: invite.role,
  status: "pending",
  revision: 1,
  createdAt: "2026-10-09T10:00:00Z",
};
const inviteToken = `pwi_${"x".repeat(43)}`;

function authenticatedLedgers(items = [personal, team], actor = "alice") {
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true, user: { id: actor } });
  ledgerApi.workspaces.mockResolvedValue({ items });
}

function membersApi(overrides = {}) {
  return {
    members: vi.fn().mockResolvedValue({
      items: [{ userId: "alice", name: "Alice", githubLogin: "alice", role: "owner", revision: 1 }],
    }),
    invites: vi.fn().mockResolvedValue({ items: [] }),
    workspaceInvitationRequests: vi.fn().mockResolvedValue({ items: [] }),
    inviteMember: vi.fn().mockResolvedValue({ ...invite, token: inviteToken }),
    previewInvitation: vi.fn().mockResolvedValue({ ...invite, workspace: team }),
    acceptInvitation: vi
      .fn()
      .mockResolvedValue({ ...invite, workspace: team, request: joinRequest }),
    approveInviteRequest: vi.fn().mockResolvedValue({
      request: { ...joinRequest, status: "approved", revision: 2 },
      workspace: team,
    }),
    rejectInviteRequest: vi.fn().mockResolvedValue({
      request: { ...joinRequest, status: "rejected", revision: 2 },
    }),
    ...overrides,
  };
}

const adminTeam = () => ({
  ...team,
  role: "admin",
  revision: 3,
  permissions: {
    manageMembers: true,
    manageAdmins: false,
    manageCategories: true,
    manageProjects: true,
    writeExpenses: true,
  },
});

it("refreshes the selected member's effective access before Members Reload after a Viewer promotion", async () => {
  window.history.replaceState({}, "", "/members");
  const viewer = { ...team, revision: 1 };
  const admin = { ...adminTeam(), revision: 2 };
  authenticatedLedgers([viewer], "bob");
  harness.apis.team = membersApi({
    members: vi.fn().mockResolvedValue({
      items: [{ userId: "bob", githubLogin: "bob", role: "viewer", revision: 1 }],
    }),
  });
  render(<App />);
  expect(await screen.findByText("Viewer", { selector: ".member-role" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument();
  ledgerApi.workspaces.mockResolvedValue({ items: [admin] });
  harness.apis.team.members.mockResolvedValue({
    items: [{ userId: "bob", githubLogin: "bob", role: "admin", revision: 2 }],
  });
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(await screen.findByRole("button", { name: "Invite member" })).toBeEnabled();
  expect(screen.getByText("Admin", { selector: ".member-role" })).toBeVisible();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
  expect(harness.apis.team.members).toHaveBeenCalledTimes(2);
});

it("drops Admin controls even when a changed permission response reuses the workspace revision", async () => {
  window.history.replaceState({}, "", "/members");
  const admin = adminTeam();
  authenticatedLedgers([admin], "bob");
  harness.apis.team = membersApi();
  render(<App />);
  expect(await screen.findByRole("button", { name: "Invite member" })).toBeEnabled();
  const oldNotify = harness.captures.findLast((entry) => entry.id === "team").notify;
  ledgerApi.workspaces.mockResolvedValue({ items: [{ ...team, revision: admin.revision }] });
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument()
  );
  await act(async () => oldNotify({ status: 403, code: "AUTHORIZATION_CHANGED" }));
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
});

it("falls back to an accessible ledger when explicit Reload finds the selected membership removed", async () => {
  window.history.replaceState({}, "", "/members");
  authenticatedLedgers([adminTeam(), personal], "bob");
  harness.apis.team = membersApi();
  harness.apis.alice = membersApi();
  render(<App />);
  await screen.findByRole("button", { name: "Invite member" });
  ledgerApi.workspaces.mockResolvedValue({ items: [personal] });
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("alice")
  );
  expect(harness.apis.alice.members).toHaveBeenCalledTimes(1);
  expect(harness.apis.team.members).toHaveBeenCalledTimes(1);
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
});

it("reloads current permissions once on scoped navigation without polling after the response", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers([team], "bob");
  render(<App />);
  await screen.findByRole("heading", { name: "Projects" });
  ledgerApi.workspaces.mockResolvedValue({ items: [adminTeam()] });
  harness.apis.team = membersApi();
  act(() => {
    window.history.pushState({}, "", "/members");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(await screen.findByRole("button", { name: "Invite member" })).toBeEnabled();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
  await act(async () => Promise.resolve());
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
});

it("waits for confirmed same-account focus before checking access and deduplicates concurrent focus", async () => {
  window.history.replaceState({}, "", "/members");
  authenticatedLedgers([team], "bob");
  harness.apis.team = membersApi();
  render(<App />);
  await screen.findByRole("button", { name: "Reload" });
  const session = pending();
  const access = pending();
  pullwiseApi.auth.getSession.mockReturnValueOnce(session.promise);
  ledgerApi.workspaces.mockReturnValueOnce(access.promise);
  act(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  await act(async () => session.resolve({ authenticated: true, user: { id: "bob" } }));
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2));
  act(() => window.dispatchEvent(new Event("focus")));
  await act(async () => Promise.resolve());
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
  await act(async () => access.resolve({ items: [adminTeam()] }));
  expect(await screen.findByRole("button", { name: "Invite member" })).toBeEnabled();
});

it("preserves a one-time invitation link and draft when focused access is unchanged", async () => {
  window.history.replaceState({}, "", "/members");
  authenticatedLedgers([personal]);
  harness.apis.alice = membersApi();
  render(<App />);
  const create = await openMembersManagement();
  fireEvent.submit(create.closest("form"));
  const link = await screen.findByLabelText("New invitation link");
  await waitFor(() => expect(screen.getByRole("button", { name: "Invite member" })).toBeEnabled());
  const access = pending();
  ledgerApi.workspaces.mockReturnValueOnce(access.promise);
  const reads = ledgerApi.workspaces.mock.calls.length;
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(reads + 1));
  expect(screen.getByLabelText("New invitation link")).toBe(link);
  expect(link).toHaveValue(`${window.location.origin}/members#invite=${inviteToken}`);
  expect(screen.getByRole("button", { name: "Create invitation" })).toBeDisabled();
  await act(async () =>
    access.resolve({
      items: [{ ...personal, permissions: { manageAdmins: true, manageMembers: true } }],
    })
  );
  expect(screen.getByLabelText("New invitation link")).toBe(link);
  expect(harness.apis.alice.inviteMember).toHaveBeenCalledTimes(1);
});

it("does not let an older membership-triggered access response restore Admin after a newer focus downgrade", async () => {
  window.history.replaceState({}, "", "/members");
  const admin = adminTeam();
  authenticatedLedgers([admin], "bob");
  harness.apis.team = membersApi();
  const obsolete = pending();
  ledgerApi.workspaces
    .mockResolvedValueOnce({ items: [admin] })
    .mockReturnValueOnce(obsolete.promise)
    .mockResolvedValue({ items: [{ ...team, revision: 4 }] });
  render(<App />);
  const create = await openMembersManagement();
  fireEvent.submit(create.closest("form"));
  await screen.findByLabelText("New invitation link");
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Invite member" })).toBeEnabled());
  const oldSignal = ledgerApi.workspaces.mock.calls[1][0].signal;
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument()
  );
  expect(oldSignal.aborted).toBe(true);
  await act(async () => obsolete.resolve({ items: [admin] }));
  expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(3);
});

it("clears protected cached access after an explicit access refresh fails without retrying", async () => {
  window.history.replaceState({}, "", "/members");
  authenticatedLedgers([adminTeam()], "bob");
  harness.apis.team = membersApi();
  render(<App />);
  await screen.findByRole("button", { name: "Invite member" });
  ledgerApi.workspaces.mockRejectedValueOnce(new Error("Access unavailable"));
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Access unavailable");
  expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
});

it("reopens an old Viewer invitation fragment with current Admin capabilities without accepting again", async () => {
  window.history.replaceState({}, "", "/members");
  authenticatedLedgers([team], "bob");
  const admin = adminTeam();
  harness.apis.team = membersApi({
    previewInvitation: vi.fn().mockResolvedValue({
      ...invite,
      role: "viewer",
      status: "accepted",
      request: { ...joinRequest, status: "approved" },
      workspace: admin,
    }),
  });
  render(<App />);
  await screen.findByRole("button", { name: "Reload" });
  expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument();
  ledgerApi.workspaces.mockResolvedValue({ items: [admin] });
  act(() => {
    window.history.replaceState({}, "", `/members#invite=${inviteToken}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(await screen.findByRole("button", { name: "Invite member" })).toBeEnabled();
  const panel = screen.getByRole("heading", { name: "Ledger invitation" }).closest("section");
  expect(within(panel).getByText("Role: Admin")).toBeVisible();
  expect(within(panel).queryByText("Role: Viewer")).not.toBeInTheDocument();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
  expect(harness.apis.team.acceptInvitation).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Open shared ledger" }));
  await waitFor(() => expect(window.location.hash).toBe(""));
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
  expect(screen.getByRole("button", { name: "Invite member" })).toBeEnabled();
  expect(harness.apis.team.acceptInvitation).not.toHaveBeenCalled();
});

it("reopening an accepted Admin invitation respects a current Viewer downgrade", async () => {
  window.history.replaceState({}, "", "/members");
  const admin = adminTeam();
  const viewer = { ...team, revision: admin.revision + 1 };
  authenticatedLedgers([admin], "bob");
  harness.apis.team = membersApi({
    previewInvitation: vi.fn().mockResolvedValue({
      ...invite,
      role: "admin",
      status: "accepted",
      request: { ...joinRequest, status: "approved" },
      workspace: viewer,
    }),
  });
  render(<App />);
  await screen.findByRole("button", { name: "Invite member" });
  ledgerApi.workspaces.mockResolvedValue({ items: [viewer] });
  act(() => {
    window.history.replaceState({}, "", `/members#invite=${inviteToken}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument()
  );
  const panel = screen.getByRole("heading", { name: "Ledger invitation" }).closest("section");
  expect(within(panel).getByText("Role: Viewer")).toBeVisible();
  expect(within(panel).queryByText("Role: Admin")).not.toBeInTheDocument();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
  expect(harness.apis.team.acceptInvitation).not.toHaveBeenCalled();
});

it("retires legacy product routes", () => {
  expect(screenFromPath("/dashboard/overview")).toBeNull();
  expect(screenFromPath("/services")).toBeNull();
  expect(screenFromPath("/repos")).toBeNull();
});

it("shows a not found page for a retired route", async () => {
  window.history.replaceState({}, "", "/dashboard/overview");
  render(
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
  expect(await screen.findByText("This page took a wrong turn")).toBeInTheDocument();
});

it("focuses the page heading after a lazy screen loads", async () => {
  window.history.replaceState({}, "", "/developers/docs");
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true });
  render(<App />);

  const heading = await screen.findByRole("heading", { name: "Project expense ledger" });
  await waitFor(() => expect(heading).toHaveFocus());
});

it("moves keyboard focus to the destination heading after navigation", async () => {
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true });
  const user = userEvent.setup();
  render(<App />);

  screen.getAllByRole("link", { name: "Docs" })[0].focus();
  await user.keyboard("{Enter}");
  const heading = await screen.findByRole("heading", { name: "Project expense ledger" });
  await waitFor(() => expect(heading).toHaveFocus());
});

it("preserves preference focus while an authenticated workspace loads", async () => {
  window.history.replaceState({}, "", "/projects");
  let restoreSession;
  pullwiseApi.auth.getSession.mockReturnValue(
    new Promise((resolve) => {
      restoreSession = resolve;
    })
  );
  render(<App />);
  const language = screen.getByRole("button", { name: "Select language" });
  language.focus();
  restoreSession({ authenticated: true, user: { id: "local-focus" } });

  await screen.findByRole("heading", { name: "Projects" });
  expect(language).toHaveFocus();
});

it("remounts protected state and aborts old reads when the actual ledger picker changes scope", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers();
  harness.enabled = true;
  const old = pending();
  harness.apis.alice = { projects: vi.fn().mockReturnValue(old.promise) };
  harness.apis.team = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Team-only project" }] }),
  };
  render(<App />);
  const draft = await screen.findByLabelText("Unsaved scope draft");
  fireEvent.change(draft, { target: { value: "Alice private draft" } });
  const oldSignal = harness.apis.alice.projects.mock.calls[0][1].signal;
  fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
    target: { value: "team" },
  });
  expect(await screen.findByText("Team-only project")).toBeVisible();
  expect(oldSignal.aborted).toBe(true);
  expect(screen.getByLabelText("Unsaved scope draft")).toHaveValue("");
  await act(async () => {
    old.resolve({ items: [{ name: "Late Alice private data" }] });
  });
  expect(screen.queryByText("Late Alice private data")).not.toBeInTheDocument();
  expect(harness.apis.team.projects).toHaveBeenCalledTimes(1);
});

it("ignores a late membership invalidation from the previous ledger instead of clearing a new ledger's draft", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers();
  harness.enabled = true;
  for (const id of ["alice", "team"])
    harness.apis[id] = {
      projects: vi.fn().mockResolvedValue({ items: [{ name: `${id} project` }] }),
    };
  render(<App />);
  await screen.findByText("alice project");
  const oldNotify = harness.captures.find((item) => item.id === "alice").notify;
  fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
    target: { value: "team" },
  });
  await screen.findByText("team project");
  fireEvent.change(screen.getByLabelText("Unsaved scope draft"), {
    target: { value: "Current team draft" },
  });
  await act(async () => {
    oldNotify(
      Object.assign(new Error("old membership revoked"), {
        status: 403,
        code: "WORKSPACE_MEMBERSHIP_CHANGED",
      })
    );
  });
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Unsaved scope draft")).toHaveValue("Current team draft");
});

it("keeps an old callback obsolete after selecting another ledger and returning to the original ledger", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers();
  harness.enabled = true;
  for (const id of ["alice", "team"])
    harness.apis[id] = {
      projects: vi.fn().mockResolvedValue({ items: [{ name: `${id} project` }] }),
    };
  render(<App />);
  await screen.findByText("alice project");
  const oldNotify = harness.captures.find((item) => item.id === "alice").notify;
  fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
    target: { value: "team" },
  });
  await screen.findByText("team project");
  fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
    target: { value: "alice" },
  });
  await screen.findByText("alice project");
  fireEvent.change(screen.getByLabelText("Unsaved scope draft"), {
    target: { value: "New Alice draft" },
  });
  await act(async () => {
    oldNotify(
      Object.assign(new Error("old Alice request"), { status: 403, code: "AUTHORIZATION_CHANGED" })
    );
  });
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Unsaved scope draft")).toHaveValue("New Alice draft");
});

it("fences the same workspace ID to the authenticated identity and ignores the previous account's callback", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers([team], "actor-one");
  harness.enabled = true;
  const old = pending();
  harness.apis.team = {
    projects: vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue({ items: [{ name: "Second identity result" }] }),
  };
  render(<App />);
  fireEvent.change(await screen.findByLabelText("Unsaved scope draft"), {
    target: { value: "First identity private draft" },
  });
  const oldSignal = harness.apis.team.projects.mock.calls[0][1].signal;
  const oldNotify = harness.captures.find((item) => item.id === "team").notify;
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true, user: { id: "actor-two" } });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(await screen.findByText("Second identity result")).toBeVisible();
  expect(oldSignal.aborted).toBe(true);
  expect(screen.getByLabelText("Unsaved scope draft")).toHaveValue("");
  await act(async () => {
    old.resolve({ items: [{ name: "First identity late data" }] });
  });
  expect(screen.queryByText("First identity late data")).not.toBeInTheDocument();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
  await act(async () => {
    oldNotify(
      Object.assign(new Error("first identity"), { status: 403, code: "AUTHORIZATION_CHANGED" })
    );
  });
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
});

it("hides a revoked current ledger while checking membership and falls back to an accessible ledger", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers([team, personal]);
  harness.enabled = true;
  harness.apis.team = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Revoked team data" }] }),
  };
  harness.apis.alice = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Personal accessible data" }] }),
  };
  const refresh = pending();
  ledgerApi.workspaces
    .mockResolvedValueOnce({ items: [team, personal] })
    .mockReturnValueOnce(refresh.promise);
  render(<App />);
  await screen.findByText("Revoked team data");
  const notify = harness.captures.find((item) => item.id === "team").notify;
  await act(async () => {
    notify(
      Object.assign(new Error("revoked"), { status: 403, code: "WORKSPACE_MEMBERSHIP_CHANGED" })
    );
  });
  expect(screen.queryByText("Revoked team data")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Unsaved scope draft")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Loading ledger" })).toBeVisible();
  await act(async () => {
    refresh.resolve({ items: [personal] });
  });
  expect(await screen.findByText("Personal accessible data")).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("alice");
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2);
});

it("preserves the real Members screen's one-time invitation link throughout soft picker refresh", async () => {
  window.history.replaceState({}, "", "/members");
  authenticatedLedgers([personal]);
  const refresh = pending();
  ledgerApi.workspaces
    .mockResolvedValueOnce({ items: [personal] })
    .mockReturnValueOnce(refresh.promise);
  harness.apis.alice = membersApi();
  const copy = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
  render(<App />);
  const create = await openMembersManagement();
  fireEvent.submit(create.closest("form"));
  const link = await screen.findByLabelText("New invitation link");
  expect(link).toHaveValue(`${window.location.origin}/members#invite=${inviteToken}`);
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("New invitation link")).toBe(link);
  fireEvent.click(screen.getByRole("button", { name: "Copy invitation link" }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith(link.value));
  await act(async () => {
    refresh.resolve({ items: [{ ...personal, name: "Renamed personal ledger" }] });
  });
  expect(screen.getByLabelText("New invitation link")).toBe(link);
  expect(harness.apis.alice.inviteMember).toHaveBeenCalledTimes(1);
  expect(harness.apis.alice.inviteMember).toHaveBeenCalledWith("alice", { role: "viewer" }, {});
  expect(screen.queryByLabelText("GitHub username")).not.toBeInTheDocument();
});

it.each([
  [403, "INVITATION_RECIPIENT_MISMATCH"],
  [404, "INVITATION_NOT_FOUND"],
  [403, "INVITATION_AUTHORITY_LOST"],
  [404, "WORKSPACE_NOT_FOUND"],
])(
  "retains invitation %s %s as a local error without repeating preview or picker requests",
  async (status, code) => {
    window.history.replaceState({}, "", `/members#invite=${inviteToken}`);
    authenticatedLedgers([personal]);
    const stopSecondAttempt = pending();
    harness.apis.alice = membersApi({
      previewInvitation: vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error("Invitation unavailable"), { status, code }))
        .mockReturnValue(stopSecondAttempt.promise),
    });
    render(<App />);
    await waitFor(() => expect(harness.apis.alice.previewInvitation).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(harness.apis.alice.previewInvitation).toHaveBeenCalledTimes(1);
    expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request to join" })).not.toBeInTheDocument();
    expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  }
);

it("preserves a guest invitation through Login's GitHub return URL and the restored session", async () => {
  window.history.replaceState({}, "", `/members#invite=${inviteToken}`);
  harness.apis.alice = membersApi();
  ledgerApi.workspaces.mockResolvedValue({ items: [personal] });
  pullwiseApi.auth.getGitHubAuthorizeUrl.mockRejectedValue(new Error("Local provider boundary"));
  render(<App />);
  const login = await screen.findByRole(
    "button",
    { name: "Continue with GitHub" },
    { timeout: 4000 }
  );
  expect(window.location.pathname).toBe("/login");
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  fireEvent.click(login);
  await waitFor(() => expect(pullwiseApi.auth.getGitHubAuthorizeUrl).toHaveBeenCalledTimes(1));
  const destination = new URL(pullwiseApi.auth.getGitHubAuthorizeUrl.mock.calls[0][0].redirectTo);
  expect(destination.origin).toBe(window.location.origin);
  expect(destination.pathname).toBe("/members");
  expect(destination.hash).toBe(`#invite=${inviteToken}`);
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true, user: { id: "alice" } });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(await screen.findByRole("button", { name: "Request to join" })).toBeVisible();
  expect(window.location.pathname).toBe("/members");
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  expect(harness.apis.alice.acceptInvitation).not.toHaveBeenCalled();
});

it("returns an already authenticated Login invitation to Members without dropping its fragment", async () => {
  window.history.replaceState({}, "", `/login#invite=${inviteToken}`);
  authenticatedLedgers([personal]);
  harness.apis.alice = membersApi();
  render(<App />);
  expect(await screen.findByRole("button", { name: "Request to join" })).toBeVisible();
  expect(window.location.pathname).toBe("/members");
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  expect(harness.apis.alice.previewInvitation).toHaveBeenCalledTimes(1);
  expect(harness.apis.alice.acceptInvitation).not.toHaveBeenCalled();
});

it("keeps a submitted join request pending without switching ledgers or granting access", async () => {
  window.history.replaceState({}, "", `/members#invite=${inviteToken}`);
  authenticatedLedgers([personal]);
  const submitted = pending();
  harness.apis.alice = membersApi({
    acceptInvitation: vi.fn().mockReturnValue(submitted.promise),
  });
  render(<App />);
  const request = await screen.findByRole("button", { name: "Request to join" });
  fireEvent.click(request);
  fireEvent.click(request);
  expect(harness.apis.alice.acceptInvitation).toHaveBeenCalledTimes(1);
  expect(harness.apis.alice.acceptInvitation).toHaveBeenCalledWith({ token: inviteToken }, {});
  await act(async () => {
    submitted.resolve({ ...invite, workspace: team, request: joinRequest });
  });
  expect(
    await screen.findByText("Your request was sent. Waiting for the inviter's approval.")
  ).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("alice");
  expect(screen.queryByRole("option", { name: /Team ledger/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Open shared ledger" })).not.toBeInTheDocument();
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  expect(harness.apis.alice.previewInvitation).toHaveBeenCalledTimes(1);
});

it("notifies the inviter with the applicant identity and opens the request's ledger for review", async () => {
  window.history.replaceState({}, "", "/projects");
  const managedTeam = {
    ...team,
    role: "owner",
    permissions: { manageMembers: true, manageAdmins: true },
  };
  authenticatedLedgers([personal, managedTeam]);
  harness.enabled = true;
  harness.apis.alice = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Personal project" }] }),
  };
  harness.apis.team = membersApi({
    workspaceInvitationRequests: vi.fn().mockResolvedValue({ items: [joinRequest] }),
  });
  ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
  render(<App />);
  expect(await screen.findByText("Personal project")).toBeVisible();
  const notification = await screen.findByRole("alert");
  expect(notification).toHaveTextContent("Bob");
  expect(notification).toHaveTextContent("Team ledger");
  expect(screen.getByRole("button", { name: "Inbox" })).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
  expect(await screen.findByRole("button", { name: "Approve request from bob" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Reject request from bob" })).toBeVisible();
  expect(harness.apis.team.members).toHaveBeenCalledWith("team", expect.any(Object));
  expect(harness.apis.team.approveInviteRequest).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/members");
});

it.each([
  [{ kind: "shared" }, "/shared", "shared"],
  [{ kind: "project", projectId: "hosting" }, "/projects/hosting", "project"],
])(
  "opens a pending recurring expense in its current authorized ledger and target %j",
  async (target, path, mode) => {
    window.history.replaceState({}, "", "/projects");
    authenticatedLedgers([personal, { ...team, role: "editor" }]);
    ledgerApi.workspaces.mockResolvedValueOnce({ items: [personal] });
    harness.enabled = true;
    harness.apis.alice = {
      projects: vi.fn().mockResolvedValue({ items: [{ name: "Personal project" }] }),
    };
    harness.apis.team = {
      projects: vi.fn().mockResolvedValue({ items: [{ name: "Team expense" }] }),
      project: vi.fn().mockResolvedValue({ name: "Team expense" }),
    };
    ledgerApi.recurringExpenseNotifications.mockResolvedValue({
      items: [
        {
          id: "rule-one:2026-10-09",
          ruleId: "rule-one",
          periodKey: "2026-10-09",
          scheduledOn: "2026-10-09",
          workspaceId: "team",
          workspaceName: "Team ledger",
          target,
          amount: "12.30",
          currency: "USD",
          purpose: "Monthly hosting",
          failedCode: "EXPENSE_LIMIT_REACHED",
          createdAt: "2026-10-09T00:00:00Z",
        },
      ],
    });
    render(<App />);
    expect(await screen.findByText("Personal project")).toBeVisible();
    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("2026-10-09");
    fireEvent.click(within(notice).getByRole("button", { name: "Open recurring plan" }));
    expect(await screen.findByText("Team expense")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
    expect(window.location.pathname).toBe(path);
    await waitFor(() => expect(screen.getByText(`Recurring target: ${mode}`)).toHaveFocus());
    expect(ledgerApi.workspaces.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(harness.apis.alice.projects).toHaveBeenCalledTimes(1);
  }
);

it("opens the requested ledger when inbox review is the first navigation into a ledger", async () => {
  const managedTeam = {
    ...team,
    role: "admin",
    permissions: { manageMembers: true, manageAdmins: false },
  };
  authenticatedLedgers([personal, managedTeam]);
  harness.apis.alice = membersApi();
  harness.apis.team = membersApi({
    workspaceInvitationRequests: vi.fn().mockResolvedValue({ items: [joinRequest] }),
  });
  ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bob");
  expect(window.location.pathname).toBe("/");
  expect(ledgerApi.workspaces).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  expect(await screen.findByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
  expect(await screen.findByRole("button", { name: "Approve request from bob" })).toBeVisible();
  expect(harness.apis.team.workspaceInvitationRequests).toHaveBeenCalledWith(
    "team",
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
  expect(harness.apis.alice.members).not.toHaveBeenCalled();
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
  expect(window.location.pathname).toBe("/members");
});

it("opens review in the current Members ledger once and keeps ordinary returns collapsed", async () => {
  window.history.replaceState({}, "", "/members");
  authenticatedLedgers([personal]);
  const ownRequest = {
    ...joinRequest,
    workspaceId: personal.id,
    workspace: { id: personal.id, name: personal.name },
  };
  harness.apis.alice = membersApi({
    workspaceInvitationRequests: vi.fn().mockResolvedValue({ items: [ownRequest] }),
  });
  ledgerApi.invitationRequests.mockResolvedValue({ items: [ownRequest] });
  render(<App />);
  const initialToggle = await screen.findByRole("button", { name: "Invite member", exact: true });
  await waitFor(() => expect(initialToggle).toBeEnabled());
  expect(initialToggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("button", { name: "Approve request from bob" })
  ).not.toBeInTheDocument();

  fireEvent.click(await screen.findByRole("button", { name: "Review request" }));
  expect(await screen.findByRole("button", { name: "Approve request from bob" })).toBeVisible();
  const reviewedToggle = screen.getByRole("button", { name: "Invite member", exact: true });
  expect(reviewedToggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(reviewedToggle);
  expect(reviewedToggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("button", { name: "Approve request from bob" })
  ).not.toBeInTheDocument();

  act(() => {
    window.history.pushState({}, "", "/projects");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await screen.findByRole("heading", { name: "Projects" });
  act(() => {
    window.history.pushState({}, "", "/members");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const returnedToggle = await screen.findByRole("button", { name: "Invite member", exact: true });
  await waitFor(() => expect(returnedToggle).toBeEnabled());
  expect(returnedToggle).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("button", { name: "Approve request from bob" })
  ).not.toBeInTheDocument();
  expect(harness.apis.alice.approveInviteRequest).not.toHaveBeenCalled();
  expect(harness.apis.alice.inviteMember).not.toHaveBeenCalled();
});

it.each(["route", "ledger", "account"])(
  "discards a pending review intent after its %s changes before members settle",
  async (change) => {
    window.history.replaceState({}, "", "/projects");
    const managedTeam = {
      ...team,
      role: "admin",
      permissions: { manageMembers: true, manageAdmins: false },
    };
    authenticatedLedgers([personal, managedTeam]);
    harness.enabled = true;
    const originalMembers = pending();
    harness.apis.alice = {
      ...membersApi(),
      projects: vi.fn().mockResolvedValue({ items: [{ name: "Personal project" }] }),
    };
    harness.apis.team = {
      ...membersApi({
        workspaceInvitationRequests: vi.fn().mockResolvedValue({ items: [joinRequest] }),
      }),
      projects: vi.fn().mockResolvedValue({ items: [{ name: "Team project" }] }),
    };
    harness.apis.team.members.mockReturnValueOnce(originalMembers.promise);
    ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
    render(<App />);
    await screen.findByText("Personal project");
    fireEvent.click(await screen.findByRole("button", { name: "Review request" }));
    await waitFor(() => expect(harness.apis.team.members).toHaveBeenCalledTimes(1));
    const originalSignal = harness.apis.team.members.mock.calls[0][1].signal;
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
    expect(screen.getByRole("button", { name: "Invite member", exact: true })).toBeDisabled();

    if (change === "route") {
      fireEvent.click(screen.getByRole("link", { name: "Projects", exact: true }));
      await screen.findByText("Team project");
      act(() => {
        window.history.pushState({}, "", "/members");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    } else if (change === "ledger") {
      fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
        target: { value: "alice" },
      });
      const ownToggle = await screen.findByRole("button", { name: "Invite member", exact: true });
      await waitFor(() => expect(ownToggle).toBeEnabled());
      expect(ownToggle).toHaveAttribute("aria-expanded", "false");
      fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
        target: { value: "team" },
      });
    } else {
      pullwiseApi.auth.getSession.mockResolvedValue({
        authenticated: true,
        user: { id: "actor-two" },
      });
      ledgerApi.workspaces.mockResolvedValue({ items: [managedTeam] });
      ledgerApi.invitationRequests.mockResolvedValue({ items: [] });
      act(() => window.dispatchEvent(new Event("focus")));
      await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2));
    }

    await waitFor(() => expect(harness.apis.team.members).toHaveBeenCalledTimes(2));
    const toggle = await screen.findByRole("button", { name: "Invite member", exact: true });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(originalSignal.aborted).toBe(true);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await act(async () => originalMembers.resolve({ items: [] }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Approve request from bob" })
    ).not.toBeInTheDocument();
    expect(harness.apis.team.approveInviteRequest).not.toHaveBeenCalled();
    expect(harness.apis.team.inviteMember).not.toHaveBeenCalled();
  }
);

it("keeps notification review in the current ledger during a member write and allows inbox review afterward", async () => {
  window.history.replaceState({}, "", "/members");
  const managedTeam = {
    ...team,
    role: "admin",
    permissions: { manageMembers: true, manageAdmins: false },
  };
  authenticatedLedgers([personal, managedTeam]);
  const creating = pending();
  harness.apis.alice = membersApi({
    inviteMember: vi.fn().mockReturnValue(creating.promise),
  });
  harness.apis.team = membersApi({
    workspaceInvitationRequests: vi.fn().mockResolvedValue({ items: [joinRequest] }),
  });
  ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
  render(<App />);
  const create = await openMembersManagement();
  expect(await screen.findByRole("alert")).toHaveTextContent("Bob");
  fireEvent.submit(create.closest("form"));
  expect(harness.apis.alice.inviteMember).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Go to Pullwise home" })).toHaveAttribute(
    "aria-disabled",
    "true"
  );
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeDisabled();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Review request" })).toBeDisabled()
  );
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("alice");
  expect(harness.apis.team.members).not.toHaveBeenCalled();
  expect(harness.apis.alice.members).toHaveBeenCalledTimes(1);
  expect(window.location.pathname).toBe("/members");
  await act(async () => {
    creating.resolve({ ...invite, token: inviteToken });
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Inbox" })).toBeEnabled());
  await waitFor(() => expect(screen.getByRole("button", { name: "Review request" })).toBeEnabled());
  expect(screen.getByRole("button", { name: "Inbox" })).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
  const inbox = await screen.findByRole("dialog", { name: "Inbox" });
  fireEvent.click(within(inbox).getByRole("button", { name: "Review request" }));
  expect(await screen.findByRole("button", { name: "Approve request from bob" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("team");
  expect(harness.apis.team.members).toHaveBeenCalledWith("team", expect.any(Object));
  expect(inbox).not.toBeInTheDocument();
});

it("keeps pending requests available without repeating their notifications on focus refresh", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers([personal]);
  harness.enabled = true;
  harness.apis.alice = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Personal project" }] }),
  };
  ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
  const started = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(started);
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bob");
  fireEvent.click(screen.getByRole("button", { name: "Close notification" }));
  clock.mockReturnValue(started + 60000);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await waitFor(() => expect(ledgerApi.invitationRequests).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
  const inbox = await screen.findByRole("dialog", { name: "Inbox" });
  expect(inbox).toHaveTextContent("Bob");
  expect(inbox).toHaveTextContent("@bob");
  expect(inbox).toHaveTextContent("Team ledger");
});

it("ignores a late invitation inbox response after the authenticated account changes", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers([personal]);
  harness.enabled = true;
  harness.apis.alice = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Personal project" }] }),
  };
  const previousActorRequests = pending();
  ledgerApi.invitationRequests
    .mockReturnValueOnce(previousActorRequests.promise)
    .mockResolvedValue({ items: [] });
  render(<App />);
  await screen.findByText("Personal project");
  await waitFor(() => expect(ledgerApi.invitationRequests).toHaveBeenCalledTimes(1));
  const oldSignal = ledgerApi.invitationRequests.mock.calls[0][0].signal;
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true, user: { id: "actor-two" } });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => {
    previousActorRequests.resolve({ items: [joinRequest] });
  });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Inbox" })).not.toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
  const inbox = await screen.findByRole("dialog", { name: "Inbox" });
  expect(inbox).not.toHaveTextContent("Bob");
  expect(screen.queryByRole("button", { name: "Review request" })).not.toBeInTheDocument();
});

it("clears the previous account's visible requests and notification while the new inbox loads", async () => {
  window.history.replaceState({}, "", "/projects");
  authenticatedLedgers([personal]);
  harness.enabled = true;
  harness.apis.alice = {
    projects: vi.fn().mockResolvedValue({ items: [{ name: "Personal project" }] }),
  };
  ledgerApi.invitationRequests.mockResolvedValue({ items: [joinRequest] });
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Bob");
  const nextActorRequests = pending();
  ledgerApi.invitationRequests.mockReturnValue(nextActorRequests.promise);
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true, user: { id: "actor-two" } });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await waitFor(() => expect(ledgerApi.workspaces).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Inbox" })).not.toHaveTextContent("1");
  fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
  const inbox = await screen.findByRole("dialog", { name: "Inbox" });
  expect(inbox).not.toHaveTextContent("Bob");
  expect(screen.queryByRole("button", { name: "Review request" })).not.toBeInTheDocument();
});

it("treats an inaccessible old project ID in a newly selected ledger as one resource error", async () => {
  window.history.replaceState({}, "", "/projects/prj_alice");
  authenticatedLedgers();
  harness.enabled = true;
  harness.apis.alice = { project: vi.fn().mockResolvedValue({ name: "Alice-only project" }) };
  harness.apis.team = {
    project: vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Project unavailable"), { status: 404, code: "PROJECT_NOT_FOUND" })
      ),
  };
  render(<App />);
  await screen.findByText("Alice-only project");
  fireEvent.change(screen.getByLabelText("Unsaved scope draft"), {
    target: { value: "Alice-only edit" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Select ledger" }), {
    target: { value: "team" },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("PROJECT_NOT_FOUND");
  expect(screen.queryByText("Alice-only project")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Unsaved scope draft")).toHaveValue("");
  expect(window.location.pathname).toBe("/projects/prj_alice");
  expect(harness.apis.team.project).toHaveBeenCalledTimes(1);
  expect(ledgerApi.workspaces).toHaveBeenCalledTimes(1);
});
