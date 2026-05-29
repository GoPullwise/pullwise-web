import { render, screen, within } from "@testing-library/react";
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

    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^sign in$/i })).not.toBeInTheDocument();
  });

  it("exposes legal chrome navigation as keyboard-accessible links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<SecurityScreen go={go} />);

    const home = screen.getByRole("link", { name: /go to pullwise home/i });
    const chromeNav = within(screen.getByRole("navigation"));
    const product = chromeNav.getByRole("link", { name: /^product$/i });
    const security = chromeNav.getByRole("link", { name: /^security$/i });
    const status = chromeNav.getByRole("link", { name: /^status$/i });
    const signIn = screen.getByRole("link", { name: /^sign in$/i });
    const getStarted = screen.getByRole("link", { name: /^get started$/i });
    const privacy = screen.getByRole("link", { name: /^privacy$/i });

    expect(home).toHaveAttribute("href", "/");
    expect(product).toHaveAttribute("href", "/");
    expect(security).toHaveAttribute("href", "/security");
    expect(status).toHaveAttribute("href", "/status");
    expect(signIn).toHaveAttribute("href", "/login");
    expect(getStarted).toHaveAttribute("href", "/login");
    expect(privacy).toHaveAttribute("href", "/privacy");

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
    expect(breadcrumbHome).toHaveAttribute("href", "/");

    await user.click(breadcrumbHome);

    expect(go).toHaveBeenCalledWith("landing");
  });

  it("exposes the security report address as a real mail link", () => {
    render(<SecurityScreen go={vi.fn()} />);

    expect(screen.getByRole("link", { name: /security@pull-wise\.com/i })).toHaveAttribute(
      "href",
      "mailto:security@pull-wise.com"
    );
  });
});
