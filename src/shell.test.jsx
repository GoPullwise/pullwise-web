import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useIssues, useRepositories } from "./lib/pullwise-data.js";
import { Sidebar, Topbar } from "./shell.jsx";

vi.mock("./lib/pullwise-data.js", () => ({
  useIssues: vi.fn(),
  useRepositories: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  useIssues.mockReturnValue({ items: [] });
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
});
