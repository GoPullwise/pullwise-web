import { useEffect, useId, useMemo, useRef, useState } from "react";
import { T, useLang } from "../i18n.jsx";
import { CurrencyBadge, FinancialValue } from "./financial-value.jsx";
import "./expense-charts.css";

const PLOT_HEIGHT = 200;
const TOP = 12;
const BASELINE = 188;
const PRECISION = 10000n;

function bucketTime(bucket) {
  if (typeof bucket !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return null;
  const date = new Date(`${bucket}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === bucket
    ? date.getTime()
    : null;
}

function currencySeries(groups, dimension, categories, minorAmount, archivedLabel) {
  const series = new Map();
  let unavailable = false;
  for (const row of Array.isArray(groups) ? groups : []) {
    const amount = minorAmount?.(row?.amountMinor);
    const time = dimension === "bucket" ? bucketTime(row?.bucket) : null;
    if (
      typeof row?.currency !== "string" ||
      !/^[A-Z]{3}$/.test(row.currency) ||
      typeof amount !== "bigint" ||
      amount < 0n ||
      (dimension === "bucket" && time === null)
    ) {
      unavailable = true;
      continue;
    }
    const category = categories.find((item) => item.id === row.categoryId);
    const label =
      dimension === "bucket"
        ? row.bucket
        : typeof category?.name === "string" && category.name
          ? category.name
          : archivedLabel;
    const points = series.get(row.currency) || [];
    points.push({
      row,
      amount,
      time,
      label,
      key: `${row.target || ""}:${row.projectId || ""}:${row.bucket || row.categoryId || "unknown"}`,
    });
    series.set(row.currency, points);
  }
  for (const points of series.values()) {
    points.sort((left, right) =>
      dimension === "bucket"
        ? left.time - right.time
        : left.amount === right.amount
          ? 0
          : left.amount > right.amount
            ? -1
            : 1
    );
  }
  return { series: [...series.entries()], unavailable };
}

function usePlotWidth(ref) {
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => {
      const next = node.getBoundingClientRect().width;
      // Hidden report tabs keep their previous geometry until they become visible.
      if (Number.isFinite(next) && next > 0) setWidth(Math.max(1, next));
    };
    measure();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref]);
  return width;
}

function CurrencyChart({ currency, points, dimension, formatTotal, title }) {
  const chartId = useId();
  const plotRef = useRef(null);
  const pointRefs = useRef(new Map());
  const width = usePlotWidth(plotRef);
  const [selectedKey, setSelectedKey] = useState(null);
  const retainedIndex = points.findIndex((point) => point.key === selectedKey);
  const selectedIndex =
    retainedIndex >= 0 ? retainedIndex : dimension === "bucket" ? points.length - 1 : 0;
  const selected = points[selectedIndex];
  const largest = points.reduce((max, point) => (point.amount > max ? point.amount : max), 0n);
  const padding = Math.min(12, width / 8);
  const plotWidth = width - padding * 2;
  const firstTime = points[0].time;
  const timeRange = points[points.length - 1].time - firstTime;
  const slotWidth = plotWidth / points.length;
  const plotted = points.map((point, index) => {
    // Only the bounded integer ratio reaches Number; monetary values stay exact.
    const ratio =
      largest === 0n ? 0 : Number((point.amount * PRECISION) / largest) / Number(PRECISION);
    const x =
      dimension === "bucket"
        ? timeRange === 0
          ? width / 2
          : padding + ((point.time - firstTime) / timeRange) * plotWidth
        : padding + (index + 0.5) * slotWidth;
    return { ...point, x, y: BASELINE - ratio * (BASELINE - TOP) };
  });
  const line = plotted.map((point) => `${point.x},${point.y}`).join(" ");
  const area =
    plotted.length > 1 && largest > 0n
      ? `M ${plotted[0].x} ${BASELINE} L ${plotted.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${plotted[plotted.length - 1].x} ${BASELINE} Z`
      : null;
  const selectedPoint = plotted[selectedIndex];

  function select(index, focus = false) {
    const point = points[index];
    if (!point) return;
    setSelectedKey(point.key);
    if (focus) pointRefs.current.get(point.key)?.focus();
  }

  function inspectPointer(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const x = ((event.clientX - bounds.left) / bounds.width) * width;
    const nearest = plotted.reduce(
      (index, point, candidate) =>
        Math.abs(point.x - x) < Math.abs(plotted[index].x - x) ? candidate : index,
      0
    );
    select(nearest);
  }

  function onPointKeyDown(event, index) {
    const next = {
      ArrowLeft: Math.max(0, index - 1),
      ArrowDown: Math.max(0, index - 1),
      ArrowRight: Math.min(points.length - 1, index + 1),
      ArrowUp: Math.min(points.length - 1, index + 1),
      Home: 0,
      End: points.length - 1,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      select(next, true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(index);
    }
  }

  return (
    <figure className="expense-chart" data-currency={currency} data-dimension={dimension}>
      <figcaption className="expense-chart-caption">
        <CurrencyBadge currency={currency} />
      </figcaption>
      <div className="expense-chart-readout" aria-live="polite" aria-atomic="true">
        <span className="expense-chart-selected-label">{selected.label}</span>
        <FinancialValue
          value={formatTotal(selected.row)}
          currency={currency}
          className="expense-chart-value"
        />
      </div>
      <div className="expense-chart-plot" ref={plotRef}>
        <svg
          className="expense-chart-svg"
          viewBox={`0 0 ${width} ${PLOT_HEIGHT}`}
          role="group"
          aria-label={`${title} · ${currency}`}
          aria-describedby={`${chartId}-help`}
          onPointerMove={(event) => {
            if (event.pointerType !== "touch") inspectPointer(event);
          }}
          onClick={inspectPointer}
        >
          <desc>
            {T("Each currency has its own scale.", "各币种使用独立刻度")}{" "}
            {formatTotal(points.find((point) => point.amount === largest).row)}
          </desc>
          <g className="expense-chart-grid" aria-hidden="true">
            {[TOP, (TOP + BASELINE) / 2, BASELINE].map((y) => (
              <line key={y} x1={padding} y1={y} x2={width - padding} y2={y} />
            ))}
          </g>
          {dimension === "bucket" && (
            <g aria-hidden="true">
              {area && <path className="expense-chart-area" d={area} />}
              {plotted.length > 1 && <polyline className="expense-chart-line" points={line} />}
              <line
                className="expense-chart-guide"
                x1={selectedPoint.x}
                y1={TOP}
                x2={selectedPoint.x}
                y2={BASELINE}
              />
            </g>
          )}
          {plotted.map((point, index) => {
            const start = index === 0 ? 0 : (plotted[index - 1].x + point.x) / 2;
            const end = index === points.length - 1 ? width : (point.x + plotted[index + 1].x) / 2;
            const barWidth = Math.min(48, slotWidth * 0.62);
            return (
              <g
                key={point.key}
                ref={(node) => {
                  if (node) pointRefs.current.set(point.key, node);
                  else pointRefs.current.delete(point.key);
                }}
                className={"expense-chart-point" + (index === selectedIndex ? " selected" : "")}
                role="button"
                aria-label={`${point.label} · ${formatTotal(point.row)}`}
                aria-pressed={index === selectedIndex}
                tabIndex={index === selectedIndex ? 0 : -1}
                data-label={point.label}
                data-amount-minor={point.row.amountMinor}
                data-x={point.x}
                data-y={point.y}
                onFocus={() => select(index)}
                onClick={(event) => {
                  event.stopPropagation();
                  select(index);
                }}
                onKeyDown={(event) => onPointKeyDown(event, index)}
              >
                <rect
                  className="expense-chart-hit"
                  x={start}
                  y={0}
                  width={Math.max(0, end - start)}
                  height={PLOT_HEIGHT}
                  aria-hidden="true"
                />
                {dimension === "bucket" ? (
                  <rect
                    className="expense-chart-marker"
                    x={point.x - 3}
                    y={point.y - 3}
                    width={6}
                    height={6}
                    aria-hidden="true"
                  />
                ) : (
                  <>
                    <rect
                      className="expense-chart-bar"
                      x={point.x - barWidth / 2}
                      y={point.y}
                      width={barWidth}
                      height={BASELINE - point.y}
                      aria-hidden="true"
                    />
                    {point.amount === 0n && (
                      <line
                        className="expense-chart-zero"
                        x1={point.x - barWidth / 2}
                        y1={BASELINE}
                        x2={point.x + barWidth / 2}
                        y2={BASELINE}
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div
        className={"expense-chart-axis" + (points.length === 1 ? " single" : "")}
        aria-hidden="true"
      >
        <span title={points[0].label}>{points[0].label}</span>
        {points.length > 1 && (
          <span title={points[points.length - 1].label}>{points[points.length - 1].label}</span>
        )}
      </div>
      <span className="expense-chart-help" id={`${chartId}-help`}>
        {T("Use arrow keys to inspect values.", "使用方向键查看数值")}
      </span>
    </figure>
  );
}

export function ExpenseCharts({
  groups = [],
  dimension = "bucket",
  categories = [],
  formatTotal,
  minorAmount,
  title,
}) {
  useLang();
  const archivedLabel = T("Archived category");
  const { series, unavailable } = useMemo(
    () => currencySeries(groups, dimension, categories, minorAmount, archivedLabel),
    [groups, dimension, categories, minorAmount, archivedLabel]
  );
  if (!series.length) {
    return (
      <p>
        {Array.isArray(groups) && groups.length
          ? T("Unavailable")
          : T("No expenses in this range.")}
      </p>
    );
  }
  return (
    <div className="expense-charts">
      <p className="expense-charts-scale">
        {T("Each currency has its own scale.", "各币种使用独立刻度")}
      </p>
      {unavailable && (
        <p className="expense-charts-warning" role="status">
          {T("Some report amounts are unavailable.", "部分报表金额不可用")}
        </p>
      )}
      {series.map(([currency, points]) => (
        <CurrencyChart
          key={`${dimension}:${currency}`}
          currency={currency}
          points={points}
          dimension={dimension}
          formatTotal={formatTotal}
          title={title}
        />
      ))}
    </div>
  );
}
