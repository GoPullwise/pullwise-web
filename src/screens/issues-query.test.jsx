import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { pullwiseApi } from "../api/pullwise.js";
import { IssuesScreen } from "./issues.jsx";
import { setLang } from "../i18n.jsx";

it("bulk update uses the restored query cache while that query refreshes", async () => {
  setLang("en");
  let resolveRefresh;
  const refresh = new Promise(resolve => { resolveRefresh = resolve; });
  const alpha = { id: "alpha", title: "Alpha query result", repo: "owner/repo", scanId: "scan-a", status: "open", severity: "high" };
  const beta = { ...alpha, id: "beta", title: "Beta query result", scanId: "scan-b" };
  let alphaCalls = 0;
  const list = vi.spyOn(pullwiseApi.issues, "list").mockImplementation(async ({ q }) => {
    if (q === "alpha" && alphaCalls++ > 0) return refresh;
    return { items: q === "alpha" ? [alpha] : q === "beta" ? [beta] : [], total: q ? 1 : 0, hasMore: false };
  });
  const update = vi.spyOn(pullwiseApi.issues, "updateStatuses")
    .mockImplementation(async updates => ({ items: updates.map(value => ({ ...alpha, ...value })) }));
  render(<IssuesScreen go={() => {}} setIssue={() => {}} />);
  const search = screen.getByRole("searchbox", { name: "Search issues" });
  fireEvent.change(search, { target: { value: "alpha" } });
  await screen.findByText(alpha.title);
  fireEvent.change(search, { target: { value: "beta" } });
  await screen.findByText(beta.title);
  fireEvent.change(search, { target: { value: "alpha" } });
  await waitFor(() => expect(list.mock.calls.filter(([params]) => params.q === "alpha")).toHaveLength(2));
  expect(screen.queryByText(beta.title)).toBeNull();
  expect(screen.getByText(alpha.title)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Mark all fixed" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm mark all fixed" }));
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(update.mock.calls[0][0].map(item => item.id)).toEqual(["alpha"]);
  await act(async () => resolveRefresh({ items: [alpha], total: 1, hasMore: false }));
});
