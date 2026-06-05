import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectGitHubRepositories } from "./lib/auth.js";
import { useIssues, useRepositories } from "./lib/pullwise-data.js";
import { Sidebar, Topbar } from "./shell.jsx";

vi.mock("./lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
}));

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
    const repoAccess = screen.getByRole("link", { name: /1 repositories/i });

    expect(screen.queryByRole("link", { name: /^workers$/i })).not.toBeInTheDocument();
    expect(overview).toHaveAttribute("href", "/dashboard/overview");
    expect(issues).toHaveAttribute("href", "/issues");
    expect(repositories).toHaveAttribute("href", "/repos");
    expect(history).toHaveAttribute("href", "/history");
    expect(apiKeys).toHaveAttribute("href", "/api-keys");
    expect(billing).toHaveAttribute("href", "/billing");
    expect(settings).toHaveAttribute("href", "/settings");
    expect(repoAccess).toHaveAttribute("href", "/repos");

    await user.click(apiKeys);
    await user.click(repoAccess);

    expect(screen.getByText("Repository access")).toBeInTheDocument();
    expect(screen.queryByText(/authorized repos/i)).not.toBeInTheDocument();
    expect(go).toHaveBeenCalledWith("apiKeys");
    expect(go).toHaveBeenCalledWith("repos");
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

  it("keeps repository connection as an action when no repositories are linked", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    useRepositories.mockReturnValue({ items: [] });

    render(<Sidebar section="dashboard" go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github/i }));

    expect(connectGitHubRepositories).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith("repos");
  });
});
