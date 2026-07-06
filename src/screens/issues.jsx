import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { ScanProgressBar, scanProgressPresentation } from "../components/scan-progress.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { downloadBlob } from "../lib/download.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { screenLinkProps } from "../lib/navigation.js";
import {
  normalizeScan,
  applyCachedIssueUpdate,
  issueUpdateKey,
  notifyIssuesChanged,
  rememberIssueUpdate,
  retryResponseScanId,
  retryResponseScanPayload,
  scanQueueSummary,
  useIssues,
  useScans,
} from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const DEFAULT_REVIEW_OUTPUT_LANGUAGE = "en";
const HISTORY_EXPECTED_SCAN_RETRY_MS = 1500;
const HISTORY_EXPECTED_SCAN_MAX_RETRIES = 5;
const REVIEW_OUTPUT_LANGUAGES = [
  { value: "en", labelEn: "English", labelZh: "英文" },
  { value: "zh-CN", labelEn: "Chinese", labelZh: "中文" },
  { value: "ja", labelEn: "Japanese", labelZh: "日语" },
  { value: "ko", labelEn: "Korean", labelZh: "韩语" },
  { value: "es", labelEn: "Spanish", labelZh: "西班牙语" },
  { value: "fr", labelEn: "French", labelZh: "法语" },
  { value: "de", labelEn: "German", labelZh: "德语" },
  { value: "pt-BR", labelEn: "Portuguese", labelZh: "葡萄牙语" },
  { value: "it", labelEn: "Italian", labelZh: "意大利语" },
];
function reviewOutputLanguageValue(settings) {
  return settings?.review?.outputLanguage || DEFAULT_REVIEW_OUTPUT_LANGUAGE;
}

function withReviewOutputLanguage(settings, outputLanguage, fallback = null) {
  return {
    ...(fallback || {}),
    ...(settings || {}),
    review: {
      ...(fallback?.review || {}),
      ...(settings?.review || {}),
      outputLanguage,
    },
  };
}

function reviewOutputLanguageSaveError(error) {
  const message = String(error?.message || "");
  if (error?.status === 403 && /trusted origin/i.test(message)) {
    return "Unable to save review output language. Server origin configuration rejected this browser request. Add this web origin to PULLWISE_ALLOWED_ORIGINS or PULLWISE_APP_URL.";
  }
  return message || "Unable to save review output language.";
}

