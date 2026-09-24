import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIssues, useRepositories, useScans } from "./lib/pullwise-data.js";
import { Sidebar, Topbar } from "./shell.jsx";

vi.mock("./lib/pullwise-data.js", () => ({
  useIssues: vi.fn(),
  useRepositories: vi.fn(),
  useScans: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useIssues.mockReturnValue({ items: [] });
  useScans.mockReturnValue({ items: [] });
  useRepositories.mockReturnValue({
    items: [{ id: "repo_1", name: "api", fullName: "acme/api" }],
  });
});

describe("Topbar navigation", () => {
  it("renders the current breadcrumb with the same base styling as clickable breadcrumbs", () => {
    render(<Topbar go={vi.fn()} breadcrumbs={[{ label: "Issues" }]} />);

    const current = screen.getByText("Issues");

    expect(current).toHaveClass("crumb-button");
    expect(current).not.toHaveClass("now");
    expect(screen.queryByRole("link", { name: /^issues$/i })).not.toBeInTheDocument();
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

  it("exposes search as a named button and dialog", async () => {
    const user = userEvent.setup();

    render(<Topbar go={vi.fn()} breadcrumbs={[{ label: "Issues" }]} />);

    await user.click(screen.getByRole("button", { name: /^search$/i }));

    const dialog = screen.getByRole("dialog", { name: /^search$/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("searchbox", { name: /^search$/i })).toBeInTheDocument();
  });

  it("keeps a result-heavy search dialog inside the remaining viewport", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles/screens.css"), "utf8");
    const modalSearchStyles = styles.match(
      /\.modal-search\s*\{(?<body>[^}]*)\}/s,
    )?.groups?.body;
    const searchBodyStyles = styles.match(
      /\.search-body\s*\{(?<body>[^}]*)\}/s,
    )?.groups?.body;
    const modalSearchBodyStyles = styles.match(
      /\.modal-search \.search-body\s*\{(?<body>[^}]*)\}/s,
    )?.groups?.body;

    expect(modalSearchStyles).toContain("--search-modal-top-offset: 12vh;");
    expect(modalSearchStyles).toContain("margin-top: var(--search-modal-top-offset);");
    expect(modalSearchStyles).toContain(
      "max-height: calc(100vh - 40px - var(--search-modal-top-offset));",
    );
    expect(modalSearchStyles).toContain(
      "max-height: calc(100dvh - 40px - var(--search-modal-top-offset));",
    );
    expect(searchBodyStyles).toContain("min-height: 0;");
    expect(searchBodyStyles).toContain("overflow-y: auto;");
    expect(modalSearchBodyStyles).toContain("max-height: none;");
    expect(modalSearchBodyStyles).toContain("flex: 1 1 auto;");
  });

  it("keeps the search dialog inside narrow mobile viewports", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles/screens.css"), "utf8");
    const modalBlocks = [
      ...styles.matchAll(/\.modal-search\s*\{(?<body>[^}]*)\}/g),
    ].map((match) => match.groups?.body || "");

    expect(modalBlocks.length).toBeGreaterThan(0);
    expect(modalBlocks[0]).toContain("max-width: calc(100vw - 40px);");
    for (const body of modalBlocks) {
      expect(body).not.toMatch(/max-width:\s*none/);
    }
    expect(modalBlocks.some((body) => /width:\s*100%/.test(body))).toBe(true);
  });

  it("sends the typed global search query to the server-backed hooks", async () => {
    const user = userEvent.setup();

    render(<Topbar go={vi.fn()} breadcrumbs={[{ label: "Issues" }]} />);

    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await user.type(screen.getByRole("searchbox", { name: /^search$/i }), "needle");

    await waitFor(() => {
      expect(useIssues).toHaveBeenLastCalledWith({ q: "needle", limit: 5, refreshOnChange: false });
      expect(useRepositories).toHaveBeenLastCalledWith({ q: "needle", limit: 4 });
    });
  });

  it("waits for a pause before sending each global search query", async () => {
    vi.useFakeTimers();
    try {
      render(<Topbar go={vi.fn()} breadcrumbs={[{ label: "Issues" }]} />);

      fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
      fireEvent.change(screen.getByRole("searchbox", { name: /^search$/i }), {
        target: { value: "needle" },
      });

      expect(useIssues).not.toHaveBeenLastCalledWith({
        q: "needle",
        limit: 5,
        refreshOnChange: false,
      });
      expect(useRepositories).not.toHaveBeenLastCalledWith({ q: "needle", limit: 4 });

      expect(useIssues).toHaveBeenLastCalledWith({
        q: "",
        limit: 5,
        refreshOnChange: false,
      });
      expect(useRepositories).toHaveBeenLastCalledWith({ q: "", limit: 4 });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(useIssues).toHaveBeenLastCalledWith({
        q: "needle",
        limit: 5,
        refreshOnChange: false,
      });
      expect(useRepositories).toHaveBeenLastCalledWith({ q: "needle", limit: 4 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps authoritative server matches whose display fields do not contain the literal query", async () => {
    useIssues.mockImplementation(({ q }) => ({
      items: q
        ? [
            {
              id: "iss_ranked",
              title: "Authentication boundary",
              file: "src/auth.js",
              category: "Security",
              repo: "acme/service",
              severity: "high",
            },
          ]
        : [],
    }));
    useRepositories.mockImplementation(({ q }) => ({
      items: q
        ? [{ id: "repo_ranked", name: "api", fullName: "acme/api", desc: "Service repository" }]
        : [],
    }));
    const user = userEvent.setup();

    render(<Topbar go={vi.fn()} breadcrumbs={[{ label: "Issues" }]} setIssue={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^search$/i }));
    await user.type(screen.getByRole("searchbox", { name: /^search$/i }), "oauth-token-rotation");

    expect(await screen.findByText("Authentication boundary")).toBeInTheDocument();
    expect(await screen.findByText("acme/api")).toBeInTheDocument();
  });

  it("exposes brand, breadcrumbs, and account navigation as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(
      <Topbar go={go} breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: "Issues" }]} />
    );

    const brand = screen.getByRole("link", { name: /go to pullwise home/i });
    expect(brand).toHaveAttribute("href", "/");
    brand.focus();
    await user.keyboard("{Enter}");

    expect(go).toHaveBeenCalledWith("landing");

    go.mockClear();
    const breadcrumb = screen.getByRole("link", { name: /^go to pullwise$/i });
    expect(breadcrumb).toHaveAttribute("href", "/dashboard/overview");
    await user.click(breadcrumb);

    expect(go).toHaveBeenCalledWith("dashboard");

    const account = screen.getByRole("link", { name: /open account settings/i });
    expect(account).toHaveAttribute("href", "/settings");
    await user.click(account);

    expect(go).toHaveBeenCalledWith("settings");
  });
});

