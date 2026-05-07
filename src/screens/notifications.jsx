// screens/notifications.jsx — Full notifications inbox

import { useMemo, useState } from "react";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

const SEED_NOTIFS = [
  {
    id: "n-024", kind: "issue", sev: "critical", repo: "billing-service",
    t_en: "2 critical issues found",      t_zh: "发现 2 个 critical 问题",
    s_en: "Hardcoded Stripe key + SQL injection · scan #s2",
    s_zh: "硬编码 Stripe key + SQL 注入 · 扫描 #s2",
    age_en: "just now",  age_zh: "刚刚",       at: 0,         goto: "issues",
  },
  {
    id: "n-023", kind: "pr", sev: null, repo: "billing-service",
    t_en: "PR #482 merged",                t_zh: "PR #482 已合并",
    s_en: "fix(security): remove hardcoded API key",
    s_zh: "fix(security): 移除硬编码 API key",
    age_en: "2 hours ago", age_zh: "2 小时前", at: 2 * 60,    goto: "history",
  },
  {
    id: "n-022", kind: "fix", sev: null, repo: "billing-service",
    t_en: "axios CVE auto-fix applied",    t_zh: "axios CVE 自动修复已应用",
    s_en: "Bumped axios to 1.6.7 · low-risk patch auto-merged",
    s_zh: "升级 axios 至 1.6.7 · 低风险 patch 自动合并",
    age_en: "yesterday", age_zh: "昨天",     at: 24 * 60,    goto: "issues",
  },
  {
    id: "n-021", kind: "report", sev: null, repo: null,
    t_en: "Weekly report ready",           t_zh: "每周报告已就绪",
    s_en: "Trend: critical issues ↓ 38% this week",
    s_zh: "趋势: 本周 critical 问题数 ↓ 38%",
    age_en: "4 days ago", age_zh: "4 天前", at: 4 * 24 * 60, goto: "dashboard",
  },
  {
    id: "n-020", kind: "issue", sev: "high", repo: "billing-service",
    t_en: "Coverage dropped to 62%",       t_zh: "测试覆盖率降至 62%",
    s_en: "Below the 70% workspace threshold",
    s_zh: "低于工作区设定的 70% 阈值",
    age_en: "1 week ago", age_zh: "1 周前", at: 7 * 24 * 60, goto: "dashboard",
  },
  {
    id: "n-019", kind: "billing", sev: null, repo: null,
    t_en: "Pro plan renews on 2026-06-01", t_zh: "Pro 计划将于 2026-06-01 续费",
    s_en: "$24 charged to Visa ending 4242",
    s_zh: "$24 将自 4242 结尾的 Visa 卡扣款",
    age_en: "1 week ago", age_zh: "1 周前", at: 7 * 24 * 60, goto: "settings",
  },
  {
    id: "n-018", kind: "issue", sev: "high", repo: "portfolio-2025",
    t_en: "New high-severity issue",       t_zh: "新增 high 级别问题",
    s_en: "useEffect missing dep — Editor.tsx:137",
    s_zh: "useEffect 缺失依赖 — Editor.tsx:137",
    age_en: "1 week ago", age_zh: "1 周前", at: 7 * 24 * 60 + 2, goto: "issues",
  },
  {
    id: "n-017", kind: "fix", sev: null, repo: "billing-service",
    t_en: "5 patches awaiting review",     t_zh: "5 个 patch 等待 review",
    s_en: "Auto-fix queue paused — confidence above 0.95 still applies automatically",
    s_zh: "Auto-fix 队列已暂停 — confidence ≥ 0.95 仍会自动应用",
    age_en: "2 weeks ago", age_zh: "2 周前", at: 14 * 24 * 60, goto: "issues",
  },
  {
    id: "n-016", kind: "report", sev: null, repo: null,
    t_en: "Monthly digest available",      t_zh: "每月汇总已生成",
    s_en: "April: 142 scans · 38 issues fixed · 12 PRs merged",
    s_zh: "4 月: 142 次扫描 · 修复 38 项 · 合并 12 个 PR",
    age_en: "3 weeks ago", age_zh: "3 周前", at: 21 * 24 * 60, goto: "history",
  },
];

const KINDS = [
  { k: "all",     t_en: "All",         t_zh: "全部" },
  { k: "issue",   t_en: "Issues",      t_zh: "问题" },
  { k: "pr",      t_en: "PRs",         t_zh: "PR" },
  { k: "fix",     t_en: "Auto-fix",    t_zh: "Auto-fix" },
  { k: "report",  t_en: "Reports",     t_zh: "报告" },
  { k: "billing", t_en: "Billing",     t_zh: "计费" },
];

function iconFor(kind) {
  if (kind === "issue") return <I.Shield size={14} />;
  if (kind === "pr") return <I.GitPull size={14} />;
  if (kind === "fix") return <I.Sparkle size={14} />;
  if (kind === "report") return <I.Activity size={14} />;
  if (kind === "billing") return <I.Tag size={14} />;
  return <I.Bell size={14} />;
}

function groupOf(at) {
  if (at <= 24 * 60) return T("Today", "今天");
  if (at <= 7 * 24 * 60) return T("This week", "本周");
  if (at <= 30 * 24 * 60) return T("Earlier this month", "本月较早");
  return T("Older", "更早");
}

