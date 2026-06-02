import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { StatusScreen } from "./legal.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    system: {
      health: vi.fn(),
      status: vi.fn(),
      adminStatus: vi.fn(),
      listWorkers: vi.fn(),
    },
  },
}));

describe("StatusScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pullwiseApi.system.status.mockResolvedValue({
      scanSystemStatus: "ok",
      queuedJobs: 2,
      runningJobs: 1,
      availableCapacity: 3,
    });
    pullwiseApi.system.adminStatus.mockResolvedValue({
      scanSystemStatus: "ok",
      queuedJobs: 2,
      runningJobs: 1,
      availableCapacity: 3,
      workers: [],
    });
  });

  it("renders live backend health instead of generated incident history", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "local",
      database: {
        type: "sqlite",
        path: ".pullwise/pullwise.sqlite3",
      },
    });

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("API reachable")).toBeInTheDocument();
    expect(screen.getByText("Scan system")).toBeInTheDocument();
    expect(screen.getByText(/2 queued \/ 1 running \/ 3 slots available/i)).toBeInTheDocument();
    expect(screen.queryByText(/Elevated scan latency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Brief web app outage/i)).not.toBeInTheDocument();
  });

  it("renders backend readiness details when health includes them", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "production",
      database: {
        type: "sqlite",
        path: ".pullwise/pullwise.sqlite3",
      },
      reviewProvider: "codex",
      github: {
        oauthConfigured: true,
        appInstallConfigured: true,
        appApiConfigured: false,
        appVisibilityCheck: true,
      },
      billing: {
        provider: "disabled",
        enabled: false,
      },
      limits: {
        maxConcurrentScansPerUser: 1,
        maxQueuedScansGlobal: 1000,
        maxQueuedScansPerUser: 20,
        rateLimitEnabled: true,
      },
    });

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("Backend readiness")).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(screen.getByText(/OAuth configured/i)).toBeInTheDocument();
    expect(screen.getByText(/App API missing/i)).toBeInTheDocument();
    expect(screen.getByText(/disabled \(not enabled\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1 per user running/i)).toBeInTheDocument();
    expect(screen.getByText(/1000 global \/ 20 per user queued/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate limiting enabled/i)).toBeInTheDocument();
  });

  it("does not render worker details for non-admin visitors", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "production",
      database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
    });
    pullwiseApi.system.status.mockResolvedValue({
      scanSystemStatus: "ok",
      queuedJobs: 1,
      runningJobs: 1,
      availableCapacity: 2,
      workers: [
        {
          worker_id: "wk_public...",
          name: "US worker",
          status: "idle",
          running_jobs: 1,
          max_concurrent_jobs: 4,
          free_slots: 3,
          provider: "codex",
          version: "0.1.0",
          region: "us-east",
          last_heartbeat_at: 1760000000,
        },
      ],
    });

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("Scan system")).toBeInTheDocument();
    expect(screen.queryByText("Worker registry")).not.toBeInTheDocument();
    expect(screen.queryByText("US worker")).not.toBeInTheDocument();
    expect(pullwiseApi.system.adminStatus).not.toHaveBeenCalled();
  });

  it("renders worker summary and link to workers screen for admin", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "production",
      database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
    });
    pullwiseApi.system.adminStatus.mockResolvedValue({
      scanSystemStatus: "degraded",
      queuedJobs: 5,
      runningJobs: 2,
      availableCapacity: 1,
      workers: [
        {
          worker_id: "wk_1",
          name: "US worker",
          status: "busy",
          running_jobs: 2,
          max_concurrent_jobs: 2,
          provider: "codex",
          version: "0.1.0",
          region: "us-east",
        },
        {
          worker_id: "wk_2",
          name: "EU worker",
          status: "degraded",
          running_jobs: 0,
          max_concurrent_jobs: 8,
          provider: "codex",
          version: "0.1.0",
          region: "eu",
        },
      ],
    });

    render(<StatusScreen go={vi.fn()} auth={{ session: { admin: true } }} />);

    expect(await screen.findByText("Worker registry")).toBeInTheDocument();
    expect(screen.getByText("US worker")).toBeInTheDocument();
    expect(screen.getByText("EU worker")).toBeInTheDocument();
    expect(screen.getByText(/Manage workers/i)).toBeInTheDocument();
  });

  it("shows empty state when no workers are registered for admin", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "production",
      database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
    });
    pullwiseApi.system.adminStatus.mockResolvedValue({
      scanSystemStatus: "ok",
      queuedJobs: 0,
      runningJobs: 0,
      availableCapacity: 1,
      workers: [],
    });

    render(<StatusScreen go={vi.fn()} auth={{ session: { admin: true } }} />);

    expect(await screen.findByText("Worker registry")).toBeInTheDocument();
    expect(screen.getByText(/No workers registered/i)).toBeInTheDocument();
    expect(screen.getByText(/Manage workers/i)).toBeInTheDocument();
  });
});
