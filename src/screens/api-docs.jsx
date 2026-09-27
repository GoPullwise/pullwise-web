import { useState } from "react";
import { env } from "../config/env.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const ENDPOINTS = [
  ["GET", "/api/v1/me", "profile:read", "Account profile"],
  ["GET", "/api/v1/repositories", "projects:read", "Authorized repositories"],
  ["GET", "/api/v1/projects", "projects:read", "Your projects"],
  ["POST", "/api/v1/projects", "projects:write", "Bind an authorized repository"],
  ["GET", "/api/v1/projects/{id}", "projects:read", "Project and description"],
  ["PATCH", "/api/v1/projects/{id}", "projects:write", "Update description with If-Match"],
  ["GET", "/api/v1/categories", "categories:read", "Account categories"],
  ["POST", "/api/v1/categories", "categories:write", "Create category"],
  ["PATCH", "/api/v1/categories/{id}", "categories:write", "Rename with If-Match"],
  ["DELETE", "/api/v1/categories/{id}", "categories:write", "Archive with If-Match"],
  ["GET", "/api/v1/expenses", "expenses:read", "Filtered expense detail"],
  ["POST", "/api/v1/expenses", "expenses:write", "Create with Idempotency-Key"],
  ["GET", "/api/v1/expenses/{id}", "expenses:read", "One expense"],
  ["PATCH", "/api/v1/expenses/{id}", "expenses:write", "Edit with If-Match"],
  ["DELETE", "/api/v1/expenses/{id}", "expenses:write", "Remove with If-Match"],
  ["GET", "/api/v1/expenses/export", "expenses:read", "CSV export"],
  ["GET", "/api/v1/reports/summary", "reports:read", "Per-currency account, project and shared totals"],
  ["GET", "/api/v1/reports/timeseries", "reports:read", "Date-bucket totals"],
  ["GET", "/api/v1/reports/categories", "reports:read", "Category totals"],
  ["POST", "/api/v1/expense-suggestions", "suggestions:use", "Optional suggestion; never records an expense"],
];

function baseUrl() {
  const configured = String(env.VITE_PUBLIC_API_BASE_URL || env.VITE_API_BASE_URL || "").trim();
  if (!configured) return "https://api.pull-wise.com";
  if (/^[a-z][a-z0-9+.-]*:/i.test(configured)) return configured.replace(/\/$/, "");
  return configured.startsWith("/") && typeof window !== "undefined"
    ? new URL(configured, window.location.origin).href.replace(/\/$/, "") : "https://api.pull-wise.com";
}

function apiUrl(path, base) {
  const relative = path.replace(/^\/+/, "");
  return `${base}/${base.endsWith("/api") && relative.startsWith("api/") ? relative.slice(4) : relative}`;
}

function DocsCode({ title, children }) {
  return <div className="docs-code"><div className="docs-code-h"><span><I.Terminal size={12} /> {title}</span></div><pre>{children}</pre></div>;
}

function markdown(base, example) {
  return ["# Pullwise ledger REST API", "", "Use a Bearer key with the required ledger scopes and project/shared restrictions.", "",
    "The account ledger and Pullwise platform billing are separate. No exchange rate is inferred.", "",
    "## Base URL", "", base, "", "## Endpoints", "",
    ...ENDPOINTS.flatMap(([method, path, scope, description]) => [`### ${method} ${path}`, description, `Scope: ${scope}`, ""]),
    "## Example", "", "```sh", example, "```", "",
    "Filters: target, projectId, categoryId, from (inclusive), to (exclusive), currency. Lists also support limit and cursor.",
    "Writes to versioned records require If-Match. Expense creation requires Idempotency-Key.",
    "A suggestion needs user confirmation and does not write to the ledger."].join("\n");
}

