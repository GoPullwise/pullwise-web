import { describe, expect, it } from "vitest";
import {
  formatLedgerTotal,
  inclusiveRange,
  localMonth,
  monthRange,
  summaryCurrencies,
} from "./ledger-summary.js";

describe("ledger summary", () => {
  it("uses aggregate project totals exactly once, including money above the Number limit", () => {
    const report = {
      groups: [
        { target: "account", currency: "USD", amountMinor: "18014398509481983" },
        { target: "project", currency: "USD", amountMinor: "18014398509481982" },
        {
          target: "project",
          projectId: "prj_1",
          currency: "USD",
          amountMinor: "18014398509481982",
        },
        { target: "shared", currency: "USD", amountMinor: 1 },
        { target: "account", currency: "JPY", amountMinor: 7 },
        { target: "shared", currency: "JPY", amountMinor: 7 },
      ],
    };
    const rows = summaryCurrencies(report);
    expect(
      rows.map(({ currency, account, project, shared }) => ({ currency, account, project, shared }))
    ).toEqual([
      { currency: "JPY", account: 7n, project: 0n, shared: 7n },
      { currency: "USD", account: 18014398509481983n, project: 18014398509481982n, shared: 1n },
    ]);
    expect(formatLedgerTotal({ currency: "USD", amountMinor: "18014398509481983" })).toBe(
      "USD 180,143,985,094,819.83"
    );
    expect(formatLedgerTotal({ currency: "JPY", amountMinor: 7 })).toBe("JPY 7");
  });

  it.each([
    ["MGA", "1234", "MGA 12.34"],
    ["AFN", "1234", "AFN 12.34"],
    ["ALL", "1234", "ALL 12.34"],
    ["IRR", "1234", "IRR 12.34"],
    ["IQD", "1234", "IQD 1.234"],
    ["CLF", "1234", "CLF 0.1234"],
    ["UYW", "1234", "UYW 0.1234"],
    ["JPY", "1234", "JPY 1,234"],
    ["IQD", "18014398509481983", "IQD 18,014,398,509,481.983"],
  ])("uses Server minor units rather than browser currency tables for %s", (currency, amountMinor, expected) => {
    expect(formatLedgerTotal({ currency, amountMinor })).toBe(expected);
  });

  it.each([
    undefined,
    {},
    { groups: null },
    { groups: [{ target: "account", currency: "USD", amountMinor: 9007199254740992 }] },
    { groups: [{ target: "account", currency: "USD", amountMinor: 1 }] },
    { groups: [{ target: "shared", currency: "USD", amountMinor: 1 }] },
    {
      groups: [
        { target: "account", currency: "USD", amountMinor: 0 },
        { target: "account", currency: "USD", amountMinor: 0 },
      ],
    },
  ])("does not turn malformed or inconsistent summaries into successful zero: %j", (report) => {
    expect(summaryCurrencies(report)).toBeNull();
  });

  it("distinguishes empty and genuine zero summaries", () => {
    expect(summaryCurrencies({ groups: [] })).toEqual([]);
    const rows = summaryCurrencies({
      groups: [
        { target: "account", currency: "USD", amountMinor: 0 },
        { target: "shared", currency: "USD", amountMinor: 0 },
      ],
    });
    expect(rows[0].account).toBe(0n);
  });

  it("uses the user's local calendar month and handles month/year/leap-day boundaries", () => {
    expect(localMonth({ getFullYear: () => 2026, getMonth: () => 9 })).toBe("2026-10");
    expect(monthRange("2026-12")).toEqual({
      from: "2026-12-01",
      to: "2027-01-01",
      end: "2026-12-31",
    });
    expect(monthRange("2028-02")).toEqual({
      from: "2028-02-01",
      to: "2028-03-01",
      end: "2028-02-29",
    });
    expect(inclusiveRange("2028-02-29", "2028-02-29")).toEqual({
      from: "2028-02-29",
      to: "2028-03-01",
      end: "2028-02-29",
    });
  });

  it.each(["9999-12", "2026-13", "0000-01", "2026-2", ""])(
    "rejects an invalid or overflowing month: %s",
    (month) => {
      expect(monthRange(month)).toBeNull();
    }
  );

  it.each([
    ["2026-10-02", "2026-10-01"],
    ["2026-02-29", "2026-03-01"],
    ["9999-12-30", "9999-12-31"],
    ["", "2026-10-01"],
  ])("rejects an invalid or overflowing inclusive range: %s / %s", (from, to) => {
    expect(inclusiveRange(from, to)).toBeNull();
  });
});
