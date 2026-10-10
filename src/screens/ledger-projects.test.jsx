import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LedgerScreen } from "./ledger.jsx";

const api = vi.hoisted(() => ({
  repositories: vi.fn(),
  projects: vi.fn(),
  categories: vi.fn(),
  reportSummary: vi.fn(),
  createProject: vi.fn(),
  project: vi.fn(),
  updateProject: vi.fn(),
  expenses: vi.fn(),
  recurringRules: vi.fn(),
  reportTimeseries: vi.fn(),
  reportCategories: vi.fn(),
  me: vi.fn(),
}));
const github = vi.hoisted(() => ({ connect: vi.fn(), login: vi.fn() }));
vi.mock("../api/ledger.js", () => ({ ledgerApi: api }));
vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: github.connect,
  startGitHubLogin: github.login,
}));

beforeEach(() => {
  vi.resetAllMocks();
  api.repositories.mockResolvedValue({
    items: [{ githubRepoId: 202, fullName: "alice/project" }],
    nextCursor: null,
  });
  api.projects.mockResolvedValue({ items: [], nextCursor: null });
  api.categories.mockResolvedValue([]);
  api.reportSummary.mockResolvedValue({ groups: [] });
  api.createProject.mockResolvedValue({ id: "prj_new" });
  api.expenses.mockResolvedValue({ items: [], nextCursor: null });
  api.recurringRules.mockResolvedValue({ items: [], nextCursor: null });
  api.reportTimeseries.mockResolvedValue({ groups: [] });
  api.reportCategories.mockResolvedValue({ groups: [] });
  api.me.mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } });
  github.connect.mockResolvedValue(undefined);
});

async function nameProject(name = "Project costs") {
  fireEvent.change(await screen.findByLabelText("Project name"), { target: { value: name } });
}

async function openGitHubLinks() {
  const summary = await screen.findByText("Link GitHub repositories (optional)", {
    selector: "summary",
  });
  if (!summary.closest("details").open) fireEvent.click(summary);
  await waitFor(() => expect(summary.closest("details")).toHaveAttribute("open"));
}

