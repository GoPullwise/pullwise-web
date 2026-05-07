// screens/flow.jsx — Repos selection + Scan progress

import { useEffect as useEffectF, useState as useStateF } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { FIXTURES } from "../data.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

function normalizeRepo(repo) {
  const fullName = repo.fullName || repo.full_name || repo.name || "";
  return {
    ...repo,
    id: String(repo.id || fullName),
    name: fullName || repo.name,
    fullName,
    desc: repo.desc || repo.description || "",
    lang: repo.lang || repo.language || "-",
    stars: repo.stars ?? repo.stargazers_count ?? "-",
    branches: repo.branches ?? "-",
    updated: repo.updated || repo.updated_at || repo.updatedAt || "",
    private: Boolean(repo.private),
  };
}

function repoOwner(repo) {
  const fullName = repo.fullName || repo.name || "";
  return fullName.includes("/") ? fullName.split("/")[0] : "";
}

export function ReposScreen({ go, setActiveRepo }) {
  useLang();
  const [q, setQ] = useStateF("");
  const [selected, setSelected] = useStateF([]);
  const [remoteRepos, setRemoteRepos] = useStateF(null);
  const [loadingRepos, setLoadingRepos] = useStateF(true);
  const [repoError, setRepoError] = useStateF("");
  const [needsAuthorization, setNeedsAuthorization] = useStateF(false);
  const fixtureRepos = FIXTURES.REPOS.map(normalizeRepo);
  const availableRepos = remoteRepos?.length ? remoteRepos : fixtureRepos;
/*
  const allLabel = T("All", "所有");
/*
  const allLabel = T("All", "所有");
  const orgs = [
*/
  const allLabel = T("All", "\u6240\u6709");
  const orgs = [
    allLabel,
    ...Array.from(new Set(availableRepos.map(repoOwner).filter(Boolean))).map((owner) => `@${owner}`),
  ];
  const [org, setOrg] = useStateF(allLabel);
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

  const loadRepositories = async ({ sync = false } = {}) => {
    setLoadingRepos(true);
    setRepoError("");

    try {
      const payload = sync ? await pullwiseApi.repositories.sync() : await pullwiseApi.repositories.list();
      const items = (payload?.items || payload?.repositories || []).map(normalizeRepo);
      setRemoteRepos(items);
      setNeedsAuthorization(Boolean(payload?.needsAuthorization));
    } catch (error) {
      setRepoError(error?.message || T("Unable to load GitHub repositories.", "无法加载 GitHub 仓库。"));
      setRemoteRepos(null);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffectF(() => {
    if (!orgs.includes(org)) {
      setOrg(allLabel);
    }
  }, [orgs.join("|"), org, allLabel]);

  useEffectF(() => {
    loadRepositories();
  }, []);

  useEffectF(() => {
    setSelected((current) => {
      const valid = current.filter((id) => availableRepos.some((repo) => repo.id === id));
      if (valid.length) return valid;
      return availableRepos[0] ? [availableRepos[0].id] : [];
    });
  }, [availableRepos.map((repo) => repo.id).join("|")]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Acme Inc", go: "dashboard" },
        { label: T("Repositories","仓库") },
      ]} />
      <div className="with-side">
        <Sidebar section="repos" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
        <div className="page-h">
          <div>
            <h1>{T("Choose repositories to scan","选择要扫描的仓库")}</h1>
            <div className="sub">
              {needsAuthorization
                ? T(
                    "GitHub repository access is not connected yet.",
                    "尚未连接 GitHub 仓库权限。"
                  )
                : T(
                    `${availableRepos.length} accessible repos - pick one or more to start`,
                    `${availableRepos.length} 个可访问仓库 - 选择一或多个开始`
                  )}
            </div>
          </div>
          <div className="actions">
            <button className="btn" disabled={loadingRepos} onClick={() => loadRepositories({ sync: true })}><I.Refresh size={14} /> {T("Sync","同步")}</button>
            <button className="btn primary" disabled={selected.length === 0} onClick={() => {
              setActiveRepo(availableRepos.find(r => r.id === selected[0]));
              go("scanning");
            }}>
              <I.Play size={12} /> {T("Start scan","开始扫描")} ({selected.length})
            </button>
          </div>
        </div>

        <div className="repos-toolbar">
          <div className="repos-search">
            <I.Search size={14} />
            <input placeholder={T("Search repositories...","搜索仓库...")} value={q} onChange={e => setQ(e.target.value)} />
            <span className="kbd">⌘K</span>
          </div>
          <div className="repos-orgs">
            {orgs.map(o => (
              <button key={o} className={"repos-org" + (org === o ? " active" : "")} onClick={() => setOrg(o)}>{o}</button>
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
                  {T(
                    "Install the Pullwise GitHub App before scanning repositories.",
                    "扫描仓库前需要先安装 Pullwise GitHub App。"
                  )}
                </div>
              </div>
              <I.ArrowR size={14} />
            </div>
          )}
          {repoError && (
            <div className="repo-row">
              <div className="repo-icon"><I.X size={16} /></div>
              <div className="repo-main">
                <div className="repo-name"><span>{T("Using demo repositories", "正在使用演示仓库")}</span></div>
                <div className="repo-desc">{repoError}</div>
              </div>
            </div>
          )}
          {repos.map(r => {
            const on = selected.includes(r.id);
            return (
              <div key={r.id} className={"repo-row" + (on ? " on" : "")} onClick={() => toggle(r.id)}>
                <div className="repo-check">
                  <span className="repo-check-box">{on && <I.Check size={11} />}</span>
                </div>
                <div className="repo-icon"><I.Folder size={16} /></div>
                <div className="repo-main">
                  <div className="repo-name">
                    <span>{r.name}</span>
                    {r.private && <span className="tag"><I.Lock size={10} /> private</span>}
                  </div>
                  <div className="repo-desc">{r.desc}</div>
                </div>
                <div className="repo-meta">
                  <span><span className="lang-dot" data-lang={r.lang}></span> {r.lang}</span>
                  <span><I.Star size={12} /> {r.stars}</span>
                  <span><I.GitBranch size={12} /> {r.branches}</span>
                  <span><I.Clock size={12} /> {r.updated}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="repos-foot">
          <span className="muted">{T("Don't see it? ","没看到? ")}<a className="auth-link" onClick={() => go("oauth")}>{T("Configure GitHub App permissions","配置 GitHub App 权限")}</a></span>
        </div>
        </div>
      </div>
    </div>
  );
}

export function ScanningScreen({ go, activeRepo }) {
  useLang();
  const [pct, setPct] = useStateF(0);
  const [stepIdx, setStepIdx] = useStateF(0);
  const [logs, setLogs] = useStateF([]);
  const [found, setFound] = useStateF({ critical: 0, high: 0, medium: 0, low: 0 });

  const phases = [
    { k: "clone", t: T("Cloning repository","克隆仓库"), d: T("shallow clone, ~12 MB","浅克隆, ~12 MB") },
    { k: "index", t: T("Building AST index","构建 AST 索引"), d: T("parsing 1,284 files","解析 1,284 个文件") },
    { k: "secrets", t: T("Scanning for secrets","扫描密钥泄露"), d: T("regex + entropy scan","正则 + 熵值扫描") },
    { k: "deps", t: T("Analyzing dependencies","分析依赖"), d: T("287 packages, 12 transitive","287 个包, 12 个传递依赖") },
    { k: "ai", t: T("AI semantic review","AI 语义 review"), d: T("claude-haiku-4-5 · 6 lenses","claude-haiku-4-5 · 6 种 lens") },
    { k: "report", t: T("Composing report","生成报告"), d: T("merging signals","合并信号") },
  ];

  useEffectF(() => {
    let p = 0;
    const id = setInterval(() => {
      p += Math.random() * 4 + 1.5;
      if (p > 100) p = 100;
      setPct(p);
      const s = Math.min(phases.length - 1, Math.floor((p / 100) * phases.length));
      setStepIdx(s);
      const sample = [
        "→ git fetch --depth=1 main",
        "→ pnpm install --frozen-lockfile",
        "✓ packages indexed: 1,284 files",
        "✓ secrets scan: 2 high-entropy strings flagged",
        "✓ dep scan: 1 CVE matched (axios@0.21.1)",
        "✓ ast lens: 11 suspect patterns",
        "✓ ai lens: 6 issues with confidence > 0.8",
        "✓ merging signals…",
      ];
      if (Math.random() > 0.5) {
        setLogs(L => [...L.slice(-9), sample[Math.floor(Math.random() * sample.length)]]);
      }
      if (p > 30) setFound(f => ({ ...f, critical: 2 }));
      if (p > 50) setFound(f => ({ ...f, high: Math.min(4, Math.floor((p-50)/12)+1) }));
      if (p > 65) setFound(f => ({ ...f, medium: Math.min(9, Math.floor((p-65)/4)) }));
      if (p > 80) setFound(f => ({ ...f, low: Math.min(7, Math.floor((p-80)/3)) }));
      if (p >= 100) {
        clearInterval(id);
        setTimeout(() => go("dashboard"), 700);
      }
    }, 220);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app fade-in">
      <Topbar go={go} now={T("Scanning…","扫描进行中")} />
      <div className="main narrow" style={{ margin: "0 auto" }}>
        <div className="scanning">
          <div className="scanning-card card">
            <div className="scanning-h">
              <div className="scanning-icon"><span className="spin" style={{ display: "inline-block" }}><I.Refresh size={18} /></span></div>
              <div>
                <div className="scanning-title">{T("Scanning ","扫描 ")}<b>{activeRepo?.name || "yourname/billing-service"}</b></div>
                <div className="scanning-sub">{T("branch ","分支 ")}<span className="tag">main</span>{T(" · commit "," · commit ")}<span className="tag">a3f9c2</span>{T(" · ~1 min 10 s remaining"," · 预计 1 分 10 秒")}</div>
              </div>
              <button className="btn ghost" onClick={() => go("repos")}>{T("Cancel","取消")}</button>
            </div>

            <div className="scanning-bar-wrap">
              <div className="scanning-bar"><div className="scanning-bar-fill" style={{ width: pct + "%" }}></div></div>
              <div className="scanning-bar-meta">
                <span>{Math.floor(pct)}%</span>
                <span>{phases[stepIdx]?.t}</span>
              </div>
            </div>

            <div className="scanning-phases">
              {phases.map((p, i) => (
                <div key={p.k} className={"scanning-phase" + (i < stepIdx ? " done" : i === stepIdx ? " on" : "")}>
                  <div className="scanning-phase-bullet">
                    {i < stepIdx ? <I.Check size={11} /> : i === stepIdx ? <span className="pulse" style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: "currentColor" }}></span> : i+1}
                  </div>
                  <div>
                    <div className="scanning-phase-t">{p.t}</div>
                    <div className="scanning-phase-d">{p.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="scanning-side">
            <div className="card scanning-counts">
              <div className="scanning-counts-h">{T("Live findings","实时发现")}</div>
              <div className="scanning-counts-grid">
                <div><b style={{ color: "var(--sev-critical)" }}>{found.critical}</b><span>Critical</span></div>
                <div><b style={{ color: "var(--sev-high)" }}>{found.high}</b><span>High</span></div>
                <div><b style={{ color: "var(--sev-medium)" }}>{found.medium}</b><span>Medium</span></div>
                <div><b style={{ color: "var(--sev-low)" }}>{found.low}</b><span>Low</span></div>
              </div>
            </div>

            <div className="card scanning-log">
              <div className="scanning-counts-h">Live log</div>
              <div className="scanning-log-body">
                {logs.length === 0 && <div className="muted">{T("Waiting for engine…","等待引擎启动…")}</div>}
                {logs.map((l, i) => (<div key={i} className="scanning-log-line">{l}</div>))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
