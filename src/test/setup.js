import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { clearPullwiseDataCache } from "../lib/pullwise-data-cache.js";

afterEach(() => {
  cleanup();
  clearPullwiseDataCache();
});

Object.defineProperty(window, "scrollTo", {
  value: () => {},
  writable: true,
});

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
