import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, signOut } from "../lib/auth.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { scanQueueSummary, useIssues, useScans } from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function sortIssues(items, key) {
  const sorted = items.slice();
  if (key === "severity") {
    sorted.sort((a, b) => (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) || (b.confidence - a.confidence));
  }
  if (key === "confidence") sorted.sort((a, b) => b.confidence - a.confidence);
  if (key === "newest") sorted.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (key === "file") sorted.sort((a, b) => (a.file || "").localeCompare(b.file || ""));
  return sorted;
}

function issueTotal(scan) {
  if (!scan?.issues) return 0;
  return Object.values(scan.issues).reduce((sum, value) => sum + Number(value || 0), 0);
}

function scanHistorySummary(scan) {
  const queueSummary = scanQueueSummary(scan);
  if (scan.status === "queued" && queueSummary) {
    const queueTags = queueSummary.tags.filter((tag) => !tag.startsWith("Global") && !tag.startsWith("Per user"));
    return ["queued", ...queueTags].join(" - ");
  }
  if (scan.issues) return T(`${issueTotal(scan)} issues`, `${issueTotal(scan)} issues`);
  return scan.status;
}

export function IssuesScreen({ go, setIssue }) {
  useLang();
  const { items: all, loading, error, reload } = useIssues();
  const [sev, setSev] = useState("all");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const query = q.trim().toLowerCase();
  const filtered = sortIssues(
    all.filter((issue) => {
      if (sev !== "all" && issue.severity !== sev) return false;
      if (status !== "all" && issue.status !== status) return false;
      if (!query) return true;
      return [issue.title, issue.file, issue.repo, issue.category, issue.id]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    }),
    sortBy
  );

  const updateStatus = async (issue, nextStatus) => {
    await pullwiseApi.issues.updateStatus(issue.id, { status: nextStatus });
    await reload();
  };

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Pullwise", go: "dashboard" },
        { label: T("Issues", "问题") },
      ]} />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Issues", "问题")}</h1>
              <div className="sub">
                {loading ? T("Loading findings", "正在加载 findings") : T(`${filtered.length} items`, `${filtered.length} 项`)}
              </div>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => setSortBy(sortBy === "severity" ? "confidence" : "severity")}>
                <I.Sort size={14} /> {sortBy === "severity" ? T("Severity", "严重度") : T("Confidence", "置信度")}
              </button>
            </div>
          </div>

          <div className="filters card">
            <div className="filters-row">
              <div className="repos-search" style={{ flex: 1 }}>
                <I.Search size={14} />
                <input placeholder={T("Search by title, repo, or file...", "按标题、仓库或文件搜索...")} value={q} onChange={(event) => setQ(event.target.value)} />
              </div>
              <div className="seg">
                {["open", "fixed", "snoozed", "all"].map((item) => (
                  <button key={item} className={"seg-i" + (status === item ? " active" : "")} onClick={() => setStatus(item)}>
                    {item === "all" ? T("All", "全部") : item}
                  </button>
                ))}
              </div>
            </div>
            <div className="filters-row">
              <div className="filter-pills">
                <span className="filter-l">Severity</span>
                {["all", "critical", "high", "medium", "low", "info"].map((item) => (
                  <button key={item} className={"pill-btn" + (sev === item ? " active" : "")} onClick={() => setSev(item)}>
                    {item === "all" ? T("All", "全部") : <><span className="dot" style={{ background: `var(--sev-${item})` }}></span>{item}</>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="issues-table card">
            <div className="issues-thead">
              <div></div>
              <div>Issue</div>
              <div>File</div>
              <div>Category</div>
              <div>Confidence</div>
              <div>Status</div>
              <div></div>
            </div>
            {error && <div className="muted" style={{ padding: 18 }}>{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="muted" style={{ padding: 24, textAlign: "center" }}>
                {T("No findings are available yet.", "暂无 findings。")}
              </div>
            )}
            {filtered.map((issue) => (
              <div key={issue.id} className="issues-trow">
                <div></div>
                <div className="issues-title-c" onClick={() => { setIssue(issue); go("issue"); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span className={"sev sev-" + issue.severity}><span className="dot" style={{ background: "currentColor" }}></span>{issue.severity}</span>
                    <span className="issue-id">{issue.id}</span>
                  </div>
                  <div className="issue-t">{issue.title}</div>
                  <div className="muted">{issue.repo}</div>
                </div>
                <div className="issues-file">{issue.file}{issue.line ? ":" + issue.line : ""}</div>
                <div><span className="tag">{issue.category}</span></div>
                <div>
                  <div className="conf-bar"><div style={{ width: `${issue.confidence * 100}%` }}></div></div>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{Math.round(issue.confidence * 100)}%</span>
                </div>
                <div><span className="tag">{issue.status}</span></div>
                <div style={{ display: "flex", gap: 6 }}>
                  {issue.status === "open" && <button className="btn sm" onClick={() => updateStatus(issue, "snoozed")}>{T("Snooze", "推迟")}</button>}
                  {issue.status !== "fixed" && <button className="btn sm primary" onClick={() => updateStatus(issue, "fixed")}>{T("Mark fixed", "标记已修复")}</button>}
                  <button className="btn sm" onClick={() => { setIssue(issue); go("issue"); }}><I.ArrowR size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IssueDetailScreen({ go, issue }) {
  useLang();

  if (!issue) {
    return (
      <div className="app fade-in">
        <Topbar go={go} breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: T("Issue", "问题") }]} />
        <div className="with-side">
          <Sidebar section="issues" go={go} />
          <div className="main">
            <div className="card section muted">{T("Select an issue from the list first.", "请先从列表选择一个问题。")}</div>
            <button className="btn" onClick={() => go("issues")} style={{ marginTop: 12 }}><I.ArrowL size={13} /> {T("Back to issues", "返回问题列表")}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Pullwise", go: "dashboard" },
        { label: T("Issues", "问题"), go: "issues" },
        { label: issue.id },
      ]} />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <button className="btn ghost sm" onClick={() => go("issues")} style={{ marginBottom: 12 }}>
            <I.ArrowL size={13} /> {T("Back to list", "返回列表")}
          </button>
          <div className="issue-detail-h">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className={"sev sev-" + issue.severity}><span className="dot" style={{ background: "currentColor", width: 8, height: 8 }}></span>{issue.severity}</span>
                <span className="issue-id">{issue.id}</span>
                <span className="tag">{issue.category}</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>{issue.title}</h1>
              <div style={{ color: "var(--text-2)", fontSize: 13.5, marginBottom: 4 }}>{issue.summary}</div>
              <div className="sub" style={{ display: "flex", gap: 14, fontSize: 12.5, marginTop: 6 }}>
                <span><I.Folder size={12} /> {issue.repo}</span>
                <span><I.FileCode size={12} /> {issue.file}{issue.line ? ":" + issue.line : ""}</span>
                <span><I.Sparkle size={12} /> {Math.round(issue.confidence * 100)}% {T("confidence", "置信度")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryScreen({ go }) {
  useLang();
  const { items: scans, loading, error } = useScans();
  const [status, setStatus] = useState("all");
  const filtered = scans.filter((scan) => status === "all" || scan.status === status);

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: T("Scan history", "扫描历史") }]} />
      <div className="with-side">
        <Sidebar section="history" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Scan history", "扫描历史")}</h1>
              <div className="sub">{loading ? T("Loading scans", "正在加载扫描") : T(`${filtered.length} scans`, `${filtered.length} 次扫描`)}</div>
            </div>
            <div className="actions">
              <div className="seg">
                {["all", "queued", "running", "done", "failed", "cancelled"].map((item) => (
                  <button key={item} className={"seg-i" + (status === item ? " active" : "")} onClick={() => setStatus(item)}>
                    {item === "all" ? T("All", "全部") : item}
                  </button>
                ))}
              </div>
              <button className="btn primary" onClick={() => go("repos")}><I.Play size={11} /> {T("New scan", "新扫描")}</button>
            </div>
          </div>

          <div className="hist-list card">
            {error && <div className="muted" style={{ padding: 18 }}>{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                {T("No scans yet.", "暂无扫描。")}
              </div>
            )}
            {filtered.map((scan) => (
              <div key={scan.id} className="hist-row">
                <div className="hist-status">
                  {scan.status === "done" && <span className="hist-dot" style={{ background: "#16a34a" }}></span>}
                  {["queued", "running"].includes(scan.status) && <span className="spin" style={{ display: "inline-block", color: "var(--accent)" }}><I.Refresh size={12} /></span>}
                  {["failed", "cancelled"].includes(scan.status) && <span className="hist-dot" style={{ background: "var(--sev-critical)" }}></span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                    <b style={{ fontSize: 13.5 }}>{scan.repo}</b>
                    <span className="tag"><I.GitBranch size={10} /> {scan.branch}</span>
                    <span className="tag">{scan.commit}</span>
                  </div>
                  {scan.status === "queued" && scanQueueSummary(scan) && (
                    <div className="muted">{scanHistorySummary(scan)}</div>
                  )}
                  {!(scan.status === "queued" && scanQueueSummary(scan)) && (
                    <div className="muted">
                    {scan.issues ? T(`${issueTotal(scan)} issues`, `${issueTotal(scan)} 个问题`) : scan.status}
                    </div>
                  )}
                </div>
                <div className="hist-meta">
                  <div>{scan.time}</div>
                  <div className="muted">{T("Triggered by ", "触发：")}{scan.by}</div>
                </div>
                <button className="btn sm" onClick={() => go("dashboard")}>{T("View", "查看")} <I.ArrowR size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsScreen({ go }) {
  useLang();
  const [tab, setTab] = useState("profile");
  const [session, setSession] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [integrationError, setIntegrationError] = useState("");
  const integrationRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    Promise.all([
      pullwiseApi.auth.getSession(),
      pullwiseApi.integrations.list(),
    ]).then(([sessionPayload, integrationsPayload]) => {
      if (cancelled) return;
      setSession(sessionPayload);
      if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
    }).catch(() => {
      if (!cancelled) {
        setSession(null);
        if (requestId === integrationRequestIdRef.current) setIntegrations(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshGitHubRepositoryAccess = useCallback(async () => {
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    setIntegrationError("");
    try {
      await pullwiseApi.repositories.sync();
      const integrationsPayload = await pullwiseApi.integrations.list();
      if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
    } catch (error) {
      if (requestId === integrationRequestIdRef.current) {
        setIntegrationError(error?.message || "Unable to refresh GitHub repository access.");
      }
      throw error;
    }
  }, []);

  useGitHubRepositoryAccessAutoRefresh(refreshGitHubRepositoryAccess);

  const github = integrations?.github;
  const user = session?.user;
  const githubRepoCount = github?.repositories?.length || 0;
  const githubAccountNames = Array.from(new Set([
    ...(Array.isArray(github?.installationAccounts) ? github.installationAccounts : []),
    github?.installationAccount,
  ].filter(Boolean)));
  const githubAccount = githubAccountNames.length ? ` on ${githubAccountNames.join(", ")}` : "";
  const authorizeRepositories = async () => {
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    setIntegrationError("");
    try {
      await connectGitHubRepositories(github?.connected ? { add: true } : {});
      const integrationsPayload = await pullwiseApi.integrations.list();
      if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
    } catch (error) {
      if (requestId === integrationRequestIdRef.current) {
        setIntegrationError(error?.message || "Unable to connect GitHub repository access.");
      }
    }
  };
  const githubAccountZh = githubAccountNames.length ? `（${githubAccountNames.join(", ")}）` : "";

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: T("Settings", "设置") }]} />
      <div className="with-side">
        <Sidebar section="settings" go={go} />
        <div className="main">
          <div className="page-h">
            <div>
              <h1>{T("Settings", "设置")}</h1>
              <div className="sub">{T("Account and integrations", "账号与集成")}</div>
            </div>
          </div>
          <div className="set-shell">
            <aside className="set-side">
              {[
                { k: "profile", t: T("Profile", "个人资料"), i: <I.User size={14} /> },
                { k: "integrations", t: T("Integrations", "集成"), i: <I.Github size={14} /> },
              ].map((item) => (
                <button key={item.k} className={"set-side-i" + (tab === item.k ? " active" : "")} onClick={() => setTab(item.k)}>
                  {item.i}<span>{item.t}</span>
                </button>
              ))}
            </aside>
            <div className="set-body">
              {tab === "profile" && (
                <div className="card section">
                  <div className="section-h"><h3>{T("Profile", "个人资料")}</h3></div>
                  <div className="set-row">
                    <div className="set-av" style={{ background: "var(--accent)" }}>{(user?.name || "?").slice(0, 1).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <label className="auth-field"><span>{T("Name", "姓名")}</span><div className="auth-input"><input value={user?.name || ""} readOnly /></div></label>
                    </div>
                  </div>
                  <label className="auth-field"><span>{T("Email", "邮箱")}</span><div className="auth-input"><I.Mail size={13} /><input value={user?.email || ""} readOnly /></div></label>
                  <div className="set-pref">
                    <div>
                      <b>{T("Session", "会话")}</b>
                      <div className="muted">{T("Stay signed in for 7 days on this browser.", "此浏览器保持登录 7 天。")}</div>
                    </div>
                    <button className="btn sm" onClick={signOut}>{T("Sign out", "退出登录")}</button>
                  </div>
                </div>
              )}
              {tab === "integrations" && (
                <div className="card section">
                  <div className="section-h"><h3>{T("Personal authorizations", "个人授权")}</h3></div>
                  <div className="int-row">
                    <I.Github size={20} />
                    <div style={{ flex: 1 }}>
                      <b>{T("GitHub repository authorization", "GitHub 仓库授权")}</b>
                      <div className="muted">
                        {github?.connected
                          ? T(
                              `${githubRepoCount} repositories authorized${githubAccount}`,
                              `${githubRepoCount} 个仓库已授权${githubAccountZh}`
                            )
                          : T(
                              "Connect repositories when you are ready to scan. Pullwise only requests read-only repository contents.",
                              "准备扫描时再连接仓库。Pullwise 只请求仓库内容只读权限。"
                            )}
                      </div>
                    </div>
                    <span className="pill sev-bg-low" style={{ background: "color-mix(in oklch, #16a34a 14%, transparent)", color: "#16a34a" }}>
                      <span className="dot"></span> {github?.connected ? T("Connected", "已连接") : T("Disconnected", "未连接")}
                    </span>
                    <button className="btn sm" onClick={authorizeRepositories}>
                      {github?.connected
                        ? T("Add account or organization", "添加账号或组织")
                        : T("Connect repositories", "连接仓库")}
                    </button>
                  </div>
                  {github?.connected && <GitHubInstallationsList installations={github?.installations} />}
                  {integrationError && <div className="auth-error" role="alert"><I.X size={13} /> {integrationError}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
