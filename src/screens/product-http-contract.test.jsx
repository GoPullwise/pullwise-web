import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import worker from "../../worker.js";
import { ProductDetail } from "../components/product-detail.jsx";
import { productApi } from "../api/product.js";
import { setLang } from "../i18n.jsx";

it.skipIf(!process.env.PULLWISE_CONTRACT_PYTHON)("uses Web client and proxy against real product-v1 HTTP, including handling and sync", async () => {
  const server = resolve(process.cwd(), "../pullwise-server");
  const child = spawn(process.env.PULLWISE_CONTRACT_PYTHON, ["-u", "tests/serve_product_contract.py"],
    { cwd: server, env: { ...process.env, PYTHONPATH: server }, stdio: ["pipe", "pipe", "pipe"] });
  let errors = "";
  child.stderr.on("data", (data) => { errors += data; });
  const lines = createInterface({ input: child.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  const ready = await Promise.race([
    iterator.next().then(({ value }) => { if (!value) throw new Error(errors); return JSON.parse(value); }),
    new Promise((_, reject) => child.once("error", reject)),
  ]);
  const nativeFetch = globalThis.fetch;
  const proxyEnv = { PULLWISE_API_ORIGIN: ready.origin };
  const browserOrigin = "https://app.pullwise.dev";
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((url, init = {}) => {
    if (String(url).startsWith(ready.origin)) return nativeFetch(url, init);
    const incoming = new URL(String(url), browserOrigin);
    if (!incoming.pathname.startsWith("/api/")) incoming.pathname = `/api${incoming.pathname}`;
    const headers = new Headers(init.headers);
    headers.set("Cookie", ready.cookie);
    headers.set("Origin", browserOrigin);
    return worker.fetch(new Request(incoming, { ...init, headers }), proxyEnv);
  });
  try {
    setLang("en");
    const listing = await productApi.items({ module: "pr" });
    expect(listing.items).toHaveLength(1);
    const item = listing.items[0];
    expect(item.actionTypes).toEqual(["change_requested", "reply_needed"]);
    const keyed = await worker.fetch(new Request(`${browserOrigin}/api/v1/items?module=pr`,
      { headers: { Authorization: `Bearer ${ready.key}` } }), proxyEnv);
    expect((await keyed.json()).items).toEqual(listing.items);
    const denied = await worker.fetch(new Request(`${browserOrigin}/api/v1/items/${item.id}`, {
      method: "PATCH", headers: { Cookie: ready.cookie, "Content-Type": "application/json", "If-Match": `"${item.revision}"` },
      body: JSON.stringify({ itemVersion: item.itemVersion, disposition: "done" }),
    }), proxyEnv);
    expect(denied.status).toBe(403);
    const saved = vi.fn();
    render(<ProductDetail selection={{ kind: "item", id: item.id }} onSaved={saved} onClose={() => {}} onAccessLost={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Please add tests.")).toBeVisible();
    expect(await within(dialog).findByText("Done. Why this approach?")).toBeVisible();
    expect(within(dialog).getByText("Completion claim · model classification, not verified completion")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    const after = await productApi.item(item.id);
    expect(after.handling.disposition).toBe("done");
    await expect(productApi.handle(item, { disposition: "open" })).rejects.toMatchObject({ status: 412 });
    const sync = await worker.fetch(new Request(`${browserOrigin}/api/v1/watches/${ready.watchId}/sync`, {
      method: "POST", headers: { Cookie: ready.cookie, Origin: browserOrigin,
        "Content-Type": "application/json", "Idempotency-Key": "http-contract" }, body: "{}",
    }), proxyEnv);
    expect(sync.status).toBe(202);
    const release = await productApi.source(ready.releaseId);
    expect(release.contexts[0].itemId).toBeNull();
    const repositories = await productApi.repositories();
    const managed = repositories.items.find(repo => repo.id === ready.repositoryId);
    expect(managed?.service?.revision).toBe(1);
    const service = await productApi.saveRepositoryService(ready.repositoryId, 1, {
      enabled: true, modules: {pr: true, ci: false},
      analysisEnabled: {pr: false, ci: false}, allowMemberSync: false,
      defaultAssigneeId: null, priorityOrder: 0,
    });
    expect(service.revision).toBe(2);
    const body = {upstream: {owner: "acme", repository: "sdk"},
      targetRepositoryId: null, interests: ["OAuth"],
      enabled: true, analysisEnabled: false, includePrerelease: false,
      priorityOrder: 0};
    const created = await productApi.createWatch(body, "http-create-watch");
    const replay = await productApi.createWatch(body, "http-create-watch");
    expect(replay.id).toBe(created.id);
    expect((await productApi.watches()).items.some(row => row.id === created.id)).toBe(true);
    child.stdin.end("verify\n");
    const { value } = await iterator.next();
    expect(JSON.parse(value)).toMatchObject({ unchangedUsage: true, modelJobs: 0 });
  } finally {
    fetch.mockRestore();
    child.stdin.end();
    child.kill();
    lines.close();
  }
}, 30000);
