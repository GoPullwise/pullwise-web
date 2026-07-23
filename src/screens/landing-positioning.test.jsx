import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./public.jsx";

describe("landing positioning", () => {
  it("explains the product, outcome, and next step without internal implementation jargon", () => {
    render(<LandingScreen go={vi.fn()} accent="#6366f1" auth={{ authenticated: false }} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /find repository-wide risks.*ship fixes with evidence/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/ai code review platform for engineering teams/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see pricing/i })).toHaveAttribute("href", "/pricing");

    const pipeline = screen.getByRole("region", {
      name: /how pullwise reviews a repository/i,
    });
    expect(within(pipeline).getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText("Map the whole repository")).toBeInTheDocument();
    expect(screen.getByText("Review high-risk code paths")).toBeInTheDocument();
    expect(screen.getByText("Run in isolated workers")).toBeInTheDocument();
    expect(screen.getByText("Verify before reporting")).toBeInTheDocument();
    expect(screen.getByText("Deliver fix-ready evidence")).toBeInTheDocument();
    expect(screen.getByText("Automate through the API")).toBeInTheDocument();
  });
});
