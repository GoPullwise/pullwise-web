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

describe("InvitationInbox", () => {
  it("refreshes after BFCache restoration without duplicate or overlapping automatic reads", async () => {
    let now = 100000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    let finishReturn;
    const restored = new Promise((resolve) => {
      finishReturn = resolve;
    });
    const api = {
      invitationRequests: vi
        .fn()
        .mockResolvedValueOnce({ items: [] })
        .mockReturnValueOnce(restored)
        .mockReturnValueOnce(new Promise(() => {})),
    };
    const pageshow = (persisted) => {
      const event = new Event("pageshow");
      Object.defineProperty(event, "persisted", { value: persisted });
      fireEvent(window, event);
    };
    const view = render(
      <NotificationProvider>
        <InvitationInboxProvider
          identity="inviter"
          enabled
          navigationKey="settings"
          onReview={vi.fn()}
          api={api}
        >
          <InvitationInboxButton />
        </InvitationInboxProvider>
      </NotificationProvider>
    );
    try {
      await act(async () => {});
      expect(api.invitationRequests).toHaveBeenCalledOnce();
      now += 10001;
      pageshow(false);
      expect(api.invitationRequests).toHaveBeenCalledOnce();
      pageshow(true);
      expect(api.invitationRequests).toHaveBeenCalledTimes(2);
      const returnedSignal = api.invitationRequests.mock.calls[1][0].signal;
      now += 4;
      fireEvent.focus(window);
      fireEvent(document, new Event("visibilitychange"));
      pageshow(true);
      expect(api.invitationRequests).toHaveBeenCalledTimes(2);
      expect(returnedSignal.aborted).toBe(false);
      await act(async () => finishReturn({ items: [request] }));
      expect(screen.getByRole("button", { name: "Review request" })).toBeInTheDocument();
      pageshow(true);
      expect(api.invitationRequests).toHaveBeenCalledTimes(2);
      now += 10001;
      pageshow(true);
      expect(api.invitationRequests).toHaveBeenCalledTimes(3);
      const pendingSignal = api.invitationRequests.mock.calls[2][0].signal;
      now += 10001;
      pageshow(true);
      fireEvent.focus(window);
      expect(api.invitationRequests).toHaveBeenCalledTimes(3);
      expect(pendingSignal.aborted).toBe(false);
      view.unmount();
      expect(pendingSignal.aborted).toBe(true);
      now += 10001;
      pageshow(true);
      expect(api.invitationRequests).toHaveBeenCalledTimes(3);
    } finally {
      view.unmount();
      clock.mockRestore();
    }
  });

  it("locks review in an open inbox while allowing explicit reads and dismissal", async () => {
    const api = { invitationRequests: vi.fn().mockResolvedValue({ items: [request] }) };
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
    fireEvent.click(screen.getByRole("button", { name: "Join requests" }));
    const dialog = await screen.findByRole("dialog", { name: "Join requests" });
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
});
