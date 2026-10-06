import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      mode: "preview",
      database: {
        type: "d1",
        path: "/private/ledger.db",
      },
    });

    render(<StrictMode><StatusScreen go={vi.fn()} /></StrictMode>);

    expect(await screen.findByText("API reachable")).toBeInTheDocument();
    expect(pullwiseApi.system.health).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Scan system")).not.toBeInTheDocument();
    expect(pullwiseApi.system.status).toBeUndefined();
    expect(screen.getByText(/d1: configured backend/i)).toBeInTheDocument();
    expect(screen.queryByText(/\/private\/ledger\.db/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Elevated scan latency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Brief web app outage/i)).not.toBeInTheDocument();
  });

  it("shows only current GitHub and billing readiness from health", async () => {
    pullwiseApi.system.health.mockResolvedValue({
      ok: true,
      service: "pullwise-server",
      database: { type: "d1", path: "/private/ledger.db" },
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
    expect(
      screen.queryByText(/Scan system|Review runtimes|old-model|queued/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\/private\/ledger\.db/i)).not.toBeInTheDocument();
  });

  it("allows an explicit refresh to fail and recover without repeating the request automatically", async () => {
    const freshHealth = deferred();
    pullwiseApi.system.health
      .mockResolvedValueOnce({ ok: true, service: "pullwise-server" })
      .mockRejectedValueOnce(new Error("Newer health check failed"))
      .mockReturnValueOnce(freshHealth.promise);

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("API reachable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));

    await waitFor(() => expect(pullwiseApi.system.health).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
    expect(screen.getByText("Newer health check failed")).toBeInTheDocument();
    expect(pullwiseApi.system.health).toHaveBeenCalledTimes(2);
    const refresh = screen.getByRole("button", { name: "Refresh status" });
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    await waitFor(() => expect(pullwiseApi.system.health).toHaveBeenCalledTimes(3));
    expect(refresh).toBeDisabled();

    await act(async () => {
      freshHealth.resolve({
        ok: true,
        service: "pullwise-server",
        mode: "production",
        database: { type: "d1", path: "/private/ledger.db" },
      });
      await freshHealth.promise;
    });

    expect(screen.getByText("API reachable")).toBeInTheDocument();
    expect(screen.queryByText("API unreachable")).not.toBeInTheDocument();
    expect(refresh).toBeEnabled();
  });

  it("never polls or repeats health reads on visibility changes and aborts the initial request when unmounted", async () => {
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
      await waitFor(() => expect(pullwiseApi.system.health).toHaveBeenCalledTimes(1));
      vi.useFakeTimers();
      await act(async () => vi.advanceTimersByTime(120_000));
      expect(pullwiseApi.system.health).toHaveBeenCalledTimes(1);

      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(pullwiseApi.system.health).toHaveBeenCalledTimes(1);
      expect(healthSignals[0].aborted).toBe(false);

      visibility.mockReturnValue("hidden");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(healthSignals[0].aborted).toBe(false);

      visibility.mockReturnValue("visible");
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(pullwiseApi.system.health).toHaveBeenCalledTimes(1);

      unmount();
      expect(healthSignals[0].aborted).toBe(true);
    } finally {
      vi.useRealTimers();
      visibility.mockRestore();
    }
  });
});
