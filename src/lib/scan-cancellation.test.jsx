import { act, renderHook, waitFor } from "@testing-library/react";
import { pullwiseApi } from "../api/pullwise.js";
import { useScanRun } from "./pullwise-data.js";

afterEach(() => vi.restoreAllMocks());

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it.each([false, true])("late cancellation cannot overwrite a newer scan context (reject=%s)", async reject => {
  const pending = deferred();
  vi.spyOn(pullwiseApi.scans, "get").mockImplementation(async id => ({ id, repo: "owner/repo", status: "running" }));
  vi.spyOn(pullwiseApi.scans, "cancel").mockReturnValueOnce(pending.promise);
  const { result, rerender } = renderHook(({ scanId }) => useScanRun({ scanId, pollIntervalMs: 60000 }), { initialProps: { scanId: "scan-a" } });
  await waitFor(() => expect(result.current.scan?.id).toBe("scan-a"));
  let cancel;
  act(() => { cancel = result.current.cancel(); });
  rerender({ scanId: "scan-b" });
  await waitFor(() => expect(result.current.scan?.id).toBe("scan-b"));
  // Re-entering A is a new context even though the id matches the old request.
  rerender({ scanId: "scan-a" });
  await waitFor(() => expect(result.current.scan?.status).toBe("running"));
  await act(async () => {
    if (reject) pending.reject(new Error("old cancel failed"));
    else pending.resolve({ id: "scan-a", status: "cancelled" });
    await cancel;
  });
  expect(result.current.scan.id).toBe("scan-a");
  expect(result.current.scan.status).toBe("running");
  expect(result.current.error).toBe("");
  expect(result.current.canceling).toBe(false);
});

it("same-frame cancel calls share one mutation", async () => {
  const pending = deferred();
  vi.spyOn(pullwiseApi.scans, "get").mockResolvedValue({ id: "scan-a", status: "running" });
  const send = vi.spyOn(pullwiseApi.scans, "cancel").mockReturnValue(pending.promise);
  const { result } = renderHook(() => useScanRun({ scanId: "scan-a", pollIntervalMs: 60000 }));
  await waitFor(() => expect(result.current.scan?.id).toBe("scan-a"));
  let first, second;
  act(() => { first = result.current.cancel(); second = result.current.cancel(); });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve({ id: "scan-a", status: "cancelled" }); await Promise.all([first, second]); });
  expect(result.current.scan.status).toBe("cancelled");
});
