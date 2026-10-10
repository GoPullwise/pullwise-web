import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LedgerOverviewScreen } from "./ledger-overview.jsx";

const workspace = (fields = {}) => ({ id: "wsp_owner", role: "viewer", revision: 1, ...fields });
const summary = (shared = 250) => ({
  groups: [
    { target: "account", currency: "USD", amountMinor: 1000 + shared },
    { target: "project", currency: "USD", amountMinor: 1000 },
    { target: "project", projectId: "prj_first", currency: "USD", amountMinor: 1000 },
    { target: "shared", currency: "USD", amountMinor: shared },
  ],
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const values = (element) =>
  [...element.querySelectorAll(".financial-value")].map((value) => value.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Spending overview", () => {
  it("shows a whole-ledger monthly total and separate project/shared subtotals for viewers", async () => {
    const api = {
      reportSummary: vi.fn().mockResolvedValue(summary()),
      projects: vi.fn(),
      expenses: vi.fn(),
    };
    render(<LedgerOverviewScreen api={api} workspace={workspace()} go={vi.fn()} />);
    await screen.findByRole("heading", { name: "Expense totals" });
    expect(screen.getByLabelText("Month")).toHaveValue("2026-10");
    expect(api.reportSummary).toHaveBeenCalledWith(
      { from: "2026-10-01", to: "2026-11-01" },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(values(screen.getByRole("region", { name: "Expense totals" }))).toEqual([
      "USD 12.50",
      "USD 10.00",
      "USD 2.50",
    ]);
    expect(api.projects).not.toHaveBeenCalled();
    expect(api.expenses).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Spending overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("selects any month or inclusive custom dates and rejects invalid ranges before requesting", async () => {
    const api = { reportSummary: vi.fn().mockResolvedValue(summary()) };
    render(<LedgerOverviewScreen api={api} go={vi.fn()} />);
    await screen.findByRole("heading", { name: "Expense totals" });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2028-02" } });
    await waitFor(() =>
      expect(api.reportSummary).toHaveBeenLastCalledWith(
        { from: "2028-02-01", to: "2028-03-01" },
        expect.anything()
      )
    );
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("End date (included)"), {
      target: { value: "2026-10-10" },
    });
    await waitFor(() =>
      expect(api.reportSummary).toHaveBeenLastCalledWith(
        { from: "2026-10-10", to: "2026-10-11" },
        expect.anything()
      )
    );
    const calls = api.reportSummary.mock.calls.length;
    fireEvent.change(screen.getByLabelText("End date (included)"), {
      target: { value: "2026-10-09" },
    });
    expect(
      await screen.findByText("Choose a valid date range with the end on or after the start.")
    ).toBeVisible();
    expect(api.reportSummary).toHaveBeenCalledTimes(calls);
    expect(screen.queryByRole("heading", { name: "Expense totals" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    await screen.findByRole("heading", { name: "Expense totals" });
    expect(api.reportSummary).toHaveBeenLastCalledWith(
      { from: "2026-10-01", to: "2026-11-01" },
      expect.anything()
    );
  });

  it("shows unavailable rather than zero on report failure and permits a manual recovery", async () => {
    const api = {
      reportSummary: vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValue(summary()),
    };
    const onReloadAccess = vi.fn().mockResolvedValue(true);
    render(<LedgerOverviewScreen api={api} go={vi.fn()} onReloadAccess={onReloadAccess} />);
    expect(
      await screen.findByText("Spending summary is unavailable. Reload to try again.")
    ).toBeVisible();
    expect(document.querySelector(".financial-value")).toBeNull();
    expect(screen.queryByText("No expenses in this range.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(document.querySelector(".financial-value")).not.toBeNull());
    expect(onReloadAccess).toHaveBeenCalledOnce();
    expect(api.reportSummary).toHaveBeenCalledTimes(2);
  });

  it("aborts old workspace data and ignores a late response after switching ledgers", async () => {
    const old = deferred();
    const api = {
      reportSummary: vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(summary(500)),
    };
    const view = render(<LedgerOverviewScreen api={api} go={vi.fn()} workspace={workspace()} />);
    await waitFor(() => expect(api.reportSummary).toHaveBeenCalledOnce());
    const signal = api.reportSummary.mock.calls[0][1].signal;
    view.rerender(
      <LedgerOverviewScreen api={api} go={vi.fn()} workspace={workspace({ id: "wsp_next" })} />
    );
    await screen.findByRole("heading", { name: "Expense totals" });
    expect(signal.aborted).toBe(true);
    await act(async () => {
      old.resolve(summary(999));
      await old.promise;
    });
    expect(values(screen.getByRole("region", { name: "Expense totals" }))).toEqual([
      "USD 15.00",
      "USD 10.00",
      "USD 5.00",
    ]);
  });

  it("drops protected totals after a current permission failure", async () => {
    const failure = { status: 403, payload: { error: { code: "WORKSPACE_MEMBERSHIP_CHANGED" } } };
    const api = {
      reportSummary: vi.fn().mockResolvedValueOnce(summary()).mockRejectedValue(failure),
    };
    const onAccessChanged = vi.fn();
    render(<LedgerOverviewScreen api={api} go={vi.fn()} onAccessChanged={onAccessChanged} />);
    await screen.findByRole("heading", { name: "Expense totals" });
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-09" } });
    await waitFor(() => expect(onAccessChanged).toHaveBeenCalledWith(failure));
    expect(document.querySelector(".financial-value")).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Expense totals" })).getByRole("status")
    ).toHaveTextContent("Spending summary is unavailable");
  });
});
