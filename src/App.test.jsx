import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./api/pullwise.js";
import { App } from "./App.jsx";
import { connectGitHubRepositories, startGitHubLogin } from "./lib/auth.js";
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
  signOut: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
    pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: false });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [] });
    pullwiseApi.repositories.sync.mockResolvedValue({ items: [] });
    pullwiseApi.scans.list.mockResolvedValue({ items: [] });
    pullwiseApi.issues.list.mockResolvedValue({ items: [] });
  });

  it("renders the normal entry", () => {
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

  it("sends authenticated users on the login screen back to the landing page", async () => {
    window.history.replaceState({}, "", "/?screen=login");
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
    window.history.replaceState({}, "", "/?screen=dashboard");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({ authenticated: false });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="login"]')).toBeInTheDocument();
    });
  });

  it("shows workspace actions on the landing page for signed-in users", () => {
    render(<LandingScreen go={vi.fn()} accent="#6366f1" auth={{ authenticated: true }} />);

    expect(screen.getAllByRole("button", { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sign in$/i })).not.toBeInTheDocument();
  });

  it("renders GitHub-only login UI", () => {
    render(<LoginScreen go={vi.fn()} />);

    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /email me a magic link/i })).not.toBeInTheDocument();
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
    window.history.replaceState({}, "", "/?screen=oauth");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /back/i }));

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

  it("explains missing GitHub App read-only contents permission for private repositories", async () => {
    connectGitHubRepositories.mockRejectedValueOnce(
      new Error("GitHub App installation must grant Contents: read-only access so Pullwise can scan private repositories without write permission.")
    );
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/read-only permission/i);
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
    window.history.replaceState({}, "", "/?screen=repos");
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
    window.history.replaceState({}, "", "/?screen=repos");
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
    window.history.replaceState({}, "", "/?screen=repos");
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
    window.history.replaceState({}, "", "/?screen=repos");
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
          installationHtmlUrl: "https://github.com/organizations/GoPullwise/settings/installations/130258770",
          repositorySelection: "selected",
          repositoryCount: 1,
        },
        {
          installationId: "134816087",
          installationAccount: "GoTagma",
          installationTargetType: "Organization",
          installationHtmlUrl: "https://github.com/organizations/GoTagma/settings/installations/134816087",
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
    expect(screen.getByText(/Organization .* all repositories .* 4 repositories/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage gopullwise/i })).toHaveAttribute(
      "href",
      "https://github.com/organizations/GoPullwise/settings/installations/130258770"
    );
  });

  it("starts GitHub repository authorization from the dashboard sidebar", async () => {
    window.history.replaceState({}, "", "/?screen=dashboard");
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

  it("keeps failed dashboard sidebar repository authorization in the repositories flow", async () => {
    window.history.replaceState({}, "", "/?screen=dashboard");
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
    window.history.replaceState({}, "", "/?screen=repos&repoAuth=1");
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
    window.history.replaceState({}, "", "/?screen=repos&repoAuth=1");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [], needsAuthorization: true });
    connectGitHubRepositories.mockRejectedValueOnce(new Error("GitHub App install URL is unavailable"));

    render(<App />);

    expect(await screen.findByText("GitHub App install URL is unavailable")).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("repoAuth")).toBeNull();
  });
});
