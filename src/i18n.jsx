import { useEffect, useReducer } from "react";
import { localStorageGet, localStorageSet } from "./lib/browser-storage.js";

// i18n: tiny inline translations.
// Usage: T("English", "中文") returns the active variant.
// For newer translations, pass T("English", { zh: "中文", ja: "日本語" }).
// Components that need to re-render on lang change call useLang().
//
// Phrase catalogs live in ./locales/<code>.js and are fetched on demand, so an
// English session downloads no translation data at all and every other locale
// downloads only its own. T() stays synchronous: until a catalog resolves it
// falls back to the English source string, then setLang/preloadActiveLocale
// fire "pw-langchange" so useLang() subscribers re-render with real copy.
export const LANGUAGES = [
  { code: "en", label: "English", shortLabel: "EN", nativeLabel: "English" },
  { code: "zh", label: "Chinese", shortLabel: "中", nativeLabel: "中文" },
  { code: "ja", label: "Japanese", shortLabel: "日", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", shortLabel: "한", nativeLabel: "한국어" },
  { code: "fr", label: "French", shortLabel: "FR", nativeLabel: "Français" },
  { code: "es", label: "Spanish", shortLabel: "ES", nativeLabel: "Español" },
];

const LANGUAGE_CODES = new Set(LANGUAGES.map((language) => language.code));

function normalizeLang(nextLang) {
  const code = String(nextLang || "en").trim().toLowerCase();
  return LANGUAGE_CODES.has(code) ? code : "en";
}

let lang = normalizeLang(localStorageGet("pw-lang", "en"));

// Static specifiers keep the locale chunks statically analysable for the bundler.
const LOCALE_LOADERS = {
  zh: () => import("./locales/zh.js"),
  ja: () => import("./locales/ja.js"),
  ko: () => import("./locales/ko.js"),
  fr: () => import("./locales/fr.js"),
  es: () => import("./locales/es.js"),
};

const catalogCache = new Map();
let activePhrases = null;
let activeDynamicRules = null;

function loadCatalog(code) {
  let pending = catalogCache.get(code);
  if (!pending) {
    pending = Promise.all([LOCALE_LOADERS[code](), import("./locales/dynamic.js")])
      .then(([phrases, dynamic]) => ({
        phrases: phrases.PHRASES,
        dynamicRules: dynamic.DYNAMIC_PHRASE_TRANSLATIONS,
      }))
      .catch(() => ({ phrases: null, dynamicRules: null }));
    catalogCache.set(code, pending);
  }
  return pending;
}

async function activateCatalog(code) {
  if (code === "en") {
    activePhrases = null;
    activeDynamicRules = null;
    return;
  }
  const catalog = await loadCatalog(code);
  // A newer setLang may have landed while this was in flight.
  if (lang !== code) return;
  activePhrases = catalog.phrases;
  activeDynamicRules = catalog.dynamicRules;
  notifyLangChange();
}

function notifyLangChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("pw-langchange"));
}

function interpolateDynamicTranslation(template, match, targetLang) {
  if (typeof template === "function") return template(match, targetLang);
  return String(template).replace(/\$(\d+)/g, (_, index) => match[Number(index)] ?? "");
}

function dynamicPhraseTranslation(en, targetLang) {
  if (!activeDynamicRules) return "";
  for (const rule of activeDynamicRules) {
    const match = String(en).match(rule.match);
    if (!match) continue;
    const template = rule.translations?.[targetLang];
    return template ? interpolateDynamicTranslation(template, match, targetLang) : "";
  }
  return "";
}

/** Resolves once the stored locale's catalog is in memory. */
export function preloadActiveLocale() {
  return activateCatalog(lang);
}

export function setLang(nextLang) {
  lang = normalizeLang(nextLang);
  localStorageSet("pw-lang", lang);
  notifyLangChange();
  return activateCatalog(lang);
}

export function T(en, translations) {
  if (lang === "en") return en;

  const phraseTranslation = activePhrases?.[en];
  const dynamicTranslation = dynamicPhraseTranslation(en, lang);

  if (translations && typeof translations === "object" && !Array.isArray(translations)) {
    return translations[lang] || translations.en || phraseTranslation || dynamicTranslation || en;
  }

  if (lang === "zh" && translations) {
    return translations === en ? phraseTranslation || dynamicTranslation || translations : translations;
  }

  return phraseTranslation || dynamicTranslation || en;
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
