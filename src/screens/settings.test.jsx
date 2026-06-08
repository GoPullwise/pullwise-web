import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { SettingsScreen } from "./issues.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getSession: vi.fn(),
    },
    integrations: {
      list: vi.fn(),
    },
    repositories: {
      sync: vi.fn(),
    },
    settings: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
  manageGitHubInstallation: vi.fn(),
  signOut: vi.fn(),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      user: { name: "Taylor", email: "taylor@example.com" },
    });
    pullwiseApi.settings.get.mockResolvedValue({
      profile: { name: "Taylor", email: "taylor@example.com" },
      review: { outputLanguage: "en" },
    });
    pullwiseApi.settings.update.mockResolvedValue({
      profile: { name: "Taylor", email: "taylor@example.com" },
      review: { outputLanguage: "en" },
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

    expect(
      await screen.findByText(/2 repositories authorized on octocat, acme/i)
    ).toBeInTheDocument();
  });

  it("lists each GitHub App installation with a controlled management button", async () => {
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
            installationHtmlUrl:
              "https://github.com/organizations/GoPullwise/settings/installations/130258770",
            repositorySelection: "selected",
            repositoryCount: 1,
            manage: {
              mode: "verified_identity",
              githubIdentityId: "ghi_1",
              githubLogin: "alice",
              lastVerifiedAt: 1779670000,
            },
          },
          {
            installationId: "134816087",
            installationAccount: "GoTagma",
            installationTargetType: "Organization",
            installationHtmlUrl:
              "https://github.com/organizations/GoTagma/settings/installations/134816087",
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
    expect(
      screen.getByText(/Organization .* all repositories .* 4 repositories/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage gopullwise/i })).not.toBeInTheDocument();
    expect(screen.getByText("Last verified by @alice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage gopullwise/i })).toBeInTheDocument();
  });

  it("does not render negative installation repository counts", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: true,
        installationAccounts: ["GoPullwise"],
        repositories: [],
        installations: [
          {
            installationId: "130258770",
            installationAccount: "GoPullwise",
            repositorySelection: "selected",
            repositoryCount: -2,
          },
        ],
      },
    });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /integrations/i }));

    expect(await screen.findByText("Authorized GitHub installations")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("-2 repositories");
    expect(screen.getByText(/Account .* selected .* 0 repositories/i)).toBeInTheDocument();
  });

  it("syncs and refreshes installation repository counts after returning from GitHub management", async () => {
    pullwiseApi.integrations.list
      .mockResolvedValueOnce({
        github: {
          connected: true,
          installationAccounts: ["GoPullwise"],
          repositories: ["GoPullwise/pullwise-server"],
          installations: [
            {
              installationId: "130258770",
              installationAccount: "GoPullwise",
              installationTargetType: "Organization",
              installationHtmlUrl:
                "https://github.com/organizations/GoPullwise/settings/installations/130258770",
              repositorySelection: "selected",
              repositoryCount: 1,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        github: {
          connected: true,
          installationAccounts: ["GoPullwise"],
          repositories: ["GoPullwise/pullwise-server", "GoPullwise/pullwise-web"],
          installations: [
            {
              installationId: "130258770",
              installationAccount: "GoPullwise",
              installationTargetType: "Organization",
              installationHtmlUrl:
                "https://github.com/organizations/GoPullwise/settings/installations/130258770",
              repositorySelection: "selected",
              repositoryCount: 2,
            },
          ],
        },
      });
    manageGitHubInstallation.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /integrations/i }));
    expect(await screen.findByText(/1 repository/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /manage gopullwise/i }));

    await waitFor(() => {
      expect(manageGitHubInstallation).toHaveBeenCalledWith("130258770", {
        githubIdentityId: undefined,
        redirectTo: expect.any(String),
      });
      expect(screen.getByText(/2 repositories authorized on GoPullwise/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText(/2 repositories/i).length).toBeGreaterThan(0);
  });

  it("explains repository contents and pull request permissions before connecting GitHub", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: false,
        repositories: [],
      },
    });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /integrations/i }));

    expect(await screen.findByText(/fix branches, and pull requests/i)).toBeInTheDocument();
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

  it("saves the review output language preference from settings", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: false,
        repositories: [],
      },
    });
    pullwiseApi.settings.get.mockResolvedValueOnce({
      profile: { name: "Taylor", email: "taylor@example.com" },
      review: { outputLanguage: "en" },
    });
    pullwiseApi.settings.update.mockResolvedValueOnce({
      profile: { name: "Taylor", email: "taylor@example.com" },
      review: { outputLanguage: "zh-CN" },
    });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /preferences/i }));

    const select = await screen.findByRole("combobox", { name: /review output language/i });
    expect(screen.getByText("Review output language")).toBeInTheDocument();

    await user.selectOptions(select, "zh-CN");

    await waitFor(() => {
      expect(pullwiseApi.settings.update).toHaveBeenCalledWith({
        review: { outputLanguage: "zh-CN" },
      });
    });
  });
});
