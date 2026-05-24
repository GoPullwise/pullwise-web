import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HistoryScreen, IssueDetailScreen } from "./issues.jsx";

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

import { useScans } from "../lib/pullwise-data.js";

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
  it("renders impact, remediation, evidence, references, and honest Stage 2 actions", () => {
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
    expect(screen.getByRole("button", { name: /apply fix/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /open pr/i })).toBeDisabled();
  });
});
