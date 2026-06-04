function twoDigits(value) {
  return String(value).padStart(2, "0");
}

export function formatQuotaResetAt(value) {
  if (typeof value === "boolean") return "";
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const date = new Date(Math.trunc(seconds) * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  return [
    `${date.getUTCFullYear()}-${twoDigits(date.getUTCMonth() + 1)}-${twoDigits(date.getUTCDate())}`,
    `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`,
    "UTC",
  ].join(" ");
}

export function quotaResetText(quota, prefix = "resets") {
  const formatted = formatQuotaResetAt(quota?.resetAt ?? quota?.reset_at);
  return formatted ? `${prefix} ${formatted}` : "";
}