describe("Design token discipline", () => {
  function stylesOf(path) {
    return readFileSync(resolve(process.cwd(), path), "utf8");
  }

  it("uses one scrim color for every modal and drawer backdrop", () => {
    const screens = stylesOf("styles/screens.css");
    const app = stylesOf("src/app.css");
    const product = stylesOf("src/screens/product.css");
    const backdrops = [
      screens.match(/\.modal-back\s*\{(?<body>[^}]*)\}/s)?.groups?.body,
      app.match(/\.quota-modal-back\s*\{(?<body>[^}]*)\}/s)?.groups?.body,
      product.match(/\.product-backdrop\s*\{(?<body>[^}]*)\}/s)?.groups?.body,
    ];

    for (const body of backdrops) {
      expect(body).toBeTruthy();
      expect(body).toContain("background: rgba(8, 12, 20, 0.52);");
    }
  });

  it("renders accent-fill foregrounds with the --accent-fg token", () => {
    const screens = stylesOf("styles/screens.css");
    const app = stylesOf("src/app.css");
    const blocks = [
      screens.match(/^\.oauth-logo\.app\s*\{(?<body>[^}]*)\}/ms)?.groups?.body,
      screens.match(/^\.repo-check-box\s*\{(?<body>[^}]*)\}/ms)?.groups?.body,
      screens.match(/^\.scanning-phase\.done \.scanning-phase-bullet\s*\{(?<body>[^}]*)\}/ms)?.groups?.body,
      screens.match(/^\.scanning-phase\.failed \.scanning-phase-bullet\s*\{(?<body>[^}]*)\}/ms)?.groups?.body,
      screens.match(/^\.pr-step\.on > span:first-child\s*\{(?<body>[^}]*)\}/ms)?.groups?.body,
      screens.match(/^\.set-av\s*\{(?<body>[^}]*)\}/ms)?.groups?.body,
      app.match(/^\.issue-check-dot\s*\{(?<body>[^}]*)\}/ms)?.groups?.body,
    ];

    for (const body of blocks) {
      expect(body).toBeTruthy();
      expect(body).toMatch(/color:\s*var\(--accent-fg\)/);
      expect(body).not.toMatch(/color:\s*white\s*;/);
    }

    // Remaining literal white is allowed only in the dark-theme phase block
    // (screens.css) and the always-dark dev proto-nav (app.css).
    expect(screens.match(/^\s*color:\s*white\s*;/gm) || []).toHaveLength(1);
    expect(app.match(/^\s*color:\s*white\s*;/gm) || []).toHaveLength(3);
  });
  it("keeps font sizes on the --fs-* scale and token font stacks", () => {
    const files = [
      "styles/base.css",
      "styles/screens.css",
      "src/app.css",
      "src/landing-seo.css",
      "src/screens/product.css",
    ];
    for (const file of files) {
      const css = stylesOf(file);
      expect(css, file).not.toMatch(/font-size:\s*\d+\.\d+px/);
      expect(css, file).not.toMatch(/font:\s*\d+\.\d+px/);
      expect(css, file).not.toContain("11.5px");
    }

    const app = stylesOf("src/app.css");
    const protoNav = app.match(/^\.proto-nav\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    const protoNavItem = app.match(/^\.proto-nav-i\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    const protoNavN = app.match(/^\.proto-nav-n\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    expect(protoNav).toContain("var(--font-sans)");
    expect(protoNavItem).toContain("var(--font-sans)");
    expect(protoNavN).toContain("var(--font-mono)");

    const kpiValueSizes = [
      ...app.matchAll(/^\.kpi-v\s*\{(?<body>[^}]*)\}/gms),
    ].filter((match) => /font-size/.test(match.groups?.body || ""));
    expect(kpiValueSizes).toHaveLength(1);

    const screens = stylesOf("styles/screens.css");
    const docsH2 = screens.match(/^\.docs-h2\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    const statusH1 = screens.match(/^\.status-overall h1\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    for (const body of [docsH2, statusH1]) {
      expect(body).toBeTruthy();
      expect(body).toContain("font-size: var(--fs-4xl);");
      expect(body).not.toContain("font-size: 24px;");
    }
    const issuesFile = screens.match(/^\.issues-file\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    expect(issuesFile).toContain("var(--fs-sm)");

    expect(stylesOf("src/App.jsx")).not.toContain("fontSize: 16");
    expect(stylesOf("src/screens/public.jsx")).not.toContain("fontSize: 16");
    expect(stylesOf("src/screens/issues.jsx")).not.toContain("fontSize: 22");
    expect(stylesOf("src/screens/issues.jsx")).not.toContain("fontSize: 13");
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
      const body = base.match(
        new RegExp(token.replace("-", "\\-") + "\\s*:(?<body>[^;]*);")
      )?.groups?.body;
      expect(body, token).toBeTruthy();
      expect(body, token).toContain("PingFang SC");
      expect(body, token).toContain("Microsoft YaHei");
    }
  });
  it("keeps mobile overlays and touch targets usable", () => {
    const base = stylesOf("styles/base.css");
    const screens = stylesOf("styles/screens.css");
    const app = stylesOf("src/app.css");

    // iOS Safari zooms focused inputs below 16px; --fs-2xl is exactly 16px.
    const searchInput = screens.match(/^\.search-h input\s*\{(?<body>[^}]*)\}/ms)?.groups?.body;
    expect(searchInput).toContain("var(--fs-2xl)");
    expect(searchInput).not.toContain("var(--fs-xl)");

    // Toasts use the full small-screen width above the floating pickers
    // instead of squeezing beside them at 206px.
    const smallBlocks = [
      ...app.matchAll(/@media\s*\(max-width:\s*520px\)\s*\{(?<body>[\s\S]*?)\n\}/g),
    ].map((match) => match.groups?.body || "");
    const toastBlock = smallBlocks
      .map((body) => body.match(/\.notification-stack\s*\{(?<body>[^}]*)\}/s)?.groups?.body)
      .find(Boolean);
    expect(toastBlock).toBeTruthy();
    expect(toastBlock).toContain("width: calc(100vw - 32px);");
    expect(toastBlock).toContain("bottom: 72px;");
    expect(toastBlock).not.toContain("calc(100vw - 184px)");

    // Coarse pointers get the same 44px target on the collapsed topbar
    // icon buttons that the rest of the shell already guarantees.
    const coarse = base.match(/@media\s*\(pointer:\s*coarse\)\s*\{(?<body>[\s\S]*?)\n\}/s)?.groups?.body;
    expect(coarse).toBeTruthy();
    expect(coarse).toMatch(/\.topbar \.btn\.ghost\.sm\s*\{[^}]*min-width:\s*44px/s);
  });

  it("collapses the product counts band at the shared 760px breakpoint", () => {
    const product = stylesOf("src/screens/product.css");

    // Five count cells squeeze to ~123px each at 650px when the collapse
    // waits for 600px; fold to two columns at the shared app breakpoint.
    const wide = product.match(
      /@media\s*\(max-width:\s*760px\)\s*\{\s*\.product-counts\s*\{(?<counts>[^}]*)\}\s*\.product-counts button\s*\{(?<btn>[^}]*)\}/,
    );
    expect(wide).toBeTruthy();
    expect(wide.groups.counts).toContain("repeat(2, minmax(0, 1fr))");
    expect(wide.groups.btn).toContain("border-bottom");

    const narrow = product.match(/@media\s*\(max-width:\s*600px\)\s*\{(?<body>[\s\S]*?)\n\}/);
    expect(narrow?.groups?.body || "").not.toContain(".product-counts");
  });
});

