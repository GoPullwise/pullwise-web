import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App.jsx";
import { pullwiseApi } from "./api/pullwise.js";
import { createLedgerApi, ledgerApi } from "./api/ledger.js";
import { NotificationProvider } from "./components/notifications.jsx";
import { screenFromPath } from "./lib/navigation.js";

vi.mock("./api/pullwise.js", () => ({
  pullwiseApi: { auth: { getSession: vi.fn(), getGitHubAuthorizeUrl: vi.fn() } },
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
  ledgerApi: { workspaces: vi.fn() },
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
  ledgerApi.workspaces.mockResolvedValue({
    items: [{ id: "local-focus", name: "Personal ledger", role: "owner", revision: 1 }],
  });
});

afterEach(() => vi.unstubAllGlobals());

function pending() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

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
  recipient: { githubId: "202", login: "bob" },
  role: "viewer",
  expiresAt: "2026-10-07T12:00:00Z",
  revision: 1,
  status: "pending",
};
const inviteToken = `pwi_${"x".repeat(43)}`;

function authenticatedLedgers(items = [personal, team], actor = "alice") {
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true, user: { id: actor } });
  ledgerApi.workspaces.mockResolvedValue({ items });
}

function membersApi(overrides = {}) {
  return {
    members: vi
      .fn()
      .mockResolvedValue({
        items: [
          { userId: "alice", name: "Alice", githubLogin: "alice", role: "owner", revision: 1 },
        ],
      }),
    invites: vi.fn().mockResolvedValue({ items: [] }),
    inviteMember: vi.fn().mockResolvedValue({ ...invite, token: inviteToken }),
    previewInvitation: vi.fn().mockResolvedValue({ ...invite, workspace: team }),
    acceptInvitation: vi.fn().mockResolvedValue({ workspace: team }),
    ...overrides,
  };
}

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
  fireEvent.change(await screen.findByLabelText("GitHub username"), { target: { value: "bob" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
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
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
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
  expect(await screen.findByRole("button", { name: "Accept invitation" })).toBeVisible();
  expect(window.location.pathname).toBe("/members");
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  expect(harness.apis.alice.acceptInvitation).not.toHaveBeenCalled();
});

it("returns an already authenticated Login invitation to Members without dropping its fragment", async () => {
  window.history.replaceState({}, "", `/login#invite=${inviteToken}`);
  authenticatedLedgers([personal]);
  harness.apis.alice = membersApi();
  render(<App />);
  expect(await screen.findByRole("button", { name: "Accept invitation" })).toBeVisible();
  expect(window.location.pathname).toBe("/members");
  expect(window.location.hash).toBe(`#invite=${inviteToken}`);
  expect(harness.apis.alice.previewInvitation).toHaveBeenCalledTimes(1);
  expect(harness.apis.alice.acceptInvitation).not.toHaveBeenCalled();
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
