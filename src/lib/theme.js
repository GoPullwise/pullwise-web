import { localStorageGet, localStorageSet } from "./browser-storage.js";

export const THEME_STORAGE_KEY = "pw-theme";
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export function readThemePreference() {
  const stored = localStorageGet(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

export function resolveTheme(preference = readThemePreference()) {
  if (preference === "light" || preference === "dark") return preference;
  return globalThis.matchMedia?.(SYSTEM_THEME_QUERY)?.matches ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#080808" : "#f8f7f6");
}

export function saveThemePreference(theme) {
  localStorageSet(THEME_STORAGE_KEY, theme);
}

export function subscribeSystemTheme(listener) {
  const media = globalThis.matchMedia?.(SYSTEM_THEME_QUERY);
  if (!media) return () => {};
  const update = () => listener(media.matches ? "dark" : "light");
  if (media.addEventListener) {
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }
  // Older Safari exposes only the original MediaQueryList listener methods.
  media.addListener?.(update);
  return () => media.removeListener?.(update);
}
