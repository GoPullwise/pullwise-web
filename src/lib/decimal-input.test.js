import { describe, expect, it } from "vitest";
import { normalizeDecimalInput } from "./decimal-input.js";

describe("exact decimal input", () => {
  it.each([
    ["12,50", "12.50"],
    ["12,5", "12.5"],
    ["0,00", "0.00"],
    ["1234,50", "1234.50"],
    [" 12,50 ", "12.50"],
    ["9007199254740993,25", "9007199254740993.25"],
    ["0", "0"],
    ["12.00", "12.00"],
    ["0.00000012345678901234567890", "0.00000012345678901234567890"],
    ["9007199254740993.000000000000000001", "9007199254740993.000000000000000001"],
  ])("preserves all digits in %s", (input, expected) => {
    expect(normalizeDecimalInput(input)).toBe(expected);
  });

  it.each([
    "1,234", "12,000", "0,123", "1234,567", "12,5000", "1,234,567",
    "1,234.50", "1.234,50", "1 234,50", "1\u00a0234,50", "1\u202f234,50",
    "1'234.50", "1_234.50", "1e3", "-12.50", "+12.50", "01.50", "01,50",
    "12.", "12,", ".50", ",50", "", " ", "NaN", "Infinity", null, 12.5,
  ])("rejects ambiguous grouping or invalid input %s", (input) => {
    expect(normalizeDecimalInput(input)).toBeNull();
  });
});
