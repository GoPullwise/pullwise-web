import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.jsx";
import { connectGitHubRepositories, requestMagicLink } from "./lib/auth.js";
import { LoginScreen, OAuthScreen } from "./screens/public.jsx";

vi.mock("./lib/auth.js", () => ({
  startGitHubLogin: vi.fn(),
  connectGitHubRepositories: vi.fn(),
  requestMagicLink: vi.fn(),
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

  it("renders GitHub login and email magic-link UI", () => {
    render(<LoginScreen go={vi.fn()} />);

    expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email me a magic link/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
    expect(screen.queryByText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Create account")).not.toBeInTheDocument();
  });

  it("requests an email magic link", async () => {
    requestMagicLink.mockResolvedValueOnce({ ok: true, sent: true });
    const user = userEvent.setup();

    render(<LoginScreen go={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("you@company.com"), "dev@example.com");
    await user.click(screen.getByRole("button", { name: /email me a magic link/i }));

    await waitFor(() => {
      expect(requestMagicLink).toHaveBeenCalledWith({ email: "dev@example.com" });
    });
    expect(screen.getByRole("status")).toHaveTextContent(/check your email/i);
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
