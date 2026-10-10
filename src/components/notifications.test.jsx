import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { NOTIFICATION_AUTO_DISMISS_MS, NotificationProvider, useNotify } from "./notifications.jsx";
import { setLang } from "../i18n.jsx";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractRuleBody(styles, selector) {
  const match = styles.match(new RegExp(`${escapeRegex(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  expect(match, `Expected CSS rule for ${selector}`).not.toBeNull();
  return match[1];
}

function NotificationHarness() {
  const notify = useNotify();
  return (
    <div>
      <button
        type="button"
        onClick={() => notify.error("First failure", { title: "Expense error" })}
      >
        Show first
      </button>
      <button
        type="button"
        onClick={() => notify.error("Second failure", { title: "Expense error" })}
      >
        Show second
      </button>
    </div>
  );
}

function ActionHarness({ action }) {
  const { notify } = useNotify();
  return (
    <button
      type="button"
      onClick={() => notify({ message: "Pending request", action, durationMs: 0 })}
    >
      Show action
    </button>
  );
}

describe("NotificationProvider", () => {
  it("disables conflicting navigation while preserving the notification for later review", () => {
    const review = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const action = { label: "Review request", navigation: true, onClick: review };
    const { rerender } = render(
      <NotificationProvider navigationDisabled>
        <ActionHarness action={action} />
      </NotificationProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Show action" }));
    const control = screen.getByRole("button", { name: "Review request" });
    expect(control).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close notification" })).toBeEnabled();
    fireEvent.click(control);
    expect(review).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Pending request");

    rerender(
      <NotificationProvider>
        <ActionHarness action={action} />
      </NotificationProvider>
    );
    expect(control).toBeEnabled();
    fireEvent.click(control);
    expect(review).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(control);
    expect(review).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps non-navigation notification actions available during a pending operation", () => {
    const copy = vi.fn();
    render(
      <NotificationProvider navigationDisabled>
        <ActionHarness action={{ label: "Copy details", onClick: copy }} />
      </NotificationProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Show action" }));
    const control = screen.getByRole("button", { name: "Copy details" });
    expect(control).toBeEnabled();
    fireEvent.click(control);
    expect(copy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("localizes default notification chrome in Chinese", async () => {
    setLang("zh");
    const user = userEvent.setup();
    try {
      render(
        <NotificationProvider>
          <NotificationHarness />
        </NotificationProvider>
      );

      await user.click(screen.getByRole("button", { name: /show first/i }));

      expect(screen.getByLabelText("通知")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "关闭通知" })).toBeInTheDocument();
    } finally {
      setLang("en");
    }
  });

  it("does not add a left accent bar to notification toasts", () => {
    const styles = readFileSync("src/app.css", "utf8");

    expect(styles).not.toMatch(/\.notification-toast::before/);
  });

  it("keeps floating controls hard-edged by construction", () => {
    const styles = readFileSync("src/app.css", "utf8");
    const baseStyles = readFileSync("styles/base.css", "utf8");

    // The global reset owns the hard edge; floating controls need no override.
    expect(baseStyles).toMatch(/\*\s*,\s*\*::before,\s*\*::after\s*\{[^}]*border-radius:\s*0;/s);
    for (const selector of [
      ".lang-toggle",
      ".theme-toggle",
      ".back-to-top",
      ".notification-toast",
      ".notification-icon",
      ".notification-close",
    ]) {
      const rule = styles.match(
        new RegExp(`${escapeRegex(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`, "m")
      );
      expect(rule, `Expected CSS rule for ${selector}`).not.toBeNull();
      expect(rule[1]).not.toMatch(/border-radius|box-shadow/);
    }
  });

  it("anchors notification toasts beside the bottom control cluster", () => {
    const styles = readFileSync("src/app.css", "utf8");

    expect(styles).toMatch(
      /\.notification-stack\s*\{[\s\S]*right:\s*180px;[\s\S]*bottom:\s*calc\(18px \+ env\(safe-area-inset-bottom\)\);[\s\S]*width:\s*min\(390px,\s*calc\(100vw - 198px\)\);/
    );
  });

  it("keeps an open language picker above notifications and below modal backdrops", () => {
    const pickerStyles = readFileSync("src/app.css", "utf8");
    const modalStyles = readFileSync("styles/screens.css", "utf8");
    const baseStyles = readFileSync("styles/base.css", "utf8");

    expect(extractRuleBody(pickerStyles, ".lang-picker")).toMatch(
      /z-index:\s*calc\(var\(--z-float\) \+ 1\);/
    );
    expect(extractRuleBody(pickerStyles, ".notification-stack-controls-open")).toMatch(
      /z-index:\s*var\(--z-float\);/
    );
    expect(extractRuleBody(pickerStyles, ".notification-stack")).toMatch(
      /z-index:\s*var\(--z-toast\);/
    );
    expect(extractRuleBody(modalStyles, ".modal-back")).toMatch(/z-index:\s*var\(--z-modal\);/);
    expect(baseStyles).toMatch(/--z-float:\s*60;/);
    expect(baseStyles).toMatch(/--z-modal:\s*100;/);
  });

  it("keeps high-priority visual tokens and modal ownership canonical", () => {
    const baseStyles = readFileSync("styles/base.css", "utf8");
    const modalStyles = readFileSync("styles/screens.css", "utf8");
    const appStyles = readFileSync("src/app.css", "utf8");
    const pageStyles = modalStyles + "\n" + appStyles;
    const modalWidthRules = modalStyles.match(/\.modal\s*\{[^}]*max-width:[^;}]+;/gs) || [];

    expect(baseStyles.match(/(?:^|\n):root\s*\{/g)).toHaveLength(1);
    expect(appStyles).not.toMatch(/(?:^|\n):root\s*\{/);
    expect(modalWidthRules).toHaveLength(1);
    expect(modalWidthRules[0]).toMatch(/max-width:\s*var\(--modal-max-width\);/);
    expect(baseStyles).toMatch(/--modal-max-width:\s*min\(560px,\s*calc\(100vw - 24px\)\);/);
    expect(pageStyles).not.toMatch(/var\(--[a-z0-9-]+\s*,/i);
    expect(pageStyles).not.toMatch(/#(?:16a34a|b91c1c|dc2626|15803d|4ade80|f59e0b|b45309)\b/i);
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
