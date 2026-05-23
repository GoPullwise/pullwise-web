import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { connectGitHubRepositories, signOut } from "../lib/auth.js";
import { SettingsScreen } from "./issues.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getSession: vi.fn(),
    },
    integrations: {
      list: vi.fn(),
    },
  },
}));

vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
  signOut: vi.fn(),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      user: { name: "Taylor", email: "taylor@example.com" },
    });
  });

  it("lets users manage GitHub repository authorization from personal authorizations", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: true,
        installationAccount: "octocat",
        repositories: ["octocat/private-repo"],
      },
    });
    connectGitHubRepositories.mockResolvedValueOnce(undefined);
    const go = vi.fn();
    const user = userEvent.setup();

    render(<SettingsScreen go={go} />);

    await user.click(screen.getByRole("button", { name: /integrations/i }));

    expect(await screen.findByText("Personal authorizations")).toBeInTheDocument();
    expect(screen.getByText("GitHub repository authorization")).toBeInTheDocument();
    expect(screen.getByText(/1 repositories authorized on octocat/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /manage repository access/i }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    });
    expect(connectGitHubRepositories).toHaveBeenCalledWith({ manage: true });
    expect(go).not.toHaveBeenCalledWith("oauth");
  });

  it("explains that repository contents are read-only before connecting GitHub", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: false,
        repositories: [],
      },
    });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /integrations/i }));

    expect(await screen.findByText(/read-only repository contents/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect repositories/i })).toBeInTheDocument();
  });

  it("exposes active sign out from the profile session settings", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: false,
        repositories: [],
      },
    });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    expect(await screen.findByText(/stay signed in for 7 days/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
