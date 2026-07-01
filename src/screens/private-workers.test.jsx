import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { PrivateWorkersScreen } from "./private-workers.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    privateWorkers: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      rotateToken: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe("PrivateWorkersScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders private worker Codex quota status and quota windows", async () => {
    pullwiseApi.privateWorkers.list.mockResolvedValue({
      workers: [
        {
          worker_id: "wk_quota",
          name: "Quota worker",
          status: "degraded",
          region: "local",
          version: "0.4.18",
          running_jobs: 0,
          last_heartbeat_at: 1782900000,
          codexQuota: {
            provider: "codex",
            status: "exhausted",
            ready: false,
            planType: "pro",
            remainingPercent: 0,
            windows: [
              {
                windowKind: "five_hour",
                label: "5 hour",
                usedPercent: 100,
                remainingPercent: 0,
                windowDurationMins: 300,
              },
              {
                windowKind: "weekly",
                label: "weekly",
                usedPercent: 50,
                remainingPercent: 50,
                windowDurationMins: 10080,
              },
            ],
          },
        },
      ],
    });

    render(<PrivateWorkersScreen go={vi.fn()} />);

    const row = (await screen.findByText("Quota worker")).closest(".private-worker-row");

    expect(row).toBeTruthy();
    expect(within(row).getByText("Codex quota Exhausted")).toBeInTheDocument();
    expect(within(row).getByText("5 hour 0% remaining")).toBeInTheDocument();
    expect(within(row).getByText("Weekly 50% remaining")).toBeInTheDocument();
  });
});
