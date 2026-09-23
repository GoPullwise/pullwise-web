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

export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
