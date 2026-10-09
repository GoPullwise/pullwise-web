import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecurringExpenses, RecurringScheduleFields } from "./recurring-expenses.jsx";

const shared = { kind: "shared" };
const project = { kind: "project", projectId: "prj_one" };
const rule = (overrides = {}) => ({
  id: "rul_one",
  target: shared,
  amount: "12.00",
  currency: "USD",
  categoryId: "cat_one",
  purpose: "Hosting",
  note: null,
  quantity: null,
  unit: null,
  schedule: {
    frequency: "monthly",
    day: 31,
    timezone: "Europe/Paris",
    startOn: "2026-10-01",
    endOn: null,
  },
  status: "active",
  revision: 2,
  nextOccurrenceOn: "2026-10-31",
  nextRunAt: 1793397600,
  blockedCode: null,
  ...overrides,
});
const error = (status) => Object.assign(new Error("failure"), { status });
function pending() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function client(items = [rule()]) {
  return {
    recurringRules: vi.fn().mockResolvedValue({ items, nextCursor: null }),
    recurringRule: vi.fn(),
    updateRecurringRule: vi.fn(),
    removeRecurringRule: vi.fn().mockResolvedValue(undefined),
  };
}
function TestExpenseForm({ value, recurrence, busy, submitDisabled, onSubmit, onCancel }) {
  const [purpose, setPurpose] = useState(value.purpose);
  const [schedule, setSchedule] = useState(recurrence);
  return (
    <form
      aria-label="Expense editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(
          {
            ...value,
            purpose,
            occurredOn: schedule.startOn,
            target: { kind: "project", projectId: "wrong" },
          },
          "unused-key",
          schedule
        );
      }}
    >
      <label>
        Start date
        <input
          type="date"
          value={schedule.startOn}
          disabled={busy}
          onChange={(event) => setSchedule({ ...schedule, startOn: event.target.value })}
        />
      </label>
      <label>
        Purpose
        <input
          value={purpose}
          disabled={busy}
          onChange={(event) => setPurpose(event.target.value)}
        />
      </label>
      <RecurringScheduleFields schedule={schedule} onChange={setSchedule} disabled={busy} />
      <button type="submit" disabled={busy || submitDisabled}>
        Save schedule
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
function fixture(api, props = {}) {
  return (
    <RecurringExpenses
      api={api}
      target={shared}
      categories={[{ id: "cat_one", name: "Infrastructure" }]}
      canManage={true}
      formatTotal={(item) => `${item.currency} ${item.amount}`}
      renderExpenseForm={(fields) => <TestExpenseForm {...fields} />}
      {...props}
    />
  );
}
function row(purpose = "Hosting") {
  return screen.getByRole("heading", { name: purpose }).closest("article");
}
function button(name, purpose = "Hosting") {
  return within(row(purpose)).getByRole("button", { name });
}
async function loaded() {
  await screen.findByRole("heading", { name: "Hosting" });
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("RecurringScheduleFields", () => {
  it("keeps native frequency-specific fields and emits a complete schedule without changing its start date or timezone", () => {
    function Fields() {
      const [schedule, setSchedule] = useState(rule().schedule);
      return (
        <>
          <RecurringScheduleFields
            schedule={schedule}
            onChange={(next) => {
              changes(next);
              setSchedule(next);
            }}
          />
          <output>{JSON.stringify(schedule)}</output>
        </>
      );
    }
    const changes = vi.fn();
    render(<Fields />);
    expect(screen.getByLabelText("Day of month")).toHaveValue(31);
    expect(screen.queryByLabelText("Weekday")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "weekly" } });
    expect(screen.queryByLabelText("Day of month")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Weekday"), { target: { value: "7" } });
    expect(changes.mock.lastCall[0]).toMatchObject({
      frequency: "weekly",
      weekday: 7,
      timezone: "Europe/Paris",
      startOn: "2026-10-01",
    });
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "quarterly" } });
    fireEvent.change(screen.getByLabelText("Month of quarter"), { target: { value: "3" } });
    expect(changes.mock.lastCall[0].quarterMonth).toBe(3);
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "yearly" } });
    expect(screen.getByLabelText("Month of year")).toHaveAttribute("max", "12");
    expect(screen.getByLabelText("End date (optional)")).toHaveAttribute("min", "2026-10-01");
  });
});

