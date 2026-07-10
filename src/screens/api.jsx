import { useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { SkeletonLine } from "../components/skeleton.jsx";
import { useErrorNotification } from "../components/notifications.jsx";
import { I } from "../icons.jsx";
import { env } from "../config/env.js";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

function itemsFrom(payload, ...keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function textValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    return String(value)
      .replaceAll("\x00", "")
      .split(/\r?\n|\r/, 1)[0]
      .trim();
  }
  return "";
}

function objectRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

const API_KEY_SCOPES = [
  {
    value: "repositories:read",
    labelEn: "Read repositories",
    labelZh: "读取仓库",
    descEn: "List repositories authorized for this account.",
    descZh: "列出此账户已授权的仓库。",
  },
  {
    value: "scans:write",
    labelEn: "Start repository scans",
    labelZh: "启动仓库扫描",
    descEn: "Create or stop scans for authorized repositories.",
    descZh: "为已授权的仓库创建或停止扫描。",
  },
  {
    value: "scans:read",
    labelEn: "Read scans",
    labelZh: "读取扫描",
    descEn: "Read scan status, findings, and history.",
    descZh: "读取扫描状态、发现和历史。",
  },
  {
    value: "quota:read",
    labelEn: "Read quota",
    labelZh: "读取配额",
    descEn: "Check account and repository quota.",
    descZh: "检查账户和仓库配额。",
  },
];

const API_KEY_SCOPE_VALUES = API_KEY_SCOPES.map((scope) => scope.value);

function formatDate(value) {
  if (!value) return T("Never", "从未");
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return textValue(value);
  return date.toLocaleString();
}

function normalizeApiKey(key = {}) {
  if (!objectRecord(key)) return null;
  const record = key;
  const id = textValue(record.id, record.keyId, record.key_id);
  if (!id) return null;
  const scopes = Array.isArray(record.scopes) ? record.scopes.map(textValue).filter(Boolean) : [];
  return {
    ...record,
    id,
    name: textValue(record.name) || T("API key", "API 密钥"),
    prefix: textValue(record.prefix),
    scopes,
    createdAt: record.createdAt || record.created_at,
    lastUsedAt: record.lastUsedAt || record.last_used_at,
  };
}

function createdApiKeyRecord(payload) {
  if (objectRecord(payload?.apiKey)) return payload.apiKey;
  if (objectRecord(payload?.key)) return payload.key;
  return payload;
}

function createdApiKeyToken(payload) {
  return textValue(
    payload?.token,
    payload?.apiKey?.token,
    payload?.apiKey?.key,
    typeof payload?.key === "string" ? payload.key : payload?.key?.token,
    payload?.key?.key
  );
}

function copyText(value) {
  const clipboard = globalThis.navigator?.clipboard;
  if (!value || !clipboard?.writeText) return Promise.resolve(false);
  return clipboard
    .writeText(value)
    .then(() => true)
    .catch(() => false);
}

function markdownText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownTableCell(value) {
  return markdownText(value).replaceAll("|", "\\|");
}

function appendMarkdownBlock(lines, value) {
  const text = markdownText(value);
  if (text) lines.push(text);
}

