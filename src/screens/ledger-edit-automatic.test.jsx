import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http.js";
import { LedgerScreen } from "./ledger.jsx";

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function fixture({
  mode = "shared",
  plan = "max",
  eligible = plan !== "free",
  available = true,
} = {}) {
  const target =
    mode === "project" ? { kind: "project", projectId: "prj_automatic" } : { kind: "shared" };
  const workspace = {
    id: "usr_ledger_owner",
    role: "editor",
    revision: 1,
    permissions: { writeExpenses: true, manageProjects: false, manageCategories: false },
  };
  const profile = {
    id: "usr_editor",
    workspace,
    entitlements: {
      plan,
      jev: {
        eligible,
        available,
        monthlyBudgetUsd: plan === "pro" ? "3.00" : plan === "max" ? "5.00" : "0.00",
      },
    },
  };
  const expense = {
    id: "exp_automatic",
    target,
    occurredOn: "2026-10-09",
    amount: "239.87",
    currency: "CNY",
    categoryId: "cat_original",
    purpose: "Hosting account",
    note: "Keep this exact note",
    quantity: "2",
    unit: "months",
    revision: 7,
  };
  const project = {
    id: "prj_automatic",
    name: "Hosting project",
    status: "active",
    githubAccess: "not_linked",
    githubRepoIds: [],
    repositories: [],
    canCreateExpense: true,
    revision: 1,
    totals: [],
  };
  const api = {
    me: vi.fn().mockResolvedValue(profile),
    project: vi.fn().mockResolvedValue(project),
    projects: vi.fn().mockResolvedValue({ items: [project], nextCursor: null }),
    expenses: vi.fn().mockResolvedValue({ items: [expense], nextCursor: null }),
    categories: vi.fn().mockResolvedValue([
      { id: "cat_original", name: "Original category", archivedAt: null },
      { id: "cat_inferred", name: "Hosting", archivedAt: null },
    ]),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
    repositories: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    updateExpense: vi.fn().mockResolvedValue({ ...expense, revision: 8 }),
    createExpense: vi.fn(),
    suggestExpense: vi.fn(),
    suggestDecision: vi.fn(),
    updateRecurringRule: vi.fn(),
  };
  return { api, expense, profile, workspace, mode };
}

function viewFor(f) {
  return (
    <LedgerScreen
      api={f.api}
      workspace={f.workspace}
      go={vi.fn()}
      mode={f.mode}
      projectId="prj_automatic"
    />
  );
}

async function openEditor(f) {
  render(viewFor(f));
  const edit = await screen.findByRole("button", { name: `Edit ${f.expense.purpose}` });
  fireEvent.click(edit);
  return screen.getByLabelText("Category");
}

const savedFields = (expense, categoryId) => ({
  target: expense.target,
  occurredOn: expense.occurredOn,
  amount: expense.amount,
  currency: expense.currency,
  purpose: expense.purpose,
  note: expense.note,
  quantity: expense.quantity,
  unit: expense.unit,
  ...(categoryId ? { categoryId } : {}),
});

