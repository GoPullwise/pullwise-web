import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";

const successfulListCache = new Map();

function stableCacheKey(name, params = {}) {
  return [
    name,
    ...Object.entries(params)
      .filter(([, value]) => value !== "" && value !== undefined && value !== null)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${String(value)}`),
  ].join("|");
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
  return cached ? cloneListState(cached) : null;
}

function rememberListState(key, state) {
  successfulListCache.set(
    key,
    cloneListState({ ...state, loading: false, loadingMore: false, error: "" })
  );
}

export function clearPullwiseDataCache() {
  successfulListCache.clear();
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
                    outputRedacted:
                      normalizeBoolean(attempt.outputRedacted) ||
                      Boolean(textValue(attempt.output)),
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
            outputRedacted:
              normalizeBoolean(item.outputRedacted) || Boolean(textValue(item.output)),
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
    providerChain: normalizeTextList(preflight.providerChain),
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
    verifier,
  };
}

function normalizeLooseStatus(value) {
  const status = textValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return status;
}

function normalizeListEntry(value, index, { fallbackLabel = "" } = {}) {
  if (objectRecord(value)) {
    const label = textValue(
      value.label,
      value.title,
      value.name,
      value.check,
      value.checkpoint,
      value.phase,
      value.stage,
      value.job,
      value.id
    );
    const summary = textValue(
      value.summary,
      value.message,
      value.detail,
      value.reason,
      value.description
    );
    const status = normalizeLooseStatus(
      value.status ?? value.state ?? value.result ?? value.verdict ?? value.outcome
    );
    const at = formatTime(
      value.at ??
        value.time ??
        value.timestamp ??
        value.createdAt ??
        value.created_at ??
        value.updatedAt ??
        value.updated_at ??
        value.finishedAt ??
        value.finished_at
    );
    const item = {
      key:
        textValue(value.key, value.id, value.name, value.label, value.title) ||
        `${fallbackLabel || "item"}_${index}`,
      label: label || summary || fallbackLabel,
      summary: label && summary && summary !== label ? summary : "",
      status,
      at,
      jobId: textValue(value.jobId, value.job_id, value.scanJobId, value.scan_job_id),
      workerId: textValue(
        value.workerId,
        value.worker_id,
        value.workerName,
        value.worker_name,
        value.claimId,
        value.claim_id
      ),
      attempt: normalizeQueueCount(value.attempt, { positive: true }),
      kind: textValue(value.kind, value.type),
    };
    if (!item.label && !item.summary && !item.status && !item.at && !item.jobId && !item.workerId) {
      return null;
    }
    return item;
  }
  const label = firstLineText(value);
  if (!label) return null;
  return {
    key: `${fallbackLabel || "item"}_${index}`,
    label,
    summary: "",
    status: "",
    at: "",
    jobId: "",
    workerId: "",
    attempt: null,
    kind: "",
  };
}

function normalizeCompletionAudit(value) {
  if (!objectRecord(value)) return null;
  const blockers = itemsFrom(value, "blockers", "blockingChecks", "blocking_checks", "gates")
    .map((item, index) => normalizeListEntry(item, index, { fallbackLabel: "blocker" }))
    .filter(Boolean)
    .slice(0, 8);
  const warnings = itemsFrom(value, "warnings", "warningChecks", "warning_checks")
    .map((item, index) => normalizeListEntry(item, index, { fallbackLabel: "warning" }))
    .filter(Boolean)
    .slice(0, 8);
  const checks = itemsFrom(value, "checks", "results", "items")
    .map((item, index) => normalizeListEntry(item, index, { fallbackLabel: "check" }))
    .filter(Boolean)
    .slice(0, 12);
  const audit = {
    status: normalizeLooseStatus(value.status ?? value.state ?? value.result ?? value.verdict),
    outcome: textValue(value.outcome),
    summary: textValue(value.summary, value.message, value.resultSummary, value.result_summary),
    blockers,
    warnings,
    checks,
    completedAt: formatTime(
      value.completedAt ?? value.completed_at ?? value.finishedAt ?? value.finished_at
    ),
    updatedAt: formatTime(value.updatedAt ?? value.updated_at ?? value.lastUpdatedAt),
  };
  return audit.status ||
    audit.outcome ||
    audit.summary ||
    audit.completedAt ||
    audit.updatedAt ||
    blockers.length ||
    warnings.length ||
    checks.length
    ? audit
    : null;
}

function normalizeJobTrace(value) {
  const source = Array.isArray(value) ? { checkpoints: value } : objectRecord(value) ? value : null;
  if (!source) return null;
  const checkpoints = itemsFrom(
    source,
    "checkpoints",
    "steps",
    "entries",
    "events",
    "jobs",
    "trace"
  )
    .map((item, index) => normalizeListEntry(item, index, { fallbackLabel: "checkpoint" }))
    .filter(Boolean)
    .slice(0, 16);
  const trace = {
    status: normalizeLooseStatus(source.status ?? source.state ?? source.result),
    summary: textValue(source.summary, source.message),
    currentJobId: textValue(source.currentJobId, source.current_job_id, source.jobId, source.job_id),
    workerId: textValue(
      source.workerId,
      source.worker_id,
      source.workerName,
      source.worker_name,
      source.claimId,
      source.claim_id
    ),
    updatedAt: formatTime(
      source.updatedAt ??
        source.updated_at ??
        source.lastSeenAt ??
        source.last_seen_at ??
        source.finishedAt ??
        source.finished_at
    ),
    checkpoints,
  };
  return trace.status ||
    trace.summary ||
    trace.currentJobId ||
    trace.workerId ||
    trace.updatedAt ||
    checkpoints.length
    ? trace
    : null;
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

const REPOSITORY_GRAPH_PROTOCOL_VERSIONS = new Set([
  "repository-graph/0.1",
  "repository-graph/0.2",
]);
const REPOSITORY_IMPACT_GRAPH_PROTOCOL_VERSION = "impact-graph/0.1";
const REPOSITORY_SEMANTIC_GRAPH_PROTOCOL_VERSION = "semantic-code-graph/0.1";
const REPOSITORY_GRAPH_MAX_NODES = 120;
const REPOSITORY_GRAPH_MAX_EDGES = 240;
const REPOSITORY_GRAPH_MAX_SEMANTIC_NODES = 120;
const REPOSITORY_GRAPH_MAX_SEMANTIC_EDGES = 240;
const REPOSITORY_GRAPH_MAX_PROMPT_CHARS = 2048;
const REPOSITORY_GRAPH_MAX_EVIDENCE = 4;
const IMPACT_GRAPH_MAX_TARGETS = 120;
const IMPACT_GRAPH_MAX_RELATIONS = 40;
const IMPACT_GRAPH_MAX_COVERAGE_ITEMS = 80;
const REPOSITORY_GRAPH_NODE_TYPES = new Set([
  "entrypoint",
  "module",
  "test",
  "manifest",
  "workflow",
  "doc",
  "config",
  "file",
]);
const REPOSITORY_GRAPH_EDGE_TYPES = new Set([
  "imports",
  "contains",
  "calls",
  "configures",
  "depends_on",
  "tests",
  "documents",
]);
const IMPACT_GRAPH_MODES = new Set(["repository", "changeset", "issue"]);
const REPOSITORY_SEMANTIC_NODE_TYPES = new Set([
  "class",
  "component",
  "function",
  "method",
  "route",
  "variable",
]);
const REPOSITORY_SEMANTIC_EDGE_TYPES = new Set([
  "calls",
  "defines",
  "extends",
  "handles",
  "imports",
  "implements",
  "uses",
]);
const REPOSITORY_GRAPH_ID_RE = /^[A-Za-z0-9_.:/@-]{1,180}$/;

function isSafeRepositoryGraphId(value) {
  const id = textValue(value);
  if (!REPOSITORY_GRAPH_ID_RE.test(id)) return false;
  if (/^[A-Za-z]:\//.test(id) || id.startsWith("/")) return false;
  return !/(^|:)(file|dir|symbol):([A-Za-z]:\/|\/)/i.test(id);
}

function normalizeRepositoryGraph(value) {
  if (!objectRecord(value)) return null;
  const version = textValue(value.version);
  if (!REPOSITORY_GRAPH_PROTOCOL_VERSIONS.has(version)) return null;
  const nodes = [];
  const nodeIds = new Set();
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  for (const item of rawNodes) {
    const node = normalizeRepositoryGraphNode(item);
    if (!node || nodeIds.has(node.id)) continue;
    nodeIds.add(node.id);
    nodes.push(node);
    if (nodes.length >= REPOSITORY_GRAPH_MAX_NODES) break;
  }
  const edges = [];
  const edgeIds = new Set();
  const rawEdges = Array.isArray(value.edges) ? value.edges : [];
  for (const item of rawEdges) {
    const edge = normalizeRepositoryGraphEdge(item, nodeIds);
    if (!edge || edgeIds.has(edge.id)) continue;
    edgeIds.add(edge.id);
    edges.push(edge);
    if (edges.length >= REPOSITORY_GRAPH_MAX_EDGES) break;
  }
  const graph = {
    version,
    generatedAt: normalizeQuotaCount(value.generatedAt, 0),
    repo: textValue(value.repo),
    branch: textValue(value.branch) || "main",
    commit: textValue(value.commit) || "pending",
    summary: textValue(value.summary),
    stats: normalizeRepositoryGraphStats(value.stats, nodes, edges, rawNodes.length, rawEdges.length),
    nodes,
    edges,
    architectureSummary: normalizeRepositoryGraphArchitectureSummary(value.architectureSummary),
  };
  const impactGraph = normalizeImpactGraph(value.impactGraph);
  if (impactGraph) graph.impactGraph = impactGraph;
  if (!graph.summary) delete graph.summary;
  if (!Object.keys(graph.architectureSummary).length) delete graph.architectureSummary;
  return graph;
}

function normalizeRepositoryGraphNode(value) {
  if (!objectRecord(value)) return null;
  const id = textValue(value.id);
  const type = textValue(value.type);
  const path = normalizeRepositoryGraphPath(value.path);
  if (!id || !isSafeRepositoryGraphId(id) || !REPOSITORY_GRAPH_NODE_TYPES.has(type) || !path) {
    return null;
  }
  const node = {
    id,
    label: textValue(value.label).slice(0, 80) || path.split("/").pop() || id,
    type,
    path,
  };
  const importance = Number(value.importance);
  if (Number.isFinite(importance)) node.importance = Math.max(0, Math.min(1, importance));
  const tags = normalizeTextList(value.tags).slice(0, 10);
  if (tags.length) node.tags = tags;
  return node;
}

function normalizeRepositoryGraphEdge(value, nodeIds) {
  if (!objectRecord(value)) return null;
  const source = textValue(value.source);
  const target = textValue(value.target);
  const type = textValue(value.type);
  if (
    !nodeIds.has(source) ||
    !nodeIds.has(target) ||
    source === target ||
    !REPOSITORY_GRAPH_EDGE_TYPES.has(type)
  ) {
    return null;
  }
  const fallbackId = `${type}:${source}->${target}`.slice(0, 180);
  const id = isSafeRepositoryGraphId(value.id) ? textValue(value.id) : fallbackId;
  const edge = { id, source, target, type };
  const weight = Number(value.weight);
  if (Number.isFinite(weight) && weight > 0) edge.weight = Math.min(100, Math.trunc(weight));
  const confidence = optionalUnitNumber(value.confidence);
  if (confidence !== null) edge.confidence = confidence;
  const evidence = normalizeRepositoryGraphEvidence(value.evidence);
  if (evidence.length) edge.evidence = evidence;
  return edge;
}

function normalizeRepositoryGraphStats(value, nodes, edges, rawNodeCount, rawEdgeCount) {
  const source = objectRecord(value) ? value : {};
  return {
    files: normalizeQuotaCount(source.files, 0),
    nodes: nodes.length,
    edges: edges.length,
    languages: normalizeTextList(source.languages).slice(0, 8),
    truncated:
      Boolean(source.truncated) || rawNodeCount > nodes.length || rawEdgeCount > edges.length,
  };
}

function normalizeRepositoryGraphArchitectureSummary(value) {
  if (!objectRecord(value)) return {};
  const summary = {};
  for (const key of ["entrypoints", "modules", "tests", "workflows"]) {
    const items = (Array.isArray(value[key]) ? value[key] : [])
      .map(normalizeRepositoryGraphPath)
      .filter(Boolean)
      .slice(0, 20);
    if (items.length) summary[key] = items;
  }
  const reviewHints = normalizeTextList(value.reviewHints ?? value.review_hints).slice(0, 20);
  if (reviewHints.length) summary.reviewHints = reviewHints;
  const promptText = multilineTextValue(value.promptText ?? value.prompt_text, REPOSITORY_GRAPH_MAX_PROMPT_CHARS);
  if (promptText) summary.promptText = promptText;
  return summary;
}

function optionalUnitNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1, number));
}

function normalizeRepositoryGraphEvidence(value, { maxItems = REPOSITORY_GRAPH_MAX_EVIDENCE } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!objectRecord(item)) {
        const text = firstLineText(item).slice(0, 180);
        return text ? { text } : null;
      }
      const evidence = {};
      const kind = textValue(item.kind, item.type).slice(0, 40);
      const file = normalizeRepositoryGraphPath(item.file ?? item.path);
      const line = normalizeQuotaCount(item.line ?? item.startLine ?? item.start_line, 0);
      const text = firstLineText(item.text ?? item.summary ?? item.label ?? item.command).slice(
        0,
        180
      );
      if (kind) evidence.kind = kind;
      if (file) evidence.file = file;
      if (line) evidence.line = line;
      if (text) evidence.text = text;
      return Object.keys(evidence).length ? evidence : null;
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeImpactGraph(value) {
  const source =
    objectRecord(value?.impactGraph) && !textValue(value.version) ? value.impactGraph : value;
  if (!objectRecord(source)) return null;
  const version = textValue(source.version);
  if (version !== REPOSITORY_IMPACT_GRAPH_PROTOCOL_VERSION) return null;
  const targets = [];
  const targetIds = new Set();
  const rawTargets = Array.isArray(source.targets) ? source.targets : [];
  for (const item of rawTargets) {
    const target = normalizeImpactTarget(item);
    if (!target || targetIds.has(target.id)) continue;
    targetIds.add(target.id);
    targets.push(target);
    if (targets.length >= IMPACT_GRAPH_MAX_TARGETS) break;
  }
  const changedFiles = normalizeImpactPathList(source.changedFiles ?? source.changed_files).slice(
    0,
    IMPACT_GRAPH_MAX_COVERAGE_ITEMS
  );
  const mode = textValue(source.mode);
  const graph = {
    version,
    mode: IMPACT_GRAPH_MODES.has(mode) ? mode : "repository",
    summary: textValue(source.summary),
    stats: normalizeImpactStats(source.stats, targets, changedFiles),
    changedFiles,
    targets,
    coverage: normalizeImpactCoverage(source.coverage),
    promptText: multilineTextValue(
      source.promptText ?? source.prompt_text,
      REPOSITORY_GRAPH_MAX_PROMPT_CHARS
    ),
  };
  if (!graph.summary) delete graph.summary;
  if (!graph.promptText) delete graph.promptText;
  return graph;
}

export function normalizeImpactTarget(value) {
  if (!objectRecord(value)) return null;
  const rawId = textValue(value.id);
  let path = normalizeRepositoryGraphPath(value.path ?? value.file);
  if (!path && rawId.startsWith("file:")) {
    path = normalizeRepositoryGraphPath(rawId.slice(5));
  }
  if (!path) return null;
  const fallbackId = `file:${path}`.slice(0, 180);
  const id = isSafeRepositoryGraphId(rawId) ? rawId : fallbackId;
  const target = {
    id,
    path,
    label: textValue(value.label).slice(0, 80) || path.split("/").pop() || path,
    type: textValue(value.type) || "file",
    relations: normalizeImpactRelations(value.relations),
    gaps: normalizeTextList(value.gaps).slice(0, 20),
  };
  const risk = optionalUnitNumber(value.risk);
  if (risk !== null) target.risk = risk;
  const evidence = normalizeRepositoryGraphEvidence(value.evidence, { maxItems: 8 });
  if (evidence.length) target.evidence = evidence;
  return target;
}

function normalizeImpactRelations(value) {
  const source = objectRecord(value) ? value : {};
  return {
    tests: normalizeImpactRelationList(source.tests ?? source.test),
    documents: normalizeImpactRelationList(
      source.documents ?? source.docs ?? source.documentation
    ),
    configures: normalizeImpactRelationList(source.configures ?? source.config ?? source.configs),
    ci: normalizeImpactRelationList(source.ci ?? source.CI ?? source.workflows),
    imports: normalizeImpactRelationList(source.imports),
    importedBy: normalizeImpactRelationList(source.importedBy ?? source.imported_by),
    symbols: normalizeImpactRelationList(source.symbols),
  };
}

function normalizeImpactRelationList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeImpactRelation).filter(Boolean).slice(0, IMPACT_GRAPH_MAX_RELATIONS);
}

export function normalizeImpactRelation(value) {
  if (!objectRecord(value)) {
    const path = normalizeRepositoryGraphPath(value);
    if (!path) return null;
    return {
      id: `file:${path}`.slice(0, 180),
      path,
      label: path.split("/").pop() || path,
    };
  }
  const path = normalizeRepositoryGraphPath(
    value.path ??
      value.file ??
      value.targetPath ??
      value.target_path ??
      value.sourcePath ??
      value.source_path
  );
  const label = textValue(value.label, value.name).slice(0, 100);
  const rawId = textValue(value.id);
  const fallbackId = (path ? `file:${path}` : label ? `relation:${label}` : "").slice(0, 180);
  const id = isSafeRepositoryGraphId(rawId) ? rawId : fallbackId;
  if (!id && !path && !label) return null;
  const relation = {
    id: id || label,
    label: label || path.split("/").pop() || id,
  };
  if (path) relation.path = path;
  const type = textValue(value.type, value.kind);
  if (type) relation.type = type;
  const line = normalizeLineNumber(value.line ?? value.startLine ?? value.start_line);
  if (line) relation.line = line;
  const confidence = optionalUnitNumber(value.confidence);
  if (confidence !== null) relation.confidence = confidence;
  const evidence = normalizeRepositoryGraphEvidence(value.evidence);
  if (evidence.length) relation.evidence = evidence;
  return relation;
}

function normalizeImpactPathList(values) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((item) =>
          objectRecord(item)
            ? normalizeRepositoryGraphPath(item.path ?? item.file)
            : normalizeRepositoryGraphPath(item)
        )
        .filter(Boolean)
    ),
  ];
}

export function normalizeImpactCoverage(value) {
  const source = objectRecord(value) ? value : {};
  return {
    sourceFilesWithoutTests: normalizeImpactPathList(
      source.sourceFilesWithoutTests ?? source.source_files_without_tests
    ).slice(0, IMPACT_GRAPH_MAX_COVERAGE_ITEMS),
    sourceFilesWithoutDocs: normalizeImpactPathList(
      source.sourceFilesWithoutDocs ?? source.source_files_without_docs
    ).slice(0, IMPACT_GRAPH_MAX_COVERAGE_ITEMS),
    testsWithoutTargets: normalizeImpactPathList(
      source.testsWithoutTargets ?? source.tests_without_targets
    ).slice(0, IMPACT_GRAPH_MAX_COVERAGE_ITEMS),
    docsWithoutTargets: normalizeImpactPathList(
      source.docsWithoutTargets ?? source.docs_without_targets
    ).slice(0, IMPACT_GRAPH_MAX_COVERAGE_ITEMS),
  };
}

function normalizeImpactStats(value, targets, changedFiles) {
  const source = objectRecord(value) ? value : {};
  const relationCount = (key) =>
    targets.reduce((total, target) => total + (target.relations?.[key]?.length || 0), 0);
  const configuredRelationCount = relationCount("configures") + relationCount("ci");
  return {
    targets: normalizeQuotaCount(source.targets, targets.length),
    testedTargets: normalizeQuotaCount(
      source.testedTargets ?? source.tested_targets,
      targets.filter((target) => target.relations.tests.length > 0).length
    ),
    documentedTargets: normalizeQuotaCount(
      source.documentedTargets ?? source.documented_targets,
      targets.filter((target) => target.relations.documents.length > 0).length
    ),
    configuredTargets: normalizeQuotaCount(
      source.configuredTargets ?? source.configured_targets,
      targets.filter(
        (target) => target.relations.configures.length > 0 || target.relations.ci.length > 0
      ).length
    ),
    testsEdges: normalizeQuotaCount(source.testsEdges ?? source.tests_edges, relationCount("tests")),
    documentsEdges: normalizeQuotaCount(
      source.documentsEdges ?? source.documents_edges,
      relationCount("documents")
    ),
    configuresEdges: normalizeQuotaCount(
      source.configuresEdges ?? source.configures_edges,
      configuredRelationCount
    ),
    changedFiles: normalizeQuotaCount(
      source.changedFiles ?? source.changed_files,
      changedFiles.length
    ),
    truncated: normalizeBoolean(source.truncated),
  };
}

function normalizeRepositorySemanticGraph(value) {
  if (!objectRecord(value)) return null;
  const version = textValue(value.version);
  if (version !== REPOSITORY_SEMANTIC_GRAPH_PROTOCOL_VERSION) return null;
  const nodes = [];
  const nodeIds = new Set();
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  for (const item of rawNodes) {
    const node = normalizeRepositorySemanticNode(item);
    if (!node || nodeIds.has(node.id)) continue;
    nodeIds.add(node.id);
    nodes.push(node);
    if (nodes.length >= REPOSITORY_GRAPH_MAX_SEMANTIC_NODES) break;
  }
  if (!nodes.length) return null;
  const edges = [];
  const edgeIds = new Set();
  const rawEdges = Array.isArray(value.edges) ? value.edges : [];
  for (const item of rawEdges) {
    const edge = normalizeRepositorySemanticEdge(item, nodeIds);
    if (!edge || edgeIds.has(edge.id)) continue;
    edgeIds.add(edge.id);
    edges.push(edge);
    if (edges.length >= REPOSITORY_GRAPH_MAX_SEMANTIC_EDGES) break;
  }
  const graph = {
    version,
    summary: textValue(value.summary),
    stats: normalizeRepositorySemanticStats(value.stats, nodes, edges, rawNodes.length, rawEdges.length),
    nodes,
    edges,
    reviewHints: normalizeTextList(value.reviewHints ?? value.review_hints).slice(0, 20),
  };
  if (!graph.summary) delete graph.summary;
  if (!graph.reviewHints.length) delete graph.reviewHints;
  return graph;
}

function normalizeRepositorySemanticNode(value) {
  if (!objectRecord(value)) return null;
  const id = textValue(value.id);
  const type = textValue(value.type);
  const path = normalizeRepositoryGraphPath(value.path);
  if (!id || !isSafeRepositoryGraphId(id) || !REPOSITORY_SEMANTIC_NODE_TYPES.has(type) || !path) {
    return null;
  }
  const node = {
    id,
    label: textValue(value.label).slice(0, 80) || path.split("/").pop() || id,
    type,
    path,
    line: normalizeQuotaCount(value.line, 0),
  };
  if (!node.line) delete node.line;
  const signature = textValue(value.signature).slice(0, 180);
  if (signature) node.signature = signature;
  const importance = Number(value.importance);
  if (Number.isFinite(importance)) node.importance = Math.max(0, Math.min(1, importance));
  const tags = normalizeTextList(value.tags).slice(0, 10);
  if (tags.length) node.tags = tags;
  return node;
}

function normalizeRepositorySemanticEdge(value, nodeIds) {
  if (!objectRecord(value)) return null;
  const source = textValue(value.source);
  const target = textValue(value.target);
  const type = textValue(value.type);
  if (
    !nodeIds.has(source) ||
    !nodeIds.has(target) ||
    source === target ||
    !REPOSITORY_SEMANTIC_EDGE_TYPES.has(type)
  ) {
    return null;
  }
  const fallbackId = `${type}:${source}->${target}`.slice(0, 180);
  const id = isSafeRepositoryGraphId(value.id) ? textValue(value.id) : fallbackId;
  const edge = { id, source, target, type };
  const weight = Number(value.weight);
  if (Number.isFinite(weight) && weight > 0) edge.weight = Math.min(100, Math.trunc(weight));
  const confidence = optionalUnitNumber(value.confidence);
  if (confidence !== null) edge.confidence = confidence;
  const evidence = normalizeRepositoryGraphEvidence(value.evidence);
  if (evidence.length) edge.evidence = evidence;
  return edge;
}

function normalizeRepositorySemanticStats(value, nodes, edges, rawNodeCount, rawEdgeCount) {
  const source = objectRecord(value) ? value : {};
  const stats = {
    files: normalizeQuotaCount(source.files, 0),
    symbols: nodes.length,
    relationships: edges.length,
    routes: nodes.filter((node) => node.type === "route").length,
    truncated:
      Boolean(source.truncated) || rawNodeCount > nodes.length || rawEdgeCount > edges.length,
  };
  const graphSource = textValue(source.source);
  if (["agent_fallback", "static"].includes(graphSource)) stats.source = graphSource;
  return stats;
}

function normalizeRepositoryGraphPath(value) {
  const text = firstLineText(value).replaceAll("\\", "/");
  if (!text || text.startsWith("/") || text.startsWith("//") || /^[A-Za-z]:/.test(text)) return "";
  const parts = text.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) {
    return "";
  }
  return parts.join("/");
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
const AUDIT_SWARM_SEVERITY_ALIASES = {
  p0: "critical",
  p1: "high",
  p2: "medium",
  p3: "low",
  p4: "info",
};

function normalizeSeverityValue(value) {
  const severity = textValue(value).toLowerCase();
  return (
    AUDIT_SWARM_SEVERITY_ALIASES[severity] || (NORMALIZED_SEVERITIES.has(severity) ? severity : "")
  );
}

function normalizeSeverity(value) {
  return normalizeSeverityValue(value) || "info";
}

function normalizeIssueStatus(value) {
  const status = textValue(value);
  return ["open", "fixed", "snoozed"].includes(status) ? status : "open";
}

const ISSUE_FEEDBACK_REASON_ALIASES = {
  valid: "useful",
  speculative: "too_speculative",
};
const ISSUE_FEEDBACK_REASONS = new Set([
  "useful",
  "false_positive",
  "not_relevant",
  "duplicate",
  "expected_behavior",
  "too_speculative",
  "low_impact",
  "already_fixed",
]);

function normalizeIssueFeedbackReason(value) {
  const reason = textValue(value).toLowerCase().replace(/[-\s]+/g, "_");
  const normalized = ISSUE_FEEDBACK_REASON_ALIASES[reason] || reason;
  return ISSUE_FEEDBACK_REASONS.has(normalized) ? normalized : "";
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
      if (objectRecord(item)) return normalizeAuditSwarmEvidenceText(item);
      return textValue(item);
    })
    .filter(Boolean);
}

function normalizeAuditSwarmEvidenceLocation(item) {
  const file = textValue(item.file, item.path);
  if (!file) return "";
  const startLine = normalizeLineNumber(item.startLine ?? item.start_line ?? item.line);
  const endLine = normalizeLineNumber(item.endLine ?? item.end_line);
  if (startLine && endLine && endLine !== startLine) return `${file}:${startLine}-${endLine}`;
  return startLine ? `${file}:${startLine}` : file;
}

function normalizeAuditSwarmEvidenceText(item) {
  return textValue(
    item.summary,
    item.text,
    item.claim,
    item.command,
    normalizeAuditSwarmEvidenceLocation(item),
    item.output,
    item.label,
    item.url,
    item.type
  );
}

const AUDIT_SWARM_EVIDENCE_BLOCK_KINDS = new Set([
  "summary",
  "claim",
  "code_location",
  "evidence",
  "command",
  "verifier_verdict",
  "false_positive_check",
  "invariant",
  "risk",
]);

function normalizeAuditSwarmCounts(value) {
  const source = objectRecord(value) ? value : {};
  return {
    issueCards: normalizeCount(source.issueCards ?? source.issue_cards),
    verificationResults: normalizeCount(source.verificationResults ?? source.verification_results),
    evidenceBlocks: normalizeCount(source.evidenceBlocks ?? source.evidence_blocks),
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
        falsePositiveChecks: normalizeTextList(
          card.falsePositiveChecks ?? card.false_positive_checks
        ),
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
      const commands = normalizeTextList(
        result.commandsRun ?? result.commands_run ?? result.commands
      );
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
    .filter(
      (result) =>
        result && (result.issueId || result.verdict || result.summary || result.commands.length)
    )
    .slice(0, 30);
}

function normalizeAuditSwarmEvidenceBlocks(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((block) => {
      if (!objectRecord(block)) return null;
      const rawKind = textValue(block.kind).toLowerCase();
      const kind = AUDIT_SWARM_EVIDENCE_BLOCK_KINDS.has(rawKind) ? rawKind : "evidence";
      const verdict = textValue(block.verdict).toLowerCase();
      const items = normalizeAuditSwarmTextList(block.items).slice(0, 8);
      return {
        id: textValue(block.id, block.blockId, block.block_id),
        kind,
        title: textValue(block.title) || kind.replaceAll("_", " "),
        summary: textValue(block.summary, block.text, block.claim),
        issueId: textValue(block.issueId, block.issue_id),
        severity: normalizeSeverityValue(block.severity),
        category: textValue(block.category),
        role: textValue(
          block.role,
          block.agentRole,
          block.agent_role,
          block.verifierRole,
          block.verifier_role
        ),
        shardId: textValue(block.shardId, block.shard_id),
        stage: textValue(block.stage),
        status: textValue(block.status),
        verdict: ["confirmed", "rejected", "inconclusive"].includes(verdict) ? verdict : "",
        proofType: textValue(block.proofType, block.proof_type),
        proofStrength: normalizeCount(block.proofStrength ?? block.proof_strength),
        command: textValue(block.command),
        file: textValue(block.file, block.path),
        startLine: normalizeLineNumber(block.startLine ?? block.start_line ?? block.line),
        endLine: normalizeLineNumber(block.endLine ?? block.end_line),
        confidence: normalizeConfidence(block.confidence),
        items,
      };
    })
    .filter(
      (block) =>
        block &&
        (block.title ||
          block.summary ||
          block.command ||
          block.file ||
          block.items.length ||
          block.verdict ||
          block.issueId)
    )
    .filter((block) => {
      const key = [
        block.kind,
        block.title,
        block.summary,
        block.issueId,
        block.severity,
        block.category,
        block.role,
        block.shardId,
        block.stage,
        block.status,
        block.verdict,
        block.proofType,
        block.command,
        block.file,
        block.startLine,
        block.endLine,
        block.items.join("\n"),
      ]
        .map((part) => String(part || "").trim().toLowerCase())
        .join("\x1f");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

function normalizeAuditSwarm(value) {
  if (!objectRecord(value)) return {};
  const issueCards = normalizeAuditSwarmIssueCards(value.issueCards ?? value.issue_cards);
  const verificationResults = normalizeAuditSwarmVerificationResults(
    value.verificationResults ?? value.verification_results
  );
  const evidenceBlocks = normalizeAuditSwarmEvidenceBlocks(
    value.evidenceBlocks ?? value.evidence_blocks
  );
  const counts = normalizeAuditSwarmCounts(value.counts);
  if (issueCards.length) counts.issueCards = Math.max(counts.issueCards, issueCards.length);
  if (verificationResults.length) {
    counts.verificationResults = Math.max(counts.verificationResults, verificationResults.length);
  }
  if (evidenceBlocks.length)
    counts.evidenceBlocks = Math.max(counts.evidenceBlocks, evidenceBlocks.length);
  return {
    protocol: textValue(value.protocol),
    stage: textValue(value.stage),
    adapter: textValue(value.adapter),
    providerChain: normalizeTextList(value.providerChain),
    summary: textValue(value.summary),
    logsSummary: textValue(value.logsSummary, value.logs_summary),
    counts,
    roles: normalizeTextList(value.roles),
    shards: normalizeTextList(value.shards),
    issueCards,
    verificationResults,
    evidenceBlocks,
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
    feedbackReason: normalizeIssueFeedbackReason(issue.feedbackReason ?? issue.feedback_reason),
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
  const billingUsage = normalizeQuotaUsage(scan.billingUsage);
  const repoUsage = normalizeQuotaUsage(scan.repoUsage);
  const quotaBucketIds = objectRecord(scan.quotaBucketIds) ? { ...scan.quotaBucketIds } : {};
  const rawRepositoryGraph = scan.repositoryGraph;
  const repositoryGraph = normalizeRepositoryGraph(rawRepositoryGraph);
  const semanticGraph =
    normalizeRepositorySemanticGraph(scan.semanticGraph) ||
    normalizeRepositorySemanticGraph(objectRecord(rawRepositoryGraph) ? rawRepositoryGraph.semanticGraph : null) ||
    null;
  const rawImpactGraph =
    scan.impactGraph ?? (objectRecord(rawRepositoryGraph) ? rawRepositoryGraph.impactGraph : null);
  const impactGraph = normalizeImpactGraph(rawImpactGraph) || repositoryGraph?.impactGraph || null;
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
    verificationAudit: normalizeVerificationAudit(
      scan.verificationAudit ?? scan.verification_audit
    ),
    aiUsage: normalizeAiUsage(scan.aiUsage, scan),
    completionAudit: normalizeCompletionAudit(scan.completionAudit ?? scan.completion_audit),
    jobTrace: normalizeJobTrace(scan.jobTrace ?? scan.job_trace),
    preflight: normalizePreflight(scan.preflight),
    auditSwarm: normalizeAuditSwarm(scan.auditSwarm ?? scan.audit_swarm),
    repositoryGraph,
    semanticGraph,
    impactGraph,
    repoId: textValue(scan.repoId),
    githubRepoId: textValue(scan.githubRepoId),
    quotaBucketIds,
    billingUsage,
    repoUsage,
  };
}

export function useRepositories() {
  const requestIdRef = useRef(0);
  const cacheKey = "repositories";
  const { initialCachedState, shouldRefreshQuietly } = useInitialCachedListState(cacheKey);
  const [state, setState] = useState(() => ({
    items: [],
    installations: [],
    installationAccounts: [],
    userQuota: null,
    needsAuthorization: false,
    ...(initialCachedState || {}),
    loading: !shouldRefreshQuietly,
    error: "",
  }));

  const load = useCallback(async ({ sync = false, quiet = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({ ...current, loading: quiet ? current.loading : true, error: "" }));
    try {
      const payload = sync
        ? await pullwiseApi.repositories.sync()
        : await pullwiseApi.repositories.list();
      if (requestId !== requestIdRef.current) return;
      const nextState = {
        items: itemsFrom(payload, "items", "repositories").map(normalizeRepo),
        installations: itemsFrom(payload, "installations"),
        installationAccounts: itemsFrom(payload, "installationAccounts"),
        userQuota: normalizeQuotaUsage(payload?.userQuota),
        loading: false,
        error: "",
        needsAuthorization: normalizeBoolean(payload?.needsAuthorization),
      };
      rememberListState(cacheKey, nextState);
      setState(nextState);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setState((current) => ({
        ...current,
        loading: false,
        error: error?.message || "Unable to load repositories.",
      }));
    }
  }, []);

  useEffect(() => {
    load({ quiet: shouldRefreshQuietly });
  }, [load, shouldRefreshQuietly]);

  return { ...state, reload: load };
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
  refreshOnChange = true,
} = {}) {
  const requestIdRef = useRef(0);
  const cacheKey = stableCacheKey("issues", { limit, status, severity, q, scanId });
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
      setState((current) => ({
        ...current,
        loading: append || quiet ? current.loading : true,
        loadingMore: append,
        error: "",
      }));
      try {
        const payload = await pullwiseApi.issues.list(
          listParams({ limit, offset, status, severity, q, scanId })
        );
        if (requestId !== requestIdRef.current) return;
        const nextItems = itemsFrom(payload, "items", "issues").map(normalizeIssue);
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
        if (requestId !== requestIdRef.current) return;
        setState((current) => ({
          items: current.items,
          loading: false,
          loadingMore: false,
          error: error?.message || "Unable to load issues.",
          meta: current.meta,
        }));
      }
    },
    [cacheKey, limit, status, severity, q, scanId]
  );

  useEffect(() => {
    load({ quiet: shouldRefreshQuietly });
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
  const requestIdRef = useRef(0);
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

  const load = useCallback(
    async ({ quiet = false, append = false, offset = 0 } = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setState((current) => ({
        ...current,
        loading: quiet || append ? current.loading : true,
        loadingMore: append,
        error: "",
      }));
      try {
        const payload = await pullwiseApi.scans.list(listParams({ limit, offset, status, repo }));
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
        if (requestId !== requestIdRef.current) return;
        const message = error?.message || "Unable to load scans.";
        setState((current) => ({
          items: current.items,
          loading: false,
          loadingMore: false,
          error: message,
          meta: current.meta,
        }));
      }
    },
    [cacheKey, limit, status, repo]
  );

  useEffect(() => {
    load({ quiet: shouldRefreshQuietly });
  }, [load, shouldRefreshQuietly]);

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

const TERMINAL_SCAN_STATUSES = new Set(["done", "failed", "cancelled", "lost"]);

export function isTerminalScan(scan) {
  return Boolean(scan && TERMINAL_SCAN_STATUSES.has(scan.status));
}

function retryResponseScanPayload(payload) {
  if (objectRecord(payload?.scan)) return payload.scan;
  if (objectRecord(payload?.data?.scan)) return payload.data.scan;
  if (objectRecord(payload?.result?.scan)) return payload.result.scan;
  if (objectRecord(payload?.retry)) return payload.retry;
  return objectRecord(payload) ? payload : null;
}

function retryResponseScanId(payload, fallback = "") {
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
    if (!scanId) return undefined;
    let alive = true;
    const seedScan = initialScanRef.current;
    clearRunError();
    setScan(seedScan?.id === scanId ? normalizeScan(seedScan) : null);
    pullwiseApi.scans
      .get(scanId)
      .then((payload) => {
        if (alive) {
          setScan(normalizeScan(payload));
          clearRunError();
        }
      })
      .catch((err) => {
        if (alive) {
          setRunError(err, "Unable to load scan.", seedScan?.id === scanId ? "load" : "initial-load");
        }
      });
    return () => {
      alive = false;
    };
  }, [scanId, clearRunError, setRunError]);

  useEffect(() => {
    if (!scan?.id || isTerminalScan(scan)) return undefined;
    let alive = true;
    const handle = setTimeout(async () => {
      try {
        const next = await pullwiseApi.scans.get(scan.id);
        if (alive) {
          setScan(normalizeScan(next));
          clearRunError(["load", "poll"]);
        }
      } catch {
        if (alive) {
          setPollRetryTick((tick) => tick + 1);
        }
      }
    }, pollIntervalMs);
    return () => {
      alive = false;
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

  return { scan, error, errorCode, cancel, retry, retrying, canceling };
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
        clearRunError(["poll"]);
      } catch {
        if (alive) {
          setPollRetryTick((tick) => tick + 1);
        }
      }
    }, pollIntervalMs);

    return () => {
      alive = false;
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
      setScans(previousScans);
      setBatchResults(previousBatchResults);
      setRunError(err, "Cancel failed.", "cancel");
    } finally {
      setCanceling(false);
    }
  };

  return { scans, batchResults, error, errorCode, cancel, canceling };
}
