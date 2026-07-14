import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HistoryScreen, IssueDetailScreen, IssuesScreen } from "./issues.jsx";
import { NotificationProvider } from "../components/notifications.jsx";
import { setLang } from "../i18n.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    scans: {
      get: vi.fn(() => Promise.resolve({})),
      status: vi.fn(() => Promise.resolve({ items: [] })),
      auditBundle: vi.fn(),
      auditBundleArchive: vi.fn(),
    },
    issues: {
      list: vi.fn(),
      get: vi.fn(),
      updateStatus: vi.fn(),
      updateStatuses: undefined,
      previewFix: vi.fn(),
      createPullRequest: vi.fn(),
    },
  },
}));

vi.mock("../lib/pullwise-data.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isActiveScan: (scan) => ["queued", "running"].includes(scan?.status),
    scanQueueSummary: (scan) =>
      scan?.queue
        ? {
            message: scan.queue.message || "",
            tags: [
              scan.queue.position ? `Position ${scan.queue.position}` : null,
              typeof scan.queue.ahead === "number" ? `${scan.queue.ahead} scans ahead` : null,
            ].filter(Boolean),
          }
        : null,
    useIssues: vi.fn(() => ({ items: [] })),
    useRepositories: vi.fn(() => ({ items: [] })),
    useScans: vi.fn(() => ({ items: [] })),
  };
});

import { pullwiseApi } from "../api/pullwise.js";
import { rememberIssueUpdate, useIssues, useScans } from "../lib/pullwise-data.js";

function baseStyles() {
  return readFileSync(resolve(process.cwd(), "styles/base.css"), "utf8");
}

function screenStyles() {
  return readFileSync(resolve(process.cwd(), "styles/screens.css"), "utf8");
}

function appStyles() {
  return readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");
}

