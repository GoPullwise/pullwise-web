import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "./api/pullwise.js";
import { T, setLang, useLang } from "./i18n.jsx";
import { I } from "./icons.jsx";
import { connectGitHubRepositories } from "./lib/auth.js";
import { localStorageGet, localStorageSet } from "./lib/browser-storage.js";
import { pathFromScreen, screenFromPath } from "./lib/navigation.js";
import { ApiDocsScreen, ApiKeysScreen } from "./screens/api.jsx";
import { BillingScreen, PricingScreen } from "./screens/billing.jsx";
import { DashboardScreen } from "./screens/dashboard.jsx";
import { NotFoundScreen } from "./screens/error.jsx";
import { ReposScreen, ScanningScreen } from "./screens/flow.jsx";
import {
  HistoryScreen,
  IssueDetailScreen,
  IssuesScreen,
  SettingsScreen,
} from "./screens/issues.jsx";
import { PrivacyScreen, SecurityScreen, StatusScreen, TermsScreen } from "./screens/legal.jsx";
import { LandingScreen, LoginScreen, OAuthScreen } from "./screens/public.jsx";

const ACCENT = "#6366f1";
const LAYOUT = "list";
const INITIAL_SESSION_RETRY_DELAY_MS = 2000;
const PUBLIC_SCREENS = new Set([
  "landing",
  "login",
  "pricing",
  "api",
  "privacy",
  "terms",
  "security",
  "status",
  "notfound",
]);

function getInitialScreen() {
  const screen = screenFromPath(window.location.pathname);
  return screen || "notfound";
}

function getRequestedScreenParam() {
  return window.location.pathname || "/";
}

function repositoryAuthorizationRequested() {
  return new URLSearchParams(window.location.search).get("repoAuth") === "1";
}

