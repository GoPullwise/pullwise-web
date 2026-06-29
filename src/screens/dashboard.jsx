import { useMemo, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import {
  normalizeScan,
  retryResponseScanId,
  retryResponseScanPayload,
  scanQueueSummary,
  useIssues,
  useRepositories,
  useScans,
} from "../lib/pullwise-data.js";
import {
  CONFIDENCE_BUCKETS,
  DistributionCard,
  VERIFICATION_BUCKETS,
  countBy,
} from "../components/distribution-primitives.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { ScanProgressBar, scanProgressPresentation } from "../components/scan-progress.jsx";
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

function scanAgentConfigLabel(scan) {
  const usage = scan?.aiUsage;
  if (!usage) return "";
  const parts = [];
  const push = (value) => {
    const text = String(value || "").trim();
    if (text && !parts.includes(text)) parts.push(text);
  };
  push(usage.agentCli || usage.provider);
  push(usage.model);
  if (usage.reasoningEffort) {
    push(T(`reasoning: ${usage.reasoningEffort}`, `推理：${usage.reasoningEffort}`));
  }
  return parts.join(" · ");
}

const SEVERITY_WEIGHTS = { critical: 10, high: 7, medium: 4, low: 2, info: 1 };
const SEVERITY_RANK = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const HOTSPOT_LIMIT = 5;
const RETRYABLE_SCAN_STATUSES = new Set(["failed", "cancelled", "lost"]);
const ACTIVE_SCAN_STATUSES = new Set(["queued", "running"]);
const SCAN_PHASE_LABELS = {
  clone: { en: "Cloning repository", zh: "克隆仓库" },
  index: { en: "Repository preflight", zh: "仓库预检" },
  ai: { en: "GraphVerified review", zh: "GraphVerified 审查" },
  report: { en: "Uploading report", zh: "上传报告" },
};

const SEVERITY_LEVELS = [
  { key: "critical", en: "Critical", zh: "关键", color: "var(--sev-critical)" },
  { key: "high", en: "High", zh: "高", color: "var(--sev-high)" },
  { key: "medium", en: "Medium", zh: "中", color: "var(--sev-medium)" },
  { key: "low", en: "Low", zh: "低", color: "var(--sev-low)" },
  { key: "info", en: "Info", zh: "信息", color: "var(--sev-info)" },
];

function issueSeverity(issue) {
  const severity = String(issue?.severity || "info").toLowerCase();
  return SEVERITY_WEIGHTS[severity] ? severity : "info";
}

function severityCounts() {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

function riskHotspots(issues, itemForIssue) {
  const groups = new Map();
  for (const issue of issues) {
    const item = itemForIssue(issue);
    if (!item?.key || !item?.label) continue;
    const severity = issueSeverity(issue);
    const current = groups.get(item.key) || {
      key: item.key,
      label: item.label,
      context: item.context || "",
      score: 0,
      total: 0,
      maxSeverity: severity,
      counts: severityCounts(),
    };
    current.score += SEVERITY_WEIGHTS[severity];
    current.total += 1;
    current.counts[severity] += 1;
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[current.maxSeverity]) {
      current.maxSeverity = severity;
    }
    groups.set(item.key, current);
  }
  const rows = Array.from(groups.values()).sort(
    (left, right) =>
      right.score - left.score ||
      right.counts.critical - left.counts.critical ||
      right.counts.high - left.counts.high ||
      right.total - left.total ||
      left.label.localeCompare(right.label)
  );
  const maxScore = rows[0]?.score || 1;
  return rows.slice(0, HOTSPOT_LIMIT).map((row) => ({
    ...row,
    heat: Math.max(8, Math.round((row.score / maxScore) * 100)),
  }));
}

function issueRepoLabel(issue) {
  return String(issue?.repo || "").trim();
}

function issueFileLabel(issue) {
  return String(issue?.file || "").trim();
}

function issueRiskHotspots(issues) {
  return {
    repos: riskHotspots(issues, (issue) => {
      const repo = issueRepoLabel(issue);
      return repo ? { key: repo, label: repo } : null;
    }),
    files: riskHotspots(issues, (issue) => {
      const repo = issueRepoLabel(issue);
      const file = issueFileLabel(issue);
      if (!file) return null;
      return {
        key: `${repo || "unknown"}\u001f${file}`,
        label: file,
        context: repo,
      };
    }),
  };
}

function severityCountLabel(level, count) {
  return T(`${count} ${level.en.toLowerCase()}`, `${count} ${level.zh}`);
}

function scanPhaseLabel(scan) {
  const phase = SCAN_PHASE_LABELS[scan?.phase];
  if (phase) return T(phase.en, phase.zh);
  if (scan?.status === "queued") return T("Queued", "排队中");
  if (scan?.status === "running") return T("Running", "运行中");
  return T("Scan", "扫描");
}

function activeScanProgressMessage(scan) {
  if (!scan) return "";
  if (scan.progressMessage) return scan.progressMessage;
  if (scan.status === "queued") {
    const queue = scanQueueSummary(scan);
    return (
      queue?.message ||
      queue?.tags?.join(" / ") ||
      T("Waiting for an available worker.", "等待可用 worker。")
    );
  }
  return T("Worker is preparing the next progress update.", "Worker 正在准备下一次进度更新。");
}

function RiskHotspotRow({ item, index }) {
  return (
    <div
      className="risk-hotspot-row"
      role="listitem"
      style={{ "--risk-hotspot-color": `var(--sev-${item.maxSeverity})` }}
    >
      <div className={"risk-hotspot-rank sev-bg-" + item.maxSeverity}>{index + 1}</div>
      <div className="risk-hotspot-main">
        <div className="risk-hotspot-line">
          <span className="risk-hotspot-label">{item.label}</span>
          <span className="risk-hotspot-score">
            {T(`${item.score} risk`, `${item.score} 风险`)}
          </span>
        </div>
        {item.context && <div className="risk-hotspot-context">{item.context}</div>}
        <div className="risk-hotspot-heat" aria-hidden="true">
          <span style={{ width: `${item.heat}%` }} />
        </div>
        <div className="risk-hotspot-counts">
          <span className="tag">
            {T(`${item.total} open issues`, `${item.total} 个未解决问题`)}
          </span>
          {SEVERITY_LEVELS.filter((level) => item.counts[level.key] > 0).map((level) => (
            <span key={level.key} className={"tag risk-hotspot-count sev-" + level.key}>
              {severityCountLabel(level, item.counts[level.key])}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RiskHotspotList({ title, subtitle, items, empty }) {
  return (
    <div className="risk-hotspot-list">
      <div className="risk-hotspot-list-h">
        <h4>{title}</h4>
        <span>{subtitle}</span>
      </div>
      {items.length > 0 ? (
        <div className="risk-hotspot-rows" role="list" aria-label={title}>
          {items.map((item, index) => (
            <RiskHotspotRow key={item.key} item={item} index={index} />
          ))}
        </div>
      ) : (
        <div className="risk-hotspot-empty muted">{empty}</div>
      )}
    </div>
  );
}

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

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-busy="true">
      <div className="kpi-row">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="kpi card" key={`dashboard-kpi-skeleton-${index}`}>
            <div className="kpi-h">
              <SkeletonLine className="sk-line sk-w-45" />
            </div>
            <div className="kpi-v">
              <SkeletonLine className="sk-line sk-w-35 sk-h-32" />
            </div>
            <div className="kpi-foot">
              <SkeletonLine className="sk-line sk-w-70" />
            </div>
            <div className="kpi-chart">
              <SkeletonLine className="sk-block sk-h-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        {Array.from({ length: 2 }, (_, index) => (
          <div className="card dash-summary" key={`dashboard-summary-skeleton-${index}`}>
            <div className="dash-summary-head">
              <SkeletonLine className="sk-line sk-w-35 sk-h-18" />
              <SkeletonLine className="sk-line sk-w-20" />
            </div>
            <div className="dash-donut-cards">
              {Array.from({ length: 2 }, (_, cardIndex) => (
                <div
                  className="dash-donut-card skeleton-panel"
                  key={`dashboard-donut-skeleton-${index}-${cardIndex}`}
                >
                  <SkeletonLine className="sk-circle sk-size-72" />
                  <div className="skeleton-stack">
                    <SkeletonLine className="sk-line sk-w-55" />
                    <SkeletonLine className="sk-line sk-w-80" />
                    <SkeletonLine className="sk-line sk-w-45" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <section className="card dash-summary risk-hotspots">
        <div className="dash-summary-head">
          <div>
            <SkeletonLine className="sk-line sk-w-30 sk-h-18" />
            <SkeletonLine className="sk-line sk-w-65" />
          </div>
          <SkeletonLine className="sk-line sk-w-20" />
        </div>
        <div className="risk-hotspot-grid">
          {Array.from({ length: 2 }, (_, listIndex) => (
            <div className="risk-hotspot-list" key={`dashboard-risk-skeleton-${listIndex}`}>
              <SkeletonLine className="sk-line sk-w-45" />
              <div className="skeleton-stack">
                {Array.from({ length: 3 }, (_, rowIndex) => (
                  <SkeletonLine
                    className="sk-line sk-w-100 sk-h-24"
                    key={`dashboard-risk-row-skeleton-${listIndex}-${rowIndex}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="dash-issues-h">
        <div>
          <SkeletonLine className="sk-line sk-w-30 sk-h-18" />
          <SkeletonLine className="sk-line sk-w-50" />
        </div>
        <SkeletonLine className="sk-line sk-w-20" />
      </div>
      <div className="issue-list">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="issue-row skeleton-row" key={`dashboard-issue-skeleton-${index}`}>
            <SkeletonLine className="sk-line sk-w-12 sk-h-22" />
            <SkeletonLine className="sk-line sk-w-16" />
            <div className="issue-main">
              <SkeletonLine className="sk-line sk-w-60 sk-h-16" />
              <div className="issue-meta">
                <SkeletonLine className="sk-line sk-w-35" />
                <SkeletonLine className="sk-line sk-w-18" />
              </div>
            </div>
            <SkeletonLine className="sk-line sk-w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardScreen({ go, setIssue, accent }) {
  useLang();
  const [retryingScanId, setRetryingScanId] = useState("");
  const {
    items: issues,
    loading: issuesLoading,
    error: issuesError,
    meta: issuesMeta = {},
  } = useIssues({
    status: "open",
    limit: 50,
    sort: "severity",
  });
  const {
    items: scans,
    loading: scansLoading,
    reload: reloadScans,
    upsertScan,
    meta: scansMeta = {},
  } = useScans({ limit: 50 });
  const {
    items: repositories,
    loading: reposLoading,
    needsAuthorization,
    meta: repositoriesMeta = {},
  } = useRepositories();

  const openIssues = issues;
  const openIssueTotal = Number.isFinite(Number(issuesMeta.total))
    ? Number(issuesMeta.total)
    : openIssues.length;
  const counts = issueCounts(openIssues);
  const verificationCounts = useMemo(
    () =>
      countBy(
        openIssues,
        (issue) => issue.verificationStatus,
        VERIFICATION_BUCKETS.map((bucket) => bucket.key)
      ),
    [openIssues]
  );
  const confidenceCounts = useMemo(
    () =>
      countBy(
        openIssues,
        (issue) => issue.confidenceLevel,
        CONFIDENCE_BUCKETS.map((bucket) => bucket.key)
      ),
    [openIssues]
  );
  const verifiedShare =
    Number(verificationCounts.verified || 0) + Number(verificationCounts.static_proof || 0);
  const highShare = Number(confidenceCounts.high || 0);
  const verifiedPct = openIssues.length ? Math.round((verifiedShare / openIssues.length) * 100) : 0;
  const highPct = openIssues.length ? Math.round((highShare / openIssues.length) * 100) : 0;
  const latestScan = scans[0];
  const activeScan = scans.find((scan) =>
    ACTIVE_SCAN_STATUSES.has(String(scan?.status || "").toLowerCase())
  );
  const latestScanBaseAgentLabel = scanAgentConfigLabel(latestScan);
  const latestScanQueueSummary =
    latestScan?.status === "queued" ? scanQueueSummary(latestScan) : null;
  const latestScanQueueLabel = latestScanQueueSummary?.tags?.length
    ? latestScanQueueSummary.tags.join(" / ")
    : "";
  const latestScanAgentLabel = latestScanQueueLabel || latestScanBaseAgentLabel;
  const canRetryLatestScan = Boolean(
    latestScan?.id && RETRYABLE_SCAN_STATUSES.has(String(latestScan.status || "").toLowerCase())
  );
  const activeScanProgress = activeScan
    ? scanProgressPresentation(activeScan, { label: scanPhaseLabel(activeScan) })
    : null;
  const activeScanMessage = activeScanProgressMessage(activeScan);
  const hotspots = useMemo(() => issueRiskHotspots(openIssues), [openIssues]);

  const issueTrend = useMemo(() => scans.slice(0, 14).reverse().map(scanIssueTotal), [scans]);
  const issueDelta = useMemo(() => {
    if (issueTrend.length < 2) return 0;
    return issueTrend[issueTrend.length - 1] - issueTrend[0];
  }, [issueTrend]);

  const scanTrend = useMemo(
    () =>
      scans
        .slice(0, 14)
        .reverse()
        .map(() => 1),
    [scans]
  );
  const scanTotal = Number.isFinite(Number(scansMeta.total))
    ? Number(scansMeta.total)
    : scans.length;
  const repositoryCount = Number.isFinite(Number(repositoriesMeta.total))
    ? Number(repositoriesMeta.total)
    : repositories.length;

  const dashboardLoading = issuesLoading || scansLoading || reposLoading;

  const retryLatestScan = async () => {
    if (!canRetryLatestScan || retryingScanId) return;
    setRetryingScanId(latestScan.id);
    try {
      const payload = await pullwiseApi.scans.retry(latestScan.id);
      const inlinePayload = retryResponseScanPayload(payload);
      const refreshed = inlinePayload
        ? normalizeScan(inlinePayload)
        : normalizeScan(await pullwiseApi.scans.get(retryResponseScanId(payload, latestScan.id)));
      if (typeof upsertScan === "function") {
        upsertScan(refreshed, latestScan.id);
      } else if (typeof reloadScans === "function") {
        await reloadScans({ quiet: true });
      }
    } catch (retryError) {
      window.alert(retryError?.message || T("Unable to retry scan.", "无法重试扫描。"));
    } finally {
      setRetryingScanId("");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Overview", "总览") }]}
        setIssue={setIssue}
        loading={dashboardLoading}
      />
      <div className="with-side">
        <Sidebar section="dashboard" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Overview", "总览")}</h1>
              <div className="sub">{T("Account overview", "账户总览")}</div>
            </div>
            <div className="actions">
              <a className="btn" {...screenLinkProps(go, "repos")}>
                <I.Refresh size={14} /> {T("New scan", "新扫描")}
              </a>
            </div>
          </div>

          {dashboardLoading ? (
            <DashboardSkeleton />
          ) : (
            <>
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
                  <div className="kpi-v">{openIssueTotal}</div>
                  <div className="kpi-foot" aria-hidden="true">
                    &nbsp;
                  </div>
                  <div className="kpi-chart">
                    <Sparkline data={issueTrend} color={accent} height={20} />
                  </div>
                </div>
                <div className="kpi card">
                  <div className="kpi-h">
                    <span className="kpi-l">{T("Critical", "关键")}</span>
                  </div>
                  <div
                    className="kpi-v"
                    style={{ color: counts.critical > 0 ? "var(--sev-critical)" : undefined }}
                  >
                    {counts.critical}
                  </div>
                  <div className="kpi-foot">
                    {counts.critical > 0
                      ? T("Requires immediate attention", "需要立即处理")
                      : T("No critical issues found", "未发现关键问题")}
                  </div>
                  <div className="kpi-chart">
                    <Sparkline
                      data={issueTrend.map(() => counts.critical)}
                      color="var(--sev-critical)"
                      height={20}
                    />
                  </div>
                </div>
                <div className="kpi card">
                  <div className="kpi-h">
                    <span className="kpi-l">{T("Repositories", "仓库")}</span>
                  </div>
                  <div className="kpi-v">{reposLoading ? "-" : repositoryCount}</div>
                  <div className="kpi-foot">
                    {needsAuthorization
                      ? T("Connect GitHub to add repositories", "连接 GitHub 以添加仓库")
                      : T("Connected to your account", "已连接到您的账户")}
                  </div>
                  <div className="kpi-chart">
                    <Sparkline
                      data={scanTrend.map(() => repositoryCount)}
                      color="var(--text-3)"
                      height={20}
                    />
                  </div>
                </div>
                <div className="kpi card">
                  <div className="kpi-h">
                    <span className="kpi-l">{T("Scans", "扫描")}</span>
                    {canRetryLatestScan && (
                      <button
                        type="button"
                        className="btn sm kpi-retry-btn"
                        disabled={retryingScanId === latestScan.id}
                        onClick={retryLatestScan}
                      >
                        {retryingScanId === latestScan.id
                          ? T("Retrying...", "正在重试...")
                          : T("Retry", "重试")}
                      </button>
                    )}
                  </div>
                  <div className="kpi-v">{scansLoading ? "-" : scanTotal}</div>
                  <div className="kpi-foot">
                    {latestScan
                      ? latestScanAgentLabel
                        ? T(
                            `Last: ${latestScan.time} · ${latestScanAgentLabel}`,
                            `最近：${latestScan.time} · ${latestScanAgentLabel}`
                          )
                        : T(`Last: ${latestScan.time}`, `最近：${latestScan.time}`)
                      : T("No scans yet", "暂无扫描记录")}
                  </div>
                  <div className="kpi-chart">
                    <Sparkline data={scanTrend} color={accent} height={20} />
                  </div>
                </div>
              </div>

              {activeScan && (
                <section
                  className="card dash-summary active-scan-progress"
                  aria-labelledby="active-scan-progress-title"
                >
                  <div className="dash-summary-head">
                    <div>
                      <h3 id="active-scan-progress-title">{T("Active scan", "活动扫描")}</h3>
                      <div className="sub">{activeScan.repo || activeScan.id}</div>
                    </div>
                    <a
                      className="btn sm"
                      {...screenLinkProps(go, "scanning", { scanId: activeScan.id })}
                    >
                      {T("Scan details", "扫描详情")} <I.ArrowR size={12} />
                    </a>
                  </div>
                  <ScanProgressBar
                    className="active-scan-progress-main"
                    progress={activeScanProgress.progress}
                    label={activeScanProgress.label}
                    message={activeScanMessage}
                    meta={activeScan.logsSummary}
                    valueLabel={activeScanProgress.valueLabel}
                    ariaValueText={activeScanProgress.ariaValueText}
                  />
                </section>
              )}

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
                        <span>{T(item.en, item.zh)}</span>
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

                <div className="card dash-summary">
                  <div className="dash-summary-head">
                    <h3>{T("Trust & evidence", "可信度与证据")}</h3>
                    <span className="sub">{T("Open issues only", "仅未解决问题")}</span>
                  </div>
                  <div className="dash-donut-cards">
                    <DistributionCard
                      className="dash-donut-card"
                      title={T("Verification", "验证状态")}
                      subtitle={T(
                        `${verifiedPct}% verified or static proof`,
                        `${verifiedPct}% 已验证或静态证明`
                      )}
                      counts={verificationCounts}
                      buckets={VERIFICATION_BUCKETS}
                      layout="donut"
                      donutCenterTop={verifiedPct + "%"}
                      donutCenterBottom={T(
                        `${verifiedShare}/${openIssues.length}`,
                        `${verifiedShare}/${openIssues.length}`
                      )}
                    />
                    <DistributionCard
                      className="dash-donut-card"
                      title={T("Confidence", "置信度")}
                      subtitle={T(
                        `${highPct}% high-confidence findings`,
                        `${highPct}% 高置信度发现`
                      )}
                      counts={confidenceCounts}
                      buckets={CONFIDENCE_BUCKETS}
                      layout="donut"
                      donutCenterTop={highPct + "%"}
                      donutCenterBottom={T(
                        `${highShare}/${openIssues.length}`,
                        `${highShare}/${openIssues.length}`
                      )}
                    />
                  </div>
                </div>
              </div>

              <section
                className="card dash-summary risk-hotspots"
                aria-labelledby="risk-hotspots-title"
              >
                <div className="dash-summary-head">
                  <div>
                    <h3 id="risk-hotspots-title">{T("Risk hotspots", "风险热区")}</h3>
                    <div className="sub">
                      {T(
                        "Top open issue concentrations by repository and file.",
                        "按仓库和文件定位未解决问题最集中的位置。"
                      )}
                    </div>
                  </div>
                  <a className="btn sm" {...screenLinkProps(go, "issues")}>
                    {T("All issues", "所有问题")} <I.ArrowR size={12} />
                  </a>
                </div>
                <div className="risk-hotspot-grid">
                  <RiskHotspotList
                    title={T("Top risky repositories", "高风险仓库")}
                    subtitle={T("Severity-weighted", "按严重度加权")}
                    items={hotspots.repos}
                    empty={T("No repository hotspots yet.", "暂无仓库风险聚集。")}
                  />
                  <RiskHotspotList
                    title={T("Top file hotspots", "文件热区")}
                    subtitle={T("Most concentrated files", "问题最集中的文件")}
                    items={hotspots.files}
                    empty={T("No file hotspots yet.", "暂无文件风险聚集。")}
                  />
                </div>
              </section>

              <div className="dash-issues-h">
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 600 }}>
                    {T("Needs attention", "需要关注")}
                  </h2>
                  <div className="sub" style={{ fontSize: 12.5 }}>
                    {issuesLoading
                      ? T("Loading issues...", "正在加载问题...")
                      : openIssues.length > 0
                        ? T(
                            `Showing ${Math.min(openIssues.length, 8)} of ${openIssueTotal} open issues`,
                            `显示 ${Math.min(openIssues.length, 8)} / ${openIssueTotal} 个未解决问题`
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
                <div
                  className="card section muted"
                  style={{ textAlign: "center", padding: "32px 20px" }}
                >
                  <div style={{ marginBottom: 8 }}>
                    {scans.length > 0
                      ? T(
                          "No issues found — your repositories look clean.",
                          "未发现问题 — 您的仓库看起来很干净。"
                        )
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
                        go("issue", { issueId: issue.id });
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
