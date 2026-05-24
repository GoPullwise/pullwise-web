import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { HistoryScreen, IssueDetailScreen, IssuesScreen } from "./issues.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    issues: {
      updateStatus: vi.fn(),
      previewFix: vi.fn(),
      createPullRequest: vi.fn(),
    },
  },
}));

vi.mock("../lib/pullwise-data.js", () => ({
  isActiveScan: (scan) => ["queued", "running"].includes(scan?.status),
  scanQueueSummary: (scan) => scan?.queue ? {
    message: scan.queue.message || "",
    tags: [
      scan.queue.position ? `Position ${scan.queue.position}` : null,
      typeof scan.queue.ahead === "number" ? `${scan.queue.ahead} scans ahead` : null,
    ].filter(Boolean),
  } : null,
  useIssues: vi.fn(() => ({ items: [] })),
  useRepositories: vi.fn(() => ({ items: [] })),
  useScans: vi.fn(),
}));

import { pullwiseApi } from "../api/pullwise.js";
import { useIssues, useScans } from "../lib/pullwise-data.js";

describe("IssuesScreen list resilience", () => {
  it("does not leak NaN when issue confidence is missing", () => {
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
    expect(screen.getByText("--")).toBeInTheDocument();
  });
});

describe("HistoryScreen queue state", () => {
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
});

describe("IssueDetailScreen review detail", () => {
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
      confidence: 0.91,
      status: "open",
      autoFix: true,
      steps: [
        "Allow only same-origin redirect targets.",
        "Add tests for rejected external URLs.",
      ],
      badCode: [{ ln: 42, code: "return redirect(next_url)", t: "del" }],
      goodCode: [{ ln: 42, code: "return redirect(safe_redirect(next_url))", t: "add" }],
      references: [{ label: "OWASP redirects", url: "https://cheatsheetseries.owasp.org/" }],
    };

    render(<IssueDetailScreen go={vi.fn()} issue={issue} />);

    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Attackers can abuse this for phishing.")).toBeInTheDocument();
    expect(screen.getByText("Remediation")).toBeInTheDocument();
    expect(screen.getByText("Allow only same-origin redirect targets.")).toBeInTheDocument();
    expect(screen.getByText("Evidence")).toBeInTheDocument();
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
    pullwiseApi.issues.previewFix.mockReturnValueOnce(new Promise((resolve) => {
      resolvePreview = resolve;
    }));

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
    expect(screen.getByText("Repository unknown")).toBeInTheDocument();
    expect(screen.getByText("File unknown")).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });
});
