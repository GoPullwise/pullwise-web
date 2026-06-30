import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";

const successfulListCache = new Map();
const issueUpdateCache = new Map();
const issueUpdateByIdCache = new Map();
const inFlightDataRequests = new Map();
const ISSUE_UPDATE_KEY_FIELDS = [
  "id",
  "scanId",
  "jobId",
  "repo",
  "file",
  "line",
  "title",
  "createdAt",
];

function pageIsHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function onVisible(callback) {
  if (typeof document === "undefined") return undefined;
  const handleVisibility = () => {
    if (document.visibilityState !== "hidden") callback();
  };
  document.addEventListener("visibilitychange", handleVisibility);
  return () => document.removeEventListener("visibilitychange", handleVisibility);
}

function stableCacheKey(name, params = {}) {
  return [
    name,
    ...Object.entries(params)
      .filter(([, value]) => value !== "" && value !== undefined && value !== null)
      .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`),
  ].join("|");
}

function makeAbortController() {
  return typeof AbortController === "function" ? new AbortController() : null;
}

function bulkScanStatusUnavailable(error) {
  return error?.status === 404 || error?.status === 405;
}

async function fetchScanStatusUpdates(scanIds, { signal } = {}) {
  if (typeof pullwiseApi.scans.status === "function") {
    try {
      return await pullwiseApi.scans.status(scanIds, { signal });
    } catch (error) {
      if (!bulkScanStatusUnavailable(error)) throw error;
    }
  }
  return Promise.all(scanIds.map((scanId) => pullwiseApi.scans.get(scanId, { signal })));
}

function createAbortError() {
  if (typeof DOMException === "function") {
    return new DOMException("Request aborted", "AbortError");
  }
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return error;
}

function isAbortError(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED"
  );
}

function dedupedDataRequest(key, fetcher, ownerSignal) {
  if (ownerSignal?.aborted) return Promise.reject(createAbortError());
  let entry = inFlightDataRequests.get(key);
  if (!entry) {
    const controller = makeAbortController();
    entry = {
      consumers: 0,
      controller,
      done: false,
      promise: Promise.resolve()
        .then(() => fetcher(controller?.signal))
        .finally(() => {
          entry.done = true;
          if (inFlightDataRequests.get(key) === entry) {
            inFlightDataRequests.delete(key);
          }
        }),
    };
    entry.promise.catch(() => {});
    inFlightDataRequests.set(key, entry);
  }
  entry.consumers += 1;

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    entry.consumers = Math.max(0, entry.consumers - 1);
    if (!entry.done && entry.consumers === 0 && ownerSignal?.aborted) {
      entry.controller?.abort();
    }
  };

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      release();
      reject(createAbortError());
    };
    ownerSignal?.addEventListener?.("abort", onAbort, { once: true });
    entry.promise.then(
      (value) => {
        ownerSignal?.removeEventListener?.("abort", onAbort);
        release();
        resolve(value);
      },
      (error) => {
        ownerSignal?.removeEventListener?.("abort", onAbort);
        release();
        reject(error);
      }
    );
  });
}

function cloneListState(state) {
  return {
    ...state,
    items: Array.isArray(state.items) ? [...state.items] : [],
    installations: Array.isArray(state.installations)
      ? [...state.installations]
      : state.installations,
    installationAccounts: Array.isArray(state.installationAccounts)
      ? [...state.installationAccounts]
      : state.installationAccounts,
    meta: state.meta ? { ...state.meta } : state.meta,
  };
}

function cachedListState(key) {
  const cached = successfulListCache.get(key);
  if (!cached) return null;
  const state = cloneListState(cached);
  if (key.startsWith("issues|") || key === "issues") {
    state.items = applyCachedIssueUpdates(state.items).filter((issue) =>
      issueMatchesRequestFilters(issue, issueFiltersFromCacheKey(key))
    );
  }
  return state;
}

function rememberListState(key, state) {
  successfulListCache.set(
    key,
    cloneListState({ ...state, loading: false, loadingMore: false, error: "" })
  );
}

export function clearPullwiseDataCache() {
  successfulListCache.clear();
  issueUpdateCache.clear();
  issueUpdateByIdCache.clear();
  for (const entry of inFlightDataRequests.values()) {
    entry.controller?.abort?.();
  }
  inFlightDataRequests.clear();
}

export function issueUpdateKey(issue) {
  return JSON.stringify(ISSUE_UPDATE_KEY_FIELDS.map((field) => String(issue?.[field] ?? "")));
}

function applyCachedIssueUpdates(items) {
  if (!Array.isArray(items) || (issueUpdateCache.size === 0 && issueUpdateByIdCache.size === 0)) {
    return items;
  }
  return items.map(applyCachedIssueUpdate);
}

export function applyCachedIssueUpdate(issue) {
  const normalized = normalizeIssue(issue);
  const updated =
    issueUpdateCache.get(issueUpdateKey(normalized)) ||
    issueUpdateByIdCache.get(normalized.id);
  return updated ? { ...normalized, ...updated } : normalized;
}

function issueFiltersFromCacheKey(cacheKey) {
  const filters = {};
  for (const part of String(cacheKey || "").split("|").slice(1)) {
    const separatorIndex = part.indexOf(":");
    if (separatorIndex <= 0) continue;
    filters[part.slice(0, separatorIndex)] = part.slice(separatorIndex + 1);
  }
  return filters;
}

function issueMatchesRequestFilters(issue, { status, severity, scanId } = {}) {
  if (status && status !== "all" && issue.status !== status) return false;
  if (severity && severity !== "all" && issue.severity && issue.severity !== severity) return false;
  if (scanId && issue.scanId && issue.scanId !== scanId) return false;
  return true;
}

export function rememberIssueUpdate(issue, updatedIssue) {
  const key = issueUpdateKey(issue);
  const normalized = normalizeIssue({ ...issue, ...updatedIssue });
  issueUpdateCache.set(key, normalized);
  if (normalized.id) issueUpdateByIdCache.set(normalized.id, normalized);
  for (const [cacheKey, state] of successfulListCache.entries()) {
    if (!cacheKey.startsWith("issues|") && cacheKey !== "issues") continue;
    const filters = issueFiltersFromCacheKey(cacheKey);
    rememberListState(cacheKey, {
      ...state,
      items: applyCachedIssueUpdates(state.items).filter((issue) =>
        issueMatchesRequestFilters(issue, filters)
      ),
    });
  }
}

function useInitialCachedListState(cacheKey) {
  const initialCacheRef = useRef(null);
  if (!initialCacheRef.current) {
    const state = cachedListState(cacheKey);
    initialCacheRef.current = {
      cacheKey,
      state,
      hasState: Boolean(state),
    };
  }
  const isInitialCacheKey = initialCacheRef.current.cacheKey === cacheKey;
  return {
    initialCachedState: isInitialCacheKey ? initialCacheRef.current.state : null,
    shouldRefreshQuietly: isInitialCacheKey && initialCacheRef.current.hasState,
  };
}

if (import.meta.env?.MODE === "test") {
  globalThis.__clearPullwiseDataCache = clearPullwiseDataCache;
}

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

function normalizePreflight(preflight) {
  if (!objectRecord(preflight)) return null;
  const manifests = Array.isArray(preflight.manifests)
    ? preflight.manifests
        .map((item) =>
          objectRecord(item) ? { file: textValue(item.file), type: textValue(item.type) } : null
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
  const environment = objectRecord(preflight.environment)
    ? {
        os: textValue(preflight.environment.os),
        osRelease: textValue(preflight.environment.osRelease),
        platform: textValue(preflight.environment.platform),
        machine: textValue(preflight.environment.machine),
        pythonVersion: textValue(preflight.environment.pythonVersion),
      }
    : null;
  const repositoryStats = normalizePreflightRepositoryStats(preflight.repositoryStats);
  const repositoryLimits = normalizePreflightRepositoryLimits(preflight.repositoryLimits);
  return {
    mode: textValue(preflight.mode),
    execution: textValue(preflight.execution),
    summary: textValue(preflight.summary),
    repo: textValue(preflight.repo),
    branch: textValue(preflight.branch),
    commit: textValue(preflight.commit),
    workerVersion: textValue(preflight.workerVersion),
    environment,
    provider: textValue(preflight.provider),
    languages: normalizeTextList(preflight.languages),
    packageManagers: normalizeTextList(preflight.packageManagers),
    availableScripts: normalizeTextList(preflight.availableScripts),
    limitations: normalizeTextList(preflight.limitations),
    repositoryStats,
    repositoryLimits,
    repositoryLimitExceeded: normalizeBoolean(preflight.repositoryLimitExceeded),
    repositoryLimitReasons: normalizeTextList(preflight.repositoryLimitReasons),
    manifests,
    toolVersions,
  };
}

function normalizePreflightRepositoryStats(value) {
  if (!objectRecord(value)) return null;
  const stats = {
    fileCount: normalizeCount(value.fileCount),
    totalBytes: normalizeCount(value.totalBytes),
  };
  if (normalizeBoolean(value.scanStoppedEarly)) stats.scanStoppedEarly = true;
  return stats.fileCount || stats.totalBytes || stats.scanStoppedEarly ? stats : null;
}

function normalizePreflightRepositoryLimits(value) {
  if (!objectRecord(value)) return null;
  const limits = {
    maxFiles: normalizeCount(value.maxFiles),
    maxBytes: normalizeCount(value.maxBytes),
  };
  return limits.maxFiles || limits.maxBytes ? limits : null;
}

function normalizeProgress(value) {
  const progress = Number(value ?? 0);
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

const INCOMPLETE_TERMINAL_SCAN_PROGRESS_MAX = 94;
const INCOMPLETE_TERMINAL_SCAN_STATUSES = new Set(["failed", "cancelled", "lost"]);

function normalizeScanProgressForStatus(status, value) {
  const progress = normalizeProgress(value);
  if (status === "done") return 100;
  if (INCOMPLETE_TERMINAL_SCAN_STATUSES.has(status)) {
    return Math.min(progress, INCOMPLETE_TERMINAL_SCAN_PROGRESS_MAX);
  }
  return progress;
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

function normalizeScanRetry(value) {
  if (!objectRecord(value)) return null;
  const maxAttempts = normalizeQueueCount(value.maxAttempts ?? value.max_attempts, { positive: true }) || 1;
  const attempt = normalizeQueueCount(value.attempt) || 0;
  const retryAttempts = normalizeQueueCount(value.retryAttempts ?? value.retry_attempts) ?? Math.max(0, maxAttempts - 1);
  const remainingAttempts = Math.min(
    maxAttempts,
    normalizeQueueCount(value.remainingAttempts ?? value.remaining_attempts) || 0
  );
  const attemptedWorkers = normalizeQueueCount(value.attemptedWorkers ?? value.attempted_workers) || 0;
  return {
    attempt,
    maxAttempts,
    retryAttempts,
    remainingAttempts,
    attemptedWorkers,
    reason: textValue(value.reason),
  };
}

function normalizeAiUsage(value) {
  const source = objectRecord(value) ? value : {};
  const agentCli = textValue(source.agentCli);
  const provider = textValue(source.provider);
  const model = textValue(source.model);
  const reasoningEffort = textValue(source.reasoningEffort);
  const usage = {};
  if (agentCli) usage.agentCli = agentCli;
  if (provider) usage.provider = provider;
  if (model) usage.model = model;
  if (reasoningEffort) usage.reasoningEffort = reasoningEffort;
  return Object.keys(usage).length ? usage : null;
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

const NORMALIZED_SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);
const SEVERITY_ALIASES = {
  p0: "critical",
  p1: "high",
  p2: "medium",
  p3: "low",
  p4: "info",
};

function normalizeSeverityValue(value) {
  const severity = textValue(value).toLowerCase();
  return SEVERITY_ALIASES[severity] || (NORMALIZED_SEVERITIES.has(severity) ? severity : "");
}

function normalizeSeverity(value) {
  return normalizeSeverityValue(value) || "info";
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
  const status = textValue(value).toLowerCase();
  const normalized =
    {
      canceled: "cancelled",
      complete: "done",
      completed: "done",
    }[status] || status;
  return ["queued", "running", "done", "failed", "cancelled", "lost"].includes(normalized)
    ? normalized
    : "queued";
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
  const reserved = normalizeQuotaCount(value.reserved);
  const limit = normalizeQuotaCount(value.limit);
  const remaining = Object.prototype.hasOwnProperty.call(value, "remaining")
    ? normalizeQuotaCount(value.remaining)
    : Math.max(0, limit - used - reserved);
  return {
    ...value,
    scope: textValue(value.scope, value.scopeType, value.scope_type),
    period: textValue(value.period),
    plan: textValue(value.plan),
    used,
    reserved,
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
      const startLine = normalizeLineNumber(
        location.startLine ?? location.start_line ?? location.line
      );
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
      const outputRedacted =
        normalizeBoolean(item.outputRedacted) || Boolean(multilineTextValue(item.output));
      const url = normalizeReferenceUrl(item.url);
      if (!summary && !file && !command && !logPath && !url) return null;
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
        outputRedacted,
        url,
      };
    })
    .filter(Boolean);
}

function normalizeReproduction(value) {
  const source = objectRecord(value) ? value : {};
  return {
    commands: normalizeTextList(source.commands),
    steps: normalizeTextList(source.steps ?? source.verification_steps),
    input: textValue(source.input),
    expected: textValue(source.expected),
    actual: textValue(source.actual),
    testFile: textValue(source.testFile, source.test_file),
    logPath: textValue(source.logPath, source.log_path),
    exitCode: normalizeCount(source.exitCode ?? source.exit_code),
  };
}

function normalizeGraphVerifiedGraphEvidence(value) {
  const source = objectRecord(value) ? value : {};
  const evidence = {
    sliceId: textValue(source.slice_id, source.sliceId),
    codegraphFiles: normalizeTextList(source.codegraph_files ?? source.codegraphFiles),
    pathSummary: normalizeTextList(source.path_summary ?? source.pathSummary),
  };
  return evidence.sliceId || evidence.codegraphFiles.length || evidence.pathSummary.length
    ? evidence
    : null;
}

function normalizeGraphVerifiedCodeEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!objectRecord(item)) return null;
      const file = textValue(item.file, item.path);
      const lines = textValue(item.lines);
      const whyItMatters = multilineTextValue(item.why_it_matters ?? item.whyItMatters ?? item.summary);
      if (!file && !lines && !whyItMatters) return null;
      return { file, lines, whyItMatters };
    })
    .filter(Boolean);
}

function normalizeGraphVerifiedJudgeEvidence(value) {
  const source = objectRecord(value) ? value : {};
  const hasSafeToShow =
    typeof source.safeToShowUser === "boolean" || typeof source.safe_to_show_user === "boolean";
  const evidence = {
    status: textValue(source.status),
    level: textValue(source.level),
    safeToShowUser: source.safeToShowUser === false ? false : source.safe_to_show_user === false ? false : true,
    reason: multilineTextValue(source.reason),
    command: textValue(source.command),
    logPath: textValue(source.logPath, source.log_path),
    observable: multilineTextValue(source.observable),
  };
  return evidence.status ||
    evidence.level ||
    evidence.reason ||
    evidence.command ||
    evidence.logPath ||
    evidence.observable ||
    hasSafeToShow
    ? evidence
    : null;
}

function normalizeGraphVerifiedReproProof(value) {
  const source = objectRecord(value) ? value : {};
  const verificationSteps = normalizeTextList(source.verificationSteps ?? source.verification_steps);
  const proof = {
    type: textValue(source.type),
    expected: multilineTextValue(source.expected),
    actual: multilineTextValue(source.actual),
    logExcerpt: multilineTextValue(source.logExcerpt, 2000) || multilineTextValue(source.log_excerpt, 2000),
    verificationSteps,
    graphPathExercised: source.graphPathExercised === true || source.graph_path_exercised === true,
  };
  return proof.type ||
    proof.expected ||
    proof.actual ||
    proof.logExcerpt ||
    proof.verificationSteps.length ||
    proof.graphPathExercised
    ? proof
    : null;
}

function normalizeGraphVerifiedIssue(issue, id, title) {
  const graphVerifiedItem = objectRecord(issue.graphVerifiedItem) ? { ...issue.graphVerifiedItem } : {};
  const normalized = {
    id,
    scanId: textValue(issue.scanId),
    jobId: textValue(issue.jobId),
    repo: textValue(issue.repo),
    branch: textValue(issue.branch),
    commit: textValue(issue.commit),
    status: normalizeIssueStatus(issue.status),
    severity: normalizeSeverity(issue.severity),
    category: textValue(issue.category) || "General",
    title,
    summary: multilineTextValue(issue.summary),
    graphVerified: true,
    candidateId: textValue(issue.candidateId),
    dedupeKey: textValue(issue.dedupeKey),
    verificationLevel: textValue(issue.verificationLevel),
    reproductionPath: textValue(issue.reproductionPath),
    verificationStatus: normalizeVerificationStatus(issue.verificationStatus),
    confidenceLevel: normalizeConfidenceLevel(issue.confidenceLevel),
    safeToShowUser: issue.safeToShowUser !== false,
    graphEvidence: normalizeGraphVerifiedGraphEvidence(issue.graphEvidence),
    codeEvidence: normalizeGraphVerifiedCodeEvidence(issue.codeEvidence),
    affectedLocations: normalizeLocations(issue.affectedLocations),
    triggerCondition: multilineTextValue(issue.triggerCondition),
    expectedBehavior: multilineTextValue(issue.expectedBehavior),
    observedBehavior: multilineTextValue(issue.observedBehavior),
    reproduction: normalizeReproduction(issue.reproduction),
    whyThisMatters: multilineTextValue(issue.whyThisMatters),
    suggestedFixDirection: multilineTextValue(issue.suggestedFixDirection),
    limitations: normalizeTextList(issue.limitations),
    graphVerifiedReport: objectRecord(issue.graphVerifiedReport) ? { ...issue.graphVerifiedReport } : {},
    graphVerifiedItem,
    judgeEvidence: normalizeGraphVerifiedJudgeEvidence(issue.judgeEvidence),
    reproProof: normalizeGraphVerifiedReproProof(issue.reproProof),
    file: textValue(issue.file),
    line: normalizeLineNumber(issue.line),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    age: issue.age || formatTime(issue.createdAt || issue.updatedAt),
    autoFix: false,
    autoFixable: false,
    pullRequest: undefined,
    pullRequestPending: undefined,
  };
  return normalized;
}

function normalizeReasoningBreakdown(value) {
  const source = objectRecord(value) ? value : {};
  return {
    facts: normalizeTextList(source.facts),
    inferences: normalizeTextList(source.inferences),
    recommendations: normalizeTextList(source.recommendations),
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
function normalizeScanProgressLog(value) {
  if (!objectRecord(value)) return null;
  const entry = {};
  const time = normalizeTimestamp(value.time ?? value.logTime ?? value.log_time);
  if (time !== null) entry.time = time;
  const phase = textValue(value.phase);
  if (phase) entry.phase = phase;
  if (Object.prototype.hasOwnProperty.call(value, "progress")) {
    entry.progress = normalizeProgress(value.progress);
  }
  const message = textValue(value.message, value.progressMessage, value.progress_message);
  if (message) entry.message = message;
  const logsSummary = textValue(value.logsSummary, value.logs_summary);
  if (logsSummary) entry.logsSummary = logsSummary;
  return Object.keys(entry).length ? entry : null;
}

function normalizeScanProgressLogs(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeScanProgressLog).filter(Boolean).slice(-20);
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
  if (issue.graphVerified) return normalizeGraphVerifiedIssue(issue, id, title);
  const autoFix = normalizeBoolean(issue.autoFix);
  const autoFixable = normalizeBoolean(issue.autoFixable);
  const normalized = {
    id,
    scanId: textValue(issue.scanId),
    repo: textValue(issue.repo),
    branch: textValue(issue.branch, issue.audit?.branch),
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
    audit: objectRecord(issue.audit) ? { ...issue.audit } : {},
    commit: textValue(issue.commit, issue.audit?.commit),
    jobId: textValue(issue.jobId, issue.audit?.jobId),
    severity: normalizeSeverity(issue.severity),
    category: textValue(issue.category) || "General",
    status: normalizeIssueStatus(issue.status),
    file: textValue(issue.file),
    line: normalizeLineNumber(issue.line),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    confidence: normalizeConfidence(issue.confidence),
    confidenceRationale: textValue(issue.confidenceRationale),
    effort: textValue(issue.effort) || "-",
    fixBenefits: textValue(issue.fixBenefits),
    fixRisks: textValue(issue.fixRisks),
    age: issue.age || formatTime(issue.createdAt || issue.updatedAt),
    autoFix,
    autoFixable,
    fixabilityState: textValue(issue.fixabilityState, issue.fixability_state),
    fixabilityReason: textValue(issue.fixabilityReason, issue.fixability_reason),
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
  const status = normalizeScanStatus(scan.status);
  const billingUsage = normalizeQuotaUsage(scan.billingUsage);
  const repoUsage = normalizeQuotaUsage(scan.repoUsage);
  const quotaBucketIds = objectRecord(scan.quotaBucketIds) ? { ...scan.quotaBucketIds } : {};
  const graphVerifiedReport = normalizeGraphVerifiedReport(scan.graphVerifiedReport);
  return {
    id: textValue(scan.id),
    repo: textValue(scan.repo),
    branch: textValue(scan.branch) || "main",
    commit: textValue(scan.commit) || "-",
    status,
    phase: textValue(scan.phase),
    createdAt: scan.createdAt,
    startedAt: normalizeTimestamp(scan.startedAt ?? scan.started_at) ?? scan.startedAt,
    completedAt: normalizeTimestamp(scan.completedAt ?? scan.completed_at) ?? scan.completedAt,
    updatedAt: normalizeTimestamp(scan.updatedAt ?? scan.updated_at) ?? scan.updatedAt,
    time: textValue(scan.time) || formatTime(scan.createdAt),
    by: textValue(scan.by) || "you",
    progress: normalizeScanProgressForStatus(status, scan.progress),
    progressMessage: textValue(scan.progressMessage, scan.progress_message),
    logsSummary: textValue(scan.logsSummary, scan.logs_summary),
    progressLogs: normalizeScanProgressLogs(scan.progressLogs ?? scan.progress_logs),
    issues: normalizeIssueCounts(scan.issues),
    verification: normalizeVerificationCounts(scan.verification),
    aiUsage: normalizeAiUsage(scan.aiUsage, scan),
    preflight: normalizePreflight(scan.preflight),
    graphVerifiedReport,
    repoId: textValue(scan.repoId),
    githubRepoId: textValue(scan.githubRepoId),
    queue: objectRecord(scan.queue) ? { ...scan.queue } : null,
    retry: normalizeScanRetry(scan.retry),
    quotaBucketIds,
    billingUsage,
    repoUsage,
  };
}

function normalizeGraphVerifiedReport(value) {
  if (!objectRecord(value)) return null;
  const finalJson = objectRecord(value.finalJson)
    ? { ...value.finalJson }
    : {};
  const confirmed = Array.isArray(finalJson.confirmed)
    ? finalJson.confirmed.filter(objectRecord)
    : [];
  const report = {
    version: textValue(value.version) || "graph-verified-code-review/1",
    runId: textValue(value.runId),
    mode: textValue(value.mode),
    head: textValue(value.head),
    confirmedCount: normalizeCount(value.confirmedCount),
    rejectedCount: normalizeCount(value.rejectedCount),
    blockedCount: normalizeCount(value.blockedCount),
    finalJson: { ...finalJson, confirmed },
  };
  for (const key of ["coverage", "reviewUnits", "review_units"]) {
    if (objectRecord(value[key]) || Array.isArray(value[key])) {
      report[key] = value[key];
    }
  }
  return report.runId ||
    report.mode ||
    report.confirmedCount ||
    report.rejectedCount ||
    report.blockedCount ||
    confirmed.length ||
    report.coverage ||
    report.reviewUnits ||
    report.review_units ||
    report.finalJson.coverage ||
    report.finalJson.reviewUnits ||
    report.finalJson.review_units
    ? report
    : null;
}

export function useRepositories({ limit = 100 } = {}) {
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const cacheKey = stableCacheKey("repositories", { limit });
  const { initialCachedState, shouldRefreshQuietly } = useInitialCachedListState(cacheKey);
  const [state, setState] = useState(() => ({
    items: [],
    meta: pageMeta({}, limit),
    installations: [],
    installationAccounts: [],
    userQuota: null,
    needsAuthorization: false,
    ...(initialCachedState || {}),
    loading: !shouldRefreshQuietly,
    loadingMore: false,
    error: "",
  }));

  const load = useCallback(
    async ({ sync = false, quiet = false, append = false, offset = 0 } = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      abortRef.current?.abort?.();
      const controller = makeAbortController();
      abortRef.current = controller;
      setState((current) => ({
        ...current,
        loading: quiet || append ? current.loading : true,
        loadingMore: append,
        error: "",
      }));
      try {
        const params = listParams({ limit, offset });
        const payload = sync
          ? await pullwiseApi.repositories.sync(undefined, { signal: controller?.signal })
          : await dedupedDataRequest(
              stableCacheKey("repositories-request", params),
              (signal) => pullwiseApi.repositories.list(params, { signal }),
              controller?.signal
            );
        if (requestId !== requestIdRef.current) return;
        const nextItems = itemsFrom(payload, "items", "repositories").map(normalizeRepo);
        setState((current) => {
          const nextState = {
            items: append ? [...current.items, ...nextItems] : nextItems,
            installations: itemsFrom(payload, "installations"),
            installationAccounts: itemsFrom(payload, "installationAccounts"),
            userQuota: normalizeQuotaUsage(payload?.userQuota),
            loading: false,
            loadingMore: false,
            error: "",
            meta: pageMeta(payload, limit),
            needsAuthorization: normalizeBoolean(payload?.needsAuthorization),
          };
          rememberListState(cacheKey, nextState);
          return nextState;
        });
      } catch (error) {
        if (isAbortError(error)) return;
        if (requestId !== requestIdRef.current) return;
        setState((current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          error: error?.message || "Unable to load repositories.",
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [cacheKey, limit]
  );

  useEffect(() => {
    load({ quiet: shouldRefreshQuietly });
    return () => abortRef.current?.abort?.();
  }, [load, shouldRefreshQuietly]);

  const loadMore = useCallback(() => {
    if (!state.meta?.hasMore || state.loadingMore) return;
    load({ append: true, offset: state.meta.nextOffset ?? state.items.length });
  }, [load, state.meta, state.loadingMore, state.items.length]);

  return { ...state, reload: load, loadMore };
}

function pageMeta(payload, fallbackLimit) {
  return {
    total: Number.isFinite(Number(payload?.total))
      ? Number(payload.total)
      : itemsFrom(payload, "items").length,
    limit: Number.isFinite(Number(payload?.limit)) ? Number(payload.limit) : fallbackLimit,
    offset: Number.isFinite(Number(payload?.offset)) ? Number(payload.offset) : 0,
    hasMore: Boolean(payload?.hasMore),
    nextOffset: Number.isFinite(Number(payload?.nextOffset)) ? Number(payload.nextOffset) : null,
  };
}

function listParams({ limit, offset, status, severity, q, scanId, repo, sort } = {}) {
  const params = {};
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;
  if (status && status !== "all") params.status = status;
  if (severity && severity !== "all") params.severity = severity;
  if (q) params.q = q;
  if (scanId) params.scanId = scanId;
  if (repo) params.repo = repo;
  if (sort) params.sort = sort;
  return params;
}

const ISSUES_CHANGED_EVENT = "pullwise:issues-changed";

export function notifyIssuesChanged(detail = {}) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent(ISSUES_CHANGED_EVENT, { detail }));
}

export function useIssues({
  limit = 50,
  status = "",
  severity = "",
  q = "",
  scanId = "",
  sort = "",
  refreshOnChange = true,
} = {}) {
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const cacheKey = stableCacheKey("issues", { limit, status, severity, q, scanId, sort });
  const { initialCachedState, shouldRefreshQuietly } = useInitialCachedListState(cacheKey);
  const [state, setState] = useState(() => ({
    items: [],
    meta: pageMeta({}, limit),
    ...(initialCachedState || {}),
    loading: !shouldRefreshQuietly,
    loadingMore: false,
    error: "",
  }));

  const load = useCallback(
    async ({ append = false, offset = 0, quiet = false } = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      abortRef.current?.abort?.();
      const controller = makeAbortController();
      abortRef.current = controller;
      setState((current) => ({
        ...current,
        loading: append || quiet ? current.loading : true,
        loadingMore: append,
        error: "",
      }));
      try {
        const params = listParams({ limit, offset, status, severity, q, scanId, sort });
        const payload = await dedupedDataRequest(
          stableCacheKey("issues-request", params),
          (signal) => pullwiseApi.issues.list(params, { signal }),
          controller?.signal
        );
        if (requestId !== requestIdRef.current) return;
        const nextItems = applyCachedIssueUpdates(
          itemsFrom(payload, "items", "issues").map(normalizeIssue)
        ).filter((issue) => issueMatchesRequestFilters(issue, { status, severity, scanId }));
        setState((current) => {
          const nextState = {
            items: append ? [...current.items, ...nextItems] : nextItems,
            loading: false,
            loadingMore: false,
            error: "",
            meta: pageMeta(payload, limit),
          };
          rememberListState(cacheKey, nextState);
          return nextState;
        });
      } catch (error) {
        if (isAbortError(error)) return;
        if (requestId !== requestIdRef.current) return;
        setState((current) => ({
          items: current.items,
          loading: false,
          loadingMore: false,
          error: error?.message || "Unable to load issues.",
          meta: current.meta,
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [cacheKey, limit, status, severity, q, scanId, sort]
  );

  useEffect(() => {
    load({ quiet: shouldRefreshQuietly });
    return () => abortRef.current?.abort?.();
  }, [load, shouldRefreshQuietly]);

  useEffect(() => {
    if (!refreshOnChange || typeof window === "undefined") return undefined;
    const handleIssuesChanged = () => {
      load({ quiet: true });
    };
    window.addEventListener(ISSUES_CHANGED_EVENT, handleIssuesChanged);
    return () => window.removeEventListener(ISSUES_CHANGED_EVENT, handleIssuesChanged);
  }, [load, refreshOnChange]);

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

function retryCountLabel(count) {
  return `${count} retr${count === 1 ? "y" : "ies"}`;
}

export function scanQueueSummary(scan) {
  const queue = scan?.queue;
  const retry = scan?.retry;
  if ((!queue || typeof queue !== "object" || Array.isArray(queue)) && !retry) return null;

  const tags = [];
  const position = normalizeQueueCount(queue?.position, { positive: true });
  const ahead = normalizeQueueCount(queue?.ahead);
  if (position !== null) tags.push(`Position ${position}`);
  if (ahead !== null) tags.push(`${scanCountLabel(ahead)} ahead`);
  if (retry?.attempt || retry?.maxAttempts > 1) {
    tags.push(`Attempt ${Math.max(0, retry.attempt)} of ${Math.max(1, retry.maxAttempts)}`);
  }
  if (retry?.remainingAttempts > 0) {
    tags.push(`${retryCountLabel(retry.remainingAttempts)} left`);
  }
  if (retry?.reason === "worker_result_failed") {
    tags.push("Retrying after worker failure");
  }

  return {
    message: firstLineText(queue?.message),
    tags,
  };
}

export function useScans({ pollIntervalMs = 1500, limit = 50, status = "", repo = "" } = {}) {
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const cacheKey = stableCacheKey("scans", { limit, status, repo });
  const { initialCachedState, shouldRefreshQuietly } = useInitialCachedListState(cacheKey);
  const [state, setState] = useState(() => ({
    items: [],
    meta: pageMeta({}, limit),
    ...(initialCachedState || {}),
    loading: !shouldRefreshQuietly,
    loadingMore: false,
    error: "",
  }));
  const [pollRetryTick, setPollRetryTick] = useState(0);
  const hasActiveScans = state.items.some(isActiveScan);
  const hasActiveScansRef = useRef(hasActiveScans);
  hasActiveScansRef.current = hasActiveScans;

  const load = useCallback(
    async ({ quiet = false, append = false, offset = 0 } = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      abortRef.current?.abort?.();
      const controller = makeAbortController();
      abortRef.current = controller;
      setState((current) => ({
        ...current,
        loading: quiet || append ? current.loading : true,
        loadingMore: append,
        error: "",
      }));
      try {
        const params = listParams({ limit, offset, status, repo });
        const payload = await dedupedDataRequest(
          stableCacheKey("scans-request", params),
          (signal) => pullwiseApi.scans.list(params, { signal }),
          controller?.signal
        );
        if (requestId !== requestIdRef.current) return;
        const nextItems = itemsFrom(payload, "items", "scans").map(normalizeScan);
        setState((current) => {
          const nextState = {
            items: append ? [...current.items, ...nextItems] : nextItems,
            loading: false,
            loadingMore: false,
            error: "",
            meta: pageMeta(payload, limit),
          };
          rememberListState(cacheKey, nextState);
          return nextState;
        });
      } catch (error) {
        if (isAbortError(error)) return;
        if (requestId !== requestIdRef.current) return;
        const message = error?.message || "Unable to load scans.";
        setState((current) => ({
          items: current.items,
          loading: false,
          loadingMore: false,
          error: message,
          meta: current.meta,
        }));
        if (hasActiveScansRef.current) {
          setPollRetryTick((tick) => tick + 1);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [cacheKey, limit, status, repo]
  );

  useEffect(() => {
    load({ quiet: shouldRefreshQuietly });
    return () => abortRef.current?.abort?.();
  }, [load, shouldRefreshQuietly]);

  useEffect(() => {
    const activeIds = state.items
      .filter(isActiveScan)
      .map((scan) => scan.id)
      .filter(Boolean);
    if (!activeIds.length) return undefined;
    if (pageIsHidden()) {
      return onVisible(() => setPollRetryTick((tick) => tick + 1));
    }
    let alive = true;
    const controller = makeAbortController();
    const pollDelayMs =
      typeof pullwiseApi.scans.status === "function" ? pollIntervalMs : Math.max(pollIntervalMs, 50);
    const handle = setTimeout(() => {
      if (typeof pullwiseApi.scans.status !== "function") {
        load({ quiet: true });
        return;
      }

      const requestKey = stableCacheKey("scans-status-request", { ids: activeIds.join(",") });
      dedupedDataRequest(
        requestKey,
        async (signal) => {
          try {
            return await pullwiseApi.scans.status(activeIds, { signal });
          } catch (error) {
            if (!bulkScanStatusUnavailable(error)) throw error;
            return null;
          }
        },
        controller?.signal
      )
        .then((payload) => {
          if (!alive) return;
          if (payload === null) {
            load({ quiet: true });
            return;
          }
          const updates = Array.isArray(payload) ? payload : itemsFrom(payload, "items", "scans");
          const byId = new Map(
            updates
              .map(normalizeScan)
              .filter((scan) => scan.id)
              .map((scan) => [scan.id, scan])
          );
          if (!byId.size) return;
          setState((current) => {
            const nextItems = current.items
              .map((scan) => byId.get(scan.id) || scan)
              .filter((scan) => !status || status === "all" || scan.status === status);
            const nextState = {
              ...current,
              items: nextItems,
              error: "",
              meta: current.meta,
            };
            rememberListState(cacheKey, nextState);
            return nextState;
          });
        })
        .catch((error) => {
          if (isAbortError(error) || !alive) return;
          setState((current) => ({
            ...current,
            error: error?.message || "Unable to refresh scan status.",
          }));
          setPollRetryTick((tick) => tick + 1);
        });
    }, pollDelayMs);
    return () => {
      alive = false;
      controller?.abort();
      clearTimeout(handle);
    };
  }, [hasActiveScans, state.items, cacheKey, status, pollIntervalMs, pollRetryTick, load]);

  const loadMore = useCallback(() => {
    if (!state.meta.hasMore || state.loadingMore) return;
    load({ append: true, offset: state.meta.nextOffset ?? state.items.length });
  }, [load, state.meta, state.loadingMore, state.items.length]);

  const upsertScan = useCallback(
    (scan, replacedScanId = "") => {
      const normalized = normalizeScan(scan);
      if (!normalized.id) return;
      setState((current) => {
        const shouldInclude = !status || normalized.status === status;
        const remainingItems = current.items.filter(
          (item) => item.id !== normalized.id && item.id !== replacedScanId
        );
        const nextItems = shouldInclude ? [normalized, ...remainingItems] : remainingItems;
        const nextState = {
          ...current,
          items: nextItems,
          meta: {
            ...current.meta,
            total: Math.max(current.meta.total || 0, nextItems.length),
          },
        };
        rememberListState(cacheKey, nextState);
        return nextState;
      });
    },
    [cacheKey, status]
  );

  return { ...state, reload: load, loadMore, upsertScan };
}

const TERMINAL_SCAN_STATUSES = new Set(["done", "failed", "cancelled", "lost"]);

export function isTerminalScan(scan) {
  return Boolean(scan && TERMINAL_SCAN_STATUSES.has(scan.status));
}

export function retryResponseScanPayload(payload) {
  if (objectRecord(payload?.scan)) return payload.scan;
  if (objectRecord(payload?.data?.scan)) return payload.data.scan;
  if (objectRecord(payload?.result?.scan)) return payload.result.scan;
  if (objectRecord(payload?.retry)) return payload.retry;
  return objectRecord(payload) && textValue(payload.id, payload.scanId, payload.scan_id) ? payload : null;
}

export function retryResponseScanId(payload, fallback = "") {
  return textValue(
    payload?.scanId,
    payload?.scan_id,
    payload?.retryScanId,
    payload?.retry_scan_id,
    payload?.newScanId,
    payload?.new_scan_id,
    payload?.id,
    fallback
  );
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [pollRetryTick, setPollRetryTick] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const initialScanRef = useRef(initialScan);
  const errorSourceRef = useRef("");

  const setRunError = useCallback((err, fallback, source) => {
    errorSourceRef.current = source;
    setError(err?.message || fallback);
    setErrorCode(textValue(err?.code, err?.payload?.code));
  }, []);

  const clearRunError = useCallback((sources = null) => {
    if (Array.isArray(sources) && !sources.includes(errorSourceRef.current)) return;
    errorSourceRef.current = "";
    setError("");
    setErrorCode("");
  }, []);

  useEffect(() => {
    initialScanRef.current = initialScan;
  }, [initialScan]);

  useEffect(() => {
    if (scanId) return undefined;
    if (!repo && !repoId) return undefined;
    let alive = true;
    clearRunError();
    pullwiseApi.scans
      .create(scanCreatePayload({ repoId, repo, branch, commit, requestId }))
      .then((payload) => {
        if (alive) {
          setScan(normalizeScan(payload));
          clearRunError();
        }
      })
      .catch((err) => {
        if (alive) {
          setRunError(err, "Unable to start scan.", "create");
        }
      });
    return () => {
      alive = false;
    };
  }, [scanId, repoId, repo, branch, commit, requestId, clearRunError, setRunError]);

  useEffect(() => {
    if (!scanId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    const controller = makeAbortController();
    const seedScan = initialScanRef.current;
    clearRunError();
    setLoading(true);
    setScan(seedScan?.id === scanId ? normalizeScan(seedScan) : null);
    pullwiseApi.scans
      .get(scanId, { signal: controller?.signal })
      .then((payload) => {
        if (alive) {
          setScan(normalizeScan(payload));
          clearRunError();
        }
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        if (alive) {
          setRunError(err, "Unable to load scan.", seedScan?.id === scanId ? "load" : "initial-load");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      controller?.abort();
    };
  }, [scanId, clearRunError, setRunError]);

  useEffect(() => {
    if (!scan?.id || isTerminalScan(scan)) return undefined;
    if (pageIsHidden()) {
      return onVisible(() => setPollRetryTick((tick) => tick + 1));
    }
    let alive = true;
    const controller = makeAbortController();
    const handle = setTimeout(async () => {
      try {
        const payload = await fetchScanStatusUpdates([scan.id], { signal: controller?.signal });
        const next = Array.isArray(payload)
          ? payload[0]
          : itemsFrom(payload, "items", "scans")[0] || payload;
        if (alive) {
          setScan(normalizeScan(next));
          clearRunError(["load", "poll"]);
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (alive) {
          setRunError(err, "Unable to refresh scan status.", "poll");
          setPollRetryTick((tick) => tick + 1);
        }
      }
    }, pollIntervalMs);
    return () => {
      alive = false;
      controller?.abort();
      clearTimeout(handle);
    };
  }, [scan, pollIntervalMs, pollRetryTick, clearRunError, setRunError]);

  const cancel = async () => {
    if (!scan?.id || isTerminalScan(scan) || canceling) return;
    const previousScan = scan;
    const cancelledAt = Math.floor(Date.now() / 1000);
    setCanceling(true);
    clearRunError();
    setScan((current) => {
      if (!current?.id || current.id !== previousScan.id || isTerminalScan(current)) return current;
      return normalizeScan({
        ...current,
        status: "cancelled",
        completedAt: current.completedAt || cancelledAt,
        updatedAt: cancelledAt,
        quotaState: current.quotaState === "reserved" ? "released" : current.quotaState,
        quotaReleasedAt: current.quotaState === "reserved" ? cancelledAt : current.quotaReleasedAt,
      });
    });
    try {
      const updated = await pullwiseApi.scans.cancel(previousScan.id);
      setScan(normalizeScan(updated));
    } catch (err) {
      setScan((current) =>
        current?.id === previousScan.id && current.status === "cancelled" ? previousScan : current
      );
      setRunError(err, "Cancel failed.", "cancel");
    } finally {
      setCanceling(false);
    }
  };

  const retry = async () => {
    if (!scan?.id || !["failed", "cancelled", "lost"].includes(scan.status)) return null;
    setRetrying(true);
    clearRunError();
    try {
      const payload = await pullwiseApi.scans.retry(scan.id);
      const inlinePayload = retryResponseScanPayload(payload);
      if (inlinePayload && textValue(inlinePayload.id, inlinePayload.scanId)) {
        const normalized = normalizeScan(inlinePayload);
        setScan(normalized);
        return normalized;
      }
      const targetScanId = retryResponseScanId(payload, scan.id);
      if (!targetScanId) return null;
      const refreshed = normalizeScan(await pullwiseApi.scans.get(targetScanId));
      setScan(refreshed);
      return refreshed;
    } catch (err) {
      setRunError(err, "Retry failed.", "retry");
      return null;
    } finally {
      setRetrying(false);
    }
  };

  return { scan, loading, error, errorCode, cancel, retry, retrying, canceling };
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

const BATCH_SCAN_CREATE_CONCURRENCY = 3;

async function allSettledWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = { status: "fulfilled", value: await worker(items[index], index) };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    })
  );
  return results;
}

export function useScanBatchRun({ repositories = [], pollIntervalMs = 1500 } = {}) {
  const [scans, setScans] = useState([]);
  const [batchResults, setBatchResults] = useState([]);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [pollRetryTick, setPollRetryTick] = useState(0);
  const [canceling, setCanceling] = useState(false);
  const errorSourceRef = useRef("");
  const requests = repositories
    .map(normalizeScanRequest)
    .filter((request) => request.repo || request.repoId);
  const requestKey = requests.map(scanRequestKey).join("\u001e");
  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  const setRunError = useCallback((err, fallback, source) => {
    errorSourceRef.current = source;
    setError(err?.message || fallback);
    setErrorCode(textValue(err?.code, err?.payload?.code));
  }, []);

  const clearRunError = useCallback((sources = null) => {
    if (Array.isArray(sources) && !sources.includes(errorSourceRef.current)) return;
    errorSourceRef.current = "";
    setError("");
    setErrorCode("");
  }, []);

  useEffect(() => {
    const nextRequests = requestsRef.current;
    if (!requestKey) {
      setScans((current) => (current.length ? [] : current));
      setBatchResults((current) => (current.length ? [] : current));
      clearRunError();
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
    clearRunError();

    allSettledWithConcurrency(nextRequests, BATCH_SCAN_CREATE_CONCURRENCY, (request) =>
      pullwiseApi.scans.create(scanCreatePayload(request))
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
        setRunError(failed.reason, "Unable to start one or more scans.", "create");
      }
    });

    return () => {
      alive = false;
    };
  }, [requestKey, clearRunError, setRunError]);

  useEffect(() => {
    const activeScans = scans.filter((scan) => scan?.id && !isTerminalScan(scan));
    if (!activeScans.length) return undefined;
    if (pageIsHidden()) {
      return onVisible(() => setPollRetryTick((tick) => tick + 1));
    }

    let alive = true;
    const controller = makeAbortController();
    const handle = setTimeout(async () => {
      try {
        const activeIds = activeScans.map((scan) => scan.id);
        const payload = await fetchScanStatusUpdates(activeIds, { signal: controller?.signal });
        const updates = Array.isArray(payload) ? payload : itemsFrom(payload, "items", "scans");
        if (!alive) return;
        const byId = new Map(updates.map((scan) => [String(scan.id || ""), normalizeScan(scan)]));
        setScans((current) => current.map((scan) => byId.get(scan.id) || scan));
        setBatchResults((current) =>
          current.map((row) => {
            const nextScan = byId.get(row.scanId);
            return nextScan ? { ...row, status: nextScan.status, scan: nextScan } : row;
          })
        );
        clearRunError(["poll"]);
      } catch (err) {
        if (isAbortError(err)) return;
        if (alive) {
          setRunError(err, "Unable to refresh scan status.", "poll");
          setPollRetryTick((tick) => tick + 1);
        }
      }
    }, pollIntervalMs);

    return () => {
      alive = false;
      controller?.abort();
      clearTimeout(handle);
    };
  }, [scans, pollIntervalMs, pollRetryTick, clearRunError, setRunError]);

  const cancel = async () => {
    const activeScans = scans.filter((scan) => scan?.id && !isTerminalScan(scan));
    if (!activeScans.length || canceling) return;
    const previousScans = scans;
    const previousBatchResults = batchResults;
    const activeIds = new Set(activeScans.map((scan) => scan.id));
    const cancelledAt = Math.floor(Date.now() / 1000);
    const optimisticCancel = (scan) => {
      if (!scan?.id || !activeIds.has(scan.id) || isTerminalScan(scan)) return scan;
      return normalizeScan({
        ...scan,
        status: "cancelled",
        completedAt: scan.completedAt || cancelledAt,
        updatedAt: cancelledAt,
        quotaState: scan.quotaState === "reserved" ? "released" : scan.quotaState,
        quotaReleasedAt: scan.quotaState === "reserved" ? cancelledAt : scan.quotaReleasedAt,
      });
    };

    try {
      setCanceling(true);
      clearRunError();
      setScans((current) => current.map(optimisticCancel));
      setBatchResults((current) =>
        current.map((row) => {
          const nextScan = optimisticCancel(row.scan);
          return nextScan !== row.scan ? { ...row, status: nextScan.status, scan: nextScan } : row;
        })
      );
      const results = await Promise.allSettled(
        activeScans.map((scan) => Promise.resolve().then(() => pullwiseApi.scans.cancel(scan.id)))
      );
      const updates = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => normalizeScan(result.value));
      const failedIds = new Set(
        results
          .map((result, index) => (result.status === "rejected" ? activeScans[index]?.id : ""))
          .filter(Boolean)
      );
      const failed = results.find((result) => result.status === "rejected");
      const previousById = new Map(previousScans.map((scan) => [scan.id, scan]));
      const previousRowsById = new Map(previousBatchResults.map((row) => [row.scanId, row]));
      const byId = new Map(updates.map((scan) => [String(scan.id || ""), scan]));
      setScans((current) => current.map((scan) => byId.get(scan.id) || scan));
      setBatchResults((current) =>
        current.map((row) => {
          const nextScan = byId.get(row.scanId);
          return nextScan ? { ...row, status: nextScan.status, scan: nextScan } : row;
        })
      );
      if (failed) {
        setScans((current) =>
          current.map((scan) => (failedIds.has(scan.id) ? previousById.get(scan.id) || scan : scan))
        );
        setBatchResults((current) =>
          current.map((row) => {
            if (!failedIds.has(row.scanId)) return row;
            const previous = previousRowsById.get(row.scanId) || row;
            return {
              ...previous,
              error: failed.reason?.message || "Cancel failed.",
              errorCode: textValue(failed.reason?.code, failed.reason?.payload?.code),
            };
          })
        );
        setRunError(failed.reason, "Cancel failed.", "cancel");
      }
    } catch (err) {
      setScans(previousScans);
      setBatchResults(previousBatchResults);
      setRunError(err, "Cancel failed.", "cancel");
    } finally {
      setCanceling(false);
    }
  };

  return { scans, batchResults, error, errorCode, cancel, canceling };
}
