import { act, renderHook, waitFor } from "@testing-library/react";
import { pullwiseApi } from "../api/pullwise.js";
import { useIssues, useRepositories } from "./pullwise-data.js";

afterEach(() => vi.restoreAllMocks());

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it("cached and uncached query errors preserve only their own items and pagination", async () => {
  const pending = deferred();
  vi.spyOn(pullwiseApi.issues, "list")
    .mockResolvedValueOnce({ items: [{ id: "alpha", status: "open" }], total: 1 })
    .mockResolvedValueOnce({ items: [{ id: "beta", status: "open" }], total: 2 })
    .mockReturnValueOnce(pending.promise)
    .mockRejectedValueOnce(new Error("new query failed"));
  const { result, rerender } = renderHook(({ q }) => useIssues({ q, refreshOnChange: false }), { initialProps: { q: "alpha" } });
  await waitFor(() => expect(result.current.items[0]?.id).toBe("alpha"));
  rerender({ q: "beta" });
  await waitFor(() => expect(result.current.items[0]?.id).toBe("beta"));
  rerender({ q: "alpha" });
  expect(result.current.items.map(item => item.id)).toEqual(["alpha"]);
  expect(result.current.meta.total).toBe(1);
  await act(async () => pending.reject(new Error("refresh failed")));
  expect(result.current.error).toBe("refresh failed");
  expect(result.current.items[0].id).toBe("alpha");
  rerender({ q: "uncached" });
  expect(result.current.items).toEqual([]);
  await waitFor(() => expect(result.current.error).toBe("new query failed"));
  expect(result.current.meta.total).toBe(0);
});

it("old repository pagination cannot overwrite a new owner's rows or metadata", async () => {
  const pending = deferred();
  vi.spyOn(pullwiseApi.repositories, "list")
    .mockResolvedValueOnce({ items: [{ id: "a", fullName: "alpha/repo" }], total: 2, hasMore: true, nextOffset: 1,
      installationAccounts: [{ login: "alpha" }] })
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ items: [{ id: "b", fullName: "beta/repo" }], total: 1, hasMore: false,
      installationAccounts: [{ login: "beta" }] });
  const { result, rerender } = renderHook(({ owner }) => useRepositories({ owner, limit: 1 }), { initialProps: { owner: "alpha" } });
  await waitFor(() => expect(result.current.items[0]?.id).toBe("a"));
  act(() => result.current.loadMore());
  rerender({ owner: "beta" });
  await waitFor(() => expect(result.current.items[0]?.id).toBe("b"));
  await act(async () => pending.resolve({ items: [{ id: "a2", fullName: "alpha/other" }], total: 2, hasMore: false }));
  expect(result.current.items.map(item => item.id)).toEqual(["b"]);
  expect(result.current.meta.total).toBe(1);
  expect(result.current.installationAccounts).toEqual([{ login: "beta" }]);
});
