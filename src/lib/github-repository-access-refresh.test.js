import { describe, expect, it, vi } from "vitest";
import {
  clearGitHubRepositoryAccessRefreshNeeded,
  githubRepositoryAccessRefreshNeeded,
  markGitHubRepositoryAccessRefreshNeeded,
} from "./github-repository-access-refresh.js";

describe("GitHub repository access refresh storage", () => {
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
});
