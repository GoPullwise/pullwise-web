import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceContext } from "./components/workspace-context.jsx";
import { Sidebar, Topbar, ViewTabs } from "./shell.jsx";

describe("Topbar navigation", () => {
  it.each(["admin", "editor", "viewer"])(
    "distinguishes your ledger from a shared ledger for a current %s role without changing selection IDs",
    async (role) => {
      const own = {
        id: "user_alice",
        ownerId: "user_alice",
        name: "Same ledger name",
        role: "owner",
      };
      const shared = {
        id: "user_bob",
        ownerId: "user_bob",
        name: "Same ledger name",
        role,
      };
      const onSelect = vi.fn();
      const go = vi.fn();
      const user = userEvent.setup();
      const view = render(
        <WorkspaceContext.Provider value={{ items: [own, shared], workspace: shared, onSelect }}>
          <Topbar go={go} />
        </WorkspaceContext.Provider>
      );
      const selector = screen.getByRole("combobox", { name: "Select ledger" });
      expect(selector).toHaveValue("user_bob");
      expect(selector).toHaveAttribute("title", "Shared ledger · Same ledger name");
      expect(
        within(selector).getByRole("option", { name: "Your ledger · Same ledger name" })
      ).toHaveValue("user_alice");
      expect(
        within(selector).getByRole("option", { name: "Shared ledger · Same ledger name" })
      ).toHaveProperty("selected", true);
      await user.selectOptions(selector, "user_alice");
      expect(onSelect).toHaveBeenCalledWith("user_alice");
      view.rerender(
        <WorkspaceContext.Provider value={{ items: [own, shared], workspace: own, onSelect }}>
          <Topbar go={go} />
        </WorkspaceContext.Provider>
      );
      expect(selector).toHaveValue("user_alice");
      expect(selector).toHaveAttribute("title", "Your ledger · Same ledger name");
      expect(
        within(selector).getByRole("option", { name: "Your ledger · Same ledger name" })
      ).toHaveProperty("selected", true);
      expect(go).not.toHaveBeenCalled();
    }
  );

  it("does not label an unknown ledger role as owned or shared", () => {
    const workspace = { id: "user_unknown", ownerId: "user_unknown", name: "Unknown ledger" };
    render(
      <WorkspaceContext.Provider value={{ items: [workspace], workspace, onSelect: vi.fn() }}>
        <Topbar go={vi.fn()} />
      </WorkspaceContext.Provider>
    );
    const selector = screen.getByRole("combobox", { name: "Select ledger" });
    expect(screen.queryByText("Ledger", { exact: true })).not.toBeInTheDocument();
    expect(selector.closest(".workspace-picker").querySelector("label")).toBeNull();
    expect(within(selector).getByRole("option", { name: "Unknown ledger" })).toHaveProperty(
      "selected",
      true
    );
    expect(selector).toHaveAttribute("title", "Unknown ledger");
    expect(selector).not.toHaveTextContent("Your ledger");
    expect(selector).not.toHaveTextContent("Shared ledger");
  });

  it("renders the current breadcrumb with the same base styling as clickable breadcrumbs", () => {
    render(<Topbar go={vi.fn()} breadcrumbs={[{ label: "Overview" }]} />);

    const current = screen.getByText("Overview");

    expect(current).toHaveClass("crumb-button");
    expect(current).not.toHaveClass("now");
    expect(screen.queryByRole("link", { name: /^overview$/i })).not.toBeInTheDocument();
  });

  it("overrides generic topbar link padding for clickable breadcrumbs", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles/base.css"), "utf8");
    const genericTopbarLinkBlock = styles.match(
      /\.topbar nav button,\s*\.topbar nav a\s*\{(?<body>[^}]*)\}/s
    )?.groups?.body;
    const breadcrumbButtonBlock = styles.match(
      /\.topbar \.crumbs \.crumb-button\s*\{(?<body>[^}]*)\}/s
    )?.groups?.body;

    expect(genericTopbarLinkBlock).toMatch(/\bpadding:\s*0 10px;/);
    expect(breadcrumbButtonBlock).toMatch(/\bpadding:\s*0;/);
  });

  it("exposes brand, breadcrumbs, and account navigation as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(
      <Topbar
        go={go}
        breadcrumbs={[{ label: "Pullwise", go: "ledgerProjects" }, { label: "Expenses" }]}
      />
    );

    const brand = screen.getByRole("link", { name: /go to pullwise home/i });
    expect(brand).toHaveAttribute("href", "/");
    brand.focus();
    await user.keyboard("{Enter}");

    expect(go).toHaveBeenCalledWith("landing");

    go.mockClear();
    const breadcrumb = screen.getByRole("link", { name: /^go to pullwise$/i });
    expect(breadcrumb).toHaveAttribute("href", "/projects");
    await user.click(breadcrumb);

    expect(go).toHaveBeenCalledWith("ledgerProjects");

    const account = screen.getByRole("link", { name: /open account settings/i });
    expect(account).toHaveAttribute("href", "/settings");
    await user.click(account);

    expect(go).toHaveBeenCalledWith("settings");
  });

  it("pauses topbar destinations and ledger changes, then restores native keyboard navigation", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    const onSelect = vi.fn();
    const own = { id: "own", role: "owner", name: "Own ledger" };
    const shared = { id: "shared", role: "viewer", name: "Shared ledger" };
    const topbar = (navigationDisabled) => (
      <WorkspaceContext.Provider value={{ items: [own, shared], workspace: own, onSelect }}>
        <Topbar
          go={go}
          loading
          navigationDisabled={navigationDisabled}
          breadcrumbs={[{ label: "Projects", go: "ledgerProjects" }, { label: "Expenses" }]}
        />
        <button type="button">Following control</button>
      </WorkspaceContext.Provider>
    );
    const view = render(topbar(true));
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).not.toHaveAttribute("href");
      expect(link).toHaveAttribute("aria-disabled", "true");
      expect(link).toHaveAttribute("tabindex", "-1");
      expect(fireEvent.click(link, { ctrlKey: true })).toBe(false);
      expect(
        fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }))
      ).toBe(false);
    }
    const selector = screen.getByRole("combobox", { name: "Select ledger" });
    expect(selector).toBeDisabled();
    await user.selectOptions(selector, "shared");
    fireEvent.change(selector, { target: { value: "shared" } });
    await user.tab();
    expect(screen.getByRole("button", { name: "Following control" })).toHaveFocus();
    const brand = screen.getByRole("link", { name: /go to pullwise home/i });
    brand.focus();
    await user.keyboard("{Enter}");
    expect(go).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

    view.rerender(topbar(false));
    expect(selector).not.toBeDisabled();
    expect(brand).toHaveAttribute("href", "/");
    expect(brand).not.toHaveAttribute("aria-disabled");
    expect(brand).not.toHaveAttribute("tabindex");
    brand.focus();
    await user.keyboard("{Enter}");
    await user.selectOptions(selector, "shared");
    expect(go).toHaveBeenCalledWith("landing");
    expect(onSelect).toHaveBeenCalledWith("shared");
  });
});

