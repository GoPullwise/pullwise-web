import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import {
  clearPullwiseDataCache,
  normalizeIssue,
  normalizeRepo,
  normalizeScan,
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

  it("shows cached repositories while refreshing after remount", async () => {
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
    expect(next.result.current.loading).toBe(true);
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
});

describe("useScans", () => {
  beforeEach(() => {
    pullwiseApi.scans.create.mockReset();
    pullwiseApi.scans.get.mockReset();
    pullwiseApi.scans.list.mockReset();
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
    });

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(pullwiseApi.scans.list).toHaveBeenNthCalledWith(2, {
      limit: 1,
      offset: 1,
      status: "done",
      repo: "owner/repo",
    });
  });

  it("shows cached scans while refreshing after remount", async () => {
    const refresh = deferred();
    pullwiseApi.scans.list
      .mockResolvedValueOnce({ items: [{ id: "sc_old", status: "done" }] })
      .mockReturnValueOnce(refresh.promise);

    const first = renderHook(() => useScans({ pollIntervalMs: 10000, limit: 1 }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.items.map((scan) => scan.id)).toEqual(["sc_old"]);
    first.unmount();

    const next = renderHook(() => useScans({ pollIntervalMs: 10000, limit: 1 }));
    expect(next.result.current.loading).toBe(true);
    expect(next.result.current.items.map((scan) => scan.id)).toEqual(["sc_old"]);

    await act(async () => {
      refresh.resolve({ items: [{ id: "sc_new", status: "done" }] });
    });

    await waitFor(() => expect(next.result.current.loading).toBe(false));
    expect(next.result.current.items.map((scan) => scan.id)).toEqual(["sc_new"]);
    next.unmount();
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
      expect(pullwiseApi.scans.get).toHaveBeenCalledWith("sc_running");
    });
    expect(pullwiseApi.scans.create).not.toHaveBeenCalled();
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
    });

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
    });
  });

  it("shows cached issues while refreshing after remount", async () => {
    const refresh = deferred();
    pullwiseApi.issues.list
      .mockResolvedValueOnce({ items: [{ id: "iss_old", status: "open", severity: "high" }] })
      .mockReturnValueOnce(refresh.promise);

    const first = renderHook(() => useIssues({ limit: 1, status: "open", refreshOnChange: false }));
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.items.map((issue) => issue.id)).toEqual(["iss_old"]);
    first.unmount();

    const next = renderHook(() => useIssues({ limit: 1, status: "open", refreshOnChange: false }));
    expect(next.result.current.loading).toBe(true);
    expect(next.result.current.items.map((issue) => issue.id)).toEqual(["iss_old"]);

    await act(async () => {
      refresh.resolve({ items: [{ id: "iss_new", status: "open", severity: "medium" }] });
    });

    await waitFor(() => expect(next.result.current.loading).toBe(false));
    expect(next.result.current.items.map((issue) => issue.id)).toEqual(["iss_new"]);
    next.unmount();
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

  it("normalizes repository graph nodes, edges, and architecture summary", () => {
    const scan = normalizeScan({
      id: "sc_graph",
      repository_graph: {
        version: "repository-graph/0.1",
        stats: { nodes: 3, edges: 2, languages: ["JavaScript"], truncated: true },
        nodes: [
          {
            id: "file:src/App.jsx",
            label: "App.jsx",
            type: "entrypoint",
            path: "src/App.jsx",
            importance: 0.9,
            tags: ["frontend"],
          },
          { id: "dir:src/screens", label: "src/screens", type: "module", path: "src/screens" },
          { id: "bad", label: "bad", type: "unknown", path: "C:\\repo\\bad.js" },
        ],
        edges: [
          { id: "e1", source: "file:src/App.jsx", target: "dir:src/screens", type: "imports", weight: 2 },
          { id: "bad-edge", source: "bad", target: "missing", type: "unknown" },
        ],
        architectureSummary: {
          entrypoints: ["src/App.jsx"],
          modules: ["src/screens"],
          reviewHints: ["Review scan UI."],
          promptText: "Repository architecture: UI entrypoint.",
        },
      },
    });

    expect(scan.repositoryGraph.version).toBe("repository-graph/0.1");
    expect(scan.repositoryGraph.nodes).toHaveLength(2);
    expect(scan.repositoryGraph.edges).toHaveLength(1);
    expect(scan.repositoryGraph.stats.nodes).toBe(2);
    expect(scan.repositoryGraph.stats.edges).toBe(1);
    expect(scan.repositoryGraph.stats.languages).toEqual(["JavaScript"]);
    expect(scan.repositoryGraph.stats.truncated).toBe(true);
    expect(scan.repositoryGraph.architectureSummary.entrypoints).toEqual(["src/App.jsx"]);
    expect(scan.repositoryGraph.architectureSummary.reviewHints).toEqual(["Review scan UI."]);
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
      normalizeIssue({ id: "f_manual", autoFix: "false", autoFixable: "false" })
    ).toMatchObject({
      autoFix: false,
      autoFixable: false,
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

  it("normalizes saved issue feedback reasons", () => {
    expect(normalizeIssue({ id: "f_useful", feedbackReason: "valid" }).feedbackReason).toBe(
      "useful"
    );
    expect(normalizeIssue({ id: "f_fp", feedback_reason: "False Positive" }).feedbackReason).toBe(
      "false_positive"
    );
    expect(normalizeIssue({ id: "f_spec", feedbackReason: "speculative" }).feedbackReason).toBe(
      "too_speculative"
    );
    expect(normalizeIssue({ id: "f_bad", feedbackReason: "<script>" }).feedbackReason).toBe("");
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

  it("normalizes scan AI usage to model metadata without token counts", () => {
    expect(
      normalizeScan({
        id: "sc_1",
        ai_usage: {
          provider: "codex",
          model: "gpt-5.5",
          input_tokens: "123",
          outputTokens: 45.8,
          total_tokens: "168",
        },
      }).aiUsage
    ).toEqual({
      model: "gpt-5.5",
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

  it("normalizes scan verification audit counts for candidate reporting", () => {
    expect(
      normalizeScan({
        id: "sc_audit",
        verification_audit: {
          candidate_count: "7",
          reported_count: "3",
          rejected_count: "1",
          downgraded_count: "2",
          verified_count: "1",
          static_proof_count: "2",
          potential_risk_count: "bad",
          unverified_count: -1,
          rejectedReasons: [
            { reason: "missing_evidence", count: "2" },
            { reason: "", count: "10" },
          ],
          rejectedSamples: [
            {
              reason: "missing_evidence",
              title: "Only a vague model guess",
              severity: "low",
              category: "Quality",
              file: "src/guess.py",
              line: "9",
              verificationStatus: "unverified",
              summary: "drop me",
            },
            { reason: "", title: "bad" },
          ],
          summary: "7 candidates evaluated\n3 reported",
        },
      }).verificationAudit
    ).toEqual({
      candidateCount: 7,
      reportedCount: 3,
      rejectedCount: 2,
      downgradedCount: 2,
      verifiedCount: 1,
      staticProofCount: 2,
      potentialRiskCount: 0,
      unverifiedCount: 0,
      rejectedReasons: [{ reason: "missing_evidence", count: 2 }],
      rejectedSamples: [
        {
          reason: "missing_evidence",
          title: "Only a vague model guess",
          severity: "low",
          category: "Quality",
          file: "src/guess.py",
          line: 9,
          verificationStatus: "unverified",
        },
      ],
      summary: "7 candidates evaluated",
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
        verifier: {
          enabled: true,
          summary: "Verifier ran one command",
          runs: [
            {
              script: "test",
              command: "npm run test",
              status: "failed",
              exitCode: "1",
              durationMs: "1200",
              logPath: "verification/job/test.log",
              output: "AssertionError",
            },
            {
              script: "lint",
              command: "npm run lint",
              status: "flaky",
              exitCode: "1",
              durationMs: "900",
              confirmedFailure: false,
              logPath: "verification/job/lint.log",
              output: "first attempt failed, second passed",
              attempts: [
                {
                  attempt: "1",
                  status: "failed",
                  exitCode: "1",
                  durationMs: "400",
                  output: "FAIL",
                },
                {
                  attempt: "2",
                  status: "passed",
                  exitCode: "0",
                  durationMs: "300",
                  output: "PASS",
                },
              ],
            },
            { script: "", command: "", status: "bad" },
          ],
        },
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
      manifests: [{ file: "package.json", type: "node" }],
      toolVersions: [
        { name: "git", command: "git --version", available: true, exitCode: 0, output: "git ok" },
      ],
      verifier: {
        enabled: true,
        summary: "Verifier ran one command",
        runs: [
          {
            script: "test",
            command: "npm run test",
            status: "failed",
            exitCode: 1,
            durationMs: 1200,
            logPath: "verification/job/test.log",
            outputRedacted: true,
          },
          {
            script: "lint",
            command: "npm run lint",
            status: "flaky",
            exitCode: 1,
            durationMs: 900,
            confirmedFailure: false,
            logPath: "verification/job/lint.log",
            outputRedacted: true,
            attempts: [
              { attempt: 1, status: "failed", exitCode: 1, durationMs: 400, outputRedacted: true },
              { attempt: 2, status: "passed", exitCode: 0, durationMs: 300, outputRedacted: true },
            ],
          },
        ],
      },
    });
    expect(normalizeScan({ id: "sc_empty" }).preflight).toBeNull();
  });

  it("normalizes scan Audit Swarm evidence for readable rendering", () => {
    const scan = normalizeScan({
      id: "sc_audit_swarm",
      audit_swarm: {
        protocol: "audit-swarm/0.1",
        stage: "report",
        adapter: "codex",
        provider_chain: ["codex", "opencode"],
        summary: "2 candidates evaluated\n1 reported",
        counts: {
          issueCards: "1",
          verificationResults: "1",
          candidateCount: "2",
          rejectedCount: "1",
          verifiedCount: "1",
        },
        roles: ["security-reviewer"],
        shards: ["auth.session"],
        issue_cards: [
          {
            issue_id: "issue-refresh",
            title: "Refresh token rotation may not be atomic",
            severity: "high",
            category: "Security",
            shard_id: "auth.session",
            agent_role: "security-reviewer",
            confidence: "0.83",
            locations: [{ file: "src/auth/refresh.ts", startLine: "42", endLine: "81" }],
            claim: "Token invalidation and issuance are not in one transaction.",
            evidence: [
              { summary: "createRefreshToken runs before old-token invalidation is confirmed." },
            ],
            false_positive_checks: [
              "Check whether the caller wraps this service in a transaction.",
            ],
            suggested_test: "Mock a failure between issuance and invalidation.",
          },
        ],
        verification_results: [
          {
            issue_id: "issue-refresh",
            verifier_role: "prover",
            verdict: "confirmed",
            confidence: "0.9",
            proof_type: "failing_test",
            proof_strength: "3",
            result_summary: "A mocked failure leaves both tokens valid.",
            commands_run: ["pnpm test auth -- refresh-token-rotation"],
            evidence: ["Focused test reproduced the token rotation gap."],
          },
        ],
        evidence_blocks: [
          {
            id: "issue-refresh:claim",
            kind: "claim",
            title: "Refresh token rotation may not be atomic",
            summary: "Token invalidation and issuance are not in one transaction.",
            issue_id: "issue-refresh",
            severity: "high",
            role: "security-reviewer",
            shard_id: "auth.session",
            confidence: "0.83",
          },
          {
            id: "issue-refresh:location:0",
            kind: "code_location",
            title: "Code location",
            summary: "Primary audited location.",
            file: "src/auth/refresh.ts",
            start_line: "42",
            end_line: "81",
          },
          {
            id: "issue-refresh:false-positive:0",
            kind: "false_positive_check",
            title: "False-positive check",
            summary: "Check whether the caller wraps this service in a transaction.",
          },
          {
            id: "issue-refresh:verdict:prover",
            kind: "verifier_verdict",
            title: "Verifier verdict",
            summary: "A mocked failure leaves both tokens valid.",
            verdict: "confirmed",
            role: "prover",
            proof_type: "failing_test",
            proof_strength: "3",
          },
          {
            id: "issue-refresh:command:0",
            kind: "command",
            title: "Verifier command",
            summary: "A mocked failure leaves both tokens valid.",
            command: "pnpm test auth -- refresh-token-rotation",
            status: "executed",
          },
        ],
      },
    });

    expect(scan.auditSwarm).toMatchObject({
      protocol: "audit-swarm/0.1",
      stage: "report",
      adapter: "codex",
      providerChain: ["codex", "opencode"],
      summary: "2 candidates evaluated",
      counts: {
        issueCards: 1,
        verificationResults: 1,
        evidenceBlocks: 5,
        candidateCount: 2,
        rejectedCount: 1,
        verifiedCount: 1,
      },
      roles: ["security-reviewer"],
      shards: ["auth.session"],
    });
    expect(scan.auditSwarm.issueCards[0]).toMatchObject({
      issueId: "issue-refresh",
      title: "Refresh token rotation may not be atomic",
      file: "src/auth/refresh.ts",
      line: "42",
      claim: "Token invalidation and issuance are not in one transaction.",
      evidence: ["createRefreshToken runs before old-token invalidation is confirmed."],
      falsePositiveChecks: ["Check whether the caller wraps this service in a transaction."],
      suggestedTest: "Mock a failure between issuance and invalidation.",
    });
    expect(scan.auditSwarm.verificationResults[0]).toMatchObject({
      issueId: "issue-refresh",
      verifierRole: "prover",
      verdict: "confirmed",
      proofType: "failing_test",
      proofStrength: 3,
      summary: "A mocked failure leaves both tokens valid.",
      command: "pnpm test auth -- refresh-token-rotation",
      evidence: ["Focused test reproduced the token rotation gap."],
    });
    expect(scan.auditSwarm.evidenceBlocks).toHaveLength(5);
    expect(scan.auditSwarm.evidenceBlocks[0]).toMatchObject({
      id: "issue-refresh:claim",
      kind: "claim",
      title: "Refresh token rotation may not be atomic",
      summary: "Token invalidation and issuance are not in one transaction.",
      issueId: "issue-refresh",
      severity: "high",
      role: "security-reviewer",
      shardId: "auth.session",
      confidence: 0.83,
    });
    expect(scan.auditSwarm.evidenceBlocks[1]).toMatchObject({
      kind: "code_location",
      file: "src/auth/refresh.ts",
      startLine: "42",
      endLine: "81",
    });
    expect(scan.auditSwarm.evidenceBlocks[3]).toMatchObject({
      kind: "verifier_verdict",
      verdict: "confirmed",
      role: "prover",
      proofType: "failing_test",
      proofStrength: 3,
    });
    expect(scan.auditSwarm.evidenceBlocks[4]).toMatchObject({
      kind: "command",
      command: "pnpm test auth -- refresh-token-rotation",
      status: "executed",
    });
  });

  it("maps Audit Swarm P-class severities onto the UI severity scale", () => {
    const scan = normalizeScan({
      id: "sc_audit_swarm_priority",
      audit_swarm: {
        issue_cards: [
          { issue_id: "issue-p0", title: "P0 issue", severity: "P0" },
          { issue_id: "issue-p1", title: "P1 issue", severity: "P1" },
          { issue_id: "issue-p2", title: "P2 issue", severity: "P2" },
          { issue_id: "issue-p3", title: "P3 issue", severity: "P3" },
          { issue_id: "issue-p4", title: "P4 issue", severity: "P4" },
        ],
        evidence_blocks: [
          { id: "block-p0", title: "P0 block", severity: "P0" },
          { id: "block-p1", title: "P1 block", severity: "P1" },
          { id: "block-p2", title: "P2 block", severity: "P2" },
          { id: "block-p3", title: "P3 block", severity: "P3" },
          { id: "block-p4", title: "P4 block", severity: "P4" },
        ],
      },
    });

    expect(scan.auditSwarm.issueCards.map((card) => card.severity)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
      "info",
    ]);
    expect(scan.auditSwarm.evidenceBlocks.map((block) => block.severity)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
      "info",
    ]);
  });

  it("keeps structured Audit Swarm command and file evidence visible", () => {
    const scan = normalizeScan({
      id: "sc_audit_swarm_structured_evidence",
      audit_swarm: {
        issue_cards: [
          {
            issue_id: "issue-command",
            title: "Command evidence",
            evidence: [
              { type: "command", command: "npm test -- auth", exit_code: 1 },
              { type: "file", file: "src/auth/session.ts", start_line: "42" },
            ],
          },
        ],
        verification_results: [
          {
            issue_id: "issue-command",
            verdict: "confirmed",
            evidence: [
              { type: "command", command: "npm run check", exit_code: 1 },
              { type: "file", file: "src/auth/session.ts", line: "42" },
            ],
          },
        ],
        evidence_blocks: [
          {
            id: "issue-command:evidence",
            kind: "evidence",
            title: "Structured evidence",
            items: [
              { type: "command", command: "npm test -- auth" },
              { type: "file", file: "src/auth/session.ts", start_line: "42" },
              { type: "output", output: "failed output\nmore detail" },
            ],
          },
        ],
      },
    });

    expect(scan.auditSwarm.issueCards[0].evidence).toEqual([
      "npm test -- auth",
      "src/auth/session.ts:42",
    ]);
    expect(scan.auditSwarm.verificationResults[0].evidence).toEqual([
      "npm run check",
      "src/auth/session.ts:42",
    ]);
    expect(scan.auditSwarm.evidenceBlocks[0].items).toEqual([
      "npm test -- auth",
      "src/auth/session.ts:42",
      "failed output",
    ]);
  });

  it("deduplicates repeated Audit Swarm evidence blocks by rendered content", () => {
    const scan = normalizeScan({
      id: "sc_audit_swarm_duplicate_evidence",
      audit_swarm: {
        counts: { evidence_blocks: 3 },
        evidence_blocks: [
          {
            id: "issue-command:location:0",
            kind: "code_location",
            title: "Code location",
            summary: "Primary audited location.",
            file: "src/screens/workers.jsx",
            start_line: "421",
            role: "auditor",
            shard_id: "workers-ui",
          },
          {
            id: "issue-command:location:1",
            kind: "code_location",
            title: "Code location",
            summary: "Primary audited location.",
            file: "src/screens/workers.jsx",
            start_line: "421",
            role: "auditor",
            shard_id: "workers-ui",
          },
          {
            id: "issue-command:evidence:0",
            kind: "evidence",
            title: "Discovery evidence",
            summary: "Distinct supporting evidence.",
          },
        ],
      },
    });

    expect(scan.auditSwarm.evidenceBlocks).toHaveLength(2);
    expect(scan.auditSwarm.counts.evidenceBlocks).toBe(3);
    expect(scan.auditSwarm.evidenceBlocks.map((block) => block.title)).toEqual([
      "Code location",
      "Discovery evidence",
    ]);
  });

  it("normalizes scan progress into a finite percentage range", () => {
    expect(normalizeScan({ id: "sc_invalid", progress: "not-a-number" }).progress).toBe(0);
    expect(normalizeScan({ id: "sc_low", progress: -12 }).progress).toBe(0);
    expect(normalizeScan({ id: "sc_high", progress: 140 }).progress).toBe(100);
    expect(normalizeScan({ id: "sc_ok", progress: "42.5" }).progress).toBe(42.5);
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
            perUser: "1",
          },
        },
      })
    ).toEqual({
      message: "Waiting for capacity",
      tags: ["Position 2", "3 scans ahead", "Per user 1"],
    });

    expect(
      scanQueueSummary({
        queue: {
          message: { text: "bad shape" },
          position: { value: 2 },
          ahead: -1,
          limits: {
            global: {},
            perUser: -2,
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
