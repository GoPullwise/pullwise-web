import { useState } from "react";
import { env } from "../config/env.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const ENDPOINTS = [
  ["GET", "/api/v1/me", "profile:read", "Current product profile"],
  ["GET", "/api/v1/usage", "usage:read", "Entitlements and processing usage"],
  ["GET", "/api/v1/usage/events", "usage:read", "Successful processing history"],
  ["GET", "/api/v1/watches", "watches:read", "Authorized update watches"],
  ["GET", "/api/v1/watches/{watchId}", "watches:read", "One authorized watch"],
  ["PATCH", "/api/v1/watches/{watchId}", "watches:write", "Update an owner public watch with If-Match"],
  ["DELETE", "/api/v1/watches/{watchId}", "watches:write", "Archive an owner public watch with If-Match"],
  ["GET", "/api/v1/sources", "items:read", "Saved PR, CI and Updates sources"],
  ["GET", "/api/v1/sources/{sourceId}", "items:read", "One source and its current authorized contexts"],
  ["GET", "/api/v1/items", "items:read", "Saved action items and filters"],
  ["GET", "/api/v1/items/overview", "items:read", "Authorized counts and source coverage"],
  ["GET", "/api/v1/visualizations?kind=workload", "items:read", "Saved Item distribution by module and attention state"],
  ["GET", "/api/v1/visualizations?kind=pr_actions", "items:read", "Saved PR action rows with Item drilldowns"],
  ["GET", "/api/v1/visualizations?kind=ci_failures", "items:read", "Saved CI stage and symptom pairs"],
  ["GET", "/api/v1/visualizations?kind=updates_releases", "items:read", "Release and watch rows, including unclassified sources"],
  ["GET", "/api/v1/items/{itemId}", "items:read", "Evidence and handling history"],
  ["GET", "/api/v1/items/{itemId}/timeline", "items:read", "Saved observations, assessments and handling events"],
  ["PATCH", "/api/v1/items/{itemId}", "items:write", "Handling with itemVersion and If-Match"],
  ["POST", "/api/v1/watches/{watchId}/sync", "watches:read + sync:write", "GitHub fact sync only"],
  ["POST", "/api/v1/repositories/{repositoryId}/sync", "repositories:read + sync:write", "Repository fact sync only"],
  ["GET", "/api/v1/jobs/{jobId}", "items:read", "Requester-owned manual sync status"],
  ["GET", "/api/v1/repositories/{repositoryId}/service", "repositories:read", "Saved owner service"],
  ["PUT", "/api/v1/repositories/{repositoryId}/service", "repositories:manage", "Existing owner service update"],
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
  const relative = path.replace(/^\/+/, "");
  return `${base}/${base.endsWith("/api") && relative.startsWith("api/") ? relative.slice(4) : relative}`;
}

function DocsCode({ title, children }) {
  return <div className="docs-code"><div className="docs-code-h"><span>
    <I.Terminal size={12} /> {title}</span></div><pre>{children}</pre></div>;
}

function markdown(base, itemExample, syncExample) {
  return ["# Pullwise REST API", "", "PR / CI / Updates contract preview. Cloudflare Server is not deployed for this product yet.", "",
    "## Authentication", "", "Use a Bearer API key or X-Pullwise-Api-Key. Handling and sync need explicit write scopes.", "",
    "### Base URL", "", "```text", base, "```", "", "## Endpoints", "",
    ...ENDPOINTS.flatMap(([method, path, scope, description]) => [
      `### ${method} ${path}`, "", description, `Required scope: ${scope}`, "",
    ]),
    "## Saved items", "", "```sh", itemExample, "```", "",
    "## Manual fact sync", "", "```sh", syncExample, "```", "",
    "GET and manual sync do not invoke Jev or spend intelligent-processing usage.", "",
    "## Availability", "", "Repository listing/creation, watch creation, private/member sync, matrices and full timelines are not enabled on the Cloudflare Server candidate.", "",
    "## Errors and limits", "", "| Code | Description |", "| --- | --- |",
    "| 401 | Session or API key required |", "| 403 | Scope or Origin denied |",
    "| 404 | Resource unavailable or no longer authorized |", "| 409 | Idempotency conflict |",
    "| 412 | Saved revision changed |", "| 422 | Invalid filters |", "",
    "API routes are versioned under /api/v1."].join("\n");
}

