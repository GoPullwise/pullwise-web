import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "../App.jsx";
import { pullwiseApi } from "../api/pullwise.js";
import { setLang } from "../i18n.jsx";

afterEach(() => vi.restoreAllMocks());

it("late cancellation preserves the current scan page and browser URL", async () => {
  setLang("en");
  window.history.replaceState({}, "", "/scanning/scan-a");
  let resolve;
  const pending = new Promise(yes => { resolve = yes; });
  vi.spyOn(pullwiseApi.auth, "getSession").mockResolvedValue({ authenticated: true, user: { id: "test-user" } });
  vi.spyOn(pullwiseApi.scans, "get").mockImplementation(async id => ({ id, repo: `owner/${id}`, status: "running", branch: "main" }));
  vi.spyOn(pullwiseApi.scans, "cancel").mockReturnValueOnce(pending);
  vi.spyOn(pullwiseApi.scans, "status").mockResolvedValue({ items: [] });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /^cancel$/i }));
  act(() => {
    window.history.replaceState({}, "", "/scanning/scan-b");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { screen: "scanning", scanId: "scan-b" } }));
  });
  await waitFor(() => expect(document.querySelector("h1")?.textContent).toContain("owner/scan-b"));
  await act(async () => resolve({ id: "scan-a", repo: "owner/scan-a", status: "cancelled", branch: "main" }));
  expect(window.location.pathname).toBe("/scanning/scan-b");
  expect(document.querySelector("h1")?.textContent).toContain("owner/scan-b");
});
