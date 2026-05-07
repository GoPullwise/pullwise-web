import React from "react";
import { I } from "./icons.jsx";
import { T, useLang } from "./i18n.jsx";
import { useIssues, useRepositories } from "./lib/pullwise-data.js";

export function Topbar({ go, breadcrumbs }) {
  useLang();
  const [bellOpen, setBellOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "Escape") {
        setSearchOpen(false);
        setBellOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div className="brand" onClick={() => go("landing")} style={{ cursor: "default" }}>
          <div className="brand-mark">PR</div>
          <span>Pullwise</span>
        </div>
        {breadcrumbs && (
          <div className="crumbs">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <span className="sep">/</span>}
                <span className={index === breadcrumbs.length - 1 ? "now" : ""} onClick={() => crumb.go && go(crumb.go)}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost sm" onClick={() => setSearchOpen(true)}>
          <I.Search size={14} /> <span style={{ color: "var(--text-3)" }}>{T("Search...", "搜索...")}</span> <span className="kbd" style={{ marginLeft: 6 }}>⌘K</span>
        </button>
        <span style={{ position: "relative" }}>
          <button className="btn ghost sm" onClick={() => setBellOpen((open) => !open)} aria-haspopup="menu" aria-expanded={bellOpen}>
            <I.Bell size={14} />
          </button>
          {bellOpen && <BellPopover close={() => setBellOpen(false)} go={go} />}
        </span>
        <button className="btn ghost sm" onClick={() => go("settings")}><I.User size={14} /></button>
      </div>

      {searchOpen && <SearchModal close={() => setSearchOpen(false)} go={go} />}
    </header>
  );
}

function BellPopover({ close, go }) {
  useLang();
  return (
    <>
      <div className="pop-back" onClick={close} />
      <div className="pop pop-bell" role="menu">
        <div className="pop-h">
          <span><I.Bell size={12} /> {T("Notifications", "通知")}</span>
          <a className="auth-link" onClick={() => { close(); go("settings"); }}>{T("Preferences", "偏好")}</a>
        </div>
        <div className="pop-body">
          <div className="muted" style={{ padding: 16, fontSize: 13 }}>{T("No notifications yet.", "暂无通知。")}</div>
        </div>
        <div className="pop-foot" style={{ gap: 6 }}>
          <button className="btn sm" style={{ flex: 1 }} onClick={() => { close(); go("notifications"); }}>
            {T("View all", "查看全部")} <I.ArrowR size={11} />
          </button>
        </div>
      </div>
    </>
  );
}

function SearchModal({ close, go }) {
  useLang();
  const [q, setQ] = React.useState("");
  const { items: issues } = useIssues();
  const { items: repos } = useRepositories();
  const query = q.trim().toLowerCase();
  const issueResults = issues.filter((issue) =>
    !query || [issue.title, issue.id, issue.file, issue.category, issue.repo].filter(Boolean).some((value) => value.toLowerCase().includes(query))
  ).slice(0, 5);
  const repoResults = repos.filter((repo) =>
    !query || [repo.name, repo.fullName, repo.desc].filter(Boolean).some((value) => value.toLowerCase().includes(query))
  ).slice(0, 4);
  const allPages = [
    { k: "dashboard", t: T("Overview", "总览"), i: <I.Layout size={14} /> },
    { k: "issues", t: T("Issues", "问题"), i: <I.Bug size={14} /> },
    { k: "repos", t: T("Repositories", "仓库"), i: <I.Folder size={14} /> },
    { k: "history", t: T("Scan history", "扫描历史"), i: <I.Clock size={14} /> },
    { k: "settings", t: T("Settings", "设置"), i: <I.Settings size={14} /> },
    { k: "pricing", t: T("Pricing", "定价"), i: <I.Tag size={14} /> },
    { k: "docs", t: T("Docs", "文档"), i: <I.FileCode size={14} /> },
  ];
  const pages = allPages.filter((page) => !query || page.t.toLowerCase().includes(query) || page.k.includes(query));
  const empty = issueResults.length === 0 && repoResults.length === 0 && pages.length === 0;

  return (
    <div className="modal-back" onClick={close}>
      <div className="modal modal-search" onClick={(event) => event.stopPropagation()}>
        <div className="search-h">
          <I.Search size={16} />
          <input
            autoFocus
            placeholder={T("Search issues, repos, pages...", "搜索问题、仓库、页面...")}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="search-body">
          {issueResults.length > 0 && (
            <div className="search-g">
              <div className="search-gh">{T("Issues", "问题")} · {issueResults.length}</div>
              {issueResults.map((issue) => (
                <button key={issue.id} className="search-i" onClick={() => { close(); go("issues"); }}>
                  <span className={"sev sev-" + issue.severity} style={{ flex: "0 0 auto" }}>
                    <span className="dot" style={{ background: "currentColor" }} />{issue.severity}
                  </span>
                  <div className="search-i-t" style={{ flex: 1, minWidth: 0 }}>
                    <div className="search-i-tt">{issue.title}</div>
                    <div className="search-i-s">{issue.id} · {issue.file}{issue.line ? ":" + issue.line : ""}</div>
                  </div>
                  <I.ArrowR size={11} style={{ color: "var(--text-4)" }} />
                </button>
              ))}
            </div>
          )}
          {repoResults.length > 0 && (
            <div className="search-g">
              <div className="search-gh">{T("Repositories", "仓库")} · {repoResults.length}</div>
              {repoResults.map((repo) => (
                <button key={repo.id} className="search-i" onClick={() => { close(); go("repos"); }}>
                  <I.Folder size={14} style={{ color: "var(--text-3)" }} />
                  <div className="search-i-t" style={{ flex: 1, minWidth: 0 }}>
                    <div className="search-i-tt">{repo.fullName || repo.name}</div>
                    <div className="search-i-s">{repo.desc}</div>
                  </div>
                  {repo.private && <span className="tag"><I.Lock size={10} /> private</span>}
                </button>
              ))}
            </div>
          )}
          {pages.length > 0 && (
            <div className="search-g">
              <div className="search-gh">{T("Pages", "页面")} · {pages.length}</div>
              {pages.map((page) => (
                <button key={page.k} className="search-i" onClick={() => { close(); go(page.k); }}>
                  <span style={{ color: "var(--text-3)", display: "inline-flex" }}>{page.i}</span>
                  <span className="search-i-t" style={{ flex: 1, textAlign: "left" }}>{page.t}</span>
                  <I.ArrowR size={11} style={{ color: "var(--text-4)" }} />
                </button>
              ))}
            </div>
          )}
          {empty && <div className="search-empty">{T("No results for", "无匹配结果")} <b>{q}</b></div>}
        </div>
        <div className="search-foot">
          <span><span className="kbd">ESC</span> {T("Close", "关闭")}</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ section, go }) {
  useLang();
  const { items: repos } = useRepositories();
  const { items: issues } = useIssues();
  const openIssueCount = issues.filter((issue) => issue.status === "open").length;
  const items = [
    { k: "dashboard", label: T("Overview", "总览"), icon: <I.Layout size={15} />, badge: null },
    { k: "issues", label: T("Issues", "问题"), icon: <I.Bug size={15} />, badge: openIssueCount || null },
    { k: "repos", label: T("Repositories", "仓库"), icon: <I.Folder size={15} />, badge: null },
    { k: "history", label: T("Scan history", "扫描历史"), icon: <I.Clock size={15} />, badge: null },
    { k: "notifications", label: T("Notifications", "通知"), icon: <I.Bell size={15} />, badge: null },
    { k: "settings", label: T("Settings", "设置"), icon: <I.Settings size={15} />, badge: null },
  ];
  return (
    <aside className="side">
      <div className="side-h">{T("Workspace", "工作区")}</div>
      <button className="side-i">
        <div style={{ width: 18, height: 18, borderRadius: 4, background: "linear-gradient(135deg, var(--accent), color-mix(in oklch, var(--accent) 60%, #000))", display: "grid", placeItems: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}>P</div>
        <span>Pullwise</span>
        <I.ChevD size={13} style={{ marginLeft: "auto", opacity: 0.6 }} />
      </button>

      <div className="side-h" style={{ marginTop: 6 }}>{T("Navigation", "导航")}</div>
      {items.map((item) => (
        <button key={item.k} className={"side-i" + (section === item.k ? " active" : "")} onClick={() => go(item.k)}>
          <div className="ic">{item.icon}</div>
          <span>{item.label}</span>
          {item.badge != null && <span className="badge">{item.badge}</span>}
        </button>
      ))}

      <div className="side-h" style={{ marginTop: 6 }}>{T("Authorized repos", "已授权仓库")}</div>
      {repos.slice(0, 3).map((repo) => (
        <button key={repo.id} className="side-i" onClick={() => go("repos")}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)", marginLeft: 4, marginRight: 4 }}></span>
          <span style={{ fontSize: 12.5 }}>{repo.name}</span>
        </button>
      ))}
      {repos.length === 0 && (
        <button className="side-i" onClick={() => go("oauth")}>
          <I.Github size={14} />
          <span style={{ fontSize: 12.5 }}>{T("Connect GitHub", "连接 GitHub")}</span>
        </button>
      )}

      <div style={{ marginTop: "auto", padding: "12px 6px 0" }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{T("Free plan", "免费计划")}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}>{T("Real GitHub data", "真实 GitHub 数据")}</div>
          <button className="btn sm primary" style={{ width: "100%" }} onClick={() => go("pricing")}>{T("Upgrade", "升级")}</button>
        </div>
      </div>
    </aside>
  );
}
