import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleLayout, ConsoleLayoutProvider } from "./console-layout.jsx";

let availableWidth;
let desktop;
let mediaListeners;
let observers;
let capturedPointers;
let captureDescriptors;
let releasePointerCapture;

function DraftField() {
  const [value, setValue] = useState("");
  return (
    <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
  );
}

function layout(route = "projects", id) {
  return (
    <ConsoleLayout key={route}>
      <aside className="side" id={id} data-testid="navigation">
        Projects and account tools
      </aside>
      <main className="main" data-testid="content">
        {route}
        <DraftField />
      </main>
    </ConsoleLayout>
  );
}

function fixture({ scope = "alice", route = "projects" } = {}) {
  return <ConsoleLayoutProvider scope={scope}>{layout(route)}</ConsoleLayoutProvider>;
}

function separator() {
  return screen.getByRole("separator", { name: "Resize navigation" });
}

function currentWidth() {
  return Number(separator().getAttribute("aria-valuenow"));
}

function wrapper() {
  return screen.getByTestId("navigation").parentElement;
}

function resize(width) {
  availableWidth = width;
  act(() => {
    for (const observer of observers) {
      if (observer.targets.size > 0) observer.callback();
    }
  });
}

function setDesktop(matches) {
  desktop = matches;
  act(() => {
    for (const listener of [...mediaListeners]) listener({ matches });
  });
}

beforeEach(() => {
  availableWidth = 1440;
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
        this.pointerId = options.pointerId ?? 1;
        this.isPrimary = options.isPrimary ?? true;
      }
    }
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    width: availableWidth,
    height: 600,
    top: 0,
    left: 0,
    right: availableWidth,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {},
  }));
  captureDescriptors = Object.fromEntries(
    ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
    ])
  );
  releasePointerCapture = vi.fn(function (pointerId) {
    if (capturedPointers.get(this) === pointerId) capturedPointers.delete(this);
  });
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: {
      configurable: true,
      value(pointerId) {
        capturedPointers.set(this, pointerId);
      },
    },
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

describe("ConsoleLayout", () => {
  it("keeps navigation and main as direct children and identifies the controlled sidebar", () => {
    render(fixture());
    const handle = separator();
    const navigation = screen.getByTestId("navigation");
    expect([...wrapper().children]).toEqual([navigation, screen.getByTestId("content"), handle]);
    expect(handle).toHaveAttribute("aria-controls", navigation.id);
    expect(navigation.id).not.toBe("");
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuemin", "180");
    expect(handle).toHaveAttribute("aria-valuemax", "320");
    expect(currentWidth()).toBe(220);
    expect(wrapper().style.getPropertyValue("--console-sidebar-width")).toBe("220px");
  });

  it("preserves an existing sidebar ID", () => {
    render(layout("projects", "existing-navigation"));
    expect(separator()).toHaveAttribute("aria-controls", "existing-navigation");
  });

  it("grows navigation when dragged right and clamps both limits", () => {
    render(fixture());
    const handle = separator();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 220, button: 0 });
    expect(handle).toHaveFocus();
    expect(wrapper()).toHaveClass("is-resizing");
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 1000 });
    expect(currentWidth()).toBe(320);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: -1000 });
    expect(currentWidth()).toBe(180);
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(wrapper()).not.toHaveClass("is-resizing");
  });

  it("uses the same visible direction for arrow keys and supports Home and End", () => {
    render(fixture());
    const handle = separator();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(currentWidth()).toBe(236);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(currentWidth()).toBe(220);
    fireEvent.keyDown(handle, { key: "Home" });
    expect(currentWidth()).toBe(180);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(currentWidth()).toBe(180);
    fireEvent.keyDown(handle, { key: "End" });
    expect(currentWidth()).toBe(320);
  });

  it("protects the main minimum using actual wrapper width, including fractional space", () => {
    availableWidth = 900.75;
    render(fixture());
    expect(separator()).toHaveAttribute("aria-valuemax", "240");
    fireEvent.keyDown(separator(), { key: "End" });
    expect(currentWidth()).toBe(240);
    expect(availableWidth - currentWidth()).toBeGreaterThanOrEqual(660);
    resize(880);
    expect(currentWidth()).toBe(220);
    expect(wrapper().style.getPropertyValue("--console-sidebar-width")).toBe("220px");
  });

  it("shares one tab preference across routes while clamping each layout's available space", () => {
    const view = render(fixture());
    fireEvent.keyDown(separator(), { key: "End" });
    expect(currentWidth()).toBe(320);
    availableWidth = 900;
    view.rerender(fixture({ route: "members" }));
    expect(currentWidth()).toBe(240);
    resize(1440);
    expect(currentWidth()).toBe(320);
    view.rerender(fixture({ route: "settings" }));
    expect(currentWidth()).toBe(320);
  });

  it("clears the preference and an active capture when the signed-in identity changes", () => {
    const view = render(fixture());
    fireEvent.keyDown(separator(), { key: "End" });
    const handle = separator();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 320, button: 0 });
    view.rerender(fixture({ scope: "bob" }));
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(currentWidth()).toBe(220);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 });
    expect(currentWidth()).toBe(220);
    view.rerender(fixture({ scope: "alice" }));
    expect(currentWidth()).toBe(220);
  });

  it("removes the divider below desktop and keeps the draft during viewport changes", () => {
    render(fixture());
    fireEvent.keyDown(separator(), { key: "End" });
    const draft = screen.getByRole("textbox", { name: "Draft" });
    fireEvent.change(draft, { target: { value: "Unsubmitted project" } });
    const handle = separator();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 320, button: 0 });
    setDesktop(false);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(wrapper().style.getPropertyValue("--console-sidebar-width")).toBe("");
    expect(capturedPointers.has(handle)).toBe(false);
    resize(900);
    setDesktop(true);
    expect(currentWidth()).toBe(240);
    expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
    expect(draft).toHaveValue("Unsubmitted project");
  });

  it("starts below desktop with the existing navigation and no width override", () => {
    desktop = false;
    render(fixture());
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(wrapper().style.getPropertyValue("--console-sidebar-width")).toBe("");
    expect(screen.getByTestId("navigation")).toBeVisible();
  });

  it("cancels capture on actual container resize and disposes it on route replacement", () => {
    const view = render(fixture());
    let handle = separator();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 220, button: 0 });
    resize(900);
    expect(capturedPointers.has(handle)).toBe(false);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 900 });
    expect(currentWidth()).toBe(220);
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 220, button: 0 });
    view.rerender(fixture({ route: "billing" }));
    expect(capturedPointers.has(handle)).toBe(false);
    handle = separator();
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 220, button: 0 });
    view.unmount();
    expect(capturedPointers.has(handle)).toBe(false);
    expect(mediaListeners.size).toBe(0);
    expect(observers.every((observer) => observer.targets.size === 0)).toBe(true);
  });
});
