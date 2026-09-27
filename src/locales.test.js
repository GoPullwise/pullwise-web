import { afterEach, describe, expect, it } from "vitest";
import { setLang, T } from "./i18n.jsx";

const LEDGER_COPY = [
  "Projects", "Shared expense pool", "Account overview", "Totals by currency",
  "From date", "Export CSV", "Request suggestion", "Save expense",
  "Track expenses for each GitHub repository.",
  "Your recorded expenses remain available when GitHub access changes.",
  "Project expenses for GitHub teams", "Record project and shared expenses.",
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
  }
});
