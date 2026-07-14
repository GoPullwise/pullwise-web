import { afterEach, describe, expect, it } from "vitest";
import { setLang, T } from "./i18n.jsx";

const COPIED_PROSE = [
  "Repository context evidence",
  "Isolated Codex workers",
  "Sequential reviewer turns",
  "Reject static guesses, ambiguous evidence, missing locations, and findings the validator disproves.",
  "Capturing manifests, tools, and repository context",
];

const METHODOLOGY_PROSE =
  "Pullwise scans the current repository snapshot with isolated Codex full-repository review workers, routes risk tiers, runs sequential reviewer and validator turns, and submits stable reports plus versioned artifacts.";
const ENGLISH_PLACEHOLDER_OVERRIDES = {
  "Validation proof": "Validation evidence",
  "Validating findings and locations": "Reviewing risks and validating findings",
};

describe("production locale catalog", () => {
  afterEach(() => setLang("en"));

  for (const locale of ["zh", "ja", "ko", "fr", "es"]) {
    it(`${locale} does not return copied English methodology prose`, () => {
      setLang(locale);
      for (const english of COPIED_PROSE) {
        expect(T(english), `${locale}: ${english}`).not.toBe(english);
        expect(T(english).trim()).not.toBe("");
      }
      expect(T(METHODOLOGY_PROSE), `${locale}: landing methodology`).not.toBe(
        METHODOLOGY_PROSE
      );
      for (const [english, placeholder] of Object.entries(ENGLISH_PLACEHOLDER_OVERRIDES)) {
        expect(T(english), `${locale}: ${english}`).not.toBe(placeholder);
      }
    });

    it(`${locale} localizes dynamic worker state vocabulary`, () => {
      setLang(locale);
      expect(T("2 queued / 1 running / 1 busy / 3 idle workers")).not.toBe(
        "2 queued / 1 running / 1 busy / 3 idle workers"
      );
    });
  }
});
