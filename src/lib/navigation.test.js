import { describe, expect, it, vi } from "vitest";
import { pathFromScreen, screenFromPath, screenLinkProps } from "./navigation.js";

function fakeClick(overrides = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe("screenLinkProps", () => {
  it("routes plain primary clicks through the SPA", () => {
    const go = vi.fn();
    const event = fakeClick();

    screenLinkProps(go, "ledgerShared").onClick(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith("ledgerShared");
  });

  it("preserves browser behavior for modified screen-link clicks", () => {
    const go = vi.fn();
    const event = fakeClick({ ctrlKey: true });

    screenLinkProps(go, "ledgerShared").onClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("preserves browser behavior for non-primary screen-link clicks", () => {
    const go = vi.fn();
    const event = fakeClick({ button: 1 });

    screenLinkProps(go, "ledgerShared").onClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it.each([
    ["primary", "onClick", {}],
    ["Ctrl", "onClick", { ctrlKey: true }],
    ["Command", "onClick", { metaKey: true }],
    ["Shift", "onClick", { shiftKey: true }],
    ["Alt", "onClick", { altKey: true }],
    ["middle", "onAuxClick", { button: 1 }],
    ["Enter", "onKeyDown", { key: "Enter" }],
    ["Space", "onKeyDown", { key: " " }],
  ])("blocks disabled navigation for %s activation", (_label, handler, overrides) => {
    const go = vi.fn();
    const props = screenLinkProps(go, "ledgerProject", { id: "p1" }, true);
    const event = fakeClick(overrides);

    expect(props).not.toHaveProperty("href");
    expect(props).toMatchObject({ role: "link", "aria-disabled": true, tabIndex: -1 });
    props[handler](event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
  });

  it("keeps ordinary link props unchanged when navigation is enabled", () => {
    const go = vi.fn();
    const props = screenLinkProps(go, "ledgerProject", { id: "p1" }, false);

    expect(props.href).toBe("/projects/p1");
    expect(props).not.toHaveProperty("role");
    expect(props).not.toHaveProperty("aria-disabled");
    expect(props).not.toHaveProperty("tabIndex");
    expect(props).not.toHaveProperty("onAuxClick");
    props.onClick(fakeClick({ detail: 0 }));

    expect(go).toHaveBeenCalledWith("ledgerProject", { id: "p1" });
  });

  it.each([
    { detail: 1, selectedInside: true, navigates: false },
    { detail: 0, selectedInside: true, navigates: true },
    { detail: 1, selectedInside: false, navigates: true },
  ])("preserves text selection without blocking ordinary activation: %j", (scenario) => {
    const link = document.createElement("a");
    const other = document.createElement("p");
    link.textContent = "Project name";
    other.textContent = "Other readable content";
    document.body.append(link, other);
    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(scenario.selectedInside ? link : other);
    selection.removeAllRanges();
    selection.addRange(range);
    try {
      const go = vi.fn();
      const event = fakeClick({ detail: scenario.detail, currentTarget: link });
      screenLinkProps(go, "ledgerProject", { id: "p1" }).onClick(event);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(go).toHaveBeenCalledTimes(scenario.navigates ? 1 : 0);
      expect(selection.toString()).toBe(
        scenario.selectedInside ? link.textContent : other.textContent
      );
    } finally {
      selection.removeAllRanges();
      link.remove();
      other.remove();
    }
  });
});

describe("admin routes", () => {
  it("does not expose the workers admin screen from the public web app", () => {
    expect(screenFromPath("/workers")).toBeNull();
    expect(pathFromScreen("workers")).toBe("/404");
  });
});

describe("dashboard routes", () => {
  it("has a dedicated spending overview path", () => {
    expect(pathFromScreen("ledgerOverview")).toBe("/overview");
    expect(screenFromPath("/overview")).toBe("ledgerOverview");
  });
  it("uses dashboard overview as the canonical dashboard path", () => {
    expect(pathFromScreen("ledgerProjects")).toBe("/projects");
    expect(screenFromPath("/projects")).toBe("ledgerProjects");
    expect(screenFromPath("/dashboard")).toBeNull();
  });

  it("does not expose private worker management", () => {
    expect(pathFromScreen("privateWorkers")).toBe("/404");
    expect(screenFromPath("/private-workers")).toBeNull();
  });
});

describe("developer docs routes", () => {
  it("uses developer docs as the canonical Docs path", () => {
    expect(pathFromScreen("docs")).toBe("/developers/docs");
    expect(screenFromPath("/developers/docs")).toBe("docs");
  });
});

describe("removed public routes", () => {
  it("does not expose the former Security page", () => {
    expect(screenFromPath("/security")).toBeNull();
    expect(pathFromScreen("security")).toBe("/404");
  });
});

describe("retired scan routes", () => {
  it("does not route full-repository scan or issue URLs", () => {
    for (const name of ["scanning", "history", "issues", "issue"]) {
      expect(pathFromScreen(name)).toBe("/404");
    }
    for (const path of ["/scanning", "/scanning/scan-1", "/history", "/issues", "/issues/f_1"]) {
      expect(screenFromPath(path)).toBeNull();
    }
  });
});
