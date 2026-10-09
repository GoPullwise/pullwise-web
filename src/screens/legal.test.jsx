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

    expect(screen.getByText("2026-10-09")).toBeInTheDocument();
  });

  it("keeps billing terms aligned with implemented renewal controls", () => {
    render(<TermsScreen go={vi.fn()} />);

    expect(screen.getByText(/cancel renewal for an active subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/resume renewal from Pullwise Billing/i)).toBeInTheDocument();
    expect(screen.getByText(
      "Pullwise platform subscriptions are billed through Creem. Subscription charges and payment history are separate from expenses you record in your ledger. Review the displayed price, tax and renewal terms before purchase."
    )).toBeInTheDocument();
    expect(screen.getByText(
      "You can cancel renewal for an active subscription from Pullwise Billing. It ends at the current paid period. You can resume renewal from Pullwise Billing before that date. Upgrades update your plan after payment confirmation; Creem calculates any proration. Lower-tier changes or yearly-to-monthly changes are unavailable in the product."
    )).toBeInTheDocument();
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

  it("discloses Pro and Max model processing during ordinary saving and preserves user control", () => {
    const { unmount } = render(<PrivacyScreen go={vi.fn()} />);
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent("submitted purpose and note");
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent("allowed active category IDs and names");
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent("Pullwise checks possible duplicates in its own service");
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent(
      "Repository code and stored GitHub and API key tokens are excluded"
    );
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent(
      "Do not enter secrets in purpose, notes or category names"
    );
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent(
      "saved purpose and note of expenses you explicitly select and start reviewing"
    );
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent(
      "Jev returns only predefined choices and confidence scores"
    );
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent(
      "the interface displays the checks using fixed wording"
    );
    expect(screen.getByText(/Pro and Max automatically use Jev/i)).toHaveTextContent(
      "text from other candidate historical expenses is not sent to the model"
    );
    expect(document.body.textContent).not.toContain("bounded authorized expense context");
    expect(screen.queryByText(/Optional Jev suggestions/i)).not.toBeInTheDocument();
    unmount();
    render(<TermsScreen go={vi.fn()} />);
    const control = screen.getByText(/Automatic Jev assistance on Pro and Max runs/i);
    expect(control).toHaveTextContent("expense write");
    expect(control).toHaveTextContent("You can separately start checks of saved expenses");
    expect(control).toHaveTextContent("predefined choices and any returned confidence scores");
    expect(control).toHaveTextContent("fixed interface wording");
    expect(control).toHaveTextContent("Review results do not change records");
    expect(control).toHaveTextContent("you must confirm corrections through Edit");
  });

  it("explains email registration and optional GitHub integration in both policies", () => {
    const { unmount } = render(<PrivacyScreen go={vi.fn()} />);
    expect(screen.getByText(/Pullwise provides project and shared expense tracking/i)).toHaveTextContent(
      "first successful email verification creates an account automatically"
    );
    expect(screen.getByText(/Pullwise provides project and shared expense tracking/i))
      .toHaveTextContent("GitHub sign-in and repository integration are optional");
    expect(document.body.textContent).not.toContain("GitHub-connected project expense ledger");
    unmount();

    render(<TermsScreen go={vi.fn()} />);
    expect(screen.getByText(/Projects can be created without linking/i)).toHaveTextContent(
      "Reports keep currencies separate"
    );
    const account = screen.getByText(/Shared-ledger access depends/i);
    expect(account).toHaveTextContent("current membership and role");
    expect(account).toHaveTextContent("new invitation links grant access only after the original inviter approves");
    expect(account).toHaveTextContent("Legacy targeted invitations still check the intended GitHub identity");
    expect(account).toHaveTextContent("matching a GitHub profile email never merges accounts");
  });

  it("discloses ledger-wide sharing without implying billing or GitHub credential sharing", () => {
    render(<PrivacyScreen go={vi.fn()} />);
    const sharing = screen.getByText(/Opening an invitation link or submitting a join request/i);
    expect(sharing).toHaveTextContent(
      "all existing and future projects, categories, expenses, reports and CSV exports"
    );
    expect(sharing).toHaveTextContent("An invitation is not limited to one project");
    expect(sharing).toHaveTextContent("personal billing or other ledgers");
    expect(sharing).toHaveTextContent("cannot recall copies already exported");
    expect(sharing).toHaveTextContent("does not grant ledger access");
    expect(sharing).toHaveTextContent("including email-only accounts");
    expect(sharing).toHaveTextContent("Only the original inviter");
    expect(sharing).toHaveTextContent("while their original permissions remain valid");
  });

  it("identifies infrastructure, model provider and functional browser storage", () => {
    render(<PrivacyScreen go={vi.fn()} />);
    expect(screen.getByText(/Cloudflare hosts/i)).toHaveTextContent("TypeSafe processes Jev");
    expect(screen.getByText(/The interface loads fonts from Google Fonts/i)).toHaveTextContent(
      "Your browser sends font requests directly to Google"
    );
    expect(screen.getByText(/Optional GitHub data:/i)).toHaveTextContent(
      "encrypted GitHub access tokens"
    );
    expect(screen.getByRole("link", { name: "Cookies and browser storage" })).toHaveAttribute(
      "href", "#storage"
    );
    const storage = screen.getByText(/HttpOnly session cookie/i);
    expect(storage).toHaveTextContent("local storage remembers your language and theme");
    expect(storage).toHaveTextContent("session storage records a pending GitHub access refresh");
    expect(storage).toHaveTextContent("short-lived verification cookie");
  });

  it("discloses short-lived HMAC email codes, explicit linking and delivery processing", () => {
    render(<PrivacyScreen go={vi.fn()} />);
    const identity = screen.getByText(/Account and sign-in data:/i);
    expect(identity).toHaveTextContent("Codes expire after 10 minutes");
    expect(identity).toHaveTextContent("stored as keyed HMAC digests");
    expect(identity).toHaveTextContent("does not collect or store a sign-in password");
    const linking = screen.getByText(/Adding an email sign-in method to an existing account/i);
    expect(linking).toHaveTextContent("explicit verification while signed in");
    expect(linking).toHaveTextContent("never causes automatic account linking or merging");
    expect(screen.getByText(/Cloudflare hosts/i)).toHaveTextContent(
      "delivers verification emails using your email address and one-time code"
    );
  });

  it("describes soft removal without promising immediate account or history erasure", () => {
    render(<PrivacyScreen go={vi.fn()} />);
    const retention = screen.getByText(/Signing out, revoking GitHub access/i);
    expect(retention).toHaveTextContent("does not erase ledger history");
    expect(retention).toHaveTextContent("stored records and audit history remain");
    expect(retention).toHaveTextContent("do not promise immediate permanent erasure");
    expect(screen.getByText(/to request access, export, correction or deletion/i)).toHaveTextContent(
      "applicable law and other ledger members' rights"
    );
  });

  it("states the authorized non-refund policy while retaining cancellation and mandatory legal rights", () => {
    render(<TermsScreen go={vi.fn()} />);
    const fees = screen.getByText(/Paid subscription fees are non-refundable/i);
    expect(fees).toHaveTextContent("except where required by applicable law");
    expect(fees).toHaveTextContent("Cancelling renewal does not refund the current paid period");
    expect(fees).toHaveTextContent("paid access continues until that period ends");
    expect(screen.queryByRole("link", { name: "Refund requests" })).not.toBeInTheDocument();
    expect(screen.queryByText(/For billing errors or refund requests/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/guaranteed refund|\d+-day refund/i);
  });
});
