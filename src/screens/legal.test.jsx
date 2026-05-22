import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SecurityScreen } from "./legal.jsx";

describe("legal pages", () => {
  it("does not claim third-party security certifications that are not backed by the product", () => {
    render(<SecurityScreen go={vi.fn()} />);

    expect(screen.queryByText(/SOC 2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ISO 27001/i)).not.toBeInTheDocument();
    expect(screen.getByText(/GitHub App permissions/i)).toBeInTheDocument();
  });

  it("shows dashboard actions instead of sign-in actions for signed-in users", () => {
    render(<SecurityScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^sign in$/i })).not.toBeInTheDocument();
  });
});
