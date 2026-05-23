import { useEffect, useRef } from "react";

const STORAGE_KEY = "pullwise.githubRepositoryAccessRefreshNeeded";

let memoryRefreshNeeded = false;

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markGitHubRepositoryAccessRefreshNeeded() {
  memoryRefreshNeeded = true;
  storage()?.setItem(STORAGE_KEY, "1");
}

export function clearGitHubRepositoryAccessRefreshNeeded() {
  memoryRefreshNeeded = false;
  storage()?.removeItem(STORAGE_KEY);
}

export function githubRepositoryAccessRefreshNeeded() {
  return memoryRefreshNeeded || storage()?.getItem(STORAGE_KEY) === "1";
}

export function useGitHubRepositoryAccessAutoRefresh(onRefresh) {
  const refreshRef = useRef(onRefresh);
  const runningRef = useRef(false);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    let disposed = false;

    const runRefresh = async () => {
      if (disposed || runningRef.current || !githubRepositoryAccessRefreshNeeded()) return;
      if (document.visibilityState === "hidden") return;

      runningRef.current = true;
      try {
        await refreshRef.current();
        clearGitHubRepositoryAccessRefreshNeeded();
      } catch {
        // Keep the pending flag so the next focus/visibility return can retry.
      } finally {
        runningRef.current = false;
      }
    };

    const handleFocus = () => {
      void runRefresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") void runRefresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    void runRefresh();

    return () => {
      disposed = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
}
