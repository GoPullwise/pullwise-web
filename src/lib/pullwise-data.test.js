import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { normalizeIssue, normalizeRepo, normalizeScan, useScanBatchRun, useScanRun, useScans } from "./pullwise-data.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    scans: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    },
  },
}));

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

    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(2), { timeout: 250 });
    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(3), { timeout: 250 });
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
    expect(() => [repo.name, repo.fullName, repo.desc].some((value) => value.toLowerCase().includes("123"))).not.toThrow();
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
    expect(() => [issue.title, issue.file, issue.repo, issue.category, issue.id]
      .some((value) => value.toLowerCase().includes("18"))).not.toThrow();
  });

  it("normalizes issue rich detail arrays for safe rendering", () => {
    const issue = normalizeIssue({
      id: "f_rich",
      steps: ["Review input validation", 42, null, { text: "bad shape" }],
      badCode: [
        null,
        { ln: 7, code: 123, t: "add" },
        { ln: "x", code: { nested: true }, t: "weird" },
      ],
      goodCode: ["return ok", { ln: 9, code: "return safe", t: "del" }],
      references: [
        null,
        { label: 42, url: "https://example.com/a" },
        { url: 123 },
        "https://example.com/raw",
      ],
    });

    expect(issue.steps).toEqual(["Review input validation", "42"]);
    expect(issue.badCode).toEqual([{ ln: "7", code: "123", t: "add" }]);
    expect(issue.goodCode).toEqual([
      { ln: "", code: "return ok", t: "" },
      { ln: "9", code: "return safe", t: "del" },
    ]);
    expect(issue.references).toEqual([
      { label: "42", url: "https://example.com/a" },
      { label: "https://example.com/raw", url: "https://example.com/raw" },
    ]);
  });

  it("normalizes scan issue counts into finite non-negative integers", () => {
    expect(normalizeScan({
      id: "sc_1",
      issues: {
        critical: -1,
        high: "not-a-number",
        medium: 2.8,
        low: "3",
      },
    }).issues).toEqual({
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

  it("normalizes confidence into a finite display-safe range", () => {
    expect(normalizeIssue({ id: "f_invalid", confidence: "not-a-number" }).confidence).toBe(0);
    expect(normalizeIssue({ id: "f_high", confidence: 1.6 }).confidence).toBe(1);
    expect(normalizeIssue({ id: "f_low", confidence: -0.4 }).confidence).toBe(0);
  });

  it("preserves rich review fields and supplies stable empty arrays", () => {
    expect(normalizeIssue({
      id: "f_123",
      scan_id: "sc_1",
      impact: "Production impact.",
      references: [{ label: "Docs", url: "https://example.com" }],
    })).toMatchObject({
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
