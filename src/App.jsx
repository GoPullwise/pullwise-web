import { useEffect, useState } from "react";
import { pullwiseApi } from "./api/pullwise.js";
import { T, setLang, useLang } from "./i18n.jsx";
import { I } from "./icons.jsx";
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
  const [issue, setIssue] = useState(null);
  const [activeRepo, setActiveRepo] = useState(null);
  const [navOpen, setNavOpen] = useState(true);

  const go = (nextScreen) => {
    setScreen(nextScreen);
    window.scrollTo({ top: 0 });
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
        setScreen((current) => {
          if (authenticated && (current === "landing" || current === "login")) {
            return "dashboard";
          }
          if (!authenticated && !PUBLIC_SCREENS.has(current)) {
            return "login";
          }
          return current;
        });
      })
      .catch(() => {
        if (cancelled) return;
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

  let body;
  switch (screen) {
    case "landing":
      body = <LandingScreen go={go} accent={ACCENT} />;
      break;
    case "login":
      body = <LoginScreen go={go} />;
      break;
    case "oauth":
      body = <OAuthScreen go={go} />;
      break;
    case "repos":
      body = <ReposScreen go={go} setActiveRepo={setActiveRepo} />;
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
      body = <HistoryScreen go={go} />;
      break;
    case "settings":
      body = <SettingsScreen go={go} />;
      break;
    case "billing":
      body = <BillingScreen go={go} />;
      break;
    case "privacy":
      body = <PrivacyScreen go={go} />;
      break;
    case "terms":
      body = <TermsScreen go={go} />;
      break;
    case "security":
      body = <SecurityScreen go={go} />;
      break;
    case "status":
      body = <StatusScreen go={go} />;
      break;
    case "notfound":
      body = <NotFoundScreen go={go} requested={getRequestedScreenParam()} />;
      break;
    default:
      body = <NotFoundScreen go={go} requested={getRequestedScreenParam()} />;
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