describe("Design token discipline", () => {
  function stylesOf(path) {
    return readFileSync(resolve(process.cwd(), path), "utf8");
  }

  it("uses one scrim color for every modal and drawer backdrop", () => {
    const screens = stylesOf("styles/screens.css");
    const backdrops = [screens.match(/\.modal-back\s*\{(?<body>[^}]*)\}/s)?.groups?.body];

    for (const body of backdrops) {
      expect(body).toBeTruthy();
      expect(body).toContain("background: rgba(8, 12, 20, 0.52);");
    }
  });

  it("renders accent-fill foregrounds with the --accent-fg token", () => {
    const screens = stylesOf("styles/screens.css");
    const blocks = [screens.match(/^\.oauth-logo\.app\s*\{(?<body>[^}]*)\}/ms)?.groups?.body];

    for (const body of blocks) {
      expect(body).toBeTruthy();
      expect(body).toMatch(/color:\s*var\(--accent-fg\)/);
      expect(body).not.toMatch(/color:\s*white\s*;/);
    }

    expect(screens.match(/^\s*color:\s*white\s*;/gm) || []).toHaveLength(0);
  });
  it("keeps font sizes on the --fs-* scale and token font stacks", () => {
    const files = ["styles/base.css", "styles/screens.css", "src/app.css", "src/landing-seo.css"];
    for (const file of files) {
      const css = stylesOf(file);
      expect(css, file).not.toMatch(/font-size:\s*\d+\.\d+px/);
      expect(css, file).not.toMatch(/font:\s*\d+\.\d+px/);
      expect(css, file).not.toContain("11.5px");
    }

    const screens = stylesOf("styles/screens.css");
    const docsH2 = screens.match(/^\.docs-h2\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    const statusH1 = screens.match(/^\.status-overall h1\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    for (const body of [docsH2, statusH1]) {
      expect(body).toBeTruthy();
      expect(body).toContain("font-size: var(--fs-4xl);");
      expect(body).not.toContain("font-size: 24px;");
    }

    expect(stylesOf("src/App.jsx")).not.toContain("fontSize: 16");
    expect(stylesOf("src/screens/public.jsx")).not.toContain("fontSize: 16");
  });
  it("keeps the stylesheet free of dead rules, duplicates, and mojibake", () => {
    const base = stylesOf("styles/base.css");
    const screens = stylesOf("styles/screens.css");
    const app = stylesOf("src/app.css");

    // Dead rules with no JSX usage.
    expect(base).not.toContain(".main.narrow");
    expect(screens).not.toContain(".issue-grid");
    expect(screens).not.toContain(".issue-kanban");

    // The mobile .lp-top frame is owned by app.css (imported last); no
    // overridden duplicate may remain in screens.css <=760px blocks.
    const screensMobile = [
      ...screens.matchAll(/@media\s*\(max-width:\s*760px\)\s*\{(?<body>[\s\S]*?)\n\}/g),
    ].map((match) => match.groups?.body || "");
    expect(screensMobile.some((body) => /\.lp-top\s*\{/.test(body))).toBe(false);

    // The mobile .repo-row grid columns are declared once per file.
    const screensRepoRows = screensMobile.filter((body) =>
      /^\s*\.repo-row\s*\{(?![^}]*gap)/m.test(body)
    );
    expect(screensRepoRows).toHaveLength(0);

    // Corrupted comment bytes.
    expect(app).not.toContain("鈹€");

    // Explicit CJK fallbacks keep the Chinese locale consistent across OSes.
    for (const token of ["--font-sans", "--font-display"]) {
      const body = base.match(new RegExp(token.replace("-", "\\-") + "\\s*:(?<body>[^;]*);"))
        ?.groups?.body;
      expect(body, token).toBeTruthy();
      expect(body, token).toContain("PingFang SC");
      expect(body, token).toContain("Microsoft YaHei");
    }
  });
  it("keeps mobile overlays and touch targets usable", () => {
    const base = stylesOf("styles/base.css");
    const app = stylesOf("src/app.css");

    // Toasts use the full small-screen width above the floating pickers
    // instead of squeezing beside them at 206px.
    const smallBlocks = [
      ...app.matchAll(/@media\s*\(max-width:\s*760px\)\s*\{(?<body>[\s\S]*?)\n\}/g),
    ].map((match) => match.groups?.body || "");
    const toastBlock = smallBlocks
      .map((body) => body.match(/\.notification-stack\s*\{(?<body>[^}]*)\}/s)?.groups?.body)
      .find(Boolean);
    expect(toastBlock).toBeTruthy();
    expect(toastBlock).toContain("width: calc(100vw - 32px);");
    expect(toastBlock).toContain("bottom: calc(78px + env(safe-area-inset-bottom));");
    expect(toastBlock).not.toContain("calc(100vw - 198px)");

    // Coarse pointers get the same 44px target on the collapsed topbar
    // icon buttons that the rest of the shell already guarantees.
    const coarse = base.match(/@media\s*\(any-pointer:\s*coarse\)\s*\{(?<body>[\s\S]*?)\n\}/s)
      ?.groups?.body;
    expect(coarse).toBeTruthy();
    expect(coarse).toMatch(/\.topbar \.btn\.ghost\.sm\s*\{[^}]*min-width:\s*44px/s);
  });
});

