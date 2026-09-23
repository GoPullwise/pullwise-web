import { afterEach, describe, expect, it, vi } from "vitest";
import { http } from "./http.js";
import { productApi } from "./product.js";

afterEach(() => vi.restoreAllMocks());

describe("product-v1 REST client", () => {
  it("uses the shared REST prefix and forwards cancellation and filters", async () => {
    const transport = vi.spyOn(http, "request").mockResolvedValue({ data: { items: [] } });
    const signal = new AbortController().signal;
    await productApi.items({ module: "pr", view: "unassigned", cursor: "opaque" }, { signal });
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ url: "/v1/items", params: { module: "pr", view: "unassigned", cursor: "opaque" }, signal }));
  });

  it("binds handling to the displayed occurrence and revision", async () => {
    const transport = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    await productApi.handle({ id: "item/1", itemVersion: 3, revision: 7 }, { disposition: "done", note: null });
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({
      url: "/v1/items/item%2F1", method: "PATCH", headers: { "If-Match": '"7"' },
      data: { itemVersion: 3, disposition: "done", note: null },
    }));
  });

  it("preserves nested product errors for conflict and access recovery", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "STALE_ITEM", message: "Item changed" } }), { status: 409, headers: { "Content-Type": "application/json" } }));
    await expect(productApi.item("i1")).rejects.toMatchObject({ status: 409, code: "STALE_ITEM", message: "Item changed" });
  });
});
