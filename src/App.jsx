import { useEffect, useRef, useState } from "react";
import { pullwiseApi } from "./api/pullwise.js";
import { T, setLang, useLang } from "./i18n.jsx";
import { I } from "./icons.jsx";
import { connectGitHubRepositories } from "./lib/auth.js";
import { BillingScreen } from "./screens/billing.jsx";
import { DashboardScreen } from "./screens/dashboard.jsx";
import { NotFoundScreen } from "./screens/error.jsx";
import { ReposScreen, ScanningScreen } from "./screens/flow.jsx";
import {
  HistoryScreen,
  IssueDetailScreen,
  IssuesScreen,
  SettingsScreen,
} from "./screens/issues.jsx";
import {
  PrivacyScreen,
  SecurityScreen,
  StatusScreen,
  TermsScreen,
} from "./screens/legal.jsx";
import {
  LandingScreen,
  LoginScreen,
  OAuthScreen,
} from "./screens/public.jsx";

const ACCENT = "#6366f1";
const LAYOUT = "list";
const SCREENS = new Set([
  "landing",
  "login",
  "oauth",
  "repos",
  "scanning",
  "dashboard",
  "issues",
  "issue",
  "history",
  "settings",
  "billing",
  "privacy",
  "terms",
  "security",
  "status",
  "notfound",
]);
const PUBLIC_SCREENS = new Set(["landing", "login", "privacy", "terms", "security", "status", "notfound"]);

function getInitialScreen() {
  const requestedScreen = new URLSearchParams(window.location.search).get("screen");
  if (!requestedScreen) return "landing";
  return SCREENS.has(requestedScreen) ? requestedScreen : "notfound";
}

function getRequestedScreenParam() {
  return new URLSearchParams(window.location.search).get("screen") || "";
}

function repositoryAuthorizationRequested() {
  return new URLSearchParams(window.location.search).get("repoAuth") === "1";
}

function clearRepositoryAuthorizationRequest() {
  const url = new URL(window.location.href);
  url.searchParams.delete("repoAuth");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
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
    { k: "settings", t: "设置" },
    { k: "billing", t: "Billing" },
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
  const [theme, setTheme] = useState(() => localStorage.getItem("pw-theme") || "light");
  const [screen, setScreen] = useState(getInitialScreen);
  const [auth, setAuth] = useState({ status: "checking", authenticated: false, session: null });
  const [issue, setIssue] = useState(null);
  const [activeRepo, setActiveRepo] = useState(null);
  const [navOpen, setNavOpen] = useState(true);
  const [repositoryAuthorizationError, setRepositoryAuthorizationError] = useState("");
  const continuedRepositoryAuthorization = useRef(false);

  const go = (nextScreen) => {
    setScreen(nextScreen);
    window.scrollTo({ top: 0 });
  };

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
    let cancelled = false;

    pullwiseApi.auth.getSession()
      .then((payload) => {
        if (cancelled) return;
        const authenticated = Boolean(payload?.authenticated);
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
      })
      .catch(() => {
        if (cancelled) return;
        setAuth({ status: "ready", authenticated: false, session: null });
        setScreen((current) => (PUBLIC_SCREENS.has(current) ? current : "login"));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.setProperty("--accent", ACCENT);
    localStorage.setItem("pw-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (auth.status !== "ready" || !auth.authenticated || screen !== "repos") return;
    if (continuedRepositoryAuthorization.current || !repositoryAuthorizationRequested()) return;
    continuedRepositoryAuthorization.current = true;
    clearRepositoryAuthorizationRequest();
    connectGitHubRepositories().catch((error) => {
      setRepositoryAuthorizationError(error?.message || "Unable to connect GitHub repository access.");
    });
  }, [auth.status, auth.authenticated, screen]);

  let body;
  if (auth.status === "checking" && !PUBLIC_SCREENS.has(screen)) {
    body = (
      <div className="auth-wrap fade-in">
        <div className="auth-card">
          <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
            <div className="brand-mark">PR</div>
            <span style={{ fontSize: 16 }}>Pullwise</span>
          </div>
          <h2 className="auth-title">{T("Checking session", "正在检查会话")}</h2>
          <p className="auth-sub">{T("Restoring your workspace if this browser is still signed in.", "如果此浏览器仍保持登录，将恢复工作区。")}</p>
        </div>
      </div>
    );
  } else switch (screen) {
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
          setActiveRepo={setActiveRepo}
          authorizationError={repositoryAuthorizationError}
          clearAuthorizationError={() => setRepositoryAuthorizationError("")}
        />
      );
      break;
    case "scanning":
      body = <ScanningScreen go={go} activeRepo={activeRepo} />;
      break;
    case "dashboard":
      body = <DashboardScreen go={go} layout={LAYOUT} setIssue={setIssue} accent={ACCENT} />;
      break;
    case "issues":
      body = <IssuesScreen go={go} setIssue={setIssue} />;
      break;
    case "issue":
      body = <IssueDetailScreen go={go} issue={issue} />;
      break;
    case "history":
      body = <HistoryScreen go={go} openScan={openScan} />;
      break;
    case "settings":
      body = <SettingsScreen go={go} />;
      break;
    case "billing":
      body = <BillingScreen go={go} />;
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
        title={theme === "light" ? T("Switch to dark", "切换到暗色") : T("Switch to light", "切换到亮色")}
        aria-label={T("Toggle theme", "切换主题")}
      >
        {theme === "light" ? <I.Moon size={16} /> : <I.Sun size={16} />}
      </button>
    </>
  );
}
