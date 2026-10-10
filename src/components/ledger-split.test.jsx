import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LedgerSplit } from "./ledger-split.jsx";
import { installAnimationFrameMock } from "../test/animation-frame.js";

let availableWidth;
let desktop;
let mediaListeners;
let observers;
let capturedPointers;
let setPointerCapture;
let releasePointerCapture;
let captureDescriptors;
let frames;

function DraftField() {
  const [draft, setDraft] = useState("");
  return (
    <>
      <label htmlFor="project-note">Project note</label>
      <input id="project-note" value={draft} onChange={(event) => setDraft(event.target.value)} />
    </>
  );
}

function fixture(props = {}) {
  return (
    <LedgerSplit {...props}>
      <section className="panel" data-testid="primary-panel">
        <DraftField />
      </section>
      <aside className="panel" data-testid="side-panel">
        Create project
      </aside>
      <section className="panel ledger-overview" data-testid="overview-panel">
        Spending overview
      </section>
    </LedgerSplit>
  );
}

function show(props = {}) {
  return render(fixture(props));
}

function split() {
  return screen.getByTestId("primary-panel").parentElement;
}

function separator() {
  return screen.getByRole("separator", { name: "Resize side panel" });
}

function currentWidth() {
  return Number(separator().getAttribute("aria-valuenow"));
}

function resize(width) {
  availableWidth = width;
  act(() => {
    for (const observer of observers) {
      const entries = [...observer.targets].map((target) => ({
        target,
        contentRect: target.getBoundingClientRect(),
        borderBoxSize: [{ inlineSize: width, blockSize: 500 }],
      }));
      if (entries.length > 0) observer.callback(entries, observer);
    }
    frames.flush();
  });
}

function setDesktop(matches) {
  desktop = matches;
  act(() => {
    for (const listener of [...mediaListeners]) {
      listener({ matches, media: "(min-width: 900px)" });
    }
  });
}

function beginDrag(clientX = 600, pointerId = 7) {
  const handle = separator();
  fireEvent.pointerDown(handle, { pointerId, clientX, button: 0 });
  return handle;
}

function dragTo(clientX, pointerId = 7) {
  fireEvent.pointerMove(separator(), { pointerId, clientX });
}

beforeEach(() => {
  frames = installAnimationFrameMock();
  availableWidth = 1000;
  desktop = true;
  mediaListeners = new Set();
  observers = [];
  capturedPointers = new Map();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query) => ({
      get matches() {
        return desktop;
      },
      media: query,
      addEventListener: (_type, listener) => mediaListeners.add(listener),
      removeEventListener: (_type, listener) => mediaListeners.delete(listener),
      addListener: (listener) => mediaListeners.add(listener),
      removeListener: (listener) => mediaListeners.delete(listener),
    }))
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        this.callback = callback;
        this.targets = new Set();
        observers.push(this);
      }

      observe(target) {
        this.targets.add(target);
      }

      unobserve(target) {
        this.targets.delete(target);
      }

      disconnect() {
        this.targets.clear();
      }
    }
  );
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      constructor(type, options = {}) {
        super(type, options);
        this.pointerId = options.pointerId ?? 7;
        this.pointerType = options.pointerType ?? "mouse";
        this.isPrimary = options.isPrimary ?? true;
      }
    }
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    width: availableWidth,
    height: 500,
    top: 0,
    left: 0,
    right: availableWidth,
    bottom: 500,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
  setPointerCapture = vi.fn(function (pointerId) {
    capturedPointers.set(this, pointerId);
  });
  releasePointerCapture = vi.fn(function (pointerId) {
    if (capturedPointers.get(this) === pointerId) capturedPointers.delete(this);
  });
  captureDescriptors = Object.fromEntries(
    ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
    ])
  );
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: { configurable: true, value: setPointerCapture },
    releasePointerCapture: { configurable: true, value: releasePointerCapture },
    hasPointerCapture: {
      configurable: true,
      value(pointerId) {
        return capturedPointers.get(this) === pointerId;
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of Object.entries(captureDescriptors)) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    else delete HTMLElement.prototype[name];
  }
});

