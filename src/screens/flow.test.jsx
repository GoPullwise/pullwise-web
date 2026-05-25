import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReposScreen, ScanningScreen } from "./flow.jsx";

vi.mock("../lib/pullwise-data.js", () => ({
  isTerminalScan: (scan) => ["done", "failed", "cancelled"].includes(scan?.status),
  scanQueueSummary: (scan) =>
    scan?.queue
      ? {
          message: scan.queue.message || "",
          tags: [
            scan.queue.position ? `Position ${scan.queue.position}` : null,
            typeof scan.queue.ahead === "number" ? `${scan.queue.ahead} scans ahead` : null,
            scan.queue.limits?.global ? `Global ${scan.queue.limits.global}` : null,
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
  useRepositories.mockReset();
  useScanBatchRun.mockReset();
  useScanBatchRun.mockReturnValue({ scans: [], error: "", cancel: vi.fn() });
  useScanRun.mockReset();
});

function renderScanError(error) {
  const go = vi.fn();
  useScanRun.mockReturnValue({
    scan: null,
    error,
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
          reason: "global_limit",
          message: "Server is running 3 of 3 scans; 3 scans ahead.",
          limits: { global: 3, perUser: 1 },
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
    expect(screen.getByText(/global 3/i)).toBeInTheDocument();
    expect(screen.getByText(/per user 1/i)).toBeInTheDocument();
  });

  it("routes disabled review provider errors to settings", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError(
      "Review provider is disabled. Configure a provider before scanning."
    );

    await user.click(screen.getByRole("button", { name: /open settings/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/review provider is disabled/i);
    expect(go).toHaveBeenCalledWith("settings");
  });

  it("routes GitHub repository sync errors to repositories", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Sync GitHub repositories before starting a scan.");

    await user.click(screen.getByRole("button", { name: /sync repositories/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/sync github repositories/i);
    expect(go).toHaveBeenCalledWith("repos");
  });

  it("routes monthly review quota errors to billing", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Monthly review limit exceeded for this workspace.");

    await user.click(screen.getByRole("button", { name: /open billing/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/monthly review limit/i);
    expect(go).toHaveBeenCalledWith("billing");
  });

  it("routes missing CLI provider errors to settings", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Codex CLI is missing or not authenticated.");

    await user.click(screen.getByRole("button", { name: /open settings/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/cli is missing/i);
    expect(go).toHaveBeenCalledWith("settings");
  });
});
