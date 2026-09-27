import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "./api/pullwise.js";
import { App } from "./App.jsx";
import { productApi } from "./api/product.js";
import { overviewFixture, page } from "./test/product-fixtures.js";

vi.mock("./api/product.js");
import { NotificationProvider } from "./components/notifications.jsx";
import { setLang } from "./i18n.jsx";
import {
  connectGitHubRepositories,
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
      branches: vi.fn(),
      sync: vi.fn(),
    },
    scans: {
      preflight: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      status: vi.fn(),
      cancel: vi.fn(),
    },
    issues: {
      list: vi.fn(),
      get: vi.fn(),
      updateStatus: vi.fn(),
    },
    docs: {
      getSubscriptionPlanConfigs: vi.fn(),
      getServerConfig: vi.fn(),
    },
  },
}));

vi.mock("./lib/auth.js", () => ({
  startGitHubLogin: vi.fn(),
  connectGitHubRepositories: vi.fn(),
  manageGitHubInstallation: vi.fn(),
  signOut: vi.fn(),
}));

function render(ui, options) {
  return rtlRender(<NotificationProvider>{ui}</NotificationProvider>, options);
}

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
    productApi.overview.mockResolvedValue(overviewFixture);
    productApi.items.mockResolvedValue(page([]));
    productApi.repositories.mockResolvedValue(page([]));
    productApi.watches.mockResolvedValue(page([]));
    productApi.repositoryPage.mockResolvedValue(page([]));
    productApi.watchPage.mockResolvedValue(page([]));
    productApi.usage.mockResolvedValue({entitlements: {activeRepositoryLimit: 3,
      activeWatchLimit: 5}});
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
    pullwiseApi.scans.status.mockResolvedValue({ items: [] });
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
    pullwiseApi.issues.updateStatus.mockImplementation((issueId, payload) =>
      Promise.resolve({
        id: issueId,
        status: payload?.status || "open",
      })
    );
    pullwiseApi.docs.getSubscriptionPlanConfigs.mockResolvedValue({
      plans: [
        {
          plan: "free",
          agentConfig: {
            provider: "openai",
            model: "app-route-model-free",
            thinkingLevel: "low",
          },
        },
      ],
    });
    pullwiseApi.docs.getServerConfig.mockResolvedValue({ groups: [] });
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

  it("syncs the browser theme-color meta with the active theme", async () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#f8f7f6");
    document.head.appendChild(meta);
    localStorage.setItem("pw-theme", "dark");

    render(<App />);

    await waitFor(() => {
      expect(
        document.querySelector('meta[name="theme-color"]')?.getAttribute("content")
      ).toBe("#080808");
    });
    localStorage.removeItem("pw-theme");
    meta.remove();
  });

  it("restarts initial session recovery after StrictMode aborts the first request", async () => {
    let calls = 0;
    pullwiseApi.auth.getSession.mockImplementation(({ signal } = {}) => {
      calls += 1;
      if (calls > 1) return Promise.resolve({ authenticated: false });
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          { once: true }
        );
      });
    });

    render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    await waitFor(() => expect(calls).toBeGreaterThanOrEqual(3), { timeout: 4000 });
    await waitFor(() => {
      expect(screen.getAllByText("Sign in with GitHub").length).toBeGreaterThan(0);
    });
  });

  it("localizes the browser tab title when the language changes", async () => {
    document.title = "Pullwise - AI 代码 Review 助手";

    render(<App />);

    await waitFor(() => {
      expect(document.title).toBe("Pullwise — Pull Requests, CI, and Upstream Updates");
    });

    setLang("zh");

    await waitFor(() => {
      expect(document.title).toBe("Pullwise — 拉取请求、CI 与上游更新工作台");
    });
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

  it.each(["/scanning", "/scanning/scan-1", "/history", "/issues", "/issues/f_1"])(
    "does not expose the retired full-repository route %s",
    async (path) => {
      window.history.replaceState({}, "", path);
      pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: true,
        user: { name: "Dev", email: "dev@example.com" } });
      render(<App />);
      expect(await screen.findByText("This page took a wrong turn")).toBeInTheDocument();
      expect(pullwiseApi.scans.list).not.toHaveBeenCalled();
      expect(pullwiseApi.issues.list).not.toHaveBeenCalled();
    }
  );

  it("restores a valid session without leaving the landing page", async () => {
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="landing"]')).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/");
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
    expect(screen.queryByRole("button", { name: /skip|sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /skip|go to sign in|continue with github/i })
    ).not.toBeInTheDocument();
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
    expect(window.location.pathname).toBe("/login");
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

  it("renders Not Found for the removed Security page route", async () => {
    window.history.replaceState({}, "", "/security");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({ authenticated: false });

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="notfound"]')).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /security baseline/i })).not.toBeInTheDocument();
  });

  it("renders Not Found when browser history moves to an unknown private route", async () => {
    window.history.replaceState({}, "", "/dashboard");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });

    render(<App />);
    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="dashboard"]')).toBeInTheDocument();
    });

    act(() => {
      window.history.replaceState({}, "", "/workers");
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="notfound"]')).toBeInTheDocument();
    });
    expect(document.querySelector('[data-screen-label="landing"]')).not.toBeInTheDocument();
  });

  it("renders the Docs route as a public screen", async () => {
    window.history.replaceState({}, "", "/developers/docs");
    pullwiseApi.auth.getSession.mockReturnValueOnce(new Promise(() => {}));

    render(<App />);

    await waitFor(() => {
      expect(document.querySelector('[data-screen-label="docs"]')).toBeInTheDocument();
    });
    expect(await screen.findByRole("heading", { name: /configure PR, CI, and Updates/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pull request actions/i })).toBeInTheDocument();
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
    productApi.repositoryPage
      .mockResolvedValueOnce(page([{ id: "repo_a", fullName: "user-a/private-repo" }]))
      .mockReturnValueOnce(new Promise(() => {}));

    render(<App />);

    expect(await screen.findByText("user-a/private-repo")).toBeInTheDocument();

    fireEvent.focus(window);

    await waitFor(() => {
      expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(2);
      expect(productApi.repositoryPage).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("user-a/private-repo")).not.toBeInTheDocument();
    });
  });

  it("routes authenticated users to product repository and watch management", async () => {
    window.history.replaceState({}, "", "/services");
    pullwiseApi.auth.getSession.mockResolvedValue({authenticated: true,
      user: {name: "Dev", email: "dev@example.com"}});
    render(<App />);
    expect(await screen.findByRole("heading", {name: "Repositories and watches"})).toBeVisible();
    expect(productApi.repositoryPage).toHaveBeenCalled();
    expect(screen.queryByText("New scan")).toBeNull();
  });

  it("uses product management at the existing repositories URL", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValue({authenticated: true,
      user: {name: "Dev", email: "dev@example.com"}});
    render(<App />);
    expect(await screen.findByRole("heading", {name: "Repositories and watches"})).toBeVisible();
    expect(productApi.repositoryPage).toHaveBeenCalled();
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
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
    render(<LandingScreen go={vi.fn()} auth={{ authenticated: true }} />);

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
    const languageOptions = screen.getAllByRole("menuitemradio");
    expect(languageOptions).toHaveLength(6);
    expect(languageOptions[0].querySelector(".lang-menu-code")?.textContent).toBe("EN");
    expect(languageOptions[4].querySelector(".lang-menu-code")?.textContent).toBe("FR");
    expect(languageOptions[5].querySelector(".lang-menu-code")?.textContent).toBe("ES");
    const selectedShortLabel =
      languageOptions[2].querySelector(".lang-menu-code")?.textContent || "";

    await user.click(languageOptions[2]);

    expect(localStorage.getItem("pw-lang")).toBe("ja");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.querySelector(".lang-toggle")).toHaveTextContent(selectedShortLabel);
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

  it("explains missing GitHub App repository access for the new services", async () => {
    connectGitHubRepositories.mockRejectedValueOnce(
      new Error("GitHub App installation must grant Contents: read access.")
    );
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /repository access required to read PR, CI, and release facts/i
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

  it("shows a product GitHub connection prompt for an empty repository directory", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    productApi.repositoryPage.mockResolvedValue(page([]));

    render(<App />);

    expect(await screen.findByRole("button", { name: "Connect GitHub repositories" })).toBeVisible();
    expect(screen.queryByText("New scan")).toBeNull();
  });

  it("starts GitHub repository authorization from the repositories empty state", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    productApi.repositoryPage.mockResolvedValue(page([]));
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Connect GitHub repositories" }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
      expect(connectGitHubRepositories).toHaveBeenCalledWith({ add: true });
    });
  });

  it("opens GitHub access management from the product repository page", async () => {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValueOnce({
      authenticated: true,
      user: { name: "Dev", email: "dev@example.com" },
    });
    productApi.repositoryPage.mockResolvedValue(page([
      { id: "repo_1", fullName: "octocat/private-repo" },
    ]));
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Manage GitHub access" }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledWith({ manage: true });
    });
  });

  const managedProductRepo = {
    id: "repo_1", fullName: "GoPullwise/pullwise-server", private: true,
    service: {repositoryId: "repo_1", enabled: true, revision: 1,
      modules: {pr: true, ci: false}, analysisEnabled: {pr: false, ci: false},
      allowMemberSync: false, defaultAssigneeId: null, priorityOrder: 0},
  };

  async function openProductRepositories(items = [managedProductRepo]) {
    window.history.replaceState({}, "", "/repos");
    pullwiseApi.auth.getSession.mockResolvedValue({authenticated: true,
      user: {name: "Dev", email: "dev@example.com"}});
    productApi.repositoryPage.mockResolvedValue(page(items));
    render(<App />);
    await screen.findByRole("heading", {name: "Repositories and watches"});
  }

  it("shows authorized product service configuration on the repositories route", async () => {
    await openProductRepositories();
    expect(screen.getByRole("heading", {name: "GoPullwise/pullwise-server"})).toBeVisible();
    expect(screen.getByRole("button", {name: "Save service for GoPullwise/pullwise-server"})).toBeVisible();
    expect(screen.getByRole("button", {name: "Manage GitHub access"})).toBeVisible();
    expect(screen.queryByText("New scan")).toBeNull();
  });

  it("refreshes the product directory after GitHub access management", async () => {
    const second = {...managedProductRepo, id: "repo_2", fullName: "GoPullwise/pullwise-web"};
    await openProductRepositories();
    connectGitHubRepositories.mockImplementationOnce(async () => {
      productApi.repositoryPage.mockResolvedValue(page([managedProductRepo, second]));
    });
    fireEvent.click(screen.getByRole("button", {name: "Manage GitHub access"}));
    expect(await screen.findByRole("heading", {name: "GoPullwise/pullwise-web"})).toBeVisible();
    expect(connectGitHubRepositories).toHaveBeenCalledWith({manage: true});
  });

  it("saves one repository service revision without starting a scan", async () => {
    await openProductRepositories();
    productApi.saveRepositoryService.mockResolvedValue({...managedProductRepo.service, revision: 2});
    fireEvent.click(screen.getByRole("button", {name: "Save service for GoPullwise/pullwise-server"}));
    await waitFor(() => expect(productApi.saveRepositoryService).toHaveBeenCalledWith(
      "repo_1", 1, expect.objectContaining({modules: {pr: true, ci: false},
        analysisEnabled: {pr: false, ci: false}})));
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
  });

  it("creates a personal Updates watch through the shared product API", async () => {
    await openProductRepositories([]);
    productApi.createWatch.mockResolvedValue({id: "watch-new"});
    fireEvent.change(screen.getByLabelText("Upstream owner"), {target: {value: "acme"}});
    fireEvent.change(screen.getByLabelText("Repository name"), {target: {value: "sdk"}});
    const create = screen.getByRole("region", {name: "Create watch"});
    fireEvent.change(within(create).getByLabelText("Interests"), {target: {value: "OAuth"}});
    fireEvent.click(within(create).getByRole("button", {name: "Create watch"}));
    await waitFor(() => expect(productApi.createWatch).toHaveBeenCalledWith(
      expect.objectContaining({targetRepositoryId: null, interests: ["OAuth"],
        analysisEnabled: false}), expect.any(String)));
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
  });

  it("requires a reload after a stale service revision without replaying it", async () => {
    await openProductRepositories();
    productApi.saveRepositoryService.mockRejectedValue(Object.assign(
      new Error("Changed"), {status: 412}));
    fireEvent.click(screen.getByRole("button", {name: "Save service for GoPullwise/pullwise-server"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Configuration changed");
    expect(productApi.saveRepositoryService).toHaveBeenCalledTimes(1);
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

  it("reloads product repositories after automatic GitHub authorization completes", async () => {
    window.history.replaceState({}, "", "/repos?repoAuth=1");
    pullwiseApi.auth.getSession.mockResolvedValue({authenticated: true,
      user: {name: "Dev", email: "dev@example.com"}});
    productApi.repositoryPage.mockResolvedValueOnce(page([]))
      .mockResolvedValue(page([{id: "repo-new", fullName: "acme/new"}]));
    connectGitHubRepositories.mockResolvedValue();
    render(<App />);
    expect(await screen.findByRole("heading", {name: "acme/new"})).toBeVisible();
    expect(productApi.repositoryPage).toHaveBeenCalledTimes(2);
  });
});
