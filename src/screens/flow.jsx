import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation } from "../lib/auth.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { screenLinkProps } from "../lib/navigation.js";
import { downloadBlob } from "../lib/download.js";
import {
  isTerminalScan,
  scanQueueSummary,
  useRepositories,
  useScanBatchRun,
  useScanRun,
} from "../lib/pullwise-data.js";
import { quotaResetText } from "../lib/quota-display.js";
import { Sidebar, Topbar } from "../shell.jsx";

function quotaNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.trunc(number));
}

function repoQuotaLabel(quota) {
  if (!quota) return "";
  const limit = quotaNumber(quota.limit);
  const used = quotaNumber(quota.used);
  const remaining = Object.prototype.hasOwnProperty.call(quota, "remaining")
    ? quotaNumber(quota.remaining)
    : Math.max(0, limit - used);
  const scope = quota.scope === "user" ? "account" : "repo";
  if (!limit) {
    return scope === "account"
      ? T("account quota unavailable", "账户配额不可用")
      : T("repo quota unavailable", "仓库配额不可用");
  }
  const reset = quotaResetText(quota);
  const leftText =
    scope === "account"
      ? T(`${remaining} of ${limit} account scans left`, `账户扫描剩余 ${remaining} / ${limit}`)
      : T(`${remaining} of ${limit} repo scans left`, `仓库扫描剩余 ${remaining} / ${limit}`);
  return reset ? `${leftText} - ${reset}` : leftText;
}

function quotaRemaining(quota) {
  if (!quota || typeof quota !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(quota, "remaining")) {
    return quotaNumber(quota.remaining);
  }
  if (
    Object.prototype.hasOwnProperty.call(quota, "limit") &&
    Object.prototype.hasOwnProperty.call(quota, "used")
  ) {
    return Math.max(0, quotaNumber(quota.limit) - quotaNumber(quota.used));
  }
  return null;
}

function scansWord(count) {
  return count === 1
    ? T("scan", "次扫描")
    : T("scans", "次扫描");
}

function accountQuotaNotice(remaining) {
  if (remaining === 0) {
    return T(
      "Your account has 0 scans left for this billing period. Upgrade or wait for the quota reset before selecting a repository.",
      "此计费周期账户剩余 0 次扫描。请升级或等待配额重置后再选择仓库。"
    );
  }
  return T(
    `Your account has ${remaining} ${scansWord(remaining)} left for this billing period. Deselect another repository before selecting more.`,
    `此计费周期账户剩余 ${remaining} ${scansWord(remaining)}。请先取消选择其他仓库，再选择更多仓库。`
  );
}

function repositoryQuotaNotice(repo) {
  const label = repo?.fullName || repo?.name || T("This repository", "此仓库");
  return T(
    `${label} has 0 repository scans left for this billing period.`,
    `${label} 此计费周期仓库扫描剩余 0 次。`
  );
}

function preflightAllowedCount(payload, fallback) {
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "allowedCount")) return fallback;
  return Math.min(fallback, quotaNumber(payload.allowedCount));
}

function preflightRows(payload) {
  return Array.isArray(payload?.repositories) ? payload.repositories : [];
}

function repoLookupValues(repo) {
  return new Set(
    [repo?.id, repo?.repoId, repo?.githubRepoId, repo?.fullName, repo?.name, repo?.repo]
      .map((value) => String(value || ""))
      .filter(Boolean)
  );
}

function preflightRowForRepo(rows, repo) {
  const values = repoLookupValues(repo);
  return rows.find((row) =>
    [row?.repoId, row?.githubRepoId, row?.repo, row?.fullName, row?.id]
      .map((value) => String(value || ""))
      .some((value) => values.has(value))
  );
}

function repoOwner(repo) {
  const fullName = repo.fullName || repo.name || "";
  return fullName.includes("/") ? fullName.split("/")[0] : "";
}

const REPO_LANGUAGE_COLORS = {
  javascript: "#f1e05a",
  typescript: "#3178c6",
  python: "#3572A5",
  go: "#00ADD8",
  java: "#b07219",
  kotlin: "#A97BFF",
  swift: "#F05138",
  rust: "#dea584",
  ruby: "#701516",
  php: "#4F5D95",
  c: "#555555",
  cpp: "#f34b7d",
  csharp: "#178600",
  html: "#e34c26",
  css: "#563d7c",
  scss: "#c6538c",
  shell: "#89e051",
  powershell: "#012456",
  vue: "#41b883",
  svelte: "#ff3e00",
  dart: "#00B4AB",
  scala: "#c22d40",
  r: "#198CE7",
  elixir: "#6e4a7e",
  hcl: "#844FBA",
  dockerfile: "#384d54",
  jupyter: "#da5b0b",
  objectivec: "#438eff",
  perl: "#0298c3",
  lua: "#000080",
  haskell: "#5e5086",
  clojure: "#db5855",
  other: "#8b949e",
};

const REPO_LANGUAGE_COLOR_ALIASES = new Map([
  ["javascript", "javascript"],
  ["js", "javascript"],
  ["node", "javascript"],
  ["typescript", "typescript"],
  ["ts", "typescript"],
  ["tsx", "typescript"],
  ["javascript/typescript", "typescript"],
  ["js/ts", "typescript"],
  ["python", "python"],
  ["py", "python"],
  ["go", "go"],
  ["golang", "go"],
  ["java", "java"],
  ["kotlin", "kotlin"],
  ["swift", "swift"],
  ["rust", "rust"],
  ["ruby", "ruby"],
  ["rb", "ruby"],
  ["php", "php"],
  ["c", "c"],
  ["c++", "cpp"],
  ["cpp", "cpp"],
  ["cxx", "cpp"],
  ["c#", "csharp"],
  ["csharp", "csharp"],
  ["c-sharp", "csharp"],
  ["html", "html"],
  ["css", "css"],
  ["scss", "scss"],
  ["sass", "scss"],
  ["shell", "shell"],
  ["bash", "shell"],
  ["sh", "shell"],
  ["zsh", "shell"],
  ["powershell", "powershell"],
  ["pwsh", "powershell"],
  ["vue", "vue"],
  ["vue.js", "vue"],
  ["svelte", "svelte"],
  ["dart", "dart"],
  ["scala", "scala"],
  ["r", "r"],
  ["elixir", "elixir"],
  ["hcl", "hcl"],
  ["terraform", "hcl"],
  ["dockerfile", "dockerfile"],
  ["jupyter notebook", "jupyter"],
  ["notebook", "jupyter"],
  ["objective-c", "objectivec"],
  ["objective c", "objectivec"],
  ["objc", "objectivec"],
  ["perl", "perl"],
  ["lua", "lua"],
  ["haskell", "haskell"],
  ["clojure", "clojure"],
]);

function repoLanguageColorKey(language) {
  const normalized = String(language || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!normalized || normalized === "-") return "other";
  const exact = REPO_LANGUAGE_COLOR_ALIASES.get(normalized);
  if (exact) return exact;
  const composite = normalized
    .split(/[,&/]+/)
    .map((part) => part.trim())
    .find((part) => REPO_LANGUAGE_COLOR_ALIASES.has(part));
  return composite ? REPO_LANGUAGE_COLOR_ALIASES.get(composite) : "other";
}

function repoLanguageColor(languageKey) {
  return REPO_LANGUAGE_COLORS[languageKey] || REPO_LANGUAGE_COLORS.other;
}

function makeScanRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `scan_req_${globalThis.crypto.randomUUID()}`;
  }
  return `scan_req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function scanInputFromRepo(repo) {
  const request = {
    repo: repo?.fullName || repo?.name || repo?.repo || "",
    branch: repo?.branch || repo?.defaultBranch || "main",
    commit: repo?.commit || "pending",
    requestId: repo?.scanRequestId || "",
  };
  if (repo?.repoId) request.repoId = repo.repoId;
  return request;
}

function repoBranchKey(repo) {
  return String(
    repo?.repoId || repo?.githubRepoId || repo?.id || repo?.fullName || repo?.name || ""
  );
}

function repoBranchApiId(repo) {
  return String(
    repo?.repoId || repo?.githubRepoId || repo?.id || repo?.fullName || repo?.name || ""
  );
}

function cleanBranchList(values) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(
          (value) =>
            value &&
            !value.includes("\r") &&
            !value.includes("\n") &&
            !value.includes(String.fromCharCode(0))
        )
    ),
  ];
}

function branchPayloadBranches(payload, fallbackBranch) {
  const branches = cleanBranchList(payload?.branches);
  if (branches.length) return branches;
  return cleanBranchList([payload?.defaultBranch, fallbackBranch]);
}

function batchScanStatus(scans, expectedCount, hasError) {
  if (!expectedCount) return "no_repo";
  if (hasError && scans.length === 0) return "failed";
  if (scans.some((scan) => scan.status === "running")) return "running";
  if (scans.some((scan) => scan.status === "queued")) return "queued";
  if (scans.length < expectedCount) return hasError ? "failed" : "queued";
  if (scans.every((scan) => scan.status === "done")) return "done";
  if (scans.every((scan) => scan.status === "cancelled")) return "cancelled";
  if (scans.some((scan) => scan.status === "failed")) return "failed";
  if (hasError) return "failed";
  return "queued";
}

function batchCreationSummary(batchRows, scans, expectedCount) {
  const created = batchRows.length
    ? batchRows.filter((row) => row.scanId || row.scan?.id).length
    : scans.length;
  const failedToCreate = batchRows.filter((row) => row.status === "failed" && !row.scanId).length;
  return { created, failedToCreate, expected: expectedCount };
}

function isTerminalBatchRow(row) {
  return ["done", "failed", "cancelled"].includes(row?.status) || isTerminalScan(row?.scan);
}

function scanErrorAction(error) {
  const code = typeof error === "object" && error ? String(error.code || "") : "";
  const message = typeof error === "object" && error ? error.message : error;
  const text = `${code} ${String(message || "")}`.toLowerCase();
  if (code.startsWith("QUOTA_EXCEEDED")) {
    return { label: T("Open billing", "打开账单"), screen: "billing" };
  }
  if (
    text.includes("review provider") ||
    text.includes("cli") ||
    text.includes("not authenticated")
  ) {
    return { label: T("Open settings", "打开设置"), screen: "settings" };
  }
  if (
    text.includes("sync github repositories") ||
    ["REPOSITORY_SYNC_REQUIRED", "REPOSITORY_NOT_AUTHORIZED"].includes(code)
  ) {
    return { label: T("Sync repositories", "同步仓库"), screen: "repos" };
  }
  return { label: T("Retry", "重试"), screen: "repos" };
}

const REVIEW_RUNNER_CLI_RE = /\b[A-Za-z][A-Za-z0-9_-]*\s+cli\b/gi;

function publicScanErrorMessage(error) {
  const message = typeof error === "object" && error ? error.message : error;
  return String(message || "")
    .replace(REVIEW_RUNNER_CLI_RE, T("Review runner", "审查运行器"))
    .replace(/\bcli\b/gi, T("review runner", "审查运行器"));
}

function scanIssueTotals(scans) {
  return scans.reduce(
    (totals, scan) => {
      const issues = scan?.issues || {};
      return {
        critical: totals.critical + Number(issues.critical || 0),
        high: totals.high + Number(issues.high || 0),
        medium: totals.medium + Number(issues.medium || 0),
        low: totals.low + Number(issues.low || 0),
      };
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function uniqueAuditSwarmEvidenceBlocks(blocks) {
  const seen = new Set();
  return blocks.filter((block) => {
    const key = [
      block?.kind,
      block?.title,
      block?.summary,
      block?.issueId,
      block?.severity,
      block?.category,
      block?.role,
      block?.shardId,
      block?.stage,
      block?.status,
      block?.verdict,
      block?.proofType,
      block?.command,
      block?.file,
      block?.startLine,
      block?.endLine,
      (block?.items || []).join("\n"),
    ]
      .map((part) => String(part || "").trim().toLowerCase())
      .join("\x1f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scanPreflightSummary(scans) {
  const preflights = scans.map((scan) => scan?.preflight).filter(Boolean);
  if (!preflights.length) return null;
  const verifierRuns = preflights.flatMap((preflight) => preflight.verifier?.runs || []);
  const verifierFailed = verifierRuns.filter((run) => run.status === "failed").length;
  const verifierFlaky = verifierRuns.filter((run) => run.status === "flaky").length;
  const verifierTimeout = verifierRuns.filter((run) => run.status === "timeout").length;
  const environments = preflights.map((preflight) => preflight.environment).filter(Boolean);
  const environmentLabels = uniqueStrings(
    environments.map((environment) =>
      [environment.os, environment.osRelease, environment.machine].filter(Boolean).join(" ")
    )
  ).slice(0, 3);
  return {
    mode: uniqueStrings(preflights.map((preflight) => preflight.mode)).join(", "),
    execution: uniqueStrings(preflights.map((preflight) => preflight.execution)).join(", "),
    summary:
      preflights.length === 1
        ? preflights[0].summary
        : `${preflights.length} repository preflights captured without running project scripts.`,
    languages: uniqueStrings(preflights.flatMap((preflight) => preflight.languages || [])).slice(
      0,
      6
    ),
    packageManagers: uniqueStrings(
      preflights.flatMap((preflight) => preflight.packageManagers || [])
    ).slice(0, 6),
    availableScripts: uniqueStrings(
      preflights.flatMap((preflight) => preflight.availableScripts || [])
    ).slice(0, 8),
    manifestsCount: preflights.reduce(
      (total, preflight) => total + (preflight.manifests?.length || 0),
      0
    ),
    toolCount: preflights.reduce(
      (total, preflight) => total + (preflight.toolVersions?.length || 0),
      0
    ),
    environmentLabels,
    verifierRuns: verifierRuns.length,
    verifierFailed,
    verifierFlaky,
    verifierTimeout,
  };
}

function auditSwarmCount(audit, key) {
  const value = Number(audit?.counts?.[key] || 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function scanAuditSwarmSummary(scans) {
  const audits = scans.map((scan) => scan?.auditSwarm).filter(Boolean);
  if (!audits.length) return null;
  const issueCards = audits.flatMap((audit) => audit.issueCards || []).slice(0, 8);
  const verificationResults = audits
    .flatMap((audit) => audit.verificationResults || [])
    .slice(0, 12);
  const evidenceBlocks = uniqueAuditSwarmEvidenceBlocks(
    audits.flatMap((audit) => audit.evidenceBlocks || [])
  ).slice(0, 12);
  const counts = audits.reduce(
    (totals, audit) => {
      for (const key of Object.keys(totals)) {
        totals[key] += auditSwarmCount(audit, key);
      }
      return totals;
    },
    {
      issueCards: 0,
      verificationResults: 0,
      evidenceBlocks: 0,
      candidateCount: 0,
      reportedCount: 0,
      rejectedCount: 0,
      verifiedCount: 0,
      staticProofCount: 0,
      potentialRiskCount: 0,
      unverifiedCount: 0,
      manifestCount: 0,
      toolCount: 0,
      verifierRunCount: 0,
    }
  );
  counts.issueCards = Math.max(counts.issueCards, issueCards.length);
  counts.verificationResults = Math.max(counts.verificationResults, verificationResults.length);
  counts.evidenceBlocks = Math.max(counts.evidenceBlocks, evidenceBlocks.length);
  const summaries = uniqueStrings(audits.map((audit) => audit.summary));
  return {
    protocol: uniqueStrings(audits.map((audit) => audit.protocol)).join(", "),
    stage: uniqueStrings(audits.map((audit) => audit.stage)).join(", "),
    adapter: uniqueStrings(audits.map((audit) => audit.adapter)).join(", "),
    providerChain: uniqueStrings(audits.flatMap((audit) => audit.providerChain || [])).slice(0, 5),
    summary:
      audits.length === 1
        ? summaries[0] || ""
        : `${audits.length} repository audit protocols are reporting structured evidence.`,
    logsSummary: audits.find((audit) => audit.logsSummary)?.logsSummary || "",
    counts,
    roles: uniqueStrings([
      ...audits.flatMap((audit) => audit.roles || []),
      ...evidenceBlocks.map((block) => block.role),
    ]).slice(0, 8),
    shards: uniqueStrings([
      ...audits.flatMap((audit) => audit.shards || []),
      ...evidenceBlocks.map((block) => block.shardId),
    ]).slice(0, 8),
    issueCards: [],
    verificationResults: [],
    evidenceBlocks,
  };
}

function scanAiUsageSummary(scans) {
  const usages = scans.map((scan) => scan?.aiUsage).filter(Boolean);
  if (!usages.length) return null;
  const models = uniqueStrings(usages.map((usage) => usage.model));
  const usage = {};
  if (models.length === 1) usage.model = models[0];
  else if (models.length > 1) usage.model = `${models.length} models`;
  return usage.model ? usage : null;
}

function hasAuditSwarm(audit) {
  if (!audit) return false;
  const counts = audit.counts || {};
  return Boolean(
    audit.protocol ||
    audit.stage ||
    audit.summary ||
    audit.roles?.length ||
    audit.shards?.length ||
    audit.evidenceBlocks?.length ||
    Object.values(counts).some((value) => Number(value || 0) > 0)
  );
}

function auditSwarmLocation(item) {
  const location = item?.location && typeof item.location === "object" ? item.location : {};
  const file = item?.file || location.file || "";
  const line = item?.startLine || item?.line || location.startLine || location.line || "";
  return file ? `${file}${line ? `:${line}` : ""}` : "";
}

function auditSwarmCountLabel(count, singular, plural) {
  const safePlural = plural || `${singular}s`;
  return `${count || 0} ${count === 1 ? singular : safePlural}`;
}

function AuditSwarmEvidence({ auditSwarm, className = "", onDownload = null, downloading = false }) {
  if (!hasAuditSwarm(auditSwarm)) return null;

  const rootClassName = ["scanning-audit", className].filter(Boolean).join(" ");
  const evidenceTotal = auditSwarm.counts.evidenceBlocks || 0;
  const stats = [
    { key: "candidates", value: auditSwarm.counts.candidateCount, label: T("Candidates", "候选") },
    { key: "reported", value: auditSwarm.counts.reportedCount, label: T("Reported", "已报告") },
    { key: "rejected", value: auditSwarm.counts.rejectedCount, label: T("Rejected", "已拒绝") },
    { key: "verified", value: auditSwarm.counts.verifiedCount, label: T("Verified", "已验证") },
  ].filter((s) => typeof s.value === "number");
  const showStats = stats.some((s) => s.value > 0);
  const handleEvidenceClick = () => {
    if (onDownload && evidenceTotal > 0) onDownload();
  };
  const evidenceInteractive = Boolean(onDownload) && evidenceTotal > 0;

  return (
    <div className={rootClassName}>
      <div className="audit-head">
        <span className="audit-head-icon">
          <I.Shield size={13} />
        </span>
        <span className="audit-head-t">{T("Audit evidence", "审计证据")}</span>
        {auditSwarm.protocol && <span className="audit-head-sub">{auditSwarm.protocol}</span>}
      </div>
      {auditSwarm.summary && (
        <div className="muted scan-preflight-summary">{auditSwarm.summary}</div>
      )}
      {showStats && (
        <div className="audit-stat-strip">
          {stats.map((s) => (
            <div key={s.key} className={"audit-stat" + (s.value > 0 ? "" : " audit-stat-empty")}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
      {evidenceTotal > 0 && (
        <button
          type="button"
          className={"audit-evidence-link" + (evidenceInteractive ? " is-interactive" : "")}
          onClick={handleEvidenceClick}
          disabled={!evidenceInteractive || downloading}
          aria-busy={downloading || undefined}
        >
          <span>
            {T(
              `${evidenceTotal} evidence blocks in the downloaded audit bundle`,
              `下载的审计包中包含 ${evidenceTotal} 个证据块`
            )}
          </span>
          <I.Download size={13} />
        </button>
      )}
      {auditSwarm.issueCards.length > 0 && (
        <div className="audit-section">
          <div className="audit-section-h">
            <span>{T("Issue cards", "问题卡片")}</span>
            <span className="audit-section-count">
              {auditSwarmCountLabel(
                auditSwarm.counts.issueCards,
                T("issue card", "张问题卡片"),
                T("issue cards", "张问题卡片")
              )}
            </span>
          </div>
          <div className="audit-card-list">
            {auditSwarm.issueCards.slice(0, 3).map((card, index) => {
              const location = auditSwarmLocation(card);
              return (
                <div key={card.issueId || `${card.title}-${index}`} className="audit-card">
                  <div className="audit-card-title">{card.title}</div>
                  <div className="audit-card-meta">
                    {card.severity && <span className="sev-mini">{card.severity}</span>}
                    {card.agentRole && <span>{card.agentRole}</span>}
                    {location && <span>{location}</span>}
                  </div>
                  {card.claim && (
                    <div className="audit-card-row">
                      <b>{T("Claim", "结论")}</b>
                      <span>{card.claim}</span>
                    </div>
                  )}
                  {card.evidence?.[0] && (
                    <div className="audit-card-row">
                      <b>{T("Evidence", "证据")}</b>
                      <span>{card.evidence[0]}</span>
                    </div>
                  )}
                  {card.falsePositiveChecks?.[0] && (
                    <div className="audit-card-row">
                      <b>{T("False +", "误报排除")}</b>
                      <span>{card.falsePositiveChecks[0]}</span>
                    </div>
                  )}
                  {card.suggestedTest && (
                    <div className="audit-card-row">
                      <b>{T("Test", "建议测试")}</b>
                      <span>{card.suggestedTest}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {auditSwarm.counts.issueCards > auditSwarm.issueCards.length && (
            <div className="audit-card-more">
              {T(
                `+${auditSwarm.counts.issueCards - auditSwarm.issueCards.length} more in the downloaded audit bundle`,
                `下载的审计包中还有 ${auditSwarm.counts.issueCards - auditSwarm.issueCards.length} 条`
              )}
            </div>
          )}
        </div>
      )}
      {auditSwarm.verificationResults.length > 0 && (
        <div className="audit-section">
          <div className="audit-section-h">
            <span>{T("Verifier results", "验证结果")}</span>
            <span className="audit-section-count">
              {auditSwarmCountLabel(
                auditSwarm.counts.verificationResults,
                T("verifier result", "条验证结果"),
                T("verifier results", "条验证结果")
              )}
            </span>
          </div>
          <div className="audit-card-list">
            {auditSwarm.verificationResults.slice(0, 3).map((result, index) => (
              <div
                key={`${result.issueId || "result"}-${result.verifierRole || index}`}
                className="audit-card"
              >
                <div className="audit-card-title">
                  {result.verdict || T("reviewed", "已审查")}
                  {result.verifierRole ? ` · ${result.verifierRole}` : ""}
                </div>
                {result.summary && (
                  <div className="audit-card-row">
                    <b>{T("Summary", "摘要")}</b>
                    <span>{result.summary}</span>
                  </div>
                )}
                {result.command && (
                  <div className="audit-card-row">
                    <b>{T("Command", "命令")}</b>
                    <code className="tag evidence-command">{result.command}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchPicker({ repoLabel, value, options, loading, error, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const minWidth = Math.max(rect.width, 140);
    const maxLeft = viewportWidth - minWidth - 8;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, maxLeft)),
      minWidth,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handlePointerDown = (event) => {
      const container = containerRef.current;
      const menu = menuRef.current;
      const target = event.target;
      if (container && container.contains(target)) return;
      if (menu && menu.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (triggerRef.current) triggerRef.current.focus();
      }
    };
    const handleScrollOrResize = () => updateMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  const handleSelect = (branch) => {
    if (branch === value) {
      setOpen(false);
      return;
    }
    onChange(branch);
    setOpen(false);
  };

  const pickerClass = "repo-branch-picker" + (error ? " repo-branch-error" : "");

  return (
    <span
      ref={containerRef}
      className={pickerClass}
      title={error || `Branch: ${value}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="repo-branch-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Branch for ${repoLabel}`}
        disabled={disabled}
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((prev) => !prev);
        }}
      >
        <I.GitBranch size={12} />
        <span className="repo-branch-value">{loading ? T("Loading...", "加载中...") : value}</span>
        <I.ChevD size={11} className="repo-branch-chev" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={menuRef}
          role="listbox"
          className="repo-branch-menu"
          aria-label={`Branches for ${repoLabel}`}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            minWidth: menuPos.minWidth,
          }}
        >
          {loading && (
            <li className="repo-branch-empty" role="presentation">
              {T("Loading branches...", "正在加载分支...")}
            </li>
          )}
          {!loading && options.length === 0 && (
            <li className="repo-branch-empty" role="presentation">
              {T("No branches available", "暂无分支")}
            </li>
          )}
          {!loading &&
            options.map((branch) => {
              const isSelected = branch === value;
              return (
                <li
                  key={branch}
                  role="option"
                  aria-selected={isSelected}
                  className={"repo-branch-option" + (isSelected ? " selected" : "")}
                  onClick={() => handleSelect(branch)}
                >
                  <I.GitBranch size={11} aria-hidden="true" />
                  <span className="repo-branch-option-label">{branch}</span>
                  {isSelected && (
                    <I.Check size={11} className="repo-branch-option-check" aria-hidden="true" />
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </span>
  );
}

export function ReposScreen({
  go,
  setActiveRepo,
  setIssue = null,
  authorizationError = "",
  clearAuthorizationError = () => {},
}) {
  useLang();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const [connectError, setConnectError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [checkingQuota, setCheckingQuota] = useState(false);
  const [quotaPreflight, setQuotaPreflight] = useState(null);
  const [quotaDialogSelected, setQuotaDialogSelected] = useState([]);
  const [quotaDialogNotice, setQuotaDialogNotice] = useState("");
  const [repoBranches, setRepoBranches] = useState({});
  const [selectedBranches, setSelectedBranches] = useState({});
  const {
    items: availableRepos,
    installations,
    installationAccounts,
    userQuota,
    loading,
    error,
    needsAuthorization,
    reload,
  } = useRepositories();
  const displayError = error || connectError || authorizationError;
  const hasInstallationDetails = Array.isArray(installations) && installations.length > 0;
  const allLabel = T("All", "所有");
  const orgs = useMemo(
    () => [
      allLabel,
      ...Array.from(
        new Set([...availableRepos.map(repoOwner), ...(installationAccounts || [])].filter(Boolean))
      ).map((owner) => `@${owner}`),
    ],
    [allLabel, availableRepos, installationAccounts]
  );
  const [org, setOrg] = useState(allLabel);
  const activeOwner = org?.startsWith("@") ? org.slice(1) : "";
  const query = q.trim().toLowerCase();
  const refreshGitHubRepositoryAccess = useCallback(async () => {
    await reload({ sync: true });
  }, [reload]);
  const repos = availableRepos.filter((repo) => {
    const matchesOrg = !activeOwner || repoOwner(repo) === activeOwner;
    const matchesQuery =
      !query ||
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      repo.desc.toLowerCase().includes(query);
    return matchesOrg && matchesQuery;
  });
  const accountQuotaRemaining = quotaRemaining(userQuota);
  const accountQuotaLabel = repoQuotaLabel(userQuota);
  const branchForRepo = useCallback(
    (repo) => {
      const key = repoBranchKey(repo);
      return (
        selectedBranches[key] ||
        repoBranches[key]?.defaultBranch ||
        repo?.branch ||
        repo?.defaultBranch ||
        "main"
      );
    },
    [repoBranches, selectedBranches]
  );
  const selectedRepoObjects = selected
    .map((id) => availableRepos.find((item) => item.id === id))
    .filter(Boolean)
    .map((repo) => ({ ...repo, branch: branchForRepo(repo) }));

  const loadRepoBranches = useCallback(
    async (repo) => {
      const key = repoBranchKey(repo);
      const apiId = repoBranchApiId(repo);
      if (!key || !apiId) return;
      const current = repoBranches[key];
      if (current?.loading || current?.branches?.length) return;
      const fallbackBranch = repo?.branch || repo?.defaultBranch || "main";
      setRepoBranches((state) => ({
        ...state,
        [key]: {
          branches: branchPayloadBranches(state[key], fallbackBranch),
          defaultBranch: state[key]?.defaultBranch || fallbackBranch,
          loading: true,
          error: "",
        },
      }));
      try {
        const payload = await pullwiseApi.repositories.branches(apiId);
        const branches = branchPayloadBranches(payload, fallbackBranch);
        const defaultBranch =
          cleanBranchList([payload?.defaultBranch])[0] || fallbackBranch || branches[0] || "main";
        setRepoBranches((state) => ({
          ...state,
          [key]: { branches, defaultBranch, loading: false, error: "" },
        }));
        setSelectedBranches((state) => ({
          ...state,
          [key]: branches.includes(state[key]) ? state[key] : defaultBranch,
        }));
      } catch (branchError) {
        setRepoBranches((state) => ({
          ...state,
          [key]: {
            branches: branchPayloadBranches(state[key], fallbackBranch),
            defaultBranch: fallbackBranch,
            loading: false,
            error: branchError?.message || "Unable to load branches.",
          },
        }));
      }
    },
    [repoBranches]
  );

  useEffect(() => {
    if (!orgs.includes(org)) setOrg(allLabel);
  }, [allLabel, org, orgs]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => availableRepos.some((repo) => repo.id === id)));
  }, [availableRepos]);

  useEffect(() => {
    const availableKeys = new Set(availableRepos.map(repoBranchKey).filter(Boolean));
    setSelectedBranches((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => availableKeys.has(key)))
    );
    setRepoBranches((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => availableKeys.has(key)))
    );
  }, [availableRepos]);

  useGitHubRepositoryAccessAutoRefresh(refreshGitHubRepositoryAccess);

  const runScanForRepos = async (reposToScan) => {
    if (!reposToScan.length) return;
    const selectedRepos = reposToScan.map((repo) => ({
      ...repo,
      scanRequestId: makeScanRequestId(),
    }));
    if (selectedRepos.length > 1) {
      const requests = selectedRepos
        .map(scanInputFromRepo)
        .filter((request) => request.repo || request.repoId);
      const results = await Promise.allSettled(
        requests.map((request) => pullwiseApi.scans.create(request))
      );
      const createdCount = results.filter((result) => result.status === "fulfilled").length;
      if (createdCount === 0) {
        const failed = results.find((result) => result.status === "rejected");
        throw failed?.reason || new Error(T("Unable to start scans.", "无法启动扫描。"));
      }
      go("history");
      return;
    }
    setActiveRepo({ ...selectedRepos[0], selectedRepos });
    go("scanning");
  };

  const toggle = (id) => {
    const isSelected = selected.includes(id);
    if (isSelected) {
      setSelected((current) => current.filter((item) => item !== id));
      setSelectionNotice("");
      return;
    }

    const repo = availableRepos.find((item) => item.id === id);
    const repoRemaining = quotaRemaining(repo?.quota);
    if (repoRemaining !== null && repoRemaining <= 0) {
      setSelectionNotice(repositoryQuotaNotice(repo));
      return;
    }
    if (accountQuotaRemaining !== null && selected.length >= accountQuotaRemaining) {
      setSelectionNotice(accountQuotaNotice(accountQuotaRemaining));
      return;
    }

    setSelectionNotice("");
    setSelected((current) => (current.includes(id) ? current : [...current, id]));
    loadRepoBranches(repo);
  };

  const activateRepositorySelection = (event, repoId) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle(repoId);
  };

  const visibleRepoIds = useMemo(() => repos.map((repo) => repo.id), [repos]);
  const visibleSelectedCount = useMemo(
    () => visibleRepoIds.reduce((sum, id) => sum + (selected.includes(id) ? 1 : 0), 0),
    [visibleRepoIds, selected]
  );
  const hasVisibleSelection = visibleSelectedCount > 0;
  const selectAllLabel = hasVisibleSelection
    ? T("Deselect all", "取消全选")
    : T("Select all", "全选");

  const toggleSelectAll = () => {
    if (repos.length === 0) return;
    if (hasVisibleSelection) {
      const visibleSet = new Set(visibleRepoIds);
      setSelected((current) => current.filter((id) => !visibleSet.has(id)));
      setSelectionNotice("");
      return;
    }
    const blocked = [];
    const next = [...selected];
    for (const repo of repos) {
      if (next.includes(repo.id)) continue;
      const repoRemaining = quotaRemaining(repo?.quota);
      if (repoRemaining !== null && repoRemaining <= 0) {
        blocked.push(repositoryQuotaNotice(repo));
        continue;
      }
      if (accountQuotaRemaining !== null && next.length >= accountQuotaRemaining) {
        blocked.push(accountQuotaNotice(accountQuotaRemaining));
        break;
      }
      next.push(repo.id);
      loadRepoBranches(repo);
    }
    setSelected(next);
    if (blocked.length > 0) {
      const head = blocked[0];
      const extra = blocked.length > 1 ? ` (+${blocked.length - 1})` : "";
      setSelectionNotice(`${head}${extra}`);
    } else {
      setSelectionNotice("");
    }
  };

  const startScan = async () => {
    if (checkingQuota) return;
    const reposToScan = selectedRepoObjects;
    if (reposToScan.length === 0) return;

    setCheckingQuota(true);
    setConnectError("");
    setSelectionNotice("");
    clearAuthorizationError();
    try {
      const preflight = await pullwiseApi.scans.preflight({
        repositories: reposToScan.map(scanInputFromRepo),
      });
      const allowedCount = preflightAllowedCount(preflight, reposToScan.length);
      if (allowedCount < reposToScan.length) {
        const remaining = quotaRemaining(preflight?.userQuota);
        const notice =
          remaining !== null && remaining < reposToScan.length
            ? T(
                `Your account currently has ${remaining} ${scansWord(remaining)} left. Choose up to ${allowedCount} repositories to scan now.`,
                `此账户当前剩余 ${remaining} ${scansWord(remaining)}。请最多选择 ${allowedCount} 个仓库进行扫描。`
              )
            : T(
                `Only ${allowedCount} of these repositories can be scanned right now based on current quota. Choose which repositories to scan.`,
                `根据当前配额，现在只能扫描这些仓库中的 ${allowedCount} 个。请选择要扫描的仓库。`
              );
        setQuotaPreflight({ ...preflight, selectedRepos: reposToScan });
        setQuotaDialogSelected([]);
        setQuotaDialogNotice(notice);
        return;
      }
      await runScanForRepos(reposToScan);
    } catch (scanError) {
      setConnectError(
        scanError?.message ||
          T(
            "Unable to start scan. Check quota and repository access, then try again.",
            "无法启动扫描。请检查配额和仓库访问权限后重试。"
          )
      );
    } finally {
      setCheckingQuota(false);
    }
  };

  const quotaDialogRepos = Array.isArray(quotaPreflight?.selectedRepos)
    ? quotaPreflight.selectedRepos
    : [];
  const quotaDialogAllowed = preflightAllowedCount(quotaPreflight, quotaDialogRepos.length);
  const quotaDialogRows = preflightRows(quotaPreflight);
  const quotaDialogCanConfirm =
    quotaDialogSelected.length > 0 && quotaDialogSelected.length <= quotaDialogAllowed;

  const closeQuotaDialog = () => {
    setQuotaPreflight(null);
    setQuotaDialogSelected([]);
    setQuotaDialogNotice("");
  };

  const toggleQuotaDialogRepo = (repo) => {
    const row = preflightRowForRepo(quotaDialogRows, repo);
    if (row?.available === false) {
      setQuotaDialogNotice(
        row.reason === "repository_quota_exceeded"
          ? repositoryQuotaNotice(repo)
          : T(
              "This repository cannot be scanned with the current GitHub authorization.",
              "此仓库无法使用当前 GitHub 授权进行扫描。"
            )
      );
      return;
    }
    if (quotaDialogSelected.includes(repo.id)) {
      setQuotaDialogSelected((current) => current.filter((item) => item !== repo.id));
      return;
    }
    if (quotaDialogSelected.length >= quotaDialogAllowed) {
      setQuotaDialogNotice(
        T(
          `You can choose ${quotaDialogAllowed} ${scansWord(quotaDialogAllowed)} because that is the current effective quota.`,
          `当前有效配额下，你只能选择 ${quotaDialogAllowed} ${scansWord(quotaDialogAllowed)}。`
        )
      );
      return;
    }
    setQuotaDialogSelected((current) => [...current, repo.id]);
  };

  const confirmQuotaDialogSelection = async () => {
    if (!quotaDialogCanConfirm) return;
    const reposToScan = quotaDialogRepos.filter((repo) => quotaDialogSelected.includes(repo.id));
    closeQuotaDialog();
    setCheckingQuota(true);
    setConnectError("");
    try {
      await runScanForRepos(reposToScan);
    } catch (scanError) {
      setConnectError(
        scanError?.message ||
          T(
            "Unable to start scan. Check quota and repository access, then try again.",
            "无法启动扫描。请检查配额和仓库访问权限后重试。"
          )
      );
    } finally {
      setCheckingQuota(false);
    }
  };

  const connectRepositories = async (options = {}) => {
    if (connecting) return;
    setConnecting(true);
    setConnectError("");
    clearAuthorizationError();
    try {
      await connectGitHubRepositories(options);
      await reload({ sync: true });
    } catch (authError) {
      setConnectError(
        authError?.message ||
          T(
            "Unable to connect GitHub repository access.",
            "无法连接 GitHub 仓库访问。"
          )
      );
    } finally {
      setConnecting(false);
    }
  };

  const manageInstallation = async (installation) => {
    if (managingInstallationId) return;
    const targetInstallationId = installation?.id || installation?.installationId;
    setManagingInstallationId(targetInstallationId || "");
    setConnectError("");
    clearAuthorizationError();
    try {
      await manageGitHubInstallation(targetInstallationId, {
        githubIdentityId: installation?.manage?.githubIdentityId || undefined,
      });
      await reload();
    } catch (authError) {
      setConnectError(
        authError?.message || T("Unable to manage GitHub installation.", "无法管理 GitHub 安装。")
      );
    } finally {
      setManagingInstallationId("");
    }
  };

  const activateConnectRepositories = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    connectRepositories();
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Repositories", "仓库") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="repos" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Choose repositories to scan", "选择要扫描的仓库")}</h1>
              {(needsAuthorization || !hasInstallationDetails) && (
                <div className="sub">
                  {needsAuthorization
                    ? T(
                        "GitHub repository access is not connected yet.",
                        "尚未连接 GitHub 仓库权限。"
                      )
                    : T(
                        `${availableRepos.length} authorized repos`,
                        `${availableRepos.length} 个已授权仓库`
                      )}
                </div>
              )}
              {accountQuotaLabel && (
                <div className="sub account-quota-summary">
                  {T("Account quota", "账户配额")}: {accountQuotaLabel}
                </div>
              )}
            </div>
            <div className="actions">
              <button className="btn" disabled={loading} onClick={() => reload({ sync: true })}>
                <I.Refresh size={14} /> {T("Sync", "同步")}
              </button>
              <button
                className="btn primary"
                disabled={selected.length === 0 || checkingQuota}
                onClick={startScan}
              >
                {checkingQuota ? (
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={12} />
                  </span>
                ) : (
                  <I.Play size={12} />
                )}{" "}
                {checkingQuota ? T("Checking quota", "正在检查配额") : T("Start scan", "开始扫描")}{" "}
                ({selected.length})
              </button>
            </div>
          </div>

          {!needsAuthorization && hasInstallationDetails && (
            <GitHubInstallationsList
              installations={installations}
              onManage={manageInstallation}
              managingInstallationId={managingInstallationId}
            />
          )}

          <div className="repos-toolbar">
            <div className="repos-toolbar-row">
              <div className="repos-search">
                <I.Search size={14} />
                <input
                  placeholder={T("Search repositories...", "搜索仓库...")}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn repos-select-all"
                onClick={toggleSelectAll}
                disabled={repos.length === 0}
                aria-pressed={hasVisibleSelection}
                aria-label={
                  hasVisibleSelection
                    ? T("Deselect all visible repositories", "取消全选可见仓库")
                    : T("Select all visible repositories", "全选可见仓库")
                }
                title={
                  hasVisibleSelection
                    ? T("Deselect all visible repositories", "取消全选可见仓库")
                    : T("Select all visible repositories", "全选可见仓库")
                }
              >
                {hasVisibleSelection ? (
                  <I.X size={12} />
                ) : (
                  <I.Check size={12} />
                )}
                {selectAllLabel}
                {hasVisibleSelection ? (
                  visibleSelectedCount > 0 && (
                    <span className="repos-select-all-count">
                      ({visibleSelectedCount})
                    </span>
                  )
                ) : (
                  visibleRepoIds.length > 0 && (
                    <span className="repos-select-all-count">
                      ({visibleRepoIds.length})
                    </span>
                  )
                )}
              </button>
            </div>
            <div className="repos-orgs">
              {orgs.map((item) => (
                <button
                  key={item}
                  className={"repos-org" + (org === item ? " active" : "")}
                  onClick={() => setOrg(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="repos-list">
            {selectionNotice && (
              <div className="repo-row repo-row-status quota-selection-alert" role="alert">
                <div className="repo-icon">
                  <I.Activity size={16} />
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{T("Scan quota limit", "扫描配额限制")}</span>
                  </div>
                  <div className="repo-desc">{selectionNotice}</div>
                </div>
              </div>
            )}
            {needsAuthorization && (
              <div
                className="repo-row repo-row-status"
                role="button"
                tabIndex={0}
                onClick={() => connectRepositories()}
                onKeyDown={activateConnectRepositories}
              >
                <div className="repo-icon">
                  {connecting ? (
                    <span className="spin" style={{ display: "inline-block" }}>
                      <I.Refresh size={16} />
                    </span>
                  ) : (
                    <I.Github size={16} />
                  )}
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>
                      {connecting
                        ? T("Opening GitHub...", "Opening GitHub...")
                        : T("Connect GitHub repositories", "连接 GitHub 仓库")}
                    </span>
                  </div>
                  <div className="repo-desc">
                    {T(
                      "Choose the repositories Pullwise can read for this scan.",
                      "选择 Pullwise 可只读访问并扫描的仓库。"
                    )}
                  </div>
                </div>
                <I.ArrowR size={14} />
              </div>
            )}
            {displayError && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon">
                  <I.X size={16} />
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{T("Unable to load repositories", "无法加载仓库")}</span>
                  </div>
                  <div className="repo-desc">{displayError}</div>
                </div>
              </div>
            )}
            {loading && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon">
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={16} />
                  </span>
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{T("Loading repositories", "正在加载仓库")}</span>
                  </div>
                  <div className="repo-desc">
                    {T("Reading GitHub App authorization.", "正在读取 GitHub App 授权。")}
                  </div>
                </div>
              </div>
            )}
            {!loading && !error && !needsAuthorization && repos.length === 0 && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon">
                  <I.Folder size={16} />
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{T("No authorized repositories", "没有已授权仓库")}</span>
                  </div>
                  <div className="repo-desc">
                    {T(
                      "Authorize repositories in GitHub, then sync again.",
                      "请先在 GitHub 授权仓库，然后重新同步。"
                    )}
                  </div>
                </div>
              </div>
            )}
            {repos.map((repo) => {
              const on = selected.includes(repo.id);
              const quotaLabel = repoQuotaLabel(repo.quota);
              const quotaEmpty = repo.quota && quotaNumber(repo.quota.remaining) <= 0;
              const repoLabel = repo.fullName || repo.name;
              const branchKey = repoBranchKey(repo);
              const branchState = repoBranches[branchKey] || null;
              const selectedBranch = branchForRepo(repo);
              const branchOptions = branchState?.branches?.length
                ? branchState.branches
                : [selectedBranch].filter(Boolean);
              const languageColorKey = repoLanguageColorKey(repo.lang);
              return (
                <div
                  key={repo.id}
                  className={"repo-row" + (on ? " on" : "")}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`Select repository ${repoLabel}`}
                  onClick={() => toggle(repo.id)}
                  onKeyDown={(event) => activateRepositorySelection(event, repo.id)}
                >
                  <div className="repo-check">
                    <span className="repo-check-box">{on && <I.Check size={11} />}</span>
                  </div>
                  <div className="repo-icon">
                    <I.Folder size={16} />
                  </div>
                  <div className="repo-main">
                    <div className="repo-name">
                      <span>{repo.fullName || repo.name}</span>
                      {repo.private && (
                        <span className="tag">
                          <I.Lock size={10} /> private
                        </span>
                      )}
                    </div>
                    <div className="repo-desc">{repo.desc}</div>
                  </div>
                  <div className="repo-meta">
                    {on ? (
                      <BranchPicker
                        repoLabel={repoLabel}
                        value={selectedBranch}
                        options={branchOptions}
                        loading={!!branchState?.loading}
                        error={branchState?.error || ""}
                        disabled={!!branchState?.loading}
                        onChange={(nextBranch) => {
                          setSelectedBranches((current) => ({
                            ...current,
                            [branchKey]: nextBranch,
                          }));
                        }}
                      />
                    ) : (
                      <span
                        className="repo-branch-picker repo-branch-placeholder"
                        aria-hidden="true"
                      >
                        <span className="repo-branch-trigger">
                          <I.GitBranch size={12} />
                          <span className="repo-branch-value">{selectedBranch}</span>
                          <I.ChevD size={11} className="repo-branch-chev" />
                        </span>
                      </span>
                    )}
                    <span className="repo-meta-lang">
                      <span
                        className="lang-dot"
                        data-lang-color={languageColorKey}
                        style={{ "--repo-lang-color": repoLanguageColor(languageColorKey) }}
                      ></span>{" "}
                      {repo.lang}
                    </span>
                    <span>
                      <I.Star size={12} /> {repo.stars}
                    </span>
                    <span>
                      <I.GitBranch size={12} /> {repo.branches}
                    </span>
                    <span>
                      <I.Clock size={12} /> {repo.updated}
                    </span>
                    {quotaLabel && (
                      <span className={"repo-quota" + (quotaEmpty ? " empty" : "")}>
                        <I.Activity size={12} /> {quotaLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="repos-foot">
            <span className="muted">
              {T("Missing a repository? ", "缺少仓库？")}
              <button
                type="button"
                className="auth-link"
                onClick={() => connectRepositories({ add: true })}
              >
                {T("Add GitHub account or organization", "添加 GitHub 账号或组织")}
              </button>
            </span>
          </div>
        </div>
      </div>
      {quotaPreflight && (
        <div className="quota-modal-back">
          <div
            className="quota-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-dialog-title"
          >
            <div className="modal-h">
              <div>
                <h2 id="quota-dialog-title">{T("Choose repositories to scan", "选择要扫描的仓库")}</h2>
                <p>{quotaDialogNotice}</p>
              </div>
              <button className="btn ghost icon" type="button" onClick={closeQuotaDialog}>
                <I.X size={14} />
              </button>
            </div>
            <div className="quota-choice-count">
              {T(
                `${quotaDialogSelected.length} of ${quotaDialogAllowed} selected`,
                `已选 ${quotaDialogSelected.length} / ${quotaDialogAllowed}`
              )}
            </div>
            <div className="quota-choice-list">
              {quotaDialogRepos.map((repo) => {
                const row = preflightRowForRepo(quotaDialogRows, repo);
                const on = quotaDialogSelected.includes(repo.id);
                const unavailable = row?.available === false || quotaDialogAllowed <= 0;
                const quotaLabel = repoQuotaLabel(row?.repoQuota || row?.quota || repo.quota);
                return (
                  <button
                    key={repo.id}
                    type="button"
                    className={
                      "quota-choice-row" + (on ? " on" : "") + (unavailable ? " unavailable" : "")
                    }
                    aria-pressed={on}
                    onClick={() => toggleQuotaDialogRepo(repo)}
                    disabled={unavailable}
                  >
                    <span className="repo-check-box">{on && <I.Check size={11} />}</span>
                    <span className="quota-choice-copy">
                      <strong>{repo.fullName || repo.name}</strong>
                      <span>
                        {quotaLabel ||
                          repo.desc ||
                          T("Authorized repository", "已授权仓库")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="modal-foot">
              {quotaDialogAllowed <= 0 && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    closeQuotaDialog();
                    go("billing");
                  }}
                >
                  <I.Activity size={14} /> {T("Open billing", "打开账单")}
                </button>
              )}
              <button className="btn ghost" type="button" onClick={closeQuotaDialog}>
                {T("Cancel", "取消")}
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!quotaDialogCanConfirm}
                onClick={confirmQuotaDialogSelection}
              >
                <I.Play size={12} /> {T("Scan selected", "扫描所选")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PRODUCTION_SCAN_PHASES = [
  {
    k: "clone",
    t_en: "Cloning repository",
    t_zh: "克隆仓库",
    d_en: "Checking out the requested ref",
    d_zh: "检出请求的分支或 commit",
  },
  {
    k: "index",
    t_en: "Repository preflight",
    t_zh: "仓库预检",
    d_en: "Capturing manifests, tools, and verifier output",
    d_zh: "采集清单、工具版本和验证器输出",
  },
  {
    k: "ai",
    t_en: "Audit Swarm review",
    t_zh: "Audit Swarm 审计",
    d_en: "Reviewer agents evaluate and verify candidates",
    d_zh: "reviewer agents 评估并验证候选问题",
  },
  {
    k: "report",
    t_en: "Uploading report",
    t_zh: "上传报告",
    d_en: "Persisting findings and audit evidence",
    d_zh: "保存 findings 和审计证据",
  },
];

const LEGACY_SCAN_PHASES = [
  ...PRODUCTION_SCAN_PHASES.slice(0, 2),
  {
    k: "secrets",
    t_en: "Scanning for secrets",
    t_zh: "扫描密钥泄露",
    d_en: "Legacy local scan phase",
    d_zh: "旧版本地扫描阶段",
  },
  {
    k: "deps",
    t_en: "Analyzing dependencies",
    t_zh: "分析依赖",
    d_en: "Legacy local scan phase",
    d_zh: "旧版本地扫描阶段",
  },
  ...PRODUCTION_SCAN_PHASES.slice(2),
];

const LEGACY_ONLY_SCAN_PHASE_KEYS = new Set(["secrets", "deps"]);
const SCAN_PHASE_BY_KEY = new Map(LEGACY_SCAN_PHASES.map((phase) => [phase.k, phase]));
const EMPTY_REPOSITORY_GRAPH_ITEMS = Object.freeze([]);

function scanPhaseDefinition(phase) {
  return SCAN_PHASE_BY_KEY.get(phase);
}

function scanPhasesForPhase(phase) {
  return LEGACY_ONLY_SCAN_PHASE_KEYS.has(phase) ? LEGACY_SCAN_PHASES : PRODUCTION_SCAN_PHASES;
}

function graphCountLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function repositoryGraphElementsKey(nodes, edges) {
  const nodeKeys = nodes
    .map((node) => [
      node.id,
      node.label || node.path || node.id,
      node.type || "file",
      node.line || 0,
    ])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  const edgeKeys = edges
    .map((edge) => [
      edge.id,
      edge.source,
      edge.target,
      edge.type,
      edge.weight || 1,
    ])
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return JSON.stringify({ nodes: nodeKeys, edges: edgeKeys });
}

function repositoryGraphTypeLabel(type) {
  const labels = {
    class: "Classes",
    component: "Components",
    entrypoint: "Entrypoints",
    file: "Files",
    function: "Functions",
    manifest: "Manifests",
    method: "Methods",
    module: "Modules",
    route: "Routes",
    test: "Tests",
    variable: "Variables",
    workflow: "Workflows",
  };
  return labels[type] || type;
}

function GraphMenuPicker({
  className = "",
  triggerClassName = "",
  triggerIcon = null,
  triggerLabel,
  ariaLabel,
  width = 180,
  multiSelect = false,
  options,
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const minWidth = Math.max(rect.width, width);
    const maxLeft = viewportWidth - minWidth - 8;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, maxLeft)),
      minWidth,
    });
  }, [width]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handlePointerDown = (event) => {
      const container = containerRef.current;
      const menu = menuRef.current;
      const target = event.target;
      if (container && container.contains(target)) return;
      if (menu && menu.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (triggerRef.current) triggerRef.current.focus();
      }
    };
    const handleScrollOrResize = () => updateMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  return (
    <span
      ref={containerRef}
      className={`graph-menu-picker ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`graph-menu-trigger ${triggerClassName}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((prev) => !prev);
        }}
      >
        {triggerIcon}
        <span className="graph-menu-trigger-label">{triggerLabel}</span>
        <I.ChevD size={11} className="graph-menu-chev" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={menuRef}
          role="listbox"
          aria-multiselectable={multiSelect || undefined}
          className="graph-menu"
          aria-label={ariaLabel}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            minWidth: menuPos.minWidth,
          }}
        >
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={!!option.selected}
              className={"graph-menu-option" + (option.selected ? " selected" : "")}
              onClick={() => {
                option.onSelect();
                if (!multiSelect) setOpen(false);
              }}
            >
              {option.icon ? (
                <span className="graph-menu-option-icon" aria-hidden="true">
                  {option.icon}
                </span>
              ) : null}
              <span className="graph-menu-option-label">{option.label}</span>
              {option.selected ? (
                <I.Check size={11} className="graph-menu-option-check" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

function graphTypeFilterLabel(activeCount, totalCount) {
  if (!totalCount) return T("No types", "No types");
  if (activeCount === 0 || activeCount === totalCount) {
    return T("All types", "All types");
  }
  return T(`${activeCount} of ${totalCount} types`, `${activeCount} / ${totalCount} 个类型`);
}

function RepositoryGraphPanel({ graph, semanticGraph }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const cytoscapeElementCacheRef = useRef({ key: "", elements: [] });
  const fileGraph = graph && Array.isArray(graph.nodes) ? graph : null;
  const codeGraph = semanticGraph && Array.isArray(semanticGraph.nodes) ? semanticGraph : null;
  const [activeView, setActiveView] = useState(() => (fileGraph ? "files" : "code"));
  const activeGraph = activeView === "code" && codeGraph ? codeGraph : fileGraph || codeGraph;
  const nodes = Array.isArray(activeGraph?.nodes) ? activeGraph.nodes : EMPTY_REPOSITORY_GRAPH_ITEMS;
  const edges = Array.isArray(activeGraph?.edges) ? activeGraph.edges : EMPTY_REPOSITORY_GRAPH_ITEMS;
  const activeStats = activeGraph?.stats || {};
  const typeList = useMemo(
    () => [...new Set(nodes.map((node) => node.type).filter(Boolean))].sort(),
    [nodes]
  );
  const typeKey = typeList.join("|");
  const [activeTypes, setActiveTypes] = useState(() => new Set(typeList));
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id || "");

  useEffect(() => {
    if (activeView === "files" && !fileGraph && codeGraph) setActiveView("code");
    if (activeView === "code" && !codeGraph && fileGraph) setActiveView("files");
  }, [activeView, codeGraph, fileGraph]);

  useEffect(() => {
    setActiveTypes(new Set(typeKey ? typeKey.split("|") : []));
  }, [activeView, typeKey]);

  useEffect(() => {
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(nodes[0]?.id || "");
    }
  }, [activeView, nodes, selectedNodeId]);

  const visibleNodes = useMemo(
    () => nodes.filter((node) => activeTypes.size === 0 || activeTypes.has(node.type)),
    [activeTypes, nodes]
  );
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [edges, visibleNodeIds]
  );
  const cytoscapeElementKey = useMemo(
    () => repositoryGraphElementsKey(visibleNodes, visibleEdges),
    [visibleEdges, visibleNodes]
  );
  const cytoscapeElements = useMemo(() => {
    if (cytoscapeElementCacheRef.current.key === cytoscapeElementKey) {
      return cytoscapeElementCacheRef.current.elements;
    }
    const elements = [
      ...visibleNodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label || node.path || node.id,
          type: node.type || "file",
          line: node.line || 0,
        },
      })),
      ...visibleEdges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.type,
          weight: edge.weight || 1,
        },
      })),
    ];
    cytoscapeElementCacheRef.current = { key: cytoscapeElementKey, elements };
    return elements;
  }, [cytoscapeElementKey, visibleEdges, visibleNodes]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || visibleNodes[0] || null;
  const reviewHints = Array.isArray(activeGraph?.reviewHints)
    ? activeGraph.reviewHints
    : Array.isArray(graph?.architectureSummary?.reviewHints)
    ? graph.architectureSummary.reviewHints
    : [];
  const viewIsCode = activeView === "code" && Boolean(codeGraph);

  useEffect(() => {
    if (!containerRef.current || cytoscapeElements.length === 0) return undefined;
    const cy = cytoscape({
      container: containerRef.current,
      elements: cytoscapeElements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#2563eb",
            "border-color": "#eff6ff",
            "border-width": 1,
            color: "#0f172a",
            content: "data(label)",
            "font-size": 10,
            height: 18,
            label: "data(label)",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.82,
            "text-background-padding": 2,
            "text-valign": "bottom",
            "text-wrap": "wrap",
            width: 18,
          },
        },
        { selector: 'node[type = "entrypoint"]', style: { "background-color": "#16a34a", height: 24, width: 24 } },
        { selector: 'node[type = "module"]', style: { "background-color": "#7c3aed" } },
        { selector: 'node[type = "test"]', style: { "background-color": "#d97706" } },
        { selector: 'node[type = "workflow"]', style: { "background-color": "#0891b2" } },
        { selector: 'node[type = "route"]', style: { "background-color": "#dc2626", height: 24, width: 24 } },
        { selector: 'node[type = "component"]', style: { "background-color": "#16a34a", height: 22, width: 22 } },
        { selector: 'node[type = "class"]', style: { "background-color": "#7c3aed" } },
        { selector: 'node[type = "function"]', style: { "background-color": "#2563eb" } },
        { selector: 'node[type = "method"]', style: { "background-color": "#0891b2" } },
        { selector: 'node[type = "variable"]', style: { "background-color": "#64748b" } },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            width: 1.2,
          },
        },
      ],
      layout: { name: viewIsCode ? "cose" : "breadthfirst", directed: true, padding: 18, spacingFactor: 1.1 },
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });
    cy.on("tap", "node", (event) => setSelectedNodeId(event.target.id()));
    cyRef.current = cy;
    cy.layout({ name: viewIsCode ? "cose" : "breadthfirst", directed: true, padding: 18, spacingFactor: 1.1 }).run();
    return () => {
      cyRef.current = null;
      cy.destroy();
    };
  }, [cytoscapeElements, viewIsCode]);

  if (!nodes.length) return null;

  const toggleType = (type) => {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="repository-graph">
      <div className="repository-graph-head">
        <div className="scanning-counts-h">
          <I.Layers size={14} /> {viewIsCode ? T("Semantic graph", "Semantic graph") : T("Repository graph", "Repository graph")}
        </div>
        <div className="repository-graph-stats">
          <span>{graphCountLabel(nodes.length, viewIsCode ? "symbol" : "node")}</span>
          <span>{graphCountLabel(edges.length, viewIsCode ? "relationship" : "edge")}</span>
          {viewIsCode && activeStats.source && <span>{activeStats.source}</span>}
          {activeStats.truncated && <span>{T("capped", "capped")}</span>}
          <button
            type="button"
            className="btn ghost sm repository-graph-fit"
            onClick={() => cyRef.current?.fit(undefined, 24)}
          >
            <I.Grid size={12} /> {T("Fit graph", "Fit graph")}
          </button>
        </div>
      </div>
      {(fileGraph && codeGraph) || typeList.length > 1 ? (
        <div className="repository-graph-controls" aria-label={T("Repository graph controls", "Repository graph controls")}>
          {fileGraph && codeGraph && (
            <GraphMenuPicker
              className="repository-graph-view-picker"
              triggerClassName="repository-graph-view-trigger"
              triggerIcon={
                activeView === "code" ? <I.Code size={12} aria-hidden="true" /> : <I.FileCode size={12} aria-hidden="true" />
              }
              triggerLabel={
                activeView === "code"
                  ? T("Semantic graph", "Semantic graph")
                  : T("File graph", "File graph")
              }
              ariaLabel={T("Graph view", "Graph view")}
              width={160}
              options={[
                {
                  value: "files",
                  label: T("File graph", "File graph"),
                  icon: <I.FileCode size={11} aria-hidden="true" />,
                  selected: activeView === "files",
                  onSelect: () => setActiveView("files"),
                },
                {
                  value: "code",
                  label: T("Semantic graph", "Semantic graph"),
                  icon: <I.Code size={11} aria-hidden="true" />,
                  selected: activeView === "code",
                  onSelect: () => setActiveView("code"),
                },
              ]}
            />
          )}
          {typeList.length > 1 && (
            <GraphMenuPicker
              className="repository-graph-type-picker"
              triggerClassName="repository-graph-type-trigger"
              triggerIcon={<I.Filter size={12} aria-hidden="true" />}
              triggerLabel={graphTypeFilterLabel(activeTypes.size, typeList.length)}
              ariaLabel={T("Node type filter", "Node type filter")}
              width={200}
              multiSelect
              options={typeList.map((type) => ({
                value: type,
                label: repositoryGraphTypeLabel(type),
                selected: activeTypes.has(type),
                onSelect: () => toggleType(type),
              }))}
            />
          )}
        </div>
      ) : null}
      <div
        className="repository-graph-canvas"
        ref={containerRef}
        role="img"
        aria-label={viewIsCode ? T("Code semantic graph", "Code semantic graph") : T("Repository dependency graph", "Repository dependency graph")}
      />
      <div className="repository-graph-node-list" aria-label={T("Repository graph nodes", "Repository graph nodes")}>
        {visibleNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`repository-graph-node${selectedNode?.id === node.id ? " active" : ""}`}
            onClick={() => setSelectedNodeId(node.id)}
          >
            <span>{node.label || node.path || node.id}</span>
            <small>{node.type}</small>
          </button>
        ))}
      </div>
      {selectedNode && (
        <div className="repository-graph-details">
          <b>{selectedNode.signature || selectedNode.label || selectedNode.path}</b>
          <span>{selectedNode.path}{selectedNode.line ? `:${selectedNode.line}` : ""}</span>
          <span className="tag">{selectedNode.type}</span>
        </div>
      )}
      {reviewHints.length > 0 && (
        <div className="repository-graph-hints">
          {reviewHints.slice(0, 3).map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScanningScreen({ go, activeRepo, setIssue = null, onScanResolved = null }) {
  useLang();
  const [logs, setLogs] = useState([]);
  const [bundleLoading, setBundleLoading] = useState(false);
  const resolvedScanIdRef = useRef("");
  const selectedRepos = useMemo(
    () => (Array.isArray(activeRepo?.selectedRepos) ? activeRepo.selectedRepos : []),
    [activeRepo?.selectedRepos]
  );
  const batchMode = selectedRepos.length > 1;
  const singleRepo = selectedRepos.length === 1 ? selectedRepos[0] : activeRepo;
  const initialScan = singleRepo?.initialScan || null;
  const scanId = singleRepo?.scanId || "";
  const singleScanInput = scanInputFromRepo(singleRepo);
  const repoId = singleScanInput.repoId || initialScan?.repoId || "";
  const repoFullName = singleScanInput.repo || initialScan?.repo || "";
  const branch = singleScanInput.branch || initialScan?.branch || "main";
  const commit = singleScanInput.commit || initialScan?.commit || "pending";
  const requestId = singleScanInput.requestId || "";
  const batchRepositories = useMemo(() => {
    if (!batchMode) return [];
    return selectedRepos.map(scanInputFromRepo).filter((request) => request.repo || request.repoId);
  }, [batchMode, selectedRepos]);

  const singleRun = useScanRun({
    repoId: batchMode ? "" : repoId,
    repo: batchMode ? "" : repoFullName,
    branch,
    commit,
    requestId,
    scanId: batchMode ? "" : scanId,
    initialScan: batchMode ? null : initialScan,
  });
  const batchRun = useScanBatchRun({ repositories: batchRepositories });
  const scans = batchMode ? batchRun.scans : singleRun.scan ? [singleRun.scan] : [];
  const batchRows = batchMode ? batchRun.batchResults || [] : [];
  const scan = batchMode
    ? scans.find((item) => !isTerminalScan(item)) || scans[0] || null
    : singleRun.scan;
  const error = batchMode ? batchRun.error : singleRun.error;
  const errorCode = batchMode ? batchRun.errorCode : singleRun.errorCode;
  const cancel = batchMode ? batchRun.cancel : singleRun.cancel;

  // Append a log line whenever the worker advances to a new phase.
  useEffect(() => {
    const phase = scan?.phase;
    if (!phase) return;
    const def = scanPhaseDefinition(phase);
    if (!def) return;
    setLogs((prev) => {
      const stamp = new Date().toLocaleTimeString();
      const line = `[${stamp}] ${T(def.t_en, def.t_zh)}`;
      if (prev.length && prev[prev.length - 1] === line) return prev;
      return [...prev.slice(-9), line];
    });
  }, [scan?.phase]);

  useEffect(() => {
    if (batchMode || !scan?.id || typeof onScanResolved !== "function") return;
    if (resolvedScanIdRef.current === scan.id) return;
    resolvedScanIdRef.current = scan.id;
    onScanResolved(scan);
  }, [batchMode, scan, onScanResolved]);

  const expectedBatchCount = batchRepositories.length;
  const status = batchMode
    ? batchScanStatus(scans, expectedBatchCount, Boolean(error))
    : scan?.status || (error ? "failed" : repoFullName ? "queued" : "no_repo");
  const progress = batchMode
    ? expectedBatchCount
      ? scans.reduce((sum, item) => sum + Number(item?.progress || 0), 0) / expectedBatchCount
      : 0
    : typeof scan?.progress === "number"
      ? scan.progress
      : 0;
  const currentPhase =
    scan?.phase || (status === "queued" ? null : status === "done" ? "report" : "clone");
  const scanPhases = scanPhasesForPhase(currentPhase);
  const phaseIdx = currentPhase ? scanPhases.findIndex((p) => p.k === currentPhase) : -1;
  const found = batchMode
    ? scanIssueTotals(scans)
    : scan?.issues || { critical: 0, high: 0, medium: 0, low: 0 };
  const preflight = batchMode
    ? scanPreflightSummary(scans)
    : scanPreflightSummary(scan ? [scan] : []);
  const auditSwarm = scanAuditSwarmSummary(scans);
  const repositoryGraph = batchMode ? null : scan?.repositoryGraph || null;
  const semanticGraph = batchMode ? null : scan?.semanticGraph || null;
  const aiUsage = batchMode ? scanAiUsageSummary(scans) : scan?.aiUsage || null;
  const terminal = batchMode
    ? expectedBatchCount > 0 &&
      batchRows.length === expectedBatchCount &&
      batchRows.every(isTerminalBatchRow)
    : isTerminalScan(scan);
  const auditSwarmPhaseIndex = scanPhases.findIndex((phase) => phase.k === "ai");
  const auditSwarmReviewComplete = auditSwarmPhaseIndex >= 0 && phaseIdx > auditSwarmPhaseIndex;
  const queueSummary = scanQueueSummary(scan);
  const canCancel = batchMode
    ? scans.some((item) => item?.id && !isTerminalScan(item))
    : Boolean(scan && !terminal);
  const errorAction = error ? scanErrorAction({ message: error, code: errorCode }) : null;
  const publicError = error ? publicScanErrorMessage(error) : "";
  const batchSummary = batchMode
    ? batchCreationSummary(batchRows, scans, expectedBatchCount)
    : null;

  const handleCancel = async () => {
    if (canCancel) await cancel();
    go("history");
  };
  const handleBack = () => {
    go("history");
  };

  const handleDownloadBundle = async () => {
    const targetScanId = batchMode ? "" : scanId;
    if (!targetScanId || bundleLoading || !auditSwarmReviewComplete) return;
    setBundleLoading(true);
    try {
      const bundle = await pullwiseApi.scans.auditBundleArchive(targetScanId);
      downloadBlob(`pullwise-audit-${targetScanId}.zip`, bundle, "application/zip");
    } catch (error) {
      globalThis.alert?.(
        error?.message || T("Unable to download audit bundle.", "无法下载审计包。")
      );
    } finally {
      setBundleLoading(false);
    }
  };

  const headerLabel =
    status === "done"
      ? batchMode
        ? T("Scan batch complete", "批量扫描完成")
        : T("Scan complete", "扫描完成")
      : status === "failed"
        ? batchMode
          ? T("Scan batch failed", "批量扫描失败")
          : T("Scan failed", "扫描失败")
        : status === "cancelled"
          ? batchMode
            ? T("Scan batch cancelled", "批量扫描已取消")
            : T("Scan cancelled", "扫描已取消")
          : status === "no_repo"
            ? T("No repository selected", "未选择仓库")
            : batchMode
              ? T("Scanning repositories", "正在扫描仓库")
              : T("Scanning…", "扫描进行中");

  const headerIcon =
    status === "done" ? (
      <I.Check size={18} />
    ) : status === "failed" || status === "cancelled" ? (
      <I.X size={18} />
    ) : (
      <span className="spin" style={{ display: "inline-block" }}>
        <I.Refresh size={18} />
      </span>
    );

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[{ label: T("Scan", "扫描") }]} setIssue={setIssue} />
      <div className="main" style={{ margin: "0 auto", maxWidth: "none" }}>
        <div className="scanning scanning-wide">
          <div className="scanning-card card">
            <div className="scanning-h">
              <div className="scanning-icon">{headerIcon}</div>
              <div className="scanning-copy">
                <div className="scanning-title">
                  {status === "queued"
                    ? batchMode
                      ? T("Scan batch queued", "批量扫描排队中")
                      : T("Scan queued", "Scan queued")
                    : headerLabel}{" "}
                  <b>
                    {batchMode
                      ? T(`${expectedBatchCount} repositories`, `${expectedBatchCount} 个仓库`)
                      : scan?.repo || repoFullName || "—"}
                  </b>
                </div>
                <div className="scanning-sub">
                  {batchMode ? (
                    <span className="tag">
                      {batchSummary.failedToCreate
                        ? T(
                            `${batchSummary.created}/${batchSummary.expected} scans created, ${batchSummary.failedToCreate} not created`,
                            `${batchSummary.created}/${batchSummary.expected} 个扫描已创建，${batchSummary.failedToCreate} 个未创建`
                          )
                        : T(
                            `${batchSummary.created}/${batchSummary.expected} scans created`,
                            `${batchSummary.created}/${batchSummary.expected} 个扫描已创建`
                          )}
                    </span>
                  ) : (
                    <>
                      <span className="scanning-sub-label">{T("branch", "分支")}</span>
                      <span className="tag">{scan?.branch || branch}</span>
                      {scan?.commit && scan.commit !== "pending" && scan.commit !== "-" && (
                        <>
                          <span className="scanning-sub-sep" aria-hidden="true">
                            ·
                          </span>
                          <span className="scanning-sub-label">{T("commit", "commit")}</span>
                          <span className="tag">{scan.commit}</span>
                        </>
                      )}
                      {scan?.id && (
                        <>
                          <span className="scanning-sub-sep" aria-hidden="true">
                            ·
                          </span>
                          <span className="tag">{scan.id}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="scanning-actions">
                <button className="btn ghost" onClick={handleBack}>
                  <I.ArrowL size={13} /> {T("Back", "返回")}
                </button>
                {canCancel && (
                  <>
                    <span className="scanning-actions-sep" aria-hidden="true" />
                    <button className="btn ghost" onClick={handleCancel}>
                      <I.X size={13} /> {T("Cancel", "取消")}
                    </button>
                  </>
                )}
                {terminal && (
                  <>
                    <span className="scanning-actions-sep" aria-hidden="true" />
                    <button className="btn primary" onClick={() => go("dashboard")}>
                      <I.Layout size={13} /> {T("Overview", "总览")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div
                className="auth-error"
                role="alert"
                style={{ margin: "0 0 12px", alignItems: "center" }}
              >
                <I.X size={13} />
                <span style={{ flex: 1 }}>{publicError}</span>
                {errorAction && (
                  <a className="btn sm" {...screenLinkProps(go, errorAction.screen)}>
                    {errorAction.label} <I.ArrowR size={11} />
                  </a>
                )}
              </div>
            )}

            <div className="scanning-bar-wrap">
              <div className="scanning-bar">
                <div className="scanning-bar-fill" style={{ width: progress + "%" }}></div>
              </div>
              <div className="scanning-bar-meta">
                <span>{Math.floor(progress)}%</span>
                <span>
                  {phaseIdx >= 0
                    ? T(scanPhases[phaseIdx].t_en, scanPhases[phaseIdx].t_zh)
                    : T("Queued", "队列中")}
                </span>
              </div>
            </div>

            {status === "queued" && queueSummary && (
              <div className="scanning-queue">
                {queueSummary.message && (
                  <div className="scanning-queue-message">{queueSummary.message}</div>
                )}
                <div className="scanning-queue-meta">
                  {queueSummary.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="scanning-phases">
              {scanPhases.map((p, i) => {
                const isDone = phaseIdx > i || status === "done";
                const isOn = phaseIdx === i && !terminal;
                const cls = isDone ? " done" : isOn ? " on" : "";
                const bullet = isDone ? (
                  <I.Check size={11} />
                ) : isOn ? (
                  <span
                    className="pulse"
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: "currentColor",
                    }}
                  />
                ) : (
                  i + 1
                );
                return (
                  <Fragment key={p.k}>
                    <div className={"scanning-phase" + cls}>
                      <div className="scanning-phase-bullet">{bullet}</div>
                      <div>
                        <div className="scanning-phase-t">{T(p.t_en, p.t_zh)}</div>
                        <div className="scanning-phase-d">{T(p.d_en, p.d_zh)}</div>
                      </div>
                    </div>
                    {p.k === "ai" && auditSwarmReviewComplete && (
                      <AuditSwarmEvidence
                        auditSwarm={auditSwarm}
                        className="scanning-audit-inline"
                        onDownload={batchMode ? null : handleDownloadBundle}
                        downloading={bundleLoading}
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>

            {(repositoryGraph || semanticGraph) && (
              <RepositoryGraphPanel graph={repositoryGraph} semanticGraph={semanticGraph} />
            )}
          </div>

          <div className="scanning-side">
            <div className="card scanning-counts">
              <div className="scanning-counts-h">{T("Live findings", "实时发现")}</div>
              <div className="scanning-counts-grid">
                <div>
                  <b style={{ color: "var(--sev-critical)" }}>{found.critical || 0}</b>
                  <span>{T("Critical", "关键")}</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-high)" }}>{found.high || 0}</b>
                  <span>{T("High", "高")}</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-medium)" }}>{found.medium || 0}</b>
                  <span>{T("Medium", "中")}</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-low)" }}>{found.low || 0}</b>
                  <span>{T("Low", "低")}</span>
                </div>
              </div>
              {aiUsage?.model && (
                <>
                  <div className="scanning-counts-h scanning-counts-subh">
                    {T("Model usage", "模型用量")}
                  </div>
                  <div className="scan-preflight-meta">
                    <span className="tag">{aiUsage.model}</span>
                  </div>
                </>
              )}
            </div>

            {preflight && (
              <div className="card scanning-preflight">
                <div className="scanning-counts-h">{T("Preflight evidence", "预检证据")}</div>
                {preflight.summary && (
                  <div className="muted scan-preflight-summary">{preflight.summary}</div>
                )}
                <div className="scan-preflight-tags">
                  {preflight.execution && <span className="tag">{preflight.execution}</span>}
                  {preflight.mode && <span className="tag">{preflight.mode}</span>}
                  {preflight.packageManagers.map((item) => (
                    <span className="tag" key={`pm-${item}`}>
                      {item}
                    </span>
                  ))}
                  {preflight.languages.map((item) => (
                    <span className="tag" key={`lang-${item}`}>
                      {item}
                    </span>
                  ))}
                </div>
                <div className="scan-preflight-meta">
                  <span>
                    {T(
                      `${preflight.manifestsCount || 0} manifests`,
                      `${preflight.manifestsCount || 0} 个清单`
                    )}
                  </span>
                  <span>
                    {T(
                      `${preflight.toolCount || 0} tool checks`,
                      `${preflight.toolCount || 0} 项工具检查`
                    )}
                  </span>
                  {preflight.environmentLabels.map((item) => (
                    <span key={`env-${item}`}>{item}</span>
                  ))}
                  <span>
                    {T(
                      `${preflight.verifierRuns || 0} verifier runs`,
                      `${preflight.verifierRuns || 0} 次验证器运行`
                    )}
                  </span>
                  {preflight.verifierFailed > 0 && (
                    <span className="preflight-warn">
                      {T(
                        `${preflight.verifierFailed} failed`,
                        `${preflight.verifierFailed} 次失败`
                      )}
                    </span>
                  )}
                  {preflight.verifierFlaky > 0 && (
                    <span className="preflight-warn">
                      {T(
                        `${preflight.verifierFlaky} flaky`,
                        `${preflight.verifierFlaky} 次不稳定`
                      )}
                    </span>
                  )}
                  {preflight.verifierTimeout > 0 && (
                    <span className="preflight-warn">
                      {T(
                        `${preflight.verifierTimeout} timed out`,
                        `${preflight.verifierTimeout} 次超时`
                      )}
                    </span>
                  )}
                  {preflight.availableScripts.length > 0 && (
                    <span>{preflight.availableScripts.join(", ")}</span>
                  )}
                </div>
              </div>
            )}

            <div className="card scanning-log">
              <div className="scanning-counts-h">{T("Live log", "实时日志")}</div>
              <div className="scanning-log-body">
                {logs.length === 0 && (
                  <div className="muted">{T("Waiting for engine…", "等待引擎启动…")}</div>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="scanning-log-line">
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {batchMode && (
              <div className="card scanning-log">
                <div className="scanning-counts-h">{T("Repository results", "仓库结果")}</div>
                <div className="scanning-log-body">
                  {batchRows.length === 0 && (
                    <div className="muted">{T("Creating scan requests…", "正在创建扫描请求…")}</div>
                  )}
                  {batchRows.map((row) => (
                    <div
                      key={row.requestId || row.repo || row.scanId}
                      className="scanning-log-line"
                    >
                      <b>{row.repo || "—"}</b>
                      <span className="tag" style={{ marginLeft: 8 }}>
                        {row.status}
                      </span>
                      {row.scanId && (
                        <span className="tag" style={{ marginLeft: 8 }}>
                          {row.scanId}
                        </span>
                      )}
                      {row.error && <div className="muted">{row.error}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
