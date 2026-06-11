import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { ImpactEvidenceDrawer } from "../components/impact/ImpactEvidenceDrawer.jsx";
import { ImpactTargetCard } from "../components/impact/ImpactTargetCard.jsx";
import { findImpactTargetByPath } from "../components/impact/impact-utils.js";
import { IssueDistributionBand } from "../components/issue-distribution-band.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { downloadBlob } from "../lib/download.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { screenLinkProps } from "../lib/navigation.js";
import {
  normalizeIssue,
  normalizeIssuePullRequest,
  normalizeScan,
  notifyIssuesChanged,
  scanQueueSummary,
  useIssues,
  useScans,
} from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const VERIFICATION_RANK = { verified: 4, static_proof: 3, potential_risk: 2, unverified: 1 };
const EVIDENCE_RANK = { high: 3, medium: 2, low: 1 };
const DEFAULT_REVIEW_OUTPUT_LANGUAGE = "en";
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

function evidenceSortRank(issue) {
  return (
    (VERIFICATION_RANK[issueVerificationStatus(issue)] ?? 0) * 10 +
    (EVIDENCE_RANK[issueConfidenceLevel(issue)] ?? 0)
  );
}

function sortIssues(items, key) {
  const sorted = items.slice();
  if (key === "severity") {
    sorted.sort(
      (a, b) =>
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
        evidenceSortRank(b) - evidenceSortRank(a)
    );
  }
  if (key === "confidence")
    sorted.sort(
      (a, b) =>
        (VERIFICATION_RANK[issueVerificationStatus(b)] ?? 0) -
          (VERIFICATION_RANK[issueVerificationStatus(a)] ?? 0) ||
        (EVIDENCE_RANK[issueConfidenceLevel(b)] ?? 0) -
          (EVIDENCE_RANK[issueConfidenceLevel(a)] ?? 0)
    );
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
  return JSON.stringify(ISSUE_IDENTITY_FIELDS.map((field) => String(issue?.[field] ?? "")));
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
    const queueTags = queueSummary.tags.filter(
      (tag) => !tag.startsWith("Global") && !tag.startsWith("Per user")
    );
    return [T("queued", "排队中"), ...queueTags].join(" - ");
  }
  if (scan.status === "cancelled") return T("Scan cancelled", "扫描已取消");
  if (scan.issues) {
    const total = issueTotal(scan);
    const audit = scan.verificationAudit || {};
    const rejected = Number(audit.rejectedCount || 0);
    const downgraded = Number(audit.downgradedCount || 0);
    const partsEn = [`${total} issues`];
    const partsZh = [`${total} 个问题`];
    if (rejected > 0) {
      partsEn.push(`${rejected} rejected`);
      partsZh.push(`${rejected} 个候选被拒绝`);
    }
    if (downgraded > 0) {
      partsEn.push(`${downgraded} downgraded`);
      partsZh.push(`${downgraded} 个被降级`);
    }
    return T(partsEn.join(" · "), partsZh.join(" · "));
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

function issuePullRequestState(issue) {
  if (!issue?.pullRequest) return null;
  const value = normalizeIssuePullRequest(issue.pullRequest, {
    issueId: issue.id,
    title: issue.title,
  });
  return value ? { issueId: issue.id, value } : null;
}

function CodeEvidence({ title, lines }) {
  if (!lines?.length) return null;
  return (
    <div className="code code-evidence">
      <div className="code-head">{title}</div>
      <div className="code-body">
        <pre>
          {lines.map((line, index) => (
            <div
              key={`${title}-${line.ln || index}-${line.code}`}
              className={"code-line " + (line.t || "")}
            >
              <span className="ln">{line.ln || ""}</span>
              <span className="marker">
                {line.t === "add" ? "+" : line.t === "del" ? "-" : " "}
              </span>
              <code>{line.code}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

const VERIFICATION_LABELS = {
  verified: { en: "Verified", zh: "已验证" },
  static_proof: { en: "Static proof", zh: "静态证明" },
  potential_risk: { en: "Potential risk", zh: "潜在风险" },
  unverified: { en: "Unverified", zh: "未验证" },
};

const CONFIDENCE_LABELS = {
  high: { en: "High evidence", zh: "高置信度证据" },
  medium: { en: "Medium evidence", zh: "中等置信度证据" },
  low: { en: "Low evidence", zh: "低置信度证据" },
};

function issueVerificationStatus(issue) {
  return issue?.verificationStatus || "potential_risk";
}

function issueConfidenceLevel(issue) {
  return issue?.confidenceLevel || "low";
}

function verificationLabel(issue) {
  const label = VERIFICATION_LABELS[issueVerificationStatus(issue)];
  if (!label) return T("Potential risk", "潜在风险");
  return T(label.en, label.zh);
}

function confidenceEvidenceLabel(issue) {
  const label = CONFIDENCE_LABELS[issueConfidenceLevel(issue)];
  if (!label) return T("Low evidence", "低置信度证据");
  return T(label.en, label.zh);
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

const AUDIT_SWARM_DONE_PHASES = new Set(["report", "done", "complete", "completed"]);
const AUDIT_SWARM_PENDING_PHASES = new Set(["clone", "checkout", "index", "secrets", "deps", "ai"]);
const AUDIT_SWARM_DONE_STAGES = new Set(["report", "done", "complete", "completed"]);
const AUDIT_SWARM_PENDING_STAGES = new Set([
  "candidate",
  "candidates",
  "discovery",
  "review",
  "reviewing",
  "running",
  "ai",
]);

function lifecycleText(...values) {
  for (const value of values) {
    const text = markdownText(value).toLowerCase();
    if (text) return text;
  }
  return "";
}

function issueAuditSwarmReviewComplete(issue) {
  if (typeof issue?.auditSwarm?.reviewComplete === "boolean") {
    return issue.auditSwarm.reviewComplete;
  }
  if (typeof issue?.audit?.auditSwarmReviewComplete === "boolean") {
    return issue.audit.auditSwarmReviewComplete;
  }

  const phase = lifecycleText(
    issue?.scanPhase,
    issue?.phase,
    issue?.scan?.phase,
    issue?.audit?.scanPhase,
    issue?.audit?.phase,
    issue?.auditSwarm?.phase
  );
  if (AUDIT_SWARM_DONE_PHASES.has(phase)) return true;
  if (AUDIT_SWARM_PENDING_PHASES.has(phase)) return false;

  const stage = lifecycleText(issue?.auditSwarm?.stage, issue?.audit?.auditSwarmStage);
  if (AUDIT_SWARM_DONE_STAGES.has(stage)) return true;
  if (AUDIT_SWARM_PENDING_STAGES.has(stage)) return false;

  const status = lifecycleText(issue?.scanStatus, issue?.scan?.status, issue?.audit?.scanStatus);
  if (["done", "complete", "completed"].includes(status)) return true;
  if (["queued", "running", "failed", "cancelled", "canceled"].includes(status)) return false;

  return true;
}

function appendMarkdownSection(lines, title, content) {
  const body = Array.isArray(content)
    ? content.map(markdownText).filter(Boolean).join("\n")
    : markdownText(content);
  if (!body) return;
  lines.push("", `## ${title}`, body);
}

function appendMarkdownCodeBlock(lines, title, value) {
  const body = markdownText(value);
  if (!body) return;
  lines.push("", `### ${title}`, "```", body, "```");
}

function codeLinesMarkdown(lines = []) {
  return lines
    .map((line) => (typeof line === "string" ? line : line?.code))
    .map(markdownText)
    .filter(Boolean)
    .join("\n");
}

function buildIssuePageMarkdown(issue, currentStatus, { includeAuditEvidence = true } = {}) {
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

  if (includeAuditEvidence) {
    const confidenceEvidence = [];
    if (issue.verificationSummary) confidenceEvidence.push(markdownText(issue.verificationSummary));
    if (issue.evidenceChecklist?.length) {
      confidenceEvidence.push(
        ...issue.evidenceChecklist
          .map((item) => {
            const label = markdownText(item?.label);
            if (!label) return "";
            return `- [${item?.met ? "x" : " "}] ${label}`;
          })
          .filter(Boolean)
      );
    }
    appendMarkdownSection(lines, "Confidence evidence", confidenceEvidence);

    if (issue.evidenceTrace?.length) {
      appendMarkdownSection(
        lines,
        "Evidence trace",
        issue.evidenceTrace.flatMap((stage, index) => {
          const label = markdownText(stage?.label || stage?.key || `Step ${index + 1}`);
          const status = markdownText(stage?.status);
          const stageLines = label ? [`### ${label}${status ? ` (${status})` : ""}`] : [];
          if (stage?.summary) stageLines.push(markdownText(stage.summary));
          if (stage?.items?.length) {
            stageLines.push(
              ...stage.items.map((item) => `- ${markdownText(item)}`).filter(Boolean)
            );
          }
          return stageLines;
        })
      );
    }

    const breakdown = issue.reasoningBreakdown || {};
    const reasoningLines = [
      ["Facts", breakdown.facts],
      ["Inferences", breakdown.inferences],
      ["Recommendations", breakdown.recommendations],
    ].flatMap(([label, items]) => {
      if (!items?.length) return [];
      return [`### ${label}`, ...items.map((item) => `- ${markdownText(item)}`).filter(Boolean)];
    });
    appendMarkdownSection(lines, "Facts, reasoning, recommendations", reasoningLines);

    if (issue.evidence?.length) {
      appendMarkdownSection(
        lines,
        "Evidence chain",
        issue.evidence.flatMap((item) => {
          const itemLines = [`### ${markdownText(item.label || item.type)}`];
          if (item.type) itemLines.push(`- Type: ${markdownText(item.type).replaceAll("_", " ")}`);
          if (item.summary) itemLines.push(markdownText(item.summary));
          if (item.file) itemLines.push(`- File: ${locationLabel(item)}`);
          if (item.command) itemLines.push(`- Command: ${markdownText(item.command)}`);
          if (item.logPath) itemLines.push(`- Log: ${markdownText(item.logPath)}`);
          if (item.url) itemLines.push(`- URL: ${markdownText(item.url)}`);
          if (item.exitCode !== null && item.exitCode !== undefined) {
            itemLines.push(`- Exit code: ${item.exitCode}`);
          }
          return itemLines.filter(Boolean);
        })
      );
    }

    const reproduction = issue.reproduction || {};
    const reproductionLines = [];
    if (issue.reproductionPath) reproductionLines.push(markdownText(issue.reproductionPath));
    if (reproduction.commands?.length) {
      reproductionLines.push("### Commands", "```", reproduction.commands.join("\n"), "```");
    }
    [
      ["Input", reproduction.input],
      ["Expected", reproduction.expected],
      ["Actual", reproduction.actual],
      ["Test file", reproduction.testFile],
      ["Log", reproduction.logPath],
    ].forEach(([label, value]) => {
      const text = markdownText(value);
      if (text) reproductionLines.push(`- ${label}: ${text}`);
    });
    appendMarkdownSection(lines, "Reproduction center", reproductionLines);
  }

  appendMarkdownSection(lines, "Detection reasoning", issue.detectionReasoning);
  appendMarkdownSection(lines, "Impact", issue.impact);
  appendMarkdownSection(lines, "Why this is not a false positive", issue.whyNotFalsePositive);
  appendMarkdownSection(lines, "When this may not apply", issue.limitations);

  const fixImpact = [];
  if (issue.fixBenefits) fixImpact.push(`### Benefits\n${markdownText(issue.fixBenefits)}`);
  if (issue.fixRisks) fixImpact.push(`### Risks\n${markdownText(issue.fixRisks)}`);
  appendMarkdownSection(lines, "Fix impact analysis", fixImpact);

  if (issue.steps?.length) {
    appendMarkdownSection(
      lines,
      "Remediation",
      issue.steps.map((step, index) => `${index + 1}. ${markdownText(step)}`).filter(Boolean)
    );
  }

  const badCode = includeAuditEvidence ? codeLinesMarkdown(issue.badCode || []) : "";
  const goodCode = includeAuditEvidence ? codeLinesMarkdown(issue.goodCode || []) : "";
  if (badCode || goodCode) {
    lines.push("", "## Patch evidence");
    appendMarkdownCodeBlock(lines, "Current code", badCode);
    appendMarkdownCodeBlock(lines, "Suggested code", goodCode);
  }

  if (issue.references?.length) {
    appendMarkdownSection(
      lines,
      "References",
      issue.references
        .map((reference) => {
          const url = markdownText(reference?.url);
          if (!url) return "";
          const label = markdownText(reference?.label) || url;
          return `- [${label}](${url})`;
        })
        .filter(Boolean)
    );
  }

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function VerificationBadge({ issue }) {
  return <span className="tag">{verificationLabel(issue)}</span>;
}

function EvidenceChecklist({ issue }) {
  const checklist = issue.evidenceChecklist || [];
  if (!checklist.length) return null;
  return (
    <div className="evidence-checklist">
      <div className="evidence-badges">
        <span className="tag">{confidenceEvidenceLabel(issue)}</span>
        <VerificationBadge issue={issue} />
      </div>
      <div className="evidence-checklist-list">
        {checklist.map((item) => (
          <div key={item.label} className="evidence-check">
            {item.met ? (
              <I.Check size={13} className="evidence-check-icon met" />
            ) : (
              <I.X size={13} className="evidence-check-icon" />
            )}
            <span className="muted evidence-check-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceTrace({ issue }) {
  const stages = Array.isArray(issue?.evidenceTrace)
    ? issue.evidenceTrace
        .map((stage, index) => {
          const label = String(stage?.label || stage?.key || `Step ${index + 1}`).trim();
          const status =
            String(stage?.status || "").toLowerCase() === "missing" ? "missing" : "present";
          const summary = String(stage?.summary || "").trim();
          const items = Array.isArray(stage?.items)
            ? stage.items.map((item) => String(item || "").trim()).filter(Boolean)
            : [];
          return { key: stage?.key || stage?.label || index, label, status, summary, items };
        })
        .filter((stage) => stage.label || stage.summary || stage.items.length)
    : [];
  if (!stages.length) return null;

  const presentCount = stages.filter((stage) => stage.status === "present").length;
  const percent = Math.round((presentCount / stages.length) * 100);

  return (
    <div className="evidence-trace-wrap">
      <div className="trace-progress">
        <div className="trace-progress-h">
          <span className="trace-progress-title">{T("Trace coverage", "追溯覆盖")}</span>
          <span className="trace-progress-count">
            {T(
              `${presentCount}/${stages.length} present`,
              `${presentCount}/${stages.length} 已提供`
            )}
          </span>
        </div>
        <span className="trace-progress-bar" aria-hidden="true">
          <span className="trace-progress-fill" style={{ width: `${percent}%` }} />
        </span>
      </div>
      <div className="trace-timeline" role="list">
        {stages.map((stage, index) => {
          const present = stage.status === "present";
          const detailItems = stage.items.filter((item) => item !== stage.summary);
          return (
            <div
              key={`${stage.key}-${index}`}
              className={"trace-step " + (present ? "trace-step-present" : "trace-step-missing")}
              role="listitem"
            >
              <div className="trace-node">
                <span className="trace-node-bullet" aria-hidden="true">
                  {present ? <I.Check size={14} /> : <I.X size={14} />}
                </span>
                <span className="trace-node-l">
                  <I.Activity size={12} className="trace-node-glyph" /> {stage.label}
                </span>
                <span className="trace-node-s">
                  {present ? T("present", "已提供") : T("missing", "缺失")}
                </span>
                {stage.summary && <span className="trace-node-summary">{stage.summary}</span>}
              </div>
              {detailItems.length > 0 && (
                <div className="trace-node-detail">
                  <div className="trace-node-detail-h">{T("Evidence", "证据")}</div>
                  <ul className="trace-node-items">
                    {detailItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {index < stages.length - 1 && (
                <span
                  className={
                    "trace-connector " +
                    (present ? "trace-connector-present" : "trace-connector-missing")
                  }
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceChain({ issue }) {
  const evidence = issue.evidence || [];
  if (!evidence.length) return null;
  return (
    <div className="evidence-chain">
      {evidence.map((item, index) => (
        <div key={`${item.type}-${item.label}-${index}`} className="evidence-item">
          <div className="evidence-item-h">
            <span className="tag">{item.type.replaceAll("_", " ")}</span>
            <strong className="evidence-item-title">{item.label}</strong>
            {item.exitCode !== null && item.exitCode !== undefined && (
              <span className="tag">exit {item.exitCode}</span>
            )}
          </div>
          {item.summary && <p className="muted evidence-summary">{item.summary}</p>}
          {(item.file || item.command || item.logPath || item.url) && (
            <div className="evidence-meta">
              {item.file && (
                <span className="tag">
                  <I.FileCode size={11} /> {locationLabel(item)}
                </span>
              )}
              {item.command && <code className="tag evidence-command">{item.command}</code>}
              {item.logPath && <span className="tag">log: {item.logPath}</span>}
              {item.url && (
                <a className="auth-link" href={item.url} target="_blank" rel="noreferrer">
                  {T("Open evidence line", "打开证据行")}
                </a>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReproductionCenter({ issue }) {
  const reproduction = issue.reproduction || {};
  const commands = Array.isArray(reproduction.commands) ? reproduction.commands : [];
  const commandText = commands.join("\n");
  const hasStructuredRepro =
    commands.length ||
    reproduction.input ||
    reproduction.expected ||
    reproduction.actual ||
    reproduction.testFile ||
    reproduction.logPath;
  if (!hasStructuredRepro && !issue.reproductionPath) return null;
  return (
    <div className="repro-center">
      {issue.reproductionPath && <p className="muted repro-note">{issue.reproductionPath}</p>}
      {commands.length > 0 && (
        <div className="docs-code repro-command">
          <div className="docs-code-h">
            <span>{T("Reproduction command", "复现命令")}</span>
            <button className="docs-code-copy" type="button" onClick={() => copyText(commandText)}>
              <I.Copy size={12} /> {T("Copy", "复制")}
            </button>
          </div>
          <pre>{commandText}</pre>
        </div>
      )}
      {(reproduction.input || reproduction.expected || reproduction.actual) && (
        <div className="repro-fields">
          {reproduction.input && (
            <div className="repro-field">
              <b className="repro-field-title">{T("Input", "输入")}</b>
              <p className="muted repro-field-text">{reproduction.input}</p>
            </div>
          )}
          {reproduction.expected && (
            <div className="repro-field">
              <b className="repro-field-title">{T("Expected", "预期")}</b>
              <p className="muted repro-field-text">{reproduction.expected}</p>
            </div>
          )}
          {reproduction.actual && (
            <div className="repro-field">
              <b className="repro-field-title">{T("Actual", "实际")}</b>
              <p className="muted repro-field-text">{reproduction.actual}</p>
            </div>
          )}
        </div>
      )}
      {(reproduction.testFile || reproduction.logPath) && (
        <div className="repro-tags">
          {reproduction.testFile && <span className="tag">test: {reproduction.testFile}</span>}
          {reproduction.logPath && <span className="tag">log: {reproduction.logPath}</span>}
        </div>
      )}
    </div>
  );
}

function ReasoningBreakdown({ issue }) {
  const breakdown = issue.reasoningBreakdown || {};
  const sections = [
    ["Facts", breakdown.facts],
    ["Inferences", breakdown.inferences],
    ["Recommendations", breakdown.recommendations],
  ].filter(([, items]) => Array.isArray(items) && items.length > 0);
  if (!sections.length) return null;
  return (
    <div className="repro-fields">
      {sections.map(([title, items]) => (
        <div key={title} className="repro-field">
          <b className="repro-field-title">{title}</b>
          <ul className="legal-list-flat evidence-list">
            {items.map((item, index) => (
              <li key={`${title}-${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
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
      const results = await Promise.allSettled(
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
                onClick={() => setSortBy(sortBy === "severity" ? "confidence" : "severity")}
              >
                <I.Sort size={14} />{" "}
                {sortBy === "severity" ? T("Severity", "严重度") : T("Evidence", "证据")}
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

          {!loading && !error && all.length > 0 && (
            <IssueDistributionBand issues={all} activeSeverity={sev} onSeverityClick={setSev} />
          )}

          <div className="issues-table card">
            <div className="issues-thead">
              <div></div>
              <div>{T("Issue", "问题")}</div>
              <div>{T("File", "文件")}</div>
              <div>{T("Category", "类别")}</div>
              <div>{T("Evidence", "证据")}</div>
              <div>{T("Status", "状态")}</div>
              <div></div>
            </div>
            {loading && <IssuesTableSkeleton />}
            {error && <div className="muted issues-table-message">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="muted issues-table-empty">
                {T("No findings are available yet.", "暂无 findings。")}
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
                        <VerificationBadge issue={issue} />
                        <span className="issues-evidence-label">
                          {confidenceEvidenceLabel(issue)}
                        </span>
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
  const [loadedIssue, setLoadedIssue] = useState(null);
  const [, setLoadingIssue] = useState(false);
  const [, setLoadError] = useState("");
  const routeMatchesInitialIssue = !issueId || initialIssue?.id === issueId;
  const activeIssue = loadedIssue || (routeMatchesInitialIssue ? initialIssue : null);
  const [currentStatus, setCurrentStatus] = useState(activeIssue?.status || "open");
  const [actionError, setActionError] = useState("");
  const [fixPreview, setFixPreview] = useState(null);
  const [pullRequest, setPullRequest] = useState(issuePullRequestState(activeIssue));
  const [fixLoading, setFixLoading] = useState("");
  const [statusLoading, setStatusLoading] = useState("");
  const [selectedFeedback, setSelectedFeedback] = useState(activeIssue?.feedbackReason || "");
  const [feedbackLoading, setFeedbackLoading] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [pageCopied, setPageCopied] = useState(false);
  const [impactScan, setImpactScan] = useState(null);
  const [impactScanLoading, setImpactScanLoading] = useState(false);
  const [impactDrawer, setImpactDrawer] = useState(null);
  const statusRequestRef = useRef(false);
  const feedbackRequestRef = useRef(0);
  const fixRequestRef = useRef(0);
  const pageCopyResetRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoadedIssue(null);
    setLoadError("");
    if (!issueId || initialIssue?.id === issueId) {
      setLoadingIssue(false);
      return () => {
        cancelled = true;
      };
    }
    setLoadingIssue(true);
    pullwiseApi.issues
      .get(issueId)
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
  }, [issueId, initialIssue, setIssue]);

  const embeddedImpactScan = useMemo(() => {
    if (plainObject(activeIssue?.scan)) return normalizeScan(activeIssue.scan);
    if (plainObject(activeIssue?.impactGraph)) {
      return normalizeScan({ id: activeIssue.scanId, impactGraph: activeIssue.impactGraph });
    }
    return null;
  }, [activeIssue]);

  useEffect(() => {
    let cancelled = false;
    setImpactScan(null);
    setImpactScanLoading(false);
    if (
      embeddedImpactScan?.impactGraph ||
      !activeIssue?.scanId ||
      !activeIssue?.file ||
      typeof pullwiseApi.scans?.get !== "function"
    ) {
      return () => {
        cancelled = true;
      };
    }
    setImpactScanLoading(true);
    pullwiseApi.scans
      .get(activeIssue.scanId)
      .then((payload) => {
        if (!cancelled) setImpactScan(normalizeScan(payload));
      })
      .catch(() => {
        if (!cancelled) setImpactScan(null);
      })
      .finally(() => {
        if (!cancelled) setImpactScanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeIssue?.id, activeIssue?.scanId, activeIssue?.file, embeddedImpactScan]);

  useEffect(() => {
    fixRequestRef.current += 1;
    setCurrentStatus(activeIssue?.status || "open");
    setActionError("");
    setFixPreview(null);
    setPullRequest(issuePullRequestState(activeIssue));
    setFixLoading("");
    setStatusLoading("");
    setSelectedFeedback(activeIssue?.feedbackReason || "");
    setFeedbackLoading("");
    setFeedbackSaved(false);
    setPageCopied(false);
    setImpactDrawer(null);
    statusRequestRef.current = false;
    feedbackRequestRef.current += 1;
    if (pageCopyResetRef.current) {
      clearTimeout(pageCopyResetRef.current);
      pageCopyResetRef.current = null;
    }
    return () => {
      fixRequestRef.current += 1;
      statusRequestRef.current = false;
      feedbackRequestRef.current += 1;
      if (pageCopyResetRef.current) {
        clearTimeout(pageCopyResetRef.current);
        pageCopyResetRef.current = null;
      }
    };
  }, [activeIssue]);

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
  const impactGraph = embeddedImpactScan?.impactGraph || impactScan?.impactGraph || null;
  const impactTarget = findImpactTargetByPath(impactGraph, issue.file);
  const showImpactContext = Boolean(issue.scanId || impactGraph || impactScanLoading);

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
  const auditEvidenceReady = issueAuditSwarmReviewComplete(issue);
  const hasEvidence = auditEvidenceReady && (issue.badCode?.length || issue.goodCode?.length);
  const autoFixable = Boolean(issue.autoFix || issue.autoFixable);
  const severity = issue.severity || "info";
  const primaryLocation = issue.affectedLocations?.[0] || null;
  const hasReproduction =
    auditEvidenceReady &&
    Boolean(
      issue.reproductionPath ||
      issue.reproduction?.commands?.length ||
      issue.reproduction?.input ||
      issue.reproduction?.expected ||
      issue.reproduction?.actual ||
      issue.reproduction?.testFile ||
      issue.reproduction?.logPath
    );
  const hasReasoningBreakdown =
    auditEvidenceReady &&
    Boolean(
      issue.reasoningBreakdown?.facts?.length ||
      issue.reasoningBreakdown?.inferences?.length ||
      issue.reasoningBreakdown?.recommendations?.length
    );
  const hasEvidenceTrace =
    auditEvidenceReady && Array.isArray(issue.evidenceTrace) && issue.evidenceTrace.length > 0;
  const activeFixPreview = fixPreview?.issueId === issue.id ? fixPreview.value : null;
  const activePullRequest =
    pullRequest?.issueId === issue.id
      ? pullRequest.value
      : issuePullRequestState(issue)?.value || null;
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
  const beginFixRequest = () => {
    const requestId = fixRequestRef.current + 1;
    fixRequestRef.current = requestId;
    return requestId;
  };
  const isCurrentFixRequest = (requestId) => fixRequestRef.current === requestId;
  const previewFix = async () => {
    const requestId = beginFixRequest();
    setActionError("");
    setFixPreview(null);
    setPullRequest(issuePullRequestState(issue));
    setFixLoading("preview");
    try {
      const preview = await pullwiseApi.issues.previewFix(issue.id);
      if (!isCurrentFixRequest(requestId)) return;
      setFixPreview({ issueId: issue.id, value: preview });
    } catch (error) {
      if (!isCurrentFixRequest(requestId)) return;
      setActionError(error?.message || T("Unable to preview fix.", "无法预览修复。"));
    } finally {
      if (isCurrentFixRequest(requestId)) setFixLoading("");
    }
  };
  const openPullRequest = async () => {
    const requestId = beginFixRequest();
    setActionError("");
    setFixLoading("pr");
    try {
      const result = await pullwiseApi.issues.createPullRequest(issue.id);
      if (!isCurrentFixRequest(requestId)) return;
      setPullRequest({
        issueId: issue.id,
        value: normalizeIssuePullRequest(result, { issueId: issue.id, title: issue.title }) || null,
      });
    } catch (error) {
      if (!isCurrentFixRequest(requestId)) return;
      setActionError(error?.message || T("Unable to open pull request.", "无法打开拉取请求。"));
    } finally {
      if (isCurrentFixRequest(requestId)) setFixLoading("");
    }
  };
  const copyPage = async () => {
    const copied = await copyText(
      buildIssuePageMarkdown(issue, currentStatus, { includeAuditEvidence: auditEvidenceReady })
    );
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
                <VerificationBadge issue={issue} />
                <span className="tag">{confidenceEvidenceLabel(issue)}</span>
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
              {auditEvidenceReady && issue.evidenceChecklist?.length > 0 && (
                <DetailSection title={T("Confidence evidence", "置信度证据")}>
                  {issue.verificationSummary && (
                    <p className="muted issue-section-note">{issue.verificationSummary}</p>
                  )}
                  <EvidenceChecklist issue={issue} />
                </DetailSection>
              )}

              {hasEvidenceTrace && (
                <DetailSection title={T("Evidence trace", "证据追溯")}>
                  <EvidenceTrace issue={issue} />
                </DetailSection>
              )}

              {hasReasoningBreakdown && (
                <DetailSection title={T("Facts, reasoning, recommendations", "事实、推理与建议")}>
                  <ReasoningBreakdown issue={issue} />
                </DetailSection>
              )}

              {auditEvidenceReady && (
                <DetailSection
                  title={T("Evidence chain", "证据链")}
                  empty={T("No structured evidence was provided.", "未提供结构化证据。")}
                >
                  {issue.evidence?.length > 0 && <EvidenceChain issue={issue} />}
                </DetailSection>
              )}

              {auditEvidenceReady && (
                <DetailSection
                  title={T("Reproduction center", "复现中心")}
                  empty={T("No executable reproduction was provided.", "未提供可执行复现。")}
                >
                  {hasReproduction && <ReproductionCenter issue={issue} />}
                </DetailSection>
              )}

              <DetailSection title={T("Detection reasoning", "检测推理")} empty="">
                {issue.detectionReasoning && (
                  <p className="muted" style={{ color: "var(--text-2)" }}>
                    {issue.detectionReasoning}
                  </p>
                )}
              </DetailSection>

              <DetailSection
                title={T("Impact", "影响")}
                empty={T("No impact statement was provided.", "未提供影响说明。")}
              >
                {issue.impact && (
                  <p className="muted" style={{ color: "var(--text-2)" }}>
                    {issue.impact}
                  </p>
                )}
              </DetailSection>

              {showImpactContext && (
                <DetailSection
                  title={T("Impact context", "Impact context")}
                  empty={T(
                    "No impact context is available for this issue file.",
                    "No impact context is available for this issue file."
                  )}
                >
                  {impactScanLoading && !impactGraph ? (
                    <div className="muted">
                      {T("Loading impact context...", "Loading impact context...")}
                    </div>
                  ) : impactTarget ? (
                    <ImpactTargetCard target={impactTarget} onEvidence={setImpactDrawer} />
                  ) : impactGraph ? (
                    <div className="muted">
                      {T(
                        `No impact target matched ${issue.file || "this issue file"}.`,
                        `No impact target matched ${issue.file || "this issue file"}.`
                      )}
                    </div>
                  ) : (
                    <div className="muted">
                      {T(
                        "Impact graph unavailable for this scan.",
                        "Impact graph unavailable for this scan."
                      )}
                    </div>
                  )}
                </DetailSection>
              )}

              <TextListSection
                title={T("Why this is not a false positive", "为什么这不是误报")}
                items={issue.whyNotFalsePositive}
              />

              <TextListSection
                title={T("When this may not apply", "何时可能不适用")}
                items={issue.limitations}
              />

              {(issue.fixBenefits || issue.fixRisks) && (
                <DetailSection title={T("Fix impact analysis", "修复影响分析")}>
                  {issue.fixBenefits && (
                    <div style={{ marginBottom: issue.fixRisks ? 10 : 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#16a34a",
                        }}
                      >
                        <I.Check size={12} /> {T("Benefits", "收益")}
                      </div>
                      <p className="muted" style={{ color: "var(--text-2)", margin: 0 }}>
                        {issue.fixBenefits}
                      </p>
                    </div>
                  )}
                  {issue.fixRisks && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--sev-high, #e97316)",
                        }}
                      >
                        <I.X size={12} /> {T("Risks", "风险")}
                      </div>
                      <p className="muted" style={{ color: "var(--text-2)", margin: 0 }}>
                        {issue.fixRisks}
                      </p>
                    </div>
                  )}
                </DetailSection>
              )}

              <DetailSection
                title={T("Remediation", "修复步骤")}
                empty={T("No remediation steps were provided.", "未提供修复步骤。")}
              >
                {issue.steps?.length > 0 && (
                  <ol className="legal-list-flat" style={{ marginBottom: 0 }}>
                    {issue.steps.map((step, index) => (
                      <li key={`${index}-${step}`}>{step}</li>
                    ))}
                  </ol>
                )}
              </DetailSection>

              {auditEvidenceReady && (
                <DetailSection
                  title={T("Patch evidence", "补丁证据")}
                  empty={T("No patch evidence was provided.", "未提供补丁证据。")}
                >
                  {hasEvidence && (
                    <>
                      <CodeEvidence
                        title={T("Current code", "当前代码")}
                        lines={issue.badCode || []}
                      />
                      <CodeEvidence
                        title={T("Suggested code", "建议代码")}
                        lines={issue.goodCode || []}
                      />
                    </>
                  )}
                </DetailSection>
              )}

              {issue.references?.length > 0 && (
                <DetailSection title={T("References", "参考资料")}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {issue.references.map((reference) => (
                      <a
                        key={`${reference.label}-${reference.url}`}
                        className="auth-link"
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 13 }}
                      >
                        {reference.label || reference.url}
                      </a>
                    ))}
                  </div>
                </DetailSection>
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
                {issue.auditSwarm?.protocol && (
                  <div className="tag audit-tag">{issue.auditSwarm.protocol}</div>
                )}
                {issue.auditSwarm?.agentRole && (
                  <div className="tag audit-tag">{issue.auditSwarm.agentRole}</div>
                )}
                {issue.auditSwarm?.shardId && (
                  <div className="tag audit-tag">
                    {T(`shard ${issue.auditSwarm.shardId}`, `分片 ${issue.auditSwarm.shardId}`)}
                  </div>
                )}
                {issue.auditSwarm?.verdict && (
                  <div className="tag audit-tag">
                    {T(`verdict ${issue.auditSwarm.verdict}`, `结论 ${issue.auditSwarm.verdict}`)}
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
              <div className="divider" />
              <button
                className="btn sm"
                disabled={!autoFixable || Boolean(fixLoading)}
                onClick={previewFix}
              >
                <I.Sparkle size={13} />{" "}
                {fixLoading === "preview"
                  ? T("Previewing...", "正在预览...")
                  : T("Preview fix", "预览修复")}
              </button>
              {activePullRequest?.url ? (
                <a className="btn sm" href={activePullRequest.url} target="_blank" rel="noreferrer">
                  <I.GitBranch size={13} /> {T("Open PR", "打开 PR")}
                  {activePullRequest.number ? ` #${activePullRequest.number}` : ""}
                </a>
              ) : (
                <button
                  className="btn sm"
                  disabled={!activeFixPreview?.valid || Boolean(fixLoading)}
                  onClick={openPullRequest}
                  title={
                    !activeFixPreview?.valid ? T("Preview fix first.", "请先预览修复。") : undefined
                  }
                >
                  <I.GitBranch size={13} />{" "}
                  {fixLoading === "pr" ? T("Opening...", "正在打开...") : T("Open PR", "打开 PR")}
                </button>
              )}
              {!autoFixable && (
                <div className="muted" style={{ fontSize: 12 }}>
                  {T("This issue is not auto-fixable.", "此问题无法自动修复。")}
                </div>
              )}
              {activeFixPreview && (
                <div className="fix-preview">
                  <div className="fix-preview-h">
                    <b>{activeFixPreview.file}</b>
                    <span className="tag">
                      {activeFixPreview.valid ? T("validated", "已验证") : T("blocked", "已阻止")}
                    </span>
                  </div>
                  {activeFixPreview.message && (
                    <div className="muted">{activeFixPreview.message}</div>
                  )}
                  {activeFixPreview.diff && (
                    <pre className="diff-block">{activeFixPreview.diff}</pre>
                  )}
                </div>
              )}
            </div>
          </div>
          <ImpactEvidenceDrawer
            title={impactDrawer?.title || T("Impact evidence", "Impact evidence")}
            evidence={impactDrawer?.evidence || []}
            onClose={() => setImpactDrawer(null)}
          />
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

function HistoryGroups({ scans, viewScan, viewScanIssues, downloadAuditBundle, bundleLoading }) {
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

const SEVERITY_BAR_SEGMENTS = [
  { key: "critical", color: "var(--sev-critical)" },
  { key: "high", color: "var(--sev-high)" },
  { key: "medium", color: "var(--sev-medium)" },
  { key: "low", color: "var(--sev-low)" },
];

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

function ScanRow({ scan, viewScan, viewScanIssues, downloadAuditBundle, bundleLoading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const total = scanIssuesTotal(scan);
  const breakdown = scan?.issues || {};
  const status = scan.status || "info";
  const hasResults = scanHasResults(scan);
  const isDownloading = bundleLoading === scan.id;
  const summary = scanHistorySummary(scan);
  const aiUsageBadges = scanAiUsageBadges(scan.aiUsage);

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
      </div>
      <div className="scan-row-actions" ref={menuRef} onClick={stopRowClick}>
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

export function HistoryScreen({ go, openScan = null, openScanIssues = null, setIssue = null }) {
  useLang();
  const [status, setStatus] = useState("all");
  const [bundleLoading, setBundleLoading] = useState("");
  const {
    items: scans,
    loading,
    loadingMore,
    error,
    loadMore,
    meta = {},
  } = useScans({ status, limit: 50 });
  const filtered = scans;
  const totalCount = Number.isFinite(Number(meta.total)) ? Number(meta.total) : filtered.length;
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

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Scan history", "扫描历史") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="history" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Scan history", "扫描历史")}</h1>
              <div className="sub">
                {loading ? (
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
              <a className="btn primary" {...screenLinkProps(go, "repos")}>
                <I.Play size={11} /> {T("New scan", "新扫描")}
              </a>
            </div>
          </div>

          <div className="hist-list card">
            {error && (
              <div className="muted" style={{ padding: 18 }}>
                {error}
              </div>
            )}
            {loading && <HistorySkeleton />}
            {!loading && !error && filtered.length === 0 && (
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
            {!loading && filtered.length > 0 && (
              <HistoryGroups
                scans={filtered}
                viewScan={viewScan}
                viewScanIssues={viewScanIssues}
                downloadAuditBundle={downloadAuditBundle}
                bundleLoading={bundleLoading}
              />
            )}
            {!loading && meta.hasMore && (
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
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState("");
  const [integrations, setIntegrations] = useState(null);
  const [integrationError, setIntegrationError] = useState("");
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const integrationRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    Promise.all([
      pullwiseApi.auth.getSession(),
      pullwiseApi.integrations.list(),
      pullwiseApi.settings.get(),
    ])
      .then(([sessionPayload, integrationsPayload, settingsPayload]) => {
        if (cancelled) return;
        setSession(sessionPayload);
        setSettings(settingsPayload);
        if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          setSettings(null);
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
      <Topbar go={go} breadcrumbs={[{ label: T("Settings", "设置") }]} setIssue={setIssue} />
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
                {
                  k: "preferences",
                  t: T("Preferences", "偏好"),
                  i: <I.Sliders size={14} />,
                },
                { k: "integrations", t: T("Integrations", "集成"), i: <I.Github size={14} /> },
              ].map((item) => (
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
