import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiDocsScreen } from "./api-docs.jsx";
import { setLang } from "../i18n.jsx";

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete navigator.clipboard;
  return setLang("en");
});

function clipboard(value) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

describe("API documentation clipboard recovery", () => {
  it.each(["missing", "denied"])("offers exact selectable Markdown when clipboard is %s", async (failure) => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    clipboard(failure === "missing" ? undefined : { writeText });
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Page" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Select and copy the Markdown below");
    const fallback = screen.getByRole("textbox", { name: "Page Markdown" });
    expect(fallback).toHaveAttribute("readonly");
    expect(fallback).toHaveFocus();
    expect(fallback.selectionStart).toBe(0);
    expect(fallback.selectionEnd).toBe(fallback.value.length);
    expect(fallback.value).toContain("# Pullwise ledger REST API");
    expect(fallback.value).toContain("Idempotency-Key");
    if (failure === "denied") expect(fallback.value).toBe(writeText.mock.calls[0][0]);
    const retry = vi.fn().mockResolvedValue(undefined);
    clipboard({ writeText: retry });
    fireEvent.click(screen.getByRole("button", { name: "Copy Page" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(retry).toHaveBeenCalledWith(fallback.value);
    expect(screen.queryByRole("textbox", { name: "Page Markdown" })).not.toBeInTheDocument();
  });

  it("ignores an old clipboard failure after the page is replaced", async () => {
    let reject;
    const pending = new Promise((_, fail) => { reject = fail; });
    clipboard({ writeText: vi.fn().mockReturnValue(pending) });
    const old = render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Page" }));
    expect(screen.getByRole("button", { name: "Copy Page" })).toBeDisabled();
    old.unmount();
    clipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: false }} />);
    await act(async () => reject(new Error("Old permission failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Page" })).toBeEnabled();
  });

  it("keeps the recovery guidance localized", async () => {
    await setLang("zh");
    clipboard(undefined);
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "复制页面" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("无法自动复制此页面"));
    expect(screen.getByRole("textbox", { name: "页面 Markdown" })).toHaveAttribute("readonly");
  });
});
