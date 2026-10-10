import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pullwiseApi } from "./api/pullwise.js";
import { createLedgerApi, ledgerApi } from "./api/ledger.js";
import { captureGitHubRefreshScope, setGitHubRefreshIdentity } from "./api/github-refresh.js";
import { WorkspaceContext } from "./components/workspace-context.jsx";
import { NotificationProvider } from "./components/notifications.jsx";
import { InvitationInboxProvider } from "./components/invitation-inbox.jsx";
import { ConsoleLayoutProvider } from "./components/console-layout.jsx";
import { PagePreferencesProvider, PagePreferencesReady } from "./components/page-preferences.jsx";
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
const MembersScreen = lazyScreen(() => import("./screens/members.jsx"), "MembersScreen");
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
  const invite = /^#invite=[A-Za-z0-9_-]{20,200}$/.test(window.location.hash)
    ? window.location.hash
    : "";
  if (window.location.pathname === path) return;
  window.history.replaceState(
    { screen },
    "",
    path + (screen === "login" || screen === "ledgerMembers" ? invite : "")
  );
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

function workspaceAccessSignature(workspace) {
  if (!workspace) return "unloaded";
  return JSON.stringify([
    workspace.id,
    workspace.revision,
    workspace.memberRevision,
    workspace.permissionsRevision,
    workspace.authorizationRevision,
    workspace.role,
    Object.entries(workspace.permissions || {}).sort(([left], [right]) =>
      left.localeCompare(right)
    ),
    Array.isArray(workspace.scopes) ? [...workspace.scopes].sort() : null,
  ]);
}

