import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LandingScreen, LoginScreen, OAuthScreen } from "./public.jsx";
import { pullwiseApi } from "../api/pullwise.js";
import { startGitHubLogin } from "../lib/auth.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: { auth: { requestEmailCode: vi.fn(), verifyEmailCode: vi.fn() } },
}));
vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
  signOut: vi.fn(),
  startGitHubLogin: vi.fn(),
}));

describe("public navigation links", () => {
  it("exposes landing header actions as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<LandingScreen go={go} auth={{ authenticated: false }} />);

    const headerNav = screen.getByRole("navigation");
    const product = within(headerNav).getByRole("link", { name: /^product$/i });
    const pricing = within(headerNav).getByRole("link", { name: /^pricing$/i });
    const docs = within(headerNav).getByRole("link", { name: /^docs$/i });
    const api = within(headerNav).getByRole("link", { name: /^api$/i });
    expect(within(headerNav).queryByRole("link", { name: /^security$/i })).not.toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: /^sign in$/i });
    const getStarted = screen.getByRole("link", { name: /^get started$/i });
    const primaryActions = screen.getAllByRole("link", { name: /start with email/i });

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
    render(<LandingScreen go={vi.fn()} auth={{ authenticated: true }} />);

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: /^sign out$/i })).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: /^projects$/i })).toHaveAttribute(
      "href",
      "/projects"
    );
  });

  it("describes the project expense ledger", () => {
    render(<LandingScreen go={vi.fn()} auth={{ authenticated: false }} />);

    const pipeline = screen.getByRole("region", { name: /how pullwise organizes costs/i });
    expect(within(pipeline).getAllByRole("article")).toHaveLength(6);
    expect(
      screen.getByRole("heading", { name: /track project and shared expenses/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Record project expenses")).toBeInTheDocument();
    expect(screen.getByText("Record shared expenses")).toBeInTheDocument();
    expect(screen.getByText("Review category reports")).toBeInTheDocument();
    expect(
      screen.getByText(/every expense stays with its project or the shared pool/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/full-repository|start scans|fix-ready|review high-risk/i)
    ).not.toBeInTheDocument();
  });

  it("explains project creation with optional repository links", () => {
    render(<LoginScreen go={vi.fn()} />);
    expect(screen.getByText(/repository links are optional/i)).toBeInTheDocument();
    expect(screen.getByText(/create a project and record your first expense/i)).toBeInTheDocument();
    expect(screen.queryByText(/start a scan/i)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeInTheDocument();
  });

  it("locks GitHub and internal navigation while sending an email code, then recovers on failure", async () => {
    let reject;
    const request = new Promise((_, no) => {
      reject = no;
    });
    pullwiseApi.auth.requestEmailCode.mockReturnValueOnce(request);
    const go = vi.fn();
    render(<LoginScreen go={go} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    const github = screen.getByRole("button", { name: "Continue with GitHub" });
    expect(github).toBeDisabled();
    const terms = screen.getByRole("link", { name: "Terms of Service" });
    expect(terms).not.toHaveAttribute("href");
    fireEvent.click(terms, { ctrlKey: true });
    fireEvent.click(github);
    expect(go).not.toHaveBeenCalled();
    expect(startGitHubLogin).not.toHaveBeenCalled();
    await act(async () => reject(new Error("Mail unavailable")));
    expect(screen.getByRole("alert")).toHaveTextContent("Mail unavailable");
    expect(github).toBeEnabled();
    expect(terms).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("new@example.com");
  });

  it("blocks email requests while GitHub is pending and restores them after an authorization error", async () => {
    let reject;
    startGitHubLogin.mockReturnValueOnce(
      new Promise((_, no) => {
        reject = no;
      })
    );
    render(<LoginScreen go={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    expect(screen.getByRole("textbox", { name: "Email" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();
    await act(async () => reject(new Error("GitHub unavailable")));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Email" })).toBeEnabled());
  });

  it("keeps the public-page frame on one shared horizontal baseline", () => {
    const styles = readFileSync("src/app.css", "utf8");

    expect(styles).toMatch(/\.lp-top\s*{[^}]*max-width:\s*1240px;/s);
    expect(styles).toMatch(/\.lp-hero\s*{[^}]*max-width:\s*1240px;/s);
    expect(styles).toMatch(/\.lp-preview\s*{[^}]*max-width:\s*1240px;/s);
    expect(styles).toMatch(
      /\.lp-foot\s*{[^}]*max-width:\s*1240px;[^}]*padding:\s*28px 40px calc\(88px \+ env\(safe-area-inset-bottom\)\);/s
    );
    expect(styles).toMatch(
      /\.pricing-hero,\s*\.pricing-tiers,\s*\.pricing-faq,\s*\.docs-shell,\s*\.legal-shell,\s*\.status-hero,\s*\.status-section\s*{[^}]*max-width:\s*1240px;/s
    );
    expect(styles).toMatch(
      /\.pricing-hero,\s*\.pricing-tiers,\s*\.pricing-faq,\s*\.docs-shell,\s*\.legal-shell,\s*\.status-hero,\s*\.status-section\s*{[^}]*padding-left:\s*40px;[^}]*padding-right:\s*40px;/s
    );
    expect(styles).toMatch(/\.legal-main\s*{[^}]*max-width:\s*none;/s);
  });
  it("opens landing footer legal pages from real links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<LandingScreen go={go} auth={{ authenticated: false }} />);

    const privacy = screen.getByRole("link", { name: /^privacy$/i });
    expect(privacy).toHaveAttribute("href", "/privacy");
    expect(screen.queryByRole("link", { name: /^security$/i })).not.toBeInTheDocument();

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

    expect(screen.getByRole("link", { name: /^back$/i })).toHaveAttribute("href", "/projects");
  });
});
