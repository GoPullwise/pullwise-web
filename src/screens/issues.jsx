import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { MarkdownReport } from "../components/markdown-report.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { ScanProgressBar, scanProgressPresentation } from "../components/scan-progress.jsx";
import { useErrorNotification, useNotify } from "../components/notifications.jsx";
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
  scanCanDownloadAuditBundle,
  scanHasBlockingError,
  scanHasResults,
  scanQueueSummary,
  useIssues,
  useScans,
} from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const DEFAULT_REVIEW_OUTPUT_LANGUAGE = "en";
const HISTORY_EXPECTED_SCAN_RETRY_MS = 1500;
const HISTORY_EXPECTED_SCAN_TIMEOUT_MS = 30_000;
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

function issueMatchesListFilters(issue, { status, severity }) {
  if (status && status !== "all" && issue.status !== status) return false;
  if (severity && severity !== "all" && issue.severity !== severity) return false;
  return true;
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
const ISSUE_BULK_PAGE_LIMIT = 100;
const ISSUE_STATUS_BATCH_LIMIT = 100;
const ISSUE_STATUS_FALLBACK_CHUNK_SIZE = 10;

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

function nonNegativeInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null;
}

function issueItemsFromPage(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.issues)) return payload.issues;
  return [];
}

function chunksOf(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function collectMatchingIssuesAcrossPages(initialItems, initialMeta, params) {
  const issuesByKey = new Map();
  const addIssues = (items, { applyCache = true } = {}) => {
    let added = 0;
    items.forEach((item) => {
      const issue = applyCache ? applyCachedIssueUpdate(item) : item;
      const key = issueRowKey(issue);
      if (!issuesByKey.has(key)) added += 1;
      issuesByKey.set(key, issue);
    });
    return added;
  };
  addIssues(initialItems, { applyCache: false });

  const initialTotal = nonNegativeInteger(initialMeta?.total);
  let hasMore = Boolean(initialMeta?.hasMore ?? initialMeta?.has_more);
  let nextOffset = nonNegativeInteger(initialMeta?.nextOffset ?? initialMeta?.next_offset);
  if (nextOffset === null) {
    const offset = nonNegativeInteger(initialMeta?.offset);
    const limit = nonNegativeInteger(initialMeta?.limit);
    nextOffset = offset !== null && limit !== null ? offset + limit : initialItems.length;
  }
  if (!hasMore && initialTotal !== null && nextOffset < initialTotal) hasMore = true;

  const requestedOffsets = new Set();
  while (hasMore) {
    if (requestedOffsets.has(nextOffset)) {
      throw new Error("Issue pagination did not advance. Refresh to retry.");
    }
    requestedOffsets.add(nextOffset);
    const payload = await pullwiseApi.issues.list({
      ...params,
      limit: ISSUE_BULK_PAGE_LIMIT,
      offset: nextOffset,
    });
    const pageItems = issueItemsFromPage(payload);
    const addedCount = addIssues(pageItems);
    const pageOffset = nonNegativeInteger(payload?.offset) ?? nextOffset;
    const pageLimit = nonNegativeInteger(payload?.limit) || ISSUE_BULK_PAGE_LIMIT;
    const explicitNextOffset = nonNegativeInteger(payload?.nextOffset ?? payload?.next_offset);
    const candidateNextOffset = explicitNextOffset ?? pageOffset + pageItems.length;
    const total = nonNegativeInteger(payload?.total ?? payload?.count) ?? initialTotal;
    const explicitHasMore = payload?.hasMore ?? payload?.has_more;
    const pageHasMore =
      typeof explicitHasMore === "boolean"
        ? explicitHasMore
        : total !== null
          ? candidateNextOffset < total
          : pageItems.length >= pageLimit;
    if (
      pageHasMore &&
      (pageItems.length === 0 || addedCount === 0 || candidateNextOffset <= nextOffset)
    ) {
      throw new Error("Issue pagination did not advance. Refresh to retry.");
    }
    hasMore = pageHasMore;
    nextOffset = candidateNextOffset;
  }
  return Array.from(issuesByKey.values());
}

async function updateIssueStatusesInBatches(targets, nextStatus) {
  if (typeof pullwiseApi.issues.updateStatuses === "function") {
    const results = [];
    for (const batch of chunksOf(targets, ISSUE_STATUS_BATCH_LIMIT)) {
      try {
        const payload = await pullwiseApi.issues.updateStatuses(
          batch.map((issue) => ({
            id: issue.id,
            status: nextStatus,
            ...issueStatusIdentity(issue),
          }))
        );
        const returned = issueItemsFromPage(payload);
        batch.forEach((target) => {
          const targetKey = issueRowKey(target);
          const updated =
            returned.find((issue) => issueRowKey(issue) === targetKey) ||
            returned.find((issue) => String(issue?.id || "") === String(target.id || ""));
          results.push(
            updated
              ? { status: "fulfilled", value: updated }
              : { status: "rejected", reason: new Error("Issue was not updated.") }
          );
        });
      } catch (error) {
        batch.forEach(() => results.push({ status: "rejected", reason: error }));
      }
    }
    return results;
  }

  const results = [];
  for (const batch of chunksOf(targets, ISSUE_STATUS_FALLBACK_CHUNK_SIZE)) {
    results.push(
      ...(await Promise.allSettled(
        batch.map((issue) =>
          pullwiseApi.issues.updateStatus(issue.id, {
            status: nextStatus,
            ...issueStatusIdentity(issue),
          })
        )
      ))
    );
  }
  return results;
}

function issueTotal(scan) {
  if (!scan?.issues) return 0;
  return Object.values(scan.issues).reduce((sum, value) => sum + Number(value || 0), 0);
}


function scanHistorySummary(scan) {
  if (scanHasBlockingError(scan)) return scan.error;
  const queueSummary = scanQueueSummary(scan);
  if (scan.status === "queued" && queueSummary) {
    return [T("queued", "\u6392\u961f\u4e2d"), ...queueSummary.tags].join(" - ");
  }
  if (scan.status === "partial_completed") {
    const total = issueTotal(scan);
    return total > 0
      ? T(`Partial result - ${total} confirmed`, `部分结果 - ${total} confirmed`)
      : T("Partial result available", "部分结果可用");
  }
  if (scan.status === "cancelled") return T("Scan cancelled", "\u626b\u63cf\u5df2\u53d6\u6d88");
  if (scan.status === "lost") {
    return T("Scan lost", "扫描丢失");
  }
  if (scan.issues) {
    const total = issueTotal(scan);
    return T(`${total} confirmed`, `${total} confirmed`);
  }
  return scan.status;
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

function markdownListItems(items) {
  return (Array.isArray(items) ? items : []).map(markdownText).filter(Boolean);
}

function appendMarkdownListSection(lines, title, items) {
  const values = markdownListItems(items);
  if (!values.length) return;
  lines.push("", `## ${title}`, ...values.map((item) => `- ${item}`));
}

function appendMarkdownKeyValueSection(lines, title, rows) {
  const values = rows
    .map(([label, value]) => [label, markdownText(value)])
    .filter(([, value]) => value);
  if (!values.length) return;
  lines.push("", `## ${title}`, ...values.map(([label, value]) => `- ${label}: ${value}`));
}

function issueEvidenceText(item) {
  if (typeof item === "string") return markdownText(item);
  if (!item || typeof item !== "object") return "";
  const label = markdownText(item.label || item.type || "Evidence");
  const summary = markdownText(item.summary || item.text || item.output || item.actual);
  const location = item.file ? locationLabel(item) : "";
  const command = markdownText(item.command);
  return [label, summary, location, command].filter(Boolean).join(" - ");
}

function issueValidationSourceRows(sources) {
  if (!sources || typeof sources !== "object") return [];
  return Object.entries(sources).map(([key, value]) => [key, issueSourceValueText(value)]);
}

function issueSourceValueText(value) {
  if (Array.isArray(value)) return value.map(issueSourceValueText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${issueSourceValueText(item)}`)
      .filter(Boolean)
      .join("; ");
  }
  return markdownText(value);
}

function buildIssuePageMarkdown(issue, currentStatus) {
  const title = markdownText(issue.title) || markdownText(issue.id) || "Issue";
  const primaryLocation = issue.affectedLocations?.[0] || null;
  const lines = [`# ${title}`];
  appendMarkdownKeyValueSection(lines, "Metadata", [
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
    ["Confidence", issue.confidenceLevel || issue.confidence],
    ["Verification", issue.verificationStatus],
  ]);
  appendMarkdownSection(lines, "Summary", issue.summary || issue.failureScenario);
  appendMarkdownSection(lines, "Impact", issue.impact);
  appendMarkdownSection(lines, "Detection reasoning", issue.detectionReasoning);
  appendMarkdownSection(lines, "Verification", issue.verificationSummary);
  appendMarkdownListSection(
    lines,
    "Affected locations",
    (issue.affectedLocations || []).map(locationLabel)
  );
  appendMarkdownListSection(lines, "Evidence", (issue.evidence || []).map(issueEvidenceText));
  appendMarkdownListSection(lines, "False-positive checks", issue.whyNotFalsePositive);
  appendMarkdownSection(lines, "Recommendation", issue.recommendation);
  appendMarkdownSection(lines, "Next agent task", issue.nextAgentTask);
  appendMarkdownListSection(lines, "Remediation steps", issue.steps);
  appendMarkdownSection(lines, "Disproof attempt", issue.disproofAttempt);
  appendMarkdownKeyValueSection(
    lines,
    "Validation sources",
    issueValidationSourceRows(issue.validationSources)
  );
  appendMarkdownListSection(lines, "Limitations", issue.limitations);
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function issuePageMarkdown(issue, currentStatus) {
  const rawMarkdown = markdownText(issue.rawMarkdown);
  return rawMarkdown || buildIssuePageMarkdown(issue, currentStatus);
}

function confidenceLabel(issue) {
  if (issue.confidenceLevel) return issue.confidenceLevel;
  const confidence = Number(issue.confidence);
  if (!Number.isFinite(confidence) || confidence <= 0) return "";
  return confidence <= 1 ? `${Math.round(confidence * 100)}%` : String(confidence);
}

function IssueChecklistSection({ issue }) {
  const checklist = Array.isArray(issue.evidenceChecklist) ? issue.evidenceChecklist : [];
  if (!checklist.length) return null;
  return (
    <div className="issue-checklist">
      {checklist.map((item) => (
        <div className="issue-check" key={item.id || item.label}>
          <span className={item.met ? "issue-check-dot met" : "issue-check-dot"}>
            {item.met ? <I.Check size={10} /> : null}
          </span>
          <div>
            <b>{item.label || item.id}</b>
            {item.detail && <span>{item.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
function IssueSummaryDetail({ issue, currentStatus }) {
  const markdown = issuePageMarkdown(issue, currentStatus);
  return (
    <div className="scan-human-report issue-markdown-report card section">
      <div className="section-h">
        <h3>{T("Issue report", "Issue report")}</h3>
      </div>
      <MarkdownReport markdown={markdown} />
    </div>
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
          <div>
            <SkeletonLine className="sk-line sk-w-28" />
          </div>
          <div>
            <SkeletonLine className="sk-line sk-w-16" />
          </div>
          <div>
            <SkeletonLine className="sk-line sk-w-16" />
          </div>
          <div>
            <SkeletonLine className="sk-line sk-w-16" />
          </div>
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
  const [completedBulkScope, setCompletedBulkScope] = useState("");
  const [statusActionError, setStatusActionError] = useState("");
  const [localIssueUpdates, setLocalIssueUpdates] = useState({});
  const statusUpdatingRef = useRef(new Set());
  const bulkStatusUpdatingRef = useRef(false);
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
    ...localIssues.filter(
      (issue) => !query && !serverIssueKeys.has(issueRowKey(issue))
    ),
  ].filter((issue) => issueMatchesListFilters(issue, { status, severity: sev }));
  const filtered = sortIssues(issuesWithLocalStatus, sortBy);
  const totalCount = Number.isFinite(Number(meta.total)) ? Number(meta.total) : filtered.length;
  useErrorNotification(error, {
    title: T("Issues error", "Issues error"),
    key: `issues-list:${error}`,
  });
  useErrorNotification(statusActionError, {
    title: T("Issue action error", "Issue action error"),
    key: `issue-action:${statusActionError}`,
  });
  const bulkFixableIssues = filtered.filter((issue) => issue.status !== "fixed");
  const bulkScopeKey = JSON.stringify([status, sev, query, scanId, totalCount]);
  const mayHaveUnloadedFixableIssues =
    status !== "fixed" &&
    (Boolean(meta.hasMore ?? meta.has_more) || totalCount > all.length);
  const canMarkAllFixed =
    bulkFixableIssues.length > 0 ||
    (mayHaveUnloadedFixableIssues && completedBulkScope !== bulkScopeKey);

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
      setStatusActionError(
        error?.message || T("Issue status update failed.", "\u95ee\u9898\u72b6\u6001\u66f4\u65b0\u5931\u8d25\u3002")
      );
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
    if (bulkStatusUpdatingRef.current) return;
    bulkStatusUpdatingRef.current = true;
    setBulkStatusLoading("fixed");
    setStatusActionError("");
    let targets = [];
    let rowKeys = [];
    try {
      const matchingIssues = await collectMatchingIssuesAcrossPages(filtered, meta, {
        status,
        severity: sev,
        q: query,
        scanId,
        sort: sortBy,
      });
      targets = matchingIssues.filter((issue) => {
        const rowKey = issueRowKey(issue);
        return (
          issueMatchesListFilters(issue, { status, severity: sev }) &&
          issue.status !== "fixed" &&
          !statusUpdatingRef.current.has(rowKey)
        );
      });
      if (!targets.length) {
        setCompletedBulkScope(bulkScopeKey);
        return;
      }
      rowKeys = targets.map(issueRowKey);
      rowKeys.forEach((rowKey) => statusUpdatingRef.current.add(rowKey));
      setStatusUpdating((current) =>
        rowKeys.reduce((next, rowKey) => ({ ...next, [rowKey]: true }), current)
      );
      const results = await updateIssueStatusesInBatches(targets, "fixed");
      const visibleRowKeys = new Set(filtered.map(issueRowKey));
      const localUpdates = {};
      let successCount = 0;
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
        if (visibleRowKeys.has(rowKey)) localUpdates[rowKey] = updatedIssue;
        successCount += 1;
      });
      if (Object.keys(localUpdates).length) {
        setLocalIssueUpdates((current) => ({ ...current, ...localUpdates }));
      }
      if (successCount) {
        await reload();
        notifyIssuesChanged({ count: successCount, status: "fixed" });
      }
      if (failureCount) {
        const message = T(
          `${failureCount} issue status update failed.`,
          `${failureCount} 个问题状态更新失败。`
        );
        setStatusActionError(message);
      } else {
        setCompletedBulkScope(bulkScopeKey);
      }
    } catch (error) {
      setStatusActionError(
        error?.message || T("Issue status update failed.", "\u95ee\u9898\u72b6\u6001\u66f4\u65b0\u5931\u8d25\u3002")
      );
    } finally {
      rowKeys.forEach((rowKey) => statusUpdatingRef.current.delete(rowKey));
      setStatusUpdating((current) => {
        const next = { ...current };
        rowKeys.forEach((rowKey) => {
          delete next[rowKey];
        });
        return next;
      });
      bulkStatusUpdatingRef.current = false;
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
                disabled={loading || Boolean(bulkStatusLoading) || !canMarkAllFixed}
                onClick={markAllFixed}
              >
                <I.Check size={14} />{" "}
                {bulkStatusLoading
                  ? T("Marking...", "正在标记...")
                  : T("Mark all fixed", "\u5168\u90e8\u6807\u8bb0\u5df2\u4fee\u590d")}
              </button>
              <button
                className="btn"
                onClick={() =>
                  setSortBy(
                    sortBy === "severity" ? "newest" : sortBy === "newest" ? "file" : "severity"
                  )
                }
              >
                <I.Sort size={14} />{" "}
                {sortBy === "severity"
                  ? T("Severity", "\u4e25\u91cd\u6027")
                  : sortBy === "newest"
                    ? T("Newest", "\u6700\u65b0")
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
                <span className="filter-l">{T("Severity", "\u4e25\u91cd\u6027")}</span>
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
              <div>{T("Status", "\u72b6\u6001")}</div>
              <div></div>
            </div>
            {loading && <IssuesTableSkeleton />}
            {!loading && filtered.length === 0 && (
              <div className="muted issues-table-empty">
                {T("No findings are available yet.", "\u6682\u65e0\u95ee\u9898\u3002")}
              </div>
            )}
            {!loading &&
              filtered.map((issue) => {
                const rowKey = issueRowKey(issue);
                const updatingStatus =
                  Boolean(statusUpdating[rowKey]) || Boolean(bulkStatusLoading);
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
                        <span className="tag">{T("Confirmed", "Confirmed")}</span>
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
                          {T("Mark fixed", "\u6807\u8bb0\u5df2\u4fee\u590d")}
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
  useErrorNotification(loadError, {
    title: T("Issue load error", "Issue load error"),
    key: `issue-load:${routeIssueId}:${loadError}`,
  });
  const activeIssue = routeIssueId ? loadedIssue : initialIssue;
  const [currentStatus, setCurrentStatus] = useState(activeIssue?.status || "open");
  const [actionError, setActionError] = useState("");
  useErrorNotification(actionError, {
    title: T("Issue action error", "Issue action error"),
    key: `issue-detail-action:${routeIssueId || activeIssue?.id || "issue"}:${actionError}`,
  });
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
      initialIssueRef.current?.id === routeIssueId
        ? applyCachedIssueUpdate(initialIssueRef.current)
        : null;
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
        setLoadError(error?.message || T("Unable to load issue.", "\u65e0\u6cd5\u52a0\u8f7d\u95ee\u9898\u3002"));
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
            <a className="btn ghost sm issue-detail-back" {...screenLinkProps(go, "issues")}>
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
              {T("Select an issue from the list first.", "\u8bf7\u5148\u4ece\u5217\u8868\u9009\u62e9\u4e00\u4e2a\u95ee\u9898\u3002")}
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
      setActionError(error?.message || T("Unable to update issue status.", "\u65e0\u6cd5\u66f4\u65b0\u95ee\u9898\u72b6\u6001\u3002"));
    } finally {
      statusRequestRef.current = false;
      setStatusLoading("");
    }
  };
  const severity = issue.severity || "info";
  const primaryLocation = issue.affectedLocations?.[0] || null;
  const confidence = confidenceLabel(issue);
  const copyPage = async () => {
    const copied = await copyText(issuePageMarkdown(issue, currentStatus));
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
          <a className="btn ghost sm issue-detail-back" {...screenLinkProps(go, "issues")}>
            <I.ArrowL size={13} /> {T("Back to list", "返回列表")}
          </a>
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
                {issue.category && <span className="tag">{issue.category}</span>}{" "}
                {confidence && <span className="tag">{confidence}</span>}
                {issue.verificationStatus && (
                  <span className="tag">{issue.verificationStatus}</span>
                )}
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
              <IssueSummaryDetail issue={issue} currentStatus={currentStatus} />
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
              <IssueChecklistSection issue={issue} />
              <div className="divider" />
              <button className="btn sm" onClick={copyPage} aria-live="polite">
                {pageCopied ? <I.Check size={13} /> : <I.Copy size={13} />}{" "}
                {pageCopied ? T("Copied", "\u5df2\u590d\u5236") : T("Copy Page", "复制页面")}
              </button>
              <div className="divider" />
              {currentStatus === "open" ? (
                <div className="issue-action-row">
                  <button
                    className="btn sm primary"
                    disabled={Boolean(statusLoading)}
                    onClick={() => updateStatus("fixed")}
                  >
                    <I.Check size={13} /> {T("Mark fixed", "\u6807\u8bb0\u5df2\u4fee\u590d")}
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
    const time = scanTimeLabel(scan) || "\u2014";
    if (!groups.has(time)) groups.set(time, []);
    groups.get(time).push(scan);
  }
  return Array.from(groups.entries());
}

function HistoryGroups({
  scans,
  viewScan,
  viewScanIssues,
  downloadAuditBundle,
  bundleLoading,
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
                      downloadAuditBundle={downloadAuditBundle}
                      bundleLoading={bundleLoading}
                    />
                  ) : (
                    <div className="scan-stack">
                      {timeItems.map((scan, sIndex) => (
                        <ScanRow
                          key={scan.id || `${scan.repo}-${scan.createdAt}-${sIndex}`}
                          scan={scan}
                          viewScan={viewScan}
                          viewScanIssues={viewScanIssues}
                          downloadAuditBundle={downloadAuditBundle}
                          bundleLoading={bundleLoading}
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
  { key: "high", labelEn: "High", labelZh: "\u9ad8" },
  { key: "medium", labelEn: "Medium", labelZh: "\u4e2d" },
  { key: "low", labelEn: "Low", labelZh: "\u4f4e" },
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
    push(T(`reasoning: ${aiUsage.reasoningEffort}`, `\u63a8\u7406\uff1a${aiUsage.reasoningEffort}`));
  }
  return badges;
}

function ScanRow({
  scan,
  viewScan,
  viewScanIssues,
  downloadAuditBundle,
  bundleLoading,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const blockingError = scanHasBlockingError(scan);
  const total = blockingError ? 0 : scanIssuesTotal(scan);
  const breakdown = blockingError ? {} : scan?.issues || {};
  const status = scan.status || "info";
  const hasResults = scanCanDownloadAuditBundle(scan);
  const isDownloading = bundleLoading === scan.id;
  const summary = scanHistorySummary(scan);
  const aiUsageBadges = blockingError ? [] : scanAiUsageBadges(scan.aiUsage);
  const showProgress = !blockingError && (status === "queued" || status === "running");
  const progressDisplay = showProgress
    ? scanProgressPresentation(scan, { label: T("Progress", "进度") })
    : null;

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
    if (blockingError) return;
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
      role={blockingError ? undefined : "button"}
      tabIndex={blockingError ? undefined : 0}
      aria-label={T(`View scan ${scan.repo || ""}`, `查看扫描 ${scan.repo || ""}`)}
      onClick={handleRowActivate}
      onKeyDown={handleRowKeyDown}
    >
      <span className="scan-status-dot" aria-hidden="true" />
      <div className="scan-info">
        <div className="scan-main">
          <strong className="scan-repo">{scan.repo}</strong>
          {!blockingError && scan.branch && (
            <span className="scan-badge">
              <I.GitBranch size={10} /> {scan.branch}
            </span>
          )}
          {!blockingError && scan.commit && scan.commit !== "pending" && scan.commit !== "-" && (
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
            {/* Default: severity capsules (no big colored bar - those get read as a progress meter) */}
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
      {!blockingError && <div className="scan-row-actions" ref={menuRef} onClick={stopRowClick}>
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
          {"\u22ef"}
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
              {isDownloading ? T("Preparing...", "\u51c6\u5907\u4e2d...") : T("Download zip", "?? zip")}
            </button>
          </div>
        )}
      </div>}
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
      scanId: String(item?.scanId || "").trim(),
      repoId: String(item?.repoId || "").trim(),
      repo: String(item?.repo || "").trim(),
      branch: String(item?.branch || "main").trim() || "main",
      requestId: String(item?.requestId || "").trim(),
    }))
    .filter((item) => item.scanId || item.repoId || item.repo || item.requestId);
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
  const expectedScanId = String(request?.scanId || "").trim();
  if (expectedScanId && String(scan?.id || "").trim() === expectedScanId) return true;

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
  return (
    repoMatches &&
    expectedBranch === scanBranch &&
    scanIsAfterHistoryHandoff(scan, expectedScanStartedAt)
  );
}

function scanListIncludesExpectedRequests(scans, expectedScanRequests, expectedScanStartedAt) {
  if (!expectedScanRequests.length) return true;
  if (!Array.isArray(scans) || !scans.length) return false;
  const used = new Set();
  for (const request of expectedScanRequests) {
    const matchIndex = scans.findIndex(
      (scan, index) =>
        !used.has(index) && scanMatchesExpectedRequest(scan, request, expectedScanStartedAt)
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
  const notify = useNotify();
  const [status, setStatus] = useState("all");
  const [bundleLoading, setBundleLoading] = useState("");
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [expectedScanRetryCount, setExpectedScanRetryCount] = useState(0);
  const [expectedScanWaitStartedAt, setExpectedScanWaitStartedAt] = useState(() => Date.now());
  const [expectedScanWaitExpired, setExpectedScanWaitExpired] = useState(false);
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
  const waitingForExpectedScans =
    hasExpectedScans && !expectedScansLoaded && !expectedScanWaitExpired && !error;
  const displayLoading = loading || waitingForExpectedScans;
  useErrorNotification(error, {
    title: T("Scan history error", "Scan history error"),
    key: `scan-history:${status}:${error}`,
  });
  useErrorNotification(actionError, {
    title: T("Scan action error", "Scan action error"),
    key: `scan-action:${actionError}`,
  });

  useEffect(() => {
    setExpectedScanRetryCount(0);
    setExpectedScanWaitStartedAt(Date.now());
    setExpectedScanWaitExpired(false);
  }, [expectedScanIdsKey, expectedScanRequestsKey, normalizedExpectedScanStartedAt, status]);

  useEffect(() => {
    if (!hasExpectedScans || expectedScansLoaded || expectedScanWaitExpired || error) {
      return undefined;
    }
    const handoffStartedAt = normalizedExpectedScanStartedAt
      ? normalizedExpectedScanStartedAt * 1000
      : expectedScanWaitStartedAt;
    const remaining = Math.max(
      0,
      handoffStartedAt + HISTORY_EXPECTED_SCAN_TIMEOUT_MS - Date.now()
    );
    const handle = setTimeout(() => setExpectedScanWaitExpired(true), remaining);
    return () => clearTimeout(handle);
  }, [
    error,
    expectedScanWaitExpired,
    expectedScanWaitStartedAt,
    expectedScansLoaded,
    hasExpectedScans,
    normalizedExpectedScanStartedAt,
  ]);

  useEffect(() => {
    if (!waitingForExpectedScans || loading) return undefined;
    let cancelled = false;
    const handle = setTimeout(() => {
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
      refreshExpectedScans().finally(() => {
        if (!cancelled) setExpectedScanRetryCount((count) => count + 1);
      });
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
    if (hasExpectedScans && expectedScansLoaded && typeof onExpectedScansLoaded === "function") {
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
    if (!scan?.id || !scanCanDownloadAuditBundle(scan) || bundleLoading) return;
    setBundleLoading(scan.id);
    try {
      const bundle = await pullwiseApi.scans.auditBundleArchive(scan.id);
      downloadBlob(`pullwise-audit-${scan.id}.zip`, bundle, "application/zip");
    } catch (error) {
      notify.error(error?.message || T("Unable to download audit bundle.", "Unable to download audit bundle."), {
        title: T("Download failed", "Download failed"),
      });
    } finally {
      setBundleLoading("");
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
        refreshError?.message || T("Unable to refresh scan history.", "\u65e0\u6cd5\u5237\u65b0\u626b\u63cf\u5386\u53f2\u3002")
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
              <h1 className="page-title-truncate">{T("Scan history", "扫描历史")}</h1>
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
                <I.Play size={11} /> {T("New scan", "\u65b0\u626b\u63cf")}
              </a>
            </div>
          </div>

          <div className="hist-list card">
            {expectedScanWaitExpired && !expectedScansLoaded && (
              <div className="history-expected-scan-notice" role="status">
                {T(
                  "The new scan is taking longer to appear. Showing current history; use Refresh to try again.",
                  "新扫描显示时间较长。当前已显示现有历史记录；请使用“刷新”重试。"
                )}
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
                {T("No scans yet.", "\u6682\u65e0\u626b\u63cf\u3002")}
              </div>
            )}
            {!displayLoading && filtered.length > 0 && (
              <HistoryGroups
                scans={filtered}
                viewScan={viewScan}
                viewScanIssues={viewScanIssues}
                downloadAuditBundle={downloadAuditBundle}
                bundleLoading={bundleLoading}
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
  useErrorNotification(initialLoadError, {
    title: T("Settings error", "Settings error"),
    key: `settings-load:${initialLoadError}`,
    action: {
      label: settingsLoading ? T("Retrying...", "Retrying...") : T("Retry", "Retry"),
      onClick: () => loadSettingsPayloads(),
    },
  });
  useErrorNotification(profileError, {
    title: T("Profile error", "Profile error"),
    key: `settings-profile:${profileError}`,
  });
  useErrorNotification(settingsError, {
    title: T("Settings error", "Settings error"),
    key: `settings-preferences:${settingsError}`,
  });
  useErrorNotification(integrationError, {
    title: T("Integration error", "Integration error"),
    key: `settings-integrations:${integrationError}`,
  });
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const integrationRequestIdRef = useRef(0);
  const githubActionInFlightRef = useRef(false);
  const reviewOutputLanguageSaveInFlightRef = useRef(false);

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
      const message =
        sessionResult.reason?.message ||
        T("Unable to load account session.", "Unable to load account session.");
      setSession(null);
      setProfileError(message);
      errors.push(message);
    }

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value);
    } else {
      const message =
        settingsResult.reason?.message ||
        T("Unable to load preferences.", "Unable to load preferences.");
      setSettings(null);
      setSettingsError(message);
      errors.push(message);
    }

    if (requestId === integrationRequestIdRef.current) {
      if (integrationsResult.status === "fulfilled") {
        setIntegrations(integrationsResult.value);
      } else {
        const message =
          integrationsResult.reason?.message ||
          T("Unable to load GitHub integrations.", "Unable to load GitHub integrations.");
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
            T("Unable to refresh GitHub repository access.", "\u65e0\u6cd5\u5237\u65b0 GitHub \u4ed3\u5e93\u8bbf\u95ee\u3002")
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
  const githubAccountZh = githubAccountNames.length ? `\uff08${githubAccountNames.join(", ")}\uff09` : "";
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
    if (reviewOutputLanguageSaveInFlightRef.current) return;
    reviewOutputLanguageSaveInFlightRef.current = true;
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
      reviewOutputLanguageSaveInFlightRef.current = false;
      setSettingsSaving("");
    }
  };
  const authorizeRepositories = async () => {
    if (githubActionInFlightRef.current) return;
    githubActionInFlightRef.current = true;
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
            T("Unable to connect GitHub repository access.", "\u65e0\u6cd5\u8fde\u63a5 GitHub \u4ed3\u5e93\u8bbf\u95ee\u3002")
        );
      }
    } finally {
      githubActionInFlightRef.current = false;
    }
  };
  const manageInstallation = async (installation) => {
    if (githubActionInFlightRef.current) return;
    githubActionInFlightRef.current = true;
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
          error?.message || T("Unable to manage GitHub installation.", "\u65e0\u6cd5\u7ba1\u7406 GitHub \u5b89\u88c5\u3002")
        );
      }
    } finally {
      githubActionInFlightRef.current = false;
      setManagingInstallationId("");
    }
  };

  const visibleSettingsError =
    initialLoadError ||
    (tab === "preferences"
      ? settingsError
      : tab === "integrations"
        ? integrationError
        : profileError);
  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Settings", "设置") }]}
        setIssue={setIssue}
        loading={settingsLoading}
      />
      <div className="with-side">
        <Sidebar section="settings" go={go} />
        <div className="main">
          <div className="page-h">
            <div>
              <h1>{T("Settings", "设置")}</h1>
              <div className="sub">{T("Account and integrations", "\u8d26\u53f7\u4e0e\u96c6\u6210")}</div>
            </div>
          </div>
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
              {visibleSettingsError && (
                <div className="settings-inline-error" role="alert">
                  <div>
                    <b>
                      {initialLoadError
                        ? T("Some settings could not be loaded.", "部分设置无法加载。")
                        : T("Settings update failed.", "设置更新失败。")}
                    </b>
                    <div>{visibleSettingsError}</div>
                  </div>
                  {initialLoadError && (
                    <button
                      className="btn sm"
                      type="button"
                      disabled={settingsLoading}
                      onClick={() => loadSettingsPayloads()}
                    >
                      {settingsLoading ? T("Retrying...", "正在重试...") : T("Retry", "重试")}
                    </button>
                  )}
                </div>
              )}
              {tab === "profile" && (
                <div className="card section">
                  <div className="section-h">
                    <h3>{T("Profile", "个人资料")}</h3>
                  </div>
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
                        {T("Stay signed in for 7 days on this browser.", "\u6b64\u6d4f\u89c8\u5668\u4fdd\u6301\u767b\u5f55 7 \u5929\u3002")}
                      </div>
                    </div>
                    <button className="btn sm" onClick={signOut}>
                      {T("Sign out", "\u9000\u51fa\u767b\u5f55")}
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
                      <div className="muted">{T("Default is English.", "\u9ed8\u8ba4\u82f1\u8bed\u3002")}</div>
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
                                "\u51c6\u5907\u626b\u63cf\u65f6\u518d\u8fde\u63a5\u4ed3\u5e93\u3002Pullwise \u4f7f\u7528 GitHub App \u4ed3\u5e93\u6743\u9650\u8fdb\u884c checkout\u3001\u4fee\u590d\u5206\u652f\u548c PR \u521b\u5efa\u3002"
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
                      {github?.connected ? T("Connected", "\u5df2\u8fde\u63a5") : T("Disconnected", "\u672a\u8fde\u63a5")}
                    </span>
                    <button className="btn sm" onClick={authorizeRepositories}>
                      {github?.connected
                        ? T("Add account or organization", "\u6dfb\u52a0\u8d26\u53f7\u6216\u7ec4\u7ec7")
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
