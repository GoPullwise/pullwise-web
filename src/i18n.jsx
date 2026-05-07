import { useEffect, useReducer } from "react";

// i18n: tiny inline translations.
// Usage: T("English", "中文") returns the active variant.
// Components that need to re-render on lang change call useLang().
let lang = localStorage.getItem("pw-lang") || "en";

export function setLang(nextLang) {
  lang = nextLang;
  localStorage.setItem("pw-lang", nextLang);
  window.dispatchEvent(new Event("pw-langchange"));
}

export function T(en, zh) {
  return lang === "zh" ? zh : en;
}

export function useLang() {
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const handler = () => force();
    window.addEventListener("pw-langchange", handler);
    return () => window.removeEventListener("pw-langchange", handler);
  }, []);

  return lang;
}
