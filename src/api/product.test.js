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

  it("uses the shared REST contract for repository and watch configuration", async () => {
    const transport = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const service = { enabled: true, modules: { pr: true, ci: false },
      analysisEnabled: { pr: false, ci: false }, allowMemberSync: false,
      defaultAssigneeId: null, priorityOrder: 0 };
    await productApi.saveRepositoryService("repo/1", 0, service);
    expect(transport).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/v1/repositories/repo%2F1/service", method: "PUT",
      headers: { "If-Match": '"0"' }, data: service }));
    await productApi.createWatch({ upstream: { owner: "acme", repository: "sdk" },
      interests: ["OAuth"], targetRepositoryId: null }, "create-1");
    expect(transport).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/v1/watches", method: "POST", headers: { "Idempotency-Key": "create-1" } }));
    await productApi.archiveWatch("watch/1", 4);
    expect(transport).toHaveBeenLastCalledWith(expect.objectContaining({
      url: "/v1/watches/watch%2F1", method: "DELETE",
      headers: { "If-Match": '"4"' } }));
  });
});
