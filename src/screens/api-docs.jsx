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
  ["POST", "/api/v1/expense-suggestions/{id}/decision", "suggestions:use", "Record a reviewed suggestion decision"],
];

function baseUrl() {
  const configured = String(env.VITE_PUBLIC_API_BASE_URL || env.VITE_API_BASE_URL || "").trim();
  if (!configured) return "https://api.pull-wise.com";
  if (/^[a-z][a-z0-9+.-]*:/i.test(configured)) return configured.replace(/\/$/, "");
  return configured.startsWith("/") && typeof window !== "undefined"
    ? new URL(configured, window.location.origin).href.replace(/\/$/, "") : "https://api.pull-wise.com";
}

function apiUrl(path, base) {
  // A same-origin /api base is the Web proxy prefix; Server still expects /api/v1.
  return `${base}/${path.replace(/^\/+/, "")}`;
}

function DocsCode({ title, children }) {
  return <div className="docs-code"><div className="docs-code-h"><span><I.Terminal size={12} /> {title}</span></div><pre>{children}</pre></div>;
}

const MAX_ASSISTANCE = "For Max accounts, regular expense creation and editing automatically receive Jev assistance while the model is available and within the monthly allowance. No separate suggestion request or suggestions:use scope is needed; expenses:write and the normal target restrictions apply.";
const CATEGORY_BEHAVIOR = "On POST /api/v1/expenses, Max can omit categoryId for reliable automatic categorization. Explicit category, target, amount and currency are preserved. If no reliable category is available, 422 CATEGORY_REQUIRED leaves the expense unsaved; choose a category and retry with a new Idempotency-Key. Free and Pro require a category. PATCH always requires an explicit category.";
const ASSISTANCE_RESPONSE = "Successful writes return the expense with an assistance object: status, categorySource (jev or user), suggestions and optional reason/modelVersion/questionVersion. Duplicate advice never blocks saving. Identical Idempotency-Key replays return the cached result without another model call. Reads do not invoke Jev.";
const EXACT_TOTALS = "Single expense amountMinor values are safe integers. Aggregate amountMinor totals are numbers up to 9007199254740991 and exact decimal integer strings above that boundary; parse large totals with BigInt or decimal arithmetic.";

function markdown(base, example, createExample) {
  return ["# Pullwise ledger REST API", "", "Use a Bearer key with the required ledger scopes and project/shared restrictions.", "",
    "The account ledger and Pullwise platform billing are separate. No exchange rate is inferred.", "",
    "## Base URL", "", base, "", "## Endpoints", "",
    ...ENDPOINTS.flatMap(([method, path, scope, description]) => [`### ${method} ${path}`, description, `Scope: ${scope}`, ""]),
    "## Example", "", "```sh", example, "```", "",
    "## Automatic Max assistance", "", MAX_ASSISTANCE, "", CATEGORY_BEHAVIOR, "", ASSISTANCE_RESPONSE, "",
    "```sh", createExample, "```", "", EXACT_TOTALS, "",
    "Filters: target, projectId, categoryId, from (inclusive), to (exclusive), currency. Lists also support limit and cursor.",
    "Writes to versioned records require If-Match. Expense creation requires Idempotency-Key."].join("\n");
}