export function ApiDocsScreen({ go, auth }) {
  useLang();
  const [copied, setCopied] = useState(false);
  const base = baseUrl();
  const itemExample = `curl '${apiUrl("/api/v1/items?module=pr&view=mine", base)}' \\\n+  -H 'Authorization: Bearer $PULLWISE_API_KEY'`;
  const syncExample = `curl -X POST '${apiUrl("/api/v1/watches/watch_123/sync", base)}' \\\n+  -H 'Authorization: Bearer $PULLWISE_API_KEY' \\\n+  -H 'Idempotency-Key: github-facts-1' -H 'Content-Type: application/json' -d '{}'`;
  const nav = [["overview", "Overview"], ["authentication", "Authentication"],
    ["endpoints", "Endpoints"], ["items", "Saved items"], ["sync", "Manual fact sync"],
    ["availability", "Availability"], ["errors", "Errors and limits"]];
  async function copyPage() {
    try {
      await navigator.clipboard.writeText(markdown(base, itemExample, syncExample));
      setCopied(true);
    } catch { setCopied(false); }
  }
  return <div className="landing fade-in product-api-docs">
    <PublicHeader go={go} current="api" auth={auth} />
    <div className="docs-shell">
      <aside className="docs-side"><div className="docs-side-g">
        <div className="docs-side-h">API</div>
        {nav.map(([id, label]) => <a key={id} className="docs-side-i" href={`#${id}`}>{label}</a>)}
      </div></aside>
      <main className="docs-main">
        <div className="docs-crumbs"><a className="auth-link" {...screenLinkProps(go, "landing")}>Pullwise</a>
          <span className="sep">/</span><span className="now">API</span></div>
        <div className="docs-page-head"><h1 id="overview" className="docs-h1">Pullwise REST API</h1>
          <button className="btn sm" type="button" onClick={copyPage} data-copy-exclude>
            {copied ? <I.Check size={13} /> : <I.Copy size={13} />}{" "}
            {copied ? T("Copied", "已复制") : T("Copy Page", "复制页面")}
          </button></div>
        <p className="docs-lede">{T(
          "PR / CI / Updates contract preview. This product's Cloudflare Server is not deployed yet; confirm availability before integrating.",
          "PR / CI / Updates 接口预览。此产品的 Cloudflare Server 尚未部署；接入前请确认可用性。")}</p>
        <div className="docs-callout"><I.Shield size={16} /><div><b>{T("Current authority", "当前权限")}</b>
          <p>{T("Every read checks current account, key scope and resource permission. Revoked private content is hidden.",
            "每次读取都会核对账户、密钥范围和资源权限；已撤销的私有内容不会返回。")}</p></div></div>
        <h2 id="authentication" className="docs-h2">{T("Authentication", "认证")}</h2>
        <p>{T("Create a key in API Keys. Read scopes are the default; handling and manual sync need explicit write scopes.",
          "在 API Keys 中创建密钥。默认是只读权限；处理和手动同步需要显式写权限。")}</p>
        <DocsCode title={T("Base URL", "基础地址")}>{base}</DocsCode>
        <DocsCode title={T("Authorization headers", "认证请求头")}>{`Authorization: Bearer pwk_example\nX-Pullwise-Api-Key: pwk_example`}</DocsCode>
        <h2 id="endpoints" className="docs-h2">{T("Endpoints", "接口")}</h2>
        <div className="docs-endpoint-list">{ENDPOINTS.map(([method, path, scope, description]) =>
          <article key={`${method}-${path}`} className="docs-endpoint-card">
            <div className="docs-endpoint-card-h"><span className="docs-method">{method}</span><code>{path}</code></div>
            <p>{description}</p><span className="docs-scope">{T("Required scope", "所需权限")}: {scope}</span>
          </article>)}</div>
        <h2 id="items" className="docs-h2">{T("Saved items", "已保存事项")}</h2>
        <p>{T("Lists, overviews and evidence read saved results. GET never starts model processing.",
          "列表、概览和证据读取已保存结果。GET 不会启动模型处理。")}</p>
        <DocsCode title={T("Read current PR work", "读取当前 PR 事项")}>{itemExample}</DocsCode>
        <h2 id="sync" className="docs-h2">{T("Manual fact sync", "手动事实同步")}</h2>
        <p>{T("Manual sync only queues GitHub fact collection. Send {} and Idempotency-Key; a retry returns the saved response. It does not invoke Jev or spend intelligent-processing usage.",
          "手动同步只排队采集 GitHub 事实。发送 {} 和 Idempotency-Key；重试返回已保存响应，不调用 Jev 或消耗智能处理用量。")}</p>
        <DocsCode title={T("Sync watch facts", "同步 watch 事实")}>{syncExample}</DocsCode>
        <h2 id="availability" className="docs-h2">{T("Availability", "可用范围")}</h2>
        <p>{T("Repository listing/creation, watch creation, private/member sync, matrices and full timelines are not enabled on the Cloudflare Server candidate. Production GitHub ingestion and Jev remain disabled.",
          "Cloudflare Server 候选尚未启用仓库列表/创建、watch 创建、私有/成员同步、矩阵和完整时间线；生产 GitHub 接入与 Jev 仍关闭。")}</p>
        <h2 id="errors" className="docs-h2">{T("Errors and limits", "错误与限制")}</h2>
        <div className="docs-table">{[["401", "Session or API key required"], ["403", "Scope or Origin denied"],
          ["404", "Resource unavailable or no longer authorized"], ["409", "Idempotency conflict"],
          ["412", "Saved revision changed"], ["422", "Invalid filters"]].map(([code, description]) =>
          <div key={code} className="docs-table-r"><b>{code}</b><span>{description}</span></div>)}</div>
        <div className="docs-foot"><span className="muted">{T(
          "API routes are versioned under /api/v1. Availability depends on Server rollout.",
          "API 路由使用 /api/v1 前缀；可用性取决于 Server 发布进度。")}</span>
          <div className="docs-foot-actions"><a className="btn" {...screenLinkProps(go, "pricing")}>{T("Pricing", "价格")}</a>
            <a className="btn primary" {...screenLinkProps(go, "apiKeys")}>{T("API Keys", "API 密钥")}</a></div>
        </div>
      </main>
    </div>
    <PublicFooter go={go} current="api" />
  </div>;
}
