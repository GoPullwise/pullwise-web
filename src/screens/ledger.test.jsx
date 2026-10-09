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
  recurringRules: vi.fn(),
  createRecurringRule: vi.fn(),
  updateRecurringRule: vi.fn(),
  removeRecurringRule: vi.fn(),
  reportSummary: vi.fn(),
  reportTimeseries: vi.fn(),
  reportCategories: vi.fn(),
  suggestExpense: vi.fn(),
  suggestDecision: vi.fn(),
}));
vi.mock("../api/ledger.js", () => ({ ledgerApi: api }));
const github = vi.hoisted(() => ({ connect: vi.fn(), login: vi.fn() }));
vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: github.connect,
  startGitHubLogin: github.login,
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.me.mockResolvedValue({ entitlements: { jev: { eligible: true, available: true } } });
  api.repositories.mockResolvedValue({ items: [{ githubRepoId: 202, fullName: "alice/project" }] });
  api.projects.mockResolvedValue({ items: [], nextCursor: null });
  api.categories.mockResolvedValue([]);
  api.expenses.mockResolvedValue({ items: [], nextCursor: null });
  api.recurringRules.mockResolvedValue({ items: [], nextCursor: null });
  api.createExpense.mockResolvedValue({ id: "exp_saved", categoryId: "cat_1" });
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

async function openGitHubLinks() {
  const summary = await screen.findByText("Link GitHub repositories (optional)", {
    selector: "summary",
  });
  fireEvent.click(summary);
  await waitFor(() => expect(summary.parentElement).toHaveAttribute("open"));
  await waitFor(() => expect(screen.queryByText("Loading repositories…")).not.toBeInTheDocument());
}

async function openFilters() {
  const button = await screen.findByRole("button", { name: "Filters" });
  await waitFor(() => expect(button).toBeEnabled());
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
  await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "true"));
  expect(document.getElementById(button.getAttribute("aria-controls"))).toBeVisible();
}

