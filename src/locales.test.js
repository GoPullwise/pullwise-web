import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setLang, T } from "./i18n.jsx";
import { API_KEY_SCOPES } from "./screens/ledger-api-scopes.js";
import { PHRASES as ZH_PHRASES } from "./locales/zh.js";
import { PHRASES as JA_PHRASES } from "./locales/ja.js";
import { PHRASES as KO_PHRASES } from "./locales/ko.js";
import { PHRASES as FR_PHRASES } from "./locales/fr.js";
import { PHRASES as ES_PHRASES } from "./locales/es.js";
import { LEDGER_PHRASES } from "./locales/ledger.js";
import { LEDGER_LONG_PHRASES } from "./locales/ledger-longform.js";
import { LEDGER_UI_PHRASES } from "./locales/ledger-ui.js";
import { LEDGER_SCREEN_PHRASES } from "./locales/ledger-screen.js";
import { LEDGER_SCOPE_PHRASES } from "./locales/ledger-scopes.js";

const BASE_PHRASES = { zh: ZH_PHRASES, ja: JA_PHRASES, ko: KO_PHRASES, fr: FR_PHRASES, es: ES_PHRASES };
const SOURCE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const sources = ["screens", "components"].flatMap((directory) => {
  const directoryPath = join(SOURCE_DIRECTORY, directory);
  return readdirSync(directoryPath)
    .filter((name) => /\.(js|jsx)$/.test(name) && !name.includes(".test."))
    .map((name) => readFileSync(join(directoryPath, name), "utf8"));
}).concat(["App.jsx", "shell.jsx"].map((name) => readFileSync(join(SOURCE_DIRECTORY, name), "utf8")));
// Cover literal copy used by current screens; interpolated provider/user data
// keeps its deliberate English fallback and is exercised separately below.
const CURRENT_COPY = [...new Set(sources.flatMap((source) =>
  [...source.matchAll(/\bT\(\s*("(?:\\.|[^"\\])*")/g)].map((match) => JSON.parse(match[1]))))];

const LEDGER_COPY = [
  "Projects", "Shared expense pool", "Ledger overview", "Totals by currency",
  "From date", "Export CSV", "Automatic", "Save expense", "Automatic Max assistance",
  "Jev categorized this expense", "This expense may duplicate an existing entry. Review your records.",
  "Choose a category to finish saving. Your draft is still here.",
  "Automatic Jev assistance when saving expenses", "Automatic categorization and expense advice · Web + REST API",
  "Annual subscriptions keep the same monthly Jev budget", "Monthly UTC budget · no rollover",
  "Awaiting payment confirmation", "Subscription confirmed", "Refresh billing", "less per year",
  "Your recorded expenses remain available when GitHub access changes.",
  "Project expense tracking for developers and teams", "Record project and shared expenses.",
  "No repositories linked", "Jev assistance allowance",
];

describe("ledger locale copy", () => {
  afterEach(() => setLang("en"));
  for (const locale of ["zh", "ja", "ko", "fr", "es"]) {
    it(`${locale} translates core ledger navigation and actions`, async () => {
      await setLang(locale);
      for (const english of LEDGER_COPY) {
        expect(T(english), `${locale}: ${english}`).not.toBe(english);
        expect(T(english).trim()).not.toBe("");
      }
    });
    it(`${locale} covers current screen, documentation and legal source keys`, async () => {
      await setLang(locale);
      const phrases = { ...BASE_PHRASES[locale], ...LEDGER_PHRASES[locale],
        ...LEDGER_LONG_PHRASES[locale], ...LEDGER_UI_PHRASES[locale],
        ...LEDGER_SCOPE_PHRASES[locale], ...LEDGER_SCREEN_PHRASES[locale] };
      for (const english of [...CURRENT_COPY, ...API_KEY_SCOPES.flatMap(scope => [scope.labelEn, scope.descEn])]) {
        expect(Object.hasOwn(phrases, english), `${locale}: ${english}`).toBe(true);
        const translated = phrases[english];
        expect(translated.trim(), `${locale}: ${english}`).not.toBe("");
        expect(T(english)).toBe(translated);
      }
      expect(T("Contact contact@pull-wise.com with privacy or security questions.")).not.toMatch(/^Contact /);
      expect(T("For questions, contact contact@pull-wise.com.")).not.toMatch(/^For questions/);
      const rights = T("Contact privacy@example.com to request access, export, correction or deletion of account data. We may verify your identity and consider applicable law and other ledger members' rights before acting. You can export authorized expenses as CSV, manage members and GitHub access according to your permissions, and revoke your API keys in the product.");
      expect(rights).not.toMatch(/^Contact /);
      expect(rights).toContain("privacy@example.com");
    });
  }
});
