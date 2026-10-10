import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LedgerScreen } from "./ledger.jsx";

const dateHelp =
  "Each due date adds a separate expense.";

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function fixture(mode) {
  const projectId = "prj_dates";
  const target = mode === "project" ? { kind: "project", projectId } : { kind: "shared" };
  const project = {
    id: projectId,
    name: "Monthly services",
    status: "active",
    revision: 3,
    githubAccess: "not_linked",
    githubRepoIds: [],
    repositories: [],
    canCreateExpense: true,
    totals: [],
  };
  const rule = {
    id: "rul_dates",
    target,
    amount: "200.00",
    currency: "USD",
    categoryId: "cat_dates",
    purpose: "Monthly hosting",
    note: null,
    quantity: null,
    unit: null,
    status: "active",
    revision: 7,
    schedule: {
      frequency: "monthly",
      day: 9,
      startOn: "2026-10-09",
      endOn: null,
      timezone: "Asia/Shanghai",
    },
    nextOccurrenceOn: "2026-10-09",
    nextRunAt: 1791475200,
  };
  const write = deferred();
  const api = {
    project: vi.fn().mockResolvedValue(project),
    projects: vi.fn().mockResolvedValue({ items: [project], nextCursor: null }),
    categories: vi.fn().mockResolvedValue([{ id: "cat_dates", name: "Hosting", archivedAt: null }]),
    expenses: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    recurringRules: vi.fn().mockResolvedValue({ items: [rule], nextCursor: null }),
    updateRecurringRule: vi.fn().mockReturnValue(write.promise),
    createRecurringRule: vi.fn(),
    updateExpense: vi.fn(),
    createExpense: vi.fn(),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
    repositories: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  };
  const reads = () =>
    [api.project, api.projects, api.categories, api.expenses, api.recurringRules].map(
      (method) => method.mock.calls.length
    );
  return { api, projectId, rule, write, reads };
}

describe("Recurring start dates in the shared expense editor", () => {
  it.each(["project", "shared"])(
    "saves a %s start date separately from the monthly day and displays the server's next date",
    async (mode) => {
      const user = userEvent.setup();
      const { api, projectId, rule, write, reads } = fixture(mode);
      render(<LedgerScreen api={api} go={vi.fn()} mode={mode} projectId={projectId} />);
      const row = (await screen.findByRole("heading", { name: rule.purpose })).closest("article");
      const readCounts = reads();
      await user.click(within(row).getByRole("button", { name: "Edit schedule" }));

      const startDate = screen.getByLabelText("Start date");
      const repeatDay = screen.getByLabelText("Day of month");
      expect(startDate).toHaveValue("2026-10-09");
      expect(repeatDay).toHaveValue(9);
      expect(document.getElementById(startDate.getAttribute("aria-describedby"))).toHaveTextContent(
        dateHelp
      );

      fireEvent.change(startDate, { target: { value: "2026-10-10" } });
      expect(startDate).toHaveValue("2026-10-10");
      expect(repeatDay).toHaveValue(9);
      expect(screen.getByLabelText("Time zone")).toHaveValue("Asia/Shanghai");
      expect(within(row).getByText("2026-10-09", { selector: "time" })).toBeVisible();
      expect(api.updateRecurringRule).not.toHaveBeenCalled();
      expect(reads()).toEqual(readCounts);

      await user.click(screen.getByRole("button", { name: "Save schedule" }));
      expect(api.updateRecurringRule).toHaveBeenCalledExactlyOnceWith(
        rule.id,
        rule.revision,
        {
          target: rule.target,
          amount: "200.00",
          currency: "USD",
          categoryId: "cat_dates",
          purpose: rule.purpose,
          note: null,
          quantity: null,
          unit: null,
          schedule: { ...rule.schedule, startOn: "2026-10-10" },
        },
        { signal: expect.any(AbortSignal) }
      );
      expect(within(row).getByText("2026-10-09", { selector: "time" })).toBeVisible();
      expect(startDate).toBeDisabled();

      const saved = {
        ...rule,
        revision: 8,
        schedule: { ...rule.schedule, startOn: "2026-10-10" },
        nextOccurrenceOn: "2026-11-09",
        nextRunAt: 1794153600,
      };
      await act(async () => write.resolve(saved));
      await waitFor(() => expect(screen.queryByLabelText("Start date")).toBeNull());
      expect(within(row).getByText("2026-11-09", { selector: "time" })).toBeVisible();
      expect(reads()).toEqual(readCounts);
      expect(api.createRecurringRule).not.toHaveBeenCalled();
      expect(api.createExpense).not.toHaveBeenCalled();
      expect(api.updateExpense).not.toHaveBeenCalled();

      await user.click(within(row).getByRole("button", { name: "Edit schedule" }));
      expect(screen.getByLabelText("Start date")).toHaveValue("2026-10-10");
      expect(screen.getByLabelText("Day of month")).toHaveValue(9);
      expect(screen.getByLabelText("Time zone")).toHaveValue("Asia/Shanghai");
      expect(reads()).toEqual(readCounts);
    }
  );
});
