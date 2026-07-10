import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { StatusScreen } from "./legal.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    system: {
      health: vi.fn(),
      status: vi.fn(),
    },
  },
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("StatusScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pullwiseApi.system.status.mockResolvedValue({
      scanSystemStatus: "ok",
      queuedJobs: 2,
      runningJobs: 1,
      busyWorkerCount: 1,
      idleWorkerCount: 2,
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
    expect(screen.getByText(/2 queued \/ 1 running \/ 1 busy \/ 2 idle workers/i)).toBeInTheDocument();
    expect(screen.getByText(/sqlite: configured backend/i)).toBeInTheDocument();
    expect(screen.queryByText(/\.pullwise\/pullwise\.sqlite3/i)).not.toBeInTheDocument();
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
        maxQueuedScansGlobal: 1000,
        repository: { maxFiles: 2000, maxBytes: 50 * 1024 * 1024 },
        rateLimitEnabled: true,
      },
    });

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("Backend readiness")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.queryByText(/codex/i)).not.toBeInTheDocument();
    expect(screen.getByText(/OAuth configured/i)).toBeInTheDocument();
    expect(screen.getByText(/App API missing/i)).toBeInTheDocument();
    expect(screen.getByText(/disabled \(not enabled\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1000 global queued/i)).toBeInTheDocument();
    expect(screen.getByText(/Repo checkout 2,000 files \/ 50 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/Public REST API.*rate limiting enabled/i)).toBeInTheDocument();
    expect(screen.queryByText(/\.pullwise\/pullwise\.sqlite3/i)).not.toBeInTheDocument();
  });

  it("does not expose the public review provider detail", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "production",
      database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
      reviewProvider: "internal-runner",
    });

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("Backend readiness")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.queryByText(/internal-runner/i)).not.toBeInTheDocument();
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
      busyWorkerCount: 1,
      idleWorkerCount: 0,
      workers: [
        {
          worker_id: "wk_public...",
          name: "US worker",
          status: "idle",
          running_jobs: 1,
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
  });

  it("does not render worker registry from public status even for admin sessions", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "production",
      database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
    });
    pullwiseApi.system.status.mockResolvedValue({
      scanSystemStatus: "degraded",
      queuedJobs: 5,
      runningJobs: 2,
      busyWorkerCount: 1,
      idleWorkerCount: 0,
      workers: [
        {
          worker_id: "wk_1",
          name: "US worker",
          status: "busy",
          running_jobs: 2,
          provider: "codex",
          version: "0.1.0",
          region: "us-east",
        },
        {
          worker_id: "wk_2",
          name: "EU worker",
          status: "degraded",
          running_jobs: 0,
          provider: "codex",
          version: "0.1.0",
          region: "eu",
        },
      ],
    });

    render(<StatusScreen go={vi.fn()} auth={{ session: { admin: true } }} />);

    expect(await screen.findByText("Scan system")).toBeInTheDocument();
    expect(screen.queryByText("Worker registry")).not.toBeInTheDocument();
    expect(screen.queryByText("US worker")).not.toBeInTheDocument();
    expect(screen.queryByText("EU worker")).not.toBeInTheDocument();
    expect(screen.queryByText(/Manage workers/i)).not.toBeInTheDocument();
  });

  it("keeps status page focused on public status when admin has no workers", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      mode: "production",
      database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
    });
    pullwiseApi.system.status.mockResolvedValue({
      scanSystemStatus: "ok",
      queuedJobs: 0,
      runningJobs: 0,
      busyWorkerCount: 0,
      idleWorkerCount: 1,
      workers: [],
    });

    render(<StatusScreen go={vi.fn()} auth={{ session: { admin: true } }} />);

    expect(await screen.findByText("Scan system")).toBeInTheDocument();
    expect(screen.queryByText("Worker registry")).not.toBeInTheDocument();
    expect(screen.queryByText(/No workers registered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Manage workers/i)).not.toBeInTheDocument();
  });

  it("ignores stale health responses after a newer check fails", async () => {
    const staleHealth = deferred();
    pullwiseApi.system.health
      .mockReturnValueOnce(staleHealth.promise)
      .mockRejectedValueOnce(new Error("Newer health check failed"));

    render(<StatusScreen go={vi.fn()} />);

    expect(pullwiseApi.system.health).toHaveBeenCalledTimes(1);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(pullwiseApi.system.health).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("API unreachable")).toBeInTheDocument();

    await act(async () => {
      staleHealth.resolve({
        ok: true,
        service: "pullwise-server",
        mode: "production",
        database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
      });
      await staleHealth.promise;
    });

    expect(screen.getByText("API unreachable")).toBeInTheDocument();
    expect(screen.queryByText("API reachable")).not.toBeInTheDocument();
  });
});
