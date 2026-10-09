import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityLog } from "./activity-log.jsx";

const NOW = "2026-10-09T08:00:00.000Z";
const target = { kind: "shared" };
const event = (fields = {}) => ({
  id: "act_1",
  operationId: "operation_1",
  createdAt: "2026-10-09T07:59:00.000Z",
  actor: { kind: "user", userId: "usr_b", name: "B's actual name", githubLogin: "member-b" },
  resource: { kind: "expense", id: "exp_1", label: "Cloud hosting" },
  action: "update",
  target,
  changes: [{ field: "amount", before: { amount: "12.50", currency: "USD" }, after: { amount: "12345678901234567890.12345", currency: "KWD" } }],
  ...fields,
});
const page = (fields = {}) => ({
  items: [event()], nextCursor: null,
  windowStart: "2026-10-08T08:00:00.000Z", windowEnd: NOW,
  ...fields,
});
const api = () => ({ activity: vi.fn().mockResolvedValue(page()) });
const pending = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const fixture = (client, fields = {}) => <ActivityLog api={client} target={target} active {...fields} />;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

describe("ActivityLog", () => {
  it("loads once on explicit activation and displays identity, local time, record and exact changes", async () => {
    const client = api();
    const view = render(fixture(client, { active: false }));
    expect(client.activity).not.toHaveBeenCalled();
    view.rerender(fixture(client));
    expect(await screen.findByText("Cloud hosting")).toBeVisible();
    expect(screen.getByText("B's actual name")).toBeVisible();
    expect(screen.getByText("@member-b")).toBeVisible();
    expect(screen.getByText("Record ID: exp_1")).toBeVisible();
    expect(screen.getByText("Updated · Expense")).toBeVisible();
    expect(screen.getByText("12345678901234567890.12345")).toBeVisible();
    expect(view.container.querySelector('[data-currency="KWD"]')).toHaveTextContent("KWD");
    expect(view.container.querySelector("time")).toHaveAttribute("datetime", event().createdAt);
    expect(view.container.querySelector("time").textContent).toBe(new Intl.DateTimeFormat("en", {
      dateStyle: "medium", timeStyle: "long",
    }).format(new Date(event().createdAt)));
    expect(client.activity).toHaveBeenCalledWith({ target: "shared", limit: 50 }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    view.rerender(fixture(client, { active: false }));
    view.rerender(fixture(client));
    expect(client.activity).toHaveBeenCalledOnce();
  });

  it("defers first read and invalidated reload while a parent write is pending", async () => {
    const client = api();
    const view = render(fixture(client, { disabled: true }));
    expect(client.activity).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Reload operation log" })).toBeDisabled();
    view.rerender(fixture(client));
    await screen.findByText("Cloud hosting");
    view.rerender(fixture(client, { disabled: true, reloadSignal: 1 }));
    expect(client.activity).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Reload operation log" }));
    expect(client.activity).toHaveBeenCalledOnce();
    view.rerender(fixture(client, { reloadSignal: 1 }));
    await waitFor(() => expect(client.activity).toHaveBeenCalledTimes(2));
  });

  it("appends bounded pages, deduplicates and accepts the same first cursor on an explicit reload", async () => {
    const client = api();
    client.activity
      .mockResolvedValueOnce(page({ nextCursor: "page-2" }))
      .mockResolvedValueOnce(page({ items: [event(), event({ id: "act_2", resource: { kind: "expense", id: "exp_2", label: "Domain renewal" } })] }))
      .mockResolvedValueOnce(page({ nextCursor: "page-2" }));
    const view = render(fixture(client));
    await screen.findByText("Cloud hosting");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByText("Domain renewal");
    expect(view.container.querySelectorAll(".activity-log-row")).toHaveLength(2);
    expect(client.activity.mock.calls[1][0]).toEqual({ target: "shared", limit: 50, cursor: "page-2" });
    fireEvent.click(screen.getByRole("button", { name: "Reload operation log" }));
    await waitFor(() => expect(screen.queryByText("Domain renewal")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
    expect(client.activity).toHaveBeenCalledTimes(3);
  });

  it("stops a repeated cursor, retains loaded history and waits for explicit recovery", async () => {
    const client = api();
    client.activity.mockResolvedValue(page({ nextCursor: "same-page" }));
    render(fixture(client));
    await screen.findByText("Cloud hosting");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Operation log pagination did not advance. Reload to continue.");
    expect(screen.getByText("Cloud hosting")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(client.activity).toHaveBeenCalledTimes(2);
  });

  it("does not turn a failed initial read into a successful empty log or retry automatically", async () => {
    const client = api();
    client.activity.mockRejectedValue(new Error("Unavailable"));
    render(fixture(client));
    expect(await screen.findByRole("alert")).toHaveTextContent("Operation log could not be loaded. Reload to try again.");
    expect(screen.queryByText("No changes in the past 24 hours.")).not.toBeInTheDocument();
    expect(client.activity).toHaveBeenCalledOnce();
    client.activity.mockResolvedValue(page({ items: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Reload operation log" }));
    expect(await screen.findByText("No changes in the past 24 hours.")).toBeVisible();
  });

  it("aborts stale API or target reads and never restores the previous scope", async () => {
    const first = api();
    const old = pending();
    first.activity.mockReturnValue(old.promise);
    const view = render(fixture(first));
    const signal = first.activity.mock.calls[0][1].signal;
    const second = api();
    second.activity.mockResolvedValue(page({ items: [event({ id: "act_new", resource: { kind: "expense", id: "exp_new", label: "New account record" } })] }));
    view.rerender(fixture(second));
    expect(signal.aborted).toBe(true);
    await screen.findByText("New account record");
    await act(async () => old.resolve(page()));
    expect(screen.queryByText("Cloud hosting")).not.toBeInTheDocument();
    const project = { kind: "project", projectId: "prj_new" };
    second.activity.mockResolvedValue(page({ items: [event({ target: project, resource: { kind: "project", id: "prj_new", label: "New project" } })] }));
    view.rerender(fixture(second, { target: project }));
    await screen.findByText("New project");
    expect(screen.queryByText("New account record")).not.toBeInTheDocument();
    expect(second.activity.mock.lastCall[0]).toEqual({ target: "project", projectId: "prj_new", limit: 50 });
  });

  it("rejects missing or different targets instead of showing protected records", async () => {
    const client = api();
    client.activity.mockResolvedValue(page({ items: [event({ target: undefined })] }));
    render(fixture(client));
    await screen.findByRole("alert");
    expect(screen.queryByText("Cloud hosting")).not.toBeInTheDocument();
  });

  it("labels email-only users, API keys, automation and restricted target changes explicitly", async () => {
    const client = api();
    client.activity.mockResolvedValue(page({ items: [
      event({ id: "email", actor: { kind: "user", userId: "usr_email", name: "Email member", githubLogin: null } }),
      event({ id: "key", actor: { kind: "api_key", userId: "usr_owner", name: "Owner", githubLogin: "owner" }, changes: [{ field: "target", before: { kind: "restricted" }, after: { kind: "shared" } }] }),
      event({ id: "schedule", actor: { kind: "system", userId: "usr_creator", name: "Schedule creator", githubLogin: "creator" }, resource: { kind: "expense", id: "exp_auto", label: "Monthly hosting" }, action: "generate" }),
    ] }));
    render(fixture(client));
    expect(await screen.findByText("Email member")).toBeVisible();
    expect(screen.getByText("API key · Owner")).toBeVisible();
    expect(screen.getByText("Automated schedule · Schedule creator")).toBeVisible();
    expect(screen.getByText("@creator")).toBeVisible();
    expect(screen.getByText("Generated · Expense")).toBeVisible();
    expect(screen.getByText("Restricted target", { exact: false })).toBeVisible();
    expect(screen.queryByText("Project: Unavailable", { exact: false })).not.toBeInTheDocument();
  });

  it("expires displayed records after 24 hours without issuing another API request", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    const client = api();
    client.activity.mockResolvedValue(page({ items: [event({ createdAt: "2026-10-08T08:00:01.000Z" })] }));
    render(fixture(client));
    await act(async () => {});
    expect(screen.getByText("Cloud hosting")).toBeVisible();
    await act(async () => vi.advanceTimersByTimeAsync(1002));
    expect(screen.queryByText("Cloud hosting")).not.toBeInTheDocument();
    expect(screen.getByText("No changes in the past 24 hours.")).toBeVisible();
    expect(client.activity).toHaveBeenCalledOnce();
  });

  it("uses the advancing server retention cutoff on later pages despite a skewed client clock", async () => {
    vi.setSystemTime(new Date("2026-11-01T08:00:00Z"));
    const client = api();
    client.activity
      .mockResolvedValueOnce(page({ nextCursor: "later", items: [event({ createdAt: "2026-10-08T08:00:30.000Z" })] }))
      .mockResolvedValueOnce(page({ windowStart: "2026-10-08T08:01:00.000Z", items: [event({ id: "act_later", resource: { kind: "expense", id: "exp_later", label: "Recent record" } })] }));
    render(fixture(client));
    expect(await screen.findByText("Cloud hosting")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Recent record")).toBeVisible();
    expect(screen.queryByText("Cloud hosting")).not.toBeInTheDocument();
    expect(client.activity).toHaveBeenCalledTimes(2);
  });
});
