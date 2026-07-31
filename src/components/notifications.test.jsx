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

function extractSelectorGroupBody(styles, selectors) {
  const selectorPattern = selectors.map((selector) => escapeRegex(selector)).join("\\s*,\\s*");
  const match = styles.match(new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  expect(match, `Expected CSS selector group for ${selectors.join(", ")}`).not.toBeNull();
  return match[1];
}

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

  it("keeps the final floating control override explicitly hard-edged", () => {
    const styles = readFileSync("src/app.css", "utf8");
    const hardEdgeOverride = extractSelectorGroupBody(styles, [
      ".lang-toggle",
      ".theme-toggle",
      ".back-to-top",
      ".notification-toast",
      ".notification-icon",
      ".notification-close",
    ]);

    expect(hardEdgeOverride).toMatch(/border-radius:\s*0;/);
    expect(hardEdgeOverride).toMatch(/box-shadow:\s*none;/);
  });

  it("anchors notification toasts beside the bottom control cluster", () => {
    const styles = readFileSync("src/app.css", "utf8");

    expect(styles).toMatch(
      /\.notification-stack\s*\{[\s\S]*right:\s*166px;[\s\S]*bottom:\s*18px;[\s\S]*width:\s*min\(390px,\s*calc\(100vw - 184px\)\);/
    );
  });

  it("keeps the language picker below modal backdrops", () => {
    const pickerStyles = readFileSync("src/app.css", "utf8");
    const modalStyles = readFileSync("styles/screens.css", "utf8");
    const baseStyles = readFileSync("styles/base.css", "utf8");

    expect(extractRuleBody(pickerStyles, ".lang-picker")).toMatch(/z-index:\s*var\(--z-float\);/);
    expect(extractRuleBody(modalStyles, ".modal-back")).toMatch(/z-index:\s*var\(--z-modal\);/);
    expect(baseStyles).toMatch(/--z-float:\s*60;/);
    expect(baseStyles).toMatch(/--z-modal:\s*100;/);
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
