// shell.jsx — Topbar + Sidebar + AppShell (used across authed screens)

import React from "react";
import { FIXTURES } from "./data.jsx";
import { I } from "./icons.jsx";
import { T, useLang } from "./i18n.jsx";

export function Topbar({ go, breadcrumbs }) {
  useLang();
  const [bellOpen, setBellOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
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
            {breadcrumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="sep">/</span>}
                <span className={i === breadcrumbs.length - 1 ? "now" : ""} onClick={() => c.go && go(c.go)}>{c.label}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost sm" onClick={() => setSearchOpen(true)}>
          <I.Search size={14} /> <span style={{ color: "var(--text-3)" }}>{T("Search…", "搜索…")}</span> <span className="kbd" style={{ marginLeft: 6 }}>⌘K</span>
        </button>
        <span style={{ position: "relative" }}>
          <button className="btn ghost sm" onClick={() => setBellOpen(o => !o)} aria-haspopup="menu" aria-expanded={bellOpen}>
            <I.Bell size={14} />
            <span style={{ position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 999, background: "var(--sev-critical)", boxShadow: "0 0 0 2px var(--bg-elev)" }} />
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
  const items = [
    { sev: "critical", icon: <I.Shield size={14} />, t: T("2 critical issues found","发现 2 个 critical 问题"), s: T("billing-service · just now","billing-service · 刚刚"), screen: "issues" },
    { sev: null, icon: <I.GitPull size={14} />, t: T("PR #482 merged","PR #482 已合并"), s: T("fix(security): remove hardcoded API key · 2h ago","fix(security): 移除硬编码 API key · 2 小时前") },
    { sev: null, icon: <I.Sparkle size={14} />, t: T("axios CVE auto-fix applied","axios CVE 自动修复已应用"), s: T("billing-service@main · yesterday","billing-service@main · 昨天") },
    { sev: null, icon: <I.Activity size={14} />, t: T("Weekly report ready","每周报告已就绪"), s: T("Monday morning · 4d ago","周一早上 · 4 天前") },
    { sev: null, icon: <I.Bug size={14} />, t: T("Coverage dropped to 62%","覆盖率降至 62%"), s: T("billing-service · 1w ago","billing-service · 1 周前"), screen: "dashboard" },
  ];
  return (
    <>
      <div className="pop-back" onClick={close} />
      <div className="pop pop-bell" role="menu">
        <div className="pop-h">
          <span><I.Bell size={12} /> {T("Notifications","通知")}</span>
          <a className="auth-link" onClick={() => { close(); go("settings"); }}>{T("Preferences","偏好")}</a>
        </div>
        <div className="pop-body">
          {items.map((n, i) => (
            <button
              key={i}
              className="pop-i"
              onClick={() => { if (n.screen) { close(); go(n.screen); } }}
              style={{ cursor: n.screen ? "pointer" : "default" }}
            >
              <div className="pop-i-ic" style={{ color: n.sev ? `var(--sev-${n.sev})` : "var(--text-3)" }}>{n.icon}</div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div className="pop-i-t">{n.t}</div>
                <div className="pop-i-s">{n.s}</div>
              </div>
              {n.sev && <span className="dot" style={{ width: 6, height: 6, borderRadius: 999, background: `var(--sev-${n.sev})` }} />}
            </button>
          ))}
        </div>
        <div className="pop-foot">
          <button className="btn sm ghost" style={{ width: "100%" }} onClick={close}>{T("Mark all as read","全部标为已读")}</button>
        </div>
      </div>
    </>
  );
}

function SearchModal({ close, go }) {
  useLang();
  const [q, setQ] = React.useState("");
  const ql = q.trim().toLowerCase();
  const issues = FIXTURES.ISSUES.filter(i =>
    !ql || i.title.toLowerCase().includes(ql) || i.id.toLowerCase().includes(ql) || i.file.toLowerCase().includes(ql) || i.category.toLowerCase().includes(ql)
  ).slice(0, 5);
  const repos = FIXTURES.REPOS.filter(r =>
    !ql || r.name.toLowerCase().includes(ql) || r.desc.toLowerCase().includes(ql)
  ).slice(0, 4);
  const allPages = [
    { k: "dashboard", t: T("Overview","总览"), i: <I.Layout size={14} /> },
    { k: "issues",    t: "Issues",                i: <I.Bug size={14} /> },
    { k: "repos",     t: T("Repositories","仓库"), i: <I.Folder size={14} /> },
    { k: "history",   t: T("Scan history","扫描历史"), i: <I.Clock size={14} /> },
    { k: "settings",  t: T("Settings","设置"),    i: <I.Settings size={14} /> },
    { k: "pricing",   t: T("Pricing","定价"),     i: <I.Tag size={14} /> },
    { k: "docs",      t: T("Docs","文档"),         i: <I.FileCode size={14} /> },
  ];
  const pages = allPages.filter(p => !ql || p.t.toLowerCase().includes(ql) || p.k.includes(ql));

  const empty = issues.length === 0 && repos.length === 0 && pages.length === 0;

  return (
    <div className="modal-back" onClick={close}>
      <div className="modal modal-search" onClick={e => e.stopPropagation()}>
        <div className="search-h">
          <I.Search size={16} />
          <input
            autoFocus
            placeholder={T("Search issues, repos, pages…","搜索 issue、仓库、页面…")}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="search-body">
          {issues.length > 0 && (
            <div className="search-g">
              <div className="search-gh">{T("Issues","问题")} · {issues.length}</div>
              {issues.map(it => (
                <button key={it.id} className="search-i" onClick={() => { close(); go("issues"); }}>
                  <span className={"sev sev-" + it.severity} style={{ flex: "0 0 auto" }}>
                    <span className="dot" style={{ background: "currentColor" }} />{it.severity}
                  </span>
                  <div className="search-i-t" style={{ flex: 1, minWidth: 0 }}>
                    <div className="search-i-tt">{it.title}</div>
                    <div className="search-i-s">{it.id} · {it.file}{it.line ? ":" + it.line : ""}</div>
                  </div>
                  <I.ArrowR size={11} style={{ color: "var(--text-4)" }} />
                </button>
              ))}
            </div>
          )}
          {repos.length > 0 && (
            <div className="search-g">
              <div className="search-gh">{T("Repositories","仓库")} · {repos.length}</div>
              {repos.map(r => (
                <button key={r.id} className="search-i" onClick={() => { close(); go("repos"); }}>
                  <I.Folder size={14} style={{ color: "var(--text-3)" }} />
                  <div className="search-i-t" style={{ flex: 1, minWidth: 0 }}>
                    <div className="search-i-tt">{r.name}</div>
                    <div className="search-i-s">{r.desc}</div>
                  </div>
                  {r.private && <span className="tag"><I.Lock size={10} /> private</span>}
                </button>
              ))}
            </div>
          )}
          {pages.length > 0 && (
            <div className="search-g">
              <div className="search-gh">{T("Pages","页面")} · {pages.length}</div>
              {pages.map(p => (
                <button key={p.k} className="search-i" onClick={() => { close(); go(p.k); }}>
                  <span style={{ color: "var(--text-3)", display: "inline-flex" }}>{p.i}</span>
                  <span className="search-i-t" style={{ flex: 1, textAlign: "left" }}>{p.t}</span>
                  <I.ArrowR size={11} style={{ color: "var(--text-4)" }} />
                </button>
              ))}
            </div>
          )}
          {empty && (
            <div className="search-empty">{T("No results for","无匹配结果")} <b>“{q}”</b></div>
          )}
        </div>
        <div className="search-foot">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> {T("Navigate","选择")}</span>
          <span><span className="kbd">⏎</span> {T("Open","打开")}</span>
          <span><span className="kbd">ESC</span> {T("Close","关闭")}</span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ section, go }) {
  useLang();
  const items = [
    { k: "dashboard", label: T("Overview", "总览"), icon: <I.Layout size={15} />, badge: null },
    { k: "issues", label: T("Issues", "问题"), icon: <I.Bug size={15} />, badge: 11 },
    { k: "repos", label: T("Repositories", "仓库"), icon: <I.Folder size={15} />, badge: null },
    { k: "history", label: T("Scan history", "扫描历史"), icon: <I.Clock size={15} />, badge: null },
    { k: "settings", label: T("Settings", "设置"), icon: <I.Settings size={15} />, badge: null },
  ];
  return (
    <aside className="side">
      <div className="side-h">{T("Workspace", "工作区")}</div>
      <button className="side-i">
        <div style={{ width: 18, height: 18, borderRadius: 4, background: "linear-gradient(135deg, var(--accent), color-mix(in oklch, var(--accent) 60%, #000))", display: "grid", placeItems: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}>A</div>
        <span>Acme Inc</span>
        <I.ChevD size={13} style={{ marginLeft: "auto", opacity: .6 }} />
      </button>

      <div className="side-h" style={{ marginTop: 6 }}>{T("Navigation", "导航")}</div>
      {items.map(i => (
        <button key={i.k} className={"side-i" + (section === i.k ? " active" : "")} onClick={() => go(i.k)}>
          <div className="ic">{i.icon}</div>
          <span>{i.label}</span>
          {i.badge != null && <span className="badge">{i.badge}</span>}
        </button>
      ))}

      <div className="side-h" style={{ marginTop: 6 }}>{T("Pinned repos", "固定仓库")}</div>
      {[
        { n: "billing-service", c: "var(--sev-critical)" },
        { n: "portfolio-2025", c: "var(--accent)" },
        { n: "dotfiles", c: "var(--text-3)" },
      ].map(r => (
        <button key={r.n} className="side-i">
          <span style={{ width: 6, height: 6, borderRadius: 999, background: r.c, marginLeft: 4, marginRight: 4 }}></span>
          <span style={{ fontSize: 12.5 }}>{r.n}</span>
        </button>
      ))}

      <div style={{ marginTop: "auto", padding: "12px 6px 0" }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{T("Pro plan", "Pro 计划")}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}>{T("Unlimited private scans · Advanced lenses", "无限私有扫描 · 高级 lens")}</div>
          <button className="btn sm primary" style={{ width: "100%" }}>{T("Upgrade", "升级")}</button>
        </div>
      </div>
    </aside>
  );
}