function deferredPromise() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe("IssuesScreen list resilience", () => {
  it("shows the topbar loading spinner only while issues are loading", () => {
    useIssues.mockReturnValue({
      items: [],
      loading: true,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: {},
    });

    const { rerender } = render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    expect(screen.getByRole("status", { name: /^loading$/i })).toHaveClass(
      "topbar-loading",
      "spin"
    );

    useIssues.mockReturnValue({
      items: [],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: {},
    });
    rerender(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    expect(screen.queryByRole("status", { name: /^loading$/i })).not.toBeInTheDocument();
  });

  it("renders issue table skeleton rows while issues are loading", () => {
    useIssues.mockReturnValue({
      items: [],
      loading: true,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: {},
    });

    const { container } = render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    expect(container.querySelector(".issues-table-skeleton")).toBeInTheDocument();
    expect(container.querySelectorAll(".issues-table-skeleton .issues-trow")).toHaveLength(6);
    expect(screen.queryByText(/no findings are available/i)).not.toBeInTheDocument();
  });

  it("keeps fuzzy issue matches returned by the server", async () => {
    const user = userEvent.setup();
    useIssues.mockReturnValue({
      items: [
        {
          id: "f_redirect",
          repo: "acme/api",
          severity: "high",
          category: "Security",
          title: "Validate redirect targets",
          file: "src/auth.py",
          status: "open",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/search by title, repo, or file/i), "identity provider");

    expect(useIssues).toHaveBeenCalledWith(expect.objectContaining({ q: "identity provider" }));
    expect(screen.getByText("Validate redirect targets")).toBeInTheDocument();
  });

  it("does not leak NaN when issue evidence metadata is missing", () => {
    useIssues.mockReturnValue({
      items: [
        {
          id: "f_123",
          repo: "acme/api",
          severity: "high",
          category: "Security",
          title: "Validate redirect targets",
          file: "src/auth.py",
          status: "open",
        },
      ],
      loading: false,
      error: "",
      reload: vi.fn(),
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    expect(document.body).not.toHaveTextContent("NaN%");
    expect(screen.getByText("Validate redirect targets")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Potential risk")).not.toBeInTheDocument();
    expect(screen.queryByText("Low evidence")).not.toBeInTheDocument();
  });

  it("does not use numeric confidence as the evidence sort tiebreaker", () => {
    useIssues.mockReturnValue({
      items: [
        {
          id: "f_lower_numeric",
          repo: "acme/api",
          severity: "high",
          category: "Quality",
          title: "First issue",
          file: "src/a.py",
          status: "open",
          verificationStatus: "static_proof",
          confidenceLevel: "medium",
          confidence: 0.2,
        },
        {
          id: "f_higher_numeric",
          repo: "acme/api",
          severity: "high",
          category: "Quality",
          title: "Second issue",
          file: "src/b.py",
          status: "open",
          verificationStatus: "static_proof",
          confidenceLevel: "medium",
          confidence: 0.99,
        },
      ],
      loading: false,
      error: "",
      reload: vi.fn(),
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    const openButtons = screen.getAllByRole("button", { name: /open issue/i });
    expect(openButtons[0]).toHaveAttribute("aria-label", "Open issue f_lower_numeric");
    expect(openButtons[1]).toHaveAttribute("aria-label", "Open issue f_higher_numeric");
    expect(document.body).not.toHaveTextContent("99%");
  });

  it("opens an issue from the list with keyboard activation", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    const setIssue = vi.fn();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      status: "open",
    };
    useIssues.mockReturnValue({
      items: [issue],
      loading: false,
      error: "",
      reload: vi.fn(),
    });

    render(<IssuesScreen go={go} setIssue={setIssue} />);

    const openIssue = screen.getByRole("button", { name: /open issue f_123/i });
    openIssue.focus();
    await user.keyboard("{Enter}");

    expect(setIssue).toHaveBeenCalledWith(issue);
    expect(go).toHaveBeenCalledWith("issue", { issueId: "f_123" });

    setIssue.mockClear();
    go.mockClear();
    await user.keyboard(" ");

    expect(setIssue).toHaveBeenCalledWith(issue);
    expect(go).toHaveBeenCalledWith("issue", { issueId: "f_123" });
  });

  it("does not submit concurrent status updates from the list actions", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      status: "open",
    };
    const reload = vi.fn();
    let resolveUpdate;
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    useIssues.mockReturnValue({
      items: [issue],
      loading: false,
      error: "",
      reload,
      meta: {},
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    const markFixed = screen.getByRole("button", { name: /mark fixed/i });
    await user.dblClick(markFixed);

    expect(pullwiseApi.issues.updateStatus).toHaveBeenCalledTimes(1);
    expect(markFixed).toBeDisabled();

    await act(async () => {
      resolveUpdate({ ...issue, status: "fixed" });
    });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("moves a fixed issue out of Open and into Fixed even before list reload catches up", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      status: "open",
    };
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockResolvedValueOnce({ ...issue, status: "fixed" });
    useIssues.mockImplementation(({ status } = {}) => ({
      items: status === "open" || status === "all" ? [issue] : [],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: {},
    }));

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^open$/i }));

    expect(screen.getByRole("button", { name: /open issue f_123/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mark fixed/i }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /open issue f_123/i })).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /^fixed$/i }));

    expect(await screen.findByRole("button", { name: /open issue f_123/i })).toBeInTheDocument();
  });

  it("shows a visible error when a list status update fails", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      status: "open",
    };
    const reload = vi.fn();
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockRejectedValueOnce(new Error("offline"));
    useIssues.mockReturnValue({
      items: [issue],
      loading: false,
      loadingMore: false,
      error: "",
      reload,
      loadMore: vi.fn(),
      meta: {},
    });

    render(
      <NotificationProvider>
        <IssuesScreen go={vi.fn()} setIssue={vi.fn()} />
      </NotificationProvider>
    );

    const markFixed = screen.getByRole("button", { name: /mark fixed/i });
    await user.click(markFixed);

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(markFixed).not.toBeDisabled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("marks every visible non-fixed issue as fixed from the list action", async () => {
    const user = userEvent.setup();
    const firstIssue = {
      id: "f_first",
      scanId: "sc_1",
      jobId: "job_1",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      line: 42,
      status: "open",
      createdAt: 100,
    };
    const secondIssue = {
      ...firstIssue,
      id: "f_second",
      jobId: "job_2",
      title: "Escape shell arguments",
      file: "src/shell.py",
      line: 12,
      createdAt: 101,
    };
    const reload = vi.fn();
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockImplementation((issueId) =>
      Promise.resolve({
        ...(issueId === "f_first" ? firstIssue : secondIssue),
        status: "fixed",
      })
    );
    useIssues.mockReturnValue({
      items: [firstIssue, secondIssue],
      loading: false,
      loadingMore: false,
      error: "",
      reload,
      loadMore: vi.fn(),
      meta: {},
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^open$/i }));

    await user.click(screen.getByRole("button", { name: /mark all fixed/i }));

    await waitFor(() => expect(pullwiseApi.issues.updateStatus).toHaveBeenCalledTimes(2));
    expect(pullwiseApi.issues.updateStatus).toHaveBeenCalledWith(
      "f_first",
      expect.objectContaining({
        status: "fixed",
        scanId: "sc_1",
        jobId: "job_1",
        repo: "acme/api",
        file: "src/auth.py",
        line: 42,
        title: "Validate redirect targets",
        createdAt: 100,
      })
    );
    expect(pullwiseApi.issues.updateStatus).toHaveBeenCalledWith(
      "f_second",
      expect.objectContaining({
        status: "fixed",
        scanId: "sc_1",
        jobId: "job_2",
        repo: "acme/api",
        file: "src/shell.py",
        line: 12,
        title: "Escape shell arguments",
        createdAt: 101,
      })
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /open issue f_first/i })).not.toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /open issue f_second/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^fixed$/i }));

    expect(await screen.findByRole("button", { name: /open issue f_first/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open issue f_second/i })).toBeInTheDocument();
  });

  it("uses the batch endpoint when marking visible issues as fixed", async () => {
    const user = userEvent.setup();
    const firstIssue = {
      id: "f_batch_first",
      scanId: "sc_batch",
      jobId: "job_batch_1",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      line: 42,
      status: "open",
      createdAt: 100,
    };
    const secondIssue = {
      ...firstIssue,
      id: "f_batch_second",
      jobId: "job_batch_2",
      title: "Escape shell arguments",
      file: "src/shell.py",
      line: 12,
      createdAt: 101,
    };
    const reload = vi.fn();
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatuses = vi.fn().mockResolvedValue({
      items: [
        { ...firstIssue, status: "fixed" },
        { ...secondIssue, status: "fixed" },
      ],
    });
    useIssues.mockReturnValue({
      items: [firstIssue, secondIssue],
      loading: false,
      loadingMore: false,
      error: "",
      reload,
      loadMore: vi.fn(),
      meta: {},
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^open$/i }));
    await user.click(screen.getByRole("button", { name: /mark all fixed/i }));

    await waitFor(() => expect(pullwiseApi.issues.updateStatuses).toHaveBeenCalledTimes(1));
    expect(pullwiseApi.issues.updateStatuses).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "f_batch_first",
          status: "fixed",
          scanId: "sc_batch",
          jobId: "job_batch_1",
          file: "src/auth.py",
        }),
        expect.objectContaining({
          id: "f_batch_second",
          status: "fixed",
          scanId: "sc_batch",
          jobId: "job_batch_2",
          file: "src/shell.py",
        }),
      ])
    );
    expect(pullwiseApi.issues.updateStatus).not.toHaveBeenCalled();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("marks matching issues across pages and splits server batches at 100 updates", async () => {
    const user = userEvent.setup();
    const issues = Array.from({ length: 101 }, (_, index) => ({
      id: "f_page_" + String(index + 1).padStart(3, "0"),
      status: "open",
      severity: "high",
    }));
    const reload = vi.fn();
    pullwiseApi.issues.list.mockReset();
    pullwiseApi.issues.list.mockImplementation(({ limit = 50, offset = 0 } = {}) => {
      const items = issues.slice(offset, offset + limit);
      const nextOffset = offset + items.length;
      return Promise.resolve({
        items,
        total: issues.length,
        limit,
        offset,
        hasMore: nextOffset < issues.length,
        nextOffset: nextOffset < issues.length ? nextOffset : null,
      });
    });
    pullwiseApi.issues.updateStatuses = vi.fn((updates) =>
      Promise.resolve({ items: updates.map((issue) => ({ ...issue, status: "fixed" })) })
    );
    useIssues.mockReturnValue({
      items: issues.slice(0, 50),
      loading: false,
      loadingMore: false,
      error: "",
      reload,
      loadMore: vi.fn(),
      meta: { total: 101, limit: 50, offset: 0, hasMore: true, nextOffset: 50 },
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /mark all fixed/i }));

    await waitFor(() => expect(pullwiseApi.issues.updateStatuses).toHaveBeenCalledTimes(2));
    const submitted = pullwiseApi.issues.updateStatuses.mock.calls.flatMap(([updates]) => updates);
    expect(submitted.map((issue) => issue.id)).toEqual(issues.map((issue) => issue.id));
    expect(pullwiseApi.issues.updateStatuses.mock.calls.map(([updates]) => updates.length)).toEqual([
      100,
      1,
    ]);
    expect(pullwiseApi.issues.list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "all",
        severity: "all",
        q: "",
        scanId: "",
        sort: "severity",
        limit: 100,
        offset: 50,
      })
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /mark all fixed/i })).toBeDisabled();
  });

  it("locks a cross-page bulk action before awaiting the next page", async () => {
    const nextPage = deferredPromise();
    const firstIssue = { id: "f_lock_1", status: "open", severity: "high" };
    const secondIssue = { id: "f_lock_2", status: "open", severity: "medium" };
    pullwiseApi.issues.list.mockReset();
    pullwiseApi.issues.list.mockReturnValue(nextPage.promise);
    pullwiseApi.issues.updateStatuses = vi.fn((updates) =>
      Promise.resolve({ items: updates.map((issue) => ({ ...issue, status: "fixed" })) })
    );
    useIssues.mockReturnValue({
      items: [firstIssue],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 2, limit: 1, offset: 0, hasMore: true, nextOffset: 1 },
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);
    const markAll = screen.getByRole("button", { name: /mark all fixed/i });
    act(() => {
      fireEvent.click(markAll);
      fireEvent.click(markAll);
    });

    expect(pullwiseApi.issues.list).toHaveBeenCalledTimes(1);
    await act(async () => {
      nextPage.resolve({
        items: [secondIssue],
        total: 2,
        limit: 100,
        offset: 1,
        hasMore: false,
        nextOffset: null,
      });
    });

    await waitFor(() => expect(pullwiseApi.issues.updateStatuses).toHaveBeenCalledTimes(1));
    expect(pullwiseApi.issues.updateStatuses.mock.calls[0][0]).toHaveLength(2);
  });

  it("stops without updating when issue pagination repeats a page", async () => {
    const issue = { id: "f_repeat", status: "open", severity: "high" };
    pullwiseApi.issues.list.mockReset();
    pullwiseApi.issues.list.mockResolvedValue({
      items: [issue],
      total: 2,
      limit: 1,
      offset: 1,
      hasMore: true,
      nextOffset: 1,
    });
    pullwiseApi.issues.updateStatuses = vi.fn();
    useIssues.mockReturnValue({
      items: [issue],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 2, limit: 1, offset: 0, hasMore: true, nextOffset: 1 },
    });

    render(
      <NotificationProvider>
        <IssuesScreen go={vi.fn()} setIssue={vi.fn()} />
      </NotificationProvider>
    );
    await userEvent.setup().click(screen.getByRole("button", { name: /mark all fixed/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/pagination did not advance/i);
    expect(pullwiseApi.issues.updateStatuses).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /mark all fixed/i })).not.toBeDisabled();
  });

  it("keeps duplicate issue ids from sharing pending or local status state", async () => {
    const user = userEvent.setup();
    const firstIssue = {
      id: "dup_issue",
      scanId: "sc_1",
      jobId: "job_1",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "First duplicate issue",
      file: "src/first.py",
      line: 10,
      status: "open",
      createdAt: 100,
    };
    const secondIssue = {
      ...firstIssue,
      title: "Second duplicate issue",
      file: "src/second.py",
      line: 20,
      createdAt: 101,
    };
    let resolveUpdate;
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    useIssues.mockReturnValue({
      items: [firstIssue, secondIssue],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: {},
    });

    render(<IssuesScreen go={vi.fn()} setIssue={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^open$/i }));

    const markFixedButtons = screen.getAllByRole("button", { name: /mark fixed/i });
    await user.click(markFixedButtons[0]);

    expect(pullwiseApi.issues.updateStatus).toHaveBeenCalledWith(
      "dup_issue",
      expect.objectContaining({
        status: "fixed",
        scanId: "sc_1",
        jobId: "job_1",
        repo: "acme/api",
        file: "src/second.py",
        line: 20,
        title: "Second duplicate issue",
        createdAt: 101,
      })
    );
    expect(markFixedButtons[0]).toBeDisabled();
    expect(markFixedButtons[1]).not.toBeDisabled();

    await act(async () => {
      resolveUpdate({ ...secondIssue, status: "fixed" });
    });

    await waitFor(() =>
      expect(screen.queryByText("Second duplicate issue")).not.toBeInTheDocument()
    );
    expect(screen.getByText("First duplicate issue")).toBeInTheDocument();
  });
});

