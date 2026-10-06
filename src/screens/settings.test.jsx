import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { connectGitHubRepositories, signOut } from "../lib/auth.js";
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

describe("product settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      user: { name: "Taylor", email: "taylor@example.com" },
    });
    pullwiseApi.integrations.list.mockResolvedValue({
      github: { connected: false, repositories: [], installations: [] },
    });
  });

  it("shows account and read-only GitHub service onboarding without scan controls", async () => {
    render(<SettingsScreen go={vi.fn()} />);
    expect(await screen.findByText("Taylor")).toBeInTheDocument();
    expect(screen.getByText(/create ledger projects/i)).toBeInTheDocument();
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

  it("waits for GitHub access before offering connection actions", () => {
    pullwiseApi.integrations.list.mockReturnValue(new Promise(() => {}));
    render(<SettingsScreen go={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /^connect repositories$/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/create ledger projects/i)).not.toBeInTheDocument();
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
    connectGitHubRepositories.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
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
