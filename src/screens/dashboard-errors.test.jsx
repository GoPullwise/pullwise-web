import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { pullwiseApi } from "../api/pullwise.js";
import { DashboardScreen } from "./dashboard.jsx";
import { NotificationProvider } from "../components/notifications.jsx";
import { setLang } from "../i18n.jsx";

afterEach(() => vi.restoreAllMocks());

it("a cached overview becomes unavailable on refresh failure and recovers nonzero data", async () => {
  setLang("en");
  const issue = { id: "critical", title: "Critical finding", status: "open", severity: "critical", repo: "acme/api" };
  const list = vi.spyOn(pullwiseApi.issues, "list").mockResolvedValue({ items: [issue], total: 1 });
  vi.spyOn(pullwiseApi.repositories, "list").mockResolvedValue({ items: [], total: 0 });
  vi.spyOn(pullwiseApi.scans, "list").mockResolvedValue({ items: [], total: 0 });
  const first = render(<DashboardScreen go={() => {}} setIssue={() => {}} />);
  await screen.findByText("Requires immediate attention");
  first.unmount();
  list.mockRejectedValue(new Error("Cached overview refresh failed"));
  render(<DashboardScreen go={() => {}} setIssue={() => {}} />);
  await screen.findByText("Cached overview refresh failed");
  expect(screen.queryByRole("region", { name: "Account health" })).toBeNull();
  list.mockResolvedValue({ items: [issue], total: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Retry loading data" }));
  await screen.findByText("Requires immediate attention");
  expect(screen.queryByText("No critical issues found")).toBeNull();
});

it.each(["issues", "repositories", "scans"])("%s failures show unavailable data with a working retry", async source => {
  setLang("en");
  for (const name of ["issues", "repositories", "scans"]) {
    vi.spyOn(pullwiseApi[name], "list").mockResolvedValue({ items: [], total: 0 });
  }
  pullwiseApi[source].list.mockRejectedValue(new Error(`${source} unavailable`));
  render(<NotificationProvider><DashboardScreen go={() => {}} setIssue={() => {}} /></NotificationProvider>);
  await waitFor(() => expect(screen.getAllByText(`${source} unavailable`).length).toBeGreaterThan(0));
  expect(screen.queryByText("No critical issues found")).toBeNull();
  expect(screen.queryByText("No open issues to display.")).toBeNull();
  expect(screen.queryByText("No scans yet")).toBeNull();
  const callsBeforeRetry = pullwiseApi[source].list.mock.calls.length;
  pullwiseApi[source].list.mockResolvedValue({ items: [], total: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Retry loading data" }));
  await screen.findByText("No critical issues found");
  expect(screen.getByText("No open issues to display.")).toBeVisible();
  expect(pullwiseApi[source].list.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
});
