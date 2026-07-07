import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_AUTO_DISMISS_MS,
  NotificationProvider,
  useNotify,
} from "./notifications.jsx";

function NotificationHarness() {
  const notify = useNotify();
  return (
    <div>
      <button
        type="button"
        onClick={() => notify.error("First failure", { title: "Scan error" })}
      >
        Show first
      </button>
      <button
        type="button"
        onClick={() => notify.error("Second failure", { title: "Scan error" })}
      >
        Show second
      </button>
    </div>
  );
}

describe("NotificationProvider", () => {
  it("stacks multiple notifications and dismisses one manually", async () => {
    const user = userEvent.setup();
    render(
      <NotificationProvider>
        <NotificationHarness />
      </NotificationProvider>
    );

    await user.click(screen.getByRole("button", { name: /show first/i }));
    await user.click(screen.getByRole("button", { name: /show second/i }));

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent("First failure");
    expect(alerts[1]).toHaveTextContent("Second failure");

    await user.click(within(alerts[0]).getByRole("button", { name: /close notification/i }));

    expect(screen.queryByText("First failure")).not.toBeInTheDocument();
    expect(screen.getByText("Second failure")).toBeInTheDocument();
  });

  it("auto-dismisses notifications after five minutes", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    try {
      render(
        <NotificationProvider>
          <NotificationHarness />
        </NotificationProvider>
      );

      await user.click(screen.getByRole("button", { name: /show first/i }));
      expect(screen.getByRole("alert")).toHaveTextContent("First failure");

      act(() => {
        vi.advanceTimersByTime(NOTIFICATION_AUTO_DISMISS_MS - 1);
      });
      expect(screen.getByRole("alert")).toHaveTextContent("First failure");

      act(() => {
        vi.advanceTimersByTime(1);
      });
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });
});
