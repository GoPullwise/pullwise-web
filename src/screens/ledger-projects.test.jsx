import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LedgerScreen } from "./ledger.jsx";

const api = vi.hoisted(() => ({
  repositories: vi.fn(),
  projects: vi.fn(),
  categories: vi.fn(),
  reportSummary: vi.fn(),
  createProject: vi.fn(),
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
  github.connect.mockResolvedValue(undefined);
});

describe("Projects authorization and creation", () => {
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
    expect(
      screen.queryByRole("option", { name: "team/occupied-on-later-page" })
    ).not.toBeInTheDocument();
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
    fireEvent.change(await screen.findByLabelText("Project name (optional)"), {
      target: { value: "Platform" },
    });
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
    fireEvent.change(await screen.findByLabelText("GitHub organization (optional)"), {
      target: { value: "8" },
    });
    expect(screen.queryByRole("option", { name: "alice/personal" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "team/api" }));
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith(
        { githubRepoIds: [303, 404], githubOrganizationId: 8, description: "" },
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
    expect(screen.queryByRole("option", { name: "alice/web" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "alice/api" })).not.toBeInTheDocument();
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
    await screen.findByLabelText("Repository");
    for (let id = 2; id <= 30; id += 1)
      fireEvent.click(screen.getByRole("checkbox", { name: `team/repo-${id}` }));
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
    fireEvent.click(await screen.findByRole("checkbox", { name: "alice/removed" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.queryByRole("checkbox", { name: "alice/removed" })).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith({ githubRepoIds: [202], description: "" }, {})
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
  });

  it("reloads repositories after GitHub popup authorization completes", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(github.connect).toHaveBeenCalledTimes(1);
    expect(api.repositories).toHaveBeenCalledTimes(2);
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("shows popup cancellation and allows a manual retry", async () => {
    github.connect.mockRejectedValueOnce(new Error("GitHub authorization was cancelled"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub authorization was cancelled"
    );
    expect(screen.getByRole("button", { name: /Manage GitHub access/i })).toBeEnabled();
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("keeps project controls usable when the spending summary fails", async () => {
    api.reportSummary.mockRejectedValueOnce(new Error("Summary unavailable"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(screen.getByText(/Spending summary is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("No expenses in this range.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith({ githubRepoIds: [202], description: "" }, {})
    );
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
    expect(
      await screen.findByText(/These repositories are already in your projects/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Connect GitHub to add a project/i)).not.toBeInTheDocument();
  });

  it("uses the displayed repository after a previously selected repository disappears", async () => {
    api.repositories.mockResolvedValueOnce({
      items: [
        { githubRepoId: 202, fullName: "alice/first" },
        { githubRepoId: 303, fullName: "alice/second" },
      ],
      nextCursor: null,
    });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.change(await screen.findByLabelText("Repository"), { target: { value: "303" } });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "alice/second" })).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText("Repository")).toHaveValue("202");
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() =>
      expect(api.createProject).toHaveBeenCalledWith({ githubRepoIds: [202], description: "" }, {})
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

  it("shows repository load failure instead of a successful empty state", async () => {
    api.repositories.mockRejectedValueOnce(new Error("Repository list unavailable"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Repository list unavailable");
    expect(screen.queryByRole("button", { name: /Create project/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No projects yet|Your first project starts here/i)
    ).not.toBeInTheDocument();
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
    expect(screen.getByText("USD 12.30")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Repository access could not be checked/i);
    expect(
      screen.queryByText(/No repositories are available yet|GitHub access lost/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Create project/i })).not.toBeInTheDocument();
    expect(api.repositories).toHaveBeenCalledTimes(1);
    expect(github.connect).not.toHaveBeenCalled();
    expect(github.login).not.toHaveBeenCalled();
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

  it.each([
    ["GITHUB_RATE_LIMITED", /GitHub is limiting requests/i],
    ["GITHUB_UNAVAILABLE", /GitHub is temporarily unavailable/i],
    ["GITHUB_TOKEN_UNREADABLE", /stored GitHub credential could not be read/i],
  ])("explains %s without requesting login", async (code, message) => {
    api.repositories.mockRejectedValue({ status: 503, payload: { error: { code } } });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByRole("button", { name: "Reconnect GitHub" })).not.toBeInTheDocument();
    expect(github.login).not.toHaveBeenCalled();
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("checks repositories once on manual recovery and ignores an obsolete response", async () => {
    api.repositories.mockRejectedValueOnce(new Error("Repository list unavailable"));
    const view = render(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={0} />);
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
    expect(api.reportSummary).toHaveBeenCalledTimes(1);
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={1} />);
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
    fireEvent.click(await screen.findByRole("button", { name: "Check repository access" }));
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
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    api.repositories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={1} />);
    expect(screen.queryByRole("option", { name: "alice/project" })).not.toBeInTheDocument();
    api.repositories.mockResolvedValueOnce({
      items: [{ githubRepoId: 404, fullName: "alice/current" }],
      nextCursor: null,
    });
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={2} />);
    expect(await screen.findByRole("option", { name: "alice/current" })).toBeInTheDocument();
    finish({ items: [{ githubRepoId: 303, fullName: "alice/stale" }], nextCursor: null });
    await Promise.resolve();
    expect(screen.queryByRole("option", { name: "alice/stale" })).not.toBeInTheDocument();
  });
});
