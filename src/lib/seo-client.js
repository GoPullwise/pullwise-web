import { renderSeoHead, seoMetadataForPath } from "./seo.js";
import "../landing-seo.css";

const HTML_LANGS = {
  en: "en",
  zh: "zh-CN",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  es: "es",
};

function currentLanguage() {
  try {
    return localStorage.getItem("pw-lang") || "en";
  } catch {
    return "en";
  }
}

function currentOrigin() {
  const configured = import.meta.env.VITE_APP_URL;
  return configured || window.location.origin;
}

export function applyCurrentSeoMetadata() {
  const lang = currentLanguage();
  const metadata = seoMetadataForPath(window.location.pathname, {
    lang,
    origin: currentOrigin(),
  });

  document.head.querySelectorAll('title, [data-seo-managed="true"]').forEach((node) => node.remove());
  document.head.insertAdjacentHTML("beforeend", renderSeoHead(metadata));
  document.documentElement.lang = HTML_LANGS[lang] || "en";
  return metadata;
}
