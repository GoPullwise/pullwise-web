import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerScreen } from "./ledger.jsx";

const active = { id: "cat_active", name: "Current tools", revision: 1 };
const archived = {
  id: "cat_archived",
  name: "Past hosting",
  revision: 2,
  archivedAt: "2026-10-01T00:00:00Z",
};
const removed = {
  id: "cat_removed",
  name: "Historic tools",
  revision: 3,
  archivedAt: "2026-10-08T00:00:00Z",
  removedAt: "2026-10-08T00:00:00Z",
};
const unrelated = { ...removed, id: "cat_other_removed", name: "Other retired category" };
const workspace = {
  id: "wsp_owner",
  role: "owner",
  revision: 2,
  permissions: { manageProjects: true, manageCategories: true, writeExpenses: true },
};
const expense = {
  id: "exp_historic",
  revision: 7,
  occurredOn: "2026-10-08",
  amount: "12.00",
  currency: "USD",
  categoryId: removed.id,
  purpose: "Recorded hosting",
  note: "Original note",
};
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function client() {
  return {
    categories: vi.fn().mockResolvedValue([active, archived, removed, unrelated]),
    me: vi.fn().mockResolvedValue({ entitlements: { jev: { eligible: false, available: false } } }),
    projects: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    project: vi
      .fn()
      .mockResolvedValue({
        id: "prj_current",
        revision: 5,
        name: "Current project",
        status: "active",
        canCreateExpense: true,
        githubAccess: "not_linked",
      }),
    expenses: vi.fn().mockResolvedValue({ items: [expense], nextCursor: null }),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi
      .fn()
      .mockResolvedValue({
        groups: [{ categoryId: removed.id, currency: "USD", amountMinor: 1200 }],
      }),
    updateExpense: vi.fn().mockResolvedValue(expense),
    createExpense: vi.fn().mockResolvedValue(expense),
    removeCategory: vi.fn().mockResolvedValue(null),
    archiveCategory: vi.fn(),
    updateCategory: vi.fn(),
  };
}
function page(api, mode, props = {}) {
  return (
    <LedgerScreen
      api={api}
      workspace={workspace}
      authIdentity="actor_1"
      go={vi.fn()}
      mode={mode}
      projectId={mode === "project" ? "prj_current" : undefined}
      {...props}
    />
  );
}

describe("removed category metadata", () => {
  it("keeps management reads normal and hides removed rows, while archives remain manageable", async () => {
    const api = client();
    render(page(api, "categories"));
    await screen.findByRole("heading", { name: active.name });
    expect(api.categories).toHaveBeenCalledExactlyOnceWith({ signal: expect.any(AbortSignal) });
    expect(screen.getByRole("heading", { name: archived.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: removed.name })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Remove ${removed.name}` })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Remove ${archived.name}` })).toBeEnabled();
    expect(screen.getByText(/Saved expenses keep its name/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your categories" }).parentElement.querySelector(".count")
    ).toHaveTextContent("2");
  });

  it.each(["project", "shared"])(
    "reads removed metadata once for %s history and preserves its original category on an explicit edit",
    async (mode) => {
      const api = client();
      render(page(api, mode));
      await screen.findByRole("heading", { name: expense.purpose });
      expect(api.categories).toHaveBeenCalledExactlyOnceWith({
        signal: expect.any(AbortSignal),
        params: { includeRemoved: true },
      });
      const row = screen.getByRole("heading", { name: expense.purpose }).closest("article");
      expect(row).toHaveTextContent("Historic tools (Removed)");
      fireEvent.click(within(row).getByRole("button", { name: `Edit ${expense.purpose}` }));
      const category = screen.getByRole("combobox", { name: "Category" });
      expect(category).toHaveValue(removed.id);
      expect(
        within(category).getByRole("option", { name: "Historic tools (Removed)" })
      ).toBeInTheDocument();
      expect(
        within(category).queryByRole("option", { name: unrelated.name })
      ).not.toBeInTheDocument();
      expect(
        within(category).queryByRole("option", { name: archived.name })
      ).not.toBeInTheDocument();
      const purpose = screen.getByRole("textbox", { name: "What did you pay for?" });
      fireEvent.change(purpose, { target: { value: "Updated saved purpose" } });
      fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
      await waitFor(() => expect(api.updateExpense).toHaveBeenCalledTimes(1));
      expect(api.updateExpense).toHaveBeenCalledWith(
        expense.id,
        7,
        expect.objectContaining({
          categoryId: removed.id,
          purpose: "Updated saved purpose",
          amount: "12.00",
          currency: "USD",
        }),
        {}
      );
      expect(api.createExpense).not.toHaveBeenCalled();
    }
  );

  it.each(["project", "shared"])(
    "excludes archived and removed categories from new %s expenses but keeps historical filters",
    async (mode) => {
      const api = client();
      render(page(api, mode));
      await screen.findByRole("heading", { name: expense.purpose });
      fireEvent.click(screen.getByRole("button", { name: "Add expense" }));
      const category = screen.getByRole("combobox", { name: "Category" });
      expect(within(category).getByRole("option", { name: active.name })).toBeInTheDocument();
      for (const name of [
        "Historic tools (Removed)",
        "Other retired category (Removed)",
        archived.name,
      ])
        expect(within(category).queryByRole("option", { name })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Filters" }));
      const filter = screen.getByRole("combobox", { name: "Filter category" });
      expect(
        within(filter).getByRole("option", { name: "Historic tools (Removed)" })
      ).toBeInTheDocument();
      fireEvent.change(filter, { target: { value: removed.id } });
      await waitFor(() =>
        expect(api.expenses).toHaveBeenLastCalledWith(
          expect.objectContaining({ categoryId: removed.id }),
          expect.anything()
        )
      );
      expect(api.createExpense).not.toHaveBeenCalled();
    }
  );

  it("removes a referenced category with CAS and keeps controls locked until management refresh excludes it", async () => {
    const api = client(),
      write = deferred(),
      refresh = deferred();
    api.categories.mockResolvedValueOnce([active]).mockReturnValueOnce(refresh.promise);
    api.removeCategory.mockReturnValueOnce(write.promise);
    render(page(api, "categories"));
    fireEvent.click(await screen.findByRole("button", { name: `Remove ${active.name}` }));
    const confirm = screen.getByRole("button", { name: `Confirm remove ${active.name}` });
    fireEvent.click(confirm);
    expect(api.removeCategory).toHaveBeenCalledExactlyOnceWith(active.id, 1, {});
    expect(confirm).toBeDisabled();
    await act(async () => write.resolve(null));
    await waitFor(() => expect(api.categories).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: `Remove ${active.name}` })).toBeDisabled();
    await act(async () => refresh.resolve([{ ...active, removedAt: "2026-10-09T00:00:00Z" }]));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: active.name })).not.toBeInTheDocument()
    );
    expect(screen.getByRole("heading", { name: "Your categories" })).toHaveFocus();
    expect(api.archiveCategory).not.toHaveBeenCalled();
  });
});
