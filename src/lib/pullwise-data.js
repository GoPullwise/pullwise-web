import { useCallback, useEffect, useState } from "react";
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
  return String(value);
}

export function normalizeRepo(repo) {
  const fullName = repo.fullName || repo.full_name || repo.name || "";
  return {
    ...repo,
    id: String(repo.id || fullName),
    name: repo.name || fullName,
    fullName,
    desc: repo.desc || repo.description || "",
    lang: repo.lang || repo.language || "-",
    stars: repo.stars ?? repo.stargazers_count ?? "-",
    branches: repo.branches ?? "-",
    updated: repo.updated || repo.updated_at || repo.updatedAt || "",
    private: Boolean(repo.private),
  };
}

export function normalizeIssue(issue) {
  return {
    ...issue,
    id: String(issue.id || ""),
    repo: issue.repo || issue.repository || "",
    title: issue.title || "",
    summary: issue.summary || issue.description || "",
    severity: issue.severity || "info",
    category: issue.category || "General",
    status: issue.status || "open",
    file: issue.file || "",
    line: issue.line || null,
    confidence: Number(issue.confidence ?? 0),
    effort: issue.effort || "-",
    age: issue.age || formatTime(issue.createdAt || issue.updatedAt),
    autoFix: Boolean(issue.autoFix ?? issue.autoFixable),
    autoFixable: Boolean(issue.autoFixable ?? issue.autoFix),
  };
}

export function normalizeScan(scan) {
  return {
    ...scan,
    id: String(scan.id || ""),
    repo: scan.repo || scan.repository || "",
    branch: scan.branch || "main",
    commit: scan.commit || "-",
    status: scan.status || "queued",
    createdAt: scan.createdAt,
    time: scan.time || formatTime(scan.createdAt),
    by: scan.by || "you",
    issues: scan.issues || null,
  };
}

export function useRepositories() {
  const [state, setState] = useState({
    items: [],
    installations: [],
    installationAccounts: [],
    loading: true,
    error: "",
    needsAuthorization: false,
  });

  const load = async ({ sync = false } = {}) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = sync ? await pullwiseApi.repositories.sync() : await pullwiseApi.repositories.list();
      setState({
        items: itemsFrom(payload, "items", "repositories").map(normalizeRepo),
        installations: itemsFrom(payload, "installations"),
        installationAccounts: itemsFrom(payload, "installationAccounts"),
        loading: false,
        error: "",
        needsAuthorization: Boolean(payload?.needsAuthorization),
      });
    } catch (error) {
      setState({
        items: [],
        installations: [],
        installationAccounts: [],
        loading: false,
        error: error?.message || "Unable to load repositories.",
        needsAuthorization: false,
      });
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { ...state, reload: load };
}

export function useIssues() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await pullwiseApi.issues.list();
      setState({ items: itemsFrom(payload, "items", "issues").map(normalizeIssue), loading: false, error: "" });
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
  if (!queue) return null;

  const tags = [];
  if (queue.position) tags.push(`Position ${queue.position}`);
  if (typeof queue.ahead === "number") {
    tags.push(`${scanCountLabel(queue.ahead)} ahead`);
  }
  if (queue.limits?.global) tags.push(`Global ${queue.limits.global}`);
  if (queue.limits?.perUser) tags.push(`Per user ${queue.limits.perUser}`);

  return {
    message: queue.message || "",
    tags,
  };
}

export function useScans({ pollIntervalMs = 1500 } = {}) {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  const load = useCallback(async ({ quiet = false } = {}) => {
    setState((current) => ({ ...current, loading: quiet ? current.loading : true, error: "" }));
    try {
      const payload = await pullwiseApi.scans.list();
      setState({ items: itemsFrom(payload, "items", "scans").map(normalizeScan), loading: false, error: "" });
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

// Creates a scan, then polls /scans/{id} every `pollIntervalMs` until the
// scan reaches a terminal status. Caller drives the lifecycle by passing
// `repo`; pass an empty string to defer creation.
export function useScanRun({ repo, branch, commit = "pending", pollIntervalMs = 1500 }) {
  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!repo) return undefined;
    let alive = true;
    setError("");
    pullwiseApi.scans
      .create({ repo, branch: branch || "main", commit })
      .then((payload) => { if (alive) setScan(normalizeScan(payload)); })
      .catch((err) => { if (alive) setError(err?.message || "Unable to start scan."); });
    return () => { alive = false; };
  }, [repo, branch, commit]);

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
