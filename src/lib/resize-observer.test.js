import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFrameResizeObserver } from "./resize-observer.js";
import { installAnimationFrameMock } from "../test/animation-frame.js";

let frames;
let notify;
let nativeObserve;
let nativeDisconnect;

beforeEach(() => {
  frames = installAnimationFrameMock();
  nativeObserve = vi.fn();
  nativeDisconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        notify = callback;
      }
      observe(target) {
        nativeObserve(target);
      }
      disconnect() {
        nativeDisconnect();
      }
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

it("coalesces resize delivery and reads current geometry once on the next frame", () => {
  let width = 320;
  const measured = [];
  const observer = createFrameResizeObserver(() => measured.push(width));
  const target = document.createElement("div");
  observer.observe(target);
  expect(nativeObserve).toHaveBeenCalledWith(target);
  notify();
  width = 360;
  notify();
  notify();
  expect(measured).toEqual([]);
  expect(frames.request).toHaveBeenCalledOnce();
  frames.flush();
  expect(measured).toEqual([360]);
  width = 400;
  notify();
  frames.flush();
  expect(measured).toEqual([360, 400]);
  observer.disconnect();
});

it("cancels queued work and ignores late native or frame callbacks after disconnect", () => {
  const measure = vi.fn();
  const observer = createFrameResizeObserver(measure);
  notify();
  const queued = frames.request.mock.calls[0][0];
  observer.disconnect();
  expect(nativeDisconnect).toHaveBeenCalledOnce();
  expect(frames.cancel).toHaveBeenCalledWith(frames.request.mock.results[0].value);
  frames.flush();
  queued();
  notify();
  expect(measure).not.toHaveBeenCalled();
  expect(frames.request).toHaveBeenCalledOnce();
});

it("allows callers to keep their window resize fallback without ResizeObserver", () => {
  vi.stubGlobal("ResizeObserver", undefined);
  expect(createFrameResizeObserver(vi.fn())).toBeNull();
  expect(frames.request).not.toHaveBeenCalled();
});
