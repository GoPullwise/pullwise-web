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
});
