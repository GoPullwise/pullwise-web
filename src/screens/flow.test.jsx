import { readFileSync } from "node:fs";
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
      auditBundle: vi.fn(),
      auditBundleArchive: vi.fn(),
    },
    repositories: {
      branches: vi.fn(),
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
  pullwiseApi.scans.auditBundle.mockReset();
  pullwiseApi.scans.auditBundleArchive.mockReset();
  pullwiseApi.repositories.branches.mockReset();
  pullwiseApi.repositories.branches.mockResolvedValue({
    defaultBranch: "main",
    branches: ["main", "develop"],
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
  it("shows the topbar loading spinner only while repositories are loading", () => {
    useRepositories.mockReturnValue({
      items: [],
      installations: [],
      installationAccounts: [],
      loading: true,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    const { rerender } = render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(screen.getByRole("status", { name: /^loading$/i })).toHaveClass(
      "topbar-loading",
      "spin"
    );

    useRepositories.mockReturnValue({
      items: [],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });
    rerender(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(screen.queryByRole("status", { name: /^loading$/i })).not.toBeInTheDocument();
  });

  it("keeps scan list metadata in two rows before selection", () => {
    const appStyles = readFileSync("src/app.css", "utf8");

    expect(appStyles).toMatch(/\.repo-meta\s*{[^}]*display:\s*grid;/);
    expect(appStyles).toMatch(
      /\.repo-meta\s*{[^}]*grid-template-rows:\s*repeat\(2,\s*minmax\(16px,\s*auto\)\);/
    );
    expect(appStyles).toMatch(/\.repo-meta\s*{[^}]*grid-auto-flow:\s*column;/);
    expect(appStyles).toMatch(
      /\.repo-meta \.repo-branch-placeholder\s*{[^}]*visibility:\s*hidden;/
    );
  });

  it("reserves the branch slot before a repository is selected", async () => {
    const user = userEvent.setup();
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

    const row = screen.getByRole("button", { name: /select repository octocat\/alpha/i });
    expect(row.querySelector(".repo-branch-placeholder")).toBeInTheDocument();
    expect(row.querySelector(".repo-branch-placeholder")).toHaveTextContent("main");
    expect(
      screen.queryByRole("button", { name: /branch for octocat\/alpha/i })
    ).not.toBeInTheDocument();

    await user.click(row);

    expect(row.querySelector(".repo-branch-placeholder")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /branch for octocat\/alpha/i })
    ).toBeInTheDocument();
  });

  it("assigns repository language colors with a fallback for unknown languages", () => {
    useRepositories.mockReturnValue({
      items: [
        repoAlpha,
        repoBeta,
        {
          ...repoAlpha,
          id: "repo_unknown",
          name: "unknown",
          fullName: "octocat/unknown",
          lang: "Zig",
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

    const dots = document.querySelectorAll(".lang-dot");
    expect(dots[0]).toHaveAttribute("data-lang-color", "javascript");
    expect(dots[0]).toHaveStyle("--repo-lang-color: #f1e05a");
    expect(dots[1]).toHaveAttribute("data-lang-color", "typescript");
    expect(dots[1]).toHaveStyle("--repo-lang-color: #3178c6");
    expect(dots[2]).toHaveAttribute("data-lang-color", "other");
    expect(dots[2]).toHaveStyle("--repo-lang-color: #8b949e");
  });

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

  it("loads repository branches and scans the selected branch", async () => {
    const go = vi.fn();
    const setActiveRepo = vi.fn();
    const user = userEvent.setup();
    pullwiseApi.repositories.branches.mockResolvedValueOnce({
      defaultBranch: "main",
      branches: ["main", "release/1.0"],
    });
    useRepositories.mockReturnValue({
      items: [repoAlpha],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={go} setActiveRepo={setActiveRepo} />);

    await user.click(screen.getByText("octocat/alpha").closest(".repo-row"));
    const branchTrigger = await screen.findByRole("button", {
      name: /branch for octocat\/alpha/i,
    });
    await user.click(branchTrigger);
    await user.click(await screen.findByRole("option", { name: "release/1.0" }));
    await user.click(screen.getByRole("button", { name: /start scan/i }));

    await waitFor(() => expect(setActiveRepo).toHaveBeenCalledTimes(1));
    expect(pullwiseApi.repositories.branches).toHaveBeenCalledWith("repo_alpha");
    expect(pullwiseApi.scans.preflight).toHaveBeenCalledWith({
      repositories: [
        expect.objectContaining({
          repo: "octocat/alpha",
          branch: "release/1.0",
        }),
      ],
    });
    const activeRepo = setActiveRepo.mock.calls[0][0];
    expect(activeRepo.selectedRepos[0].branch).toBe("release/1.0");
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

  it("uses the installation list instead of a duplicate authorization summary", async () => {
    useRepositories.mockReturnValue({
      items: [repoAlpha, repoBeta],
      installations: [
        {
          installationId: "130258770",
          installationAccount: "octocat",
          installationTargetType: "Organization",
          repositorySelection: "selected",
          repositoryCount: 2,
        },
      ],
      installationAccounts: ["octocat"],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(await screen.findByText("Authorized GitHub installations")).toBeInTheDocument();
    expect(screen.getByText("octocat")).toBeInTheDocument();
    expect(screen.getByText("selected")).toBeInTheDocument();
    expect(screen.queryByText(/2 authorized repos/i)).not.toBeInTheDocument();
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
    expect(
      screen.getByRole("button", { name: /select repository octocat\/alpha/i })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /select repository octocat\/beta/i })
    ).toHaveAttribute("aria-pressed", "false");
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

  it("shows evidence status totals for a completed scan", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        verification: { verified: 1, static_proof: 2, potential_risk: 3, unverified: 4 },
        aiUsage: {
          provider: "codex",
          model: "gpt-5.5",
          inputTokens: 123,
          outputTokens: 45,
          totalTokens: 168,
        },
        verificationAudit: {
          candidateCount: 6,
          reportedCount: 4,
          rejectedCount: 2,
          downgradedCount: 1,
          rejectedSamples: [{ reason: "missing_evidence", title: "Only a vague model guess" }],
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_done",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
        }}
      />
    );

    expect(screen.getByText("Evidence status")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Static")).toBeInTheDocument();
    expect(screen.getByText("Risk")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.5")).toBeInTheDocument();
    expect(screen.queryByText("168 tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("codex")).not.toBeInTheDocument();
    expect(screen.getByText("Candidate audit")).toBeInTheDocument();
    expect(screen.getByText("Candidates")).toBeInTheDocument();
    expect(screen.getByText("Reported")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Downgraded")).toBeInTheDocument();
    expect(
      screen.getByText("Rejected: missing_evidence - Only a vague model guess")
    ).toBeInTheDocument();
  });

  it("shows user-readable Audit Swarm evidence from the worker scan payload", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        verification: { verified: 1, static_proof: 0, potential_risk: 0, unverified: 0 },
        auditSwarm: {
          protocol: "audit-swarm/0.1",
          stage: "report",
          adapter: "codex",
          summary: "2 candidates evaluated; 1 reported; 1 rejected before reporting.",
          counts: {
            issueCards: 1,
            verificationResults: 1,
            evidenceBlocks: 7,
            candidateCount: 2,
            rejectedCount: 1,
            verifiedCount: 1,
          },
          roles: ["security-reviewer", "prover"],
          shards: ["auth.session"],
          evidenceBlocks: [
            {
              id: "issue-refresh:claim",
              kind: "claim",
              issueId: "issue-refresh",
              title: "Refresh token rotation may not be atomic",
              severity: "high",
              role: "security-reviewer",
              shardId: "auth.session",
              summary: "Token invalidation and issuance are not in one transaction.",
            },
            {
              id: "issue-refresh:location:0",
              kind: "code_location",
              title: "Code location",
              file: "src/auth/refresh.ts",
              startLine: "42",
              summary: "Primary audited location.",
            },
            {
              id: "issue-refresh:evidence:0",
              kind: "evidence",
              title: "Discovery evidence",
              summary: "createRefreshToken runs before old-token invalidation is confirmed.",
            },
            {
              id: "issue-refresh:false-positive:0",
              kind: "false_positive_check",
              title: "False-positive check",
              summary: "Check whether the caller wraps this service in a transaction.",
            },
            {
              id: "issue-refresh:suggested-test",
              kind: "command",
              title: "Suggested test",
              status: "suggested",
              summary: "Mock a failure between issuance and invalidation.",
            },
            {
              id: "issue-refresh:verdict:prover",
              kind: "verifier_verdict",
              title: "Verifier verdict",
              role: "prover",
              verdict: "confirmed",
              summary: "A mocked failure leaves both tokens valid.",
            },
            {
              id: "issue-refresh:command:0",
              kind: "command",
              title: "Verifier command",
              role: "prover",
              status: "executed",
              command: "pnpm test auth -- refresh-token-rotation",
            },
          ],
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_done",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
        }}
      />
    );

    const auditEvidence = screen.getByText("Audit evidence").closest(".scanning-audit");
    expect(auditEvidence).toHaveClass("scanning-audit-inline");
    expect(auditEvidence.closest(".scanning-card")).toBeInTheDocument();
    expect(auditEvidence.closest(".scanning-side")).toBeNull();
    expect(auditEvidence.previousElementSibling).toHaveTextContent("Audit Swarm review");
    expect(auditEvidence.nextElementSibling).toHaveTextContent("Uploading report");
    expect(screen.getByText("audit-swarm/0.1")).toBeInTheDocument();
    expect(screen.getByText("stage report")).toBeInTheDocument();
    expect(screen.getByText("7 evidence blocks")).toBeInTheDocument();
    expect(screen.getByText("2 candidates evaluated")).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getAllByText("Code location").length).toBeGreaterThan(0);
    expect(screen.getByText("src/auth/refresh.ts:42")).toBeInTheDocument();
    expect(screen.getByText("Refresh token rotation may not be atomic")).toBeInTheDocument();
    expect(
      screen.getByText("Token invalidation and issuance are not in one transaction.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("createRefreshToken runs before old-token invalidation is confirmed.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check whether the caller wraps this service in a transaction.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mock a failure between issuance and invalidation.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Verifier verdict").length).toBeGreaterThan(0);
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    expect(screen.getAllByText("prover").length).toBeGreaterThan(0);
    expect(screen.getByText("A mocked failure leaves both tokens valid.")).toBeInTheDocument();
    expect(screen.getByText("pnpm test auth -- refresh-token-rotation")).toBeInTheDocument();
  });

  it("keeps long audit evidence card text inside the card without clamping", () => {
    const styles = readFileSync("styles/screens.css", "utf8");

    expect(styles).toMatch(/\.audit-card\s*{[^}]*min-width:\s*0;/s);
    expect(styles).toMatch(/\.audit-card-row\s*{[^}]*grid-template-columns:\s*88px minmax\(0,\s*1fr\);/s);
    expect(styles).toMatch(/\.audit-card-row > :where\(span,\s*code\)\s*{[^}]*min-width:\s*0;/s);
    expect(styles).toMatch(/\.audit-card-row > :where\(span,\s*code\)\s*{[^}]*white-space:\s*normal;/s);
    expect(styles).toMatch(/\.audit-card-row > \.evidence-command\s*{[^}]*overflow:\s*visible;/s);
    expect(styles).toMatch(/\.audit-card-row > \.evidence-command\s*{[^}]*white-space:\s*normal;/s);
    expect(styles).not.toMatch(/\.audit-card-row > :where\(span,\s*code\)\s*{[^}]*line-clamp/s);
  });

  it("renders the audit funnel as compact count metrics instead of colored progress bars", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 0, medium: 1, low: 0 },
        verification: { verified: 1, static_proof: 1, potential_risk: 0, unverified: 0 },
        verificationAudit: {
          candidateCount: 2,
          reportedCount: 2,
          verifiedCount: 1,
          staticProofCount: 1,
          rejectedCount: 0,
          downgradedCount: 0,
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_done",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
        }}
      />
    );

    const funnel = screen.getByRole("img", { name: /audit funnel/i });
    expect(funnel.querySelector(".audit-funnel-fill")).not.toBeInTheDocument();
    expect(funnel.querySelectorAll(".audit-funnel-metric")).toHaveLength(4);
    expect(funnel).toHaveTextContent("Candidates evaluated");
    expect(funnel).toHaveTextContent("Verified / static proof");
  });

  it("shows preflight evidence for a completed scan", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
        verification: { verified: 0, static_proof: 0, potential_risk: 0, unverified: 0 },
        preflight: {
          mode: "static",
          execution: "allowlisted_verifier_scripts",
          summary: "Static preflight captured repository manifests and worker tool versions.",
          packageManagers: ["pnpm"],
          languages: ["JavaScript/TypeScript"],
          availableScripts: ["build", "test"],
          environment: {
            os: "Linux",
            osRelease: "6.8.0",
            machine: "x86_64",
          },
          manifests: [{ file: "package.json", type: "node" }],
          toolVersions: [{ name: "git", available: true, output: "git ok" }],
          verifier: {
            enabled: true,
            summary: "Verifier ran one command.",
            runs: [
              { script: "test", command: "pnpm run test", status: "failed", exitCode: 1 },
              { script: "lint", command: "pnpm run lint", status: "flaky", exitCode: 1 },
            ],
          },
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_done",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
        }}
      />
    );

    expect(screen.getByText("Preflight evidence")).toBeInTheDocument();
    expect(screen.getByText("allowlisted_verifier_scripts")).toBeInTheDocument();
    expect(screen.getByText("pnpm")).toBeInTheDocument();
    expect(screen.getByText("1 manifests")).toBeInTheDocument();
    expect(screen.getByText("1 tool checks")).toBeInTheDocument();
    expect(screen.getByText("Linux 6.8.0 x86_64")).toBeInTheDocument();
    expect(screen.getByText("2 verifier runs")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("1 flaky")).toBeInTheDocument();
    expect(screen.getByText("build, test")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /overview/i })).toBeInTheDocument();
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

  it("opens the dashboard overview from completed scans", async () => {
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

    await user.click(screen.getByRole("button", { name: /overview/i }));

    expect(go).toHaveBeenCalledWith("dashboard");
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

  it("shows the production worker scan phases instead of legacy simulated phases", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "ai",
        progress: 80,
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

    const phases = document.querySelector(".scanning-phases");
    expect(phases).not.toBeNull();
    expect(within(phases).getByText("Cloning repository")).toBeInTheDocument();
    expect(within(phases).getByText("Repository preflight")).toBeInTheDocument();
    expect(within(phases).getByText("Audit Swarm review")).toBeInTheDocument();
    expect(within(phases).getByText("Uploading report")).toBeInTheDocument();
    expect(within(phases).queryByText("Scanning for secrets")).not.toBeInTheDocument();
    expect(within(phases).queryByText("Analyzing dependencies")).not.toBeInTheDocument();
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

  it.each([
    "Codex CLI is missing or not authenticated.",
    "OpenCode CLI is missing or not authenticated.",
  ])(
    "routes missing CLI provider errors to settings without exposing the runner name",
    async (message) => {
      const user = userEvent.setup();
      const { go } = renderScanError(message);

      const action = screen.getByRole("link", { name: /open settings/i });
      expect(action).toHaveAttribute("href", "/settings");

      await user.click(action);

      expect(screen.getByRole("alert")).toHaveTextContent(/review runner is missing/i);
      expect(screen.getByRole("alert")).not.toHaveTextContent(/codex|opencode/i);
      expect(go).toHaveBeenCalledWith("settings");
    }
  );
});
