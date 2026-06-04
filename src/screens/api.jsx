import { useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
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
    label: "Read repositories",
    description: "List repositories authorized for this account.",
  },
  {
    value: "scans:write",
    label: "Start repository scans",
    description: "Create or stop scans for authorized repositories.",
  },
  {
    value: "scans:read",
    label: "Read scans",
    description: "Read scan status, findings, and history.",
  },
  {
    value: "quota:read",
    label: "Read quota",
    description: "Check account and repository quota.",
  },
];

const API_KEY_SCOPE_VALUES = API_KEY_SCOPES.map((scope) => scope.value);

function formatDate(value) {
  if (!value) return "Never";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return textValue(value);
  return date.toLocaleString();
}

function normalizeApiKey(key = {}) {
  if (!objectRecord(key)) return null;
  const record = key;
  const id = textValue(record.id, record.keyId, record.key_id);
  if (!id) return null;
  const scopes = Array.isArray(record.scopes)
    ? record.scopes.map(textValue).filter(Boolean)
    : [];
  return {
    ...record,
    id,
    name: textValue(record.name) || "API key",
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

function MarketingHeader({ go, auth }) {
  const signedIn = Boolean(auth?.authenticated);
  return (
    <header className="lp-top">
      <a
        className="brand topbar-brand-button"
        aria-label="Go to Pullwise home"
        {...screenLinkProps(go, "landing")}
      >
        <div className="brand-mark">PR</div>
        <span>Pullwise</span>
      </a>
      <nav className="lp-nav">
        <a className="btn ghost sm" {...screenLinkProps(go, "landing")}>
          {T("Product", "Product")}
        </a>
        <a className="btn ghost sm" {...screenLinkProps(go, "pricing")}>
          {T("Pricing", "Pricing")}
        </a>
        <a className="btn ghost sm" {...screenLinkProps(go, "api")}>
          {T("API", "API")}
        </a>
      </nav>
      <div style={{ display: "flex", gap: 8 }}>
        {signedIn ? (
          <a className="btn primary sm" {...screenLinkProps(go, "dashboard")}>
            {T("Dashboard", "Dashboard")}
          </a>
        ) : (
          <a className="btn primary sm" {...screenLinkProps(go, "login")}>
            {T("Sign in", "Sign in")}
          </a>
        )}
      </div>
    </header>
  );
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

const API_BASE_URL = "https://api.pull-wise.com";
const CONTACT_EMAIL = "contact@pull-wise.com";

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
      description: T(
        "Read remaining account and repository scan quota.",
        "读取账户和仓库剩余扫描配额。"
      ),
    },
  ];
  const nav = [
    ["overview", T("Overview", "概览")],
    ["authentication", T("Authentication", "认证")],
    ["repositories", T("Repositories", "仓库")],
    ["scans", T("Scans", "扫描")],
    ["quota", T("Quota", "配额")],
    ["errors", T("Errors", "错误")],
  ];

  return (
    <div className="landing fade-in">
      <MarketingHeader go={go} auth={auth} />
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
                  "API keys inherit the creator account and GitHub repository authorization. A key can only read quota, start scans, and inspect repositories already authorized in Pullwise.",
                  "API key 继承创建者账户和 GitHub 仓库授权。密钥只能读取配额、启动扫描，并访问已经在 Pullwise 中授权的仓库。"
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
              "请在工作台 / API Keys 创建密钥。请求时可以使用 bearer token，也可以使用 X-Pullwise-Api-Key。推荐 bearer token，因为它能更好地兼容常见 API 客户端和 CI 密钥存储。"
            )}
          </p>
          <DocsCode title={T("Authorization headers", "认证请求头")}>
            {`Authorization: Bearer pwk_live_example

X-Pullwise-Api-Key: pwk_live_example`}
          </DocsCode>
          <p>
            {T(
              "The API key management screen is authenticated with your Pullwise browser session. The public REST API endpoints below require an API key and one of these scopes: repositories:read, scans:write, scans:read, quota:read.",
              "API key 管理页面使用你的 Pullwise 浏览器会话认证。下面的公开 REST API 端点需要 API key，并要求以下权限之一：repositories:read、scans:write、scans:read、quota:read。"
            )}
          </p>
          <DocsCode title={T("Create a key from the signed-in web app", "在已登录 Web 应用中创建密钥")}>
            {`POST /api-keys
Content-Type: application/json

{
  "name": "CI scanner",
  "scopes": ["repositories:read", "scans:write", "scans:read", "quota:read"]
}`}
          </DocsCode>

          <h2 id="repositories" className="docs-h2">
            {T("Repositories", "仓库")}
          </h2>
          <div className="docs-table">
            {endpoints.map(({ method, path, scope, description }) => (
              <div key={`${method}-${path}`} className="docs-table-r">
                <b className="docs-endpoint">
                  {method} {path}
                </b>
                <span>
                  {description}
                  <br />
                  <span className="muted">{T("Required scope", "所需权限")}: {scope}</span>
                </span>
              </div>
            ))}
          </div>
          <DocsCode title={T("List authorized repositories", "列出已授权仓库")}>
            {`curl ${API_BASE_URL}/api/v1/repositories \\
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
      "permissions": { "contents": "read" },
      "quota": {
        "limit": 100,
        "used": 12,
        "remaining": 88
      }
    }
  ],
  "repositories": [/* same records as items */],
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
    "requestId": "ci-2026-05-29T06:30:00Z"
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
  "phase": null,
  "issues": {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
    "info": 0
  },
  "createdAt": 1779997800,
  "queuedAt": 1779997800,
  "requestId": "ci-2026-05-29T06:30:00Z"
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
              "配额同时按账户和仓库返回。启动扫描会在入队前消耗配额。配额耗尽时，启动扫描端点返回 402 Payment Required，并包含机器可读的 code。"
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
    "limit": 100,
    "used": 12,
    "remaining": 88
  },
  "repository": {
    "limit": 20,
    "used": 3,
    "remaining": 17
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
              ["429", T("Rate limit exceeded. Responses include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset when rate limiting is enabled.", "超过限流。启用限流时，响应包含 X-RateLimit-Limit、X-RateLimit-Remaining 和 X-RateLimit-Reset。")],
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

        <aside className="docs-toc">
          <div className="docs-toc-h">{T("On this page", "本页内容")}</div>
          {nav.slice(1).map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </aside>
      </div>
    </div>
  );
}

export function ApiKeysScreen({ go, setIssue = null }) {
  useLang();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("Account automation");
  const [selectedScopes, setSelectedScopes] = useState(API_KEY_SCOPE_VALUES);
  const [createdToken, setCreatedToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await pullwiseApi.apiKeys.list();
      setKeys(itemsFrom(payload, "apiKeys", "keys", "items").map(normalizeApiKey).filter(Boolean));
    } catch (err) {
      setError(err?.message || "Unable to load API keys.");
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
    if (pending) return;
    setPending("create");
    setError("");
    setCreatedToken("");
    try {
      const scopes = API_KEY_SCOPE_VALUES.filter((scope) => selectedScopes.includes(scope));
      const payload = await pullwiseApi.apiKeys.create({
        name: name.trim() || "API key",
        scopes,
      });
      const key = normalizeApiKey(createdApiKeyRecord(payload));
      const token = createdApiKeyToken(payload);
      if (!key) throw new Error("API key response was malformed.");
      setCreatedToken(token);
      setKeys((current) => [key, ...current.filter((item) => item.id !== key.id)]);
      setName("Account automation");
      setSelectedScopes(API_KEY_SCOPE_VALUES);
    } catch (err) {
      setError(err?.message || "Unable to create API key.");
    } finally {
      setPending("");
    }
  };

  const revokeKey = async (keyId) => {
    if (!keyId || pending) return;
    setPending(keyId);
    setError("");
    try {
      await pullwiseApi.apiKeys.revoke(keyId);
      setKeys((current) => current.filter((key) => key.id !== keyId));
    } catch (err) {
      setError(err?.message || "Unable to revoke API key.");
    } finally {
      setPending("");
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    setError("");
    if (!navigator.clipboard) {
      setError("Unable to copy API key. Select and copy the token manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(createdToken);
    } catch {
      setError("Unable to copy API key. Select and copy the token manually.");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: "API Keys" }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="apiKeys" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>API Keys</h1>
              <div className="sub">
                REST credentials for account-scoped repository scans and quota checks.
              </div>
            </div>
            <div className="actions">
              <a className="btn" {...screenLinkProps(go, "api")}>
                <I.FileCode size={14} /> API docs
              </a>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
              <I.X size={13} /> {error}
            </div>
          )}
          {createdToken && (
            <div className="auth-success" role="status" style={{ marginBottom: 12 }}>
              <I.Check size={14} />
              <div>
                <b>New key created</b>
                <span>Copy it now. The full token is only shown once.</span>
                <div className="docs-code" style={{ marginBottom: 0 }}>
                  <div className="docs-code-h">
                    <span>Bearer token</span>
                    <button className="docs-code-copy" type="button" onClick={copyToken}>
                      <I.Copy size={12} /> Copy
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
                <span>Keys</span>
              </button>
              <a className="set-side-i" {...screenLinkProps(go, "api")}>
                <I.FileCode size={14} />
                <span>Docs</span>
              </a>
            </aside>

            <div className="set-body">
              <form className="bill-card" onSubmit={createKey} style={{ display: "block" }}>
                <div className="billing-summary-main" style={{ alignItems: "flex-start" }}>
                  <I.Shield size={18} style={{ marginTop: 27 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label className="auth-field">
                      <span>Key name</span>
                      <div className="auth-input">
                        <I.Code size={14} />
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="CI scanner"
                        />
                      </div>
                    </label>
                    <fieldset
                      style={{
                        border: 0,
                        margin: "14px 0 0",
                        padding: 0,
                      }}
                    >
                      <legend
                        style={{
                          color: "var(--text-2)",
                          fontSize: 13,
                          fontWeight: 700,
                          marginBottom: 8,
                        }}
                      >
                        Scopes
                      </legend>
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        }}
                      >
                        {API_KEY_SCOPES.map((scope) => (
                          <label
                            key={scope.value}
                            className="auth-field"
                            style={{
                              border: "1px solid var(--line)",
                              borderRadius: 8,
                              cursor: "pointer",
                              gap: 6,
                              padding: 10,
                            }}
                          >
                            <span
                              style={{
                                alignItems: "center",
                                color: "var(--text-1)",
                                display: "flex",
                                fontSize: 13,
                                gap: 8,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedScopes.includes(scope.value)}
                                onChange={() => toggleScope(scope.value)}
                              />
                              <b>{scope.label}</b>
                            </span>
                            <span style={{ color: "var(--text-2)", fontSize: 12 }}>
                              {scope.value}
                            </span>
                            <span style={{ color: "var(--text-3)", fontSize: 12 }}>
                              {scope.description}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </div>
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 12,
                    justifyContent: "space-between",
                    marginTop: 14,
                  }}
                >
                  <span className="sub">
                    {selectedScopes.length} of {API_KEY_SCOPES.length} scopes selected
                  </span>
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={pending === "create"}
                  >
                    {pending === "create" && (
                      <span className="spin" style={{ display: "inline-block" }}>
                        <I.Refresh size={14} />
                      </span>
                    )}
                    <I.Plus size={14} /> Create key
                  </button>
                </div>
              </form>

              <div className="bill-card" style={{ display: "block" }}>
                <div className="docs-table">
                  <div className="docs-table-r">
                    <b>Permission model</b>
                    <span>
                      Keys inherit the creator Pullwise account role and authorized GitHub
                      repositories. Repo operations require the target repoId to belong to that
                      account.
                    </span>
                  </div>
                  <div className="docs-table-r">
                    <b>REST scopes</b>
                    <span>
                      Choose only the REST scopes each key needs: repositories:read,
                      scans:write, scans:read, quota:read.
                    </span>
                  </div>
                </div>
              </div>

              <div className="issue-list">
                {keys.map((key) => (
                  <div key={key.id || key.prefix || key.name} className="issue-row">
                    <div className="issue-sev sev-bg-info">
                      <I.Code size={12} /> key
                    </div>
                    <div className="issue-id">{key.prefix || key.id || "-"}</div>
                    <div className="issue-main">
                      <div className="issue-t">{key.name}</div>
                      <div className="issue-meta">
                        <span className="tag">Created {formatDate(key.createdAt)}</span>
                        <span className="tag">Last used {formatDate(key.lastUsedAt)}</span>
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
                      <I.X size={13} /> Revoke
                    </button>
                  </div>
                ))}
                {!loading && keys.length === 0 && (
                  <div className="card section muted">No API keys have been created yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

