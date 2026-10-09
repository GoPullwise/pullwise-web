import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerScreen } from "./ledger.jsx";

const guideTitle = "Add a category to record expenses";
const guideDescription = "Create a category such as Hosting, Domains or AI tools. Categories work across projects and the shared pool in this ledger.";
const archivedCategory = {
  id: "cat_hosting",
  name: "Hosting",
  archivedAt: "2026-10-08T12:00:00Z",
  revision: 3,
};

function fixture({ mode = "shared", categories = [], records = false, permissions = {}, projectFields = {} } = {}) {
  const project = {
    id: "prj_category",
    name: "Current project",
    status: "active",
    githubAccess: "not_linked",
    canCreateExpense: true,
    githubRepoIds: [],
    repositories: [],
    revision: 2,
    totals: [],
    ...projectFields,
  };
  const expense = {
    id: "exp_hosting",
    target: mode === "shared" ? { kind: "shared" } : { kind: "project", projectId: project.id },
    occurredOn: "2026-10-08",
    amount: "12.50",
    currency: "USD",
    categoryId: archivedCategory.id,
    purpose: "Historical hosting",
    revision: 4,
  };
  const api = {
    categories: vi.fn().mockResolvedValue(categories),
    projects: vi.fn().mockResolvedValue({ items: [project], nextCursor: null }),
    project: vi.fn().mockResolvedValue(project),
    expenses: vi.fn().mockResolvedValue({ items: records ? [expense] : [], nextCursor: null }),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
    repositories: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    me: vi.fn().mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } }),
    createExpense: vi.fn(),
    updateExpense: vi.fn().mockResolvedValue({ ...expense, revision: 5 }),
  };
  const workspace = {
    id: "wsp_category",
    revision: 1,
    permissions: { manageCategories: true, manageProjects: true, writeExpenses: true, ...permissions },
  };
  const go = vi.fn();
  render(<LedgerScreen api={api} go={go} mode={mode} projectId={project.id} workspace={workspace} />);
  return { api, go, expense };
}

describe("Expense category guidance", () => {
  it.each(["shared", "project"])("gives an empty %s ledger one clear category action", async (mode) => {
    const { api, go } = fixture({ mode });
    const heading = await screen.findByRole("heading", { name: guideTitle });
    const empty = heading.closest(".empty");
    expect(within(empty).getByText(guideDescription)).toBeVisible();
    const addCategory = within(empty).getByRole("button", { name: "Add category" });
    expect(addCategory).toHaveClass("primary");
    expect(screen.getAllByRole("button", { name: "Add category" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage categories" })).not.toBeInTheDocument();
    expect(screen.queryByText("No expenses for this target yet.")).not.toBeInTheDocument();
    fireEvent.click(addCategory);
    expect(go).toHaveBeenCalledExactlyOnceWith("ledgerCategories");
    expect(api.createExpense).not.toHaveBeenCalled();
    expect(api.me).not.toHaveBeenCalled();
  });

  it("requires an active category even when archived or removed categories exist", async () => {
    fixture({ categories: [archivedCategory, { id: "cat_removed", name: "Old tools", removedAt: "2026-10-08T12:00:00Z" }] });
    expect(await screen.findByRole("heading", { name: guideTitle })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add category" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });

  it("opens expense entry when an active category is available", async () => {
    const { go } = fixture({ categories: [{ ...archivedCategory, archivedAt: null }] });
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    expect(screen.getByLabelText("Date")).toHaveFocus();
    expect(screen.getByLabelText("Category")).toBeVisible();
    expect(screen.queryByRole("heading", { name: guideTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add category" })).not.toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
  });

  it("keeps historical project records editable and moves category guidance out of the open editor", async () => {
    const { api, expense } = fixture({ mode: "project", categories: [archivedCategory], records: true });
    const heading = await screen.findByRole("heading", { name: guideTitle });
    expect(heading.closest(".notice")).not.toBeNull();
    expect(screen.getByText(expense.purpose)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: `Edit ${expense.purpose}` }));
    expect(screen.getByText("You can keep this expense's original category when editing.")).toBeVisible();
    expect(screen.getByLabelText("Category")).toHaveValue(expense.categoryId);
    expect(screen.getByRole("option", { name: archivedCategory.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: guideTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add category" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(api.updateExpense).toHaveBeenCalledExactlyOnceWith(
      expense.id,
      expense.revision,
      expect.objectContaining({ target: expense.target, categoryId: expense.categoryId, purpose: expense.purpose }),
      {}
    ));
    expect(await screen.findByRole("heading", { name: guideTitle })).toBeVisible();
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
  });

  it("keeps a filtered empty result distinct from the category setup action", async () => {
    const { api, go } = fixture();
    await screen.findByRole("heading", { name: guideTitle });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-01" } });
    const emptyHeading = await screen.findByRole("heading", { name: "No expenses match these filters" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Reload" })).toBeEnabled());
    expect(emptyHeading.closest(".empty")).not.toBeNull();
    expect(screen.getByRole("heading", { name: guideTitle }).closest(".notice")).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Add category" })).toHaveLength(1);
    expect(api.expenses).toHaveBeenLastCalledWith({ target: "shared", from: "2026-10-01" }, expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(go).toHaveBeenCalledExactlyOnceWith("ledgerCategories");
  });

  it("tells an Editor who can add a category without offering a management action", async () => {
    fixture({ permissions: { manageCategories: false, manageProjects: false } });
    expect(await screen.findByRole("heading", { name: "No active expense categories" })).toBeVisible();
    expect(screen.getByText("Ask an Owner or Admin to add a category before recording an expense.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });

  it("keeps a Viewer’s empty ledger free of category setup actions", async () => {
    fixture({ permissions: { manageCategories: false, manageProjects: false, writeExpenses: false } });
    await screen.findByRole("heading", { name: "No expenses for this target yet." });
    expect(screen.queryByRole("heading", { name: guideTitle })).not.toBeInTheDocument();
    expect(screen.queryByText("Ask an Owner or Admin to add a category before recording an expense.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });

  it.each([
    ["archived", { status: "archived" }],
    ["lost GitHub access", { githubAccess: "lost", canCreateExpense: false }],
    ["unverified GitHub access", { githubAccess: "unavailable", canCreateExpense: false }],
  ])("does not suggest categories when %s already prevents adding project expenses", async (_, projectFields) => {
    fixture({ mode: "project", projectFields });
    await screen.findByRole("heading", { name: "No expenses for this target yet." });
    expect(screen.queryByRole("heading", { name: guideTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });
});
