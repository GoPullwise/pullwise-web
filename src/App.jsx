import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "./api/pullwise.js";
import { NotificationProvider } from "./components/notifications.jsx";
import { LANGUAGES, T, setLang, useLang } from "./i18n.jsx";
import { I } from "./icons.jsx";
import { connectGitHubRepositories } from "./lib/auth.js";
import { localStorageGet, localStorageSet } from "./lib/browser-storage.js";
import { pathFromScreen, screenFromPath } from "./lib/navigation.js";
import { applyCurrentSeoMetadata } from "./lib/seo-client.js";
import { NotFoundScreen } from "./screens/error.jsx";
import { LandingScreen, LoginScreen, OAuthScreen } from "./screens/public.jsx";

const INITIAL_SESSION_RETRY_DELAY_MS = 2000;
const SESSION_SIGNED_OUT_CONFIRM_DELAY_MS = 2000;
const BACK_TO_TOP_THRESHOLD_PX = 240;
function lazyScreen(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const ApiKeysScreen = lazyScreen(() => import("./screens/api.jsx"), "ApiKeysScreen");
const ApiDocsScreen = lazyScreen(() => import("./screens/api-docs.jsx"), "ApiDocsScreen");
const BillingScreen = lazyScreen(() => import("./screens/billing.jsx"), "BillingScreen");
const PricingScreen = lazyScreen(() => import("./screens/billing.jsx"), "PricingScreen");
const LedgerScreen = lazyScreen(() => import("./screens/ledger.jsx"), "LedgerScreen");
const DocsScreen = lazyScreen(() => import("./screens/docs.jsx"), "DocsScreen");
const SettingsScreen = lazyScreen(() => import("./screens/settings.jsx"), "SettingsScreen");
const PrivacyScreen = lazyScreen(() => import("./screens/legal.jsx"), "PrivacyScreen");
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

function replaceAutomaticScreenPath(screen) {
  const path = pathFromScreen(screen);
  if (window.location.pathname === path) return;
  window.history.replaceState({ screen }, "", path);
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

export function App() {
  const lang = useLang();
  const [theme, setTheme] = useState(() => localStorageGet("pw-theme", "light"));
  const [screen, setScreen] = useState(getInitialScreen);
  const [routeVersion, setRouteVersion] = useState(0);
  const [auth, setAuth] = useState({ status: "checking", authenticated: false, session: null });
  const [repositoryAuthorizationError, setRepositoryAuthorizationError] = useState("");
  const [repositoryAuthorizationRevision, setRepositoryAuthorizationRevision] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const screenKey = PUBLIC_SCREENS.has(screen)
    ? screen
    : `${screen}:${sessionIdentity(auth.authenticated, auth.session)}:${routeVersion}`;
  const navigationKey = `${screen}:${routeVersion}`;
  const focusedNavigation = useRef(null);
  const continuedRepositoryAuthorization = useRef(false);
  const languageMenuRef = useRef(null);
  const screenRootRef = useRef(null);

  useEffect(() => {
    const root = screenRootRef.current;
    if (!root) return;
    const navigating = focusedNavigation.current !== navigationKey;
    focusedNavigation.current = navigationKey;
    if (
      !navigating &&
      document.activeElement !== document.body &&
      !root.contains(document.activeElement)
    ) {
      return;
    }
    const focusHeading = () => {
      const heading = root.querySelector("h1, [role='heading']");
      if (!heading) return false;
      heading.tabIndex = -1;
      heading.classList.add("screen-heading");
      heading.focus({ preventScroll: true });
      return true;
    };
    if (focusHeading()) return;
    root.focus({ preventScroll: true });
    // Lazy screens and session restoration can render the heading later.
    const observer = new MutationObserver(() => {
      if (document.activeElement !== root && document.activeElement !== document.body) {
        observer.disconnect();
        return;
      }
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [navigationKey, screenKey]);

  const go = (nextScreen, params = {}) => {
    const path = pathFromScreen(nextScreen, params);
    const historyState = { screen: nextScreen };
    if (window.location.pathname !== path) {
      window.history.pushState(historyState, "", path);
    } else {
      window.history.replaceState(historyState, "", path);
    }
    setScreen(screenFromPath(path) || "notfound");
    setRouteVersion((value) => value + 1);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPopState = () => {
      const nextScreen = screenFromPath(window.location.pathname) || "notfound";
      setScreen(nextScreen);
      setRouteVersion((value) => value + 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    applyCurrentSeoMetadata();
  }, [lang, screen]);

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
    replaceAutomaticScreenPath("login");
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
            replaceAutomaticScreenPath("landing");
            return "landing";
          }
          if (!authenticated && !PUBLIC_SCREENS.has(current)) {
            replaceAutomaticScreenPath("login");
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
        setScreen((current) => {
          if (PUBLIC_SCREENS.has(current)) return current;
          replaceAutomaticScreenPath("login");
          return "login";
        });
        return { authenticated: false, error };
      } finally {
        if (sessionAbortRef.current === controller) {
          sessionAbortRef.current = null;
          sessionCheckingRef.current = false;
        }
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
    checkSession({ deferUnauthenticated: true, preserveAuthenticatedOnError: true }).then(
      (result) => {
        if (disposed) return;
        if (result?.authenticated || result?.aborted || result?.skipped) return;
        // Keep login actions disabled until a second check confirms that the browser is actually
        // signed out. This avoids a transient signed-out UI during cold starts or weak networks.
        setTimeout(() => {
          if (!disposed) checkSession({ isRetry: true, preserveAuthenticatedOnError: true });
        }, INITIAL_SESSION_RETRY_DELAY_MS);
      }
    );
    return () => {
      disposed = true;
      const controller = sessionAbortRef.current;
      if (controller) controller.abort();
      if (sessionAbortRef.current === controller) {
        sessionAbortRef.current = null;
        sessionCheckingRef.current = false;
      }
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
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#080808" : "#f8f7f6");
    localStorageSet("pw-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (auth.status !== "ready" || !auth.authenticated || screen !== "ledgerProjects") return;
    if (continuedRepositoryAuthorization.current || !repositoryAuthorizationRequested()) return;
    continuedRepositoryAuthorization.current = true;
    clearRepositoryAuthorizationRequest();
    connectGitHubRepositories()
      .then(() => {
        setRepositoryAuthorizationRevision((value) => value + 1);
      })
      .catch((error) => {
        setRepositoryAuthorizationError(
          error?.message || "Unable to connect GitHub repository access."
        );
      });
  }, [auth.status, auth.authenticated, screen]);

  // Show the back-to-top button once the user has scrolled past the threshold,
  // and hide it again when they return to the top. This lets long list pages
  // (project and expense lists) recover from deep scroll.
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

  let body;
  if (auth.status === "checking" && shouldShowSessionCheck(screen)) {
    body = (
      <div className="auth-wrap fade-in">
        <div className="auth-card">
          <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
            <img
              className="brand-mark"
              src="/brand-mark.png"
              alt=""
              aria-hidden="true"
              width="24"
              height="24"
            />
            <span style={{ fontSize: "var(--fs-2xl)" }}>Pullwise</span>
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
        body = <LandingScreen go={go} auth={auth} />;
        break;
      case "login":
        body = <LoginScreen go={go} />;
        break;
      case "oauth":
        body = <OAuthScreen go={go} auth={auth} />;
        break;
      case "ledgerProjects":
        body = (
          <LedgerScreen
            go={go}
            mode="projects"
            authorizationError={repositoryAuthorizationError}
            authorizationRevision={repositoryAuthorizationRevision}
          />
        );
        break;
      case "ledgerCategories":
        body = <LedgerScreen go={go} mode="categories" />;
        break;
      case "ledgerShared":
        body = <LedgerScreen go={go} mode="shared" />;
        break;
      case "ledgerProject":
        body = (
          <LedgerScreen
            key={window.location.pathname}
            go={go}
            mode="project"
            projectId={window.location.pathname.slice("/projects/".length)}
          />
        );
        break;
      case "apiKeys":
        body = <ApiKeysScreen go={go} />;
        break;
      case "settings":
        body = <SettingsScreen go={go} />;
        break;
      case "billing":
        body = <BillingScreen go={go} />;
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
    <NotificationProvider>
      <div
        className="screen-root"
        ref={screenRootRef}
        tabIndex={-1}
        data-screen-label={screen}
        key={screenKey}
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
    </NotificationProvider>
  );
}
