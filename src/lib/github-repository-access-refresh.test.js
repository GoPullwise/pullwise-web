import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearGitHubRepositoryAccessRefreshNeeded,
  githubRepositoryAccessRefreshNeeded,
  markGitHubRepositoryAccessRefreshNeeded,
  useGitHubRepositoryAccessAutoRefresh,
} from "./github-repository-access-refresh.js";

describe("GitHub repository access refresh storage", () => {
  beforeEach(() => clearGitHubRepositoryAccessRefreshNeeded());
  afterEach(() => clearGitHubRepositoryAccessRefreshNeeded());

  it("falls back to memory when sessionStorage operations throw", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    try {
      expect(() => markGitHubRepositoryAccessRefreshNeeded()).not.toThrow();
      expect(githubRepositoryAccessRefreshNeeded()).toBe(true);
      expect(() => clearGitHubRepositoryAccessRefreshNeeded()).not.toThrow();
      expect(githubRepositoryAccessRefreshNeeded()).toBe(false);
    } finally {
      setItem.mockRestore();
      getItem.mockRestore();
      removeItem.mockRestore();
    }
  });

  it("runs and clears a pending repository refresh when the hook mounts", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    markGitHubRepositoryAccessRefreshNeeded();

    const { unmount } = renderHook(() => useGitHubRepositoryAccessAutoRefresh(onRefresh));

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(githubRepositoryAccessRefreshNeeded()).toBe(false));
    unmount();
  });

  it("waits for visibility and retries a failed repository refresh on focus", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const onRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("sync unavailable"))
      .mockResolvedValueOnce(undefined);
    markGitHubRepositoryAccessRefreshNeeded();
    const { unmount } = renderHook(() => useGitHubRepositoryAccessAutoRefresh(onRefresh));

    try {
      expect(onRefresh).not.toHaveBeenCalled();

      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
      expect(githubRepositoryAccessRefreshNeeded()).toBe(true);

      act(() => window.dispatchEvent(new Event("focus")));
      await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(githubRepositoryAccessRefreshNeeded()).toBe(false));
    } finally {
      unmount();
      visibility.mockRestore();
    }
  });

  it("refreshes pending access on a BFCache return without repeating normal page loads or completed work", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useGitHubRepositoryAccessAutoRefresh(onRefresh));

    try {
      markGitHubRepositoryAccessRefreshNeeded();
      act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false })));
      expect(onRefresh).not.toHaveBeenCalled();
      expect(githubRepositoryAccessRefreshNeeded()).toBe(true);

      act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(githubRepositoryAccessRefreshNeeded()).toBe(false));

      act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }

    markGitHubRepositoryAccessRefreshNeeded();
    act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(githubRepositoryAccessRefreshNeeded()).toBe(true);
  });

  it("waits for a visible BFCache return and shares one refresh across concurrent return events", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    let finishRefresh;
    const onRefresh = vi.fn(() => new Promise((resolve) => { finishRefresh = resolve; }));
    markGitHubRepositoryAccessRefreshNeeded();
    const { unmount } = renderHook(() => useGitHubRepositoryAccessAutoRefresh(onRefresh));

    try {
      act(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      expect(onRefresh).not.toHaveBeenCalled();
      expect(githubRepositoryAccessRefreshNeeded()).toBe(true);

      visibility.mockReturnValue("visible");
      act(() => {
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(githubRepositoryAccessRefreshNeeded()).toBe(true);

      await act(async () => finishRefresh());
      expect(githubRepositoryAccessRefreshNeeded()).toBe(false);
    } finally {
      unmount();
      visibility.mockRestore();
    }
  });

  it("keeps a failed BFCache refresh pending and retries it on the next persisted return", async () => {
    const onRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("sync unavailable"))
      .mockResolvedValueOnce(undefined);
    const { unmount } = renderHook(() => useGitHubRepositoryAccessAutoRefresh(onRefresh));

    try {
      markGitHubRepositoryAccessRefreshNeeded();
      await act(async () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      expect(onRefresh).toHaveBeenCalledTimes(1);
      expect(githubRepositoryAccessRefreshNeeded()).toBe(true);

      await act(async () => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
      expect(onRefresh).toHaveBeenCalledTimes(2);
      expect(githubRepositoryAccessRefreshNeeded()).toBe(false);
    } finally {
      unmount();
    }
  });
});
