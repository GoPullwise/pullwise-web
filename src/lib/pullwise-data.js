import { useEffect, useState } from "react";
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
  const [state, setState] = useState({ items: [], loading: true, error: "", needsAuthorization: false });

  const load = async ({ sync = false } = {}) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = sync ? await pullwiseApi.repositories.sync() : await pullwiseApi.repositories.list();
      setState({
        items: itemsFrom(payload, "items", "repositories").map(normalizeRepo),
        loading: false,
        error: "",
        needsAuthorization: Boolean(payload?.needsAuthorization),
      });
    } catch (error) {
      setState({
        items: [],
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

export function useScans() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const payload = await pullwiseApi.scans.list();
      setState({ items: itemsFrom(payload, "items", "scans").map(normalizeScan), loading: false, error: "" });
    } catch (error) {
      setState({ items: [], loading: false, error: error?.message || "Unable to load scans." });
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { ...state, reload: load };
}
