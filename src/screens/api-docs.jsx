import { useState } from "react";
import { env } from "../config/env.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const ENDPOINTS = [
  ["GET", "/api/v1/me", "profile:read", "Account profile"],
  ["GET", "/api/v1/account/jev", "Cookie session only", "Read your personal Jev preference"],
  ["PATCH", "/api/v1/account/jev", "Cookie session only", "Set your personal Jev preference with If-Match"],
  ["GET", "/api/v1/repositories", "projects:read", "Authorized repositories"],
  ["GET", "/api/v1/projects", "projects:read", "Your projects"],
  ["POST", "/api/v1/projects", "projects:write", "Create a project with optional GitHub links"],
  ["GET", "/api/v1/projects/{id}", "projects:read", "Project and description"],
  [
    "PATCH",
    "/api/v1/projects/{id}",
    "projects:write",
    "Update project details or GitHub links with If-Match",
  ],
  ["GET", "/api/v1/categories", "categories:read", "Ledger categories"],
  ["POST", "/api/v1/categories", "categories:write", "Create category"],
  ["PATCH", "/api/v1/categories/{id}", "categories:write", "Rename with If-Match"],
  ["DELETE", "/api/v1/categories/{id}", "categories:write", "Archive with If-Match"],
  ["POST", "/api/v1/categories/{id}/remove", "categories:write", "Remove unused category with If-Match"],
  ["GET", "/api/v1/expenses", "expenses:read", "Filtered expense detail"],
  ["POST", "/api/v1/expenses", "expenses:write", "Create with Idempotency-Key"],
  ["GET", "/api/v1/expenses/{id}", "expenses:read", "One expense"],
  ["POST", "/api/v1/expenses/{id}/review", "expenses:write", "Check a saved expense with If-Match; never changes records"],
  ["PATCH", "/api/v1/expenses/{id}", "expenses:write", "Edit with If-Match"],
  ["DELETE", "/api/v1/expenses/{id}", "expenses:write", "Remove with If-Match"],
  ["GET", "/api/v1/expenses/export", "expenses:read", "CSV export"],
  [
    "GET",
    "/api/v1/reports/summary",
    "reports:read",
    "Per-currency ledger, project and shared totals",
  ],
  ["GET", "/api/v1/reports/timeseries", "reports:read", "Date-bucket totals"],
  ["GET", "/api/v1/reports/categories", "reports:read", "Category totals"],
  [
    "POST",
    "/api/v1/expense-suggestions",
    "suggestions:use",
    "Optional suggestion; never records an expense",
  ],
  [
    "POST",
    "/api/v1/expense-suggestions/{id}/decision",
    "suggestions:use",
    "Record a reviewed suggestion decision",
  ],
];

function baseUrl() {
  const configured = String(env.VITE_PUBLIC_API_BASE_URL || env.VITE_API_BASE_URL || "").trim();
  if (!configured) return "https://api.pull-wise.com";
  if (/^[a-z][a-z0-9+.-]*:/i.test(configured)) return configured.replace(/\/$/, "");
  return configured.startsWith("/") && typeof window !== "undefined"
    ? new URL(configured, window.location.origin).href.replace(/\/$/, "")
    : "https://api.pull-wise.com";
}

function apiUrl(path, base) {
  // A same-origin /api base is the Web proxy prefix; Server still expects /api/v1.
  return `${base}/${path.replace(/^\/+/, "")}`;
}

