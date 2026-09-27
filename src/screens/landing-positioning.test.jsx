import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./public.jsx";

describe("landing positioning", () => {
  it("explains the product, outcome, and next step without internal implementation jargon", () => {
    render(<LandingScreen go={vi.fn()} auth={{ authenticated: false }} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /track project and shared expenses.*keep every cost in view/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/record project and shared costs/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see pricing/i })).toHaveAttribute("href", "/pricing");

    const pipeline = screen.getByRole("region", {
      name: /how pullwise organizes costs/i,
    });
    expect(within(pipeline).getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText("Connect authorized repositories")).toBeInTheDocument();
    expect(screen.getByText("Record project expenses")).toBeInTheDocument();
    expect(screen.getByText("Record shared expenses")).toBeInTheDocument();
    expect(screen.getByText("Review category reports")).toBeInTheDocument();
    expect(screen.getByText("Compare currencies separately")).toBeInTheDocument();
    expect(screen.getByText("Control API access")).toBeInTheDocument();
  });
});
