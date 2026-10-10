import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerScreen } from "./ledger.jsx";

function fixture(mode, currency = "USD") {
  const projectId = "prj_currency";
  const target = mode === "project" ? { kind: "project", projectId } : { kind: "shared" };
  const project = {
    id: projectId,
    name: "Currency fixture",
    status: "active",
    revision: 1,
    githubAccess: "not_linked",
    githubRepoIds: [],
    repositories: [],
    canCreateExpense: true,
    totals: [],
  };
  const expense = {
    id: "exp_currency",
    target,
    occurredOn: "2026-10-10",
    amount: "12.50",
    currency,
    categoryId: "cat_currency",
    purpose: "Existing hosting",
    note: null,
    quantity: null,
    unit: null,
    revision: 1,
  };
  const rule = {
    ...expense,
    id: "rul_currency",
    purpose: "Recurring hosting",
    status: "active",
    schedule: {
      frequency: "monthly",
      day: 10,
      startOn: "2026-10-10",
      endOn: null,
      timezone: "UTC",
    },
  };
  const api = {
    project: vi.fn().mockResolvedValue(project),
    projects: vi.fn().mockResolvedValue({ items: [project], nextCursor: null }),
    categories: vi
      .fn()
      .mockResolvedValue([{ id: "cat_currency", name: "Hosting", archivedAt: null }]),
    expenses: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createExpense: vi.fn().mockResolvedValue(expense),
    updateExpense: vi.fn().mockResolvedValue({ ...expense, revision: 2 }),
    createRecurringRule: vi.fn().mockResolvedValue(rule),
    updateRecurringRule: vi.fn().mockResolvedValue({ ...rule, revision: 2 }),
    reportSummary: vi.fn().mockResolvedValue({ groups: [] }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
  };
  return { api, projectId, target, expense, rule };
}

function view(data, mode) {
  return <LedgerScreen api={data.api} go={vi.fn()} mode={mode} projectId={data.projectId} />;
}

async function openCreate(data, mode, type = "one-time") {
  render(view(data, mode));
  fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
  if (type === "recurring")
    fireEvent.click(screen.getByRole("button", { name: /^Recurring plan/ }));
  fireEvent.change(screen.getByLabelText(type === "recurring" ? "Start date" : "Paid on"), {
    target: { value: "2026-10-10" },
  });
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.50" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_currency" } });
  fireEvent.change(screen.getByLabelText("What did you pay for?"), {
    target: { value: "Hosting" },
  });
}

function choose(code) {
  fireEvent.click(screen.getByRole("combobox", { name: "Currency", exact: true }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`^${code} - `) }));
}

function customDraft(code) {
  fireEvent.click(screen.getByRole("combobox", { name: "Currency", exact: true }));
  fireEvent.click(screen.getByRole("option", { name: "Custom currency", exact: true }));
  fireEvent.change(screen.getByLabelText("Currency code"), { target: { value: code } });
}