function DocsCode({ title, children }) {
  return (
    <div className="docs-code">
      <div className="docs-code-h">
        <span>
          <I.Terminal size={12} /> {title}
        </span>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

const PROJECT_CREATION =
  'Create a standalone project with POST /api/v1/projects and a nonempty name, for example {"name":"Website launch"}. description is optional. Omit githubRepoIds or send []; omit githubOrganizationId or use null. Standalone projects work without installing the GitHub App on a repository. Authenticate normally.';
const PROJECT_BINDINGS =
  "To link GitHub, send githubRepoIds with 1–30 distinct numeric IDs authorized to the acting user. A non-null githubOrganizationId requires at least one repository and current access to that organization. GitHub organization access does not grant ledger membership.";
const PROJECT_UPDATES =
  "PATCH /api/v1/projects/{id} requires If-Match. Omit githubRepoIds to keep the current links; send [] to remove every repository and automatically clear the organization. A project with no repositories must have a nonempty name; include name in the same PATCH if needed. Later links and removals preserve the project ID and expense history.";
const PROJECT_STATE =
  'Standalone responses have githubRepoId: null, githubRepoIds: [], repositories: [] and githubAccess: "not_linked". Active standalone projects can record expenses under the usual role, scope and plan limits.';

const MAX_ASSISTANCE =
  "For ledgers on the Owner's effective Pro or Max plan, regular expense creation and editing automatically receive Jev assistance while the model is available and within the ledger's monthly allowance. No separate suggestion request or suggestions:use scope is needed; expenses:write and the normal target restrictions apply.";
const CATEGORY_BEHAVIOR =
  "On POST /api/v1/expenses and PATCH /api/v1/expenses/{id}, categoryId may be omitted for automatic categorization when the ledger Owner's effective Pro or Max plan, model availability and allowance permit it. Explicit category, target, amount and currency are preserved. If no category can be selected confidently, 422 CATEGORY_REQUIRED leaves the expense unsaved; choose a category and retry. Creates use a new Idempotency-Key. Retry edits with If-Match using the loaded revision; reload explicitly after a revision conflict. Free ledgers and all recurring schedules require an explicit category.";
const ASSISTANCE_RESPONSE =
  "Successful writes return the expense with an assistance object: status, categorySource (jev or user), suggestions and optional reason/modelVersion/questionVersion. Duplicate advice never blocks saving. Identical create requests with the same Idempotency-Key return the cached result without another model call. Reads do not invoke Jev.";
const EXPENSE_REVIEW =
  "POST /api/v1/expenses/{id}/review checks one saved expense with an empty JSON body {} and If-Match for its loaded revision. It requires expenses:write and the usual ledger role and target authority, with the Owner's effective Pro or Max plan. It shares the 20-attempt UTC daily cap and monthly Jev allowance. Reviews never change expenses or their revision, and never automatically apply a category or target. Requests are explicit and are not retried automatically; review does not use Idempotency-Key replay.";
const REVIEW_RESPONSE =
  "A review returns expenseId, revision, questionVersion, modelVersion, optional suggestionId and checks. Category and target checks use checked, issue, uncertain or unavailable, with current values and optional suggested values and confidence. Jev returns only predefined choices and scores. Optional reason values are fixed codes: disabled, provider_unavailable, no_categories or invalid_context. Duplicate checks use local rules on up to 30 other expenses with the same authorized target, amount and currency, a matching case-insensitive purpose and dates within seven days of the reviewed expense. The duplicate status is checked or issue; an issue may include candidate {id, revision}, without expense details. Local duplicate checks can remain available when the model is unavailable. Uncertain or unavailable does not mean a clear result. To edit, first GET the current expense with expenses:read, then explicitly PATCH it with expenses:write and the fresh If-Match revision.";
const EXACT_TOTALS =
  "Single expense amountMinor values are safe integers. Aggregate amountMinor totals are numbers up to 9007199254740991 and exact decimal integer strings above that boundary; parse large totals with BigInt or decimal arithmetic.";
const ACCOUNT_JEV =
  "GET and PATCH /api/v1/account/jev require a cookie session and operate on the signed-in account's own ledger preference, independently of workspace selection. API keys cannot use these endpoints. The response contains enabled, revision, eligible, available and monthlyBudgetUsd. enabled is the stored preference; available also requires an effective Pro or Max plan and runtime availability. PATCH accepts only {enabled: boolean} and requires If-Match with the preference revision; Free accounts cannot write. A 412 conflict requires an explicit GET before another user choice. These endpoints do not run model checks, change expenses or reset used allowance. Shared ledger members inherit their ledger Owner's preference; paid local duplicate checks remain possible when model checks are off.";

function markdown(base, example, createExample, projectExample, reviewExample) {
  return [
    "# Pullwise ledger REST API",
    "",
    "Use a Bearer key with the required ledger scopes and project/shared restrictions.",
    "",
    "Ledger expenses and Pullwise platform billing are separate. Totals stay separate by currency; no currency conversion is performed.",
    "",
    "Keys are bound to one workspace and intersect the issuing member's current role. Team membership revision changes invalidate the key. X-Pullwise-Workspace cannot override that binding. Cookie requests may select a ledger with X-Pullwise-Workspace; native CSV links use workspaceId. Conflicting selectors are rejected. Members share the ledger Owner's plan and monthly model allowance.",
    "",
    "## Projects",
    "",
    PROJECT_CREATION,
    "",
    PROJECT_BINDINGS,
    "",
    PROJECT_UPDATES,
    "",
    PROJECT_STATE,
    "",
    "```sh",
    projectExample,
    "```",
    "",
    "## Base URL",
    "",
    base,
    "",
    "## Endpoints",
    "",
    ...ENDPOINTS.flatMap(([method, path, scope, description]) => [
      `### ${method} ${path}`,
      description,
      `Scope: ${scope}`,
      "",
    ]),
    "## Example",
    "",
    "```sh",
    example,
    "```",
    "",
    "## Automatic Jev assistance",
    "",
    MAX_ASSISTANCE,
    "",
    CATEGORY_BEHAVIOR,
    "",
    ASSISTANCE_RESPONSE,
    "",
    "## Jev settings",
    "",
    ACCOUNT_JEV,
    "",
    "```sh",
    createExample,
    "```",
    "",
    "## Review saved expenses",
    "",
    EXPENSE_REVIEW,
    "",
    REVIEW_RESPONSE,
    "",
    "```sh",
    reviewExample,
    "```",
    "",
    EXACT_TOTALS,
    "",
    "Filters: target, projectId, categoryId, from (inclusive), to (exclusive), currency. Lists also support limit and cursor.",
    "Writes to versioned records require If-Match. Expense creation requires Idempotency-Key.",
  ].join("\n");
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
  const projectExample = [
    `curl -X POST '${apiUrl("/api/v1/projects", base)}'`,
    '  -H "Authorization: Bearer $PULLWISE_API_KEY"',
    "  -H 'Content-Type: application/json'",
    `  --data '{"name":"Website launch"}'`,
  ].join(" \\\n");
  const reviewExample = [
    `curl -X POST '${apiUrl("/api/v1/expenses/exp_example/review", base)}'`,
    '  -H "Authorization: Bearer $PULLWISE_API_KEY"',
    "  -H 'Content-Type: application/json'",
    `  -H 'If-Match: "7"'`,
    "  --data '{}'",
  ].join(" \\\n");
  const nav = [
    ["overview", "Overview"],
    ["authentication", "Authentication"],
    ["projects", "Projects"],
    ["endpoints", "Endpoints"],
    ["filters", "Filters and writes"],
    ["max-assistance", "Automatic Jev assistance"],
    ["jev-settings", "Jev settings"],
    ["expense-review", "Review saved expenses"],
    ["errors", "Errors"],
  ];
  async function copyPage() {
    try {
      await navigator.clipboard.writeText(markdown(base, example, createExample, projectExample, reviewExample));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="landing fade-in product-api-docs">
      <PublicHeader go={go} current="api" auth={auth} />
      <div className="docs-shell">
        <aside className="docs-side">
          <div className="docs-side-g">
            <div className="docs-side-h">API</div>
            {nav.map(([id, label]) => (
              <a key={id} className="docs-side-i" href={`#${id}`}>
                {T(label)}
              </a>
            ))}
          </div>
        </aside>
        <main className="docs-main">
          <div className="docs-crumbs">
            <a className="auth-link" {...screenLinkProps(go, "landing")}>
              Pullwise
            </a>
            <span className="sep">/</span>
            <span className="now">API</span>
          </div>
          <div className="docs-page-head">
            <h1 id="overview" className="docs-h1">
              {T("Pullwise ledger REST API")}
            </h1>
            <button className="btn sm" type="button" onClick={copyPage} data-copy-exclude>
              {copied ? <I.Check size={13} /> : <I.Copy size={13} />}{" "}
              {copied ? T("Copied", "已复制") : T("Copy Page", "复制页面")}
            </button>
          </div>
          <p className="docs-lede">
            {T(
              "Record project and shared expenses, then read totals by currency. Platform billing is a separate account service.",
              "记录项目和公共池支出，按币种读取汇总。平台账单是独立的账户服务。"
            )}
          </p>
          <h2 id="authentication" className="docs-h2">
            {T("Authentication", "认证")}
          </h2>
          <p>
            {T(
              "Create a key in API Keys with only the scopes needed. Project allowlists do not grant shared-pool access; enable that separately. A revoked key cannot read or write.",
              "在 API Keys 中仅授予所需权限。项目白名单不会自动授予公共池权限；需要时单独启用。撤销的密钥不能读写。"
            )}
          </p>
          <DocsCode title={T("Base URL", "基础地址")}>{base}</DocsCode>
          <DocsCode title={T("Authorization", "认证请求头")}>
            Authorization: Bearer pwk_example
          </DocsCode>
          <p>
            {T(
              "Each key is bound to one ledger and cannot exceed its issuer's current member role. A member revision change invalidates team keys. Cookie clients can select a ledger with X-Pullwise-Workspace; CSV links use workspaceId, and conflicting selectors are rejected. All members share the ledger Owner's plan and model allowance.",
              "每个密钥绑定一个账本，不能超出发行成员的当前角色权限。成员权限版本变化后，团队密钥会失效。Cookie 客户端通过 X-Pullwise-Workspace 选择账本，CSV 链接使用 workspaceId；冲突的选择器会被拒绝。所有成员共用账本 Owner 的套餐和模型额度。"
            )}
          </p>
          <h2 id="projects" className="docs-h2">
            {T("Projects", "项目")}
          </h2>
          <p>
            {T(
              PROJECT_CREATION,
              '通过 POST /api/v1/projects 和非空 name 创建独立项目，例如 {"name":"Website launch"}。description 可选。省略 githubRepoIds 或传入 []，省略 githubOrganizationId 或传入 null。独立项目无需为仓库安装 GitHub App，仍需正常认证。'
            )}
          </p>
          <p>
            {T(
              PROJECT_BINDINGS,
              "关联 GitHub 时，githubRepoIds 使用 1–30 个不重复且当前操作用户已授权的数字仓库 ID。非空 githubOrganizationId 必须同时有关联仓库，并验证当前组织访问权。GitHub 组织访问权不会自动授予账本成员资格。"
            )}
          </p>
          <p>
            {T(
              PROJECT_UPDATES,
              "PATCH /api/v1/projects/{id} 需要 If-Match。省略 githubRepoIds 保留当前关联，传入 [] 解除所有仓库关联并自动清除组织。没有关联仓库的项目必须有非空 name，可在同一次 PATCH 中填写。后续关联或解除关联会保留项目 ID 和历史支出。"
            )}
          </p>
          <p>
            {T(
              PROJECT_STATE,
              '独立项目响应为 githubRepoId: null、githubRepoIds: []、repositories: [] 和 githubAccess: "not_linked"。启用的独立项目可按原有角色、权限范围及套餐限额记录支出。'
            )}
          </p>
          <DocsCode title={T("Create a standalone project", "创建独立项目")}>
            {projectExample}
          </DocsCode>
          <h2 id="endpoints" className="docs-h2">
            {T("Endpoints", "接口")}
          </h2>
          <div className="docs-endpoint-list">
            {ENDPOINTS.map(([method, path, scope, description]) => (
              <article key={`${method}-${path}`} className="docs-endpoint-card">
                <div className="docs-endpoint-card-h">
                  <span className="docs-method">{method}</span>
                  <code>{path}</code>
                </div>
                <p>{T(description)}</p>
                <span className="docs-scope">
                  {T("Required scope", "所需权限")}: {scope === "Cookie session only"
                    ? T("Cookie session only", "仅限 Cookie 会话")
                    : scope}
                </span>
              </article>
            ))}
          </div>
          <h2 id="jev-settings" className="docs-h2">
            {T("Jev settings", "Jev 设置")}
          </h2>
          <p>
            {T(
              ACCOUNT_JEV,
              "GET 和 PATCH /api/v1/account/jev 需要 Cookie 会话，操作当前登录账户自己账本的偏好，与工作区选择无关。API 密钥不能使用这些接口。响应包含 enabled、revision、eligible、available 和 monthlyBudgetUsd。enabled 是已保存偏好；available 还要求 Pro 或 Max 权益有效且运行时可用。PATCH 仅接受 {enabled: boolean}，并须使用偏好版本传入 If-Match；Free 账户不能写入。412 冲突后须先主动 GET，再由用户重新选择。这些接口不会运行模型检查、修改支出或重置已使用额度。共享账本成员继承各自账本 Owner 的偏好；模型关闭时，付费账本仍可进行本地疑似重复检查。"
            )}
          </p>
          <h2 id="filters" className="docs-h2">
            {T("Filters and writes", "筛选与写入")}
          </h2>
          <p>
            {T(
              "Expense lists and reports share target, projectId, categoryId, from (inclusive), to (exclusive) and currency filters. Lists also use limit and cursor. Amounts are decimal strings on writes and minor units in totals. Currencies are never combined.",
              "支出列表与报表共用目标、项目、类别、起始日期（含）、结束日期（不含）及币种筛选。列表还支持 limit 和 cursor。写入金额是十进制字符串，汇总使用最小货币单位，不跨币种相加。"
            )}
          </p>
          <p>
            {T(
              "Use Idempotency-Key when creating an expense and If-Match with the latest revision when editing or removing one.",
              "创建支出使用 Idempotency-Key；修改或移除时使用最新版本的 If-Match。"
            )}
          </p>
          <DocsCode title={T("Read shared expenses", "读取公共池支出")}>{example}</DocsCode>
          <p>
            {T(
              EXACT_TOTALS,
              "单笔支出的 amountMinor 是安全整数。汇总 amountMinor 在 9007199254740991 以内为数字，超过后为精确十进制整数字符串；请使用 BigInt 或十进制运算处理大额汇总。"
            )}
          </p>
          <h2 id="max-assistance" className="docs-h2">
            {T("Automatic Jev assistance", "Jev 自动辅助")}
          </h2>
          <p>
            {T(
              MAX_ASSISTANCE,
              "账本所有者的 Pro 或 Max 权益有效时，在模型可用且账本月度额度内，正常创建和编辑支出即可自动享受 Jev 辅助。无需另发建议请求或授予 suggestions:use 权限；使用 expenses:write 和正常目标权限即可。"
            )}
          </p>
          <p>
            {T(
              CATEGORY_BEHAVIOR,
              "POST /api/v1/expenses 和 PATCH /api/v1/expenses/{id} 时，账本所有者的 Pro 或 Max 权益有效、模型可用且额度允许，则可省略 categoryId 进行自动分类。明确填写的类别、目标、金额和币种会保留。无法有把握地选出类别时返回 422 CATEGORY_REQUIRED，支出尚未保存；请选择类别后重试。新增支出使用新的 Idempotency-Key；编辑重试使用已加载版本的 If-Match，发生版本冲突后须主动重新加载。Free 及所有周期计划都必须明确填写类别。"
            )}
          </p>
          <p>
            {T(
              ASSISTANCE_RESPONSE,
              "成功写入会返回支出和 assistance 对象，包括 status、categorySource（jev 或 user）、suggestions，以及可选的 reason/modelVersion/questionVersion。重复记录提示不阻止保存。使用相同 Idempotency-Key 的相同创建请求重放返回缓存结果，不会再次调用模型。读取不会调用 Jev。"
            )}
          </p>
          <DocsCode
            title={T("Create with automatic categorization (Pro and Max)", "使用自动分类创建支出（Pro 和 Max）")}
          >
            {createExample}
          </DocsCode>
          <h2 id="expense-review" className="docs-h2">
            {T("Review saved expenses", "检查已保存支出")}
          </h2>
          <p>
            {T(
              EXPENSE_REVIEW,
              "POST /api/v1/expenses/{id}/review 使用空 JSON 请求体 {} 和已加载版本的 If-Match 检查一笔已保存支出。需要 expenses:write、当前账本角色和目标权限，以及所有者有效的 Pro 或 Max 套餐。检查共同使用 UTC 每日最多 20 次尝试及月度 Jev 额度。巡检不会修改支出或版本，也不会自动套用类别或目标。请求必须主动发起，不会自动重试；巡检不使用 Idempotency-Key 重放。"
            )}
          </p>
          <p>
            {T(
              REVIEW_RESPONSE,
              "巡检返回 expenseId、revision、questionVersion、modelVersion、可选的 suggestionId 及 checks。类别和目标检查的状态为 checked、issue、uncertain 或 unavailable，包含 current 值，以及可选的 suggested 值和 confidence。Jev 只返回预定义选项和评分。可选 reason 是固定代码：disabled、provider_unavailable、no_categories 或 invalid_context。重复检查通过本地规则，对同一获准目标、金额和币种、用途忽略大小写后相同、日期在被检查支出前后七天内的最多 30 笔其他支出进行比较。重复状态为 checked 或 issue；issue 可包含 candidate {id, revision}，不包含支出详情。模型不可用时，本地重复检查仍可能有结果。不确定或不可用不代表没有问题。修改前先使用 expenses:read GET 当前支出，再主动使用 expenses:write 和新的 If-Match 版本 PATCH。"
            )}
          </p>
          <DocsCode title={T("Review one saved expense", "检查一笔已保存支出")}>{reviewExample}</DocsCode>
          <h2 id="errors" className="docs-h2">
            {T("Errors and limits", "错误与限制")}
          </h2>
          <div className="docs-table">
            {[
              ["401", "Session or API key required"],
              ["403", "Scope or target denied"],
              ["404", "Resource unavailable"],
              ["409", "Idempotency conflict"],
              ["412", "Saved revision changed"],
              ["422", "Invalid input or filters"],
              ["429", "Request limit reached"],
            ].map(([code, description]) => (
              <div key={code} className="docs-table-r">
                <b>{code}</b>
                <span>{T(description)}</span>
              </div>
            ))}
          </div>
          <div className="docs-foot-actions">
            <a className="btn" {...screenLinkProps(go, "docs")}>
              {T("Guide", "指南")}
            </a>
            <a className="btn primary" {...screenLinkProps(go, "apiKeys")}>
              {T("API Keys", "API 密钥")}
            </a>
          </div>
        </main>
      </div>
      <PublicFooter go={go} current="api" />
    </div>
  );
}
