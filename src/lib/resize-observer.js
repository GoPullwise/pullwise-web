// ResizeObserver callbacks run inside layout delivery. Measuring and updating
// React state or layout styles there can cause another delivery in the same
// cycle, especially when fonts or narrow layouts change. Read the latest
// geometry once on the next frame instead; callers keep their initial measure.
export function createFrameResizeObserver(onResize) {
  if (typeof ResizeObserver !== "function") return null;
  let active = true;
  let frame = null;
  const observer = new ResizeObserver(() => {
    if (!active || frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (active) onResize();
    });
  });
  return {
    observe(target) {
      observer.observe(target);
    },
    disconnect() {
      active = false;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
