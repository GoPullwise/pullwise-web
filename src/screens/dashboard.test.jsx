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
  vi.spyOn(productApi, "visualizations").mockResolvedValue({kind: "workload", countUnit: "item",
    totalCount: 1, data: {rows: [{key: "pr", totalCount: 1, cells: [
      {key: "needs_action", count: 1, drilldown: {resource: "items", filters: {
        view: "mine", module: "pr", attentionState: "needs_action"}}},
    ]}]}});
  vi.spyOn(productApi, "prActions").mockResolvedValue({kind: "pr_actions", countUnit: "item",
    totalCount: 1, hasMore: false, nextCursor: null, data: {rowsTotal: 1, rows: [{
      key: "repo-1:42", repositoryId: "repo-1", pullNumber: 42, totalCount: 1,
      cells: [{key: "reply_needed", count: 1, drilldown: {resource: "items", filters: {
        module: "pr", repositoryId: "repo-1", view: "all", pullNumber: "42",
        actionType: "reply_needed"}}}],
    }]}});
  vi.spyOn(productApi, "ciFailures").mockResolvedValue({kind: "ci_failures",
    countUnit: "ci_job_attempt", totalCount: 2, hasMore: false, data: {
      rows: [{key: "dependency_install"}], columns: [{key: "connection_timeout"}],
      cells: [{rowKey: "dependency_install", columnKey: "connection_timeout", count: 1,
        drilldown: {resource: "items", filters: {module: "ci", view: "all",
          ciStage: "dependency_install", ciSymptom: "connection_timeout"}}}],
      unclassifiedCount: 1, unclassifiedDrilldown: {resource: "items", filters: {
        module: "ci", view: "all", classificationState: "unclassified"}},
    }});
  vi.spyOn(productApi, "updatesReleases").mockResolvedValue({kind: "updates_releases",
    countUnit: "release_watch", totalCount: 1, hasMore: false, nextCursor: null,
    data: {rows: [{sourceId: "release-1", contextId: "context-1", watchId: "watch-1",
      upstreamRepositoryId: "upstream-1", releaseId: "77", tagName: "v2.0",
      title: "SDK 2.0", publishedAt: "2026-09-20T00:00:00Z", itemId: null,
      contextVersion: 2, processingStatus: "analysis_disabled", contextStale: false,
      coverage: structuredClone(releaseFixture.contexts[0].coverage), relevance: null,
      updateSignals: {migration_stated: null}, evidenceIds: [],
      drilldown: {resource: "sources", filters: {module: "updates", watchId: "watch-1", releaseId: "77"}}}]}});
  vi.spyOn(productApi, "items").mockResolvedValue(page([structuredClone(itemFixture)]));
  vi.spyOn(productApi, "repositories").mockResolvedValue(page([{ id: "repo-1", fullName: "acme/api" }]));
  vi.spyOn(productApi, "watches").mockResolvedValue(page([{ id: "watch-1", upstreamRepositoryId: "upstream-1", interests: ["OAuth"], contextVersion: 2 }]));
  vi.spyOn(productApi, "sources").mockResolvedValue(page([structuredClone(releaseFixture)]));
  vi.spyOn(productApi, "item").mockResolvedValue(structuredClone(itemFixture));
  vi.spyOn(productApi, "itemTimeline").mockResolvedValue({items: [
    {id: "event-observed", itemId: "item-pr", itemVersion: 2,
      sourceKind: "github", eventType: "snapshot_observed", occurredAt: null,
      observedAt: "2026-09-22T03:00:00Z", timeBasis: "observed", sourceRefs: [],
      evidenceIds: [], actor: null},
    {id: "event-handling", itemId: "item-pr", itemVersion: 2,
      sourceKind: "handling", eventType: "disposition_changed",
      occurredAt: "2026-09-22T04:00:00Z", observedAt: "2026-09-22T04:00:00Z",
      timeBasis: "source", sourceRefs: [], evidenceIds: [],
      actor: {kind: "user", id: "owner"}},
    {id: "event-thread-resolved", itemId: "item-pr", itemVersion: 2,
      sourceKind: "github", eventType: "thread_resolved", occurredAt: null,
      observedAt: "2026-09-22T05:00:00Z", timeBasis: "observed",
      sourceRefs: [], evidenceIds: [], actor: null},
    {id: "event-comment-edited", itemId: "item-pr", itemVersion: 2,
      sourceKind: "github", eventType: "comment_edited",
      occurredAt: "2026-09-22T06:00:00Z", observedAt: "2026-09-22T07:00:00Z",
      timeBasis: "source", sourceRefs: [], evidenceIds: [], actor: null},
  ], relations: [], nextCursor: null, hasMore: false,
    coverage: {historicalStartAt: "2026-09-22T03:00:00Z", limitations: []}});
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
  const table = structuredClone(await productApi.updatesReleases());
  Object.assign(table.data.rows[0], { relevance: "relevant",
    updateSignals: { migration_stated: "present", security_fix_stated: null } });
  productApi.updatesReleases.mockResolvedValue(table);
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

it("uses the Server workload distribution and drills into its filters", async () => {
  mount();
  const bucket = await screen.findByRole("button", { name: "PR Needs action: 1" });
  fireEvent.click(bucket);
  await waitFor(() => expect(productApi.items).toHaveBeenLastCalledWith(
    expect.objectContaining({ module: "pr", attentionState: "needs_action" }),
    expect.anything()));
  expect(productApi.visualizations).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "workload" }), expect.anything());
});

