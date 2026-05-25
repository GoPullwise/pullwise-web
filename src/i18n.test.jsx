import { afterEach, describe, expect, it, vi } from "vitest";

function blockedStorage() {
  return {
    getItem: vi.fn(() => {
      throw new Error("storage blocked");
    }),
    setItem: vi.fn(() => {
      throw new Error("storage blocked");
    }),
  };
}

describe("i18n storage resilience", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("falls back when localStorage is unavailable during import or language changes", async () => {
    vi.stubGlobal("localStorage", blockedStorage());

    const { T, setLang } = await import("./i18n.jsx");

    expect(T("English", "Chinese")).toBe("English");
    expect(() => setLang("zh")).not.toThrow();
    expect(T("English", "Chinese")).toBe("Chinese");
  });
});
