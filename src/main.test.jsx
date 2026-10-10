import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const entry = vi.hoisted(() => ({
  render: vi.fn(),
  isPopup: vi.fn(),
  notify: vi.fn(),
  app: vi.fn(() => null),
}));

vi.mock("react-dom/client", () => ({ createRoot: vi.fn(() => ({ render: entry.render })) }));
vi.mock("./App.jsx", () => ({ App: entry.app }));
vi.mock("./lib/install-popup.js", () => ({
  isInstallPopupReturn: entry.isPopup,
  notifyOpenerAndClose: entry.notify,
}));

describe("GitHub callback startup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.setItem("pw-lang", "en");
    entry.isPopup.mockReturnValue(true);
    window.history.replaceState({}, "", "/");
  });

  it.each([false, true])("keeps a linking conflict readable with popup=%s without claiming completion or starting the app", async (popup) => {
    entry.isPopup.mockReturnValue(popup);
    window.history.replaceState({}, "", "/oauth?github_error=GITHUB_IDENTITY_CONFLICT&repoAuth=1&github_popup_nonce=untrusted");
    await import("./main.jsx");
    render(entry.render.mock.calls[0][0]);
    expect(await screen.findByRole("heading", { name: "GitHub connection was not completed" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(/does not match.*or it is already linked to another Pullwise account/);
    expect(screen.getByText(/Shared-ledger admins authorize their own GitHub accounts/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("GitHub installation complete")).not.toBeInTheDocument();
    expect(entry.notify).not.toHaveBeenCalled();
    expect(entry.app).not.toHaveBeenCalled();
  });

  it("shows session-change guidance without starting account or repository reads", async () => {
    window.history.replaceState({}, "", "/oauth?github_error=ACCOUNT_CHANGED");
    await import("./main.jsx");
    render(entry.render.mock.calls[0][0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your Pullwise session changed during GitHub authorization.");
    expect(entry.app).not.toHaveBeenCalled();
    expect(entry.notify).not.toHaveBeenCalled();
  });

  it("keeps generic authorization failures readable without automatic login or popup completion", async () => {
    window.history.replaceState({}, "", "/oauth?github_error=AUTHORIZATION_FAILED&repoAuth=1");
    await import("./main.jsx");
    render(entry.render.mock.calls[0][0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub authorization could not be completed.");
    expect(screen.queryByText("GitHub installation complete")).not.toBeInTheDocument();
    expect(entry.app).not.toHaveBeenCalled();
    expect(entry.notify).not.toHaveBeenCalled();
  });

  it("preserves the existing successful installation popup return", async () => {
    window.history.replaceState({}, "", "/projects?github_popup_nonce=valid-fixture");
    await import("./main.jsx");
    render(entry.render.mock.calls[0][0]);
    expect(entry.notify).toHaveBeenCalledTimes(1);
    expect(screen.getByText("GitHub installation complete")).toBeVisible();
    expect(entry.app).not.toHaveBeenCalled();
  });

  it("keeps provider failure messaging in the popup protocol and never shows completion", async () => {
    window.history.replaceState({}, "", "/projects?github_error=github_account_mismatch&github_popup_nonce=valid-fixture");
    await import("./main.jsx");
    render(entry.render.mock.calls[0][0]);
    expect(entry.notify).toHaveBeenCalledTimes(1);
    expect(screen.getByText("GitHub installation was not completed")).toBeVisible();
    expect(screen.queryByText("GitHub installation complete")).not.toBeInTheDocument();
    expect(entry.app).not.toHaveBeenCalled();
  });
});
