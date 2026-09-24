import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLang } from "../i18n.jsx";
import { productApi } from "../api/product.js";
import { ProductManagementScreen } from "./product-management.jsx";
import { connectGitHubRepositories } from "../lib/auth.js";

vi.mock("../lib/auth.js", () => ({ connectGitHubRepositories: vi.fn() }));

const repository = {id: "repo-1", fullName: "acme/api", private: true,
  service: {repositoryId: "repo-1", enabled: true,
    modules: {pr: true, ci: false}, analysisEnabled: {pr: false, ci: false},
    allowMemberSync: false, defaultAssigneeId: null, priorityOrder: 0,
    revision: 4}};
const watch = {id: "watch-1", upstreamRepositoryId: "github:101",
  targetRepositoryId: null, interests: ["OAuth"], enabled: true,
  analysisEnabled: false, includePrerelease: false, priorityOrder: 0,
  revision: 2};
const page = items => ({items, nextCursor: null, hasMore: false, requestId: "test"});

beforeEach(() => {
  setLang("en");
  vi.spyOn(productApi, "repositories").mockResolvedValue(page([repository]));
  vi.spyOn(productApi, "watches").mockResolvedValue(page([watch]));
  vi.spyOn(productApi, "repositoryPage").mockResolvedValue(page([repository]));
  vi.spyOn(productApi, "watchPage").mockResolvedValue(page([watch]));
  vi.spyOn(productApi, "usage").mockResolvedValue({entitlements: {
    activeRepositoryLimit: 3, activeWatchLimit: 5}});
  vi.spyOn(productApi, "saveRepositoryService").mockResolvedValue(repository.service);
  vi.spyOn(productApi, "createWatch").mockResolvedValue(watch);
  vi.spyOn(productApi, "updateWatch").mockResolvedValue(watch);
  vi.spyOn(productApi, "archiveWatch").mockResolvedValue({});
  vi.spyOn(productApi, "syncRepository").mockResolvedValue({id: "job-1", status: "queued"});
});
afterEach(() => vi.restoreAllMocks());

it("shows product services and watches without a scan action", async () => {
  render(<ProductManagementScreen go={vi.fn()} />);
  expect(await screen.findByRole("heading", {name: "acme/api"})).toBeVisible();
  expect(screen.getByText("github:101")).toBeVisible();
  expect(screen.getByRole("button", {name: "Save service for acme/api"})).toBeVisible();
  expect(screen.queryByText("New scan")).toBeNull();
});