export function App() {
  const lang = useLang();
  const [theme, setTheme] = useState(() => localStorageGet("pw-theme", "light"));
  const [screen, setScreen] = useState(getInitialScreen);
  const [routeVersion, setRouteVersion] = useState(0);
  const [reviewIntent, setReviewIntent] = useState(null);
  const [recurringFocusIntent, setRecurringFocusIntent] = useState(null);
  const reviewNonceRef = useRef(0);
  const pageOperationRef = useRef(null);
  const [reportedNavigation, setReportedNavigation] = useState({ owner: "", active: false });
  const [renderedNavigation, setRenderedNavigation] = useState({ owner: "", active: false });
  const [auth, setAuth] = useState({ status: "checking", authenticated: false, session: null });
  const [repositoryAuthorizationError, setRepositoryAuthorizationError] = useState("");
  const [repositoryAuthorizationRevision, setRepositoryAuthorizationRevision] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languageFocusIndex, setLanguageFocusIndex] = useState(0);
  const [phoneLayout, setPhoneLayout] = useState(
    () => window.matchMedia?.("(max-width: 760px)").matches ?? false
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesVisible, setPreferencesVisible] = useState(!phoneLayout);
  const [workspaceState, setWorkspaceState] = useState({
    identity: "",
    status: "idle",
    items: [],
    selectedId: "",
    error: "",
  });
  const [workspaceRefresh, setWorkspaceRefresh] = useState(0);
  const [accessRefreshing, setAccessRefreshing] = useState(false);
  const scopedScreen = [
    "ledgerProjects",
    "ledgerCategories",
    "ledgerShared",
    "ledgerProject",
    "ledgerMembers",
    "apiKeys",
  ].includes(screen);
  const identity = sessionIdentity(auth.authenticated, auth.session);
  const githubAccountId = auth.authenticated ? auth.session?.user?.id : null;
  const workspace =
    workspaceState.identity === identity && workspaceState.status === "ready"
      ? workspaceState.items.find((item) => item.id === workspaceState.selectedId)
      : null;
  const accessSignature = workspaceAccessSignature(workspace);
  useEffect(() => {
    if (
      reviewIntent &&
      (reviewIntent.identity !== identity ||
        screen !== "ledgerMembers" ||
        (workspace &&
          (reviewIntent.workspaceId !== workspace.id ||
            workspace.permissions?.manageMembers !== true)))
    ) {
      setReviewIntent(null);
    }
  }, [reviewIntent, identity, screen, workspace]);
  const onReviewHandled = useCallback((handled) => {
    setReviewIntent((current) => (current?.nonce === handled?.nonce ? null : current));
  }, []);
  const selectedWorkspaceRef = useRef("");
  const workspaceIdentityRef = useRef("");
  const workspaceReloading = useRef(false);
  const softWorkspaceRefresh = useRef(false);
  const workspaceContext = JSON.stringify([
    identity,
    auth.status,
    screen,
    routeVersion,
    scopedScreen ? accessSignature : "account",
  ]);
  const workspaceGeneration = useRef({ context: "", value: 0 });
  if (workspaceGeneration.current.context !== workspaceContext) {
    workspaceGeneration.current = {
      context: workspaceContext,
      value: workspaceGeneration.current.value + 1,
    };
  }
  const workspaceScope = `${workspaceContext}:${workspaceGeneration.current.value}`;
  const currentWorkspaceScope = useRef(workspaceScope);
  currentWorkspaceScope.current = workspaceScope;
  const reloadWorkspaceAccess = useCallback(() => {
    if (workspaceReloading.current) return;
    workspaceReloading.current = true;
    softWorkspaceRefresh.current = false;
    setWorkspaceState((old) => ({ ...old, status: "loading", items: [] }));
    setWorkspaceRefresh((value) => value + 1);
  }, []);
  const onAccessChanged = useCallback(
    (error) => {
      // An old request can finish after a ledger, role, account or route change.
      // Its response must never invalidate the currently selected ledger.
      if (currentWorkspaceScope.current !== workspaceScope) return;
      const code = error?.code || error?.payload?.error?.code;
      if (
        error &&
        ![
          "ROLE_FORBIDDEN",
          "AUTHORIZATION_CHANGED",
          "WORKSPACE_MEMBERSHIP_CHANGED",
          "WORKSPACE_NOT_FOUND",
          "WORKSPACE_FORBIDDEN",
        ].includes(code)
      )
        return;
      reloadWorkspaceAccess();
    },
    [workspaceScope, reloadWorkspaceAccess]
  );
  const onMembershipChanged = useCallback(
    (selectedId) => {
      if (currentWorkspaceScope.current !== workspaceScope) return;
      if (typeof selectedId === "string" && selectedId) selectedWorkspaceRef.current = selectedId;
      softWorkspaceRefresh.current = true;
      setWorkspaceRefresh((value) => value + 1);
    },
    [workspaceScope]
  );
  const api = useMemo(
    () =>
      createLedgerApi(workspace?.id, onAccessChanged, captureGitHubRefreshScope(githubAccountId)),
    [workspace?.id, onAccessChanged, githubAccountId]
  );
  const workspaceReadRef = useRef({ generation: 0, controller: null });
  const accessRefreshRef = useRef(null);
  const onReloadAccess = useCallback(() => {
    if (currentWorkspaceScope.current !== workspaceScope || !workspace)
      return Promise.resolve(false);
    if (accessRefreshRef.current?.scope === workspaceScope) return accessRefreshRef.current.promise;
    accessRefreshRef.current?.controller.abort();
    workspaceReadRef.current.controller?.abort();
    const controller = new AbortController();
    const generation = workspaceReadRef.current.generation + 1;
    workspaceReadRef.current = { generation, controller };
    const refresh = { scope: workspaceScope, controller, promise: null };
    accessRefreshRef.current = refresh;
    setAccessRefreshing(true);
    refresh.promise = ledgerApi
      .workspaces({ signal: controller.signal })
      .then((result) => {
        if (
          controller.signal.aborted ||
          generation !== workspaceReadRef.current.generation ||
          currentWorkspaceScope.current !== workspaceScope
        )
          return false;
        const items = result?.items;
        if (
          !Array.isArray(items) ||
          !items.length ||
          items.some((item) => !item?.id || !item?.role)
        )
          throw new Error("Ledger access could not be loaded.");
        const wanted = selectedWorkspaceRef.current;
        const selected = items.find((item) => item.id === wanted) || items[0];
        selectedWorkspaceRef.current = selected.id;
        setWorkspaceState({ identity, status: "ready", items, selectedId: selected.id, error: "" });
        // A changed role/revision remounts the protected view. Its initial read
        // replaces the old view's pending Reload instead of continuing that read.
        return workspaceAccessSignature(selected) === accessSignature;
      })
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          generation === workspaceReadRef.current.generation &&
          currentWorkspaceScope.current === workspaceScope
        ) {
          setWorkspaceState({
            identity,
            status: "error",
            items: [],
            selectedId: "",
            error: error?.message || "Ledger access could not be loaded.",
          });
        }
        return false;
      })
      .finally(() => {
        if (accessRefreshRef.current !== refresh) return;
        accessRefreshRef.current = null;
        setAccessRefreshing(false);
      });
    return refresh.promise;
  }, [workspaceScope, workspace, identity, accessSignature]);
  const refreshCurrentAccess = useRef(onReloadAccess);
  refreshCurrentAccess.current = onReloadAccess;
  useEffect(() => {
    const refresh = accessRefreshRef.current;
    if (refresh && refresh.scope !== workspaceScope) {
      refresh.controller.abort();
      accessRefreshRef.current = null;
      setAccessRefreshing(false);
    }
  }, [workspaceScope]);
  useEffect(() => () => accessRefreshRef.current?.controller.abort(), []);
  const selectWorkspace = useCallback(
    (selectedId) => {
      workspaceIdentityRef.current = identity;
      selectedWorkspaceRef.current = selectedId;
      setWorkspaceState((old) => ({ ...old, selectedId }));
    },
    [identity]
  );
  const onInvitationRequestsChanged = useCallback(() => {
    window.dispatchEvent(new Event("pw-invitationrequestschange"));
  }, []);
  useEffect(() => {
    if (auth.status !== "ready" || !auth.authenticated || !scopedScreen) return;
    if (workspaceIdentityRef.current !== identity) {
      selectedWorkspaceRef.current = "";
      workspaceIdentityRef.current = identity;
    }
    const controller = new AbortController();
    workspaceReadRef.current.controller?.abort();
    const generation = workspaceReadRef.current.generation + 1;
    workspaceReadRef.current = { generation, controller };
    const soft = softWorkspaceRefresh.current;
    softWorkspaceRefresh.current = false;
    setWorkspaceState((old) =>
      soft && old.identity === identity && old.status === "ready"
        ? old
        : {
            identity,
            status: "loading",
            items: [],
            selectedId: old.identity === identity ? old.selectedId : "",
            error: "",
          }
    );
    ledgerApi
      .workspaces({ signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted || generation !== workspaceReadRef.current.generation) return;
        const items = result?.items;
        if (
          !Array.isArray(items) ||
          !items.length ||
          items.some((item) => !item?.id || !item?.role)
        )
          throw new Error("Ledger access could not be loaded.");
        const wanted =
          workspaceIdentityRef.current === identity ? selectedWorkspaceRef.current : "";
        const selectedId = items.some((item) => item.id === wanted) ? wanted : items[0].id;
        selectedWorkspaceRef.current = selectedId;
        setWorkspaceState({ identity, status: "ready", items, selectedId, error: "" });
        workspaceReloading.current = false;
      })
      .catch((error) => {
        if (!controller.signal.aborted && generation === workspaceReadRef.current.generation) {
          workspaceReloading.current = false;
          setWorkspaceState({
            identity,
            status: "error",
            items: [],
            selectedId: "",
            error: error?.message || "Ledger access could not be loaded.",
          });
        }
      });
    return () => controller.abort();
  }, [auth.status, auth.authenticated, identity, scopedScreen, workspaceRefresh]);
  const screenKey = PUBLIC_SCREENS.has(screen)
    ? screen
    : `${screen}:${identity}:${routeVersion}:${scopedScreen ? accessSignature : "account"}`;
  const navigationKey = `${screen}:${routeVersion}`;
  const currentScreenKeyRef = useRef(screenKey);
  currentScreenKeyRef.current = screenKey;
  const reportPageOperation = (active, owner) => {
    if (currentScreenKeyRef.current !== owner) return false;
    if (active) pageOperationRef.current = owner;
    else if (pageOperationRef.current === owner) pageOperationRef.current = null;
    setReportedNavigation({ owner, active });
    return true;
  };
  const navigationDisabled =
    (reportedNavigation.owner === screenKey && reportedNavigation.active) ||
    (renderedNavigation.owner === screenKey && renderedNavigation.active);
  const focusedNavigation = useRef(null);
  const continuedRepositoryAuthorization = useRef(false);
  const languageMenuRef = useRef(null);
  const languageToggleRef = useRef(null);
  const preferencesRef = useRef(null);
  const preferencesToggleRef = useRef(null);
  const themeToggleRef = useRef(null);
  const layoutFocusRestoreRef = useRef(null);
  const screenRootRef = useRef(null);
  const deferredAccessRefresh = useRef("");
  const focusAccessContext = useRef(null);
  focusAccessContext.current = { identity, scopedScreen, scope: workspaceScope };
  const previousWorkspaceNavigation = useRef(null);
  useEffect(() => {
    const previous = previousWorkspaceNavigation.current;
    previousWorkspaceNavigation.current = { identity, scopedScreen, screen, routeVersion };
    if (
      !previous ||
      previous.identity !== identity ||
      !previous.scopedScreen ||
      !scopedScreen ||
      (previous.screen === screen && previous.routeVersion === routeVersion) ||
      pageOperationRef.current === currentScreenKeyRef.current
    )
      return;
    refreshCurrentAccess.current();
  }, [identity, scopedScreen, screen, routeVersion]);

  useEffect(() => {
    if (pageOperationRef.current !== screenKey) pageOperationRef.current = null;
    setReportedNavigation((previous) =>
      previous.owner === screenKey || !previous.active
        ? previous
        : { owner: screenKey, active: false }
    );
    const root = screenRootRef.current;
    if (!root) return;
    const syncNavigation = () => {
      const active = Boolean(root.querySelector('.topbar [aria-disabled="true"]'));
      setRenderedNavigation((previous) =>
        previous.owner === screenKey && previous.active === active
          ? previous
          : { owner: screenKey, active }
      );
      if (!active && deferredAccessRefresh.current) {
        const scope = deferredAccessRefresh.current;
        deferredAccessRefresh.current = "";
        if (scope === currentWorkspaceScope.current) refreshCurrentAccess.current();
      }
    };
    syncNavigation();
    const observer = new MutationObserver(syncNavigation);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-disabled", "disabled", "href"],
    });
    return () => observer.disconnect();
  }, [screenKey]);

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

  useEffect(() => {
    if (!recurringFocusIntent) return;
    const intent = recurringFocusIntent;
    if (
      intent.identity !== identity ||
      screen !== intent.screen ||
      window.location.pathname !== intent.path
    ) {
      setRecurringFocusIntent(null);
      return;
    }
    if (workspaceState.status !== "ready" || accessRefreshing) return;
    if (workspace?.id !== intent.workspaceId) {
      setRecurringFocusIntent(null);
      return;
    }
    const root = screenRootRef.current;
    if (!root) return;
    let frame = 0;
    const focusPlan = () => {
      const section = root.querySelector("#recurring-plans");
      if (!section || section.closest("[hidden]") || section.getAttribute("aria-busy") === "true")
        return false;
      const row = Array.from(section.querySelectorAll("[data-recurring-rule-id]")).find(
        (node) => node.dataset.recurringRuleId === intent.ruleId
      );
      const target = row || section;
      // Wait for the inbox focus cleanup and the normal route heading focus.
      frame = window.requestAnimationFrame(() => {
        if (!target.isConnected) return;
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: "start" });
        setRecurringFocusIntent((current) => (current === intent ? null : current));
      });
      return true;
    };
    const observer = new MutationObserver(() => {
      if (focusPlan()) observer.disconnect();
    });
    if (!focusPlan())
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-busy", "hidden"],
      });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [
    recurringFocusIntent,
    identity,
    screen,
    screenKey,
    workspace,
    workspaceState.status,
    accessRefreshing,
  ]);

  const go = (nextScreen, params = {}) => {
    if (pageOperationRef.current === currentScreenKeyRef.current) return;
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

  const closeLanguageMenu = useCallback((restoreFocus = true) => {
    setLanguageMenuOpen(false);
    if (restoreFocus) languageToggleRef.current?.focus({ preventScroll: true });
  }, []);
  const closePreferences = useCallback((restoreFocus = true) => {
    setLanguageMenuOpen(false);
    setPreferencesOpen(false);
    if (restoreFocus) preferencesToggleRef.current?.focus({ preventScroll: true });
  }, []);
  const reportPreferencesVisibility = useCallback(
    (visible) => {
      setPreferencesVisible(visible);
      if (!visible) closePreferences(false);
    },
    [closePreferences]
  );
  const openLanguageMenu = (edge) => {
    const selected = LANGUAGES.findIndex((language) => language.code === lang);
    setLanguageFocusIndex(
      edge === "first" ? 0 : edge === "last" ? LANGUAGES.length - 1 : Math.max(0, selected)
    );
    setLanguageMenuOpen(true);
  };
  const languageMenuKeyDown = (event) => {
    const directions = { ArrowDown: 1, ArrowUp: -1 };
    if (event.key in directions) {
      event.preventDefault();
      setLanguageFocusIndex(
        (index) => (index + directions[event.key] + LANGUAGES.length) % LANGUAGES.length
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setLanguageFocusIndex(event.key === "Home" ? 0 : LANGUAGES.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeLanguageMenu();
    } else if (event.key === "Tab") {
      event.preventDefault();
      closeLanguageMenu();
      if (!event.shiftKey) themeToggleRef.current?.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 760px)");
    if (!media) return;
    const updateLayout = (event) => {
      const active = document.activeElement;
      const losingFocus = preferencesRef.current?.contains(active);
      layoutFocusRestoreRef.current = losingFocus ? { active, phone: event.matches } : null;
      setPhoneLayout(event.matches);
      setLanguageMenuOpen(false);
      setPreferencesOpen(false);
    };
    media.addEventListener?.("change", updateLayout);
    return () => media.removeEventListener?.("change", updateLayout);
  }, []);

  useEffect(() => {
    const restore = layoutFocusRestoreRef.current;
    if (!restore) return;
    if (document.activeElement !== restore.active && document.activeElement !== document.body) {
      layoutFocusRestoreRef.current = null;
      return;
    }
    const opener = restore.phone ? preferencesToggleRef.current : languageToggleRef.current;
    if (!opener) return;
    layoutFocusRestoreRef.current = null;
    opener.focus({ preventScroll: true });
  }, [phoneLayout, languageMenuOpen, preferencesOpen, preferencesVisible]);

  useEffect(() => {
    if (phoneLayout && preferencesOpen) languageToggleRef.current?.focus({ preventScroll: true });
  }, [phoneLayout, preferencesOpen]);

  useEffect(() => {
    if (!languageMenuOpen) return;
    const option =
      languageMenuRef.current?.querySelectorAll('[role="menuitemradio"]')[languageFocusIndex];
    option?.focus({ preventScroll: true });
    option?.scrollIntoView?.({ block: "nearest" });
  }, [languageMenuOpen, languageFocusIndex]);

  useEffect(() => {
    if (!languageMenuOpen && !preferencesOpen) return;
    const closeOutside = (event) => {
      // Outside pointer actions keep their own focus and native behavior.
      if (!preferencesRef.current?.contains(event.target)) closePreferences(false);
      else if (!languageMenuRef.current?.contains(event.target)) closeLanguageMenu(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (languageMenuOpen) closeLanguageMenu();
      else closePreferences();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [languageMenuOpen, preferencesOpen, closeLanguageMenu, closePreferences]);

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

  useEffect(() => () => setGitHubRefreshIdentity(null), []);

  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  const setAuthState = useCallback((nextAuth) => {
    const resolvedAuth = typeof nextAuth === "function" ? nextAuth(authRef.current) : nextAuth;
    const nextIdentity = sessionIdentity(resolvedAuth.authenticated, resolvedAuth.session);
    setGitHubRefreshIdentity(resolvedAuth.authenticated ? resolvedAuth.session?.user?.id : null);
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

  const acceptEmailSession = useCallback(
    (payload, { link = false } = {}) => {
      if (!payload?.authenticated || !payload?.user?.id) {
        throw new Error(
          T("Sign-in could not be confirmed. Please retry.", "未能确认登录状态，请重试。")
        );
      }
      if (
        link &&
        (!authRef.current.authenticated || authRef.current.session?.user?.id !== payload.user.id)
      ) {
        throw new Error(
          T(
            "Email linking could not be confirmed for this account. Please retry.",
            "未能确认邮箱已绑定到此账户，请重试。"
          )
        );
      }
      sessionAbortRef.current?.abort();
      sessionAbortRef.current = null;
      sessionCheckingRef.current = false;
      clearSessionConfirmTimer();
      if (!link) setGitHubRefreshIdentity(null);
      setAuthState({ status: "ready", authenticated: true, session: payload });
      if (!link) {
        const destination = /^#invite=[A-Za-z0-9_-]{20,200}$/.test(window.location.hash)
          ? "ledgerMembers"
          : "ledgerProjects";
        replaceAutomaticScreenPath(destination);
        setScreen(destination);
        setRouteVersion((value) => value + 1);
      }
    },
    [clearSessionConfirmTimer, setAuthState]
  );

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
            const destination = /^#invite=[A-Za-z0-9_-]{20,200}$/.test(window.location.hash)
              ? "ledgerMembers"
              : "landing";
            replaceAutomaticScreenPath(destination);
            return destination;
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
      const beforeIdentity = sessionIdentity(
        authRef.current.authenticated,
        authRef.current.session
      );
      checkSession({
        isRetry: true,
        confirmUnauthenticated: true,
        preserveAuthenticatedOnError: true,
      }).then((result) => {
        if (result?.needsConfirmation) scheduleSignedOutConfirmation();
        const context = focusAccessContext.current;
        if (
          !result?.authenticated ||
          result?.preserved ||
          sessionIdentity(true, result.payload) !== beforeIdentity ||
          context?.identity !== beforeIdentity ||
          !context.scopedScreen
        )
          return;
        if (
          pageOperationRef.current === currentScreenKeyRef.current ||
          screenRootRef.current?.querySelector('.topbar [aria-disabled="true"]')
        ) {
          deferredAccessRefresh.current = context.scope;
          return;
        }
        refreshCurrentAccess.current();
      });
    };
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    const restoreFromCache = (event) => {
      if (event.persisted) recheck();
    };
    window.addEventListener("pageshow", restoreFromCache);
    return () => {
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("pageshow", restoreFromCache);
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
        body = (
          <LoginScreen
            go={go}
            onAuthenticated={acceptEmailSession}
            onOperationBusy={(active) => reportPageOperation(active, screenKey)}
          />
        );
        break;
      case "oauth":
        body = <OAuthScreen go={go} auth={auth} />;
        break;
      case "ledgerProjects":
        body = (
          <LedgerScreen
            go={go}
            mode="projects"
            api={api}
            workspace={workspace}
            onAccessChanged={onAccessChanged}
            onReloadAccess={onReloadAccess}
            accessRefreshing={accessRefreshing}
            authorizationError={repositoryAuthorizationError}
            authorizationRevision={repositoryAuthorizationRevision}
          />
        );
        break;
      case "ledgerCategories":
        body = (
          <LedgerScreen
            go={go}
            mode="categories"
            api={api}
            workspace={workspace}
            onAccessChanged={onAccessChanged}
            onReloadAccess={onReloadAccess}
            accessRefreshing={accessRefreshing}
          />
        );
        break;
      case "ledgerShared":
        body = (
          <LedgerScreen
            go={go}
            mode="shared"
            api={api}
            workspace={workspace}
            onAccessChanged={onAccessChanged}
            onReloadAccess={onReloadAccess}
            accessRefreshing={accessRefreshing}
          />
        );
        break;
      case "ledgerProject":
        body = (
          <LedgerScreen
            key={window.location.pathname}
            go={go}
            mode="project"
            api={api}
            workspace={workspace}
            onAccessChanged={onAccessChanged}
            onReloadAccess={onReloadAccess}
            accessRefreshing={accessRefreshing}
            projectId={window.location.pathname.slice("/projects/".length)}
          />
        );
        break;
      case "apiKeys":
        body = (
          <ApiKeysScreen
            go={go}
            workspace={workspace}
            onAccessChanged={onAccessChanged}
            onReloadAccess={onReloadAccess}
            accessRefreshing={accessRefreshing}
          />
        );
        break;
      case "ledgerMembers":
        body = (
          <MembersScreen
            go={go}
            api={api}
            workspace={workspace}
            onAccessChanged={onAccessChanged}
            onReloadAccess={onReloadAccess}
            accessRefreshing={accessRefreshing}
            onMembershipChanged={onMembershipChanged}
            onInvitationRequestsChanged={onInvitationRequestsChanged}
            reviewIntent={
              reviewIntent?.identity === identity && reviewIntent.workspaceId === workspace?.id
                ? reviewIntent
                : null
            }
            onReviewHandled={onReviewHandled}
          />
        );
        break;
      case "settings":
        body = (
          <SettingsScreen
            go={go}
            onSessionUpdated={(payload) => acceptEmailSession(payload, { link: true })}
            onOperationBusy={(active) => reportPageOperation(active, screenKey)}
          />
        );
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

  if (auth.status === "ready" && auth.authenticated && scopedScreen && !workspace) {
    body = (
      <div className="auth-wrap fade-in">
        <div className="auth-card">
          <h1>
            {workspaceState.status === "error"
              ? T("Ledger access unavailable", "暂时无法加载账本")
              : T("Loading ledger", "正在加载账本")}
          </h1>
          {workspaceState.status === "error" ? (
            <>
              <p role="alert">{workspaceState.error}</p>
              <button className="btn" onClick={reloadWorkspaceAccess}>
                {T("Retry", "重试")}
              </button>
            </>
          ) : (
            <p role="status">
              {T("Checking your current ledger membership.", "正在检查当前账本成员权限。")}
            </p>
          )}
        </div>
      </div>
    );
  }
  const consoleScreen =
    auth.status === "ready" &&
    auth.authenticated &&
    !PUBLIC_SCREENS.has(screen) &&
    screen !== "oauth";
  const preferencesLabel = T("Display options", {
    zh: "显示选项",
    ja: "表示設定",
    ko: "화면 옵션",
    fr: "Options d’affichage",
    es: "Opciones de visualización",
  });
  const preferencesControls = (
    <div className="preferences" ref={preferencesRef}>
      {phoneLayout && (
        <button
          className="preferences-toggle"
          type="button"
          ref={preferencesToggleRef}
          aria-label={preferencesLabel}
          aria-expanded={preferencesOpen}
          aria-controls="preferences-actions"
          onClick={() => (preferencesOpen ? closePreferences() : setPreferencesOpen(true))}
        >
          <I.Sliders size={18} />
          <span>{preferencesLabel}</span>
        </button>
      )}
      <div
        className="preferences-actions"
        id="preferences-actions"
        role="group"
        aria-label={preferencesLabel}
        hidden={phoneLayout && !preferencesOpen}
      >
        <div className="lang-picker" ref={languageMenuRef}>
          <button
            type="button"
            ref={languageToggleRef}
            className={"lang-toggle" + (languageMenuOpen ? " active" : "")}
            onClick={() => (languageMenuOpen ? closeLanguageMenu() : openLanguageMenu())}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                openLanguageMenu(event.key === "ArrowDown" ? "first" : "last");
              }
            }}
            title={T("Select language", "选择语言")}
            aria-label={T("Select language", "选择语言")}
            aria-haspopup="menu"
            aria-controls={languageMenuOpen ? "language-menu" : undefined}
            aria-expanded={languageMenuOpen}
          >
            {LANGUAGES.find((language) => language.code === lang)?.shortLabel || "EN"}
            <span className="preferences-label">{T("Select language", "选择语言")}</span>
          </button>
          {languageMenuOpen && (
            <div
              className="lang-menu"
              id="language-menu"
              role="menu"
              aria-label={T("Select language", "选择语言")}
              onKeyDown={languageMenuKeyDown}
            >
              {LANGUAGES.map((language, index) => (
                <button
                  key={language.code}
                  type="button"
                  className={"lang-menu-i" + (lang === language.code ? " active" : "")}
                  role="menuitemradio"
                  aria-checked={lang === language.code}
                  tabIndex={languageFocusIndex === index ? 0 : -1}
                  onFocus={() => setLanguageFocusIndex(index)}
                  onClick={() => {
                    setLang(language.code);
                    closeLanguageMenu();
                  }}
                >
                  <span className="lang-menu-code">{language.shortLabel}</span>
                  <span>{language.nativeLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          ref={themeToggleRef}
          className="theme-toggle"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          title={
            theme === "light"
              ? T("Switch to dark", "切换到暗色")
              : T("Switch to light", "切换到亮色")
          }
          aria-label={T("Toggle theme", "切换主题")}
        >
          {theme === "light" ? <I.Moon size={16} /> : <I.Sun size={16} />}
          <span className="preferences-label">
            {theme === "light"
              ? T("Switch to dark", "切换到暗色")
              : T("Switch to light", "切换到亮色")}
          </span>
        </button>
        <button
          type="button"
          className={"back-to-top" + (showBackToTop ? " visible" : "")}
          onClick={() => {
            scrollToTop();
            if (phoneLayout) closePreferences();
          }}
          title={T("Back to top", "回到顶部")}
          aria-label={T("Back to top", "回到顶部")}
          tabIndex={showBackToTop ? 0 : -1}
        >
          <I.ArrowUp size={16} />
          <span className="preferences-label">{T("Back to top", "回到顶部")}</span>
        </button>
      </div>
    </div>
  );
  return (
    <div className="app-frame" data-console={consoleScreen ? "true" : "false"}>
      <NotificationProvider
        scope={identity}
        navigationDisabled={navigationDisabled}
        floatingControlsOpen={
          preferencesVisible && (languageMenuOpen || (phoneLayout && preferencesOpen))
        }
      >
        <InvitationInboxProvider
          identity={identity}
          enabled={auth.status === "ready" && auth.authenticated}
          navigationKey={navigationKey}
          navigationDisabled={navigationDisabled}
          onReview={(request) => {
            if (pageOperationRef.current === currentScreenKeyRef.current) return false;
            if (screenRootRef.current?.querySelector('.topbar [aria-disabled="true"]'))
              return false;
            setReviewIntent({
              identity,
              workspaceId: request.workspaceId,
              requestId: request.id,
              nonce: ++reviewNonceRef.current,
            });
            selectWorkspace(request.workspaceId);
            go("ledgerMembers");
          }}
          onOpenRecurring={(item) => {
            if (pageOperationRef.current === currentScreenKeyRef.current) return false;
            if (screenRootRef.current?.querySelector('.topbar [aria-disabled="true"]'))
              return false;
            const nextScreen = item.target.kind === "project" ? "ledgerProject" : "ledgerShared";
            const params = item.target.kind === "project" ? { id: item.target.projectId } : {};
            setRecurringFocusIntent({
              identity,
              workspaceId: item.workspaceId,
              ruleId: item.ruleId,
              screen: nextScreen,
              path: pathFromScreen(nextScreen, params),
            });
            selectWorkspace(item.workspaceId);
            if (
              workspaceState.status !== "ready" ||
              !workspaceState.items.some((entry) => entry.id === item.workspaceId)
            )
              reloadWorkspaceAccess();
            go(nextScreen, params);
          }}
        >
          <ConsoleLayoutProvider scope={identity}>
            <WorkspaceContext.Provider
              value={
                scopedScreen && workspace
                  ? { items: workspaceState.items, workspace, onSelect: selectWorkspace }
                  : null
              }
            >
              <PagePreferencesProvider
                owner={screenKey}
                phone={phoneLayout}
                consolePage={consoleScreen}
                publicPage={
                  PUBLIC_SCREENS.has(screen) &&
                  !(auth.status === "checking" && shouldShowSessionCheck(screen))
                }
                controls={preferencesControls}
                onVisibilityChange={reportPreferencesVisibility}
              >
                <div
                  className="screen-root"
                  ref={screenRootRef}
                  tabIndex={-1}
                  data-screen-label={screen}
                  key={screenKey}
                >
                  <Suspense fallback={<ScreenFallback />}>
                    {body}
                    <PagePreferencesReady />
                  </Suspense>
                </div>
              </PagePreferencesProvider>
            </WorkspaceContext.Provider>
          </ConsoleLayoutProvider>
        </InvitationInboxProvider>
      </NotificationProvider>
    </div>
  );
}
