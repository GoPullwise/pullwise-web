import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import {
  clearPullwiseDataCache,
  normalizeIssue,
  normalizeRepo,
  normalizeScan,
  rememberIssueUpdate,
  scanQueueSummary,
  useIssues,
  useRepositories,
  useScanBatchRun,
  useScanRun,
  useScans,
} from "./pullwise-data.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    repositories: {
      list: vi.fn(),
      sync: vi.fn(),
    },
    scans: {
      create: vi.fn(),
      cancel: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    },
    issues: {
      list: vi.fn(),
    },
  },
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  clearPullwiseDataCache();
});

describe("normalizeScan", () => {
  it("preserves graph-verified report counts and confirmed JSON without markdown artifacts", () => {
    const scan = normalizeScan({
      id: "sc_1",
      repo: "acme/app",
      graphVerifiedReport: {
        runId: "run_1",
        mode: "standard",
        confirmedCount: "1",
        rejectedCount: "2",
        blockedCount: "0",
        coverage: { scope: "full-repository snapshot" },
        reviewUnits: [{ unit_id: "unit-0001", status: "covered" }],
        finalMarkdown: "# Graph-Verified Code Review Report",
        finalJson: {
          coverage: { reviewedFiles: 1 },
          confirmed: [{ candidate: { issue_id: "issue_1" } }],
        },
      },
    });

    expect(scan.graphVerifiedReport).toMatchObject({
      version: "graph-verified-code-review/1",
      runId: "run_1",
      mode: "standard",
      confirmedCount: 1,
      rejectedCount: 2,
      blockedCount: 0,
    });
    expect(scan.graphVerifiedReport.finalMarkdown).toBeUndefined();
    expect(scan.graphVerifiedReport.debugMarkdown).toBeUndefined();
    expect(scan.graphVerifiedReport.coverage.scope).toBe("full-repository snapshot");
    expect(scan.graphVerifiedReport.reviewUnits[0].unit_id).toBe("unit-0001");
    expect(scan.graphVerifiedReport.finalJson.coverage.reviewedFiles).toBe(1);
    expect(scan.graphVerifiedReport.finalJson.confirmed[0].candidate.issue_id).toBe("issue_1");
  });
});

