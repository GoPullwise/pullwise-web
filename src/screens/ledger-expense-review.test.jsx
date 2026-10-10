import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http.js";
import { LedgerScreen } from "./ledger.jsx";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function outcome(expense, checks = {}) {
  return {
    expenseId: expense.id,
    revision: expense.revision,
    questionVersion: "ledger-suggest-v2",
    modelVersion: "local-choice-fixture",
    checks: {
      category: { status: "checked", current: expense.categoryId },
      target: { status: "checked", current: expense.target },
      duplicate: { status: "checked" },
      ...checks,
    },
  };
}

function fixture({
  mode = "shared",
  count = 3,
  eligible = true,
  available = true,
  write = true,
} = {}) {
  const target =
    mode === "project" ? { kind: "project", projectId: "prj_review" } : { kind: "shared" };
  const workspace = {
    id: "usr_review_owner",
    revision: 1,
    role: write ? "editor" : "viewer",
    permissions: { writeExpenses: write, manageProjects: false, manageCategories: false },
  };
  const expenses = Array.from({ length: count }, (_, index) => ({
    id: `exp_review_${index}`,
    revision: 8,
    target,
    occurredOn: "2026-10-09",
    amount: "200.00",
    currency: "USD",
    categoryId: "cat_hosting",
    purpose: `Hosting ${index}`,
    note: "Saved note",
    quantity: "2",
    unit: "months",
  }));
  const categories = [
    { id: "cat_hosting", name: "Hosting", archivedAt: null },
    { id: "cat_tools", name: "Tools", archivedAt: null },
  ];
  const project = {
    id: "prj_review",
    revision: 1,
    name: "Selected project",
    status: "active",
    githubAccess: "not_linked",
    canCreateExpense: true,
    repositories: [],
    githubRepoIds: [],
    totals: [],
  };
  const api = {
    me: vi.fn().mockResolvedValue({
      workspace,
      entitlements: { jev: { eligible, available, monthlyBudgetUsd: "3.00" } },
    }),
    project: vi.fn().mockResolvedValue(project),
    projects: vi.fn().mockResolvedValue({ items: [project], nextCursor: null }),
    expenses: vi.fn().mockImplementation((query = {}) => {
      const offset = query.cursor ? Number(query.cursor.replace("review_page_", "")) : 0;
      const limit = query.limit ?? 50;
      return Promise.resolve({
        items: expenses.slice(offset, offset + limit),
        nextCursor: offset + limit < expenses.length ? `review_page_${offset + limit}` : null,
      });
    }),
    categories: vi.fn().mockResolvedValue(categories),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reviewExpense: vi
      .fn()
      .mockImplementation((id) =>
        Promise.resolve(outcome(expenses.find((item) => item.id === id)))
      ),
    expense: vi
      .fn()
      .mockImplementation((id) => Promise.resolve(expenses.find((item) => item.id === id))),
    updateExpense: vi.fn().mockResolvedValue({ ...expenses[0], revision: 9 }),
    createExpense: vi.fn(),
    removeExpense: vi.fn(),
  };
  return { mode, target, workspace, expenses, api, categories, onAccessChanged: vi.fn() };
}

const view = (f) => (
  <LedgerScreen
    api={f.api}
    workspace={f.workspace}
    go={vi.fn()}
    mode={f.mode}
    projectId="prj_review"
    onAccessChanged={f.onAccessChanged}
  />
);
async function open(f, ready = true) {
  const rendered = render(view(f));
  const opener = await screen.findByRole("button", { name: "Expense review" });
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name: "Expense review" });
  if (ready)
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Start review" })).toBeEnabled()
    );
  return { rendered, dialog, opener };
}
async function startAndFinish(f) {
  const state = await open(f);
  fireEvent.click(within(state.dialog).getByRole("button", { name: "Start review" }));
  await waitFor(() =>
    expect(within(state.dialog).getByRole("button", { name: "New selection" })).toBeEnabled()
  );
  return state;
}

