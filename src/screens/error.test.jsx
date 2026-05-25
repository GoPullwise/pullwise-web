import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotFoundScreen } from "./error.jsx";

describe("NotFoundScreen", () => {
  it("suggests login instead of private workspace pages when signed out", () => {
    render(<NotFoundScreen go={vi.fn()} requested="missing" auth={{ authenticated: false }} />);

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Issues")).not.toBeInTheDocument();
  });

  it("suggests private workspace pages when signed in", () => {
    render(<NotFoundScreen go={vi.fn()} requested="missing" auth={{ authenticated: true }} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
  });

  it("exposes support email as a real mail link", () => {
    render(<NotFoundScreen go={vi.fn()} requested="missing" auth={{ authenticated: false }} />);

    expect(screen.getByRole("link", { name: /support@pullwise\.dev/i })).toHaveAttribute(
      "href",
      "mailto:support@pullwise.dev"
    );
  });
});