function sortIssues(items, key) {
  const sorted = items.slice();
  if (key === "severity") {
    sorted.sort(
      (a, b) =>
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
  }
  if (key === "newest")
    sorted.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (key === "file") sorted.sort((a, b) => (a.file || "").localeCompare(b.file || ""));
  return sorted;
}

function issueMatchesListFilters(issue, { status, severity, q }) {
  if (status && status !== "all" && issue.status !== status) return false;
  if (severity && severity !== "all" && issue.severity !== severity) return false;
  if (!q) return true;
  const query = q.toLowerCase();
  return [issue.title, issue.id, issue.file, issue.category, issue.repo]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

const ISSUE_IDENTITY_FIELDS = [
  "id",
  "scanId",
  "jobId",
  "repo",
  "file",
  "line",
  "title",
  "createdAt",
];
const ISSUE_STATUS_IDENTITY_FIELDS = ISSUE_IDENTITY_FIELDS.filter((field) => field !== "id");

function issueRowKey(issue) {
  return issueUpdateKey(issue);
}

function issueStatusIdentity(issue) {
  return Object.fromEntries(
    ISSUE_STATUS_IDENTITY_FIELDS.map((field) => [field, issue?.[field]]).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

function issueTotal(scan) {
  if (!scan?.issues) return 0;
  return Object.values(scan.issues).reduce((sum, value) => sum + Number(value || 0), 0);
}

function scanHasResults(scan) {
  return ["done", "failed", "partial_completed"].includes(scan?.status);
}

function scanHistorySummary(scan) {
  const queueSummary = scanQueueSummary(scan);
  if (scan.status === "queued" && queueSummary) {
    return [T("queued", "排队�?), ...queueSummary.tags].join(" - ");
  }
  if (scan.status === "partial_completed") {
    const total = issueTotal(scan);
    return total > 0
      ? T(`Partial result - ${total} confirmed`, `部分结果 - ${total} confirmed`)
      : T("Partial result available", "部分结果可用");
  }
  if (scan.status === "cancelled") return T("Scan cancelled", "扫描已取�?);
  if (scan.status === "lost") {
    return T("Scan lost", "扫描丢失");
  }
  if (scan.issues) {
    const total = issueTotal(scan);
    return T(`${total} confirmed`, `${total} confirmed`);
  }
  return scan.status;
}

function DetailSection({ title, children, empty = "" }) {
  if (!children && !empty) return null;
  return (
    <div className="card section">
      <div className="section-h">
        <h3>{title}</h3>
      </div>
      {children || <div className="muted">{empty}</div>}
    </div>
  );
}

function locationLabel(item) {
  if (!item?.file) return "";
  if (item.startLine && item.endLine && item.endLine !== item.startLine) {
    return `${item.file}:${item.startLine}-${item.endLine}`;
  }
  return item.startLine ? `${item.file}:${item.startLine}` : item.file;
}

function copyText(value) {
  const clipboard = globalThis.navigator?.clipboard;
  if (!value || !clipboard?.writeText) return Promise.resolve(false);
  return clipboard
    .writeText(value)
    .then(() => true)
    .catch(() => false);
}

function absoluteAppUrl(path) {
  const text = String(path || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  const origin = globalThis.location?.origin || "";
  return origin ? new URL(text, origin).href : text;
}

function scanDebugZipUrl(scan) {
  return absoluteAppUrl(scan?.debugBundleUrl);
}
function markdownText(value) {
  return String(value ?? "").trim();
}


function appendMarkdownSection(lines, title, content) {
  const body = Array.isArray(content)
    ? content.map(markdownText).filter(Boolean).join("\n")
    : markdownText(content);
  if (!body) return;
  lines.push("", `## ${title}`, body);
}

function buildIssuePageMarkdown(issue, currentStatus) {  const title = markdownText(issue.title) || markdownText(issue.id) || "Issue";
  const primaryLocation = issue.affectedLocations?.[0] || null;
  const lines = [`# ${title}`];
  const metadata = [
    ["Issue", issue.id],
    ["Status", currentStatus || issue.status],
    ["Severity", issue.severity],
    ["Category", issue.category],
    ["Repository", issue.repo],
    ["Branch", issue.branch || issue.audit?.branch],
    ["Commit", issue.commit],
    ["Scan", issue.scanId],
    ["Job", issue.jobId],
    ["File", primaryLocation ? locationLabel(primaryLocation) : issue.file],
  ]
    .map(([label, value]) => {
      const text = markdownText(value);
      return text ? `- ${label}: ${text}` : "";
    })
    .filter(Boolean);

  appendMarkdownSection(lines, "Metadata", metadata);
  appendMarkdownSection(lines, "Summary", issue.summary);
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function ReproductionCenter({ issue }) {
  const reproduction = issue.reproduction || {};
  const commands = Array.isArray(reproduction.commands) ? reproduction.commands : [];
  const steps = Array.isArray(reproduction.steps) ? reproduction.steps : [];
  const commandText = commands.join("\n");
  const hasStructuredRepro =
    commands.length ||
    steps.length ||
    reproduction.input ||
    reproduction.expected ||
    reproduction.actual ||
    reproduction.testFile ||
    reproduction.logPath ||
    reproduction.exitCode !== undefined;
  if (!hasStructuredRepro && !issue.reproductionPath) return null;
  return (
    <div className="repro-center">
      {issue.reproductionPath && <p className="muted repro-note">{issue.reproductionPath}</p>}
      {commands.length > 0 && (
        <div className="docs-code repro-command">
          <div className="docs-code-h">
            <span>{T("Validation command", "Validation command")}</span>
            <button className="docs-code-copy" type="button" onClick={() => copyText(commandText)}>
              <I.Copy size={12} /> {T("Copy", "\u590d\u5236")}
            </button>
          </div>
          <pre>{commandText}</pre>
        </div>
      )}
      {steps.length > 0 && (
        <div className="repro-fields">
          {steps.map((step, index) => (
            <div key={`verification-step-${index}-${step}`} className="repro-field">
              <b className="repro-field-title">{T("Verification step", "\u9a8c\u8bc1\u6b65\u9aa4")}</b>
              <p className="muted repro-field-text">{step}</p>
            </div>
          ))}
        </div>
      )}
      {(reproduction.input || reproduction.expected || reproduction.actual) && (
        <div className="repro-fields">
          {reproduction.input && (
            <div className="repro-field">
              <b className="repro-field-title">{T("Input", "\u8f93\u5165")}</b>
              <p className="muted repro-field-text">{reproduction.input}</p>
            </div>
          )}
          {reproduction.expected && (
            <div className="repro-field">
              <b className="repro-field-title">{T("Expected", "\u9884\u671f")}</b>
              <p className="muted repro-field-text">{reproduction.expected}</p>
            </div>
          )}
          {reproduction.actual && (
            <div className="repro-field">
              <b className="repro-field-title">{T("Actual", "\u5b9e\u9645")}</b>
              <p className="muted repro-field-text">{reproduction.actual}</p>
            </div>
          )}
        </div>
      )}
      {(reproduction.testFile || reproduction.logPath || reproduction.exitCode) && (
        <div className="repro-tags">
          {reproduction.testFile && (
            <span className="tag">
              {T("test:", { zh: "测试�?, ja: "テス�?", ko: "테스�?", fr: "test :", es: "prueba:" })}{" "}
              {reproduction.testFile}
            </span>
          )}
          {reproduction.logPath && (
            <span className="tag">
              {T("log:", { zh: "日志�?, ja: "ログ:", ko: "로그:", fr: "journal :", es: "registro:" })}{" "}
              {reproduction.logPath}
            </span>
          )}
          {reproduction.exitCode !== undefined && (
            <span className="tag">
              {T("exit:", { zh: "退出码�?, ja: "終了:", ko: "종료:", fr: "sortie :", es: "salida:" })}{" "}
              {reproduction.exitCode}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TextListSection({ title, items }) {
  if (!items?.length) return null;
  return (
    <DetailSection title={title}>
      <ul className="legal-list-flat evidence-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </DetailSection>
  );
}

function IssueSummaryDetail({ issue }) {
  return (
    <>
      {issue.affectedLocations?.length > 0 && (
        <DetailSection title={T("Affected locations", "Affected locations")}>
          <ul className="legal-list-flat evidence-list">
            {issue.affectedLocations.map((location, index) => (
              <li key={`${locationLabel(location)}-${index}`}>{locationLabel(location)}</li>
            ))}
          </ul>
        </DetailSection>
      )}
      <DetailSection title={T("Validation", "Validation")}>
        <ReproductionCenter issue={issue} />
      </DetailSection>
      <TextListSection title={T("Limitations", "Limitations")} items={issue.limitations} />
    </>
  );
}

function IssuesTableSkeleton() {
  return (
    <div className="issues-table-skeleton">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="issues-trow" key={`issues-skeleton-${index}`} aria-hidden="true">
          <div></div>
          <div className="issues-title-c">
            <SkeletonLine className="sk-line sk-w-24" />
            <SkeletonLine className="sk-line sk-w-48" />
          </div>
          <div><SkeletonLine className="sk-line sk-w-28" /></div>
          <div><SkeletonLine className="sk-line sk-w-16" /></div>
          <div><SkeletonLine className="sk-line sk-w-16" /></div>
          <div><SkeletonLine className="sk-line sk-w-16" /></div>
          <div></div>
        </div>
      ))}
    </div>
  );
}
function IssueDetailSkeleton() {
  return (
    <div
      className="issue-detail-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={T("Loading issue details", "正在加载问题详情")}
    >
      <div className="issue-detail-h issue-detail-skeleton-head" aria-hidden="true">
        <div className="skeleton-stack">
          <div className="issues-title-meta">
            <SkeletonLine className="sk-line sk-w-14 sk-h-20" />
            <SkeletonLine className="sk-line sk-w-18 sk-h-20" />
            <SkeletonLine className="sk-line sk-w-22 sk-h-20" />
          </div>
          <SkeletonLine className="sk-line sk-w-62 sk-h-28" />
          <SkeletonLine className="sk-line sk-w-80" />
          <div className="issues-title-meta">
            <SkeletonLine className="sk-line sk-w-24 sk-h-20" />
            <SkeletonLine className="sk-line sk-w-34 sk-h-20" />
            <SkeletonLine className="sk-line sk-w-18 sk-h-20" />
          </div>
        </div>
      </div>
      <div className="issue-detail-grid" aria-hidden="true">
        <div className="issue-detail-main-col">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              className="card section issue-detail-skeleton-section"
              key={`issue-detail-skeleton-${index}`}
            >
              <div className="section-h">
                <SkeletonLine className="sk-line sk-w-30 sk-h-18" />
              </div>
              <div className="skeleton-stack">
                <SkeletonLine className="sk-line sk-w-100" />
                <SkeletonLine className="sk-line sk-w-80" />
                <SkeletonLine className="sk-line sk-w-56" />
              </div>
            </div>
          ))}
        </div>
        <div className="card section issue-actions issue-detail-skeleton-actions">
          <div className="section-h">
            <SkeletonLine className="sk-line sk-w-35 sk-h-18" />
          </div>
          <div className="skeleton-stack">
            <SkeletonLine className="sk-line sk-w-70 sk-h-20" />
            <SkeletonLine className="sk-line sk-w-55 sk-h-20" />
            <SkeletonLine className="sk-line sk-w-80 sk-h-28" />
            <SkeletonLine className="sk-line sk-w-48 sk-h-28" />
            <SkeletonLine className="sk-line sk-w-62" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function IssuesScreen({ go, setIssue, scanFilter = null, onClearScanFilter = null }) {
  useLang();
  const [sev, setSev] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [statusUpdating, setStatusUpdating] = useState({});
  const [bulkStatusLoading, setBulkStatusLoading] = useState("");
  const [statusActionError, setStatusActionError] = useState("");
  const [localIssueUpdates, setLocalIssueUpdates] = useState({});
  const statusUpdatingRef = useRef(new Set());
  const query = q.trim();
  const scanId = scanFilter?.id || "";
  const {
    items: all,
    loading,
    loadingMore,
    error,
    reload,
    loadMore,
    meta = {},
  } = useIssues({
    status,
    severity: sev,
    q: query,
    scanId,
    sort: sortBy,
    limit: 50,
    refreshOnChange: false,
  });
  const localIssues = Object.values(localIssueUpdates);
  const serverIssueKeys = new Set(all.map(issueRowKey));
  const issuesWithLocalStatus = [
    ...all.map((issue) => ({ ...issue, ...(localIssueUpdates[issueRowKey(issue)] || {}) })),
    ...localIssues.filter((issue) => !serverIssueKeys.has(issueRowKey(issue))),
  ].filter((issue) => issueMatchesListFilters(issue, { status, severity: sev, q: query }));
  const filtered = sortIssues(issuesWithLocalStatus, sortBy);
  const totalCount = Number.isFinite(Number(meta.total)) ? Number(meta.total) : filtered.length;
  const bulkFixableIssues = filtered.filter((issue) => issue.status !== "fixed");

  const updateStatus = async (issue, nextStatus) => {
    const rowKey = issueRowKey(issue);
    if (statusUpdatingRef.current.has(rowKey)) return;
    statusUpdatingRef.current.add(rowKey);
    setStatusUpdating((current) => ({ ...current, [rowKey]: true }));
    setStatusActionError("");
    try {
      const updated = await pullwiseApi.issues.updateStatus(issue.id, {
        status: nextStatus,
        ...issueStatusIdentity(issue),
      });
      const updatedIssue = { ...issue, ...updated, status: updated?.status || nextStatus };
      rememberIssueUpdate(issue, updatedIssue);
      setLocalIssueUpdates((current) => ({ ...current, [rowKey]: updatedIssue }));
      await reload();
      notifyIssuesChanged({ issueId: issue.id, issueKey: rowKey, status: updatedIssue.status });
    } catch (error) {
      setStatusActionError(error?.message || T("Issue status update failed.", "问题状态更新失败�?));
    } finally {
      statusUpdatingRef.current.delete(rowKey);
      setStatusUpdating((current) => {
        const next = { ...current };
        delete next[rowKey];
        return next;
      });
    }
  };
  const markAllFixed = async () => {
    if (bulkStatusLoading) return;
    const targets = filtered.filter((issue) => {
      const rowKey = issueRowKey(issue);
      return issue.status !== "fixed" && !statusUpdatingRef.current.has(rowKey);
    });
    if (!targets.length) return;
    const rowKeys = targets.map(issueRowKey);
    rowKeys.forEach((rowKey) => statusUpdatingRef.current.add(rowKey));
    setBulkStatusLoading("fixed");
    setStatusActionError("");
    setStatusUpdating((current) =>
      rowKeys.reduce((next, rowKey) => ({ ...next, [rowKey]: true }), current)
    );
    try {
      const results =
        typeof pullwiseApi.issues.updateStatuses === "function"
          ? await pullwiseApi.issues
              .updateStatuses(
                targets.map((issue) => ({
                  id: issue.id,
                  status: "fixed",
                  ...issueStatusIdentity(issue),
                }))
              )
              .then((payload) => {
                const updatedById = new Map(
                  (payload?.items || payload?.issues || []).map((issue) => [String(issue?.id || ""), issue])
                );
                return targets.map((issue) => {
                  const updated = updatedById.get(String(issue.id || ""));
                  return updated
                    ? { status: "fulfilled", value: updated }
                    : { status: "rejected", reason: new Error("Issue was not updated.") };
                });
              })
          : await Promise.allSettled(
              targets.map((issue) =>
                pullwiseApi.issues.updateStatus(issue.id, {
                  status: "fixed",
                  ...issueStatusIdentity(issue),
                })
              )
            );
      const localUpdates = {};
      const notifications = [];
      let failureCount = 0;
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") {
          failureCount += 1;
          return;
        }
        const issue = targets[index];
        const rowKey = rowKeys[index];
        const updatedIssue = { ...issue, ...result.value, status: result.value?.status || "fixed" };
        rememberIssueUpdate(issue, updatedIssue);
        localUpdates[rowKey] = updatedIssue;
        notifications.push({ issueId: issue.id, issueKey: rowKey, status: updatedIssue.status });
      });
      if (Object.keys(localUpdates).length) {
        setLocalIssueUpdates((current) => ({ ...current, ...localUpdates }));
        await reload();
        notifications.forEach(notifyIssuesChanged);
      }
      if (failureCount) {
        const message = T(
          `${failureCount} issue status update failed.`,
          `${failureCount} 个问题状态更新失败。`
        );
        setStatusActionError(message);
        globalThis.alert?.(message);
      }
    } catch (error) {
      setStatusActionError(error?.message || T("Issue status update failed.", "问题状态更新失败�?));
    } finally {
      rowKeys.forEach((rowKey) => statusUpdatingRef.current.delete(rowKey));
      setStatusUpdating((current) => {
        const next = { ...current };
        rowKeys.forEach((rowKey) => {
          delete next[rowKey];
        });
        return next;
      });
      setBulkStatusLoading("");
    }
  };
  const openIssue = (issue) => {
    setIssue(issue);
    go("issue", issue.id ? { issueId: issue.id } : {});
  };
  const activateIssue = (event, issue) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openIssue(issue);
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Issues", "问题") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Issues", "问题")}</h1>
              <div className="sub">
                {loading ? (
                  <SkeletonLine className="sk-line sk-w-36" />
                ) : (
                  T(
                    `${filtered.length} of ${totalCount} items`,
                    `${filtered.length} / ${totalCount} 项`
                  )
                )}
              </div>
            </div>
            <div className="actions">
              <button
                className="btn primary"
                disabled={loading || Boolean(bulkStatusLoading) || bulkFixableIssues.length === 0}
                onClick={markAllFixed}
              >
                <I.Check size={14} />{" "}
                {bulkStatusLoading
                  ? T("Marking...", "正在标记...")
                  : T("Mark all fixed", "全部标记已修�?)}
              </button>
              <button
                className="btn"
                onClick={() =>
                  setSortBy(sortBy === "severity" ? "newest" : sortBy === "newest" ? "file" : "severity")
                }
              >
                <I.Sort size={14} />{" "}
                {sortBy === "severity"
                  ? T("Severity", "严重�?)
                  : sortBy === "newest"
                    ? T("Newest", "最�?)
                    : T("File", "文件")}
              </button>
            </div>
          </div>

          <div className="filters card">
            <div className="filters-row">
              <div className="repos-search" style={{ flex: 1 }}>
                <I.Search size={14} />
                <input
                  placeholder={T("Search by title, repo, or file...", "按标题、仓库或文件搜索...")}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>
              <div className="seg">
                {["open", "fixed", "snoozed", "all"].map((item) => (
                  <button
                    key={item}
                    className={"seg-i" + (status === item ? " active" : "")}
                    onClick={() => setStatus(item)}
                  >
                    {item === "all" ? T("All", "全部") : item}
                  </button>
                ))}
              </div>
            </div>
            <div className="filters-row">
              <div className="filter-pills">
                <span className="filter-l">{T("Severity", "严重�?)}</span>
                {["all", "critical", "high", "medium", "low", "info"].map((item) => (
                  <button
                    key={item}
                    className={"pill-btn" + (sev === item ? " active" : "")}
                    onClick={() => setSev(item)}
                  >
                    {item === "all" ? (
                      T("All", "全部")
                    ) : (
                      <>
                        <span className="dot" style={{ background: `var(--sev-${item})` }}></span>
                        {item}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
            {scanId && (
              <div className="filters-row">
                <div className="filter-pills">
                  <span className="filter-l">{T("Scan", "扫描")}</span>
                  <span className="tag">
                    <I.Activity size={11} /> {T("Scan", "扫描")} {scanId}
                  </span>
                  {scanFilter?.repo && <span className="tag">{scanFilter.repo}</span>}
                  {scanFilter?.branch && (
                    <span className="tag">
                      <I.GitBranch size={10} /> {scanFilter.branch}
                    </span>
                  )}
                  {onClearScanFilter && (
                    <button className="btn sm" onClick={onClearScanFilter}>
                      {T("Clear scan", "Clear scan")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="issues-table card">
            <div className="issues-thead">
              <div></div>
              <div>{T("Issue", "问题")}</div>
              <div>{T("File", "文件")}</div>
              <div>{T("Category", "类别")}</div>
              <div>{T("Proof", "证据")}</div>
              <div>{T("Status", "状�?)}</div>
              <div></div>
            </div>
            {loading && <IssuesTableSkeleton />}
            {error && <div className="muted issues-table-message">{error}</div>}
            {statusActionError && <div className="muted issues-table-message">{statusActionError}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="muted issues-table-empty">
                {T("No findings are available yet.", "暂无问题�?)}
              </div>
            )}
            {!loading &&
              filtered.map((issue) => {
                const rowKey = issueRowKey(issue);
                const updatingStatus = Boolean(statusUpdating[rowKey]);
                return (
                  <div key={rowKey} className="issues-trow">
                    <div></div>
                    <div
                      className="issues-title-c"
                      role="button"
                      tabIndex={0}
                      aria-label={`Open issue ${issue.id}`}
                      onClick={() => openIssue(issue)}
                      onKeyDown={(event) => activateIssue(event, issue)}
                    >
                      <div className="issues-title-meta">
                        <span className={"sev sev-" + issue.severity}>
                          <span className="dot" style={{ background: "currentColor" }}></span>
                          {issue.severity}
                        </span>
                        <span className="issue-id">{issue.id}</span>
                      </div>
                      <div className="issue-t">{issue.title}</div>
                      <div className="muted">{issue.repo}</div>
                    </div>
                    <div className="issues-file">
                      {issue.file}
                      {issue.line ? ":" + issue.line : ""}
                    </div>
                    <div>
                      <span className="tag">{issue.category}</span>
                    </div>
                    <div>
                      <div className="issues-evidence-cell">
                        <span className="tag">
                          {T("Confirmed", "Confirmed")}
                        </span>
                        {issue.verificationLevel && (
                          <span className="issues-evidence-label">{issue.verificationLevel}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="tag">{issue.status}</span>
                    </div>
                    <div className="issues-row-actions">
                      {issue.status === "open" && (
                        <button
                          className="btn sm"
                          disabled={updatingStatus}
                          onClick={() => updateStatus(issue, "snoozed")}
                        >
                          {T("Snooze", "推迟")}
                        </button>
                      )}
                      {issue.status !== "fixed" && (
                        <button
                          className="btn sm primary"
                          disabled={updatingStatus}
                          onClick={() => updateStatus(issue, "fixed")}
                        >
                          {T("Mark fixed", "标记已修�?)}
                        </button>
                      )}
                      <button
                        className="btn sm"
                        onClick={() => {
                          openIssue(issue);
                        }}
                        title={T(`View issue ${issue.id}`, `查看问题 ${issue.id}`)}
                        aria-label={T(`View issue ${issue.id}`, `查看问题 ${issue.id}`)}
                      >
                        <I.ArrowR size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            {!loading && meta.hasMore && (
              <div className="issues-load-more">
                <button className="btn sm" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? T("Loading...", "正在加载...") : T("Load more", "加载更多")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IssueDetailScreen({ go, issue: initialIssue, issueId = "", setIssue = null }) {
  useLang();
  const routeIssueId = String(issueId || "").trim();
  const initialIssueRef = useRef(initialIssue);
  const [loadedIssue, setLoadedIssue] = useState(null);
  const [loadingIssue, setLoadingIssue] = useState(Boolean(routeIssueId));
  const [loadError, setLoadError] = useState("");
  const activeIssue = routeIssueId ? loadedIssue : initialIssue;
  const [currentStatus, setCurrentStatus] = useState(activeIssue?.status || "open");
  const [actionError, setActionError] = useState("");
  const [statusLoading, setStatusLoading] = useState("");
  const [pageCopied, setPageCopied] = useState(false);
  const statusRequestRef = useRef(false);
  const pageCopyResetRef = useRef(null);

  useEffect(() => {
    initialIssueRef.current = initialIssue;
  }, [initialIssue]);

  useEffect(() => {
    let cancelled = false;
    setLoadedIssue(null);
    setLoadError("");
    if (!routeIssueId) {
      setLoadingIssue(false);
      return () => {
        cancelled = true;
      };
    }
    const seedIssue =
      initialIssueRef.current?.id === routeIssueId ? applyCachedIssueUpdate(initialIssueRef.current) : null;
    setLoadedIssue(seedIssue);
    setLoadingIssue(true);
    pullwiseApi.issues
      .get(routeIssueId)
      .then((payload) => {
        if (cancelled) return;
        const nextIssue = applyCachedIssueUpdate(payload);
        setLoadedIssue(nextIssue);
        if (typeof setIssue === "function") setIssue(nextIssue);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error?.message || T("Unable to load issue.", "无法加载问题�?));
      })
      .finally(() => {
        if (!cancelled) setLoadingIssue(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeIssueId, setIssue]);


  useEffect(() => {
    setCurrentStatus(activeIssue?.status || "open");
    setActionError("");
    setStatusLoading("");
    setPageCopied(false);
    statusRequestRef.current = false;
    if (pageCopyResetRef.current) {
      clearTimeout(pageCopyResetRef.current);
      pageCopyResetRef.current = null;
    }
    return () => {
      statusRequestRef.current = false;
      if (pageCopyResetRef.current) {
        clearTimeout(pageCopyResetRef.current);
        pageCopyResetRef.current = null;
      }
    };
  }, [activeIssue]);

  if (loadingIssue) {
    return (
      <div className="app fade-in">
        <Topbar
          go={go}
          breadcrumbs={[
            { label: T("Issues", "问题"), go: "issues" },
            { label: routeIssueId || T("Issue", "问题") },
          ]}
          setIssue={setIssue}
          loading
        />
        <div className="with-side">
          <Sidebar section="issues" go={go} />
          <div className="main" style={{ maxWidth: "none" }}>
            <a
              className="btn ghost sm"
              style={{ marginBottom: 12 }}
              {...screenLinkProps(go, "issues")}
            >
              <I.ArrowL size={13} /> {T("Back to list", "返回列表")}
            </a>
            <IssueDetailSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!activeIssue) {
    return (
      <div className="app fade-in">
        <Topbar go={go} breadcrumbs={[{ label: T("Issue", "问题") }]} setIssue={setIssue} />
        <div className="with-side">
          <Sidebar section="issues" go={go} />
          <div className="main">
            <div className="card section muted">
              {T("Select an issue from the list first.", "请先从列表选择一个问题�?)}
            </div>
            <a className="btn" style={{ marginTop: 12 }} {...screenLinkProps(go, "issues")}>
              <I.ArrowL size={13} /> {T("Back to issues", "返回问题列表")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const issue = activeIssue;

  const updateStatus = async (nextStatus) => {
    if (statusRequestRef.current) return;
    statusRequestRef.current = true;
    setActionError("");
    setStatusLoading(nextStatus);
    try {
      const updated = await pullwiseApi.issues.updateStatus(issue.id, {
        status: nextStatus,
        ...issueStatusIdentity(issue),
      });
      const mergedIssue = { ...issue, ...updated, status: updated?.status || nextStatus };
      rememberIssueUpdate(issue, mergedIssue);
      setCurrentStatus(mergedIssue.status);
      if (typeof setIssue === "function") setIssue(mergedIssue);
      notifyIssuesChanged({
        issueId: issue.id,
        issueKey: issueRowKey(issue),
        status: mergedIssue.status,
      });
    } catch (error) {
      setActionError(error?.message || T("Unable to update issue status.", "无法更新问题状态�?));
    } finally {
      statusRequestRef.current = false;
      setStatusLoading("");
    }
  };
  const severity = issue.severity || "info";
  const primaryLocation = issue.affectedLocations?.[0] || null;
  const copyPage = async () => {
    const copied = await copyText(buildIssuePageMarkdown(issue, currentStatus));
    if (!copied) return;
    setPageCopied(true);
    if (pageCopyResetRef.current) clearTimeout(pageCopyResetRef.current);
    pageCopyResetRef.current = setTimeout(() => {
      setPageCopied(false);
      pageCopyResetRef.current = null;
    }, 2000);
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Issues", "问题"), go: "issues" }, { label: issue.id }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <a
            className="btn ghost sm"
            style={{ marginBottom: 12 }}
            {...screenLinkProps(go, "issues")}
          >
            <I.ArrowL size={13} /> {T("Back to list", "返回列表")}
          </a>
          {loadError && (
            <div className="auth-error" role="alert" style={{ margin: "0 0 12px" }}>
              <I.X size={13} /> {loadError}
            </div>
          )}
          <div className="issue-detail-h">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className={"sev sev-" + severity}>
                  <span
                    className="dot"
                    style={{ background: "currentColor", width: 8, height: 8 }}
                  ></span>
                  {severity}
                </span>
                <span className="issue-id">{issue.id}</span>
                {issue.category && <span className="tag">{issue.category}</span>}                {issue.verificationLevel && <span className="tag">{issue.verificationLevel}</span>}
                <span className="tag">{currentStatus}</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: 0, marginBottom: 6 }}>
                {issue.title}
              </h1>
              {issue.summary && (
                <div style={{ color: "var(--text-2)", fontSize: 13.5, marginBottom: 4 }}>
                  {issue.summary}
                </div>
              )}
              <div
                className="sub"
                style={{ display: "flex", gap: 10, fontSize: 12.5, marginTop: 6, flexWrap: "wrap" }}
              >
                <span>
                  <I.Folder size={12} /> {issue.repo || T("Repository unknown", "未知仓库")}
                </span>
                <span>
                  <I.FileCode size={12} />{" "}
                  {primaryLocation
                    ? locationLabel(primaryLocation)
                    : issue.file || T("File unknown", "未知文件")}
                </span>
                {issue.scanId && (
                  <span>
                    <I.Activity size={12} /> {issue.scanId}
                  </span>
                )}
                {issue.commit && issue.commit !== "pending" && (
                  <span>
                    <I.GitBranch size={12} /> {issue.commit}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="issue-detail-grid">
            <div className="issue-detail-main-col">
              <IssueSummaryDetail issue={issue} />
            </div>

            <div className="card section issue-actions">
              <div className="section-h">
                <h3>{T("Actions", "操作")}</h3>
              </div>
              <div className="audit-scope">
                <div className="muted">{T("Audit scope", "审计范围")}</div>
                <div className="tag audit-tag">
                  {issue.repo || T("Repository unknown", "未知仓库")}
                </div>
                <div className="tag audit-tag">
                  {issue.branch || issue.audit?.branch || "main"} @ {issue.commit || "pending"}
                </div>
                {issue.jobId && (
                  <div className="tag audit-tag">
                    {T(`job ${issue.jobId}`, `任务 ${issue.jobId}`)}
                  </div>
                )}
              </div>
              <div className="divider" />
              {actionError && (
                <div className="auth-error" role="alert">
                  <I.X size={13} /> {actionError}
                </div>
              )}
              <button className="btn sm" onClick={copyPage} aria-live="polite">
                {pageCopied ? <I.Check size={13} /> : <I.Copy size={13} />}{" "}
                {pageCopied ? T("Copied", "已复�?) : T("Copy Page", "复制页面")}
              </button>
              <div className="divider" />
              {currentStatus === "open" ? (
                <div className="issue-action-row">
                  <button
                    className="btn sm primary"
                    disabled={Boolean(statusLoading)}
                    onClick={() => updateStatus("fixed")}
                  >
                    <I.Check size={13} /> {T("Mark fixed", "标记已修�?)}
                  </button>
                  <button
                    className="btn sm"
                    disabled={Boolean(statusLoading)}
                    onClick={() => updateStatus("snoozed")}
                  >
                    <I.Clock size={13} /> {T("Snooze", "推迟")}
                  </button>
                </div>
              ) : (
                <button
                  className="btn sm"
                  disabled={Boolean(statusLoading)}
                  onClick={() => updateStatus("open")}
                >
                  <I.Refresh size={13} /> {T("Reopen", "重新打开")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function dayKey(value) {
  const date = scanDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function scanDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }
  const text = String(value).trim();
  if (!text) return null;
  const num = Number(text);
  if (Number.isFinite(num) && /^\d{10,}$/.test(text)) return new Date(num * 1000);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayLabel(key) {
  const [y, m, d] = key.split("-").map((part) => Number(part));
  if (!y || !m || !d) return key;
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  if (key === todayKey) return T("Today", "今天");
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
  if (key === yesterdayKey) return T("Yesterday", "昨天");
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function scanTimeLabel(scan) {
  const date = scanDate(scan?.createdAt);
  if (date) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return scan?.time || "";
}

function scanIssuesTotal(scan) {
  if (!scan?.issues) return 0;
  return Object.values(scan.issues).reduce((sum, value) => sum + Number(value || 0), 0);
}

function groupScansByDay(scans) {
  const groups = new Map();
  for (const scan of scans) {
    const key = dayKey(scan?.createdAt) || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(scan);
  }
  return Array.from(groups.entries());
}

function groupScansByTime(scans) {
  const groups = new Map();
  for (const scan of scans) {
    const time = scanTimeLabel(scan) || "�?;
    if (!groups.has(time)) groups.set(time, []);
    groups.get(time).push(scan);
  }
  return Array.from(groups.entries());
}

function HistoryGroups({
  scans,
  viewScan,
  viewScanIssues,
  retryScan,
  retryLoading,
  downloadAuditBundle,
  bundleLoading,
  downloadDebugBundle,
  debugBundleLoading,
}) {
  const dayGroups = useMemo(() => groupScansByDay(scans), [scans]);
  if (scans.length === 0) return null;
  return (
    <div className="scan-list" role="list">
      {dayGroups.map(([key, dayItems]) => {
        const timeGroups = groupScansByTime(dayItems);
        return (
          <div className="scan-day-group" key={key} role="listitem">
            <div className="scan-day-title">
              <span className="scan-day-dot" aria-hidden="true" />
              <strong>{dayLabel(key)}</strong>
              <span className="scan-day-count">
                {T(
                  `${dayItems.length} scan${dayItems.length === 1 ? "" : "s"}`,
                  `${dayItems.length} 次扫描`
                )}
              </span>
            </div>
            <div className="scan-day-body">
              {timeGroups.map(([time, timeItems], tIndex) => (
                <div className="scan-time-block" key={`${key}-${time}-${tIndex}`}>
                  <aside className="scan-time">
                    {time}
                    {timeItems.length > 1 && (
                      <span className="scan-time-batch">
                        {T(`${timeItems.length} scans`, `${timeItems.length} 次扫描`)}
                      </span>
                    )}
                  </aside>
                  {timeItems.length === 1 ? (
                    <ScanRow
                      scan={timeItems[0]}
                      viewScan={viewScan}
                      viewScanIssues={viewScanIssues}
                      retryScan={retryScan}
                      retryLoading={retryLoading}
                      downloadAuditBundle={downloadAuditBundle}
                      bundleLoading={bundleLoading}
                      downloadDebugBundle={downloadDebugBundle}
                      debugBundleLoading={debugBundleLoading}
                    />
                  ) : (
                    <div className="scan-stack">
                      {timeItems.map((scan, sIndex) => (
                        <ScanRow
                          key={scan.id || `${scan.repo}-${scan.createdAt}-${sIndex}`}
                          scan={scan}
                          viewScan={viewScan}
                          viewScanIssues={viewScanIssues}
                          retryScan={retryScan}
                          retryLoading={retryLoading}
                          downloadAuditBundle={downloadAuditBundle}
                          bundleLoading={bundleLoading}
                          downloadDebugBundle={downloadDebugBundle}
                          debugBundleLoading={debugBundleLoading}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SEVERITY_LEGEND = [
  { key: "critical", labelEn: "Critical", labelZh: "关键" },
  { key: "high", labelEn: "High", labelZh: "�? },
  { key: "medium", labelEn: "Medium", labelZh: "�? },
  { key: "low", labelEn: "Low", labelZh: "�? },
];

function severityLabel(legend) {
  return T(legend.labelEn, legend.labelZh);
}

function scanAiUsageBadges(aiUsage) {
  if (!aiUsage) return [];
  const badges = [];
  const push = (value) => {
    const text = String(value || "").trim();
    if (text && !badges.includes(text)) badges.push(text);
  };
  push(aiUsage.agentCli || aiUsage.provider);
  push(aiUsage.model);
  if (aiUsage.reasoningEffort) {
    push(T(`reasoning: ${aiUsage.reasoningEffort}`, `推理�?{aiUsage.reasoningEffort}`));
  }
  return badges;
}

function isRetryableHistoryScan(scan) {
  return Boolean(scan?.id && ["failed", "cancelled", "lost"].includes(scan.status));
}

function ScanRow({
  scan,
  viewScan,
  viewScanIssues,
  retryScan,
  retryLoading,
  downloadAuditBundle,
  bundleLoading,
  downloadDebugBundle,
  debugBundleLoading,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const total = scanIssuesTotal(scan);
  const breakdown = scan?.issues || {};
  const status = scan.status || "info";
  const hasResults = scanHasResults(scan);
  const isDownloading = bundleLoading === scan.id;
  const isDebugDownloading = debugBundleLoading === scan.id;
  const isRetrying = retryLoading === scan.id;
  const canRetry = isRetryableHistoryScan(scan);
  const summary = scanHistorySummary(scan);
  const aiUsageBadges = scanAiUsageBadges(scan.aiUsage);
  const showProgress = status === "queued" || status === "running";
  const progressDisplay = showProgress ? scanProgressPresentation(scan, { label: T("Progress", "进度") }) : null;
  const debugBundleUrl = scanDebugZipUrl(scan);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  const issuesBadgeTone =
    total >= 5
      ? "scan-issues-badge-danger"
      : total > 0
        ? "scan-issues-badge-warning"
        : "scan-issues-badge-ok";

  const handleRowActivate = () => {
    viewScan(scan);
  };
  const handleRowKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowActivate();
    }
  };
  const stopRowClick = (event) => event.stopPropagation();

  return (
    <article
      className={`scan-row scan-row-${status}`}
      role="button"
      tabIndex={0}
      aria-label={T(`View scan ${scan.repo || ""}`, `查看扫描 ${scan.repo || ""}`)}
      onClick={handleRowActivate}
      onKeyDown={handleRowKeyDown}
    >
      <span className="scan-status-dot" aria-hidden="true" />
      <div className="scan-info">
        <div className="scan-main">
          <strong className="scan-repo">{scan.repo}</strong>
          {scan.branch && (
            <span className="scan-badge">
              <I.GitBranch size={10} /> {scan.branch}
            </span>
          )}
          {scan.commit && scan.commit !== "pending" && scan.commit !== "-" && (
            <span className="scan-badge scan-badge-muted">{scan.commit}</span>
          )}
          <span className={`scan-badge scan-badge-status scan-badge-${status}`}>{status}</span>
          {aiUsageBadges.map((badge) => (
            <span key={badge} className="scan-badge scan-badge-muted">
              {badge}
            </span>
          ))}
          {total > 0 && (
            <span className={`scan-issues-badge ${issuesBadgeTone}`}>
              {T(`${total} issue${total === 1 ? "" : "s"}`, `${total} 个问题`)}
            </span>
          )}
        </div>
        {total > 0 && (
          <div
            className="scan-severity-strip"
            role="img"
            aria-label={T(
              `${total} issues: critical ${breakdown.critical || 0}, high ${breakdown.high || 0}, medium ${breakdown.medium || 0}, low ${breakdown.low || 0}`,
              `${total} 个问题：关键 ${breakdown.critical || 0}，高 ${breakdown.high || 0}，中 ${breakdown.medium || 0}，低 ${breakdown.low || 0}`
            )}
          >
            {/* Default: severity capsules (no big colored bar �?those get read as a progress meter) */}
            <div className="scan-severity-capsules">
              {SEVERITY_LEGEND.filter((s) => Number(breakdown[s.key] || 0) > 0).map((s) => (
                <span key={s.key} className={`scan-severity-capsule scan-severity-${s.key}`}>
                  <span className="scan-severity-capsule-dot" aria-hidden="true" />
                  {severityLabel(s)} {breakdown[s.key]}
                </span>
              ))}
            </div>
            {/* On hover/focus: one dot per issue, grouped by severity.
                Replaces the capsule view for a more granular "issue cartridge" look. */}
            <div className="scan-severity-dots" aria-hidden="true">
              {SEVERITY_LEGEND.filter((s) => Number(breakdown[s.key] || 0) > 0).flatMap((s) =>
                Array.from({ length: Number(breakdown[s.key] || 0) }, (_, i) => (
                  <span
                    key={`${s.key}-${i}`}
                    className={`scan-issue-dot scan-severity-${s.key}`}
                    title={`${severityLabel(s)} #${i + 1}`}
                  />
                ))
              )}
            </div>
          </div>
        )}
        {summary && <div className="scan-summary muted">{summary}</div>}
        {showProgress && (
          <ScanProgressBar
            compact
            className="scan-row-progress"
            progress={progressDisplay.progress}
            label={progressDisplay.label}
            message={scan.progressMessage}
            valueLabel={progressDisplay.valueLabel}
            ariaValueText={progressDisplay.ariaValueText}
          />
        )}
      </div>
      <div className="scan-row-actions" ref={menuRef} onClick={stopRowClick}>
        {canRetry && (
          <button className="btn sm" disabled={isRetrying} onClick={() => retryScan(scan)}>
            {isRetrying ? T("Retrying...", "正在重试...") : T("Retry", "重试")}
          </button>
        )}
        <button
          className="btn sm"
          disabled={!scan.id || !hasResults}
          onClick={() => viewScanIssues(scan)}
        >
          {T("Issues", "问题")}
        </button>
        <button className="btn sm" onClick={() => viewScan(scan)}>
          {T("View", "查看")}
        </button>
        <button
          type="button"
          className="btn sm scan-row-more"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={T("More actions", "更多操作")}
          title={T("More actions", "更多操作")}
          onClick={() => setMenuOpen((open) => !open)}
        >
          �?
        </button>
        {menuOpen && (
          <div className="scan-row-menu" role="menu">
            <button
              type="button"
              className="scan-row-menu-item"
              role="menuitem"
              disabled={!hasResults || isDownloading}
              onClick={() => {
                setMenuOpen(false);
                downloadAuditBundle(scan);
              }}
            >
              <I.Download size={12} />
              {isDownloading ? T("Preparing...", "准备�?..") : T("Download zip", "下载 zip")}
            </button>
            <button
              type="button"
              className="scan-row-menu-item"
              role="menuitem"
              disabled={!debugBundleUrl || isDebugDownloading}
              onClick={() => {
                setMenuOpen(false);
                downloadDebugBundle(scan);
              }}
            >
              <I.Download size={12} />
              {isDebugDownloading ? T("Preparing debug zip...", "正在准备 debug zip...") : T("Download debug zip", "下载 debug zip")}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function HistorySkeleton() {
  return (
    <div className="history-skeleton" aria-busy="true">
      <div className="scan-day-group">
        <div className="scan-day-title">
          <SkeletonLine className="sk-line sk-w-20" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <article className="scan-row skeleton-row" key={`history-row-skeleton-${index}`}>
            <span className="scan-status-dot" aria-hidden="true" />
            <div className="scan-info">
              <div className="scan-main">
                <SkeletonLine className="sk-line sk-w-36 sk-h-18" />
                <SkeletonLine className="sk-line sk-w-18 sk-h-20" />
                <SkeletonLine className="sk-line sk-w-14 sk-h-20" />
              </div>
              <SkeletonLine className="sk-line sk-w-70" />
            </div>
            <div className="scan-row-actions">
              <SkeletonLine className="sk-line sk-w-26 sk-h-28" />
              <SkeletonLine className="sk-line sk-w-22 sk-h-28" />
              <SkeletonLine className="sk-line sk-w-10 sk-h-28" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function cleanExpectedScanIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = [];
  const seen = new Set();
  for (const item of value) {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function cleanExpectedScanRequests(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      repoId: String(item?.repoId || "").trim(),
      repo: String(item?.repo || "").trim(),
      branch: String(item?.branch || "main").trim() || "main",
      requestId: String(item?.requestId || "").trim(),
    }))
    .filter((item) => item.repoId || item.repo || item.requestId);
}

function normalizeExpectedScanStartedAt(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

function scanHistoryTimestamp(scan) {
  const value = Number(scan?.createdAt ?? scan?.startedAt ?? scan?.updatedAt);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value > 1000000000000 ? Math.floor(value / 1000) : value;
}

function scanIsAfterHistoryHandoff(scan, expectedScanStartedAt) {
  if (!expectedScanStartedAt) return true;
  const timestamp = scanHistoryTimestamp(scan);
  return timestamp !== null && timestamp >= expectedScanStartedAt - 5;
}

function scanMatchesExpectedRequest(scan, request, expectedScanStartedAt) {
  const requestId = String(request?.requestId || "").trim();
  if (requestId && String(scan?.requestId || "").trim() === requestId) return true;

  const expectedRepoId = String(request?.repoId || "").trim();
  const expectedRepo = String(request?.repo || "").trim();
  const expectedBranch = String(request?.branch || "main").trim() || "main";
  const scanRepoId = String(scan?.repoId || "").trim();
  const scanRepo = String(scan?.repo || "").trim();
  const scanBranch = String(scan?.branch || "main").trim() || "main";
  const repoMatches =
    (expectedRepoId && scanRepoId && expectedRepoId === scanRepoId) ||
    (expectedRepo && scanRepo && expectedRepo === scanRepo);
  return repoMatches && expectedBranch === scanBranch && scanIsAfterHistoryHandoff(scan, expectedScanStartedAt);
}

function scanListIncludesExpectedRequests(scans, expectedScanRequests, expectedScanStartedAt) {
  if (!expectedScanRequests.length) return true;
  if (!Array.isArray(scans) || !scans.length) return false;
  const used = new Set();
  for (const request of expectedScanRequests) {
    const matchIndex = scans.findIndex(
      (scan, index) => !used.has(index) && scanMatchesExpectedRequest(scan, request, expectedScanStartedAt)
    );
    if (matchIndex < 0) return false;
    used.add(matchIndex);
  }
  return true;
}

function scanListIncludesExpectedIds(scans, expectedScanIds) {
  if (!expectedScanIds.length) return true;
  if (!Array.isArray(scans) || !scans.length) return false;
  const scanIds = new Set(scans.map((scan) => String(scan?.id || "").trim()).filter(Boolean));
  return expectedScanIds.every((scanId) => scanIds.has(scanId));
}

function missingExpectedScanIds(scans, expectedScanIds) {
  if (!expectedScanIds.length) return [];
  const scanIds = new Set(
    (scans || []).map((scan) => String(scan?.id || "").trim()).filter(Boolean)
  );
  return expectedScanIds.filter((scanId) => !scanIds.has(scanId));
}

function scansFromStatusPayload(payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.scans)
        ? payload.scans
        : [];
  return items.map(normalizeScan).filter((scan) => scan.id);
}

export function HistoryScreen({
  go,
  openScan = null,
  openScanIssues = null,
  setIssue = null,
  expectedScanIds = [],
  expectedScanRequests = [],
  expectedScanStartedAt = null,
  onExpectedScansLoaded = null,
}) {
  useLang();
  const [status, setStatus] = useState("all");
  const [bundleLoading, setBundleLoading] = useState("");
  const [debugBundleLoading, setDebugBundleLoading] = useState("");
  const [retryLoading, setRetryLoading] = useState("");
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [expectedScanRetryCount, setExpectedScanRetryCount] = useState(0);
  const [actionError, setActionError] = useState("");
  const {
    items: scans,
    loading,
    loadingMore,
    error,
    reload,
    loadMore,
    upsertScan,
    meta = {},
  } = useScans({ status, limit: 50 });
  const filtered = scans;
  const normalizedExpectedScanIds = useMemo(
    () => cleanExpectedScanIds(expectedScanIds),
    [expectedScanIds]
  );
  const expectedScanIdsKey = useMemo(
    () => normalizedExpectedScanIds.join("|"),
    [normalizedExpectedScanIds]
  );
  const normalizedExpectedScanRequests = useMemo(
    () => cleanExpectedScanRequests(expectedScanRequests),
    [expectedScanRequests]
  );
  const expectedScanRequestsKey = useMemo(
    () => JSON.stringify(normalizedExpectedScanRequests),
    [normalizedExpectedScanRequests]
  );
  const normalizedExpectedScanStartedAt = normalizeExpectedScanStartedAt(expectedScanStartedAt);
  const hasExpectedScans =
    normalizedExpectedScanIds.length > 0 || normalizedExpectedScanRequests.length > 0;
  const expectedScansLoaded = useMemo(
    () =>
      scanListIncludesExpectedIds(filtered, normalizedExpectedScanIds) &&
      scanListIncludesExpectedRequests(
        filtered,
        normalizedExpectedScanRequests,
        normalizedExpectedScanStartedAt
      ),
    [
      filtered,
      normalizedExpectedScanIds,
      normalizedExpectedScanRequests,
      normalizedExpectedScanStartedAt,
    ]
  );
  const expectedScanIdsMissing = useMemo(
    () => missingExpectedScanIds(filtered, normalizedExpectedScanIds),
    [filtered, normalizedExpectedScanIds]
  );
  const expectedScanWaitExpired =
    hasExpectedScans &&
    !expectedScansLoaded &&
    !error &&
    expectedScanRetryCount >= HISTORY_EXPECTED_SCAN_MAX_RETRIES;
  const waitingForExpectedScans =
    hasExpectedScans &&
    !expectedScansLoaded &&
    !error &&
    !expectedScanWaitExpired;
  const displayLoading = loading || waitingForExpectedScans;
  const totalCount = Number.isFinite(Number(meta.total)) ? Number(meta.total) : filtered.length;

  useEffect(() => {
    setExpectedScanRetryCount(0);
  }, [expectedScanIdsKey, expectedScanRequestsKey, normalizedExpectedScanStartedAt, status]);

  useEffect(() => {
    if (!waitingForExpectedScans || loading) return undefined;
    let cancelled = false;
    const handle = setTimeout(() => {
      setExpectedScanRetryCount((count) => count + 1);
      const refreshExpectedScans = async () => {
        if (typeof reload === "function") {
          try {
            await reload({ quiet: true });
          } catch {
            // The targeted status refresh below can still recover scans omitted from the list page.
          }
        }
        if (
          cancelled ||
          typeof pullwiseApi.scans.status !== "function" ||
          typeof upsertScan !== "function"
        ) {
          return;
        }
        const scanIds = expectedScanIdsMissing.length
          ? expectedScanIdsMissing
          : normalizedExpectedScanIds;
        if (!scanIds.length) return;
        try {
          const payload = await pullwiseApi.scans.status(scanIds);
          if (cancelled) return;
          for (const scan of scansFromStatusPayload(payload)) {
            upsertScan(scan);
          }
        } catch {
          // The list refresh above is still the fallback source while the scan is propagating.
        }
      };
      refreshExpectedScans();
    }, HISTORY_EXPECTED_SCAN_RETRY_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    waitingForExpectedScans,
    loading,
    reload,
    expectedScanRetryCount,
    expectedScanIdsMissing,
    normalizedExpectedScanIds,
    upsertScan,
  ]);

  useEffect(() => {
    if (
      hasExpectedScans &&
      expectedScansLoaded &&
      typeof onExpectedScansLoaded === "function"
    ) {
      onExpectedScansLoaded();
    }
  }, [expectedScansLoaded, hasExpectedScans, onExpectedScansLoaded]);

  const viewScan = (scan) => {
    if (openScan) {
      openScan(scan);
      return;
    }
    go("dashboard");
  };
  const viewScanIssues = (scan) => {
    if (!scan?.id || !scanHasResults(scan)) return;
    if (openScanIssues) {
      openScanIssues(scan);
      return;
    }
    go("issues");
  };
  const downloadAuditBundle = async (scan) => {
    if (!scan?.id || !scanHasResults(scan) || bundleLoading) return;
    setBundleLoading(scan.id);
    try {
      const bundle = await pullwiseApi.scans.auditBundleArchive(scan.id);
      downloadBlob(`pullwise-audit-${scan.id}.zip`, bundle, "application/zip");
    } catch (error) {
      globalThis.alert?.(
        error?.message || T("Unable to download audit bundle.", "无法下载审计包�?)
      );
    } finally {
      setBundleLoading("");
    }
  };
  const downloadDebugBundle = async (scan) => {
    const debugUrl = scanDebugZipUrl(scan);
    if (!scan?.id || !debugUrl || debugBundleLoading) return;
    setDebugBundleLoading(scan.id);
    try {
      const response = await fetch(debugUrl, { credentials: "include" });
      if (!response.ok) throw new Error(T("Unable to download debug bundle.", "无法下载 debug bundle�?));
      const bundle = await response.blob();
      downloadBlob(`pullwise-debug-${scan.id}.zip`, bundle, "application/zip");
    } catch (error) {
      globalThis.alert?.(error?.message || T("Unable to download debug bundle.", "无法下载 debug bundle�?));
    } finally {
      setDebugBundleLoading("");
    }
  };
  const retryScan = async (scan) => {
    if (!scan?.id || retryLoading) return;
    setActionError("");
    setRetryLoading(scan.id);
    try {
      const payload = await pullwiseApi.scans.retry(scan.id);
      const inlinePayload = retryResponseScanPayload(payload);
      const refreshed = inlinePayload
        ? normalizeScan(inlinePayload)
        : normalizeScan(await pullwiseApi.scans.get(retryResponseScanId(payload, scan.id)));
      if (typeof upsertScan === "function") {
        upsertScan(refreshed, scan.id);
      } else if (typeof reload === "function") {
        await reload({ quiet: true });
      }
    } catch (actionError) {
      setActionError(actionError?.message || T("Unable to retry scan.", "无法重试扫描�?));
    } finally {
      setRetryLoading("");
    }
  };
  const refreshHistory = async () => {
    if (refreshLoading || displayLoading || typeof reload !== "function") return;
    setActionError("");
    setRefreshLoading(true);
    try {
      await reload({ quiet: true });
    } catch (refreshError) {
      setActionError(
        refreshError?.message || T("Unable to refresh scan history.", "无法刷新扫描历史�?)
      );
    } finally {
      setRefreshLoading(false);
    }
  };
  const refreshDisabled = refreshLoading || displayLoading || typeof reload !== "function";

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Scan history", "扫描历史") }]}
        setIssue={setIssue}
        loading={displayLoading}
      />
      <div className="with-side">
        <Sidebar section="history" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Scan history", "扫描历史")}</h1>
              <div className="sub">
                {displayLoading ? (
                  <SkeletonLine className="sk-line sk-w-36" />
                ) : (
                  T(
                    `${filtered.length} of ${totalCount} scans`,
                    `${filtered.length} / ${totalCount} 次扫描`
                  )
                )}
              </div>
            </div>
            <div className="actions">
              <div className="seg">
                {["all", "queued", "running", "done", "failed", "cancelled"].map((item) => (
                  <button
                    key={item}
                    className={"seg-i" + (status === item ? " active" : "")}
                    onClick={() => setStatus(item)}
                  >
                    {item === "all" ? T("All", "全部") : item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn"
                disabled={refreshDisabled}
                onClick={refreshHistory}
                title={T("Refresh scan history", "刷新扫描历史")}
              >
                <I.Refresh size={13} className={refreshLoading ? "spin" : undefined} />
                {refreshLoading ? T("Refreshing...", "正在刷新...") : T("Refresh", "刷新")}
              </button>
              <a className="btn primary" {...screenLinkProps(go, "repos")}>
                <I.Play size={11} /> {T("New scan", "新扫�?)}
              </a>
            </div>
          </div>

          <div className="hist-list card">
            {!waitingForExpectedScans && error && (
              <div className="muted" style={{ padding: 18 }}>
                {error}
              </div>
            )}
            {!error && (actionError || expectedScanWaitExpired) && (
              <div className="auth-error" role="alert" style={{ margin: "18px 18px 0" }}>
                <I.X size={13} /> {actionError || T("New scan has not appeared yet. Refresh scan history to try again.", "New scan has not appeared yet. Refresh scan history to try again.")}
              </div>
            )}
            {displayLoading && <HistorySkeleton />}
            {!displayLoading && !error && filtered.length === 0 && (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--text-3)",
                  fontSize: 13,
                }}
              >
                {T("No scans yet.", "暂无扫描�?)}
              </div>
            )}
            {!displayLoading && filtered.length > 0 && (
              <HistoryGroups
                scans={filtered}
                viewScan={viewScan}
                viewScanIssues={viewScanIssues}
                retryScan={retryScan}
                retryLoading={retryLoading}
                downloadAuditBundle={downloadAuditBundle}
                bundleLoading={bundleLoading}
                downloadDebugBundle={downloadDebugBundle}
                debugBundleLoading={debugBundleLoading}
              />
            )}
            {!displayLoading && meta.hasMore && (
              <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
                <button className="btn sm" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? T("Loading...", "正在加载...") : T("Load more", "加载更多")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsScreen({ go, setIssue = null }) {
  useLang();
  const [tab, setTab] = useState("profile");
  const [session, setSession] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [initialLoadError, setInitialLoadError] = useState("");
  const [integrations, setIntegrations] = useState(null);
  const [integrationError, setIntegrationError] = useState("");
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const integrationRequestIdRef = useRef(0);

  const loadSettingsPayloads = useCallback(async (cancelledRef = null) => {
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    setSettingsLoading(true);
    setInitialLoadError("");
    setProfileError("");
    setSettingsError("");
    setIntegrationError("");
    const [sessionResult, integrationsResult, settingsResult] = await Promise.allSettled([
      pullwiseApi.auth.getSession(),
      pullwiseApi.integrations.list(),
      pullwiseApi.settings.get(),
    ]);
    if (cancelledRef?.current) return;

    const errors = [];
    if (sessionResult.status === "fulfilled") {
      setSession(sessionResult.value);
    } else {
      const message = sessionResult.reason?.message || T("Unable to load account session.", "Unable to load account session.");
      setSession(null);
      setProfileError(message);
      errors.push(message);
    }

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value);
    } else {
      const message = settingsResult.reason?.message || T("Unable to load preferences.", "Unable to load preferences.");
      setSettings(null);
      setSettingsError(message);
      errors.push(message);
    }

    if (requestId === integrationRequestIdRef.current) {
      if (integrationsResult.status === "fulfilled") {
        setIntegrations(integrationsResult.value);
      } else {
        const message = integrationsResult.reason?.message || T("Unable to load GitHub integrations.", "Unable to load GitHub integrations.");
        setIntegrations(null);
        setIntegrationError(message);
        errors.push(message);
      }
    }
    setInitialLoadError(errors.join(" "));
    setSettingsLoading(false);
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadSettingsPayloads(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadSettingsPayloads]);

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
        setIntegrationError(
          error?.message ||
            T("Unable to refresh GitHub repository access.", "无法刷新 GitHub 仓库访问�?)
        );
      }
      throw error;
    }
  }, []);

  useGitHubRepositoryAccessAutoRefresh(refreshGitHubRepositoryAccess);

  const github = integrations?.github;
  const user = session?.user;
  const githubRepoCount = github?.repositories?.length || 0;
  const githubAccountNames = Array.from(
    new Set(
      [
        ...(Array.isArray(github?.installationAccounts) ? github.installationAccounts : []),
        github?.installationAccount,
      ].filter(Boolean)
    )
  );
  const githubAccount = githubAccountNames.length ? ` on ${githubAccountNames.join(", ")}` : "";
  const githubAccountZh = githubAccountNames.length ? `�?{githubAccountNames.join(", ")}）` : "";
  const hasGitHubInstallationDetails =
    Array.isArray(github?.installations) && github.installations.length > 0;
  const reviewOutputLanguage = reviewOutputLanguageValue(settings);
  const settingsTabs = [
    { k: "profile", t: T("Profile", "个人资料"), i: <I.User size={14} /> },
    {
      k: "preferences",
      t: T("Preferences", "偏好"),
      i: <I.Sliders size={14} />,
    },
    { k: "integrations", t: T("Integrations", "集成"), i: <I.Github size={14} /> },
  ];
  const updateReviewOutputLanguage = async (event) => {
    const outputLanguage = event.target.value;
    const previousSettings = settings;
    setSettingsError("");
    setSettingsSaving("reviewOutputLanguage");
    setSettings(withReviewOutputLanguage(settings, outputLanguage));
    try {
      const settingsPayload = await pullwiseApi.settings.update({
        review: { outputLanguage },
      });
      setSettings(withReviewOutputLanguage(settingsPayload, outputLanguage, previousSettings));
    } catch (error) {
      setSettings(previousSettings);
      setSettingsError(reviewOutputLanguageSaveError(error));
    } finally {
      setSettingsSaving("");
    }
  };
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
        setIntegrationError(
          error?.message ||
            T("Unable to connect GitHub repository access.", "无法连接 GitHub 仓库访问�?)
        );
      }
    }
  };
  const manageInstallation = async (installation) => {
    if (managingInstallationId) return;
    const targetInstallationId = installation?.id || installation?.installationId;
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    setManagingInstallationId(targetInstallationId || "");
    setIntegrationError("");
    try {
      await manageGitHubInstallation(targetInstallationId, {
        githubIdentityId: installation?.manage?.githubIdentityId || undefined,
        redirectTo: window.location.href,
      });
      const integrationsPayload = await pullwiseApi.integrations.list();
      if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
    } catch (error) {
      if (requestId === integrationRequestIdRef.current) {
        setIntegrationError(
          error?.message || T("Unable to manage GitHub installation.", "无法管理 GitHub 安装�?)
        );
      }
    } finally {
      if (requestId === integrationRequestIdRef.current) setManagingInstallationId("");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[{ label: T("Settings", "设置") }]} setIssue={setIssue} loading={settingsLoading} />
      <div className="with-side">
        <Sidebar section="settings" go={go} />
        <div className="main">
          <div className="page-h">
            <div>
              <h1>{T("Settings", "设置")}</h1>
              <div className="sub">{T("Account and integrations", "账号与集�?)}</div>
            </div>
          </div>
          {initialLoadError && (
            <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
              <I.X size={13} />
              <span style={{ flex: 1 }}>{initialLoadError}</span>
              <button className="btn sm" type="button" onClick={() => loadSettingsPayloads()} disabled={settingsLoading}>
                {settingsLoading ? T("Retrying...", "Retrying...") : T("Retry", "Retry")}
              </button>
            </div>
          )}
          <div className="set-shell">
            <aside className="set-side">
              {settingsTabs.map((item) => (
                <button
                  key={item.k}
                  className={"set-side-i" + (tab === item.k ? " active" : "")}
                  onClick={() => setTab(item.k)}
                >
                  {item.i}
                  <span>{item.t}</span>
                </button>
              ))}
            </aside>
            <div className="set-body">
              {tab === "profile" && (
                <div className="card section">
                  <div className="section-h">
                    <h3>{T("Profile", "个人资料")}</h3>
                  </div>
                  {profileError && (
                    <div className="auth-error" role="alert">
                      <I.X size={13} /> {profileError}
                    </div>
                  )}
                  <div className="set-row">
                    <div className="set-av" style={{ background: "var(--accent)" }}>
                      {(user?.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="auth-field">
                        <span>{T("Name", "姓名")}</span>
                        <div className="auth-input">
                          <input value={user?.name || ""} readOnly />
                        </div>
                      </label>
                    </div>
                  </div>
                  <label className="auth-field">
                    <span>{T("Email", "邮箱")}</span>
                    <div className="auth-input">
                      <I.Mail size={13} />
                      <input value={user?.email || ""} readOnly />
                    </div>
                  </label>
                  <div className="set-pref">
                    <div>
                      <b>{T("Session", "会话")}</b>
                      <div className="muted">
                        {T("Stay signed in for 7 days on this browser.", "此浏览器保持登录 7 天�?)}
                      </div>
                    </div>
                    <button className="btn sm" onClick={signOut}>
                      {T("Sign out", "退出登�?)}
                    </button>
                  </div>
                </div>
              )}
              {tab === "preferences" && (
                <div className="card section">
                  <div className="section-h">
                    <h3>{T("Preferences", "偏好")}</h3>
                  </div>
                  <div className="set-pref">
                    <div>
                      <b>{T("Review output language", "产出语言偏好")}</b>
                      <div className="muted">{T("Default is English.", "默认英语�?)}</div>
                    </div>
                    <select
                      className="set-select"
                      aria-label={T("Review output language", "产出语言偏好")}
                      disabled={!settings || settingsSaving === "reviewOutputLanguage"}
                      value={reviewOutputLanguage}
                      onChange={updateReviewOutputLanguage}
                    >
                      {REVIEW_OUTPUT_LANGUAGES.map((language) => (
                        <option key={language.value} value={language.value}>
                          {T(language.labelEn, language.labelZh)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {settingsError && (
                    <div className="auth-error" role="alert">
                      <I.X size={13} /> {settingsError}
                    </div>
                  )}
                </div>
              )}
              {tab === "integrations" && (
                <div className="card section">
                  <div className="section-h">
                    <h3>{T("Personal authorizations", "个人授权")}</h3>
                  </div>
                  <div className="int-row">
                    <I.Github size={20} />
                    <div style={{ flex: 1 }}>
                      <b>{T("GitHub repository authorization", "GitHub 仓库授权")}</b>
                      {(!github?.connected || !hasGitHubInstallationDetails) && (
                        <div className="muted">
                          {github?.connected
                            ? T(
                                `${githubRepoCount} repositories authorized${githubAccount}`,
                                `${githubRepoCount} 个仓库已授权${githubAccountZh}`
                              )
                            : T(
                                "Connect repositories when you are ready to scan. Pullwise uses GitHub App repository access for checkout, fix branches, and pull requests.",
                                "准备扫描时再连接仓库。Pullwise 使用 GitHub App 仓库权限进行 checkout、修复分支和 PR 创建�?
                              )}
                        </div>
                      )}
                    </div>
                    <span
                      className="pill sev-bg-low"
                      style={{
                        background: "color-mix(in oklch, #16a34a 14%, transparent)",
                        color: "#16a34a",
                      }}
                    >
                      <span className="dot"></span>{" "}
                      {github?.connected ? T("Connected", "已连�?) : T("Disconnected", "未连�?)}
                    </span>
                    <button className="btn sm" onClick={authorizeRepositories}>
                      {github?.connected
                        ? T("Add account or organization", "添加账号或组�?)
                        : T("Connect repositories", "连接仓库")}
                    </button>
                  </div>
                  {Array.isArray(github?.identities) && github.identities.length > 0 && (
                    <div className="gh-identities">
                      {github.identities.map((identity) => (
                        <span className="tag" key={identity.id || identity.login}>
                          <I.User size={10} /> @{identity.login}
                        </span>
                      ))}
                    </div>
                  )}
                  {github?.connected && (
                    <GitHubInstallationsList
                      installations={github?.installations}
                      onManage={manageInstallation}
                      managingInstallationId={managingInstallationId}
                    />
                  )}
                  {integrationError && (
                    <div className="auth-error" role="alert">
                      <I.X size={13} /> {integrationError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
