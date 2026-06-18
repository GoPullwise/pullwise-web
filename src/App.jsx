import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "./api/pullwise.js";
import { LANGUAGES, T, setLang, useLang } from "./i18n.jsx";
import { I } from "./icons.jsx";
import { connectGitHubRepositories } from "./lib/auth.js";
import { localStorageGet, localStorageSet } from "./lib/browser-storage.js";
import {
  issueIdFromPath,
  pathFromScreen,
  scanIdFromPath,
  screenFromPath,
} from "./lib/navigation.js";
import { clearPullwiseDataCache } from "./lib/pullwise-data.js";
import { NotFoundScreen } from "./screens/error.jsx";
import { ReposScreen, ScanningScreen } from "./screens/flow.jsx";
import { LandingScreen, LoginScreen, OAuthScreen } from "./screens/public.jsx";

const ACCENT = "#6366f1";
const LAYOUT = "list";
const INITIAL_SESSION_RETRY_DELAY_MS = 2000;
const SESSION_SIGNED_OUT_CONFIRM_DELAY_MS = 2000;
const ACTIVE_REPO_STORAGE_KEY = "pw-active-repo";
const BACK_TO_TOP_THRESHOLD_PX = 240;
function lazyScreen(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const ApiKeysScreen = lazyScreen(() => import("./screens/api.jsx"), "ApiKeysScreen");
const ApiDocsScreen = lazyScreen(() => import("./screens/api-docs.jsx"), "ApiDocsScreen");
const BillingScreen = lazyScreen(() => import("./screens/billing.jsx"), "BillingScreen");
const PricingScreen = lazyScreen(() => import("./screens/billing.jsx"), "PricingScreen");
const DashboardScreen = lazyScreen(() => import("./screens/dashboard.jsx"), "DashboardScreen");
const DocsScreen = lazyScreen(() => import("./screens/docs.jsx"), "DocsScreen");
const HistoryScreen = lazyScreen(() => import("./screens/issues.jsx"), "HistoryScreen");
const IssueDetailScreen = lazyScreen(() => import("./screens/issues.jsx"), "IssueDetailScreen");
const IssuesScreen = lazyScreen(() => import("./screens/issues.jsx"), "IssuesScreen");
const SettingsScreen = lazyScreen(() => import("./screens/issues.jsx"), "SettingsScreen");
const PrivacyScreen = lazyScreen(() => import("./screens/legal.jsx"), "PrivacyScreen");
const SecurityScreen = lazyScreen(() => import("./screens/legal.jsx"), "SecurityScreen");
const StatusScreen = lazyScreen(() => import("./screens/legal.jsx"), "StatusScreen");
const TermsScreen = lazyScreen(() => import("./screens/legal.jsx"), "TermsScreen");

function ScreenFallback() {
  return (
    <div className="auth-wrap fade-in" role="status" aria-label={T("Loading...", "正在加载...")}>
      {T("Loading...", "正在加载...")}
    </div>
  );
}

const PUBLIC_SCREENS = new Set([
  "landing",
  "login",
  "pricing",
  "docs",
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

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sessionFingerprint(session) {
  try {
    return JSON.stringify(session ?? {});
  } catch {
    return "unknown";
  }
}

function sessionIdentity(authenticated, session) {
  if (!authenticated) return "signed-out";
  const user = isObject(session?.user) ? session.user : {};
  const profile = isObject(session?.profile) ? session.profile : {};
  const identity =
    session?.userId ||
    session?.id ||
    user.id ||
    user.userId ||
    user.email ||
    user.login ||
    user.username ||
    user.githubLogin ||
    profile.id ||
    profile.userId ||
    profile.email ||
    profile.login ||
    profile.username ||
    profile.githubLogin;
  return identity ? `user:${String(identity)}` : `session:${sessionFingerprint(session)}`;
}

function isUsableActiveRepo(value) {
  if (!isObject(value)) return false;
  if (Array.isArray(value.selectedRepos)) return value.selectedRepos.length > 0;
  return Boolean(value.scanId || value.repoId || value.fullName || value.name || value.repo);
}

function storedActiveRepo() {
  const raw = localStorageGet(ACTIVE_REPO_STORAGE_KEY, null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isUsableActiveRepo(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function activeRepoForScanRoute(activeRepo, routeScanId) {
  if (!routeScanId) return activeRepo;
  if (Array.isArray(activeRepo?.selectedRepos)) {
    const selectedRepo = activeRepo.selectedRepos.length === 1 ? activeRepo.selectedRepos[0] : null;
    if (selectedRepo?.scanId === routeScanId || selectedRepo?.initialScan?.id === routeScanId) {
      return activeRepo;
    }
    return { scanId: routeScanId };
  }
  if (activeRepo?.scanId === routeScanId) return activeRepo;
  if (activeRepo?.initialScan?.id === routeScanId) return { ...activeRepo, scanId: routeScanId };
  return { scanId: routeScanId };
}

function activeRepoWithResolvedScan(activeRepo, scan) {
  if (!scan?.id) return activeRepo;
  const scanContext = {
    scanId: scan.id,
    fullName: scan.repo,
    name: scan.repo,
    defaultBranch: scan.branch || "main",
    commit: scan.commit || "pending",
    initialScan: scan,
  };
  if (Array.isArray(activeRepo?.selectedRepos)) {
    if (activeRepo.selectedRepos.length !== 1) return activeRepo;
    return {
      ...activeRepo,
      selectedRepos: [{ ...activeRepo.selectedRepos[0], ...scanContext }],
    };
  }
  return { ...activeRepo, ...scanContext };
}

function cleanPendingScanIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = [];
  const seen = new Set();
  for (const item of value) {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function pendingScanIdsFromHistoryState(state) {
  return isObject(state) ? cleanPendingScanIds(state.pendingScanIds) : [];
}

function PrototypeNav({ go, current }) {
  const screens = [
    { k: "landing", t: T("Landing", "首页") },
    { k: "login", t: T("Sign in", "登录") },
    { k: "oauth", t: T("GitHub OAuth", "GitHub 授权") },
    { k: "repos", t: T("Repositories", "选仓库") },
    { k: "scanning", t: T("Scanning…", "扫描中") },
    { k: "dashboard", t: T("Dashboard", "工作台") },
    { k: "issues", t: T("Issues", "问题") },
    { k: "issue", t: T("Issue", "详情") },
    { k: "history", t: T("Scan history", "历史") },
    { k: "apiKeys", t: T("API Keys", "API Keys") },
    { k: "settings", t: T("Settings", "设置") },
    { k: "billing", t: T("Billing", "账单") },
    { k: "pricing", t: T("Pricing", "价格") },
    { k: "docs", t: T("Docs", "Docs") },
    { k: "api", t: T("API docs", "API 文档") },
    { k: "privacy", t: T("Privacy Policy", "隐私") },
    { k: "terms", t: T("Terms of Service", "条款") },
    { k: "security", t: T("Security", "安全") },
    { k: "status", t: T("Status", "状态") },
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
      <div className="proto-nav-hint">
        {T("Click any prototype page to jump", "点击跳转任意原型页面")}
      </div>
    </div>
  );
}

export function App({ prototypeNav = false }) {
  const lang = useLang();
  const [theme, setTheme] = useState(() => localStorageGet("pw-theme", "light"));
  const [screen, setScreen] = useState(getInitialScreen);
  const [auth, setAuth] = useState({ status: "checking", authenticated: false, session: null });
  const [issue, setIssue] = useState(null);
  const [routeIssueId, setRouteIssueId] = useState(() => issueIdFromPath(window.location.pathname));
  const [routeScanId, setRouteScanId] = useState(() => scanIdFromPath(window.location.pathname));
  const [issueScanFilter, setIssueScanFilter] = useState(null);
  const [activeRepo, setActiveRepo] = useState(storedActiveRepo);
  const [pendingHistoryScanIds, setPendingHistoryScanIds] = useState(() =>
    pendingScanIdsFromHistoryState(window.history.state)
  );
  const [navOpen, setNavOpen] = useState(true);
  const [repositoryAuthorizationError, setRepositoryAuthorizationError] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const continuedRepositoryAuthorization = useRef(false);
  const languageMenuRef = useRef(null);

  const go = (nextScreen, params = {}) => {
    const path = pathFromScreen(nextScreen, params);
    const nextIssueId = nextScreen === "issue" ? issueIdFromPath(path) : "";
    const nextScanId = nextScreen === "scanning" ? scanIdFromPath(path) : "";
    const nextPendingHistoryScanIds =
      nextScreen === "history" ? cleanPendingScanIds(params.pendingScanIds) : [];
    const historyState = { screen: nextScreen, issueId: nextIssueId, scanId: nextScanId };
    if (nextPendingHistoryScanIds.length) {
      historyState.pendingScanIds = nextPendingHistoryScanIds;
    }
    if (window.location.pathname !== path) {
      window.history.pushState(historyState, "", path);
    } else {
      window.history.replaceState(historyState, "", path);
    }
    setRouteIssueId(nextIssueId);
    setRouteScanId(nextScanId);
    setPendingHistoryScanIds(nextPendingHistoryScanIds);
    setScreen(nextScreen);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPopState = (event) => {
      const nextScreen = screenFromPath(window.location.pathname) || "landing";
      setRouteIssueId(nextScreen === "issue" ? issueIdFromPath(window.location.pathname) : "");
      setRouteScanId(nextScreen === "scanning" ? scanIdFromPath(window.location.pathname) : "");
      setPendingHistoryScanIds(
        nextScreen === "history" ? pendingScanIdsFromHistoryState(event.state) : []
      );
      setScreen(nextScreen);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openScan = (scan) => {
    const scanId = scan?.id || "";
    setActiveRepo({
      scanId,
      fullName: scan?.repo,
      name: scan?.repo,
      defaultBranch: scan?.branch || "main",
      commit: scan?.commit || "pending",
      initialScan: scan,
    });
    go("scanning", scanId ? { scanId } : {});
  };

  const openScanIssues = (scan) => {
    if (!scan?.id) return;
    setIssueScanFilter({
      id: scan.id,
      repo: scan.repo,
      branch: scan.branch || "main",
      commit: scan.commit || "pending",
      time: scan.time || "",
    });
    go("issues");
  };

  const handleScanResolved = useCallback(
    (scan) => {
      if (!scan?.id || screen !== "scanning") return;
      setActiveRepo((current) => activeRepoWithResolvedScan(current, scan));
      const path = pathFromScreen("scanning", { scanId: scan.id });
      if (window.location.pathname !== path) {
        window.history.replaceState({ screen: "scanning", issueId: "", scanId: scan.id }, "", path);
      }
      setRouteIssueId("");
      setRouteScanId(scan.id);
    },
    [screen]
  );

  useEffect(() => {
    document.body.classList.toggle("has-proto-nav", prototypeNav && navOpen);
  }, [prototypeNav, navOpen]);

  useEffect(() => {
    document.title = T("Pullwise - AI Review", "Pullwise - AI审查");
  }, [lang]);

  useEffect(() => {
    if (!languageMenuOpen) return;
    const closeLanguageMenu = (event) => {
      if (languageMenuRef.current?.contains(event.target)) return;
      setLanguageMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setLanguageMenuOpen(false);
    };
    document.addEventListener("mousedown", closeLanguageMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeLanguageMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageMenuOpen]);

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
  const sessionConfirmTimeoutRef = useRef(null);
  const authRef = useRef(auth);
  const authIdentityRef = useRef(null);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  const setAuthState = useCallback((nextAuth) => {
    const resolvedAuth = typeof nextAuth === "function" ? nextAuth(authRef.current) : nextAuth;
    const nextIdentity = sessionIdentity(resolvedAuth.authenticated, resolvedAuth.session);
    if (authIdentityRef.current !== nextIdentity) {
      clearPullwiseDataCache();
      if (authIdentityRef.current !== null) {
        setIssue(null);
        setIssueScanFilter(null);
        setPendingHistoryScanIds([]);
      }
      authIdentityRef.current = nextIdentity;
    }
    authRef.current = resolvedAuth;
    setAuth(resolvedAuth);
  }, []);

  const clearSessionConfirmTimer = useCallback(() => {
    if (!sessionConfirmTimeoutRef.current) return;
    clearTimeout(sessionConfirmTimeoutRef.current);
    sessionConfirmTimeoutRef.current = null;
  }, []);

  const checkSession = useCallback(
    async ({
      isRetry = false,
      deferUnauthenticated = false,
      confirmUnauthenticated = false,
      preserveAuthenticatedOnError = false,
    } = {}) => {
      if (sessionCheckingRef.current) return { skipped: true };
      sessionCheckingRef.current = true;

      if (sessionAbortRef.current) sessionAbortRef.current.abort();
      const controller = new AbortController();
      sessionAbortRef.current = controller;

      if (!isRetry) {
        setAuthState((prev) => ({ ...prev, status: "checking" }));
      }

      try {
        const payload = await pullwiseApi.auth.getSession({ signal: controller.signal });
        if (controller.signal.aborted) return { aborted: true };
        const authenticated = Boolean(payload?.authenticated);
        const wasAuthenticated = Boolean(authRef.current?.authenticated);
        if (
          !authenticated &&
          (deferUnauthenticated || (confirmUnauthenticated && wasAuthenticated))
        ) {
          return { authenticated, payload: payload || null, needsConfirmation: true };
        }
        clearSessionConfirmTimer();
        setAuthState({ status: "ready", authenticated, session: payload || null });
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
        const wasAuthenticated = Boolean(authRef.current?.authenticated);
        if (preserveAuthenticatedOnError && wasAuthenticated) {
          setAuthState((previous) => ({ ...previous, status: "ready" }));
          return { authenticated: true, error, preserved: true };
        }
        if (deferUnauthenticated || (confirmUnauthenticated && wasAuthenticated)) {
          return { authenticated: false, error, needsConfirmation: true };
        }
        clearSessionConfirmTimer();
        setAuthState({ status: "ready", authenticated: false, session: null });
        setScreen((current) => (PUBLIC_SCREENS.has(current) ? current : "login"));
        return { authenticated: false, error };
      } finally {
        sessionCheckingRef.current = false;
      }
    },
    [clearSessionConfirmTimer, setAuthState]
  );

  const scheduleSignedOutConfirmation = useCallback(() => {
    clearSessionConfirmTimer();
    sessionConfirmTimeoutRef.current = setTimeout(() => {
      sessionConfirmTimeoutRef.current = null;
      checkSession({ isRetry: true, preserveAuthenticatedOnError: true });
    }, SESSION_SIGNED_OUT_CONFIRM_DELAY_MS);
  }, [checkSession, clearSessionConfirmTimer]);

  // Initial session check on mount, with a single retry on failure.
  // Many transient issues (server cold start, brief network hiccup) resolve within seconds.
  useEffect(() => {
    let disposed = false;
    checkSession({ deferUnauthenticated: true, preserveAuthenticatedOnError: true }).then((result) => {
      if (disposed) return;
      if (result?.authenticated || result?.aborted || result?.skipped) return;
      // Keep login actions disabled until a second check confirms that the browser is actually
      // signed out. This avoids a transient signed-out UI during cold starts or weak networks.
      setTimeout(() => {
        if (!disposed) checkSession({ isRetry: true, preserveAuthenticatedOnError: true });
      }, INITIAL_SESSION_RETRY_DELAY_MS);
    });
    return () => {
      disposed = true;
      if (sessionAbortRef.current) sessionAbortRef.current.abort();
      clearSessionConfirmTimer();
    };
  }, [checkSession, clearSessionConfirmTimer]);

  // Re-check session when the app becomes visible or regains focus.
  // This catches the case where the user navigated away (e.g. to GitHub OAuth), completed an
  // action that set a session cookie, and returned to this tab. Without this re-check, the app
  // would show stale "not logged in" state even though the cookie is now valid.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "hidden") return;
      checkSession({
        isRetry: true,
        confirmUnauthenticated: true,
        preserveAuthenticatedOnError: true,
      }).then((result) => {
        if (result?.needsConfirmation) scheduleSignedOutConfirmation();
      });
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [checkSession, scheduleSignedOutConfirmation]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--accent", ACCENT);
    localStorageSet("pw-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (activeRepo) {
      localStorageSet(ACTIVE_REPO_STORAGE_KEY, JSON.stringify(activeRepo));
    } else {
      localStorageSet(ACTIVE_REPO_STORAGE_KEY, null);
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

  // Show the back-to-top button once the user has scrolled past the threshold,
  // and hide it again when they return to the top. This lets long list pages
  // (dashboard, repositories, issues, scan history) recover from deep scroll.
  useEffect(() => {
    const updateBackToTop = () => {
      setShowBackToTop(window.scrollY > BACK_TO_TOP_THRESHOLD_PX);
    };
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTop);
  }, []);

  const scrollToTop = useCallback(() => {
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, []);

  const clearPendingHistoryScanIds = useCallback(() => {
    setPendingHistoryScanIds([]);
    if (screen !== "history") return;
    const currentState = isObject(window.history.state) ? { ...window.history.state } : {};
    delete currentState.pendingScanIds;
    window.history.replaceState(currentState, "", window.location.pathname);
  }, [screen]);

  const scanningActiveRepo = activeRepoForScanRoute(activeRepo, routeScanId);

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
        body = (
          <ScanningScreen
            go={go}
            activeRepo={scanningActiveRepo}
            setIssue={setIssue}
            onScanResolved={handleScanResolved}
          />
        );
        break;
      case "dashboard":
        body = <DashboardScreen go={go} layout={LAYOUT} setIssue={setIssue} accent={ACCENT} />;
        break;
      case "issues":
        body = (
          <IssuesScreen
            go={go}
            setIssue={setIssue}
            scanFilter={issueScanFilter}
            onClearScanFilter={() => setIssueScanFilter(null)}
          />
        );
        break;
      case "issue":
        body = (
          <IssueDetailScreen
            go={go}
            issue={issue}
            issueId={routeIssueId}
            setIssue={setIssue}
          />
        );
        break;
      case "history":
        body = (
          <HistoryScreen
            go={go}
            openScan={openScan}
            openScanIssues={openScanIssues}
            setIssue={setIssue}
            expectedScanIds={pendingHistoryScanIds}
            onExpectedScansLoaded={clearPendingHistoryScanIds}
          />
        );
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
      case "docs":
        body = <DocsScreen go={go} auth={auth} />;
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

      <div
        data-screen-label={screen}
        key={
          PUBLIC_SCREENS.has(screen)
            ? screen
            : `${screen}:${sessionIdentity(auth.authenticated, auth.session)}`
        }
      >
        <Suspense fallback={<ScreenFallback />}>{body}</Suspense>
      </div>

      <button
        type="button"
        className={"back-to-top" + (showBackToTop ? " visible" : "")}
        onClick={scrollToTop}
        title={T("Back to top", "回到顶部")}
        aria-label={T("Back to top", "回到顶部")}
        tabIndex={showBackToTop ? 0 : -1}
      >
        <I.ArrowUp size={16} />
      </button>
      <div className="lang-picker" ref={languageMenuRef}>
        {languageMenuOpen && (
          <div className="lang-menu" role="menu" aria-label={T("Select language", "选择语言")}>
            {LANGUAGES.map((language) => (
              <button
                key={language.code}
                type="button"
                className={"lang-menu-i" + (lang === language.code ? " active" : "")}
                role="menuitemradio"
                aria-checked={lang === language.code}
                onClick={() => {
                  setLang(language.code);
                  setLanguageMenuOpen(false);
                }}
              >
                <span className="lang-menu-code">{language.shortLabel}</span>
                <span>{language.nativeLabel}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={"lang-toggle" + (languageMenuOpen ? " active" : "")}
          onClick={() => setLanguageMenuOpen((open) => !open)}
          title={T("Select language", "选择语言")}
          aria-label={T("Select language", "选择语言")}
          aria-haspopup="menu"
          aria-expanded={languageMenuOpen}
        >
          {LANGUAGES.find((language) => language.code === lang)?.shortLabel || "EN"}
        </button>
      </div>
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
