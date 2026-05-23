import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScanningScreen } from "./flow.jsx";

vi.mock("../lib/pullwise-data.js", () => ({
  isTerminalScan: (scan) => ["done", "failed", "cancelled"].includes(scan?.status),
  scanQueueSummary: (scan) => scan?.queue ? {
    message: scan.queue.message || "",
    tags: [
      scan.queue.position ? `Position ${scan.queue.position}` : null,
      typeof scan.queue.ahead === "number" ? `${scan.queue.ahead} scans ahead` : null,
      scan.queue.limits?.global ? `Global ${scan.queue.limits.global}` : null,
      scan.queue.limits?.perUser ? `Per user ${scan.queue.limits.perUser}` : null,
    ].filter(Boolean),
  } : null,
  useRepositories: vi.fn(),
  useScanRun: vi.fn(),
}));

import { useScanRun } from "../lib/pullwise-data.js";

describe("ScanningScreen queue state", () => {
  it("passes the active repository scan request id to the scan runner", () => {
    useScanRun.mockReturnValue({
      scan: null,
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          fullName: "octocat/private-repo",
          defaultBranch: "main",
          scanRequestId: "scan_req_1",
        }}
      />
    );

    expect(useScanRun).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: "octocat/private-repo",
        branch: "main",
        requestId: "scan_req_1",
      })
    );
  });

  it("explains queued scans with queue position and capacity limits", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_queued",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "queued",
        progress: 0,
        queue: {
          position: 4,
          ahead: 3,
          reason: "global_limit",
          message: "Server is running 3 of 3 scans; 3 scans ahead.",
          limits: { global: 3, perUser: 1 },
          running: { global: 3, user: 0 },
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    expect(screen.getAllByText(/queued/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/scan queued/i)).toBeInTheDocument();
    expect(screen.getByText(/position 4/i)).toBeInTheDocument();
    expect(screen.getAllByText(/3 scans ahead/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/global 3/i)).toBeInTheDocument();
    expect(screen.getByText(/per user 1/i)).toBeInTheDocument();
  });
});