describe("explicit inspection of selected saved expenses", () => {
  it.each(["project", "shared"])(
    "loads up to one hundred %s review expenses independently of the ten-record page",
    async (mode) => {
      const user = userEvent.setup();
      const f = fixture({ mode, count: 101 });
      const { dialog, opener } = await open(f);
      expect(f.api.me).toHaveBeenCalledExactlyOnceWith({ signal: expect.any(AbortSignal) });
      expect(f.api.reviewExpense).not.toHaveBeenCalled();
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
      const query = mode === "project"
        ? { target: "project", projectId: "prj_review" }
        : { target: "shared" };
      expect(f.api.expenses).toHaveBeenNthCalledWith(
        1, { ...query, limit: 10 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(f.api.expenses).toHaveBeenNthCalledWith(
        2, { ...query, limit: 100 },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(within(dialog).getByText("Selected: 100 / 100")).toBeVisible();
      expect(within(dialog).getAllByRole("checkbox")).toHaveLength(100);
      expect(within(dialog).getByRole("checkbox", { name: "Review Hosting 10" })).toBeChecked();
      expect(within(dialog).getByRole("checkbox", { name: "Review Hosting 99" })).toBeChecked();
      expect(within(dialog).queryByRole("checkbox", { name: "Review Hosting 100" })).not.toBeInTheDocument();
      const last = within(dialog).getByRole("checkbox", { name: "Review Hosting 99" });
      await user.click(last);
      expect(within(dialog).getByText("Selected: 99 / 100")).toBeVisible();
      expect(last).toBeEnabled();
      await user.click(last);
      expect(
        within(dialog)
          .getAllByRole("checkbox")
          .filter((item) => item.checked)
      ).toHaveLength(100);
      expect(
        within(dialog).getByText("The first 100 matching expenses are loaded for review. Other history is not included.")
      ).toBeVisible();
      expect(document.querySelector(".ledger-screen").inert).toBe(true);
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(document.querySelector(".ledger-screen").inert).toBe(false);
      await waitFor(() => expect(opener).toHaveFocus());
      expect(f.api.reviewExpense).not.toHaveBeenCalled();
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
    }
  );

  it("reads the filtered selection from its first page without changing the ordinary expense page", async () => {
    const f = fixture({ count: 101 });
    render(view(f));
    await screen.findByRole("heading", { name: "Hosting 0" });
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Next", exact: true })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
    await screen.findByRole("heading", { name: "Hosting 10" });
    const before = f.api.expenses.mock.calls.length;
    const opener = screen.getByRole("button", { name: "Expense review" });
    await waitFor(() => expect(opener).toBeEnabled());
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Start review" })).toBeEnabled());
    expect(f.api.expenses).toHaveBeenLastCalledWith(
      { target: "shared", from: "2026-10-01", limit: 100 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(f.api.expenses).toHaveBeenCalledTimes(before + 1);
    expect(within(dialog).getByRole("checkbox", { name: "Review Hosting 0" })).toBeChecked();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(100);
    expect(f.api.reviewExpense).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Hosting 10" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hosting 0" })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".ledger-expense-row")).toHaveLength(10);
    expect(f.api.expenses).toHaveBeenCalledTimes(before + 1);
  });

  it("aborts an unfinished selection read and keeps its page guard until the read settles", async () => {
    const f = fixture({ count: 101 });
    const held = deferred();
    const list = f.api.expenses.getMockImplementation();
    f.api.expenses.mockImplementation((query, options) =>
      query.limit === 100 ? held.promise : list(query, options)
    );
    const { dialog, opener } = await open(f, false);
    await waitFor(() => expect(f.api.expenses).toHaveBeenCalledTimes(2));
    expect(within(dialog).getByRole("button", { name: "Start review" })).toBeDisabled();
    expect(within(dialog).getByText("Loading expenses for review…")).toBeVisible();
    const signal = f.api.expenses.mock.calls[1][1].signal;
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(signal.aborted).toBe(true);
    expect(opener).toBeDisabled();
    await act(async () => held.resolve({ items: f.expenses.slice(0, 100), nextCursor: "more" }));
    await waitFor(() => expect(opener).toBeEnabled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Hosting 99")).not.toBeInTheDocument();
    expect(f.api.reviewExpense).not.toHaveBeenCalled();
    fireEvent.click(opener);
    await waitFor(() => expect(f.api.expenses).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByRole("button", { name: "Start review" })).toBeEnabled());
  });

  it.each([401, 403, 500])("handles a selection read failure %s without model requests", async (status) => {
    const f = fixture();
    const failure = new ApiError("Selection unavailable", {
      status,
      payload: { error: { code: status === 500 ? "UNAVAILABLE" : "WORKSPACE_FORBIDDEN" } },
    });
    const list = f.api.expenses.getMockImplementation();
    f.api.expenses.mockImplementation((query, options) =>
      query.limit === 100 ? Promise.reject(failure) : list(query, options)
    );
    const { dialog } = await open(f, false);
    if (status === 500) {
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Expenses could not be loaded for review.");
      expect(within(dialog).getByRole("button", { name: "Start review" })).toBeDisabled();
      expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
      expect(f.onAccessChanged).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(f.onAccessChanged).toHaveBeenCalledWith(failure));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Hosting 0" })).not.toBeInTheDocument();
    }
    expect(f.api.reviewExpense).not.toHaveBeenCalled();
    expect(f.api.expenses).toHaveBeenCalledTimes(2);
  });

  it.each(["workspace", "role"])("discards a late selection after a %s change", async (change) => {
    const f = fixture({ count: 101 });
    const held = deferred();
    const list = f.api.expenses.getMockImplementation();
    f.api.expenses.mockImplementation((query, options) =>
      query.limit === 100 ? held.promise : list(query, options)
    );
    const { rendered } = await open(f, false);
    await waitFor(() => expect(f.api.expenses).toHaveBeenCalledTimes(2));
    const signal = f.api.expenses.mock.calls[1][1].signal;
    const fresh = fixture({ count: 1, write: change !== "role" });
    fresh.expenses[0].purpose = "Current authorized expense";
    if (change === "workspace") fresh.workspace = { ...fresh.workspace, id: "usr_other_owner" };
    rendered.rerender(view(fresh));
    expect(signal.aborted).toBe(true);
    await act(async () => held.resolve({ items: f.expenses.slice(0, 100), nextCursor: "more" }));
    await screen.findByRole("heading", { name: "Current authorized expense" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Hosting 99")).not.toBeInTheDocument();
    expect(f.api.reviewExpense).not.toHaveBeenCalled();
    expect(fresh.api.reviewExpense).not.toHaveBeenCalled();
    if (change === "role") expect(screen.queryByRole("button", { name: "Expense review" })).not.toBeInTheDocument();
  });

  it.each(["too-many", "wrong-target", "duplicate-id", "invalid-revision", "missing-items"])(
    "rejects an invalid selection response: %s",
    async (kind) => {
      const f = fixture({ count: 101 });
      const page = { items: f.expenses.slice(0, 100), nextCursor: "more" };
      if (kind === "too-many") page.items = f.expenses;
      if (kind === "wrong-target") page.items[0] = { ...page.items[0], target: { kind: "project", projectId: "prj_other" } };
      if (kind === "duplicate-id") page.items[1] = page.items[0];
      if (kind === "invalid-revision") page.items[0] = { ...page.items[0], revision: 0 };
      if (kind === "missing-items") delete page.items;
      const list = f.api.expenses.getMockImplementation();
      f.api.expenses.mockImplementation((query, options) =>
        query.limit === 100 ? Promise.resolve(page) : list(query, options)
      );
      const { dialog } = await open(f, false);
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Expenses could not be loaded for review.");
      expect(within(dialog).getByRole("button", { name: "Start review" })).toBeDisabled();
      expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
      expect(f.api.reviewExpense).not.toHaveBeenCalled();
    }
  );

  it("shows a removed category label in structured results without assigning it or writing an expense", async () => {
    const f = fixture({ count: 1 });
    f.api.categories.mockResolvedValue([
      { ...f.categories[0], removedAt: "2026-10-09T00:00:00Z" },
      f.categories[1],
    ]);
    render(view(f));
    await screen.findByRole("heading", { name: "Hosting 0" });
    fireEvent.click(screen.getByRole("button", { name: "Expense review" }));
    const dialog = screen.getByRole("dialog", { name: "Expense review" });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Start review" }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Start review" }),
    );
    expect(
      await within(dialog).findByText("Current: Hosting (Removed)"),
    ).toBeInTheDocument();
    expect(f.api.updateExpense).not.toHaveBeenCalled();
    expect(f.api.createExpense).not.toHaveBeenCalled();
  });

  it("runs sequentially, keeps the page locked until aborted work settles, and retains partial results", async () => {
    const f = fixture();
    const first = deferred();
    const second = deferred();
    f.api.reviewExpense.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { dialog, opener } = await open(f);
    const start = within(dialog).getByRole("button", { name: "Start review" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(f.api.reviewExpense).toHaveBeenCalledExactlyOnceWith(f.expenses[0].id, 8, {
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByRole("button", { name: "Reload", exact: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(f.api.reviewExpense.mock.calls[0][2].signal.aborted).toBe(false);
    await act(async () =>
      first.resolve(
        outcome(f.expenses[0], {
          category: { status: "uncertain", current: "cat_hosting", confidence: 0.45 },
        })
      )
    );
    await waitFor(() => expect(f.api.reviewExpense).toHaveBeenCalledTimes(2));
    expect(within(dialog).getByText("No confident choice. Review it manually.")).toBeVisible();
    const signal = f.api.reviewExpense.mock.calls[1][2].signal;
    fireEvent.click(within(dialog).getByRole("button", { name: "Stop review" }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole("button", { name: "Reload", exact: true })).toBeDisabled();
    await act(async () => second.resolve(outcome(f.expenses[1])));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reload", exact: true })).toBeEnabled()
    );
    expect(f.api.reviewExpense).toHaveBeenCalledTimes(2);
    expect(within(dialog).getAllByText("Cancelled")).toHaveLength(2);
    expect(within(dialog).getByText("No confident choice. Review it manually.")).toBeVisible();
    expect(f.api.expenses).toHaveBeenCalledTimes(2);
    expect(f.api.updateExpense).not.toHaveBeenCalled();
    expect(f.api.createExpense).not.toHaveBeenCalled();
    expect(f.api.removeExpense).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => expect(opener).toHaveFocus());
    fireEvent.click(opener);
    expect(await screen.findByText("No confident choice. Review it manually.")).toBeVisible();
    expect(f.api.reviewExpense).toHaveBeenCalledTimes(2);
  });

  it("shows only structured choices and scores, local duplicates and explicit partial statuses", async () => {
    const f = fixture({ mode: "project", count: 4 });
    f.api.reviewExpense
      .mockResolvedValueOnce(
        outcome(f.expenses[0], {
          category: {
            status: "issue",
            current: "cat_hosting",
            suggested: "cat_tools",
            confidence: 0.94,
            explanation: "NEVER DISPLAY MODEL PROSE",
          },
          target: {
            status: "issue",
            current: f.target,
            suggested: { kind: "shared" },
            confidence: 0.9,
          },
          duplicate: { status: "issue", candidate: { id: f.expenses[1].id, revision: 8 } },
        })
      )
      .mockResolvedValueOnce(
        outcome(f.expenses[1], {
          category: { status: "uncertain", current: "cat_hosting", confidence: 0.45 },
          target: { status: "uncertain", current: f.target, confidence: 0.3 },
        })
      )
      .mockResolvedValueOnce(
        outcome(f.expenses[2], {
          category: { status: "unavailable", current: "cat_hosting", reason: "no_categories" },
          target: { status: "unavailable", current: f.target, reason: "invalid_context" },
        })
      );
    const { dialog } = await startAndFinish(f);
    expect(within(dialog).getByText("Suggested choice: Tools")).toBeVisible();
    expect(within(dialog).getByText("Suggested choice: Shared expense pool")).toBeVisible();
    expect(within(dialog).getByText("0.94")).toBeVisible();
    expect(within(dialog).getByText("0.45")).toBeVisible();
    expect(within(dialog).getByText("No active category can be compared.")).toBeVisible();
    expect(within(dialog).getByText("Jev is unavailable for this check.")).toBeVisible();
    const first = dialog.querySelector('[data-expense-id="exp_review_0"]');
    expect(within(first).getByText(/Hosting 1 · 2026-10-09/)).toBeVisible();
    expect(within(dialog).queryByText("NEVER DISPLAY MODEL PROSE")).not.toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/all clear|all records|move expense/i);
    expect(f.api.expense).not.toHaveBeenCalled();
    expect(f.api.updateExpense).not.toHaveBeenCalled();
  });

  it("permits paid local duplicate review when model checks are unavailable", async () => {
    const f = fixture({ available: false, count: 1 });
    f.api.reviewExpense.mockResolvedValueOnce(
      outcome(f.expenses[0], {
        category: { status: "unavailable", current: "cat_hosting", reason: "disabled" },
        target: { status: "unavailable", current: f.target, reason: "disabled" },
        duplicate: { status: "issue", candidate: { id: "exp_unloaded", revision: 2 } },
      })
    );
    const { dialog } = await startAndFinish(f);
    expect(
      within(dialog).getByText(
        "Jev category and target checks are unavailable. Local duplicate checks remain available."
      )
    ).toBeVisible();
    expect(
      within(dialog).getByText("A possible duplicate is outside the loaded records.")
    ).toBeVisible();
    expect(dialog.textContent).not.toContain("exp_unloaded");
    expect(f.api.reviewExpense).toHaveBeenCalledOnce();
    expect(f.api.expense).not.toHaveBeenCalled();
  });

  it.each(["free", "failed"])(
    "keeps Start disabled for %s eligibility without calling review",
    async (state) => {
      const f = fixture({ eligible: false });
      if (state === "failed") f.api.me.mockRejectedValueOnce(new Error("Profile unavailable"));
      render(view(f));
      fireEvent.click(await screen.findByRole("button", { name: "Expense review" }));
      const dialog = await screen.findByRole("dialog");
      await waitFor(() =>
        expect(within(dialog).queryByText("Checking Jev availability…")).not.toBeInTheDocument()
      );
      expect(within(dialog).getByRole("button", { name: "Start review" })).toBeDisabled();
      expect(f.api.reviewExpense).not.toHaveBeenCalled();
    }
  );

  it("hides inspection from viewers and disables it while an entry draft is open", async () => {
    const readOnly = fixture({ write: false });
    const first = render(view(readOnly));
    await screen.findByRole("heading", { name: "Hosting 0" });
    expect(screen.queryByRole("button", { name: "Expense review" })).not.toBeInTheDocument();
    first.unmount();
    const f = fixture();
    render(view(f));
    fireEvent.click(await screen.findByRole("button", { name: "Edit Hosting 0" }));
    expect(screen.getByRole("button", { name: "Expense review" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("What did you pay for?"), {
      target: { value: "Draft stays" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Expense review" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Draft stays");
  });

  it.each(["project", "shared"])(
    "freshly reads the %s record before opening its existing editor",
    async (mode) => {
      const f = fixture({ mode, count: 1 });
      const freshRead = deferred();
      f.api.expense.mockReturnValueOnce(freshRead.promise);
      const { dialog } = await startAndFinish(f);
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Edit reviewed expense Hosting 0" })
      );
      expect(f.api.expense).toHaveBeenCalledExactlyOnceWith(f.expenses[0].id, {
        signal: expect.any(AbortSignal),
      });
      expect(screen.getByRole("button", { name: "Add expense" })).toBeDisabled();
      expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
      const fresh = {
        ...f.expenses[0],
        revision: 12,
        categoryId: "cat_tools",
        amount: "123.456789",
        purpose: "Fresh saved purpose",
        note: "Fresh saved note",
      };
      await act(async () => freshRead.resolve(fresh));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByLabelText("Category")).toHaveValue("cat_tools"));
      expect(screen.getByLabelText("Amount")).toHaveValue("123.456789");
      expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Fresh saved purpose");
      expect(screen.getByLabelText("Note (optional)")).toHaveValue("Fresh saved note");
      await waitFor(() => expect(screen.getByLabelText("Paid on")).toHaveFocus());
      expect(f.api.updateExpense).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      await waitFor(() =>
        expect(f.api.updateExpense).toHaveBeenCalledWith(
          fresh.id,
          12,
          {
            target: f.target,
            occurredOn: fresh.occurredOn,
            amount: fresh.amount,
            currency: fresh.currency,
            categoryId: fresh.categoryId,
            purpose: fresh.purpose,
            note: fresh.note,
            quantity: fresh.quantity,
            unit: fresh.unit,
          },
          {}
        )
      );
    }
  );

  it("rejects a fresh record from another target without opening an editor", async () => {
    const f = fixture({ count: 1 });
    f.api.expense.mockResolvedValueOnce({
      ...f.expenses[0],
      target: { kind: "project", projectId: "prj_other" },
      revision: 12,
    });
    const { dialog } = await startAndFinish(f);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Edit reviewed expense Hosting 0" })
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Current expense could not be loaded."
    );
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(f.api.updateExpense).not.toHaveBeenCalled();
  });

  it("aborts a scope change and ignores late review results in the new ledger", async () => {
    const f = fixture();
    const held = deferred();
    f.api.reviewExpense.mockReturnValueOnce(held.promise);
    const { rendered, dialog } = await open(f);
    fireEvent.click(within(dialog).getByRole("button", { name: "Start review" }));
    const signal = f.api.reviewExpense.mock.calls[0][2].signal;
    const fresh = fixture();
    fresh.workspace = { ...fresh.workspace, id: "usr_other_owner" };
    rendered.rerender(view(fresh));
    expect(signal.aborted).toBe(true);
    await act(async () =>
      held.resolve(
        outcome(f.expenses[0], {
          category: {
            status: "issue",
            current: "cat_hosting",
            suggested: "cat_tools",
            confidence: 0.95,
          },
        })
      )
    );
    await screen.findByRole("heading", { name: "Hosting 0" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested choice: Tools")).not.toBeInTheDocument();
    expect(f.api.reviewExpense).toHaveBeenCalledOnce();
    expect(fresh.api.reviewExpense).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reload", exact: true })).toBeEnabled();
  });

  it.each(["JEV_BUDGET_LIMIT", "RATE_LIMITED"])(
    "stops the queue at %s without automatic retries or list reload",
    async (code) => {
      const f = fixture();
      f.api.reviewExpense.mockRejectedValueOnce(
        new ApiError("Stop", { status: 429, payload: { error: { code } } })
      );
      const { dialog } = await startAndFinish(f);
      expect(f.api.reviewExpense).toHaveBeenCalledOnce();
      expect(within(dialog).getAllByText("Cancelled")).toHaveLength(2);
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
      expect(f.api.updateExpense).not.toHaveBeenCalled();
      const message =
        code === "JEV_BUDGET_LIMIT"
          ? "Monthly Jev budget reached. Continue manually."
          : "This expense could not be reviewed. Start a new review to try again.";
      expect(within(dialog).getAllByText(message)).toHaveLength(2);
      expect(dialog.textContent).not.toContain("Daily Jev allowance");
    }
  );

  it.each([11, 100, 101])(
    "checks up to one hundred of %s matching records in order without following pagination",
    async (count) => {
      const f = fixture({ count });
      const { dialog } = await open(f);
      await act(async () =>
        fireEvent.click(within(dialog).getByRole("button", { name: "Start review" }))
      );
      expect(within(dialog).getByRole("button", { name: "New selection" })).toBeEnabled();
      const chosen = f.expenses.slice(0, 100);
      expect(f.api.reviewExpense.mock.calls.map(([id, revision]) => [id, revision])).toEqual(
        chosen.map((expense) => [expense.id, expense.revision])
      );
      expect(dialog.querySelectorAll('[data-review-state="done"]')).toHaveLength(chosen.length);
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
    }
  );

  it.each([401, 403])(
    "clears protected records when opening eligibility returns %s",
    async (status) => {
      const f = fixture();
      const failure = new ApiError("Expired", {
        status,
        payload: { error: { code: "WORKSPACE_FORBIDDEN" } },
      });
      f.api.me.mockRejectedValueOnce(failure);
      render(view(f));
      fireEvent.click(await screen.findByRole("button", { name: "Expense review" }));
      await waitFor(() => expect(f.onAccessChanged).toHaveBeenCalledWith(failure));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Hosting 0" })).not.toBeInTheDocument();
      expect(f.api.reviewExpense).not.toHaveBeenCalled();
    }
  );

  it.each(["self-duplicate", "missing-duplicate", "unknown-target", "invalid-score"])(
    "fails closed for malformed structured advice: %s",
    async (kind) => {
      const f = fixture({ count: 1 });
      const result = outcome(f.expenses[0]);
      if (kind === "self-duplicate")
        result.checks.duplicate = {
          status: "issue",
          candidate: { id: f.expenses[0].id, revision: 8 },
        };
      if (kind === "missing-duplicate") result.checks.duplicate = { status: "issue" };
      if (kind === "unknown-target")
        result.checks.target = {
          status: "issue",
          current: f.target,
          suggested: { kind: "foreign" },
        };
      if (kind === "invalid-score") result.checks.category.confidence = "model prose";
      f.api.reviewExpense.mockResolvedValueOnce(result);
      const { dialog } = await startAndFinish(f);
      expect(dialog.querySelector('[data-review-state="error"]')).not.toBeNull();
      expect(dialog.querySelector("[data-check]")).toBeNull();
      expect(f.api.updateExpense).not.toHaveBeenCalled();
    }
  );

  it("does not inject a late fresh read after the inspection dialog is closed", async () => {
    const f = fixture({ count: 1 });
    const held = deferred();
    f.api.expense.mockReturnValueOnce(held.promise);
    const { dialog, opener } = await startAndFinish(f);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Edit reviewed expense Hosting 0" })
    );
    const signal = f.api.expense.mock.calls[0][1].signal;
    expect(screen.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(signal.aborted).toBe(true);
    expect(opener).toBeDisabled();
    await act(async () =>
      held.resolve({ ...f.expenses[0], revision: 20, purpose: "Late saved draft" })
    );
    await waitFor(() => expect(opener).toBeEnabled());
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    expect(screen.queryByText("Late saved draft")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
    expect(f.api.updateExpense).not.toHaveBeenCalled();
  });

  it("keeps recurring controls disabled after Close until an aborted review settles", async () => {
    const f = fixture({ count: 1 });
    const held = deferred();
    f.api.reviewExpense.mockReturnValueOnce(held.promise);
    f.api.recurringRules.mockResolvedValue({
      items: [
        {
          ...f.expenses[0],
          id: "rul_review",
          status: "active",
          nextOccurrenceOn: "2026-11-09",
          schedule: {
            frequency: "monthly",
            day: 9,
            startOn: "2026-10-09",
            timezone: "Asia/Shanghai",
            endOn: null,
          },
        },
      ],
      nextCursor: null,
    });
    const { dialog } = await open(f);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit schedule" })).toBeEnabled()
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Start review" }));
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit schedule" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    await act(async () => held.resolve(outcome(f.expenses[0])));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit schedule" })).toBeEnabled()
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
    expect(f.api.updateExpense).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    "clears protected records and results on an access failure %s",
    async (status) => {
      const f = fixture();
      const failure = new ApiError("Access changed", {
        status,
        payload: { error: { code: "ROLE_FORBIDDEN" } },
      });
      f.api.reviewExpense
        .mockResolvedValueOnce(outcome(f.expenses[0]))
        .mockRejectedValueOnce(failure);
      const { dialog } = await open(f);
      fireEvent.click(within(dialog).getByRole("button", { name: "Start review" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.queryByRole("heading", { name: "Hosting 0" })).not.toBeInTheDocument();
      expect(f.onAccessChanged).toHaveBeenCalledWith(failure);
      expect(f.api.reviewExpense).toHaveBeenCalledTimes(2);
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
    }
  );
});
