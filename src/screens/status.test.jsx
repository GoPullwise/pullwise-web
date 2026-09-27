import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { setLang } from "../i18n.jsx";
import { StatusScreen } from "./legal.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    system: {
      health: vi.fn(),
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
    setLang("en");
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
    expect(screen.queryByText("Scan system")).not.toBeInTheDocument();
    expect(pullwiseApi.system.status).toBeUndefined();
    expect(screen.getByText(/sqlite: configured backend/i)).toBeInTheDocument();
    expect(screen.queryByText(/\.pullwise\/pullwise\.sqlite3/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Elevated scan latency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Brief web app outage/i)).not.toBeInTheDocument();
  });

  it("shows only current GitHub and billing readiness from health", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      database: { type: "sqlite", path: ".pullwise/pullwise.sqlite3" },
      github: { oauthConfigured: true, appInstallConfigured: true, appApiConfigured: false },
      billing: { provider: "disabled", enabled: false },
      scanSystem: { queuedJobs: 5, busyWorkerCount: 1 },
      availableReviewModels: [{ provider: "old", model: "old-model" }],
    });

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("Backend readiness")).toBeInTheDocument();
    expect(screen.getByText(/OAuth configured/i)).toBeInTheDocument();
    expect(screen.getByText(/App API missing/i)).toBeInTheDocument();
    expect(screen.getByText(/disabled \(not enabled\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Scan system|Review runtimes|old-model|queued/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\.pullwise\/pullwise\.sqlite3/i)).not.toBeInTheDocument();
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

  it("waits for visibility and aborts health requests when hidden or unmounted", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const healthSignals = [];
    pullwiseApi.system.health.mockImplementation(({ signal } = {}) => {
      healthSignals.push(signal);
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          { once: true }
        );
      });
    });
    const { unmount } = render(<StatusScreen go={vi.fn()} />);

    try {
      expect(pullwiseApi.system.health).not.toHaveBeenCalled();

      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await waitFor(() => expect(pullwiseApi.system.health).toHaveBeenCalledTimes(1));
      expect(healthSignals[0].aborted).toBe(false);

      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(healthSignals[0].aborted).toBe(true);

      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await waitFor(() => expect(pullwiseApi.system.health).toHaveBeenCalledTimes(2));
      expect(healthSignals[1].aborted).toBe(false);

      unmount();
      expect(healthSignals[1].aborted).toBe(true);
    } finally {
      visibility.mockRestore();
    }
  });
});
