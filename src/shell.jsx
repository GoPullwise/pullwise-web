import React from "react";
import { I } from "./icons.jsx";
import { T, useLang } from "./i18n.jsx";
import { connectGitHubRepositories } from "./lib/auth.js";
import { screenLinkProps } from "./lib/navigation.js";
import { useIssues, useRepositories } from "./lib/pullwise-data.js";

export function Topbar({ go, breadcrumbs, setIssue = null }) {
  useLang();
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <a
          className="brand topbar-brand-button"
          aria-label="Go to Pullwise home"
          {...screenLinkProps(go, "landing")}
        >
          <img className="brand-mark" src="/favicon.ico" alt="" aria-hidden="true" width="24" height="24" />
          <span>Pullwise</span>
        </a>
        {breadcrumbs && (
          <nav className="crumbs" aria-label="Breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <span className="sep">/</span>}
                {crumb.go && index !== breadcrumbs.length - 1 ? (
                  <a
                    className="crumb-button"
                    aria-label={`Go to ${crumb.label}`}
                    {...screenLinkProps(go, crumb.go)}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="crumb-label now" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost sm" onClick={() => setSearchOpen(true)}>
          <I.Search size={14} />{" "}
          <span style={{ color: "var(--text-3)" }}>{T("Search...", "搜索...")}</span>{" "}
          <span className="kbd" style={{ marginLeft: 6 }}>
            ⌘K
          </span>
        </button>
        <a
          className="btn ghost sm"
          aria-label="Open account settings"
          {...screenLinkProps(go, "settings")}
        >
          <I.User size={14} />
        </a>
      </div>

      {searchOpen && <SearchModal close={() => setSearchOpen(false)} go={go} setIssue={setIssue} />}
    </header>
  );
}

function SearchModal({ close, go, setIssue }) {
  useLang();
  const [q, setQ] = React.useState("");
  const { items: issues } = useIssues();
  const { items: repos } = useRepositories();
  const query = q.trim().toLowerCase();
  const issueResults = issues
    .filter(
      (issue) =>
        !query ||
        [issue.title, issue.id, issue.file, issue.category, issue.repo]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
    )
    .slice(0, 5);
  const repoResults = repos
    .filter(
      (repo) =>
        !query ||
        [repo.name, repo.fullName, repo.desc]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
    )
    .slice(0, 4);
  const allPages = [
    { k: "dashboard", t: T("Overview", "总览"), i: <I.Layout size={14} /> },
    { k: "issues", t: T("Issues", "问题"), i: <I.Bug size={14} /> },
    { k: "repos", t: T("Repositories", "仓库"), i: <I.Folder size={14} /> },
    { k: "history", t: T("Scan history", "扫描历史"), i: <I.Clock size={14} /> },
    { k: "apiKeys", t: T("API Keys", "API Keys"), i: <I.Code size={14} /> },
    { k: "billing", t: T("Billing", "支付"), i: <I.Package size={14} /> },
    { k: "pricing", t: T("Pricing", "Pricing"), i: <I.Trend size={14} /> },
    { k: "api", t: T("API docs", "API docs"), i: <I.FileCode size={14} /> },
    { k: "settings", t: T("Settings", "设置"), i: <I.Settings size={14} /> },
  ];
  const pages = allPages.filter(
    (page) => !query || page.t.toLowerCase().includes(query) || page.k.includes(query)
  );
  const empty = issueResults.length === 0 && repoResults.length === 0 && pages.length === 0;
  const openIssue = (issue) => {
    if (typeof setIssue === "function") {
      setIssue(issue);
      close();
      go("issue");
      return;
    }
    close();
    go("issues");
  };

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
              <div className="search-gh">
                {T("Issues", "问题")} · {issueResults.length}
              </div>
              {issueResults.map((issue) => (
                <button key={issue.id} className="search-i" onClick={() => openIssue(issue)}>
                  <span className={"sev sev-" + issue.severity} style={{ flex: "0 0 auto" }}>
                    <span className="dot" style={{ background: "currentColor" }} />
                    {issue.severity}
                  </span>
                  <div className="search-i-t" style={{ flex: 1, minWidth: 0 }}>
                    <div className="search-i-tt">{issue.title}</div>
                    <div className="search-i-s">
                      {issue.id} · {issue.file}
                      {issue.line ? ":" + issue.line : ""}
                    </div>
                  </div>
                  <I.ArrowR size={11} style={{ color: "var(--text-4)" }} />
                </button>
              ))}
            </div>
          )}
          {repoResults.length > 0 && (
            <div className="search-g">
              <div className="search-gh">
                {T("Repositories", "仓库")} · {repoResults.length}
              </div>
              {repoResults.map((repo) => (
                <button
                  key={repo.id}
                  className="search-i"
                  onClick={() => {
                    close();
                    go("repos");
                  }}
                >
                  <I.Folder size={14} style={{ color: "var(--text-3)" }} />
                  <div className="search-i-t" style={{ flex: 1, minWidth: 0 }}>
                    <div className="search-i-tt">{repo.fullName || repo.name}</div>
                    <div className="search-i-s">{repo.desc}</div>
                  </div>
                  {repo.private && (
                    <span className="tag">
                      <I.Lock size={10} /> private
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {pages.length > 0 && (
            <div className="search-g">
              <div className="search-gh">
                {T("Pages", "页面")} · {pages.length}
              </div>
              {pages.map((page) => (
                <button
                  key={page.k}
                  className="search-i"
                  onClick={() => {
                    close();
                    go(page.k);
                  }}
                >
                  <span style={{ color: "var(--text-3)", display: "inline-flex" }}>{page.i}</span>
                  <span className="search-i-t" style={{ flex: 1, textAlign: "left" }}>
                    {page.t}
                  </span>
                  <I.ArrowR size={11} style={{ color: "var(--text-4)" }} />
                </button>
              ))}
            </div>
          )}
          {empty && (
            <div className="search-empty">
              {T("No results for", "无匹配结果")} <b>{q}</b>
            </div>
          )}
        </div>
        <div className="search-foot">
          <span>
            <span className="kbd">ESC</span> {T("Close", "关闭")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ section, go }) {
  useLang();
  const { items: repos } = useRepositories();
  const { items: issues, meta: issueMeta = {} } = useIssues({ status: "open", limit: 1 });
  const [connecting, setConnecting] = React.useState(false);
  const openIssueCount = Number.isFinite(Number(issueMeta.total))
    ? Number(issueMeta.total)
    : issues.length;
  const connectRepositories = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      await connectGitHubRepositories();
    } catch {
      // Repositories screen owns the retry/error UI for repository authorization.
    } finally {
      go("repos");
      setConnecting(false);
    }
  };
  const items = [
    { k: "dashboard", label: T("Overview", "总览"), icon: <I.Layout size={15} />, badge: null },
    {
      k: "issues",
      label: T("Issues", "问题"),
      icon: <I.Bug size={15} />,
      badge: openIssueCount || null,
    },
    { k: "repos", label: T("Repositories", "仓库"), icon: <I.Folder size={15} />, badge: null },
    {
      k: "history",
      label: T("Scan history", "扫描历史"),
      icon: <I.Clock size={15} />,
      badge: null,
    },
    { k: "apiKeys", label: T("API Keys", "API Keys"), icon: <I.Code size={15} />, badge: null },
    { k: "billing", label: T("Billing", "支付"), icon: <I.Package size={15} />, badge: null },
    { k: "settings", label: T("Settings", "设置"), icon: <I.Settings size={15} />, badge: null },
  ];
  return (
    <aside className="side">
      <div className="side-group side-nav" aria-label={T("Navigation", "导航")}>
        <div className="side-h" style={{ marginTop: 6 }}>
          {T("Navigation", "导航")}
        </div>
        {items.map((item) => (
          <a
            key={item.k}
            className={"side-i" + (section === item.k ? " active" : "")}
            {...screenLinkProps(go, item.k)}
          >
            <div className="ic">{item.icon}</div>
            <span>{item.label}</span>
            {item.badge != null && <span className="badge">{item.badge}</span>}
          </a>
        ))}
      </div>

      <div className="side-group side-repos">
        <div className="side-h" style={{ marginTop: 6 }}>
          {T("Repository access", "Repository access")}
        </div>
        {repos.length > 0 ? (
          <a className="side-i side-repo-i" {...screenLinkProps(go, "repos")}>
            <I.Folder size={14} />
            <span style={{ fontSize: 12.5 }}>
              {T(`${repos.length} repositories`, `${repos.length} repositories`)}
            </span>
          </a>
        ) : (
          <button
            className="side-i side-repo-i"
            onClick={connectRepositories}
            disabled={connecting}
          >
            {connecting ? (
              <span className="spin" style={{ display: "inline-block" }}>
                <I.Refresh size={14} />
              </span>
            ) : (
              <I.Github size={14} />
            )}
            <span style={{ fontSize: 12.5 }}>
              {connecting
                ? T("Opening GitHub...", "Opening GitHub...")
                : T("Connect GitHub", "连接 GitHub")}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
