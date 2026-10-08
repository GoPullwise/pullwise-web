import { Children, cloneElement, isValidElement, useId } from "react";
import { T, useLang } from "../i18n.jsx";
import { useResizablePane } from "./use-resizable-pane.js";

const MIN_SIDE = 260;
const MAX_SIDE = 520;
const MIN_PRIMARY = 280;
const COLUMN_GAP = 48;

function isPrimaryPanel(child) {
  if (!isValidElement(child)) return false;
  const classes = String(child.props.className || "").split(/\s+/);
  return classes.includes("panel") && !classes.includes("ledger-overview");
}

function measurePanels(element) {
  return Array.from(element.children).filter(
    (child) => child.classList.contains("panel") && !child.classList.contains("ledger-overview")
  );
}

function defaultSideWidth(width) {
  return Math.round(Math.max(MIN_SIDE, Math.min(340, width * 0.38)));
}

// Keep the panels as direct children: the shared split rules and overview row
// depend on their original order. The separator is an overlay after all panels.
export function LedgerSplit({ children, className = "", enabled = true, scope = "", label }) {
  useLang();
  const splitId = useId();
  const childArray = Children.toArray(children);
  const panelIndexes = childArray.flatMap((child, index) => (isPrimaryPanel(child) ? [index] : []));
  const active = enabled && panelIndexes.length === 2;
  const pane = useResizablePane({
    active,
    scope,
    minimum: MIN_SIDE,
    maximum: MAX_SIDE,
    remainingMinimum: MIN_PRIMARY,
    gap: COLUMN_GAP,
    defaultWidth: defaultSideWidth,
    direction: -1,
    measureTargets: measurePanels,
  });
  const sidePanel = childArray[panelIndexes[1]];
  const sideId = active ? sidePanel.props.id || `${splitId}-side` : undefined;
  const style =
    active && pane.desktop && pane.width > 0
      ? {
          "--ledger-side-width": `${pane.size}px`,
          "--ledger-side-min": `${MIN_SIDE}px`,
          "--ledger-side-max": `${pane.maximum}px`,
          ...(pane.handleHeight > 0
            ? { "--ledger-split-handle-height": `${pane.handleHeight}px` }
            : {}),
        }
      : undefined;

  return (
    <div
      ref={pane.element}
      className={
        [active && "ledger-split", className, pane.resizing && "is-resizing"]
          .filter(Boolean)
          .join(" ") || undefined
      }
      style={style}
    >
      {childArray.map((child, index) =>
        active && index === panelIndexes[1] && !child.props.id
          ? cloneElement(child, { id: sideId })
          : child
      )}
      {active && pane.desktop && (
        <div
          {...pane.separatorProps}
          className="ledger-split-resizer"
          aria-label={label || T("Resize side panel", "调整侧栏宽度")}
          aria-controls={sideId}
        />
      )}
    </div>
  );
}