export function NotificationsScreen({ go }) {
  useLang();
  const [items, setItems] = useState(() => SEED_NOTIFS.map((n) => ({ ...n, read: false })));
  const [kind, setKind] = useState("all");
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (kind !== "all" && n.kind !== kind) return false;
      if (tab === "unread" && n.read) return false;
      if (q) {
        const ql = q.toLowerCase();
        if (
          !n.t_en.toLowerCase().includes(ql) &&
          !n.t_zh.toLowerCase().includes(ql) &&
          !(n.repo || "").toLowerCase().includes(ql)
        ) return false;
      }
      return true;
    });
  }, [items, kind, tab, q]);

  const grouped = useMemo(() => {
    const byG = new Map();
    for (const n of filtered) {
      const g = groupOf(n.at);
      if (!byG.has(g)) byG.set(g, []);
      byG.get(g).push(n);
    }
    return Array.from(byG.entries());
  }, [filtered]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = () => setItems((arr) => arr.map((n) => ({ ...n, read: true })));
  const toggleRead = (id) => setItems((arr) => arr.map((n) => n.id === id ? { ...n, read: !n.read } : n));
  const dismiss = (id) => setItems((arr) => arr.filter((n) => n.id !== id));

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[{ label: "Acme Inc", go: "dashboard" }, { label: T("Notifications", "通知") }]} />
      <div className="with-side">
        <Sidebar section="notifications" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Notifications", "通知")}</h1>
              <div className="sub">
                {unreadCount > 0
                  ? T(`${unreadCount} unread · ${items.length} total`, `${unreadCount} 条未读 · 共 ${items.length} 条`)
                  : T("You're all caught up", "已全部读完")}
              </div>
            </div>
            <div className="actions">
              <button className="btn" disabled={unreadCount === 0} onClick={markAllRead}>
                <I.Check size={13} /> {T("Mark all read", "全部标为已读")}
              </button>
              <button className="btn" onClick={() => go("settings")}>
                <I.Settings size={13} /> {T("Preferences", "通知偏好")}
              </button>
            </div>
          </div>

          <div className="filters card">
            <div className="filters-row">
              <div className="repos-search" style={{ flex: 1 }}>
                <I.Search size={14} />
                <input
                  placeholder={T("Search notifications…", "搜索通知…")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="seg">
                <button className={"seg-i" + (tab === "all" ? " active" : "")} onClick={() => setTab("all")}>{T("All", "全部")}</button>
                <button className={"seg-i" + (tab === "unread" ? " active" : "")} onClick={() => setTab("unread")}>
                  {T("Unread", "未读")} {unreadCount > 0 && <span className="badge" style={{ marginLeft: 4 }}>{unreadCount}</span>}
                </button>
              </div>
            </div>
            <div className="filters-row">
              <div className="filter-pills">
                <span className="filter-l">{T("Kind", "类型")}</span>
                {KINDS.map((k) => (
                  <button key={k.k} className={"pill-btn" + (kind === k.k ? " active" : "")} onClick={() => setKind(k.k)}>
                    {T(k.t_en, k.t_zh)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="notif-list">
            {grouped.length === 0 && (
              <div className="notif-empty card">
                <I.Bell size={26} style={{ color: "var(--text-3)" }} />
                <h3>{T("Nothing here yet", "暂无通知")}</h3>
                <p>{T("New scan results, PR merges, and weekly reports will show up here.", "新的扫描结果、PR 合并与每周报告会在这里展示。")}</p>
              </div>
            )}
            {grouped.map(([g, arr]) => (
              <div key={g} className="notif-group">
                <div className="notif-group-h">{g}<span className="muted">{arr.length}</span></div>
                {arr.map((n) => (
                  <div key={n.id} className={"notif-row" + (n.read ? " read" : "")}>
                    <div className="notif-ic" style={{ color: n.sev ? `var(--sev-${n.sev})` : "var(--text-3)" }}>
                      {iconFor(n.kind)}
                    </div>
                    <div className="notif-body" onClick={() => { toggleRead(n.id); n.goto && go(n.goto); }}>
                      <div className="notif-h">
                        <b>{T(n.t_en, n.t_zh)}</b>
                        {n.repo && <span className="tag">{n.repo}</span>}
                        {n.sev && <span className={"sev sev-" + n.sev}><span className="dot" style={{ background: "currentColor" }}></span>{n.sev}</span>}
                        {!n.read && <span className="notif-unread-dot" />}
                      </div>
                      <div className="notif-s">{T(n.s_en, n.s_zh)}</div>
                    </div>
                    <div className="notif-meta">
                      <span>{T(n.age_en, n.age_zh)}</span>
                    </div>
                    <div className="notif-actions">
                      <button
                        className="btn ghost sm"
                        title={n.read ? T("Mark unread", "标记为未读") : T("Mark read", "标记为已读")}
                        onClick={() => toggleRead(n.id)}
                      >
                        {n.read ? <I.Bell size={12} /> : <I.Check size={12} />}
                      </button>
                      <button className="btn ghost sm" title={T("Dismiss", "移除")} onClick={() => dismiss(n.id)}>
                        <I.X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
