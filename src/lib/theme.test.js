import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  subscribeSystemTheme,
  SYSTEM_THEME_QUERY,
} from "./theme.js";

const html = readFileSync("index.html", "utf8");
const bootstrap = html.match(/<script id="pw-theme-bootstrap">([\s\S]*?)<\/script>/)[1];

beforeEach(() => {
  localStorage.removeItem("pw-theme");
  document.head.insertAdjacentHTML("beforeend", '<meta name="theme-color" content="initial">');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem("pw-theme");
  document.querySelector('meta[name="theme-color"]')?.remove();
  document.documentElement.removeAttribute("data-theme");
});

function systemPreference(dark) {
  const media = {
    matches: dark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media)
  );
  return media;
}

describe("theme selection before and after React starts", () => {
  it.each([
    [null, false, "light"],
    [null, true, "dark"],
    ["invalid", true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
  ])(
    "resolves stored %s and system dark=%s to %s without saving a default",
    (stored, dark, expected) => {
      if (stored !== null) localStorage.setItem("pw-theme", stored);
      systemPreference(dark);
      const save = vi.spyOn(Storage.prototype, "setItem");
      expect(resolveTheme()).toBe(expected);
      applyTheme(resolveTheme());
      expect(document.documentElement).toHaveAttribute("data-theme", expected);
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        expected === "dark" ? "#080808" : "#f8f7f6"
      );
      new Function(bootstrap)();
      expect(document.documentElement).toHaveAttribute("data-theme", expected);
      expect(save).not.toHaveBeenCalled();
    }
  );

  it("follows the system when local storage is blocked and tolerates saving a user choice", () => {
    systemPreference(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(readThemePreference()).toBeNull();
    expect(resolveTheme()).toBe("dark");
    expect(() => new Function(bootstrap)()).not.toThrow();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(() => saveThemePreference("light")).not.toThrow();
  });

  it("uses light when color-scheme detection is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(resolveTheme()).toBe("light");
    new Function(bootstrap)();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(() => subscribeSystemTheme(vi.fn())()).not.toThrow();
  });

  it("subscribes to system changes and releases the exact listener", () => {
    const media = systemPreference(false);
    const listener = vi.fn();
    const stop = subscribeSystemTheme(listener);
    expect(matchMedia).toHaveBeenCalledWith(SYSTEM_THEME_QUERY);
    const update = media.addEventListener.mock.calls[0][1];
    media.matches = true;
    update();
    expect(listener).toHaveBeenCalledWith("dark");
    stop();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", update);
  });

  it("supports legacy Safari media listeners", () => {
    const media = { matches: true, addListener: vi.fn(), removeListener: vi.fn() };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media)
    );
    const listener = vi.fn();
    const stop = subscribeSystemTheme(listener);
    const update = media.addListener.mock.calls[0][0];
    update();
    expect(listener).toHaveBeenCalledWith("dark");
    stop();
    expect(media.removeListener).toHaveBeenCalledWith(update);
  });
});
