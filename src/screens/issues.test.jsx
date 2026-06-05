import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { HistoryScreen, IssueDetailScreen, IssuesScreen } from "./issues.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    scans: {
      auditBundle: vi.fn(),
      auditBundleArchive: vi.fn(),
    },
    issues: {
      updateStatus: vi.fn(),
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
    useScans: vi.fn(),
  };
});

import { pullwiseApi } from "../api/pullwise.js";
import { useIssues, useScans } from "../lib/pullwise-data.js";

describe("IssuesScreen list resilience", () => {
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
    expect(screen.getByText("Potential risk")).toBeInTheDocument();
    expect(screen.getByText("Low evidence")).toBeInTheDocument();
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
    expect(go).toHaveBeenCalledWith("issue");

    setIssue.mockClear();
    go.mockClear();
    await user.keyboard(" ");

    expect(setIssue).toHaveBeenCalledWith(issue);
    expect(go).toHaveBeenCalledWith("issue");
  });
});

describe("HistoryScreen queue state", () => {
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
            limits: { global: 3, perUser: 1 },
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

    await user.click(screen.getByRole("button", { name: /^view\b/i }));

    expect(openScan).toHaveBeenCalledWith(scan);
    expect(go).not.toHaveBeenCalledWith("dashboard");
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
      verificationAudit: { rejectedCount: 2, downgradedCount: 1 },
    };
    useScans.mockReturnValue({
      items: [scan],
      loading: false,
      error: "",
    });

    render(<HistoryScreen go={go} openScan={openScan} />);

    await user.click(screen.getByRole("button", { name: /^view\b/i }));

    expect(screen.getByText("1 issues · 2 rejected · 1 downgraded")).toBeInTheDocument();
    expect(openScan).toHaveBeenCalledWith(scan);
    expect(go).not.toHaveBeenCalledWith("dashboard");
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
      verificationAudit: { rejectedCount: 2, downgradedCount: 1 },
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

      await user.click(screen.getByRole("button", { name: /bundle/i }));

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

    await user.click(backToList);
    expect(go).toHaveBeenCalledWith("issues");
  });

  it("renders impact, remediation, evidence, references, and fix actions", () => {
    const issue = {
      id: "f_123",
      scanId: "sc_1",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      summary: "The redirect endpoint accepts arbitrary URLs.",
      impact: "Attackers can abuse this for phishing.",
      file: "src/auth.py",
      line: 42,
      commit: "abc1234",
      verificationStatus: "verified",
      verificationSummary: "A focused request test reproduces the redirect behavior.",
      confidenceLevel: "high",
      evidenceChecklist: [
        { label: "Fixed commit", met: true },
        { label: "Precise file and line", met: true },
        { label: "Reproduction command", met: true },
      ],
      affectedLocations: [
        {
          file: "src/auth.py",
          startLine: "42",
          endLine: "42",
          url: "https://github.com/acme/api/blob/abc1234/src/auth.py#L42",
        },
      ],
      evidence: [
        {
          type: "code",
          label: "Redirect call",
          summary: "The endpoint passes next_url directly into redirect.",
          file: "src/auth.py",
          startLine: "42",
          endLine: "42",
          url: "https://github.com/acme/api/blob/abc1234/src/auth.py#L42",
        },
        {
          type: "runtime_log",
          label: "Repro output",
          summary: "The focused test failed with an external redirect.",
          command: "pytest tests/repro/test_redirect.py",
          exitCode: 1,
          logPath: "logs/f_123.log",
          output: "FAIL tests/repro/test_redirect.py\nAssertionError: expected 400 received 302",
        },
      ],
      reproduction: {
        commands: ["pytest tests/repro/test_redirect.py"],
        input: "GET /login?next=https://evil.example",
        expected: "400 validation error",
        actual: "302 external redirect",
        testFile: "tests/repro/test_redirect.py",
        logPath: "logs/f_123.log",
      },
      evidenceTrace: [
        {
          key: "code",
          label: "Code",
          status: "present",
          summary: "Affected code location: src/auth.py:L42",
          items: ["Code evidence links the redirect call to src/auth.py:L42."],
        },
        {
          key: "path",
          label: "Path",
          status: "present",
          summary: "Reachability check: next_url is read from the request query.",
          items: ["Reachability check: next_url is read from the request query."],
        },
        {
          key: "fix",
          label: "Fix",
          status: "missing",
          summary: "No fix or validation evidence was captured.",
          items: [],
        },
      ],
      reasoningBreakdown: {
        facts: ["Redirect call: The endpoint passes next_url directly into redirect."],
        inferences: ["Impact: Attackers can abuse this for phishing."],
        recommendations: ["Validate redirect targets before returning a redirect."],
      },
      whyNotFalsePositive: ["next_url is read from the request query."],
      limitations: ["A production gateway could block external next URLs first."],
      confidence: 0.91,
      status: "open",
      autoFix: true,
      steps: ["Allow only same-origin redirect targets.", "Add tests for rejected external URLs."],
      badCode: [{ ln: 42, code: "return redirect(next_url)", t: "del" }],
      goodCode: [{ ln: 42, code: "return redirect(safe_redirect(next_url))", t: "add" }],
      references: [{ label: "OWASP redirects", url: "https://cheatsheetseries.owasp.org/" }],
    };

    render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Attackers can abuse this for phishing.")).toBeInTheDocument();
    expect(screen.getByText("Confidence evidence")).toBeInTheDocument();
    expect(screen.getByText("A focused request test reproduces the redirect behavior.")).toBeInTheDocument();
    expect(screen.getByText("Fixed commit")).toBeInTheDocument();
    expect(screen.getByText("Evidence chain")).toBeInTheDocument();
    expect(screen.getByText("Redirect call")).toBeInTheDocument();
    expect(screen.getByText("Raw output")).toBeInTheDocument();
    expect(screen.getByText(/AssertionError: expected 400 received 302/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open evidence line/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/api/blob/abc1234/src/auth.py#L42"
    );
    expect(screen.getByText("Evidence trace")).toBeInTheDocument();
    expect(screen.getByText("Affected code location: src/auth.py:L42")).toBeInTheDocument();
    expect(screen.getByText("Reachability check: next_url is read from the request query.")).toBeInTheDocument();
    expect(screen.getByText("No fix or validation evidence was captured.")).toBeInTheDocument();
    expect(screen.getByText("Facts, reasoning, recommendations")).toBeInTheDocument();
    expect(screen.getByText("Facts")).toBeInTheDocument();
    expect(screen.getByText("Redirect call: The endpoint passes next_url directly into redirect.")).toBeInTheDocument();
    expect(screen.getByText("Inferences")).toBeInTheDocument();
    expect(screen.getByText("Impact: Attackers can abuse this for phishing.")).toBeInTheDocument();
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Validate redirect targets before returning a redirect.")).toBeInTheDocument();
    expect(screen.getByText("Reproduction center")).toBeInTheDocument();
    expect(screen.getAllByText("pytest tests/repro/test_redirect.py").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("GET /login?next=https://evil.example")).toBeInTheDocument();
    expect(screen.getByText("Why this is not a false positive")).toBeInTheDocument();
    expect(screen.getByText("next_url is read from the request query.")).toBeInTheDocument();
    expect(screen.getByText("When this may not apply")).toBeInTheDocument();
    expect(screen.getByText("A production gateway could block external next URLs first.")).toBeInTheDocument();
    expect(screen.getByText("Remediation")).toBeInTheDocument();
    expect(screen.getByText("Allow only same-origin redirect targets.")).toBeInTheDocument();
    expect(screen.getByText("Patch evidence")).toBeInTheDocument();
    expect(screen.getByText("return redirect(next_url)")).toBeInTheDocument();
    expect(screen.getByText("return redirect(safe_redirect(next_url))")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OWASP redirects" })).toHaveAttribute(
      "href",
      "https://cheatsheetseries.owasp.org/"
    );
    expect(screen.getByRole("button", { name: /mark fixed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /snooze/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview fix/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /open pr/i })).toBeDisabled();
  });

  it("previews an auto-fix and then opens a pull request", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      summary: "The redirect endpoint accepts arbitrary URLs.",
      status: "open",
      autoFix: true,
      file: "src/auth.py",
      badCode: [{ ln: 42, code: "return redirect(next_url)", t: "del" }],
      goodCode: [{ ln: 42, code: "return redirect(safe_redirect(next_url))", t: "add" }],
    };
    pullwiseApi.issues.previewFix.mockResolvedValueOnce({
      valid: true,
      file: "src/auth.py",
      diff: "--- a/src/auth.py\n+++ b/src/auth.py\n-return redirect(next_url)\n+return redirect(safe_redirect(next_url))\n",
    });
    pullwiseApi.issues.createPullRequest.mockResolvedValueOnce({
      url: "https://github.com/acme/api/pull/42",
      number: 42,
      branch: "pullwise/fix-f_123-a1b2c3",
      title: "Fix: Validate redirect targets",
    });

    render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

    await user.click(screen.getByRole("button", { name: /preview fix/i }));
    expect(await screen.findByText("validated")).toBeInTheDocument();
    expect(screen.getByText(/\+return redirect\(safe_redirect\(next_url\)\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open pr/i }));
    expect(await screen.findByRole("link", { name: /pull request #42/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/api/pull/42"
    );
  });

  it("does not render unsafe pull request responses as links", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      summary: "The redirect endpoint accepts arbitrary URLs.",
      status: "open",
      autoFix: true,
      file: "src/auth.py",
    };
    pullwiseApi.issues.previewFix.mockResolvedValueOnce({
      valid: true,
      file: "src/auth.py",
      diff: "--- a/src/auth.py\n+++ b/src/auth.py\n",
    });
    pullwiseApi.issues.createPullRequest.mockResolvedValueOnce({
      url: "javascript:alert(1)",
      number: 42,
      branch: "pullwise/fix-f_123-a1b2c3\r\nX-Injected: bad",
      title: "Fix Validate redirect targets\r\nX-Injected: bad",
    });

    render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

    await user.click(screen.getByRole("button", { name: /preview fix/i }));
    expect(await screen.findByText("validated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /open pr/i }));

    expect(screen.queryByRole("link", { name: /pull request/i })).not.toBeInTheDocument();
    expect(document.body).not.toContainHTML("javascript:alert");
  });

  it("does not expose unsafe pull request metadata during a synchronous issue rerender", () => {
    const issueA = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      status: "open",
      autoFix: true,
      pullRequest: {
        url: "https://github.com/acme/api/pull/42",
        number: 42,
        branch: "pullwise/fix-f_123-a1b2c3",
        title: "Fix Validate redirect targets",
      },
    };
    const issueB = {
      id: "f_456",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Escape shell arguments",
      status: "open",
      autoFix: true,
      pullRequest: {
        url: "javascript:alert(1)",
        number: 43,
        branch: "pullwise/fix-f_456-bad\r\nX-Injected: bad",
        title: "Fix Escape shell arguments\r\nX-Injected: bad",
      },
    };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    try {
      flushSync(() => {
        root.render(<IssueDetailScreen go={vi.fn()} issue={issueA} />);
      });
      expect(screen.getByRole("link", { name: /pull request #42/i })).toHaveAttribute(
        "href",
        "https://github.com/acme/api/pull/42"
      );

      flushSync(() => {
        root.render(<IssueDetailScreen go={vi.fn()} issue={issueB} />);
      });

      expect(screen.queryByRole("link", { name: /pull request/i })).not.toBeInTheDocument();
      expect(document.body).not.toContainHTML("javascript:alert");
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("ignores preview responses from a previous issue", async () => {
    const user = userEvent.setup();
    const issueA = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      summary: "The redirect endpoint accepts arbitrary URLs.",
      status: "open",
      autoFix: true,
      file: "src/auth.py",
    };
    const issueB = {
      ...issueA,
      id: "f_456",
      title: "Escape shell arguments",
      file: "src/shell.py",
    };
    let resolvePreview;
    pullwiseApi.issues.previewFix.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreview = resolve;
      })
    );

    const { rerender } = render(<IssueDetailScreen go={vi.fn()} issue={issueA} />);

    await user.click(screen.getByRole("button", { name: /preview fix/i }));
    rerender(<IssueDetailScreen go={vi.fn()} issue={issueB} />);
    await act(async () => {
      resolvePreview({
        valid: true,
        file: "src/auth.py",
        diff: "--- a/src/auth.py\n+++ b/src/auth.py\n-return redirect(next_url)\n+return redirect(safe_redirect(next_url))\n",
      });
    });

    expect(screen.queryByText("validated")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open pr/i })).toBeDisabled();
  });

  it("does not expose a valid preview during a synchronous issue rerender", async () => {
    const issueA = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      summary: "The redirect endpoint accepts arbitrary URLs.",
      status: "open",
      autoFix: true,
      file: "src/auth.py",
    };
    const issueB = {
      ...issueA,
      id: "f_456",
      title: "Escape shell arguments",
      file: "src/shell.py",
    };
    pullwiseApi.issues.previewFix.mockResolvedValueOnce({
      valid: true,
      file: "src/auth.py",
      diff: "--- a/src/auth.py\n+++ b/src/auth.py\n-return redirect(next_url)\n+return redirect(safe_redirect(next_url))\n",
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    try {
      flushSync(() => {
        root.render(<IssueDetailScreen go={vi.fn()} issue={issueA} />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /preview fix/i }));
      });
      expect(await screen.findByText("validated")).toBeInTheDocument();

      flushSync(() => {
        root.render(<IssueDetailScreen go={vi.fn()} issue={issueB} />);
      });

      expect(screen.queryByText("validated")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /open pr/i })).toBeDisabled();
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("clears a previous valid preview when re-previewing fails", async () => {
    const user = userEvent.setup();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      summary: "The redirect endpoint accepts arbitrary URLs.",
      status: "open",
      autoFix: true,
      file: "src/auth.py",
    };
    pullwiseApi.issues.previewFix
      .mockResolvedValueOnce({
        valid: true,
        file: "src/auth.py",
        diff: "--- a/src/auth.py\n+++ b/src/auth.py\n-return redirect(next_url)\n+return redirect(safe_redirect(next_url))\n",
      })
      .mockRejectedValueOnce(new Error("Preview failed"));

    render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

    await user.click(screen.getByRole("button", { name: /preview fix/i }));
    expect(await screen.findByText("validated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /preview fix/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Preview failed");
    expect(screen.queryByText("validated")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open pr/i })).toBeDisabled();
  });

  it("keeps non-auto-fixable issues honest", () => {
    render(
      <IssueDetailScreen
        go={vi.fn()}
        issue={{ id: "f_123", title: "Manual issue", status: "open", autoFix: false }}
      />
    );

    expect(screen.getByRole("button", { name: /preview fix/i })).toBeDisabled();
    expect(screen.getByText(/not auto-fixable/i)).toBeInTheDocument();
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
