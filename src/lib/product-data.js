import { useEffect, useRef, useState } from "react";

// A protected result belongs only to its exact read key; no cross-route cache.
export function useProductRead(key, load) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const [state, setState] = useState({ key: null });
  useEffect(() => {
    const controller = new AbortController();
    const read = loadRef.current;
    Promise.resolve().then(() => controller.signal.aborted ? undefined : read(controller.signal)).then(
      value => { if (!controller.signal.aborted) setState({ key, value }); },
      error => { if (!controller.signal.aborted) setState({ key, error }); },
    );
    return () => controller.abort();
  }, [key]);
  return state.key === key ? { ...state, loading: false } : { loading: true };
}

export function requirePage(value) {
  if (!value || !Array.isArray(value.items) || typeof value.hasMore !== "boolean") {
    throw new Error("Invalid product list response");
  }
  return value;
}

export function requireOverview(value) {
  const counts = ["needs_action", "needs_confirmation", "waiting", "optional", "closed"];
  const views = ["mine", "unassigned", "waiting", "all"];
  if (!value || !Number.isInteger(value.totalCount) || value.totalCount < 0 ||
      !counts.every(key => Number.isInteger(value.counts?.[key]) && value.counts[key] >= 0) ||
      !views.every(key => Number.isInteger(value.viewCounts?.[key]) && value.viewCounts[key] >= 0)) {
    throw new Error("Invalid product overview response");
  }
  return value;
}

export function requireWorkload(value) {
  if (!value || value.kind !== "workload" || value.countUnit !== "item" ||
      !Number.isInteger(value.totalCount) || value.totalCount < 0 ||
      !Array.isArray(value.data?.rows) || value.data.rows.some(row =>
        !["pr", "ci", "updates"].includes(row.key) ||
        !Number.isInteger(row.totalCount) || row.totalCount < 0 ||
        !Array.isArray(row.cells) || row.cells.some(cell =>
          !Number.isInteger(cell.count) || cell.count < 0 ||
          cell.drilldown?.resource !== "items" ||
          !cell.drilldown.filters || typeof cell.drilldown.filters !== "object"))) {
    throw new Error("Invalid workload visualization response");
  }
  return value;
}

export function requirePRActions(value) {
  if (!value || value.kind !== "pr_actions" || value.countUnit !== "item" ||
      !Number.isInteger(value.totalCount) || value.totalCount < 0 ||
      !Number.isInteger(value.data?.rowsTotal) || value.data.rowsTotal < 0 ||
      !Array.isArray(value.data.rows) || typeof value.hasMore !== "boolean" ||
      value.data.rows.some(row => !row.repositoryId ||
        !Number.isInteger(row.pullNumber) || row.pullNumber < 1 ||
        !Number.isInteger(row.totalCount) || row.totalCount < 0 ||
        !Array.isArray(row.cells) || row.cells.some(cell =>
          !Number.isInteger(cell.count) || cell.count < 0 ||
          cell.drilldown?.resource !== "items" || !cell.drilldown.filters))) {
    throw new Error("Invalid PR action visualization response");
  }
  return value;
}

export function requireCIFailures(value) {
  if (!value || value.kind !== "ci_failures" ||
      value.countUnit !== "ci_job_attempt" ||
      !Number.isInteger(value.totalCount) || value.totalCount < 0 ||
      !Number.isInteger(value.data?.unclassifiedCount) ||
      value.data.unclassifiedCount < 0 ||
      !Array.isArray(value.data.rows) || !Array.isArray(value.data.columns) ||
      !Array.isArray(value.data.cells) || value.data.cells.some(cell =>
        !Number.isInteger(cell.count) || cell.count < 0 ||
        cell.drilldown?.resource !== "items" || !cell.drilldown.filters)) {
    throw new Error("Invalid CI failure visualization response");
  }
  return value;
}

export function requireUpdatesReleases(value) {
  if (!value || value.kind !== "updates_releases" ||
      value.countUnit !== "release_watch" ||
      !Number.isInteger(value.totalCount) || value.totalCount < 0 ||
      typeof value.hasMore !== "boolean" ||
      !Array.isArray(value.data?.rows) || value.data.rows.some(row =>
        !row.sourceId || !row.contextId || !row.watchId ||
        !Number.isInteger(row.contextVersion) || row.contextVersion < 1 ||
        !row.coverage || typeof row.coverage !== "object" ||
        !row.updateSignals || typeof row.updateSignals !== "object")) {
    throw new Error("Invalid Updates release visualization response");
  }
  return value;
}

export function requireTimeline(value) {
  if (!value || !Array.isArray(value.items) || !Array.isArray(value.relations) ||
      typeof value.hasMore !== "boolean" ||
      value.items.some(event => !event.id || !event.eventType ||
        !["github", "model", "handling"].includes(event.sourceKind) ||
        !["observed", "source"].includes(event.timeBasis) || !event.observedAt) ||
      value.relations.some(relation =>
        !["same_run_retry_succeeded", "later_run_succeeded"].includes(relation.kind) ||
        !relation.fromEventId || !relation.matchRuleVersion ||
        !relation.toExecution?.runId || !relation.toExecution?.jobId)) {
    throw new Error("Invalid Item timeline response");
  }
  return value;
}

export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