describe("IssueDetailScreen direct loading", () => {
  it("fetches issue data by route id when in-memory issue state is missing", async () => {
    const setIssue = vi.fn();
    pullwiseApi.issues.get.mockReset();
    pullwiseApi.issues.get.mockResolvedValueOnce({
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      status: "open",
    });

    render(<IssueDetailScreen go={vi.fn()} issue={null} issueId="f_123" setIssue={setIssue} />);

    expect((await screen.findAllByText("Validate redirect targets")).length).toBeGreaterThan(0);
    expect(pullwiseApi.issues.get).toHaveBeenCalledWith("f_123");
    expect(setIssue).toHaveBeenCalledWith(expect.objectContaining({ id: "f_123" }));
    expect(screen.queryByRole("group", { name: /issue feedback/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark fixed/i })).toBeInTheDocument();
  });

  it("keeps a locally fixed issue fixed when direct detail reload returns stale open data", async () => {
    const issue = {
      id: "f_123",
      scanId: "sc_1",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      status: "open",
    };
    rememberIssueUpdate(issue, { ...issue, status: "fixed" });
    pullwiseApi.issues.get.mockReset();
    pullwiseApi.issues.get.mockResolvedValueOnce(issue);

    render(<IssueDetailScreen go={vi.fn()} issue={null} issueId="f_123" setIssue={vi.fn()} />);

    expect((await screen.findAllByText("Validate redirect targets")).length).toBeGreaterThan(0);
    expect(screen.getByText("fixed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark fixed/i })).not.toBeInTheDocument();
  });
  it("shows a skeleton and fetches full details when opened with a list summary", async () => {
    const setIssue = vi.fn();
    const detail = deferredPromise();
    pullwiseApi.issues.get.mockReset();
    pullwiseApi.issues.get.mockReturnValueOnce(detail.promise);

    render(
      <IssueDetailScreen
        go={vi.fn()}
        issue={{
          id: "f_123",
          repo: "acme/api",
          severity: "high",
          category: "Security",
          title: "Summary-only title",
          file: "src/auth.py",
          status: "open",
        }}
        issueId="f_123"
        setIssue={setIssue}
      />
    );

    expect(screen.getByRole("status", { name: /loading issue details/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /summary-only title/i })).not.toBeInTheDocument();
    expect(pullwiseApi.issues.get).toHaveBeenCalledWith("f_123");

    await act(async () => {
      detail.resolve({
        id: "f_123",
        repo: "acme/api",
        severity: "high",
        category: "Security",
        title: "Full issue title",
        summary: "Detailed issue summary",
        impact: "Full issue impact",
        file: "src/auth.py",
        status: "open",
      });
      await detail.promise;
    });

    expect(await screen.findByRole("heading", { level: 1, name: /full issue title/i })).toBeInTheDocument();
    expect(screen.getAllByText("Detailed issue summary").length).toBeGreaterThan(0);
    expect(setIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: "f_123", title: "Full issue title" })
    );
  });

  it("shows generic issue details without a generated review report", () => {
    render(
      <IssueDetailScreen
        go={vi.fn()}
        issue={{
          id: "f_empty_payload",
          scanId: "sc_empty_payload",
          repo: "acme/api",
          severity: "medium",
          category: "Quality",
          title: "Empty report issue",
          file: "src/auth/session.ts",
          status: "open",
        }}
      />
    );
    expect(pullwiseApi.scans.get).not.toHaveBeenCalled();
  });
});