describe("LedgerSplit", () => {
  it("preserves direct panel order and exposes a named vertical separator after the content", () => {
    show({ className: "ledger-entry", label: "Resize side panel" });
    const wrapper = split();
    const handle = separator();
    expect(wrapper).toHaveClass("ledger-split", "ledger-entry");
    expect([...wrapper.children]).toEqual([
      screen.getByTestId("primary-panel"),
      screen.getByTestId("side-panel"),
      screen.getByTestId("overview-panel"),
      handle,
    ]);
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuemin", "260");
    expect(handle).toHaveAttribute("aria-valuemax", "520");
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(wrapper.style.getPropertyValue("--ledger-side-width")).toBe(`${currentWidth()}px`);
  });

  it("drags the side panel within its bounds and leaves at least 280px for the primary panel", () => {
    show();
    const handle = beginDrag();
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    dragTo(-500);
    expect(currentWidth()).toBe(520);
    dragTo(1500);
    expect(currentWidth()).toBe(260);
    fireEvent.pointerUp(handle, { pointerId: 7, clientX: 1500 });
    expect(releasePointerCapture).toHaveBeenCalledWith(7);

    resize(700);
    expect(separator()).toHaveAttribute("aria-valuemax", "372");
    beginDrag();
    dragTo(-500);
    expect(currentWidth()).toBe(372);
    expect(700 - currentWidth() - 48).toBe(280);
    expect(split().style.getPropertyValue("--ledger-side-width")).toBe("372px");
  });

  it("supports keyboard resizing in the same direction as the visible divider", () => {
    show();
    const initial = currentWidth();
    const handle = separator();
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(currentWidth()).toBe(initial + 16);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(currentWidth()).toBe(initial);
    fireEvent.keyDown(handle, { key: "Home" });
    expect(currentWidth()).toBe(260);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(currentWidth()).toBe(260);
    fireEvent.keyDown(handle, { key: "End" });
    expect(currentWidth()).toBe(520);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(currentWidth()).toBe(520);
    expect(handle).toHaveFocus();
  });

  it("clamps a requested width when the actual module narrows", () => {
    show();
    fireEvent.keyDown(separator(), { key: "End" });
    resize(700);
    expect(currentWidth()).toBe(372);
    expect(separator()).toHaveAttribute("aria-valuemax", "372");
    expect(split().style.getPropertyValue("--ledger-side-width")).toBe("372px");
    resize(620);
    expect(currentWidth()).toBe(292);
    expect(split().style.getPropertyValue("--ledger-side-width")).toBe("292px");
  });

  it("stacks on mobile without an inline column width and restores a safe desktop width", () => {
    show();
    fireEvent.keyDown(separator(), { key: "End" });
    fireEvent.change(screen.getByLabelText("Project note"), {
      target: { value: "Keep this draft" },
    });
    const originalInput = screen.getByLabelText("Project note");
    setDesktop(false);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(split().style.getPropertyValue("--ledger-side-width")).toBe("");
    resize(700);
    setDesktop(true);
    expect(currentWidth()).toBeLessThanOrEqual(372);
    expect(currentWidth()).toBeGreaterThanOrEqual(260);
    expect(split().style.getPropertyValue("--ledger-side-width")).toBe(`${currentWidth()}px`);
    expect(screen.getByLabelText("Project note")).toBe(originalInput);
    expect(originalInput).toHaveValue("Keep this draft");
  });

  it("starts mobile with no separator or width override", () => {
    desktop = false;
    show();
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(split().style.getPropertyValue("--ledger-side-width")).toBe("");
    expect(screen.getByText("Create project")).toBeVisible();
  });

  it("ignores other pointers and stops a captured drag on cancellation", () => {
    show();
    const initial = currentWidth();
    const handle = beginDrag();
    dragTo(400, 8);
    expect(currentWidth()).toBe(initial);
    dragTo(584);
    expect(currentWidth()).toBe(initial + 16);
    fireEvent.pointerCancel(handle, { pointerId: 7 });
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    dragTo(400);
    expect(currentWidth()).toBe(initial + 16);
  });

  it("ends a drag when pointer capture is lost", () => {
    show();
    const handle = beginDrag();
    dragTo(584);
    const width = currentWidth();
    capturedPointers.delete(handle);
    fireEvent.lostPointerCapture(handle, { pointerId: 7 });
    dragTo(400);
    expect(currentWidth()).toBe(width);
  });

  it("keeps the current drag after a different pointer's late lost-capture event", () => {
    show();
    const initial = currentWidth();
    const handle = beginDrag(600, 8);
    fireEvent.lostPointerCapture(handle, { pointerId: 7 });
    dragTo(584, 8);
    expect(currentWidth()).toBe(initial + 16);
    expect(capturedPointers.get(handle)).toBe(8);
  });

  it("ends a captured drag when the module resizes", () => {
    show();
    const handle = beginDrag();
    dragTo(584);
    resize(700);
    const width = currentWidth();
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(capturedPointers.has(handle)).toBe(false);
    dragTo(400);
    expect(currentWidth()).toBe(width);
  });

  it("releases active capture before removing the mobile separator", () => {
    show();
    const handle = beginDrag();
    setDesktop(false);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(capturedPointers.has(handle)).toBe(false);
    setDesktop(true);
    const width = currentWidth();
    dragTo(400);
    expect(currentWidth()).toBe(width);
  });

  it("releases capture and subscriptions when an active split unmounts", () => {
    const view = show();
    const handle = beginDrag();
    view.unmount();
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(capturedPointers.has(handle)).toBe(false);
    expect(mediaListeners.size).toBe(0);
    expect(observers.every((observer) => observer.targets.size === 0)).toBe(true);
  });

  it("resets a changed scope's width while retaining mounted child drafts", () => {
    const view = show({ scope: "ledger-alice" });
    const initial = currentWidth();
    const input = screen.getByLabelText("Project note");
    fireEvent.change(input, { target: { value: "Unsubmitted note" } });
    fireEvent.keyDown(separator(), { key: "End" });
    view.rerender(fixture({ scope: "ledger-bob" }));
    expect(currentWidth()).toBe(initial);
    expect(screen.getByLabelText("Project note")).toBe(input);
    expect(input).toHaveValue("Unsubmitted note");
  });

  it("disables resizing when the module cannot fit both minimum panel widths", () => {
    availableWidth = 588;
    show();
    const handle = separator();
    const width = currentWidth();
    expect(handle).toHaveAttribute("aria-disabled", "true");
    expect(handle).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.pointerDown(handle, { pointerId: 7, clientX: 600, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 300 });
    expect(currentWidth()).toBe(width);
    expect(setPointerCapture).not.toHaveBeenCalled();
    resize(700);
    expect(separator()).not.toHaveAttribute("aria-disabled", "true");
    expect(separator()).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(separator(), { key: "End" });
    expect(currentWidth()).toBe(372);
  });

  it("removes resizing controls when the secondary panel is not enabled", () => {
    show({ enabled: false });
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(split().style.getPropertyValue("--ledger-side-width")).toBe("");
    expect(screen.getByLabelText("Project note")).toBeVisible();
  });

  it("clears an active drag when disabling and reopening the secondary panel", () => {
    const view = show();
    const input = screen.getByLabelText("Project note");
    fireEvent.change(input, { target: { value: "Retain draft" } });
    const handle = beginDrag();
    dragTo(584);
    expect(split()).toHaveClass("is-resizing");
    view.rerender(fixture({ enabled: false }));
    expect(split()).not.toHaveClass("is-resizing");
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(capturedPointers.has(handle)).toBe(false);
    view.rerender(fixture({ enabled: true }));
    expect(split()).not.toHaveClass("is-resizing");
    const width = currentWidth();
    dragTo(400);
    expect(currentWidth()).toBe(width);
    expect(screen.getByLabelText("Project note")).toBe(input);
    expect(input).toHaveValue("Retain draft");
  });

  it("keeps the reported range and rendered width inside fractional available space", () => {
    availableWidth = 700.75;
    show();
    fireEvent.keyDown(separator(), { key: "End" });
    const width = currentWidth();
    const maximum = Number(separator().getAttribute("aria-valuemax"));
    expect(width).toBeLessThanOrEqual(maximum);
    expect(maximum).toBeLessThanOrEqual(availableWidth - 48 - 280);
    expect(Number.parseFloat(split().style.getPropertyValue("--ledger-side-width"))).toBe(width);
  });
});