describe("RecurringExpenses", () => {
  it("does not start a recurring write when the parent operation boundary denies admission", async () => {
    const api = client();
    const beginOperation = vi.fn(() => false);
    render(fixture(api, { beginOperation }));
    await loaded();
    fireEvent.click(button("Pause"));
    expect(beginOperation).toHaveBeenCalledOnce();
    expect(api.updateRecurringRule).not.toHaveBeenCalled();
    expect(button("Pause")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeEnabled();
  });

  it("keeps the admitted parent operation and local controls locked until queued refreshes settle", async () => {
    const api = client();
    const write = pending();
    const firstRefresh = pending();
    const secondRefresh = pending();
    const release = vi.fn();
    const beginOperation = vi.fn(() => release);
    api.updateRecurringRule.mockReturnValue(write.promise);
    const view = render(fixture(api, { beginOperation, reloadSignal: 0 }));
    await loaded();
    api.recurringRules
      .mockReturnValueOnce(firstRefresh.promise)
      .mockReturnValueOnce(secondRefresh.promise);
    fireEvent.click(button("Pause"));
    view.rerender(fixture(api, { beginOperation, reloadSignal: 1 }));
    expect(api.recurringRules).toHaveBeenCalledOnce();
    await act(async () =>
      write.resolve(rule({ status: "paused", revision: 3, nextOccurrenceOn: null }))
    );
    await waitFor(() => expect(api.recurringRules).toHaveBeenCalledTimes(2));
    expect(beginOperation).toHaveBeenCalledOnce();
    expect(release).not.toHaveBeenCalled();
    expect(button("Resume")).toBeDisabled();
    expect(button("Edit schedule")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeDisabled();
    fireEvent.click(button("Resume"));
    expect(api.updateRecurringRule).toHaveBeenCalledOnce();
    view.rerender(fixture(api, { beginOperation, reloadSignal: 2 }));
    await act(async () =>
      firstRefresh.resolve({ items: [rule({ status: "paused", revision: 3 })], nextCursor: null })
    );
    await waitFor(() => expect(api.recurringRules).toHaveBeenCalledTimes(3));
    expect(release).not.toHaveBeenCalled();
    expect(button("Resume")).toBeDisabled();
    await act(async () =>
      secondRefresh.resolve({ items: [rule({ status: "paused", revision: 4 })], nextCursor: null })
    );
    expect(release).toHaveBeenCalledOnce();
    expect(button("Resume")).toBeEnabled();
    expect(button("Resume")).toHaveFocus();
    expect(api.updateRecurringRule).toHaveBeenCalledOnce();
  });

  it("releases a failed write without discarding its conflicted draft or retry policy", async () => {
    const api = client();
    const release = vi.fn();
    api.updateRecurringRule.mockRejectedValue(error(412));
    render(fixture(api, { beginOperation: () => release }));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Keep my draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await screen.findByRole("alert");
    expect(release).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Keep my draft");
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeEnabled();
    expect(api.recurringRules).toHaveBeenCalledOnce();
  });

  it("releases the admitted operation before notifying the parent of an access failure", async () => {
    const api = client();
    const release = vi.fn();
    const onAccessChanged = vi.fn();
    api.updateRecurringRule.mockRejectedValue(error(403));
    render(fixture(api, { beginOperation: () => release, onAccessChanged }));
    await loaded();
    fireEvent.click(button("Pause"));
    await screen.findByRole("alert");
    expect(release).toHaveBeenCalledOnce();
    expect(onAccessChanged).toHaveBeenCalledOnce();
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(
      onAccessChanged.mock.invocationCallOrder[0]
    );
    expect(screen.queryByRole("heading", { name: "Hosting" })).not.toBeInTheDocument();
  });

  it("does not release a newer operation from an old scope's late finally and releases once on unmount", async () => {
    const oldApi = client();
    const newApi = client([rule({ purpose: "New schedule" })]);
    const oldWrite = pending();
    const newWrite = pending();
    const oldRelease = vi.fn();
    const newRelease = vi.fn();
    const beginOperation = vi.fn().mockReturnValueOnce(oldRelease).mockReturnValueOnce(newRelease);
    oldApi.updateRecurringRule.mockReturnValue(oldWrite.promise);
    newApi.updateRecurringRule.mockReturnValue(newWrite.promise);
    const view = render(fixture(oldApi, { beginOperation }));
    await loaded();
    fireEvent.click(button("Pause"));
    view.rerender(fixture(newApi, { beginOperation }));
    await screen.findByRole("heading", { name: "New schedule" });
    expect(oldRelease).toHaveBeenCalledOnce();
    fireEvent.click(button("Pause", "New schedule"));
    await act(async () => oldWrite.resolve(rule({ status: "paused", revision: 3 })));
    expect(oldRelease).toHaveBeenCalledOnce();
    expect(newRelease).not.toHaveBeenCalled();
    expect(button("Pause", "New schedule")).toBeDisabled();
    view.unmount();
    expect(newRelease).toHaveBeenCalledOnce();
    expect(newApi.updateRecurringRule.mock.calls[0][3].signal.aborted).toBe(true);
    await act(async () => newWrite.reject(error(403)));
    expect(newRelease).toHaveBeenCalledOnce();
  });

  it("does not reset a mounted draft when the parent's admission callback changes", async () => {
    const api = client();
    const view = render(fixture(api, { beginOperation: vi.fn() }));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Mounted draft" } });
    view.rerender(fixture(api, { beginOperation: () => false }));
    expect(screen.getByLabelText("Purpose")).toHaveValue("Mounted draft");
    expect(api.recurringRules).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(api.updateRecurringRule).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Mounted draft");
  });

  it("locks an existing draft during an ordinary read refresh without admitting a write or losing the draft", async () => {
    const api = client();
    const refresh = pending();
    const beginOperation = vi.fn();
    const view = render(fixture(api, { beginOperation, reloadSignal: 0 }));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    fireEvent.change(screen.getByLabelText("Purpose"), {
      target: { value: "Draft during refresh" },
    });
    api.recurringRules.mockReturnValueOnce(refresh.promise);
    view.rerender(fixture(api, { beginOperation, reloadSignal: 1 }));
    expect(screen.getByLabelText("Purpose")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Expense editor" }));
    expect(beginOperation).not.toHaveBeenCalled();
    expect(api.updateRecurringRule).not.toHaveBeenCalled();
    await act(async () => refresh.resolve({ items: [rule({ revision: 3 })], nextCursor: null }));
    expect(screen.getByLabelText("Purpose")).toHaveValue("Draft during refresh");
    expect(screen.getByLabelText("Purpose")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeEnabled();
    expect(beginOperation).not.toHaveBeenCalled();
  });

  it("allows a viewer to read the exact server date, timezone and decimal amount without mutation controls", async () => {
    const api = client([
      rule({ amount: "900719925474099312345.12345", nextOccurrenceOn: "2099-02-28" }),
    ]);
    render(fixture(api, { canManage: false }));
    await loaded();
    expect(api.recurringRules).toHaveBeenCalledWith(
      { target: "shared" },
      { signal: expect.any(AbortSignal) }
    );
    expect(row()).toHaveTextContent("Next occurrence: 2099-02-28 · Europe/Paris");
    expect(row().querySelector(".financial-value").textContent).toBe(
      "USD 900719925474099312345.12345"
    );
    expect(within(row()).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("1 recurring schedules").closest(".ledger-list")).toBeNull();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeEnabled();
  });

  it("submits project GET scope and rejects rules belonging to another project", async () => {
    const api = client([
      rule({
        target: { kind: "project", projectId: "different" },
        purpose: "Protected other project",
      }),
    ]);
    render(fixture(api, { target: project }));
    await screen.findByRole("alert");
    expect(api.recurringRules.mock.calls[0][0]).toEqual({
      target: "project",
      projectId: "prj_one",
    });
    expect(screen.queryByText("Protected other project")).not.toBeInTheDocument();
    expect(screen.queryByText("No recurring schedules yet.")).not.toBeInTheDocument();
  });

  it("uses a synchronous pause guard, original revision and authoritative response without an extra GET", async () => {
    const api = client();
    const write = pending();
    api.updateRecurringRule.mockReturnValue(write.promise);
    render(fixture(api));
    await loaded();
    const pause = button("Pause");
    fireEvent.click(pause);
    fireEvent.click(pause);
    expect(api.updateRecurringRule).toHaveBeenCalledTimes(1);
    expect(api.updateRecurringRule).toHaveBeenCalledWith(
      "rul_one",
      2,
      { status: "paused" },
      { signal: expect.any(AbortSignal) }
    );
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeDisabled();
    await act(async () =>
      write.resolve(rule({ status: "paused", revision: 3, nextOccurrenceOn: null }))
    );
    expect(button("Resume")).toHaveFocus();
    expect(row()).toHaveTextContent("No next occurrence");
    expect(row()).toHaveTextContent("paused or blocked periods are not backfilled");
    expect(api.recurringRules).toHaveBeenCalledTimes(1);
  });

  it("lets a blocked schedule explicitly resume and explains bounded historical catchup", async () => {
    const api = client([
      rule({ status: "blocked", blockedCode: "CATCHUP_REVIEW_REQUIRED", nextOccurrenceOn: null }),
    ]);
    api.updateRecurringRule.mockResolvedValue(
      rule({ revision: 3, nextOccurrenceOn: "2027-01-31" })
    );
    render(fixture(api));
    await loaded();
    expect(row()).toHaveTextContent("More than 12 periods are overdue");
    fireEvent.click(button("Resume"));
    await waitFor(() => expect(button("Pause")).toBeEnabled());
    expect(api.updateRecurringRule.mock.calls[0].slice(0, 3)).toEqual([
      "rul_one",
      2,
      { status: "active" },
    ]);
    expect(row()).toHaveTextContent("2027-01-31");
  });

  it("allows confirmed CAS deletion of a completed schedule without editing or reviving it", async () => {
    const api = client([
      rule({ status: "completed", nextOccurrenceOn: null, nextRunAt: null }),
      rule({ id: "rul_two", purpose: "Old schedule", status: "canceled" }),
      rule({ id: "rul_unknown", purpose: "Unknown schedule", status: "unexpected" }),
    ]);
    render(fixture(api));
    await loaded();
    expect(within(row()).queryByRole("button", { name: "Edit schedule" })).not.toBeInTheDocument();
    expect(within(row()).queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
    expect(within(row("Old schedule")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row("Unknown schedule")).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.click(button("Delete schedule"));
    expect(api.removeRecurringRule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete schedule" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Hosting" })).not.toBeInTheDocument()
    );
    expect(api.removeRecurringRule).toHaveBeenCalledWith(
      "rul_one",
      2,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(api.updateRecurringRule).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Old schedule" })).toBeVisible();
  });

  it("keeps completed schedules read-only for a Viewer", async () => {
    const api = client([rule({ status: "completed", nextOccurrenceOn: null, nextRunAt: null })]);
    render(fixture(api, { canManage: false }));
    await loaded();
    expect(within(row()).queryByRole("button")).not.toBeInTheDocument();
    expect(api.removeRecurringRule).not.toHaveBeenCalled();
  });

  it("opens editing with date focused and makes editing and deletion confirmation mutually exclusive", async () => {
    const api = client();
    render(fixture(api));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    expect(screen.getByLabelText("Start date")).toHaveFocus();
    const editor = screen.getByRole("form", { name: "Expense editor" });
    expect(editor.closest(".ledger-list")).toBeNull();
    expect(editor.closest(".recurring-expenses-editor").previousElementSibling).toContainElement(
      row()
    );
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "My draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(button("Edit schedule")).toHaveFocus();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    fireEvent.click(button("Delete schedule"));
    expect(screen.getByRole("button", { name: "Confirm delete schedule" })).toHaveFocus();
    fireEvent.click(button("Edit schedule"));
    expect(
      screen.queryByRole("button", { name: "Confirm delete schedule" })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Start date")).toHaveFocus();
    expect(api.updateRecurringRule).not.toHaveBeenCalled();
    expect(api.removeRecurringRule).not.toHaveBeenCalled();
  });

  it("preserves the current draft on repeated edit and rebuilds the side editor when another schedule opens", async () => {
    const api = client([rule(), rule({ id: "rul_two", purpose: "Storage" })]);
    render(fixture(api));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Unsaved hosting" } });
    fireEvent.click(button("Edit schedule"));
    expect(screen.getByLabelText("Purpose")).toHaveValue("Unsaved hosting");
    expect(screen.getByLabelText("Start date")).toHaveFocus();
    fireEvent.click(button("Edit schedule", "Storage"));
    expect(screen.getAllByRole("form", { name: "Expense editor" })).toHaveLength(1);
    expect(screen.getByLabelText("Purpose")).toHaveValue("Storage");
    expect(screen.getByLabelText("Start date")).toHaveFocus();
    expect(within(row("Storage")).queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(button("Edit schedule", "Storage")).toHaveFocus();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(api.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("keeps edit revision stable across an external refresh and normalizes the complete template with its original target", async () => {
    const original = rule({ target: project });
    const api = client([original]);
    api.updateRecurringRule.mockResolvedValue(
      rule({ target: project, revision: 4, purpose: "Changed" })
    );
    const view = render(fixture(api, { target: project, reloadSignal: 0 }));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Changed" } });
    fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "weekly" } });
    fireEvent.change(screen.getByLabelText("Weekday"), { target: { value: "5" } });
    api.recurringRules.mockResolvedValue({
      items: [rule({ target: project, revision: 3 })],
      nextCursor: null,
    });
    view.rerender(fixture(api, { target: project, reloadSignal: 1 }));
    await waitFor(() => expect(api.recurringRules).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await screen.findByRole("heading", { name: "Changed" });
    expect(api.updateRecurringRule.mock.calls[0].slice(0, 3)).toEqual([
      "rul_one",
      2,
      {
        target: project,
        amount: "12.00",
        currency: "USD",
        categoryId: "cat_one",
        purpose: "Changed",
        note: null,
        quantity: null,
        unit: null,
        schedule: {
          frequency: "weekly",
          weekday: 5,
          timezone: "Europe/Paris",
          startOn: "2026-10-01",
          endOn: null,
        },
      },
    ]);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(button("Edit schedule", "Changed")).toHaveFocus();
  });

  it("retains a conflicted draft, locks Save, and rebases only after a successful explicit Reload", async () => {
    const api = client();
    api.updateRecurringRule
      .mockRejectedValueOnce(error(412))
      .mockResolvedValue(rule({ revision: 6, purpose: "Retained draft" }));
    render(fixture(api));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Retained draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await screen.findByText(
      "Schedule conflict. Your draft is still here. Reload the schedules before retrying."
    );
    expect(screen.getByLabelText("Purpose")).toHaveValue("Retained draft");
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeDisabled();
    api.recurringRules.mockRejectedValueOnce(error(503));
    fireEvent.click(screen.getByRole("button", { name: "Reload recurring schedules" }));
    await screen.findByText("Recurring schedules could not be loaded. Reload to try again.");
    expect(screen.getByRole("button", { name: "Save schedule" })).toBeDisabled();
    expect(screen.getByLabelText("Purpose")).toHaveValue("Retained draft");
    api.recurringRules.mockResolvedValue({
      items: [rule({ revision: 5, purpose: "Other user version" })],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Reload recurring schedules" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save schedule" })).toBeEnabled()
    );
    expect(screen.getByLabelText("Purpose")).toHaveValue("Retained draft");
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await screen.findByRole("heading", { name: "Retained draft" });
    expect(api.updateRecurringRule.mock.calls.map((call) => call[1])).toEqual([2, 5]);
  });

  it("restores Reload focus when a conflict leaves the original edit opener disabled", async () => {
    const api = client();
    api.updateRecurringRule.mockRejectedValue(error(412));
    render(fixture(api));
    await loaded();
    fireEvent.click(button("Edit schedule"));
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toHaveFocus();
  });

  it("requires explicit delete confirmation with CAS and retains expense history without an automatic reload", async () => {
    const api = client();
    const write = pending();
    api.removeRecurringRule.mockReturnValue(write.promise);
    render(fixture(api));
    await loaded();
    fireEvent.click(button("Delete schedule"));
    const confirmation = screen.getByRole("group", { name: "Confirm delete schedule" });
    expect(row().querySelector(".recurring-expenses-side")).toContainElement(confirmation);
    expect(row().querySelector(":scope > .notice")).toBeNull();
    expect(
      within(confirmation).getByRole("button", { name: "Confirm delete schedule" })
    ).toHaveAccessibleDescription(
      "Delete this schedule permanently? Already created expense records are retained."
    );
    expect(
      screen.getByText(
        "Delete this schedule permanently? Already created expense records are retained."
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(button("Delete schedule")).toHaveFocus();
    expect(api.removeRecurringRule).not.toHaveBeenCalled();
    fireEvent.click(button("Delete schedule"));
    const confirm = screen.getByRole("button", { name: "Confirm delete schedule" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.removeRecurringRule).toHaveBeenCalledTimes(1);
    expect(api.removeRecurringRule).toHaveBeenCalledWith("rul_one", 2, {
      signal: expect.any(AbortSignal),
    });
    await act(async () => write.resolve());
    expect(screen.getByText("No recurring schedules yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toHaveFocus();
    expect(api.recurringRules).toHaveBeenCalledTimes(1);
  });

  it("cancels same-row deletion with Escape and restores the original action", async () => {
    const api = client();
    render(fixture(api));
    await loaded();
    const opener = button("Delete schedule");
    fireEvent.click(opener);
    const confirm = screen.getByRole("button", { name: "Confirm delete schedule" });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Confirm delete schedule" })).toBeNull();
    expect(opener).toBeVisible();
    expect(opener).toHaveFocus();
    expect(api.removeRecurringRule).not.toHaveBeenCalled();
  });

  it("keeps the historical category name visible when its configuration was removed", async () => {
    const api = client([rule({ status: "blocked", blockedCode: "INVALID_CATEGORY" })]);
    render(
      fixture(api, {
        categories: [
          {
            id: "cat_one",
            name: "Infrastructure",
            archivedAt: "2026-10-09T00:00:00Z",
            removedAt: "2026-10-09T00:00:00Z",
          },
        ],
      })
    );
    await loaded();
    expect(row()).toHaveTextContent("Infrastructure (Removed)");
    expect(api.removeRecurringRule).not.toHaveBeenCalled();
    expect(api.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("keeps deletion in its action slot during a write and blocks retries after an uncertain result", async () => {
    const api = client();
    const write = pending();
    api.removeRecurringRule.mockReturnValue(write.promise);
    render(fixture(api));
    await loaded();
    fireEvent.click(button("Delete schedule"));
    const confirm = screen.getByRole("button", { name: "Confirm delete schedule" });
    fireEvent.click(confirm);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(screen.getByRole("group", { name: "Confirm delete schedule" })).toBeInTheDocument();
    await act(async () => write.reject(error(503)));
    await screen.findByRole("alert");
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(api.removeRecurringRule).toHaveBeenCalledOnce();
    expect(api.recurringRules).toHaveBeenCalledOnce();
    expect(row().querySelector(":scope > .notice")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Confirm delete schedule" })).toBeNull();
    expect(button("Delete schedule")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toHaveFocus();
  });

  it("retains known rows on availability failures and only retries on explicit intent", async () => {
    const api = client();
    render(fixture(api));
    await loaded();
    api.recurringRules.mockRejectedValue(error(503));
    fireEvent.click(screen.getByRole("button", { name: "Reload recurring schedules" }));
    await screen.findByRole("alert");
    expect(row()).toHaveTextContent("Hosting");
    expect(screen.queryByText("No recurring schedules yet.")).not.toBeInTheDocument();
    expect(api.recurringRules).toHaveBeenCalledTimes(2);
    expect(button("Pause")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeEnabled();
  });

  it("clears protected rows and cancels requests on an access failure while keeping manual retry available", async () => {
    const api = client();
    const onAccessChanged = vi.fn();
    render(fixture(api, { onAccessChanged }));
    await loaded();
    const failure = error(403);
    api.recurringRules.mockRejectedValue(failure);
    fireEvent.click(screen.getByRole("button", { name: "Reload recurring schedules" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Hosting")).not.toBeInTheDocument();
    expect(onAccessChanged).toHaveBeenCalledOnce();
    expect(onAccessChanged).toHaveBeenCalledWith(failure);
    expect(api.recurringRules.mock.lastCall[1].signal.aborted).toBe(true);
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeEnabled();
  });

  it("ignores a late read from a different workspace even when both target the shared pool", async () => {
    const oldRead = pending();
    const oldApi = client();
    oldApi.recurringRules.mockReturnValue(oldRead.promise);
    const newApi = client([rule({ purpose: "New workspace schedule" })]);
    const view = render(fixture(oldApi));
    const signal = oldApi.recurringRules.mock.calls[0][1].signal;
    view.rerender(fixture(newApi));
    await screen.findByRole("heading", { name: "New workspace schedule" });
    expect(signal.aborted).toBe(true);
    await act(async () =>
      oldRead.resolve({ items: [rule({ purpose: "Private old workspace" })], nextCursor: null })
    );
    expect(screen.queryByText("Private old workspace")).not.toBeInTheDocument();
    expect(newApi.recurringRules).toHaveBeenCalledOnce();
  });

  it("suppresses late mutation state and access callbacks after target scope changes", async () => {
    const api = client();
    const write = pending();
    const onAccessChanged = vi.fn();
    api.updateRecurringRule.mockReturnValue(write.promise);
    const view = render(fixture(api, { onAccessChanged }));
    await loaded();
    fireEvent.click(button("Pause"));
    const signal = api.updateRecurringRule.mock.calls[0][3].signal;
    api.recurringRules.mockResolvedValue({
      items: [rule({ target: project, purpose: "Project schedule" })],
      nextCursor: null,
    });
    view.rerender(fixture(api, { target: project, onAccessChanged }));
    await screen.findByRole("heading", { name: "Project schedule" });
    expect(signal.aborted).toBe(true);
    await act(async () => write.reject(error(403)));
    expect(screen.getByRole("heading", { name: "Project schedule" })).toBeInTheDocument();
    expect(onAccessChanged).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cancels pending mutation on role changes and exposes read-only viewer rows", async () => {
    const api = client();
    const write = pending();
    api.updateRecurringRule.mockReturnValue(write.promise);
    const view = render(fixture(api));
    await loaded();
    fireEvent.click(button("Pause"));
    const signal = api.updateRecurringRule.mock.calls[0][3].signal;
    view.rerender(fixture(api, { canManage: false }));
    await waitFor(() => expect(api.recurringRules).toHaveBeenCalledTimes(2));
    await loaded();
    expect(signal.aborted).toBe(true);
    await act(async () => write.resolve(rule({ status: "paused", revision: 3 })));
    expect(within(row()).queryByRole("button")).not.toBeInTheDocument();
    expect(row()).toHaveTextContent("Active");
  });

  it("keeps pagination recoverable, deduplicates records and stops a repeated cursor without putting footer content in the equal-row grid", async () => {
    const api = client();
    api.recurringRules
      .mockResolvedValueOnce({ items: [rule()], nextCursor: "page_two" })
      .mockRejectedValueOnce(error(503))
      .mockResolvedValueOnce({
        items: [rule(), rule({ id: "rul_two", purpose: "Storage" })],
        nextCursor: "page_two",
      });
    render(fixture(api));
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Load more schedules" }));
    await screen.findByText("More schedules could not be loaded. Retry to continue.");
    expect(row()).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load more schedules" }).closest(".ledger-list")
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load more schedules" }));
    await screen.findByRole("heading", { name: "Storage" });
    expect(screen.getAllByRole("heading", { name: "Hosting" })).toHaveLength(1);
    expect(
      screen
        .getByText("Pagination did not advance. Reload the schedules before continuing.")
        .closest(".ledger-list")
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Load more schedules" })).not.toBeInTheDocument();
    expect(api.recurringRules.mock.calls.slice(1).map((call) => call[0])).toEqual([
      { target: "shared", cursor: "page_two" },
      { target: "shared", cursor: "page_two" },
    ]);
  });

  it("does not treat invalid money as zero or a prominent financial value", async () => {
    const api = client([rule({ amount: null })]);
    const formatTotal = vi.fn();
    render(fixture(api, { formatTotal }));
    await loaded();
    const value = row().querySelector(".financial-unavailable");
    expect(value).toHaveTextContent("Unavailable");
    expect(value).not.toHaveClass("financial-value");
    expect(formatTotal).not.toHaveBeenCalled();
  });

  it("aborts an unmounted mutation without delivering late access callbacks", async () => {
    const api = client();
    const write = pending();
    const onAccessChanged = vi.fn();
    api.updateRecurringRule.mockReturnValue(write.promise);
    const view = render(fixture(api, { onAccessChanged }));
    await loaded();
    fireEvent.click(button("Pause"));
    const signal = api.updateRecurringRule.mock.calls[0][3].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => write.reject(error(404)));
    expect(onAccessChanged).not.toHaveBeenCalled();
  });
});
