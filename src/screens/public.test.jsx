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
    const docs = within(headerNav).getByRole("link", { name: /^docs$/i });
    const api = within(headerNav).getByRole("link", { name: /^api$/i });
    const signIn = screen.getByRole("link", { name: /^sign in$/i });
    const getStarted = screen.getByRole("link", { name: /^get started$/i });
    const primaryActions = screen.getAllByRole("link", { name: /sign in with github/i });

    expect(product).toHaveAttribute("href", "/");
    expect(pricing).toHaveAttribute("href", "/pricing");
    expect(docs).toHaveAttribute("href", "/developers/docs");
    expect(api).toHaveAttribute("href", "/developers/api");
    expect(signIn).toHaveAttribute("href", "/login");
    expect(getStarted).toHaveAttribute("href", "/login");
    expect(primaryActions).toHaveLength(2);
    for (const action of primaryActions) {
      expect(action).toHaveAttribute("href", "/login");
    }

    await user.click(getStarted);
    await user.click(pricing);
    await user.click(docs);
    await user.click(api);

    expect(go).toHaveBeenCalledWith("login");
    expect(go).toHaveBeenCalledWith("pricing");
    expect(go).toHaveBeenCalledWith("docs");
    expect(go).toHaveBeenCalledWith("api");
  });

  it("exposes signed-in landing header actions as real screen links", () => {
    render(<LandingScreen go={vi.fn()} accent="#6366f1" auth={{ authenticated: true }} />);

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: /^sign out$/i })).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: /^dashboard$/i })).toHaveAttribute(
      "href",
      "/dashboard/overview"
    );
  });

  it("summarizes implemented product capabilities on the landing page", () => {
    render(<LandingScreen go={vi.fn()} accent="#6366f1" auth={{ authenticated: false }} />);

    expect(screen.getByText("Graph-verified code review")).toBeInTheDocument();
    expect(screen.getByText("CodeGraph slice planning")).toBeInTheDocument();
    expect(screen.getByText("Parallel finder agents")).toBeInTheDocument();
    expect(screen.getByText("Isolated repro workers")).toBeInTheDocument();
    expect(screen.getByText("Judge validation gate")).toBeInTheDocument();
    expect(screen.getAllByText("Confirmed-only reports").length).toBeGreaterThan(0);
    expect(screen.getByText("Automation-ready API")).toBeInTheDocument();
    expect(
      screen.getByText(/only reproduced, graph-linked findings reach the final report/i)
    ).toBeInTheDocument();
  });

  it("opens landing footer legal pages from real links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<LandingScreen go={go} accent="#6366f1" auth={{ authenticated: false }} />);

    const privacy = screen.getByRole("link", { name: /^privacy$/i });
    expect(privacy).toHaveAttribute("href", "/privacy");

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
    expect(terms).toHaveAttribute("href", "/terms");
    expect(privacy).toHaveAttribute("href", "/privacy");

    await user.click(terms);

    expect(go).toHaveBeenCalledWith("terms");
  });

  it("exposes repository authorization back navigation as a real link when signed out", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<OAuthScreen go={go} auth={{ authenticated: false }} />);

    const back = screen.getByRole("link", { name: /^back$/i });
    expect(back).toHaveAttribute("href", "/login");

    await user.click(back);

    expect(go).toHaveBeenCalledWith("login");
  });

  it("exposes repository authorization back navigation as a real link when signed in", () => {
    render(<OAuthScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(screen.getByRole("link", { name: /^back$/i })).toHaveAttribute("href", "/repos");
  });
});