describe("HistoryScreen queue state", () => {
  it("shows whole-scan ETA on a running history row", () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_history_eta",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "pending",
          status: "running",
          progress: 50,
          createdAt: new Date().toISOString(),
          by: "you",
          estimate: {
            state: "available",
            lowerSeconds: 780,
            remainingSeconds: 900,
            upperSeconds: 1080,
          },
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    render(<HistoryScreen go={vi.fn()} />);
    const row = screen.getByText("octocat/private-repo").closest(".scan-row");
    const titleLine = row?.querySelector(".scan-main");
    const etaValue = within(titleLine).getByText(/min remaining$/i);
    const etaBadge = etaValue.closest(".scan-badge");
    const runningBadge = within(titleLine).getByText(/^running$/i).closest(".scan-badge");

    expect(etaBadge).toHaveClass("scan-timing-badge");
    expect(etaBadge?.closest(".scan-main")).toBe(titleLine);
    expect(runningBadge?.nextElementSibling).toBe(etaBadge);

    expect(screen.getByText("13–18 min remaining")).toBeInTheDocument();
  });

  it.each(["done", "failed", "cancelled", "partial_completed", "lost"])(
    "hides terminal duration from %s history rows",
    (status) => {
      useScans.mockReturnValue({
        items: [
          {
            id: `sc_${status}`,
            repo: `octocat/${status}`,
            branch: "main",
            commit: "abc123",
            status,
            durationMs: 720_000,
            createdAt: new Date().toISOString(),
            by: "you",
          },
        ],
        loading: false,
        loadingMore: false,
        error: "",
        loadMore: vi.fn(),
        meta: { total: 1 },
      });

      render(<HistoryScreen go={vi.fn()} />);

      const row = screen.getByText(`octocat/${status}`).closest(".scan-row");
      expect(row).not.toBeNull();
      expect(within(row).queryByText(/^duration$/i)).not.toBeInTheDocument();
      expect(within(row).queryByText(/completed in|ran for/i)).not.toBeInTheDocument();
    }
  );

  it("keeps the scan history page title on one truncated line", () => {
    useScans.mockReturnValue({
      items: [],
      loading: false,
      loadingMore: false,
      error: "",
      loadMore: vi.fn(),
      meta: {},
    });

    render(<HistoryScreen go={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /^scan history$/i })).toHaveClass(
      "page-title-truncate"
    );

    const css = appStyles();
    const titleBlocks = [
      ...css.matchAll(/\.page-h h1\.page-title-truncate\s*\{(?<body>[^}]*)\}/g),
    ].map((match) => match.groups?.body || "");
    const titleBlock = css.match(
      /\.page-h h1\.page-title-truncate\s*\{(?<body>[^}]*)\}/s
    )?.groups?.body;

    expect(titleBlocks).toHaveLength(2);
    expect(titleBlock).toBeTruthy();
    expect(titleBlock).toMatch(/\boverflow\s*:\s*hidden\s*;/);
    expect(titleBlock).toMatch(/\btext-overflow\s*:\s*ellipsis\s*;/);
    expect(titleBlock).toMatch(/\bwhite-space\s*:\s*nowrap\s*;/);
  });

  it("keeps scan history groups visually flat without row separators", () => {
    const css = baseStyles();
    const dayGroupBlock = css.match(/\.scan-day-group\s*\{(?<body>[^}]*)\}/s)?.groups?.body;
    const dayTitleBlock = css.match(/\.scan-day-title\s*\{(?<body>[^}]*)\}/s)?.groups?.body;
    const scanRowBlock = css.match(/\.scan-row\s*\{(?<body>[^}]*)\}/s)?.groups?.body;

    expect(dayGroupBlock).toBeTruthy();
    expect(dayTitleBlock).toBeTruthy();
    expect(scanRowBlock).toBeTruthy();
    expect(dayGroupBlock).not.toMatch(/\bbackground\s*:/);
    expect(dayGroupBlock).not.toMatch(/\bborder\s*:/);
    expect(dayGroupBlock).not.toMatch(/\bbox-shadow\s*:/);
    expect(dayTitleBlock).not.toMatch(/\bborder-bottom\s*:/);
    expect(scanRowBlock).not.toMatch(/\bborder-top\s*:/);
  });

  it("shows the topbar loading spinner only while scan history is loading", () => {
    useScans.mockReturnValue({
      items: [],
      loading: true,
      loadingMore: false,
      error: "",
      loadMore: vi.fn(),
      meta: {},
    });

    const { rerender } = render(<HistoryScreen go={vi.fn()} />);

    expect(screen.getByRole("status", { name: /^loading$/i })).toHaveClass(
      "topbar-loading",
      "spin"
    );

    useScans.mockReturnValue({
      items: [],
      loading: false,
      loadingMore: false,
      error: "",
      loadMore: vi.fn(),
      meta: {},
    });
    rerender(<HistoryScreen go={vi.fn()} />);

    expect(screen.queryByRole("status", { name: /^loading$/i })).not.toBeInTheDocument();
  });

  it("keeps transient history errors out of the space above the Today group", () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_today_error",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "done",
          createdAt: new Date().toISOString(),
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "Cancel failed.",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    render(<HistoryScreen go={vi.fn()} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("octocat/private-repo")).toBeInTheDocument();
    expect(screen.queryByText("Cancel failed.")).not.toBeInTheDocument();
  });

  it("omits the page-level scan count above the Today group", () => {
    const now = new Date().toISOString();
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_today_1",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "done",
          createdAt: now,
          by: "you",
        },
        {
          id: "sc_today_2",
          repo: "octocat/second-repo",
          branch: "main",
          commit: "def456",
          status: "done",
          createdAt: now,
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 6 },
    });

    render(<HistoryScreen go={vi.fn()} />);

    expect(screen.queryByText("2 of 6 scans")).not.toBeInTheDocument();
    const dayTitle = screen.getByText("Today").closest(".scan-day-title");
    expect(dayTitle).toBeInTheDocument();
    expect(within(dayTitle).getByText("2 scans")).toBeInTheDocument();
  });

  it("refreshes scan history on demand without clearing the current list", async () => {
    const user = userEvent.setup();
    let resolveReload;
    const reload = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveReload = resolve;
        })
    );
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_done",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "done",
          time: "now",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload,
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    render(<HistoryScreen go={vi.fn()} />);

    const refresh = screen.getByRole("button", { name: /^refresh$/i });
    await user.click(refresh);

    expect(reload).toHaveBeenCalledWith({ quiet: true });
    expect(screen.getByText("octocat/private-repo")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /^loading$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refreshing/i })).toBeDisabled();

    await act(async () => {
      resolveReload({});
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^refresh$/i })).not.toBeDisabled()
    );
  });

  it("keeps scan history visible and isolates worker artifact errors to one row", () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_bad_artifact",
          repo: "octocat/bad-repo",
          branch: "main",
          commit: "abc123",
          status: "failed",
          errorCode: "WORKER_ARTIFACT_INVALID",
          error: "Uploaded review artifacts do not match result manifest: art_worker_log",
          issues: { critical: 0, high: 3, medium: 0, low: 0, info: 0 },
          time: "now",
          by: "you",
        },
        {
          id: "sc_done",
          repo: "octocat/good-repo",
          branch: "main",
          commit: "def456",
          status: "done",
          issues: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
          time: "earlier",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 2 },
    });

    render(<HistoryScreen go={vi.fn()} />);

    const badRow = screen.getByText("octocat/bad-repo").closest(".scan-row");
    expect(badRow).toHaveTextContent("failed");
    expect(badRow).toHaveTextContent(
      "Uploaded review artifacts do not match result manifest: art_worker_log"
    );
    expect(within(badRow).queryByText("main")).not.toBeInTheDocument();
    expect(within(badRow).queryByText(/3 issues/i)).not.toBeInTheDocument();
    expect(within(badRow).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("octocat/good-repo")).toBeInTheDocument();
  });

  it("keeps visible scan rows and notifies when a history refresh reports an error", async () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_done",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "done",
          time: "now",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "Temporary scan history error",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    render(
      <NotificationProvider>
        <HistoryScreen go={vi.fn()} />
      </NotificationProvider>
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary scan history error");
    expect(screen.getByText("octocat/private-repo")).toBeInTheDocument();
  });
  it("does not render manual retry actions for failed scans", async () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_failed_retry",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "failed",
          time: "now",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    render(<HistoryScreen go={vi.fn()} />);

    expect(await screen.findByText("octocat/private-repo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^retry$/i })).not.toBeInTheDocument();
  });
  it("renders scan history skeleton rows while scans are loading", () => {
    useScans.mockReturnValue({
      items: [],
      loading: true,
      loadingMore: false,
      error: "",
      loadMore: vi.fn(),
      meta: {},
    });

    const { container } = render(<HistoryScreen go={vi.fn()} />);

    expect(container.querySelector(".history-skeleton")).toBeInTheDocument();
    expect(container.querySelectorAll(".history-skeleton .scan-row")).toHaveLength(5);
    expect(screen.queryByText(/no scans yet/i)).not.toBeInTheDocument();
  });

  it("keeps cached scan history hidden while expected new scans are missing", () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_old",
          repo: "octocat/old-repo",
          branch: "main",
          commit: "abc123",
          status: "done",
          time: "earlier",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    const { container } = render(<HistoryScreen go={vi.fn()} expectedScanIds={["sc_new"]} />);

    expect(container.querySelector(".history-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("octocat/old-repo")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: /^loading$/i })).toBeInTheDocument();
  });

  it("keeps cached scan history hidden while expected new scan requests are missing", () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_old",
          repo: "octocat/alpha",
          branch: "main",
          commit: "abc123",
          status: "done",
          createdAt: 1710000000,
          time: "earlier",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    const { container } = render(
      <HistoryScreen
        go={vi.fn()}
        expectedScanRequests={[
          { repo: "octocat/alpha", branch: "main", requestId: "scan_req_new" },
        ]}
        expectedScanStartedAt={1710000100}
      />
    );

    expect(container.querySelector(".history-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("octocat/alpha")).not.toBeInTheDocument();
  });

  it("renders scan history once expected new scan requests are present", async () => {
    const onExpectedScansLoaded = vi.fn();
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_new",
          requestId: "scan_req_new",
          repo: "octocat/alpha",
          branch: "main",
          commit: "pending",
          status: "queued",
          createdAt: 1710000100,
          time: "now",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    const { container } = render(
      <HistoryScreen
        go={vi.fn()}
        expectedScanRequests={[
          { repo: "octocat/alpha", branch: "main", requestId: "scan_req_new" },
        ]}
        expectedScanStartedAt={1710000000}
        onExpectedScansLoaded={onExpectedScansLoaded}
      />
    );

    expect(container.querySelector(".history-skeleton")).not.toBeInTheDocument();
    expect(screen.getByText("octocat/alpha")).toBeInTheDocument();
    await waitFor(() => expect(onExpectedScansLoaded).toHaveBeenCalledTimes(1));
  });

  it("renders scan history once an expected request scan id is present", async () => {
    const onExpectedScansLoaded = vi.fn();
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_new",
          repo: "octocat/alpha",
          branch: "main",
          commit: "pending",
          status: "queued",
          time: "now",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    const { container } = render(
      <HistoryScreen
        go={vi.fn()}
        expectedScanRequests={[
          { scanId: "sc_new", repo: "octocat/alpha", branch: "main", requestId: "scan_req_new" },
        ]}
        expectedScanStartedAt={1710000000}
        onExpectedScansLoaded={onExpectedScansLoaded}
      />
    );

    expect(container.querySelector(".history-skeleton")).not.toBeInTheDocument();
    expect(screen.getByText("octocat/alpha")).toBeInTheDocument();
    await waitFor(() => expect(onExpectedScansLoaded).toHaveBeenCalledTimes(1));
  });
  it("quietly reloads scan history while expected new scans are missing", () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    try {
      useScans.mockReturnValue({
        items: [
          {
            id: "sc_old",
            repo: "octocat/old-repo",
            branch: "main",
            commit: "abc123",
            status: "done",
            time: "earlier",
            by: "you",
          },
        ],
        loading: false,
        loadingMore: false,
        error: "",
        reload,
        loadMore: vi.fn(),
        meta: { total: 1 },
      });

      render(<HistoryScreen go={vi.fn()} expectedScanIds={["sc_new"]} />);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(reload).toHaveBeenCalledWith({ quiet: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetches expected scans by id when the first history page is missing them", async () => {
    vi.useFakeTimers();
    const reload = vi.fn(() => Promise.resolve({}));
    const upsertScan = vi.fn();
    pullwiseApi.scans.status.mockResolvedValueOnce({
      items: [
        {
          id: "sc_new",
          repo: "octocat/new-repo",
          branch: "main",
          commit: "pending",
          status: "queued",
        },
      ],
    });
    try {
      useScans.mockReturnValue({
        items: [
          {
            id: "sc_old",
            repo: "octocat/old-repo",
            branch: "main",
            commit: "abc123",
            status: "done",
            time: "earlier",
            by: "you",
          },
        ],
        loading: false,
        loadingMore: false,
        error: "",
        reload,
        loadMore: vi.fn(),
        upsertScan,
        meta: { total: 1 },
      });

      render(<HistoryScreen go={vi.fn()} expectedScanIds={["sc_new"]} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(reload).toHaveBeenCalledWith({ quiet: true });
      expect(pullwiseApi.scans.status).toHaveBeenCalledWith(["sc_new"]);
      expect(upsertScan).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sc_new", repo: "octocat/new-repo", status: "queued" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetches expected scans by id after a slow history reload while waiting", async () => {
    vi.useFakeTimers();
    const slowReload = deferredPromise();
    const reload = vi.fn(() => slowReload.promise);
    const upsertScan = vi.fn();
    pullwiseApi.scans.status.mockClear();
    pullwiseApi.scans.status.mockResolvedValueOnce({
      items: [
        {
          id: "sc_new",
          repo: "octocat/new-repo",
          branch: "main",
          commit: "pending",
          status: "queued",
        },
      ],
    });
    try {
      useScans.mockReturnValue({
        items: [
          {
            id: "sc_old",
            repo: "octocat/old-repo",
            branch: "main",
            commit: "abc123",
            status: "done",
            time: "earlier",
            by: "you",
          },
        ],
        loading: false,
        loadingMore: false,
        error: "",
        reload,
        loadMore: vi.fn(),
        upsertScan,
        meta: { total: 1 },
      });

      render(<HistoryScreen go={vi.fn()} expectedScanIds={["sc_new"]} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(reload).toHaveBeenCalledWith({ quiet: true });
      expect(pullwiseApi.scans.status).not.toHaveBeenCalled();

      await act(async () => {
        slowReload.resolve({ items: [{ id: "sc_old" }] });
        await slowReload.promise;
        await Promise.resolve();
      });

      expect(pullwiseApi.scans.status).toHaveBeenCalledWith(["sc_new"]);
      expect(upsertScan).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sc_new", repo: "octocat/new-repo", status: "queued" })
      );
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps the skeleton up across repeated refreshes while expected new scans are missing", async () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    try {
      useScans.mockReturnValue({
        items: [
          {
            id: "sc_old",
            repo: "octocat/old-repo",
            branch: "main",
            commit: "abc123",
            status: "done",
            time: "earlier",
            by: "you",
          },
        ],
        loading: false,
        loadingMore: false,
        error: "",
        reload,
        loadMore: vi.fn(),
        meta: { total: 1 },
      });

      const { container } = render(<HistoryScreen go={vi.fn()} expectedScanIds={["sc_new"]} />);

      for (let index = 0; index < 5; index += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1500);
        });
      }

      expect(container.querySelector(".history-skeleton")).toBeInTheDocument();
      expect(screen.queryByText("octocat/old-repo")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(reload).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops waiting for a permanently absent expected scan and restores manual recovery", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00Z"));
    const reload = vi.fn();
    try {
      useScans.mockReturnValue({
        items: [
          {
            id: "sc_old",
            repo: "octocat/old-repo",
            branch: "main",
            status: "done",
            time: "earlier",
          },
        ],
        loading: false,
        loadingMore: false,
        error: "",
        reload,
        loadMore: vi.fn(),
        meta: { total: 1 },
      });

      const { container } = render(
        <HistoryScreen go={vi.fn()} expectedScanIds={["sc_never_arrives"]} />
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      const callsAtExpiry = reload.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });

      expect(container.querySelector(".history-skeleton")).not.toBeInTheDocument();
      expect(screen.getByText("octocat/old-repo")).toBeInTheDocument();
      expect(screen.getByText(/new scan is taking longer to appear/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^refresh$/i })).toBeEnabled();
      expect(reload).toHaveBeenCalledTimes(callsAtExpiry);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders scan history once expected new scans are present", async () => {
    const onExpectedScansLoaded = vi.fn();
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_new",
          repo: "octocat/new-repo",
          branch: "main",
          commit: "pending",
          status: "queued",
          time: "now",
          by: "you",
        },
      ],
      loading: false,
      loadingMore: false,
      error: "",
      reload: vi.fn(),
      loadMore: vi.fn(),
      meta: { total: 1 },
    });

    const { container } = render(
      <HistoryScreen
        go={vi.fn()}
        expectedScanIds={["sc_new"]}
        onExpectedScansLoaded={onExpectedScansLoaded}
      />
    );

    expect(container.querySelector(".history-skeleton")).not.toBeInTheDocument();
    expect(screen.getByText("octocat/new-repo")).toBeInTheDocument();
    await waitFor(() => expect(onExpectedScansLoaded).toHaveBeenCalledTimes(1));
  });

  it("exposes the history new scan action as a real screen link", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    useScans.mockReturnValue({
      items: [],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={go} />);

    const newScan = screen.getByRole("link", { name: /new scan/i });
    expect(newScan).toHaveAttribute("href", "/repos");

    await user.click(newScan);

    expect(go).toHaveBeenCalledWith("repos");
  });

  it("shows queued scan position and scans ahead in history", () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_queued",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "pending",
          status: "queued",
          time: "now",
          by: "you",
          queue: {
            position: 4,
            ahead: 3,
            message: "Server is running 3 of 3 scans; 3 scans ahead.",
            limits: { queuedGlobal: 3 },
          },
        },
      ],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={vi.fn()} />);

    expect(screen.getByText(/position 4/i)).toBeInTheDocument();
    expect(screen.getByText(/3 scans ahead/i)).toBeInTheDocument();
  });

  it("opens queued or running scan instances from history", async () => {
    const openScan = vi.fn();
    const go = vi.fn();
    const user = userEvent.setup();
    const scan = {
      id: "sc_running",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "pending",
      status: "running",
      time: "now",
      by: "you",
    };
    useScans.mockReturnValue({
      items: [scan],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={go} openScan={openScan} />);

    const row = screen.getByText("octocat/private-repo").closest(".scan-row");
    expect(row).not.toBeNull();
    await user.click(within(row).getByRole("button", { name: /^view$/i }));
    expect(openScan).toHaveBeenCalledWith(scan);
    expect(go).not.toHaveBeenCalledWith("dashboard");
  });

  it("keeps scan issues disabled while a scan is running", async () => {
    const openScanIssues = vi.fn();
    const user = userEvent.setup();
    const scan = {
      id: "sc_running",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "pending",
      status: "running",
      time: "now",
      by: "you",
    };
    useScans.mockReturnValue({
      items: [scan],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={vi.fn()} openScanIssues={openScanIssues} />);

    const issues = screen.getByRole("button", { name: /issues/i });
    expect(issues).toBeDisabled();

    await user.click(issues);

    expect(openScanIssues).not.toHaveBeenCalled();
  });

  it("shows cancelled scans as cancelled and disables result actions", async () => {
    const openScanIssues = vi.fn();
    const user = userEvent.setup();
    const scan = {
      id: "sc_cancelled",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "pending",
      status: "cancelled",
      time: "now",
      by: "you",
      issues: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    };
    useScans.mockReturnValue({
      items: [scan],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={vi.fn()} openScanIssues={openScanIssues} />);

    const row = screen.getByText("octocat/private-repo").closest(".scan-row");
    expect(row).not.toBeNull();
    expect(within(row).getByText(/^cancelled$/i)).toBeInTheDocument();
    expect(within(row).queryByText(/^pending$/i)).not.toBeInTheDocument();

    const issues = within(row).getByRole("button", { name: /^issues$/i });
    // Download zip moved into a more-actions menu, so open the menu first
    // and grab the disabled download-zip item from there.
    const more = within(row).getByRole("button", { name: /more actions/i });
    await user.click(more);
    const downloadZip = within(row).getByRole("menuitem", { name: /download zip/i });
    expect(issues).toBeDisabled();
    expect(downloadZip).toBeDisabled();

    await user.click(issues);
    await user.click(downloadZip);

    expect(openScanIssues).not.toHaveBeenCalled();
    expect(pullwiseApi.scans.auditBundleArchive).not.toHaveBeenCalled();
  });

  it("opens partial-completed scan results from history", async () => {
    const openScanIssues = vi.fn();
    const user = userEvent.setup();
    const scan = {
      id: "sc_partial",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "abc123",
      status: "partial_completed",
      time: "now",
      by: "you",
      issues: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    };
    useScans.mockReturnValue({
      items: [scan],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={vi.fn()} openScanIssues={openScanIssues} />);

    const row = screen.getByText("octocat/private-repo").closest(".scan-row");
    expect(row).not.toBeNull();
    expect(within(row).getByText("Partial result available")).toBeInTheDocument();

    const issues = within(row).getByRole("button", { name: /^issues$/i });
    expect(issues).not.toBeDisabled();
    await user.click(issues);
    expect(openScanIssues).toHaveBeenCalledWith(scan);

    const more = within(row).getByRole("button", { name: /more actions/i });
    await user.click(more);
    expect(within(row).getByRole("menuitem", { name: /download zip/i })).not.toBeDisabled();
  });

  it("opens completed scan instances from history", async () => {
    const openScan = vi.fn();
    const go = vi.fn();
    const user = userEvent.setup();
    const scan = {
      id: "sc_done",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "abc123",
      status: "done",
      time: "now",
      by: "you",
      issues: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
      aiUsage: {
        agentCli: "codex",
        model: "gpt-5.5",
        reasoningEffort: "high",
        inputTokens: 123,
        outputTokens: 45,
        totalTokens: 168,
      },
    };
    useScans.mockReturnValue({
      items: [scan],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={go} openScan={openScan} />);

    const row = screen.getByText("octocat/private-repo").closest(".scan-row");
    expect(row).not.toBeNull();
    await user.click(within(row).getByRole("button", { name: /^view$/i }));
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.5")).toBeInTheDocument();
    expect(screen.getByText("reasoning: high")).toBeInTheDocument();
    expect(screen.queryByText("168 tokens")).not.toBeInTheDocument();

    expect(screen.getByText("1 confirmed")).toBeInTheDocument();
    expect(openScan).toHaveBeenCalledWith(scan);
    expect(go).not.toHaveBeenCalledWith("dashboard");
  });

  it("shows completed scan rows without embedded report details", () => {
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_review_done",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "done",
          time: "now",
          by: "you",
          issues: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        },
      ],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={vi.fn()} openScan={vi.fn()} />);
    expect(
      screen.queryByText(/confirmed issue f_123 with review evidence/i)
    ).not.toBeInTheDocument();
  });
  it("omits worker debug bundle downloads from scan history rows", async () => {
    const user = userEvent.setup();
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_failed",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "abc123",
          status: "failed",
          time: "now",
          by: "you",
          debugBundleUrl: "/v1/review-runs/run_job_1/artifacts/art_debug_bundle",
          issues: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        },
      ],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={vi.fn()} openScan={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /more actions/i }));

    expect(screen.getByRole("menuitem", { name: /download zip/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /download debug zip/i })).not.toBeInTheDocument();
  });
  it("does not substitute audit bundle URLs when worker debug artifacts are missing", async () => {
    const user = userEvent.setup();
    useScans.mockReturnValue({
      items: [
        {
          id: "sc_running",
          repo: "octocat/private-repo",
          branch: "main",
          commit: "pending",
          status: "running",
          progress: 12,
          time: "now",
          by: "you",
          issues: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        },
      ],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={vi.fn()} openScan={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /more actions/i }));

    expect(screen.queryByRole("menuitem", { name: /download debug zip/i })).not.toBeInTheDocument();
  });
  it("downloads a structured audit bundle for completed scans", async () => {
    const user = userEvent.setup();
    const scan = {
      id: "sc_done",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "abc123",
      status: "done",
      time: "now",
      by: "you",
      issues: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
    };
    const createObjectURL = vi.fn(() => "blob:pullwise-audit");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    pullwiseApi.scans.auditBundleArchive.mockResolvedValueOnce(
      new Blob(["zip"], { type: "application/zip" })
    );
    useScans.mockReturnValue({
      items: [scan],
      loading: false,
      error: "",
    });
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    try {
      render(<HistoryScreen go={vi.fn()} openScan={vi.fn()} />);

      // Download zip is now behind a more-actions menu, so open it first.
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: /download zip/i }));

      expect(pullwiseApi.scans.auditBundleArchive).toHaveBeenCalledWith("sc_done");
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:pullwise-audit");
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", {
          configurable: true,
          value: originalCreateObjectURL,
        });
      } else {
        delete URL.createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", {
          configurable: true,
          value: originalRevokeObjectURL,
        });
      } else {
        delete URL.revokeObjectURL;
      }
      click.mockRestore();
    }
  });
});

