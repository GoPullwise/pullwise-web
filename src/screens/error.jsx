// screens/error.jsx — Not Found / fallback screens

import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";

function screenHref(screen) {
  return `?screen=${encodeURIComponent(screen)}`;
}

function screenLinkProps(go, screen) {
  return {
    href: screenHref(screen),
    onClick: (event) => {
      if (typeof go !== "function") return;
      event.preventDefault();
      go(screen);
    },
  };
}

export function NotFoundScreen({ go, requested, auth }) {
  useLang();
  const signedIn = Boolean(auth?.authenticated);
  const suggestions = signedIn
    ? [
        {
          k: "dashboard",
          t: T("Dashboard", "Dashboard"),
          d: T("Workspace overview", "工作区总览"),
          i: <I.Layout size={14} />,
        },
        {
          k: "issues",
          t: T("Issues", "问题列表"),
          d: T("All findings across repos", "所有仓库的扫描结果"),
          i: <I.Bug size={14} />,
        },
        {
          k: "landing",
          t: T("Home", "首页"),
          d: T("Back to the Pullwise landing page", "回到 Pullwise 主页"),
          i: <I.ArrowL size={14} />,
        },
      ]
    : [
        {
          k: "landing",
          t: T("Home", "首页"),
          d: T("Back to the Pullwise landing page", "回到 Pullwise 主页"),
          i: <I.ArrowL size={14} />,
        },
        {
          k: "login",
          t: T("Sign in", "登录"),
          d: T("Restore your workspace session", "恢复你的工作区会话"),
          i: <I.User size={14} />,
        },
        {
          k: "status",
          t: T("Status", "状态"),
          d: T("Check backend availability", "检查后端可用性"),
          i: <I.Activity size={14} />,
        },
      ];

  return (
    <div className="notfound-shell fade-in">
      <div className="notfound-card">
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">{T("This page took a wrong turn", "这个页面走丢了")}</h1>
        <p className="notfound-sub">
          {T(
            "We couldn't find what you were looking for. The link may be outdated, or the screen may have been renamed.",
            "我们找不到你想访问的页面。链接可能已过时,或该页面已被重命名。"
          )}
          {requested && (
            <span className="notfound-req">
              {" "}
              · <span className="kbd">?screen={requested}</span>
            </span>
          )}
        </p>
        <div className="notfound-suggest">
          <div className="notfound-suggest-h">{T("Try one of these instead", "试试这些页面")}</div>
          {suggestions.map((s) => (
            <a key={s.k} className="notfound-suggest-i" {...screenLinkProps(go, s.k)}>
              <span className="notfound-suggest-ic">{s.i}</span>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div className="notfound-suggest-t">{s.t}</div>
                <div className="notfound-suggest-d">{s.d}</div>
              </div>
              <I.ArrowR size={12} style={{ color: "var(--text-4)" }} />
            </a>
          ))}
        </div>
        <div className="notfound-foot">
          <a className="auth-link" href="mailto:support@pullwise.dev">
            support@pullwise.dev
          </a>
        </div>
      </div>
    </div>
  );
}
