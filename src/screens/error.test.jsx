import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("exposes signed-out recovery suggestions as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<NotFoundScreen go={go} requested="missing" auth={{ authenticated: false }} />);

    const home = screen.getByRole("link", { name: /^home/i });
    const signIn = screen.getByRole("link", { name: /^sign in/i });
    const status = screen.getByRole("link", { name: /^status/i });

    expect(home).toHaveAttribute("href", "/");
    expect(signIn).toHaveAttribute("href", "/login");
    expect(status).toHaveAttribute("href", "/status");

    await user.click(status);

    expect(go).toHaveBeenCalledWith("status");
  });

  it("exposes signed-in recovery suggestions as real screen links", () => {
    render(<NotFoundScreen go={vi.fn()} requested="missing" auth={{ authenticated: true }} />);

    expect(screen.getByRole("link", { name: /^dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: /^issues/i })).toHaveAttribute(
      "href",
      "/issues"
    );
  });

  it("exposes support email as a real mail link", () => {
    render(<NotFoundScreen go={vi.fn()} requested="missing" auth={{ authenticated: false }} />);

    expect(screen.getByRole("link", { name: /contact@pull-wise\.com/i })).toHaveAttribute(
      "href",
      "mailto:contact@pull-wise.com"
    );
  });
});
