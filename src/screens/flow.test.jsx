import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../i18n.jsx";
import { ReposScreen, ScanningScreen } from "./flow.jsx";

vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
  manageGitHubInstallation: vi.fn(),
}));

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    scans: {
      preflight: vi.fn(),
    },
  },
}));

vi.mock("../lib/pullwise-data.js", () => ({
  isTerminalScan: (scan) => ["done", "failed", "cancelled"].includes(scan?.status),
  scanQueueSummary: (scan) =>
    scan?.queue
      ? {
          message: scan.queue.message || "",
          tags: [
            scan.queue.position ? `Position ${scan.queue.position}` : null,
            typeof scan.queue.ahead === "number" ? `${scan.queue.ahead} scans ahead` : null,
            scan.queue.limits?.perUser ? `Per user ${scan.queue.limits.perUser}` : null,
          ].filter(Boolean),
        }
      : null,
  useIssues: vi.fn(() => ({ items: [], loading: false, error: "" })),
  useRepositories: vi.fn(),
  useScanBatchRun: vi.fn(),
  useScanRun: vi.fn(),
}));

import { useRepositories, useScanBatchRun, useScanRun } from "../lib/pullwise-data.js";
import { connectGitHubRepositories, manageGitHubInstallation } from "../lib/auth.js";
import { pullwiseApi } from "../api/pullwise.js";

const repoAlpha = {
  id: "repo_alpha",
  name: "alpha",
  fullName: "octocat/alpha",
  desc: "Alpha service",
  lang: "JavaScript",
  stars: 1,
  branches: 2,
  updated: "Today",
  defaultBranch: "main",
};

const repoBeta = {
  id: "repo_beta",
  name: "beta",
  fullName: "octocat/beta",
  desc: "Beta service",
  lang: "TypeScript",
  stars: 3,
  branches: 4,
  updated: "Yesterday",
  defaultBranch: "develop",
};

beforeEach(() => {
  setLang("en");
  connectGitHubRepositories.mockReset();
  connectGitHubRepositories.mockResolvedValue(undefined);
  manageGitHubInstallation.mockReset();
  manageGitHubInstallation.mockResolvedValue(undefined);
  pullwiseApi.scans.preflight.mockReset();
  pullwiseApi.scans.preflight.mockResolvedValue({
    requestedCount: 0,
    allowedCount: 99,
    userQuota: { scope: "user", used: 0, limit: 99, remaining: 99 },
    repositories: [],
  });
  useRepositories.mockReset();
  useScanBatchRun.mockReset();
  useScanBatchRun.mockReturnValue({ scans: [], error: "", cancel: vi.fn() });
  useScanRun.mockReset();
});

function renderScanError(error, errorCode = "") {
  const go = vi.fn();
  useScanRun.mockReturnValue({
    scan: null,
    error,
    errorCode,
    cancel: vi.fn(),
  });

  render(
    <ScanningScreen
      go={go}
      activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
    />
  );

  return { go };
}

