import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { DashboardScreen } from "./dashboard.jsx";
import { productApi } from "../api/product.js";
import { setLang } from "../i18n.jsx";
import { itemFixture, overviewFixture, releaseFixture, page } from "../test/product-fixtures.js";

beforeEach(() => {
  setLang("en");
  vi.spyOn(productApi, "overview").mockResolvedValue(structuredClone(overviewFixture));
  vi.spyOn(productApi, "items").mockResolvedValue(page([structuredClone(itemFixture)]));
  vi.spyOn(productApi, "repositories").mockResolvedValue(page([{ id: "repo-1", fullName: "acme/api" }]));
  vi.spyOn(productApi, "watches").mockResolvedValue(page([{ id: "watch-1", upstreamRepositoryId: "upstream-1", interests: ["OAuth"], contextVersion: 2 }]));
  vi.spyOn(productApi, "sources").mockResolvedValue(page([structuredClone(releaseFixture)]));
  vi.spyOn(productApi, "item").mockResolvedValue(structuredClone(itemFixture));
  vi.spyOn(productApi, "source").mockResolvedValue(structuredClone(releaseFixture));
  vi.spyOn(productApi, "handle").mockResolvedValue({ ...itemFixture, revision: 5, handling: { disposition: "done" } });
});
afterEach(() => vi.restoreAllMocks());

const mount = () => render(<DashboardScreen go={vi.fn()} />);

it("renders saved source classifications and assessments without an Item", async () => {
  const release = structuredClone(releaseFixture);
  Object.assign(release.contexts[0], {
    relevance: "relevant", updateSignals: { migration_stated: "present", security_fix_stated: null },
    assessments: [{ id: "saved-source", model: "jev-1.13.0", questionVersion: "updates-filter/v3", answers: {} }],
  });
  productApi.sources.mockResolvedValue(page([release]));
  productApi.source.mockResolvedValue(release);
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Updates module" }));
  expect(await screen.findByText("Relevant")).toBeVisible();
  expect(screen.getByText("Migration: Explicitly stated")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "SDK 2.0" }));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText(/Model assessment.*jev-1.13.0/)).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "Mark done" })).toBeNull();
});
const openItem = async () => {
  fireEvent.click(await screen.findByRole("button", { name: itemFixture.title }));
  return screen.findByRole("dialog");
};

it("shows authoritative distinct counts and multiple labels without legacy requests", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  mount();
  await screen.findByRole("button", { name: itemFixture.title });
  expect(screen.getByRole("button", { name: "Needs action: 1" })).toBeVisible();
  expect(screen.getByText("Changes requested")).toBeVisible();
  expect(screen.getByText("Reply needed")).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByText("New scan")).toBeNull();
});

it("passes module, view, scope and state filters to REST", async () => {
  mount();
  await screen.findByRole("button", { name: itemFixture.title });
  fireEvent.click(screen.getByRole("button", { name: "PR module" }));
  fireEvent.click(await screen.findByRole("button", { name: "Unassigned: 1" }));
  await screen.findByRole("option", { name: "acme/api" });
  fireEvent.change(screen.getByLabelText("Repository scope"), { target: { value: "repo-1" } });
  await waitFor(() => expect(productApi.items).toHaveBeenLastCalledWith(expect.objectContaining({ module: "pr", view: "unassigned", repositoryId: "repo-1" }), expect.anything()));
  fireEvent.click(await screen.findByRole("button", { name: "Needs action: 1" }));
  await waitFor(() => expect(productApi.items).toHaveBeenLastCalledWith(expect.objectContaining({ attentionState: "needs_action" }), expect.anything()));
});

it("keeps Updates without Items independent of item-view filters and displays partial coverage", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Updates module" }));
  fireEvent.click(await screen.findByRole("button", { name: "Unassigned: 1" }));
  await screen.findByText("v2.0");
  expect(productApi.sources).toHaveBeenLastCalledWith({ module: "updates", repositoryId: "", watchId: "", cursor: "" }, expect.anything());
  expect(screen.getByText("1 / 4 units selected")).toBeVisible();
  expect(screen.queryByText("Not relevant")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "SDK 2.0" }));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText(releaseFixture.content.body)).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "Mark done" })).toBeNull();
});

it("shows literal evidence and GitHub links, and restores keyboard focus", async () => {
  const user = userEvent.setup();
  mount();
  const opener = await screen.findByRole("button", { name: itemFixture.title });
  await user.click(opener);
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText(/const cache = new Map/)).toHaveTextContent("Why is this cached?");
  expect(within(dialog).getByRole("link", { name: "Open on GitHub" })).toHaveAttribute("href", itemFixture.sourceUrl);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(opener).toHaveFocus();
});

