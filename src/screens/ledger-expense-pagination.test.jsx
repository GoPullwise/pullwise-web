import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerScreen } from "./ledger.jsx";

const projectId = "prj_pagination";
const workspace = (fields = {}) => ({
  id: "wsp_pagination",
  role: "owner",
  revision: 4,
  memberRevision: 6,
  permissions: { manageProjects: true, manageCategories: true, writeExpenses: true },
  ...fields,
});

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function fixture({ mode = "shared", count = 23, id = projectId, prefix = mode } = {}) {
  const target = mode === "project" ? { kind: "project", projectId: id } : { kind: "shared" };
  const project = {
    id,
    name: "Pagination project",
    revision: 3,
    status: "active",
    githubAccess: "not_linked",
    githubRepoIds: [],
    repositories: [],
    canCreateExpense: true,
    totals: [],
  };
  const expenses = Array.from({ length: count }, (_, index) => ({
    id: `exp_${prefix}_${index + 1}`,
    purpose: `${prefix} expense ${String(index + 1).padStart(2, "0")}`,
    occurredOn: `2026-09-${String(index + 1).padStart(2, "0")}`,
    amount: "12345678901234.50",
    currency: "USD",
    categoryId: index % 2 ? "cat_tools" : "cat_hosting",
    target,
    revision: 2,
    note: null,
  }));
  const page = (query = {}) => {
    const rows = expenses.filter((expense) =>
      (!query.from || expense.occurredOn >= query.from) &&
      (!query.to || expense.occurredOn < query.to) &&
      (!query.categoryId || expense.categoryId === query.categoryId)
    );
    const offset = query.cursor ? Number(query.cursor.replace("page_", "")) : 0;
    const limit = query.limit ?? 50;
    return {
      items: rows.slice(offset, offset + limit),
      nextCursor: offset + limit < rows.length ? `page_${offset + limit}` : null,
    };
  };
  const api = {
    me: vi.fn().mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } }),
    project: vi.fn().mockResolvedValue(project),
    projects: vi.fn().mockResolvedValue({ items: [project], nextCursor: null }),
    categories: vi.fn().mockResolvedValue([
      { id: "cat_hosting", name: "Hosting", archivedAt: null },
      { id: "cat_tools", name: "Tools", archivedAt: null },
    ]),
    expenses: vi.fn().mockImplementation((query) => Promise.resolve(page(query))),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
    createExpense: vi.fn().mockResolvedValue({ ...expenses[0], id: "exp_created" }),
    updateExpense: vi.fn(),
    removeExpense: vi.fn(),
  };
  const props = { api, go: vi.fn(), mode, projectId: id, workspace: workspace() };
  return { mode, projectId: id, expenses, page, api, props };
}

function targetQuery(f) {
  return f.mode === "project" ? { target: "project", projectId: f.projectId } : { target: "shared" };
}

function pageQuery(f, cursor, filters = {}) {
  return { ...targetQuery(f), ...filters, limit: 10, ...(cursor ? { cursor } : {}) };
}

function records() {
  return screen.getByRole("heading", { name: "Recorded expenses" }).closest("section");
}

function purposes() {
  return within(records()).queryAllByRole("article").map((row) =>
    within(row).getByRole("heading", { level: 3 }).textContent
  );
}

function pagination() {
  return screen.getByRole("navigation", { name: "Expense pagination" });
}

function pageButton(name) {
  return within(pagination()).getByRole("button", { name, exact: true });
}

async function settled() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Reload", exact: true })).toBeEnabled());
}

async function open(f) {
  const rendered = render(<LedgerScreen {...f.props} />);
  if (f.expenses.length) await screen.findByRole("heading", { name: f.expenses[0].purpose });
  else await screen.findByRole("heading", { name: "No expenses for this target yet." });
  await settled();
  return rendered;
}

async function nextPage(f, index = 10) {
  fireEvent.click(pageButton("Next"));
  await screen.findByRole("heading", { name: f.expenses[index].purpose });
  await settled();
}

function openFilters() {
  const toggle = screen.getByRole("button", { name: /^Filters(?: \d+)?$/ });
  if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle);
}