function appendApiDocsMarkdownElement(lines, element) {
  if (element.matches("[data-copy-exclude], .docs-crumbs")) return;

  if (element.classList.contains("docs-page-head")) {
    const heading = element.querySelector(".docs-h1");
    if (heading) appendApiDocsMarkdownElement(lines, heading);
    return;
  }

  if (element.classList.contains("docs-callout")) {
    const title = markdownText(element.querySelector("b")?.textContent);
    const body = markdownText(element.querySelector("p")?.textContent);
    if (title || body) {
      lines.push(
        [title ? `> **${title}**` : "", body ? `> ${body}` : ""].filter(Boolean).join("\n")
      );
    }
    return;
  }

  if (element.classList.contains("docs-code")) {
    const title = markdownText(element.querySelector(".docs-code-h span")?.textContent);
    const code = String(element.querySelector("pre")?.textContent ?? "").replace(/\n+$/g, "");
    if (title) lines.push(`### ${title}`);
    if (code) lines.push(`\`\`\`\n${code}\n\`\`\``);
    return;
  }

  if (element.classList.contains("docs-endpoint-list")) {
    Array.from(element.querySelectorAll(".docs-endpoint-card")).forEach((card) => {
      const method = markdownText(card.querySelector(".docs-method")?.textContent);
      const path = markdownText(card.querySelector("code")?.textContent);
      const description = markdownText(card.querySelector("p")?.textContent);
      const scope = markdownText(card.querySelector(".docs-scope")?.textContent);
      const endpointLines = [
        method || path ? `### ${[method, path].filter(Boolean).join(" ")}` : "",
        description,
        scope,
      ].filter(Boolean);
      if (endpointLines.length) lines.push(endpointLines.join("\n\n"));
    });
    return;
  }

  if (element.classList.contains("docs-table")) {
    const rows = Array.from(element.querySelectorAll(".docs-table-r"))
      .map((row) => [
        markdownTableCell(row.querySelector("b")?.textContent),
        markdownTableCell(row.querySelector("span")?.textContent),
      ])
      .filter(([code, text]) => code || text);
    if (rows.length) {
      lines.push(
        [
          "| Code | Description |",
          "| --- | --- |",
          ...rows.map((row) => `| ${row[0]} | ${row[1]} |`),
        ].join("\n")
      );
    }
    return;
  }

  if (element.classList.contains("docs-foot")) {
    appendMarkdownBlock(lines, element.querySelector(".muted")?.textContent);
    return;
  }

  const tag = element.tagName.toLowerCase();
  if (tag === "h1") {
    appendMarkdownBlock(lines, `# ${element.textContent}`);
    return;
  }
  if (tag === "h2") {
    appendMarkdownBlock(lines, `## ${element.textContent}`);
    return;
  }
  if (tag === "p") {
    appendMarkdownBlock(lines, element.textContent);
  }
}

