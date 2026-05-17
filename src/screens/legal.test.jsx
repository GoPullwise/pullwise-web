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
});
