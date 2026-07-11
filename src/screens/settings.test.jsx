import { act, render, screen, waitFor, within } from "@testing-library/react";
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
    admin: {
      serverMetrics: vi.fn(),
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
    pullwiseApi.admin.serverMetrics.mockRejectedValue(
      Object.assign(new Error("Admin access is required."), { status: 403 })
    );
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

  it("serializes same-frame GitHub authorization actions before React rerenders", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: true,
        installationAccount: "octocat",
        repositories: ["octocat/private-repo"],
      },
    });
    let resolveConnection;
    connectGitHubRepositories.mockReturnValue(
      new Promise((resolve) => {
        resolveConnection = resolve;
      })
    );
    render(<SettingsScreen go={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /integrations/i }));
    const connect = await screen.findByRole("button", { name: /add account or organization/i });
    act(() => {
      connect.click();
      connect.click();
    });

    expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
    await act(async () => resolveConnection());
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
    const pullwiseMeta = screen
      .getByText("GoPullwise")
      .closest(".gh-install-row")
      .querySelector(".gh-install-meta");
    expect(within(pullwiseMeta).getByText("Organization")).toBeInTheDocument();
    expect(within(pullwiseMeta).getByText("selected")).toBeInTheDocument();
    expect(within(pullwiseMeta).getByText("1 repository")).toBeInTheDocument();
    expect(screen.getByText("GoTagma")).toBeInTheDocument();
    const tagmaMeta = screen
      .getByText("GoTagma")
      .closest(".gh-install-row")
      .querySelector(".gh-install-meta");
    expect(within(tagmaMeta).getByText("Organization")).toBeInTheDocument();
    expect(within(tagmaMeta).getByText("all repositories")).toBeInTheDocument();
    expect(within(tagmaMeta).getByText("4 repositories")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage gopullwise/i })).not.toBeInTheDocument();
    expect(screen.getByText("Last verified by @alice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage gopullwise/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/5 repositories authorized on GoPullwise, GoTagma/i)
    ).not.toBeInTheDocument();
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
    const meta = screen
      .getByText("GoPullwise")
      .closest(".gh-install-row")
      .querySelector(".gh-install-meta");
    expect(within(meta).getByText("Account")).toBeInTheDocument();
    expect(within(meta).getByText("selected")).toBeInTheDocument();
    expect(within(meta).getByText("0 repositories")).toBeInTheDocument();
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
      expect(screen.getByText("2 repositories")).toBeInTheDocument();
    });
    expect(screen.queryByText(/2 repositories authorized on GoPullwise/i)).not.toBeInTheDocument();
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
      expect(select).toHaveValue("zh-CN");
    });
  });

  it("does not expose admin server machine metrics in web settings", async () => {
    pullwiseApi.integrations.list.mockResolvedValue({
      github: {
        connected: false,
        repositories: [],
      },
    });
    pullwiseApi.admin.serverMetrics.mockResolvedValue({
      ok: true,
      collectedAt: 1781200060,
      server: {
        hostname: "api-1",
        platform: "Linux-6.8",
        machine: "x86_64",
      },
      cpu: {
        logicalCount: 8,
        loadAverage: { oneMinute: 1.25, fiveMinute: 0.75, fifteenMinute: 0.5 },
      },
      memory: {
        totalBytes: 8589934592,
        availableBytes: 3221225472,
        usedBytes: 5368709120,
        usedPercent: 62.5,
      },
      storage: {
        totalBytes: 107374182400,
        freeBytes: 64424509440,
        usedBytes: 42949672960,
        usedPercent: 40.0,
      },
      history: [
        {
          collectedAt: 1781200000,
          cpu: {
            logicalCount: 8,
            loadAverage: { oneMinute: 0.8, fiveMinute: 0.6, fifteenMinute: 0.4 },
          },
          memory: { usedPercent: 58.2 },
          storage: { usedPercent: 39.7 },
        },
        {
          collectedAt: 1781200060,
          cpu: {
            logicalCount: 8,
            loadAverage: { oneMinute: 1.25, fiveMinute: 0.75, fifteenMinute: 0.5 },
          },
          memory: { usedPercent: 62.5 },
          storage: { usedPercent: 40.0 },
        },
      ],
    });

    render(<SettingsScreen go={vi.fn()} />);

    expect(await screen.findByText(/stay signed in for 7 days/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /server machine/i })).not.toBeInTheDocument();
    expect(screen.queryByText("api-1")).not.toBeInTheDocument();
    expect(pullwiseApi.admin.serverMetrics).not.toHaveBeenCalled();
  });

  it("keeps the selected review output language when a delayed save response echoes stale English", async () => {
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
    let resolveUpdate;
    pullwiseApi.settings.update.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );
    const staleSettingsPayload = {
      profile: { name: "Taylor", email: "taylor@example.com" },
      review: { outputLanguage: "en" },
    };
    const resolveStaleSave = () =>
      act(async () => {
        resolveUpdate(staleSettingsPayload);
      });
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /preferences/i }));

    const select = await screen.findByRole("combobox", { name: /review output language/i });

    await user.selectOptions(select, "zh-CN");

    await waitFor(() => {
      expect(pullwiseApi.settings.update).toHaveBeenCalledWith({
        review: { outputLanguage: "zh-CN" },
      });
    });
    expect(select).toHaveValue("zh-CN");

    await resolveStaleSave();

    await waitFor(() => {
      expect(select).toHaveValue("zh-CN");
    });
  });

  it("explains server origin configuration when review language save is rejected", async () => {
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
    pullwiseApi.settings.update.mockRejectedValueOnce(
      Object.assign(new Error("State-changing requests must come from a trusted origin."), {
        status: 403,
      })
    );
    const user = userEvent.setup();

    render(<SettingsScreen go={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /preferences/i }));

    const select = await screen.findByRole("combobox", { name: /review output language/i });

    await user.selectOptions(select, "zh-CN");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /server origin configuration/i
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/PULLWISE_ALLOWED_ORIGINS/);
  });
  it("shows a retryable first-load error without clearing successful settings data", async () => {
    pullwiseApi.integrations.list.mockRejectedValueOnce(new Error("GitHub integrations unavailable."));

    render(<SettingsScreen go={vi.fn()} />);

    expect(await screen.findByText(/stay signed in for 7 days/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/GitHub integrations unavailable/i);
    expect(screen.getByRole("button", { name: /^retry$/i })).toBeInTheDocument();
  });

});
