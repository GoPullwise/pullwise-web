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
    const text = scalarText(value);
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

function normalizeTextList(values) {
  if (!Array.isArray(values)) return [];
  return values.map(scalarText).filter(Boolean);
}

function normalizeCodeLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => {
      if (["string", "number", "boolean"].includes(typeof line)) {
        return { ln: "", code: String(line), t: "" };
      }
      if (!line || typeof line !== "object" || Array.isArray(line)) return null;
      const code = scalarText(line.code);
      if (!code) return null;
      const type = ["add", "del"].includes(line.t) ? line.t : "";
      return {
        ln: scalarText(line.ln),
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
        const url = String(reference);
        return /^https?:\/\//i.test(url) ? { label: url, url } : null;
      }
      if (!reference || typeof reference !== "object" || Array.isArray(reference)) return null;
      const url = scalarText(reference.url);
      if (!/^https?:\/\//i.test(url)) return null;
      return {
        label: scalarText(reference.label) || url,
        url,
      };
    })
    .filter(Boolean);
}

export function normalizeRepo(repo = {}) {
  repo = repo || {};
  const fullName = textValue(repo.fullName, repo.full_name, repo.name);
  return {
    ...repo,
    id: textValue(repo.id, fullName),
    name: textValue(repo.name, fullName),
    fullName,
    desc: textValue(repo.desc, repo.description),
    lang: textValue(repo.lang, repo.language) || "-",
    stars: normalizeDisplayCount(repo.stars, repo.stargazers_count),
    branches: normalizeDisplayCount(repo.branches),
    updated: textValue(repo.updated, repo.updated_at, repo.updatedAt),
    private: normalizeBoolean(repo.private),
  };
}

export function normalizeIssue(issue = {}) {
  issue = issue || {};
  const autoFix = normalizeBoolean(issue.autoFix ?? issue.autoFixable);
  const autoFixable = normalizeBoolean(issue.autoFixable ?? issue.autoFix);
  return {
    ...issue,
    id: textValue(issue.id),
    scanId: textValue(issue.scanId, issue.scan_id),
    repo: textValue(issue.repo, issue.repository),
    title: textValue(issue.title),
    summary: textValue(issue.summary, issue.description),
    impact: textValue(issue.impact),
    severity: normalizeSeverity(issue.severity),
    category: textValue(issue.category) || "General",
    status: normalizeIssueStatus(issue.status),
    file: textValue(issue.file),
    line: normalizeLineNumber(issue.line),
    confidence: normalizeConfidence(issue.confidence),
    effort: textValue(issue.effort) || "-",
    age: issue.age || formatTime(issue.createdAt || issue.updatedAt),
    autoFix,
    autoFixable,
    steps: normalizeTextList(issue.steps),
    badCode: normalizeCodeLines(issue.badCode),
    goodCode: normalizeCodeLines(issue.goodCode),
    references: normalizeReferences(issue.references),
    tags: normalizeTextList(issue.tags),
  };
}

export function normalizeScan(scan = {}) {
  scan = scan || {};
  return {
    ...scan,
    id: textValue(scan.id),
    repo: textValue(scan.repo, scan.repository),
    branch: textValue(scan.branch) || "main",
    commit: textValue(scan.commit) || "-",
    status: normalizeScanStatus(scan.status),
    createdAt: scan.createdAt,
    time: textValue(scan.time) || formatTime(scan.createdAt),
    by: textValue(scan.by) || "you",
    progress: normalizeProgress(scan.progress),
    issues: normalizeIssueCounts(scan.issues),
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
  const globalLimit = normalizeQueueCount(queue.limits?.global, { positive: true });
  const perUserLimit = normalizeQueueCount(queue.limits?.perUser, { positive: true });
  if (position !== null) tags.push(`Position ${position}`);
  if (ahead !== null) tags.push(`${scanCountLabel(ahead)} ahead`);
  if (globalLimit !== null) tags.push(`Global ${globalLimit}`);
  if (perUserLimit !== null) tags.push(`Per user ${perUserLimit}`);

  return {
    message: scalarText(queue.message),
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

function scanCreatePayload({ repo, branch, commit = "pending", requestId = "" }) {
  const payload = { repo, branch: branch || "main", commit: commit || "pending" };
  if (requestId) payload.requestId = requestId;
  return payload;
}

// Creates or resumes a scan, then polls /scans/{id} every `pollIntervalMs`
// until the scan reaches a terminal status.
export function useScanRun({
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
  const initialScanRef = useRef(initialScan);

  useEffect(() => {
    initialScanRef.current = initialScan;
  }, [initialScan]);

  useEffect(() => {
    if (scanId) return undefined;
    if (!repo) return undefined;
    let alive = true;
    setError("");
    pullwiseApi.scans
      .create(scanCreatePayload({ repo, branch, commit, requestId }))
      .then((payload) => {
        if (alive) setScan(normalizeScan(payload));
      })
      .catch((err) => {
        if (alive) setError(err?.message || "Unable to start scan.");
      });
    return () => {
      alive = false;
    };
  }, [scanId, repo, branch, commit, requestId]);

  useEffect(() => {
    if (!scanId) return undefined;
    let alive = true;
    const seedScan = initialScanRef.current;
    setError("");
    setScan(seedScan?.id === scanId ? normalizeScan(seedScan) : null);
    pullwiseApi.scans
      .get(scanId)
      .then((payload) => {
        if (alive) setScan(normalizeScan(payload));
      })
      .catch((err) => {
        if (alive) setError(err?.message || "Unable to load scan.");
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
        if (alive) setError(err?.message || "Polling failed.");
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
    }
  };

  return { scan, error, cancel };
}

function scanRequestKey(request) {
  return [
    request.repo,
    request.branch || "main",
    request.commit || "pending",
    request.requestId || "",
  ].join("\u001f");
}

function normalizeScanRequest(request) {
  return {
    repo: request?.repo || "",
    branch: request?.branch || "main",
    commit: request?.commit || "pending",
    requestId: request?.requestId || "",
  };
}

export function useScanBatchRun({ repositories = [], pollIntervalMs = 1500 } = {}) {
  const [scans, setScans] = useState([]);
  const [error, setError] = useState("");
  const requests = repositories.map(normalizeScanRequest).filter((request) => request.repo);
  const requestKey = requests.map(scanRequestKey).join("\u001e");
  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  useEffect(() => {
    const nextRequests = requestsRef.current;
    if (!requestKey) {
      setScans((current) => (current.length ? [] : current));
      setError((current) => (current ? "" : current));
      return undefined;
    }

    let alive = true;
    setScans((current) => (current.length ? [] : current));
    setError((current) => (current ? "" : current));

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
        if (alive) setError(err?.message || "Polling failed.");
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
    }
  };

  return { scans, error, cancel };
}
