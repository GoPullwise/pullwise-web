import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../i18n.jsx";
import { ScanTiming, scanTimingPresentation } from "./scan-timing.jsx";

const parallel = {
  configuredConcurrency: 3,
  effectiveConcurrency: 3,
  activeUnits: 2,
  pendingUnits: 6,
  retryingUnits: 0,
};

function estimate(state, extra = {}) {
  return {
    state,
    basis: "current_run_work_graph",
    updatedAt: "2026-07-01T10:42:00Z",
    parallel,
    ...extra,
  };
}

describe("ScanTiming", () => {
  beforeEach(() => setLang("en"));

  it("keeps ETA hidden until a usable running estimate exists", () => {
    expect(
      scanTimingPresentation({ status: "queued", estimate: estimate("available") })
    ).toBeNull();
    expect(scanTimingPresentation({ status: "running" })).toBeNull();

    expect(
      scanTimingPresentation({ status: "running", estimate: estimate("estimating") })
    ).toBeNull();
    expect(
      scanTimingPresentation({ status: "running", estimate: estimate("unavailable") })
    ).toBeNull();
  });

  it("renders a rounded minute range without fake second-level precision", () => {
    render(
      <ScanTiming
        scan={{
          status: "running",
          estimate: estimate("available", {
            remainingSeconds: 900,
            lowerSeconds: 780,
            upperSeconds: 1080,
            confidence: "medium",
          }),
        }}
      />
    );

    const timing = screen.getByRole("status");
    expect(timing).toHaveTextContent("13–18 min remaining");
    expect(timing).not.toHaveTextContent(/seconds?/i);
    expect(timing).toHaveAttribute("aria-live", "polite");
  });

  it("replaces ETA with actual terminal duration", () => {
    expect(scanTimingPresentation({ status: "done", durationMs: null })).toBeNull();

    const { rerender } = render(
      <ScanTiming scan={{ status: "done", reviewRun: { durationMs: 720_000 } }} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Completed in 12 min");

    rerender(
      <ScanTiming scan={{ status: "failed", startedAt: 100, completedAt: 820 }} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Ran for 12 min");
  });

  it("keeps the timing block square-edged and safe on narrow layouts", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");
    const block = css.match(/\.scan-timing\s*\{(?<body>[^}]*)\}/s)?.groups?.body;

    expect(block).toBeTruthy();
    expect(block).toMatch(/border-radius\s*:\s*0/);
    expect(block).toMatch(/max-width\s*:\s*100%/);
    expect(block).toMatch(/overflow-wrap\s*:\s*anywhere/);
  });
});
