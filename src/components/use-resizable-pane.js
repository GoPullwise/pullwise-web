import { useCallback, useEffect, useRef, useState } from "react";
import { createFrameResizeObserver } from "../lib/resize-observer.js";

const DESKTOP_QUERY = "(min-width: 900px)";
const NO_TARGETS = () => [];

function desktopLayout() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.(DESKTOP_QUERY).matches ?? window.innerWidth >= 900;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// Both console dividers use the same bounds, capture lifecycle and keyboard
// behavior. Direction describes which way dragging grows the controlled pane.
export function useResizablePane({
  active = true,
  scope = "",
  minimum,
  maximum: maximumLimit,
  remainingMinimum,
  gap = 0,
  defaultWidth,
  direction = 1,
  requestedWidth,
  onWidthChange,
  measureTargets = NO_TARGETS,
}) {
  const element = useRef(null);
  const drag = useRef(null);
  const previousWidth = useRef(0);
  const [desktop, setDesktop] = useState(desktopLayout);
  const [width, setWidth] = useState(0);
  const [handleHeight, setHandleHeight] = useState(0);
  const [preferredWidth, setPreferredWidth] = useState(null);
  const [resizing, setResizing] = useState(false);
  const maximum = Math.max(
    minimum,
    Math.min(maximumLimit, Math.floor(width - gap - remainingMinimum))
  );
  const preferred = onWidthChange ? requestedWidth : preferredWidth;
  const initial = typeof defaultWidth === "function" ? defaultWidth(width) : defaultWidth;
  const size = clamp(Number.isFinite(preferred) ? preferred : initial, minimum, maximum);
  const adjustable = active && desktop && maximum > minimum;
  const current = useRef(null);
  current.current = { adjustable, maximum, size, onWidthChange };

  const stopDragging = useCallback((updateState = true) => {
    if (updateState) setResizing(false);
    const ongoing = drag.current;
    if (!ongoing) return;
    drag.current = null;
    try {
      if (ongoing.element.hasPointerCapture?.(ongoing.pointerId))
        ongoing.element.releasePointerCapture(ongoing.pointerId);
    } catch {
      // Capture may already be released on cancellation or element removal.
    }
  }, []);

  const request = useCallback(
    (value) => {
      const next = clamp(value, minimum, current.current.maximum);
      if (current.current.onWidthChange) current.current.onWidthChange(next);
      else setPreferredWidth(next);
    },
    [minimum]
  );

  useEffect(() => {
    stopDragging();
    setPreferredWidth(null);
  }, [scope, active, stopDragging]);

  useEffect(() => {
    if (!active) return;
    let disposed = false;
    const media = window.matchMedia?.(DESKTOP_QUERY);
    const updateMedia = () => {
      stopDragging();
      setDesktop(media?.matches ?? window.innerWidth >= 900);
    };
    const measure = () => {
      if (disposed || !element.current) return;
      const nextWidth = element.current.getBoundingClientRect().width;
      if (Math.abs(previousWidth.current - nextWidth) > 0.5) stopDragging();
      previousWidth.current = nextWidth;
      setWidth(nextWidth);
      const targets = measureTargets(element.current);
      setHandleHeight(
        Math.max(0, ...targets.map((target) => target.getBoundingClientRect().height))
      );
      if (!media) setDesktop(window.innerWidth >= 900);
    };
    updateMedia();
    measure();
    const observer = createFrameResizeObserver(measure);
    observer?.observe(element.current);
    for (const target of measureTargets(element.current)) observer?.observe(target);
    media?.addEventListener?.("change", updateMedia);
    window.addEventListener("resize", measure);
    return () => {
      disposed = true;
      observer?.disconnect();
      media?.removeEventListener?.("change", updateMedia);
      window.removeEventListener("resize", measure);
      stopDragging(false);
    };
  }, [active, measureTargets, stopDragging]);

  const separatorProps = {
    role: "separator",
    "aria-orientation": "vertical",
    "aria-valuemin": minimum,
    "aria-valuemax": maximum,
    "aria-valuenow": Math.round(size),
    "aria-disabled": !adjustable,
    tabIndex: adjustable ? 0 : -1,
    onPointerDown(event) {
      if (
        !current.current.adjustable ||
        event.isPrimary === false ||
        (event.button !== undefined && event.button !== 0) ||
        !Number.isFinite(event.clientX)
      )
        return;
      event.preventDefault();
      stopDragging();
      event.currentTarget.focus({ preventScroll: true });
      drag.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        size: current.current.size,
        element: event.currentTarget,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setResizing(true);
    },
    onPointerMove(event) {
      const ongoing = drag.current;
      if (!ongoing || ongoing.pointerId !== event.pointerId || !current.current.adjustable) return;
      event.preventDefault();
      request(Math.round(ongoing.size + (event.clientX - ongoing.clientX) * direction));
    },
    onPointerUp(event) {
      if (drag.current?.pointerId === event.pointerId) stopDragging();
    },
    onPointerCancel(event) {
      if (drag.current?.pointerId === event.pointerId) stopDragging();
    },
    onLostPointerCapture(event) {
      if (drag.current?.pointerId === event.pointerId) stopDragging();
    },
    onKeyDown(event) {
      if (!current.current.adjustable) return;
      const { size: currentSize, maximum: currentMax } = current.current;
      const next = {
        ArrowLeft: currentSize - 16 * direction,
        ArrowRight: currentSize + 16 * direction,
        Home: minimum,
        End: currentMax,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      stopDragging();
      request(next);
    },
  };

  return { element, desktop, width, size, maximum, handleHeight, resizing, separatorProps };
}
