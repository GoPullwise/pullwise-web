import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivacyScreen, SecurityScreen } from "./legal.jsx";

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

  it("exposes legal chrome navigation as keyboard-accessible links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<SecurityScreen go={go} />);

    const home = screen.getByRole("link", { name: /go to pullwise home/i });
    const privacy = screen.getByRole("link", { name: /^privacy$/i });

    expect(home).toHaveAttribute("href", expect.stringContaining("screen=landing"));
    expect(privacy).toHaveAttribute("href", expect.stringContaining("screen=privacy"));

    home.focus();
    await user.keyboard("{Enter}");
    await user.click(privacy);

    expect(go).toHaveBeenCalledWith("landing");
    expect(go).toHaveBeenCalledWith("privacy");
  });

  it("exposes legal document breadcrumb home as a link", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<PrivacyScreen go={go} />);

    const breadcrumbHome = screen.getByRole("link", { name: /^pullwise$/i });
    expect(breadcrumbHome).toHaveAttribute("href", expect.stringContaining("screen=landing"));

    await user.click(breadcrumbHome);

    expect(go).toHaveBeenCalledWith("landing");
  });
});
