import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HistoryScreen } from "./issues.jsx";

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