it("opens PR action cells using the Server drilldown", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "PR module" }));
  const cell = await screen.findByRole("button", { name: "PR #42 Reply needed: 1" });
  fireEvent.click(cell);
  await waitFor(() => expect(productApi.items).toHaveBeenLastCalledWith(
    expect.objectContaining({ module: "pr", repositoryId: "repo-1",
      pullNumber: "42", actionType: "reply_needed" }), expect.anything()));
});

it("opens paired CI stage and symptom cells without inferring a cause", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "CI module" }));
  fireEvent.click(await screen.findByRole("button", {
    name: "Dependency install Connection timeout: 1" }));
  await waitFor(() => expect(productApi.items).toHaveBeenLastCalledWith(
    expect.objectContaining({ module: "ci", ciStage: "dependency_install",
      ciSymptom: "connection_timeout" }), expect.anything()));
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
  expect(productApi.updatesReleases).toHaveBeenLastCalledWith({ kind: "updates_releases", module: "updates", repositoryId: "", watchId: "", cursor: "" }, expect.anything());
  expect(screen.getByText("1 / 4 units selected")).toBeVisible();
  expect(screen.queryByText("Not relevant")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "SDK 2.0" }));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText(releaseFixture.content.body)).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "Mark done" })).toBeNull();
});

it("sends Item search text to the shared REST filters", async () => {
  mount();
  await screen.findByRole("button", {name: itemFixture.title});
  fireEvent.change(screen.getByLabelText("Search items"), {target: {value: "cache"}});
  fireEvent.click(screen.getByRole("button", {name: "Search items"}));
  await waitFor(() => expect(productApi.items).toHaveBeenLastCalledWith(
    expect.objectContaining({q: "cache"}), expect.anything()));
  expect(productApi.overview).toHaveBeenLastCalledWith(
    expect.objectContaining({q: "cache"}), expect.anything());
});

it("shows unclassified Release by watch from the Server table", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Updates module" }));
  expect(await screen.findByRole("button", { name: "SDK 2.0" })).toBeVisible();
  expect(screen.getByText("1 / 4 units selected")).toBeVisible();
  expect(productApi.updatesReleases).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "updates_releases", module: "updates" }),
    expect.anything());
  expect(screen.queryByText("Not relevant")).toBeNull();
});

it("opens a saved Updates signal at its bound evidence", async () => {
  const table = structuredClone(await productApi.updatesReleases());
  Object.assign(table.data.rows[0], {relevance: "relevant",
    updateSignals: {migration_stated: "present"},
    signalEvidenceIds: {migration_stated: ["ev-migration"]}});
  productApi.updatesReleases.mockResolvedValue(table);
  const detail = structuredClone(releaseFixture);
  detail.contexts[0].evidence = [{id: "ev-migration", status: "available",
    text: "OAuth migration is required."}];
  productApi.source.mockResolvedValue(detail);
  mount();
  fireEvent.click(screen.getByRole("button", {name: "Updates module"}));
  fireEvent.click(await screen.findByRole("button", {name: "Migration: Explicitly stated"}));
  const dialog = await screen.findByRole("dialog");
  expect(await within(dialog).findByText("OAuth migration is required.")).toBeVisible();
  expect(document.getElementById("evidence-ev-migration")).toHaveFocus();
  expect(productApi.source).toHaveBeenCalledWith("release-1", expect.anything());
});

it("hides stale Updates signal controls even when an old label is present", async () => {
  const table = structuredClone(await productApi.updatesReleases());
  Object.assign(table.data.rows[0], {contextStale: true, relevance: "relevant",
    updateSignals: {migration_stated: "present"},
    signalEvidenceIds: {migration_stated: ["old-evidence"]}});
  productApi.updatesReleases.mockResolvedValue(table);
  mount();
  fireEvent.click(screen.getByRole("button", {name: "Updates module"}));
  expect(await screen.findByText("Context stale")).toBeVisible();
  expect(screen.queryByRole("button", {name: "Migration: Explicitly stated"})).toBeNull();
  expect(screen.queryByText("Relevant")).toBeNull();
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

it("shows saved Item events with observed versus occurred time", async () => {
  mount();
  const dialog = await openItem();
  expect(await within(dialog).findByText("Snapshot first observed")).toBeVisible();
  expect(within(dialog).getByText("Disposition changed")).toBeVisible();
  expect(within(dialog).getByText("Thread resolved")).toBeVisible();
  expect(within(dialog).getByText("Comment edited")).toBeVisible();
  expect(within(dialog).getAllByText(/First observed/)).toHaveLength(2);
  expect(productApi.itemTimeline).toHaveBeenCalledWith("item-pr", {}, expect.anything());
});

it("shows only a server-verified CI successor relation", async () => {
  productApi.itemTimeline.mockResolvedValue({items: [], nextCursor: null,
    hasMore: false, coverage: {historicalStartAt: null, limitations: []},
    relations: [{kind: "later_run_succeeded", fromEventId: "saved-event",
      fromLoaded: false, toExecution: {repositoryId: "repo-1", runId: "run-2",
        runAttempt: 1, jobId: "job-2", loaded: false},
      matchRuleVersion: "ci-successor/v1"}]});
  mount();
  const dialog = await openItem();
  expect(await within(dialog).findByText("Verified successor execution succeeded")).toBeVisible();
  expect(within(dialog).getByText(/run-2/)).toBeVisible();
  expect(within(dialog).queryByText(/root cause fixed/i)).toBeNull();
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