async function closeGitHubLinks() {
  const summary = screen.getByText("Link GitHub repositories (optional)", { selector: "summary" });
  if (summary.closest("details").open) fireEvent.click(summary);
  await waitFor(() => expect(summary.closest("details")).not.toHaveAttribute("open"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled());
}

async function selectRepository(id) {
  await openGitHubLinks();
  const picker = await screen.findByLabelText("Repository");
  await waitFor(() => expect(picker).toBeEnabled());
  fireEvent.change(picker, {
    target: { value: String(id) },
  });
}

const blankProject = {
  id: "prj_blank",
  name: "Operating costs",
  description: "",
  status: "active",
  githubRepoId: null,
  githubFullName: null,
  githubRepoIds: [],
  repositories: [],
  githubOrganizationId: null,
  githubOrganization: null,
  githubAccess: "not_linked",
  canCreateExpense: true,
  revision: 7,
  totals: [],
};

describe("Projects authorization and creation", () => {
  it("loads a full-width Projects list skeleton without predicting a creation rail", () => {
    api.projects.mockImplementationOnce(() => new Promise(() => {}));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    const loading = screen.getByRole("status", { name: "Loading projects…" });
    expect(loading.querySelectorAll(".panel")).toHaveLength(1);
    expect(loading.querySelectorAll(".ledger-project-row")).toHaveLength(3);
    expect(loading.querySelector(".ledger-split")).toBeNull();
    expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });

  it("opens the existing Projects list and creation form as the two shared split panels", async () => {
    api.projects.mockResolvedValue({ items: [blankProject], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    const projectLink = await screen.findByRole("link", { name: blankProject.name });
    const projectPanel = projectLink.closest(".ledger-your-projects");
    expect(projectPanel.closest(".ledger-split")).toBeNull();
    const opener = screen.getByRole("button", { name: "Add project" });
    fireEvent.click(opener);
    const name = await screen.findByRole("textbox", { name: "Project name" });
    const split = projectPanel.closest(".ledger-split");
    expect(split).not.toBeNull();
    const panels = Array.from(split.children).filter((child) => child.classList.contains("panel"));
    expect(panels).toHaveLength(2);
    expect(panels[0]).toBe(projectPanel);
    expect(panels[1]).toContainElement(name);
    await waitFor(() => expect(name).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole("textbox", { name: "Project name" })).not.toBeInTheDocument();
  });

  it("explains disabled project creation and gives working onboarding actions", async () => {
    const go = vi.fn();
    render(<LedgerScreen go={go} mode="projects" />);
    const name = await screen.findByLabelText("Project name");
    const create = screen.getByRole("button", { name: "Create project" });
    expect(create).toBeDisabled();
    expect(document.getElementById(create.getAttribute("aria-describedby"))).toHaveTextContent(
      "Enter a project name to continue.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    await waitFor(() => expect(name).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Create categories" }));
    expect(go).toHaveBeenCalledWith("ledgerCategories");
    await nameProject();
    expect(create).toBeEnabled();
    expect(create).not.toHaveAttribute("aria-describedby");
    await openGitHubLinks();
    await screen.findByLabelText("Repository");
    expect(create).toBeDisabled();
    expect(document.getElementById(create.getAttribute("aria-describedby"))).toHaveTextContent(
      "Choose a repository, or close optional GitHub links",
    );
  });

  it("groups concurrent recoverable notices into one alert while keeping project history", async () => {
    api.projects.mockResolvedValue({ items: [blankProject], nextCursor: null });
    api.repositories.mockRejectedValue(new Error("Repository provider unavailable"));
    render(<LedgerScreen go={vi.fn()} mode="projects" authorizationError="Authorization notice" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add project" }));
    await openGitHubLinks();
    await screen.findByText("Repository provider unavailable");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Authorization notice");
    expect(screen.getByRole("alert")).toHaveTextContent("Repository provider unavailable");
    expect(screen.getByRole("link", { name: blankProject.name })).toBeVisible();
    expect(api.projects).toHaveBeenCalledTimes(1);
  });

  it("searches repositories locally without losing authorized primary or additional selections", async () => {
    api.repositories.mockResolvedValue({
      items: [
        { githubRepoId: 202, fullName: "alice/web" },
        { githubRepoId: 303, fullName: "alice/api" },
        { githubRepoId: 404, fullName: "alice/docs" },
      ],
      nextCursor: "repository_page_two",
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject("Platform");
    await selectRepository(202);
    fireEvent.click(screen.getByRole("checkbox", { name: "alice/api" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a repository" }), {
      target: { value: "docs" },
    });
    expect(screen.getByRole("combobox", { name: "Repository" })).toHaveValue("202");
    expect(screen.queryByRole("checkbox", { name: "alice/api" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "alice/docs" })).toBeVisible();
    expect(api.repositories).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Load more repositories" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith(
      { name: "Platform", description: "", githubRepoIds: [202, 303] },
      {},
    ));
  });

  it.each([
    { items: [], nextCursor: null },
    {
      items: [{ githubRepoId: 202, fullName: "alice/project" }],
      organizations: [{ id: 8, login: "team", type: "Organization" }],
      nextCursor: null,
    },
  ])(
    "creates a named blank project by default regardless of available GitHub links",
    async (repos) => {
      api.repositories.mockResolvedValue(repos);
      const go = vi.fn();
      render(<LedgerScreen go={go} mode="projects" />);
      const name = await screen.findByLabelText("Project name");
      expect(name).toBeRequired();
      expect(
        screen
          .getByText("Link GitHub repositories (optional)", { selector: "summary" })
          .closest("details")
      ).not.toHaveAttribute("open");
      expect(screen.queryByRole("combobox", { name: "Repository" })).not.toBeInTheDocument();
      expect(api.createProject).not.toHaveBeenCalled();
      expect(api.repositories).not.toHaveBeenCalled();
      await nameProject("  Local operating costs  ");
      fireEvent.click(screen.getByRole("button", { name: "Create project" }));
      await waitFor(() =>
        expect(api.createProject).toHaveBeenCalledWith(
          { name: "Local operating costs", description: "", githubRepoIds: [] },
          {}
        )
      );
      expect(api.createProject).toHaveBeenCalledTimes(1);
      expect(github.connect).not.toHaveBeenCalled();
      expect(github.login).not.toHaveBeenCalled();
      await waitFor(() => expect(go).toHaveBeenCalledWith("ledgerProject", { id: "prj_new" }));
    }
  );

  it("keeps an unnamed blank project from dispatching even through form submission", async () => {
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    const name = await screen.findByLabelText("Project name");
    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.submit(name.closest("form"));
    expect(api.createProject).not.toHaveBeenCalled();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("does not wait for pending repository access before creating a blank project", async () => {
    api.repositories.mockImplementationOnce(() => new Promise(() => {}));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject();
    await openGitHubLinks();
    await waitFor(() => expect(api.repositories).toHaveBeenCalledTimes(1));
    await closeGitHubLinks();
    expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { name: "Project costs", description: "", githubRepoIds: [] },
        {}
      )
    );
    expect(github.connect).not.toHaveBeenCalled();
    expect(github.login).not.toHaveBeenCalled();
  });

  it("does not include previously selected repositories or organization after closing optional links", async () => {
    api.repositories.mockResolvedValue({
      items: [
        { githubRepoId: 202, fullName: "team/project", account: { id: 8, type: "Organization" } },
      ],
      organizations: [{ id: 8, login: "team", type: "Organization" }],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject();
    await openGitHubLinks();
    fireEvent.change(await screen.findByLabelText("GitHub organization (optional)"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "202" } });
    await closeGitHubLinks();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { name: "Project costs", description: "", githubRepoIds: [] },
        {}
      )
    );
  });

  it("permits blank creation while optional GitHub repository access requires reconnect", async () => {
    api.repositories.mockResolvedValue({
      items: [],
      nextCursor: null,
      githubAccess: "reauthorization_required",
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject();
    await openGitHubLinks();
    expect(await screen.findByRole("alert")).toHaveTextContent(/may have expired or been revoked/i);
    await closeGitHubLinks();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { name: "Project costs", description: "", githubRepoIds: [] },
        {}
      )
    );
    expect(github.login).not.toHaveBeenCalled();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("renames a blank project using its revision while repository access is unavailable", async () => {
    api.repositories.mockRejectedValue(new Error("Repository list unavailable"));
    api.project.mockResolvedValueOnce(blankProject).mockResolvedValue({
      ...blankProject,
      name: "Local budget",
      revision: 8,
    });
    api.updateProject.mockResolvedValue({ ...blankProject, name: "Local budget", revision: 8 });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId={blankProject.id} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    expect(api.repositories).not.toHaveBeenCalled();
    await openGitHubLinks();
    expect(await screen.findByRole("alert")).toHaveTextContent("Repository list unavailable");
    const name = screen.getByLabelText("Project name");
    expect(name).toBeRequired();
    fireEvent.change(name, { target: { value: "Local budget" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith(
        blankProject.id,
        7,
        { name: "Local budget", description: "" },
        {}
      )
    );
    expect(api.updateProject).toHaveBeenCalledTimes(1);
    expect(github.connect).not.toHaveBeenCalled();
    expect(github.login).not.toHaveBeenCalled();
  });

  it("archives and reactivates a blank project without adding repository bindings", async () => {
    let current = { ...blankProject };
    api.project.mockImplementation(async () => current);
    api.updateProject.mockImplementation(async (_id, revision, fields) => {
      current = { ...current, ...fields, revision: revision + 1 };
      return current;
    });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId={blankProject.id} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "archived" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenNthCalledWith(
        1,
        blankProject.id,
        7,
        { description: "", status: "archived" },
        {}
      )
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Save project" })).toBeEnabled());
    expect(screen.getByLabelText("Project name")).toHaveValue("Operating costs");
    fireEvent.change(screen.getByLabelText("Project status"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenNthCalledWith(
        2,
        blankProject.id,
        8,
        { description: "", status: "active" },
        {}
      )
    );
    expect(current.githubRepoIds).toEqual([]);
    expect(current.githubOrganizationId).toBeNull();
    expect(api.repositories).not.toHaveBeenCalled();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it("requires a financial name before explicitly detaching the final repository", async () => {
    const linked = {
      ...blankProject,
      name: "",
      githubRepoId: 202,
      githubFullName: "alice/project",
      githubRepoIds: [202],
      repositories: [
        { githubRepoId: 202, githubFullName: "alice/project", githubAccess: "authorized" },
      ],
      githubAccess: "authorized",
    };
    api.project.mockResolvedValue(linked);
    api.updateProject.mockResolvedValue({ ...blankProject, name: "Local budget", revision: 8 });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId={blankProject.id} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    expect(screen.getByLabelText("Project name")).not.toBeRequired();
    const repository = screen.getByRole("checkbox", { name: "alice/project" });
    expect(repository).toBeChecked();
    fireEvent.click(repository);
    expect(screen.getByLabelText("Project name")).toBeRequired();
    expect(screen.getByRole("button", { name: "Save project" })).toBeDisabled();
    fireEvent.submit(screen.getByLabelText("Project name").closest("form"));
    expect(api.updateProject).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Local budget" } });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenCalledWith(
        blankProject.id,
        7,
        { name: "Local budget", description: "", githubRepoIds: [] },
        {}
      )
    );
  });

  it("keeps final-repository detachment fenced to its original revision after a conflict", async () => {
    const linked = {
      ...blankProject,
      githubRepoId: 202,
      githubFullName: "alice/project",
      githubRepoIds: [202],
      repositories: [
        { githubRepoId: 202, githubFullName: "alice/project", githubAccess: "authorized" },
      ],
      githubAccess: "authorized",
    };
    api.project.mockResolvedValue(linked);
    api.updateProject.mockRejectedValueOnce({ status: 412 });
    render(<LedgerScreen go={vi.fn()} mode="project" projectId={blankProject.id} />);
    fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Local budget" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "alice/project" }));
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Save conflict/);
    expect(api.updateProject).toHaveBeenCalledWith(
      blankProject.id,
      7,
      { name: "Local budget", description: "", githubRepoIds: [] },
      {}
    );
    expect(screen.getByLabelText("Project name")).toHaveValue("Local budget");
    expect(screen.getByRole("checkbox", { name: "alice/project" })).not.toBeChecked();
    expect(api.updateProject).toHaveBeenCalledTimes(1);
    api.project.mockResolvedValue({ ...linked, name: "Another member's budget", revision: 8 });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Project name")).toHaveValue("Another member's budget")
    );
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Local budget" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "alice/project" }));
    api.updateProject.mockResolvedValue({ ...blankProject, name: "Local budget", revision: 9 });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() =>
      expect(api.updateProject).toHaveBeenNthCalledWith(
        2,
        blankProject.id,
        8,
        { name: "Local budget", description: "", githubRepoIds: [] },
        {}
      )
    );
  });

  it("excludes repositories used by projects outside the loaded project page using the server occupancy flag", async () => {
    api.projects.mockResolvedValue({
      items: [{ id: "prj_first_page", name: "Visible project", githubRepoIds: [700], totals: [] }],
      nextCursor: "project_page_two",
    });
    api.repositories.mockResolvedValue({
      items: [
        { githubRepoId: 202, fullName: "team/occupied-on-later-page", isBound: true },
        { githubRepoId: 303, fullName: "team/available", isBound: false },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add project" }));
    await openGitHubLinks();
    expect(
      screen.queryByRole("option", { name: "team/occupied-on-later-page" })
    ).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Repository")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "303" } });
    expect(screen.getByLabelText("Repository")).toHaveValue("303");
    expect(screen.getByRole("button", { name: "Load more projects" })).toBeEnabled();
    expect(api.projects).toHaveBeenCalledTimes(1);
  });

  it("creates one named project from multiple authorized repositories", async () => {
    api.repositories.mockResolvedValue({
      items: [
        { githubRepoId: 202, fullName: "alice/web" },
        { githubRepoId: 303, fullName: "alice/api" },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject("Platform");
    await selectRepository(202);
    fireEvent.click(screen.getByRole("checkbox", { name: "alice/api" }));
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { githubRepoIds: [202, 303], name: "Platform", description: "" },
        {}
      )
    );
  });

  it("filters repository candidates by the actor's organization and binds its stable ID", async () => {
    api.repositories.mockResolvedValue({
      items: [
        {
          githubRepoId: 202,
          fullName: "alice/personal",
          account: { id: 7, login: "alice", type: "User" },
        },
        {
          githubRepoId: 303,
          fullName: "team/web",
          account: { id: 8, login: "team", type: "Organization" },
        },
        {
          githubRepoId: 404,
          fullName: "team/api",
          account: { id: 8, login: "team", type: "Organization" },
        },
      ],
      organizations: [{ id: 8, login: "team", type: "Organization" }],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} />);
    await nameProject();
    await openGitHubLinks();
    fireEvent.change(await screen.findByLabelText("GitHub organization (optional)"), {
      target: { value: "8" },
    });
    expect(screen.queryByRole("option", { name: "alice/personal" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "303" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "team/api" }));
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        {
          githubRepoIds: [303, 404],
          githubOrganizationId: 8,
          name: "Project costs",
          description: "",
        },
        {}
      )
    );
  });

  it("keeps every repository bound to another project out of the chooser, including archived projects", async () => {
    api.projects.mockResolvedValue({
      items: [
        {
          id: "prj_old",
          name: "Historical platform",
          status: "archived",
          githubRepoIds: [202, 303],
          totals: [],
        },
      ],
      nextCursor: null,
    });
    api.repositories.mockResolvedValue({
      items: [
        { githubRepoId: 202, fullName: "alice/web" },
        { githubRepoId: 303, fullName: "alice/api" },
        { githubRepoId: 404, fullName: "alice/new" },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add project" }));
    await openGitHubLinks();
    expect(screen.queryByRole("option", { name: "alice/web" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "alice/api" })).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Repository")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "404" } });
    expect(screen.getByLabelText("Repository")).toHaveValue("404");
  });

  it("limits a project to thirty repositories without disabling removal of a selected repository", async () => {
    api.repositories.mockResolvedValue({
      items: Array.from({ length: 31 }, (_, index) => ({
        githubRepoId: index + 1,
        fullName: `team/repo-${index + 1}`,
      })),
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} />);
    await nameProject();
    await selectRepository(1);
    for (let id = 2; id <= 30; id += 1) fireEvent.click(screen.getByLabelText(`team/repo-${id}`));
    expect(screen.getByRole("checkbox", { name: "team/repo-31" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "team/repo-30" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledTimes(1));
    expect(api.createProject.mock.calls[0][0].githubRepoIds).toHaveLength(30);
  });

  it("does not submit a stale additional repository after authorization refresh", async () => {
    api.repositories.mockResolvedValueOnce({
      items: [
        { githubRepoId: 202, fullName: "alice/web" },
        { githubRepoId: 303, fullName: "alice/removed" },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} />);
    await nameProject();
    await selectRepository(202);
    fireEvent.click(await screen.findByRole("checkbox", { name: "alice/removed" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: "alice/removed" })).not.toBeInTheDocument()
    );
    await selectRepository(202);
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { githubRepoIds: [202], name: "Project costs", description: "" },
        {}
      )
    );
  });

  it("does not navigate to a project created in a workspace that is no longer selected", async () => {
    let finish;
    api.createProject.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const go = vi.fn();
    const workspace = {
      id: "usr_first",
      revision: 1,
      permissions: { manageProjects: true, manageCategories: true, writeExpenses: true },
    };
    const view = render(<LedgerScreen go={go} workspace={workspace} />);
    await nameProject();
    fireEvent.click(await screen.findByRole("button", { name: "Create project" }));
    view.rerender(<LedgerScreen go={go} workspace={{ ...workspace, id: "usr_second" }} />);
    await screen.findByRole("button", { name: "Create project" });
    finish({ id: "prj_first" });
    await Promise.resolve();
    expect(go).not.toHaveBeenCalled();
  });

  it("does not expose project creation or GitHub writes to a Viewer", async () => {
    const workspace = {
      id: "usr_team",
      role: "viewer",
      revision: 1,
      permissions: { manageProjects: false, manageCategories: false, writeExpenses: false },
    };
    render(<LedgerScreen go={vi.fn()} mode="projects" workspace={workspace} />);
    await waitFor(() => expect(api.projects).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Create project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Manage GitHub access/ })).not.toBeInTheDocument();
    expect(api.repositories).not.toHaveBeenCalled();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("reloads repositories after GitHub popup authorization completes", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(github.connect).toHaveBeenCalledTimes(1);
    expect(api.repositories).toHaveBeenCalledTimes(2);
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("refreshes after closing GitHub and shows a neutral notice only after the required reload", async () => {
    const message = "GitHub window closed. Current repository access has been refreshed.";
    const outcome = {
      status: "closed_unverified",
      repositories: {
        needsAuthorization: false,
        githubAccess: "authorized",
        items: [{ githubRepoId: 202, fullName: "alice/project" }],
      },
    };
    let finishReload;
    api.projects.mockResolvedValueOnce({ items: [], nextCursor: null }).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishReload = resolve;
        })
    );
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    github.connect.mockResolvedValueOnce(outcome);
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    expect(screen.getByText(/On GitHub, finish saving, then close the window/)).toBeVisible();
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    await waitFor(() => expect(api.projects).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(message)).not.toBeInTheDocument();

    finishReload({ items: [], nextCursor: null });
    expect((await screen.findByText(message)).closest('[role="status"]')).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.repositories).toHaveBeenCalledTimes(2);
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("keeps a failed required reload visible without a stale GitHub closure notice", async () => {
    api.projects
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockRejectedValueOnce(new Error("Projects could not be read"));
    github.connect.mockResolvedValueOnce({
      status: "closed_unverified",
      repositories: { needsAuthorization: true, githubAccess: "not_connected", items: [] },
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Projects could not be read");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("discards a GitHub closure outcome after the workspace changes", async () => {
    let finish;
    github.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const workspace = {
      id: "usr_first",
      revision: 1,
      permissions: { manageProjects: true, manageCategories: true, writeExpenses: true },
    };
    const view = render(<LedgerScreen go={vi.fn()} mode="projects" workspace={workspace} />);
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    view.rerender(
      <LedgerScreen go={vi.fn()} mode="projects" workspace={{ ...workspace, id: "usr_second" }} />
    );
    await screen.findByLabelText("Project name");
    finish({
      status: "closed_unverified",
      repositories: { needsAuthorization: true, githubAccess: "not_connected", items: [] },
    });
    await Promise.resolve();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(api.projects).toHaveBeenCalledTimes(2);
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("preserves an explicit GitHub authorization error and allows a manual retry", async () => {
    github.connect.mockRejectedValueOnce(new Error("GitHub denied authorization"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub denied authorization");
    expect(screen.getByRole("button", { name: /Manage GitHub access/i })).toBeEnabled();
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("creates projects without reading workspace reports or category filters", async () => {
    api.reportSummary.mockImplementation(() => new Promise(() => {}));
    api.categories.mockImplementation(() => new Promise(() => {}));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject();
    expect(screen.queryByRole("combobox", { name: "Repository" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Spending summary is unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText("No expenses in this range.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ledger overview" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("From date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter category")).not.toBeInTheDocument();
    expect(api.categories).not.toHaveBeenCalled();
    expect(api.reportSummary).not.toHaveBeenCalled();
    expect(api.reportTimeseries).not.toHaveBeenCalled();
    expect(api.reportCategories).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { githubRepoIds: [], name: "Project costs", description: "" },
        {}
      )
    );
  });

  it("keeps search local and refreshes or paginates only the Projects list", async () => {
    const first = { ...blankProject, id: "prj_first", name: "First project" };
    const next = { ...blankProject, id: "prj_next", name: "Next project" };
    api.projects
      .mockResolvedValueOnce({ items: [first], nextCursor: "projects-page-2" })
      .mockResolvedValueOnce({ items: [next], nextCursor: null })
      .mockResolvedValueOnce({ items: [first], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await screen.findByRole("link", { name: first.name });
    const projectCount = () =>
      screen.getByText("Project", { selector: ".ledger-project-count > span" }).nextElementSibling;
    expect(projectCount()).toHaveTextContent("1+");
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a project" }), {
      target: { value: "Nothing matches" },
    });
    expect(screen.getByRole("heading", { name: "No matching projects" })).toBeVisible();
    expect(projectCount()).toHaveTextContent("1+");
    expect(api.projects).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.click(screen.getByRole("button", { name: "Load more projects" }));
    expect(await screen.findByRole("link", { name: next.name })).toBeVisible();
    expect(projectCount()).toHaveTextContent(/^2$/);
    expect(api.projects).toHaveBeenLastCalledWith(
      { cursor: "projects-page-2" },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(api.projects).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: next.name })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("link", { name: first.name })).toBeVisible();
    expect(projectCount()).toHaveTextContent(/^1$/);
    expect(api.categories).not.toHaveBeenCalled();
    expect(api.reportSummary).not.toHaveBeenCalled();
    expect(api.reportTimeseries).not.toHaveBeenCalled();
    expect(api.reportCategories).not.toHaveBeenCalled();
    expect(api.repositories).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Ledger overview" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("From date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter category")).not.toBeInTheDocument();
  });

  it("opens the explicitly created project and guards duplicate submission", async () => {
    let finish;
    api.createProject.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const go = vi.fn();
    render(<LedgerScreen go={go} mode="projects" />);
    await nameProject();
    const button = await screen.findByRole("button", { name: /Create project/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.createProject).toHaveBeenCalledTimes(1);
    finish({ id: "prj_new" });
    await waitFor(() => expect(go).toHaveBeenCalledWith("ledgerProject", { id: "prj_new" }));
  });

  it("does not navigate when creation completes after leaving Projects", async () => {
    let finish;
    api.createProject.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const go = vi.fn();
    const view = render(<LedgerScreen go={go} mode="projects" />);
    await nameProject();
    fireEvent.click(await screen.findByRole("button", { name: /Create project/i }));
    view.unmount();
    finish({ id: "prj_late" });
    await Promise.resolve();
    expect(go).not.toHaveBeenCalled();
  });

  it("does not reload after authorization completes on an unmounted view", async () => {
    let finish;
    github.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const view = render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    view.unmount();
    finish();
    await Promise.resolve();
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("distinguishes already-added repositories from missing GitHub access", async () => {
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
    expect(screen.queryByText(/Connect GitHub to add a project/i)).not.toBeInTheDocument();
  });

  it("requires explicit reselection after a previously selected repository disappears", async () => {
    api.repositories.mockResolvedValueOnce({
      items: [
        { githubRepoId: 202, fullName: "alice/first" },
        { githubRepoId: 303, fullName: "alice/second" },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject();
    await selectRepository(303);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "alice/second" })).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText("Repository")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    expect(api.createProject).not.toHaveBeenCalled();
    await selectRepository(202);
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { githubRepoIds: [202], name: "Project costs", description: "" },
        {}
      )
    );
  });

  it("allows pagination again after reload cancels a pending page and ignores its late response", async () => {
    const firstPage = {
      items: [{ id: "prj_1", githubRepoId: 202, githubFullName: "alice/project", totals: [] }],
      nextCursor: "next",
    };
    api.projects.mockResolvedValue(firstPage);
    let finish;
    let pendingSignal;
    api.projects.mockImplementationOnce(() => Promise.resolve(firstPage));
    api.projects.mockImplementationOnce((params, options) => {
      pendingSignal = options.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more projects" }));
    expect(screen.getByRole("button", { name: "Load more projects" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(api.projects).toHaveBeenCalledTimes(3));
    expect(pendingSignal.aborted).toBe(true);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Load more projects" })).toBeEnabled()
    );
    finish({
      items: [{ id: "prj_stale", githubFullName: "alice/stale", totals: [] }],
      nextCursor: null,
    });
    await Promise.resolve();
    expect(screen.queryByRole("link", { name: /alice\/stale/ })).not.toBeInTheDocument();
    api.projects.mockResolvedValueOnce({
      items: [{ id: "prj_2", githubFullName: "alice/current", totals: [] }],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Load more projects" }));
    expect(await screen.findByRole("link", { name: /alice\/current/ })).toBeInTheDocument();
  });

  it("retains a repository load error while allowing an independent blank project", async () => {
    api.repositories.mockRejectedValueOnce(new Error("Repository list unavailable"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await nameProject();
    await openGitHubLinks();
    expect(await screen.findByRole("alert")).toHaveTextContent("Repository list unavailable");
    await closeGitHubLinks();
    expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
    expect(screen.queryByText(/No repositories are available yet/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { name: "Project costs", description: "", githubRepoIds: [] },
        {}
      )
    );
    expect(github.connect).not.toHaveBeenCalled();
    expect(github.login).not.toHaveBeenCalled();
  });

  it("keeps project history visible on repository failure without automatic retries", async () => {
    api.projects.mockResolvedValue({
      items: [
        {
          id: "prj_history",
          githubRepoId: 202,
          githubFullName: null,
          description: "Historical hosting",
          githubAccess: "unavailable",
          totals: [{ currency: "USD", amountMinor: 1230 }],
        },
      ],
      nextCursor: null,
    });
    api.repositories.mockRejectedValue(
      Object.assign(new Error("IDENTITY_UNAVAILABLE"), {
        status: 503,
        payload: { error: { code: "IDENTITY_UNAVAILABLE" } },
      })
    );
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("link", { name: /Historical hosting/ })).toHaveAttribute(
      "href",
      "/projects/prj_history"
    );
    expect(
      screen
        .getByRole("link", { name: /Historical hosting/ })
        .closest("article")
        .querySelector(".financial-value").textContent
    ).toBe("USD 12.30");
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    await nameProject();
    await openGitHubLinks();
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/Repository access could not be checked/i);
    expect(
      screen.queryByText(/No repositories are available yet|GitHub access lost/i)
    ).not.toBeInTheDocument();
    expect(api.repositories).toHaveBeenCalledTimes(1);
    expect(github.connect).not.toHaveBeenCalled();
    expect(github.login).not.toHaveBeenCalled();
    await closeGitHubLinks();
    expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { name: "Project costs", description: "", githubRepoIds: [] },
        {}
      )
    );
  });

  it("offers guarded credential renewal only after an explicit click", async () => {
    api.repositories.mockResolvedValue({
      items: [],
      nextCursor: null,
      githubAccess: "reauthorization_required",
    });
    let finish;
    github.login.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    const reconnect = await screen.findByRole("button", { name: "Reconnect GitHub" });
    expect(screen.getByRole("alert")).toHaveTextContent(/may have expired or been revoked/i);
    expect(github.login).not.toHaveBeenCalled();
    fireEvent.click(reconnect);
    fireEvent.click(reconnect);
    expect(github.login).toHaveBeenCalledTimes(1);
    expect(github.connect).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(reconnect).toBeEnabled());
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("retains project history and hides repository candidates during a renewal outage", async () => {
    const githubRefreshError = Object.assign(new Error("GitHub unavailable"), {
      status: 503,
      code: "GITHUB_UNAVAILABLE",
    });
    api.projects.mockResolvedValue({
      items: [{ ...blankProject, name: "Historical hosting" }],
      nextCursor: null,
      githubRefreshError,
    });
    api.repositories.mockResolvedValue({
      items: [{ githubRepoId: 202, fullName: "alice/candidate" }],
      nextCursor: null,
      githubAccess: "unavailable",
      githubRefreshError,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("link", { name: /Historical hosting/ })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/GitHub is temporarily unavailable/i);
    expect(screen.queryByRole("button", { name: "Reconnect GitHub" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    await nameProject();
    await openGitHubLinks();
    await waitFor(() => expect(api.repositories).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("option", { name: "alice/candidate" })).not.toBeInTheDocument();
    expect(github.login).not.toHaveBeenCalled();
    expect(github.connect).not.toHaveBeenCalled();
  });

  it.each([
    ["GITHUB_RATE_LIMITED", /GitHub is limiting requests/i],
    ["GITHUB_UNAVAILABLE", /GitHub is temporarily unavailable/i],
    ["GITHUB_TOKEN_UNREADABLE", /stored GitHub credential could not be read/i],
  ])("explains %s without requesting login", async (code, message) => {
    api.repositories.mockRejectedValue({ status: 503, payload: { error: { code } } });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("button", { name: "Reconnect GitHub" })).not.toBeInTheDocument();
    expect(github.login).not.toHaveBeenCalled();
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("checks repositories once on manual recovery and ignores an obsolete response", async () => {
    api.repositories.mockRejectedValueOnce(new Error("Repository list unavailable"));
    const view = render(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={0} />);
    await openGitHubLinks();
    const retry = await screen.findByRole("button", { name: "Check repository access" });
    let finish;
    api.repositories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(api.repositories).toHaveBeenCalledTimes(2);
    expect(api.projects).toHaveBeenCalledTimes(1);
    expect(api.reportSummary).not.toHaveBeenCalled();
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={1} />);
    await openGitHubLinks();
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    finish({ items: [{ githubRepoId: 303, fullName: "alice/obsolete" }], nextCursor: null });
    await Promise.resolve();
    expect(screen.queryByRole("option", { name: "alice/obsolete" })).not.toBeInTheDocument();
  });

  it("allows the next repository page after a completed manual access recovery", async () => {
    api.repositories.mockRejectedValueOnce(new Error("Repository list unavailable"));
    api.repositories.mockResolvedValueOnce({
      items: [{ githubRepoId: 202, fullName: "alice/project" }],
      nextCursor: "next",
    });
    api.repositories.mockResolvedValueOnce({
      items: [{ githubRepoId: 303, fullName: "alice/second" }],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: "Check repository access" }));
    await openGitHubLinks();
    fireEvent.click(await screen.findByRole("button", { name: "Load more repositories" }));
    expect(await screen.findByRole("option", { name: "alice/second" })).toBeInTheDocument();
    expect(api.repositories).toHaveBeenCalledTimes(3);
  });

  it.each([401, 403])(
    "does not degrade a Pullwise identity/permission denial (%s) into history access",
    async (status) => {
      api.projects.mockResolvedValue({
        items: [
          { id: "prj_history", githubRepoId: 202, description: "Protected history", totals: [] },
        ],
        nextCursor: null,
      });
      api.repositories.mockRejectedValue({
        status,
        payload: { error: { code: status === 401 ? "UNAUTHENTICATED" : "SCOPE_FORBIDDEN" } },
      });
      render(<LedgerScreen go={vi.fn()} mode="projects" />);
      fireEvent.click(await screen.findByRole("button", { name: "Add project" }));
      await openGitHubLinks();
      await screen.findByRole("alert");
      expect(screen.queryByText("Protected history")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Check repository access" })
      ).not.toBeInTheDocument();
      expect(github.login).not.toHaveBeenCalled();
    }
  );

  it("clears repositories when authorization changes and ignores the previous response", async () => {
    let finish;
    const view = render(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={0} />);
    await openGitHubLinks();
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    api.repositories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={1} />);
    expect(screen.queryByText("alice/project", { selector: "option" })).not.toBeInTheDocument();
    await openGitHubLinks();
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    api.repositories.mockResolvedValueOnce({
      items: [{ githubRepoId: 404, fullName: "alice/current" }],
      nextCursor: null,
    });
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={2} />);
    await openGitHubLinks();
    expect(await screen.findByRole("option", { name: "alice/current" })).toBeInTheDocument();
    finish({ items: [{ githubRepoId: 303, fullName: "alice/stale" }], nextCursor: null });
    await Promise.resolve();
    expect(screen.queryByRole("option", { name: "alice/stale" })).not.toBeInTheDocument();
  });
});
