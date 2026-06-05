import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation } from "../lib/auth.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { screenLinkProps } from "../lib/navigation.js";
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
  if (!limit) return `${scope} quota unavailable`;
  const reset = quotaResetText(quota);
  return `${remaining} of ${limit} ${scope} scans left${reset ? ` - ${reset}` : ""}`;
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
  return count === 1 ? "scan" : "scans";
}

function accountQuotaNotice(remaining) {
  if (remaining === 0) {
    return "Your account has 0 scans left for this billing period. Upgrade or wait for the quota reset before selecting a repository.";
  }
  return `Your account has ${remaining} ${scansWord(remaining)} left for this billing period. Deselect another repository before selecting more.`;
}

function repositoryQuotaNotice(repo) {
  const label = repo?.fullName || repo?.name || "This repository";
  return `${label} has 0 repository scans left for this billing period.`;
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

function makeScanRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `scan_req_${globalThis.crypto.randomUUID()}`;
  }
  return `scan_req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function scanInputFromRepo(repo) {
  const request = {
    repo: repo?.fullName || repo?.name || repo?.repo || "",
    branch: repo?.defaultBranch || repo?.branch || "main",
    commit: repo?.commit || "pending",
    requestId: repo?.scanRequestId || "",
  };
  if (repo?.repoId) request.repoId = repo.repoId;
  return request;
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
    return { label: "Open billing", screen: "billing" };
  }
  if (
    text.includes("review provider") ||
    text.includes("cli") ||
    text.includes("not authenticated")
  ) {
    return { label: "Open settings", screen: "settings" };
  }
  if (
    text.includes("sync github repositories") ||
    ["REPOSITORY_SYNC_REQUIRED", "REPOSITORY_NOT_AUTHORIZED"].includes(code)
  ) {
    return { label: "Sync repositories", screen: "repos" };
  }
  return { label: "Retry", screen: "repos" };
}

const REVIEW_RUNNER_CLI_RE = /\b[A-Za-z][A-Za-z0-9_-]*\s+cli\b/gi;

function publicScanErrorMessage(error) {
  const message = typeof error === "object" && error ? error.message : error;
  return String(message || "")
    .replace(REVIEW_RUNNER_CLI_RE, "Review runner")
    .replace(/\bcli\b/gi, "review runner");
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

function scanVerificationTotals(scans) {
  return scans.reduce(
    (totals, scan) => {
      const verification = scan?.verification || {};
      return {
        verified: totals.verified + Number(verification.verified || 0),
        static_proof: totals.static_proof + Number(verification.static_proof || 0),
        potential_risk: totals.potential_risk + Number(verification.potential_risk || 0),
        unverified: totals.unverified + Number(verification.unverified || 0),
      };
    },
    { verified: 0, static_proof: 0, potential_risk: 0, unverified: 0 }
  );
}

function scanVerificationAuditTotals(scans) {
  return scans.reduce(
    (totals, scan) => {
      const audit = scan?.verificationAudit || {};
      return {
        candidateCount: totals.candidateCount + Number(audit.candidateCount || 0),
        reportedCount: totals.reportedCount + Number(audit.reportedCount || 0),
        rejectedCount: totals.rejectedCount + Number(audit.rejectedCount || 0),
        downgradedCount: totals.downgradedCount + Number(audit.downgradedCount || 0),
        rejectedSamples: [...totals.rejectedSamples, ...(audit.rejectedSamples || [])].slice(0, 5),
      };
    },
    {
      candidateCount: 0,
      reportedCount: 0,
      rejectedCount: 0,
      downgradedCount: 0,
      rejectedSamples: [],
    }
  );
}

function hasVerificationAudit(audit) {
  return Boolean(
    audit &&
    (audit.candidateCount ||
      audit.reportedCount ||
      audit.rejectedCount ||
      audit.downgradedCount ||
      audit.rejectedSamples?.length)
  );
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
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
  const evidenceBlocks = audits.flatMap((audit) => audit.evidenceBlocks || []).slice(0, 12);
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
  const totals = usages
    .map((usage) => Number(usage.totalTokens))
    .filter((count) => Number.isFinite(count) && count >= 0);
  const usage = {};
  if (models.length === 1) usage.model = models[0];
  else if (models.length > 1) usage.model = `${models.length} models`;
  if (totals.length) usage.totalTokens = totals.reduce((sum, count) => sum + Math.trunc(count), 0);
  return usage.model || usage.totalTokens !== undefined ? usage : null;
}

function tokenUsageLabel(usage) {
  const total = Number(usage?.totalTokens);
  if (!Number.isFinite(total) || total < 0) return "";
  const count = Math.trunc(total);
  return `${count.toLocaleString()} tokens`;
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

function auditSwarmBlockLabel(kind) {
  return (
    {
      summary: "Summary",
      claim: "Claim",
      code_location: "Code location",
      evidence: "Evidence",
      command: "Command",
      verifier_verdict: "Verifier verdict",
      false_positive_check: "False-positive check",
      invariant: "Invariant",
      risk: "Risk",
    }[kind] || "Evidence"
  );
}

function auditSwarmBlockLocation(block) {
  const file = block?.file || "";
  const line = block?.startLine || "";
  return file ? `${file}${line ? `:${line}` : ""}` : "";
}

function auditSwarmLocation(item) {
  const location = item?.location && typeof item.location === "object" ? item.location : {};
  const file = item?.file || location.file || "";
  const line = item?.startLine || item?.line || location.startLine || location.line || "";
  return file ? `${file}${line ? `:${line}` : ""}` : "";
}

function auditSwarmCountLabel(count, singular, plural = `${singular}s`) {
  return `${count || 0} ${count === 1 ? singular : plural}`;
}

function auditSwarmBlockMeta(block) {
  const location = auditSwarmBlockLocation(block);
  return uniqueStrings([
    auditSwarmBlockLabel(block?.kind),
    block?.severity,
    block?.role,
    block?.shardId ? `shard ${block.shardId}` : "",
    block?.verdict,
    block?.proofType,
    block?.status,
    location,
    block?.confidence ? `${Math.round(Number(block.confidence) * 100)}% confidence` : "",
  ]);
}

function AuditSwarmEvidence({ auditSwarm, className = "" }) {
  if (!hasAuditSwarm(auditSwarm)) return null;

  const rootClassName = ["scanning-audit", className].filter(Boolean).join(" ");
  const visibleEvidenceCount = Math.min(auditSwarm.evidenceBlocks.length, 8);
  const stats = [
    { key: "candidates", value: auditSwarm.counts.candidateCount, label: "Candidates" },
    { key: "reported", value: auditSwarm.counts.reportedCount, label: "Reported" },
    { key: "rejected", value: auditSwarm.counts.rejectedCount, label: "Rejected" },
    { key: "verified", value: auditSwarm.counts.verifiedCount, label: "Verified" },
  ].filter((s) => typeof s.value === "number");
  const showStats = stats.some((s) => s.value > 0);

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
      <div className="scan-preflight-tags">
        {auditSwarm.stage && <span className="tag">stage {auditSwarm.stage}</span>}
        {auditSwarm.adapter && <span className="tag">{auditSwarm.adapter}</span>}
        {auditSwarm.roles.slice(0, 4).map((role) => (
          <span className="tag" key={`audit-role-${role}`}>
            {role}
          </span>
        ))}
        {auditSwarm.shards.slice(0, 3).map((shard) => (
          <span className="tag" key={`audit-shard-${shard}`}>
            shard {shard}
          </span>
        ))}
      </div>
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
      <div className="scan-preflight-meta audit-meta-fallback">
        {auditSwarm.counts.candidateCount > 0 && (
          <span>{auditSwarm.counts.candidateCount} candidates evaluated</span>
        )}
        {auditSwarm.counts.rejectedCount > 0 && (
          <span>{auditSwarm.counts.rejectedCount} rejected before reporting</span>
        )}
        {auditSwarm.counts.verifiedCount > 0 && (
          <span>{auditSwarm.counts.verifiedCount} verified</span>
        )}
        {auditSwarm.counts.staticProofCount > 0 && (
          <span>{auditSwarm.counts.staticProofCount} static proof</span>
        )}
      </div>
      {auditSwarm.evidenceBlocks.length > 0 && (
        <div className="audit-section">
          <div className="audit-section-h">
            <span>{T("Evidence blocks", "Evidence blocks")}</span>
            <span className="audit-section-count">
              {auditSwarmCountLabel(auditSwarm.counts.evidenceBlocks, "evidence block")}
            </span>
          </div>
          <div className="audit-card-list">
            {auditSwarm.evidenceBlocks.slice(0, 8).map((block, index) => (
              <div key={block.id || `${block.kind}-${block.title}-${index}`} className="audit-card">
                <div className="audit-card-title">
                  {block.title || auditSwarmBlockLabel(block.kind)}
                </div>
                <div className="audit-card-meta">
                  {auditSwarmBlockMeta(block).map((item) => (
                    <span key={`${block.id || index}-${item}`}>{item}</span>
                  ))}
                </div>
                {block.summary && (
                  <div className="audit-card-row">
                    <b>{T("Summary", "Summary")}</b>
                    <span>{block.summary}</span>
                  </div>
                )}
                {block.command && (
                  <div className="audit-card-row">
                    <b>{T("Command", "Command")}</b>
                    <code className="tag evidence-command">{block.command}</code>
                  </div>
                )}
                {block.items?.length > 0 && (
                  <div className="audit-card-row">
                    <b>{T("Details", "Details")}</b>
                    <span>{block.items.join("; ")}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {auditSwarm.counts.evidenceBlocks > visibleEvidenceCount && (
            <div className="audit-card-more">
              {T(
                `+${auditSwarm.counts.evidenceBlocks - visibleEvidenceCount} more evidence blocks in the downloaded audit bundle`,
                `+${auditSwarm.counts.evidenceBlocks - visibleEvidenceCount} more evidence blocks in the downloaded audit bundle`
              )}
            </div>
          )}
        </div>
      )}
      {auditSwarm.issueCards.length > 0 && (
        <div className="audit-section">
          <div className="audit-section-h">
            <span>{T("Issue cards", "问题卡片")}</span>
            <span className="audit-section-count">
              {auditSwarmCountLabel(auditSwarm.counts.issueCards, "issue card")}
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
              {auditSwarmCountLabel(auditSwarm.counts.verificationResults, "verifier result")}
            </span>
          </div>
          <div className="audit-card-list">
            {auditSwarm.verificationResults.slice(0, 3).map((result, index) => (
              <div
                key={`${result.issueId || "result"}-${result.verifierRole || index}`}
                className="audit-card"
              >
                <div className="audit-card-title">
                  {result.verdict || "reviewed"}
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
  const selectedRepoObjects = selected
    .map((id) => availableRepos.find((item) => item.id === id))
    .filter(Boolean);

  useEffect(() => {
    if (!orgs.includes(org)) setOrg(allLabel);
  }, [allLabel, org, orgs]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => availableRepos.some((repo) => repo.id === id)));
  }, [availableRepos]);

  useGitHubRepositoryAccessAutoRefresh(refreshGitHubRepositoryAccess);

  const runScanForRepos = (reposToScan) => {
    if (!reposToScan.length) return;
    const selectedRepos = reposToScan.map((repo) => ({
      ...repo,
      scanRequestId: makeScanRequestId(),
    }));
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
  };

  const activateRepositorySelection = (event, repoId) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle(repoId);
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
            ? `Your account currently has ${remaining} ${scansWord(remaining)} left. Choose up to ${allowedCount} repositories to scan now.`
            : `Only ${allowedCount} of these repositories can be scanned right now based on current quota. Choose which repositories to scan.`;
        setQuotaPreflight({ ...preflight, selectedRepos: reposToScan });
        setQuotaDialogSelected([]);
        setQuotaDialogNotice(notice);
        return;
      }
      runScanForRepos(reposToScan);
    } catch (quotaError) {
      setConnectError(quotaError?.message || "Unable to verify scan quota before starting.");
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
          : "This repository cannot be scanned with the current GitHub authorization."
      );
      return;
    }
    if (quotaDialogSelected.includes(repo.id)) {
      setQuotaDialogSelected((current) => current.filter((item) => item !== repo.id));
      return;
    }
    if (quotaDialogSelected.length >= quotaDialogAllowed) {
      setQuotaDialogNotice(
        `You can choose ${quotaDialogAllowed} ${scansWord(quotaDialogAllowed)} because that is the current effective quota.`
      );
      return;
    }
    setQuotaDialogSelected((current) => [...current, repo.id]);
  };

  const confirmQuotaDialogSelection = () => {
    if (!quotaDialogCanConfirm) return;
    const reposToScan = quotaDialogRepos.filter((repo) => quotaDialogSelected.includes(repo.id));
    closeQuotaDialog();
    runScanForRepos(reposToScan);
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
      setConnectError(authError?.message || "Unable to connect GitHub repository access.");
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
      setConnectError(authError?.message || "Unable to manage GitHub installation.");
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
      <Topbar go={go} breadcrumbs={[{ label: T("Repositories", "仓库") }]} setIssue={setIssue} />
      <div className="with-side">
        <Sidebar section="repos" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Choose repositories to scan", "选择要扫描的仓库")}</h1>
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
              {accountQuotaLabel && (
                <div className="sub account-quota-summary">Account quota: {accountQuotaLabel}</div>
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
                {checkingQuota ? "Checking quota" : T("Start scan", "开始扫描")} ({selected.length})
              </button>
            </div>
          </div>

          {!needsAuthorization && (
            <GitHubInstallationsList
              installations={installations}
              onManage={manageInstallation}
              managingInstallationId={managingInstallationId}
            />
          )}

          <div className="repos-toolbar">
            <div className="repos-search">
              <I.Search size={14} />
              <input
                placeholder={T("Search repositories...", "搜索仓库...")}
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
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
                    <span>Scan quota limit</span>
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
                    <span>
                      <span className="lang-dot" data-lang={repo.lang}></span> {repo.lang}
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
                <h2 id="quota-dialog-title">Choose repositories to scan</h2>
                <p>{quotaDialogNotice}</p>
              </div>
              <button className="btn ghost icon" type="button" onClick={closeQuotaDialog}>
                <I.X size={14} />
              </button>
            </div>
            <div className="quota-choice-count">
              {quotaDialogSelected.length} of {quotaDialogAllowed} selected
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
                      <span>{quotaLabel || repo.desc || "Authorized repository"}</span>
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
                  <I.Activity size={14} /> Open billing
                </button>
              )}
              <button className="btn ghost" type="button" onClick={closeQuotaDialog}>
                Cancel
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!quotaDialogCanConfirm}
                onClick={confirmQuotaDialogSelection}
              >
                <I.Play size={12} /> Scan selected
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

function scanPhaseDefinition(phase) {
  return SCAN_PHASE_BY_KEY.get(phase);
}

function scanPhasesForPhase(phase) {
  return LEGACY_ONLY_SCAN_PHASE_KEYS.has(phase) ? LEGACY_SCAN_PHASES : PRODUCTION_SCAN_PHASES;
}

export function ScanningScreen({ go, activeRepo, setIssue = null }) {
  useLang();
  const [logs, setLogs] = useState([]);
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
  const currentPhase = scan?.phase || (status === "queued" ? null : status === "done" ? "report" : "clone");
  const scanPhases = scanPhasesForPhase(currentPhase);
  const phaseIdx = currentPhase ? scanPhases.findIndex((p) => p.k === currentPhase) : -1;
  const found = batchMode
    ? scanIssueTotals(scans)
    : scan?.issues || { critical: 0, high: 0, medium: 0, low: 0 };
  const verificationFound = batchMode
    ? scanVerificationTotals(scans)
    : scan?.verification || { verified: 0, static_proof: 0, potential_risk: 0, unverified: 0 };
  const verificationAuditFound = batchMode
    ? scanVerificationAuditTotals(scans)
    : scan?.verificationAudit || {
        candidateCount: 0,
        reportedCount: 0,
        rejectedCount: 0,
        downgradedCount: 0,
        rejectedSamples: [],
      };
  const preflight = batchMode
    ? scanPreflightSummary(scans)
    : scanPreflightSummary(scan ? [scan] : []);
  const auditSwarm = scanAuditSwarmSummary(scans);
  const aiUsage = batchMode ? scanAiUsageSummary(scans) : scan?.aiUsage || null;
  const aiUsageTokens = tokenUsageLabel(aiUsage);
  const terminal = batchMode
    ? expectedBatchCount > 0 &&
      batchRows.length === expectedBatchCount &&
      batchRows.every(isTerminalBatchRow)
    : isTerminalScan(scan);
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
      <div className="main narrow" style={{ margin: "0 auto" }}>
        <div className="scanning">
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
                    {p.k === "ai" && (
                      <AuditSwarmEvidence
                        auditSwarm={auditSwarm}
                        className="scanning-audit-inline"
                      />
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>

          <div className="scanning-side">
            <div className="card scanning-counts">
              <div className="scanning-counts-h">{T("Live findings", "实时发现")}</div>
              <div className="scanning-counts-grid">
                <div>
                  <b style={{ color: "var(--sev-critical)" }}>{found.critical || 0}</b>
                  <span>Critical</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-high)" }}>{found.high || 0}</b>
                  <span>High</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-medium)" }}>{found.medium || 0}</b>
                  <span>Medium</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-low)" }}>{found.low || 0}</b>
                  <span>Low</span>
                </div>
              </div>
              {(aiUsage?.model || aiUsageTokens) && (
                <>
                  <div className="scanning-counts-h scanning-counts-subh">Model usage</div>
                  <div className="scan-preflight-meta">
                    {aiUsage?.model && <span className="tag">{aiUsage.model}</span>}
                    {aiUsageTokens && <span className="tag">{aiUsageTokens}</span>}
                  </div>
                </>
              )}
              <div className="scanning-counts-h scanning-counts-subh">Evidence status</div>
              <div className="scanning-counts-grid">
                <div>
                  <b className="scan-verification-verified">{verificationFound.verified || 0}</b>
                  <span>Verified</span>
                </div>
                <div>
                  <b className="scan-verification-static">{verificationFound.static_proof || 0}</b>
                  <span>Static</span>
                </div>
                <div>
                  <b className="scan-verification-risk">{verificationFound.potential_risk || 0}</b>
                  <span>Risk</span>
                </div>
                <div>
                  <b className="scan-verification-unverified">
                    {verificationFound.unverified || 0}
                  </b>
                  <span>Unverified</span>
                </div>
              </div>
              {hasVerificationAudit(verificationAuditFound) && (
                <>
                  <div className="scanning-counts-h scanning-counts-subh">Candidate audit</div>
                  <div className="scanning-counts-grid">
                    <div>
                      <b>{verificationAuditFound.candidateCount || 0}</b>
                      <span>Candidates</span>
                    </div>
                    <div>
                      <b className="scan-verification-verified">
                        {verificationAuditFound.reportedCount || 0}
                      </b>
                      <span>Reported</span>
                    </div>
                    <div>
                      <b className="scan-verification-risk">
                        {verificationAuditFound.rejectedCount || 0}
                      </b>
                      <span>Rejected</span>
                    </div>
                    <div>
                      <b className="scan-verification-static">
                        {verificationAuditFound.downgradedCount || 0}
                      </b>
                      <span>Downgraded</span>
                    </div>
                  </div>
                  {verificationAuditFound.rejectedSamples?.length > 0 && (
                    <div className="scan-preflight-meta">
                      {verificationAuditFound.rejectedSamples.slice(0, 5).map((sample, index) => (
                        <span key={`${sample.reason}-${sample.title || index}`}>
                          Rejected: {sample.reason}
                          {sample.title ? ` - ${sample.title}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
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
                  <span>{preflight.manifestsCount || 0} manifests</span>
                  <span>{preflight.toolCount || 0} tool checks</span>
                  {preflight.environmentLabels.map((item) => (
                    <span key={`env-${item}`}>{item}</span>
                  ))}
                  <span>{preflight.verifierRuns || 0} verifier runs</span>
                  {preflight.verifierFailed > 0 && (
                    <span className="preflight-warn">{preflight.verifierFailed} failed</span>
                  )}
                  {preflight.verifierFlaky > 0 && (
                    <span className="preflight-warn">{preflight.verifierFlaky} flaky</span>
                  )}
                  {preflight.verifierTimeout > 0 && (
                    <span className="preflight-warn">{preflight.verifierTimeout} timed out</span>
                  )}
                  {preflight.availableScripts.length > 0 && (
                    <span>{preflight.availableScripts.join(", ")}</span>
                  )}
                </div>
              </div>
            )}

            <div className="card scanning-log">
              <div className="scanning-counts-h">Live log</div>
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
