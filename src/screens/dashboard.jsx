import { useMemo } from "react";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { useIssues, useRepositories, useScans } from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

function Sparkline({ data, color, height = 28 }) {
  const values = data.length > 1 ? data : [0, 0];
  const w = 200;
  const h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * w;
    const y = h - 2 - ((value - min) / range) * (h - 4);
    return [x, y];
  });
  const d = points
    .map((point, index) => (index === 0 ? `M${point[0]},${point[1]}` : `L${point[0]},${point[1]}`))
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} fillOpacity={0.1} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="0" y1={h} x2={w} y2={h} stroke={color} strokeWidth={0.5} strokeOpacity={0.15} />
    </svg>
  );
}

function issueCounts(issues) {
  return issues.reduce(
    (counts, issue) => {
      const severity = issue.severity || "info";
      counts[severity] = (counts[severity] || 0) + 1;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );
}

function scanIssueTotal(scan) {
  if (!scan?.issues) return 0;
  return Object.values(scan.issues).reduce((sum, value) => sum + Number(value || 0), 0);
}

const SEVERITY_LEVELS = [
  { key: "critical", label: "Critical", color: "var(--sev-critical)" },
  { key: "high", label: "High", color: "var(--sev-high)" },
  { key: "medium", label: "Medium", color: "var(--sev-medium)" },
  { key: "low", label: "Low", color: "var(--sev-low)" },
  { key: "info", label: "Info", color: "var(--sev-info)" },
];

function IssueRow({ issue, onClick }) {
  return (
    <button type="button" className="issue-row" onClick={onClick}>
      <div className={"issue-sev sev-bg-" + issue.severity}>
        <span className="dot" style={{ background: "currentColor" }}></span>
        {issue.severity}
      </div>
      <div className="issue-id">{issue.id}</div>
      <div className="issue-main">
        <div className="issue-t">{issue.title}</div>
        <div className="issue-meta">
          <span>
            <I.FileCode size={11} /> {issue.file || issue.repo}
            {issue.line ? ":" + issue.line : ""}
          </span>
          <span className="tag">{issue.category}</span>
          <span style={{ color: "var(--text-3)" }}>
            · {Math.round(issue.confidence * 100)}% {T("confidence", "置信度")}
          </span>
        </div>
      </div>
      <div className="issue-effort">{issue.effort}</div>
      <I.ChevR size={14} style={{ color: "var(--text-4)" }} />
    </button>
  );
}

export function DashboardScreen({ go, setIssue, accent }) {
  useLang();
  const { items: issues, loading: issuesLoading, error: issuesError } = useIssues();
  const { items: scans, loading: scansLoading } = useScans();
  const {
    items: repositories,
    loading: reposLoading,
    needsAuthorization,
    workspace,
  } = useRepositories();

  const openIssues = issues.filter((issue) => issue.status === "open");
  const counts = issueCounts(openIssues);
  const latestScan = scans[0];
  const workspaceName = workspace?.name || workspace?.githubOwnerLogin || "Pullwise";

  const issueTrend = useMemo(
    () => scans.slice(0, 14).reverse().map(scanIssueTotal),
    [scans]
  );
  const issueDelta = useMemo(() => {
    if (issueTrend.length < 2) return 0;
    return issueTrend[issueTrend.length - 1] - issueTrend[0];
  }, [issueTrend]);

  const scanTrend = useMemo(
    () => scans.slice(0, 14).reverse().map(() => 1),
    [scans]
  );

  const visibleRepos = repositories.slice(0, 6);
  const hasRepos = visibleRepos.length > 0;

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: T("Overview", "总览") }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="dashboard" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Overview", "总览")}</h1>
              <div className="sub">{workspaceName}</div>
            </div>
            <div className="actions">
              <a className="btn" {...screenLinkProps(go, "repos")}>
                <I.Refresh size={14} /> {T("New scan", "新扫描")}
              </a>
            </div>
          </div>

          <div className="kpi-row">
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">{T("Open issues", "未解决问题")}</span>
                {issueDelta !== 0 && (
                  <span
                    className="kpi-d"
                    style={{ color: issueDelta > 0 ? "var(--sev-high)" : "var(--sev-low)" }}
                  >
                    {issueDelta > 0 ? "+" : ""}
                    {issueDelta}
                  </span>
                )}
              </div>
              <div className="kpi-v">{openIssues.length}</div>
              <Sparkline data={issueTrend} color={accent} />
            </div>
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">Critical</span>
              </div>
              <div className="kpi-v" style={{ color: counts.critical > 0 ? "var(--sev-critical)" : undefined }}>
                {counts.critical}
              </div>
              <div className="kpi-foot">
                {counts.critical > 0
                  ? T("Requires immediate attention", "需要立即处理")
                  : T("No critical issues found", "未发现关键问题")}
              </div>
              <Sparkline
                data={issueTrend.map(() => counts.critical)}
                color="var(--sev-critical)"
                height={20}
              />
            </div>
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">{T("Repositories", "仓库")}</span>
              </div>
              <div className="kpi-v">{reposLoading ? "-" : repositories.length}</div>
              <div className="kpi-foot">
                {needsAuthorization
                  ? T("Connect GitHub to add repositories", "连接 GitHub 以添加仓库")
                  : T("Connected to your organization", "已连接到您的组织")}
              </div>
              <Sparkline
                data={scanTrend.map(() => repositories.length)}
                color="var(--text-3)"
                height={20}
              />
            </div>
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">{T("Scans", "扫描")}</span>
              </div>
              <div className="kpi-v">{scansLoading ? "-" : scans.length}</div>
              <div className="kpi-foot">
                {latestScan
                  ? T(`Last: ${latestScan.time}`, `最近：${latestScan.time}`)
                  : T("No scans yet", "暂无扫描记录")}
              </div>
              <Sparkline data={scanTrend} color={accent} height={20} />
            </div>
          </div>

          <div className="dash-grid">
            <div className="card dash-summary">
              <div className="dash-summary-head">
                <h3>{T("Severity breakdown", "严重程度分布")}</h3>
                <a className="btn sm" {...screenLinkProps(go, "issues")}>
                  {T("All issues", "所有问题")} <I.ArrowR size={12} />
                </a>
              </div>
              <div className="dash-donut-legend" style={{ marginTop: 8 }}>
                {SEVERITY_LEVELS.map((item) => (
                  <div key={item.key} className="dash-donut-row">
                    <span className="dash-donut-dot" style={{ background: item.color }}></span>
                    <span>{item.label}</span>
                    <b>{counts[item.key]}</b>
                  </div>
                ))}
                {openIssues.length === 0 && !issuesLoading && (
                  <div className="muted" style={{ padding: "8px 0", fontSize: 12.5 }}>
                    {T("No open issues to display.", "暂无未解决问题。")}
                  </div>
                )}
              </div>
            </div>

            <div className="card dash-cats">
              <div className="dash-summary-head">
                <h3>{T("Connected repositories", "已连接仓库")}</h3>
                <a className="btn sm" {...screenLinkProps(go, "repos")}>
                  {hasRepos
                    ? <>
                        {T(`View all (${repositories.length})`, `查看全部 (${repositories.length})`)}{" "}
                        <I.ArrowR size={12} />
                      </>
                    : T("Connect", "连接")}
                </a>
              </div>
              {hasRepos &&
                visibleRepos.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    className="dash-cat-row"
                    aria-label={T(
                      `Open repository ${repo.fullName || repo.name}`,
                      `打开仓库 ${repo.fullName || repo.name}`
                    )}
                    onClick={() => go("repos")}
                  >
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}
                    >
                      <I.Folder size={13} style={{ flexShrink: 0 }} />{" "}
                      {repo.fullName || repo.name}
                    </span>
                    {repo.private ? (
                      <span className="tag" style={{ fontSize: 10.5 }}>
                        <I.Lock size={9} /> {T("Private", "私有")}
                      </span>
                    ) : (
                      <span className="tag" style={{ fontSize: 10.5 }}>
                        {T("Public", "公开")}
                      </span>
                    )}
                    <b style={{ minWidth: 18, textAlign: "right" }}>
                      <I.ChevR size={12} />
                    </b>
                  </button>
                ))}
              {!reposLoading && !hasRepos && (
                <div className="muted" style={{ padding: "20px 0", textAlign: "center" }}>
                  <div style={{ marginBottom: 8 }}>
                    {T(
                      "No repositories connected yet.",
                      "尚未连接任何仓库。",
                    )}
                  </div>
                  <a className="btn sm" {...screenLinkProps(go, "repos")}>
                    <I.Github size={13} /> {T("Connect GitHub", "连接 GitHub")}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="dash-issues-h">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{T("Needs attention", "需要关注")}</h2>
              <div className="sub" style={{ fontSize: 12.5 }}>
                {issuesLoading
                  ? T("Loading issues...", "正在加载问题...")
                  : openIssues.length > 0
                    ? T(
                        `Showing ${Math.min(openIssues.length, 8)} of ${openIssues.length} open issues`,
                        `显示 ${Math.min(openIssues.length, 8)} / ${openIssues.length} 个未解决问题`
                      )
                    : T("No open issues", "暂无未解决问题")}
              </div>
            </div>
            {openIssues.length > 0 && (
              <a className="btn sm" {...screenLinkProps(go, "issues")}>
                {T("All issues", "所有问题")} <I.ArrowR size={12} />
              </a>
            )}
          </div>

          {issuesError && <div className="card section muted">{issuesError}</div>}
          {!issuesLoading && openIssues.length === 0 && !issuesError && (
            <div className="card section muted" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ marginBottom: 8 }}>
                {scans.length > 0
                  ? T("No issues found — your repositories look clean.", "未发现问题 — 您的仓库看起来很干净。")
                  : T("Run your first scan to check for issues.", "运行第一次扫描以检查问题。")}
              </div>
              {scans.length === 0 && (
                <a className="btn sm" {...screenLinkProps(go, "repos")}>
                  <I.Refresh size={13} /> {T("Start a scan", "开始扫描")}
                </a>
              )}
            </div>
          )}
          {openIssues.length > 0 && (
            <div className="issue-list">
              {openIssues.slice(0, 8).map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  onClick={() => {
                    setIssue(issue);
                    go("issue");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
