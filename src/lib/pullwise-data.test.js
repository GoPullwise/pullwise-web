import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import {
  normalizeIssue,
  normalizeWorkspace,
  normalizeRepo,
  normalizeScan,
  scanQueueSummary,
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
  },
}));

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
      needsAuthorization: "false",
    });

    const { result, unmount } = renderHook(() => useRepositories());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.needsAuthorization).toBe(false);
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
      autoFixable: true,
    });
  });

  it("preserves repository workspace and quota fields", () => {
    expect(
      normalizeRepo({
        id: "repo_123",
        fullName: "octocat/repo",
        githubRepoId: 123,
        githubNodeId: "R_123",
        workspace: { id: "ws_1", name: "octocat" },
        quota: { scope: "repository", period: "2026-05", used: "1.8", limit: "3", remaining: "2" },
        href: "/repositories/repo_123",
        scanAction: { href: "/scans", method: "POST" },
      })
    ).toMatchObject({
      id: "repo_123",
      repoId: "repo_123",
      githubRepoId: "123",
      githubNodeId: "R_123",
      workspaceId: "ws_1",
      workspaceName: "octocat",
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

  it("strips control characters from workspace and quota display text", () => {
    expect(
      normalizeWorkspace({
        id: "ws_1\r\nX-Injected: bad",
        name: "octocat\r\nX-Injected: bad",
        githubOwnerLogin: "octo\x00cat",
        githubOwnerType: "User\r\nX-Injected: bad",
        githubAppInstallationId: "123\r\nX-Injected: bad",
        role: "admin\r\nX-Injected: bad",
      })
    ).toMatchObject({
      id: "ws_1",
      name: "octocat",
      githubOwnerLogin: "octocat",
      githubOwnerType: "User",
      githubAppInstallationId: "123",
      role: "admin",
    });

    expect(
      normalizeRepo({
        fullName: "octocat/repo\r\nX-Injected: bad",
        workspace: { id: "ws_1", name: "octocat\r\nX-Injected: bad" },
        quota: {
          scope: "workspace\r\nX-Injected: bad",
          period: "2026-05\r\nX-Injected: bad",
          plan: "free\r\nX-Injected: bad",
        },
      })
    ).toMatchObject({
      fullName: "octocat/repo",
      workspaceName: "octocat",
      quota: {
        scope: "workspace",
        period: "2026-05",
        plan: "free",
      },
    });
  });

  it("normalizes issue text fields for search-safe rendering", () => {
    const issue = normalizeIssue({
      id: 123,
      scan_id: 456,
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
        repository: 456,
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

  it("preserves scan workspace, repository, and quota summaries", () => {
    expect(
      normalizeScan({
        id: "sc_1",
        repoId: "repo_123",
        githubRepoId: 123,
        workspaceId: "ws_1",
        quotaBucketIds: { workspace: "qb_ws", repository: "qb_repo" },
        billingUsage: { scope: "workspace", used: 2, limit: 10, remaining: 8 },
        repoUsage: { scope: "repository", used: 1, limit: 3, remaining: 2 },
      })
    ).toMatchObject({
      repoId: "repo_123",
      githubRepoId: "123",
      workspaceId: "ws_1",
      quotaBucketIds: { workspace: "qb_ws", repository: "qb_repo" },
      billingUsage: { scope: "workspace", used: 2, limit: 10, remaining: 8 },
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
            perUser: { value: 1 },
          },
        },
      })
    ).toEqual({
      message: "Waiting for capacity",
      tags: ["Position 2", "3 scans ahead", "Global 4"],
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
        scan_id: "sc_1",
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
