import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";

function itemsFrom(payload, ...keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function formatTime(value) {
  if (!value) return "";
  if (typeof value === "number") {
    return new Date(value * 1000).toLocaleString();
  }
  return scalarText(value);
}

function normalizeConfidence(value) {
  const confidence = Number(value ?? 0);
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}

function normalizeCount(value) {
  const count = Number(value ?? 0);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.trunc(count));
}

function normalizeIssueCounts(issues) {
  if (!issues || typeof issues !== "object" || Array.isArray(issues)) return null;
  return Object.fromEntries(
    Object.entries(issues).map(([key, value]) => [key, normalizeCount(value)])
  );
}

function normalizeVerificationCounts(verification) {
  if (!verification || typeof verification !== "object" || Array.isArray(verification)) {
    return { verified: 0, static_proof: 0, potential_risk: 0, unverified: 0 };
  }
  return {
    verified: normalizeCount(verification.verified),
    static_proof: normalizeCount(verification.static_proof ?? verification.staticProof),
    potential_risk: normalizeCount(verification.potential_risk ?? verification.potentialRisk),
    unverified: normalizeCount(verification.unverified),
  };
}

function normalizeVerificationAudit(value) {
  const source = objectRecord(value) ? value : {};
  const rejectedReasons = Array.isArray(source.rejectedReasons ?? source.rejected_reasons)
    ? (source.rejectedReasons ?? source.rejected_reasons)
        .map((item) => {
          if (!objectRecord(item)) return null;
          const reason = textValue(item.reason);
          const count = normalizeCount(item.count);
          return reason && count ? { reason, count } : null;
        })
        .filter(Boolean)
    : [];
  const rejectedSamples = Array.isArray(source.rejectedSamples ?? source.rejected_samples)
    ? (source.rejectedSamples ?? source.rejected_samples)
        .map((item) => {
          if (!objectRecord(item)) return null;
          const reason = textValue(item.reason);
          if (!reason) return null;
          return {
            reason,
            title: textValue(item.title),
            severity: textValue(item.severity),
            category: textValue(item.category),
            file: textValue(item.file),
            line: normalizeCount(item.line),
            verificationStatus: normalizeVerificationStatus(item.verificationStatus),
          };
        })
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const rejectedReasonCount = rejectedReasons.reduce((sum, item) => sum + item.count, 0);
  return {
    candidateCount: normalizeCount(source.candidateCount ?? source.candidate_count),
    reportedCount: normalizeCount(source.reportedCount ?? source.reported_count),
    rejectedCount: Math.max(
      normalizeCount(source.rejectedCount ?? source.rejected_count),
      rejectedReasonCount
    ),
    downgradedCount: normalizeCount(source.downgradedCount ?? source.downgraded_count),
    verifiedCount: normalizeCount(source.verifiedCount ?? source.verified_count),
    staticProofCount: normalizeCount(source.staticProofCount ?? source.static_proof_count),
    potentialRiskCount: normalizeCount(source.potentialRiskCount ?? source.potential_risk_count),
    unverifiedCount: normalizeCount(source.unverifiedCount ?? source.unverified_count),
    rejectedReasons,
    rejectedSamples,
    summary: textValue(source.summary),
  };
}

function normalizePreflight(preflight) {
  if (!objectRecord(preflight)) return null;
  const manifests = Array.isArray(preflight.manifests)
    ? preflight.manifests
        .map((item) =>
          objectRecord(item)
            ? { file: textValue(item.file), type: textValue(item.type) }
            : null
        )
        .filter((item) => item?.file && item?.type)
    : [];
  const toolVersions = Array.isArray(preflight.toolVersions)
    ? preflight.toolVersions
        .map((item) => {
          if (!objectRecord(item)) return null;
          const name = textValue(item.name);
          if (!name) return null;
          const exitCode = Number(item.exitCode ?? 0);
          return {
            name,
            command: textValue(item.command),
            available: normalizeBoolean(item.available),
            exitCode: Number.isFinite(exitCode) ? Math.trunc(exitCode) : 0,
            output: textValue(item.output),
          };
        })
        .filter(Boolean)
    : [];
  const verifierRuns = Array.isArray(preflight.verifier?.runs)
    ? preflight.verifier.runs
        .map((item) => {
          if (!objectRecord(item)) return null;
          const status = textValue(item.status);
          const attempts = Array.isArray(item.attempts)
            ? item.attempts
                .map((attempt) => {
                  if (!objectRecord(attempt)) return null;
                  const attemptStatus = textValue(attempt.status);
                  return {
                    attempt: normalizeCount(attempt.attempt),
                    status: ["passed", "failed", "skipped", "timeout"].includes(attemptStatus)
                      ? attemptStatus
                      : "skipped",
                    exitCode: normalizeCount(attempt.exitCode),
                    durationMs: normalizeCount(attempt.durationMs),
                    output: textValue(attempt.output),
                  };
                })
                .filter(Boolean)
            : [];
          return {
            script: textValue(item.script),
            command: textValue(item.command),
            status: ["passed", "failed", "skipped", "timeout", "flaky"].includes(status)
              ? status
              : "skipped",
            exitCode: normalizeCount(item.exitCode),
            durationMs: normalizeCount(item.durationMs),
            confirmedFailure: normalizeBoolean(item.confirmedFailure),
            attempts,
            logPath: textValue(item.logPath),
            output: textValue(item.output),
          };
        })
        .filter((item) => item?.script || item?.command)
    : [];
  const verifier = objectRecord(preflight.verifier)
    ? {
        enabled: normalizeBoolean(preflight.verifier.enabled),
        summary: textValue(preflight.verifier.summary),
        runs: verifierRuns,
      }
    : null;
  const environment = objectRecord(preflight.environment)
    ? {
        os: textValue(preflight.environment.os),
        osRelease: textValue(preflight.environment.osRelease),
        platform: textValue(preflight.environment.platform),
        machine: textValue(preflight.environment.machine),
        pythonVersion: textValue(preflight.environment.pythonVersion),
      }
    : null;
  return {
    mode: textValue(preflight.mode),
    execution: textValue(preflight.execution),
    summary: textValue(preflight.summary),
    repo: textValue(preflight.repo),
    branch: textValue(preflight.branch),
    commit: textValue(preflight.commit),
    workerVersion: textValue(preflight.workerVersion),
    environment,
    providerChain: normalizeTextList(preflight.providerChain),
    languages: normalizeTextList(preflight.languages),
    packageManagers: normalizeTextList(preflight.packageManagers),
    availableScripts: normalizeTextList(preflight.availableScripts),
    limitations: normalizeTextList(preflight.limitations),
    manifests,
    toolVersions,
    verifier,
  };
}

