import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./public.jsx";

describe("landing positioning", () => {
  it("explains the product, outcome, and next step without internal implementation jargon", () => {
    render(<LandingScreen go={vi.fn()} auth={{ authenticated: false }} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /follow pull requests, ci failures, and upstream updates.*keep the next action clear/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/source facts, saved evidence, and your team's handling history/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see pricing/i })).toHaveAttribute("href", "/pricing");

    const pipeline = screen.getByRole("region", {
      name: /how pullwise keeps work in view/i,
    });
    expect(within(pipeline).getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText("Connect authorized repositories")).toBeInTheDocument();
    expect(screen.getByText("Track pull request actions")).toBeInTheDocument();
    expect(screen.getByText("Investigate CI failures")).toBeInTheDocument();
    expect(screen.getByText("Watch upstream releases")).toBeInTheDocument();
    expect(screen.getByText("Inspect saved evidence")).toBeInTheDocument();
    expect(screen.getByText("Record team handling")).toBeInTheDocument();
  });
});
