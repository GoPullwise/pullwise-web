import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LandingScreen, LoginScreen, OAuthScreen } from "./public.jsx";

describe("public navigation links", () => {
  it("exposes landing header actions as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<LandingScreen go={go} accent="#6366f1" auth={{ authenticated: false }} />);

    const headerNav = screen.getByRole("navigation");
    const product = within(headerNav).getByRole("link", { name: /^product$/i });
    const pricing = within(headerNav).getByRole("link", { name: /^pricing$/i });
    const api = within(headerNav).getByRole("link", { name: /^api$/i });
    const signIn = screen.getByRole("link", { name: /^sign in$/i });
    const getStarted = screen.getByRole("link", { name: /^get started$/i });
    const primaryActions = screen.getAllByRole("link", { name: /sign in with github/i });

    expect(product).toHaveAttribute("href", expect.stringContaining("screen=landing"));
    expect(pricing).toHaveAttribute("href", expect.stringContaining("screen=pricing"));
    expect(api).toHaveAttribute("href", expect.stringContaining("screen=api"));
    expect(signIn).toHaveAttribute("href", expect.stringContaining("screen=login"));
    expect(getStarted).toHaveAttribute("href", expect.stringContaining("screen=login"));
    expect(primaryActions).toHaveLength(2);
    for (const action of primaryActions) {
      expect(action).toHaveAttribute("href", expect.stringContaining("screen=login"));
    }

    await user.click(getStarted);
    await user.click(pricing);
    await user.click(api);

    expect(go).toHaveBeenCalledWith("login");
    expect(go).toHaveBeenCalledWith("pricing");
    expect(go).toHaveBeenCalledWith("api");
  });

  it("exposes signed-in landing header actions as real screen links", () => {
    render(<LandingScreen go={vi.fn()} accent="#6366f1" auth={{ authenticated: true }} />);

    expect(screen.getByRole("link", { name: /^settings$/i })).toHaveAttribute(
      "href",
      expect.stringContaining("screen=settings")
    );
    expect(screen.getByRole("link", { name: /^dashboard$/i })).toHaveAttribute(
      "href",
      expect.stringContaining("screen=dashboard")
    );
    const dashboardActions = screen.getAllByRole("link", { name: /open dashboard/i });
    expect(dashboardActions).toHaveLength(2);
    for (const action of dashboardActions) {
      expect(action).toHaveAttribute("href", expect.stringContaining("screen=dashboard"));
    }
  });

  it("opens landing footer legal pages from real links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<LandingScreen go={go} accent="#6366f1" auth={{ authenticated: false }} />);

    const privacy = screen.getByRole("link", { name: /^privacy$/i });
    expect(privacy).toHaveAttribute("href", expect.stringContaining("screen=privacy"));

    privacy.focus();
    await user.keyboard("{Enter}");

    expect(go).toHaveBeenCalledWith("privacy");
  });

  it("opens login legal policy links from real links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<LoginScreen go={go} />);

    const terms = screen.getByRole("link", { name: /terms of service/i });
    const privacy = screen.getByRole("link", { name: /privacy policy/i });
    expect(terms).toHaveAttribute("href", expect.stringContaining("screen=terms"));
    expect(privacy).toHaveAttribute("href", expect.stringContaining("screen=privacy"));

    await user.click(terms);

    expect(go).toHaveBeenCalledWith("terms");
  });

  it("exposes repository authorization back navigation as a real link when signed out", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<OAuthScreen go={go} auth={{ authenticated: false }} />);

    const back = screen.getByRole("link", { name: /^back$/i });
    expect(back).toHaveAttribute("href", expect.stringContaining("screen=login"));

    await user.click(back);

    expect(go).toHaveBeenCalledWith("login");
  });

  it("exposes repository authorization back navigation as a real link when signed in", () => {
    render(<OAuthScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(screen.getByRole("link", { name: /^back$/i })).toHaveAttribute(
      "href",
      expect.stringContaining("screen=repos")
    );
  });
});
