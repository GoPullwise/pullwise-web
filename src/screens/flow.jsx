import { useCallback, useEffect, useMemo, useState } from "react";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation } from "../lib/auth.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import {
  isTerminalScan,
  scanQueueSummary,
  useRepositories,
  useScanBatchRun,
  useScanRun,
} from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

function quotaNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.trunc(number));
}

function repoQuotaLabel(quota) {
  if (!quota) return "";
  const limit = quotaNumber(quota.limit);
  const used = quotaNumber(quota.used);
  const remaining = Object.prototype.hasOwnProperty.call(quota, "remaining")
    ? quotaNumber(quota.remaining)
    : Math.max(0, limit - used);
  const scope = quota.scope === "workspace" ? "workspace" : "repo";
  if (!limit) return `${scope} quota unavailable`;
  return `${remaining} of ${limit} ${scope} scans left`;
}

function workspaceLabel(repo) {
  return repo?.workspaceName || repo?.workspace?.name || repo?.workspaceId || "";
}

function repoOwner(repo) {
  const fullName = repo.fullName || repo.name || "";
  return fullName.includes("/") ? fullName.split("/")[0] : "";
}

function makeScanRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `scan_req_${globalThis.crypto.randomUUID()}`;
  }
  return `scan_req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function scanInputFromRepo(repo) {
  const request = {
    repo: repo?.fullName || repo?.name || repo?.repo || "",
    branch: repo?.defaultBranch || repo?.branch || "main",
    commit: repo?.commit || "pending",
    requestId: repo?.scanRequestId || "",
  };
  if (repo?.repoId) request.repoId = repo.repoId;
  return request;
}

function batchScanStatus(scans, expectedCount, hasError) {
  if (!expectedCount) return "no_repo";
  if (hasError && scans.length === 0) return "failed";
  if (scans.length < expectedCount) return "queued";
  if (scans.some((scan) => scan.status === "running")) return "running";
  if (scans.some((scan) => scan.status === "queued")) return "queued";
  if (scans.every((scan) => scan.status === "done")) return "done";
  if (scans.every((scan) => scan.status === "cancelled")) return "cancelled";
  if (scans.some((scan) => scan.status === "failed")) return "failed";
  if (hasError) return "failed";
  return "queued";
}

function scanErrorAction(error) {
  const code = typeof error === "object" && error ? String(error.code || "") : "";
  const message = typeof error === "object" && error ? error.message : error;
  const text = `${code} ${String(message || "")}`.toLowerCase();
  if (["QUOTA_EXCEEDED_WORKSPACE", "QUOTA_EXCEEDED_REPOSITORY"].includes(code)) {
    return { label: "Open billing", screen: "billing" };
  }
  if (
    text.includes("review provider") ||
    text.includes("cli") ||
    text.includes("not authenticated")
  ) {
    return { label: "Open settings", screen: "settings" };
  }
  if (
    text.includes("sync github repositories") ||
    ["REPOSITORY_SYNC_REQUIRED", "REPOSITORY_NOT_AUTHORIZED", "WORKSPACE_MEMBERSHIP_REQUIRED"].includes(code)
  ) {
    return { label: "Sync repositories", screen: "repos" };
  }
  if (text.includes("monthly review limit")) {
    return { label: "Open billing", screen: "billing" };
  }
  return { label: "Retry", screen: "repos" };
}

function scanIssueTotals(scans) {
  return scans.reduce(
    (totals, scan) => {
      const issues = scan?.issues || {};
      return {
        critical: totals.critical + Number(issues.critical || 0),
        high: totals.high + Number(issues.high || 0),
        medium: totals.medium + Number(issues.medium || 0),
        low: totals.low + Number(issues.low || 0),
      };
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

export function ReposScreen({
  go,
  setActiveRepo,
  setIssue = null,
  authorizationError = "",
  clearAuthorizationError = () => {},
}) {
  useLang();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const [connectError, setConnectError] = useState("");
  const {
    items: availableRepos,
    installations,
    installationAccounts,
    loading,
    error,
    needsAuthorization,
    reload,
  } = useRepositories();
  const displayError = error || connectError || authorizationError;
  const allLabel = T("All", "所有");
  const orgs = useMemo(
    () => [
      allLabel,
      ...Array.from(
        new Set([...availableRepos.map(repoOwner), ...(installationAccounts || [])].filter(Boolean))
      ).map((owner) => `@${owner}`),
    ],
    [allLabel, availableRepos, installationAccounts]
  );
  const [org, setOrg] = useState(allLabel);
  const activeOwner = org?.startsWith("@") ? org.slice(1) : "";
  const query = q.trim().toLowerCase();
  const refreshGitHubRepositoryAccess = useCallback(async () => {
    await reload({ sync: true });
  }, [reload]);
  const repos = availableRepos.filter((repo) => {
    const matchesOrg = !activeOwner || repoOwner(repo) === activeOwner;
    const matchesQuery =
      !query ||
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      repo.desc.toLowerCase().includes(query);
    return matchesOrg && matchesQuery;
  });

  useEffect(() => {
    if (!orgs.includes(org)) setOrg(allLabel);
  }, [allLabel, org, orgs]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => availableRepos.some((repo) => repo.id === id)));
  }, [availableRepos]);

  useGitHubRepositoryAccessAutoRefresh(refreshGitHubRepositoryAccess);

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  const startScan = () => {
    const reposToScan = selected
      .map((id) => availableRepos.find((item) => item.id === id))
      .filter(Boolean);
    if (reposToScan.length === 0) return;

    const selectedRepos = reposToScan.map((repo) => ({
      ...repo,
      scanRequestId: makeScanRequestId(),
    }));
    setActiveRepo({ ...selectedRepos[0], selectedRepos });
    go("scanning");
  };

  const connectRepositories = async (options = {}) => {
    if (connecting) return;
    setConnecting(true);
    setConnectError("");
    clearAuthorizationError();
    try {
      await connectGitHubRepositories(options);
      await reload({ sync: true });
    } catch (authError) {
      setConnectError(authError?.message || "Unable to connect GitHub repository access.");
    } finally {
      setConnecting(false);
    }
  };

  const manageInstallation = async (installation) => {
    if (managingInstallationId) return;
    const targetInstallationId = installation?.id || installation?.installationId;
    setManagingInstallationId(targetInstallationId || "");
    setConnectError("");
    clearAuthorizationError();
    try {
      await manageGitHubInstallation(targetInstallationId, {
        githubIdentityId: installation?.manage?.githubIdentityId || undefined,
      });
      await reload();
    } catch (authError) {
      setConnectError(authError?.message || "Unable to manage GitHub installation.");
    } finally {
      setManagingInstallationId("");
    }
  };

  const activateConnectRepositories = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    connectRepositories();
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: T("Repositories", "仓库") }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="repos" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Choose repositories to scan", "选择要扫描的仓库")}</h1>
              <div className="sub">
                {needsAuthorization
                  ? T(
                      "GitHub repository access is not connected yet.",
                      "尚未连接 GitHub 仓库权限。"
                    )
                  : T(
                      `${availableRepos.length} authorized repos`,
                      `${availableRepos.length} 个已授权仓库`
                    )}
              </div>
            </div>
            <div className="actions">
              <button className="btn" disabled={loading} onClick={() => reload({ sync: true })}>
                <I.Refresh size={14} /> {T("Sync", "同步")}
              </button>
              <button className="btn primary" disabled={selected.length === 0} onClick={startScan}>
                <I.Play size={12} /> {T("Start scan", "开始扫描")} ({selected.length})
              </button>
            </div>
          </div>

          {!needsAuthorization && (
            <GitHubInstallationsList
              installations={installations}
              onManage={manageInstallation}
              managingInstallationId={managingInstallationId}
            />
          )}

          <div className="repos-toolbar">
            <div className="repos-search">
              <I.Search size={14} />
              <input
                placeholder={T("Search repositories...", "搜索仓库...")}
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
            </div>
            <div className="repos-orgs">
              {orgs.map((item) => (
                <button
                  key={item}
                  className={"repos-org" + (org === item ? " active" : "")}
                  onClick={() => setOrg(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="repos-list">
            {needsAuthorization && (
              <div
                className="repo-row repo-row-status"
                role="button"
                tabIndex={0}
                onClick={() => connectRepositories()}
                onKeyDown={activateConnectRepositories}
              >
                <div className="repo-icon">
                  {connecting ? (
                    <span className="spin" style={{ display: "inline-block" }}>
                      <I.Refresh size={16} />
                    </span>
                  ) : (
                    <I.Github size={16} />
                  )}
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>
                      {connecting
                        ? T("Opening GitHub...", "Opening GitHub...")
                        : T("Connect GitHub repositories", "连接 GitHub 仓库")}
                    </span>
                  </div>
                  <div className="repo-desc">
                    {T(
                      "Choose the repositories Pullwise can read for this scan.",
                      "选择 Pullwise 可只读访问并扫描的仓库。"
                    )}
                  </div>
                </div>
                <I.ArrowR size={14} />
              </div>
            )}
            {displayError && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon">
                  <I.X size={16} />
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{T("Unable to load repositories", "无法加载仓库")}</span>
                  </div>
                  <div className="repo-desc">{displayError}</div>
                </div>
              </div>
            )}
            {loading && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon">
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={16} />
                  </span>
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{T("Loading repositories", "正在加载仓库")}</span>
                  </div>
                  <div className="repo-desc">
                    {T("Reading GitHub App authorization.", "正在读取 GitHub App 授权。")}
                  </div>
                </div>
              </div>
            )}
            {!loading && !error && !needsAuthorization && repos.length === 0 && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon">
                  <I.Folder size={16} />
                </div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{T("No authorized repositories", "没有已授权仓库")}</span>
                  </div>
                  <div className="repo-desc">
                    {T(
                      "Authorize repositories in GitHub, then sync again.",
                      "请先在 GitHub 授权仓库，然后重新同步。"
                    )}
                  </div>
                </div>
              </div>
            )}
            {repos.map((repo) => {
              const on = selected.includes(repo.id);
              const quotaLabel = repoQuotaLabel(repo.quota);
              const workspace = workspaceLabel(repo);
              const quotaEmpty = repo.quota && quotaNumber(repo.quota.remaining) <= 0;
              return (
                <div
                  key={repo.id}
                  className={"repo-row" + (on ? " on" : "")}
                  onClick={() => toggle(repo.id)}
                >
                  <div className="repo-check">
                    <span className="repo-check-box">{on && <I.Check size={11} />}</span>
                  </div>
                  <div className="repo-icon">
                    <I.Folder size={16} />
                  </div>
                  <div className="repo-main">
                    <div className="repo-name">
                      <span>{repo.fullName || repo.name}</span>
                      {repo.private && (
                        <span className="tag">
                          <I.Lock size={10} /> private
                        </span>
                      )}
                    </div>
                    <div className="repo-desc">{repo.desc}</div>
                  </div>
                  <div className="repo-meta">
                    <span>
                      <span className="lang-dot" data-lang={repo.lang}></span> {repo.lang}
                    </span>
                    <span>
                      <I.Star size={12} /> {repo.stars}
                    </span>
                    <span>
                      <I.GitBranch size={12} /> {repo.branches}
                    </span>
                    <span>
                      <I.Clock size={12} /> {repo.updated}
                    </span>
                    {workspace && (
                      <span className="repo-workspace">
                        <I.Package size={12} /> {workspace}
                      </span>
                    )}
                    {quotaLabel && (
                      <span className={"repo-quota" + (quotaEmpty ? " empty" : "")}>
                        <I.Activity size={12} /> {quotaLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="repos-foot">
            <span className="muted">
              {T("Missing a repository? ", "缺少仓库？")}
              <button
                type="button"
                className="auth-link"
                onClick={() => connectRepositories({ add: true })}
              >
                {T("Add GitHub account or organization", "添加 GitHub 账号或组织")}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const SCAN_PHASES = [
  {
    k: "clone",
    t_en: "Cloning repository",
    t_zh: "克隆仓库",
    d_en: "Preparing working tree",
    d_zh: "准备工作树",
  },
  {
    k: "index",
    t_en: "Building AST index",
    t_zh: "构建 AST 索引",
    d_en: "Parsing source files",
    d_zh: "解析源代码",
  },
  {
    k: "secrets",
    t_en: "Scanning for secrets",
    t_zh: "扫描密钥泄露",
    d_en: "Regex + entropy scan",
    d_zh: "正则 + 熵值扫描",
  },
  {
    k: "deps",
    t_en: "Analyzing dependencies",
    t_zh: "分析依赖",
    d_en: "Reading lockfile",
    d_zh: "读取 lockfile",
  },
  {
    k: "ai",
    t_en: "AI semantic review",
    t_zh: "AI 语义 review",
    d_en: "Agent reviewing repository",
    d_zh: "agent 审查代码",
  },
  {
    k: "report",
    t_en: "Composing report",
    t_zh: "生成报告",
    d_en: "Merging signals",
    d_zh: "合并扫描信号",
  },
];

export function ScanningScreen({ go, activeRepo, setIssue = null }) {
  useLang();
  const [logs, setLogs] = useState([]);
  const selectedRepos = useMemo(
    () => (Array.isArray(activeRepo?.selectedRepos) ? activeRepo.selectedRepos : []),
    [activeRepo?.selectedRepos]
  );
  const batchMode = selectedRepos.length > 1;
  const singleRepo = selectedRepos.length === 1 ? selectedRepos[0] : activeRepo;
  const initialScan = singleRepo?.initialScan || null;
  const scanId = singleRepo?.scanId || "";
  const singleScanInput = scanInputFromRepo(singleRepo);
  const repoId = singleScanInput.repoId || initialScan?.repoId || "";
  const repoFullName = singleScanInput.repo || initialScan?.repo || "";
  const branch = singleScanInput.branch || initialScan?.branch || "main";
  const commit = singleScanInput.commit || initialScan?.commit || "pending";
  const requestId = singleScanInput.requestId || "";
  const batchRepositories = useMemo(() => {
    if (!batchMode) return [];
    return selectedRepos.map(scanInputFromRepo).filter((request) => request.repo || request.repoId);
  }, [batchMode, selectedRepos]);

  const singleRun = useScanRun({
    repoId: batchMode ? "" : repoId,
    repo: batchMode ? "" : repoFullName,
    branch,
    commit,
    requestId,
    scanId: batchMode ? "" : scanId,
    initialScan: batchMode ? null : initialScan,
  });
  const batchRun = useScanBatchRun({ repositories: batchRepositories });
  const scans = batchMode ? batchRun.scans : singleRun.scan ? [singleRun.scan] : [];
  const scan = batchMode
    ? scans.find((item) => !isTerminalScan(item)) || scans[0] || null
    : singleRun.scan;
  const error = batchMode ? batchRun.error : singleRun.error;
  const errorCode = batchMode ? batchRun.errorCode : singleRun.errorCode;
  const cancel = batchMode ? batchRun.cancel : singleRun.cancel;

  // Append a log line whenever the worker advances to a new phase.
  useEffect(() => {
    const phase = scan?.phase;
    if (!phase) return;
    const def = SCAN_PHASES.find((p) => p.k === phase);
    if (!def) return;
    setLogs((prev) => {
      const stamp = new Date().toLocaleTimeString();
      const line = `[${stamp}] ${T(def.t_en, def.t_zh)}`;
      if (prev.length && prev[prev.length - 1] === line) return prev;
      return [...prev.slice(-9), line];
    });
  }, [scan?.phase]);

  const expectedBatchCount = batchRepositories.length;
  const status = batchMode
    ? batchScanStatus(scans, expectedBatchCount, Boolean(error))
    : scan?.status || (error ? "failed" : repoFullName ? "queued" : "no_repo");
  const progress = batchMode
    ? expectedBatchCount
      ? scans.reduce((sum, item) => sum + Number(item?.progress || 0), 0) / expectedBatchCount
      : 0
    : typeof scan?.progress === "number"
      ? scan.progress
      : 0;
  const currentPhase = scan?.phase || (status === "queued" ? null : "clone");
  const phaseIdx = currentPhase ? SCAN_PHASES.findIndex((p) => p.k === currentPhase) : -1;
  const found = batchMode
    ? scanIssueTotals(scans)
    : scan?.issues || { critical: 0, high: 0, medium: 0, low: 0 };
  const terminal = batchMode
    ? expectedBatchCount > 0 && scans.length === expectedBatchCount && scans.every(isTerminalScan)
    : isTerminalScan(scan);
  const queueSummary = scanQueueSummary(scan);
  const canCancel = batchMode
    ? scans.some((item) => item?.id && !isTerminalScan(item))
    : Boolean(scan && !terminal);
  const errorAction = error ? scanErrorAction({ message: error, code: errorCode }) : null;

  // After a successful scan, drop into the dashboard so the user sees results.
  useEffect(() => {
    if (status !== "done") return undefined;
    const id = setTimeout(() => go("dashboard"), 700);
    return () => clearTimeout(id);
  }, [status, go]);

  const handleCancel = async () => {
    if (canCancel) await cancel();
    go("history");
  };
  const handleBack = () => {
    go("history");
  };

  const headerLabel =
    status === "done"
      ? batchMode
        ? T("Scan batch complete", "批量扫描完成")
        : T("Scan complete", "扫描完成")
      : status === "failed"
        ? batchMode
          ? T("Scan batch failed", "批量扫描失败")
          : T("Scan failed", "扫描失败")
        : status === "cancelled"
          ? batchMode
            ? T("Scan batch cancelled", "批量扫描已取消")
            : T("Scan cancelled", "扫描已取消")
          : status === "no_repo"
            ? T("No repository selected", "未选择仓库")
            : batchMode
              ? T("Scanning repositories", "正在扫描仓库")
              : T("Scanning…", "扫描进行中");

  const headerIcon =
    status === "done" ? (
      <I.Check size={18} />
    ) : status === "failed" || status === "cancelled" ? (
      <I.X size={18} />
    ) : (
      <span className="spin" style={{ display: "inline-block" }}>
        <I.Refresh size={18} />
      </span>
    );

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: T("Scan", "扫描") }]}
        setIssue={setIssue}
      />
      <div className="main narrow" style={{ margin: "0 auto" }}>
        <div className="scanning">
          <div className="scanning-card card">
            <div className="scanning-h">
              <div className="scanning-icon">{headerIcon}</div>
              <div className="scanning-copy">
                <div className="scanning-title">
                  {status === "queued"
                    ? batchMode
                      ? T("Scan batch queued", "批量扫描排队中")
                      : T("Scan queued", "Scan queued")
                    : headerLabel}{" "}
                  <b>
                    {batchMode
                      ? T(`${expectedBatchCount} repositories`, `${expectedBatchCount} 个仓库`)
                      : scan?.repo || repoFullName || "—"}
                  </b>
                </div>
                <div className="scanning-sub">
                  {batchMode ? (
                    <span className="tag">
                      {T(
                        `${scans.length}/${expectedBatchCount} scans created`,
                        `${scans.length}/${expectedBatchCount} 个扫描已创建`
                      )}
                    </span>
                  ) : (
                    <>
                      {T("branch ", "分支 ")}
                      <span className="tag">{scan?.branch || branch}</span>
                      {scan?.commit && scan.commit !== "pending" && scan.commit !== "-" && (
                        <>
                          {T(" · commit ", " · commit ")}
                          <span className="tag">{scan.commit}</span>
                        </>
                      )}
                      {scan?.id && (
                        <>
                          {" "}
                          · <span className="tag">{scan.id}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="scanning-actions">
                <button className="btn ghost" onClick={handleBack}>
                  <I.ArrowL size={13} /> {T("Back", "返回")}
                </button>
                {canCancel && (
                  <button className="btn ghost" onClick={handleCancel}>
                    <I.X size={13} /> {T("Cancel", "取消")}
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div
                className="auth-error"
                role="alert"
                style={{ margin: "0 0 12px", alignItems: "center" }}
              >
                <I.X size={13} />
                <span style={{ flex: 1 }}>{error}</span>
                {errorAction && (
                  <button className="btn sm" onClick={() => go(errorAction.screen)}>
                    {errorAction.label} <I.ArrowR size={11} />
                  </button>
                )}
              </div>
            )}

            <div className="scanning-bar-wrap">
              <div className="scanning-bar">
                <div className="scanning-bar-fill" style={{ width: progress + "%" }}></div>
              </div>
              <div className="scanning-bar-meta">
                <span>{Math.floor(progress)}%</span>
                <span>
                  {phaseIdx >= 0
                    ? T(SCAN_PHASES[phaseIdx].t_en, SCAN_PHASES[phaseIdx].t_zh)
                    : T("Queued", "队列中")}
                </span>
              </div>
            </div>

            {status === "queued" && queueSummary && (
              <div className="scanning-queue">
                {queueSummary.message && (
                  <div className="scanning-queue-message">{queueSummary.message}</div>
                )}
                <div className="scanning-queue-meta">
                  {queueSummary.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="scanning-phases">
              {SCAN_PHASES.map((p, i) => {
                const isDone = phaseIdx > i || status === "done";
                const isOn = phaseIdx === i && !terminal;
                const cls = isDone ? " done" : isOn ? " on" : "";
                const bullet = isDone ? (
                  <I.Check size={11} />
                ) : isOn ? (
                  <span
                    className="pulse"
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: "currentColor",
                    }}
                  />
                ) : (
                  i + 1
                );
                return (
                  <div key={p.k} className={"scanning-phase" + cls}>
                    <div className="scanning-phase-bullet">{bullet}</div>
                    <div>
                      <div className="scanning-phase-t">{T(p.t_en, p.t_zh)}</div>
                      <div className="scanning-phase-d">{T(p.d_en, p.d_zh)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="scanning-side">
            <div className="card scanning-counts">
              <div className="scanning-counts-h">{T("Live findings", "实时发现")}</div>
              <div className="scanning-counts-grid">
                <div>
                  <b style={{ color: "var(--sev-critical)" }}>{found.critical || 0}</b>
                  <span>Critical</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-high)" }}>{found.high || 0}</b>
                  <span>High</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-medium)" }}>{found.medium || 0}</b>
                  <span>Medium</span>
                </div>
                <div>
                  <b style={{ color: "var(--sev-low)" }}>{found.low || 0}</b>
                  <span>Low</span>
                </div>
              </div>
            </div>

            <div className="card scanning-log">
              <div className="scanning-counts-h">Live log</div>
              <div className="scanning-log-body">
                {logs.length === 0 && (
                  <div className="muted">{T("Waiting for engine…", "等待引擎启动…")}</div>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="scanning-log-line">
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
