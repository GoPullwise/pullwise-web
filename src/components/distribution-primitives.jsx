// Reusable visualization primitives for distributions derived from
// already-normalized API responses. All components are pure SVG/CSS,
// have no data dependencies, and accept pre-aggregated data so callers
// keep the responsibility of counting/slicing.

import { T } from "../i18n.jsx";

export const SEVERITY_BUCKETS = [
  { key: "critical", color: "var(--sev-critical)" },
  { key: "high", color: "var(--sev-high)" },
  { key: "medium", color: "var(--sev-medium)" },
  { key: "low", color: "var(--sev-low)" },
  { key: "info", color: "var(--sev-info)" },
];

export const VERIFICATION_BUCKETS = [
  { key: "verified", color: "#16a34a" },
  { key: "static_proof", color: "#2563eb" },
  { key: "potential_risk", color: "#ea580c" },
  { key: "unverified", color: "#6b7280" },
];

export const CONFIDENCE_BUCKETS = [
  { key: "high", color: "#16a34a" },
  { key: "medium", color: "#ca8a04" },
  { key: "low", color: "#9ca3af" },
];

function safeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

export function countBy(items, keyFn, bucketKeys) {
  const counts = Object.create(null);
  for (const key of bucketKeys) counts[key] = 0;
  for (const item of items) {
    const key = keyFn(item);
    if (key == null) continue;
    if (counts[key] === undefined) counts[key] = 0;
    counts[key] += 1;
  }
  return counts;
}

// Horizontal stacked bar. `segments` is an array of { color, weight }.
export function StackedBar({ segments, height = 6, radius = 999, className = "" }) {
  const total = segments.reduce((sum, seg) => sum + Math.max(0, seg.weight), 0);
  if (total <= 0) {
    return (
      <div
        className={"disto-bar disto-bar-empty " + className}
        style={{ height, borderRadius: radius }}
      />
    );
  }
  let offset = 0;
  return (
    <div className={"disto-bar " + className} style={{ height, borderRadius: radius }} role="img">
      {segments.map((segment, index) => {
        if (segment.weight <= 0) return null;
        const pct = (segment.weight / total) * 100;
        const left = offset;
        offset += pct;
        const isFirst = index === 0;
        const isLast = index === segments.length - 1;
        return (
          <span
            key={`${segment.key || index}-${segment.color}`}
            className="disto-bar-seg"
            style={{
              left: `${left}%`,
              width: `${pct}%`,
              background: segment.color,
              borderTopLeftRadius: isFirst ? radius : 0,
              borderBottomLeftRadius: isFirst ? radius : 0,
              borderTopRightRadius: isLast ? radius : 0,
              borderBottomRightRadius: isLast ? radius : 0,
            }}
          />
        );
      })}
    </div>
  );
}

// Donut chart with center label. `segments` is an array of
// { key, label, color, value }. A single empty segment renders a gray ring.
export function Donut({
  segments,
  size = 96,
  thickness = 10,
  centerTop,
  centerBottom,
  className = "",
  trackColor = "var(--bg-2, rgba(0,0,0,0.06))",
}) {
  const safeSegments = segments.map((segment) => ({
    ...segment,
    value: safeCount(segment.value),
  }));
  const total = safeSegments.reduce((sum, seg) => sum + seg.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const empty = total === 0;
  let offset = 0;
  return (
    <div className={"disto-donut " + className} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        {!empty &&
          safeSegments.map((segment, index) => {
            if (segment.value <= 0) return null;
            const length = (segment.value / total) * circumference;
            const dashArray = `${length} ${circumference - length}`;
            const rotate = (offset / total) * 360 - 90;
            offset += segment.value;
            return (
              <circle
                key={`${segment.key || index}-${segment.color}`}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={dashArray}
                strokeDashoffset={0}
                transform={`rotate(${rotate} ${center} ${center})`}
                strokeLinecap="butt"
              />
            );
          })}
      </svg>
      <div className="disto-donut-center">
        {centerTop != null && <div className="disto-donut-top">{centerTop}</div>}
        {centerBottom != null && <div className="disto-donut-bot">{centerBottom}</div>}
      </div>
    </div>
  );
}

function DistributionLegendItem({ bucket, active, onBucketClick, title, children }) {
  if (!onBucketClick) {
    return (
      <li className="disto-legend-i" title={title}>
        {children}
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        className={
          "disto-legend-i disto-legend-click" + (active ? " disto-legend-active" : "")
        }
        onClick={() => onBucketClick(bucket.key)}
        aria-pressed={active}
        title={title}
      >
        {children}
      </button>
    </li>
  );
}

// A single distribution card: header + (stacked bar | donut) + legend.
export function DistributionCard({
  title,
  subtitle,
  counts,
  buckets,
  layout = "bar", // "bar" | "donut"
  donutCenterTop,
  donutCenterBottom,
  onBucketClick,
  activeKey = "",
  showEmpty = true,
  className = "",
}) {
  const total = buckets.reduce((sum, bucket) => sum + safeCount(counts[bucket.key]), 0);
  const segments = buckets
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label || bucket.key,
      color: bucket.color,
      weight: safeCount(counts[bucket.key]),
    }))
    .filter((seg) => seg.weight > 0);
  const empty = total === 0;
  return (
    <div className={"disto-card card " + className}>
      <div className="disto-card-h">
        <div>
          <h4>{title}</h4>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
        <div className="disto-card-total">{total}</div>
      </div>
      {layout === "donut" ? (
        <div className="disto-card-donut">
          <Donut
            segments={empty && showEmpty ? buckets.map((b) => ({ ...b, value: 0 })) : segments}
            centerTop={donutCenterTop}
            centerBottom={donutCenterBottom}
          />
          <ul className="disto-legend disto-legend-stacked">
            {buckets.map((bucket) => {
              const value = safeCount(counts[bucket.key]);
              const active = activeKey === bucket.key;
              return (
                <DistributionLegendItem
                  key={bucket.key}
                  bucket={bucket}
                  active={active}
                  onBucketClick={onBucketClick}
                >
                  <span className="disto-legend-dot" style={{ background: bucket.color }} />
                  <span className="disto-legend-l">{bucket.label || bucket.key}</span>
                  <b>{value}</b>
                </DistributionLegendItem>
              );
            })}
          </ul>
        </div>
      ) : (
        <StackedBar segments={segments} />
      )}
      {layout === "bar" && (
        <ul className="disto-legend">
          {buckets.map((bucket) => {
            const value = safeCount(counts[bucket.key]);
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            const active = activeKey === bucket.key;
            return (
              <DistributionLegendItem
                key={bucket.key}
                bucket={bucket}
                active={active}
                onBucketClick={onBucketClick}
                title={T(
                    `${value} ${bucket.label || bucket.key} (${pct}%)`,
                    `${value} ${bucket.label || bucket.key}（${pct}%）`
                  )}
              >
                <span className="disto-legend-dot" style={{ background: bucket.color }} />
                <span className="disto-legend-l">{bucket.label || bucket.key}</span>
                <span className="disto-legend-pct">{pct}%</span>
              </DistributionLegendItem>
            );
          })}
        </ul>
      )}
    </div>
  );
}
