import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocsScreen } from "./docs.jsx";

describe("product Docs", () => {
  it("explains PR, CI, Updates and saved evidence without exposing scan configuration", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: false }} />);

    expect(screen.getByRole("heading", { name: /configure PR, CI, and Updates/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pull request actions/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /CI failures/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /upstream updates/i })).toBeInTheDocument();
    expect(screen.getByText(/browser reads do not start intelligent processing/i)).toBeInTheDocument();
    expect(screen.queryByText(/monthly account scans|scan limits|review agents/i)).not.toBeInTheDocument();
  });

  it("links to the current product configuration and API contract", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(screen.getByRole("link", { name: /configure services/i })).toHaveAttribute("href", "/services");
    expect(screen.getByRole("link", { name: /API contract/i })).toHaveAttribute("href", "/developers/api");
  });
});
