import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { useIssues, useRepositories, useScans } from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

function Sparkline({ data, color, w = 180, h = 36 }) {
  const values = data.length ? data : [0, 0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * w;
    const y = h - ((value - min) / range) * h;
    return [x, y];
  });
  const d = points
    .map((point, index) => (index === 0 ? `M${point[0]},${point[1]}` : `L${point[0]},${point[1]}`))
    .join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} fillOpacity={0.12} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function IssueRow({ issue, onClick }) {
  return (
    <div className="issue-row" onClick={onClick}>
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
    </div>
  );
}

export function DashboardScreen({ go, layout, setIssue, accent }) {
  useLang();
  const { items: issues, loading: issuesLoading, error: issuesError } = useIssues();
  const { items: scans, loading: scansLoading } = useScans();
  const { items: repositories, loading: reposLoading, needsAuthorization } = useRepositories();
  const openIssues = issues.filter((issue) => issue.status === "open");
  const counts = issueCounts(openIssues);
  const latestScan = scans[0];
  const trend = scans.slice(0, 14).reverse().map(scanIssueTotal);
  const activeRepo =
    latestScan?.repo || repositories[0]?.fullName || repositories[0]?.name || "Pullwise";

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: activeRepo }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="dashboard" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Overview", "总览")}</h1>
              <div
                className="sub"
                style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
              >
                {latestScan ? (
                  <>
                    <span className="tag">
                      <I.GitBranch size={10} /> {latestScan.branch}
                    </span>
                    <span className="tag">{latestScan.commit}</span>
                    <span>
                      {T(`Last scan: ${latestScan.time}`, `最近扫描：${latestScan.time}`)}
                    </span>
                  </>
                ) : (
                  <span>{T("No scans yet", "暂无扫描记录")}</span>
                )}
              </div>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => go("repos")}>
                <I.Refresh size={14} /> {T("New scan", "新扫描")}
              </button>
            </div>
          </div>

          <div className="kpi-row">
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">{T("Open issues", "未解决问题")}</span>
              </div>
              <div className="kpi-v">{openIssues.length}</div>
              <Sparkline data={trend} color={accent} />
            </div>
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">Critical</span>
              </div>
              <div className="kpi-v" style={{ color: "var(--sev-critical)" }}>
                {counts.critical}
              </div>
              <div className="kpi-foot">{T("From stored scan results", "来自已保存扫描结果")}</div>
            </div>
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">{T("Authorized repos", "已授权仓库")}</span>
              </div>
              <div className="kpi-v">{reposLoading ? "-" : repositories.length}</div>
              <div className="kpi-foot">
                {needsAuthorization
                  ? T("GitHub authorization required", "需要 GitHub 授权")
                  : T("GitHub App access", "GitHub App 权限")}
              </div>
            </div>
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">{T("Scans", "扫描")}</span>
              </div>
              <div className="kpi-v">{scansLoading ? "-" : scans.length}</div>
              <div className="kpi-foot">
                {T("Persisted in server SQLite", "已持久化到 server SQLite")}
              </div>
            </div>
          </div>

          <div className="dash-grid">
            <div className="card dash-summary">
              <div className="dash-summary-head">
                <h3>{T("Issue distribution", "问题分布")}</h3>
                <button className="btn sm" onClick={() => go("issues")}>
                  {T("All issues", "所有问题")} <I.ArrowR size={12} />
                </button>
              </div>
              <div className="dash-donut-legend" style={{ marginTop: 12 }}>
                {[
                  { key: "critical", label: "Critical", color: "var(--sev-critical)" },
                  { key: "high", label: "High", color: "var(--sev-high)" },
                  { key: "medium", label: "Medium", color: "var(--sev-medium)" },
                  { key: "low", label: "Low", color: "var(--sev-low)" },
                ].map((item) => (
                  <div key={item.key} className="dash-donut-row">
                    <span className="dash-donut-dot" style={{ background: item.color }}></span>
                    <span>{item.label}</span>
                    <b>{counts[item.key]}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="card dash-cats">
              <div className="dash-summary-head">
                <h3>{T("Repositories", "仓库")}</h3>
              </div>
              {repositories.slice(0, 7).map((repo) => (
                <div key={repo.id} className="dash-cat-row">
                  <span
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 180 }}
                  >
                    <I.Folder size={13} /> {repo.fullName || repo.name}
                  </span>
                  <div className="dash-cat-bar">
                    <div style={{ width: "100%", background: "var(--accent)" }}></div>
                  </div>
                  <b style={{ minWidth: 18, textAlign: "right" }}>
                    {repo.private ? <I.Lock size={12} /> : ""}
                  </b>
                </div>
              ))}
              {!reposLoading && repositories.length === 0 && (
                <div className="muted" style={{ padding: "16px 0" }}>
                  {T("No GitHub repositories authorized.", "暂无已授权 GitHub 仓库。")}
                </div>
              )}
            </div>
          </div>

          <div className="dash-issues-h">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{T("Needs attention", "需要关注")}</h2>
              <div className="sub" style={{ fontSize: 12.5 }}>
                {issuesLoading
                  ? T("Loading issues", "正在加载问题")
                  : T(`${openIssues.length} open issues`, `${openIssues.length} 个未解决问题`)}
              </div>
            </div>
            <button className="btn sm" onClick={() => go("issues")}>
              {T("All issues", "所有问题")} <I.ArrowR size={12} />
            </button>
          </div>

          {issuesError && <div className="card section muted">{issuesError}</div>}
          {!issuesLoading && openIssues.length === 0 && !issuesError && (
            <div className="card section muted">
              {T(
                "No findings have been written by the scan worker yet.",
                "扫描 worker 尚未写入任何 finding。"
              )}
            </div>
          )}
          {layout === "list" && openIssues.length > 0 && (
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
