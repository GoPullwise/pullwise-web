import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LedgerScreen } from "./ledger.jsx";

const api = vi.hoisted(() => ({
  me: vi.fn(),
  repositories: vi.fn(),
  projects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  categories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  archiveCategory: vi.fn(),
  project: vi.fn(),
  expenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  removeExpense: vi.fn(),
  reportSummary: vi.fn(),
  reportTimeseries: vi.fn(),
  reportCategories: vi.fn(),
  suggestExpense: vi.fn(),
  suggestDecision: vi.fn(),
}));
vi.mock("../api/ledger.js", () => ({ ledgerApi: api }));
const github = vi.hoisted(() => ({ connect: vi.fn(), login: vi.fn() }));
vi.mock("../lib/auth.js", () => ({ connectGitHubRepositories: github.connect, startGitHubLogin: github.login }));

beforeEach(() => {
  vi.clearAllMocks();
  api.me.mockResolvedValue({ entitlements: { jev: { eligible: true, available: true } } });
  api.repositories.mockResolvedValue({ items: [{ githubRepoId: 202, fullName: "alice/project" }] });
  api.projects.mockResolvedValue({ items: [], nextCursor: null });
  api.categories.mockResolvedValue([]);
  api.expenses.mockResolvedValue({ items: [], nextCursor: null });
  api.reportSummary.mockResolvedValue({ groups: [] });
  api.reportTimeseries.mockResolvedValue({ groups: [] });
  api.reportCategories.mockResolvedValue({ groups: [] });
  api.suggestExpense.mockResolvedValue({ status: "unavailable", suggestions: {} });
  api.suggestDecision.mockResolvedValue(null);
  api.project.mockResolvedValue({
    id: "prj_1",
    githubRepoId: 202,
    githubFullName: "alice/project",
    description: "",
    status: "active",
    githubAccess: "authorized",
    revision: 1,
    totals: [],
  });
});

