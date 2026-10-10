import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ProjectsList } from "./projects-list.jsx";
import { setLang, T } from "../i18n.jsx";

const projects = [
  { id: "active", name: "Platform", description: "Hosting costs", status: "active", totals: [] },
  { id: "archived", name: "Old service", description: "Retired tools", status: "archived", totals: [] },
];
const Total = () => null;
afterEach(() => setLang("en"));

describe("Projects list filtering and announcements", () => {
  it("updates memoized row copy when the selected locale catalog finishes loading", async () => {
    render(<ProjectsList
      page={{ items: projects, nextCursor: null }}
      go={vi.fn()}
      labelForProject={(project) => project.name}
      Total={Total}
      onLoadMore={vi.fn()}
    />);
    const row = screen.getByRole("link", { name: "Platform" }).closest("article");
    expect(row).toHaveTextContent("No expenses");
    let localeReady;
    act(() => { localeReady = setLang("zh"); });
    await act(async () => { await localeReady; });
    expect(T("No expenses")).not.toBe("No expenses");
    expect(row).toHaveTextContent(T("No expenses"));
  });
  it("indexes names once, searches only loaded records, and retains explicit pagination with no matches", () => {
    const labelForProject = vi.fn((project) => project.name);
    const onLoadMore = vi.fn();
    render(<ProjectsList
      page={{ items: projects, nextCursor: "next" }}
      go={vi.fn()}
      labelForProject={labelForProject}
      Total={Total}
      onLoadMore={onLoadMore}
    />);
    const search = screen.getByRole("searchbox", { name: "Find a project" });
    expect(document.getElementById(search.getAttribute("aria-describedby"))).toHaveTextContent(
      "apply to loaded projects only",
    );
    const list = screen.getByRole("list", { name: "Projects" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(labelForProject).toHaveBeenCalledTimes(2);
    fireEvent.change(search, { target: { value: "Hosting" } });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 2 loaded projects.");
    fireEvent.change(search, { target: { value: "Unknown" } });
    expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
    expect(labelForProject).toHaveBeenCalledTimes(2);
    expect(onLoadMore).not.toHaveBeenCalled();
    const loadMore = screen.getByRole("button", { name: "Load more projects" });
    expect(loadMore).toBeEnabled();
    fireEvent.click(loadMore);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveFocus();
    fireEvent.change(screen.getByRole("combobox", { name: "Project status" }), {
      target: { value: "archived" },
    });
    expect(screen.getByRole("link", { name: "Old service" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Platform" })).not.toBeInTheDocument();
    expect(labelForProject).toHaveBeenCalledTimes(2);
  });

  it("announces retained loading results and blocks filtering and internal navigation during writes", () => {
    const props = {
      page: { items: projects, nextCursor: "next" },
      go: vi.fn(),
      labelForProject: (project) => project.name,
      Total,
      onLoadMore: vi.fn(),
    };
    const { rerender } = render(<ProjectsList {...props} />);
    const search = screen.getByRole("searchbox", { name: "Find a project" });
    fireEvent.change(search, { target: { value: "Platform" } });
    rerender(<ProjectsList {...props} loading paginationDisabled />);
    expect(screen.getByRole("status")).toHaveTextContent("Updating projects…");
    expect(document.getElementById(search.getAttribute("aria-controls"))).toHaveAttribute("aria-busy", "true");
    expect(search).toBeEnabled();
    expect(screen.getByRole("button", { name: "Load more projects" })).toBeDisabled();
    rerender(<ProjectsList {...props} writing paginationDisabled />);
    expect(search).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Project status" })).toBeDisabled();
    const project = screen.getByText("Platform").closest("a");
    expect(project).not.toHaveAttribute("href");
    fireEvent.click(project);
    expect(props.go).not.toHaveBeenCalled();
  });
});
