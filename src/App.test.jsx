import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./api/pullwise.js";
import { App } from "./App.jsx";
import { setLang } from "./i18n.jsx";
import {
  connectGitHubRepositories,
  manageGitHubInstallation,
  startGitHubLogin,
} from "./lib/auth.js";
import { clearPullwiseDataCache } from "./lib/pullwise-data.js";
import { LandingScreen, LoginScreen, OAuthScreen } from "./screens/public.jsx";

vi.mock("./api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getSession: vi.fn(),
    },
    repositories: {
      list: vi.fn(),
      branches: vi.fn(),
      sync: vi.fn(),
    },
    scans: {
      preflight: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      cancel: vi.fn(),
    },
    issues: {
      list: vi.fn(),
      get: vi.fn(),
    },
    docs: {
      getSubscriptionPlanConfigs: vi.fn(),
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

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearPullwiseDataCache();
    setLang("en");
    document.title = "";
    window.history.replaceState({}, "", "/");
    pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: false });
    pullwiseApi.repositories.list.mockResolvedValue({ items: [] });
    pullwiseApi.repositories.branches.mockResolvedValue({
      defaultBranch: "main",
      branches: ["main"],
    });
    pullwiseApi.repositories.sync.mockResolvedValue({ items: [] });
    pullwiseApi.scans.preflight.mockResolvedValue({
      requestedCount: 0,
      allowedCount: 99,
      userQuota: { scope: "user", used: 0, limit: 99, remaining: 99 },
      repositories: [],
    });
    pullwiseApi.scans.create.mockResolvedValue({
      id: "sc_created",
      repo: "GoPullwise/pullwise-web",
      branch: "main",
      commit: "pending",
      status: "queued",
      phase: "clone",
      progress: 0,
    });
    pullwiseApi.scans.get.mockResolvedValue({
      id: "sc_created",
      repo: "GoPullwise/pullwise-web",
      branch: "main",
      commit: "pending",
      status: "queued",
      phase: "clone",
      progress: 0,
    });
    pullwiseApi.scans.list.mockResolvedValue({ items: [] });
    pullwiseApi.issues.list.mockResolvedValue({ items: [] });
    pullwiseApi.issues.get.mockResolvedValue({
      id: "f_123",
      repo: "GoPullwise/pullwise-web",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.js",
      status: "open",
    });
    pullwiseApi.docs.getSubscriptionPlanConfigs.mockResolvedValue({
      plans: [
        {
          plan: "free",
          agentCli: "app-route-cli-free",
          model: "app-route-model-free",
          reasoningEffort: "app-route-effort-free",
        },
      ],
    });
  });

  afterEach(() => {
    setLang("en");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the normal entry", () => {
    render(<App />);

    expect(screen.getAllByText("Pullwise").length).toBeGreaterThan(0);
  });

  it("localizes the browser tab title when the language changes", async () => {
    document.title = "Pullwise - AI 代码 Review 助手";

    render(<App />);

    await waitFor(() => {
      expect(document.title).toBe("Pullwise - AI Review");
    });

    setLang("zh");

    await waitFor(() => {
      expect(document.title).toBe("Pullwise - AI审查");
    });
  });

  it("renders when browser storage is unavailable", () => {
    vi.stubGlobal("localStorage", blockedStorage());

    render(<App />);

    expect(screen.getAllByText("Pullwise").length).toBeGreaterThan(0);
  });

  it("restores persisted scan context from JSON on the scanning route", async () => {
    window.history.replaceState({}, "", "/scanning");
    localStorage.setItem(
      "pw-active-repo",
      JSON.stringify({
        scanId: "sc_restore",
        fullName: "GoPullwise/pullwise-web",
        name: "pullwise-web",
        defaultBranch: "main",
        commit: "abc123",
        initialScan: {
          id: "sc_restore",
          repo: "GoPullwise/pullwise-web",
          branch: "main",
          commit: "abc123",
          status: "running",
          phase: "clone",
          progress: 15,
        },
      })
    );
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.scans.get.mockResolvedValueOnce({
      id: "sc_restore",
      repo: "GoPullwise/pullwise-web",
      branch: "main",
      commit: "abc123",
      status: "done",
      phase: "report",
      progress: 100,
    });

    render(<App />);

    await waitFor(() => {
      expect(pullwiseApi.scans.get).toHaveBeenCalledWith("sc_restore");
    });
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
    expect(screen.getByText("GoPullwise/pullwise-web")).toBeInTheDocument();
  });

  it("loads a scan detail page directly from the scan id in the route", async () => {
    window.history.replaceState({}, "", "/scanning/sc_route");
    localStorage.removeItem("pw-active-repo");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.scans.get.mockResolvedValueOnce({
      id: "sc_route",
      repo: "GoPullwise/pullwise-server",
      branch: "main",
      commit: "def456",
      status: "done",
      phase: "report",
      progress: 100,
    });

    render(<App />);

    await waitFor(() => {
      expect(pullwiseApi.scans.get).toHaveBeenCalledWith("sc_route");
    });
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
    expect(screen.getByText("GoPullwise/pullwise-server")).toBeInTheDocument();
  });

  it("replaces a new scan route with the created scan id", async () => {
    window.history.replaceState({}, "", "/scanning");
    localStorage.setItem(
      "pw-active-repo",
      JSON.stringify({
        fullName: "GoPullwise/pullwise-web",
        name: "pullwise-web",
        defaultBranch: "main",
        commit: "pending",
      })
    );
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    const createdScan = {
      id: "sc_created_route",
      repo: "GoPullwise/pullwise-web",
      branch: "main",
      commit: "pending",
      status: "queued",
      phase: "clone",
      progress: 0,
    };
    pullwiseApi.scans.create.mockResolvedValueOnce(createdScan);
    pullwiseApi.scans.get.mockResolvedValue(createdScan);

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/scanning/sc_created_route");
    });
    expect(pullwiseApi.scans.create).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("pw-active-repo")).scanId).toBe("sc_created_route");
    });
  });

  it("clears invalid persisted scan context instead of passing it to the scanning route", async () => {
    window.history.replaceState({}, "", "/scanning");
    localStorage.setItem("pw-active-repo", "[object Object]");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });

    render(<App />);

    await waitFor(() => {
      expect(localStorage.getItem("pw-active-repo")).toBeNull();
    });
    expect(pullwiseApi.scans.get).not.toHaveBeenCalled();
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
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

  it("loads an issue detail page directly from the issue id in the route", async () => {
    window.history.replaceState({}, "", "/issues/f_123");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });

    render(<App />);

    await waitFor(() => {
      expect(pullwiseApi.issues.get).toHaveBeenCalledWith("f_123");
    });
    expect(screen.getByText("Validate redirect targets")).toBeInTheDocument();
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

    await waitFor(
      () => {
        expect(document.querySelector('[data-screen-label="login"]')).toBeInTheDocument();
      },
      { timeout: 3500 }
    );
  });

  it("does not expose the workers admin screen in the public web app", async () => {
    window.history.replaceState({}, "", "/workers");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="notfound"]')).toBeInTheDocument();
    });
    expect(screen.queryByText(/worker registry/i)).not.toBeInTheDocument();
  });

  it("renders the Docs route as a public screen", async () => {
    window.history.replaceState({}, "", "/developers/docs");
    pullwiseApi.auth.getSession.mockReturnValueOnce(new Promise(() => {}));

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="docs"]')).toBeInTheDocument();
    });
    expect(await screen.findByRole("heading", { name: /pullwise docs/i })).toBeInTheDocument();
    expect(await screen.findByText("app-route-cli-free")).toBeInTheDocument();
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

    await waitFor(
      () => {
        expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(2);
        expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
      },
      { timeout: 3500 }
    );
    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
  });

  it("keeps an authenticated private screen while confirming a transient signed-out recheck", async () => {
    window.history.replaceState({}, "", "/dashboard");
    const session = {
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    };
    pullwiseApi.auth.getSession
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ authenticated: false })
      .mockResolvedValueOnce(session);

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="dashboard"]')).toBeInTheDocument();
    });

    vi.useFakeTimers();
    fireEvent.focus(window);
    await flushPromises();

    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-screen-label="dashboard"]')).toBeInTheDocument();
    expect(document.querySelector('[data-screen-label="login"]')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await flushPromises();

    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(3);
    expect(document.querySelector('[data-screen-label="dashboard"]')).toBeInTheDocument();
    expect(document.querySelector('[data-screen-label="login"]')).not.toBeInTheDocument();
  });

  it("does not keep showing cached repositories after the session user changes", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession
      .mockResolvedValueOnce({
        authenticated: true,
        user: { name: "User A", email: "a@example.com" },
      })
      .mockResolvedValueOnce({
        authenticated: true,
        user: { name: "User B", email: "b@example.com" },
      });
    pullwiseApi.repositories.list
      .mockResolvedValueOnce({
        items: [{ id: "repo_a", fullName: "user-a/private-repo" }],
        needsAuthorization: false,
      })
      .mockReturnValueOnce(new Promise(() => {}));

    render(<App />);

    expect(await screen.findByText("user-a/private-repo")).toBeInTheDocument();

    fireEvent.focus(window);

    await waitFor(() => {
      expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(2);
      expect(pullwiseApi.repositories.list).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("user-a/private-repo")).not.toBeInTheDocument();
    });
  });

  it("sends an authenticated private screen to login after signed-out recheck is confirmed", async () => {
    window.history.replaceState({}, "", "/dashboard");
    pullwiseApi.auth.getSession
      .mockResolvedValueOnce({
        authenticated: true,
        user: { name: "Dev", email: "dev@example.com" },
      })
      .mockResolvedValueOnce({ authenticated: false })
      .mockResolvedValueOnce({ authenticated: false });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="dashboard"]')).toBeInTheDocument();
    });

    vi.useFakeTimers();
    fireEvent.focus(window);
    await flushPromises();

    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-screen-label="dashboard"]')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    await flushPromises();

    expect(document.querySelector('[data-screen-label="login"]')).toBeInTheDocument();
  });

  it("shows signed-in actions on the landing page", () => {
    render(<LandingScreen go={vi.fn()} accent="#6366f1" auth={{ authenticated: true }} />);

    expect(screen.getAllByRole("link", { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
  });

  it("shows the back-to-top button only after scrolling past the threshold", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0, writable: true });

    render(<App />);

    const findBackToTop = () => screen.getByRole("button", { name: /back to top/i });
    expect(findBackToTop()).not.toHaveClass("visible");
    expect(findBackToTop()).toHaveAttribute("tabindex", "-1");

    window.scrollY = 400;
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => {
      expect(findBackToTop()).toHaveClass("visible");
    });
    expect(findBackToTop()).toHaveAttribute("tabindex", "0");

    fireEvent.click(findBackToTop());
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));

    window.scrollY = 0;
    window.dispatchEvent(new Event("scroll"));
    await waitFor(() => {
      expect(findBackToTop()).not.toHaveClass("visible");
    });

    scrollTo.mockRestore();
  });

  it("localizes the back-to-top tooltip when the language changes", () => {
    setLang("en");
    render(<App />);

    expect(screen.getByRole("button", { name: /back to top/i })).toHaveAttribute(
      "title",
      "Back to top"
    );

    act(() => {
      setLang("zh");
    });

    expect(screen.getByRole("button", { name: /回到顶部/i })).toHaveAttribute("title", "回到顶部");
  });

  it("opens a language dropdown and changes language from a selected option", async () => {
    const user = userEvent.setup();
    render(<App />);

    const languageButton = screen.getByRole("button", { name: /select language/i });
    expect(languageButton).toHaveTextContent("EN");
    expect(languageButton).toHaveAttribute("aria-expanded", "false");
    expect(localStorage.getItem("pw-lang")).toBe("en");

    await user.click(languageButton);

    expect(languageButton).toHaveAttribute("aria-expanded", "true");
    expect(localStorage.getItem("pw-lang")).toBe("en");
    expect(screen.getByRole("menuitemradio", { name: /English/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("menuitemradio", { name: /中文/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /日本語/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /한국어/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /Français/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /Español/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: /日本語/i }));

    expect(localStorage.getItem("pw-lang")).toBe("ja");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /言語を選択/i })).toHaveTextContent("日");
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
      new Error("GitHub App installation must grant Contents: read access.")
    );
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Contents: write and Pull requests: write/i
    );
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
    const pullwiseMeta = screen
      .getByText("GoPullwise")
      .closest(".gh-install-row")
      .querySelector(".gh-install-meta");
    expect(within(pullwiseMeta).getByText("Organization")).toBeInTheDocument();
    expect(within(pullwiseMeta).getByText("selected")).toBeInTheDocument();
    expect(within(pullwiseMeta).getByText("1 repository")).toBeInTheDocument();
    expect(screen.getByText("GoTagma")).toBeInTheDocument();
    const tagmaMeta = screen
      .getByText("GoTagma")
      .closest(".gh-install-row")
      .querySelector(".gh-install-meta");
    expect(within(tagmaMeta).getByText("Organization")).toBeInTheDocument();
    expect(within(tagmaMeta).getByText("all repositories")).toBeInTheDocument();
    expect(within(tagmaMeta).getByText("4 repositories")).toBeInTheDocument();
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

  it("submits a repository batch directly to scan history", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    const repoAlpha = {
      id: "repo_alpha",
      name: "alpha",
      fullName: "octocat/alpha",
      desc: "Alpha service",
      defaultBranch: "main",
    };
    const repoBeta = {
      id: "repo_beta",
      name: "beta",
      fullName: "octocat/beta",
      desc: "Beta service",
      defaultBranch: "develop",
    };
    const scanAlpha = {
      id: "sc_alpha",
      repo: "octocat/alpha",
      branch: "main",
      commit: "pending",
      status: "queued",
      progress: 0,
    };
    const scanBeta = {
      id: "sc_beta",
      repo: "octocat/beta",
      branch: "develop",
      commit: "pending",
      status: "queued",
      progress: 0,
    };
    pullwiseApi.repositories.list.mockResolvedValue({
      items: [repoAlpha, repoBeta],
      needsAuthorization: false,
    });
    pullwiseApi.scans.preflight.mockResolvedValueOnce({
      requestedCount: 2,
      allowedCount: 2,
      userQuota: { scope: "user", used: 0, limit: 99, remaining: 99 },
      repositories: [],
    });
    pullwiseApi.scans.create.mockResolvedValueOnce(scanAlpha).mockResolvedValueOnce(scanBeta);
    pullwiseApi.scans.list.mockResolvedValue({ items: [scanAlpha, scanBeta] });
    const user = userEvent.setup();

    render(<App />);

    await user.click((await screen.findByText("octocat/alpha")).closest(".repo-row"));
    await user.click(screen.getByText("octocat/beta").closest(".repo-row"));
    await user.click(screen.getByRole("button", { name: /start scan/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/history");
    });
    expect(pullwiseApi.scans.create).toHaveBeenCalledTimes(2);
    expect(pullwiseApi.scans.get).not.toHaveBeenCalled();
    expect(screen.queryByText(/scan batch/i)).not.toBeInTheDocument();
    expect(await screen.findByText("octocat/alpha")).toBeInTheDocument();
    expect(screen.getByText("octocat/beta")).toBeInTheDocument();
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

  it("opens scan history issues with a scanId filter", async () => {
    window.history.replaceState({}, "", "/history");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    pullwiseApi.scans.list.mockResolvedValue({
      items: [
        {
          id: "sc_history_1",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "done",
          createdAt: 1710000000,
          time: "Today",
          by: "you",
          issues: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        },
      ],
    });
    pullwiseApi.issues.list.mockResolvedValue({
      items: [
        {
          id: "f_history",
          scanId: "sc_history_1",
          repo: "octocat/private-repo",
          title: "History-only issue",
          severity: "high",
          category: "Security",
          status: "open",
          file: "src/auth.js",
          line: 42,
        },
      ],
      total: 1,
    });
    const user = userEvent.setup();

    render(<App />);

    const historyRow = (await screen.findByText("octocat/private-repo")).closest(".scan-row");
    await user.click(within(historyRow).getByRole("button", { name: /^issues$/i }));

    await waitFor(() => {
      expect(pullwiseApi.issues.list).toHaveBeenCalledWith(
        expect.objectContaining({ scanId: "sc_history_1" })
      );
    });
    expect(await screen.findByText("History-only issue")).toBeInTheDocument();
    expect(screen.getByText(/scan sc_history_1/i)).toBeInTheDocument();

    const filteredCallCount = pullwiseApi.issues.list.mock.calls.length;
    await user.click(screen.getByRole("button", { name: /clear scan/i }));

    await waitFor(() => {
      expect(pullwiseApi.issues.list.mock.calls.length).toBeGreaterThan(filteredCallCount);
    });
    const latestIssueParams = pullwiseApi.issues.list.mock.calls.at(-1)?.[0] || {};
    expect(latestIssueParams.scanId).toBeUndefined();
  });

  it("opens scan history details on a URL with the scan id", async () => {
    window.history.replaceState({}, "", "/history");
    localStorage.removeItem("pw-active-repo");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    const scan = {
      id: "sc_history_1",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "abc123",
      status: "done",
      createdAt: 1710000000,
      time: "Today",
      by: "you",
      phase: "report",
      progress: 100,
      issues: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
    };
    pullwiseApi.scans.list.mockResolvedValue({ items: [scan] });
    pullwiseApi.scans.get.mockResolvedValueOnce(scan);
    const user = userEvent.setup();

    render(<App />);

    const historyRow = (await screen.findByText("octocat/private-repo")).closest(".scan-row");
    await user.click(within(historyRow).getByRole("button", { name: /^view$/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/scanning/sc_history_1");
      expect(pullwiseApi.scans.get).toHaveBeenCalledWith("sc_history_1");
    });
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
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