function buildApiDocsMarkdownFromElement(root) {
  if (!root) return "";
  const lines = [];
  Array.from(root.children).forEach((element) => appendApiDocsMarkdownElement(lines, element));
  const markdown = lines
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return markdown ? `${markdown}\n` : "";
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

function resolveApiBaseUrl() {
  const publicApiBase = String(env.VITE_PUBLIC_API_BASE_URL || "").trim();
  const configuredApiBase = publicApiBase || String(env.VITE_API_BASE_URL || "").trim();
  if (!configuredApiBase) return "https://api.pull-wise.com";
  if (/^[a-z][a-z0-9+.-]*:/i.test(configuredApiBase)) {
    return configuredApiBase.replace(/\/$/, "");
  }
  if (configuredApiBase.startsWith("/")) {
    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
    if (origin) return new URL(configuredApiBase, origin).href.replace(/\/$/, "");
  }
  return "https://api.pull-wise.com";
}

function apiDocsUrl(path, baseUrl) {
  const base = String(baseUrl || resolveApiBaseUrl()).replace(/\/$/, "");
  const relativePath = String(path || "").replace(/^\/+/, "");
  if (base.endsWith("/api") && relativePath.startsWith("api/")) {
    return `${base}/${relativePath.slice(4)}`;
  }
  return `${base}/${relativePath}`;
}
const CONTACT_EMAIL = "contact@pull-wise.com";

export function ApiDocsScreen({ go, auth }) {
  useLang();
  const [pageCopied, setPageCopied] = useState(false);
  const docsMainRef = useRef(null);
  const pageCopyResetRef = useRef(null);
  const endpoints = [
    {
      method: "GET",
      path: "/api/v1/repositories",
      scope: "repositories:read",
      description: T(
        "List repositories authorized for the API key, including repoId and repository quota.",
        "列出该 API key 已授权访问的仓库，包括 repoId 和仓库配额。"
      ),
    },
    {
      method: "POST",
      path: "/api/v1/repositories/{repoId}/scans",
      scope: "scans:write",
      description: T(
        "Start a scan for an authorized repository. Optional JSON body: branch, commit SHA, requestId, or idempotencyKey.",
        "为已授权仓库启动扫描。可选 JSON body：branch、commit SHA、requestId 或 idempotencyKey。"
      ),
    },
    {
      method: "POST",
      path: "/api/v1/repositories/{repoId}/scans/stop",
      scope: "scans:write",
      description: T(
        "Cancel the latest queued or running scan for the repository.",
        "取消该仓库最近一个排队中或运行中的扫描。"
      ),
    },
    {
      method: "GET",
      path: "/api/v1/repositories/{repoId}/scans/current",
      scope: "scans:read",
      description: T(
        "Read the latest scan status for the repository. Completed scan payloads include agentFixPrompt for automation.",
        "读取该仓库最近一次扫描状态。已完成扫描的 payload 会包含 agentFixPrompt，用于自动化修复。"
      ),
    },
    {
      method: "GET",
      path: "/api/v1/repositories/{repoId}/scans/{scanId}/audit-bundle.zip",
      scope: "scans:read",
      description: T(
        "Download the audit bundle ZIP for a scan in this repository. The website /scans/{scanId}/audit-bundle.zip URL also accepts a scans:read API key for the owning account.",
        "下载该仓库某次扫描的审计包 ZIP。网站 /scans/{scanId}/audit-bundle.zip 地址也接受所属账户的 scans:read API key。"
      ),
    },
    {
      method: "GET",
      path: "/api/v1/repositories/{repoId}/quota",
      scope: "quota:read",
      description: T(
        "Read remaining account and repository scan quota.",
        "读取账户和仓库剩余扫描配额。"
      ),
    },
  ];
  const apiBaseUrl = resolveApiBaseUrl();
  const nav = [
    ["overview", T("Overview", "概览")],
    ["authentication", T("Authentication", "认证")],
    ["endpoints", T("Endpoints", "端点")],
    ["repositories", T("Repositories", "仓库")],
    ["scans", T("Scans", "扫描")],
    ["quota", T("Quota", "配额")],
    ["errors", T("Errors", "错误")],
  ];

  useEffect(
    () => () => {
      if (pageCopyResetRef.current) clearTimeout(pageCopyResetRef.current);
    },
    []
  );

  const copyPage = async () => {
    const copied = await copyText(buildApiDocsMarkdownFromElement(docsMainRef.current));
    if (!copied) return;
    setPageCopied(true);
    if (pageCopyResetRef.current) clearTimeout(pageCopyResetRef.current);
    pageCopyResetRef.current = setTimeout(() => {
      setPageCopied(false);
      pageCopyResetRef.current = null;
    }, 2000);
  };

  return (
    <div className="landing fade-in">
      <PublicHeader go={go} current="api" auth={auth} />
      <div className="docs-shell">
        <aside className="docs-side">
          <div className="docs-side-g">
            <div className="docs-side-h">API</div>
            {nav.map(([id, label]) => (
              <a key={id} className="docs-side-i" href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>
        </aside>

        <main className="docs-main" ref={docsMainRef}>
          <div className="docs-crumbs">
            <a className="auth-link" {...screenLinkProps(go, "landing")}>
              Pullwise
            </a>
            <span className="sep">/</span>
            <span className="now">API</span>
          </div>
          <div className="docs-page-head">
            <h1 id="overview" className="docs-h1">
              {T("Pullwise REST API", "Pullwise REST API")}
            </h1>
            <button
              className="btn sm"
              type="button"
              onClick={copyPage}
              aria-live="polite"
              data-copy-exclude
            >
              {pageCopied ? <I.Check size={13} /> : <I.Copy size={13} />}{" "}
              {pageCopied ? T("Copied", "已复制") : T("Copy Page", "复制页面")}
            </button>
          </div>
          <p className="docs-lede">
            {T(
              "Automate GitHub repository review from CI, internal tools, or scripts. The public REST API is served from https://api.pull-wise.com and exposes account-scoped repository listing, scan control, scan status, and quota checks.",
              "你可以从 CI、内部工具或脚本自动化 GitHub 仓库审查。公开 REST API 服务地址是 https://api.pull-wise.com，提供账户范围内的仓库列表、扫描控制、扫描状态和配额查询。"
            )}
          </p>

          <div className="docs-callout">
            <I.Shield size={16} />
            <div>
              <b>{T("Account-scoped access", "账户范围访问")}</b>
              <p>
                {T(
                  "API keys inherit the creator account and GitHub repository authorization. A key can only read quota, start scans, and inspect repositories already authorized in Pullwise.",
                  "API key 继承创建者账户和 GitHub 仓库授权。密钥只能读取配额、启动扫描，并访问已经在 Pullwise 中授权的仓库。"
                )}
              </p>
            </div>
          </div>
          <DocsCode title={T("Base URL", "基础地址")}>{apiBaseUrl}</DocsCode>

          <h2 id="authentication" className="docs-h2">
            {T("Authentication", "认证")}
          </h2>
          <p>
            {T(
              "Create a key from Dashboard / API Keys. Send it either as a bearer token or with X-Pullwise-Api-Key. Bearer tokens are recommended because they work consistently with common API clients and CI secret stores.",
              "请在工作台 / API Keys 创建密钥。请求时可以使用 bearer token，也可以使用 X-Pullwise-Api-Key。推荐 bearer token，因为它能更好地兼容常见 API 客户端和 CI 密钥存储。"
            )}
          </p>
          <DocsCode title={T("Authorization headers", "认证请求头")}>
            {`Authorization: Bearer pwk_live_example

X-Pullwise-Api-Key: pwk_live_example`}
          </DocsCode>
          <p>
            {T(
              "The API key management screen is authenticated with your Pullwise browser session. Each public REST API endpoint below requires an API key with the scope listed for that endpoint.",
              "API key 管理页面使用你的 Pullwise 浏览器会话认证。下面每个公开 REST API 端点都需要 API key，并要求该端点列出的权限。"
            )}
          </p>
          <DocsCode
            title={T("Create a key from the signed-in web app", "在已登录 Web 应用中创建密钥")}
          >
            {`POST /api-keys
Content-Type: application/json

{
  "name": "CI scanner",
  "scopes": ["repositories:read", "scans:write", "scans:read", "quota:read"]
}`}
          </DocsCode>

          <h2 id="endpoints" className="docs-h2">
            {T("Endpoints", "端点")}
          </h2>
          <p>
            {T(
              "All public REST routes are account-scoped. Repository-scoped scan routes require repoId in the path; use repositories:read to list repositories and discover repoId values, or store repoId from setup when using a scans:read-only key.",
              "所有公开 REST 路由都以账户为边界。仓库级扫描路由的路径需要 repoId；如需发现 repoId，请使用 repositories:read 列出仓库；如果只使用 scans:read 密钥，请在配置时保存 repoId。"
            )}
          </p>
          <div className="docs-endpoint-list">
            {endpoints.map(({ method, path, scope, description }) => (
              <article key={`${method}-${path}`} className="docs-endpoint-card">
                <div className="docs-endpoint-card-h">
                  <span className="docs-method">{method}</span>
                  <code>{path}</code>
                </div>
                <p>{description}</p>
                <span className="docs-scope">
                  {T("Required scope", "所需权限")}: {scope}
                </span>
              </article>
            ))}
          </div>

          <h2 id="repositories" className="docs-h2">
            {T("Repositories", "仓库")}
          </h2>
          <DocsCode title={T("List authorized repositories", "列出已授权仓库")}>
            {`curl ${apiDocsUrl("/api/v1/repositories", apiBaseUrl)} \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>
          <DocsCode title={T("Repository response", "仓库响应")}>
            {`{
  "items": [
    {
      "id": "repo_123",
      "repoId": "repo_123",
      "githubRepoId": "987654321",
      "fullName": "acme/api",
      "ownerLogin": "acme",
      "defaultBranch": "main",
      "private": true,
      "fork": false,
      "htmlUrl": "https://github.com/acme/api",
      "installationId": "123456",
      "installationAccount": "acme",
      "permissions": {
        "contents": "write",
        "pull_requests": "write"
      },
      "quota": {
        "scope": "repository",
        "period": "2026-06",
        "plan": "free",
        "limit": 3,
        "used": 1,
        "reserved": 0,
        "remaining": 2,
        "resetAt": 1782864000,
        "bucketId": "qb_repo_123"
      },
      "href": "/repositories/repo_123",
      "scanAction": {
        "method": "POST",
        "href": "/api/v1/repositories/repo_123/scans"
      }
    }
  ],
  "repositories": [/* same records as items */],
  "userQuota": {
    "scope": "user",
    "period": "2026-06",
    "plan": "free",
    "limit": 10,
    "used": 2,
    "reserved": 0,
    "remaining": 8,
    "resetAt": 1782864000,
    "bucketId": "qb_user_123"
  },
  "apiKey": {
    "id": "ak_abc",
    "name": "CI scanner",
    "prefix": "pwk_live_abc123",
    "scopes": ["repositories:read", "scans:write", "scans:read", "quota:read"]
  }
}`}
          </DocsCode>

          <h2 id="scans" className="docs-h2">
            {T("Scans", "扫描")}
          </h2>
          <p>
            {T(
              "A scan queues a backend checkout and review run for the authorized repository. The optional requestId or idempotencyKey field is an idempotency key: reusing the same value for the same repository returns the existing scan; reusing it for another repository returns 409.",
              "扫描会为已授权仓库排队执行后端 checkout 和审查。可选字段 requestId 或 idempotencyKey 是幂等键：同一仓库重复使用同一个值会返回已有扫描；不同仓库重复使用会返回 409。"
            )}
          </p>
          <p>
            {T(
              "requestId and idempotencyKey are accepted on scan creation for idempotency, but the public scan payload returns the scan id and status fields rather than echoing either value.",
              "创建扫描时可以传入 requestId 或 idempotencyKey 做幂等控制；公开扫描响应返回 scan id 和状态字段，不会回显这些值。"
            )}
          </p>
          <DocsCode title={T("Start a scan", "启动扫描")}>
            {`curl -X POST ${apiDocsUrl("/api/v1/repositories/repo_123/scans", apiBaseUrl)} \\
  -H "Authorization: Bearer $PULLWISE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "branch": "main",
    "requestId": "ci-2026-06-29T06:30:00Z"
  }'`}
          </DocsCode>
          <DocsCode title={T("Scan response", "扫描响应")}>
            {`{
  "id": "sc_abc123",
  "userId": "usr_123",
  "repoId": "repo_123",
  "githubRepoId": "987654321",
  "repo": "acme/api",
  "branch": "main",
  "commit": "pending",
  "status": "queued",
  "progress": 0,
  "phase": null,
  "issues": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "info": 0
  },
  "verification": {
    "verified": 0,
    "static_proof": 0,
    "potential_risk": 0,
    "unverified": 0
  },
  "createdAt": 1779997800,
  "queuedAt": 1779997800,
  "reviewOutputLanguage": "en",
  "quotaBucketIds": {
    "user": "qb_user_123",
    "repository": "qb_repo_123"
  },
  "billingUsage": {
    "scope": "user",
    "period": "2026-06",
    "plan": "free",
    "limit": 10,
    "used": 1,
    "reserved": 1,
    "remaining": 8,
    "resetAt": 1782864000,
    "bucketId": "qb_user_123"
  },
  "repoUsage": {
    "scope": "repository",
    "period": "2026-06",
    "plan": "free",
    "limit": 3,
    "used": 1,
    "reserved": 1,
    "remaining": 1,
    "resetAt": 1782864000,
    "bucketId": "qb_repo_123"
  },
  "quotaState": "reserved",
  "quotaReservedAt": 1779997800,
  "by": "api key"
}`}
          </DocsCode>
          <DocsCode title={T("Read current scan", "读取当前扫描")}>
            {`curl ${apiDocsUrl("/api/v1/repositories/repo_123/scans/current", apiBaseUrl)} \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>
          <DocsCode title={T("Stop an active scan", "停止活动扫描")}>
            {`curl -X POST ${apiDocsUrl("/api/v1/repositories/repo_123/scans/stop", apiBaseUrl)} \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>

          <p>
            {T(
              "Scan status is one of queued, running, done, failed, cancelled, or idle for the current-scan endpoint when no scan exists.",
              "扫描状态可能是 queued、running、done、failed、cancelled；current-scan 端点在没有扫描时返回 idle。"
            )}
          </p>

          <h2 id="quota" className="docs-h2">
            {T("Quota", "配额")}
          </h2>
          <p>
            {T(
              "Quota is reported for both the account and the repository. A scan reserves quota before it is queued; reserved quota reduces remaining quota and is consumed when the worker reaches a billable review stage. Cancelled scans and refundable worker failures release or roll back the reservation. When quota is exhausted, the scan start endpoint returns 402 Payment Required with a machine-readable code.",
              "配额同时按账户和仓库返回。扫描入队前会预留配额；预留配额会减少 remaining，并在 worker 到达可计费审查阶段时消耗。取消的扫描和可退款的 worker 失败会释放或回滚预留。配额耗尽时，启动扫描端点返回 402 Payment Required，并包含机器可读的 code。"
            )}
          </p>
          <DocsCode title={T("Read remaining scan count", "读取剩余扫描次数")}>
            {`curl ${apiDocsUrl("/api/v1/repositories/repo_123/quota", apiBaseUrl)} \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>
          <DocsCode title={T("Quota response", "配额响应")}>
            {`{
  "repoId": "repo_123",
  "user": {
    "scope": "user",
    "period": "2026-06",
    "plan": "free",
    "limit": 10,
    "used": 2,
    "reserved": 0,
    "remaining": 8,
    "resetAt": 1782864000,
    "bucketId": "qb_user_123"
  },
  "repository": {
    "scope": "repository",
    "period": "2026-06",
    "plan": "free",
    "limit": 3,
    "used": 1,
    "reserved": 0,
    "remaining": 2,
    "resetAt": 1782864000,
    "bucketId": "qb_repo_123"
  }
}`}
          </DocsCode>

          <h2 id="errors" className="docs-h2">
            {T("Errors and limits", "错误和限制")}
          </h2>
          <div className="docs-table">
            {[
              [
                "400",
                T(
                  "Malformed JSON, invalid repoId, invalid scope, invalid commit SHA, unavailable branch, or invalid request body.",
                  "JSON 格式错误、repoId 无效、scope 无效、commit SHA 无效、分支不可用或请求 body 无效。"
                ),
              ],
              ["401", T("Missing or invalid API key.", "缺少 API key 或 API key 无效。")],
              [
                "403",
                T(
                  "The API key is valid but does not include the required scope.",
                  "API key 有效，但不包含所需权限。"
                ),
              ],
              [
                "404",
                T(
                  "The route does not exist, the repository is not authorized, or no active scan can be stopped.",
                  "路由不存在、仓库未授权，或没有可停止的活动扫描。"
                ),
              ],
              [
                "409",
                T(
                  "requestId was already used for a different repository.",
                  "requestId 已被另一个仓库使用。"
                ),
              ],
              ["402", T("Scan quota is exhausted.", "扫描配额已耗尽。")],
              [
                "413",
                T(
                  "Request body exceeds the configured server limit.",
                  "请求 body 超出服务端配置限制。"
                ),
              ],
              [
                "429",
                T(
                  "Rate limit exceeded. Responses include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset when rate limiting is enabled.",
                  "超过限流。启用限流时，响应包含 X-RateLimit-Limit、X-RateLimit-Remaining 和 X-RateLimit-Reset。"
                ),
              ],
              [
                "502",
                T(
                  "Requested branch validation failed against GitHub.",
                  "向 GitHub 校验请求分支失败。"
                ),
              ],
              [
                "503",
                T(
                  "Review provider is not configured, so real scans cannot start.",
                  "审查提供方尚未配置，因此无法启动真实扫描。"
                ),
              ],
            ].map(([code, text]) => (
              <div key={code} className="docs-table-r">
                <b>{code}</b>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <DocsCode title={T("Error response", "错误响应")}>
            {`{
  "message": "A valid Pullwise API key is required."
}`}
          </DocsCode>
          <p>
            {T(
              `A machine-readable API description is also available from GET /api-docs or GET /api/docs on the backend. For support, email ${CONTACT_EMAIL}.`,
              `后端还提供机器可读 API 描述：GET /api-docs 或 GET /api/docs。如需支持，请发送邮件至 ${CONTACT_EMAIL}。`
            )}
          </p>

          <div className="docs-foot">
            <span className="muted">
              {T(
                "API routes are versioned under /api/v1. The official website is pull-wise.com.",
                "API 路由使用 /api/v1 版本前缀。官方网站是 pull-wise.com。"
              )}
            </span>
            <div className="docs-foot-actions">
              <a className="btn" {...screenLinkProps(go, "pricing")}>
                {T("Pricing", "价格")}
              </a>
              <a className="btn primary" {...screenLinkProps(go, "apiKeys")}>
                {T("API Keys", "API 密钥")}
              </a>
            </div>
          </div>
        </main>
      </div>
      <PublicFooter go={go} current="api" />
    </div>
  );
}

function ApiKeysSkeleton() {
  return (
    <div className="set-body api-keys-skeleton" aria-busy="true">
      <div className="bill-card api-key-create">
        <div className="api-key-create-head">
          <SkeletonLine className="sk-square sk-size-36" />
          <div className="skeleton-stack">
            <SkeletonLine className="sk-line sk-w-30 sk-h-16" />
            <SkeletonLine className="sk-line sk-w-65" />
          </div>
        </div>
        <div className="api-key-create-main">
          <div className="api-key-name-row">
            <SkeletonLine className="sk-line sk-w-60 sk-h-40" />
            <SkeletonLine className="sk-line sk-w-22 sk-h-40" />
          </div>
          <div className="api-scope-panel">
            <div className="api-scope-head">
              <div className="skeleton-stack">
                <SkeletonLine className="sk-line sk-w-28" />
                <SkeletonLine className="sk-line sk-w-62" />
              </div>
              <SkeletonLine className="sk-line sk-w-18 sk-h-20" />
            </div>
            <div className="api-scope-list">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="api-scope-row skeleton-row" key={`api-scope-skeleton-${index}`}>
                  <SkeletonLine className="sk-square sk-size-16" />
                  <div className="api-scope-copy">
                    <SkeletonLine className="sk-line sk-w-34" />
                    <SkeletonLine className="sk-line sk-w-70" />
                  </div>
                  <SkeletonLine className="sk-line sk-w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="issue-list">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="issue-row skeleton-row" key={`api-key-row-skeleton-${index}`}>
            <SkeletonLine className="sk-line sk-w-12 sk-h-22" />
            <SkeletonLine className="sk-line sk-w-16" />
            <div className="issue-main">
              <SkeletonLine className="sk-line sk-w-45 sk-h-16" />
              <div className="issue-meta">
                <SkeletonLine className="sk-line sk-w-26" />
                <SkeletonLine className="sk-line sk-w-24" />
                <SkeletonLine className="sk-line sk-w-18" />
              </div>
            </div>
            <SkeletonLine className="sk-line sk-w-18 sk-h-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApiKeysScreen({ go, setIssue = null }) {
  useLang();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState(T("Account automation", "账户自动化"));
  const [selectedScopes, setSelectedScopes] = useState(API_KEY_SCOPE_VALUES);
  const [createdToken, setCreatedToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const mutationInFlightRef = useRef(false);
  useErrorNotification(error, {
    title: T("API key error", "API key error"),
    key: `api-keys:${error}`,
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await pullwiseApi.apiKeys.list();
      setKeys(itemsFrom(payload, "apiKeys", "keys", "items").map(normalizeApiKey).filter(Boolean));
    } catch (err) {
      setError(err?.message || T("Unable to load API keys.", "无法加载 API key。"));
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleScope = (scopeValue) => {
    setSelectedScopes((current) => {
      const next = current.includes(scopeValue)
        ? current.filter((scope) => scope !== scopeValue)
        : [...current, scopeValue];
      return API_KEY_SCOPE_VALUES.filter((scope) => next.includes(scope));
    });
  };

  const createKey = async (event) => {
    event.preventDefault();
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setPending("create");
    setError("");
    setCreatedToken("");
    try {
      const scopes = API_KEY_SCOPE_VALUES.filter((scope) => selectedScopes.includes(scope));
      const payload = await pullwiseApi.apiKeys.create({
        name: name.trim() || T("API key", "API 密钥"),
        scopes,
      });
      const key = normalizeApiKey(createdApiKeyRecord(payload));
      const token = createdApiKeyToken(payload);
      if (!key) throw new Error(T("API key response was malformed.", "API key 响应格式错误。"));
      setKeys((current) => [key, ...current.filter((item) => item.id !== key.id)]);
      if (!token) {
        throw new Error(
          T(
            "The API key was created, but its one-time token was missing. Revoke it and create another key.",
            "API key 已创建，但响应中缺少仅显示一次的令牌。请吊销该密钥并重新创建。"
          )
        );
      }
      setCreatedToken(token);
      setName(T("Account automation", "账户自动化"));
      setSelectedScopes(API_KEY_SCOPE_VALUES);
    } catch (err) {
      setError(err?.message || T("Unable to create API key.", "无法创建 API key。"));
    } finally {
      mutationInFlightRef.current = false;
      setPending("");
    }
  };

  const revokeKey = async (keyId) => {
    if (!keyId || mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setPending(keyId);
    setError("");
    try {
      await pullwiseApi.apiKeys.revoke(keyId);
      setKeys((current) => current.filter((key) => key.id !== keyId));
    } catch (err) {
      setError(err?.message || T("Unable to revoke API key.", "无法吊销 API key。"));
    } finally {
      mutationInFlightRef.current = false;
      setPending("");
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    setError("");
    if (!navigator.clipboard) {
      setError(
        T(
          "Unable to copy API key. Select and copy the token manually.",
          "无法复制 API key，请手动选择并复制令牌。"
        )
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(createdToken);
    } catch {
      setError(
        T(
          "Unable to copy API key. Select and copy the token manually.",
          "无法复制 API key，请手动选择并复制令牌。"
        )
      );
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("API Keys", "API 密钥") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="apiKeys" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("API Keys", "API 密钥")}</h1>
              <div className="sub">
                {T(
                  "REST credentials for account-scoped repository scans and quota checks.",
                  "用于账户范围内仓库扫描和配额检查的 REST 凭据。"
                )}
              </div>
            </div>
            <div className="actions">
              <a className="btn" {...screenLinkProps(go, "api")}>
                <I.FileCode size={14} /> {T("API docs", "API 文档")}
              </a>
            </div>
          </div>

          {createdToken && (
            <div className="auth-success" role="status" style={{ marginBottom: 12 }}>
              <I.Check size={14} />
              <div>
                <b>{T("New key created", "已创建新密钥")}</b>
                <span>
                  {T(
                    "Copy it now. The full token is only shown once.",
                    "请立即复制。完整令牌只显示一次。"
                  )}
                </span>
                <div className="docs-code" style={{ marginBottom: 0 }}>
                  <div className="docs-code-h">
                    <span>{T("Bearer token", "Bearer 令牌")}</span>
                    <button className="docs-code-copy" type="button" onClick={copyToken}>
                      <I.Copy size={12} /> {T("Copy", "复制")}
                    </button>
                  </div>
                  <pre>{createdToken}</pre>
                </div>
              </div>
            </div>
          )}

          <div className="set-shell">
            <aside className="set-side">
              <button className="set-side-i active">
                <I.Code size={14} />
                <span>{T("Keys", "密钥")}</span>
              </button>
              <a className="set-side-i" {...screenLinkProps(go, "api")}>
                <I.FileCode size={14} />
                <span>{T("Docs", "文档")}</span>
              </a>
            </aside>

            {loading ? (
              <ApiKeysSkeleton />
            ) : (
              <div className="set-body">
                <form className="bill-card api-key-create" onSubmit={createKey}>
                  <div className="api-key-create-head">
                    <div className="api-key-create-icon">
                      <I.Shield size={16} />
                    </div>
                    <div>
                      <b>{T("Create API key", "创建 API key")}</b>
                      <span>
                        {T(
                          "Name the key, choose scopes, then create the token.",
                          "为密钥命名，选择权限范围，然后创建令牌。"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="api-key-create-main">
                    <div className="api-key-name-row">
                      <label className="auth-field">
                        <span>{T("Key name", "密钥名称")}</span>
                        <div className="auth-input">
                          <I.Code size={14} />
                          <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={T("CI scanner", "CI 扫描器")}
                          />
                        </div>
                      </label>
                      <button className="btn primary" type="submit" disabled={pending === "create"}>
                        {pending === "create" && (
                          <span className="spin" style={{ display: "inline-block" }}>
                            <I.Refresh size={14} />
                          </span>
                        )}
                        <I.Plus size={14} /> {T("Create key", "创建密钥")}
                      </button>
                    </div>
                    <fieldset className="api-scope-panel" aria-describedby="api-scope-help">
                      <legend className="api-scope-legend">{T("Scopes", "权限")}</legend>
                      <div className="api-scope-head">
                        <div>
                          <span className="api-scope-kicker">
                            <I.Shield size={13} /> {T("Scopes", "权限")}
                          </span>
                          <span id="api-scope-help" className="api-scope-help">
                            {T(
                              "Select the API routes this key can use.",
                              "选择此密钥可以使用的 API 路由。"
                            )}
                          </span>
                        </div>
                        <span className="tag api-scope-count">
                          {selectedScopes.length} / {API_KEY_SCOPES.length}{" "}
                          {T("selected", "已选择")}
                        </span>
                      </div>
                      <div className="api-scope-list">
                        {API_KEY_SCOPES.map((scope) => {
                          const checked = selectedScopes.includes(scope.value);
                          return (
                            <label
                              key={scope.value}
                              className={"api-scope-row" + (checked ? " selected" : "")}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleScope(scope.value)}
                              />
                              <span className="api-scope-copy">
                                <b>{T(scope.labelEn, scope.labelZh)}</b>
                                <span>{T(scope.descEn, scope.descZh)}</span>
                              </span>
                              <code className="api-scope-value">{scope.value}</code>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </div>
                </form>

                <div className="issue-list">
                  {keys.map((key) => (
                    <div key={key.id || key.prefix || key.name} className="issue-row">
                      <div className="issue-sev sev-bg-info">
                        <I.Code size={12} /> {T("key", "key")}
                      </div>
                      <div className="issue-id">{key.prefix || key.id || "-"}</div>
                      <div className="issue-main">
                        <div className="issue-t">{key.name}</div>
                        <div className="issue-meta">
                          <span className="tag">
                            {T("Created", "已创建")} {formatDate(key.createdAt)}
                          </span>
                          <span className="tag">
                            {T("Last used", "最近使用")} {formatDate(key.lastUsedAt)}
                          </span>
                          {key.scopes.map((scope) => (
                            <span className="tag" key={scope}>
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        className="btn sm"
                        disabled={pending === key.id}
                        onClick={() => revokeKey(key.id)}
                      >
                        <I.X size={13} /> {T("Revoke", "吊销")}
                      </button>
                    </div>
                  ))}
                  {!loading && keys.length === 0 && (
                    <div className="card section muted">
                      {T("No API keys have been created yet.", "尚未创建任何 API key。")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
