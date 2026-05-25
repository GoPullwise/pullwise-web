import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    items: [{ id: "repo-1", name: "api" }],
    workspace: { name: "Acme" },
  });
});

describe("Topbar navigation", () => {
  it("exposes brand, breadcrumbs, and account navigation as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(
      <Topbar
        go={go}
        breadcrumbs={[
          { label: "Pullwise", go: "dashboard" },
          { label: "Issues" },
        ]}
      />
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

    render(<Sidebar section="dashboard" go={go} />);

    const overview = screen.getByRole("link", { name: /^overview$/i });
    const issues = screen.getByRole("link", { name: /^issues\b/i });
    const repositories = screen.getByRole("link", { name: /^repositories$/i });
    const history = screen.getByRole("link", { name: /^scan history$/i });
    const billing = screen.getByRole("link", { name: /^billing$/i });
    const settings = screen.getByRole("link", { name: /^settings$/i });
    const repo = screen.getByRole("link", { name: /^api$/i });

    expect(overview).toHaveAttribute("href", expect.stringContaining("screen=dashboard"));
    expect(issues).toHaveAttribute("href", expect.stringContaining("screen=issues"));
    expect(repositories).toHaveAttribute("href", expect.stringContaining("screen=repos"));
    expect(history).toHaveAttribute("href", expect.stringContaining("screen=history"));
    expect(billing).toHaveAttribute("href", expect.stringContaining("screen=billing"));
    expect(settings).toHaveAttribute("href", expect.stringContaining("screen=settings"));
    expect(repo).toHaveAttribute("href", expect.stringContaining("screen=repos"));

    await user.click(issues);

    expect(go).toHaveBeenCalledWith("issues");
  });
});
