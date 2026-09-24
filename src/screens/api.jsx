import { useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { ConfirmDialog } from "../components/confirm-dialog.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { useErrorNotification } from "../components/notifications.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { API_KEY_SCOPES, API_KEY_SCOPE_VALUES, DEFAULT_SCOPE_VALUES } from "./product-api-scopes.js";
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

function ApiKeysLoadError({ error, onRetry }) {
  return (
    <div className="card section api-keys-load-error" role="alert">
      <I.X size={15} aria-hidden="true" />
      <div>
        <b>{T("API keys are unavailable", "API keys are unavailable")}</b>
        <span>{error || T("Unable to load API keys.", "Unable to load API keys.")}</span>
      </div>
      <button type="button" className="btn" onClick={onRetry}>
        <I.Refresh size={13} /> {T("Retry", "Retry")}
      </button>
    </div>
  );
}

export function ApiKeysScreen({ go, setIssue = null }) {
  useLang();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState(T("Account automation", "账户自动化"));
  const [selectedScopes, setSelectedScopes] = useState(DEFAULT_SCOPE_VALUES);
  const [createdCredential, setCreatedCredential] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState(null);
  const mutationInFlightRef = useRef(false);
  const revokeBackgroundRef = useRef(null);
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
      setLoadedOnce(true);
    } catch (err) {
      setError(err?.message || T("Unable to load API keys.", "无法加载 API key。"));
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
    setCreatedCredential(null);
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
      setCreatedCredential({ keyId: key.id, token });
      setName(T("Account automation", "账户自动化"));
      setSelectedScopes(DEFAULT_SCOPE_VALUES);
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
      setCreatedCredential((current) => (current?.keyId === keyId ? null : current));
    } catch (err) {
      setError(err?.message || T("Unable to revoke API key.", "无法吊销 API key。"));
    } finally {
      mutationInFlightRef.current = false;
      setPending("");
      setRevokeTarget(null);
    }
  };

  const requestRevokeKey = (key) => {
    if (!key?.id || mutationInFlightRef.current || pending) return;
    setRevokeTarget(key);
  };

  const copyToken = async () => {
    if (!createdCredential?.token) return;
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
      await navigator.clipboard.writeText(createdCredential.token);
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
      <div ref={revokeBackgroundRef} className="api-keys-background">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("API Keys", "API 密钥") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="apiKeys" go={go} />
        <div className="main wide" role="main">
          <div className="page-h">
            <div>
              <h1>{T("API Keys", "API 密钥")}</h1>
              <div className="sub">
                {T(
                  "REST credentials for saved PR, CI and Updates results, handling and fact sync.",
                  "用于读取 PR、CI、Updates 保存结果，以及处理事项和同步事实的 REST 凭据。"
                )}
              </div>
            </div>
            <div className="actions">
              <a className="btn" {...screenLinkProps(go, "api")}>
                <I.FileCode size={14} /> {T("API docs", "API 文档")}
              </a>
            </div>
          </div>

          {createdCredential?.token && (
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
                  <pre>{createdCredential.token}</pre>
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
            ) : error && !loadedOnce ? (
              <ApiKeysLoadError error={error} onRetry={load} />
            ) : (
              <div className="set-body">
                {error && (
                  <div className="api-keys-inline-error" role="status" aria-live="polite">
                    <span>{error}</span>
                    <button type="button" className="btn sm" onClick={load}>
                      <I.Refresh size={12} /> {T("Retry", "Retry")}
                    </button>
                  </div>
                )}
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
                            placeholder={T("Automation key", "自动化密钥")}
                          />
                        </div>
                      </label>
                      <button className="btn primary" type="submit" disabled={pending === "create"}>
                        {pending === "create" && (
                          <span className="spin">
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
                        onClick={() => requestRevokeKey(key)}
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
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title={T("Revoke API key?", "Revoke API key?")}
        description={T(
          "This permanently invalidates the selected API key. Any client using it will stop working.",
          "This permanently invalidates the selected API key. Any client using it will stop working."
        )}
        confirmLabel={T("Confirm revoke", "Confirm revoke")}
        cancelLabel={T("Cancel", "Cancel")}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => revokeKey(revokeTarget?.id)}
        busy={Boolean(revokeTarget && pending === revokeTarget.id)}
        danger
        backgroundRef={revokeBackgroundRef}
        dialogId="revoke-api-key"
      />
    </div>
  );
}
