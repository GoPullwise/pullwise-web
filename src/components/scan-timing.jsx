import { T } from "../i18n.jsx";

const TERMINAL_STATUSES = new Set(["done", "failed", "cancelled", "partial_completed", "lost"]);

function timestampMilliseconds(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value >= 1_000_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim()) {
    if (/^\d+$/.test(value.trim())) return timestampMilliseconds(Number(value));
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function scanDurationMs(scan) {
  for (const value of [
    scan?.durationMs,
    scan?.reviewRun?.durationMs,
    scan?.reviewRun?.duration_ms,
  ]) {
    if (value === null || value === undefined || value === "") continue;
    const duration = Number(value);
    if (Number.isFinite(duration) && duration >= 0) return duration;
  }
  const startedAt = timestampMilliseconds(scan?.startedAt ?? scan?.reviewRun?.startedAt);
  const completedAt = timestampMilliseconds(scan?.completedAt ?? scan?.reviewRun?.completedAt);
  return startedAt !== null && completedAt !== null && completedAt >= startedAt
    ? completedAt - startedAt
    : null;
}

function durationText(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "";
  if (durationMs < 60_000) return T("under 1 min", "\u4e0d\u5230 1 \u5206\u949f");
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return T(minutes + " min", minutes + " \u5206\u949f");
}

function estimateRangeText(estimate) {
  const lowerMinutes = Math.max(0, Math.floor(estimate.lowerSeconds / 60));
  const upperMinutes = Math.max(1, Math.ceil(estimate.upperSeconds / 60));
  if (lowerMinutes === 0 && upperMinutes === 1) {
    return T("Less than 1 min remaining", "\u5269\u4f59\u4e0d\u5230 1 \u5206\u949f");
  }
  const displayedLower = Math.max(1, lowerMinutes);
  if (displayedLower === upperMinutes) {
    return T(
      upperMinutes + " min remaining",
      "\u5269\u4f59 " + upperMinutes + " \u5206\u949f"
    );
  }
  return T(
    displayedLower + "\u2013" + upperMinutes + " min remaining",
    "\u5269\u4f59 " + displayedLower + "\u2013" + upperMinutes + " \u5206\u949f"
  );
}

export function scanTimingPresentation(scan) {
  const status = String(scan?.status || "").toLowerCase();
  if (status === "queued") return null;
  if (TERMINAL_STATUSES.has(status)) {
    const elapsed = durationText(scanDurationMs(scan));
    if (!elapsed) return null;
    return {
      kind: "actual",
      label: T("Duration", "\u5b9e\u9645\u8017\u65f6"),
      text:
        status === "done"
          ? T("Completed in " + elapsed, "\u5df2\u5728 " + elapsed + "\u5185\u5b8c\u6210")
          : T("Ran for " + elapsed, "\u5171\u8fd0\u884c " + elapsed),
    };
  }
  if (status !== "running" || !scan?.estimate) return null;
  if (
    scan.estimate.state !== "available" ||
    !Number.isFinite(scan.estimate.lowerSeconds) ||
    !Number.isFinite(scan.estimate.upperSeconds)
  ) {
    return null;
  }
  return {
    kind: "available",
    label: "ETA",
    text: estimateRangeText(scan.estimate),
  };
}

export function ScanTiming({ scan, compact = false, className = "" }) {
  const presentation = scanTimingPresentation(scan);
  if (!presentation) return null;
  const classes = [
    "scan-timing",
    "scan-timing-" + presentation.kind,
    compact ? "scan-timing-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} role="status" aria-live="polite" aria-atomic="true">
      <span className="scan-timing-label">{presentation.label}</span>
      <strong className="scan-timing-value">{presentation.text}</strong>
    </div>
  );
}
