import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvitationInboxButton, InvitationInboxProvider } from "./invitation-inbox.jsx";
import { NotificationProvider } from "./notifications.jsx";

const request = {
  id: "request-one",
  status: "pending",
  workspaceId: "team",
  workspace: { id: "team", name: "Team ledger" },
  invitationId: "invitation-one",
  invitation: { id: "invitation-one" },
  applicant: { userId: "applicant", name: "New member" },
};
const expense = {
  id: "rule-one:2026-10-09",
  ruleId: "rule-one",
  periodKey: "2026-10-09",
  scheduledOn: "2026-10-09",
  workspaceId: "team",
  workspaceName: "Team ledger",
  target: { kind: "project", projectId: "hosting" },
  amount: "9007199254740993.12",
  currency: "USD",
  purpose: "Monthly hosting",
  failedCode: "EXPENSE_LIMIT_REACHED",
  createdAt: "2026-10-09T00:00:00Z",
};

describe("InvitationInbox", () => {
  it("locks review in an open inbox while allowing explicit reads and dismissal", async () => {
    const api = {
      invitationRequests: vi.fn().mockResolvedValue({ items: [request] }),
      recurringExpenseNotifications: vi.fn().mockResolvedValue({ items: [] }),
    };
    const review = vi.fn();
    const tree = (navigationDisabled) => (
      <NotificationProvider navigationDisabled={navigationDisabled}>
        <InvitationInboxProvider
          identity="inviter"
          enabled
          navigationKey="settings"
          navigationDisabled={navigationDisabled}
          onReview={review}
          api={api}
        >
          <InvitationInboxButton />
        </InvitationInboxProvider>
      </NotificationProvider>
    );
    const { rerender } = render(tree(false));
    await screen.findByRole("button", { name: "Review request" });
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    const dialog = await screen.findByRole("dialog", { name: "Inbox" });
    const reload = within(dialog).getByRole("button", { name: "Reload" });
    await waitFor(() => expect(reload).toBeEnabled());

    rerender(tree(true));
    const control = within(dialog).getByRole("button", { name: "Review request" });
    expect(control).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Review request" })).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Review request" }).every((node) => node.disabled)
    ).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeEnabled();
    fireEvent.click(control);
    expect(review).not.toHaveBeenCalled();
    const reads = api.invitationRequests.mock.calls.length;
    fireEvent.click(reload);
    await waitFor(() => expect(api.invitationRequests).toHaveBeenCalledTimes(reads + 1));
    await waitFor(() => expect(reload).toBeEnabled());
    expect(review).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();

    rerender(tree(false));
    expect(control).toBeEnabled();
    fireEvent.click(control);
    expect(review).toHaveBeenCalledWith(request);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("retains each dated failed expense after dismissal and locks its target action through writes", async () => {
    const api = {
      invitationRequests: vi.fn().mockResolvedValue({ items: [request] }),
      recurringExpenseNotifications: vi.fn().mockResolvedValue({ items: [expense], hasMore: true }),
    };
    const openPlan = vi.fn().mockReturnValue(false);
    const tree = (navigationDisabled) => (
      <NotificationProvider navigationDisabled={navigationDisabled}>
        <InvitationInboxProvider
          identity="owner"
          enabled
          navigationKey="projects"
          navigationDisabled={navigationDisabled}
          onReview={vi.fn()}
          onOpenRecurring={openPlan}
          api={api}
        >
          <InvitationInboxButton />
        </InvitationInboxProvider>
      </NotificationProvider>
    );
    const { rerender } = render(tree(false));
    await screen.findByRole("button", { name: "Open recurring plan" });
    expect(screen.getByRole("button", { name: "Inbox" })).toHaveTextContent("2+");
    for (const button of screen.getAllByRole("button", { name: "Close notification" }))
      fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    const dialog = await screen.findByRole("dialog", { name: "Inbox" });
    const rows = within(dialog).getByRole("region", { name: "Pending expenses" });
    expect(rows).toHaveTextContent("Monthly hosting");
    expect(rows.querySelector("time")).toHaveAttribute("datetime", "2026-10-09");
    expect(rows.querySelector(".financial-value").textContent).toBe("USD 9007199254740993.12");
    expect(rows.querySelector("[data-currency]")).toHaveAttribute("data-currency", "USD");
    const action = within(rows).getByRole("button", { name: "Open recurring plan" });
    rerender(tree(true));
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(openPlan).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Reload" })).toBeEnabled()
    );
    const previousReads = api.recurringExpenseNotifications.mock.calls.length;
    fireEvent.click(within(dialog).getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(api.recurringExpenseNotifications).toHaveBeenCalledTimes(previousReads + 1)
    );
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Reload" })).toBeEnabled()
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(tree(false));
    fireEvent.click(action);
    expect(openPlan).toHaveBeenCalledWith(expense);
    expect(dialog).toBeInTheDocument();
    openPlan.mockReturnValue(true);
    fireEvent.click(action);
    expect(dialog).not.toBeInTheDocument();
  });

  it("keeps invitation reminders available when recurring notifications are unavailable", async () => {
    const api = {
      invitationRequests: vi.fn().mockResolvedValue({ items: [request] }),
      recurringExpenseNotifications: vi.fn().mockRejectedValue(new Error("Unavailable")),
    };
    render(
      <NotificationProvider>
        <InvitationInboxProvider
          identity="owner"
          enabled
          navigationKey="projects"
          onReview={vi.fn()}
          onOpenRecurring={vi.fn()}
          api={api}
        >
          <InvitationInboxButton />
        </InvitationInboxProvider>
      </NotificationProvider>
    );
    await screen.findByRole("button", { name: "Review request" });
    expect(screen.getByRole("button", { name: "Inbox" })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    const dialog = await screen.findByRole("dialog", { name: "Inbox" });
    await within(dialog).findByText("Pending expenses unavailable.");
    expect(within(dialog).getByRole("button", { name: "Review request" })).toBeEnabled();
    expect(within(dialog).queryByText("No pending expenses.")).not.toBeInTheDocument();
  });

  it("aborts old-account reads and never restores their pending expenses or reminders", async () => {
    let resolveOld;
    const oldRead = new Promise((resolve) => {
      resolveOld = resolve;
    });
    const api = {
      invitationRequests: vi.fn().mockResolvedValue({ items: [] }),
      recurringExpenseNotifications: vi
        .fn()
        .mockReturnValueOnce(oldRead)
        .mockResolvedValue({ items: [] }),
    };
    const tree = (identity) => (
      <NotificationProvider scope={identity}>
        <InvitationInboxProvider
          identity={identity}
          enabled
          navigationKey="projects"
          onReview={vi.fn()}
          onOpenRecurring={vi.fn()}
          api={api}
        >
          <InvitationInboxButton />
        </InvitationInboxProvider>
      </NotificationProvider>
    );
    const { rerender } = render(tree("old-owner"));
    await waitFor(() => expect(api.recurringExpenseNotifications).toHaveBeenCalledTimes(1));
    const oldSignal = api.recurringExpenseNotifications.mock.calls[0][0].signal;
    rerender(tree("new-owner"));
    await waitFor(() => expect(api.recurringExpenseNotifications).toHaveBeenCalledTimes(2));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld({ items: [expense] }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inbox" })).not.toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    const dialog = await screen.findByRole("dialog", { name: "Inbox" });
    expect(await within(dialog).findByText("No pending expenses.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Monthly hosting")).not.toBeInTheDocument();
  });
});
