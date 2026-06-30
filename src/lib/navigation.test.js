import { describe, expect, it, vi } from "vitest";
import {
  issueIdFromPath,
  pathFromScreen,
  scanIdFromPath,
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

    screenLinkProps(go, "issues").onClick(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith("issues");
  });

  it("preserves browser behavior for modified screen-link clicks", () => {
    const go = vi.fn();
    const event = fakeClick({ ctrlKey: true });

    screenLinkProps(go, "issues").onClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
  });

  it("preserves browser behavior for non-primary screen-link clicks", () => {
    const go = vi.fn();
    const event = fakeClick({ button: 1 });

    screenLinkProps(go, "issues").onClick(event);

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

  it("routes private worker management as an account dashboard tab", () => {
    expect(pathFromScreen("privateWorkers")).toBe("/private-workers");
    expect(screenFromPath("/private-workers")).toBe("privateWorkers");
  });
});

describe("developer docs routes", () => {
  it("uses developer docs as the canonical Docs path", () => {
    expect(pathFromScreen("docs")).toBe("/developers/docs");
    expect(screenFromPath("/developers/docs")).toBe("docs");
  });
});

describe("issue detail routes", () => {
  it("encodes issue identity in the URL so detail pages can reload", () => {
    expect(pathFromScreen("issue", { issueId: "issue/with spaces#1" })).toBe(
      "/issues/issue%2Fwith%20spaces%231"
    );
    expect(screenFromPath("/issues/issue%2Fwith%20spaces%231")).toBe("issue");
    expect(issueIdFromPath("/issues/issue%2Fwith%20spaces%231")).toBe("issue/with spaces#1");
  });
});

describe("scan detail routes", () => {
  it("encodes scan identity in the URL so scan pages can reload", () => {
    expect(pathFromScreen("scanning", { scanId: "scan/with spaces#1" })).toBe(
      "/scanning/scan%2Fwith%20spaces%231"
    );
    expect(pathFromScreen("scanning")).toBe("/scanning");
    expect(screenFromPath("/scanning/scan%2Fwith%20spaces%231")).toBe("scanning");
    expect(scanIdFromPath("/scanning/scan%2Fwith%20spaces%231")).toBe("scan/with spaces#1");
  });
});
