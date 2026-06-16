import { readFileSync } from "node:fs";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import cytoscape from "cytoscape";
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
      create: vi.fn(),
      auditBundle: vi.fn(),
      auditBundleArchive: vi.fn(),
    },
    repositories: {
      branches: vi.fn(),
    },
    system: {
      health: vi.fn(),
    },
  },
}));

vi.mock("cytoscape", () => ({
  default: vi.fn(() => ({
    destroy: vi.fn(),
    fit: vi.fn(),
    layout: vi.fn(() => ({ run: vi.fn() })),
    on: vi.fn(),
  })),
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

const repositoryGraphFixture = {
  version: "repository-graph/0.1",
  stats: { nodes: 2, edges: 1, languages: ["JavaScript"], truncated: false },
  nodes: [
    {
      id: "file:src/App.jsx",
      label: "App.jsx",
      type: "entrypoint",
      path: "src/App.jsx",
      importance: 0.9,
      tags: ["frontend"],
    },
    { id: "dir:src/screens", label: "src/screens", type: "module", path: "src/screens" },
  ],
  edges: [
    { id: "e1", source: "file:src/App.jsx", target: "dir:src/screens", type: "imports", weight: 1 },
  ],
  architectureSummary: {
    entrypoints: ["src/App.jsx"],
    modules: ["src/screens"],
    reviewHints: ["Review scan UI."],
    promptText: "Repository architecture: UI entrypoint.",
  },
};

const semanticGraphFixture = {
  version: "semantic-code-graph/0.1",
  summary: "UI semantic graph",
  stats: { files: 1, symbols: 2, relationships: 1, routes: 0, source: "static", truncated: false },
  nodes: [
    {
      id: "symbol:src/App.jsx:App",
      label: "App",
      type: "component",
      path: "src/App.jsx",
      line: 1,
      signature: "App()",
      importance: 0.9,
    },
    {
      id: "symbol:src/App.jsx:Flow",
      label: "Flow",
      type: "function",
      path: "src/App.jsx",
      line: 4,
      signature: "Flow()",
    },
  ],
  edges: [
    {
      id: "calls:symbol:src/App.jsx:App-symbol:src/App.jsx:Flow",
      source: "symbol:src/App.jsx:App",
      target: "symbol:src/App.jsx:Flow",
      type: "calls",
      weight: 1,
    },
  ],
  reviewHints: ["Review component call flow."],
};

const impactGraphFixture = {
  version: "impact-graph/0.1",
  mode: "changeset",
  summary: "Impact graph: auth session has direct tests, docs, config, and CI.",
  stats: {
    targets: 1,
    testedTargets: 1,
    documentedTargets: 1,
    configuredTargets: 1,
    testsEdges: 1,
    documentsEdges: 1,
    configuresEdges: 2,
    changedFiles: 1,
    truncated: false,
  },
  changedFiles: ["src/auth/session.ts"],
  targets: [
    {
      id: "file:src/auth/session.ts",
      path: "src/auth/session.ts",
      label: "session.ts",
      type: "file",
      risk: 0.74,
      relations: {
        tests: [
          {
            id: "file:tests/auth/session.test.ts",
            path: "tests/auth/session.test.ts",
            confidence: 0.95,
            evidence: [
              {
                kind: "import",
                file: "tests/auth/session.test.ts",
                line: 3,
                text: "import { createSession } from '../../src/auth/session'",
              },
            ],
          },
        ],
        documents: [{ id: "file:docs/auth.md", path: "docs/auth.md" }],
        configures: [{ id: "file:package.json", path: "package.json", type: "npm-script" }],
        ci: [{ id: "file:.github/workflows/ci.yml", path: ".github/workflows/ci.yml" }],
        importedBy: [{ id: "file:src/auth/index.ts", path: "src/auth/index.ts" }],
        imports: [],
        symbols: [],
      },
      gaps: ["no_direct_docs"],
    },
  ],
  coverage: {
    sourceFilesWithoutTests: ["src/no-test.ts"],
    sourceFilesWithoutDocs: ["src/auth/session.ts"],
    testsWithoutTargets: [],
    docsWithoutTargets: [],
  },
};

function cloneFixture(value) {
  return JSON.parse(JSON.stringify(value));
}

beforeEach(() => {
  setLang("en");
  cytoscape.mockClear();
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
  pullwiseApi.scans.create.mockReset();
  pullwiseApi.scans.create.mockImplementation((payload) =>
    Promise.resolve({
      id: `sc_${String(payload.repo || payload.repoId || "repo").replace(/\W+/g, "_")}`,
      repo: payload.repo || payload.repoId,
      branch: payload.branch || "main",
      commit: payload.commit || "pending",
      status: "queued",
      progress: 0,
    })
  );
  pullwiseApi.scans.auditBundle.mockReset();
  pullwiseApi.scans.auditBundleArchive.mockReset();
  pullwiseApi.repositories.branches.mockReset();
  pullwiseApi.repositories.branches.mockResolvedValue({
    defaultBranch: "main",
    branches: ["main", "develop"],
  });
  pullwiseApi.system.health.mockReset();
  pullwiseApi.system.health.mockResolvedValue({
    limits: {
      repository: { maxFiles: 2000, maxBytes: 50 * 1024 * 1024 },
    },
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

  it("renders repository list skeleton rows while repositories are loading", () => {
    useRepositories.mockReturnValue({
      items: [],
      installations: [],
      installationAccounts: [],
      loading: true,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    const { container } = render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(container.querySelector(".repos-skeleton")).toBeInTheDocument();
    expect(container.querySelectorAll(".repos-skeleton .repo-row")).toHaveLength(5);
    expect(screen.queryByText(/loading repositories/i)).not.toBeInTheDocument();
  });

  it("lets long repository owner tab sets slide horizontally", async () => {
    const user = userEvent.setup();
    const owners = ["GoAlpha", "GoBeta", "GoGamma", "GoDelta", "GoEpsilon", "GoZeta"];
    useRepositories.mockReturnValue({
      items: owners.map((owner, index) => ({
        ...repoAlpha,
        id: `repo_${index}`,
        name: `repo-${index}`,
        fullName: `${owner}/repo-${index}`,
      })),
      installations: [],
      installationAccounts: owners,
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    const tablist = screen.getByRole("tablist", { name: /repository owner filters/i });
    const scrollBy = vi.fn();
    tablist.scrollBy = scrollBy;
    Object.defineProperty(tablist, "clientWidth", { configurable: true, value: 300 });

    expect(tablist).toHaveClass("repos-orgs");
    expect(tablist).toHaveAttribute("aria-orientation", "horizontal");
    expect(tablist).toHaveAttribute("data-scrollable", "true");
    expect(within(tablist).getAllByRole("tab")).toHaveLength(owners.length + 1);

    await user.click(screen.getByRole("button", { name: /scroll repository filters right/i }));

    expect(scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: 240, behavior: "smooth" })
    );

    await user.click(screen.getByRole("tab", { name: "@GoDelta" }));

    expect(screen.getByRole("tab", { name: "@GoDelta" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
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

  it("starts multiple selected repository scans and opens scan history", async () => {
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
    await waitFor(() => expect(pullwiseApi.scans.create).toHaveBeenCalledTimes(2));
    expect(setActiveRepo).toHaveBeenCalledWith(null);
    const firstPayload = pullwiseApi.scans.create.mock.calls[0][0];
    const secondPayload = pullwiseApi.scans.create.mock.calls[1][0];
    expect(pullwiseApi.scans.create).toHaveBeenNthCalledWith(1, {
      repo: "octocat/alpha",
      branch: firstPayload.branch,
      commit: "pending",
      requestId: firstPayload.requestId,
    });
    expect(pullwiseApi.scans.create).toHaveBeenNthCalledWith(2, {
      repo: "octocat/beta",
      branch: secondPayload.branch,
      commit: "pending",
      requestId: secondPayload.requestId,
    });
    expect(firstPayload.requestId).toMatch(/^scan_req_/);
    expect(secondPayload.requestId).toMatch(/^scan_req_/);
    expect(secondPayload.requestId).not.toBe(firstPayload.requestId);
    expect(go).toHaveBeenCalledWith("history", {
      pendingScanIds: ["sc_octocat_alpha", "sc_octocat_beta"],
    });
    expect(go).not.toHaveBeenCalledWith("scanning");
  });

  it("selects repositories from the keyboard before opening scan history", async () => {
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
    await waitFor(() => expect(pullwiseApi.scans.create).toHaveBeenCalledTimes(2));
    expect(setActiveRepo).toHaveBeenCalledWith(null);
    expect(go).toHaveBeenCalledWith("history", {
      pendingScanIds: ["sc_octocat_alpha", "sc_octocat_beta"],
    });
    expect(go).not.toHaveBeenCalledWith("scanning");
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
      items: [{ ...repoAlpha, fork: true }],
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

  it("explains repository scan eligibility before starting a scan", async () => {
    useRepositories.mockReturnValue({
      items: [{ ...repoAlpha, fork: true }],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(await screen.findByText("Which repositories can be scanned")).toBeInTheDocument();
    expect(
      screen.getByText(
        /GitHub authorization.*account and repository quota.*worker checkout size limits/i
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Current checkout limit: 2,000 files / 50 MB.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (content, element) => element?.classList.contains("tag") && content.includes("fork")
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Forks share repository quota with their source repository/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/language is detected for context and is not an allowlist/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/selected branch must exist in GitHub/i)).toBeInTheDocument();
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
    expect(screen.getByText("哪些仓库可以扫描")).toBeInTheDocument();
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

  it("shows a scan detail skeleton while history scan details are loading", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_history",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc123",
        status: "done",
        progress: 100,
      },
      loading: true,
      error: "",
      cancel: vi.fn(),
    });

    const { container } = render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_history",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
          initialScan: {
            id: "sc_history",
            repo: "octocat/private-repo",
            branch: "main",
            status: "done",
          },
        }}
      />
    );

    const skeleton = container.querySelector(".scan-detail-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(within(skeleton).getByText("Loading scan details")).toBeInTheDocument();
    expect(screen.getByText(/not the final detail page yet/i)).toBeInTheDocument();
    expect(container.querySelector(".scan-detail-skeleton-side")).toBeInTheDocument();
    expect(screen.queryByText("Live findings")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();
  });

  it("notifies the parent when a single scan id is resolved", async () => {
    const onScanResolved = vi.fn();
    const scan = {
      id: "sc_created",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "pending",
      status: "queued",
      progress: 0,
    };
    useScanRun.mockReturnValue({
      scan,
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
        onScanResolved={onScanResolved}
      />
    );

    await waitFor(() => {
      expect(onScanResolved).toHaveBeenCalledWith(scan);
    });
  });

  it("shows compact findings and model usage for a completed scan", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        aiUsage: {
          agentCli: "codex",
          provider: "codex",
          model: "gpt-5.5",
          reasoningEffort: "high",
          inputTokens: 123,
          outputTokens: 45,
          totalTokens: 168,
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

    expect(screen.getByText("Live findings")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Review agent")).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.5")).toBeInTheDocument();
    expect(screen.getByText("reasoning: high")).toBeInTheDocument();
    expect(screen.queryByText("168 tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence status")).not.toBeInTheDocument();
    expect(screen.queryByText("Candidate audit")).not.toBeInTheDocument();
  });

  it("does not render empty metadata bars in scan audit panels", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        progress: 65,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
        completionAudit: {
          status: "passed",
          summary: "Completion audit has no extra metadata.",
        },
        jobTrace: {
          status: "running",
          summary: "Worker trace has no extra metadata.",
          checkpoints: [],
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ scanId: "sc_running", fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    const completionPanel = screen.getByText("Completion audit").closest(".scan-compact-panel");
    const tracePanel = screen.getByText("Job trace").closest(".scan-compact-panel");

    expect(completionPanel).not.toBeNull();
    expect(tracePanel).not.toBeNull();
    expect(completionPanel.querySelector(".scan-preflight-meta")).toBeNull();
    expect(tracePanel.querySelector(".scan-preflight-meta")).toBeNull();
  });

  it("renders every job trace checkpoint inside a scrollable list", () => {
    const checkpoints = Array.from({ length: 12 }, (_, index) => ({
      key: `checkpoint-${index + 1}`,
      label: `Checkpoint ${index + 1}`,
      status: index < 10 ? "done" : "running",
      at: `2026-06-12T00:${String(index + 1).padStart(2, "0")}:00Z`,
      jobId: "job_123",
      workerId: "worker_a",
      attempt: 1,
      summary: `Checkpoint ${index + 1} summary`,
    }));
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        progress: 65,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
        jobTrace: {
          status: "running",
          summary: "Worker is processing the scan.",
          currentJobId: "job_123",
          workerId: "worker_a",
          updatedAt: "2026-06-12T00:12:00Z",
          checkpoints,
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ scanId: "sc_running", fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    const traceList = screen.getByRole("list", { name: /job trace checkpoints/i });
    expect(within(traceList).getByText("Checkpoint 12")).toBeInTheDocument();
    expect(traceList.querySelectorAll(".scan-trace-item")).toHaveLength(12);
    expect(screen.queryByText(/\+\d+ more checkpoints/i)).not.toBeInTheDocument();

    const styles = readFileSync("styles/screens.css", "utf8");
    expect(styles).toMatch(
      /\.scan-audit-scroll,\s*\.scan-trace-list\s*\{[^}]*max-height:\s*clamp\(220px,\s*34vh,\s*360px\);/s
    );
    expect(styles).toMatch(
      /\.scan-audit-scroll,\s*\.scan-trace-list\s*\{[^}]*overflow-y:\s*auto;/s
    );
    expect(styles).toMatch(
      /\.scan-audit-scroll,\s*\.scan-trace-list\s*\{[^}]*overscroll-behavior-y:\s*contain;/s
    );
  });

  it("keeps completion audit detail lists scrollable in the scan side panel", () => {
    const checks = Array.from({ length: 14 }, (_, index) => ({
      key: `check-${index + 1}`,
      label: `Audit check ${index + 1}`,
      status: index < 12 ? "passed" : "warning",
      summary: `Audit check ${index + 1} result detail`,
    }));
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
        completionAudit: {
          status: "warning",
          outcome: "partial",
          summary: "Completion audit captured worker checks.",
          completedAt: "2026-06-12T00:14:00Z",
          checks,
        },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ scanId: "sc_done", fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    expect(screen.getByText("Completion audit")).toBeInTheDocument();
    const auditScroll = document.querySelector(".scan-audit-scroll");
    expect(auditScroll).not.toBeNull();
    expect(within(auditScroll).getByText("Audit check 14")).toBeInTheDocument();
    expect(auditScroll.querySelectorAll(".scan-compact-item")).toHaveLength(14);
  });

  it("hides Audit Swarm evidence and download until the review phase finishes", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "ai",
        progress: 75,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        auditSwarm: {
          protocol: "audit-swarm/0.1",
          stage: "discovery",
          summary: "Reviewer agents are still evaluating candidates.",
          counts: {
            evidenceBlocks: 3,
            candidateCount: 2,
            reportedCount: 1,
          },
          evidenceBlocks: [
            {
              id: "issue-refresh:evidence:0",
              kind: "evidence",
              title: "Discovery evidence",
              summary: "createRefreshToken runs before old-token invalidation is confirmed.",
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
          scanId: "sc_running",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
        }}
      />
    );

    expect(
      screen.getAllByText("Audit Swarm review").find((node) => node.closest(".scanning-phase"))
    ).toBeTruthy();
    expect(screen.queryByText("Audit evidence")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /evidence blocks/i })).not.toBeInTheDocument();
    expect(pullwiseApi.scans.auditBundleArchive).not.toHaveBeenCalled();
  });

  it("shows compact Audit Swarm evidence from the worker scan payload", () => {
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
              id: "issue-refresh:location:duplicate",
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
    expect(
      screen.getByText("7 evidence blocks in the downloaded audit bundle")
    ).toBeInTheDocument();
    expect(screen.getByText("Candidates")).toBeInTheDocument();
    expect(screen.getByText("Reported")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByText("Claim")).not.toBeInTheDocument();
    expect(screen.queryByText("src/auth/refresh.ts:42")).not.toBeInTheDocument();
    expect(screen.queryByText("Refresh token rotation may not be atomic")).not.toBeInTheDocument();
    expect(screen.queryByText("pnpm test auth -- refresh-token-rotation")).not.toBeInTheDocument();
  });

  it("keeps long audit evidence card text inside the card without clamping", () => {
    const styles = readFileSync("styles/screens.css", "utf8");

    expect(styles).toMatch(/\.audit-card\s*{[^}]*min-width:\s*0;/s);
    expect(styles).toMatch(
      /\.audit-card-row\s*{[^}]*grid-template-columns:\s*88px minmax\(0,\s*1fr\);/s
    );
    expect(styles).toMatch(/\.audit-card-row > :where\(span,\s*code\)\s*{[^}]*min-width:\s*0;/s);
    expect(styles).toMatch(
      /\.audit-card-row > :where\(span,\s*code\)\s*{[^}]*white-space:\s*normal;/s
    );
    expect(styles).toMatch(/\.audit-card-row > \.evidence-command\s*{[^}]*overflow:\s*visible;/s);
    expect(styles).toMatch(/\.audit-card-row > \.evidence-command\s*{[^}]*white-space:\s*normal;/s);
    expect(styles).not.toMatch(/\.audit-card-row > :where\(span,\s*code\)\s*{[^}]*line-clamp/s);
  });

  it("shows the repository graph for scans that include graph data", async () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_graph",
        repo: "octocat/graph",
        branch: "main",
        commit: "abc123",
        status: "running",
        phase: "index",
        progress: 35,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
        repositoryGraph: repositoryGraphFixture,
        semanticGraph: semanticGraphFixture,
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ scanId: "sc_graph", fullName: "octocat/graph", defaultBranch: "main" }}
      />
    );

    expect(screen.getByText("Repository graph")).toBeInTheDocument();
    expect(screen.getByText("2 nodes")).toBeInTheDocument();
    expect(screen.getByText("1 edge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fit graph/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /App\.jsx/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Review scan UI.")).not.toBeInTheDocument();
    expect(document.querySelector(".repository-graph-node-list")).not.toBeInTheDocument();
    expect(document.querySelector(".repository-graph-hints")).not.toBeInTheDocument();
    const fileDetails = document.querySelector(".repository-graph-details");
    expect(fileDetails).toHaveTextContent("App.jsx");
    expect(fileDetails).toHaveTextContent("src/App.jsx");
    expect(fileDetails).toHaveTextContent("entrypoint");

    const fileGraphConfig = cytoscape.mock.calls[0][0];
    expect(fileGraphConfig.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ id: "file:src/App.jsx", label: "App.jsx" }),
        }),
      ])
    );
    expect(fileGraphConfig.style.find((entry) => entry.selector === "node").style).toMatchObject({
      content: "data(label)",
      label: "data(label)",
      "text-opacity": 1,
    });
    expect(fileGraphConfig.layout).toMatchObject({
      animationDuration: 650,
      animationEasing: "ease-out-cubic",
    });
    const cy = cytoscape.mock.results[0].value;
    const nodeTapHandler = cy.on.mock.calls.find(
      ([eventName, selector]) => eventName === "tap" && selector === "node"
    )?.[2];
    expect(typeof nodeTapHandler).toBe("function");
    act(() => {
      nodeTapHandler({ target: { id: () => "dir:src/screens" } });
    });
    expect(document.querySelector(".repository-graph-details")).toHaveTextContent("src/screens");

    const viewTrigger = screen.getByRole("button", { name: /graph view/i });
    expect(viewTrigger).toHaveTextContent(/file graph/i);
    await userEvent.click(viewTrigger);
    await userEvent.click(await screen.findByRole("option", { name: /semantic graph/i }));

    expect(screen.getByText("2 symbols")).toBeInTheDocument();
    expect(screen.getByText("1 relationship")).toBeInTheDocument();
    expect(screen.getByText("static")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /App component/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Review component call flow.")).not.toBeInTheDocument();
    expect(document.querySelector(".repository-graph-details")).toHaveTextContent("App()");
    const semanticGraphConfig = cytoscape.mock.calls[cytoscape.mock.calls.length - 1][0];
    expect(semanticGraphConfig.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ id: "symbol:src/App.jsx:App", label: "App" }),
        }),
      ])
    );
  });

  it("renders the repository graph canvas as a full-width landscape panel", () => {
    const styles = readFileSync("styles/screens.css", "utf8");
    const canvasBlock = styles.match(/\.repository-graph-canvas\s*\{(?<body>[^}]*)\}/s)?.groups
      ?.body;

    expect(canvasBlock).toBeTruthy();
    expect(canvasBlock).toMatch(/aspect-ratio:\s*16\s*\/\s*9;/);
    expect(canvasBlock).toMatch(/width:\s*100%;/);
    expect(canvasBlock).toMatch(/min-height:\s*320px;/);
    expect(canvasBlock).not.toMatch(/aspect-ratio:\s*1\s*\/\s*1;/);
    expect(canvasBlock).not.toMatch(/width:\s*min/);
    expect(canvasBlock).not.toMatch(/height:\s*clamp/);
  });

  it("renders the impact graph canvas as a full-width landscape panel", () => {
    const styles = readFileSync("styles/screens.css", "utf8");
    const canvasBlock = styles.match(/\.impact-graph-canvas\s*\{(?<body>[^}]*)\}/s)?.groups
      ?.body;
    const wrapBlock = styles.match(/\.impact-graph-canvas-wrap\s*\{(?<body>[^}]*)\}/s)?.groups
      ?.body;

    expect(canvasBlock).toBeTruthy();
    expect(canvasBlock).toMatch(/aspect-ratio:\s*16\s*\/\s*9;/);
    expect(canvasBlock).toMatch(/width:\s*100%;/);
    expect(canvasBlock).toMatch(/min-height:\s*320px;/);
    expect(wrapBlock).toBeTruthy();
    expect(wrapBlock).toMatch(/width:\s*100%;/);
  });

  it("shows impact graph summary, target relations, coverage gaps, and graph canvas", async () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_impact",
        repo: "octocat/impact",
        branch: "main",
        commit: "abc123",
        status: "done",
        phase: "report",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        impactGraph: impactGraphFixture,
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ scanId: "sc_impact", fullName: "octocat/impact", defaultBranch: "main" }}
      />
    );

    expect(screen.getByText("Impact context")).toBeInTheDocument();
    expect(screen.getByText("impact-graph/0.1")).toBeInTheDocument();
    expect(screen.getByText("changeset")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /graph/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Tests, docs, config, and CI")).toBeInTheDocument();
    expect(cytoscape).toHaveBeenCalled();
    const graphConfig = cytoscape.mock.calls[cytoscape.mock.calls.length - 1][0];
    expect(graphConfig.layout).toMatchObject({
      name: "breadthfirst",
      directed: true,
      direction: "downward",
      grid: true,
      avoidOverlap: true,
    });
    expect(graphConfig.layout.direction).not.toBe("rightward");
    expect(graphConfig.layout.boundingBox).toMatchObject({ x1: 0, y1: 0 });
    expect(graphConfig.layout.boundingBox.w).toBeGreaterThan(graphConfig.layout.boundingBox.h);
    expect(graphConfig.wheelSensitivity).toBeUndefined();
    expect(graphConfig.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ id: "file:src/auth/session.ts", role: "target" }),
        }),
        expect.objectContaining({
          data: expect.objectContaining({ label: "tests/auth/session.test.ts", role: "tests" }),
        }),
      ])
    );

    await userEvent.click(screen.getByRole("tab", { name: /summary/i }));

    expect(screen.getAllByText("src/auth/session.ts").length).toBeGreaterThan(0);
    expect(screen.getByText("tests/auth/session.test.ts")).toBeInTheDocument();
    expect(screen.getByText("docs/auth.md")).toBeInTheDocument();
    expect(screen.getByText("package.json")).toBeInTheDocument();
    expect(screen.getByText(".github/workflows/ci.yml")).toBeInTheDocument();
    expect(screen.getByText("src/no-test.ts")).toBeInTheDocument();
  });

  it("shows a graceful impact fallback when a terminal scan has no impact graph", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_no_impact",
        repo: "octocat/no-impact",
        branch: "main",
        commit: "abc123",
        status: "done",
        phase: "report",
        progress: 100,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_no_impact",
          fullName: "octocat/no-impact",
          defaultBranch: "main",
        }}
      />
    );

    expect(screen.getByText("Impact graph unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This scan did not return an impact graph. Repository graph and issue evidence remain available."
      )
    ).toBeInTheDocument();
  });

  it("keeps the impact graph instance stable across running scan refreshes", () => {
    const go = vi.fn();
    const cancel = vi.fn();
    const activeRepo = { scanId: "sc_impact", fullName: "octocat/impact", defaultBranch: "main" };
    const scan = {
      id: "sc_impact",
      repo: "octocat/impact",
      branch: "main",
      commit: "abc123",
      status: "running",
      phase: "index",
      progress: 35,
      issues: { critical: 0, high: 0, medium: 0, low: 0 },
      impactGraph: impactGraphFixture,
    };
    useScanRun.mockReturnValue({ scan, error: "", cancel });

    const { rerender } = render(<ScanningScreen go={go} activeRepo={activeRepo} />);

    expect(cytoscape).toHaveBeenCalledTimes(1);
    expect(cytoscape.mock.calls[0][0].elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ id: "file:src/auth/session.ts", role: "target" }),
        }),
      ])
    );
    const cy = cytoscape.mock.results[0].value;

    useScanRun.mockReturnValue({
      scan: {
        ...scan,
        phase: "ai",
        progress: 62,
        impactGraph: cloneFixture(impactGraphFixture),
      },
      error: "",
      cancel,
    });

    rerender(<ScanningScreen go={go} activeRepo={activeRepo} />);

    expect(cytoscape).toHaveBeenCalledTimes(1);
    expect(cy.destroy).not.toHaveBeenCalled();
    expect(cy.layout).not.toHaveBeenCalled();
  });

  it("keeps the repository graph instance stable across running scan refreshes", () => {
    const go = vi.fn();
    const cancel = vi.fn();
    const activeRepo = { scanId: "sc_graph", fullName: "octocat/graph", defaultBranch: "main" };
    const scan = {
      id: "sc_graph",
      repo: "octocat/graph",
      branch: "main",
      commit: "abc123",
      status: "running",
      phase: "index",
      progress: 35,
      issues: { critical: 0, high: 0, medium: 0, low: 0 },
      repositoryGraph: repositoryGraphFixture,
      semanticGraph: semanticGraphFixture,
    };
    useScanRun.mockReturnValue({ scan, error: "", cancel });

    const { rerender } = render(<ScanningScreen go={go} activeRepo={activeRepo} />);

    expect(cytoscape).toHaveBeenCalledTimes(1);
    expect(cytoscape.mock.calls[0][0]).toMatchObject({
      userPanningEnabled: true,
      userZoomingEnabled: true,
    });
    const cy = cytoscape.mock.results[0].value;

    useScanRun.mockReturnValue({
      scan: {
        ...scan,
        phase: "ai",
        progress: 62,
        repositoryGraph: cloneFixture(repositoryGraphFixture),
        semanticGraph: cloneFixture(semanticGraphFixture),
      },
      error: "",
      cancel,
    });

    rerender(<ScanningScreen go={go} activeRepo={activeRepo} />);

    expect(cytoscape).toHaveBeenCalledTimes(1);
    expect(cy.destroy).not.toHaveBeenCalled();
    expect(cy.layout).not.toHaveBeenCalled();
  });

  it("does not render the retired audit funnel for completed scans", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 0, medium: 1, low: 0 },
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

    expect(screen.queryByRole("img", { name: /audit funnel/i })).not.toBeInTheDocument();
    expect(document.querySelector(".audit-funnel-fill")).not.toBeInTheDocument();
    expect(document.querySelector(".audit-funnel-metric")).not.toBeInTheDocument();
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
          repositoryStats: {
            fileCount: 2001,
            totalBytes: 50 * 1024 * 1024 + 1,
            scanStoppedEarly: true,
          },
          repositoryLimits: { maxFiles: 2000, maxBytes: 50 * 1024 * 1024 },
          repositoryLimitExceeded: true,
          repositoryLimitReasons: ["file_count", "total_bytes"],
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
    expect(screen.getByText("Repository scan limits")).toBeInTheDocument();
    expect(screen.getByText("Checkout: 2,001 files / 50 MB")).toBeInTheDocument();
    expect(screen.getByText("Limit: 2,000 files / 50 MB")).toBeInTheDocument();
    expect(screen.getByText("Reasons: file count, total size")).toBeInTheDocument();
    expect(screen.getByText("Counting stopped after a limit was reached.")).toBeInTheDocument();
    expect(screen.getByText("1 manifests")).toBeInTheDocument();
    expect(screen.getByText("1 tool checks")).toBeInTheDocument();
    expect(screen.getByText("Linux 6.8.0 x86_64")).toBeInTheDocument();
    expect(screen.getByText("2 verifier runs")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("1 flaky")).toBeInTheDocument();
    expect(screen.getByText("build, test")).toBeInTheDocument();
  });

  it("stacks repository scan limit evidence as a vertical list", () => {
    const styles = readFileSync("styles/screens.css", "utf8");
    const limitMetaBlock = styles.match(
      /\.scanning-preflight \.scan-repository-limits \.scan-preflight-meta\s*\{(?<body>[^}]*)\}/s
    )?.groups?.body;

    expect(limitMetaBlock).toBeTruthy();
    expect(limitMetaBlock).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\);/);
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

  it("cancels active scans from the detail page without navigating away", async () => {
    const go = vi.fn();
    const cancel = vi.fn().mockResolvedValue();
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

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalledWith("history");
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

  it("shows the production worker scan phases", () => {
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

  it("does not reintroduce removed local scan phases for stale phase names", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "secrets",
        progress: 40,
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
    expect(within(phases).queryByText("Scanning for secrets")).not.toBeInTheDocument();
    expect(within(phases).queryByText("Analyzing dependencies")).not.toBeInTheDocument();
  });

  it("does not render a standalone progress track in scan details", () => {
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

    const { container } = render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    expect(container.querySelector(".scanning-bar-wrap")).not.toBeInTheDocument();
    expect(container.querySelector(".scanning-bar")).not.toBeInTheDocument();
    expect(screen.getByText("Audit Swarm review")).toBeInTheDocument();
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
  ])(
    "routes missing CLI provider errors to settings without exposing the runner name",
    async (message) => {
      const user = userEvent.setup();
      const { go } = renderScanError(message);

      const action = screen.getByRole("link", { name: /open settings/i });
      expect(action).toHaveAttribute("href", "/settings");

      await user.click(action);

      expect(screen.getByRole("alert")).toHaveTextContent(/review runner is missing/i);
      expect(screen.getByRole("alert")).not.toHaveTextContent(/codex/i);
      expect(go).toHaveBeenCalledWith("settings");
    }
  );
});