describe("Sidebar navigation", () => {
  it("draws the desktop sidebar divider across the full layout height", () => {
    const styles = readFileSync(resolve(process.cwd(), "styles/base.css"), "utf8");

    expect(styles).toMatch(/\.with-side\s*\{[^}]*position:\s*relative;/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*content:\s*"";/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*top:\s*0;/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*bottom:\s*0;/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*left:\s*220px;/s);
    expect(styles).toMatch(/\.with-side::before\s*\{[^}]*background:\s*var\(--border\);/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.with-side::before\s*\{[^}]*display:\s*none;/s);
    expect(styles).not.toMatch(/\.side\s*\{[^}]*border-right:\s*1px solid var\(--border\);/s);
  });

  it("exposes navigation destinations as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    useIssues.mockReturnValue({ items: [{ id: "f_1", status: "open" }] });

    render(<Sidebar section="dashboard" go={go} />);

    const overview = screen.getByRole("link", { name: /^overview$/i });
    const issues = screen.getByRole("link", { name: /^issues\b/i });
    const repositories = screen.getByRole("link", { name: /^repositories$/i });
    const history = screen.getByRole("link", { name: /^scan history$/i });
    const apiKeys = screen.getByRole("link", { name: /^api keys$/i });
    const billing = screen.getByRole("link", { name: /^billing$/i });
    const settings = screen.getByRole("link", { name: /^settings$/i });

    expect(screen.queryByRole("link", { name: /^workers$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/repository access/i)).not.toBeInTheDocument();
    expect(overview).toHaveAttribute("href", "/dashboard/overview");
    expect(issues).toHaveAttribute("href", "/issues");
    expect(repositories).toHaveAttribute("href", "/repos");
    expect(history).toHaveAttribute("href", "/history");
    expect(apiKeys).toHaveAttribute("href", "/api-keys");
    expect(billing).toHaveAttribute("href", "/billing");
    expect(settings).toHaveAttribute("href", "/settings");

    await user.click(apiKeys);

    expect(go).toHaveBeenCalledWith("apiKeys");
  });

  it("uses the server-filtered open issue total for the issues badge", () => {
    useIssues.mockReturnValue({
      items: [{ id: "f_1", status: "open" }],
      meta: { total: 12 },
    });

    render(<Sidebar section="dashboard" go={vi.fn()} />);

    expect(useIssues).toHaveBeenCalledWith({ status: "open", limit: 1 });
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("uses the server scan total for the scan history badge", () => {
    useScans.mockReturnValue({
      items: [{ id: "scan_1" }],
      meta: { total: 123 },
    });

    render(<Sidebar section="dashboard" go={vi.fn()} />);

    const history = screen.getByRole("link", { name: /^scan history\b/i });
    expect(useScans).toHaveBeenCalledWith({ limit: 1 });
    expect(history).toHaveTextContent("123");
  });
});