it.each(["done", "dismissed"])("writes %s once with version/revision and optional note, then refreshes counts", async disposition => {
  mount();
  const dialog = await openItem();
  const button = await within(dialog).findByRole("button", { name: disposition === "done" ? "Mark done" : "Do not follow up" });
  let finish;
  productApi.handle.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(button);
  fireEvent.click(button);
  expect(productApi.handle).toHaveBeenCalledTimes(1);
  expect(productApi.handle).toHaveBeenCalledWith(expect.objectContaining({ itemVersion: 2, revision: 4 }), { disposition, note: null }, expect.anything());
  productApi.items.mockResolvedValue(page([]));
  productApi.overview.mockResolvedValue({ ...overviewFixture, totalCount: 0, counts: { ...overviewFixture.counts, needs_action: 0 } });
  await act(async () => finish({ ...itemFixture, revision: 5 }));
  await screen.findByRole("button", { name: "Needs action: 0" });
});

it.each([409, 412])("requires a fresh detail after %s without replaying a write", async status => {
  productApi.handle.mockRejectedValueOnce(Object.assign(new Error("Changed"), { status }));
  mount();
  const dialog = await openItem();
  fireEvent.click(await within(dialog).findByRole("button", { name: "Mark done" }));
  await within(dialog).findByText("This item changed. Reload it before handling it again.");
  expect(within(dialog).getByRole("button", { name: "Mark done" })).toBeDisabled();
  productApi.item.mockResolvedValue({ ...itemFixture, revision: 8, itemVersion: 3 });
  fireEvent.click(within(dialog).getByRole("button", { name: "Reload item" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Mark done" })).toBeEnabled());
  expect(productApi.handle).toHaveBeenCalledTimes(1);
});

it("clears protected data when a write loses access", async () => {
  productApi.handle.mockRejectedValueOnce(Object.assign(new Error("Access unavailable"), { status: 403 }));
  mount();
  const dialog = await openItem();
  fireEvent.click(await within(dialog).findByRole("button", { name: "Mark done" }));
  await screen.findByText("Access unavailable");
  expect(screen.queryByText(/const cache = new Map/)).toBeNull();
  expect(screen.queryByRole("button", { name: itemFixture.title })).toBeNull();
});

it("ignores obsolete responses and aborts old scope requests", async () => {
  let finish;
  productApi.items.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount();
  await waitFor(() => expect(productApi.items).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "CI module" }));
  await waitFor(() => expect(productApi.items).toHaveBeenCalledTimes(2));
  expect(productApi.items.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => finish(page([{ ...itemFixture, title: "Stale secret" }])));
  expect(screen.queryByText("Stale secret")).toBeNull();
});

it("loads opaque cursors while retaining filters and authoritative totals", async () => {
  productApi.items.mockResolvedValueOnce({ ...page([itemFixture]), nextCursor: "page-2", hasMore: true });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Next items page" }));
  await waitFor(() => expect(productApi.items).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "page-2" }), expect.anything()));
  expect(await screen.findByRole("button", { name: "Needs action: 1" })).toBeVisible();
});

it("hides expired evidence and unsafe URLs", async () => {
  productApi.item.mockResolvedValue({ ...itemFixture, sourceUrl: "javascript:alert(1)", evidence: [{ id: "old", status: "expired", text: "Secret old body", actionTypes: [] }] });
  mount();
  const dialog = await openItem();
  expect(await within(dialog).findByText("Evidence expired")).toBeVisible();
  expect(within(dialog).queryByText("Secret old body")).toBeNull();
  expect(within(dialog).queryByRole("link", { name: "Open on GitHub" })).toBeNull();
});

it("displays versioned handling history without inventing a model assessment", async () => {
  productApi.item.mockResolvedValue({ ...itemFixture, handlingHistory: [{ id: "h1", itemVersion: 1, actorId: "usr_1", disposition: "done", eventKind: "handling_updated", createdAt: 1800000000, note: "Checked earlier version" }] });
  mount();
  const dialog = await openItem();
  expect(await within(dialog).findByText("Checked earlier version")).toBeVisible();
  expect(within(dialog).queryByText("Model assessment")).toBeNull();
});

it.each(["overview", "items", "repositories", "watches"])("%s failure stays unavailable until reload succeeds", async name => {
  productApi[name].mockRejectedValue(new Error("Data unavailable"));
  mount();
  await screen.findByText("Data unavailable");
  expect(screen.queryByRole("button", { name: "Needs action: 0" })).toBeNull();
  expect(screen.queryByText("No matching items.")).toBeNull();
  productApi[name].mockResolvedValue(name === "overview" ? overviewFixture : page([]));
  fireEvent.click(screen.getByRole("button", { name: "Retry loading data" }));
  await screen.findByRole("button", { name: "Needs action: 1" });
});
