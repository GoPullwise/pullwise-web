import { describe, expect, it, vi } from "vitest";
import {
  pathFromScreen,
  screenFromPath,
  screenLinkProps,
} from "./navigation.js";

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

    screenLinkProps(go, "services").onClick(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith("services");
  });

  it("preserves browser behavior for modified screen-link clicks", () => {
    const go = vi.fn();
    const event = fakeClick({ ctrlKey: true });

    screenLinkProps(go, "services").onClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("preserves browser behavior for non-primary screen-link clicks", () => {
    const go = vi.fn();
    const event = fakeClick({ button: 1 });

    screenLinkProps(go, "services").onClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });
});

describe("admin routes", () => {
  it("does not expose the workers admin screen from the public web app", () => {
    expect(screenFromPath("/workers")).toBeNull();
    expect(pathFromScreen("workers")).toBe("/404");
  });
});

describe("dashboard routes", () => {
  it("uses dashboard overview as the canonical dashboard path", () => {
    expect(pathFromScreen("dashboard")).toBe("/dashboard/overview");
    expect(screenFromPath("/dashboard/overview")).toBe("dashboard");
    expect(screenFromPath("/dashboard")).toBe("dashboard");
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
