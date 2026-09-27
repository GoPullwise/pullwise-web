import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LedgerScreen } from "./ledger.jsx";

const api = vi.hoisted(() => ({
  repositories: vi.fn(), projects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(),
  categories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), archiveCategory: vi.fn(),
  project: vi.fn(), expenses: vi.fn(), createExpense: vi.fn(), updateExpense: vi.fn(),
  removeExpense: vi.fn(),
}));
vi.mock("../api/ledger.js", () => ({ ledgerApi: api }));

beforeEach(() => {
  vi.clearAllMocks();
  api.repositories.mockResolvedValue({ items: [{ githubRepoId: 202, fullName: "alice/project" }] });
  api.projects.mockResolvedValue({ items: [], nextCursor: null });
  api.categories.mockResolvedValue([]);
  api.expenses.mockResolvedValue({ items: [], nextCursor: null });
  api.project.mockResolvedValue({ id: "prj_1", githubRepoId: 202, githubFullName: "alice/project",
    description: "", status: "active", githubAccess: "authorized", revision: 1, totals: [] });
});

describe("ledger screens", () => {
  it("creates a project and shows the lost access recovery state", async () => {
    api.repositories.mockResolvedValue({ items: [{ githubRepoId: 303, fullName: "alice/new" }] });
    api.projects.mockResolvedValue({ items: [{ id: "prj_lost", githubRepoId: 202,
      githubFullName: null, description: "History", status: "active",
      githubAccess: "lost", revision: 1, totals: [{ currency: "USD", amountMinor: 200 }] }], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByText(/GitHub access lost/i)).toBeInTheDocument();
    expect(screen.getByText(/History/)).toBeInTheDocument();
    expect(screen.getByText("USD 2.00")).toBeInTheDocument();
    api.createProject.mockResolvedValue({ id: "prj_2" });
    fireEvent.change(screen.getByLabelText(/Project description/i), { target: { value: "New project" } });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith(
      { githubRepoId: 303, description: "New project" }, expect.anything()));
  });

  it("creates, edits and confirms removal of a shared expense", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", revision: 1, archivedAt: null }]);
    const expense = { id: "exp_1", target: { kind: "shared" }, occurredOn: "2026-09-27",
      amount: "12.00", amountMinor: 1200, currency: "USD", categoryId: "cat_1",
      purpose: "Hosting", note: null, quantity: null, unit: null, revision: 1 };
    api.expenses.mockResolvedValue({ items: [expense], nextCursor: null });
    api.createExpense.mockResolvedValue(expense);
    api.updateExpense.mockResolvedValue({ ...expense, revision: 2 });
    api.removeExpense.mockResolvedValue(null);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    expect(await screen.findByText("Hosting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit Hosting/i }));
    fireEvent.change(screen.getByLabelText(/Purpose/i), { target: { value: "Hosting edited" } });
    fireEvent.click(screen.getByRole("button", { name: /Save expense/i }));
    await waitFor(() => expect(api.updateExpense).toHaveBeenCalledWith(
      "exp_1", 1, expect.objectContaining({ purpose: "Hosting edited" }), expect.anything()));
    fireEvent.click(screen.getByRole("button", { name: /Remove Hosting/i }));
    expect(api.removeExpense).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Confirm removal/i }));
    await waitFor(() => expect(api.removeExpense).toHaveBeenCalledWith("exp_1", 1, expect.anything()));
  });

  it("manages categories and requires confirmation before archive", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", revision: 1, archivedAt: null }]);
    api.createCategory.mockResolvedValue({ id: "cat_2" });
    api.updateCategory.mockResolvedValue({ id: "cat_1", revision: 2 });
    api.archiveCategory.mockResolvedValue(null);
    render(<LedgerScreen go={vi.fn()} mode="categories" />);
    expect(await screen.findByText("Tools")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Hosting" } });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    await waitFor(() => expect(api.createCategory).toHaveBeenCalledWith({ name: "Hosting" }, expect.anything()));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Software" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith("cat_1", 1,
      { name: "Software", color: undefined }, expect.anything()));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(api.archiveCategory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() => expect(api.archiveCategory).toHaveBeenCalled());
  });

  it("saves the project description with its revision", async () => {
    api.updateProject.mockResolvedValue({ id: "prj_1", revision: 2 });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    expect(await screen.findByRole("heading", { name: "alice/project", level: 1 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "My repository" } });
    fireEvent.click(screen.getByRole("button", { name: "Save description" }));
    await waitFor(() => expect(api.updateProject).toHaveBeenCalledWith(
      "prj_1", 1, { description: "My repository" }, expect.anything()));
  });

  it("keeps an empty shared pool usable and shows a save conflict", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", revision: 1, archivedAt: null }]);
    api.createExpense.mockRejectedValue({ status: 412 });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    expect(await screen.findByText(/No expenses for this target yet/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Hosting" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ target: { kind: "shared" }, amount: "12.00" }),
      expect.any(String), expect.anything()));
    expect(await screen.findByText(/Save conflict/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Hosting");
  });
});
