// screens/dashboard.jsx — Overview dashboard with list/grid/kanban layouts

import { FIXTURES } from "../data.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

function Sparkline({ data, color, w = 120, h = 32 }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - 12;
  const cx = size / 2, cy = size / 2;
  const stroke = 14;
  let acc = 0;
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={stroke} />
      {data.map((d, i) => {
        const frac = d.value / total;
        const len = 2 * Math.PI * r;
        const dash = frac * len;
        const offset = -acc * len;
        acc += frac;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={d.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${len - dash}`} strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
        );
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" style={{ font: "600 22px var(--font-display)", fill: "var(--text)" }}>{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ font: "500 10.5px var(--font-sans)", fill: "var(--text-3)", letterSpacing: ".06em" }}>OPEN ISSUES</text>
    </svg>
  );
}

export function DashboardScreen({ go, layout, setIssue, accent }) {
  useLang();
  const issues = FIXTURES.ISSUES.filter(i => i.status === "open").slice(0, 8);
  const critical = FIXTURES.ISSUES.filter(i => i.severity === "critical" && i.status === "open").length;
  const high = FIXTURES.ISSUES.filter(i => i.severity === "high" && i.status === "open").length;
  const medium = FIXTURES.ISSUES.filter(i => i.severity === "medium" && i.status === "open").length;
  const low = FIXTURES.ISSUES.filter(i => i.severity === "low" && i.status === "open").length;
  const open = critical + high + medium + low;
  const autoFixable = FIXTURES.ISSUES.filter(i => i.autoFix && i.status === "open").length;

  const donut = [
    { value: critical, color: "var(--sev-critical)", label: "Critical" },
    { value: high, color: "var(--sev-high)", label: "High" },
    { value: medium, color: "var(--sev-medium)", label: "Medium" },
    { value: low, color: "var(--sev-low)", label: "Low" },
  ];

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Acme Inc", go: "dashboard" },
        { label: "billing-service" },
      ]} />
      <div className="with-side">
        <Sidebar section="dashboard" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>Overview</h1>
              <div className="sub" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span className="tag"><I.GitBranch size={10} /> main</span>
                <span className="tag">commit a3f9c2</span>
                <span>{T("Last scan: today 09:14 · took 1m 12s","上次扫描: 今天 09:14 · 用时 1分 12秒")}</span>
              </div>
            </div>
            <div className="actions">
              <button className="btn"><I.Refresh size={14} /> {T("Re-scan","重新扫描")}</button>
              <button className="btn primary"><I.GitPull size={14} /> {T(`Auto-fix ${autoFixable} items`, `一键修复 ${autoFixable} 项`)}</button>
            </div>
          </div>

          {/* KPI Row */}
          <div className="kpi-row">
            <div className="kpi card">
              <div className="kpi-h">
                <span className="kpi-l">Open issues</span>
                <span className="kpi-d" style={{ color: "var(--sev-critical)" }}>↑ 3</span>
              </div>
              <div className="kpi-v">{open}</div>
              <Sparkline data={FIXTURES.TREND} color={accent} w={180} h={36} />
            </div>
            <div className="kpi card">
              <div className="kpi-h"><span className="kpi-l">Critical</span></div>
              <div className="kpi-v" style={{ color: "var(--sev-critical)" }}>{critical}</div>
              <div className="kpi-foot">{T("Fix immediately · 100% auto-fixable","需立即修复 · 100% 可自动修复")}</div>
            </div>
            <div className="kpi card">
              <div className="kpi-h"><span className="kpi-l">Auto-fixable</span></div>
              <div className="kpi-v">{Math.round(autoFixable / open * 100)}<span style={{ fontSize: 18, color: "var(--text-3)" }}>%</span></div>
              <div className="kpi-foot">{autoFixable} {T("of","of")} {open} {T("can apply patch in one click","可一键应用 patch")}</div>
            </div>
            <div className="kpi card">
              <div className="kpi-h"><span className="kpi-l">{T("Health score","健康分")}</span></div>
              <div className="kpi-v">B<span style={{ fontSize: 18, color: "var(--text-3)" }}>+</span></div>
              <div className="kpi-foot">{T("Resolve all critical to reach A-","解决全部 critical 后可达 A-")}</div>
            </div>
          </div>

          {/* Hero summary */}
          <div className="dash-grid">
            <div className="card dash-summary">
              <div className="dash-summary-head">
                <h3>{T("Issue distribution","问题分布")}</h3>
                <div className="seg">
                  <button className="seg-i active">{T("This scan","本次")}</button>
                  <button className="seg-i">{T("7 days","近 7 天")}</button>
                  <button className="seg-i">{T("30 days","近 30 天")}</button>
                </div>
              </div>
              <div className="dash-donut">
                <DonutChart data={donut} />
                <div className="dash-donut-legend">
                  {donut.map(d => (
                    <div key={d.label} className="dash-donut-row">
                      <span className="dash-donut-dot" style={{ background: d.color }}></span>
                      <span>{d.label}</span>
                      <b>{d.value}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card dash-cats">
              <div className="dash-summary-head"><h3>{T("By category","按类别")}</h3><a className="auth-link">{T("View all","查看全部")}</a></div>
              {[
                { k: "Security", n: 2, color: "var(--sev-critical)", icon: <I.Shield size={13} /> },
                { k: "Performance", n: 2, color: "var(--sev-high)", icon: <I.Zap size={13} /> },
                { k: "Dependencies", n: 1, color: "var(--sev-medium)", icon: <I.Package size={13} /> },
                { k: "Quality", n: 3, color: "var(--sev-low)", icon: <I.Bug size={13} /> },
                { k: "Tests", n: 1, color: "var(--text-2)", icon: <I.FileCode size={13} /> },
                { k: "Docs", n: 1, color: "var(--text-3)", icon: <I.FileCode size={13} /> },
                { k: "Architecture", n: 1, color: "var(--text-3)", icon: <I.Layers size={13} /> },
              ].map(c => (
                <div key={c.k} className="dash-cat-row">
                  <span style={{ color: c.color, display: "inline-flex", alignItems: "center", gap: 8, minWidth: 130 }}>
                    {c.icon} {c.k}
                  </span>
                  <div className="dash-cat-bar"><div style={{ width: (c.n / 3) * 100 + "%", background: c.color }}></div></div>
                  <b style={{ minWidth: 18, textAlign: "right" }}>{c.n}</b>
                </div>
              ))}
            </div>
          </div>

          {/* Issue area with layout switcher */}
          <div className="dash-issues-h">
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{T("Needs attention","需要关注")}</h2>
              <div className="sub" style={{ fontSize: 12.5 }}>{T("Sorted by severity + confidence","按 severity + confidence 排序的优先项")}</div>
            </div>
            <div className="actions" style={{ display: "flex", gap: 8 }}>
              <div className="seg">
                <button className={"seg-i" + (layout === "list" ? " active" : "")} title="List"><I.List size={13} /></button>
                <button className={"seg-i" + (layout === "grid" ? " active" : "")} title="Grid"><I.Grid size={13} /></button>
                <button className={"seg-i" + (layout === "kanban" ? " active" : "")} title="Kanban"><I.Kanban size={13} /></button>
              </div>
              <button className="btn sm" onClick={() => go("issues")}>{T("All issues","所有 issues")} <I.ArrowR size={12} /></button>
            </div>
          </div>

          {layout === "list" && (
            <div className="issue-list">
              {issues.map(it => (
                <IssueRow key={it.id} it={it} onClick={() => { setIssue(it); go("issue"); }} />
              ))}
            </div>
          )}
          {layout === "grid" && (
            <div className="issue-grid">
              {issues.map(it => (
                <IssueCard key={it.id} it={it} onClick={() => { setIssue(it); go("issue"); }} />
              ))}
            </div>
          )}
          {layout === "kanban" && (
            <div className="issue-kanban">
              {[
                { k: "critical", t: "Critical", color: "var(--sev-critical)" },
                { k: "high", t: "High", color: "var(--sev-high)" },
                { k: "medium", t: "Medium", color: "var(--sev-medium)" },
                { k: "low", t: "Low", color: "var(--sev-low)" },
              ].map(col => {
                const cards = issues.filter(i => i.severity === col.k);
                return (
                  <div key={col.k} className="kan-col">
                    <div className="kan-col-h">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: col.color }}>
                        <span className="dot" style={{ width: 7, height: 7, borderRadius: 999, background: col.color }}></span>
                        {col.t}
                      </span>
                      <span className="tag">{cards.length}</span>
                    </div>
                    <div className="kan-col-body">
                      {cards.length === 0 && <div className="kan-empty">{T("None","无")}</div>}
                      {cards.map(it => (
                        <KanCard key={it.id} it={it} onClick={() => { setIssue(it); go("issue"); }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueRow({ it, onClick }) {
  return (
    <div className="issue-row" onClick={onClick}>
      <div className={"issue-sev sev-bg-" + it.severity}>
        <span className="dot" style={{ background: "currentColor" }}></span>
        {it.severity}
      </div>
      <div className="issue-id">{it.id}</div>
      <div className="issue-main">
        <div className="issue-t">{it.title}</div>
        <div className="issue-meta">
          <span><I.FileCode size={11} /> {it.file}{it.line ? ":" + it.line : ""}</span>
          <span className="tag">{it.category}</span>
          {it.autoFix && <span className="chip" style={{ color: "var(--accent)" }}><I.Sparkle size={10} /> Auto-fix</span>}
          <span style={{ color: "var(--text-3)" }}>· {Math.round(it.confidence * 100)}% {T("confidence","置信")}</span>
        </div>
      </div>
      <div className="issue-effort">{it.effort}</div>
      <I.ChevR size={14} style={{ color: "var(--text-4)" }} />
    </div>
  );
}

function IssueCard({ it, onClick }) {
  return (
    <div className="card issue-card" onClick={onClick}>
      <div className="issue-card-h">
        <span className={"sev sev-" + it.severity}><span className="dot" style={{ background: "currentColor" }}></span>{it.severity}</span>
        <span className="issue-id">{it.id}</span>
      </div>
      <div className="issue-card-t">{it.title}</div>
      <div className="issue-meta" style={{ marginTop: 8 }}>
        <span><I.FileCode size={11} /> {it.file.split("/").pop()}</span>
        {it.autoFix && <span className="chip" style={{ color: "var(--accent)" }}><I.Sparkle size={10} /> Auto-fix</span>}
      </div>
      <div className="issue-card-foot">
        <span className="tag">{it.category}</span>
        <span style={{ color: "var(--text-3)", fontSize: 11 }}>· {it.effort}</span>
      </div>
    </div>
  );
}

function KanCard({ it, onClick }) {
  return (
    <div className="kan-card" onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="issue-id">{it.id}</span>
        {it.autoFix && <I.Sparkle size={11} style={{ color: "var(--accent)" }} />}
      </div>
      <div className="kan-card-t">{it.title}</div>
      <div className="kan-card-foot">
        <span className="tag" style={{ height: 18, fontSize: 10 }}>{it.category}</span>
        <span style={{ color: "var(--text-3)", fontSize: 10.5 }}>{it.effort}</span>
      </div>
    </div>
  );
}
