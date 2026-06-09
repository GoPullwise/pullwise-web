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
    expect(T("Overview", "总览")).toBe("概要");
    expect(T("Custom", { zh: "自定义", ja: "カスタム", ko: "사용자 지정" })).toBe("カスタム");

    setLang("ko");
    expect(T("Custom", { zh: "自定义", ja: "カスタム", ko: "사용자 지정" })).toBe("사용자 지정");

    setLang("fr");
    expect(T("Custom", { zh: "自定义" })).toBe("Custom");

    setLang("es");
    expect(T("Settings", "设置")).toBe("Configuración");
  });

  it("normalizes legacy Chinese codes and rejects unsupported languages", async () => {
    const { T, setLang, useLang } = await import("./i18n.jsx");

    setLang("zh-CN");
    expect(T("Settings", "设置")).toBe("设置");
    expect(T("Overview", "Overview")).toBe("总览");

    setLang("de");
    expect(T("Settings", "设置")).toBe("Settings");
    expect(typeof useLang).toBe("function");
  });
});