describe("ledger screens", () => {
  it("records an expense in a standalone project without requesting GitHub repository access", async () => {
    const project = {
      id: "prj_blank",
      name: "Operating costs",
      githubRepoId: null,
      githubRepoIds: [],
      repositories: [],
      githubOrganizationId: null,
      description: "",
      status: "active",
      githubAccess: "not_linked",
      canCreateExpense: true,
      revision: 1,
      totals: [],
    };
    api.project.mockResolvedValue(project);
    api.projects.mockResolvedValue({ items: [project], nextCursor: null });
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.me.mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId={project.id} />);
    expect(await screen.findByText("No repositories linked")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
    expect(screen.queryByLabelText("Project or shared cost")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-07" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "4.00" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Local hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.calls[0][0]).toMatchObject({
      target: { kind: "project", projectId: project.id },
      purpose: "Local hosting",
      amount: "4.00",
      categoryId: "cat_1",
    });
    expect(api.createExpense.mock.calls[0][1]).toMatch(/^[a-f0-9]{32}$/);
    expect(api.repositories).not.toHaveBeenCalled();
    expect(github.connect).not.toHaveBeenCalled();
    expect(github.login).not.toHaveBeenCalled();
  });

  it.each([
    { mode: "project", target: { kind: "project", projectId: "prj_1" } },
    { mode: "shared", target: { kind: "shared" } },
  ])(
    "creates only in the current $mode scope with other projects available",
    async ({ mode, target }) => {
      api.projects.mockResolvedValue({
        items: [
          { id: "prj_1", name: "Current project", totals: [] },
          { id: "prj_other", name: "Other project", totals: [] },
        ],
        nextCursor: null,
      });
      api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
      api.me.mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } });
      render(
        <LedgerScreen go={vi.fn()} mode={mode} projectId={mode === "project" ? "prj_1" : ""} />
      );
      fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
      expect(screen.queryByLabelText("Project or shared cost")).not.toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Other project" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Date")).toHaveFocus();
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-08" } });
      fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "9.25" } });
      fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
      fireEvent.change(screen.getByLabelText("What did you pay for?"), {
        target: { value: "Scoped hosting" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
      expect(api.createExpense.mock.calls[0][0]).toMatchObject({
        target,
        occurredOn: "2026-10-08",
        amount: "9.25",
        currency: "USD",
        categoryId: "cat_1",
        purpose: "Scoped hosting",
      });
      expect(api.createExpense.mock.calls[0][1]).toMatch(/^[a-f0-9]{32}$/);
      expect(api.updateExpense).not.toHaveBeenCalled();
    }
  );

  it("shows actor-visible repository metadata to a Viewer without exposing lost names or project write controls", async () => {
    api.project.mockResolvedValue({
      id: "prj_1",
      name: "Platform",
      githubRepoIds: [202, 303],
      repositories: [
        { githubRepoId: 202, githubFullName: "hidden/old-private-name", githubAccess: "lost" },
        { githubRepoId: 303, githubFullName: "team/api", githubAccess: "authorized" },
      ],
      githubOrganization: { id: 8, login: "team", githubAccess: "authorized" },
      status: "active",
      githubAccess: "partial",
      canCreateExpense: true,
      description: "Platform costs",
      revision: 4,
      totals: [],
    });
    render(
      <LedgerScreen
        go={vi.fn()}
        mode="project"
        projectId="prj_1"
        workspace={{
          id: "usr_team",
          revision: 1,
          permissions: { manageProjects: false, manageCategories: false, writeExpenses: false },
        }}
      />
    );
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    const settings = within(screen.getByRole("tabpanel", { name: "Project settings" }));
    expect(settings.getByText("team/api")).toBeVisible();
    expect(settings.getByText("Repository #202")).toBeVisible();
    expect(screen.queryByText("hidden/old-private-name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(api.repositories).not.toHaveBeenCalled();
  });

  it("preserves historical expenses and an unsaved draft when GitHub access changes during creation", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.me.mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } });
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_1",
          target: { kind: "project", projectId: "prj_1" },
          occurredOn: "2026-09-27",
          amount: "12.00",
          currency: "USD",
          categoryId: "cat_1",
          purpose: "Historical hosting",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
    api.createExpense.mockRejectedValueOnce({
      status: 403,
      payload: { error: { code: "GITHUB_ACCESS_REQUIRED" } },
    });
    const changed = vi.fn();
    render(
      <LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" onAccessChanged={changed} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-06" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "4.00" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Unsaved domain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByText(
      "Repository access changed. Reload repositories and choose ones you can access."
    );
    expect(screen.getByText("Historical hosting")).toBeVisible();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Unsaved domain");
    expect(changed).not.toHaveBeenCalled();
    expect(api.createExpense).toHaveBeenCalledTimes(1);
  });

  it("keeps a Viewer read-only while exporting the selected workspace", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_1",
          target: { kind: "shared" },
          occurredOn: "2026-09-27",
          amount: "12.00",
          amountMinor: 1200,
          currency: "USD",
          categoryId: "cat_1",
          purpose: "Shared hosting",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
    const workspace = {
      id: "usr_team",
      role: "viewer",
      revision: 2,
      permissions: { manageProjects: false, manageCategories: false, writeExpenses: false },
    };
    render(<LedgerScreen go={vi.fn()} mode="shared" workspace={workspace} />);
    expect(await screen.findByText("Shared hosting")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Shared hosting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Shared hosting" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export CSV" })).toHaveAttribute(
      "href",
      expect.stringContaining("workspaceId=usr_team")
    );
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  it("uses the injected scoped API and clears an expense draft after a role downgrade", async () => {
    const scoped = {
      ...api,
      categories: vi.fn().mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]),
    };
    const workspace = {
      id: "usr_team",
      role: "editor",
      revision: 1,
      permissions: { manageProjects: false, manageCategories: false, writeExpenses: true },
    };
    const view = render(
      <LedgerScreen go={vi.fn()} mode="shared" api={scoped} workspace={workspace} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Team draft" },
    });
    expect(scoped.categories).toHaveBeenCalledTimes(1);
    view.rerender(
      <LedgerScreen
        go={vi.fn()}
        mode="shared"
        api={scoped}
        workspace={{
          ...workspace,
          role: "viewer",
          revision: 2,
          permissions: { ...workspace.permissions, writeExpenses: false },
        }}
      />
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("What did you pay for?")).not.toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });

  it("uses a project's independent name without exposing unavailable repository metadata", async () => {
    api.project.mockResolvedValue({
      id: "prj_1",
      name: "Platform costs",
      githubRepoId: 202,
      githubFullName: null,
      repositories: [{ githubRepoId: 202, githubFullName: null, githubAccess: "lost" }],
      description: "",
      githubAccess: "lost",
      canCreateExpense: false,
      revision: 1,
      totals: [],
    });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Platform costs" })).toBeVisible();
    expect(screen.queryByText("alice/project")).not.toBeInTheDocument();
  });

  it("allows new expenses with partial GitHub access only when the Server explicitly permits creation", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    const project = {
      id: "prj_1",
      name: "Platform",
      githubRepoIds: [202, 303],
      repositories: [
        { githubRepoId: 202, githubFullName: null, githubAccess: "lost" },
        { githubRepoId: 303, githubFullName: "team/api", githubAccess: "authorized" },
      ],
      status: "active",
      githubAccess: "partial",
      canCreateExpense: true,
      revision: 4,
      totals: [],
    };
    api.project.mockResolvedValue(project);
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    expect(await screen.findByRole("button", { name: "Add expense" })).toBeEnabled();
    api.project.mockResolvedValue({ ...project, canCreateExpense: false });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument()
    );
  });

  it("uses the selected workspace profile for automatic categorization", async () => {
    const scoped = {
      ...api,
      categories: vi.fn().mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]),
      me: vi
        .fn()
        .mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } }),
    };
    const workspace = { id: "usr_team", revision: 1, permissions: { writeExpenses: true } };
    render(<LedgerScreen go={vi.fn()} mode="shared" api={scoped} workspace={workspace} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(scoped.me).toHaveBeenCalledTimes(1));
    expect(api.me).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Category")).toBeRequired();
  });

  it("keeps categories read-only for an Editor even though expense writes are permitted", async () => {
    api.categories.mockResolvedValue([
      { id: "cat_1", name: "Tools", revision: 1, archivedAt: null },
    ]);
    render(
      <LedgerScreen
        go={vi.fn()}
        mode="categories"
        workspace={{
          id: "usr_team",
          revision: 1,
          permissions: { writeExpenses: true, manageCategories: false },
        }}
      />
    );
    expect(await screen.findByText("Tools")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Category name")).not.toBeInTheDocument();
  });

  it("clears protected expenses and their editor after a rejected membership write without retrying", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_1",
          target: { kind: "shared" },
          occurredOn: "2026-09-27",
          amount: "12.00",
          currency: "USD",
          categoryId: "cat_1",
          purpose: "Private hosting",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
    const failure = { status: 403, payload: { error: { code: "ROLE_FORBIDDEN" } } };
    api.updateExpense.mockRejectedValueOnce(failure);
    const changed = vi.fn();
    render(
      <LedgerScreen
        go={vi.fn()}
        mode="shared"
        onAccessChanged={changed}
        workspace={{ id: "usr_team", revision: 1, permissions: { writeExpenses: true } }}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Edit Private hosting" }));
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(failure));
    expect(screen.queryByText("Private hosting")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("What did you pay for?")).not.toBeInTheDocument();
    expect(api.updateExpense).toHaveBeenCalledTimes(1);
    expect(api.expenses).toHaveBeenCalledTimes(1);
  });

  it("updates repository bindings and independent name using the project revision", async () => {
    api.project.mockResolvedValue({
      id: "prj_1",
      name: "Old platform",
      githubRepoIds: [202],
      repositories: [{ githubRepoId: 202, githubFullName: "team/web", githubAccess: "authorized" }],
      status: "active",
      githubAccess: "authorized",
      canCreateExpense: true,
      description: "Existing description",
      revision: 8,
      totals: [],
    });
    api.repositories.mockResolvedValue({
      items: [
        { githubRepoId: 202, fullName: "team/web" },
        { githubRepoId: 303, fullName: "team/api" },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Platform" },
    });
    fireEvent.click(await screen.findByRole("checkbox", { name: "team/api" }));
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith(
        "prj_1",
        8,
        { name: "Platform", githubRepoIds: [202, 303], description: "Existing description" },
        {}
      )
    );
  });

  it("preserves redacted bindings during a financial-name edit without attempting repository reauthorization", async () => {
    api.project.mockResolvedValue({
      id: "prj_1",
      name: "Old platform",
      githubRepoIds: [202],
      repositories: [{ githubRepoId: 202, githubFullName: null, githubAccess: "lost" }],
      status: "active",
      githubAccess: "lost",
      canCreateExpense: false,
      description: "",
      revision: 9,
      totals: [],
    });
    api.repositories.mockResolvedValue({ items: [], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    expect(screen.getByRole("checkbox", { name: "Repository #202" })).toBeChecked();
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Retained hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith(
        "prj_1",
        9,
        { name: "Retained hosting", description: "" },
        {}
      )
    );
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("archives and reactivates a project while retaining historical expenses and its repository association", async () => {
    const project = {
      id: "prj_1",
      name: "Platform",
      githubRepoIds: [202],
      repositories: [{ githubRepoId: 202, githubFullName: "team/web", githubAccess: "authorized" }],
      status: "active",
      githubAccess: "authorized",
      canCreateExpense: true,
      description: "",
      revision: 8,
      totals: [],
    };
    api.project.mockResolvedValue(project);
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_1",
          purpose: "Historical hosting",
          categoryId: "cat_1",
          amount: "12.00",
          currency: "USD",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
    api.updateProject.mockImplementation(async (_id, revision, fields) => {
      Object.assign(project, fields, {
        revision: revision + 1,
        canCreateExpense: fields.status === "active",
      });
      return project;
    });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "archived" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await screen.findByText(/This project is archived/);
    expect(api.updateProject).toHaveBeenCalledWith(
      "prj_1",
      8,
      { description: "", status: "archived" },
      {}
    );
    expect(screen.getByLabelText("Project status")).toHaveValue("archived");
    fireEvent.click(screen.getByRole("tab", { name: "Expenses" }));
    expect(screen.getByText("Historical hosting")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Historical hosting" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Export CSV" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Project settings" }));
    fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(screen.queryByText(/This project is archived/)).not.toBeInTheDocument()
    );
    expect(api.updateProject).toHaveBeenLastCalledWith(
      "prj_1",
      9,
      { description: "", status: "active" },
      {}
    );
    expect(screen.getByRole("button", { name: "Add expense" })).toBeEnabled();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("retains an unsaved project-settings draft and its revision across filtered reads until explicit reload", async () => {
    const original = {
      id: "prj_1",
      name: "Original",
      githubRepoIds: [202],
      description: "Original description",
      status: "active",
      githubAccess: "authorized",
      revision: 7,
      totals: [],
    };
    api.project.mockResolvedValueOnce(original).mockResolvedValue({
      ...original,
      name: "Another member's name",
      description: "Another member's description",
      revision: 8,
    });
    api.updateProject.mockRejectedValueOnce({ status: 412 });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Unsaved name" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Unsaved description" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Expenses" }));
    await openFilters();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(api.project).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reload" })).toBeEnabled());
    fireEvent.click(screen.getByRole("tab", { name: "Project settings" }));
    expect(screen.getByLabelText("Project name")).toHaveValue("Unsaved name");
    expect(screen.getByLabelText("Description")).toHaveValue("Unsaved description");
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await screen.findByText(/Save conflict/);
    expect(api.updateProject).toHaveBeenCalledWith(
      "prj_1",
      7,
      { name: "Unsaved name", description: "Unsaved description" },
      {}
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Project name")).toHaveValue("Another member's name")
    );
    expect(screen.getByLabelText("Description")).toHaveValue("Another member's description");
  });

  it("labels retained filter results as updating while preserving the open expense draft", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    const previous = {
      id: "exp_1",
      target: { kind: "shared" },
      occurredOn: "2026-09-27",
      amount: "12.00",
      amountMinor: 1200,
      currency: "USD",
      categoryId: "cat_1",
      purpose: "Existing hosting",
      revision: 1,
    };
    api.expenses.mockResolvedValue({ items: [previous], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Unsaved draft" },
    });
    let finish;
    api.expenses.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await openFilters();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-01" } });
    expect(
      await screen.findByText("Updating results… Previous results remain visible.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit Existing hosting" })).toBeInTheDocument();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Unsaved draft");
    expect(screen.getByRole("tabpanel", { name: "Expenses" })).toHaveAttribute("aria-busy", "true");
    const reports = document.getElementById(
      screen.getByRole("tab", { name: "Reports" }).getAttribute("aria-controls")
    );
    expect(reports).not.toBeVisible();
    expect(reports).toHaveAttribute("aria-busy", "true");
    finish({ items: [previous], nextCursor: null });
    await waitFor(() =>
      expect(
        screen.queryByText("Updating results… Previous results remain visible.")
      ).not.toBeInTheDocument()
    );
    expect(screen.getByRole("tabpanel", { name: "Expenses" })).toHaveAttribute(
      "aria-busy",
      "false"
    );
    expect(reports).toHaveAttribute("aria-busy", "false");
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Unsaved draft");
  });
  it.each(["project", "shared"])(
    "retains $s history and editing when chart reports fail",
    async (mode) => {
      api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
      api.expenses.mockResolvedValue({
        items: [
          {
            id: "exp_1",
            target:
              mode === "project" ? { kind: "project", projectId: "prj_1" } : { kind: "shared" },
            occurredOn: "2026-09-27",
            amount: "12.00",
            amountMinor: 1200,
            currency: "USD",
            categoryId: "cat_1",
            purpose: "Existing hosting",
            revision: 1,
          },
        ],
        nextCursor: null,
      });
      api.reportTimeseries.mockRejectedValue(new Error("Trend offline"));
      api.reportCategories.mockRejectedValue(new Error("Category chart offline"));
      render(
        <LedgerScreen go={vi.fn()} mode={mode} projectId={mode === "project" ? "prj_1" : ""} />
      );
      const edit = await screen.findByRole("button", { name: "Edit Existing hosting" });
      fireEvent.click(edit);
      expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Existing hosting");
      fireEvent.click(screen.getByRole("tab", { name: "Reports" }));
      const reports = screen.getByRole("tabpanel", { name: "Reports" });
      for (const title of ["Expenses over time", "Expenses by category"]) {
        const chart = within(reports).getByRole("heading", { name: title }).closest("section");
        expect(within(chart).getByText(/This report is unavailable/i)).toBeVisible();
        expect(within(chart).queryByText("No expenses in this range.")).not.toBeInTheDocument();
      }
      expect(
        screen.queryByRole("heading", { name: "Totals by currency", hidden: true })
      ).not.toBeInTheDocument();
      expect(
        reports.querySelector(".ledger-stat, .ledger-stats, .ledger-report-totals")
      ).not.toBeInTheDocument();
      expect(api.reportSummary).not.toHaveBeenCalled();
    }
  );
  it("keeps history editable during an unknown GitHub outage without claiming access was lost", async () => {
    api.project.mockResolvedValueOnce({
      id: "prj_1",
      githubRepoId: 202,
      githubFullName: null,
      description: "",
      status: "active",
      githubAccess: "unavailable",
      revision: 1,
      totals: [],
    });
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_1",
          target: { kind: "project", projectId: "prj_1" },
          occurredOn: "2026-09-27",
          amount: "1.00",
          amountMinor: 100,
          currency: "USD",
          categoryId: "cat_1",
          purpose: "Historic hosting",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
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

  it("shows only product shortcuts beside projects without GitHub or development metadata", async () => {
    api.projects.mockResolvedValue({
      items: [
        {
          id: "prj_multi",
          name: "Infrastructure",
          description: "Cloud services",
          githubRepoIds: [201, 303],
          repositories: [
            { githubRepoId: 201, githubFullName: "alice/api", githubAccess: "authorized" },
            { githubRepoId: 303, githubFullName: "stale/private", githubAccess: "lost" },
          ],
          githubOrganization: { login: "stale-organization", githubAccess: "lost" },
          githubAccess: "partial",
          productUrl: "https://platform.example/",
          totals: [{ currency: "USD", amountMinor: 200 }],
        },
        {
          id: "prj_single",
          name: "Website",
          githubRepoIds: [404],
          repositories: [
            { githubRepoId: 404, githubFullName: "alice/web", githubAccess: "authorized" },
          ],
          githubOrganization: { login: "alice-team", githubAccess: "authorized" },
          githubAccess: "authorized",
          productUrl: "https://website.example/",
          totals: [],
        },
        {
          id: "prj_standalone",
          name: "Standalone project",
          githubRepoIds: [],
          repositories: [],
          githubAccess: "not_linked",
          developmentUrl: "https://development.example/",
          totals: [],
        },
        {
          id: "prj_legacy",
          name: "Legacy project",
          githubRepoId: 505,
          githubFullName: "stale/legacy",
          githubAccess: "unavailable",
          totals: [],
        },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    const infrastructure = (await screen.findByRole("link", { name: "Infrastructure" })).closest(
      "article"
    );
    const website = screen.getByRole("link", { name: "Website" }).closest("article");
    expect(within(infrastructure).getByRole("link", { name: "Product" })).toHaveAttribute(
      "href",
      "https://platform.example/"
    );
    expect(within(website).getByRole("link", { name: "Product" })).toHaveAttribute(
      "href",
      "https://website.example/"
    );
    expect(screen.getAllByRole("link", { name: "Product" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Development" })).not.toBeInTheDocument();
    for (const metadata of [
      "2 repositories",
      "alice/api",
      "alice/web",
      "alice-team",
      "stale/private",
      "stale-organization",
      "stale/legacy",
      "Repository #303",
      "GitHub access lost",
      "GitHub access could not be verified",
      "No repositories linked",
    ]) {
      expect(screen.queryByText(metadata)).not.toBeInTheDocument();
    }
    expect(api.repositories).not.toHaveBeenCalled();
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
    expect(screen.getByLabelText("Project name")).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Create project" })).not.toBeInTheDocument();
    expect(add).toHaveFocus();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("distinguishes a filtered empty list from a new ledger and clears the filters", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    await screen.findByRole("heading", { name: "Expenses" });
    await openFilters();
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
    expect(screen.queryByLabelText("Project or shared cost")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveFocus();
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
    expect(screen.getByText("Expenses and reports for this project.")).toBeVisible();
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
    expect(screen.getByRole("heading", { name: "Project expenses", level: 1 })).toBeVisible();
    expect(screen.getByText("Unable to load project expenses.")).toBeVisible();
    expect(screen.queryByText("Project history")).not.toBeInTheDocument();
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
    expect(status.querySelectorAll(".ledger-split > .panel")).toHaveLength(2);
    expect(status.querySelector(".ledger-overview")).not.toBeInTheDocument();
    expect(api.categories).not.toHaveBeenCalled();
    expect(api.reportSummary).not.toHaveBeenCalled();
    expect(api.reportTimeseries).not.toHaveBeenCalled();
    expect(api.reportCategories).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Your projects" })).not.toBeInTheDocument();
  });

  it.each(["project", "shared"])("renders only record skeletons while $s expenses load", (mode) => {
    api.categories.mockReturnValue(new Promise(() => {}));
    api.expenses.mockReturnValue(new Promise(() => {}));
    api.project.mockReturnValue(new Promise(() => {}));
    api.projects.mockReturnValue(new Promise(() => {}));
    api.reportSummary.mockReturnValue(new Promise(() => {}));
    api.reportTimeseries.mockReturnValue(new Promise(() => {}));
    api.reportCategories.mockReturnValue(new Promise(() => {}));

    render(<LedgerScreen go={vi.fn()} mode={mode} projectId={mode === "project" ? "prj_1" : ""} />);

    expect(
      screen.getByRole("heading", {
        name: mode === "project" ? "Project expenses" : "Shared expense pool",
        level: 1,
      })
    ).toBeVisible();
    if (mode === "project") expect(screen.getByText("Loading project expenses…")).toBeVisible();
    expect(screen.queryByText("Project history")).not.toBeInTheDocument();
    const status = screen.getByRole("status", {
      name: mode === "project" ? /loading project expenses/i : /loading ledger/i,
    });
    expect(status.querySelectorAll(".panel")).toHaveLength(1);
    expect(status.querySelectorAll(".ledger-stats")).toHaveLength(0);
    expect(status.querySelectorAll(".ledger-filter-bar")).toHaveLength(0);
    expect(status.querySelectorAll(".ledger-split > .panel")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Expenses" })).not.toBeInTheDocument();
  });

  it("shows authorization failures without pretending there are authorized repositories", async () => {
    api.repositories.mockResolvedValue({ items: [], nextCursor: null });
    github.connect.mockRejectedValue(new Error("GitHub authorization was cancelled"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
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
    fireEvent.change(await screen.findByLabelText("Project name"), {
      target: { value: "My project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    view.unmount();
    finish({ id: "prj_late" });
    await Promise.resolve();
    expect(go).not.toHaveBeenCalled();
  });

  it("reloads repositories after explicitly managing GitHub authorization in a popup", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    github.connect.mockResolvedValue(undefined);
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(github.connect).toHaveBeenCalledTimes(1);
  });

  it("loads Projects and optional repository linking without category or report requests", async () => {
    api.reportSummary.mockRejectedValue({ status: 503 });
    api.reportTimeseries.mockRejectedValue({ status: 503 });
    api.reportCategories.mockRejectedValue({ status: 503 });
    api.categories.mockRejectedValue({ status: 503 });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(screen.getByText(/Choose one to thirty authorized repositories/i)).toBeInTheDocument();
    expect(api.projects).toHaveBeenCalledTimes(1);
    expect(api.categories).not.toHaveBeenCalled();
    expect(api.reportSummary).not.toHaveBeenCalled();
    expect(api.reportTimeseries).not.toHaveBeenCalled();
    expect(api.reportCategories).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Ledger overview" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("From date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Before date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter category")).not.toBeInTheDocument();
    expect(screen.queryByText(/Spending summary is unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText("No expenses in this range.")).not.toBeInTheDocument();
  });

  it("opens the new project after explicitly linking an authorized repository", async () => {
    const go = vi.fn();
    api.createProject.mockResolvedValue({ id: "prj_new" });
    render(<LedgerScreen go={go} mode="projects" />);
    fireEvent.change(await screen.findByLabelText("Project name"), {
      target: { value: "My project" },
    });
    await openGitHubLinks();
    fireEvent.change(await screen.findByLabelText("Repository"), { target: { value: "202" } });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() => expect(go).toHaveBeenCalledWith("ledgerProject", { id: "prj_new" }));
    expect(api.createProject).toHaveBeenCalledWith(
      { name: "My project", description: "", githubRepoIds: [202] },
      {}
    );
  });

  it("focuses the project name from the empty-state call to action without GitHub authorization", async () => {
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("link", { name: "Add project" }));
    expect(screen.getByLabelText("Project name")).toHaveFocus();
    expect(api.repositories).not.toHaveBeenCalled();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("keeps GitHub authorization explicit when no repositories are available", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    github.connect.mockResolvedValueOnce(undefined);
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("link", { name: "Add project" }));
    expect(api.repositories).not.toHaveBeenCalled();
    await openGitHubLinks();
    await screen.findByText(/No repositories are available yet/);
    expect(github.connect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Manage GitHub access" }));
    await waitFor(() => expect(github.connect).toHaveBeenCalledWith({ add: true }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("loads the next authorized repository page only from the optional linking action", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: "page-2" });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    const more = await screen.findByRole("button", { name: "Load more repositories" });
    expect(api.repositories).toHaveBeenCalledTimes(1);
    fireEvent.click(more);
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(github.connect).not.toHaveBeenCalled();
    expect(api.repositories).toHaveBeenCalledTimes(2);
  });

  it("does not implicitly select the first available repository", async () => {
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    expect(await screen.findByRole("combobox", { name: "Repository" })).toHaveValue("");
    expect(github.connect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
  });

  it("preserves the project name when optional linking is opened and closed", async () => {
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.change(await screen.findByLabelText("Project name"), {
      target: { value: "Manual project" },
    });
    await openGitHubLinks();
    await screen.findByRole("combobox", { name: "Repository" });
    fireEvent.click(
      screen.getByText("Link GitHub repositories (optional)", { selector: "summary" })
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled()
    );
    expect(screen.getByLabelText("Project name")).toHaveValue("Manual project");
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("does not ask to reconnect when all visible repositories already have projects", async () => {
    api.projects.mockResolvedValue({
      items: [{ id: "prj_1", githubRepoId: 202, githubFullName: "alice/project", totals: [] }],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add project" }));
    await openGitHubLinks();
    expect(
      await screen.findByText(/These repositories are already in your projects/i)
    ).toBeInTheDocument();
    expect(github.connect).not.toHaveBeenCalled();
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
    fireEvent.change(await screen.findByLabelText("Project name"), {
      target: { value: "Later project" },
    });
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: /Load more repositories/i }));
    expect(await screen.findByRole("option", { name: "alice/later" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "404" } });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { name: "Later project", githubRepoIds: [404], description: "" },
        expect.anything()
      )
    );
  });

  it("retains existing project expenses and permits creation without list access warnings", async () => {
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
    expect(await screen.findByRole("link", { name: "History" })).toBeVisible();
    expect(screen.queryByText(/GitHub access lost/i)).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("link", { name: "History" })
        .closest("article")
        .querySelector(".financial-value").textContent
    ).toBe("USD 2.00");
    api.createProject.mockResolvedValue({ id: "prj_2" });
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "New project" } });
    await openGitHubLinks();
    fireEvent.change(await screen.findByLabelText("Repository"), { target: { value: "303" } });
    fireEvent.change(screen.getByLabelText(/Project description/i), {
      target: { value: "New project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { name: "New project", githubRepoIds: [303], description: "New project" },
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
    expect(screen.queryByLabelText("Project or shared cost")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save expense/i }));
    await waitFor(() =>
      expect(api.updateExpense).toHaveBeenCalledWith(
        "exp_1",
        1,
        expect.objectContaining({ purpose: "Hosting edited", target: { kind: "shared" } }),
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

  it("preserves a historical project expense target and revision when editing", async () => {
    api.projects.mockResolvedValue({
      items: [
        { id: "prj_1", name: "Current project", totals: [] },
        { id: "prj_other", name: "Other project", totals: [] },
      ],
      nextCursor: null,
    });
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    const expense = {
      id: "exp_project",
      target: { kind: "project", projectId: "prj_1" },
      occurredOn: "2026-09-27",
      amount: "12.00",
      amountMinor: 1200,
      currency: "USD",
      categoryId: "cat_1",
      purpose: "Project hosting",
      revision: 7,
    };
    api.expenses.mockResolvedValue({ items: [expense], nextCursor: null });
    api.updateExpense.mockResolvedValue({
      ...expense,
      purpose: "Project hosting edited",
      revision: 8,
    });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Project hosting" }));
    expect(screen.queryByLabelText("Project or shared cost")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Other project" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Date")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Project hosting edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() =>
      expect(api.updateExpense).toHaveBeenCalledWith(
        "exp_project",
        7,
        expect.objectContaining({
          target: { kind: "project", projectId: "prj_1" },
          purpose: "Project hosting edited",
          categoryId: "cat_1",
          amount: "12.00",
        }),
        expect.anything()
      )
    );
    expect(api.createExpense).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
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
    await openFilters();
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

  it("shows each project's exact expense totals independently by currency", async () => {
    api.projects.mockResolvedValue({
      items: [
        {
          id: "prj_platform",
          name: "Platform expenses",
          githubAccess: "not_linked",
          totals: [
            { currency: "USD", amountMinor: "18014398509481982" },
            { currency: "JPY", amountMinor: 120 },
            { currency: "KRW", amountMinor: 500 },
          ],
        },
        {
          id: "prj_website",
          name: "Website expenses",
          githubAccess: "not_linked",
          totals: [
            { currency: "USD", amountMinor: 500 },
            { currency: "EUR", amountMinor: 1000 },
          ],
        },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    const platform = (await screen.findByRole("link", { name: "Platform expenses" })).closest(
      "article"
    );
    const website = screen.getByRole("link", { name: "Website expenses" }).closest("article");
    expect(
      [...platform.querySelectorAll(".financial-value")].map((value) => value.textContent)
    ).toEqual(["USD 180,143,985,094,819.82", "JPY 120", "KRW 500"]);
    expect(
      [...website.querySelectorAll(".financial-value")].map((value) => value.textContent)
    ).toEqual(["USD 5.00", "EUR 10.00"]);
    expect(api.reportSummary).not.toHaveBeenCalled();
  });

  it("renders exact large and zero chart amounts without rounding plotted proportions", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.reportTimeseries.mockResolvedValue({
      groups: [
        { bucket: "2026-09-01", currency: "USD", amountMinor: "18014398509481982" },
        { bucket: "2026-09-02", currency: "USD", amountMinor: 9007199254740991 },
        { bucket: "2026-09-03", currency: "USD", amountMinor: 0 },
      ],
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Reports" }));
    const chart = screen.getByRole("heading", { name: "Expenses over time" }).closest("section");
    const currencyChart = chart.querySelector('figure.expense-chart[data-currency="USD"]');
    for (const [date, amount] of [
      ["2026-09-01", "USD 180,143,985,094,819.82"],
      ["2026-09-02", "USD 90,071,992,547,409.91"],
      ["2026-09-03", "USD 0.00"],
    ]) {
      fireEvent.click(within(currencyChart).getByRole("button", { name: new RegExp(date) }));
      const value = currencyChart.querySelector(".financial-value");
      expect(value).toBeVisible();
      expect(value.textContent).toBe(amount);
    }
    expect(
      [...currencyChart.querySelectorAll(".expense-chart-point")].map((point) =>
        Number(point.dataset.y)
      )
    ).toEqual([12, 100, 188]);
    expect(
      screen.queryByRole("heading", { name: "Totals by currency", hidden: true })
    ).not.toBeInTheDocument();
    expect(api.reportSummary).not.toHaveBeenCalled();
  });

  it("scales each currency independently in trend and category charts", async () => {
    api.reportTimeseries.mockResolvedValue({
      groups: [
        { bucket: "2026-09-01", currency: "USD", amountMinor: "18014398509481982" },
        { bucket: "2026-09-02", currency: "USD", amountMinor: 9007199254740991 },
        { bucket: "2026-09-01", currency: "JPY", amountMinor: 200 },
        { bucket: "2026-09-02", currency: "JPY", amountMinor: 100 },
        { bucket: "2026-09-01", currency: "KRW", amountMinor: 0 },
      ],
    });
    api.reportCategories.mockResolvedValue({
      groups: [
        { categoryId: "cat_1", currency: "USD", amountMinor: 10000 },
        { categoryId: "cat_2", currency: "USD", amountMinor: 2500 },
        { categoryId: "cat_1", currency: "JPY", amountMinor: 120 },
        { categoryId: "cat_2", currency: "JPY", amountMinor: 30 },
      ],
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Reports" }));
    const timeseries = screen
      .getByRole("heading", { name: "Expenses over time" })
      .closest("section");
    const categories = screen
      .getByRole("heading", { name: "Expenses by category" })
      .closest("section");
    expect(within(timeseries).getByText("Each currency has its own scale.")).toBeVisible();
    expect(within(categories).getByText("Each currency has its own scale.")).toBeVisible();
    for (const currency of ["USD", "JPY"]) {
      const trend = timeseries.querySelector(`figure.expense-chart[data-currency="${currency}"]`);
      const category = categories.querySelector(
        `figure.expense-chart[data-currency="${currency}"]`
      );
      expect(
        [...trend.querySelectorAll(".expense-chart-point")].map((point) => Number(point.dataset.y))
      ).toEqual([12, 100]);
      expect(
        [...category.querySelectorAll(".expense-chart-bar")].map((bar) =>
          Number(bar.getAttribute("height"))
        )
      ).toEqual([176, 44]);
    }
    expect(
      timeseries.querySelector('figure.expense-chart[data-currency="KRW"] .expense-chart-point')
        .dataset.y
    ).toBe("188");
  });

  it("uses Max automatic categorization through ordinary saving without a suggestion action", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.createExpense.mockResolvedValueOnce({
      id: "exp_saved",
      categoryId: "cat_1",
      assistance: {
        status: "available",
        categorySource: "jev",
        suggestions: { categoryId: "cat_1" },
      },
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(screen.getByLabelText("Category")).not.toBeRequired());
    expect(screen.queryByRole("button", { name: /suggestion/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.calls[0][0]).not.toHaveProperty("categoryId");
    expect(api.createExpense.mock.calls[0][0]).toMatchObject({
      purpose: "Hosting",
      amount: "12.00",
      target: { kind: "shared" },
    });
    expect(await screen.findByText(/Jev categorized this expense/i)).toHaveTextContent("Tools");
    expect(api.suggestExpense).not.toHaveBeenCalled();
    expect(api.suggestDecision).not.toHaveBeenCalled();
    expect(api.me).toHaveBeenCalledTimes(1);
  });

  it("preserves manual choices and shows duplicate advice only after a successful ordinary save", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.createExpense.mockResolvedValueOnce({
      id: "exp_saved",
      categoryId: "cat_1",
      assistance: {
        status: "available",
        categorySource: "user",
        suggestions: { categoryId: "cat_other", duplicateExpenseId: "exp_1" },
      },
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    expect(screen.queryByRole("checkbox", { name: /duplicate/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    expect(
      await screen.findByText(/This expense may duplicate an existing entry/i)
    ).toBeInTheDocument();
    expect(api.createExpense.mock.calls[0][0].categoryId).toBe("cat_1");
    expect(screen.queryByText(/Jev categorized this expense/i)).not.toBeInTheDocument();
  });

  it("retains the draft and focuses category when automatic categorization needs manual input", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.createExpense.mockRejectedValueOnce({
      status: 422,
      payload: {
        error: { code: "CATEGORY_REQUIRED" },
        assistance: { status: "uncertain", suggestions: {} },
      },
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(screen.getByLabelText("Category")).not.toBeRequired());
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(screen.getByLabelText("Category")).toHaveFocus());
    expect(screen.getByLabelText("Category")).toBeRequired();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Hosting");
    expect(screen.getByLabelText("Amount")).toHaveValue("12.00");
    expect(screen.getAllByText(/Choose a category to finish saving/i)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(2));
    expect(api.createExpense.mock.calls[1][0].categoryId).toBe("cat_1");
    expect(api.createExpense.mock.calls[1][1]).not.toBe(api.createExpense.mock.calls[0][1]);
  });

  it.each([
    {
      mode: "project",
      suggested: "shared",
      notice: "This expense may belong in the shared pool. Review its destination.",
    },
    {
      mode: "shared",
      suggested: "project",
      notice: "This expense may be project-specific. Review its destination.",
    },
  ])(
    "shows destination advice after saving without changing the chosen $mode target",
    async ({ mode, suggested, notice }) => {
      api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
      api.createExpense.mockResolvedValueOnce({
        id: "exp_saved",
        categoryId: "cat_1",
        assistance: {
          status: "available",
          categorySource: "user",
          suggestions: { targetKind: suggested },
        },
      });
      render(
        <LedgerScreen go={vi.fn()} mode={mode} projectId={mode === "project" ? "prj_1" : ""} />
      );
      fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
      fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
      fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
      fireEvent.change(screen.getByLabelText("What did you pay for?"), {
        target: { value: "Hosting" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      expect(await screen.findByText(notice)).toBeInTheDocument();
      expect(api.createExpense.mock.calls[0][0].target).toEqual(
        mode === "project" ? { kind: "project", projectId: "prj_1" } : { kind: "shared" }
      );
    }
  );

  it("keeps matching destination advice quiet after a manual-category save", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.createExpense.mockResolvedValueOnce({
      id: "exp_saved",
      categoryId: "cat_1",
      assistance: {
        status: "available",
        categorySource: "user",
        suggestions: { targetKind: "shared" },
      },
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument());
    expect(screen.queryByText(/Review its destination/)).not.toBeInTheDocument();
  });

  it.each([
    { eligible: false, available: false },
    { eligible: true, available: false },
  ])("keeps manual categorization when automatic assistance is unavailable: %j", async (jev) => {
    api.me.mockResolvedValue({ entitlements: { jev } });
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Category")).toBeRequired();
    expect(screen.queryByRole("button", { name: /suggestion/i })).not.toBeInTheDocument();
    expect(api.suggestExpense).not.toHaveBeenCalled();
  });

  it("keeps category required when the entitlement read fails", async () => {
    api.me.mockRejectedValueOnce(new Error("Profile offline"));
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Category")).toBeRequired();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("aborts the one-time entitlement read when its draft is closed", async () => {
    let resolveProfile;
    api.me.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        })
    );
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    const signal = api.me.mock.calls[0][0].signal;
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(signal.aborted).toBe(true);
    resolveProfile({ entitlements: { jev: { eligible: true, available: true } } });
    await Promise.resolve();
    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
    expect(api.suggestExpense).not.toHaveBeenCalled();
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  it("does not let automatic assistance omit the category when editing history", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_1",
          target: { kind: "shared" },
          occurredOn: "2026-09-27",
          amount: "12.00",
          currency: "USD",
          categoryId: "cat_1",
          purpose: "Hosting",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Hosting" }));
    expect(screen.getByLabelText("Category")).toBeRequired();
    expect(api.me).not.toHaveBeenCalled();
  });

  it("clears saved assistance when the ledger scope changes", async () => {
    api.categories.mockResolvedValue([{ id: "cat_1", name: "Tools", archivedAt: null }]);
    api.createExpense.mockResolvedValueOnce({
      id: "exp_saved",
      categoryId: "cat_1",
      assistance: {
        status: "available",
        categorySource: "jev",
        suggestions: { categoryId: "cat_1" },
      },
    });
    const view = render(<LedgerScreen go={vi.fn()} mode="shared" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-09-27" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.00" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_1" } });
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Hosting" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await screen.findByText(/Jev categorized this expense/i);
    view.rerender(<LedgerScreen go={vi.fn()} mode="project" projectId="prj_1" />);
    await screen.findByRole("heading", { name: "alice/project", level: 1 });
    expect(screen.queryByText(/Jev categorized this expense/i)).not.toBeInTheDocument();
  });
});