describe("ReposScreen scan selection", () => {
  it("hands every selected repository to the scanning screen", async () => {
    const go = vi.fn();
    const setActiveRepo = vi.fn();
    const user = userEvent.setup();
    useRepositories.mockReturnValue({
      items: [repoAlpha, repoBeta],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={go} setActiveRepo={setActiveRepo} />);

    await user.click(screen.getByText("octocat/alpha").closest(".repo-row"));
    await user.click(screen.getByText("octocat/beta").closest(".repo-row"));
    await user.click(screen.getByRole("button", { name: /start scan/i }));

    await waitFor(() => expect(setActiveRepo).toHaveBeenCalledTimes(1));
    const activeRepo = setActiveRepo.mock.calls[0][0];
    expect(activeRepo.selectedRepos).toHaveLength(2);
    expect(activeRepo.selectedRepos.map((repo) => repo.fullName)).toEqual([
      "octocat/alpha",
      "octocat/beta",
    ]);
    expect(activeRepo.selectedRepos[0].scanRequestId).toMatch(/^scan_req_/);
    expect(activeRepo.selectedRepos[1].scanRequestId).toMatch(/^scan_req_/);
    expect(activeRepo.selectedRepos[1].scanRequestId).not.toBe(
      activeRepo.selectedRepos[0].scanRequestId
    );
    expect(go).toHaveBeenCalledWith("scanning");
  });

  it("selects repositories from the keyboard before scanning", async () => {
    const go = vi.fn();
    const setActiveRepo = vi.fn();
    const user = userEvent.setup();
    useRepositories.mockReturnValue({
      items: [repoAlpha, repoBeta],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={go} setActiveRepo={setActiveRepo} />);

    const alphaRow = screen.getByRole("button", { name: /select repository octocat\/alpha/i });
    const betaRow = screen.getByRole("button", { name: /select repository octocat\/beta/i });
    alphaRow.focus();
    await user.keyboard("{Enter}");
    betaRow.focus();
    await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: /start scan/i }));

    await waitFor(() => expect(setActiveRepo).toHaveBeenCalledTimes(1));
    const activeRepo = setActiveRepo.mock.calls[0][0];
    expect(activeRepo.selectedRepos.map((repo) => repo.fullName)).toEqual([
      "octocat/alpha",
      "octocat/beta",
    ]);
    expect(go).toHaveBeenCalledWith("scanning");
  });

  it("shows repository quota before scanning", async () => {
    const resetAt = Date.UTC(2026, 5, 1, 0, 0, 0) / 1000;
    useRepositories.mockReturnValue({
      items: [
        {
          ...repoAlpha,
          repoId: "repo_123",
          quota: { scope: "repository", used: 1, limit: 3, remaining: 2, resetAt },
        },
      ],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(await screen.findByText("octocat/alpha")).toBeInTheDocument();
    expect(screen.getByText(/2 of 3 repo scans left/i)).toBeInTheDocument();
    expect(screen.getByText(/resets 2026-06-01 00:00 UTC/i)).toBeInTheDocument();
  });

  it("shows account quota reset time on the repository selection screen", async () => {
    const resetAt = Date.UTC(2026, 5, 1, 0, 0, 0) / 1000;
    useRepositories.mockReturnValue({
      items: [repoAlpha],
      installations: [],
      installationAccounts: [],
      userQuota: { scope: "user", used: 9, limit: 10, remaining: 1, resetAt },
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(await screen.findByText("octocat/alpha")).toBeInTheDocument();
    expect(screen.getByText(/account quota/i)).toHaveTextContent(
      /1 of 10 account scans left - resets 2026-06-01 00:00 UTC/i
    );
  });

  it("blocks selecting beyond the current account quota with a clear reason", async () => {
    const user = userEvent.setup();
    useRepositories.mockReturnValue({
      items: [repoAlpha, repoBeta],
      installations: [],
      installationAccounts: [],
      userQuota: { scope: "user", used: 9, limit: 10, remaining: 1 },
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    await user.click(screen.getByText("octocat/alpha").closest(".repo-row"));
    await user.click(screen.getByText("octocat/beta").closest(".repo-row"));

    expect(screen.getByRole("alert")).toHaveTextContent(/1 scan left/i);
    expect(screen.getByRole("button", { name: /select repository octocat\/alpha/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /select repository octocat\/beta/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(pullwiseApi.scans.preflight).not.toHaveBeenCalled();
  });

  it("asks the user to choose repositories when server preflight reports fewer scans left", async () => {
    const go = vi.fn();
    const setActiveRepo = vi.fn();
    const user = userEvent.setup();
    pullwiseApi.scans.preflight.mockResolvedValueOnce({
      requestedCount: 2,
      allowedCount: 1,
      userQuota: { scope: "user", used: 9, limit: 10, remaining: 1 },
      repositories: [
        {
          repo: "octocat/alpha",
          available: true,
          repoQuota: { scope: "repository", used: 0, limit: 3, remaining: 3 },
        },
        {
          repo: "octocat/beta",
          available: true,
          repoQuota: { scope: "repository", used: 0, limit: 3, remaining: 3 },
        },
      ],
    });
    useRepositories.mockReturnValue({
      items: [repoAlpha, repoBeta],
      installations: [],
      installationAccounts: [],
      userQuota: null,
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={go} setActiveRepo={setActiveRepo} />);

    await user.click(screen.getByText("octocat/alpha").closest(".repo-row"));
    await user.click(screen.getByText("octocat/beta").closest(".repo-row"));
    await user.click(screen.getByRole("button", { name: /start scan/i }));

    const dialog = await screen.findByRole("dialog", { name: /choose repositories to scan/i });
    expect(dialog).toHaveTextContent(/1 scan left/i);
    expect(setActiveRepo).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalledWith("scanning");

    await user.click(within(dialog).getByRole("button", { name: /octocat\/beta/i }));
    await user.click(within(dialog).getByRole("button", { name: /scan selected/i }));

    await waitFor(() => expect(setActiveRepo).toHaveBeenCalledTimes(1));
    const activeRepo = setActiveRepo.mock.calls[0][0];
    expect(activeRepo.selectedRepos.map((repo) => repo.fullName)).toEqual(["octocat/beta"]);
    expect(go).toHaveBeenCalledWith("scanning");
  });

  it("renders repository onboarding copy in readable Chinese", async () => {
    setLang("zh");
    useRepositories.mockReturnValue({
      items: [repoAlpha],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(await screen.findByText("选择要扫描的仓库")).toBeInTheDocument();
    expect(screen.getByText("1 个已授权仓库")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /同步/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /开始扫描/i })).toBeInTheDocument();
  });

  it("starts GitHub repository connection from the keyboard", async () => {
    const user = userEvent.setup();
    useRepositories.mockReturnValue({
      items: [],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: true,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    const connectRow = await screen.findByRole("button", {
      name: /connect github repositories/i,
    });
    connectRow.focus();
    await user.keyboard("{Enter}");

    expect(connectGitHubRepositories).toHaveBeenCalledTimes(1);
  });
});

describe("ScanningScreen queue state", () => {
  it("passes every selected repository to the batch scan runner", () => {
    useScanRun.mockReturnValue({
      scan: null,
      error: "",
      cancel: vi.fn(),
    });
    useScanBatchRun.mockReturnValue({
      scans: [],
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          selectedRepos: [
            { ...repoAlpha, scanRequestId: "scan_req_alpha" },
            { ...repoBeta, scanRequestId: "scan_req_beta" },
          ],
        }}
      />
    );

    expect(useScanBatchRun).toHaveBeenCalledWith(
      expect.objectContaining({
        repositories: [
          {
            repo: "octocat/alpha",
            branch: "main",
            commit: "pending",
            requestId: "scan_req_alpha",
          },
          {
            repo: "octocat/beta",
            branch: "develop",
            commit: "pending",
            requestId: "scan_req_beta",
          },
        ],
      })
    );
  });

  it("passes the active repository scan request id to the scan runner", () => {
    useScanRun.mockReturnValue({
      scan: null,
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          fullName: "octocat/private-repo",
          defaultBranch: "main",
          scanRequestId: "scan_req_1",
        }}
      />
    );

    expect(useScanRun).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: "octocat/private-repo",
        branch: "main",
        requestId: "scan_req_1",
      })
    );
  });

  it("passes stable repoId to the scan runner when present", () => {
    useScanRun.mockReturnValue({
      scan: null,
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          repoId: "repo_123",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
          scanRequestId: "scan_req_1",
        }}
      />
    );

    expect(useScanRun).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: "repo_123", repo: "octocat/private-repo" })
    );
  });

  it("passes an active history scan id to the scan runner", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        progress: 45,
      },
      error: "",
      cancel: vi.fn(),
    });

    const activeScan = {
      id: "sc_running",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "pending",
      status: "running",
    };

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_running",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
          initialScan: activeScan,
        }}
      />
    );

    expect(useScanRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scanId: "sc_running",
        initialScan: activeScan,
      })
    );
  });

  it("marks a partial batch startup failure as failed after created scans finish", () => {
    useScanRun.mockReturnValue({
      scan: null,
      error: "",
      cancel: vi.fn(),
    });
    useScanBatchRun.mockReturnValue({
      scans: [
        {
          id: "sc_done",
          repo: "octocat/alpha",
          branch: "main",
          commit: "pending",
          status: "done",
          progress: 100,
        },
      ],
      batchResults: [
        {
          repo: "octocat/alpha",
          status: "done",
          scanId: "sc_done",
          scan: { id: "sc_done", status: "done" },
          error: "",
        },
        {
          repo: "octocat/beta",
          status: "failed",
          scanId: "",
          scan: null,
          error: "Repository quota exhausted.",
        },
      ],
      error: "Repository quota exhausted.",
      errorCode: "QUOTA_EXCEEDED_REPOSITORY",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          selectedRepos: [
            { ...repoAlpha, scanRequestId: "scan_req_alpha" },
            { ...repoBeta, scanRequestId: "scan_req_beta" },
          ],
        }}
      />
    );

    expect(screen.getByText(/scan batch failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/scan batch queued/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1\/2 scans created, 1 not created/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/repository quota exhausted/i);
    expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
  });

  it("returns terminal scans to scan history", async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc123",
        status: "done",
        progress: 100,
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={go}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(go).toHaveBeenCalledWith("history");
  });

  it("returns active scans to history without cancelling them", async () => {
    const go = vi.fn();
    const cancel = vi.fn();
    const user = userEvent.setup();
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        progress: 35,
      },
      error: "",
      cancel,
    });

    render(
      <ScanningScreen
        go={go}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(cancel).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith("history");
  });

  it("groups scan header actions in one aligned control row", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        progress: 35,
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    const back = screen.getByRole("button", { name: /back/i });
    const cancel = screen.getByRole("button", { name: /cancel/i });
    const actionGroup = back.closest(".scanning-actions");

    expect(actionGroup).not.toBeNull();
    expect(cancel.closest(".scanning-actions")).toBe(actionGroup);
  });

  it("explains queued scans with queue position and capacity limits", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_queued",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "queued",
        progress: 0,
        queue: {
          position: 4,
          ahead: 3,
          reason: "waiting_for_turn",
          message: "Queued with 3 scans ahead.",
          limits: { perUser: 1 },
          running: { global: 3, user: 0 },
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    expect(screen.getAllByText(/queued/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/scan queued/i)).toBeInTheDocument();
    expect(screen.getByText(/position 4/i)).toBeInTheDocument();
    expect(screen.getAllByText(/3 scans ahead/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/per user 1/i)).toBeInTheDocument();
  });

  it("routes disabled review provider errors to settings", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError(
      "Review provider is disabled. Configure a provider before scanning."
    );

    const action = screen.getByRole("link", { name: /open settings/i });
    expect(action).toHaveAttribute("href", "/settings");

    await user.click(action);

    expect(screen.getByRole("alert")).toHaveTextContent(/review provider is disabled/i);
    expect(go).toHaveBeenCalledWith("settings");
  });

  it("routes GitHub repository sync errors to repositories", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Sync GitHub repositories before starting a scan.");

    const action = screen.getByRole("link", { name: /sync repositories/i });
    expect(action).toHaveAttribute("href", "/repos");

    await user.click(action);

    expect(screen.getByRole("alert")).toHaveTextContent(/sync github repositories/i);
    expect(go).toHaveBeenCalledWith("repos");
  });

  it("does not route unstructured quota text to billing", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Account quota reached.");

    const action = screen.getByRole("link", { name: /retry/i });
    expect(action).toHaveAttribute("href", "/repos");

    await user.click(action);

    expect(screen.getByRole("alert")).toHaveTextContent(/account quota reached/i);
    expect(go).toHaveBeenCalledWith("repos");
  });

  it.each([
    ["Repository quota exhausted.", "QUOTA_EXCEEDED_REPOSITORY"],
    ["Your account has used its scan quota.", "QUOTA_EXCEEDED_USER"],
  ])("routes structured quota errors to billing", async (message, code) => {
    const user = userEvent.setup();
    const { go } = renderScanError(message, code);

    const action = screen.getByRole("link", { name: /open billing/i });
    expect(action).toHaveAttribute("href", "/billing");

    await user.click(action);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(go).toHaveBeenCalledWith("billing");
  });

  it("routes missing CLI provider errors to settings", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Codex CLI is missing or not authenticated.");

    const action = screen.getByRole("link", { name: /open settings/i });
    expect(action).toHaveAttribute("href", "/settings");

    await user.click(action);

    expect(screen.getByRole("alert")).toHaveTextContent(/cli is missing/i);
    expect(go).toHaveBeenCalledWith("settings");
  });
});