function normalizeProgress(value) {
  const progress = Number(value ?? 0);
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return false;
}

function normalizeLineNumber(value) {
  const line = Number(value);
  if (!Number.isFinite(line)) return null;
  const normalized = Math.trunc(line);
  return normalized > 0 ? String(normalized) : null;
}

function normalizeQueueCount(value, { positive = false } = {}) {
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  const normalized = Math.trunc(count);
  if (normalized < 0) return null;
  if (positive && normalized === 0) return null;
  return normalized;
}

function normalizeDisplayCount(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const count = Number(value);
    if (!Number.isFinite(count)) continue;
    return Math.max(0, Math.trunc(count));
  }
  return "-";
}

function textValue(...values) {
  for (const value of values) {
    const text = firstLineText(value);
    if (text) return text;
  }
  return "";
}

function normalizeSeverity(value) {
  const severity = textValue(value);
  return ["critical", "high", "medium", "low", "info"].includes(severity) ? severity : "info";
}

function normalizeIssueStatus(value) {
  const status = textValue(value);
  return ["open", "fixed", "snoozed"].includes(status) ? status : "open";
}

function normalizeVerificationStatus(value) {
  const status = textValue(value);
  return ["verified", "static_proof", "potential_risk", "unverified"].includes(status)
    ? status
    : "potential_risk";
}

function normalizeConfidenceLevel(value) {
  const level = textValue(value);
  return ["high", "medium", "low"].includes(level) ? level : "low";
}

function normalizeScanStatus(value) {
  const status = textValue(value);
  return ["queued", "running", "done", "failed", "cancelled"].includes(status) ? status : "queued";
}

function scalarText(value) {
  if (value === undefined || value === null || value === "") return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return "";
}

function firstLineText(value) {
  return scalarText(value)
    .replaceAll("\x00", "")
    .split(/\r?\n|\r/, 1)[0]
    .trim();
}

function multilineTextValue(value, maxLength = 4000) {
  const text = scalarText(value)
    .replaceAll("\x00", "")
    .replace(/\r\n|\r/g, "\n")
    .trim();
  return text.slice(0, maxLength);
}

function normalizeReferenceUrl(value) {
  const raw = scalarText(value).trim();
  if (!raw || raw.includes("\x00") || /[\r\n]/.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname ? raw : null;
  } catch {
    return null;
  }
}

function normalizeTextList(values) {
  if (!Array.isArray(values)) return [];
  return values.map(firstLineText).filter(Boolean);
}

function objectRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeQuotaCount(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const count = Number(value);
  if (!Number.isFinite(count)) return fallback;
  return Math.max(0, Math.trunc(count));
}

export function normalizeQuotaUsage(value) {
  if (!objectRecord(value)) return null;
  const used = normalizeQuotaCount(value.used);
  const limit = normalizeQuotaCount(value.limit);
  const remaining = Object.prototype.hasOwnProperty.call(value, "remaining")
    ? normalizeQuotaCount(value.remaining)
    : Math.max(0, limit - used);
  return {
    ...value,
    scope: textValue(value.scope, value.scopeType, value.scope_type),
    period: textValue(value.period),
    plan: textValue(value.plan),
    used,
    limit,
    remaining,
    resetAt: textValue(value.resetAt, value.reset_at),
  };
}

function normalizeCodeLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => {
      if (["string", "number", "boolean"].includes(typeof line)) {
        const code = firstLineText(line);
        return code ? { ln: "", code, t: "" } : null;
      }
      if (!line || typeof line !== "object" || Array.isArray(line)) return null;
      const code = firstLineText(line.code);
      if (!code) return null;
      const type = ["add", "del"].includes(line.t) ? line.t : "";
      return {
        ln: firstLineText(line.ln),
        code,
        t: type,
      };
    })
    .filter(Boolean);
}