describe("IssueDetailScreen review detail", () => {
  it("renders the Copy Page action in Chinese", () => {
    act(() => setLang("zh"));
    try {
      render(
        <IssueDetailScreen
          go={vi.fn()}
          issue={{
            id: "f_123",
            repo: "acme/api",
            severity: "high",
            category: "Security",
            title: "Validate redirect targets",
            status: "open",
          }}
        />
      );

      expect(screen.getByRole("button", { name: "复制页面" })).toBeInTheDocument();
      expect(screen.queryByText("????")).not.toBeInTheDocument();
    } finally {
      act(() => setLang("en"));
    }
  });

  it("keeps clickable breadcrumbs vertically centered in the topbar", () => {
    const css = baseStyles();
    const crumbBlock =
      css.match(/\.crumb-label,\s*\.crumb-button\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";

    expect(crumbBlock).toMatch(/display:\s*inline-flex;/);
    expect(crumbBlock).toMatch(/align-items:\s*center;/);
  });

  it("keeps evidence trace text readable in full-width rows", () => {
    const css = screenStyles();
    const timelineBlock = css.match(/\.trace-timeline\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";
    const stepBlock = css.match(/\.trace-step\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";
    const nodeBlock = css.match(/\.trace-node\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";
    const summaryBlock =
      css.match(/\.trace-node-summary\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";

    expect(timelineBlock).toMatch(/display:\s*grid;/);
    expect(timelineBlock).not.toMatch(/overflow-x:\s*auto;/);
    expect(stepBlock).toMatch(/min-width:\s*0;/);
    expect(stepBlock).not.toMatch(/min-width:\s*150px;/);
    expect(nodeBlock).toMatch(/grid-template-columns:\s*32px minmax\(0,\s*1fr\) auto;/);
    expect(summaryBlock).toMatch(/overflow-wrap:\s*anywhere;/);
    expect(summaryBlock).not.toMatch(/-webkit-line-clamp:/);
  });

  it("lets issue detail tags wrap instead of truncating labels", () => {
    const baseCss = baseStyles();
    const appCss = appStyles();
    const tagBlock = baseCss.match(/\.tag\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";
    const truncatingAtomSelector =
      appCss.match(
        /:where\((?<selector>[^)]*)\)\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s
      )?.groups?.selector || "";
    const detailTagRowBlock =
      appCss.match(/\.issue-detail-h > div:first-child > div:first-child\s*\{(?<body>[^}]*)\}/s)
        ?.groups?.body || "";
    const auditTagBlock =
      appCss.match(/\.evidence-command,\s*\.audit-tag\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";

    expect(tagBlock).toMatch(/min-height:\s*20px;/);
    expect(tagBlock).not.toMatch(/^\s*height:\s*20px;/m);
    expect(tagBlock).toMatch(/overflow:\s*visible;/);
    expect(tagBlock).toMatch(/text-overflow:\s*clip;/);
    expect(tagBlock).toMatch(/white-space:\s*normal;/);
    expect(truncatingAtomSelector).not.toContain(".tag");
    expect(appCss).not.toMatch(/\.tag\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(detailTagRowBlock).toMatch(/flex-wrap:\s*wrap;/);
    expect(auditTagBlock).toMatch(/overflow:\s*visible;/);
    expect(auditTagBlock).toMatch(/text-overflow:\s*clip;/);
    expect(auditTagBlock).toMatch(/white-space:\s*normal;/);
  });

  it("keeps the issue detail back-to-list action left aligned", () => {
    const appCss = appStyles();
    const backBlock =
      appCss.match(/\.issue-detail-back\s*\{(?<body>[^}]*)\}/s)?.groups?.body || "";

    expect(backBlock).toMatch(/align-self:\s*flex-start;/);
    expect(backBlock).toMatch(/display:\s*inline-flex;/);
    expect(backBlock).toMatch(/justify-content:\s*flex-start;/);
    expect(backBlock).toMatch(/width:\s*fit-content;/);
    expect(backBlock).toMatch(/margin:\s*0 0 12px 0;/);
  });

  it("exposes issue detail recovery navigation as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      status: "open",
    };
    const { rerender } = render(<IssueDetailScreen go={go} issue={null} />);

    const backToIssues = screen.getByRole("link", { name: /back to issues/i });
    expect(backToIssues).toHaveAttribute("href", "/issues");

    await user.click(backToIssues);
    expect(go).toHaveBeenCalledWith("issues");

    go.mockClear();
    rerender(<IssueDetailScreen go={go} issue={issue} />);

    const backToList = screen.getByRole("link", { name: /back to list/i });
    expect(backToList).toHaveAttribute("href", "/issues");
    expect(backToList).toHaveClass("issue-detail-back");

    await user.click(backToList);
    expect(go).toHaveBeenCalledWith("issues");
  });

  it("renders issue raw markdown instead of structured audit sections", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const issue = {
      id: "f_123",
      scanId: "sc_running",
      scanStatus: "running",
      scanPhase: "ai",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      rawMarkdown:
        "# Worker finding\n\n- Keep redirect targets on the allowlist.\n\n```py\nreturn safe_redirect(next_url)\n```",
      summary: "The redirect endpoint accepts arbitrary URLs.",
      status: "open",
      verificationSummary: "A focused request test reproduces the redirect behavior.",
      evidenceChecklist: [{ label: "Precise file and line", met: true }],
      evidence: [
        {
          type: "code",
          label: "Redirect call",
          summary: "The endpoint passes next_url directly into redirect.",
          file: "src/auth.py",
          startLine: "42",
          endLine: "42",
        },
      ],
      evidenceTrace: [
        {
          key: "code",
          label: "Code",
          status: "present",
          summary: "Affected code location: src/auth.py:L42",
          items: ["Code evidence links the redirect call to src/auth.py:L42."],
        },
      ],
      reproduction: {
        commands: ["pytest tests/repro/test_redirect.py"],
      },
      reasoningBreakdown: {
        facts: ["Redirect call: The endpoint passes next_url directly into redirect."],
      },
      badCode: [{ ln: 42, code: "return redirect(next_url)", t: "del" }],
      goodCode: [{ ln: 42, code: "return redirect(safe_redirect(next_url))", t: "add" }],
    };

    try {
      render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

      expect(screen.getByText("Validate redirect targets")).toBeInTheDocument();
      expect(screen.getByText("Issue report")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Worker finding" })).toBeInTheDocument();
      expect(screen.getByRole("listitem")).toHaveTextContent(
        "Keep redirect targets on the allowlist."
      );
      expect(document.querySelector(".issue-markdown-report pre")).toHaveTextContent(
        "return safe_redirect(next_url)"
      );
      expect(screen.queryByText("Confidence evidence")).not.toBeInTheDocument();
      expect(screen.queryByText("Evidence trace")).not.toBeInTheDocument();
      expect(screen.queryByText("Facts, reasoning, recommendations")).not.toBeInTheDocument();
      expect(screen.queryByText("Evidence chain")).not.toBeInTheDocument();
      expect(screen.queryByText("Reproduction center")).not.toBeInTheDocument();
      expect(screen.queryByText("Patch evidence")).not.toBeInTheDocument();
      expect(screen.queryByText("Redirect call")).not.toBeInTheDocument();
      expect(screen.queryByText("return redirect(next_url)")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /copy page/i }));

      const markdown = writeText.mock.calls[0][0];
      expect(markdown).toBe(
        "# Worker finding\n\n- Keep redirect targets on the allowlist.\n\n```py\nreturn safe_redirect(next_url)\n```"
      );
      expect(markdown).not.toContain("## Confidence evidence");
      expect(markdown).not.toContain("## Evidence trace");
      expect(markdown).not.toContain("## Evidence chain");
      expect(markdown).not.toContain("## Reproduction center");
      expect(markdown).not.toContain("## Patch evidence");
      expect(markdown).not.toContain("Redirect call");
      expect(markdown).not.toContain("return redirect(next_url)");
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it("does not submit concurrent status updates from detail actions", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      status: "open",
    };
    let resolveUpdate;
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

    const markFixed = screen.getByRole("button", { name: /mark fixed/i });
    await user.dblClick(markFixed);

    expect(pullwiseApi.issues.updateStatus).toHaveBeenCalledTimes(1);
    expect(markFixed).toBeDisabled();

    await act(async () => {
      resolveUpdate({ ...issue, status: "fixed" });
    });
  });

  it("syncs the selected issue after a detail status update", async () => {
    const user = userEvent.setup();
    const setIssue = vi.fn();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      status: "open",
    };
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockResolvedValueOnce({ ...issue, status: "fixed" });

    render(<IssueDetailScreen go={vi.fn()} issue={issue} setIssue={setIssue} />);

    await user.click(screen.getByRole("button", { name: /mark fixed/i }));

    await waitFor(() =>
      expect(setIssue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "f_123", status: "fixed" })
      )
    );
  });

  it("sends issue identity fields when updating status from detail actions", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "dup_issue",
      scanId: "sc_1",
      jobId: "job_1",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Duplicate issue",
      file: "src/app.py",
      line: 20,
      status: "open",
      createdAt: 101,
    };
    pullwiseApi.issues.updateStatus.mockReset();
    pullwiseApi.issues.updateStatus.mockResolvedValueOnce({ ...issue, status: "fixed" });

    render(<IssueDetailScreen go={vi.fn()} issue={issue} setIssue={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /mark fixed/i }));

    expect(pullwiseApi.issues.updateStatus).toHaveBeenCalledWith(
      "dup_issue",
      expect.objectContaining({
        status: "fixed",
        scanId: "sc_1",
        jobId: "job_1",
        repo: "acme/api",
        file: "src/app.py",
        line: 20,
        title: "Duplicate issue",
        createdAt: 101,
      })
    );
  });

  it("does not leak undefined or NaN when optional issue metadata is missing", () => {
    render(
      <IssueDetailScreen
        go={vi.fn()}
        issue={{ id: "f_123", title: "Manual issue", status: "open", autoFix: false }}
      />
    );

    expect(document.body).not.toHaveTextContent("undefined");
    expect(document.body).not.toHaveTextContent("NaN%");
    expect(screen.getAllByText("Repository unknown").length).toBeGreaterThan(0);
    expect(screen.getByText("File unknown")).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });
});