describe("ledger screens", () => {
  it("keeps history editable during an unknown GitHub outage without claiming access was lost", async () => {
    api.project.mockResolvedValueOnce({ id: "prj_1", githubRepoId: 202, githubFullName: null,
      description: "", status: "active", githubAccess: "unavailable", revision: 1, totals: [] });
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.expenses.mockResolvedValue({ items: [{ id: "exp_1", target: { kind: "project", projectId: "prj_1" },
      occurredOn: "2026-09-27", amount: "1.00", amountMinor: 100, currency: "USD",
      categoryId: "cat_1", purpose: "Historic hosting", revision: 1 }], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    expect(await screen.findByText(/GitHub access could not be verified/i)).toBeInTheDocument();
    expect(screen.queryByText(/GitHub access lost/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Historic hosting" }));
    expect(await screen.findByLabelText("What did you pay for?")).toHaveValue("Historic hosting");
    expect(github.login).not.toHaveBeenCalled();
  });

  it("separates project views, supports keyboard tabs, and preserves an expense draft", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    const expensesTab = await screen.findByRole("tab", { name: "Expenses" });
    const reportsTab = screen.getByRole("tab", { name: "Reports" });
    expect(expensesTab).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("heading", { name: "Expenses over time" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting draft" },
    });
    fireEvent.keyDown(expensesTab, { key: "ArrowRight" });
    expect(reportsTab).toHaveFocus();
    expect(reportsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Expenses over time" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Continue draft" }));
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Hosting draft");
    fireEvent.click(expensesTab);
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Hosting draft");
    expect(api.expenses).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("tab", { name: "Project settings" }));
    expect(screen.getByLabelText("Description")).toBeVisible();
  });

  it("searches loaded projects and recovers from no matches without another API call", async () => {
    api.projects.mockResolvedValue({
      items: [
        { id: "prj_1", githubFullName: "alice/web", description: "Website", totals: [] },
        { id: "prj_2", githubFullName: "alice/api", description: "Backend", totals: [] },
      ],
      nextCursor: "next",
    });
    render(<LedgerScreen go={vi.fn()} />);
    const search = await screen.findByRole("searchbox", { name: "Find a project" });
    fireEvent.change(search, { target: { value: "BACKEND" } });
    expect(screen.getByRole("link", { name: /alice\/api/ })).toHaveAttribute(
      "href",
      "/projects/prj_2"
    );
    expect(screen.queryByRole("link", { name: /alice\/web/ })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByText("No matching projects")).toBeVisible();
    expect(screen.getByRole("button", { name: "Load more projects" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("link", { name: /alice\/web/ })).toBeVisible();
    expect(api.projects).toHaveBeenCalledTimes(1);
  });

  it("reveals project creation on intent and restores focus when dismissed", async () => {
    api.projects.mockResolvedValue({
      items: [{ id: "prj_1", githubRepoId: 201, githubFullName: "alice/web", totals: [] }],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} />);
    const add = await screen.findByRole("button", { name: "Add project" });
    expect(screen.queryByRole("button", { name: "Create project" })).not.toBeInTheDocument();
    fireEvent.click(add);
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Create project" })).not.toBeInTheDocument();
    expect(add).toHaveFocus();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("distinguishes a filtered empty list from a new ledger and clears the filters", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByRole("heading", { name: "Expenses" });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-01" } });
    await screen.findByText("No expenses match these filters");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByLabelText("From date")).toHaveValue(""));
    expect(screen.getByText("No expenses for this target yet.")).toBeVisible();
  });

  it("opens expense entry only on intent and closes it on cancel", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    const add = await screen.findByRole("button", { name: "Add expense" });
    expect(add).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
    fireEvent.click(add);
    expect(add).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Project or shared cost")).toHaveFocus();
    fireEvent.click(screen.getByText("More details (optional)"));
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "Manual draft" },
    });
    expect(screen.getByRole("textbox", { name: "Note (optional)" })).toHaveValue("Manual draft");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
    expect(add).toHaveFocus();
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  it("clears open expense entry when the project scope changes", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    const view = render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Draft" },
    });
    view.rerender(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    await screen.findByRole("heading", { name: "alice/project", level: 1 });
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
  });

  it("keeps historical editing available with lost access and archived categories", async () => {
    api.project.mockResolvedValue({
      id: "prj_1",
      githubFullName: "alice/project",
      githubAccess: "lost",
    });
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: "2026-09-01" }]);
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_1",
          purpose: "Hosting",
          amount: "12.00",
          currency: "USD",
          occurredOn: "2026-09-01",
          categoryId: "cat_1",
          note: "Original note",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    const edit = await screen.findByRole("button", { name: "Edit Hosting" });
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
    fireEvent.click(edit);
    expect(screen.getByLabelText("Category")).toHaveValue("cat_1");
    expect(screen.getByLabelText("Note (optional)").closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Original note");
    fireEvent.click(screen.getByRole("tab", { name: "Reports" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue draft" }));
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Original note");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(edit).toHaveFocus();
  });

  it("shows Projects as a navigable parent of the current project", async () => {
    const go = vi.fn();
    render(<LedgerScreen go={go} mode="project" projectId="prj_1" />);
    await screen.findByRole("heading", { name: "alice/project", level: 1 });
    const breadcrumbs = within(screen.getByRole("navigation", { name: "Breadcrumbs" }));
    const parent = breadcrumbs.getByRole("link", { name: "Go to Projects" });
    expect(parent).toHaveAttribute("href", "/projects");
    expect(breadcrumbs.getByText("alice/project")).toHaveAttribute("aria-current", "page");
    fireEvent.click(parent);
    expect(go).toHaveBeenCalledWith("ledgerProjects");
  });

  it("offers a visible return to the project list from the page header", async () => {
    const go = vi.fn();
    render(<LedgerScreen go={go} mode="project" projectId="prj_1" />);
    const back = await screen.findByRole("link", { name: "Back to projects" });
    expect(back).toHaveAttribute("href", "/projects");
    fireEvent.click(back);
    expect(go).toHaveBeenCalledWith("ledgerProjects");
  });

  it("keeps the return path available when project loading fails", async () => {
    api.project.mockRejectedValueOnce(new Error("Project unavailable"));
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute(
      "href",
      "/projects"
    );
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumbs" })).getByRole("link", {
        name: "Go to Projects",
      })
    ).toHaveAttribute("href", "/projects");
  });

  it("renders panel skeletons while the projects ledger loads", () => {
    api.projects.mockReturnValue(new Promise(() => {}));
    api.repositories.mockReturnValue(new Promise(() => {}));
    api.categories.mockReturnValue(new Promise(() => {}));
    api.reportSummary.mockReturnValue(new Promise(() => {}));

    render(<LedgerScreen go={vi.fn()} mode="projects" />);

    const status = screen.getByRole("status", { name: /loading ledger/i });
    expect(status.querySelectorAll(".ledger-split > .panel")).toHaveLength(3);
    expect(screen.queryByRole("heading", { name: "Your projects" })).not.toBeInTheDocument();
  });

  it("renders panel skeletons while a project detail loads", () => {
    api.categories.mockReturnValue(new Promise(() => {}));
    api.expenses.mockReturnValue(new Promise(() => {}));
    api.project.mockReturnValue(new Promise(() => {}));
    api.projects.mockReturnValue(new Promise(() => {}));
    api.reportSummary.mockReturnValue(new Promise(() => {}));
    api.reportTimeseries.mockReturnValue(new Promise(() => {}));
    api.reportCategories.mockReturnValue(new Promise(() => {}));

    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);

    const status = screen.getByRole("status", { name: /loading ledger/i });
    expect(status.querySelectorAll(".ledger-stats")).toHaveLength(1);
    expect(status.querySelectorAll(".ledger-filter-bar")).toHaveLength(1);
    expect(status.querySelectorAll(".ledger-split > .panel")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Expenses" })).not.toBeInTheDocument();
  });

  it("shows authorization failures without pretending there are authorized repositories", async () => {
    api.repositories.mockResolvedValue({ items: [], nextCursor: null });
    github.connect.mockRejectedValue(new Error("GitHub authorization was cancelled"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub authorization was cancelled"
    );
    expect(screen.getByRole("button", { name: /Manage GitHub access/i })).toBeEnabled();
  });

  it("does not navigate when creation finishes after leaving Projects", async () => {
    let finish;
    api.createProject.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const go = vi.fn();
    const view = render(<LedgerScreen go={go} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Create project/i }));
    view.unmount();
    finish({ id: "prj_late" });
    await Promise.resolve();
    expect(go).not.toHaveBeenCalled();
  });

  it("reloads repositories after GitHub authorization completes in a popup", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    github.connect.mockResolvedValue(undefined);
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(github.connect).toHaveBeenCalledTimes(1);
  });
  it("keeps authorized repositories usable when the spending summary fails", async () => {
    api.reportSummary.mockRejectedValue({ status: 503 });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(screen.getByText(/Spending summary is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub access is ready/i)).toBeInTheDocument();
    expect(screen.queryByText("No expenses in this range.")).not.toBeInTheDocument();
  });

  it("opens the new project after explicitly adding an authorized repository", async () => {
    const go = vi.fn();
    api.createProject.mockResolvedValue({ id: "prj_new" });
    render(<LedgerScreen go={go} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Create project/i }));
    await waitFor(() => expect(go).toHaveBeenCalledWith("ledgerProject", { id: "prj_new" }));
    expect(api.createProject).toHaveBeenCalledTimes(1);
  });

  it("focuses the repository picker from the empty-state call to action", async () => {
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("link", { name: /Add a repository/i }));
    expect(await screen.findByRole("combobox", { name: "Repository" })).toHaveFocus();
  });

  it("starts GitHub authorization from Add a repository when no repositories are available", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    github.connect.mockResolvedValueOnce(undefined);
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("link", { name: /Add a repository/i }));
    await waitFor(() => expect(github.connect).toHaveBeenCalledWith({ add: true }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("loads the next authorized repository page from Add a repository before reconnecting", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: "page-2" });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("link", { name: /Add a repository/i }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("opens the available repository picker instead of reconnecting GitHub", async () => {
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    const picker = await screen.findByRole("combobox", { name: "Repository" });
    picker.showPicker = vi.fn();
    fireEvent.click(screen.getByRole("link", { name: /Add a repository/i }));
    expect(picker.showPicker).toHaveBeenCalledTimes(1);
    expect(picker).toHaveFocus();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("keeps the focused picker usable when native picker opening is restricted", async () => {
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    const picker = await screen.findByRole("combobox", { name: "Repository" });
    picker.showPicker = vi.fn(() => {
      throw new DOMException("Restricted", "NotAllowedError");
    });
    fireEvent.click(screen.getByRole("link", { name: /Add a repository/i }));
    expect(picker).toHaveFocus();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("does not ask to reconnect when all visible repositories already have projects", async () => {
    api.projects.mockResolvedValue({
      items: [{ id: "prj_1", githubRepoId: 202, githubFullName: "alice/project", totals: [] }],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add project" }));
    expect(
      await screen.findByText(/These repositories are already in your projects/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Connect GitHub to add a project/i)).not.toBeInTheDocument();
  });

  it("loads later authorized repository pages before project creation", async () => {
    api.repositories
      .mockResolvedValueOnce({
        items: [{ githubRepoId: 202, fullName: "alice/first" }],
        nextCursor: "page-2",
      })
      .mockResolvedValueOnce({
        items: [{ githubRepoId: 404, fullName: "alice/later" }],
        nextCursor: null,
      });
    api.createProject.mockResolvedValue({ id: "prj_later" });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Load more repositories/i }));
    expect(await screen.findByRole("option", { name: "alice/later" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "404" } });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { githubRepoId: 404, description: "" },
        expect.anything()
      )
    );
  });

  it("creates a project and shows the lost access recovery state", async () => {
    api.repositories.mockResolvedValue({ items: [{ githubRepoId: 303, fullName: "alice/new" }] });
    api.projects.mockResolvedValue({
      items: [
        {
          id: "prj_lost",
          githubRepoId: 202,
          githubFullName: null,
          description: "History",
          status: "active",
          githubAccess: "lost",
          revision: 1,
          totals: [{ currency: "USD", amountMinor: 200 }],
        },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByText(/GitHub access lost/i)).toBeInTheDocument();
    expect(screen.getByText(/History/)).toBeInTheDocument();
    expect(screen.getByText("USD 2.00")).toBeInTheDocument();
    api.createProject.mockResolvedValue({ id: "prj_2" });
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    fireEvent.change(screen.getByLabelText(/Project description/i), {
      target: { value: "New project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { githubRepoId: 303, description: "New project" },
        expect.anything()
      )
    );
  });

  it("creates, edits and confirms removal of a shared expense", async () => {
    api.categories.mockResolvedValue([
      { id: "cat_1", name: "Tools", revision: 1, archivedAt: null },
    ]);
    const expense = {
      id: "exp_1",
      target: { kind: "shared" },
      occurredOn: "2026-09-27",
      amount: "12.00",
      amountMinor: 1200,
      currency: "USD",
      categoryId: "cat_1",
      purpose: "Hosting",
      note: null,
      quantity: null,
      unit: null,
      revision: 1,
    };
    api.expenses.mockResolvedValue({ items: [expense], nextCursor: null });
    api.createExpense.mockResolvedValue(expense);
    api.updateExpense.mockResolvedValue({ ...expense, revision: 2 });
    api.removeExpense.mockResolvedValue(null);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    expect(await screen.findByText("Hosting")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Edit Hosting/i }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save expense/i }));
    await waitFor(() =>
      expect(api.updateExpense).toHaveBeenCalledWith(
        "exp_1",
        1,
        expect.objectContaining({ purpose: "Hosting edited" }),
        expect.anything()
      )
    );
    fireEvent.click(screen.getByRole("button", { name: /Remove Hosting/i }));
    expect(api.removeExpense).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Confirm removal/i }));
    await waitFor(() =>
      expect(api.removeExpense).toHaveBeenCalledWith("exp_1", 1, expect.anything())
    );
  });

  it("manages categories and requires confirmation before archive", async () => {
    api.categories.mockResolvedValue([
      { id: "cat_1", name: "Tools", revision: 1, archivedAt: null },
    ]);
    api.createCategory.mockResolvedValue({ id: "cat_2" });
    api.updateCategory.mockResolvedValue({ id: "cat_1", revision: 2 });
    api.archiveCategory.mockResolvedValue(null);
    render(<LedgerScreen go={vi.fn()} mode="categories" />);
    expect(await screen.findByText("Tools")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Hosting" } });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith({ name: "Hosting" }, expect.anything())
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Software" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));
    await waitFor(() =>
      expect(api.updateCategory).toHaveBeenCalledWith(
        "cat_1",
        1,
        { name: "Software", color: undefined },
        expect.anything()
      )
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Rename" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(api.archiveCategory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() => expect(api.archiveCategory).toHaveBeenCalled());
  });

  it("keeps category rename and archive confirmation focused on the current action", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="categories" />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename" }));
    expect(screen.getByLabelText("New category name")).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Rename" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm archive" })).toBeInTheDocument();
    expect(api.archiveCategory).not.toHaveBeenCalled();
  });

  it("saves the project description with its revision", async () => {
    api.updateProject.mockResolvedValue({ id: "prj_1", revision: 2 });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    expect(
      await screen.findByRole("heading", { name: "alice/project", level: 1 })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Project settings" }));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "My repository" } });
    fireEvent.click(screen.getByRole("button", { name: "Save description" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith(
        "prj_1",
        1,
        { description: "My repository" },
        expect.anything()
      )
    );
  });

  it("keeps an empty shared pool usable and shows a save conflict", async () => {
    api.categories.mockResolvedValue([
      { id: "cat_1", name: "Tools", revision: 1, archivedAt: null },
    ]);
    api.createExpense.mockRejectedValue({ status: 412 });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    expect(await screen.findByText(/No expenses for this target yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() =>
      expect(api.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ target: { kind: "shared" }, amount: "12.00" }),
        expect.any(String),
        expect.anything()
      )
    );
    expect(await screen.findByText(/Save conflict/i)).toBeInTheDocument();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Hosting");
  });

  it("uses the same date and category filters for detail and charts", async () => {
    api.categories.mockResolvedValue([
      { id: "cat_1", name: "Tools", revision: 1, archivedAt: null },
    ]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByText(/No expenses for this target yet/i);
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Before date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Filter category"), { target: { value: "cat_1" } });
    await waitFor(() => {
      const expected = {
        target: "shared",
        from: "2026-09-01",
        to: "2026-10-01",
        categoryId: "cat_1",
      };
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
    api.reportSummary.mockResolvedValue({
      groups: [
        { target: "project", projectId: null, currency: "USD", amountMinor: 1000 },
        { target: "shared", projectId: null, currency: "USD", amountMinor: 500 },
        { target: "account", projectId: null, currency: "USD", amountMinor: 1500 },
        { target: "account", projectId: null, currency: "JPY", amountMinor: 120 },
      ],
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByText("USD 15.00")).toBeInTheDocument();
    expect(screen.getByText("JPY 120")).toBeInTheDocument();
    expect(screen.getByText("USD 10.00")).toBeInTheDocument();
    expect(screen.getByText("USD 5.00")).toBeInTheDocument();
  });

  it("requires confirmation before applying suggestions and keeps manual entry on failure", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.suggestExpense.mockResolvedValueOnce({
      status: "available",
      suggestionId: "sg_123",
      suggestions: { categoryId: "cat_1", targetKind: "shared", duplicateExpenseId: "exp_1" },
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByText(/No expenses for this target yet/i);
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
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
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Hosting");
  });

  it("does not request Jev for Free or Pro and keeps the manual draft", async () => {
    api.me.mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } });
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByText(/No expenses for this target yet/i);
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /request suggestion/i }));
    expect(await screen.findByText("Jev suggestions require Max.")).toBeInTheDocument();
    expect(api.suggestExpense).not.toHaveBeenCalled();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Hosting");
  });

  it("does not launch Jev after the entitlement check finishes on an unmounted draft", async () => {
    let resolveProfile;
    api.me.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        })
    );
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    const view = render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByText(/No expenses for this target yet/i);
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    const button = screen.getByRole("button", { name: /request suggestion/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.me).toHaveBeenCalledTimes(1);
    view.unmount();
    resolveProfile({ entitlements: { jev: { eligible: true, available: true } } });
    await Promise.resolve();
    expect(api.suggestExpense).not.toHaveBeenCalled();
  });
});
