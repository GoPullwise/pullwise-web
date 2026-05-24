import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { StatusScreen } from "./legal.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    system: {
      health: vi.fn(),
    },
  },
}));

describe("StatusScreen", () => {
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
        maxConcurrentScans: 3,
        maxConcurrentScansPerUser: 1,
        rateLimitEnabled: true,
      },
    });

    render(<StatusScreen go={vi.fn()} />);

    expect(await screen.findByText("Backend readiness")).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(screen.getByText(/OAuth configured/i)).toBeInTheDocument();
    expect(screen.getByText(/App API missing/i)).toBeInTheDocument();
    expect(screen.getByText(/disabled \(not enabled\)/i)).toBeInTheDocument();
    expect(screen.getByText(/3 global \/ 1 per user/i)).toBeInTheDocument();
    expect(screen.getByText(/Rate limiting enabled/i)).toBeInTheDocument();
  });
});
