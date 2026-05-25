import { describe, expect, it, vi } from "vitest";
import { screenLinkProps } from "./navigation.js";

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
