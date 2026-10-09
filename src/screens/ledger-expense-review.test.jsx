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
    expenses: vi.fn().mockResolvedValue({ items: expenses, nextCursor: null }),
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
async function open(f) {
  const rendered = render(view(f));
  const opener = await screen.findByRole("button", { name: "Expense review" });
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog", { name: "Expense review" });
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
    "opens %s inspection without a review request and enforces a maximum selection of ten",
    async (mode) => {
      const user = userEvent.setup();
      const f = fixture({ mode, count: 12 });
      const { dialog, opener } = await open(f);
      expect(f.api.me).toHaveBeenCalledExactlyOnceWith({ signal: expect.any(AbortSignal) });
      expect(f.api.reviewExpense).not.toHaveBeenCalled();
      expect(f.api.expenses).toHaveBeenCalledOnce();
      expect(within(dialog).getByText("Selected: 10 / 10")).toBeVisible();
      const last = within(dialog).getByRole("checkbox", { name: "Review Hosting 11" });
      expect(last).toBeDisabled();
      await user.click(within(dialog).getByRole("checkbox", { name: "Review Hosting 0" }));
      expect(last).toBeEnabled();
      await user.click(last);
      expect(
        within(dialog)
          .getAllByRole("checkbox")
          .filter((item) => item.checked)
      ).toHaveLength(10);
      expect(
        within(dialog).getByText("Current filters apply. Unloaded history is not included.")
      ).toBeVisible();
      expect(document.querySelector(".ledger-screen").inert).toBe(true);
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(document.querySelector(".ledger-screen").inert).toBe(false);
      await waitFor(() => expect(opener).toHaveFocus());
      expect(f.api.reviewExpense).not.toHaveBeenCalled();
    }
  );

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
    expect(f.api.expenses).toHaveBeenCalledOnce();
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
      await waitFor(() => expect(screen.getByLabelText("Date")).toHaveFocus());
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

  it.each(["JEV_BUDGET_LIMIT", "SUGGESTION_LIMIT"])(
    "stops the queue at %s without automatic retries or list reload",
    async (code) => {
      const f = fixture();
      f.api.reviewExpense.mockRejectedValueOnce(
        new ApiError("Stop", { status: 429, payload: { error: { code } } })
      );
      const { dialog } = await startAndFinish(f);
      expect(f.api.reviewExpense).toHaveBeenCalledOnce();
      expect(within(dialog).getAllByText("Cancelled")).toHaveLength(2);
      expect(f.api.expenses).toHaveBeenCalledOnce();
      expect(f.api.updateExpense).not.toHaveBeenCalled();
    }
  );

  it("checks at most ten records in loaded order without following pagination", async () => {
    const f = fixture({ count: 12 });
    const { dialog } = await startAndFinish(f);
    expect(f.api.reviewExpense.mock.calls.map(([id, revision]) => [id, revision])).toEqual(
      f.expenses.slice(0, 10).map((expense) => [expense.id, expense.revision])
    );
    expect(dialog.querySelectorAll('[data-review-state="done"]')).toHaveLength(10);
    expect(f.api.expenses).toHaveBeenCalledOnce();
  });

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
      expect(f.api.expenses).toHaveBeenCalledOnce();
    }
  );
});
