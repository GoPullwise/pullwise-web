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

export function useIssues() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await pullwiseApi.issues.list();
      setState({
        items: itemsFrom(payload, "items", "issues").map(normalizeIssue),
        loading: false,
        error: "",
      });
    } catch (error) {
      setState({ items: [], loading: false, error: error?.message || "Unable to load issues." });
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { ...state, reload: load };
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

export function useScans({ pollIntervalMs = 1500 } = {}) {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  const load = useCallback(async ({ quiet = false } = {}) => {
    setState((current) => ({ ...current, loading: quiet ? current.loading : true, error: "" }));
    try {
      const payload = await pullwiseApi.scans.list();
      setState({
        items: itemsFrom(payload, "items", "scans").map(normalizeScan),
        loading: false,
        error: "",
      });
    } catch (error) {
      const message = error?.message || "Unable to load scans.";
      setState((current) => ({
        items: quiet ? current.items : [],
        loading: false,
        error: message,
      }));
    }
  }, []);

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

  return { ...state, reload: load };
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
      setError((current) => (current ? "" : current));
      setErrorCode((current) => (current ? "" : current));
      return undefined;
    }

    let alive = true;
    setScans((current) => (current.length ? [] : current));
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
    } catch (err) {
      setError(err?.message || "Cancel failed.");
      setErrorCode(textValue(err?.code, err?.payload?.code));
    }
  };

  return { scans, error, errorCode, cancel };
}
