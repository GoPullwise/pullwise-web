import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceContext } from "../components/workspace-context.jsx";
import { LedgerScreen } from "./ledger.jsx";

const workspace = (fields = {}) => ({
  id: "wsp_current",
  name: "Current ledger",
  role: "owner",
  revision: 3,
  memberRevision: 5,
  permissions: { manageProjects: true, manageCategories: true, writeExpenses: true },
  ...fields,
});
const project = (fields = {}) => ({
  id: "prj_current",
  name: "Current project",
  description: "Saved description",
  status: "active",
  revision: 7,
  totals: [],
  githubAccess: "not_linked",
  githubRepoIds: [],
  repositories: [],
  canCreateExpense: true,
  ...fields,
});

function client(current = project()) {
  return {
    project: vi.fn().mockResolvedValue(current),
    projects: vi.fn().mockResolvedValue({ items: [current], nextCursor: null }),
    categories: vi.fn().mockResolvedValue([{ id: "cat_tools", name: "Tools", archivedAt: null }]),
    expenses: vi.fn().mockResolvedValue({
      items: [
        {
          id: "exp_current",
          purpose: "Recorded hosting",
          categoryId: "cat_tools",
          amount: "12.00",
          currency: "USD",
          revision: 2,
        },
      ],
      nextCursor: null,
    }),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
    repositories: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    activity: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      windowStart: "2026-10-08T08:00:00Z",
      windowEnd: "2026-10-09T08:00:00Z",
    }),
    updateProject: vi.fn().mockResolvedValue(current),
    removeProject: vi.fn().mockResolvedValue(undefined),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((finish, fail) => {
    resolve = finish;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function viewFor(
  api,
  selected = workspace(),
  projectId = "prj_current",
  go = vi.fn(),
  onAccessChanged = vi.fn(),
  accessProps = {}
) {
  return (
    <WorkspaceContext.Provider
      value={
        selected
          ? {
              workspace: selected,
              items: [selected, workspace({ id: "wsp_other", name: "Other ledger" })],
              onSelect: vi.fn(),
            }
          : null
      }
    >
      <LedgerScreen
        api={api}
        go={go}
        onAccessChanged={onAccessChanged}
        mode="project"
        projectId={projectId}
        workspace={selected}
        {...accessProps}
      />
    </WorkspaceContext.Provider>
  );
}

async function openSettings() {
  const tab = await screen.findByRole("tab", { name: "Project settings" });
  fireEvent.click(tab);
  return screen.getByRole("tabpanel", { name: "Project settings" });
}

async function openRemoval() {
  const settings = await openSettings();
  const opener = within(settings).getByRole("button", { name: "Remove project" });
  await userEvent.setup().click(opener);
  return { opener, settings, dialog: screen.getByRole("dialog", { name: "Remove project?" }) };
}

describe("Owner project removal", () => {
  it.each(["admin", "editor", "viewer", "", undefined])(
    "does not expose removal to role %s even with project-management permission",
    async (role) => {
      const api = client();
      render(viewFor(api, workspace({ role })));
      const settings = await openSettings();
      expect(within(settings).getByRole("button", { name: "Save project" })).toBeEnabled();
      expect(
        within(settings).queryByRole("button", { name: "Remove project" })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.removeProject).not.toHaveBeenCalled();
      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Expenses",
        "Reports",
        "Project settings",
        "Operation log",
      ]);
    }
  );

  it("does not infer Owner access when the workspace is missing", async () => {
    const api = client();
    render(viewFor(api, null));
    await openSettings();
    expect(screen.queryByRole("button", { name: "Remove project" })).not.toBeInTheDocument();
    expect(api.removeProject).not.toHaveBeenCalled();
  });

  it.each(["active", "archived"])(
    "offers Owner removal for an %s current project independently of repository access",
    async (status) => {
      const api = client(project({ status, githubAccess: "lost", canCreateExpense: false }));
      render(viewFor(api));
      const settings = await openSettings();
      expect(within(settings).getByRole("button", { name: "Remove project" })).toBeEnabled();
      expect(within(settings).getByLabelText("Project status")).toHaveValue(status);
      expect(api.removeProject).not.toHaveBeenCalled();
    }
  );

  it("confirms the persisted project name and consequences, defaults to Cancel and restores focus after cancellation", async () => {
    const api = client(project({ name: "Current & <reserved> project" }));
    const user = userEvent.setup();
    render(viewFor(api));
    const settings = await openSettings();
    fireEvent.change(within(settings).getByLabelText("Project name"), {
      target: { value: "Unsaved name" },
    });
    const opener = within(settings).getByRole("button", { name: "Remove project" });
    const background = opener.closest(".ledger-screen");
    const nativeFocus = opener.focus.bind(opener);
    const focus = vi.spyOn(opener, "focus").mockImplementation((options) => {
      if (!background.inert) nativeFocus(options);
    });
    try {
      await user.click(opener);
      const dialog = screen.getByRole("dialog", { name: "Remove project?" });
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog.closest(".ledger-screen")).toBeNull();
      expect(background.inert).toBe(true);
      expect(within(dialog).getByText("Current & <reserved> project")).toBeInTheDocument();
      expect(dialog).toHaveAccessibleDescription(
        expect.stringContaining("stops its recurring schedules")
      );
      expect(dialog).toHaveAccessibleDescription(
        expect.stringContaining("keeps its history in the background")
      );
      const cancel = within(dialog).getAllByRole("button", { name: "Cancel" })[0];
      await waitFor(() => expect(cancel).toHaveFocus());
      await user.keyboard("{Shift>}{Tab}{/Shift}");
      expect(within(dialog).getByRole("button", { name: "Confirm remove project" })).toHaveFocus();
      await user.keyboard("{Tab}");
      expect(cancel).toHaveFocus();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(background.inert).toBe(false);
      await waitFor(() => expect(opener).toHaveFocus());
      expect(within(settings).getByLabelText("Project name")).toHaveValue("Unsaved name");
      expect(api.removeProject).not.toHaveBeenCalled();
      expect(api.project).toHaveBeenCalledOnce();
    } finally {
      focus.mockRestore();
    }
  });

  it("cancels from the button or backdrop without removing or refreshing the project", async () => {
    const api = client();
    const user = userEvent.setup();
    render(viewFor(api));
    for (const method of ["button", "backdrop"]) {
      const { opener, dialog } = await openRemoval();
      if (method === "button")
        await user.click(within(dialog).getAllByRole("button", { name: "Cancel" })[1]);
      else await user.click(dialog.closest(".modal-back"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(opener).toHaveFocus());
    }
    expect(api.removeProject).not.toHaveBeenCalled();
    expect(api.project).toHaveBeenCalledOnce();
  });

  it("keeps the single pending removal and its focus guarded, then returns to projects without reading the removed detail", async () => {
    const removal = deferred();
    const api = client();
    api.removeProject.mockReturnValueOnce(removal.promise);
    const go = vi.fn();
    render(viewFor(api, workspace(), "prj_current", go));
    const { dialog, settings } = await openRemoval();
    const confirm = within(dialog).getByRole("button", { name: "Confirm remove project" });
    await userEvent.setup().click(confirm);
    expect(api.removeProject).toHaveBeenCalledExactlyOnceWith("prj_current", 7, {
      signal: expect.any(AbortSignal),
    });
    expect(confirm).toBeDisabled();
    for (const cancel of within(dialog).getAllByRole("button", { name: "Cancel" }))
      expect(cancel).toBeDisabled();
    expect(dialog.querySelector(".ledger-project-removal-description")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(dialog.closest(".modal-back"));
    fireEvent.click(confirm);
    expect(dialog).toBeInTheDocument();
    expect(api.removeProject).toHaveBeenCalledOnce();
    expect(within(settings).getByLabelText("Project name")).toBeDisabled();
    expect(within(settings).getByLabelText("Description")).toBeDisabled();
    expect(within(settings).getByRole("button", { name: "Save project" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(screen.getByRole("link", { name: "Back to projects" })).not.toHaveAttribute("href");
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeDisabled();
    for (const tab of screen.getAllByRole("tab")) expect(tab).toBeEnabled();
    fireEvent.submit(
      within(settings).getByRole("button", { name: "Save project" }).closest("form")
    );
    expect(api.updateProject).not.toHaveBeenCalled();
    await act(async () => removal.resolve());
    expect(go).toHaveBeenCalledExactlyOnceWith("ledgerProjects");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded hosting")).not.toBeInTheDocument();
    expect(api.project).toHaveBeenCalledOnce();
    expect(api.projects).toHaveBeenCalledOnce();
  });

  it("blocks removal through a settings write and its required read, then captures the refreshed revision", async () => {
    const saving = deferred();
    const refreshing = deferred();
    const current = project();
    const api = client(current);
    api.updateProject.mockReturnValueOnce(saving.promise);
    api.project.mockResolvedValueOnce(current).mockReturnValueOnce(refreshing.promise);
    render(viewFor(api));
    const settings = await openSettings();
    const remove = within(settings).getByRole("button", { name: "Remove project" });
    await userEvent.setup().click(within(settings).getByRole("button", { name: "Save project" }));
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => saving.resolve(project({ revision: 8 })));
    await waitFor(() => expect(api.project).toHaveBeenCalledTimes(2));
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(api.removeProject).not.toHaveBeenCalled();
    await act(async () => refreshing.resolve(project({ revision: 8 })));
    await waitFor(() => expect(remove).toBeEnabled());
    await userEvent.setup().click(remove);
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirm remove project" }));
    expect(api.removeProject).toHaveBeenCalledExactlyOnceWith("prj_current", 8, {
      signal: expect.any(AbortSignal),
    });
  });

  it("retains the settings draft and confirmation on failure and retries only on another explicit confirmation", async () => {
    const api = client();
    api.removeProject.mockRejectedValueOnce(new Error("Removal unavailable"));
    const go = vi.fn();
    const user = userEvent.setup();
    render(viewFor(api, workspace(), "prj_current", go));
    const settings = await openSettings();
    fireEvent.change(within(settings).getByLabelText("Project name"), {
      target: { value: "Draft project" },
    });
    fireEvent.change(within(settings).getByLabelText("Description"), {
      target: { value: "Draft description" },
    });
    await user.click(within(settings).getByRole("button", { name: "Remove project" }));
    const dialog = screen.getByRole("dialog", { name: "Remove project?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm remove project" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Removal unavailable");
    expect(within(settings).getByLabelText("Project name")).toHaveValue("Draft project");
    expect(within(settings).getByLabelText("Description")).toHaveValue("Draft description");
    expect(within(dialog).getByRole("button", { name: "Confirm remove project" })).toBeEnabled();
    expect(api.removeProject).toHaveBeenCalledOnce();
    expect(api.project).toHaveBeenCalledOnce();
    expect(go).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Confirm remove project" }));
    expect(api.removeProject).toHaveBeenCalledTimes(2);
    expect(go).toHaveBeenCalledExactlyOnceWith("ledgerProjects");
  });

  it("requires explicit reload after a conflict and uses the latest loaded revision without discarding the unsaved draft", async () => {
    const api = client();
    api.project.mockResolvedValueOnce(project()).mockResolvedValueOnce(project({ revision: 9 }));
    api.removeProject.mockRejectedValueOnce({ status: 412 });
    const user = userEvent.setup();
    render(viewFor(api));
    const settings = await openSettings();
    fireEvent.change(within(settings).getByLabelText("Project name"), {
      target: { value: "Draft project" },
    });
    await user.click(within(settings).getByRole("button", { name: "Remove project" }));
    await user.click(screen.getByRole("button", { name: "Confirm remove project" }));
    const dialog = screen.getByRole("dialog", { name: "Remove project?" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Save conflict. Reload the latest record before retrying."
    );
    expect(
      within(dialog).queryByRole("button", { name: "Confirm remove project" })
    ).not.toBeInTheDocument();
    expect(api.project).toHaveBeenCalledOnce();
    expect(api.removeProject).toHaveBeenCalledOnce();
    await user.click(within(dialog).getByRole("button", { name: "Reload project" }));
    await waitFor(() => expect(api.project).toHaveBeenCalledTimes(2));
    const refreshed = await openSettings();
    expect(within(refreshed).getByLabelText("Project name")).toHaveValue("Draft project");
    await user.click(within(refreshed).getByRole("button", { name: "Remove project" }));
    await user.click(screen.getByRole("button", { name: "Confirm remove project" }));
    expect(api.removeProject).toHaveBeenNthCalledWith(2, "prj_current", 9, {
      signal: expect.any(AbortSignal),
    });
    expect(api.project).toHaveBeenCalledTimes(2);
  });

  it("disables an open confirmation while current access is being checked", async () => {
    const api = client();
    const selected = workspace();
    const go = vi.fn();
    const onAccessChanged = vi.fn();
    const view = render(viewFor(api, selected, "prj_current", go, onAccessChanged));
    const { dialog } = await openRemoval();
    view.rerender(
      viewFor(api, selected, "prj_current", go, onAccessChanged, { accessRefreshing: true })
    );
    const confirm = within(dialog).getByRole("button", { name: "Confirm remove project" });
    expect(confirm).toBeDisabled();
    for (const cancel of within(dialog).getAllByRole("button", { name: "Cancel" }))
      expect(cancel).toBeDisabled();
    fireEvent.click(confirm);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(dialog.closest(".modal-back"));
    expect(dialog).toBeInTheDocument();
    expect(api.removeProject).not.toHaveBeenCalled();
    expect(api.project).toHaveBeenCalledOnce();
    view.rerender(viewFor(api, selected, "prj_current", go, onAccessChanged));
    expect(confirm).toBeEnabled();
    await userEvent.setup().click(within(dialog).getAllByRole("button", { name: "Cancel" })[1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.removeProject).not.toHaveBeenCalled();
  });

  it("checks current access before a conflict reload and retains the loaded draft through both read stages", async () => {
    const access = deferred();
    const refreshing = deferred();
    const onReloadAccess = vi.fn().mockReturnValue(access.promise);
    const api = client();
    api.project.mockResolvedValueOnce(project()).mockReturnValueOnce(refreshing.promise);
    api.removeProject.mockRejectedValueOnce({ status: 412 });
    const user = userEvent.setup();
    render(viewFor(api, workspace(), "prj_current", vi.fn(), vi.fn(), { onReloadAccess }));
    const settings = await openSettings();
    const name = within(settings).getByLabelText("Project name");
    const description = within(settings).getByLabelText("Description");
    fireEvent.change(name, { target: { value: "Draft project" } });
    fireEvent.change(description, { target: { value: "Draft description" } });
    await user.click(within(settings).getByRole("button", { name: "Remove project" }));
    await user.click(screen.getByRole("button", { name: "Confirm remove project" }));
    const dialog = screen.getByRole("dialog", { name: "Remove project?" });
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Reload project" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onReloadAccess).toHaveBeenCalledOnce();
    expect(api.project).toHaveBeenCalledOnce();
    expect(name).toBeDisabled();
    expect(name).toHaveValue("Draft project");
    expect(description).toBeDisabled();
    expect(description).toHaveValue("Draft description");
    fireEvent.click(within(settings).getByRole("button", { name: "Remove project" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.removeProject).toHaveBeenCalledOnce();
    await act(async () => access.resolve(true));
    await waitFor(() => expect(api.project).toHaveBeenCalledTimes(2));
    expect(within(settings).getByLabelText("Project name")).toBe(name);
    expect(name).toBeDisabled();
    expect(name).toHaveValue("Draft project");
    expect(description).toHaveValue("Draft description");
    await act(async () => refreshing.resolve(project({ revision: 9 })));
    await waitFor(() => expect(name).toBeEnabled());
    expect(within(settings).getByLabelText("Project name")).toBe(name);
    expect(name).toHaveValue("Draft project");
    expect(description).toHaveValue("Draft description");
    await user.click(within(settings).getByRole("button", { name: "Remove project" }));
    await user.click(screen.getByRole("button", { name: "Confirm remove project" }));
    expect(api.removeProject).toHaveBeenNthCalledWith(2, "prj_current", 9, {
      signal: expect.any(AbortSignal),
    });
    expect(onReloadAccess).toHaveBeenCalledOnce();
    expect(api.project).toHaveBeenCalledTimes(2);
  });

  it("clears protected data and the confirmation after lost Owner access without retrying", async () => {
    const failure = { status: 403, code: "ROLE_FORBIDDEN" };
    const api = client();
    api.removeProject.mockRejectedValueOnce(failure);
    const onAccessChanged = vi.fn();
    const go = vi.fn();
    render(viewFor(api, workspace(), "prj_current", go, onAccessChanged));
    await openRemoval();
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirm remove project" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Recorded hosting")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove project" })).not.toBeInTheDocument();
    expect(onAccessChanged).toHaveBeenCalledExactlyOnceWith(failure);
    expect(go).not.toHaveBeenCalled();
    expect(api.removeProject).toHaveBeenCalledOnce();
    expect(api.project).toHaveBeenCalledOnce();
  });

  it("explains the Owner session requirement without exposing a raw authorization code", async () => {
    const api = client();
    api.removeProject.mockRejectedValueOnce({
      status: 403,
      code: "PROJECT_OWNER_SESSION_REQUIRED",
      payload: { error: { code: "PROJECT_OWNER_SESSION_REQUIRED" } },
    });
    render(viewFor(api));
    await openRemoval();
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirm remove project" }));
    expect(
      await screen.findByText("Sign in as the ledger Owner to remove this project.")
    ).toBeInTheDocument();
    expect(screen.queryByText("PROJECT_OWNER_SESSION_REQUIRED")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.removeProject).toHaveBeenCalledOnce();
    expect(api.project).toHaveBeenCalledOnce();
  });

  it.each([
    { status: 409, code: "REVISION_LIMIT" },
    { status: 409, code: "PROJECT_BINDINGS_INVALID" },
    { status: 428, code: "PRECONDITION_REQUIRED" },
  ])(
    "offers explicit reload instead of raw $code or an automatic retry",
    async ({ status, code }) => {
      const api = client();
      api.removeProject.mockRejectedValueOnce({ status, code, payload: { error: { code } } });
      render(viewFor(api));
      await openRemoval();
      await userEvent.setup().click(screen.getByRole("button", { name: "Confirm remove project" }));
      const dialog = screen.getByRole("dialog", { name: "Remove project?" });
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Save conflict. Reload the latest record before retrying."
      );
      expect(within(dialog).getByRole("button", { name: "Reload project" })).toBeEnabled();
      expect(
        within(dialog).queryByRole("button", { name: "Confirm remove project" })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByText(code)).not.toBeInTheDocument();
      expect(api.removeProject).toHaveBeenCalledOnce();
      expect(api.project).toHaveBeenCalledOnce();
    }
  );

  it.each(["ledger", "role", "route"])(
    "discards a confirmation when its %s changes without a deletion",
    async (scope) => {
      const api = client();
      const view = render(viewFor(api));
      await openRemoval();
      const freshProject = project({
        id: scope === "route" ? "prj_other" : "prj_current",
        name: "Fresh project",
      });
      const next = client(freshProject);
      view.rerender(
        viewFor(
          next,
          workspace(
            scope === "ledger" ? { id: "wsp_other" } : scope === "role" ? { role: "admin" } : {}
          ),
          freshProject.id
        )
      );
      await screen.findByRole("heading", { name: "Fresh project" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(api.removeProject).not.toHaveBeenCalled();
      expect(next.removeProject).not.toHaveBeenCalled();
    }
  );

  it.each(["resolve", "reject"])(
    "ignores a removal %s after changing project, including access callbacks and navigation",
    async (completion) => {
      const pending = deferred();
      const api = client();
      api.removeProject.mockReturnValueOnce(pending.promise);
      const go = vi.fn();
      const onAccessChanged = vi.fn();
      const view = render(viewFor(api, workspace(), "prj_current", go, onAccessChanged));
      await openRemoval();
      await userEvent.setup().click(screen.getByRole("button", { name: "Confirm remove project" }));
      const signal = api.removeProject.mock.calls[0][2].signal;
      const nextProject = project({ id: "prj_other", name: "Fresh project" });
      const next = client(nextProject);
      view.rerender(viewFor(next, workspace(), nextProject.id, go, onAccessChanged));
      await screen.findByRole("heading", { name: "Fresh project" });
      expect(signal.aborted).toBe(true);
      await act(async () =>
        completion === "resolve"
          ? pending.resolve()
          : pending.reject({ status: 403, code: "ROLE_FORBIDDEN" })
      );
      expect(go).not.toHaveBeenCalled();
      expect(onAccessChanged).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Fresh project" })).toBeInTheDocument();
      expect(next.removeProject).not.toHaveBeenCalled();
    }
  );

  it("does not let an old completion unlock or navigate away from a newer project removal", async () => {
    const old = deferred();
    const current = deferred();
    const firstApi = client();
    firstApi.removeProject.mockReturnValueOnce(old.promise);
    const go = vi.fn();
    const view = render(viewFor(firstApi, workspace(), "prj_current", go));
    await openRemoval();
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirm remove project" }));
    const nextProject = project({ id: "prj_other", name: "Fresh project" });
    const next = client(nextProject);
    next.removeProject.mockReturnValueOnce(current.promise);
    view.rerender(viewFor(next, workspace(), nextProject.id, go));
    await screen.findByRole("heading", { name: "Fresh project" });
    await openRemoval();
    const dialog = screen.getByRole("dialog", { name: "Remove project?" });
    await userEvent
      .setup()
      .click(within(dialog).getByRole("button", { name: "Confirm remove project" }));
    await act(async () => old.resolve());
    expect(within(dialog).getByRole("button", { name: "Confirm remove project" })).toBeDisabled();
    expect(go).not.toHaveBeenCalled();
    expect(next.removeProject).toHaveBeenCalledExactlyOnceWith("prj_other", 7, {
      signal: expect.any(AbortSignal),
    });
    await act(async () => current.resolve());
    expect(go).toHaveBeenCalledExactlyOnceWith("ledgerProjects");
  });
});
