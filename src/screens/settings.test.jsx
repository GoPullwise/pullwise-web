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

  it("lets users add another GitHub account or organization from personal authorizations", async () => {
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

    await user.click(screen.getByRole("button", { name: /add account or organization/i }));

    await waitFor(() => {
      expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    });
    expect(connectGitHubRepositories).toHaveBeenCalledWith({ add: true });
    expect(go).not.toHaveBeenCalledWith("oauth");
  });

  it("summarizes multiple GitHub App installation accounts", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: true,
        installationAccounts: ["octocat", "acme"],
        repositories: ["octocat/private-repo", "acme/service"],
      },
    });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /integrations/i }));

    expect(await screen.findByText(/2 repositories authorized on octocat, acme/i)).toBeInTheDocument();
  });

  it("lists each GitHub App installation with its management link", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: true,
        installationAccounts: ["GoPullwise", "GoTagma"],
        repositories: [
          "GoPullwise/pullwise-server",
          "GoTagma/tagma-web",
          "GoTagma/tagma-cli",
          "GoTagma/tagma-mono",
          "GoTagma/tagma-desktop",
        ],
        installations: [
          {
            installationId: "130258770",
            installationAccount: "GoPullwise",
            installationTargetType: "Organization",
            installationHtmlUrl: "https://github.com/organizations/GoPullwise/settings/installations/130258770",
            repositorySelection: "selected",
            repositoryCount: 1,
          },
          {
            installationId: "134816087",
            installationAccount: "GoTagma",
            installationTargetType: "Organization",
            installationHtmlUrl: "https://github.com/organizations/GoTagma/settings/installations/134816087",
            repositorySelection: "all",
            repositoryCount: 4,
          },
        ],
      },
    });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /integrations/i }));

    expect(await screen.findByText("Authorized GitHub installations")).toBeInTheDocument();
    expect(screen.getByText("GoPullwise")).toBeInTheDocument();
    expect(screen.getByText(/Organization .* selected .* 1 repository/i)).toBeInTheDocument();
    expect(screen.getByText("GoTagma")).toBeInTheDocument();
    expect(screen.getByText(/Organization .* all repositories .* 4 repositories/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage gopullwise/i })).toHaveAttribute(
      "href",
      "https://github.com/organizations/GoPullwise/settings/installations/130258770"
    );
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
