import { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog.jsx";

it("restores the opener after the background stops being inert", async () => {
  function Example() {
    const [open, setOpen] = useState(false);
    const backgroundRef = useRef(null);
    return (
      <>
        <main ref={backgroundRef}>
          <button onClick={() => setOpen(true)}>Revoke key</button>
        </main>
        <ConfirmDialog
          open={open}
          title="Revoke key?"
          description="The selected key will stop working."
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
          backgroundRef={backgroundRef}
        />
      </>
    );
  }

  render(<Example />);
  const user = userEvent.setup();
  const opener = screen.getByRole("button", { name: "Revoke key" });
  const background = opener.closest("main");
  const nativeFocus = opener.focus.bind(opener);
  // jsdom does not enforce the browser's inert focus restriction.
  const focus = vi.spyOn(opener, "focus").mockImplementation((options) => {
    if (!background.inert) nativeFocus(options);
  });
  try {
    await user.click(opener);
    await waitFor(() => expect(background.inert).toBe(true));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Cancel" })[0]).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
  } finally {
    focus.mockRestore();
  }
});

it("keeps a busy confirmation open and focused without blocking its readable body", async () => {
  const cancel = vi.fn();
  const confirm = vi.fn();
  render(
    <ConfirmDialog
      open
      busy
      title="Cancel renewal?"
      description="Read the complete cancellation terms."
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      onConfirm={confirm}
      onCancel={cancel}
    />
  );
  const dialog = screen.getByRole("dialog");
  await waitFor(() => expect(dialog).toHaveFocus());
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(dialog.closest(".modal-back"));
  expect(cancel).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByText("Read the complete cancellation terms.")).toBeVisible();
  expect(dialog.closest(".modal-back")).not.toHaveAttribute("inert");
});
