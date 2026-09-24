import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { productApi } from "../api/product.js";
import { DashboardScreen } from "./dashboard.jsx";
import { setLang } from "../i18n.jsx";
import { itemFixture, overviewFixture, page } from "../test/product-fixtures.js";

beforeEach(() => {
  setLang("en");
  vi.spyOn(productApi, "items").mockResolvedValue(page([itemFixture]));
  vi.spyOn(productApi, "overview").mockResolvedValue(overviewFixture);
  vi.spyOn(productApi, "visualizations").mockResolvedValue({kind: "workload",
    countUnit: "item", totalCount: 1, data: {rows: []}});
  vi.spyOn(productApi, "repositories").mockResolvedValue(page([]));
  vi.spyOn(productApi, "watches").mockResolvedValue(page([]));
});
afterEach(() => vi.restoreAllMocks());

it("does not keep a previously loaded private overview after a failed reload", async () => {
  render(<DashboardScreen go={() => {}} />);
  await screen.findByRole("button", { name: itemFixture.title });
  productApi.overview.mockRejectedValue(new Error("Access proof expired"));
  fireEvent.click(screen.getByRole("button", { name: "Reload data" }));
  await screen.findByText("Access proof expired");
  expect(screen.queryByRole("button", { name: itemFixture.title })).toBeNull();
  expect(screen.queryByRole("button", { name: "Needs action: 0" })).toBeNull();
  productApi.overview.mockResolvedValue(overviewFixture);
  fireEvent.click(screen.getByRole("button", { name: "Retry loading data" }));
  await screen.findByRole("button", { name: itemFixture.title });
});

it("rejects malformed overview counts instead of drawing false zeros", async () => {
  productApi.overview.mockResolvedValue({ counts: {} });
  render(<DashboardScreen go={() => {}} />);
  await screen.findByText("Invalid product overview response");
  expect(screen.queryByText("No matching items.")).toBeNull();
});

it("aborts outstanding reads on unmount and ignores their completions", async () => {
  let resolve;
  productApi.items.mockImplementation(() => new Promise(finish => { resolve = finish; }));
  const view = render(<DashboardScreen go={() => {}} />);
  await waitFor(() => expect(productApi.items).toHaveBeenCalled());
  const signal = productApi.items.mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(page([itemFixture])));
  expect(screen.queryByText(itemFixture.title)).toBeNull();
});

it("shows stuck cursor guidance rather than requesting the same page forever", async () => {
  productApi.items.mockResolvedValue({ ...page([itemFixture]), hasMore: true, nextCursor: null });
  render(<DashboardScreen go={() => {}} />);
  expect(await screen.findByRole("button", { name: "Next items page" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Pagination stopped");
});

it("aborts the evidence read when its drawer closes", async () => {
  let resolve;
  const detail = vi.spyOn(productApi, "item").mockImplementation(() => new Promise(finish => { resolve = finish; }));
  render(<DashboardScreen go={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: itemFixture.title }));
  await waitFor(() => expect(detail).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(detail.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => resolve(itemFixture));
  expect(screen.queryByRole("dialog")).toBeNull();
});
