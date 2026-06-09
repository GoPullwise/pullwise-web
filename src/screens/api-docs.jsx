import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const API_BASE_URL = "https://api.pull-wise.com";
const CONTACT_EMAIL = "contact@pull-wise.com";

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

export function ApiDocsScreen({ go, auth }) {
  useLang();
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
        "Start a scan for an authorized repository. Optional JSON body: branch, commit, requestId.",
        "为已授权仓库启动扫描。可选 JSON body：branch、commit、requestId。"
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
        "Read the latest scan status for the repository. Returns idle when no scan exists.",
        "读取该仓库最近一次扫描状态。没有扫描时返回 idle。"
      ),
    },
    {
      method: "GET",
      path: "/api/v1/repositories/{repoId}/quota",
      scope: "quota:read",
      description: T("Read remaining account and repository scan quota.", "读取账户和仓库剩余扫描配额。"),
    },
  ];
  const nav = [
    ["overview", T("Overview", "概览")],
    ["authentication", T("Authentication", "认证")],
    ["endpoints", T("Endpoints", "端点")],
    ["repositories", T("Repositories", "仓库")],
    ["scans", T("Scans", "扫描")],
    ["quota", T("Quota", "配额")],
    ["errors", T("Errors", "错误")],
  ];

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

        <main className="docs-main">
          <div className="docs-crumbs">
            <a className="auth-link" {...screenLinkProps(go, "landing")}>
              Pullwise
            </a>
            <span className="sep">/</span>
            <span className="now">API</span>
          </div>
          <h1 id="overview" className="docs-h1">
            Pullwise REST API
          </h1>
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
                  "API keys inherit the creator account and GitHub repository authorization. A key can only inspect repositories, read quota, and start scans for repositories already authorized in Pullwise.",
                  "API key 继承创建者账户和 GitHub 仓库授权。一个 key 只能访问已经在 Pullwise 中授权的仓库、读取配额并启动扫描。"
                )}
              </p>
            </div>
          </div>
          <DocsCode title={T("Base URL", "基础地址")}>{API_BASE_URL}</DocsCode>

          <h2 id="authentication" className="docs-h2">
            {T("Authentication", "认证")}
          </h2>
          <p>
            {T(
              "Create a key from Dashboard / API Keys. Send it either as a bearer token or with X-Pullwise-Api-Key. Bearer tokens are recommended because they work consistently with common API clients and CI secret stores.",
              "请在工作台 / API Keys 创建密钥。请求时可以使用 bearer token，也可以使用 X-Pullwise-Api-Key。推荐 bearer token，因为它能更好兼容常见 API 客户端和 CI 密钥存储。"
            )}
          </p>
          <DocsCode title={T("Authorization headers", "认证请求头")}>
            {`Authorization: Bearer pwk_live_example

X-Pullwise-Api-Key: pwk_live_example`}
          </DocsCode>
          <p>
            {T(
              "API key management uses your signed-in Pullwise browser session. The public REST endpoints below require an API key and one of these scopes: repositories:read, scans:write, scans:read, quota:read.",
              "API key 管理页面使用你的 Pullwise 浏览器会话认证。下面的公开 REST 端点需要 API key，并要求以下权限之一：repositories:read、scans:write、scans:read、quota:read。"
            )}
          </p>

          <h2 id="endpoints" className="docs-h2">
            {T("Endpoints", "端点")}
          </h2>
          <p>
            {T(
              "All public REST routes are account-scoped. Use repoId from the repository list when starting, stopping, or reading scans.",
              "所有公开 REST 路由都以账户为边界。启动、停止或读取扫描时，请使用仓库列表返回的 repoId。"
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
            {`curl ${API_BASE_URL}/api/v1/repositories \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>
          <DocsCode title={T("Repository response", "仓库响应")}>
            {`{
  "items": [
    {
      "repoId": "repo_123",
      "githubRepoId": "987654321",
      "fullName": "acme/api",
      "defaultBranch": "main",
      "private": true,
      "installationId": "123456",
      "permissions": {
        "contents": "write",
        "pull_requests": "write"
      },
      "quota": {
        "scope": "repository",
        "limit": 3,
        "used": 1,
        "remaining": 2
      }
    }
  ],
  "userQuota": {
    "scope": "user",
    "limit": 10,
    "used": 2,
    "remaining": 8
  }
}`}
          </DocsCode>

          <h2 id="scans" className="docs-h2">
            {T("Scans", "扫描")}
          </h2>
          <p>
            {T(
              "A scan queues a backend checkout and review run for the authorized repository. The optional requestId field is an idempotency key: reusing the same requestId for the same repository returns the existing scan; reusing it for another repository returns 409.",
              "扫描会为已授权仓库排队执行后端 checkout 和审查。可选字段 requestId 是幂等键：同一仓库重复使用同一个 requestId 会返回已有扫描；不同仓库重复使用会返回 409。"
            )}
          </p>
          <DocsCode title={T("Start a scan", "启动扫描")}>
            {`curl -X POST ${API_BASE_URL}/api/v1/repositories/repo_123/scans \\
  -H "Authorization: Bearer $PULLWISE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "branch": "main",
    "commit": "HEAD",
    "requestId": "ci-2026-06-09T06:30:00Z"
  }'`}
          </DocsCode>
          <DocsCode title={T("Scan response", "扫描响应")}>
            {`{
  "id": "sc_abc123",
  "repoId": "repo_123",
  "repo": "acme/api",
  "branch": "main",
  "commit": "pending",
  "status": "queued",
  "progress": 0,
  "issues": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "info": 0
  }
}`}
          </DocsCode>
          <DocsCode title={T("Read current scan", "读取当前扫描")}>
            {`curl ${API_BASE_URL}/api/v1/repositories/repo_123/scans/current \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>
          <DocsCode title={T("Stop an active scan", "停止活动扫描")}>
            {`curl -X POST ${API_BASE_URL}/api/v1/repositories/repo_123/scans/stop \\
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
              "Quota is reported for both the account and the repository. A scan consumes quota before it is queued. When quota is exhausted, the scan start endpoint returns 402 Payment Required with a machine-readable code.",
              "配额会同时按账户和仓库返回。启动扫描会在入队前消耗配额。配额耗尽时，启动扫描端点返回 402 Payment Required，并包含机器可读的 code。"
            )}
          </p>
          <DocsCode title={T("Read remaining scan count", "读取剩余扫描次数")}>
            {`curl ${API_BASE_URL}/api/v1/repositories/repo_123/quota \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>
          <DocsCode title={T("Quota response", "配额响应")}>
            {`{
  "repoId": "repo_123",
  "user": {
    "scope": "user",
    "limit": 10,
    "used": 2,
    "remaining": 8
  },
  "repository": {
    "scope": "repository",
    "limit": 3,
    "used": 1,
    "remaining": 2
  }
}`}
          </DocsCode>

          <h2 id="errors" className="docs-h2">
            {T("Errors and limits", "错误和限制")}
          </h2>
          <div className="docs-table">
            {[
              ["400", T("Malformed JSON, invalid repoId, invalid scope, or invalid request body.", "JSON 格式错误、repoId 无效、scope 无效或请求 body 无效。")],
              ["401", T("Missing or invalid API key.", "缺少 API key 或 API key 无效。")],
              ["403", T("The API key is valid but does not include the required scope.", "API key 有效，但不包含所需权限。")],
              ["404", T("The route does not exist, the repository is not authorized, or no active scan can be stopped.", "路由不存在、仓库未授权，或没有可停止的活动扫描。")],
              ["409", T("requestId was already used for a different repository.", "requestId 已被另一个仓库使用。")],
              ["402", T("Scan quota is exhausted.", "扫描配额已耗尽。")],
              ["413", T("Request body exceeds the configured server limit.", "请求 body 超出服务端配置限制。")],
              ["429", T("Rate limit exceeded. Responses include rate-limit headers when rate limiting is enabled.", "超过限流。启用限流时响应会包含 rate-limit 相关请求头。")],
              ["503", T("Review provider is not configured, so real scans cannot start.", "审查提供方尚未配置，因此无法启动真实扫描。")],
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
