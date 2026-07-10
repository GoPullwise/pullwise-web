import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLang } from "../i18n.jsx";
import { ReposScreen, ScanningScreen } from "./flow.jsx";
import { NotificationProvider } from "../components/notifications.jsx";

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
    apiKeys: {
      createAuditBundleKey: vi.fn(),
    },
    repositories: {
      branches: vi.fn(),
    },
    system: {
      health: vi.fn(),
    },
  },
}));

vi.mock("../lib/pullwise-data.js", () => ({
  isTerminalScan: (scan) =>
    ["done", "failed", "cancelled", "partial_completed"].includes(scan?.status),
  scanCanDownloadAuditBundle: (scan) =>
    ["done", "failed", "partial_completed"].includes(scan?.status) &&
    !(scan?.error && scan?.errorCode === "WORKER_ARTIFACT_INVALID"),
  scanHasResults: (scan) => ["done", "failed", "partial_completed"].includes(scan?.status),
  scanQueueSummary: (scan) =>
    scan?.queue
      ? {
          message: scan.queue.message || "",
          tags: [
            scan.queue.position ? `Position ${scan.queue.position}` : null,
            typeof scan.queue.ahead === "number" ? `${scan.queue.ahead} scans ahead` : null,
          ].filter(Boolean),
        }
      : null,
  useIssues: vi.fn(() => ({ items: [], loading: false, error: "" })),
  useRepositories: vi.fn(),
  useScans: vi.fn(() => ({ items: [] })),
  useScanBatchRun: vi.fn(),
  useScanRun: vi.fn(),
}));

import { useRepositories, useScanBatchRun, useScanRun } from "../lib/pullwise-data.js";
import { connectGitHubRepositories, manageGitHubInstallation } from "../lib/auth.js";
import { pullwiseApi } from "../api/pullwise.js";
import { env } from "../config/env.js";

function firePointerEvent(target, type, options = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: options.button ?? 0,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0,
  });
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: options.pointerId ?? 1,
  });
  fireEvent(target, event);
}

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

const repoGamma = {
  id: "repo_gamma",
  name: "gamma",
  fullName: "acme/gamma",
  desc: "Gamma service",
  lang: "Go",
  stars: 5,
  branches: 1,
  updated: "Today",
  defaultBranch: "main",
};