describe("Sidebar navigation", () => {
  it("groups ledger work separately from account tools and provides compact navigation", () => {
    const go = vi.fn();
    render(<Sidebar section="billing" go={go} />);
    const ledger = screen.getByRole("group", { name: "Ledger" });
    const account = screen.getByRole("group", { name: "Account & tools" });
    expect(within(ledger).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects"
    );
    expect(within(ledger).queryByRole("link", { name: "Billing" })).not.toBeInTheDocument();
    expect(within(account).getByRole("link", { name: "Billing" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const compact = screen.getByRole("combobox", { name: "More · Account & tools" });
    expect(compact).toHaveValue("billing");
    fireEvent.change(compact, { target: { value: "settings" } });
    expect(go).toHaveBeenCalledWith("settings");
  });

  it("draws the full-height sidebar divider at the shared adjustable navigation width", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles/base.css"), "utf8");

    expect(styles).toMatch(/\.with-side\s*\{[^}]*position:\s*relative;/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*content:\s*"";/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*top:\s*0;/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*bottom:\s*0;/s);
    expect(styles).toMatch(
      /\.with-side\s*\{[^}]*grid-template-columns:\s*var\(--console-sidebar-width, 220px\) minmax\(0, 1fr\);/s
    );
    expect(styles).toMatch(
      /\.with-side::before\s*\{[^}]*left:\s*var\(--console-sidebar-width, 220px\);/s
    );
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*background:\s*var\(--border\);/s);
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.with-side::before\s*\{[^}]*display:\s*none;/s
    );
    expect(styles).not.toMatch(/\.side\s*\{[^}]*border-right:\s*1px solid var\(--border\);/s);
  });

  it("exposes navigation destinations as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    render(<Sidebar section="ledgerProjects" go={go} />);

    const projects = screen.getByRole("link", { name: /^projects$/i });
    const shared = screen.getByRole("link", { name: /^shared pool$/i });
    const apiKeys = screen.getByRole("link", { name: /^api keys$/i });
    const billing = screen.getByRole("link", { name: /^billing$/i });
    const settings = screen.getByRole("link", { name: /^settings$/i });

    expect(screen.queryByRole("link", { name: /^workers$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^issues$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^scan history$/i })).not.toBeInTheDocument();
    expect(projects).toHaveAttribute("href", "/projects");
    expect(shared).toHaveAttribute("href", "/shared");
    expect(apiKeys).toHaveAttribute("href", "/api-keys");
    expect(billing).toHaveAttribute("href", "/billing");
    expect(settings).toHaveAttribute("href", "/settings");

    await user.click(apiKeys);

    expect(go).toHaveBeenCalledWith("apiKeys");
  });

  it("pauses sidebar links and compact destinations while pure view tabs remain usable", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    const onViewChange = vi.fn();
    const sidebar = (navigationDisabled) => (
      <>
        <Sidebar section="ledgerProjects" go={go} navigationDisabled={navigationDisabled} />
        <ViewTabs
          id="busy-test"
          label="Ledger views"
          tabs={[
            { key: "expenses", label: "Expenses" },
            { key: "reports", label: "Reports" },
          ]}
          value="expenses"
          onChange={onViewChange}
        />
      </>
    );
    const view = render(sidebar(true));
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("href");
      expect(link).toHaveAttribute("aria-disabled", "true");
      expect(link).toHaveAttribute("tabindex", "-1");
      expect(fireEvent.click(link, { metaKey: true })).toBe(false);
      expect(
        fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }))
      ).toBe(false);
    }
    const compact = screen.getByRole("combobox", { name: "More · Account & tools" });
    expect(compact).toBeDisabled();
    await user.selectOptions(compact, "billing");
    fireEvent.change(compact, { target: { value: "settings" } });
    await user.tab();
    expect(screen.getByRole("tab", { name: "Expenses" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onViewChange).toHaveBeenCalledWith("reports");
    expect(screen.getByRole("tab", { name: "Reports" })).toHaveFocus();
    expect(go).not.toHaveBeenCalled();

    view.rerender(sidebar(false));
    expect(compact).not.toBeDisabled();
    const projects = screen.getByRole("link", { name: "Projects" });
    expect(projects).toHaveAttribute("href", "/projects");
    expect(projects).not.toHaveAttribute("aria-disabled");
    projects.focus();
    await user.keyboard("{Enter}");
    await user.selectOptions(compact, "billing");
    expect(go).toHaveBeenCalledWith("ledgerProjects");
    expect(go).toHaveBeenCalledWith("billing");
  });
});