describe("expense currency selection payloads", () => {
  it.each(
    ["project", "shared"].flatMap((mode) => ["one-time", "recurring"].map((type) => [mode, type]))
  )("sends only the selected currency code for a %s %s expense", async (mode, type) => {
    const data = fixture(mode);
    await openCreate(data, mode, type);
    choose("EUR");
    expect(screen.getByLabelText("Currency")).toHaveTextContent(/^EUR$/);
    fireEvent.click(
      screen.getByRole("button", { name: type === "recurring" ? "Save schedule" : "Save expense" })
    );
    const method = type === "recurring" ? data.api.createRecurringRule : data.api.createExpense;
    await waitFor(() => expect(method).toHaveBeenCalledTimes(1));
    expect(method.mock.calls[0][0]).toMatchObject({
      target: data.target,
      currency: "EUR",
      amount: "12.50",
    });
    expect(method.mock.calls[0][0].currency).not.toMatch(/Euro| - /);
    if (type === "recurring")
      expect(method.mock.calls[0][0].schedule).toMatchObject({ startOn: "2026-10-10" });
  });

  it.each(["project", "shared"])(
    "commits an explicit supported custom code for %s",
    async (mode) => {
      const data = fixture(mode);
      await openCreate(data, mode);
      customDraft("sek");
      expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent(/^USD$/);
      fireEvent.click(screen.getByRole("button", { name: "Use currency code" }));
      expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent(/^SEK$/);
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      await waitFor(() => expect(data.api.createExpense).toHaveBeenCalledTimes(1));
      expect(data.api.createExpense.mock.calls[0][0]).toMatchObject({
        target: data.target,
        currency: "SEK",
      });
    }
  );

  it("discards unconfirmed custom text without changing the parent expense draft", async () => {
    const data = fixture("shared");
    await openCreate(data, "shared");
    choose("EUR");
    customDraft("NOK");
    fireEvent.keyDown(screen.getByLabelText("Currency code"), { key: "Escape" });
    expect(screen.queryByLabelText("Currency code")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent(/^EUR$/);
    expect(screen.getByLabelText("Amount")).toHaveValue("12.50");
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(data.api.createExpense).toHaveBeenCalledTimes(1));
    expect(data.api.createExpense.mock.calls[0][0].currency).toBe("EUR");
  });

  it("confirms a custom code with Enter without submitting the expense form", async () => {
    const data = fixture("shared");
    await openCreate(data, "shared");
    customDraft("NOK");
    fireEvent.keyDown(screen.getByLabelText("Currency code"), { key: "Enter" });
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent(/^NOK$/);
    expect(data.api.createExpense).not.toHaveBeenCalled();
    expect(data.api.createRecurringRule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(data.api.createExpense).toHaveBeenCalledTimes(1));
    expect(data.api.createExpense.mock.calls[0][0].currency).toBe("NOK");
  });

  it.each(
    ["project", "shared"].flatMap((mode) => ["expense", "recurring"].map((type) => [mode, type]))
  )(
    "preserves a supported non-common currency while editing a %s %s record",
    async (mode, type) => {
      const data = fixture(mode, "SEK");
      if (type === "expense")
        data.api.expenses.mockResolvedValue({ items: [data.expense], nextCursor: null });
      else data.api.recurringRules.mockResolvedValue({ items: [data.rule], nextCursor: null });
      render(view(data, mode));
      if (type === "expense")
        fireEvent.click(
          await screen.findByRole("button", { name: `Edit ${data.expense.purpose}` })
        );
      else {
        const row = (await screen.findByRole("heading", { name: data.rule.purpose })).closest(
          "article"
        );
        fireEvent.click(within(row).getByRole("button", { name: "Edit schedule" }));
      }
      expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent(/^SEK$/);
      customDraft("NOK");
      fireEvent.keyDown(screen.getByLabelText("Currency code"), { key: "Escape" });
      fireEvent.click(
        screen.getByRole("button", {
          name: type === "recurring" ? "Save schedule" : "Save expense",
        })
      );
      const method = type === "recurring" ? data.api.updateRecurringRule : data.api.updateExpense;
      await waitFor(() => expect(method).toHaveBeenCalledTimes(1));
      expect(method.mock.calls[0][2]).toMatchObject({ target: data.target, currency: "SEK" });
    }
  );

  it("disables the picker throughout a pending expense write", async () => {
    const data = fixture("shared");
    let resolveWrite;
    data.api.createExpense.mockReturnValue(
      new Promise((resolve) => {
        resolveWrite = resolve;
      })
    );
    await openCreate(data, "shared");
    choose("JPY");
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(data.api.createExpense).toHaveBeenCalledTimes(1));
    const picker = screen.getByRole("combobox", { name: "Currency" });
    expect(picker).toBeDisabled();
    fireEvent.click(picker);
    expect(screen.queryByRole("listbox", { name: "Currency" })).not.toBeInTheDocument();
    expect(data.api.createExpense.mock.calls[0][0].currency).toBe("JPY");
    await act(async () => resolveWrite(data.expense));
  });
});
