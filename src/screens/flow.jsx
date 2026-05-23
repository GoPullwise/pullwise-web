import { useEffect, useMemo, useState } from "react";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories } from "../lib/auth.js";
import { isTerminalScan, scanQueueSummary, useRepositories, useScanRun } from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

function repoOwner(repo) {
  const fullName = repo.fullName || repo.name || "";
  return fullName.includes("/") ? fullName.split("/")[0] : "";
}

export function ReposScreen({ go, setActiveRepo, authorizationError = "", clearAuthorizationError = () => {} }) {
  useLang();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const [connecting, setConnecting] = useState(false);
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
      ...Array.from(new Set([
        ...availableRepos.map(repoOwner),
        ...(installationAccounts || []),
      ].filter(Boolean))).map((owner) => `@${owner}`),
    ],
    [allLabel, availableRepos, installationAccounts]
  );
  const [org, setOrg] = useState(allLabel);
  const activeOwner = org?.startsWith("@") ? org.slice(1) : "";
  const query = q.trim().toLowerCase();
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

  const toggle = (id) => setSelected((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ));

  const startScan = () => {
    const repo = availableRepos.find((item) => item.id === selected[0]);
    if (!repo) return;
    setActiveRepo(repo);
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

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Pullwise", go: "dashboard" },
        { label: T("Repositories", "仓库") },
      ]} />
      <div className="with-side">
        <Sidebar section="repos" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Choose repositories to scan", "选择要扫描的仓库")}</h1>
              <div className="sub">
                {needsAuthorization
                  ? T("GitHub repository access is not connected yet.", "尚未连接 GitHub 仓库权限。")
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

          {!needsAuthorization && <GitHubInstallationsList installations={installations} />}

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
              <div className="repo-row repo-row-status" role="button" tabIndex={0} onClick={() => connectRepositories()}>
                <div className="repo-icon">
                  {connecting ? <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={16} /></span> : <I.Github size={16} />}
                </div>
                <div className="repo-main">
                  <div className="repo-name"><span>{connecting ? T("Opening GitHub...", "Opening GitHub...") : T("Connect GitHub repositories", "连接 GitHub 仓库")}</span></div>
                  <div className="repo-desc">
                    {T("Choose the repositories Pullwise can read for this scan.", "选择 Pullwise 可只读访问并扫描的仓库。")}
                  </div>
                </div>
                <I.ArrowR size={14} />
              </div>
            )}
            {displayError && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon"><I.X size={16} /></div>
                <div className="repo-main">
                  <div className="repo-name"><span>{T("Unable to load repositories", "无法加载仓库")}</span></div>
                  <div className="repo-desc">{displayError}</div>
                </div>
              </div>
            )}
            {loading && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon"><span className="spin" style={{ display: "inline-block" }}><I.Refresh size={16} /></span></div>
                <div className="repo-main">
                  <div className="repo-name"><span>{T("Loading repositories", "正在加载仓库")}</span></div>
                  <div className="repo-desc">{T("Reading GitHub App authorization.", "正在读取 GitHub App 授权。")}</div>
                </div>
              </div>
            )}
            {!loading && !error && !needsAuthorization && repos.length === 0 && (
              <div className="repo-row repo-row-status">
                <div className="repo-icon"><I.Folder size={16} /></div>
                <div className="repo-main">
                  <div className="repo-name"><span>{T("No authorized repositories", "没有已授权仓库")}</span></div>
                  <div className="repo-desc">{T("Authorize repositories in GitHub, then sync again.", "请先在 GitHub 授权仓库，然后重新同步。")}</div>
                </div>
              </div>
            )}
            {repos.map((repo) => {
              const on = selected.includes(repo.id);
              return (
                <div key={repo.id} className={"repo-row" + (on ? " on" : "")} onClick={() => toggle(repo.id)}>
                  <div className="repo-check">
                    <span className="repo-check-box">{on && <I.Check size={11} />}</span>
                  </div>
                  <div className="repo-icon"><I.Folder size={16} /></div>
                  <div className="repo-main">
                    <div className="repo-name">
                      <span>{repo.fullName || repo.name}</span>
                      {repo.private && <span className="tag"><I.Lock size={10} /> private</span>}
                    </div>
                    <div className="repo-desc">{repo.desc}</div>
                  </div>
                  <div className="repo-meta">
                    <span><span className="lang-dot" data-lang={repo.lang}></span> {repo.lang}</span>
                    <span><I.Star size={12} /> {repo.stars}</span>
                    <span><I.GitBranch size={12} /> {repo.branches}</span>
                    <span><I.Clock size={12} /> {repo.updated}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="repos-foot">
            <span className="muted">
              {T("Missing a repository? ", "缺少仓库？")}
              <button type="button" className="auth-link" onClick={() => connectRepositories({ add: true })}>{T("Add GitHub account or organization", "添加 GitHub 账号或组织")}</button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const SCAN_PHASES = [
  { k: "clone",   t_en: "Cloning repository",     t_zh: "克隆仓库",       d_en: "Preparing working tree",     d_zh: "准备工作树" },
  { k: "index",   t_en: "Building AST index",     t_zh: "构建 AST 索引",  d_en: "Parsing source files",       d_zh: "解析源代码" },
  { k: "secrets", t_en: "Scanning for secrets",   t_zh: "扫描密钥泄露",   d_en: "Regex + entropy scan",       d_zh: "正则 + 熵值扫描" },
  { k: "deps",    t_en: "Analyzing dependencies", t_zh: "分析依赖",       d_en: "Reading lockfile",           d_zh: "读取 lockfile" },
  { k: "ai",      t_en: "AI semantic review",     t_zh: "AI 语义 review", d_en: "Agent reviewing repository", d_zh: "agent 审查代码" },
  { k: "report",  t_en: "Composing report",       t_zh: "生成报告",       d_en: "Merging signals",            d_zh: "合并扫描信号" },
];

export function ScanningScreen({ go, activeRepo }) {
  useLang();
  const [logs, setLogs] = useState([]);
  const repoFullName = activeRepo?.fullName || activeRepo?.name || "";
  const branch = activeRepo?.defaultBranch || "main";

  const { scan, error, cancel } = useScanRun({ repo: repoFullName, branch });

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

  // After a successful scan, drop into the dashboard so the user sees results.
  useEffect(() => {
    if (scan?.status !== "done") return undefined;
    const id = setTimeout(() => go("dashboard"), 700);
    return () => clearTimeout(id);
  }, [scan?.status, go]);

  const status = scan?.status || (error ? "failed" : repoFullName ? "queued" : "no_repo");
  const progress = typeof scan?.progress === "number" ? scan.progress : 0;
  const currentPhase = scan?.phase || (status === "queued" ? null : "clone");
  const phaseIdx = currentPhase ? SCAN_PHASES.findIndex((p) => p.k === currentPhase) : -1;
  const found = scan?.issues || { critical: 0, high: 0, medium: 0, low: 0 };
  const terminal = isTerminalScan(scan);
  const queueSummary = scanQueueSummary(scan);

  const handleCancel = async () => {
    if (scan && !terminal) await cancel();
    go("repos");
  };

  const headerLabel =
    status === "done" ? T("Scan complete", "扫描完成") :
    status === "failed" ? T("Scan failed", "扫描失败") :
    status === "cancelled" ? T("Scan cancelled", "扫描已取消") :
    status === "no_repo" ? T("No repository selected", "未选择仓库") :
    T("Scanning…", "扫描进行中");

  const headerIcon =
    status === "done" ? <I.Check size={18} /> :
    status === "failed" || status === "cancelled" ? <I.X size={18} /> :
    <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={18} /></span>;

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Pullwise", go: "dashboard" },
        { label: T("Scan", "扫描") },
      ]} />
      <div className="main narrow" style={{ margin: "0 auto" }}>
        <div className="scanning">
          <div className="scanning-card card">
            <div className="scanning-h">
              <div className="scanning-icon">{headerIcon}</div>
              <div>
                <div className="scanning-title">
                  {status === "queued" ? T("Scan queued", "Scan queued") : headerLabel} <b>{scan?.repo || repoFullName || "—"}</b>
                </div>
                <div className="scanning-sub">
                  {T("branch ", "分支 ")}
                  <span className="tag">{scan?.branch || branch}</span>
                  {scan?.commit && scan.commit !== "pending" && scan.commit !== "-" && (
                    <>{T(" · commit ", " · commit ")}<span className="tag">{scan.commit}</span></>
                  )}
                  {scan?.id && <> · <span className="tag">{scan.id}</span></>}
                </div>
              </div>
              <button className="btn ghost" onClick={handleCancel}>
                {terminal ? T("Back", "返回") : T("Cancel", "取消")}
              </button>
            </div>

            {error && (
              <div className="auth-error" role="alert" style={{ margin: "0 0 12px" }}>
                <I.X size={13} /> {error}
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
                {queueSummary.message && <div className="scanning-queue-message">{queueSummary.message}</div>}
                <div className="scanning-queue-meta">
                  {queueSummary.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
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
                    style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: "currentColor" }}
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
                <div><b style={{ color: "var(--sev-critical)" }}>{found.critical || 0}</b><span>Critical</span></div>
                <div><b style={{ color: "var(--sev-high)" }}>{found.high || 0}</b><span>High</span></div>
                <div><b style={{ color: "var(--sev-medium)" }}>{found.medium || 0}</b><span>Medium</span></div>
                <div><b style={{ color: "var(--sev-low)" }}>{found.low || 0}</b><span>Low</span></div>
              </div>
            </div>

            <div className="card scanning-log">
              <div className="scanning-counts-h">Live log</div>
              <div className="scanning-log-body">
                {logs.length === 0 && (
                  <div className="muted">{T("Waiting for engine…", "等待引擎启动…")}</div>
                )}
                {logs.map((l, i) => (<div key={i} className="scanning-log-line">{l}</div>))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
