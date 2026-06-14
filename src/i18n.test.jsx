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

  it("supports the expanded language list with object translations and English fallback", async () => {
    const { T, setLang } = await import("./i18n.jsx");

    setLang("ja");
    expect(T("Custom", { zh: "zh-custom", ja: "ja-custom", ko: "ko-custom" })).toBe("ja-custom");

    setLang("ko");
    expect(T("Custom", { zh: "zh-custom", ja: "ja-custom", ko: "ko-custom" })).toBe("ko-custom");

    setLang("fr");
    expect(T("Custom", { zh: "zh-custom" })).toBe("Custom");

    setLang("es");
    expect(T("Custom", { es: "es-custom" })).toBe("es-custom");
  });

  it("rejects unsupported language codes instead of normalizing aliases", async () => {
    const { T, setLang, useLang } = await import("./i18n.jsx");

    setLang("zh-CN");
    expect(T("Settings", "Chinese settings")).toBe("Settings");
    expect(T("Overview", "Overview")).toBe("Overview");

    setLang("de");
    expect(T("Settings", "Chinese settings")).toBe("Settings");
    expect(typeof useLang).toBe("function");
  });
});
