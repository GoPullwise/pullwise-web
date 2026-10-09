import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { WorkspaceContext } from "../components/workspace-context.jsx";
import { SettingsScreen } from "./settings.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: { getSession: vi.fn() },
    integrations: { list: vi.fn() },
  },
}));
vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
  manageGitHubInstallation: vi.fn(),
  signOut: vi.fn(),
}));

const session = {
  authenticated: true,
  user: { name: "Taylor", email: "taylor@example.com" },
};
const connectedGitHub = {
  github: {
    connected: true,
    repositories: [],
    installations: [
      {
        id: "101",
        account: "team-a",
        manage: { mode: "verified_identity", githubIdentityId: "identity_a" },
      },
      { id: "202", account: "team-b", manage: { mode: "needs_identity" } },
    ],
  },
};
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function withLedgers(go = vi.fn(), onSelect = vi.fn()) {
  const workspace = { id: "ws_one", name: "Main ledger", role: "owner" };
  return render(
    <WorkspaceContext.Provider
      value={{
        workspace,
        items: [workspace, { ...workspace, id: "ws_two", name: "Second ledger" }],
        onSelect,
      }}
    >
      <SettingsScreen go={go} />
    </WorkspaceContext.Provider>
  );
}

describe("product settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pullwiseApi.auth.getSession.mockResolvedValue(session);
    pullwiseApi.integrations.list.mockResolvedValue({
      github: { connected: false, repositories: [], installations: [] },
    });
    connectGitHubRepositories.mockResolvedValue(undefined);
    manageGitHubInstallation.mockResolvedValue(undefined);
    signOut.mockResolvedValue(undefined);
  });

  it("shows account and read-only GitHub service onboarding without scan controls", async () => {
    render(<SettingsScreen go={vi.fn()} />);
    expect(await screen.findByText("Taylor")).toBeInTheDocument();
    expect(screen.getByText(/repository links are optional/i)).toBeInTheDocument();
    expect(screen.queryByText(/review output language/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/scan history/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^connect repositories$/i }));
    await waitFor(() => expect(connectGitHubRepositories).toHaveBeenCalledWith({}));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("offers retry when account data fails without inventing an empty account", async () => {
    pullwiseApi.auth.getSession.mockRejectedValueOnce(new Error("session unavailable"));
    render(<SettingsScreen go={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("session unavailable");
    expect(screen.getByText("Account profile unavailable.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^reload$/i }));
    expect(await screen.findByText("Taylor")).toBeInTheDocument();
  });

  it.each([false, true])(
    "locks all conflicting controls for connected=%s authorization even without an installation ID, through both refresh reads",
    async (connected) => {
      const popup = deferred();
      const sessionRead = deferred();
      const integrationsRead = deferred();
      const integrations = connected
        ? connectedGitHub
        : { github: { connected: false, repositories: [], installations: [] } };
      pullwiseApi.auth.getSession
        .mockResolvedValueOnce(session)
        .mockReturnValueOnce(sessionRead.promise);
      pullwiseApi.integrations.list
        .mockResolvedValueOnce(integrations)
        .mockReturnValueOnce(integrationsRead.promise);
      connectGitHubRepositories.mockReturnValueOnce(popup.promise);
      const go = vi.fn();
      const selectLedger = vi.fn();
      withLedgers(go, selectLedger);
      const button = await screen.findByRole("button", {
        name: connected ? "Add account or organization" : "Connect repositories",
      });
      fireEvent.click(button);
      fireEvent.click(button);
      expect(connectGitHubRepositories).toHaveBeenCalledExactlyOnceWith(
        connected ? { add: true } : {}
      );
      expect(button).toBeDisabled();
      expect(screen.getByRole("button", { name: "Reload" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
      const projects = screen.getByRole("link", { name: "Projects", exact: true });
      expect(projects).toHaveAttribute("aria-disabled", "true");
      expect(projects).not.toHaveAttribute("href");
      fireEvent.click(projects, { ctrlKey: true });
      const picker = screen.getByRole("combobox", { name: "Select ledger" });
      expect(picker).toBeDisabled();
      fireEvent.change(picker, { target: { value: "ws_two" } });
      expect(selectLedger).not.toHaveBeenCalled();
      expect(go).not.toHaveBeenCalled();
      if (connected) {
        expect(screen.getByRole("button", { name: "Open projects" })).toBeDisabled();
        for (const manage of screen.getAllByRole("button", {
          name: /Manage .+ GitHub App installation/,
        })) {
          expect(manage).toBeDisabled();
          fireEvent.click(manage);
        }
        expect(manageGitHubInstallation).not.toHaveBeenCalled();
      }
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      expect(signOut).not.toHaveBeenCalled();
      expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
      expect(pullwiseApi.integrations.list).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Taylor")).toBeVisible();
      expect(screen.getByText("Taylor").closest("section")).not.toHaveAttribute("inert");
      await act(async () => popup.resolve());
      expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(2);
      expect(pullwiseApi.integrations.list).toHaveBeenCalledTimes(2);
      expect(button).toBeDisabled();
      expect(picker).toBeDisabled();
      await act(async () => sessionRead.resolve(session));
      expect(button).toBeDisabled();
      expect(picker).toBeDisabled();
      await act(async () => integrationsRead.resolve(integrations));
      expect(button).toBeEnabled();
      expect(picker).toBeEnabled();
      expect(screen.getByRole("button", { name: "Reload" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
      expect(screen.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute(
        "href",
        "/projects"
      );
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    }
  );

  it("locks every installation management action while retaining its identity and return URL", async () => {
    const popup = deferred();
    pullwiseApi.integrations.list.mockResolvedValue(connectedGitHub);
    manageGitHubInstallation.mockReturnValueOnce(popup.promise);
    render(<SettingsScreen go={vi.fn()} />);
    const first = await screen.findByRole("button", {
      name: "Manage team-a GitHub App installation",
    });
    const second = screen.getByRole("button", { name: "Manage team-b GitHub App installation" });
    fireEvent.click(first);
    fireEvent.click(second);
    expect(manageGitHubInstallation).toHaveBeenCalledExactlyOnceWith("101", {
      githubIdentityId: "identity_a",
      redirectTo: window.location.href,
    });
    expect(first).toBeDisabled();
    expect(second).toBeDisabled();
    const add = screen.getByRole("button", { name: "Add account or organization" });
    expect(add).toBeDisabled();
    fireEvent.click(add);
    expect(connectGitHubRepositories).not.toHaveBeenCalled();
    await act(async () => popup.resolve());
    expect(first).toBeEnabled();
    expect(second).toBeEnabled();
    expect(add).toBeEnabled();
    expect(pullwiseApi.integrations.list).toHaveBeenCalledTimes(2);
  });

  it("releases the busy lock after a failed connection without automatically retrying or refreshing", async () => {
    connectGitHubRepositories.mockRejectedValueOnce(new Error("Popup canceled"));
    withLedgers();
    fireEvent.click(await screen.findByRole("button", { name: "Connect repositories" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Popup canceled");
    expect(screen.getByRole("button", { name: "Connect repositories" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute(
      "href",
      "/projects"
    );
    expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.integrations.list).toHaveBeenCalledTimes(1);
  });

  it("keeps browsing and ledger navigation available during an ordinary read while disabling stale mutations", async () => {
    pullwiseApi.integrations.list.mockResolvedValue(connectedGitHub);
    withLedgers();
    await screen.findByText("Taylor");
    const read = deferred();
    pullwiseApi.integrations.list.mockReturnValueOnce(read.promise);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(screen.getByRole("button", { name: "Reload" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add account or organization" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Manage team-a GitHub App installation" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Open projects" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute(
      "href",
      "/projects"
    );
    await act(async () => read.resolve(connectedGitHub));
    expect(screen.getByRole("button", { name: "Add account or organization" })).toBeEnabled();
  });

  it("admits one pending sign out and blocks GitHub changes until it fails or completes", async () => {
    const pending = deferred();
    signOut.mockReturnValueOnce(pending.promise);
    withLedgers();
    const leave = await screen.findByRole("button", { name: "Sign out" });
    fireEvent.click(leave);
    fireEvent.click(leave);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(leave).toBeDisabled();
    const connect = screen.getByRole("button", { name: "Connect repositories" });
    expect(connect).toBeDisabled();
    fireEvent.click(connect);
    expect(connectGitHubRepositories).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeDisabled();
    await act(async () => pending.reject(new Error("Sign out failed")));
    expect(screen.getByRole("alert")).toHaveTextContent("Sign out failed");
    expect(leave).toBeEnabled();
    expect(connect).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeEnabled();
    expect(pullwiseApi.integrations.list).toHaveBeenCalledTimes(1);
  });

  it("waits for GitHub access before offering connection actions", () => {
    pullwiseApi.integrations.list.mockReturnValue(new Promise(() => {}));
    render(<SettingsScreen go={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /^connect repositories$/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/repository links are optional/i)).not.toBeInTheDocument();
    expect(connectGitHubRepositories).not.toHaveBeenCalled();
  });

  it("keeps the profile visible and retries unknown GitHub access without suggesting a new connection", async () => {
    pullwiseApi.integrations.list.mockRejectedValueOnce(
      new Error("GitHub temporarily unavailable")
    );
    render(<SettingsScreen go={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub temporarily unavailable");
    expect(screen.getByText("Taylor")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^connect repositories$/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/repositories authorized/i)).not.toBeInTheDocument();
    expect(connectGitHubRepositories).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^reload$/i }));
    expect(await screen.findByRole("button", { name: /^connect repositories$/i })).toBeEnabled();
  });

  it("does not reload account data when GitHub authorization finishes after leaving Settings", async () => {
    let finish;
    connectGitHubRepositories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const view = render(<SettingsScreen go={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /^connect repositories$/i }));
    view.unmount();
    finish();
    await Promise.resolve();
    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.integrations.list).toHaveBeenCalledTimes(1);
  });

  it("aborts in-flight account reads when leaving Settings", async () => {
    pullwiseApi.integrations.list.mockImplementationOnce(() => new Promise(() => {}));
    const view = render(<SettingsScreen go={vi.fn()} />);
    const sessionSignal = pullwiseApi.auth.getSession.mock.calls[0][0]?.signal;
    const integrationsSignal = pullwiseApi.integrations.list.mock.calls[0][0]?.signal;
    expect(sessionSignal).toBeDefined();
    expect(integrationsSignal).toBe(sessionSignal);
    view.unmount();
    expect(sessionSignal.aborted).toBe(true);
  });
});