function clearRepositoryAuthorizationRequest() {
  const url = new URL(window.location.href);
  url.searchParams.delete("repoAuth");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function shouldShowSessionCheck(screen) {
  return screen === "login" || !PUBLIC_SCREENS.has(screen);
}

function PrototypeNav({ go, current }) {
  const screens = [
    { k: "landing", t: "Landing" },
    { k: "login", t: "登录" },
    { k: "oauth", t: "GitHub 授权" },
    { k: "repos", t: "选仓库" },
    { k: "scanning", t: "扫描中" },
    { k: "dashboard", t: "Dashboard" },
    { k: "issues", t: "Issues" },
    { k: "issue", t: "详情" },
    { k: "history", t: "历史" },
    { k: "apiKeys", t: "API Keys" },
    { k: "settings", t: "设置" },
    { k: "billing", t: "Billing" },
    { k: "pricing", t: "Pricing" },
    { k: "api", t: "API" },
    { k: "privacy", t: "隐私" },
    { k: "terms", t: "条款" },
    { k: "security", t: "安全" },
    { k: "status", t: "状态" },
    { k: "notfound", t: "404" },
  ];

  return (
    <div className="proto-nav">
      <div className="proto-nav-l">
        <span className="proto-nav-brand">PR · Prototype</span>
      </div>
      <div className="proto-nav-screens">
        {screens.map((s, i) => (
          <button
            key={s.k}
            className={"proto-nav-i" + (current === s.k ? " on" : "")}
            onClick={() => go(s.k)}
          >
            <span className="proto-nav-n">{String(i + 1).padStart(2, "0")}</span>
            {s.t}
          </button>
        ))}
      </div>
      <div className="proto-nav-hint">点击跳转任意原型页面</div>
    </div>
  );
}

export function App({ prototypeNav = false }) {
  const lang = useLang();
  const [theme, setTheme] = useState(() => localStorageGet("pw-theme", "light"));
  const [screen, setScreen] = useState(getInitialScreen);
  const [auth, setAuth] = useState({ status: "checking", authenticated: false, session: null });
  const [issue, setIssue] = useState(null);
  const [activeRepo, setActiveRepo] = useState(
    () => localStorageGet("pw-active-repo", null)
  );
  const [navOpen, setNavOpen] = useState(true);
  const [repositoryAuthorizationError, setRepositoryAuthorizationError] = useState("");
  const continuedRepositoryAuthorization = useRef(false);

  const go = (nextScreen) => {
    const path = pathFromScreen(nextScreen);
    if (window.location.pathname !== path) {
      window.history.pushState({ screen: nextScreen }, "", path);
    }
    setScreen(nextScreen);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPopState = () => {
      const screen = screenFromPath(window.location.pathname) || "landing";
      setScreen(screen);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openScan = (scan) => {
    setActiveRepo({
      scanId: scan.id,
      fullName: scan.repo,
      name: scan.repo,
      defaultBranch: scan.branch || "main",
      commit: scan.commit || "pending",
      initialScan: scan,
    });
    go("scanning");
  };

  useEffect(() => {
    document.body.classList.toggle("has-proto-nav", prototypeNav && navOpen);
  }, [prototypeNav, navOpen]);

  useEffect(() => {
    document.title = T("Pullwise - AI Review", "Pullwise - AI审查");
  }, [lang]);

  useEffect(() => {
    if (auth.status !== "ready") return;
    if (auth.authenticated) return;
    if (PUBLIC_SCREENS.has(screen)) return;
    setScreen("login");
  }, [screen, auth.status, auth.authenticated]);

  // Session check: runs on mount, retries on failure, re-checks on focus/visibility return.
  // This is the standard pattern used by NextAuth, Supabase, and Firebase Auth for SPA session
  // recovery — a single check on mount is not enough because the user may navigate away (e.g. to
  // an OAuth provider) and return with a new session cookie that the app must detect.
  const sessionAbortRef = useRef(null);
  const sessionCheckingRef = useRef(false);

  const checkSession = useCallback(
    async ({ isRetry = false, deferUnauthenticated = false } = {}) => {
      if (sessionCheckingRef.current) return { skipped: true };
      sessionCheckingRef.current = true;

      if (sessionAbortRef.current) sessionAbortRef.current.abort();
      const controller = new AbortController();
      sessionAbortRef.current = controller;

      if (!isRetry) {
        setAuth((prev) => ({ ...prev, status: "checking" }));
      }

      try {
        const payload = await pullwiseApi.auth.getSession({ signal: controller.signal });
        if (controller.signal.aborted) return { aborted: true };
        const authenticated = Boolean(payload?.authenticated);
        if (!authenticated && deferUnauthenticated) {
          return { authenticated, payload: payload || null };
        }
        setAuth({ status: "ready", authenticated, session: payload || null });
        setScreen((current) => {
          if (authenticated && current === "login") {
            return "landing";
          }
          if (!authenticated && !PUBLIC_SCREENS.has(current)) {
            return "login";
          }
          return current;
        });
        return { authenticated, payload: payload || null };
      } catch (error) {
        if (controller.signal.aborted) return { aborted: true };
        if (deferUnauthenticated) {
          return { authenticated: false, error };
        }
        setAuth({ status: "ready", authenticated: false, session: null });
        setScreen((current) => (PUBLIC_SCREENS.has(current) ? current : "login"));
        return { authenticated: false, error };
      } finally {
        sessionCheckingRef.current = false;
      }
    },
    []
  );

  // Initial session check on mount, with a single retry on failure.
  // Many transient issues (server cold start, brief network hiccup) resolve within seconds.
  useEffect(() => {
    let disposed = false;
    checkSession({ deferUnauthenticated: true }).then((result) => {
      if (disposed) return;
      if (result?.authenticated || result?.aborted || result?.skipped) return;
      // Keep login actions disabled until a second check confirms that the browser is actually
      // signed out. This avoids a transient signed-out UI during cold starts or weak networks.
      setTimeout(() => {
        if (!disposed) checkSession({ isRetry: true });
      }, INITIAL_SESSION_RETRY_DELAY_MS);
    });
    return () => {
      disposed = true;
      if (sessionAbortRef.current) sessionAbortRef.current.abort();
    };
  }, [checkSession]);

  // Re-check session when the app becomes visible or regains focus.
  // This catches the case where the user navigated away (e.g. to GitHub OAuth), completed an
  // action that set a session cookie, and returned to this tab. Without this re-check, the app
  // would show stale "not logged in" state even though the cookie is now valid.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "hidden") return;
      checkSession({ isRetry: true });
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [checkSession]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--accent", ACCENT);
    localStorageSet("pw-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (activeRepo) {
      localStorageSet("pw-active-repo", activeRepo);
    } else {
      localStorageSet("pw-active-repo", null);
    }
  }, [activeRepo]);

  useEffect(() => {
    if (auth.status !== "ready" || !auth.authenticated || screen !== "repos") return;
    if (continuedRepositoryAuthorization.current || !repositoryAuthorizationRequested()) return;
    continuedRepositoryAuthorization.current = true;
    clearRepositoryAuthorizationRequest();
    connectGitHubRepositories().catch((error) => {
      setRepositoryAuthorizationError(
        error?.message || "Unable to connect GitHub repository access."
      );
    });
  }, [auth.status, auth.authenticated, screen]);

  let body;
  if (auth.status === "checking" && shouldShowSessionCheck(screen)) {
    body = (
      <div className="auth-wrap fade-in">
        <div className="auth-card">
          <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
            <img className="brand-mark" src="/favicon.ico" alt="" aria-hidden="true" width="24" height="24" />
            <span style={{ fontSize: 16 }}>Pullwise</span>
          </div>
          <h2 className="auth-title">{T("Checking session", "正在检查会话")}</h2>
          <p className="auth-sub">
            {T(
              "Restoring your account if this browser is still signed in.",
              "如果此浏览器仍保持登录，将恢复账户。"
            )}
          </p>
          <button
            className="btn sm ghost"
            type="button"
            style={{ marginTop: 16 }}
            onClick={() => {
              if (sessionAbortRef.current) sessionAbortRef.current.abort();
              setAuth({ status: "ready", authenticated: false, session: null });
              setScreen("login");
            }}
          >
            {T("Skip — go to sign in", "跳过 — 前往登录")}
          </button>
        </div>
      </div>
    );
  } else
    switch (screen) {
      case "landing":
        body = <LandingScreen go={go} accent={ACCENT} auth={auth} />;
        break;
      case "login":
        body = <LoginScreen go={go} />;
        break;
      case "oauth":
        body = <OAuthScreen go={go} auth={auth} />;
        break;
      case "repos":
        body = (
          <ReposScreen
            go={go}
            setIssue={setIssue}
            setActiveRepo={setActiveRepo}
            authorizationError={repositoryAuthorizationError}
            clearAuthorizationError={() => setRepositoryAuthorizationError("")}
          />
        );
        break;
      case "scanning":
        body = <ScanningScreen go={go} activeRepo={activeRepo} setIssue={setIssue} />;
        break;
      case "dashboard":
        body = <DashboardScreen go={go} layout={LAYOUT} setIssue={setIssue} accent={ACCENT} />;
        break;
      case "issues":
        body = <IssuesScreen go={go} setIssue={setIssue} />;
        break;
      case "issue":
        body = <IssueDetailScreen go={go} issue={issue} setIssue={setIssue} />;
        break;
      case "history":
        body = <HistoryScreen go={go} openScan={openScan} setIssue={setIssue} />;
        break;
      case "apiKeys":
        body = <ApiKeysScreen go={go} setIssue={setIssue} />;
        break;
      case "settings":
        body = <SettingsScreen go={go} setIssue={setIssue} />;
        break;
      case "billing":
        body = <BillingScreen go={go} setIssue={setIssue} />;
        break;
      case "pricing":
        body = <PricingScreen go={go} auth={auth} />;
        break;
      case "api":
        body = <ApiDocsScreen go={go} auth={auth} />;
        break;
      case "privacy":
        body = <PrivacyScreen go={go} auth={auth} />;
        break;
      case "terms":
        body = <TermsScreen go={go} auth={auth} />;
        break;
      case "security":
        body = <SecurityScreen go={go} auth={auth} />;
        break;
      case "status":
        body = <StatusScreen go={go} auth={auth} />;
        break;
      case "notfound":
        body = <NotFoundScreen go={go} requested={getRequestedScreenParam()} auth={auth} />;
        break;
      default:
        body = <NotFoundScreen go={go} requested={getRequestedScreenParam()} auth={auth} />;
    }

  return (
    <>
      {prototypeNav && (
        <>
          <button className="proto-nav-toggle" onClick={() => setNavOpen((open) => !open)}>
            {navOpen ? "▲" : "●"}
          </button>
          {navOpen && <PrototypeNav go={go} current={screen} />}
        </>
      )}

      <div data-screen-label={screen} key={screen}>
        {body}
      </div>

      <button
        className="lang-toggle"
        onClick={() => setLang(lang === "en" ? "zh" : "en")}
        title={lang === "en" ? "切换到中文" : "Switch to English"}
        aria-label="Switch language"
      >
        {lang === "en" ? "中" : "EN"}
      </button>
      <button
        className="theme-toggle"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        title={
          theme === "light" ? T("Switch to dark", "切换到暗色") : T("Switch to light", "切换到亮色")
        }
        aria-label={T("Toggle theme", "切换主题")}
      >
        {theme === "light" ? <I.Moon size={16} /> : <I.Sun size={16} />}
      </button>
    </>
  );
}
