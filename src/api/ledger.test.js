import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "./http.js";
import { ledgerApi } from "./ledger.js";

afterEach(() => vi.restoreAllMocks());

describe("ledger REST paths", () => {
  it("uses one versioned Server path and the same-origin proxy base", async () => {
    const oldBase = http.defaults.baseURL;
    http.defaults.baseURL = "/api";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        headers: { "content-type": "application/json" },
      })
    );
    try {
      await ledgerApi.expenses({ target: "shared", from: "2026-09-01" });
      expect(fetchMock.mock.calls[0][0]).toBe("/api/api/v1/expenses?target=shared&from=2026-09-01");
      expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    } finally {
      http.defaults.baseURL = oldBase;
    }
  });

  it("carries revision and idempotency headers on writes", async () => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    await ledgerApi.createExpense({ purpose: "agent" }, "create-1");
    await ledgerApi.updateExpense("exp/1", 3, { purpose: "agent" });
    expect(send).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: "/api/v1/expenses", method: "POST",
      headers: { "Idempotency-Key": "create-1" },
    }));
    expect(send).toHaveBeenNthCalledWith(2, expect.objectContaining({
      url: "/api/v1/expenses/exp%2F1", method: "PATCH",
      headers: { "If-Match": '"3"' },
    }));
  });
});