function deferredPromise() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

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
  pullwiseApi.apiKeys.createAuditBundleKey.mockReset();
  pullwiseApi.apiKeys.createAuditBundleKey.mockResolvedValue({
    key: "pwk_temp_bundle_token",
    expiresAt: 1780000900,
    restrictions: { kind: "audit_bundle", scanId: "sc_done", repoId: "repo_123" },
  });
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
    <NotificationProvider>
      <ScanningScreen
        go={go}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    </NotificationProvider>
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

    expect(screen.getByRole("tab", { name: "@GoDelta" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps selected repositories when switching owner filters before starting scans", async () => {
    const go = vi.fn();
    const setActiveRepo = vi.fn();
    const user = userEvent.setup();
    useRepositories.mockImplementation(({ owner = "" } = {}) => ({
      items: owner === "acme" ? [repoGamma] : [repoAlpha, repoBeta],
      installations: [],
      installationAccounts: ["octocat", "acme"],
      loading: false,
      loadingMore: false,
      error: "",
      needsAuthorization: false,
      meta: owner === "acme" ? { total: 1 } : { total: 2 },
      reload: vi.fn(),
      loadMore: vi.fn(),
    }));

    render(<ReposScreen go={go} setActiveRepo={setActiveRepo} />);

    await user.click(screen.getByRole("tab", { name: "@octocat" }));
    await user.click(screen.getByText("octocat/alpha").closest(".repo-row"));
    expect(screen.getByRole("button", { name: /start scan/i })).toHaveTextContent("(1)");

    await user.click(screen.getByRole("tab", { name: "@acme" }));
    expect(screen.queryByText("octocat/alpha")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start scan/i })).toHaveTextContent("(1)");

    await user.click(screen.getByText("acme/gamma").closest(".repo-row"));
    await user.click(screen.getByRole("button", { name: /start scan/i }));

    await waitFor(() => expect(pullwiseApi.scans.create).toHaveBeenCalledTimes(2));
    expect(pullwiseApi.scans.preflight).toHaveBeenCalledWith({
      repositories: [
        expect.objectContaining({ repo: "octocat/alpha" }),
        expect.objectContaining({ repo: "acme/gamma" }),
      ],
    });
    expect(setActiveRepo).toHaveBeenCalledWith(null);
    expect(go).toHaveBeenCalledWith("history", expect.any(Object));
  });

  it("requests the selected owner page when an owner tab has no repositories in the current page", async () => {
    const user = userEvent.setup();
    const firstPageRepos = Array.from({ length: 50 }, (_, index) => ({
      ...repoAlpha,
      id: `repo_octocat_${index}`,
      name: `repo-${index}`,
      fullName: `octocat/repo-${index}`,
    }));
    const acmeRepo = {
      ...repoAlpha,
      id: "repo_acme_api",
      name: "api",
      fullName: "acme/api",
    };
    const acmeRepos = [acmeRepo];

    const reload = vi.fn();
    const loadMore = vi.fn();
    useRepositories.mockImplementation(({ owner = "" } = {}) => ({
      items: owner === "acme" ? acmeRepos : firstPageRepos,
      installations: [],
      installationAccounts: ["octocat", "acme"],
      loading: false,
      loadingMore: false,
      error: "",
      needsAuthorization: false,
      meta:
        owner === "acme"
          ? { total: 1, hasMore: false, nextOffset: null }
          : { total: 114, hasMore: true, nextOffset: 50 },
      reload,
      loadMore,
    }));

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    expect(screen.getByText("octocat/repo-0")).toBeInTheDocument();
    expect(screen.queryByText("acme/api")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "@acme" }));

    expect(useRepositories).toHaveBeenLastCalledWith({ owner: "acme", q: "" });
    expect(screen.getByText("acme/api")).toBeInTheDocument();
    expect(screen.queryByText("More repositories available")).not.toBeInTheDocument();
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
    expect(appStyles).toMatch(/\.review-run-metrics b\s*\{[^}]*font-size:\s*16px;/s);
    expect(appStyles).toMatch(/\.review-run-metrics b\s*\{[^}]*font-weight:\s*650;/s);
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
      pendingScanRequests: [
        expect.objectContaining({
          scanId: "sc_octocat_alpha",
          repo: "octocat/alpha",
          branch: firstPayload.branch,
          requestId: firstPayload.requestId,
        }),
        expect.objectContaining({
          scanId: "sc_octocat_beta",
          repo: "octocat/beta",
          branch: secondPayload.branch,
          requestId: secondPayload.requestId,
        }),
      ],
      pendingScanStartedAt: expect.any(Number),
    });
    expect(go).not.toHaveBeenCalledWith("scanning");
  });

  it("serializes a batch scan submission before loading state is committed", async () => {
    const preflight = deferredPromise();
    pullwiseApi.scans.preflight.mockReturnValue(preflight.promise);
    useRepositories.mockReturnValue({
      items: [repoAlpha, repoBeta],
      installations: [],
      installationAccounts: [],
      loading: false,
      error: "",
      needsAuthorization: false,
      reload: vi.fn(),
    });
    const user = userEvent.setup();

    render(<ReposScreen go={vi.fn()} setActiveRepo={vi.fn()} />);

    await user.click(screen.getByText("octocat/alpha").closest(".repo-row"));
    await user.click(screen.getByText("octocat/beta").closest(".repo-row"));
    const start = screen.getByRole("button", { name: /start scan/i });
    act(() => {
      start.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      start.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(pullwiseApi.scans.preflight).toHaveBeenCalledTimes(1));
    preflight.resolve({ requestedCount: 2, allowedCount: 2, repositories: [] });
    await waitFor(() => expect(pullwiseApi.scans.create).toHaveBeenCalledTimes(2));
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
    const firstPayload = pullwiseApi.scans.create.mock.calls[0][0];
    const secondPayload = pullwiseApi.scans.create.mock.calls[1][0];
    expect(setActiveRepo).toHaveBeenCalledWith(null);
    expect(go).toHaveBeenCalledWith("history", {
      pendingScanIds: ["sc_octocat_alpha", "sc_octocat_beta"],
      pendingScanRequests: [
        expect.objectContaining({
          scanId: "sc_octocat_alpha",
          repo: "octocat/alpha",
          branch: firstPayload.branch,
          requestId: firstPayload.requestId,
        }),
        expect.objectContaining({
          scanId: "sc_octocat_beta",
          repo: "octocat/beta",
          branch: secondPayload.branch,
          requestId: secondPayload.requestId,
        }),
      ],
      pendingScanStartedAt: expect.any(Number),
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /branch for octocat\/alpha/i })).toHaveAttribute(
        "title",
        "Branch: release/1.0"
      )
    );
    const updatedBranchTrigger = screen.getByRole("button", {
      name: /branch for octocat\/alpha/i,
    });
    expect(updatedBranchTrigger.closest(".repo-branch-picker")).toHaveAttribute(
      "title",
      "Branch: release/1.0"
    );
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

    expect(await screen.findByRole("alert")).toHaveTextContent(/1 scan left/i);
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
    expect(screen.getByRole("button", { name: /\u5f00\u59cb\u626b\u63cf/i })).toBeInTheDocument();
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
      <NotificationProvider>
        <ScanningScreen
          go={vi.fn()}
          activeRepo={{
            selectedRepos: [
              { ...repoAlpha, scanRequestId: "scan_req_alpha" },
              { ...repoBeta, scanRequestId: "scan_req_beta" },
            ],
          }}
        />
      </NotificationProvider>
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
    expect(container.querySelector(".scan-progress-skeleton")).toBeInTheDocument();
    expect(
      container.querySelector(".scan-detail-skeleton .scanning-flow-viewport")
    ).toBeInTheDocument();
    expect(screen.getByText("Loading scan details")).toBeInTheDocument();
    expect(container.querySelector(".scan-detail-loading-note")).not.toBeInTheDocument();
    expect(screen.queryByText(/not the final detail page yet/i)).not.toBeInTheDocument();
    expect(container.querySelector(".scan-detail-skeleton-side")).toBeInTheDocument();
    expect(screen.queryByText("Live findings")).not.toBeInTheDocument();
    expect(screen.queryByText("Finding summary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();
  });

  it("uses a full-width scan header and compact divided result bands", () => {
    const styles = readFileSync("styles/screens.css", "utf8");

    expect(styles).toMatch(/\.scanning-progress\s*\{[^}]*min-height:\s*8px;/s);
    expect(styles).toMatch(/\.scanning-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s);
    expect(styles).toMatch(/\.scan-detail-primary\s*\{[^}]*display:\s*grid;/s);
    expect(styles).toMatch(
      /\.scanning-counts-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s
    );
    expect(styles).toMatch(/\.scanning-counts-grid\s*\{[^}]*gap:\s*0;/s);
    expect(styles).toMatch(/\.scanning-log-body\s*\{[^}]*min-height:\s*128px;/s);
    expect(styles).toMatch(
      /@media \(max-width: 900px\)\s*\{[\s\S]*?\.scanning,\s*\.scanning\.scanning-wide\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s
    );
  });

  it("keeps scan progress flow nodes flat with tuned dark-mode colors", () => {
    const styles = readFileSync("styles/screens.css", "utf8");
    const flowBlock = styles.match(/\.scanning-flow\s*\{(?<body>[\s\S]*?)\n\.scanning-side\s*\{/s)
      ?.groups?.body;
    const darkNodeBlock = styles.match(
      /\[data-theme="dark"\] \.scanning-phase\s*\{(?<body>[^}]*)\}/s
    )?.groups?.body;

    expect(flowBlock).toBeTruthy();
    expect(flowBlock).not.toMatch(/box-shadow\s*:/);
    expect(flowBlock).not.toMatch(/radial-gradient/);
    expect(flowBlock).toMatch(/\.scanning-phase\s*\{[^}]*border-radius:\s*0;/s);
    expect(flowBlock).toMatch(/\.scanning-flow-edge\.active\s*\{/);
    expect(darkNodeBlock).toBeTruthy();
    expect(darkNodeBlock).toMatch(
      /--phase-surface:\s*color-mix\(in oklch, var\(--bg-elev\) 90%, var\(--phase-accent\) 10%\);/
    );
    expect(darkNodeBlock).not.toMatch(/radial-gradient/);
  });

  it("hides result-only panels while a scan is still running", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "ai",
        progress: 32,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
        aiUsage: {},
        preflight: {
          mode: "",
          execution: "",
          summary: "",
          packageManagers: [],
          languages: [],
          availableScripts: [],
          manifests: [],
          toolVersions: [],
          environment: null,
        },
      },
      loading: false,
      error: "",
      cancel: vi.fn(),
    });

    const { container } = render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_running",
          fullName: "octocat/private-repo",
          defaultBranch: "main",
        }}
      />
    );

    expect(screen.queryByText("Live findings")).not.toBeInTheDocument();
    expect(screen.queryByText("Finding summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Review agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Preflight evidence")).not.toBeInTheDocument();
    expect(container.querySelector(".scan-panel-loading")).not.toBeInTheDocument();
    expect(container.querySelector(".scanning-log-body .skeleton-stack")).toBeInTheDocument();
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

    expect(screen.getByText("Finding summary")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: ".scan-findings-total b" })).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Review agent")).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.5")).toBeInTheDocument();
    expect(screen.getByText("reasoning: high")).toBeInTheDocument();
    expect(screen.queryByText("168 tokens")).not.toBeInTheDocument();
  });

  it("renders only the debug bundle download for completed scan artifacts", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        phase: "report",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        reviewRun: {
          runId: "run_job_1",
          status: "completed",
          resultStatus: "done",
          artifactCount: 3,
          debugBundleUrl: "/v1/review-runs/run_job_1/artifacts/art_debug_bundle",
          qualityGate: { status: "pass" },
          progress: { overall_percent: 100 },
          summary: {
            overall_risk: "medium",
            result_status: "complete",
            finding_counts: { confirmed_high: 1, confirmed_critical: 0 },
          },
          artifacts: [
            {
              artifactId: "art_report_agent",
              name: "report.agent.json",
              kind: "report.agent",
              mediaType: "application/json",
              sizeBytes: 2,
              required: true,
              storage: {
                type: "server_artifact",
                url: "/v1/review-runs/run_job_1/artifacts/art_report_agent",
              },
            },
            {
              artifactId: "art_worker_log",
              name: "worker.log.jsonl",
              kind: "worker_log",
              mediaType: "application/jsonl",
              sizeBytes: 128,
              required: false,
              storage: {
                type: "server_artifact",
                url: "/v1/review-runs/run_job_1/artifacts/art_worker_log",
              },
            },
            {
              artifactId: "art_debug_bundle",
              name: "debug-bundle.zip",
              kind: "debug_bundle",
              mediaType: "application/zip",
              sizeBytes: 512,
              required: false,
              storage: {
                type: "server_artifact",
                url: "/v1/review-runs/run_job_1/artifacts/art_debug_bundle",
              },
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

    expect(screen.getByText("Review run")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("1 confirmed")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.queryByText("complete")).not.toBeInTheDocument();

    const debugBundle = screen.getByLabelText("Debug bundle");
    const debugBundleLink = within(debugBundle).getByRole("link", { name: "debug-bundle.zip" });
    expect(debugBundleLink).toHaveAttribute(
      "href",
      "/v1/review-runs/run_job_1/artifacts/art_debug_bundle"
    );
    expect(within(debugBundle).getByText("debug bundle")).toBeInTheDocument();
    expect(within(debugBundle).getByText("512 B")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "report.agent.json" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "worker.log.jsonl" })).not.toBeInTheDocument();
  });

  it("hides uninformative review run summary tags", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
        reviewRun: {
          runId: "run_job_1",
          status: "completed",
          qualityGate: { status: "pass" },
          progress: { overall_percent: 100 },
          summary: { overall_risk: "unknown", result_status: "complete" },
          artifacts: [],
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

    expect(screen.getByText("Review run")).toBeInTheDocument();
    expect(screen.queryByText("unknown")).not.toBeInTheDocument();
    expect(screen.queryByText("complete")).not.toBeInTheDocument();
    expect(document.querySelector(".review-run-summary-line")).not.toBeInTheDocument();
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

  it("copies the agent fix prompt from scan details without rendering it", async () => {
    const user = userEvent.setup();
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const prompt =
      "AGENT_FIX_PROMPT_INTERNAL_TEXT\nAudit bundle ZIP: /api/v1/repositories/repo_123/scans/sc_done/audit-bundle.zip";
    const originalApiBase = env.VITE_API_BASE_URL;
    const originalPublicApiBase = env.VITE_PUBLIC_API_BASE_URL;
    env.VITE_API_BASE_URL = "/api";
    env.VITE_PUBLIC_API_BASE_URL = "";
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        repoId: "repo_123",
        agentFixPrompt: prompt,
      },
      error: "",
      cancel: vi.fn(),
    });

    try {
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

      expect(screen.queryByText(/AGENT_FIX_PROMPT_INTERNAL_TEXT/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /use agent to fix/i }));
      expect(pullwiseApi.apiKeys.createAuditBundleKey).toHaveBeenCalledWith("sc_done", "repo_123");
      expect(writeText).toHaveBeenCalledTimes(1);
      const copiedPrompt = writeText.mock.calls[0][0];
      expect(copiedPrompt).toContain(prompt);
      expect(copiedPrompt).toContain("Temporary audit bundle access:");
      expect(copiedPrompt).toContain("Authorization: Bearer pwk_temp_bundle_token");
      expect(copiedPrompt).toContain("curl -L");
      expect(copiedPrompt).toContain(
        "/api/v1/repositories/repo_123/scans/sc_done/audit-bundle.zip"
      );
      expect(copiedPrompt).not.toContain("https://api.pull-wise.com");
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    } finally {
      env.VITE_API_BASE_URL = originalApiBase;
      env.VITE_PUBLIC_API_BASE_URL = originalPublicApiBase;
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it("canonicalizes a root-relative public API base without duplicating the API prefix", async () => {
    const user = userEvent.setup();
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const originalPublicApiBase = env.VITE_PUBLIC_API_BASE_URL;
    env.VITE_PUBLIC_API_BASE_URL = "/api";
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { high: 1 },
        repoId: "repo_123",
        agentFixPrompt: "Fix the verified findings.",
      },
      error: "",
      cancel: vi.fn(),
    });

    try {
      render(
        <ScanningScreen
          go={vi.fn()}
          activeRepo={{ scanId: "sc_done", fullName: "octocat/private-repo" }}
        />
      );
      await user.click(screen.getByRole("button", { name: /use agent to fix/i }));

      const copiedPrompt = writeText.mock.calls[0][0];
      expect(copiedPrompt).toContain(
        `${window.location.origin}/api/v1/repositories/repo_123/scans/sc_done/audit-bundle.zip`
      );
      expect(copiedPrompt).not.toContain("/api/api/");
    } finally {
      env.VITE_PUBLIC_API_BASE_URL = originalPublicApiBase;
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it("renders one separator between each completed scan header action", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc1234",
        status: "done",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        repoId: "repo_123",
        agentFixPrompt: "Use the audit bundle to fix the finding.",
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

    const actions = screen.getByRole("button", { name: /back/i }).closest(".scanning-actions");
    expect(actions).not.toBeNull();
    expect(within(actions).getAllByRole("button")).toHaveLength(3);
    expect(actions.querySelectorAll(".scanning-actions-sep")).toHaveLength(2);
    expect(actions.querySelector(".scanning-actions-sep + .scanning-actions-sep")).toBeNull();
  });

  it("shows terminal scan without requiring a generated review report", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_without_generated_report",
        repo: "octocat/no-report",
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
          scanId: "sc_without_generated_report",
          fullName: "octocat/no-report",
          defaultBranch: "main",
        }}
      />
    );
    expect(screen.getByRole("button", { name: /audit bundle/i })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();
  });

  it("shows a debug bundle download action from completed scan details", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc123",
        status: "done",
        phase: "report",
        progress: 100,
        debugBundleUrl: "/v1/review-runs/run_job_1/artifacts/art_debug_bundle",
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
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

    expect(screen.getByRole("button", { name: /audit bundle/i })).toBeEnabled();
    const debugBundleAction = screen.getByRole("link", { name: /debug bundle/i });
    expect(debugBundleAction).toHaveAttribute(
      "href",
      "/v1/review-runs/run_job_1/artifacts/art_debug_bundle"
    );
    expect(debugBundleAction).toHaveAttribute("download", "debug-bundle.zip");
  });

  it("does not render a debug bundle action for an executable URL scheme", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_done",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc123",
        status: "done",
        phase: "report",
        progress: 100,
        debugBundleUrl: "javascript:alert(document.domain)",
        issues: { critical: 0, high: 0, medium: 0, low: 0 },
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

    expect(screen.queryByRole("link", { name: /debug bundle/i })).not.toBeInTheDocument();
  });

  it("shows the worker human report when a completed scan has no generated report", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_human_report",
        repo: "octocat/report",
        branch: "main",
        commit: "abc123",
        status: "done",
        phase: "report",
        progress: 100,
        issues: { critical: 0, high: 1, medium: 0, low: 0 },
        humanReport: { summaryMarkdown: "# Review\n\n- Found one high priority issue." },
      },
      error: "",
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{
          scanId: "sc_human_report",
          fullName: "octocat/report",
          defaultBranch: "main",
        }}
      />
    );

    expect(screen.getByText("Review report")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(
      within(document.querySelector(".scan-human-report")).getByRole("listitem")
    ).toHaveTextContent("Found one high priority issue.");
    expect(document.querySelector(".scan-human-report pre")).not.toBeInTheDocument();
    const report = document.querySelector(".scan-human-report");
    const execution = document.querySelector(".scan-execution-panel");
    expect(
      report.compareDocumentPosition(execution) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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
          execution: "review_worker_run",
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
    expect(screen.getByText("review_worker_run")).toBeInTheDocument();
    expect(screen.getByText("pnpm")).toBeInTheDocument();
    expect(screen.getByText("Repository scan limits")).toBeInTheDocument();
    expect(screen.getByText("Checkout: 2,001 files / 50 MB")).toBeInTheDocument();
    expect(screen.getByText("Limit: 2,000 files / 50 MB")).toBeInTheDocument();
    expect(screen.getByText("Reasons: file count, total size")).toBeInTheDocument();
    expect(screen.getByText("Counting stopped after a limit was reached.")).toBeInTheDocument();
    expect(screen.getByText("1 manifests")).toBeInTheDocument();
    expect(screen.getByText("1 tool checks")).toBeInTheDocument();
    expect(screen.getByText("Linux 6.8.0 x86_64")).toBeInTheDocument();
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

  it("marks a partial batch startup failure as failed after created scans finish", async () => {
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
      <NotificationProvider>
        <ScanningScreen
          go={vi.fn()}
          activeRepo={{
            selectedRepos: [
              { ...repoAlpha, scanRequestId: "scan_req_alpha" },
              { ...repoBeta, scanRequestId: "scan_req_beta" },
            ],
          }}
        />
      </NotificationProvider>
    );

    expect(screen.getByText(/scan batch failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/scan batch queued/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1\/2 scans created, 1 not created/i)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(/repository quota exhausted/i);
    expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();
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

  it("downloads audit bundles from completed scan details", async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:pullwise-audit");
    const revokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    pullwiseApi.scans.auditBundleArchive.mockResolvedValueOnce(
      new Blob(["zip"], { type: "application/zip" })
    );
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
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

    try {
      render(
        <ScanningScreen
          go={go}
          activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
        />
      );

      expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /audit bundle/i }));

      expect(go).not.toHaveBeenCalledWith("dashboard");
      expect(pullwiseApi.scans.auditBundleArchive).toHaveBeenCalledWith("sc_done");
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:pullwise-audit");
    } finally {
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", {
          configurable: true,
          value: originalCreateObjectURL,
        });
      } else {
        delete URL.createObjectURL;
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", {
          configurable: true,
          value: originalRevokeObjectURL,
        });
      } else {
        delete URL.revokeObjectURL;
      }
      click.mockRestore();
    }
  });

  it("disables audit bundle downloads for cancelled scan details", async () => {
    const user = userEvent.setup();
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_cancelled",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "abc123",
        status: "cancelled",
        progress: 62,
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

    const auditBundle = screen.getByRole("button", { name: /audit bundle/i });
    expect(auditBundle).toBeDisabled();
    expect(screen.queryByRole("button", { name: /overview/i })).not.toBeInTheDocument();

    await user.click(auditBundle);

    expect(pullwiseApi.scans.auditBundleArchive).not.toHaveBeenCalled();
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

  it("shows worker-reported scan phases without a web-owned fixed flow", () => {
    const logTimestamp = 1700000000;
    const currentTimestamp = 1700007200;
    const expectedLogTime = new Date(logTimestamp * 1000).toLocaleTimeString();
    const currentTime = new Date(currentTimestamp * 1000).toLocaleTimeString();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(currentTimestamp * 1000));
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "custom_review",
        progress: 62,
        updatedAt: currentTimestamp,
        progressMessage: "Reviewing billing guardrails",
        logsSummary: "worker=custom-review phase=custom_review",
        progressSteps: [
          { id: "checkout", label: "Checkout", status: "completed", percent: 100 },
          { id: "custom_review", label: "Custom review", status: "running", percent: 40 },
          { id: "publish", label: "Publish", status: "pending", percent: 0 },
        ],
        progressLogs: [
          {
            time: logTimestamp,
            phase: "custom_review",
            progress: 62,
            message: "Reviewing billing guardrails",
            logsSummary: "worker=custom-review phase=custom_review",
          },
        ],
      },
      error: "",
      cancel: vi.fn(),
    });

    try {
      render(
        <ScanningScreen
          go={vi.fn()}
          activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
        />
      );

      const flow = screen.getByLabelText("Worker progress flow");
      const phases = document.querySelector(".scanning-phases");
      expect(flow).toBeInTheDocument();
      expect(phases).not.toBeNull();
      expect(phases).toHaveClass("scanning-flow-track");
      expect(phases).toHaveAttribute("role", "list");
      expect(within(phases).getAllByRole("listitem")).toHaveLength(3);
      const edges = document.querySelectorAll(".scanning-flow-edge");
      expect(edges).toHaveLength(2);
      expect(edges[0]).toHaveClass("done");
      expect(edges[1]).toHaveClass("active");
      expect(within(phases).getByText("Checkout")).toBeInTheDocument();
      expect(within(phases).getByText("Custom review")).toBeInTheDocument();
      expect(within(phases).getByText("Reviewing billing guardrails")).toBeInTheDocument();
      expect(
        within(phases).getByText("worker=custom-review phase=custom_review")
      ).toBeInTheDocument();
      expect(within(phases).getByText("Publish")).toBeInTheDocument();
      expect(within(phases).getByText("02 / 03")).toBeInTheDocument();
      const phaseProgress = within(phases).getByRole("progressbar", {
        name: "Custom review progress",
      });
      expect(phaseProgress).toHaveAttribute("aria-valuenow", "40");
      expect(within(phaseProgress).getByText("40%")).toBeInTheDocument();
      expect(phaseProgress.querySelector(".scanning-phase-progress-fill")).toHaveStyle({
        width: "40%",
      });
      expect(
        screen.getByText(`[${expectedLogTime}] Custom review - Reviewing billing guardrails`)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(`[${currentTime}] Custom review - Reviewing billing guardrails`)
      ).not.toBeInTheDocument();
      expect(within(phases).queryByText("Preparing workspace")).not.toBeInTheDocument();
      expect(within(phases).queryByText("Running reviewers")).not.toBeInTheDocument();
      expect(within(phases).queryByText("Uploading artifacts")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows failed scan progress as stopped before completion", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_failed",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "failed",
        phase: "report",
        progress: 100,
        progressMessage: "Uploading failed result",
        logsSummary: "Review completion gate failed.",
      },
      error: "",
      retry: vi.fn(),
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    const progress = screen.getByRole("progressbar", { name: /progress before failure/i });
    expect(screen.getByText("Finding summary")).toBeInTheDocument();
    expect(progress).toHaveAttribute("aria-valuenow", "94");
    expect(progress).toHaveAttribute("aria-valuetext", "Scan failed at 94%");
    expect(screen.queryByText("Failed at 94%")).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("shows scan errors on the failed progress node", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_failed",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "failed",
        phase: "publish",
        progress: 88,
        error: "Fallback failure text.",
        progressSteps: [
          { id: "checkout", label: "Checkout", status: "completed", percent: 100 },
          {
            id: "qa_gate",
            label: "QA gate",
            status: "failed",
            percent: 88,
            reason: "QA gate failed: validator output was incomplete.",
          },
          { id: "publish", label: "Publish", status: "pending", percent: 0 },
        ],
      },
      error: "",
      retry: vi.fn(),
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
    const errorText = within(phases).getByText("QA gate failed: validator output was incomplete.");
    const errorLine = errorText.closest(".scanning-phase-error");
    expect(errorLine).toBeInTheDocument();
    expect(errorLine.closest(".scanning-phase")).toHaveClass("failed", "errored");
    expect(within(phases).getByText("Checkout").closest(".scanning-phase")).not.toHaveClass(
      "errored"
    );
  });

  it("shows cancelled scan progress nodes as cancelled instead of running", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_cancelled",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "cancelled",
        phase: "publish",
        progress: 62,
        progressSteps: [
          { id: "checkout", label: "Checkout", status: "completed", percent: 100 },
          { id: "publish", label: "Publish", status: "running", percent: 62 },
          { id: "report", label: "Report", status: "pending", percent: 0 },
        ],
      },
      error: "",
      retry: vi.fn(),
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    expect(screen.getByText("Scan cancelled")).toBeInTheDocument();
    expect(screen.queryByText("Finding summary")).not.toBeInTheDocument();
    const publishNode = screen.getByText("Publish").closest(".scanning-phase");
    expect(publishNode).toHaveClass("cancelled");
    expect(within(publishNode).getByText("Cancelled")).toBeInTheDocument();
    expect(within(publishNode).queryByText("Running")).not.toBeInTheDocument();
    expect(publishNode).not.toHaveAttribute("data-flow-current", "true");
  });

  it("shows partial completed progress nodes without downgrading them to queued", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_partial",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "partial_completed",
        phase: "qa_gate",
        progress: 99,
        progressSteps: [
          {
            id: "render_markdown_report",
            label: "Render markdown report",
            status: "completed",
            percent: 100,
          },
          { id: "qa_gate", label: "QA gate", status: "partial_completed", percent: 100 },
          { id: "hash_artifacts", label: "Hash artifacts", status: "pending", percent: 0 },
        ],
      },
      error: "",
      retry: vi.fn(),
      cancel: vi.fn(),
    });

    render(
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );

    const qaNode = screen.getByText("QA gate").closest(".scanning-phase");
    expect(screen.getByText("Finding summary")).toBeInTheDocument();
    expect(qaNode).toHaveClass("partial");
    expect(within(qaNode).getByText("Partially completed")).toBeInTheDocument();
    expect(within(qaNode).queryByText("Queued")).not.toBeInTheDocument();
  });

  it("keeps the active progress phase focused inside the flow viewport", () => {
    const rect = (left, top, width, height) => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
    const originalRect = Element.prototype.getBoundingClientRect;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function () {
        if (this.classList?.contains("scanning-flow-viewport")) return rect(0, 0, 300, 264);
        if (this.getAttribute?.("data-flow-current") === "true") return rect(500, 60, 244, 136);
        return originalRect.call(this);
      });
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "publish",
        progress: 80,
        progressSteps: [
          { id: "checkout", label: "Checkout", status: "completed", percent: 100 },
          { id: "review", label: "Review", status: "completed", percent: 100 },
          { id: "publish", label: "Publish", status: "running", percent: 80 },
        ],
      },
      error: "",
      cancel: vi.fn(),
    });

    try {
      render(
        <ScanningScreen
          go={vi.fn()}
          activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
        />
      );

      const current = document.querySelector('[data-flow-current="true"]');
      const track = document.querySelector(".scanning-flow-track");
      expect(current).toHaveTextContent("Publish");
      expect(track).toHaveStyle("transform: translate(-472px, 4px) scale(1)");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("does not refocus the progress flow on same-phase detail refreshes", () => {
    const rect = (left, top, width, height) => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
    const originalRect = Element.prototype.getBoundingClientRect;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function () {
        if (this.classList?.contains("scanning-flow-viewport")) return rect(0, 0, 300, 264);
        if (this.getAttribute?.("data-flow-current") === "true") return rect(500, 60, 244, 136);
        return originalRect.call(this);
      });
    const cancel = vi.fn();
    let scan = {
      id: "sc_running",
      repo: "octocat/private-repo",
      branch: "main",
      commit: "pending",
      status: "running",
      phase: "publish",
      progress: 80,
      progressSteps: [
        { id: "checkout", label: "Checkout", status: "completed", percent: 100 },
        { id: "review", label: "Review", status: "completed", percent: 100 },
        { id: "publish", label: "Publish", status: "running", percent: 80 },
        { id: "report", label: "Report", status: "pending", percent: 0 },
      ],
    };
    useScanRun.mockImplementation(() => ({
      scan,
      error: "",
      cancel,
    }));

    try {
      const scanScreen = () => (
        <ScanningScreen
          go={vi.fn()}
          activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
        />
      );
      const { rerender } = render(scanScreen());
      const viewport = document.querySelector(".scanning-flow-viewport");
      const track = document.querySelector(".scanning-flow-track");

      expect(track).toHaveStyle("transform: translate(-472px, 4px) scale(1)");

      firePointerEvent(viewport, "pointerdown", {
        button: 0,
        pointerId: 1,
        clientX: 10,
        clientY: 10,
      });
      firePointerEvent(viewport, "pointermove", { pointerId: 1, clientX: 60, clientY: 30 });
      firePointerEvent(viewport, "pointerup", { pointerId: 1, clientX: 60, clientY: 30 });
      fireEvent.pointerUp(viewport, { pointerId: 1 });
      expect(track).toHaveStyle("transform: translate(-422px, 24px) scale(1)");

      scan = {
        ...scan,
        progress: 81,
        progressMessage: "Publishing updated artifact manifest",
        progressSteps: [
          { id: "checkout", label: "Checkout", status: "completed", percent: 100 },
          { id: "review", label: "Review", status: "completed", percent: 100 },
          { id: "publish", label: "Publish", status: "running", percent: 81 },
          { id: "report", label: "Report", status: "pending", percent: 0 },
        ],
      };
      rerender(scanScreen());
      expect(track).toHaveStyle("transform: translate(-422px, 24px) scale(1)");

      scan = {
        ...scan,
        phase: "report",
        progress: 90,
        progressSteps: [
          { id: "checkout", label: "Checkout", status: "completed", percent: 100 },
          { id: "review", label: "Review", status: "completed", percent: 100 },
          { id: "publish", label: "Publish", status: "completed", percent: 100 },
          { id: "report", label: "Report", status: "running", percent: 90 },
        ],
      };
      rerender(scanScreen());
      expect(track).toHaveStyle("transform: translate(-894px, 28px) scale(1)");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("does not duplicate live log rows when scan details rerender without new progress", () => {
    const logTimestamp = 1700000000;
    const liveLogLine = `[${new Date(logTimestamp * 1000).toLocaleTimeString()}] Worker AI - Repo map: mapping shards 12/80`;
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "ai",
        progress: 80,
        progressSteps: [{ id: "ai", label: "Worker AI", status: "running", percent: 80 }],
        progressLogs: [
          {
            time: logTimestamp,
            phase: "ai",
            progress: 80,
            message: "Repo map: mapping shards 12/80",
          },
        ],
      },
      error: "",
      cancel: vi.fn(),
    });

    const scanScreen = (
      <ScanningScreen
        go={vi.fn()}
        activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
      />
    );
    const { rerender } = render(scanScreen);

    expect(screen.getAllByText(liveLogLine)).toHaveLength(1);
    rerender(scanScreen);
    expect(screen.getAllByText(liveLogLine)).toHaveLength(1);
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
    expect(within(phases).getByText("Secrets")).toBeInTheDocument();
    expect(within(phases).queryByText("Preparing workspace")).not.toBeInTheDocument();
    expect(within(phases).queryByText("Scanning for secrets")).not.toBeInTheDocument();
    expect(within(phases).queryByText("Analyzing dependencies")).not.toBeInTheDocument();
  });

  it("renders scan detail progress as a plain bar in the header", () => {
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "ai",
        progress: 80,
        progressSteps: [{ id: "ai", label: "Worker AI", status: "running", percent: 80 }],
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

    const progress = screen.getByRole("progressbar", { name: /estimated completion/i });
    expect(progress.closest(".scanning-copy")).toBeInTheDocument();
    expect(progress.querySelector(".scan-progress-track")).toBeInTheDocument();
    expect(progress.querySelector(".scan-progress-head")).not.toBeInTheDocument();
    expect(progress.querySelector(".scan-progress-message")).not.toBeInTheDocument();
    expect(progress.querySelector(".scan-progress-meta")).not.toBeInTheDocument();
    expect(container.querySelector(".scanning-bar-wrap")).not.toBeInTheDocument();
    expect(container.querySelector(".scanning-bar")).not.toBeInTheDocument();
    expect(screen.getByText("Worker AI")).toBeInTheDocument();
  });

  it("zooms the scan progress flow with the wheel and uses an icon-only reset control", () => {
    const rect = (left, top, width, height) => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
    const originalRect = Element.prototype.getBoundingClientRect;
    const rectSpy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function () {
        if (this.classList?.contains("scanning-flow-viewport")) return rect(0, 0, 300, 264);
        return originalRect.call(this);
      });
    useScanRun.mockReturnValue({
      scan: {
        id: "sc_running",
        repo: "octocat/private-repo",
        branch: "main",
        commit: "pending",
        status: "running",
        phase: "ai",
        progress: 80,
        progressSteps: [{ id: "ai", label: "Worker AI", status: "running", percent: 80 }],
      },
      error: "",
      cancel: vi.fn(),
    });

    try {
      render(
        <ScanningScreen
          go={vi.fn()}
          activeRepo={{ fullName: "octocat/private-repo", defaultBranch: "main" }}
        />
      );

      expect(
        screen.queryByRole("button", { name: /zoom in progress flow/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /zoom out progress flow/i })
      ).not.toBeInTheDocument();

      const reset = screen.getByRole("button", { name: /reset progress flow view/i });
      expect(reset).toHaveTextContent("");
      expect(reset.querySelector("svg")).toBeInTheDocument();

      const viewport = document.querySelector(".scanning-flow-viewport");
      const track = document.querySelector(".scanning-flow-track");
      const wheelEvent = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: -100,
        clientX: 150,
        clientY: 120,
      });
      act(() => {
        viewport.dispatchEvent(wheelEvent);
      });
      expect(wheelEvent.defaultPrevented).toBe(true);
      expect(track).toHaveStyle("transform: translate(-21px, -16.8px) scale(1.14)");

      fireEvent.click(reset);
      expect(track).toHaveStyle("transform: translate(0px, 0px) scale(1)");
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("explains queued scans with queue position", () => {
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
          limits: { queuedGlobal: 1000 },
          running: { global: 3 },
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
    expect(screen.queryByText(/per user/i)).not.toBeInTheDocument();
  });

  it("routes disabled review provider errors to settings", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError(
      "Review provider is disabled. Configure a provider before scanning."
    );

    const action = screen.getByRole("link", { name: /open settings/i });
    expect(action).toHaveAttribute("href", "/settings");

    expect(await screen.findByRole("alert")).toHaveTextContent(/review provider is disabled/i);

    await user.click(action);

    expect(go).toHaveBeenCalledWith("settings");
  });

  it("routes GitHub repository sync errors to repositories", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Sync GitHub repositories before starting a scan.");

    const action = screen.getByRole("link", { name: /sync repositories/i });
    expect(action).toHaveAttribute("href", "/repos");

    expect(await screen.findByRole("alert")).toHaveTextContent(/sync github repositories/i);

    await user.click(action);

    expect(go).toHaveBeenCalledWith("repos");
  });

  it("does not route unstructured quota text to billing", async () => {
    const user = userEvent.setup();
    const { go } = renderScanError("Account quota reached.");

    const action = screen.getByRole("link", { name: /retry/i });
    expect(action).toHaveAttribute("href", "/repos");

    expect(await screen.findByRole("alert")).toHaveTextContent(/account quota reached/i);

    await user.click(action);

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

    expect(await screen.findByRole("alert")).toHaveTextContent(message);

    await user.click(action);

    expect(go).toHaveBeenCalledWith("billing");
  });

  it.each(["Codex CLI is missing or not authenticated."])(
    "routes missing CLI provider errors to settings without exposing the runner name",
    async (message) => {
      const user = userEvent.setup();
      const { go } = renderScanError(message);

      const action = screen.getByRole("link", { name: /open settings/i });
      expect(action).toHaveAttribute("href", "/settings");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/review runner is missing/i);
      expect(alert).not.toHaveTextContent(/codex/i);

      await user.click(action);

      expect(go).toHaveBeenCalledWith("settings");
    }
  );
});
