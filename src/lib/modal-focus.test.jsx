import { StrictMode, useRef } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useModalFocus } from "./modal-focus.js";

function Fixture({ busy = false, empty = false, onClose = () => {} }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  useModalFocus({ open: true, dialogRef, initialFocusRef: cancelRef, onClose, busy });
  return (
    <>
      <button type="button">Floating control</button>
      <div ref={dialogRef} role="dialog" aria-label="Current action">
        <button ref={cancelRef} type="button" disabled={busy}>
          Cancel
        </button>
        <p tabIndex={empty ? undefined : 0}>Action details</p>
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
    "rejects outside focus and wraps %s reverse Tab at the appropriate dialog boundary",
    async (shiftKey) => {
      render(<Fixture />);
      const dialog = screen.getByRole("dialog", { name: "Current action" });
      await waitFor(() =>
        expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus()
      );
      const outside = screen.getByRole("button", { name: "Floating control" });
      outside.focus();
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
      within(dialog)
        .getByRole("button", { name: shiftKey ? "Cancel" : "Confirm" })
        .focus();
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

  it("keeps focus in an empty busy dialog and blocks Escape until the operation settles", async () => {
    const close = vi.fn();
    const view = render(<Fixture busy empty onClose={close} />);
    const dialog = screen.getByRole("dialog", { name: "Current action" });
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(pressTab().defaultPrevented).toBe(true);
    expect(pressTab(true).defaultPrevented).toBe(true);
    screen.getByRole("button", { name: "Floating control" }).focus();
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    view.rerender(<Fixture empty onClose={close} />);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("recovers focus when disabling the current action leaves no focusable controls", async () => {
    const view = render(<Fixture empty />);
    const dialog = screen.getByRole("dialog", { name: "Current action" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus()
    );
    view.rerender(<Fixture busy empty />);
    expect(dialog).toHaveFocus();
  });
});

function Modal({ open = true, label, onClose = () => {}, children, backdropStyle }) {
  const dialogRef = useRef(null);
  useModalFocus({ open, dialogRef, onClose });
  return open ? (
    <div className="modal-back" style={backdropStyle}>
      <div ref={dialogRef} role="dialog" aria-label={label}>
        <button>{label} action</button>
        {children}
      </div>
    </div>
  ) : null;
}

describe("Modal document lifecycle", () => {
  it("preserves document position and inline styles until the final nested dialog closes", async () => {
    const scroll = vi.spyOn(window, "scrollTo");
    vi.stubGlobal("scrollY", 246);
    vi.stubGlobal("scrollX", 11);
    document.body.style.setProperty("position", "relative", "important");
    document.body.style.setProperty("top", "3px");
    document.documentElement.style.setProperty("overflow", "clip");
    const outerClose = vi.fn();
    const innerClose = vi.fn();
    const tree = (innerOpen) => (
      <Modal label="Outer" onClose={outerClose}>
        <Modal open={innerOpen} label="Inner" onClose={innerClose} />
      </Modal>
    );
    let view;
    try {
      view = render(tree(true));
      const outer = screen.getByRole("dialog", { name: "Outer" });
      const inner = screen.getByRole("dialog", { name: "Inner" });
      await waitFor(() =>
        expect(within(inner).getByRole("button", { name: "Inner action" })).toHaveFocus()
      );
      expect(document.body.style.position).toBe("fixed");
      expect(document.body.style.top).toBe("-246px");
      expect(document.body.style.left).toBe("-11px");
      expect(document.documentElement.style.overflow).toBe("hidden");
      expect(within(outer).getByRole("button", { name: "Outer action" })).toHaveAttribute("inert");
      fireEvent.keyDown(inner, { key: "Escape" });
      expect(innerClose).toHaveBeenCalledOnce();
      expect(outerClose).not.toHaveBeenCalled();
      view.rerender(tree(false));
      expect(document.body.style.position).toBe("fixed");
      expect(scroll).not.toHaveBeenCalled();
      expect(within(outer).getByRole("button", { name: "Outer action" })).not.toHaveAttribute(
        "inert"
      );
      view.unmount();
      expect(document.body.style.position).toBe("relative");
      expect(document.body.style.getPropertyPriority("position")).toBe("important");
      expect(document.body.style.top).toBe("3px");
      expect(document.documentElement.style.overflow).toBe("clip");
      expect(scroll).toHaveBeenCalledExactlyOnceWith(11, 246);
    } finally {
      view?.unmount();
      document.body.removeAttribute("style");
      document.documentElement.style.removeProperty("overflow");
      scroll.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("inerts new outside controls and restores preexisting inert state on scope replacement", async () => {
    const original = document.createElement("aside");
    original.inert = true;
    original.setAttribute("inert", "");
    document.body.append(original);
    const view = render(<Modal key="first-scope" label="Scoped" />);
    const added = document.createElement("button");
    document.body.append(added);
    try {
      await waitFor(() => expect(added).toHaveAttribute("inert"));
      view.rerender(<Modal key="second-scope" label="Scoped" />);
      expect(document.body.style.position).toBe("fixed");
      expect(added).toHaveAttribute("inert");
      view.unmount();
      expect(document.body.style.position).toBe("");
      expect(added).not.toHaveAttribute("inert");
      expect(original).toHaveAttribute("inert");
      expect(original.inert).toBe(true);
    } finally {
      view.unmount();
      original.remove();
      added.remove();
    }
  });

  it("releases document locking after Strict Mode setup and cleanup replays", () => {
    const view = render(
      <StrictMode>
        <Modal label="Strict" />
      </StrictMode>
    );
    expect(document.body.style.position).toBe("fixed");
    view.unmount();
    expect(document.body.style.position).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("tracks the keyboard viewport for the current modal and restores its CSS properties", () => {
    const viewport = new EventTarget();
    viewport.height = 720;
    viewport.offsetTop = 0;
    vi.stubGlobal("visualViewport", viewport);
    const add = vi.spyOn(viewport, "addEventListener");
    const remove = vi.spyOn(viewport, "removeEventListener");
    const tree = (innerOpen = false) => (
      <Modal label="Viewport outer" backdropStyle={{ "--modal-viewport-height": "999px" }}>
        <Modal open={innerOpen} label="Viewport inner" />
      </Modal>
    );
    const view = render(tree());
    const outerBackdrop = screen
      .getByRole("dialog", { name: "Viewport outer" })
      .closest(".modal-back");
    try {
      expect(outerBackdrop.style.getPropertyValue("--modal-viewport-height")).toBe("720px");
      view.rerender(tree(true));
      const innerBackdrop = screen
        .getByRole("dialog", { name: "Viewport inner" })
        .closest(".modal-back");
      viewport.height = 350;
      viewport.offsetTop = 230;
      viewport.dispatchEvent(new Event("resize"));
      expect(innerBackdrop.style.getPropertyValue("--modal-viewport-height")).toBe("350px");
      expect(innerBackdrop.style.getPropertyValue("--modal-viewport-top")).toBe("230px");
      expect(outerBackdrop.style.getPropertyValue("--modal-viewport-height")).toBe("720px");
      expect(add).toHaveBeenCalledTimes(2);
      view.rerender(tree());
      expect(outerBackdrop.style.getPropertyValue("--modal-viewport-height")).toBe("350px");
      view.unmount();
      expect(outerBackdrop.style.getPropertyValue("--modal-viewport-height")).toBe("999px");
      expect(outerBackdrop.style.getPropertyValue("--modal-viewport-top")).toBe("");
      expect(remove).toHaveBeenCalledTimes(2);
      viewport.dispatchEvent(new Event("scroll"));
      expect(outerBackdrop.style.getPropertyValue("--modal-viewport-height")).toBe("999px");
    } finally {
      view.unmount();
      vi.unstubAllGlobals();
    }
  });
});
