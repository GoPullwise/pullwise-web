import { T } from "../i18n.jsx";

function clampProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function ScanProgressBar({
  progress = 0,
  label = "",
  message = "",
  meta = "",
  compact = false,
  className = "",
}) {
  const percent = clampProgress(progress);
  const title = label || T("Scan progress", "扫描进度");
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
    >
      <div className="scan-progress-head">
        <span className="scan-progress-label">{title}</span>
        <span className="scan-progress-value">{percent}%</span>
      </div>
      {message && <div className="scan-progress-message">{message}</div>}
      {meta && <div className="scan-progress-meta">{meta}</div>}
      <div className="scan-progress-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}