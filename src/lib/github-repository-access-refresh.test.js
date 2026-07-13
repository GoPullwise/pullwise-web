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
});