function normalizeReferences(references) {
  if (!Array.isArray(references)) return [];
  return references
    .map((reference) => {
      if (["string", "number", "boolean"].includes(typeof reference)) {
        const url = normalizeReferenceUrl(reference);
        return url ? { label: url, url } : null;
      }
      if (!reference || typeof reference !== "object" || Array.isArray(reference)) return null;
      const url = normalizeReferenceUrl(reference.url);
      if (!url) return null;
      return {
        label: firstLineText(reference.label) || url,
        url,
      };
    })
    .filter(Boolean);
}

function normalizeLocations(locations) {
  if (!Array.isArray(locations)) return [];
  return locations
    .map((location) => {
      if (!objectRecord(location)) return null;
      const file = textValue(location.file);
      if (!file) return null;
      const startLine = normalizeLineNumber(location.startLine ?? location.start_line ?? location.line);
      const endLine = normalizeLineNumber(location.endLine ?? location.end_line ?? startLine);
      return {
        file,
        startLine,
        endLine: endLine || startLine,
        url: normalizeReferenceUrl(location.url),
      };
    })
    .filter(Boolean);
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .map((item) => {
      if (!objectRecord(item)) return null;
      const type = textValue(item.type) || "code";
      const label = textValue(item.label) || type.replaceAll("_", " ");
      const summary = textValue(item.summary);
      const file = textValue(item.file);
      const command = textValue(item.command);
      const logPath = textValue(item.logPath, item.log_path);
      const output = multilineTextValue(item.output);
      const url = normalizeReferenceUrl(item.url);
      if (!summary && !file && !command && !logPath && !output && !url) return null;
      const exitCode = Number(item.exitCode ?? item.exit_code);
      return {
        type,
        label,
        summary,
        file,
        startLine: normalizeLineNumber(item.startLine ?? item.start_line ?? item.line),
        endLine: normalizeLineNumber(item.endLine ?? item.end_line ?? item.startLine),
        command,
        exitCode: Number.isFinite(exitCode) ? Math.trunc(exitCode) : null,
        logPath,
        output,
        url,
      };
    })
    .filter(Boolean);
}

function normalizeReproduction(value) {
  const source = objectRecord(value) ? value : {};
  return {
    commands: normalizeTextList(source.commands),
    input: textValue(source.input),
    expected: textValue(source.expected),
    actual: textValue(source.actual),
    testFile: textValue(source.testFile, source.test_file),
    logPath: textValue(source.logPath, source.log_path),
  };
}

function normalizeReasoningBreakdown(value) {
  const source = objectRecord(value) ? value : {};
  return {
    facts: normalizeTextList(source.facts),
    inferences: normalizeTextList(source.inferences),
    recommendations: normalizeTextList(source.recommendations),
  };
}

function normalizeAuditSwarmTextList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (objectRecord(item)) return textValue(item.summary, item.text, item.claim);
      return textValue(item);
    })
    .filter(Boolean);
}

function normalizeAuditSwarmCounts(value) {
  const source = objectRecord(value) ? value : {};
  return {
    issueCards: normalizeCount(source.issueCards ?? source.issue_cards),
    verificationResults: normalizeCount(source.verificationResults ?? source.verification_results),
    candidateCount: normalizeCount(source.candidateCount ?? source.candidate_count),
    reportedCount: normalizeCount(source.reportedCount ?? source.reported_count),
    rejectedCount: normalizeCount(source.rejectedCount ?? source.rejected_count),
    downgradedCount: normalizeCount(source.downgradedCount ?? source.downgraded_count),
    verifiedCount: normalizeCount(source.verifiedCount ?? source.verified_count),
    staticProofCount: normalizeCount(source.staticProofCount ?? source.static_proof_count),
    potentialRiskCount: normalizeCount(source.potentialRiskCount ?? source.potential_risk_count),
    unverifiedCount: normalizeCount(source.unverifiedCount ?? source.unverified_count),
    manifestCount: normalizeCount(source.manifestCount ?? source.manifest_count),
    toolCount: normalizeCount(source.toolCount ?? source.tool_count),
    verifierRunCount: normalizeCount(source.verifierRunCount ?? source.verifier_run_count),
  };
}

function normalizeAuditSwarmIssueCards(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((card, index) => {
      if (!objectRecord(card)) return null;
      const locations = normalizeLocations(card.locations);
      const primary = locations[0] || {};
      const evidence = normalizeAuditSwarmTextList(card.evidence);
      const title = textValue(card.title) || `Audit candidate ${index + 1}`;
      return {
        issueId: textValue(card.issueId, card.issue_id, card.id),
        title,
        severity: normalizeSeverity(card.severity),
        category: textValue(card.category) || "Quality",
        shardId: textValue(card.shardId, card.shard_id),
        agentRole: textValue(card.agentRole, card.agent_role),
        confidence: normalizeConfidence(card.confidence),
        file: textValue(card.file, primary.file),
        line: normalizeLineNumber(card.line ?? primary.startLine),
        locations,
        claim: textValue(card.claim, card.summary, card.description),
        evidence,
        evidenceCount: Math.max(
          normalizeCount(card.evidenceCount ?? card.evidence_count),
          evidence.length
        ),
        reproductionIdea: textValue(card.reproductionIdea, card.reproduction_idea),
        suggestedTest: textValue(card.suggestedTest, card.suggested_test),
        falsePositiveChecks: normalizeTextList(card.falsePositiveChecks ?? card.false_positive_checks),
        violatedInvariants: normalizeTextList(card.violatedInvariants ?? card.violated_invariants),
      };
    })
    .filter((card) => card && (card.title || card.claim || card.file || card.evidence.length))
    .slice(0, 20);
}