export function ApiDocsScreen({ go, auth }) {
  useLang();
  const [copied, setCopied] = useState(false);
  const base = baseUrl();
  const example = `curl '${apiUrl("/api/v1/expenses?target=shared&from=2026-09-01&to=2026-10-01", base)}' \\\n  -H 'Authorization: Bearer $PULLWISE_API_KEY'`;
  const nav = [["overview", "Overview"], ["authentication", "Authentication"], ["endpoints", "Endpoints"],
    ["filters", "Filters and writes"], ["errors", "Errors"]];
  async function copyPage() {
    try { await navigator.clipboard.writeText(markdown(base, example)); setCopied(true); }
    catch { setCopied(false); }
  }
  return <div className="landing fade-in product-api-docs"><PublicHeader go={go} current="api" auth={auth} />
    <div className="docs-shell"><aside className="docs-side"><div className="docs-side-g"><div className="docs-side-h">API</div>
      {nav.map(([id, label]) => <a key={id} className="docs-side-i" href={`#${id}`}>{label}</a>)}
    </div></aside><main className="docs-main">
      <div className="docs-crumbs"><a className="auth-link" {...screenLinkProps(go, "landing")}>Pullwise</a><span className="sep">/</span><span className="now">API</span></div>
      <div className="docs-page-head"><h1 id="overview" className="docs-h1">Pullwise ledger REST API</h1>
        <button className="btn sm" type="button" onClick={copyPage} data-copy-exclude>{copied ? <I.Check size={13} /> : <I.Copy size={13} />} {copied ? T("Copied", "已复制") : T("Copy Page", "复制页面")}</button></div>
      <p className="docs-lede">{T("Record project and shared expenses, then read totals by currency. Platform billing is a separate account service.",
        "记录项目和公共池支出，按币种读取汇总。平台账单是独立的账户服务。")}</p>
      <h2 id="authentication" className="docs-h2">{T("Authentication", "认证")}</h2>
      <p>{T("Create a key in API Keys with only the scopes needed. Project allowlists do not grant shared-pool access; enable that separately. A revoked key cannot read or write.",
        "在 API Keys 中仅授予所需权限。项目白名单不会自动授予公共池权限；需要时单独启用。撤销的密钥不能读写。")}</p>
      <DocsCode title={T("Base URL", "基础地址")}>{base}</DocsCode>
      <DocsCode title={T("Authorization", "认证请求头")}>Authorization: Bearer pwk_example</DocsCode>
      <h2 id="endpoints" className="docs-h2">{T("Endpoints", "接口")}</h2>
      <div className="docs-endpoint-list">{ENDPOINTS.map(([method, path, scope, description]) => <article key={`${method}-${path}`} className="docs-endpoint-card">
        <div className="docs-endpoint-card-h"><span className="docs-method">{method}</span><code>{path}</code></div>
        <p>{description}</p><span className="docs-scope">{T("Required scope", "所需权限")}: {scope}</span>
      </article>)}</div>
      <h2 id="filters" className="docs-h2">{T("Filters and writes", "筛选与写入")}</h2>
      <p>{T("Expense lists and reports share target, projectId, categoryId, from (inclusive), to (exclusive) and currency filters. Lists also use limit and cursor. Amounts are decimal strings on writes and minor units in totals. Currencies are never combined.",
        "支出列表与报表共用目标、项目、类别、起始日期（含）、结束日期（不含）及币种筛选。列表还支持 limit 和 cursor。写入金额是十进制字符串，汇总使用最小货币单位，不跨币种相加。")}</p>
      <p>{T("Use Idempotency-Key when creating an expense and If-Match with the latest revision when editing or removing one. Suggestions require confirmation and never post an expense.",
        "创建支出使用 Idempotency-Key；修改或移除时使用最新版本的 If-Match。建议需要用户确认，不会自行入账。")}</p>
      <DocsCode title={T("Read shared expenses", "读取公共池支出")}>{example}</DocsCode>
      <h2 id="errors" className="docs-h2">{T("Errors and limits", "错误与限制")}</h2>
      <div className="docs-table">{[["401", "Session or API key required"], ["403", "Scope or target denied"],
        ["404", "Resource unavailable"], ["409", "Idempotency conflict"], ["412", "Saved revision changed"],
        ["422", "Invalid input or filters"], ["429", "Request limit reached"]].map(([code, description]) =>
        <div key={code} className="docs-table-r"><b>{code}</b><span>{description}</span></div>)}</div>
      <div className="docs-foot-actions"><a className="btn" {...screenLinkProps(go, "docs")}>{T("Guide", "指南")}</a>
        <a className="btn primary" {...screenLinkProps(go, "apiKeys")}>{T("API Keys", "API 密钥")}</a></div>
    </main></div><PublicFooter go={go} current="api" /></div>;
}