describe("Automatic categorization while editing ordinary expenses", () => {
  it.each([
    ["project", "pro"],
    ["shared", "pro"],
    ["project", "max"],
    ["shared", "max"],
  ])(
    "lets the scoped %s ledger's %s entitlement classify an explicit Automatic edit",
    async (mode, plan) => {
      const user = userEvent.setup();
      const f = fixture({ mode, plan });
      const profileRead = deferred();
      const write = deferred();
      const refresh = deferred();
      f.api.me.mockReturnValueOnce(profileRead.promise);
      f.api.updateExpense.mockReturnValueOnce(write.promise);
      const category = await openEditor(f);
      expect(category).toBeRequired();
      expect(category).toHaveValue(f.expense.categoryId);
      expect(screen.queryByRole("option", { name: "Automatic" })).not.toBeInTheDocument();
      await act(async () => profileRead.resolve(f.profile));
      await screen.findByRole("option", { name: "Automatic" });
      expect(category).not.toBeRequired();
      expect(category).toHaveValue(f.expense.categoryId);
      expect(f.api.me).toHaveBeenCalledExactlyOnceWith({ signal: expect.any(AbortSignal) });
      await user.selectOptions(category, "");
      f.api.expenses.mockReturnValueOnce(refresh.promise);
      await user.click(screen.getByRole("button", { name: "Save expense" }));
      expect(f.api.updateExpense).toHaveBeenCalledExactlyOnceWith(
        f.expense.id,
        7,
        savedFields(f.expense),
        {}
      );
      expect(category).toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

      const saved = { ...f.expense, categoryId: "cat_inferred", revision: 8 };
      await act(async () =>
        write.resolve({
          ...saved,
          assistance: { categorySource: "jev", suggestions: { categoryId: "cat_inferred" } },
        })
      );
      await waitFor(() => expect(f.api.expenses).toHaveBeenCalledTimes(2));
      expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Edit ${f.expense.purpose}` })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Reload", exact: true })).toBeDisabled();
      await act(async () => refresh.resolve({ items: [saved], nextCursor: null }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: `Edit ${f.expense.purpose}` })).toBeEnabled()
      );
      expect(screen.getByText("Jev categorized this expense: Hosting.")).toBeVisible();
      const row = screen.getByRole("heading", { name: saved.purpose }).closest("article");
      expect(within(row).getByText("2026-10-09 · Hosting")).toBeVisible();
      expect(within(row).getByText(f.expense.amount)).toBeVisible();
      expect(f.api.me).toHaveBeenCalledOnce();
      expect(f.api.createExpense).not.toHaveBeenCalled();
      expect(f.api.suggestExpense).not.toHaveBeenCalled();
      expect(f.api.suggestDecision).not.toHaveBeenCalled();
    }
  );

  it.each(["pro", "max"])(
    "preserves the original explicit category by default for %s edits",
    async (plan) => {
      const f = fixture({ plan });
      const category = await openEditor(f);
      await screen.findByRole("option", { name: "Automatic" });
      expect(category).toHaveValue(f.expense.categoryId);
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      await waitFor(() => expect(f.api.updateExpense).toHaveBeenCalledOnce());
      expect(f.api.updateExpense).toHaveBeenCalledWith(
        f.expense.id,
        f.expense.revision,
        savedFields(f.expense, f.expense.categoryId),
        {}
      );
    }
  );

  it.each(["project", "shared"])(
    "keeps a declined %s Automatic edit intact and requires explicit manual retry",
    async (mode) => {
      const f = fixture({ mode, plan: "pro" });
      f.api.updateExpense.mockRejectedValueOnce(
        new ApiError("Category required.", {
          status: 422,
          payload: { error: { code: "CATEGORY_REQUIRED" } },
        })
      );
      const category = await openEditor(f);
      await screen.findByRole("option", { name: "Automatic" });
      fireEvent.change(category, { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      await waitFor(() => expect(category).toHaveFocus());
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Choose a category to finish saving. Your draft is still here."
      );
      expect(category).toBeRequired();
      expect(category).toHaveValue("");
      expect(screen.getByLabelText("Paid on")).toHaveValue(f.expense.occurredOn);
      expect(screen.getByLabelText("Amount")).toHaveValue(f.expense.amount);
      expect(screen.getByLabelText("What did you pay for?")).toHaveValue(f.expense.purpose);
      expect(screen.getByLabelText("Note (optional)")).toHaveValue(f.expense.note);
      expect(f.api.expenses).toHaveBeenCalledOnce();
      expect(f.api.updateExpense).toHaveBeenCalledOnce();
      fireEvent.submit(category.closest("form"));
      expect(f.api.updateExpense).toHaveBeenCalledOnce();
      fireEvent.change(category, { target: { value: "cat_inferred" } });
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      await waitFor(() => expect(f.api.updateExpense).toHaveBeenCalledTimes(2));
      expect(f.api.updateExpense).toHaveBeenLastCalledWith(
        f.expense.id,
        7,
        savedFields(f.expense, "cat_inferred"),
        {}
      );
    }
  );

  it.each([
    { plan: "free", eligible: false, available: false },
    { plan: "pro", eligible: true, available: false },
    { plan: "max", eligible: true, available: false },
    { plan: "pro", eligible: false, available: true },
  ])("fails closed for the server entitlement $plan/$eligible/$available", async (state) => {
    const f = fixture(state);
    const category = await openEditor(f);
    await waitFor(() => expect(f.api.me).toHaveBeenCalledOnce());
    expect(category).toBeRequired();
    expect(category).toHaveValue(f.expense.categoryId);
    expect(screen.queryByRole("option", { name: "Automatic" })).not.toBeInTheDocument();
    fireEvent.change(category, { target: { value: "" } });
    fireEvent.submit(category.closest("form"));
    expect(f.api.updateExpense).not.toHaveBeenCalled();
  });

  it("keeps manual editing available when the scoped entitlement read fails", async () => {
    const f = fixture();
    f.api.me.mockRejectedValueOnce(new Error("Profile unavailable"));
    const category = await openEditor(f);
    await act(async () => {});
    expect(category).toBeRequired();
    expect(category).toHaveValue(f.expense.categoryId);
    expect(screen.queryByRole("option", { name: "Automatic" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(f.api.updateExpense).toHaveBeenCalledOnce());
    expect(f.api.updateExpense).toHaveBeenCalledWith(
      f.expense.id,
      7,
      savedFields(f.expense, f.expense.categoryId),
      {}
    );
  });

  it.each(["project", "shared"])(
    "allows automatic categorization for %s recurring schedule editing while retaining the original category",
    async (mode) => {
      const f = fixture({ mode, plan: "pro" });
      const schedule = {
        ...f.expense,
        id: "rul_manual",
        status: "active",
        schedule: {
          frequency: "monthly",
          day: 9,
          startOn: "2026-10-09",
          timezone: "Asia/Shanghai",
          endOn: null,
        },
        nextOccurrenceOn: "2026-11-09",
      };
      f.api.recurringRules.mockResolvedValue({ items: [schedule], nextCursor: null });
      render(viewFor(f));
      const row = (await screen.findByRole("heading", { name: "Recurring plans" })).closest(
        "section"
      );
      await waitFor(() =>
        expect(within(row).getByRole("button", { name: "Edit schedule" })).toBeEnabled()
      );
      fireEvent.click(within(row).getByRole("button", { name: "Edit schedule" }));
      await screen.findByRole("option", { name: "Automatic" });
      expect(screen.getByLabelText("Category")).not.toBeRequired();
      expect(screen.getByLabelText("Category")).toHaveValue(f.expense.categoryId);
      expect(f.api.me).toHaveBeenCalledOnce();
    }
  );

  it("aborts closed edit eligibility and prevents a late result from enabling another ledger's editor", async () => {
    const old = fixture({ plan: "max" });
    const profileRead = deferred();
    old.api.me.mockReturnValueOnce(profileRead.promise);
    const view = render(viewFor(old));
    fireEvent.click(await screen.findByRole("button", { name: `Edit ${old.expense.purpose}` }));
    const signal = old.api.me.mock.calls[0][0].signal;
    const fresh = fixture({ plan: "free", available: false });
    fresh.workspace = { ...fresh.workspace, id: "usr_other_owner" };
    view.rerender(viewFor(fresh));
    expect(signal.aborted).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: `Edit ${fresh.expense.purpose}` }));
    await act(async () => profileRead.resolve(old.profile));
    expect(screen.getByLabelText("Category")).toBeRequired();
    expect(screen.queryByRole("option", { name: "Automatic" })).not.toBeInTheDocument();
    expect(old.api.updateExpense).not.toHaveBeenCalled();
    expect(fresh.api.me).toHaveBeenCalledOnce();
  });

  it.each(["JEV_PLAN_REQUIRED", "MAX_REQUIRED"])(
    "explains %s using the current Pro or Max eligibility rule",
    async (code) => {
      const f = fixture();
      f.api.updateExpense.mockRejectedValueOnce(
        new ApiError("Plan changed.", { status: 403, payload: { error: { code } } })
      );
      await openEditor(f);
      await screen.findByRole("option", { name: "Automatic" });
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Jev assistance requires the ledger Owner's Pro or Max plan."
      );
    }
  );
});
