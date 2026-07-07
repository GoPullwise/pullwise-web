import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { NOTIFICATION_AUTO_DISMISS_MS, NotificationProvider, useNotify } from "./notifications.jsx";

function NotificationHarness() {
  const notify = useNotify();
  return (
    <div>
      <button type="button" onClick={() => notify.error("First failure", { title: "Scan error" })}>
        Show first
      </button>
      <button type="button" onClick={() => notify.error("Second failure", { title: "Scan error" })}>
        Show second
      </button>
    </div>
  );
}

describe("NotificationProvider", () => {
  it("keeps notification toasts rounded with a visible error accent bar", () => {
    const styles = readFileSync("src/app.css", "utf8");

    expect(styles).toMatch(
      /\.notification-toast\s*\{[\s\S]*border-radius:\s*12px;[\s\S]*overflow:\s*hidden;/
    );
    expect(styles).toMatch(
      /\.notification-toast::before\s*\{[\s\S]*width:\s*5px;[\s\S]*background:\s*var\(--danger, #dc2626\);/
    );
  });
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

  it("auto-dismisses notifications after five minutes", () => {
    vi.useFakeTimers();
    try {
      render(
        <NotificationProvider>
          <NotificationHarness />
        </NotificationProvider>
      );

      fireEvent.click(screen.getByRole("button", { name: /show first/i }));
      expect(screen.getByRole("alert")).toHaveTextContent("First failure");

      act(() => {
        vi.advanceTimersByTime(NOTIFICATION_AUTO_DISMISS_MS - 1);
      });
      expect(screen.getByRole("alert")).toHaveTextContent("First failure");

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
