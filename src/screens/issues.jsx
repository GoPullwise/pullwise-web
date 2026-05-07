// screens/issues.jsx — Issues list, Issue detail, History, Settings

import React, { useState as useStateI } from "react";
import { FIXTURES } from "../data.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

const SORT_OPTIONS = [
  { k: "severity",   t_en: "Severity",    t_zh: "按严重度",   d_en: "Critical → Low",     d_zh: "Critical → Low" },
  { k: "confidence", t_en: "Confidence",  t_zh: "按置信度",   d_en: "Highest first",      d_zh: "高 → 低" },
  { k: "effort",     t_en: "Effort",      t_zh: "按工作量",   d_en: "Quick wins first",   d_zh: "快速修复优先" },
  { k: "newest",     t_en: "Newest",      t_zh: "按时间",     d_en: "Recently detected",  d_zh: "最近发现的" },
  { k: "file",       t_en: "File path",   t_zh: "按文件路径", d_en: "Alphabetical",       d_zh: "字母顺序" },
];

function sortIssues(arr, key) {
  const sevRank = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const a = arr.slice();
  if (key === "severity")   a.sort((x, y) => (sevRank[y.severity] - sevRank[x.severity]) || (y.confidence - x.confidence));
  if (key === "confidence") a.sort((x, y) => y.confidence - x.confidence);
  if (key === "effort")     a.sort((x, y) => (parseInt(x.effort) || 999) - (parseInt(y.effort) || 999));
  if (key === "newest")     a.sort((x, y) => {
    const fresh = (s) => /just|刚|today|今天|hour|小时/i.test(s || "") ? 2 : /day|天/i.test(s || "") ? 1 : 0;
    return fresh(y.age) - fresh(x.age);
  });
  if (key === "file")       a.sort((x, y) => (x.file || "").localeCompare(y.file || ""));
  return a;
}

function buildContextLines(it) {
  const focus = it.line || 30;
  const flagMap = {};
  (it.badCode || []).forEach(l => { flagMap[l.ln] = l; });

  const ext = (it.file || "").match(/\.(\w+)$/)?.[1] || "ts";
  const stock = stockLines(ext, it);

  const radius = 12;
  const out = [];
  for (let i = -radius; i <= radius; i++) {
    const ln = focus + i;
    if (ln < 1) continue;
    if (flagMap[ln]) {
      out.push({ ln, code: flagMap[ln].code, t: flagMap[ln].t });
    } else {
      const idx = ((ln % stock.length) + stock.length) % stock.length;
      out.push({ ln, code: stock[idx], t: ln === focus ? "focus" : null });
    }
  }
  return out;
}

function stockLines(ext, it) {
  if (ext === "json") return [
    "  \"name\": \"billing-service\",",
    "  \"version\": \"1.4.0\",",
    "  \"private\": true,",
    "  \"scripts\": {",
    "    \"build\": \"next build\",",
    "    \"test\": \"vitest run\",",
    "    \"lint\": \"eslint --max-warnings 0 .\"",
    "  },",
    "  \"dependencies\": {",
    "    \"react\": \"^18.3.1\",",
    "    \"next\": \"^14.2.5\",",
    "    \"zod\": \"^3.23.8\",",
    "    \"axios\": \"0.21.1\",",
    "    \"stripe\": \"^15.7.0\"",
    "  },",
  ];
  if (ext === "md") return [
    "## Quick start",
    "",
    "```bash",
    "pnpm install && pnpm dev",
    "```",
    "",
    "Visit `http://localhost:3000` and sign in.",
    "",
    "## Configuration",
    "",
    "Set environment variables in `.env.local`:",
    "",
    "- `STRIPE_SECRET_KEY` — server-side only",
    "- `DATABASE_URL`",
  ];
  if (it.category === "Performance") return [
    "import { useQuery, useQueries } from \"@tanstack/react-query\";",
    "import { trpc } from \"@/lib/trpc\";",
    "",
    "export default function Dashboard() {",
    "  const { data: projects } = useQuery({",
    "    queryKey: [\"projects\"],",
    "    queryFn: () => trpc.projects.list.query(),",
    "  });",
    "",
    "  if (!projects) return <Skeleton />;",
    "",
    "  return (",
    "    <div className=\"grid\">",
    "      {projects.map((p) => <ProjectCard key={p.id} project={p} />)}",
    "    </div>",
    "  );",
    "}",
  ];
  return [
    "import { logger } from \"@/lib/logger\";",
    "import { z } from \"zod\";",
    "",
    "const RequestSchema = z.object({",
    "  id: z.string().min(1),",
    "  amount: z.number().positive(),",
    "});",
    "",
    "export async function handle(req: Request) {",
    "  const data = RequestSchema.parse(await req.json());",
    "  logger.info(\"request\", { id: data.id });",
    "",
    "  const result = await processRequest(data);",
    "  return Response.json(result);",
    "}",
    "",
    "async function processRequest(input) {",
    "  // ...",
    "}",
  ];
}

