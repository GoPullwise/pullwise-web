import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.jsx";
import { connectGitHubRepositories, requestEmailMagicLink } from "./lib/auth.js";
import { LoginScreen, OAuthScreen } from "./screens/public.jsx";

vi.mock("./lib/auth.js", () => ({
  requestEmailMagicLink: vi.fn(),
  startGitHubLogin: vi.fn(),
  connectGitHubRepositories: vi.fn(),
  signOut: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("renders the normal entry", () => {
    render(<App />);

    expect(screen.getAllByText("Pullwise").length).toBeGreaterThan(0);
  });

  it("renders the prototype navigator entry", () => {
    render(<App prototypeNav />);

    expect(screen.getByText("PR · Prototype")).toBeInTheDocument();
  });

  it("renders passwordless login options", () => {
    render(<LoginScreen go={vi.fn()} />);

    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send magic link/i })).toBeInTheDocument();
    expect(screen.queryByText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Create account")).not.toBeInTheDocument();
  });

  it("requests a magic link for email login", async () => {
    requestEmailMagicLink.mockResolvedValueOnce({
      magicLink: "http://localhost:3000/auth/email/callback?token=dev",
    });
    const user = userEvent.setup();

    render(<LoginScreen go={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("you@company.com"), "taylor@acme.io");
    await user.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(requestEmailMagicLink).toHaveBeenCalledWith({ email: "taylor@acme.io" });
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Check your email");
    expect(screen.getByRole("link", { name: /open local magic link/i })).toHaveAttribute(
      "href",
      "http://localhost:3000/auth/email/callback?token=dev"
    );
  });

  it("opens GitHub install in a popup and navigates to repos on success", async () => {
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
      expect(go).toHaveBeenCalledWith("repos");
    });
  });

  it("shows a cancel message when the install popup is closed", async () => {
    const cancelled = Object.assign(new Error("GitHub installation was cancelled."), {
      code: "popup_closed",
    });
    connectGitHubRepositories.mockRejectedValueOnce(cancelled);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<OAuthScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /connect github repositories/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled/i);
    expect(go).not.toHaveBeenCalled();
  });
});
