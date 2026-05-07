import { useEffect, useMemo, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { useRepositories } from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

function repoOwner(repo) {
  const fullName = repo.fullName || repo.name || "";
  return fullName.includes("/") ? fullName.split("/")[0] : "";
}

export function ReposScreen({ go, setActiveRepo }) {
  useLang();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const { items: availableRepos, loading, error, needsAuthorization, reload } = useRepositories();
  const allLabel = T("All", "所有");
  const orgs = useMemo(
    () => [
      allLabel,
      ...Array.from(new Set(availableRepos.map(repoOwner).filter(Boolean))).map((owner) => `@${owner}`),
    ],
    [allLabel, availableRepos]
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
              <div className="repo-row" onClick={() => go("oauth")}>
                <div className="repo-icon"><I.Github size={16} /></div>
                <div className="repo-main">
                  <div className="repo-name"><span>{T("Connect GitHub repositories", "连接 GitHub 仓库")}</span></div>
                  <div className="repo-desc">
                    {T("Install or update the Pullwise GitHub App.", "安装或更新 Pullwise GitHub App。")}
                  </div>
                </div>
                <I.ArrowR size={14} />
              </div>
            )}
            {error && (
              <div className="repo-row">
                <div className="repo-icon"><I.X size={16} /></div>
                <div className="repo-main">
                  <div className="repo-name"><span>{T("Unable to load repositories", "无法加载仓库")}</span></div>
                  <div className="repo-desc">{error}</div>
                </div>
              </div>
            )}
            {loading && (
              <div className="repo-row">
                <div className="repo-icon"><span className="spin" style={{ display: "inline-block" }}><I.Refresh size={16} /></span></div>
                <div className="repo-main">
                  <div className="repo-name"><span>{T("Loading repositories", "正在加载仓库")}</span></div>
                  <div className="repo-desc">{T("Reading GitHub App authorization.", "正在读取 GitHub App 授权。")}</div>
                </div>
              </div>
            )}
            {!loading && !error && !needsAuthorization && repos.length === 0 && (
              <div className="repo-row">
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
              <a className="auth-link" onClick={() => go("oauth")}>{T("Configure GitHub App permissions", "配置 GitHub App 权限")}</a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScanningScreen({ go, activeRepo }) {
  useLang();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState("");
  const repoName = activeRepo?.fullName || activeRepo?.name || "";

  useEffect(() => {
    let cancelled = false;
    const createScan = async () => {
      if (!repoName) return;
      setError("");
      try {
        const payload = await pullwiseApi.scans.create({
          repo: repoName,
          branch: activeRepo?.defaultBranch || "main",
          commit: "pending",
        });
        if (!cancelled) setScan(payload);
      } catch (requestError) {
        if (!cancelled) setError(requestError?.message || T("Unable to start scan.", "无法开始扫描。"));
      }
    };
    createScan();
    return () => {
      cancelled = true;
    };
  }, [activeRepo, repoName]);

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
              <div className="scanning-icon">
                {error ? <I.X size={18} /> : <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={18} /></span>}
              </div>
              <div>
                <div className="scanning-title">
                  {T("Scan request", "扫描请求")} <b>{repoName || T("No repository selected", "未选择仓库")}</b>
                </div>
                <div className="scanning-sub">
                  {error
                    ? error
                    : scan
                      ? T(`Status: ${scan.status}`, `状态：${scan.status}`)
                      : T("Submitting scan request...", "正在提交扫描请求...")}
                </div>
              </div>
              <button className="btn ghost" onClick={() => go("repos")}>{T("Back", "返回")}</button>
            </div>

            <div className="scanning-bar-wrap">
              <div className="scanning-bar"><div className="scanning-bar-fill" style={{ width: scan ? "18%" : "6%" }}></div></div>
              <div className="scanning-bar-meta">
                <span>{scan ? scan.status : T("Pending", "等待中")}</span>
                <span>{scan?.id || ""}</span>
              </div>
            </div>

            <div className="scanning-phases">
              {[
                { k: "queued", t: T("Queued", "已入队"), d: T("Stored in Pullwise server.", "已写入 Pullwise server。") },
                { k: "worker", t: T("Waiting for scan worker", "等待扫描 worker"), d: T("Findings will appear after the backend worker writes results.", "backend worker 写入结果后会显示 findings。") },
              ].map((phase, index) => (
                <div key={phase.k} className={"scanning-phase" + (scan && index === 0 ? " done" : index === 1 ? " on" : "")}>
                  <div className="scanning-phase-bullet">
                    {scan && index === 0 ? <I.Check size={11} /> : index + 1}
                  </div>
                  <div>
                    <div className="scanning-phase-t">{phase.t}</div>
                    <div className="scanning-phase-d">{phase.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="actions" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <button className="btn" onClick={() => go("history")}>{T("View history", "查看历史")}</button>
              <button className="btn primary" onClick={() => go("dashboard")}>{T("Open overview", "打开总览")}</button>
            </div>
          </div>

          <div className="scanning-side">
            <div className="card scanning-counts">
              <div className="scanning-counts-h">{T("Findings", "结果")}</div>
              <div className="scanning-counts-grid">
                <div><b style={{ color: "var(--sev-critical)" }}>0</b><span>Critical</span></div>
                <div><b style={{ color: "var(--sev-high)" }}>0</b><span>High</span></div>
                <div><b style={{ color: "var(--sev-medium)" }}>0</b><span>Medium</span></div>
                <div><b style={{ color: "var(--sev-low)" }}>0</b><span>Low</span></div>
              </div>
            </div>

            <div className="card scanning-log">
              <div className="scanning-counts-h">{T("Server record", "服务端记录")}</div>
              <div className="scanning-log-body">
                {scan ? (
                  <>
                    <div className="scanning-log-line">{T("Scan id", "扫描 ID")}: {scan.id}</div>
                    <div className="scanning-log-line">{T("Repository", "仓库")}: {scan.repo}</div>
                    <div className="scanning-log-line">{T("Branch", "分支")}: {scan.branch}</div>
                  </>
                ) : (
                  <div className="muted">{error || T("No server record yet.", "暂无服务端记录。")}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