it("offers GitHub connection when no repository is authorized", async () => {
  productApi.repositoryPage.mockResolvedValue(page([]));
  connectGitHubRepositories.mockResolvedValue();
  render(<ProductManagementScreen go={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", {name: "Connect GitHub repositories"}));
  await waitFor(() => expect(connectGitHubRepositories).toHaveBeenCalledWith({add: true}));
});

it("clears protected configuration after a permission failure", async () => {
  productApi.saveRepositoryService.mockRejectedValue(Object.assign(
    new Error("Repository access revoked"), {status: 403}));
  render(<ProductManagementScreen go={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", {name: "Save service for acme/api"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Repository access revoked");
  expect(screen.queryByRole("heading", {name: "acme/api"})).toBeNull();
});

it("pages repository services without treating page count as account total", async () => {
  productApi.repositoryPage.mockResolvedValueOnce({items: [repository],
    hasMore: true, nextCursor: "repo-cursor", requestId: "one"})
    .mockResolvedValueOnce(page([{...repository, id: "repo-2", fullName: "acme/worker"}]));
  render(<ProductManagementScreen go={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", {name: "Next repositories page"}));
  expect(await screen.findByRole("heading", {name: "acme/worker"})).toBeVisible();
  expect(productApi.repositoryPage).toHaveBeenLastCalledWith({cursor: "repo-cursor"},
    expect.anything());
  expect(within(screen.getByRole("region", {name: "Repository services"}))
    .getByText(/This page: 1/)).toBeVisible();
});

it("pages watches and keeps the selected target repository available", async () => {
  productApi.watchPage.mockResolvedValueOnce({items: [watch], hasMore: true,
    nextCursor: "watch-cursor", requestId: "one"})
    .mockResolvedValueOnce(page([{...watch, id: "watch-2",
      upstreamRepositoryId: "github:202"}]));
  render(<ProductManagementScreen go={vi.fn()} />);
  await screen.findByRole("heading", {name: "github:101"});
  fireEvent.change(screen.getByLabelText("Watch context"), {target: {value: "repo-1"}});
  fireEvent.click(screen.getByRole("button", {name: "Next watches page"}));
  expect(await screen.findByRole("heading", {name: "github:202"})).toBeVisible();
  expect(productApi.watchPage).toHaveBeenLastCalledWith({cursor: "watch-cursor"},
    expect.anything());
  expect(screen.getByLabelText("Watch context")).toHaveValue("repo-1");
});

it("retains a selected shared-watch target across repository pages", async () => {
  productApi.repositoryPage.mockResolvedValueOnce({items: [repository],
    hasMore: true, nextCursor: "repo-cursor", requestId: "one"})
    .mockResolvedValueOnce(page([{...repository, id: "repo-2",
      fullName: "acme/worker"}]));
  render(<ProductManagementScreen go={vi.fn()} />);
  await screen.findByRole("heading", {name: "acme/api"});
  fireEvent.change(screen.getByLabelText("Watch context"), {target: {value: "repo-1"}});
  fireEvent.click(screen.getByRole("button", {name: "Next repositories page"}));
  await screen.findByRole("heading", {name: "acme/worker"});
  expect(screen.getByLabelText("Watch context")).toHaveValue("repo-1");
});

it("saves repository configuration once using the displayed revision", async () => {
  let finish;
  productApi.saveRepositoryService.mockImplementation(() =>
    new Promise(resolve => { finish = resolve; }));
  render(<ProductManagementScreen go={vi.fn()} />);
  const button = await screen.findByRole("button", {name: "Save service for acme/api"});
  fireEvent.click(button);
  fireEvent.click(button);
  expect(productApi.saveRepositoryService).toHaveBeenCalledTimes(1);
  expect(productApi.saveRepositoryService).toHaveBeenCalledWith("repo-1", 4,
    expect.objectContaining({enabled: true, modules: {pr: true, ci: false},
      analysisEnabled: {pr: false, ci: false}}));
  finish(repository.service);
  await waitFor(() => expect(productApi.repositoryPage).toHaveBeenCalledTimes(2));
});

it("creates a personal watch once with a fresh idempotency key and no analysis", async () => {
  render(<ProductManagementScreen go={vi.fn()} />);
  await screen.findByRole("heading", {name: "acme/api"});
  fireEvent.change(screen.getByLabelText("Upstream owner"), {target: {value: "acme"}});
  fireEvent.change(screen.getByLabelText("Repository name"), {target: {value: "sdk"}});
  fireEvent.change(within(screen.getByRole("region", {name: "Create watch"})).getByLabelText("Interests"),
    {target: {value: "OAuth\nMigration"}});
  const button = screen.getByRole("button", {name: "Create watch"});
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(productApi.createWatch).toHaveBeenCalledTimes(1));
  expect(productApi.createWatch).toHaveBeenCalledWith({
    upstream: {owner: "acme", repository: "sdk"}, targetRepositoryId: null,
    interests: ["OAuth", "Migration"], enabled: true,
    analysisEnabled: false, includePrerelease: false, priorityOrder: 0,
  }, expect.any(String));
});

it("requests fact-only repository sync with an idempotency key", async () => {
  render(<ProductManagementScreen go={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", {name: "Sync facts for acme/api"}));
  await waitFor(() => expect(productApi.syncRepository).toHaveBeenCalledWith(
    "repo-1", expect.any(String)));
  expect(screen.getByText(/job-1/)).toBeVisible();
});

it("saves watch changes by revision and confirms archive before writing", async () => {
  render(<ProductManagementScreen go={vi.fn()} />);
  await screen.findByRole("heading", {name: "github:101"});
  fireEvent.click(screen.getByRole("button", {name: "Save watch"}));
  await waitFor(() => expect(productApi.updateWatch).toHaveBeenCalledWith(
    "watch-1", 2, expect.objectContaining({interests: ["OAuth"],
      analysisEnabled: false})));
  fireEvent.click(screen.getByRole("button", {name: "Archive watch"}));
  expect(productApi.archiveWatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "Confirm archive"}));
  await waitFor(() => expect(productApi.archiveWatch).toHaveBeenCalledWith("watch-1", 2));
});