export function ApiDocsScreen({ go, auth }) {
  useLang();
  const [copied, setCopied] = useState(false);
  const base = baseUrl();
  const example = `curl '${apiUrl("/api/v1/expenses?target=shared&from=2026-09-01&to=2026-10-01", base)}' \\\n  -H "Authorization: Bearer $PULLWISE_API_KEY"`;
  const createExample = [
    `curl -X POST '${apiUrl("/api/v1/expenses", base)}'`,
    '  -H "Authorization: Bearer $PULLWISE_API_KEY"',
    "  -H 'Content-Type: application/json'",
    "  -H 'Idempotency-Key: hosting-2026-09-unique'",
    `  --data '{"target":{"kind":"shared"},"occurredOn":"2026-09-27","amount":"12.00","currency":"USD","purpose":"September hosting"}'`,
  ].join(" \\\n");
  const nav = [["overview", "Overview"], ["authentication", "Authentication"], ["endpoints", "Endpoints"],
    ["filters", "Filters and writes"], ["max-assistance", "Automatic Max assistance"], ["errors", "Errors"]];
  async function copyPage() {
    try { await navigator.clipboard.writeText(markdown(base, example, createExample)); setCopied(true); }
    catch { setCopied(false); }
  }
  return <div className="landing fade-in product-api-docs"><PublicHeader go={go} current="api" auth={auth} />
    <div className="docs-shell"><aside className="docs-side"><div className="docs-side-g"><div className="docs-side-h">API</div>
      {nav.map(([id, label]) => <a key={id} className="docs-side-i" href={`#${id}`}>{T(label)}</a>)}
    </div></aside><main className="docs-main">
      <div className="docs-crumbs"><a className="auth-link" {...screenLinkProps(go, "landing")}>Pullwise</a><span className="sep">/</span><span className="now">API</span></div>
      <div className="docs-page-head"><h1 id="overview" className="docs-h1">{T("Pullwise ledger REST API")}</h1>
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
        <p>{T(description)}</p><span className="docs-scope">{T("Required scope", "所需权限")}: {scope}</span>
      </article>)}</div>
      <h2 id="filters" className="docs-h2">{T("Filters and writes", "筛选与写入")}</h2>
      <p>{T("Expense lists and reports share target, projectId, categoryId, from (inclusive), to (exclusive) and currency filters. Lists also use limit and cursor. Amounts are decimal strings on writes and minor units in totals. Currencies are never combined.",
        "支出列表与报表共用目标、项目、类别、起始日期（含）、结束日期（不含）及币种筛选。列表还支持 limit 和 cursor。写入金额是十进制字符串，汇总使用最小货币单位，不跨币种相加。")}</p>
      <p>{T("Use Idempotency-Key when creating an expense and If-Match with the latest revision when editing or removing one.",
        "创建支出使用 Idempotency-Key；修改或移除时使用最新版本的 If-Match。")}</p>
      <DocsCode title={T("Read shared expenses", "读取公共池支出")}>{example}</DocsCode>
      <p>{T(EXACT_TOTALS, "单笔支出的 amountMinor 是安全整数。汇总 amountMinor 在 9007199254740991 以内为数字，超过后为精确十进制整数字符串；请使用 BigInt 或十进制运算处理大额汇总。")}</p>
      <h2 id="max-assistance" className="docs-h2">{T("Automatic Max assistance", "Max 自动辅助")}</h2>
      <p>{T(MAX_ASSISTANCE, "Max 账户在模型可用且月度额度内，正常创建和编辑支出即可自动享受 Jev 辅助。无需另发建议请求或授予 suggestions:use 权限；使用 expenses:write 和正常目标权限即可。")}</p>
      <p>{T(CATEGORY_BEHAVIOR, "POST /api/v1/expenses 时，Max 可省略 categoryId 使用可靠的自动分类。明确填写的分类、目标、金额和币种会保留。没有可靠分类时返回 422 CATEGORY_REQUIRED，支出尚未保存；请选择分类并用新的 Idempotency-Key 重试。Free 和 Pro 必须填写分类；PATCH 始终需要明确分类。")}</p>
      <p>{T(ASSISTANCE_RESPONSE, "成功写入会返回支出和 assistance 对象，包括 status、categorySource（jev 或 user）、suggestions，以及可选的 reason/modelVersion/questionVersion。重复记录提示不阻止保存。相同 Idempotency-Key 重放返回缓存结果，不会再次调用模型。读取不会调用 Jev。")}</p>
      <DocsCode title={T("Create with automatic categorization (Max)", "使用自动分类创建支出（Max）")}>{createExample}</DocsCode>
      <h2 id="errors" className="docs-h2">{T("Errors and limits", "错误与限制")}</h2>
      <div className="docs-table">{[["401", "Session or API key required"], ["403", "Scope or target denied"],
        ["404", "Resource unavailable"], ["409", "Idempotency conflict"], ["412", "Saved revision changed"],
        ["422", "Invalid input or filters"], ["429", "Request limit reached"]].map(([code, description]) =>
        <div key={code} className="docs-table-r"><b>{code}</b><span>{T(description)}</span></div>)}</div>
      <div className="docs-foot-actions"><a className="btn" {...screenLinkProps(go, "docs")}>{T("Guide", "指南")}</a>
        <a className="btn primary" {...screenLinkProps(go, "apiKeys")}>{T("API Keys", "API 密钥")}</a></div>
    </main></div><PublicFooter go={go} current="api" /></div>;
}
