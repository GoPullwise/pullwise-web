import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PrivacyScreen, TermsScreen } from "./legal.jsx";

describe("legal pages", () => {
  it("exposes legal chrome navigation as keyboard-accessible links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<PrivacyScreen go={go} />);

    const home = screen.getByRole("link", { name: /go to pullwise home/i });
    const chromeNav = within(screen.getByRole("navigation"));
    const product = chromeNav.getByRole("link", { name: /^product$/i });
    const status = chromeNav.getByRole("link", { name: /^status$/i });
    const signIn = screen.getByRole("link", { name: /^sign in$/i });
    const getStarted = screen.getByRole("link", { name: /^get started$/i });
    const privacy = screen.getByRole("link", { name: /^privacy$/i });

    expect(home).toHaveAttribute("href", "/");
    expect(product).toHaveAttribute("href", "/");
    expect(chromeNav.queryByRole("link", { name: /^security$/i })).not.toBeInTheDocument();
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

  it("shows the current legal document update date", () => {
    render(<PrivacyScreen go={vi.fn()} />);

    expect(screen.getByText("2026-10-02")).toBeInTheDocument();
  });

  it("keeps billing terms aligned with implemented renewal controls", () => {
    render(<TermsScreen go={vi.fn()} />);

    expect(screen.getByText(/cancel renewal for an active subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/resume renewal from Pullwise Billing/i)).toBeInTheDocument();
    expect(screen.getByText(/Upgrades update your plan after payment confirmation/i)).toBeInTheDocument();
    expect(
      screen.getByText(/lower-tier changes or yearly-to-monthly changes/i)
    ).toBeInTheDocument();
  });

  it("describes the ledger and separate platform billing", () => {
    const { unmount } = render(<PrivacyScreen go={vi.fn()} />);
    expect(screen.getByText(/handles account, GitHub, expense ledger/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/repository preflight|scan records|fix previews|generated reports/i);
    unmount();

    render(<TermsScreen go={vi.fn()} />);
    expect(screen.getAllByText(/platform subscription/i)[0]).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/queue and cancel scans|deterministic fixes|public scan creation|scans:write/i);
  });

  it("discloses Max model processing during ordinary saving and preserves user control", () => {
    const { unmount } = render(<PrivacyScreen go={vi.fn()} />);
    expect(screen.getByText(/Max automatically uses Jev/i)).toHaveTextContent("submitted purpose and note");
    expect(screen.getByText(/Max automatically uses Jev/i)).toHaveTextContent("allowed category names");
    expect(screen.getByText(/Max automatically uses Jev/i)).toHaveTextContent("Pullwise checks possible duplicates in its own service");
    expect(screen.getByText(/Max automatically uses Jev/i)).toHaveTextContent("Repository code is not sent");
    expect(document.body.textContent).not.toContain("bounded authorized expense context");
    expect(screen.queryByText(/Optional Jev suggestions/i)).not.toBeInTheDocument();
    unmount();
    render(<TermsScreen go={vi.fn()} />);
    expect(screen.getByText(/Automatic Max assistance runs/i)).toHaveTextContent("expense write");
  });

});
