// Keep decimal input as text: converting to Number can round financial values.
// A three-digit comma suffix can be a thousands group, so only accept the
// unambiguous one/two-digit decimal-comma form. Longer fractions use a dot.
export function normalizeDecimalInput(value) {
  if (typeof value !== "string") return null;
  const decimal = value.trim();
  if (/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(decimal)) return decimal;
  if (/^(0|[1-9][0-9]*),[0-9]{1,2}$/.test(decimal)) return decimal.replace(",", ".");
  return null;
}