describe("bounded project and Shared Pool recorded-expense pages", () => {
  it.each(["shared", "project"].flatMap((mode) => [0, 1, 10].map((count) => ({ mode, count }))))(
    "hides $mode pagination for $count expenses and performs one bounded initial read",
    async ({ mode, count }) => {
      const f = fixture({ mode, count });
      await open(f);
      expect(purposes()).toEqual(f.expenses.map((expense) => expense.purpose));
      expect(screen.queryByRole("navigation", { name: "Expense pagination" })).not.toBeInTheDocument();
      expect(f.api.expenses).toHaveBeenCalledExactlyOnceWith(pageQuery(f), {
        signal: expect.any(AbortSignal),
      });
    }
  );

  it.each(["shared", "project"].flatMap((mode) => [11, 23].map((count) => ({ mode, count }))))(
    "replaces $mode pages from $count expenses, keeps the partial last page and refetches Previous",
    async ({ mode, count }) => {
      const f = fixture({ mode, count });
      await open(f);
      expect(purposes()).toEqual(f.expenses.slice(0, 10).map((expense) => expense.purpose));
      expect(within(pagination()).getByText("Page 1")).toBeVisible();
      expect(pageButton("Previous")).toBeDisabled();
      expect(pageButton("Next")).toBeEnabled();
      expect(f.api.expenses).toHaveBeenCalledOnce();
      const reportReads = [f.api.reportTimeseries.mock.calls.length, f.api.reportCategories.mock.calls.length];

      fireEvent.click(pageButton("Next"));
      fireEvent.click(pageButton("Next"));
      await screen.findByRole("heading", { name: f.expenses[10].purpose });
      await settled();
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
      expect(f.api.expenses).toHaveBeenLastCalledWith(pageQuery(f, "page_10"), {
        signal: expect.any(AbortSignal),
      });
      expect(purposes()).toEqual(f.expenses.slice(10, 20).map((expense) => expense.purpose));
      expect(screen.queryByRole("heading", { name: f.expenses[0].purpose })).not.toBeInTheDocument();
      expect(within(pagination()).getByText("Page 2")).toBeVisible();

      if (count === 23) {
        await nextPage(f, 20);
        expect(purposes()).toEqual(f.expenses.slice(20).map((expense) => expense.purpose));
        expect(within(pagination()).getByText("Page 3")).toBeVisible();
        expect(f.api.expenses).toHaveBeenCalledTimes(3);
      }
      expect(pageButton("Next")).toBeDisabled();
      expect(pageButton("Previous")).toBeEnabled();
      const reads = f.api.expenses.mock.calls.length;
      fireEvent.click(pageButton("Previous"));
      const previousOffset = count === 23 ? 10 : 0;
      await screen.findByRole("heading", { name: f.expenses[previousOffset].purpose });
      await settled();
      expect(f.api.expenses).toHaveBeenCalledTimes(reads + 1);
      expect(f.api.expenses).toHaveBeenLastCalledWith(pageQuery(f, previousOffset ? "page_10" : null), {
        signal: expect.any(AbortSignal),
      });
      expect(purposes()).toEqual(f.expenses.slice(previousOffset, previousOffset + 10).map((expense) => expense.purpose));
      expect([f.api.reportTimeseries.mock.calls.length, f.api.reportCategories.mock.calls.length]).toEqual(reportReads);
      expect(f.api.categories).toHaveBeenCalledOnce();
      expect(f.api.projects).toHaveBeenCalledOnce();
    }
  );

  it.each(["shared", "project"])(
    "resets the %s page for filters while keeping reports and CSV independent of pagination",
    async (mode) => {
      const f = fixture({ mode });
      await open(f);
      await nextPage(f);
      openFilters();
      fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-10" } });
      await screen.findByRole("heading", { name: f.expenses[9].purpose });
      await settled();
      const filters = { from: "2026-09-10" };
      expect(purposes()).toEqual(f.expenses.slice(9, 19).map((expense) => expense.purpose));
      expect(within(pagination()).getByText("Page 1")).toBeVisible();
      expect(pageButton("Previous")).toBeDisabled();
      expect(f.api.expenses).toHaveBeenLastCalledWith(pageQuery(f, null, filters), expect.anything());
      for (const report of [f.api.reportTimeseries, f.api.reportCategories]) {
        expect(report).toHaveBeenLastCalledWith({ ...targetQuery(f), ...filters }, expect.anything());
      }
      const reportReads = f.api.reportTimeseries.mock.calls.length;
      await nextPage(f, 19);
      expect(purposes()).toEqual(f.expenses.slice(19).map((expense) => expense.purpose));
      expect(f.api.expenses).toHaveBeenLastCalledWith(pageQuery(f, "page_10", filters), expect.anything());
      expect(f.api.reportTimeseries).toHaveBeenCalledTimes(reportReads);
      expect(f.api.reportCategories).toHaveBeenCalledTimes(reportReads);
      const csv = new URL(screen.getByRole("link", { name: "Export CSV" }).href).searchParams;
      expect(Object.fromEntries(csv)).toEqual({
        ...targetQuery(f), ...filters, workspaceId: f.props.workspace.id,
      });
      fireEvent.click(screen.getByRole("tab", { name: "Reports" }));
      expect(screen.queryByRole("navigation", { name: "Expense pagination" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: "Expenses" }));
      expect(within(pagination()).getByText("Page 2")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      await screen.findByRole("heading", { name: f.expenses[0].purpose });
      await settled();
      expect(within(pagination()).getByText("Page 1")).toBeVisible();
      expect(f.api.expenses).toHaveBeenLastCalledWith(pageQuery(f), expect.anything());
    }
  );

  it.each(["shared", "project"])("keeps the current %s page on explicit Reload", async (mode) => {
    const f = fixture({ mode });
    await open(f);
    await nextPage(f);
    fireEvent.click(screen.getByRole("button", { name: "Reload", exact: true }));
    await waitFor(() => expect(f.api.expenses).toHaveBeenCalledTimes(3));
    await settled();
    expect(f.api.expenses).toHaveBeenLastCalledWith(pageQuery(f, "page_10"), expect.anything());
    expect(purposes()).toEqual(f.expenses.slice(10, 20).map((expense) => expense.purpose));
    expect(within(pagination()).getByText("Page 2")).toBeVisible();
  });

  it.each(["shared", "project"])(
    "returns an externally emptied %s page to the first page with one bounded fallback read",
    async (mode) => {
      const f = fixture({ mode });
      await open(f);
      await nextPage(f);
      f.api.expenses.mockResolvedValueOnce({ items: [], nextCursor: null });
      fireEvent.click(screen.getByRole("button", { name: "Reload", exact: true }));
      await screen.findByRole("heading", { name: f.expenses[0].purpose });
      await settled();
      expect(f.api.expenses).toHaveBeenCalledTimes(4);
      expect(f.api.expenses.mock.calls[2][0]).toEqual(pageQuery(f, "page_10"));
      expect(f.api.expenses.mock.calls[3][0]).toEqual(pageQuery(f));
      expect(within(pagination()).getByText("Page 1")).toBeVisible();
      expect(purposes()).toEqual(f.expenses.slice(0, 10).map((expense) => expense.purpose));
    }
  );

  it("does not issue an obsolete first-page fallback when a second-page reload finishes after identity changes", async () => {
    const f = fixture();
    const rendered = await open(f);
    await nextPage(f);
    const late = deferred();
    f.api.expenses.mockReturnValueOnce(late.promise);
    fireEvent.click(screen.getByRole("button", { name: "Reload", exact: true }));
    await waitFor(() => expect(f.api.expenses).toHaveBeenCalledTimes(3));
    expect(f.api.expenses.mock.calls[2][0]).toEqual(pageQuery(f, "page_10"));
    const signal = f.api.expenses.mock.calls[2][1].signal;

    const current = fixture({ prefix: "current", count: 11 });
    rendered.rerender(<LedgerScreen {...current.props} workspace={workspace({ id: "wsp_next" })} />);
    expect(signal.aborted).toBe(true);
    await screen.findByRole("heading", { name: current.expenses[0].purpose });
    await settled();
    expect(current.api.expenses).toHaveBeenCalledExactlyOnceWith(pageQuery(current), expect.anything());

    // This API ignores the abort and still returns an empty old page.
    await act(async () => late.resolve({ items: [], nextCursor: null }));
    expect(f.api.expenses).toHaveBeenCalledTimes(3);
    expect(purposes()).toEqual(current.expenses.slice(0, 10).map((expense) => expense.purpose));
    expect(within(pagination()).getByText("Page 1")).toBeVisible();
    expect(screen.queryByRole("heading", { name: f.expenses[10].purpose })).not.toBeInTheDocument();
  });

  it.each([
    { name: "project route", next: { projectId: "prj_next" } },
    { name: "Shared Pool route", next: { mode: "shared", projectId: "" } },
    { name: "workspace identity", next: { workspace: workspace({ id: "wsp_next" }) } },
    { name: "workspace revision", next: { workspace: workspace({ revision: 5 }) } },
    { name: "membership revision", next: { workspace: workspace({ memberRevision: 7 }) } },
    { name: "permissions", next: { workspace: workspace({ permissions: { writeExpenses: false } }) } },
    { name: "authorization revision", next: { authorizationRevision: 1 } },
  ])("resets pagination and discards an old page read when the $name changes", async ({ next }) => {
    const f = fixture({ mode: "project" });
    const rendered = await open(f);
    await nextPage(f);
    const late = deferred();
    f.api.expenses.mockReturnValueOnce(late.promise);
    fireEvent.click(pageButton("Next"));
    expect(f.api.expenses).toHaveBeenCalledTimes(3);
    const signal = f.api.expenses.mock.calls[2][1].signal;
    const current = fixture({ mode: next.mode || "project", id: next.projectId ?? projectId, prefix: "current", count: 11 });
    rendered.rerender(<LedgerScreen {...f.props} {...next} api={current.api} />);
    expect(signal.aborted).toBe(true);
    await screen.findByRole("heading", { name: current.expenses[0].purpose });
    await settled();
    expect(current.api.expenses).toHaveBeenCalledExactlyOnceWith(pageQuery(current), expect.anything());
    expect(within(pagination()).getByText("Page 1")).toBeVisible();
    expect(pageButton("Previous")).toBeDisabled();
    await act(async () => late.resolve(f.page(pageQuery(f, "page_20"))));
    expect(purposes()).toEqual(current.expenses.slice(0, 10).map((expense) => expense.purpose));
    expect(screen.queryByRole("heading", { name: f.expenses[20].purpose })).not.toBeInTheDocument();
  });

  it.each(["shared", "project"])(
    "aborts a stale %s page read on filter refinement and preserves the exact entry draft",
    async (mode) => {
      const f = fixture({ mode });
      await open(f);
      fireEvent.click(screen.getByRole("button", { name: "Add expense", exact: true }));
      const purpose = screen.getByLabelText("What did you pay for?");
      const amount = screen.getByLabelText("Amount");
      fireEvent.change(purpose, { target: { value: "  Preserve this pagination draft  " } });
      fireEvent.change(amount, { target: { value: "12345678901234.50" } });
      const late = deferred();
      f.api.expenses.mockReturnValueOnce(late.promise);
      fireEvent.click(pageButton("Next"));
      fireEvent.click(pageButton("Next"));
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
      const signal = f.api.expenses.mock.calls[1][1].signal;
      expect(pageButton("Next")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Save expense" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Edit " + f.expenses[0].purpose })).toBeDisabled();
      openFilters();
      expect(screen.getByLabelText("From date")).toBeEnabled();
      fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-09-15" } });
      expect(signal.aborted).toBe(true);
      await screen.findByRole("heading", { name: f.expenses[14].purpose });
      await settled();
      expect(screen.getByLabelText("What did you pay for?")).toBe(purpose);
      expect(purpose).toHaveValue("  Preserve this pagination draft  ");
      expect(amount).toHaveValue("12345678901234.50");
      expect(purposes()).toEqual(f.expenses.slice(14).map((expense) => expense.purpose));
      expect(screen.queryByRole("navigation", { name: "Expense pagination" })).not.toBeInTheDocument();
      await act(async () => late.resolve(f.page(pageQuery(f, "page_10"))));
      expect(purposes()).toEqual(f.expenses.slice(14).map((expense) => expense.purpose));
      expect(purpose).toHaveValue("  Preserve this pagination draft  ");
      expect(f.api.createExpense).not.toHaveBeenCalled();
      expect(f.api.expenses).toHaveBeenCalledTimes(3);
    }
  );

  it.each(["shared", "project"])("retains the %s page after a failed read until an explicit retry", async (mode) => {
    const f = fixture({ mode });
    await open(f);
    f.api.expenses.mockRejectedValueOnce({ status: 503, message: "Expense page temporarily unavailable" });
    fireEvent.click(pageButton("Next"));
    expect(await screen.findByText("Expense page temporarily unavailable")).toBeVisible();
    await settled();
    expect(purposes()).toEqual(f.expenses.slice(0, 10).map((expense) => expense.purpose));
    expect(within(pagination()).getByText("Page 1")).toBeVisible();
    expect(pageButton("Previous")).toBeDisabled();
    expect(pageButton("Next")).toBeEnabled();
    expect(f.api.expenses).toHaveBeenCalledTimes(2);
    await nextPage(f);
    expect(f.api.expenses).toHaveBeenCalledTimes(3);
    expect(f.api.expenses.mock.calls[1][0]).toEqual(f.api.expenses.mock.calls[2][0]);
    expect(screen.queryByText("Expense page temporarily unavailable")).not.toBeInTheDocument();
  });

  it.each(["shared", "project"].flatMap((mode) =>
    ["oversized", "missing items", "duplicate records", "invalid cursor"].map((kind) => ({ mode, kind }))
  ))("rejects an $kind $mode response without replacing rows or advancing the page", async ({ mode, kind }) => {
    const f = fixture({ mode });
    await open(f);
    const invalid = kind === "oversized"
      ? { items: f.expenses.slice(10, 21), nextCursor: "page_21" }
      : kind === "missing items"
        ? { items: null, nextCursor: null }
        : kind === "duplicate records"
          ? { items: [f.expenses[10], f.expenses[10]], nextCursor: null }
          : { items: [f.expenses[10]], nextCursor: 20 };
    f.api.expenses.mockResolvedValueOnce(invalid);
    fireEvent.click(pageButton("Next"));
    expect(await screen.findByText("Expense page unavailable. Reload to retry.")).toBeVisible();
    await settled();
    expect(purposes()).toEqual(f.expenses.slice(0, 10).map((expense) => expense.purpose));
    expect(within(pagination()).getByText("Page 1")).toBeVisible();
    expect(pageButton("Next")).toBeEnabled();
    expect(f.api.expenses).toHaveBeenCalledTimes(2);
    await nextPage(f);
    expect(purposes()).toEqual(f.expenses.slice(10, 20).map((expense) => expense.purpose));
    expect(f.api.expenses).toHaveBeenCalledTimes(3);
  });

  it.each(["shared", "project"])(
    "holds %s pagination through an expense write and its required first-page refresh",
    async (mode) => {
      const f = fixture({ mode });
      await open(f);
      await nextPage(f);
      openFilters();
      fireEvent.click(screen.getByRole("button", { name: "Add expense", exact: true }));
      fireEvent.change(screen.getByLabelText("What did you pay for?"), { target: { value: "New saved expense" } });
      fireEvent.change(screen.getByLabelText("Paid on"), { target: { value: "2026-09-23" } });
      fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.50" } });
      fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_hosting" } });
      const write = deferred();
      const refresh = deferred();
      f.api.createExpense.mockReturnValueOnce(write.promise);
      f.api.expenses.mockReturnValueOnce(refresh.promise);
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      expect(f.api.createExpense).toHaveBeenCalledOnce();
      expect(pageButton("Previous")).toBeDisabled();
      expect(pageButton("Next")).toBeDisabled();
      expect(screen.getByLabelText("From date")).toBeDisabled();
      fireEvent.click(pageButton("Previous"));
      fireEvent.click(pageButton("Next"));
      expect(f.api.expenses).toHaveBeenCalledTimes(2);
      await act(async () => write.resolve({ id: "exp_created", target: f.expenses[0].target }));
      await waitFor(() => expect(f.api.expenses).toHaveBeenCalledTimes(3));
      expect(f.api.expenses).toHaveBeenLastCalledWith(pageQuery(f), expect.anything());
      expect(pageButton("Previous")).toBeDisabled();
      expect(pageButton("Next")).toBeDisabled();
      expect(screen.getByLabelText("From date")).toBeDisabled();
      fireEvent.click(pageButton("Next"));
      expect(f.api.expenses).toHaveBeenCalledTimes(3);
      await act(async () => refresh.resolve(f.page(pageQuery(f))));
      await settled();
      expect(within(pagination()).getByText("Page 1")).toBeVisible();
      expect(pageButton("Previous")).toBeDisabled();
      expect(pageButton("Next")).toBeEnabled();
      expect(screen.getByLabelText("From date")).toBeEnabled();
      expect(purposes()).toEqual(f.expenses.slice(0, 10).map((expense) => expense.purpose));
      expect(f.api.createExpense).toHaveBeenCalledOnce();
      expect(f.api.expenses).toHaveBeenCalledTimes(3);
    }
  );
});
