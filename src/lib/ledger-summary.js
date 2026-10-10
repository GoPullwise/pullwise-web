// Match the minor-unit contract in Server cloudflare_ledger_expenses.EXPONENTS.
// Browser Intl currency tables differ for currencies such as MGA and IQD.
const CURRENCY_EXPONENTS = new Map([
  ..."BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV"
    .split(" ")
    .map((currency) => [currency, 0]),
  ..."BHD IQD JOD KWD LYD OMR TND".split(" ").map((currency) => [currency, 3]),
  ["CLF", 4],
  ["UYW", 4],
]);

export function minorAmount(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value);
  return null;
}

export function formatLedgerTotal({ currency, amountMinor }, unavailable = "Unavailable") {
  const minor = minorAmount(amountMinor);
  if (minor === null || typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency))
    return unavailable;
  const exponent = CURRENCY_EXPONENTS.get(currency) ?? 2;
  const scale = 10n ** BigInt(exponent);
  const whole = (minor / scale).toLocaleString("en");
  const fraction = exponent ? `.${(minor % scale).toString().padStart(exponent, "0")}` : "";
  return `${currency} ${whole}${fraction}`;
}

// Summary includes per-project rows as well as aggregate rows. Read only the
// aggregate rows; adding every returned row would count project expenses twice.
export function summaryCurrencies(report) {
  if (!Array.isArray(report?.groups)) return null;
  const currencies = new Map();
  for (const group of report.groups) {
    if (!["account", "project", "shared"].includes(group?.target)) return null;
    if (group.projectId !== null && group.projectId !== undefined) continue;
    const amount = minorAmount(group.amountMinor);
    if (amount === null || typeof group.currency !== "string" || !/^[A-Z]{3}$/.test(group.currency))
      return null;
    const currency = currencies.get(group.currency) || {
      currency: group.currency,
      account: null,
      project: 0n,
      shared: 0n,
      seen: new Set(),
    };
    if (currency.seen.has(group.target)) return null;
    currency.seen.add(group.target);
    currency[group.target] = amount;
    currencies.set(group.currency, currency);
  }
  const rows = [...currencies.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency)
  );
  if (report.groups.length > 0 && rows.length === 0) return null;
  if (rows.some((row) => row.account === null || row.account !== row.project + row.shared))
    return null;
  return rows;
}

export function localMonth(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ||
    value < "0001-01-01"
  )
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function monthRange(month) {
  if (
    typeof month !== "string" ||
    !/^[0-9]{4}-[0-9]{2}$/.test(month) ||
    !validDate(`${month}-01`) ||
    month === "9999-12"
  )
    return null;
  const [year, index] = month.split("-").map(Number);
  const next =
    index === 12
      ? `${String(year + 1).padStart(4, "0")}-01`
      : `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
  const to = `${next}-01`;
  const last = new Date(`${to}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 1);
  return { from: `${month}-01`, to, end: last.toISOString().slice(0, 10) };
}

export function inclusiveRange(from, end) {
  if (!validDate(from) || !validDate(end) || from > end || end === "9999-12-31") return null;
  const to = new Date(`${end}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, end, to: to.toISOString().slice(0, 10) };
}