export function IssuesScreen({ go, setIssue }) {
  useLang();
  const all = FIXTURES.ISSUES;
  const [sev, setSev] = useStateI("all");
  const [cat, setCat] = useStateI("all");
  const [status, setStatus] = useStateI("open");
  const [q, setQ] = useStateI("");
  const [selected, setSelected] = useStateI([]);
  const [sortBy, setSortBy] = useStateI("severity");
  const [sortOpen, setSortOpen] = useStateI(false);
  const [filterOpen, setFilterOpen] = useStateI(false);
  const [autoFixOnly, setAutoFixOnly] = useStateI(false);
  const [minConfidence, setMinConfidence] = useStateI(0);

  const filtered = sortIssues(
    all.filter(i => {
      if (sev !== "all" && i.severity !== sev) return false;
      if (cat !== "all" && i.category !== cat) return false;
      if (status !== "all" && i.status !== status) return false;
      if (autoFixOnly && !i.autoFix) return false;
      if (i.confidence * 100 < minConfidence) return false;
      if (q && !i.title.toLowerCase().includes(q.toLowerCase()) && !i.file.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }),
    sortBy
  );

  const sortLabel = SORT_OPTIONS.find(o => o.k === sortBy);
  const advFilterCount = (autoFixOnly ? 1 : 0) + (minConfidence > 0 ? 1 : 0);

  const sevs = ["all", "critical", "high", "medium", "low", "info"];
  const cats = ["all", "Security", "Performance", "Dependencies", "Quality", "Tests", "Docs", "Architecture"];
  const stats = ["open", "fixed", "snoozed", "all"];

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const allOn = filtered.length > 0 && filtered.every(i => selected.includes(i.id));

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Acme Inc", go: "dashboard" },
        { label: "billing-service", go: "dashboard" },
        { label: "Issues" },
      ]} />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>Issues</h1>
              <div className="sub">{filtered.length} {T("items","项")} · {filtered.filter(i => i.autoFix).length} {T("auto-fixable","项可自动修复")}</div>
            </div>
            <div className="actions">
              <span style={{ position: "relative" }}>
                <button className="btn" onClick={() => { setSortOpen(o => !o); setFilterOpen(false); }}>
                  <I.Sort size={14} /> {T("Sort","排序")}: {T(sortLabel.t_en, sortLabel.t_zh)} <I.ChevD size={11} />
                </button>
                {sortOpen && (
                  <>
                    <div className="pop-back" onClick={() => setSortOpen(false)} />
                    <div className="pop pop-menu">
                      <div className="pop-h"><span>{T("Sort by","排序方式")}</span></div>
                      {SORT_OPTIONS.map(o => (
                        <button key={o.k} className={"pop-i" + (sortBy === o.k ? " on" : "")} onClick={() => { setSortBy(o.k); setSortOpen(false); }}>
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <div className="pop-i-t">{T(o.t_en, o.t_zh)}</div>
                            <div className="pop-i-s">{T(o.d_en, o.d_zh)}</div>
                          </div>
                          {sortBy === o.k && <I.Check size={12} style={{ color: "var(--accent)" }} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </span>
              <span style={{ position: "relative" }}>
                <button className="btn" onClick={() => { setFilterOpen(o => !o); setSortOpen(false); }}>
                  <I.Filter size={14} /> {T("Filters","高级过滤")}
                  {advFilterCount > 0 && <span className="badge" style={{ marginLeft: 4 }}>{advFilterCount}</span>}
                </button>
                {filterOpen && (
                  <>
                    <div className="pop-back" onClick={() => setFilterOpen(false)} />
                    <div className="pop pop-menu pop-wide">
                      <div className="pop-h">
                        <span>{T("Advanced filters","高级过滤")}</span>
                        <a className="auth-link" onClick={() => { setAutoFixOnly(false); setMinConfidence(0); }}>{T("Reset","重置")}</a>
                      </div>
                      <div className="pop-section">
                        <div className="pop-row">
                          <div style={{ flex: 1 }}>
                            <div className="pop-i-t">{T("Auto-fixable only","仅可自动修复")}</div>
                            <div className="pop-i-s">{T("Hide issues without a generated patch","隐藏没有可应用 patch 的 issue")}</div>
                          </div>
                          <span className={"switch" + (autoFixOnly ? " on" : "")} onClick={() => setAutoFixOnly(v => !v)}><span></span></span>
                        </div>
                        <div className="pop-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span className="pop-i-t">{T("Minimum confidence","最低置信度")}</span>
                            <span style={{ color: "var(--text-3)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{minConfidence}%</span>
                          </div>
                          <input
                            type="range" min={0} max={100} step={5}
                            value={minConfidence}
                            onChange={e => setMinConfidence(parseInt(e.target.value))}
                            className="pop-slider"
                          />
                        </div>
                      </div>
                      <div className="pop-foot" style={{ justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} {T("matches","项匹配")}</span>
                        <button className="btn sm primary" onClick={() => setFilterOpen(false)}>{T("Done","完成")}</button>
                      </div>
                    </div>
                  </>
                )}
              </span>
              {selected.length > 0 ? (
                <button className="btn primary"><I.GitPull size={14} /> {T(`Create PR for ${selected.length} items`,`为选中 ${selected.length} 项创建 PR`)}</button>
              ) : (
                <button className="btn primary"><I.Sparkle size={14} /> {T("Auto-fix all","一键修复全部")}</button>
              )}
            </div>
          </div>

          <div className="filters card">
            <div className="filters-row">
              <div className="repos-search" style={{ flex: 1 }}>
                <I.Search size={14} />
                <input placeholder={T("Search by title or file...","按标题或文件搜索...")} value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <div className="seg">
                {stats.map(s => (
                  <button key={s} className={"seg-i" + (status === s ? " active" : "")} onClick={() => setStatus(s)}>
                    {s === "open" ? "Open" : s === "fixed" ? "Fixed" : s === "snoozed" ? "Snoozed" : "All"}
                  </button>
                ))}
              </div>
            </div>
            <div className="filters-row">
              <div className="filter-pills">
                <span className="filter-l">Severity</span>
                {sevs.map(s => (
                  <button key={s} className={"pill-btn" + (sev === s ? " active" : "")} onClick={() => setSev(s)}>
                    {s === "all" ? T("All","全部") : <><span className="dot" style={{ background: `var(--sev-${s})` }}></span>{s}</>}
                  </button>
                ))}
              </div>
            </div>
            <div className="filters-row">
              <div className="filter-pills">
                <span className="filter-l">Category</span>
                {cats.map(c => (
                  <button key={c} className={"pill-btn" + (cat === c ? " active" : "")} onClick={() => setCat(c)}>
                    {c === "all" ? T("All","全部") : c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="issues-table card">
            <div className="issues-thead">
              <div className="issues-check">
                <span className="repo-check-box" onClick={() => setSelected(allOn ? [] : filtered.map(i => i.id))}>
                  {allOn && <I.Check size={11} />}
                </span>
              </div>
              <div>Issue</div>
              <div>File</div>
              <div>Category</div>
              <div>Confidence</div>
              <div>Effort</div>
              <div></div>
            </div>
            {filtered.map(it => (
              <div key={it.id} className={"issues-trow" + (selected.includes(it.id) ? " on" : "")}>
                <div className="issues-check" onClick={() => toggle(it.id)}>
                  <span className="repo-check-box">{selected.includes(it.id) && <I.Check size={11} />}</span>
                </div>
                <div className="issues-title-c" onClick={() => { setIssue(it); go("issue"); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span className={"sev sev-" + it.severity}><span className="dot" style={{ background: "currentColor" }}></span>{it.severity}</span>
                    <span className="issue-id">{it.id}</span>
                    {it.status === "fixed" && <span className="pill sev-bg-low" style={{ background: "color-mix(in oklch, #16a34a 15%, transparent)", color: "#16a34a" }}><I.Check size={10} /> fixed</span>}
                    {it.status === "snoozed" && <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--text-3)" }}><I.Clock size={10} /> snoozed</span>}
                  </div>
                  <div className="issue-t">{it.title}</div>
                </div>
                <div className="issues-file">{it.file}{it.line ? ":" + it.line : ""}</div>
                <div><span className="tag">{it.category}</span></div>
                <div>
                  <div className="conf-bar"><div style={{ width: it.confidence * 100 + "%" }}></div></div>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>{Math.round(it.confidence * 100)}%</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{it.effort}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {it.autoFix && it.status === "open" && <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); setIssue(it); go("issue"); }}><I.Sparkle size={11} /> Fix</button>}
                  <button className="btn sm" onClick={() => { setIssue(it); go("issue"); }}><I.ArrowR size={11} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IssueDetailScreen({ go, issue }) {
  useLang();
  const it = issue || FIXTURES.ISSUES[0];
  const [tab, setTab] = useStateI("fix");
  const [applied, setApplied] = useStateI(false);
  const [showPR, setShowPR] = useStateI(false);

  const renderCode = (lines, title) => (
    <div className="code">
      <div className="code-head">
        <span><I.FileCode size={12} style={{ marginRight: 6 }} />{it.file}</span>
        <span style={{ color: "var(--text-3)" }}>{title}</span>
      </div>
      <div className="code-body">
        <pre>
          {lines.map((l, i) => (
            <div key={i} className={"code-line" + (l.t === "add" ? " add" : l.t === "del" ? " del" : "")}>
              <span className="ln">{l.ln}</span>
              <span className="marker" style={{ width: 12 }}>{l.t === "add" ? "+" : l.t === "del" ? "-" : " "}</span>
              <span>{l.code || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Acme Inc", go: "dashboard" },
        { label: "billing-service", go: "dashboard" },
        { label: "Issues", go: "issues" },
        { label: it.id },
      ]} />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: 1100 }}>
          <button className="btn ghost sm" onClick={() => go("issues")} style={{ marginBottom: 12 }}>
            <I.ArrowL size={13} /> {T("Back to list","返回列表")}
          </button>

          <div className="issue-detail-h">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className={"sev sev-" + it.severity}><span className="dot" style={{ background: "currentColor", width: 8, height: 8 }}></span>{it.severity}</span>
                <span className="issue-id">{it.id}</span>
                <span className="tag">{it.category}</span>
                {it.tags?.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>{it.title}</h1>
              <div style={{ color: "var(--text-2)", fontSize: 13.5, marginBottom: 4 }}>{it.summary}</div>
              <div className="sub" style={{ display: "flex", gap: 14, fontSize: 12.5, marginTop: 6 }}>
                <span><I.FileCode size={12} /> {it.file}{it.line ? ":" + it.line : ""}</span>
                <span><I.Clock size={12} /> {it.age}</span>
                <span><I.Sparkle size={12} /> {Math.round(it.confidence * 100)}% {T("confidence","置信")}</span>
                <span>{T("est. ","预计 ")}{it.effort}</span>
              </div>
            </div>
            <div className="actions" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              {it.autoFix && (
                applied ? (
                  <button className="btn lg accent" onClick={() => setShowPR(true)}>
                    <I.GitPull size={14} /> Create PR
                  </button>
                ) : (
                  <button className="btn lg primary" onClick={() => setApplied(true)}>
                    <I.Sparkle size={14} /> Apply fix
                  </button>
                )
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn sm">{T("Ignore","忽略")}</button>
                <button className="btn sm">{T("Snooze","推迟")}</button>
                <button className="btn sm"><I.ArrowR size={11} /> {T("Reassign","转给同事")}</button>
              </div>
            </div>
          </div>

          {/* Impact band */}
          <div className="impact-band card">
            <div className="impact-i" style={{ color: "var(--sev-" + it.severity + ")" }}><I.Zap size={18} /></div>
            <div>
              <div className="impact-h">{T("Impact","影响")}</div>
              <div className="impact-p">{it.impact}</div>
            </div>
          </div>

          <div className="tabs">
            {[
              { k: "fix", t: T("Fix","修复方案") },
              { k: "context", t: T("Context","代码上下文") },
              { k: "discuss", t: T("Discuss","讨论") },
              { k: "history", t: T("Timeline","时间线") },
            ].map(t => (
              <button key={t.k} className={"tab" + (tab === t.k ? " active" : "")} onClick={() => setTab(t.k)}>{t.t}</button>
            ))}
          </div>

          {tab === "fix" && (
            <div className="issue-fix">
              {/* Steps */}
              <div className="card section">
                <div className="section-h">
                  <h3><I.Lightbulb size={14} style={{ marginRight: 6 }} /> {T("Fix steps","修复步骤")}</h3>
                  <span className="tag">{T("Generated by Claude · haiku-4.5","由 Claude · haiku-4.5 生成")}</span>
                </div>
                <ol className="steps">
                  {it.steps.map((s, i) => (<li key={i}><span className="step-n">{i+1}</span><span>{s}</span></li>))}
                </ol>
              </div>

              {/* Diff */}
              {it.badCode && it.goodCode && (
                <div className="diff-grid">
                  <div className="diff-col">
                    <div className="diff-col-h"><span className="diff-tag bad">{T("current","当前")}</span> {T("unsafe implementation","不安全的实现")}</div>
                    {renderCode(it.badCode, "before")}
                  </div>
                  <div className="diff-col">
                    <div className="diff-col-h"><span className="diff-tag good">{T("suggested","建议")}</span> {T("fixed implementation","修复后的实现")}</div>
                    {renderCode(it.goodCode, "after")}
                  </div>
                </div>
              )}

              {/* References */}
              {it.references?.length > 0 && (
                <div className="card section">
                  <div className="section-h"><h3><I.Compass size={14} style={{ marginRight: 6 }} /> {T("Related references","相关资料")}</h3></div>
                  <div className="refs">
                    {it.references.map((r, i) => (
                      <a key={i} className="ref-item">
                        <I.FileCode size={13} />
                        <div>
                          <div className="ref-t">{r.label}</div>
                          <div className="ref-u">{r.url}</div>
                        </div>
                        <I.ArrowR size={12} style={{ marginLeft: "auto", color: "var(--text-4)" }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {applied && (
                <div className="applied-card card">
                  <div className="applied-i" style={{ color: "var(--accent)" }}><I.Check size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="applied-h">{T("Patch applied to local branch ","补丁已应用到本地分支 ")}<span className="tag" style={{ marginLeft: 4 }}>fix/PR-{it.id.split("-")[1]}</span></div>
                    <div className="applied-p">{T(`Code modified, tests passed (${Math.floor(Math.random() * 30) + 60} items). Next: push and open a Pull Request.`,`代码已修改, 测试通过 (${Math.floor(Math.random() * 30) + 60} 项)。下一步可以推送并创建 Pull Request。`)}</div>
                  </div>
                  <button className="btn accent" onClick={() => setShowPR(true)}><I.GitPull size={14} /> Create PR</button>
                </div>
              )}
            </div>
          )}

          {tab === "context" && (
            <div className="card section">
              <div className="section-h">
                <h3>{T("Code context (±12 lines)","代码上下文 (±12 行)")}</h3>
                <span className="tag"><I.FileCode size={11} /> {it.file}{it.line ? ":" + it.line : ""}</span>
              </div>
              <div className="code">
                <div className="code-head">
                  <span><I.GitBranch size={11} style={{ marginRight: 6 }} /> main · a3f9c2</span>
                  <span style={{ color: "var(--text-3)" }}>{(it.file || "").match(/\.(\w+)$/)?.[1] || "ts"}</span>
                </div>
                <div className="code-body">
                  <pre>
                    {buildContextLines(it).map((l, i) => (
                      <div
                        key={i}
                        className={"code-line" + (l.t === "del" ? " del" : l.t === "add" ? " add" : "") + (l.t === "focus" ? " focus" : "")}
                      >
                        <span className="ln">{l.ln}</span>
                        <span className="marker" style={{ width: 12 }}>
                          {l.t === "del" ? "-" : l.t === "add" ? "+" : l.t === "focus" ? "→" : " "}
                        </span>
                        <span>{l.code || " "}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {T("Highlighted line is where the issue was detected.","高亮行为问题所在位置。")}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn sm"><I.Github size={11} /> {T("Open in GitHub","在 GitHub 中打开")}</button>
                  <button className="btn sm primary" onClick={() => setTab("fix")}>
                    <I.Sparkle size={11} /> {T("View fix","查看修复")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "discuss" && (
            <div className="card section" style={{ padding: 24 }}>
              <div className="section-h"><h3>{T("Team discussion","团队讨论")}</h3></div>
              <div className="discuss">
                <div className="discuss-msg">
                  <div className="discuss-av" style={{ background: "var(--accent)" }}>T</div>
                  <div>
                    <div><b>Taylor</b> · <span style={{ color: "var(--text-3)" }}>2 hours ago</span></div>
                    <p>这个之前合过类似的修复, 我们应该把 server-only 强制注入到所有 payment 模块里。</p>
                  </div>
                </div>
                <div className="discuss-msg">
                  <div className="discuss-av" style={{ background: "#7c3aed" }}>R</div>
                  <div>
                    <div><b>Reviewer</b> <span className="tag" style={{ marginLeft: 4 }}>AI</span> · <span style={{ color: "var(--text-3)" }}>2 hours ago</span></div>
                    <p>已查询历史: 类似修复曾在 commit f08d11 中应用于 lib/auth.ts。建议同步检查 lib/refunds.ts 是否存在相同模式 — 我可以批量扫描。</p>
                  </div>
                </div>
                <textarea className="discuss-input" placeholder="@reviewer 帮我把这个套用到 lib/refunds.ts" />
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="card section">
              <div className="section-h"><h3>{T("Timeline","时间线")}</h3></div>
              <ul className="timeline">
                <li><span className="tl-dot" style={{ background: "var(--sev-critical)" }}></span><div><b>{T("Issue detected","检测到此问题")}</b><div className="muted">{T("Scan #s2 · today 09:14 · main@a3f9c2","扫描 #s2 · 今天 09:14 · main@a3f9c2")}</div></div></li>
                <li><span className="tl-dot" style={{ background: "var(--accent)" }}></span><div><b>{T("AI generated fix","AI 生成修复方案")}</b><div className="muted">{T("confidence 0.97 · 27-line patch","置信度 0.97 · 写入 patch 27 行")}</div></div></li>
                <li><span className="tl-dot"></span><div><b>{T("Awaiting apply","等待应用")}</b><div className="muted">{T("— current stage —","— 当前阶段 —")}</div></div></li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {showPR && <PRModal it={it} close={() => setShowPR(false)} />}
    </div>
  );
}

function PRModal({ it, close }) {
  useLang();
  const [step, setStep] = useStateI(0);
  const [created, setCreated] = useStateI(false);
  React.useEffect(() => {
    if (step > 0 && step < 3) {
      const id = setTimeout(() => setStep(step + 1), 700);
      return () => clearTimeout(id);
    }
    if (step === 3) {
      const id = setTimeout(() => setCreated(true), 400);
      return () => clearTimeout(id);
    }
  }, [step, setCreated, setStep]);

  return (
    <div className="modal-back" onClick={close}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h">
          <h3><I.GitPull size={16} style={{ marginRight: 6 }} /> Create Pull Request</h3>
          <button className="btn ghost sm" onClick={close}><I.X size={14} /></button>
        </div>
        {!created ? (
          <div className="modal-body">
            <div className="pr-form">
              <label className="auth-field">
                <span>Branch</span>
                <div className="auth-input"><I.GitBranch size={13} /><input defaultValue={`fix/PR-${it.id.split("-")[1]}`} /></div>
              </label>
              <label className="auth-field">
                <span>{T("Title","标题")}</span>
                <div className="auth-input"><input defaultValue={`fix(${it.category.toLowerCase()}): ${it.title}`} /></div>
              </label>
              <label className="auth-field">
                <span>{T("Description","描述")}</span>
                <textarea className="pr-desc" defaultValue={T(`## Overview\n${it.summary}\n\n## Impact\n${it.impact}\n\n## Changes\n${it.steps.map((s,i)=>`${i+1}. ${s}`).join("\n")}\n\n— Generated by Pullwise (${it.id})`, `## 概述\n${it.summary}\n\n## 影响\n${it.impact}\n\n## 修改\n${it.steps.map((s,i)=>`${i+1}. ${s}`).join("\n")}\n\n— 由 Pullwise 自动生成 (${it.id})`)} />
              </label>
              <label className="pr-check"><input type="checkbox" defaultChecked /> {T("Include diff summary and scan link in PR description","在 PR 描述中包含 diff 摘要与扫描链接")}</label>
              <label className="pr-check"><input type="checkbox" defaultChecked /> Request review from <b>@taylor-dev</b></label>
            </div>
            {step > 0 && (
              <div className="pr-progress">
                {[
                  { k: 1, t: T("Push branch to origin","推送 branch 到 origin") },
                  { k: 2, t: T("Create Pull Request","创建 Pull Request") },
                  { k: 3, t: T("Request reviewer","请求 reviewer") },
                ].map(s => (
                  <div key={s.k} className={"pr-step" + (step >= s.k ? " on" : "")}>
                    {step > s.k ? <I.Check size={11} /> : step === s.k ? <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={11} /></span> : <span>{s.k}</span>}
                    <span>{s.t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="modal-body" style={{ textAlign: "center", padding: "24px 24px 28px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: "color-mix(in oklch, #16a34a 15%, transparent)", color: "#16a34a", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <I.Check size={28} />
            </div>
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>{T("PR #482 created","PR #482 已创建")}</h3>
            <p style={{ color: "var(--text-2)", marginBottom: 16 }}>github.com/yourname/billing-service/pull/482</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn" onClick={close}>{T("Close","关闭")}</button>
              <button className="btn primary"><I.Github size={14} /> {T("Open in GitHub","在 GitHub 中打开")}</button>
            </div>
          </div>
        )}
        {!created && (
          <div className="modal-foot">
            <button className="btn" onClick={close}>{T("Cancel","取消")}</button>
            <button className="btn accent" onClick={() => setStep(1)} disabled={step > 0}>
              <I.GitPull size={13} /> {step > 0 ? T("Creating…","创建中…") : T("Confirm create","确认创建")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function HistoryScreen({ go }) {
  useLang();
  const scans = FIXTURES.SCANS;
  const [hStatus, setHStatus] = useStateI("all");
  const [hBy, setHBy] = useStateI("all");
  const [hOpen, setHOpen] = useStateI(false);

  const STATUSES = [
    { k: "all",     t_en: "All",     t_zh: "全部" },
    { k: "done",    t_en: "Done",    t_zh: "完成" },
    { k: "running", t_en: "Running", t_zh: "进行中" },
    { k: "failed",  t_en: "Failed",  t_zh: "失败" },
  ];
  const TRIGGERS = [
    { k: "all",  t_en: "Any trigger", t_zh: "任意触发" },
    { k: "auto", t_en: "Webhook",     t_zh: "自动 (webhook)" },
    { k: "you",  t_en: "Manual",      t_zh: "手动" },
  ];

  const filtered = scans.filter(s => {
    if (hStatus !== "all" && s.status !== hStatus) return false;
    if (hBy !== "all" && s.by !== hBy) return false;
    return true;
  });
  const filterCount = (hStatus !== "all" ? 1 : 0) + (hBy !== "all" ? 1 : 0);

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[{ label: "Acme Inc", go: "dashboard" }, { label: T("Scan history","扫描历史") }]} />
      <div className="with-side">
        <Sidebar section="history" go={go} />
        <div className="main">
          <div className="page-h">
            <div>
              <h1>{T("Scan history","扫描历史")}</h1>
              <div className="sub">{filtered.length} {T("of","/")} {scans.length} {T("scans · retained for 90 days","次扫描 · 保留 90 天")}</div>
            </div>
            <div className="actions">
              <span style={{ position: "relative" }}>
                <button className="btn" onClick={() => setHOpen(o => !o)}>
                  <I.Filter size={14} /> {T("Filter","过滤")}
                  {filterCount > 0 && <span className="badge" style={{ marginLeft: 4 }}>{filterCount}</span>}
                  <I.ChevD size={11} />
                </button>
                {hOpen && (
                  <>
                    <div className="pop-back" onClick={() => setHOpen(false)} />
                    <div className="pop pop-menu pop-wide">
                      <div className="pop-h">
                        <span>{T("Filter scans","筛选扫描")}</span>
                        <a className="auth-link" onClick={() => { setHStatus("all"); setHBy("all"); }}>{T("Reset","重置")}</a>
                      </div>
                      <div className="pop-section">
                        <div className="pop-i-t" style={{ marginBottom: 6 }}>{T("Status","状态")}</div>
                        <div className="seg" style={{ width: "100%" }}>
                          {STATUSES.map(s => (
                            <button key={s.k} className={"seg-i" + (hStatus === s.k ? " active" : "")} onClick={() => setHStatus(s.k)}>
                              {T(s.t_en, s.t_zh)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pop-section">
                        <div className="pop-i-t" style={{ marginBottom: 6 }}>{T("Triggered by","触发方式")}</div>
                        <div className="seg" style={{ width: "100%" }}>
                          {TRIGGERS.map(t => (
                            <button key={t.k} className={"seg-i" + (hBy === t.k ? " active" : "")} onClick={() => setHBy(t.k)}>
                              {T(t.t_en, t.t_zh)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pop-foot" style={{ justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} {T("scans","次扫描")}</span>
                        <button className="btn sm primary" onClick={() => setHOpen(false)}>{T("Done","完成")}</button>
                      </div>
                    </div>
                  </>
                )}
              </span>
              <button className="btn primary" onClick={() => go("repos")}><I.Play size={11} /> {T("New scan","新扫描")}</button>
            </div>
          </div>

          <div className="hist-list card">
            {filtered.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                {T("No scans match the current filters.","没有匹配当前过滤条件的扫描。")}
              </div>
            )}
            {filtered.map(s => (
              <div key={s.id} className="hist-row">
                <div className="hist-status">
                  {s.status === "done" && <span className="hist-dot" style={{ background: "#16a34a" }}></span>}
                  {s.status === "running" && <span className="spin" style={{ display: "inline-block", color: "var(--accent)" }}><I.Refresh size={12} /></span>}
                  {s.status === "failed" && <span className="hist-dot" style={{ background: "var(--sev-critical)" }}></span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                    <b style={{ fontSize: 13.5 }}>{s.repo}</b>
                    <span className="tag"><I.GitBranch size={10} /> {s.branch}</span>
                    <span className="tag">{s.commit}</span>
                  </div>
                  <div className="muted">
                    {s.status === "running" ? T("Scanning…","正在扫描…") :
                     s.status === "failed" ? T("Scan failed — credentials invalid","扫描失败 — 凭据失效") :
                     T(`${(s.issues.critical + s.issues.high + s.issues.medium + s.issues.low)} issues · ${s.issues.critical} critical · ${s.issues.high} high`, `${(s.issues.critical + s.issues.high + s.issues.medium + s.issues.low)} 个问题 · ${s.issues.critical} critical · ${s.issues.high} high`)}
                  </div>
                </div>
                <div className="hist-bars">
                  {s.issues && (
                    <div className="hist-stack">
                      {s.issues.critical > 0 && <span style={{ background: "var(--sev-critical)", flex: s.issues.critical }}></span>}
                      {s.issues.high > 0 && <span style={{ background: "var(--sev-high)", flex: s.issues.high }}></span>}
                      {s.issues.medium > 0 && <span style={{ background: "var(--sev-medium)", flex: s.issues.medium }}></span>}
                      {s.issues.low > 0 && <span style={{ background: "var(--sev-low)", flex: s.issues.low }}></span>}
                    </div>
                  )}
                </div>
                <div className="hist-meta">
                  <div>{s.time}</div>
                  <div className="muted">{T("Triggered by ","由 ")}{s.by === "auto" ? "webhook" : "you"}{T(""," 触发")}</div>
                </div>
                <button className="btn sm" onClick={() => go("dashboard")}>{T("View","查看")} <I.ArrowR size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsScreen({ go }) {
  useLang();
  const [tab, setTab] = useStateI("profile");
  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[{ label: "Acme Inc", go: "dashboard" }, { label: T("Settings","设置") }]} />
      <div className="with-side">
        <Sidebar section="settings" go={go} />
        <div className="main">
          <div className="page-h">
            <div>
              <h1>{T("Settings","设置")}</h1>
              <div className="sub">{T("Profile, integrations, scan preferences and billing","个人资料、集成、扫描偏好与计费")}</div>
            </div>
          </div>
          <div className="set-shell">
            <aside className="set-side">
              {[
                { k: "profile", t: T("Profile","个人资料"), i: <I.User size={14} /> },
                { k: "integrations", t: T("Integrations","集成"), i: <I.Github size={14} /> },
                { k: "scan", t: T("Scan preferences","扫描偏好"), i: <I.Sparkle size={14} /> },
                { k: "notifications", t: T("Notifications","通知"), i: <I.Bell size={14} /> },
                { k: "billing", t: T("Billing","计费"), i: <I.Tag size={14} /> },
                { k: "security", t: T("Security","安全"), i: <I.Shield size={14} /> },
              ].map(s => (
                <button key={s.k} className={"set-side-i" + (tab === s.k ? " active" : "")} onClick={() => setTab(s.k)}>
                  {s.i}<span>{s.t}</span>
                </button>
              ))}
            </aside>
            <div className="set-body">
              {tab === "profile" && (
                <>
                  <div className="card section">
                    <div className="section-h"><h3>{T("Profile","个人资料")}</h3></div>
                    <div className="set-row">
                      <div className="set-av" style={{ background: "var(--accent)" }}>T</div>
                      <div style={{ flex: 1 }}>
                        <label className="auth-field"><span>{T("Name","姓名")}</span><div className="auth-input"><input defaultValue="Taylor Chen" /></div></label>
                      </div>
                    </div>
                    <label className="auth-field"><span>{T("Email","邮箱")}</span><div className="auth-input"><I.Mail size={13} /><input defaultValue="taylor@acme.io" /></div></label>
                    <label className="auth-field"><span>{T("Role","角色")}</span><div className="auth-input"><input defaultValue="Engineering Lead" /></div></label>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}><button className="btn primary">{T("Save","保存")}</button></div>
                  </div>
                </>
              )}
              {tab === "integrations" && (
                <div className="card section">
                  <div className="section-h"><h3>{T("Connected integrations","已连接的集成")}</h3></div>
                  <div className="int-row">
                    <I.Github size={20} />
                    <div style={{ flex: 1 }}>
                      <b>GitHub</b><div className="muted">{T("@taylor-dev · 24 repos · push & PR authorized","@taylor-dev · 24 个仓库 · 已授权 push 与 PR")}</div>
                    </div>
                    <span className="pill sev-bg-low" style={{ background: "color-mix(in oklch, #16a34a 14%, transparent)", color: "#16a34a" }}><span className="dot"></span> {T("Connected","已连接")}</span>
                    <button className="btn sm">{T("Configure","配置")}</button>
                  </div>
                  <div className="int-row">
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: "#4A154B", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>S</div>
                    <div style={{ flex: 1 }}><b>Slack</b><div className="muted">{T("Send alerts to #eng-alerts","将告警发送到 #eng-alerts")}</div></div>
                    <button className="btn sm">{T("Connect","连接")}</button>
                  </div>
                  <div className="int-row">
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: "#5E6AD2", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>L</div>
                    <div style={{ flex: 1 }}><b>Linear</b><div className="muted">{T("Auto-sync critical issues to Linear tickets","将 critical issues 自动同步为 Linear ticket")}</div></div>
                    <button className="btn sm">{T("Connect","连接")}</button>
                  </div>
                </div>
              )}
              {tab === "scan" && (
                <div className="card section">
                  <div className="section-h"><h3>{T("Scan preferences","扫描偏好")}</h3></div>
                  <div className="set-pref">
                    <div><b>{T("Auto scan","自动扫描")}</b><div className="muted">{T("Trigger incremental scan on every push / PR","每次 push / PR 时触发增量扫描")}</div></div>
                    <span className="switch on"><span></span></span>
                  </div>
                  <div className="set-pref">
                    <div><b>{T("Include architecture lens","包含 architecture lens")}</b><div className="muted">{T("Provides high-level architecture suggestions (slower, may be noisy)","提供高层架构建议 (略慢, 可能产生噪音)")}</div></div>
                    <span className="switch on"><span></span></span>
                  </div>
                  <div className="set-pref">
                    <div><b>{T("Default branch only","仅扫描默认分支")}</b><div className="muted">{T("Ignore dependabot / renovate auto PRs","忽略 dependabot / renovate 自动 PR")}</div></div>
                    <span className="switch"><span></span></span>
                  </div>
                  <div className="set-pref">
                    <div><b>{T("Auto-apply low-risk patches","自动应用低风险 patch")}</b><div className="muted">{T("Merge lint fixes with confidence ≥ 0.95 directly","直接合入 confidence ≥ 0.95 的 lint 修复")}</div></div>
                    <span className="switch"><span></span></span>
                  </div>
                </div>
              )}
              {tab === "notifications" && (
                <div className="card section">
                  <div className="section-h"><h3>{T("Notifications","通知")}</h3></div>
                  <div className="set-pref"><div><b>{T("New critical issue","新 critical issue")}</b><div className="muted">{T("Email + Slack","邮件 + Slack")}</div></div><span className="switch on"><span></span></span></div>
                  <div className="set-pref"><div><b>{T("Weekly report","每周报告")}</b><div className="muted">{T("Sent Monday morning","周一早上发送")}</div></div><span className="switch on"><span></span></span></div>
                  <div className="set-pref"><div><b>{T("PR merged","PR 被合并")}</b><div className="muted">{T("Email only","仅邮件")}</div></div><span className="switch"><span></span></span></div>
                </div>
              )}
              {tab === "billing" && (
                <div className="card section">
                  <div className="section-h"><h3>{T("Current plan","当前计划")}</h3></div>
                  <div className="bill-card">
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>Pro</div>
                      <div className="muted">{T("$24 / mo · next charge 2026-06-01","$24 / 月 · 下次扣费 2026-06-01")}</div>
                    </div>
                    <button className="btn">{T("Manage","管理订阅")}</button>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <div className="muted" style={{ marginBottom: 6 }}>{T("Scans this month · 142 / 1,000","本月扫描用量 · 142 / 1,000")}</div>
                    <div className="usage-bar"><div style={{ width: "14.2%" }}></div></div>
                  </div>
                </div>
              )}
              {tab === "security" && (
                <div className="card section">
                  <div className="section-h"><h3>{T("Security","安全")}</h3></div>
                  <div className="set-pref"><div><b>{T("Two-factor authentication","双因素认证")}</b><div className="muted">{T("Enabled (TOTP)","已开启 (TOTP)")}</div></div><button className="btn sm">{T("Manage","管理")}</button></div>
                  <div className="set-pref"><div><b>{T("Active sessions","活跃会话")}</b><div className="muted">{T("3 devices","3 个设备")}</div></div><button className="btn sm">{T("View","查看")}</button></div>
                  <div className="set-pref"><div><b>{T("Sign out of all devices","登出所有设备")}</b><div className="muted">{T("Revoke all sessions immediately","立即吊销所有 session")}</div></div><button className="btn sm">{T("Sign out","登出")}</button></div>
                  <div className="set-pref" style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 16 }}>
                    <div><b style={{ color: "var(--sev-critical)" }}>{T("Delete workspace","删除工作区")}</b><div className="muted">{T("Irreversible — all scan history will be erased","不可撤销 — 所有扫描记录将被清除")}</div></div>
                    <button className="btn sm" style={{ color: "var(--sev-critical)", borderColor: "color-mix(in oklch, var(--sev-critical) 30%, transparent)" }}>{T("Delete","删除")}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
