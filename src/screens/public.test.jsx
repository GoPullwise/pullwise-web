import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingScreen, LoginScreen, OAuthScreen } from "./public.jsx";
import { pullwiseApi } from "../api/pullwise.js";
import { connectGitHubRepositories, startGitHubLogin } from "../lib/auth.js";
import { NotificationProvider } from "../components/notifications.jsx";
import { setLang } from "../i18n.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: { auth: { requestEmailCode: vi.fn(), verifyEmailCode: vi.fn() } },
}));
vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
  signOut: vi.fn(),
  startGitHubLogin: vi.fn(),
}));

const authorizationGuidance =
  "On GitHub, finish saving, then close the window or return to Pullwise. Repository access will be checked again.";
const closedNotice = "GitHub window closed. Current repository access has been refreshed.";
const noAccessNotice = "No repository access was found. Finish saving on GitHub and reconnect.";
const reconnectError = "Reconnect your GitHub account before checking repository access.";
const closedWithAccess = {
  status: "closed_unverified",
  repositories: {
    githubAccess: "authorized",
    needsAuthorization: false,
    items: [{ githubRepoId: "1", fullName: "team-a/service", installationId: "101" }],
  },
};
const closedWithoutAccess = {
  status: "closed_unverified",
  repositories: { githubAccess: "not_linked", needsAuthorization: true, items: [] },
};
const signedIn = { authenticated: true, session: { user: { id: "account-a" } } };

describe("repository authorization outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectGitHubRepositories.mockResolvedValue(undefined);
  });

  it.each([
    [closedWithAccess, closedNotice],
    [closedWithoutAccess, noAccessNotice],
    [
      { ...closedWithAccess, repositories: { ...closedWithAccess.repositories, items: [] } },
      noAccessNotice,
    ],
  ])("keeps a closed window outcome inline without navigating", async (outcome, message) => {
    connectGitHubRepositories.mockResolvedValueOnce(outcome);
    const go = vi.fn();
    render(
      <NotificationProvider>
        <OAuthScreen go={go} auth={signedIn} />
      </NotificationProvider>
    );
    expect(screen.getByText(authorizationGuidance)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub repositories" }));
    expect(await screen.findByRole("status")).toHaveTextContent(message);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/cancelled|confirmed|successfully/i)).not.toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Connect GitHub repositories" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/projects");
  });

  it("clears a closed-window notice on the next attempt and preserves provider errors", async () => {
    connectGitHubRepositories
      .mockResolvedValueOnce(closedWithAccess)
      .mockRejectedValueOnce(Object.assign(new Error("GitHub denied access"), { status: 503 }));
    const go = vi.fn();
    render(
      <NotificationProvider>
        <OAuthScreen go={go} auth={signedIn} />
      </NotificationProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub repositories" }));
    expect(await screen.findByRole("status")).toHaveTextContent(closedNotice);
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub repositories" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pullwise could not verify repository access. Please try again later."
    );
    expect(screen.queryByText(closedNotice)).not.toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Connect GitHub repositories" })).toBeEnabled();
  });

  it("navigates after a verified callback completes", async () => {
    const go = vi.fn();
    render(<OAuthScreen go={go} auth={signedIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub repositories" }));
    await waitFor(() => expect(go).toHaveBeenCalledExactlyOnceWith("ledgerProjects"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["unmount", "identity change"])(
    "aborts and ignores an obsolete authorization after %s",
    async (transition) => {
      let finish;
      connectGitHubRepositories.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
      const go = vi.fn();
      const view = render(<OAuthScreen go={go} auth={signedIn} />);
      fireEvent.click(screen.getByRole("button", { name: "Connect GitHub repositories" }));
      const signal = connectGitHubRepositories.mock.calls[0][0].signal;
      if (transition === "unmount") view.unmount();
      else
        view.rerender(
          <OAuthScreen go={go} auth={{ ...signedIn, session: { user: { id: "account-b" } } }} />
        );
      expect(signal.aborted).toBe(true);
      await act(async () => finish(closedWithAccess));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(go).not.toHaveBeenCalled();
      if (transition === "identity change")
        expect(screen.getByRole("button", { name: "Connect GitHub repositories" })).toBeEnabled();
    }
  );

  it("clears a completed closure notice when the account changes", async () => {
    connectGitHubRepositories.mockResolvedValueOnce(closedWithAccess);
    const view = render(<OAuthScreen go={vi.fn()} auth={signedIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub repositories" }));
    await screen.findByRole("status");
    view.rerender(<OAuthScreen go={vi.fn()} auth={{ authenticated: false }} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["zh", "ja", "ko", "fr", "es"])(
    "renders the shared authorization guidance and both closure notices in %s",
    async (language) => {
      const { PHRASES } = await import(`../locales/${language}.js`);
      try {
        await act(async () => setLang(language));
        connectGitHubRepositories
          .mockResolvedValueOnce(closedWithAccess)
          .mockResolvedValueOnce(closedWithoutAccess)
          .mockRejectedValueOnce(
            Object.assign(new Error("GitHub token expired"), {
              code: "GITHUB_REAUTHORIZATION_REQUIRED",
            })
          );
        render(
          <NotificationProvider>
            <OAuthScreen go={vi.fn()} auth={signedIn} />
          </NotificationProvider>
        );
        for (const phrase of [
          authorizationGuidance,
          closedNotice,
          noAccessNotice,
          reconnectError,
        ]) {
          expect(PHRASES[phrase]).toBeTruthy();
          expect(PHRASES[phrase]).not.toBe(phrase);
        }
        expect(PHRASES["GitHub installation was cancelled. Please try again."]).toBeUndefined();
        expect(screen.getByText(PHRASES[authorizationGuidance])).toBeVisible();
        const connect = screen.getByRole("button", {
          name: PHRASES["Connect GitHub repositories"],
        });
        fireEvent.click(connect);
        expect(await screen.findByRole("status")).toHaveTextContent(PHRASES[closedNotice]);
        fireEvent.click(connect);
        await waitFor(() =>
          expect(screen.getByRole("status")).toHaveTextContent(PHRASES[noAccessNotice])
        );
        fireEvent.click(connect);
        expect(await screen.findByRole("alert")).toHaveTextContent(PHRASES[reconnectError]);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
      } finally {
        await act(async () => setLang("en"));
      }
    }
  );
});

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
