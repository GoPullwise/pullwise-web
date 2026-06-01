import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./api/pullwise.js";
import { App } from "./App.jsx";
import {
  connectGitHubRepositories,
  manageGitHubInstallation,
  startGitHubLogin,
} from "./lib/auth.js";
import { LandingScreen, LoginScreen, OAuthScreen } from "./screens/public.jsx";

vi.mock("./api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getSession: vi.fn(),
    },
    repositories: {
      list: vi.fn(),
      sync: vi.fn(),
    },
    scans: {
      list: vi.fn(),
    },
    issues: {
      list: vi.fn(),
    },
  },
}));

vi.mock("./lib/auth.js", () => ({
  startGitHubLogin: vi.fn(),
  connectGitHubRepositories: vi.fn(),
  manageGitHubInstallation: vi.fn(),
  signOut: vi.fn(),
}));

function blockedStorage() {
  return {
    getItem: vi.fn(() => {
      throw new Error("storage blocked");
    }),
    setItem: vi.fn(() => {
      throw new Error("storage blocked");
    }),
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState({}, "", "/");
    pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: false });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [] });
    pullwiseApi.repositories.sync.mockResolvedValue({ items: [] });
    pullwiseApi.scans.list.mockResolvedValue({ items: [] });
    pullwiseApi.issues.list.mockResolvedValue({ items: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the normal entry", () => {
    render(<App />);

    expect(screen.getAllByText("Pullwise").length).toBeGreaterThan(0);
  });

  it("renders when browser storage is unavailable", () => {
    vi.stubGlobal("localStorage", blockedStorage());

    render(<App />);

    expect(screen.getAllByText("Pullwise").length).toBeGreaterThan(0);
  });

  it("renders the prototype navigator entry", () => {
    render(<App prototypeNav />);

    expect(screen.getByText("PR · Prototype")).toBeInTheDocument();
  });

  it("restores a valid session without leaving the landing page", async () => {
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="landing"]')).toBeInTheDocument();
    });
  });

  it("does not show signed-out landing actions while the session check is pending", () => {
    pullwiseApi.auth.getSession.mockReturnValueOnce(new Promise(() => {}));

    render(<App />);

    expect(screen.getAllByRole("button", { name: /checking session/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^sign in$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign in with github/i })).not.toBeInTheDocument();
  });

  it("shows session restoration instead of the login form while the login route is checking", () => {
    window.history.replaceState({}, "", "/login");
    pullwiseApi.auth.getSession.mockReturnValueOnce(new Promise(() => {}));

    render(<App />);

    expect(screen.getByRole("heading", { name: /checking session/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue with github/i })).not.toBeInTheDocument();
  });

  it("sends authenticated users on the login screen back to the landing page", async () => {
    window.history.replaceState({}, "", "/login");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="landing"]')).toBeInTheDocument();
    });
  });

  it("sends expired sessions back to login on private screens", async () => {
    window.history.replaceState({}, "", "/dashboard");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({ authenticated: false });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="login"]')).toBeInTheDocument();
    }, { timeout: 3500 });
  });

  it("keeps login actions hidden while confirming an initial signed-out session result", async () => {
    pullwiseApi.auth.getSession
      .mockResolvedValueOnce({ authenticated: false })
      .mockResolvedValueOnce({
        authenticated: true,
        user: { name: "Dev", email: "dev@example.com" },
      });

    render(<App />);

    await waitFor(() => {
      expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
    });
    expect(screen.getAllByRole("button", { name: /checking session/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in with github/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(2);
      expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
    }, { timeout: 3500 });
    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
  });

  it("shows signed-in actions on the landing page", () => {
    render(<LandingScreen go={vi.fn()} accent="#6366f1" auth={{ authenticated: true }} />);

    expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
  });

  it("renders GitHub-only login UI", () => {
    render(<LoginScreen go={vi.fn()} />);

    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /email me a magic link/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("you@company.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Create account")).not.toBeInTheDocument();
  });

  it("starts GitHub login without requesting repository authorization", async () => {
    startGitHubLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<LoginScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /continue with github/i }));

    await waitFor(() => {
      expect(startGitHubLogin).toHaveBeenCalledTimes(1);
    });
    expect(connectGitHubRepositories).not.toHaveBeenCalled();
  });

  it("opens GitHub install in a popup and navigates to repos on success", async () => {
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
      expect(go).toHaveBeenCalledWith("repos");
    });
  });

  it("returns authenticated users from repository authorization back to repositories", async () => {
    window.history.replaceState({}, "", "/oauth");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    const user = userEvent.setup();

    render(<App />);

    const back = await screen.findByRole("link", { name: /back/i });
    expect(back).toHaveAttribute("href", "/repos");

    await user.click(back);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="repos"]')).toBeInTheDocument();
    });
  });

  it("shows a cancel message when the install popup is closed", async () => {
    const cancelled = Object.assign(new Error("GitHub installation was cancelled."), {
      code: "popup_closed",
    });
    connectGitHubRepositories.mockRejectedValueOnce(cancelled);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled/i);
    expect(go).not.toHaveBeenCalled();
  });

  it("explains owner-only GitHub App repository authorization errors", async () => {
    const ownerOnly = Object.assign(
      new Error("GitHub App 'gopullwise' is private or not publicly visible."),
      { status: 409 }
    );
    connectGitHubRepositories.mockRejectedValueOnce(ownerOnly);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/public \/ any account/i);
    expect(go).not.toHaveBeenCalled();
  });

  it("explains missing GitHub App write permissions for private repository remediation", async () => {
    connectGitHubRepositories.mockRejectedValueOnce(
      new Error(
        "GitHub App installation must grant Contents: read access."
      )
    );
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Contents: write and Pull requests: write/i);
    expect(go).not.toHaveBeenCalled();
  });

  it("explains GitHub App install requests that need organization owner approval", async () => {
    const requested = Object.assign(new Error("github_app_installation_not_completed"), {
      code: "github_app_installation_not_completed",
    });
    connectGitHubRepositories.mockRejectedValueOnce(requested);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/organization owner/i);
    expect(go).not.toHaveBeenCalled();
  });

  it("explains GitHub App callbacks missing installation ids", async () => {
    const missing = Object.assign(new Error("missing_installation_id"), {
      code: "missing_installation_id",
    });
    connectGitHubRepositories.mockRejectedValueOnce(missing);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/setup url/i);
    expect(go).not.toHaveBeenCalled();
  });

  it("explains when the backend cannot sync GitHub App repositories", async () => {
    const unavailable = Object.assign(new Error("github_app_api_unconfigured"), {
      code: "github_app_api_unconfigured",
    });
    connectGitHubRepositories.mockRejectedValueOnce(unavailable);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/private key/i);
    expect(go).not.toHaveBeenCalled();
  });

  it("uses the full-width repository row layout for the GitHub connection prompt", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [], needsAuthorization: true });

    render(<App />);

    const title = await screen.findByText("Connect GitHub repositories");
    expect(title.closest(".repo-row")).toHaveClass("repo-row-status");
  });

  it("starts GitHub repository authorization from the repositories empty state", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [], needsAuthorization: true });
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<App />);

    const title = await screen.findByText("Connect GitHub repositories");
    await user.click(title.closest(".repo-row"));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    });
  });

  it("starts adding another GitHub account or organization from the repositories footer", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({
      items: [
        {
          id: "repo_1",
          name: "private-repo",
          fullName: "octocat/private-repo",
          desc: "",
        },
      ],
      needsAuthorization: false,
    });
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByText(/add github account or organization/i));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledWith({ add: true });
    });
  });

  it("shows each authorized GitHub App installation on the repositories screen", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({
      items: [
        {
          id: "repo_pullwise_server",
          name: "pullwise-server",
          fullName: "GoPullwise/pullwise-server",
          desc: "",
        },
      ],
      needsAuthorization: false,
      installations: [
        {
          installationId: "130258770",
          installationAccount: "GoPullwise",
          installationTargetType: "Organization",
          installationHtmlUrl:
            "https://github.com/organizations/GoPullwise/settings/installations/130258770",
          repositorySelection: "selected",
          repositoryCount: 1,
        },
        {
          installationId: "134816087",
          installationAccount: "GoTagma",
          installationTargetType: "Organization",
          installationHtmlUrl:
            "https://github.com/organizations/GoTagma/settings/installations/134816087",
          repositorySelection: "all",
          repositoryCount: 4,
        },
      ],
    });

    render(<App />);

    expect(await screen.findByText("Authorized GitHub installations")).toBeInTheDocument();
    expect(screen.getByText("GoPullwise")).toBeInTheDocument();
    expect(screen.getByText(/Organization .* selected .* 1 repository/i)).toBeInTheDocument();
    expect(screen.getByText("GoTagma")).toBeInTheDocument();
    expect(
      screen.getByText(/Organization .* all repositories .* 4 repositories/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage gopullwise/i })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /manage gopullwise github app installation/i })
    ).toBeInTheDocument();
  });

  it("syncs repositories after returning from GitHub installation management", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    const initialPayload = {
      items: [
        {
          id: "repo_pullwise_server",
          name: "pullwise-server",
          fullName: "GoPullwise/pullwise-server",
          desc: "",
        },
      ],
      needsAuthorization: false,
      installationAccounts: ["GoPullwise"],
      installations: [
        {
          installationId: "130258770",
          installationAccount: "GoPullwise",
          installationTargetType: "Organization",
          installationHtmlUrl:
            "https://github.com/organizations/GoPullwise/settings/installations/130258770",
          repositorySelection: "selected",
          repositoryCount: 1,
        },
      ],
    };
    const updatedPayload = {
      items: [
        {
          id: "repo_pullwise_server",
          name: "pullwise-server",
          fullName: "GoPullwise/pullwise-server",
          desc: "",
        },
        {
          id: "repo_pullwise_web",
          name: "pullwise-web",
          fullName: "GoPullwise/pullwise-web",
          desc: "",
        },
      ],
      needsAuthorization: false,
      installationAccounts: ["GoPullwise"],
      installations: [
        {
          installationId: "130258770",
          installationAccount: "GoPullwise",
          installationTargetType: "Organization",
          installationHtmlUrl:
            "https://github.com/organizations/GoPullwise/settings/installations/130258770",
          repositorySelection: "selected",
          repositoryCount: 2,
        },
      ],
    };
    pullwiseApi.repositories.list.mockResolvedValue(initialPayload);
    manageGitHubInstallation.mockImplementationOnce(async () => {
      pullwiseApi.repositories.list.mockResolvedValue(updatedPayload);
    });
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByText("GoPullwise/pullwise-server")).toBeInTheDocument();
    expect(screen.queryByText("GoPullwise/pullwise-web")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /manage gopullwise github app installation/i })
    );

    await waitFor(() => {
      expect(manageGitHubInstallation).toHaveBeenCalledWith("130258770", {
        githubIdentityId: undefined,
      });
      expect(screen.getByText("GoPullwise/pullwise-web")).toBeInTheDocument();
    });
    expect(screen.getByText(/2 repositories/i)).toBeInTheDocument();
  });

  it("starts GitHub repository authorization from the dashboard sidebar", async () => {
    window.history.replaceState({}, "", "/dashboard");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [], needsAuthorization: true });
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /connect github/i }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    });
  });

  it("opens issue search results directly in the issue detail view", async () => {
    window.history.replaceState({}, "", "/dashboard");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.issues.list.mockResolvedValue({
      items: [
        {
          id: "f_redirect",
          scanId: "sc_1",
          repo: "octocat/private-repo",
          title: "Unsafe redirect target",
          summary: "Redirects accept attacker-controlled URLs.",
          impact: "Attackers can redirect users to phishing domains.",
          severity: "high",
          category: "Security",
          status: "open",
          file: "src/auth.js",
          line: 42,
          confidence: 0.94,
          effort: "S",
        },
      ],
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /search/i }));
    const searchModal = document.querySelector(".modal-search");
    await waitFor(() => expect(searchModal).toBeInTheDocument());
    await user.click(within(searchModal).getByRole("button", { name: /unsafe redirect target/i }));

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="issue"]')).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /unsafe redirect target/i })).toBeInTheDocument();
    expect(
      screen.getByText("Attackers can redirect users to phishing domains.")
    ).toBeInTheDocument();
  });

  it("keeps failed dashboard sidebar repository authorization in the repositories flow", async () => {
    window.history.replaceState({}, "", "/dashboard");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [], needsAuthorization: true });
    connectGitHubRepositories.mockRejectedValueOnce(new Error("authorization failed"));
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /connect github/i }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
      expect(document.querySelector('[data-screen-label="repos"]')).toBeInTheDocument();
    });
  });

  it("continues repository authorization after returning from GitHub login", async () => {
    window.history.replaceState({}, "", "/repos?repoAuth=1");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [], needsAuthorization: true });
    connectGitHubRepositories.mockResolvedValueOnce(undefined);

    render(<App />);

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    });
    expect(new URLSearchParams(window.location.search).get("repoAuth")).toBeNull();
  });

  it("shows repository authorization errors after automatic continuation fails", async () => {
    window.history.replaceState({}, "", "/repos?repoAuth=1");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [], needsAuthorization: true });
    connectGitHubRepositories.mockRejectedValueOnce(
      new Error("GitHub App install URL is unavailable")
    );

    render(<App />);

    expect(await screen.findByText("GitHub App install URL is unavailable")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("repoAuth")).toBeNull();
  });
});
