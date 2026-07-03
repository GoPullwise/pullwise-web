import { T } from "../i18n.jsx";

function clampProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

const INCOMPLETE_TERMINAL_SCAN_PROGRESS_MAX = 94;

function presentationProgress(status, value) {
  const percent = clampProgress(value);
  if (status === "done") return 100;
  if (["failed", "cancelled", "lost"].includes(status)) {
    return Math.min(percent, INCOMPLETE_TERMINAL_SCAN_PROGRESS_MAX);
  }
  return percent;
}

export function scanProgressPresentation(scan, { label = "" } = {}) {
  const status = String(scan?.status || "").toLowerCase();
  const percent = presentationProgress(status, scan?.progress);
  if (status === "done") {
    return {
      progress: 100,
      label: label || T("Scan complete", "扫描完成"),
      valueLabel: "100%",
      ariaValueText: T("Scan complete", "扫描完成"),
    };
  }
  if (status === "failed") {
    return {
      progress: percent,
      label: label || T("Progress before failure", "失败前进度"),
      valueLabel: T(`Failed at ${percent}%`, `失败时 ${percent}%`),
      ariaValueText: T(`Scan failed at ${percent}%`, `扫描在 ${percent}% 时失败`),
    };
  }
  if (status === "cancelled") {
    return {
      progress: percent,
      label: label || T("Progress before cancellation", "取消前进度"),
      valueLabel: T(`Cancelled at ${percent}%`, `取消时 ${percent}%`),
      ariaValueText: T(`Scan cancelled at ${percent}%`, `扫描在 ${percent}% 时取消`),
    };
  }
  if (status === "lost") {
    return {
      progress: percent,
      label: label || T("Last reported progress", "最后上报进度"),
      valueLabel: T(`Last seen at ${percent}%`, `最后为 ${percent}%`),
      ariaValueText: T(`Last reported progress was ${percent}%`, `最后上报进度为 ${percent}%`),
    };
  }
  return {
    progress: percent,
    label: label || T("Estimated completion", "预计完成度"),
    valueLabel: `${percent}%`,
    ariaValueText: T(`Estimated completion ${percent}%`, `预计完成度 ${percent}%`),
  };
}

export function ScanProgressBar({
  progress = 0,
  label = "",
  message = "",
  meta = "",
  valueLabel = "",
  ariaValueText = "",
  compact = false,
  barOnly = false,
  className = "",
}) {
  const percent = clampProgress(progress);
  const title = label || T("Scan progress", "扫描进度");
  const displayValue = valueLabel || `${percent}%`;
  const valueText = ariaValueText || displayValue;
  const rootClass = ["scan-progress", compact ? "scan-progress-compact" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={rootClass}
      role="progressbar"
      aria-label={title}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
    >
      {!barOnly && (
        <div className="scan-progress-head">
          <span className="scan-progress-label">{title}</span>
          <span className="scan-progress-value">{displayValue}</span>
        </div>
      )}
      {!barOnly && message && <div className="scan-progress-message">{message}</div>}
      {!barOnly && meta && <div className="scan-progress-meta">{meta}</div>}
      <div className="scan-progress-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