function normalizeAuditSwarmVerificationResults(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((result) => {
      if (!objectRecord(result)) return null;
      const commands = normalizeTextList(result.commandsRun ?? result.commands_run ?? result.commands);
      const command = textValue(result.command);
      if (command && !commands.includes(command)) commands.unshift(command);
      const evidence = normalizeAuditSwarmTextList(result.evidence);
      const verdict = textValue(result.verdict);
      return {
        issueId: textValue(result.issueId, result.issue_id),
        verifierRole: textValue(result.verifierRole, result.verifier_role),
        verdict: ["confirmed", "rejected", "inconclusive"].includes(verdict) ? verdict : "",
        confidence: normalizeConfidence(result.confidence),
        proofType: textValue(result.proofType, result.proof_type),
        proofStrength: normalizeCount(result.proofStrength ?? result.proof_strength),
        summary: textValue(result.summary, result.resultSummary, result.result_summary),
        commands: commands.slice(0, 5),
        command: commands[0] || "",
        commandCount: Math.max(
          normalizeCount(result.commandCount ?? result.command_count),
          commands.length
        ),
        evidence,
        evidenceCount: Math.max(
          normalizeCount(result.evidenceCount ?? result.evidence_count),
          evidence.length
        ),
        notesForFix: normalizeTextList(result.notesForFix ?? result.notes_for_fix),
      };
    })
    .filter((result) => result && (result.issueId || result.verdict || result.summary || result.commands.length))
    .slice(0, 30);
}

function normalizeAuditSwarm(value) {
  if (!objectRecord(value)) return {};
  const issueCards = normalizeAuditSwarmIssueCards(value.issueCards ?? value.issue_cards);
  const verificationResults = normalizeAuditSwarmVerificationResults(
    value.verificationResults ?? value.verification_results
  );
  const counts = normalizeAuditSwarmCounts(value.counts);
  if (issueCards.length) counts.issueCards = Math.max(counts.issueCards, issueCards.length);
  if (verificationResults.length) {
    counts.verificationResults = Math.max(counts.verificationResults, verificationResults.length);
  }
  return {
    protocol: textValue(value.protocol),
    stage: textValue(value.stage),
    adapter: textValue(value.adapter),
    providerChain: normalizeTextList(value.providerChain ?? value.provider_chain),
    summary: textValue(value.summary),
    logsSummary: textValue(value.logsSummary, value.logs_summary),
    counts,
    roles: normalizeTextList(value.roles),
    shards: normalizeTextList(value.shards),
    issueCards,
    verificationResults,
    shardId: textValue(value.shardId, value.shard_id),
    agentRole: textValue(value.agentRole, value.agent_role),
    verdict: textValue(value.verdict),
  };
}

