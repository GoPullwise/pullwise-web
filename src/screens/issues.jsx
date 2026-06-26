import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { GraphVerifiedEvidenceGraph, GraphVerifiedReport } from "../components/graph-verified-report.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { ScanProgressBar } from "../components/scan-progress.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { downloadBlob } from "../lib/download.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { screenLinkProps } from "../lib/navigation.js";
import {
  normalizeIssue,
  normalizeScan,
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

const ISSUE_FEEDBACK_BADGES = [
  {
    value: "useful",
    labelEn: "Useful",
    labelZh: "有用",
    reason: "User marked issue useful / valid.",
    falsePositive: false,
    tone: "positive",
  },
  {
    value: "false_positive",
    labelEn: "False positive",
    labelZh: "误报",
    reason: "False positive.",
    falsePositive: true,
    tone: "negative",
  },
  {
    value: "not_relevant",
    labelEn: "Not relevant",
    labelZh: "不相关",
    reason: "Not relevant to this PR.",
  },
  {
    value: "duplicate",
    labelEn: "Duplicate",
    labelZh: "重复",
    reason: "Duplicate issue.",
  },
  {
    value: "too_speculative",
    labelEn: "Speculative",
    labelZh: "猜测",
    reason: "Too speculative.",
  },
  {
    value: "low_impact",
    labelEn: "Low impact",
    labelZh: "影响较低",
    reason: "Low impact.",
  },
];

function issueTotal(scan) {
  if (!scan?.issues) return 0;
  return Object.values(scan.issues).reduce((sum, value) => sum + Number(value || 0), 0);
}

function scanHasResults(scan) {
  return ["done", "failed"].includes(scan?.status);
}

function scanHistorySummary(scan) {
  const queueSummary = scanQueueSummary(scan);
  if (scan.status === "queued" && queueSummary) {
    return [T("queued", "排队中"), ...queueSummary.tags].join(" - ");
  }
  if (scan.status === "cancelled") return T("Scan cancelled", "扫描已取消");
  if (scan.status === "lost") {
    return T("Scan lost", "扫描丢失");
  }
  if (scan.issues) {
    const graphVerified = scan.graphVerifiedReport || {};
    const total = graphVerified.confirmedCount ?? issueTotal(scan);
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

function markdownText(value) {
  return String(value ?? "").trim();
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeScanForIssueDisplay(scan) {
  if (!plainObject(scan)) return null;
  return normalizeScan(scan);
}

function appendMarkdownSection(lines, title, content) {
  const body = Array.isArray(content)
    ? content.map(markdownText).filter(Boolean).join("\n")
    : markdownText(content);
  if (!body) return;
  lines.push("", `## ${title}`, body);
}

function graphVerifiedLines(issue) {
  const graph = issue.graphEvidence || {};
  return [
    graph.sliceId ? `- Slice: ${markdownText(graph.sliceId)}` : "",
    ...(graph.pathSummary || []).map((item) => `- ${markdownText(item)}`),
    ...(graph.codegraphFiles || []).map((file) => `- File: ${markdownText(file)}`),
  ].filter(Boolean);
}

function codeEvidenceMarkdown(issue) {
  return (issue.codeEvidence || [])
    .map((item) => {
      const location = [markdownText(item?.file), markdownText(item?.lines)]
        .filter(Boolean)
        .join(":");
      const why = markdownText(item?.whyItMatters);
      return [location ? `- ${location}` : "", why ? `  ${why}` : ""].filter(Boolean).join("\n");
    })
    .filter(Boolean);
}

function graphVerifiedReproductionMarkdown(issue) {
  const reproduction = issue.reproduction || {};
  const lines = [];
  if (issue.reproductionPath) {
    lines.push(`- Method: ${markdownText(issue.reproductionPath)}`);
  }
  if (reproduction.commands?.length) {
    lines.push("### Commands", "```", reproduction.commands.join("\n"), "```");
  }
  if (reproduction.steps?.length) {
    lines.push("### Verification steps", ...reproduction.steps.map((step) => `- ${markdownText(step)}`).filter(Boolean));
  }
  [
    ["Input", reproduction.input || issue.triggerCondition],
    ["Expected", reproduction.expected || issue.expectedBehavior],
    ["Actual", reproduction.actual || issue.observedBehavior],
    ["Log", reproduction.logPath],
  ].forEach(([label, value]) => {
    const text = markdownText(value);
    if (text) lines.push(`- ${label}: ${text}`);
  });
  return lines;
}

function buildGraphVerifiedIssueMarkdown(issue, currentStatus) {
  const title = markdownText(issue.title) || markdownText(issue.id) || "GraphVerified finding";
  const primaryLocation = issue.affectedLocations?.[0] || null;
  const lines = [`# ${title}`];
  appendMarkdownSection(
    lines,
    "Metadata",
    [
      ["Issue", issue.id],
      ["Status", currentStatus || issue.status],
      ["Severity", issue.severity],
      ["Category", issue.category],
      ["Repository", issue.repo],
      ["Branch", issue.branch],
      ["Commit", issue.commit],
      ["Scan", issue.scanId],
      ["Candidate", issue.candidateId],
      ["File", primaryLocation ? locationLabel(primaryLocation) : issue.file],
    ]
      .map(([label, value]) => {
        const text = markdownText(value);
        return text ? `- ${label}: ${text}` : "";
      })
      .filter(Boolean)
  );
  appendMarkdownSection(lines, "Summary", issue.summary);
  appendMarkdownSection(lines, "Graph evidence", graphVerifiedLines(issue));
  appendMarkdownSection(lines, "Code evidence", codeEvidenceMarkdown(issue));
  appendMarkdownSection(lines, "Trigger", issue.triggerCondition);
  appendMarkdownSection(lines, "Expected behavior", issue.expectedBehavior);
  appendMarkdownSection(lines, "Observed behavior", issue.observedBehavior);
  appendMarkdownSection(lines, "Reproduction", graphVerifiedReproductionMarkdown(issue));
  appendMarkdownSection(lines, "Why this matters", issue.whyThisMatters);
  appendMarkdownSection(lines, "Fix direction", issue.suggestedFixDirection);
  appendMarkdownSection(lines, "Limitations", issue.limitations);
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function buildIssuePageMarkdown(issue, currentStatus) {
  if (issue.graphVerified) return buildGraphVerifiedIssueMarkdown(issue, currentStatus);
  const title = markdownText(issue.title) || markdownText(issue.id) || "Issue";
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
            <span>{T("Reproduction command", "\u590d\u73b0\u547d\u4ee4")}</span>
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
          {reproduction.testFile && <span className="tag">test: {reproduction.testFile}</span>}
          {reproduction.logPath && <span className="tag">log: {reproduction.logPath}</span>}
          {reproduction.exitCode !== undefined && <span className="tag">exit: {reproduction.exitCode}</span>}
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

function codeEvidenceLocation(item) {
  return [markdownText(item?.file), markdownText(item?.lines)].filter(Boolean).join(":");
}

function GraphVerifiedIssueDetail({ issue }) {
  const graph = issue.graphEvidence || {};
  const proof = issue.reproProof || {};
  const judge = issue.judgeEvidence || {};
  const graphLines = [
    graph.sliceId ? `Slice: ${graph.sliceId}` : "",
    ...(graph.pathSummary || []),
    ...(graph.codegraphFiles || []).map((file) => `File: ${file}`),
  ].filter(Boolean);
  const behaviorFields = [
    [T("Trigger", "Trigger"), issue.triggerCondition],
    [T("Expected", "Expected"), issue.expectedBehavior],
    [T("Observed", "Observed"), issue.observedBehavior],
  ].filter(([, value]) => markdownText(value));
  const hasReproduction = Boolean(
    issue.reproductionPath ||
      issue.reproduction?.commands?.length ||
      issue.reproduction?.steps?.length ||
      issue.reproduction?.input ||
      issue.reproduction?.expected ||
      issue.reproduction?.actual ||
      issue.reproduction?.logPath ||
      issue.reproduction?.exitCode !== undefined
  );
  const proofFields = [
    [T("Type", "Type"), proof.type],
    [T("Expected", "Expected"), proof.expected],
    [T("Actual", "Actual"), proof.actual],
    [T("Log excerpt", "Log excerpt"), proof.logExcerpt],
    [T("Verification steps", "Verification steps"), proof.verificationSteps?.join(" | ")],
    [T("Graph path exercised", "Graph path exercised"), proof.graphPathExercised ? "true" : ""],
  ].filter(([, value]) => markdownText(value));
  const judgeFields = [
    [T("Status", "Status"), judge.status],
    [T("Level", "Level"), judge.level],
    [
      T("Safe to show user", "Safe to show user"),
      typeof judge.safeToShowUser === "boolean" ? (judge.safeToShowUser ? "true" : "false") : "",
    ],
    [T("Command", "Command"), judge.command],
    [T("Log path", "Log path"), judge.logPath],
    [T("Observable", "Observable"), judge.observable],
    [T("Reason", "Reason"), judge.reason],
  ].filter(([, value]) => markdownText(value));

  return (
    <>
      <DetailSection title={T("Graph evidence", "Graph evidence")}>
        <GraphVerifiedEvidenceGraph graph={graph} label={issue.id || issue.title} />
        {!graphLines.length && <p className="muted">{T("No graph evidence available.", "No graph evidence available.")}</p>}
      </DetailSection>

      <DetailSection title={T("Code evidence", "Code evidence")}>
        {issue.codeEvidence?.length > 0 && (
          <div className="repro-fields">
            {issue.codeEvidence.map((item, index) => {
              const location = codeEvidenceLocation(item);
              return (
                <div key={`${location}-${index}`} className="repro-field">
                  {location && <b className="repro-field-title">{location}</b>}
                  {item.whyItMatters && (
                    <p className="muted repro-field-text">{item.whyItMatters}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DetailSection>

      {behaviorFields.length > 0 && (
        <DetailSection title={T("Behavior", "Behavior")}>
          <div className="repro-fields">
            {behaviorFields.map(([label, value]) => (
              <div key={label} className="repro-field">
                <b className="repro-field-title">{label}</b>
                <p className="muted repro-field-text">{value}</p>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection
        title={T("Reproduction", "Reproduction")}
        empty={T("No executable reproduction was provided.", "No executable reproduction was provided.")}
      >
        {hasReproduction && <ReproductionCenter issue={issue} />}
      </DetailSection>

      {proofFields.length > 0 && (
        <DetailSection title={T("Reproduction proof", "Reproduction proof")}>
          <div className="repro-fields">
            {proofFields.map(([label, value]) => (
              <div key={label} className="repro-field">
                <b className="repro-field-title">{label}</b>
                <p className="muted repro-field-text">{value}</p>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {judgeFields.length > 0 && (
        <DetailSection title={T("Judge validation", "Judge validation")}>
          <div className="repro-fields">
            {judgeFields.map(([label, value]) => (
              <div key={label} className="repro-field">
                <b className="repro-field-title">{label}</b>
                <p className="muted repro-field-text">{value}</p>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {issue.whyThisMatters && (
        <DetailSection title={T("Why this matters", "Why this matters")}>
          <p className="muted" style={{ color: "var(--text-2)" }}>
            {issue.whyThisMatters}
          </p>
        </DetailSection>
      )}

      {issue.suggestedFixDirection && (
        <DetailSection title={T("Fix direction", "Fix direction")}>
          <p className="muted" style={{ color: "var(--text-2)" }}>
            {issue.suggestedFixDirection}
          </p>
        </DetailSection>
      )}

      <TextListSection title={T("Limitations", "Limitations")} items={issue.limitations} />
    </>
  );
}

function IssuesTableSkeleton() {
  return (
    <div className="issues-table-skeleton" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="issues-trow skeleton-row" key={`issues-row-skeleton-${index}`}>
          <div></div>
          <div className="issues-title-c">
            <div className="issues-title-meta">
              <SkeletonLine className="sk-line sk-w-18 sk-h-20" />
              <SkeletonLine className="sk-line sk-w-16" />
            </div>
            <SkeletonLine className="sk-line sk-w-70 sk-h-16" />
            <SkeletonLine className="sk-line sk-w-42" />
          </div>
          <div className="issues-file">
            <SkeletonLine className="sk-line sk-w-80" />
          </div>
          <div>
            <SkeletonLine className="sk-line sk-w-48 sk-h-20" />
          </div>
          <div>
            <div className="issues-evidence-cell">
              <SkeletonLine className="sk-line sk-w-36 sk-h-20" />
              <SkeletonLine className="sk-line sk-w-44" />
            </div>
          </div>
          <div>
            <SkeletonLine className="sk-line sk-w-36 sk-h-20" />
          </div>
          <div className="issues-row-actions">
            <SkeletonLine className="sk-line sk-w-40 sk-h-28" />
            <SkeletonLine className="sk-line sk-w-28 sk-h-28" />
          </div>
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
  } = useIssues({ status, severity: sev, q: query, scanId, limit: 50, refreshOnChange: false });
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
        globalThis.alert?.(
          T(`${failureCount} issue status update failed.`, `${failureCount} 个问题状态更新失败。`)
        );
      }
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
                  : T("Mark all fixed", "全部标记已修复")}
              </button>
              <button
                className="btn"
                onClick={() =>
                  setSortBy(sortBy === "severity" ? "newest" : sortBy === "newest" ? "file" : "severity")
                }
              >
                <I.Sort size={14} />{" "}
                {sortBy === "severity"
                  ? T("Severity", "严重度")
                  : sortBy === "newest"
                    ? T("Newest", "最新")
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
                <span className="filter-l">{T("Severity", "严重度")}</span>
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
              <div>{T("Status", "状态")}</div>
              <div></div>
            </div>
            {loading && <IssuesTableSkeleton />}
            {error && <div className="muted issues-table-message">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="muted issues-table-empty">
                {T("No findings are available yet.", "暂无问题。")}
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
                          {issue.graphVerified ? T("GraphVerified", "GraphVerified") : T("Confirmed", "Confirmed")}
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
                          {T("Mark fixed", "标记已修复")}
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
  const [selectedFeedback, setSelectedFeedback] = useState(activeIssue?.feedbackReason || "");
  const [feedbackLoading, setFeedbackLoading] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [pageCopied, setPageCopied] = useState(false);
  const statusRequestRef = useRef(false);
  const feedbackRequestRef = useRef(0);
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
      initialIssueRef.current?.id === routeIssueId ? normalizeIssue(initialIssueRef.current) : null;
    setLoadedIssue(seedIssue);
    setLoadingIssue(true);
    pullwiseApi.issues
      .get(routeIssueId)
      .then((payload) => {
        if (cancelled) return;
        const nextIssue = normalizeIssue(payload);
        setLoadedIssue(nextIssue);
        if (typeof setIssue === "function") setIssue(nextIssue);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error?.message || T("Unable to load issue.", "无法加载问题。"));
      })
      .finally(() => {
        if (!cancelled) setLoadingIssue(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeIssueId, setIssue]);

  const embeddedScan = useMemo(() => {
    if (plainObject(activeIssue?.scan)) return normalizeScanForIssueDisplay(activeIssue.scan);
    return null;
  }, [activeIssue]);

  useEffect(() => {
    setCurrentStatus(activeIssue?.status || "open");
    setActionError("");
    setStatusLoading("");
    setSelectedFeedback(activeIssue?.feedbackReason || "");
    setFeedbackLoading("");
    setFeedbackSaved(false);
    setPageCopied(false);
    statusRequestRef.current = false;
    feedbackRequestRef.current += 1;
    if (pageCopyResetRef.current) {
      clearTimeout(pageCopyResetRef.current);
      pageCopyResetRef.current = null;
    }
    return () => {
      statusRequestRef.current = false;
      feedbackRequestRef.current += 1;
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
              {T("Select an issue from the list first.", "请先从列表选择一个问题。")}
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
  const graphVerifiedReport =
    activeIssue?.graphVerifiedReport || embeddedScan?.graphVerifiedReport || null;
  const isGraphVerifiedIssue = issue.graphVerified === true;

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
      setActionError(error?.message || T("Unable to update issue status.", "无法更新问题状态。"));
    } finally {
      statusRequestRef.current = false;
      setStatusLoading("");
    }
  };
  const severity = issue.severity || "info";
  const primaryLocation = issue.affectedLocations?.[0] || null;
  const selectedFeedbackBadge = ISSUE_FEEDBACK_BADGES.find(
    (feedback) => feedback.value === selectedFeedback
  );
  const submitFeedbackBadge = async (feedback) => {
    const requestId = feedbackRequestRef.current + 1;
    feedbackRequestRef.current = requestId;
    const payload = {
      feedbackReason: feedback.value,
      reason: feedback.reason,
    };
    if (typeof feedback.falsePositive === "boolean") {
      payload.falsePositive = feedback.falsePositive;
    }
    setActionError("");
    setSelectedFeedback(feedback.value);
    setFeedbackSaved(false);
    setFeedbackLoading(feedback.value);
    try {
      const updated = await pullwiseApi.issues.updateStatus(issue.id, {
        ...issueStatusIdentity(issue),
        ...payload,
      });
      if (feedbackRequestRef.current !== requestId) return;
      const mergedIssue = {
        ...issue,
        ...updated,
        status: updated?.status || currentStatus || issue.status || "open",
        feedbackReason: feedback.value,
      };
      setCurrentStatus(mergedIssue.status);
      if (typeof setIssue === "function") setIssue(mergedIssue);
      setFeedbackSaved(true);
    } catch (error) {
      if (feedbackRequestRef.current !== requestId) return;
      setActionError(error?.message || T("Unable to submit issue feedback.", "无法提交问题反馈。"));
    } finally {
      if (feedbackRequestRef.current === requestId) setFeedbackLoading("");
    }
  };
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
                {issue.category && <span className="tag">{issue.category}</span>}
                {isGraphVerifiedIssue && <span className="tag">GraphVerified</span>}
                {issue.verificationLevel && <span className="tag">{issue.verificationLevel}</span>}
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
              {isGraphVerifiedIssue ? (
                <GraphVerifiedIssueDetail issue={issue} />
              ) : (
                <GraphVerifiedReport report={graphVerifiedReport} showEmpty />
              )}
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
                {pageCopied ? T("Copied", "已复制") : T("Copy Page", "复制页面")}
              </button>
              <div className="divider" />
              <div className="issue-feedback">
                <div className="issue-feedback-h">
                  <span className="muted">{T("Feedback", "反馈")}</span>
                  {selectedFeedbackBadge && (
                    <span className="tag issue-feedback-selected" aria-live="polite">
                      {feedbackLoading
                        ? T("Saving:", "保存中：")
                        : feedbackSaved
                          ? T("Selected:", "已选择：")
                          : T("Selected:", "已选择：")}{" "}
                      {T(selectedFeedbackBadge.labelEn, selectedFeedbackBadge.labelZh)}
                    </span>
                  )}
                </div>
                <div
                  className="issue-feedback-badges"
                  role="group"
                  aria-label={T("Issue feedback", "问题反馈")}
                >
                  {ISSUE_FEEDBACK_BADGES.map((feedback) => (
                    <button
                      key={feedback.value}
                      type="button"
                      className={
                        "btn sm issue-feedback-badge" +
                        (selectedFeedback === feedback.value ? " selected" : "")
                      }
                      disabled={Boolean(feedbackLoading)}
                      aria-pressed={selectedFeedback === feedback.value}
                      onClick={() => submitFeedbackBadge(feedback)}
                    >
                      <span>{T(feedback.labelEn, feedback.labelZh)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="divider" />
              {currentStatus === "open" ? (
                <div className="issue-action-row">
                  <button
                    className="btn sm primary"
                    disabled={Boolean(statusLoading)}
                    onClick={() => updateStatus("fixed")}
                  >
                    <I.Check size={13} /> {T("Mark fixed", "标记已修复")}
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
    const time = scanTimeLabel(scan) || "—";
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
  { key: "high", labelEn: "High", labelZh: "高" },
  { key: "medium", labelEn: "Medium", labelZh: "中" },
  { key: "low", labelEn: "Low", labelZh: "低" },
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
    push(T(`reasoning: ${aiUsage.reasoningEffort}`, `推理：${aiUsage.reasoningEffort}`));
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
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const total = scanIssuesTotal(scan);
  const breakdown = scan?.issues || {};
  const status = scan.status || "info";
  const hasResults = scanHasResults(scan);
  const isDownloading = bundleLoading === scan.id;
  const isRetrying = retryLoading === scan.id;
  const canRetry = isRetryableHistoryScan(scan);
  const summary = scanHistorySummary(scan);
  const aiUsageBadges = scanAiUsageBadges(scan.aiUsage);
  const showProgress = status === "queued" || status === "running";

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
            {/* Default: severity capsules (no big colored bar — those get read as a progress meter) */}
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
            progress={scan.progress}
            label={T("Progress", "进度")}
            message={scan.progressMessage}
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
          ⋯
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
              {isDownloading ? T("Preparing...", "准备中...") : T("Download zip", "下载 zip")}
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

function scanListIncludesExpectedIds(scans, expectedScanIds) {
  if (!expectedScanIds.length) return true;
  if (!Array.isArray(scans) || !scans.length) return false;
  const scanIds = new Set(scans.map((scan) => String(scan?.id || "").trim()).filter(Boolean));
  return expectedScanIds.every((scanId) => scanIds.has(scanId));
}

export function HistoryScreen({
  go,
  openScan = null,
  openScanIssues = null,
  setIssue = null,
  expectedScanIds = [],
  onExpectedScansLoaded = null,
}) {
  useLang();
  const [status, setStatus] = useState("all");
  const [bundleLoading, setBundleLoading] = useState("");
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
  const expectedScansLoaded = useMemo(
    () => scanListIncludesExpectedIds(filtered, normalizedExpectedScanIds),
    [filtered, normalizedExpectedScanIds]
  );
  const expectedScanWaitExpired =
    normalizedExpectedScanIds.length > 0 &&
    !expectedScansLoaded &&
    !error &&
    expectedScanRetryCount >= HISTORY_EXPECTED_SCAN_MAX_RETRIES;
  const waitingForExpectedScans =
    normalizedExpectedScanIds.length > 0 &&
    !expectedScansLoaded &&
    !error &&
    !expectedScanWaitExpired;
  const displayLoading = loading || waitingForExpectedScans;
  const totalCount = Number.isFinite(Number(meta.total)) ? Number(meta.total) : filtered.length;

  useEffect(() => {
    setExpectedScanRetryCount(0);
  }, [expectedScanIdsKey, status]);

  useEffect(() => {
    if (!waitingForExpectedScans || loading || typeof reload !== "function") return undefined;
    const handle = setTimeout(() => {
      setExpectedScanRetryCount((count) => count + 1);
      reload({ quiet: true });
    }, HISTORY_EXPECTED_SCAN_RETRY_MS);
    return () => clearTimeout(handle);
  }, [waitingForExpectedScans, loading, reload, expectedScanRetryCount]);

  useEffect(() => {
    if (
      normalizedExpectedScanIds.length > 0 &&
      expectedScansLoaded &&
      typeof onExpectedScansLoaded === "function"
    ) {
      onExpectedScansLoaded();
    }
  }, [expectedScansLoaded, normalizedExpectedScanIds.length, onExpectedScansLoaded]);

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
        error?.message || T("Unable to download audit bundle.", "无法下载审计包。")
      );
    } finally {
      setBundleLoading("");
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
      setActionError(actionError?.message || T("Unable to retry scan.", "无法重试扫描。"));
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
        refreshError?.message || T("Unable to refresh scan history.", "无法刷新扫描历史。")
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
                <I.Play size={11} /> {T("New scan", "新扫描")}
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
                {T("No scans yet.", "暂无扫描。")}
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
            T("Unable to refresh GitHub repository access.", "无法刷新 GitHub 仓库访问。")
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
  const githubAccountZh = githubAccountNames.length ? `（${githubAccountNames.join(", ")}）` : "";
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
            T("Unable to connect GitHub repository access.", "无法连接 GitHub 仓库访问。")
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
          error?.message || T("Unable to manage GitHub installation.", "无法管理 GitHub 安装。")
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
              <div className="sub">{T("Account and integrations", "账号与集成")}</div>
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
                        {T("Stay signed in for 7 days on this browser.", "此浏览器保持登录 7 天。")}
                      </div>
                    </div>
                    <button className="btn sm" onClick={signOut}>
                      {T("Sign out", "退出登录")}
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
                      <div className="muted">{T("Default is English.", "默认英语。")}</div>
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
                                "准备扫描时再连接仓库。Pullwise 使用 GitHub App 仓库权限进行 checkout、修复分支和 PR 创建。"
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
                      {github?.connected ? T("Connected", "已连接") : T("Disconnected", "未连接")}
                    </span>
                    <button className="btn sm" onClick={authorizeRepositories}>
                      {github?.connected
                        ? T("Add account or organization", "添加账号或组织")
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
