import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LedgerScreen } from "./ledger.jsx";

const api = vi.hoisted(() => ({
  repositories: vi.fn(), projects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(),
  categories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), archiveCategory: vi.fn(),
  project: vi.fn(), expenses: vi.fn(), createExpense: vi.fn(), updateExpense: vi.fn(),
  removeExpense: vi.fn(), reportSummary: vi.fn(), reportTimeseries: vi.fn(),
  reportCategories: vi.fn(), suggestExpense: vi.fn(), suggestDecision: vi.fn(),
}));
vi.mock("../api/ledger.js", () => ({ ledgerApi: api }));

beforeEach(() => {
  vi.clearAllMocks();
  api.repositories.mockResolvedValue({ items: [{ githubRepoId: 202, fullName: "alice/project" }] });
  api.projects.mockResolvedValue({ items: [], nextCursor: null });
  api.categories.mockResolvedValue([]);
  api.expenses.mockResolvedValue({ items: [], nextCursor: null });
  api.reportSummary.mockResolvedValue({ groups: [] });
  api.reportTimeseries.mockResolvedValue({ groups: [] });
  api.reportCategories.mockResolvedValue({ groups: [] });
  api.suggestExpense.mockResolvedValue({ status: "unavailable", suggestions: {} });
  api.suggestDecision.mockResolvedValue(null);
  api.project.mockResolvedValue({ id: "prj_1", githubRepoId: 202, githubFullName: "alice/project",
    description: "", status: "active", githubAccess: "authorized", revision: 1, totals: [] });
});

describe("ledger screens", () => {
  it("loads later authorized repository pages before project creation", async () => {
    api.repositories.mockResolvedValueOnce({ items: [{ githubRepoId: 202, fullName: "alice/first" }], nextCursor: "page-2" })
      .mockResolvedValueOnce({ items: [{ githubRepoId: 404, fullName: "alice/later" }], nextCursor: null });
    api.createProject.mockResolvedValue({ id: "prj_later" });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Load more repositories/i }));
    expect(await screen.findByRole("option", { name: "alice/later" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "404" } });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith(
      { githubRepoId: 404, description: "" }, expect.anything()));
  });

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

  it("uses the same date and category filters for detail and charts", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", revision: 1, archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByText(/No expenses for this target yet/i);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To date (exclusive)"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Filter category"), { target: { value: "cat_1" } });
    await waitFor(() => {
      const expected = { target: "shared", from: "2026-09-01", to: "2026-10-01", categoryId: "cat_1" };
      expect(api.expenses).toHaveBeenLastCalledWith(expected, expect.anything());
      expect(api.reportTimeseries).toHaveBeenLastCalledWith(expected, expect.anything());
      expect(api.reportCategories).toHaveBeenLastCalledWith(expected, expect.anything());
    });
    const exportUrl = new URL(screen.getByRole("link", { name: "Export CSV" }).href);
    expect(exportUrl.searchParams.get("target")).toBe("shared");
    expect(exportUrl.searchParams.get("from")).toBe("2026-09-01");
    expect(exportUrl.searchParams.get("to")).toBe("2026-10-01");
    expect(exportUrl.searchParams.get("categoryId")).toBe("cat_1");
  });

  it("shows account totals per currency with project and shared costs separate", async () => {
    api.reportSummary.mockResolvedValue({ groups: [
      { target: "project", projectId: null, currency: "USD", amountMinor: 1000 },
      { target: "shared", projectId: null, currency: "USD", amountMinor: 500 },
      { target: "account", projectId: null, currency: "USD", amountMinor: 1500 },
      { target: "account", projectId: null, currency: "JPY", amountMinor: 120 },
    ] });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByText("USD 15.00")).toBeInTheDocument();
    expect(screen.getByText("JPY 120")).toBeInTheDocument();
    expect(screen.getByText("USD 10.00")).toBeInTheDocument();
    expect(screen.getByText("USD 5.00")).toBeInTheDocument();
  });

  it("requires confirmation before applying suggestions and keeps manual entry on failure", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.suggestExpense.mockResolvedValueOnce({ status: "available", suggestionId: "sg_123",
      suggestions: { categoryId: "cat_1", targetKind: "shared", duplicateExpenseId: "exp_1" } });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByText(/No expenses for this target yet/i);
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Hosting" } });
    fireEvent.click(screen.getByRole("button", { name: /request suggestion/i }));
    expect(await screen.findByText(/^Possible duplicate:/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toHaveValue("");
    fireEvent.click(screen.getByLabelText(/I reviewed the possible duplicate/i));
    fireEvent.click(screen.getByRole("button", { name: /use suggestion/i }));
    expect(screen.getByLabelText("Category")).toHaveValue("cat_1");
    expect(api.createExpense).not.toHaveBeenCalled();
    expect(api.suggestDecision).toHaveBeenCalled();
    api.suggestExpense.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: /request suggestion/i }));
    expect(await screen.findByText(/Suggestion unavailable/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Hosting");
  });
});
