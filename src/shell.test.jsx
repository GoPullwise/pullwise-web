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
    workspace: { name: "Acme" },
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
    expect(brand).toHaveAttribute("href", expect.stringContaining("screen=landing"));
    brand.focus();
    await user.keyboard("{Enter}");

    expect(go).toHaveBeenCalledWith("landing");

    go.mockClear();
    const breadcrumb = screen.getByRole("link", { name: /^go to pullwise$/i });
    expect(breadcrumb).toHaveAttribute("href", expect.stringContaining("screen=dashboard"));
    await user.click(breadcrumb);

    expect(go).toHaveBeenCalledWith("dashboard");

    const account = screen.getByRole("link", { name: /open account settings/i });
    expect(account).toHaveAttribute("href", expect.stringContaining("screen=settings"));
    await user.click(account);

    expect(go).toHaveBeenCalledWith("settings");
  });
});

describe("Sidebar navigation", () => {
  it("exposes workspace navigation destinations as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    useIssues.mockReturnValue({ items: [{ id: "f_1", status: "open" }] });

    render(<Sidebar section="dashboard" go={go} />);

    const workspace = screen.getByRole("link", { name: /open workspaces/i });
    const overview = screen.getByRole("link", { name: /^overview$/i });
    const issues = screen.getByRole("link", { name: /^issues\b/i });
    const repositories = screen.getByRole("link", { name: /^repositories$/i });
    const history = screen.getByRole("link", { name: /^scan history$/i });
    const apiKeys = screen.getByRole("link", { name: /^api keys$/i });
    const workspaces = screen.getByRole("link", { name: /^workspaces$/i });
    const billing = screen.getByRole("link", { name: /^billing$/i });
    const settings = screen.getByRole("link", { name: /^settings$/i });
    const repoAccess = screen.getByRole("link", { name: /1 repositories/i });

    expect(workspace).toHaveAttribute("href", expect.stringContaining("screen=workspaces"));
    expect(overview).toHaveAttribute("href", expect.stringContaining("screen=dashboard"));
    expect(issues).toHaveAttribute("href", expect.stringContaining("screen=issues"));
    expect(repositories).toHaveAttribute("href", expect.stringContaining("screen=repos"));
    expect(history).toHaveAttribute("href", expect.stringContaining("screen=history"));
    expect(apiKeys).toHaveAttribute("href", expect.stringContaining("screen=apiKeys"));
    expect(workspaces).toHaveAttribute("href", expect.stringContaining("screen=workspaces"));
    expect(billing).toHaveAttribute("href", expect.stringContaining("screen=billing"));
    expect(settings).toHaveAttribute("href", expect.stringContaining("screen=settings"));
    expect(repoAccess).toHaveAttribute("href", expect.stringContaining("screen=repos"));

    await user.click(workspace);
    await user.click(apiKeys);
    await user.click(repoAccess);

    expect(screen.getByText("Repository access")).toBeInTheDocument();
    expect(screen.queryByText(/authorized repos/i)).not.toBeInTheDocument();
    expect(go).toHaveBeenCalledWith("workspaces");
    expect(go).toHaveBeenCalledWith("apiKeys");
    expect(go).toHaveBeenCalledWith("repos");
  });

  it("keeps repository connection as an action when no repositories are linked", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    useRepositories.mockReturnValue({ items: [], workspace: { name: "Acme" } });

    render(<Sidebar section="dashboard" go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github/i }));

    expect(connectGitHubRepositories).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith("repos");
  });
});
