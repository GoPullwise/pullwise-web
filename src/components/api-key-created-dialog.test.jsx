import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeyCreatedDialog } from "./api-key-created-dialog.jsx";

const credential = { keyId: "key_local_one", token: "pwk_local_once_001234" };

function deferred() {
  let resolve, reject;
  const promise = new Promise((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function MountedDialog({ value = credential, busy = false, onClose = () => {} }) {
  const backgroundRef = useRef(null);
  return (
    <>
      <main ref={backgroundRef}>Account key settings</main>
      <ApiKeyCreatedDialog
        credential={value}
        busy={busy}
        backgroundRef={backgroundRef}
        onClose={onClose}
      />
    </>
  );
}

function OpenedDialog() {
  const [open, setOpen] = useState(false);
  const backgroundRef = useRef(null);
  return (
    <>
      <main ref={backgroundRef}>
        <button onClick={() => setOpen(true)}>Create key</button>
      </main>
      {open && (
        <ApiKeyCreatedDialog
          credential={credential}
          backgroundRef={backgroundRef}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

let clipboardDescriptor;
beforeEach(() => {
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else delete navigator.clipboard;
});

describe("ApiKeyCreatedDialog", () => {
  it("traps focus, keeps the background inert and restores the opener only after inert is released", async () => {
    const user = userEvent.setup();
    render(<OpenedDialog />);
    const opener = screen.getByRole("button", { name: "Create key", exact: true });
    const background = opener.closest("main");
    const nativeFocus = opener.focus.bind(opener);
    // jsdom does not enforce native inert. This spy checks cleanup ordering.
    const focus = vi.spyOn(opener, "focus").mockImplementation((options) => {
      if (!background.inert) nativeFocus(options);
    });
    try {
      await user.click(opener);
      const dialog = await screen.findByRole("dialog", { name: "New key created" });
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAccessibleDescription("Copy it now. The full token is only shown once.");
      await waitFor(() => expect(background.inert).toBe(true));
      await waitFor(() =>
        expect(within(dialog).getByRole("button", { name: "Copy", exact: true })).toHaveFocus()
      );
      const token = within(dialog).getByLabelText("Bearer token");
      expect(token.tagName).toBe("PRE");
      expect(token).toHaveAttribute("tabindex", "0");
      expect(token.textContent).toBe(credential.token);
      const close = within(dialog).getAllByRole("button", { name: "Close", exact: true });
      expect(close).toHaveLength(2);
      close[0].focus();
      await user.keyboard("{Shift>}{Tab}{/Shift}");
      expect(within(dialog).getByRole("button", { name: "Copy", exact: true })).toHaveFocus();
      await user.keyboard("{Tab}");
      expect(close[0]).toHaveFocus();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(background.inert).toBe(false);
      await waitFor(() => expect(opener).toHaveFocus());
      expect(screen.queryByText(credential.token)).not.toBeInTheDocument();
    } finally {
      focus.mockRestore();
    }
  });

  it("blocks all close paths while busy while keeping token copying available", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const onClose = vi.fn();
    const view = render(<MountedDialog busy onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "New key created" });
    const close = within(dialog).getAllByRole("button", { name: "Close", exact: true });
    for (const control of close) expect(control).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(dialog.closest(".modal-back"));
    for (const control of close) fireEvent.click(control);
    expect(onClose).not.toHaveBeenCalled();
    const copy = within(dialog).getByRole("button", { name: "Copy", exact: true });
    expect(copy).toBeEnabled();
    await user.click(copy);
    expect(writeText).toHaveBeenCalledExactlyOnceWith(credential.token);
    expect(
      await within(dialog).findByRole("button", { name: "Copied", exact: true })
    ).toBeEnabled();
    view.rerender(<MountedDialog onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("copies the exact token once during a pending operation and announces success", async () => {
    userEvent.setup();
    const pending = deferred();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockReturnValueOnce(pending.promise);
    render(<MountedDialog />);
    const dialog = screen.getByRole("dialog", { name: "New key created" });
    const copy = within(dialog).getByRole("button", { name: "Copy", exact: true });
    act(() => {
      fireEvent.click(copy);
      fireEvent.click(copy);
    });
    expect(writeText).toHaveBeenCalledExactlyOnceWith(credential.token);
    expect(copy).toBeDisabled();
    expect(copy).toHaveAttribute("aria-busy", "true");
    await act(async () => pending.resolve());
    const copied = within(dialog).getByRole("button", { name: "Copied", exact: true });
    expect(copied).toBeEnabled();
    expect(copied).not.toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Copied");
    expect(within(dialog).getByLabelText("Bearer token").textContent).toBe(credential.token);
  });

  it.each(["resolve", "reject"])(
    "keeps focused Copy inside the dialog while pending and restores it after %s",
    async (completion) => {
      const user = userEvent.setup();
      const pending = deferred();
      vi.spyOn(navigator.clipboard, "writeText").mockReturnValueOnce(pending.promise);
      render(<MountedDialog />);
      const dialog = screen.getByRole("dialog", { name: "New key created" });
      const copy = within(dialog).getByRole("button", { name: "Copy", exact: true });
      const token = within(dialog).getByLabelText("Bearer token");
      await user.click(copy);
      expect(copy).toBeDisabled();
      // jsdom does not reproduce Chromium's disabled-button blur. Focusing the
      // token before disabling Copy prevents the real browser from reaching body.
      expect(token).toHaveFocus();
      await act(async () =>
        completion === "resolve" ? pending.resolve() : pending.reject(new Error("Clipboard denied"))
      );
      await waitFor(() => expect(copy).toBeEnabled());
      expect(copy).toHaveFocus();
      if (completion === "resolve") expect(copy).toHaveAccessibleName("Copied");
      else
        expect(within(dialog).getByRole("alert")).toHaveTextContent(
          "Select and copy the token manually."
        );
    }
  );

  it.each(["resolve", "reject"])(
    "does not take focus from another modal control when copying %s",
    async (completion) => {
      const user = userEvent.setup();
      const pending = deferred();
      vi.spyOn(navigator.clipboard, "writeText").mockReturnValueOnce(pending.promise);
      render(<MountedDialog />);
      const dialog = screen.getByRole("dialog", { name: "New key created" });
      await user.click(within(dialog).getByRole("button", { name: "Copy", exact: true }));
      expect(within(dialog).getByLabelText("Bearer token")).toHaveFocus();
      await user.tab();
      const close = within(dialog).getAllByRole("button", { name: "Close", exact: true })[1];
      expect(close).toHaveFocus();
      await act(async () =>
        completion === "resolve" ? pending.resolve() : pending.reject(new Error("Clipboard denied"))
      );
      expect(close).toHaveFocus();
      expect(
        within(dialog).getByRole("button", {
          name: completion === "resolve" ? "Copied" : "Copy",
          exact: true,
        })
      ).toBeEnabled();
    }
  );

  it("keeps manual token interaction focused when an earlier copy completes", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    vi.spyOn(navigator.clipboard, "writeText").mockReturnValueOnce(pending.promise);
    render(<MountedDialog />);
    const dialog = screen.getByRole("dialog", { name: "New key created" });
    await user.click(within(dialog).getByRole("button", { name: "Copy", exact: true }));
    const token = within(dialog).getByLabelText("Bearer token");
    expect(token).toHaveFocus();
    fireEvent.pointerDown(token);
    await act(async () => pending.resolve());
    expect(token).toHaveFocus();
    expect(within(dialog).getByRole("button", { name: "Copied", exact: true })).toBeEnabled();
  });

  it.each(["missing", "denied"])(
    "preserves manual copying and supports explicit retry when clipboard is %s",
    async (failure) => {
      const user = userEvent.setup();
      const originalClipboard = navigator.clipboard;
      if (failure === "missing")
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
      else
        vi.spyOn(originalClipboard, "writeText").mockRejectedValueOnce(
          new Error("Clipboard denied")
        );
      render(<MountedDialog />);
      const dialog = screen.getByRole("dialog", { name: "New key created" });
      await user.click(within(dialog).getByRole("button", { name: "Copy", exact: true }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Unable to copy API key. Select and copy the token manually."
      );
      const token = within(dialog).getByLabelText("Bearer token");
      expect(token.textContent).toBe(credential.token);
      expect(within(dialog).getByRole("button", { name: "Copy", exact: true })).toBeEnabled();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
      await user.click(within(dialog).getByRole("button", { name: "Copy", exact: true }));
      expect(writeText).toHaveBeenCalledExactlyOnceWith(credential.token);
      expect(
        await within(dialog).findByRole("button", { name: "Copied", exact: true })
      ).toBeEnabled();
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    }
  );

  it.each(["resolve", "reject"])(
    "ignores clipboard %s after unmount and does not affect a replacement dialog",
    async (completion) => {
      const user = userEvent.setup();
      const pending = deferred();
      vi.spyOn(navigator.clipboard, "writeText").mockReturnValueOnce(pending.promise);
      const original = render(<MountedDialog />);
      await user.click(screen.getByRole("button", { name: "Copy", exact: true }));
      original.unmount();
      const replacement = { keyId: "key_local_two", token: "pwk_local_new_654321" };
      render(<MountedDialog value={replacement} />);
      const replacementDialog = screen.getByRole("dialog", { name: "New key created" });
      await waitFor(() =>
        expect(
          within(replacementDialog).getByRole("button", { name: "Copy", exact: true })
        ).toHaveFocus()
      );
      const close = within(replacementDialog).getAllByRole("button", {
        name: "Close",
        exact: true,
      })[1];
      close.focus();
      await act(async () =>
        completion === "resolve"
          ? pending.resolve()
          : pending.reject(new Error("Old clipboard failed"))
      );
      const dialog = screen.getByRole("dialog", { name: "New key created" });
      expect(within(dialog).getByLabelText("Bearer token").textContent).toBe(replacement.token);
      expect(within(dialog).getByRole("button", { name: "Copy", exact: true })).toBeEnabled();
      expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
      expect(close).toHaveFocus();
    }
  );

  it.each(["resolve", "reject"])(
    "ignores old clipboard %s when the credential changes in the same mounted dialog",
    async (completion) => {
      const user = userEvent.setup();
      const pending = deferred();
      const currentCopy = deferred();
      const writeText = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockReturnValueOnce(pending.promise)
        .mockReturnValueOnce(currentCopy.promise);
      const view = render(<MountedDialog />);
      await user.click(screen.getByRole("button", { name: "Copy", exact: true }));
      const replacement = { keyId: "key_local_two", token: "pwk_local_new_654321" };
      view.rerender(<MountedDialog value={replacement} />);
      const dialog = screen.getByRole("dialog", { name: "New key created" });
      const newCopy = within(dialog).getByRole("button", { name: "Copy", exact: true });
      expect(newCopy).toBeEnabled();
      await user.click(newCopy);
      expect(writeText).toHaveBeenNthCalledWith(2, replacement.token);
      expect(newCopy).toBeDisabled();
      await act(async () =>
        completion === "resolve"
          ? pending.resolve()
          : pending.reject(new Error("Old clipboard failed"))
      );
      expect(newCopy).toBeDisabled();
      expect(within(dialog).getByLabelText("Bearer token")).toHaveFocus();
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
      expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
      await act(async () => currentCopy.resolve());
      expect(within(dialog).getByRole("button", { name: "Copied", exact: true })).toBeEnabled();
      expect(newCopy).toHaveFocus();
      expect(within(dialog).getByLabelText("Bearer token").textContent).toBe(replacement.token);
    }
  );
});
