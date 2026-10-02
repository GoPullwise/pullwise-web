import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocsScreen } from "./docs.jsx";

describe("product Docs", () => {
  it("explains project and shared expense workflows", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: false }} />);

    expect(screen.getByRole("heading", { name: /GitHub project expense ledger/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /connect a repository/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /record expenses/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /review reports/i })).toBeInTheDocument();
    expect(screen.getByText(/shared pool is counted once/i)).toBeInTheDocument();
    expect(screen.queryByText(/monthly account scans|scan limits|review agents/i)).not.toBeInTheDocument();
  });

  it("links to the current product configuration and API contract", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(screen.getByRole("link", { name: /open projects/i })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: /API contract/i })).toHaveAttribute("href", "/developers/api");
  });

  it("explains automatic Max assistance as part of ordinary expense entry and REST writes", () => {
    render(<DocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByRole("heading", { name: "Automatic Max assistance" })).toBeInTheDocument();
    expect(screen.getByText(/Jev automatically assists when you save an expense/i)).toHaveTextContent("REST API");
    expect(screen.getByText(/leave the category blank/i)).toBeInTheDocument();
  });
});
