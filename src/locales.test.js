import { afterEach, describe, expect, it } from "vitest";
import { setLang, T } from "./i18n.jsx";
import { API_KEY_SCOPES } from "./screens/ledger-api-scopes.js";
import { LEDGER_LONG_PHRASES } from "./locales/ledger-longform.js";
import { LEDGER_UI_PHRASES } from "./locales/ledger-ui.js";
import { LEDGER_SCREEN_PHRASES } from "./locales/ledger-screen.js";

const LEDGER_COPY = [
  "Projects", "Shared expense pool", "Account overview", "Totals by currency",
  "From date", "Export CSV", "Request suggestion", "Save expense",
  "Track expenses for each GitHub repository.",
  "Your recorded expenses remain available when GitHub access changes.",
  "Project expenses for GitHub teams", "Record project and shared expenses.",
];

const LEDGER_LONG_COPY = [
  "Sign in with GitHub, grant access to a repository, and create a project for it. A project belongs to your Pullwise account and follows the repository ID through renames.",
  "Categories belong to your account and can be used for project or shared expenses. Archived categories remain on historical entries.",
  "Expense lists and reports share target, projectId, categoryId, from (inclusive), to (exclusive) and currency filters. Lists also use limit and cursor. Amounts are decimal strings on writes and minor units in totals. Currencies are never combined.",
  "Pullwise provides a GitHub-connected project expense ledger through the web app and REST API. This policy also covers account, billing and support interactions.",
  "Ledger history remains with your account when GitHub access changes. Removed expenses and suggestion decisions may be retained in audit records. Account, API key, payment and operational records are kept as needed for service, security, tax, audit or legal purposes. Contact us to ask about deletion.",
  "You can cancel renewal for an active subscription from Pullwise Billing. It ends at the current paid period. You can resume renewal from Pullwise Billing before that date. Supported upgrades take effect immediately; Creem calculates any proration. Lower-tier changes or yearly-to-monthly changes are unavailable in the product.",
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
    it(`${locale} translates ledger documentation and legal paragraphs`, async () => {
      await setLang(locale);
      for (const english of [...LEDGER_LONG_COPY, ...Object.keys(LEDGER_LONG_PHRASES[locale]),
        ...Object.keys(LEDGER_UI_PHRASES[locale]),
        ...API_KEY_SCOPES.flatMap(scope => [scope.labelEn, scope.descEn])]) {
        expect(T(english), `${locale}: ${english}`).not.toBe(english);
      }
      for (const [english, translated] of Object.entries(LEDGER_SCREEN_PHRASES[locale])) {
        expect(translated.trim(), `${locale}: ${english}`).not.toBe("");
        expect(T(english)).toBe(translated);
      }
      expect(T("Contact contact@pull-wise.com with privacy or security questions.")).not.toMatch(/^Contact /);
      expect(T("For questions, contact contact@pull-wise.com.")).not.toMatch(/^For questions/);
    });
  }
});
