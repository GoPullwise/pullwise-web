import { useRef } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useModalFocus } from "./modal-focus.js";

function Fixture({ busy = false }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  useModalFocus({ open: true, dialogRef, initialFocusRef: cancelRef, onClose: vi.fn() });
  return (
    <>
      <button type="button">Floating control</button>
      <div ref={dialogRef} role="dialog" aria-label="Current action">
        <button ref={cancelRef} type="button" disabled={busy}>
          Cancel
        </button>
        <p tabIndex={0}>Action details</p>
        <label>
          Note
          <input disabled={busy} />
        </label>
        <button type="button" disabled={busy}>
          Confirm
        </button>
      </div>
    </>
  );
}

function pressTab(shiftKey = false) {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

describe("Modal focus recovery", () => {
  it.each([false, true])(
    "recovers %s reverse Tab from an outside control to the appropriate dialog boundary",
    async (shiftKey) => {
      render(<Fixture />);
      const dialog = screen.getByRole("dialog", { name: "Current action" });
      await waitFor(() =>
        expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus()
      );
      const outside = screen.getByRole("button", { name: "Floating control" });
      outside.focus();
      expect(outside).toHaveFocus();
      const event = pressTab(shiftKey);
      expect(event.defaultPrevented).toBe(true);
      expect(
        within(dialog).getByRole("button", { name: shiftKey ? "Confirm" : "Cancel" })
      ).toHaveFocus();
    }
  );

  it.each([false, true])(
    "recovers %s reverse Tab from body while all action buttons are disabled",
    async (shiftKey) => {
      render(<Fixture busy />);
      const dialog = screen.getByRole("dialog", { name: "Current action" });
      const details = within(dialog).getByText("Action details");
      details.focus();
      expect(details).toHaveFocus();
      // Real browsers can blur a modal when a pointer falls through a disabled
      // button's non-interactive box. jsdom needs the resulting body focus modeled.
      details.blur();
      expect(document.body).toHaveFocus();
      const event = pressTab(shiftKey);
      expect(event.defaultPrevented).toBe(true);
      expect(details).toHaveFocus();
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeDisabled();
    }
  );

  it("keeps native forward and backward navigation between interior controls", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    const dialog = screen.getByRole("dialog", { name: "Current action" });
    const details = within(dialog).getByText("Action details");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus()
    );
    fireEvent.focus(details);
    details.focus();
    expect(pressTab().defaultPrevented).toBe(false);
    await user.tab();
    const note = within(dialog).getByRole("textbox", { name: "Note" });
    expect(note).toHaveFocus();
    expect(pressTab(true).defaultPrevented).toBe(false);
    await user.tab({ shift: true });
    expect(details).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});
