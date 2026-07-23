import { renderSeoHead, seoMetadataForPath } from "./seo.js";

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

  document.head.querySelectorAll('[data-seo-managed="true"]').forEach((node) => node.remove());
  document.head.insertAdjacentHTML("beforeend", renderSeoHead(metadata));
  document.documentElement.lang = HTML_LANGS[lang] || "en";
  return metadata;
}

function dispatchRouteChange() {
  window.dispatchEvent(new Event("pw-routechange"));
}

for (const method of ["pushState", "replaceState"]) {
  const original = window.history[method];
  window.history[method] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    dispatchRouteChange();
    return result;
  };
}

let scheduled = false;
function scheduleMetadataUpdate() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    applyCurrentSeoMetadata();
  });
}

window.addEventListener("popstate", scheduleMetadataUpdate);
window.addEventListener("pw-routechange", scheduleMetadataUpdate);
window.addEventListener("pw-langchange", scheduleMetadataUpdate);

applyCurrentSeoMetadata();