function normalizeEvidenceTrace(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((stage) => {
      if (!objectRecord(stage)) return null;
      const key = textValue(stage.key);
      const label = textValue(stage.label, key);
      const status = ["present", "missing"].includes(stage.status) ? stage.status : "missing";
      const summary = textValue(stage.summary);
      const items = normalizeTextList(stage.items);
      if (!key && !label && !summary && !items.length) return null;
      return {
        key,
        label,
        status,
        summary,
        items,
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeEvidenceChecklist(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!objectRecord(item)) return null;
      const label = textValue(item.label);
      if (!label) return null;
      return { label, met: normalizeBoolean(item.met) };
    })
    .filter(Boolean);
}

function cleanPullRequestText(value) {
  if (typeof value !== "string") return "";
  if (value.includes("\r") || value.includes("\n") || value.includes("\x00")) return "";
  return value.trim();
}

function cleanPullRequestFirstLine(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const text = value
    .replaceAll("\x00", "")
    .split(/\r?\n|\r/)[0]
    .trim();
  return text || fallback;
}

function normalizePullRequestBranch(value) {
  const branch = typeof value === "string" ? value.trim() : "";
  if (!branch.startsWith("pullwise/fix-")) return "";
  if (
    branch.endsWith("/") ||
    branch.endsWith(".") ||
    branch.includes("..") ||
    branch.includes("//") ||
    branch.includes(" ")
  ) {
    return "";
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) return "";
  const parts = branch.split("/");
  if (parts.some((part) => !part || part.startsWith(".") || part.toLowerCase().endsWith(".lock"))) {
    return "";
  }
  return branch;
}

function normalizePullRequestUrl(value) {
  const url = cleanPullRequestText(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const isGitHubPullRequest =
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      pathParts.length === 4 &&
      pathParts[2] === "pull" &&
      /^\d+$/.test(pathParts[3]);
    return isGitHubPullRequest ? url : null;
  } catch {
    return null;
  }
}

function normalizePullRequestNumber(value) {
  if (typeof value === "boolean") return null;
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return null;
  return number;
}

function normalizeTimestamp(value) {
  if (typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function fallbackPullRequestTitle(issueId, title) {
  return `Fix ${cleanPullRequestText(title) || cleanPullRequestText(issueId) || "issue"}`;
}

export function normalizeIssuePullRequest(value, { issueId, title } = {}) {
  if (!objectRecord(value)) return undefined;
  return {
    issueId,
    branch: normalizePullRequestBranch(value.branch),
    url: normalizePullRequestUrl(value.url),
    number: normalizePullRequestNumber(value.number),
    title: cleanPullRequestText(value.title) || fallbackPullRequestTitle(issueId, title),
  };
}

function normalizePendingPullRequest(value, { issueId } = {}) {
  if (!objectRecord(value)) return undefined;
  const pending = {
    issueId,
    branch: normalizePullRequestBranch(value.branch),
    startedAt: normalizeTimestamp(value.startedAt) ?? 0,
  };
  if (Object.prototype.hasOwnProperty.call(value, "lastError")) {
    pending.lastError = cleanPullRequestFirstLine(value.lastError, "Pull request creation failed.");
  }
  const failedAt = normalizeTimestamp(value.failedAt);
  if (failedAt !== null) pending.failedAt = failedAt;
  return pending;
}

export function normalizeRepo(repo = {}) {
  repo = repo || {};
  const fullName = textValue(repo.fullName, repo.name);
  const rawRepoId = textValue(repo.repoId);
  const normalizedId = textValue(repo.id, rawRepoId, fullName);
  return {
    ...repo,
    id: normalizedId,
    repoId: rawRepoId || (normalizedId.startsWith("repo_") ? normalizedId : ""),
    githubRepoId: textValue(repo.githubRepoId),
    githubNodeId: textValue(repo.githubNodeId),
    name: textValue(repo.name, fullName),
    fullName,
    desc: textValue(repo.desc, repo.description),
    lang: textValue(repo.lang, repo.language) || "-",
    defaultBranch: textValue(repo.defaultBranch, repo.branch),
    stars: normalizeDisplayCount(repo.stars, repo.stargazers_count),
    branches: normalizeDisplayCount(repo.branches),
    updated: textValue(repo.updated, repo.updatedAt),
    private: normalizeBoolean(repo.private),
    quota: normalizeQuotaUsage(repo.quota),
    href: textValue(repo.href),
    scanAction: objectRecord(repo.scanAction) ? { ...repo.scanAction } : null,
  };
}

export function normalizeIssue(issue = {}) {
  issue = issue || {};
  const id = textValue(issue.id);
  const title = textValue(issue.title);
  const autoFix = normalizeBoolean(issue.autoFix);
  const autoFixable = normalizeBoolean(issue.autoFixable);
  const normalized = {
    ...issue,
    id,
    scanId: textValue(issue.scanId),
    repo: textValue(issue.repo),
    title,
    summary: textValue(issue.summary, issue.description),
    impact: textValue(issue.impact),
    detectionReasoning: textValue(issue.detectionReasoning),
    reproductionPath: textValue(issue.reproductionPath),
    verificationStatus: normalizeVerificationStatus(issue.verificationStatus),
    verificationSummary: textValue(issue.verificationSummary),
    affectedLocations: normalizeLocations(issue.affectedLocations),
    evidence: normalizeEvidence(issue.evidence),
    reproduction: normalizeReproduction(issue.reproduction),
    whyNotFalsePositive: normalizeTextList(issue.whyNotFalsePositive),
    limitations: normalizeTextList(issue.limitations),
    evidenceChecklist: normalizeEvidenceChecklist(issue.evidenceChecklist),
    confidenceLevel: normalizeConfidenceLevel(issue.confidenceLevel),
    evidenceTrace: normalizeEvidenceTrace(issue.evidenceTrace),
    reasoningBreakdown: normalizeReasoningBreakdown(issue.reasoningBreakdown),
    auditSwarm: normalizeAuditSwarm(issue.auditSwarm),
    audit: objectRecord(issue.audit) ? { ...issue.audit } : {},
    commit: textValue(issue.commit, issue.audit?.commit),
    jobId: textValue(issue.jobId, issue.audit?.jobId),
    severity: normalizeSeverity(issue.severity),
    category: textValue(issue.category) || "General",
    status: normalizeIssueStatus(issue.status),
    file: textValue(issue.file),
    line: normalizeLineNumber(issue.line),
    confidence: normalizeConfidence(issue.confidence),
    confidenceRationale: textValue(issue.confidenceRationale),
    effort: textValue(issue.effort) || "-",
    fixBenefits: textValue(issue.fixBenefits),
    fixRisks: textValue(issue.fixRisks),
    age: issue.age || formatTime(issue.createdAt || issue.updatedAt),
    autoFix,
    autoFixable,
    steps: normalizeTextList(issue.steps),
    badCode: normalizeCodeLines(issue.badCode),
    goodCode: normalizeCodeLines(issue.goodCode),
    references: normalizeReferences(issue.references),
    tags: normalizeTextList(issue.tags),
  };
  const pullRequest = normalizeIssuePullRequest(issue.pullRequest, { issueId: id, title });
  if (pullRequest) normalized.pullRequest = pullRequest;
  else delete normalized.pullRequest;
  const pendingPullRequest = normalizePendingPullRequest(issue.pullRequestPending, { issueId: id });
  if (pendingPullRequest) normalized.pullRequestPending = pendingPullRequest;
  else delete normalized.pullRequestPending;
  return normalized;
}

export function normalizeScan(scan = {}) {
  scan = scan || {};
  const billingUsage = normalizeQuotaUsage(scan.billingUsage);
  const repoUsage = normalizeQuotaUsage(scan.repoUsage);
  const quotaBucketIds = objectRecord(scan.quotaBucketIds) ? { ...scan.quotaBucketIds } : {};
  return {
    ...scan,
    id: textValue(scan.id),
    repo: textValue(scan.repo),
    branch: textValue(scan.branch) || "main",
    commit: textValue(scan.commit) || "-",
    status: normalizeScanStatus(scan.status),
    createdAt: scan.createdAt,
    time: textValue(scan.time) || formatTime(scan.createdAt),
    by: textValue(scan.by) || "you",
    progress: normalizeProgress(scan.progress),
    issues: normalizeIssueCounts(scan.issues),
    verification: normalizeVerificationCounts(scan.verification),
    verificationAudit: normalizeVerificationAudit(scan.verificationAudit ?? scan.verification_audit),
    preflight: normalizePreflight(scan.preflight),
    auditSwarm: normalizeAuditSwarm(scan.auditSwarm ?? scan.audit_swarm),
    repoId: textValue(scan.repoId),
    githubRepoId: textValue(scan.githubRepoId),
    quotaBucketIds,
    billingUsage,
    repoUsage,
  };
}

export function useRepositories() {
  const requestIdRef = useRef(0);
  const [state, setState] = useState({
    items: [],
    installations: [],
    installationAccounts: [],
    userQuota: null,
    loading: true,
    error: "",
    needsAuthorization: false,
  });

  const load = useCallback(async ({ sync = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = sync
        ? await pullwiseApi.repositories.sync()
        : await pullwiseApi.repositories.list();
      if (requestId !== requestIdRef.current) return;
      setState({
        items: itemsFrom(payload, "items", "repositories").map(normalizeRepo),
        installations: itemsFrom(payload, "installations"),
        installationAccounts: itemsFrom(payload, "installationAccounts"),
        userQuota: normalizeQuotaUsage(payload?.userQuota),
        loading: false,
        error: "",
        needsAuthorization: normalizeBoolean(payload?.needsAuthorization),
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setState({
        items: [],
        installations: [],
        installationAccounts: [],
        userQuota: null,
        loading: false,
        error: error?.message || "Unable to load repositories.",
        needsAuthorization: false,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

function pageMeta(payload, fallbackLimit) {
  return {
    total: Number.isFinite(Number(payload?.total)) ? Number(payload.total) : itemsFrom(payload, "items").length,
    limit: Number.isFinite(Number(payload?.limit)) ? Number(payload.limit) : fallbackLimit,
    offset: Number.isFinite(Number(payload?.offset)) ? Number(payload.offset) : 0,
    hasMore: Boolean(payload?.hasMore),
    nextOffset: Number.isFinite(Number(payload?.nextOffset)) ? Number(payload.nextOffset) : null,
  };
}

function listParams({ limit, offset, status, severity, q, scanId, repo } = {}) {
  const params = {};
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;
  if (status && status !== "all") params.status = status;
  if (severity && severity !== "all") params.severity = severity;
  if (q) params.q = q;
  if (scanId) params.scanId = scanId;
  if (repo) params.repo = repo;
  return params;
}

export function useIssues({ limit = 50, status = "", severity = "", q = "", scanId = "" } = {}) {
  const [state, setState] = useState({ items: [], loading: true, loadingMore: false, error: "", meta: pageMeta({}, limit) });

  const load = useCallback(async ({ append = false, offset = 0 } = {}) => {
    setState((current) => ({ ...current, loading: append ? current.loading : true, loadingMore: append, error: "" }));
    try {
      const payload = await pullwiseApi.issues.list(listParams({ limit, offset, status, severity, q, scanId }));
      const nextItems = itemsFrom(payload, "items", "issues").map(normalizeIssue);
      setState((current) => ({
        items: append ? [...current.items, ...nextItems] : nextItems,
        loading: false,
        loadingMore: false,
        error: "",
        meta: pageMeta(payload, limit),
      }));
    } catch (error) {
      setState((current) => ({
        items: append ? current.items : [],
        loading: false,
        loadingMore: false,
        error: error?.message || "Unable to load issues.",
        meta: append ? current.meta : pageMeta({}, limit),
      }));
    }
  }, [limit, status, severity, q, scanId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(() => {
    if (!state.meta.hasMore || state.loadingMore) return;
    load({ append: true, offset: state.meta.nextOffset ?? state.items.length });
  }, [load, state.meta, state.loadingMore, state.items.length]);

  return { ...state, reload: load, loadMore };
}

const ACTIVE_SCAN_STATUSES = new Set(["queued", "running"]);

export function isActiveScan(scan) {
  return Boolean(scan && ACTIVE_SCAN_STATUSES.has(scan.status));
}

function scanCountLabel(count) {
  return `${count} scan${count === 1 ? "" : "s"}`;
}

export function scanQueueSummary(scan) {
  const queue = scan?.queue;
  if (!queue || typeof queue !== "object" || Array.isArray(queue)) return null;

  const tags = [];
  const position = normalizeQueueCount(queue.position, { positive: true });
  const ahead = normalizeQueueCount(queue.ahead);
  const perUserLimit = normalizeQueueCount(queue.limits?.perUser, { positive: true });
  if (position !== null) tags.push(`Position ${position}`);
  if (ahead !== null) tags.push(`${scanCountLabel(ahead)} ahead`);
  if (perUserLimit !== null) tags.push(`Per user ${perUserLimit}`);

  return {
    message: firstLineText(queue.message),
    tags,
  };
}

export function useScans({ pollIntervalMs = 1500, limit = 50, status = "", repo = "" } = {}) {
  const [state, setState] = useState({ items: [], loading: true, loadingMore: false, error: "", meta: pageMeta({}, limit) });

  const load = useCallback(async ({ quiet = false, append = false, offset = 0 } = {}) => {
    setState((current) => ({ ...current, loading: quiet || append ? current.loading : true, loadingMore: append, error: "" }));
    try {
      const payload = await pullwiseApi.scans.list(listParams({ limit, offset, status, repo }));
      const nextItems = itemsFrom(payload, "items", "scans").map(normalizeScan);
      setState((current) => ({
        items: append ? [...current.items, ...nextItems] : nextItems,
        loading: false,
        loadingMore: false,
        error: "",
        meta: pageMeta(payload, limit),
      }));
    } catch (error) {
      const message = error?.message || "Unable to load scans.";
      setState((current) => ({
        items: quiet ? current.items : [],
        loading: false,
        loadingMore: false,
        error: message,
        meta: quiet ? current.meta : pageMeta({}, limit),
      }));
    }
  }, [limit, status, repo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!state.items.some(isActiveScan)) return undefined;
    const handle = setTimeout(() => {
      load({ quiet: true });
    }, pollIntervalMs);
    return () => clearTimeout(handle);
  }, [state.items, load, pollIntervalMs]);

  const loadMore = useCallback(() => {
    if (!state.meta.hasMore || state.loadingMore) return;
    load({ append: true, offset: state.meta.nextOffset ?? state.items.length });
  }, [load, state.meta, state.loadingMore, state.items.length]);

  return { ...state, reload: load, loadMore };
}

const TERMINAL_SCAN_STATUSES = new Set(["done", "failed", "cancelled"]);

export function isTerminalScan(scan) {
  return Boolean(scan && TERMINAL_SCAN_STATUSES.has(scan.status));
}

function scanCreatePayload({ repoId = "", repo, branch, commit = "pending", requestId = "" }) {
  const payload = { branch: branch || "main", commit: commit || "pending" };
  if (repoId) payload.repoId = repoId;
  if (repo) payload.repo = repo;
  if (requestId) payload.requestId = requestId;
  return payload;
}

// Creates or resumes a scan, then polls /scans/{id} every `pollIntervalMs`
// until the scan reaches a terminal status.
export function useScanRun({
  repoId = "",
  repo,
  branch,
  commit = "pending",
  requestId = "",
  scanId = "",
  initialScan = null,
  pollIntervalMs = 1500,
}) {
  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const initialScanRef = useRef(initialScan);

  useEffect(() => {
    initialScanRef.current = initialScan;
  }, [initialScan]);

  useEffect(() => {
    if (scanId) return undefined;
    if (!repo && !repoId) return undefined;
    let alive = true;
    setError("");
    setErrorCode("");
    pullwiseApi.scans
      .create(scanCreatePayload({ repoId, repo, branch, commit, requestId }))
      .then((payload) => {
        if (alive) setScan(normalizeScan(payload));
      })
      .catch((err) => {
        if (alive) {
          setError(err?.message || "Unable to start scan.");
          setErrorCode(textValue(err?.code, err?.payload?.code));
        }
      });
    return () => {
      alive = false;
    };
  }, [scanId, repoId, repo, branch, commit, requestId]);

  useEffect(() => {
    if (!scanId) return undefined;
    let alive = true;
    const seedScan = initialScanRef.current;
    setError("");
    setErrorCode("");
    setScan(seedScan?.id === scanId ? normalizeScan(seedScan) : null);
    pullwiseApi.scans
      .get(scanId)
      .then((payload) => {
        if (alive) setScan(normalizeScan(payload));
      })
      .catch((err) => {
        if (alive) {
          setError(err?.message || "Unable to load scan.");
          setErrorCode(textValue(err?.code, err?.payload?.code));
        }
      });
    return () => {
      alive = false;
    };
  }, [scanId]);

  useEffect(() => {
    if (!scan?.id || isTerminalScan(scan)) return undefined;
    let alive = true;
    const handle = setTimeout(async () => {
      try {
        const next = await pullwiseApi.scans.get(scan.id);
        if (alive) setScan(normalizeScan(next));
      } catch (err) {
        if (alive) {
          setError(err?.message || "Polling failed.");
          setErrorCode(textValue(err?.code, err?.payload?.code));
        }
      }
    }, pollIntervalMs);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [scan, pollIntervalMs]);

  const cancel = async () => {
    if (!scan?.id || isTerminalScan(scan)) return;
    try {
      const updated = await pullwiseApi.scans.cancel(scan.id);
      setScan(normalizeScan(updated));
    } catch (err) {
      setError(err?.message || "Cancel failed.");
      setErrorCode(textValue(err?.code, err?.payload?.code));
    }
  };

  return { scan, error, errorCode, cancel };
}

function scanRequestKey(request) {
  return [
    request.repoId || "",
    request.repo,
    request.branch || "main",
    request.commit || "pending",
    request.requestId || "",
  ].join("\u001f");
}

function normalizeScanRequest(request) {
  return {
    repoId: textValue(request?.repoId),
    repo: request?.repo || "",
    branch: request?.branch || "main",
    commit: request?.commit || "pending",
    requestId: request?.requestId || "",
  };
}

export function useScanBatchRun({ repositories = [], pollIntervalMs = 1500 } = {}) {
  const [scans, setScans] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const requests = repositories
    .map(normalizeScanRequest)
    .filter((request) => request.repo || request.repoId);
  const requestKey = requests.map(scanRequestKey).join("\u001e");
  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  useEffect(() => {
    const nextRequests = requestsRef.current;
    if (!requestKey) {
      setScans((current) => (current.length ? [] : current));
      setBatchResults((current) => (current.length ? [] : current));
      setError((current) => (current ? "" : current));
      setErrorCode((current) => (current ? "" : current));
      return undefined;
    }

    let alive = true;
    setScans((current) => (current.length ? [] : current));
    setBatchResults(
      nextRequests.map((request) => ({
        repo: request.repo || request.repoId,
        branch: request.branch || "main",
        requestId: request.requestId || "",
        status: "creating",
        scanId: "",
        scan: null,
        error: "",
        errorCode: "",
      }))
    );
    setError((current) => (current ? "" : current));
    setErrorCode((current) => (current ? "" : current));

    Promise.allSettled(
      nextRequests.map((request) => pullwiseApi.scans.create(scanCreatePayload(request)))
    ).then((results) => {
      if (!alive) return;
      const createdScans = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => normalizeScan(result.value));
      const failed = results.find((result) => result.status === "rejected");
      setScans(createdScans);
      setBatchResults(
        results.map((result, index) => {
          const request = nextRequests[index] || {};
          if (result.status === "fulfilled") {
            const scan = normalizeScan(result.value);
            return {
              repo: scan.repo || request.repo || request.repoId,
              branch: scan.branch || request.branch || "main",
              requestId: request.requestId || "",
              status: scan.status,
              scanId: scan.id,
              scan,
              error: "",
              errorCode: "",
            };
          }
          return {
            repo: request.repo || request.repoId,
            branch: request.branch || "main",
            requestId: request.requestId || "",
            status: "failed",
            scanId: "",
            scan: null,
            error: result.reason?.message || "Unable to start scan.",
            errorCode: textValue(result.reason?.code, result.reason?.payload?.code),
          };
        })
      );
      if (failed) {
        setError(failed.reason?.message || "Unable to start one or more scans.");
        setErrorCode(textValue(failed.reason?.code, failed.reason?.payload?.code));
      }
    });

    return () => {
      alive = false;
    };
  }, [requestKey]);

  useEffect(() => {
    const activeScans = scans.filter((scan) => scan?.id && !isTerminalScan(scan));
    if (!activeScans.length) return undefined;

    let alive = true;
    const handle = setTimeout(async () => {
      try {
        const updates = await Promise.all(
          activeScans.map((scan) => pullwiseApi.scans.get(scan.id))
        );
        if (!alive) return;
        const byId = new Map(updates.map((scan) => [String(scan.id || ""), normalizeScan(scan)]));
        setScans((current) => current.map((scan) => byId.get(scan.id) || scan));
        setBatchResults((current) =>
          current.map((row) => {
            const nextScan = byId.get(row.scanId);
            return nextScan ? { ...row, status: nextScan.status, scan: nextScan } : row;
          })
        );
      } catch (err) {
        if (alive) {
          setError(err?.message || "Polling failed.");
          setErrorCode(textValue(err?.code, err?.payload?.code));
        }
      }
    }, pollIntervalMs);

    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [scans, pollIntervalMs]);

  const cancel = async () => {
    const activeScans = scans.filter((scan) => scan?.id && !isTerminalScan(scan));
    if (!activeScans.length) return;

    try {
      const updates = await Promise.all(
        activeScans.map((scan) => pullwiseApi.scans.cancel(scan.id))
      );
      const byId = new Map(updates.map((scan) => [String(scan.id || ""), normalizeScan(scan)]));
      setScans((current) => current.map((scan) => byId.get(scan.id) || scan));
      setBatchResults((current) =>
        current.map((row) => {
          const nextScan = byId.get(row.scanId);
          return nextScan ? { ...row, status: nextScan.status, scan: nextScan } : row;
        })
      );
    } catch (err) {
      setError(err?.message || "Cancel failed.");
      setErrorCode(textValue(err?.code, err?.payload?.code));
    }
  };

  return { scans, batchResults, error, errorCode, cancel };
}