describe("useRepositories", () => {
  beforeEach(() => {
    pullwiseApi.repositories.list.mockReset();
    pullwiseApi.repositories.sync.mockReset();
  });

  it("normalizes authorization flags from repository payloads", async () => {
    pullwiseApi.repositories.list.mockResolvedValueOnce({
      items: [],
      installations: [],
      installationAccounts: [],
      userQuota: { scope: "user", used: "8", limit: "10", remaining: "2" },
      needsAuthorization: "false",
    });

    const { result, unmount } = renderHook(() => useRepositories());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsAuthorization).toBe(false);
    expect(result.current.userQuota).toMatchObject({
      scope: "user",
      used: 8,
      limit: 10,
      remaining: 2,
    });
    unmount();

    pullwiseApi.repositories.list.mockResolvedValueOnce({
      items: [],
      installations: [],
      installationAccounts: [],
      needsAuthorization: "true",
    });

    const next = renderHook(() => useRepositories());

    await waitFor(() => expect(next.result.current.loading).toBe(false));
    expect(next.result.current.needsAuthorization).toBe(true);
    next.unmount();
  });

  it("shows cached repositories without blocking loading while refreshing after remount", async () => {
    const refresh = deferred();
    pullwiseApi.repositories.list
      .mockResolvedValueOnce({
        items: [{ id: "repo_1", fullName: "owner/old" }],
        needsAuthorization: false,
      })
      .mockReturnValueOnce(refresh.promise);

    const first = renderHook(() => useRepositories());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.items.map((repo) => repo.fullName)).toEqual(["owner/old"]);
    first.unmount();

    const next = renderHook(() => useRepositories());
    expect(next.result.current.loading).toBe(false);
    expect(next.result.current.items.map((repo) => repo.fullName)).toEqual(["owner/old"]);

    await act(async () => {
      refresh.resolve({
        items: [{ id: "repo_2", fullName: "owner/new" }],
        needsAuthorization: false,
      });
    });

    await waitFor(() => expect(next.result.current.loading).toBe(false));
    expect(next.result.current.items.map((repo) => repo.fullName)).toEqual(["owner/new"]);
    next.unmount();
  });

  it("blocks with loading when repositories have no cached state", async () => {
    const refresh = deferred();
    pullwiseApi.repositories.list.mockReturnValueOnce(refresh.promise);

    const { result, unmount } = renderHook(() => useRepositories());

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    await act(async () => {
      refresh.resolve({
        items: [{ id: "repo_1", fullName: "owner/repo" }],
        needsAuthorization: false,
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((repo) => repo.fullName)).toEqual(["owner/repo"]);
    unmount();
  });

  it("requests paginated repository pages and appends more results", async () => {
    pullwiseApi.repositories.list
      .mockResolvedValueOnce({
        items: [{ id: "repo_1", fullName: "owner/one" }],
        total: 2,
        limit: 1,
        offset: 0,
        hasMore: true,
        nextOffset: 1,
      })
      .mockResolvedValueOnce({
        items: [{ id: "repo_2", fullName: "owner/two" }],
        total: 2,
        limit: 1,
        offset: 1,
        hasMore: false,
        nextOffset: null,
      });

    const { result, unmount } = renderHook(() => useRepositories({ limit: 1 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((repo) => repo.fullName)).toEqual(["owner/one"]);
    expect(result.current.meta.total).toBe(2);
    expect(pullwiseApi.repositories.list).toHaveBeenNthCalledWith(1, { limit: 1 }, expect.objectContaining({ signal: expect.any(Object) }));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((repo) => repo.fullName)).toEqual(["owner/one", "owner/two"]);
    expect(pullwiseApi.repositories.list).toHaveBeenNthCalledWith(2, { limit: 1, offset: 1 }, expect.objectContaining({ signal: expect.any(Object) }));
    unmount();
  });
});

describe("useScans", () => {
  beforeEach(() => {
    pullwiseApi.scans.create.mockReset();
    pullwiseApi.scans.cancel.mockReset();
    pullwiseApi.scans.get.mockReset();
    pullwiseApi.scans.list.mockReset();
    pullwiseApi.scans.status = undefined;
  });

  it("keeps polling while queued or running scans are active", async () => {
    pullwiseApi.scans.list
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "queued" }] })
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "running" }] })
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "done" }] });

    renderHook(() => useScans({ pollIntervalMs: 25 }));

    await waitFor(() => expect(pullwiseApi.scans.list.mock.calls.length).toBeGreaterThanOrEqual(1));
    await waitFor(
      () => expect(pullwiseApi.scans.list.mock.calls.length).toBeGreaterThanOrEqual(2),
      { timeout: 250 }
    );
    await waitFor(
      () => expect(pullwiseApi.scans.list.mock.calls.length).toBeGreaterThanOrEqual(3),
      { timeout: 250 }
    );
  });

  it("keeps polling active scans after a transient list error", async () => {
    pullwiseApi.scans.list
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "running" }] })
      .mockRejectedValueOnce(new Error("timeout of 12000ms exceeded"))
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "done" }] });

    const { result, unmount } = renderHook(() => useScans({ pollIntervalMs: 5 }));

    await waitFor(() => expect(result.current.items[0]?.status).toBe("running"));
    await waitFor(() => expect(result.current.error).toMatch(/timeout/i));
    await waitFor(() => expect(result.current.items[0]?.status).toBe("done"), { timeout: 250 });
    expect(result.current.error).toBe("");
    unmount();
  });

  it("aborts in-flight scan list requests when clearing the data cache", async () => {
    const refresh = deferred();
    let signal;
    pullwiseApi.scans.list.mockImplementationOnce((_params, options = {}) => {
      signal = options.signal;
      return refresh.promise;
    });

    const { unmount } = renderHook(() => useScans({ pollIntervalMs: 10000 }));

    await waitFor(() => expect(signal).toBeTruthy());

    act(() => {
      clearPullwiseDataCache();
    });

    expect(signal.aborted).toBe(true);

    await act(async () => {
      refresh.resolve({ items: [] });
    });
    unmount();
  });

  it("passes list filters and appends paginated scan results", async () => {
    pullwiseApi.scans.list
      .mockResolvedValueOnce({
        items: [{ id: "sc_1", status: "done" }],
        total: 2,
        limit: 1,
        offset: 0,
        hasMore: true,
        nextOffset: 1,
      })
      .mockResolvedValueOnce({
        items: [{ id: "sc_2", status: "done" }],
        total: 2,
        limit: 1,
        offset: 1,
        hasMore: false,
        nextOffset: null,
      });

    const { result } = renderHook(() =>
      useScans({ pollIntervalMs: 25, limit: 1, status: "done", repo: "owner/repo" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(pullwiseApi.scans.list).toHaveBeenNthCalledWith(1, {
      limit: 1,
      status: "done",
      repo: "owner/repo",
    }, expect.objectContaining({ signal: expect.any(Object) }));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(pullwiseApi.scans.list).toHaveBeenNthCalledWith(2, {
      limit: 1,
      offset: 1,
      status: "done",
      repo: "owner/repo",
    }, expect.objectContaining({ signal: expect.any(Object) }));
  });

  it("shows cached scans without blocking loading while refreshing after remount", async () => {
    const refresh = deferred();
    pullwiseApi.scans.list
      .mockResolvedValueOnce({ items: [{ id: "sc_old", status: "done" }] })
      .mockReturnValueOnce(refresh.promise);

    const first = renderHook(() => useScans({ pollIntervalMs: 10000, limit: 1 }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.items.map((scan) => scan.id)).toEqual(["sc_old"]);
    first.unmount();

    const next = renderHook(() => useScans({ pollIntervalMs: 10000, limit: 1 }));
    expect(next.result.current.loading).toBe(false);
    expect(next.result.current.items.map((scan) => scan.id)).toEqual(["sc_old"]);

    await act(async () => {
      refresh.resolve({ items: [{ id: "sc_new", status: "done" }] });
    });

    await waitFor(() => expect(next.result.current.loading).toBe(false));
    expect(next.result.current.items.map((scan) => scan.id)).toEqual(["sc_new"]);
    next.unmount();
  });

  it("blocks with loading when scans have no cached state", async () => {
    const refresh = deferred();
    pullwiseApi.scans.list.mockReturnValueOnce(refresh.promise);

    const { result, unmount } = renderHook(() =>
      useScans({ pollIntervalMs: 10000, limit: 1 })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    await act(async () => {
      refresh.resolve({ items: [{ id: "sc_1", status: "done" }] });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((scan) => scan.id)).toEqual(["sc_1"]);
    unmount();
  });

  it("includes the scan request id when creating a scan", async () => {
    pullwiseApi.scans.create.mockResolvedValueOnce({
      id: "sc_1",
      repo: "owner/repo",
      branch: "main",
      status: "done",
    });

    renderHook(() =>
      useScanRun({
        repo: "owner/repo",
        branch: "main",
        requestId: "scan_req_1",
        pollIntervalMs: 25,
      })
    );

    await waitFor(() => {
      expect(pullwiseApi.scans.create).toHaveBeenCalledWith({
        repo: "owner/repo",
        branch: "main",
        commit: "pending",
        requestId: "scan_req_1",
      });
    });
  });

  it("prefers stable repository ids when creating a scan", async () => {
    pullwiseApi.scans.create.mockResolvedValueOnce({
      id: "sc_1",
      repo: "owner/repo",
      repoId: "repo_123",
      branch: "main",
      status: "done",
    });

    renderHook(() =>
      useScanRun({
        repoId: "repo_123",
        repo: "owner/repo",
        branch: "main",
        requestId: "scan_req_repo_id",
        pollIntervalMs: 25,
      })
    );

    await waitFor(() => {
      expect(pullwiseApi.scans.create).toHaveBeenCalledWith({
        repoId: "repo_123",
        repo: "owner/repo",
        branch: "main",
        commit: "pending",
        requestId: "scan_req_repo_id",
      });
    });
  });

  it("creates a scan for each repository in a batch", async () => {
    pullwiseApi.scans.create
      .mockResolvedValueOnce({
        id: "sc_1",
        repo: "owner/alpha",
        branch: "main",
        status: "queued",
      })
      .mockResolvedValueOnce({
        id: "sc_2",
        repo: "owner/beta",
        branch: "develop",
        status: "queued",
      });

    renderHook(() =>
      useScanBatchRun({
        repositories: [
          {
            repo: "owner/alpha",
            branch: "main",
            commit: "pending",
            requestId: "scan_req_alpha",
          },
          {
            repo: "owner/beta",
            branch: "develop",
            commit: "pending",
            requestId: "scan_req_beta",
          },
        ],
        pollIntervalMs: 25,
      })
    );

    await waitFor(() => {
      expect(pullwiseApi.scans.create).toHaveBeenCalledTimes(2);
    });
    expect(pullwiseApi.scans.create).toHaveBeenNthCalledWith(1, {
      repo: "owner/alpha",
      branch: "main",
      commit: "pending",
      requestId: "scan_req_alpha",
    });
    expect(pullwiseApi.scans.create).toHaveBeenNthCalledWith(2, {
      repo: "owner/beta",
      branch: "develop",
      commit: "pending",
      requestId: "scan_req_beta",
    });
  });

  it("monitors an existing scan by id without creating a new scan", async () => {
    pullwiseApi.scans.get.mockResolvedValue({
      id: "sc_running",
      repo: "owner/repo",
      branch: "main",
      status: "done",
    });

    renderHook(() =>
      useScanRun({
        scanId: "sc_running",
        initialScan: {
          id: "sc_running",
          repo: "owner/repo",
          branch: "main",
          status: "queued",
        },
        pollIntervalMs: 25,
      })
    );

    await waitFor(() => {
      expect(pullwiseApi.scans.get).toHaveBeenCalledWith("sc_running", expect.objectContaining({ signal: expect.any(Object) }));
    });
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
  });

  it("keeps successful batch cancel results when another cancel request fails", async () => {
    const cancelError = new Error("cancel beta failed");
    pullwiseApi.scans.create
      .mockResolvedValueOnce({
        id: "sc_cancel_alpha",
        repo: "owner/alpha",
        branch: "main",
        status: "running",
      })
      .mockResolvedValueOnce({
        id: "sc_cancel_beta",
        repo: "owner/beta",
        branch: "main",
        status: "running",
      });
    pullwiseApi.scans.cancel
      .mockResolvedValueOnce({
        id: "sc_cancel_alpha",
        repo: "owner/alpha",
        branch: "main",
        status: "cancelled",
      })
      .mockRejectedValueOnce(cancelError);

    const { result, unmount } = renderHook(() =>
      useScanBatchRun({
        repositories: [
          { repo: "owner/alpha", branch: "main", commit: "pending" },
          { repo: "owner/beta", branch: "main", commit: "pending" },
        ],
        pollIntervalMs: 10000,
      })
    );

    await waitFor(() => expect(result.current.scans).toHaveLength(2));

    await act(async () => {
      await result.current.cancel();
    });

    expect(pullwiseApi.scans.cancel).toHaveBeenCalledTimes(2);
    expect(result.current.scans.find((scan) => scan.id === "sc_cancel_alpha")?.status).toBe("cancelled");
    expect(result.current.scans.find((scan) => scan.id === "sc_cancel_beta")?.status).toBe("running");
    expect(result.current.batchResults.find((row) => row.scanId === "sc_cancel_beta")?.error).toBe("cancel beta failed");
    expect(result.current.error).toBe("cancel beta failed");
    unmount();
  });

  it("exposes loading while an existing scan detail is fetched", async () => {
    const refresh = deferred();
    pullwiseApi.scans.get.mockReturnValueOnce(refresh.promise);

    const { result, unmount } = renderHook(() =>
      useScanRun({
        scanId: "sc_history",
        initialScan: {
          id: "sc_history",
          repo: "owner/repo",
          branch: "main",
          status: "done",
        },
        pollIntervalMs: 25,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.scan).toMatchObject({ id: "sc_history", repo: "owner/repo" });

    await act(async () => {
      refresh.resolve({
        id: "sc_history",
        repo: "owner/repo",
        branch: "main",
        status: "done",
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
  });

  it("surfaces active scan polling timeouts until polling recovers", async () => {
    const recovery = deferred();
    pullwiseApi.scans.create.mockResolvedValueOnce({
      id: "sc_retry",
      repo: "owner/repo",
      branch: "main",
      status: "running",
      progress: 35,
    });
    pullwiseApi.scans.get
      .mockRejectedValueOnce(new Error("timeout of 12000ms exceeded"))
      .mockReturnValueOnce(recovery.promise);

    const { result, unmount } = renderHook(() =>
      useScanRun({
        repo: "owner/repo",
        branch: "main",
        pollIntervalMs: 5,
      })
    );

    await waitFor(() => expect(result.current.scan?.status).toBe("running"));
    await waitFor(() => expect(pullwiseApi.scans.get).toHaveBeenCalledTimes(2));
    expect(result.current.error).toMatch(/timeout/i);

    await act(async () => {
      recovery.resolve({
        id: "sc_retry",
        repo: "owner/repo",
        branch: "main",
        status: "done",
        progress: 100,
      });
    });

    await waitFor(() => expect(result.current.scan?.status).toBe("done"));
    expect(result.current.error).toBe("");
    unmount();
  });

  it("surfaces batch scan polling timeouts until polling recovers", async () => {
    const recovery = deferred();
    pullwiseApi.scans.create.mockResolvedValueOnce({
      id: "sc_batch_retry",
      repo: "owner/alpha",
      branch: "main",
      status: "running",
      progress: 25,
    });
    pullwiseApi.scans.get
      .mockRejectedValueOnce(new Error("timeout of 12000ms exceeded"))
      .mockReturnValueOnce(recovery.promise);

    const { result, unmount } = renderHook(() =>
      useScanBatchRun({
        repositories: [{ repo: "owner/alpha", branch: "main", commit: "pending" }],
        pollIntervalMs: 5,
      })
    );

    await waitFor(() => expect(result.current.scans[0]?.status).toBe("running"));
    await waitFor(() => expect(pullwiseApi.scans.get).toHaveBeenCalledTimes(2));
    expect(result.current.error).toMatch(/timeout/i);

    await act(async () => {
      recovery.resolve({
        id: "sc_batch_retry",
        repo: "owner/alpha",
        branch: "main",
        status: "done",
        progress: 100,
      });
    });

    await waitFor(() => expect(result.current.scans[0]?.status).toBe("done"));
    expect(result.current.error).toBe("");
    unmount();
  });

  it("falls back to individual scan polling when the bulk status endpoint is unavailable", async () => {
    const unavailable = Object.assign(new Error("Not Found"), { status: 404 });
    const fallbackStatus = deferred();
    pullwiseApi.scans.status = vi.fn().mockRejectedValueOnce(unavailable);
    pullwiseApi.scans.create.mockResolvedValueOnce({
      id: "sc_bulk_unavailable",
      repo: "owner/alpha",
      branch: "main",
      status: "running",
      progress: 25,
    });
    pullwiseApi.scans.get.mockReturnValueOnce(fallbackStatus.promise);

    const { result, unmount } = renderHook(() =>
      useScanBatchRun({
        repositories: [{ repo: "owner/alpha", branch: "main", commit: "pending" }],
        pollIntervalMs: 5,
      })
    );

    await waitFor(() => expect(result.current.scans[0]?.status).toBe("running"));
    await waitFor(() => expect(pullwiseApi.scans.status).toHaveBeenCalledWith(
      ["sc_bulk_unavailable"],
      expect.objectContaining({ signal: expect.any(Object) })
    ));
    await waitFor(() => expect(pullwiseApi.scans.get).toHaveBeenCalledWith(
      "sc_bulk_unavailable",
      expect.objectContaining({ signal: expect.any(Object) })
    ));
    await act(async () => {
      fallbackStatus.resolve({
        id: "sc_bulk_unavailable",
        repo: "owner/alpha",
        branch: "main",
        status: "done",
        progress: 100,
      });
    });
    await waitFor(() => expect(result.current.scans[0]?.status).toBe("done"));
    expect(result.current.error).toBe("");
    unmount();
  });
});

describe("useIssues", () => {
  beforeEach(() => {
    pullwiseApi.issues.list.mockReset();
  });

  it("passes list filters and appends paginated issue results", async () => {
    pullwiseApi.issues.list
      .mockResolvedValueOnce({
        items: [{ id: "iss_1", status: "open", severity: "high" }],
        total: 2,
        limit: 1,
        offset: 0,
        hasMore: true,
        nextOffset: 1,
      })
      .mockResolvedValueOnce({
        items: [{ id: "iss_2", status: "open", severity: "high" }],
        total: 2,
        limit: 1,
        offset: 1,
        hasMore: false,
        nextOffset: null,
      });

    const { result } = renderHook(() =>
      useIssues({ limit: 1, status: "open", severity: "high", q: "auth", scanId: "sc_1" })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(pullwiseApi.issues.list).toHaveBeenNthCalledWith(1, {
      limit: 1,
      status: "open",
      severity: "high",
      q: "auth",
      scanId: "sc_1",
    }, expect.objectContaining({ signal: expect.any(Object) }));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(pullwiseApi.issues.list).toHaveBeenNthCalledWith(2, {
      limit: 1,
      offset: 1,
      status: "open",
      severity: "high",
      q: "auth",
      scanId: "sc_1",
    }, expect.objectContaining({ signal: expect.any(Object) }));
  });

  it("keeps locally fixed issues out of the open list after remount when refresh is stale", async () => {
    const issue = {
      id: "iss_1",
      scanId: "sc_1",
      repo: "acme/api",
      file: "src/auth.py",
      title: "Validate redirects",
      status: "open",
      severity: "high",
    };
    const refresh = deferred();
    pullwiseApi.issues.list
      .mockResolvedValueOnce({ items: [issue], total: 1 })
      .mockReturnValueOnce(refresh.promise);

    const first = renderHook(() => useIssues({ limit: 1, status: "open", refreshOnChange: false }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    rememberIssueUpdate(issue, { ...issue, status: "fixed" });
    first.unmount();

    const next = renderHook(() => useIssues({ limit: 1, status: "open", refreshOnChange: false }));
    expect(next.result.current.loading).toBe(false);
    expect(next.result.current.items).toEqual([]);

    await act(async () => {
      refresh.resolve({ items: [issue], total: 1 });
    });

    await waitFor(() => expect(next.result.current.loading).toBe(false));
    expect(next.result.current.items).toEqual([]);
    next.unmount();
  });
  it("shows cached issues without blocking loading while refreshing after remount", async () => {
    const refresh = deferred();
    pullwiseApi.issues.list
      .mockResolvedValueOnce({ items: [{ id: "iss_old", status: "open", severity: "high" }] })
      .mockReturnValueOnce(refresh.promise);

    const first = renderHook(() => useIssues({ limit: 1, status: "open", refreshOnChange: false }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.items.map((issue) => issue.id)).toEqual(["iss_old"]);
    first.unmount();

    const next = renderHook(() => useIssues({ limit: 1, status: "open", refreshOnChange: false }));
    expect(next.result.current.loading).toBe(false);
    expect(next.result.current.items.map((issue) => issue.id)).toEqual(["iss_old"]);

    await act(async () => {
      refresh.resolve({ items: [{ id: "iss_new", status: "open", severity: "medium" }] });
    });

    await waitFor(() => expect(next.result.current.loading).toBe(false));
    expect(next.result.current.items.map((issue) => issue.id)).toEqual(["iss_new"]);
    next.unmount();
  });

  it("blocks with loading when issues have no cached state", async () => {
    const refresh = deferred();
    pullwiseApi.issues.list.mockReturnValueOnce(refresh.promise);

    const { result, unmount } = renderHook(() =>
      useIssues({ limit: 1, status: "open", refreshOnChange: false })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);

    await act(async () => {
      refresh.resolve({ items: [{ id: "iss_1", status: "open", severity: "high" }] });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((issue) => issue.id)).toEqual(["iss_1"]);
    unmount();
  });

  it("ignores late scan-list responses from older filters", async () => {
    const slowAll = deferred();
    const fastDone = deferred();
    pullwiseApi.scans.list
      .mockReturnValueOnce(slowAll.promise)
      .mockReturnValueOnce(fastDone.promise);

    const { result, rerender } = renderHook(
      ({ status }) => useScans({ pollIntervalMs: 10000, limit: 1, status }),
      { initialProps: { status: "" } }
    );

    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(1));
    rerender({ status: "done" });
    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(2));

    await act(async () => {
      fastDone.resolve({ items: [{ id: "sc_done", status: "done" }] });
    });
    await waitFor(() => expect(result.current.items.map((scan) => scan.id)).toEqual(["sc_done"]));

    await act(async () => {
      slowAll.resolve({ items: [{ id: "sc_queued", status: "queued" }] });
    });

    expect(result.current.items.map((scan) => scan.id)).toEqual(["sc_done"]);
  });

  it("reloads issue lists when issue data changes", async () => {
    pullwiseApi.issues.list
      .mockResolvedValueOnce({
        items: [{ id: "iss_1", status: "open", severity: "high" }],
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [],
        total: 0,
      });

    const { result, unmount } = renderHook(() => useIssues({ status: "open", limit: 1 }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent("pullwise:issues-changed"));
    });

    await waitFor(() => expect(pullwiseApi.issues.list).toHaveBeenCalledTimes(2));
    expect(result.current.items).toHaveLength(0);

    unmount();
  });

  it("ignores late issue-list responses from older filters", async () => {
    const slowOpen = deferred();
    const fastFixed = deferred();
    pullwiseApi.issues.list
      .mockReturnValueOnce(slowOpen.promise)
      .mockReturnValueOnce(fastFixed.promise);

    const { result, rerender } = renderHook(
      ({ status }) => useIssues({ status, limit: 1, refreshOnChange: false }),
      { initialProps: { status: "open" } }
    );

    await waitFor(() => expect(pullwiseApi.issues.list).toHaveBeenCalledTimes(1));
    rerender({ status: "fixed" });
    await waitFor(() => expect(pullwiseApi.issues.list).toHaveBeenCalledTimes(2));

    await act(async () => {
      fastFixed.resolve({ items: [{ id: "iss_fixed", status: "fixed" }] });
    });
    await waitFor(() =>
      expect(result.current.items.map((issue) => issue.id)).toEqual(["iss_fixed"])
    );

    await act(async () => {
      slowOpen.resolve({ items: [{ id: "iss_open", status: "open" }] });
    });

    expect(result.current.items.map((issue) => issue.id)).toEqual(["iss_fixed"]);
  });
});

describe("normalizeIssue", () => {
  it("handles null payload records without throwing", () => {
    expect(normalizeRepo(null)).toMatchObject({ id: "", name: "", fullName: "" });
    expect(normalizeIssue(null)).toMatchObject({
      id: "",
      severity: "info",
      category: "General",
      status: "open",
      confidence: 0,
    });
    expect(normalizeScan(null)).toMatchObject({ id: "", branch: "main", status: "queued" });
  });

  it("normalizes graph-verified static proof issue fields", () => {
    const issue = normalizeIssue({
      id: "issue_static",
      title: "Static lifecycle proof",
      graphVerified: true,
      verificationStatus: "static_proof",
      confidenceLevel: "high",
      reproductionPath: "Inspect the worker lifecycle state transition.",
      reproduction: {
        steps: ["Inspect src/worker.py", "Compare pending state with cleanup behavior"],
        expected: "Pending uploads remain protected.",
        actual: "Cleanup can unload the pending upload watcher.",
      },
      reproProof: {
        type: "static-proof",
        verification_steps: ["Inspect src/worker.py", "Confirm cleanup lacks pending upload guard"],
      },
    });

    expect(issue.verificationStatus).toBe("static_proof");
    expect(issue.confidenceLevel).toBe("high");
    expect(issue.reproductionPath).toBe("Inspect the worker lifecycle state transition.");
    expect(issue.reproduction.steps).toEqual([
      "Inspect src/worker.py",
      "Compare pending state with cleanup behavior",
    ]);
    expect(issue.reproProof.verificationSteps).toEqual([
      "Inspect src/worker.py",
      "Confirm cleanup lacks pending upload guard",
    ]);
  });
  it("normalizes repository text fields for search-safe rendering", () => {
    const repo = normalizeRepo({
      id: 42,
      name: 12345,
      description: 987,
      language: 99,
      updatedAt: 1700000000,
    });

    expect(repo).toMatchObject({
      id: "42",
      name: "12345",
      fullName: "12345",
      desc: "987",
      lang: "99",
      updated: "1700000000",
    });
    expect(() =>
      [repo.name, repo.fullName, repo.desc].some((value) => value.toLowerCase().includes("123"))
    ).not.toThrow();
  });

  it("normalizes repository count metadata for display-safe rendering", () => {
    expect(
      normalizeRepo({
        name: "octocat/repo",
        stars: { value: 10 },
        stargazers_count: "7.9",
        branches: "3.5",
      })
    ).toMatchObject({
      stars: 7,
      branches: 3,
    });

    expect(normalizeRepo({ name: "octocat/repo", stars: "bad", branches: {} })).toMatchObject({
      stars: "-",
      branches: "-",
    });

    expect(normalizeRepo({ name: "octocat/repo", stars: -2, branches: -3 })).toMatchObject({
      stars: 0,
      branches: 0,
    });
  });

  it("normalizes boolean-like payload fields without treating false strings as true", () => {
    expect(normalizeRepo({ name: "octocat/public-repo", private: "false" }).private).toBe(false);
    expect(normalizeRepo({ name: "octocat/private-repo", private: "true" }).private).toBe(true);
    expect(
      normalizeIssue({
        id: "f_manual",
        autoFix: "false",
        autoFixable: "false",
        fixability_state: "missing_patch",
        fixability_reason: "No safe deterministic patch was generated for this issue.",
      })
    ).toMatchObject({
      autoFix: false,
      autoFixable: false,
      fixabilityState: "missing_patch",
      fixabilityReason: "No safe deterministic patch was generated for this issue.",
    });
    expect(normalizeIssue({ id: "f_auto", autoFix: "true" })).toMatchObject({
      autoFix: true,
      autoFixable: false,
    });
  });

  it("preserves repository quota fields", () => {
    expect(
      normalizeRepo({
        id: "repo_123",
        fullName: "octocat/repo",
        githubRepoId: 123,
        githubNodeId: "R_123",
        quota: { scope: "repository", period: "2026-05", used: "1.8", limit: "3", remaining: "2" },
        href: "/repositories/repo_123",
        scanAction: { href: "/scans", method: "POST" },
      })
    ).toMatchObject({
      id: "repo_123",
      repoId: "repo_123",
      githubRepoId: "123",
      githubNodeId: "R_123",
      href: "/repositories/repo_123",
      scanAction: { href: "/scans", method: "POST" },
      quota: {
        scope: "repository",
        period: "2026-05",
        used: 1,
        limit: 3,
        remaining: 2,
      },
    });
  });

  it("strips control characters from quota display text", () => {
    expect(
      normalizeRepo({
        fullName: "octocat/repo\r\nX-Injected: bad",
        quota: {
          scope: "repository\r\nX-Injected: bad",
          period: "2026-05\r\nX-Injected: bad",
          plan: "free\r\nX-Injected: bad",
        },
      })
    ).toMatchObject({
      fullName: "octocat/repo",
      quota: {
        scope: "repository",
        period: "2026-05",
        plan: "free",
      },
    });
  });

  it("normalizes issue text fields for search-safe rendering", () => {
    const issue = normalizeIssue({
      id: 123,
      scanId: 456,
      repo: 789,
      title: 1011,
      description: 1213,
      severity: 14,
      category: 1516,
      status: 17,
      file: 1819,
      effort: 2021,
    });

    expect(issue).toMatchObject({
      id: "123",
      scanId: "456",
      repo: "789",
      title: "1011",
      summary: "1213",
      severity: "info",
      category: "1516",
      status: "open",
      file: "1819",
      effort: "2021",
    });
    expect(() =>
      [issue.title, issue.file, issue.repo, issue.category, issue.id].some((value) =>
        value.toLowerCase().includes("18")
      )
    ).not.toThrow();
  });

  it("normalizes issue line numbers for display-safe file labels", () => {
    expect(normalizeIssue({ id: "f_line", line: "42" }).line).toBe("42");
    expect(normalizeIssue({ id: "f_float_line", line: 42.8 }).line).toBe("42");
    expect(normalizeIssue({ id: "f_bad_line", line: { value: 42 } }).line).toBeNull();
    expect(normalizeIssue({ id: "f_negative_line", line: -1 }).line).toBeNull();
  });

  it("normalizes issue rich detail arrays for safe rendering", () => {
    const issue = normalizeIssue({
      id: "f_rich",
      steps: [
        "Review input validation",
        "Block unsafe redirects\r\nX-Injected: bad",
        42,
        null,
        { text: "bad shape" },
      ],
      badCode: [
        null,
        { ln: "7\r\nX-Injected: bad\x00", code: "return ok\r\nX-Injected: bad\x00", t: "add" },
        { ln: "x", code: { nested: true }, t: "weird" },
      ],
      goodCode: ["return ok", { ln: 9, code: "return safe", t: "del" }],
      references: [
        null,
        { label: "Docs\r\nX-Injected: bad", url: "https://example.com/docs" },
        { label: 42, url: "https://example.com/a" },
        { label: "Unsafe", url: "https://example.com/unsafe\r\nX-Injected: bad" },
        { url: 123 },
        "https://example.com/raw",
        "https://example.com/raw-unsafe\r\nX-Injected: bad",
      ],
      tags: ["security\r\nX-Injected: bad", 42, true, "", null, { label: "bad" }],
    });

    expect(issue.steps).toEqual(["Review input validation", "Block unsafe redirects", "42"]);
    expect(issue.badCode).toEqual([{ ln: "7", code: "return ok", t: "add" }]);
    expect(issue.goodCode).toEqual([
      { ln: "", code: "return ok", t: "" },
      { ln: "9", code: "return safe", t: "del" },
    ]);
    expect(issue.references).toEqual([
      { label: "Docs", url: "https://example.com/docs" },
      { label: "42", url: "https://example.com/a" },
      { label: "https://example.com/raw", url: "https://example.com/raw" },
    ]);
    expect(issue.tags).toEqual(["security", "42", "true"]);
  });

  it("normalizes issue evidence and reproduction fields for safe rendering", () => {
    const issue = normalizeIssue({
      id: "f_evidence",
      verificationStatus: "verified",
      confidenceLevel: "high",
      affectedLocations: [
        {
          file: "src/app.py",
          startLine: "12",
          endLine: "14",
          url: "https://github.com/acme/api/blob/abc1234/src/app.py#L12-L14",
        },
        { file: "", startLine: "1" },
      ],
      evidence: [
        {
          type: "runtime_log",
          label: "Failing test",
          summary: "pytest reproduced the 500.",
          file: "tests/repro.py",
          startLine: "7.9",
          command: "pytest tests/repro.py",
          exitCode: "1",
          logPath: "logs/f_evidence.log",
          output: "FAIL tests/repro.py\r\nAssertionError: expected 400 received 500",
          url: "javascript:alert(1)",
        },
      ],
      reproduction: {
        commands: ["pytest tests/repro.py", "bad\r\ncommand"],
        input: "GET /users?page=0",
        expected: "400",
        actual: "500",
        testFile: "tests/repro.py",
        logPath: "logs/f_evidence.log",
      },
      evidenceChecklist: [
        { label: "Fixed commit", met: "true" },
        { label: "Runtime output", met: 0 },
      ],
      evidenceTrace: [
        {
          key: "code",
          label: "Code",
          status: "present",
          summary: "Affected code location: src/app.py:L12-L14",
          items: ["Affected code location: src/app.py:L12-L14", "bad\r\nextra"],
        },
        {
          key: "runtime",
          label: "Runtime",
          status: "unexpected",
          summary: "Observed result: 500",
          items: ["Observed result: 500"],
        },
      ],
      reasoningBreakdown: {
        facts: ["Finding is pinned to commit abc1234.", "bad\r\nextra"],
        inferences: ["Impact: page=0 returns 500"],
        recommendations: ["Validate page >= 1.", { value: "bad" }],
      },
    });

    expect(issue.verificationStatus).toBe("verified");
    expect(issue.confidenceLevel).toBe("high");
    expect(issue.affectedLocations).toEqual([
      {
        file: "src/app.py",
        startLine: "12",
        endLine: "14",
        url: "https://github.com/acme/api/blob/abc1234/src/app.py#L12-L14",
      },
    ]);
    expect(issue.evidence).toMatchObject([
      {
        type: "runtime_log",
        label: "Failing test",
        summary: "pytest reproduced the 500.",
        file: "tests/repro.py",
        startLine: "7",
        command: "pytest tests/repro.py",
        exitCode: 1,
        logPath: "logs/f_evidence.log",
        outputRedacted: true,
        url: null,
      },
    ]);
    expect(issue.reproduction.commands).toEqual(["pytest tests/repro.py", "bad"]);
    expect(issue.reproduction.actual).toBe("500");
    expect(issue.evidenceChecklist).toEqual([
      { label: "Fixed commit", met: true },
      { label: "Runtime output", met: false },
    ]);
    expect(issue.evidenceTrace).toEqual([
      {
        key: "code",
        label: "Code",
        status: "present",
        summary: "Affected code location: src/app.py:L12-L14",
        items: ["Affected code location: src/app.py:L12-L14", "bad"],
      },
      {
        key: "runtime",
        label: "Runtime",
        status: "missing",
        summary: "Observed result: 500",
        items: ["Observed result: 500"],
      },
    ]);
    expect(issue.reasoningBreakdown).toEqual({
      facts: ["Finding is pinned to commit abc1234.", "bad"],
      inferences: ["Impact: page=0 returns 500"],
      recommendations: ["Validate page >= 1."],
    });
  });

  it("normalizes issue pull request metadata for safe rendering", () => {
    const issue = normalizeIssue({
      id: "f_123",
      title: "Validate redirect targets",
      pullRequest: {
        issueId: { value: "f_123" },
        branch: "pullwise/fix-f_123-existing\r\nX-Injected: bad",
        url: "javascript:alert(1)",
        number: true,
        title: "Fix Validate redirect targets\r\nX-Injected: bad",
      },
      pullRequestPending: {
        issueId: { value: "f_123" },
        branch: "pullwise/fix-f_123-existing\r\nX-Injected: bad",
        startedAt: { value: 1700000000 },
        lastError: "GitHub failed\r\nX-Injected: bad",
        failedAt: { value: 1700000001 },
      },
    });

    expect(issue.pullRequest).toEqual({
      issueId: "f_123",
      branch: "",
      url: null,
      number: null,
      title: "Fix Validate redirect targets",
    });
    expect(issue.pullRequestPending).toEqual({
      issueId: "f_123",
      branch: "",
      startedAt: 0,
      lastError: "GitHub failed",
    });

    expect(
      normalizeIssue({
        id: "f_external_pr",
        title: "Validate redirect targets",
        pullRequest: {
          branch: "pullwise/fix-f_external_pr-a1b2c3",
          url: "https://example.com/acme/api/pull/42",
          number: 42,
          title: "Fix Validate redirect targets",
        },
      }).pullRequest
    ).toMatchObject({
      url: null,
    });

    const validIssue = normalizeIssue({
      id: "f_456",
      pullRequest: {
        issueId: "ignored",
        branch: "pullwise/fix-f_456-a1b2c3",
        url: "https://github.com/acme/api/pull/42",
        number: "42",
        title: "Fix escape shell arguments",
      },
      pullRequestPending: {
        branch: "pullwise/fix-f_456-a1b2c3",
        startedAt: "1700000000",
        lastError: "Still running",
        failedAt: "1700000001",
      },
    });

    expect(validIssue.pullRequest).toEqual({
      issueId: "f_456",
      branch: "pullwise/fix-f_456-a1b2c3",
      url: "https://github.com/acme/api/pull/42",
      number: 42,
      title: "Fix escape shell arguments",
    });
    expect(validIssue.pullRequestPending).toEqual({
      issueId: "f_456",
      branch: "pullwise/fix-f_456-a1b2c3",
      startedAt: 1700000000,
      lastError: "Still running",
      failedAt: 1700000001,
    });
  });

  it("normalizes scan issue counts into finite non-negative integers", () => {
    expect(
      normalizeScan({
        id: "sc_1",
        issues: {
          critical: -1,
          high: "not-a-number",
          medium: 2.8,
          low: "3",
        },
      }).issues
    ).toEqual({
      critical: 0,
      high: 0,
      medium: 2,
      low: 3,
    });
  });

  it("normalizes canonical scan AI usage without token counts", () => {
    expect(
      normalizeScan({
        id: "sc_1",
        reviewAgent: {
          agentCli: "unsupported-review-agent",
          provider: "unsupported-provider",
          model: "unsupported-model",
          reasoningEffort: "unsupported-effort",
        },
        aiUsage: {
          agentCli: "codex",
          provider: "codex",
          model: "gpt-5.6",
          reasoningEffort: "high",
          inputTokens: "123",
          outputTokens: 45.8,
          totalTokens: "168",
        },
      }).aiUsage
    ).toEqual({
      agentCli: "codex",
      provider: "codex",
      model: "gpt-5.6",
      reasoningEffort: "high",
    });
  });

  it("normalizes scan verification counts for evidence summaries", () => {
    expect(
      normalizeScan({
        id: "sc_1",
        verification: {
          verified: "2",
          staticProof: 1.8,
          potential_risk: "bad",
          unverified: -3,
        },
      }).verification
    ).toEqual({
      verified: 2,
      static_proof: 1,
      potential_risk: 0,
      unverified: 0,
    });
    expect(normalizeScan({ id: "sc_empty" }).verification).toEqual({
      verified: 0,
      static_proof: 0,
      potential_risk: 0,
      unverified: 0,
    });
  });

  it("normalizes scan preflight evidence for safe rendering", () => {
    const scan = normalizeScan({
      id: "sc_preflight",
      preflight: {
        mode: "static",
        execution: "no_project_scripts",
        summary: "Static preflight\nsecond line",
        packageManagers: ["pnpm", "", null],
        languages: ["JavaScript/TypeScript"],
        availableScripts: ["build", "test"],
        environment: {
          os: "Linux",
          osRelease: "6.8.0",
          platform: "Linux-6.8.0-x86_64",
          machine: "x86_64",
          pythonVersion: "3.12.3",
          checkoutRoot: "/srv/pullwise/checkouts/job",
        },
        repositoryStats: {
          fileCount: "2001",
          totalBytes: String(50 * 1024 * 1024 + 1),
          scanStoppedEarly: true,
        },
        repositoryLimits: { maxFiles: "2000", maxBytes: String(50 * 1024 * 1024) },
        repositoryLimitExceeded: true,
        repositoryLimitReasons: ["file_count", "total_bytes"],
        manifests: [
          { file: "package.json", type: "node" },
          { file: "", type: "bad" },
        ],
        toolVersions: [
          {
            name: "git",
            command: "git --version",
            available: true,
            exitCode: "0",
            output: "git ok",
          },
          { name: "", command: "bad", available: true },
        ],
      },
    });

    expect(scan.preflight).toMatchObject({
      mode: "static",
      execution: "no_project_scripts",
      summary: "Static preflight",
      packageManagers: ["pnpm"],
      languages: ["JavaScript/TypeScript"],
      availableScripts: ["build", "test"],
      environment: {
        os: "Linux",
        osRelease: "6.8.0",
        platform: "Linux-6.8.0-x86_64",
        machine: "x86_64",
        pythonVersion: "3.12.3",
      },
      repositoryStats: {
        fileCount: 2001,
        totalBytes: 50 * 1024 * 1024 + 1,
        scanStoppedEarly: true,
      },
      repositoryLimits: { maxFiles: 2000, maxBytes: 50 * 1024 * 1024 },
      repositoryLimitExceeded: true,
      repositoryLimitReasons: ["file_count", "total_bytes"],
      manifests: [{ file: "package.json", type: "node" }],
      toolVersions: [
        { name: "git", command: "git --version", available: true, exitCode: 0, output: "git ok" },
      ],
    });
    expect(normalizeScan({ id: "sc_empty" }).preflight).toBeNull();
  });

  it("normalizes scan progress into a finite percentage range", () => {
    expect(normalizeScan({ id: "sc_invalid", progress: "not-a-number" }).progress).toBe(0);
    expect(normalizeScan({ id: "sc_low", progress: -12 }).progress).toBe(0);
    expect(normalizeScan({ id: "sc_high", progress: 140 }).progress).toBe(100);
    expect(normalizeScan({ id: "sc_ok", progress: "42.5" }).progress).toBe(42.5);
    expect(normalizeScan({ id: "sc_done", status: "done", progress: 80 }).progress).toBe(100);
    expect(normalizeScan({ id: "sc_failed", status: "failed", progress: 100 }).progress).toBe(94);
    expect(normalizeScan({ id: "sc_cancelled", status: "cancelled", progress: 99 }).progress).toBe(94);
  });

  it("preserves scan phase and queue metadata for active scan rendering", () => {
    const scan = normalizeScan({
      id: "sc_active",
      status: "running",
      phase: "index",
      started_at: "1700000000",
      updated_at: "1700000060",
      completed_at: 1700000120,
      progressMessage: "Graph: repository census",
      logsSummary: "stage=census",
      progressLogs: [
        {
          time: "1700000050",
          phase: "ai",
          progress: "80",
          message: "Graph: mapping",
          logs_summary: "stage=graph",
        },
        { bad: {} },
      ],
      queue: {
        message: "Waiting for worker capacity",
        position: 2,
        ahead: 1,
      },
    });

    expect(scan.phase).toBe("index");
    expect(scan.progressMessage).toBe("Graph: repository census");
    expect(scan.logsSummary).toBe("stage=census");
    expect(scan.progressLogs).toEqual([
      {
        time: 1700000050,
        phase: "ai",
        progress: 80,
        message: "Graph: mapping",
        logsSummary: "stage=graph",
      },
    ]);
    expect(scan.startedAt).toBe(1700000000);
    expect(scan.updatedAt).toBe(1700000060);
    expect(scan.completedAt).toBe(1700000120);
    expect(scan.queue).toEqual({
      message: "Waiting for worker capacity",
      position: 2,
      ahead: 1,
    });
    expect(scanQueueSummary(scan)).toEqual({
      message: "Waiting for worker capacity",
      tags: ["Position 2", "1 scan ahead"],
    });
  });

  it("preserves scan retry metadata for active scan rendering", () => {
    const scan = normalizeScan({
      id: "sc_retrying",
      status: "queued",
      retry: {
        attempt: 1,
        maxAttempts: 2,
        retryAttempts: 1,
        remainingAttempts: 1,
        attemptedWorkers: 1,
        reason: "worker_result_failed",
      },
    });

    expect(scan.retry).toEqual({
      attempt: 1,
      maxAttempts: 2,
      retryAttempts: 1,
      remainingAttempts: 1,
      attemptedWorkers: 1,
      reason: "worker_result_failed",
    });
    expect(scanQueueSummary(scan)).toEqual({
      message: "",
      tags: ["Attempt 1 of 2", "1 retry left", "Retrying after worker failure"],
    });
  });

  it("normalizes scan text fields and status for safe rendering", () => {
    expect(
      normalizeScan({
        id: 123,
        repo: 456,
        branch: 789,
        commit: 1011,
        status: 12,
        by: 1314,
        time: 1516,
      })
    ).toMatchObject({
      id: "123",
      repo: "456",
      branch: "789",
      commit: "1011",
      status: "queued",
      by: "1314",
      time: "1516",
    });

    expect(normalizeScan({ id: "sc_done", status: "done" }).status).toBe("done");
    expect(normalizeScan({ id: "sc_running", status: "running" }).status).toBe("running");
  });

  it("preserves scan account, repository, and quota summaries", () => {
    expect(
      normalizeScan({
        id: "sc_1",
        repoId: "repo_123",
        githubRepoId: 123,
        quotaBucketIds: { user: "qb_user", repository: "qb_repo" },
        billingUsage: { scope: "user", used: 2, limit: 10, remaining: 8 },
        repoUsage: { scope: "repository", used: 1, limit: 3, remaining: 2 },
      })
    ).toMatchObject({
      repoId: "repo_123",
      githubRepoId: "123",
      quotaBucketIds: { user: "qb_user", repository: "qb_repo" },
      billingUsage: { scope: "user", used: 2, limit: 10, remaining: 8 },
      repoUsage: { scope: "repository", used: 1, limit: 3, remaining: 2 },
    });
  });

  it("does not stringify object-shaped text fields into user-visible labels", () => {
    expect(
      normalizeRepo({
        id: { value: 1 },
        name: { value: "repo" },
        description: { value: "desc" },
        language: { value: "js" },
        updatedAt: { value: "now" },
      })
    ).toMatchObject({
      id: "",
      name: "",
      fullName: "",
      desc: "",
      lang: "-",
      updated: "",
    });

    expect(
      normalizeIssue({
        id: { value: "f_1" },
        title: { value: "Bad label" },
        description: { value: "summary" },
        createdAt: { value: "now" },
      })
    ).toMatchObject({
      id: "",
      title: "",
      summary: "",
      age: "",
    });

    expect(
      normalizeScan({
        id: { value: "sc_1" },
        repository: { value: "repo" },
        branch: { value: "main" },
        commit: { value: "sha" },
        time: { value: "now" },
        by: { value: "user" },
      })
    ).toMatchObject({
      id: "",
      repo: "",
      branch: "main",
      commit: "-",
      time: "",
      by: "you",
    });
  });

  it("normalizes scan queue summaries for safe rendering", () => {
    expect(
      scanQueueSummary({
        queue: {
          message: "Waiting for capacity\r\nX-Injected: bad\x00",
          position: "2.8",
          ahead: "3",
          limits: {
            global: "4",
          },
        },
      })
    ).toEqual({
      message: "Waiting for capacity",
      tags: ["Position 2", "3 scans ahead"],
    });

    expect(
      scanQueueSummary({
        queue: {
          message: { text: "bad shape" },
          position: { value: 2 },
          ahead: -1,
          limits: {
            global: {},
          },
        },
      })
    ).toEqual({ message: "", tags: [] });
  });

  it("normalizes confidence into a finite display-safe range", () => {
    expect(normalizeIssue({ id: "f_invalid", confidence: "not-a-number" }).confidence).toBe(0);
    expect(normalizeIssue({ id: "f_high", confidence: 1.6 }).confidence).toBe(1);
    expect(normalizeIssue({ id: "f_low", confidence: -0.4 }).confidence).toBe(0);
  });

  it("preserves rich review fields and supplies stable empty arrays", () => {
    expect(
      normalizeIssue({
        id: "f_123",
        scanId: "sc_1",
        impact: "Production impact.",
        references: [{ label: "Docs", url: "https://example.com" }],
      })
    ).toMatchObject({
      id: "f_123",
      scanId: "sc_1",
      impact: "Production impact.",
      steps: [],
      badCode: [],
      goodCode: [],
      references: [{ label: "Docs", url: "https://example.com" }],
      tags: [],
    });
  });
});
