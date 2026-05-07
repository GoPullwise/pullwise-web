// i18n: tiny inline translations.
// Usage: T("English", "中文") returns the active variant.
// Components that need to re-render on lang change call useLang().
(function () {
  window.LANG = window.LANG || localStorage.getItem("pw-lang") || "en";

  window.setLang = function (l) {
    window.LANG = l;
    localStorage.setItem("pw-lang", l);
    window.dispatchEvent(new Event("pw-langchange"));
  };

  window.T = function (en, zh) {
    return window.LANG === "zh" ? zh : en;
  };

  window.useLang = function () {
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => {
      const h = () => force();
      window.addEventListener("pw-langchange", h);
      return () => window.removeEventListener("pw-langchange", h);
    }, []);
    return window.LANG;
  };
})();
