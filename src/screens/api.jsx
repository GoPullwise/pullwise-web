import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createLedgerApi } from "../api/ledger.js";
import { pullwiseApi } from "../api/pullwise.js";
import { ConfirmDialog } from "../components/confirm-dialog.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { useErrorNotification } from "../components/notifications.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { API_KEY_SCOPES, API_KEY_SCOPE_VALUES, DEFAULT_SCOPE_VALUES } from "./ledger-api-scopes.js";
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

function workspaceScopeValues(workspace) {
  if (!workspace) return API_KEY_SCOPE_VALUES;
  const permissions = workspace.permissions || {};
  const requiredPermission = {
    "projects:write": "manageProjects",
    "categories:write": "manageCategories",
    "expenses:write": "writeExpenses",
    "suggestions:use": "writeExpenses",
  };
  return API_KEY_SCOPE_VALUES.filter(
    (scope) =>
      (!requiredPermission[scope] || permissions[requiredPermission[scope]] === true) &&
      (!Array.isArray(workspace.scopes) || workspace.scopes.includes(scope))
  );
}

const emptyProjectPage = () => ({ items: [], nextCursor: null, loaded: false });

function projectChoices(payload) {
  if (
    !Array.isArray(payload?.items) ||
    (payload.nextCursor !== null && typeof payload.nextCursor !== "string") ||
    payload.items.some(
      (project) =>
        !objectRecord(project) ||
        typeof project.id !== "string" ||
        !/^prj_[A-Za-z0-9_-]{1,100}$/.test(project.id)
    )
  ) {
    throw new Error(T("Project list response was malformed.", "项目列表响应格式错误。"));
  }
  return {
    items: payload.items.map((project) => {
      const repository = textValue(
        Array.isArray(project.repositories)
          ? project.repositories.find((repo) => repo?.githubAccess === "authorized")?.githubFullName
          : null,
        project.githubAccess === "authorized" ? project.githubFullName : null
      );
      return {
        id: project.id,
        label: textValue(project.name, repository, project.description) || T("Project history"),
        description: textValue(project.description),
        repository,
        archived: project.status === "archived",
      };
    }),
    nextCursor: payload.nextCursor || null,
  };
}

function ApiKeysSkeleton() {
  return (
    <div className="set-body api-keys-skeleton" aria-busy="true">
      <div className="panel api-key-create">
        <div className="panel-h">
          <SkeletonLine className="sk-square sk-size-16" />
          <SkeletonLine className="sk-line sk-w-30 sk-h-16" />
        </div>
        <div className="api-key-create-main">
          <SkeletonLine className="sk-line sk-w-65" />
          <SkeletonLine className="sk-line sk-w-60 sk-h-40" />
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
          <div className="api-scope-panel">
            <div className="api-scope-head">
              <SkeletonLine className="sk-line sk-w-30 sk-h-16" />
            </div>
            {Array.from({ length: 2 }, (_, index) => (
              <div className="api-scope-row" key={`api-target-skeleton-${index}`}>
                <SkeletonLine className="sk-square sk-size-16" />
                <SkeletonLine className="sk-line sk-w-65" />
              </div>
            ))}
          </div>
          <SkeletonLine className="sk-line sk-w-22 sk-h-40" />
        </div>
      </div>

      <section className="panel">
        <div className="panel-h">
          <SkeletonLine className="sk-square sk-size-16" />
          <SkeletonLine className="sk-line sk-w-30 sk-h-16" />
        </div>
        <div className="key-list">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="key-row skeleton-row" key={`api-key-row-skeleton-${index}`}>
              <SkeletonLine className="sk-line sk-w-12 sk-h-22" />
              <SkeletonLine className="sk-line sk-w-16" />
              <div className="key-main">
                <SkeletonLine className="sk-line sk-w-45 sk-h-16" />
                <div className="key-meta">
                  <SkeletonLine className="sk-line sk-w-26" />
                  <SkeletonLine className="sk-line sk-w-24" />
                  <SkeletonLine className="sk-line sk-w-18" />
                </div>
              </div>
              <SkeletonLine className="sk-line sk-w-18 sk-h-28" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ApiKeysLoadError({ error, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <div className="panel-h">
        <I.X size={16} aria-hidden="true" />
        <h2>{T("API keys are unavailable", "API keys are unavailable")}</h2>
      </div>
      <p>{error || T("Unable to load API keys.", "Unable to load API keys.")}</p>
      <button type="button" className="btn" onClick={onRetry}>
        <I.Refresh size={13} /> {T("Retry", "Retry")}
      </button>
    </div>
  );
}

export function ApiKeysScreen({ go, workspace = null, onAccessChanged }) {
  useLang();
  const allowedScopeValues = workspaceScopeValues(workspace);
  const workspaceId = workspace?.id;
  const memberRevision = workspace?.memberRevision ?? workspace?.revision;
  const scopeKey = JSON.stringify([
    workspaceId || "personal",
    workspace?.revision,
    memberRevision,
    workspace?.permissionsRevision,
    workspace?.authorizationRevision,
    workspace?.permissions,
    allowedScopeValues,
  ]);
  const scopeValuesKey = allowedScopeValues.join(",");
  const defaultScopes = useMemo(
    () => DEFAULT_SCOPE_VALUES.filter((scope) => scopeValuesKey.split(",").includes(scope)),
    [scopeValuesKey]
  );
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState(T("Account automation", "账户自动化"));
  const [selectedScopes, setSelectedScopes] = useState(defaultScopes);
  const [restrictProjects, setRestrictProjects] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [projectPage, setProjectPage] = useState(emptyProjectPage);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [projectRetryCursor, setProjectRetryCursor] = useState(null);
  const [projectPaginationBlocked, setProjectPaginationBlocked] = useState(false);
  const [allowShared, setAllowShared] = useState(false);
  const [createdCredential, setCreatedCredential] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [renderedScope, setRenderedScope] = useState(scopeKey);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [revokeTarget, setRevokeTarget] = useState(null);
  const mutationInFlightRef = useRef(null);
  const mountedRef = useRef(false);
  const activeScopeRef = useRef(scopeKey);
  const readControllerRef = useRef(null);
  const readRequestRef = useRef(0);
  const projectReadControllerRef = useRef(null);
  const projectReadRequestRef = useRef(0);
  const projectCursorHistoryRef = useRef(new Set());
  const projectSearchRef = useRef(null);
  const projectSearchId = useId();
  const accessChangedRef = useRef(onAccessChanged);
  const revokeBackgroundRef = useRef(null);
  activeScopeRef.current = scopeKey;
  accessChangedRef.current = onAccessChanged;
  const currentScope = renderedScope === scopeKey;
  const projectApi = useMemo(() => createLedgerApi(workspaceId), [workspaceId]);
  const matchingProjects = projectPage.items.filter((project) =>
    [project.label, project.description, project.repository]
      .join(" ")
      .toLowerCase()
      .includes(projectQuery.trim().toLowerCase())
  );
  useErrorNotification(currentScope ? error : "", {
    title: T("API key error", "API key error"),
    key: `api-keys:${scopeKey}:${error}`,
  });

  const handleAccessFailure = useCallback((failure) => {
    if (
      failure?.status !== 403 &&
      failure?.status !== 404 &&
      ![
        "ROLE_FORBIDDEN",
        "AUTHORIZATION_CHANGED",
        "WORKSPACE_MEMBERSHIP_CHANGED",
        "WORKSPACE_NOT_FOUND",
        "WORKSPACE_FORBIDDEN",
      ].includes(failure?.code || failure?.payload?.error?.code)
    )
      return;
    setKeys([]);
    setCreatedCredential(null);
    setRevokeTarget(null);
    setLoadedOnce(false);
    setError(failure?.message || T("Unable to load API keys.", "无法加载 API key。"));
    setProjectPage(emptyProjectPage());
    setSelectedProjectIds([]);
    setProjectQuery("");
    readControllerRef.current?.abort();
    readRequestRef.current += 1;
    setLoading(false);
    projectReadControllerRef.current?.abort();
    projectReadRequestRef.current += 1;
    projectReadControllerRef.current = null;
    setProjectLoading(false);
    accessChangedRef.current?.(failure);
  }, []);

  const load = useCallback(async () => {
    if (!mountedRef.current || activeScopeRef.current !== scopeKey) return;
    readControllerRef.current?.abort();
    const controller = new AbortController();
    readControllerRef.current = controller;
    const request = ++readRequestRef.current;
    const current = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      activeScopeRef.current === scopeKey &&
      request === readRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const payload = await pullwiseApi.apiKeys.list(workspaceId ? { workspaceId } : {}, {
        signal: controller.signal,
      });
      if (!current()) return;
      setKeys(itemsFrom(payload, "apiKeys", "keys", "items").map(normalizeApiKey).filter(Boolean));
      setLoadedOnce(true);
    } catch (err) {
      if (!current()) return;
      handleAccessFailure(err);
      setError(err?.message || T("Unable to load API keys.", "无法加载 API key。"));
    } finally {
      if (current()) setLoading(false);
    }
  }, [scopeKey, workspaceId, handleAccessFailure]);

  const loadProjects = async (cursor = null) => {
    if (
      !mountedRef.current ||
      activeScopeRef.current !== scopeKey ||
      projectReadControllerRef.current
    )
      return;
    const controller = new AbortController();
    projectReadControllerRef.current = controller;
    const request = ++projectReadRequestRef.current;
    const current = () =>
      mountedRef.current &&
      !controller.signal.aborted &&
      activeScopeRef.current === scopeKey &&
      request === projectReadRequestRef.current;
    setProjectLoading(true);
    setProjectError("");
    setProjectRetryCursor(cursor);
    setProjectPaginationBlocked(false);
    if (!cursor) {
      setProjectPage(emptyProjectPage());
      setSelectedProjectIds([]);
      projectCursorHistoryRef.current = new Set();
    }
    try {
      const payload = await projectApi.projects(
        { limit: 50, ...(cursor ? { cursor } : {}) },
        { signal: controller.signal }
      );
      if (!current()) return;
      const next = projectChoices(payload);
      const loadedIds = new Set(projectPage.items.map((project) => project.id));
      if (
        next.nextCursor &&
        (next.nextCursor === cursor ||
          projectCursorHistoryRef.current.has(next.nextCursor) ||
          next.items.length === 0 ||
          (cursor && next.items.every((project) => loadedIds.has(project.id))))
      ) {
        setProjectPaginationBlocked(true);
        throw new Error(T("Pagination did not advance. Reload to retry."));
      }
      if (cursor) projectCursorHistoryRef.current.add(cursor);
      setProjectPage((previous) => {
        const items = cursor ? previous.items : [];
        const seen = new Set(items.map((project) => project.id));
        return {
          items: [
            ...items,
            ...next.items.filter((project) => {
              if (seen.has(project.id)) return false;
              seen.add(project.id);
              return true;
            }),
          ],
          nextCursor: next.nextCursor,
          loaded: true,
        };
      });
    } catch (failure) {
      if (!current()) return;
      handleAccessFailure(failure);
      setProjectError(failure?.message || T("Unable to load projects.", "无法加载项目。"));
    } finally {
      if (current()) setProjectLoading(false);
      if (projectReadControllerRef.current === controller) projectReadControllerRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    mutationInFlightRef.current = null;
    setRenderedScope(scopeKey);
    setKeys([]);
    setCreatedCredential(null);
    setRevokeTarget(null);
    setLoadedOnce(false);
    setPending("");
    setName(T("Account automation", "账户自动化"));
    setSelectedScopes(defaultScopes);
    setRestrictProjects(false);
    setSelectedProjectIds([]);
    setProjectPage(emptyProjectPage());
    setProjectQuery("");
    setProjectLoading(false);
    setProjectError("");
    setProjectRetryCursor(null);
    setProjectPaginationBlocked(false);
    projectCursorHistoryRef.current = new Set();
    setAllowShared(false);
    load();
    return () => {
      mountedRef.current = false;
      readRequestRef.current += 1;
      readControllerRef.current?.abort();
      projectReadRequestRef.current += 1;
      projectReadControllerRef.current?.abort();
      projectReadControllerRef.current = null;
      mutationInFlightRef.current = null;
    };
  }, [scopeKey, load, defaultScopes]);

  const toggleScope = (scopeValue) => {
    if (!allowedScopeValues.includes(scopeValue)) return;
    setSelectedScopes((current) => {
      const next = current.includes(scopeValue)
        ? current.filter((scope) => scope !== scopeValue)
        : [...current, scopeValue];
      return allowedScopeValues.filter((scope) => next.includes(scope));
    });
  };

  const toggleProjectRestriction = (checked) => {
    setRestrictProjects(checked);
    if (checked) {
      if (!projectPage.loaded) loadProjects();
    } else {
      projectReadControllerRef.current?.abort();
      projectReadRequestRef.current += 1;
      projectReadControllerRef.current = null;
      setProjectLoading(false);
    }
  };

  const toggleProject = (projectId) => {
    if (!currentScope || !projectPage.items.some((project) => project.id === projectId)) return;
    setSelectedProjectIds((selected) => {
      if (selected.includes(projectId)) return selected.filter((id) => id !== projectId);
      return selected.length < 100 ? [...selected, projectId] : selected;
    });
  };

  const createKey = async (event) => {
    event.preventDefault();
    if (
      !currentScope ||
      mutationInFlightRef.current ||
      loading ||
      !loadedOnce ||
      !allowedScopeValues.length
    )
      return;
    if (restrictProjects && (!projectPage.loaded || projectLoading || projectError)) {
      setError(
        T(
          "Load or retry the project list before creating a restricted key.",
          "请先加载或重试项目列表，再创建受限密钥。"
        )
      );
      return;
    }
    const mutation = {};
    mutationInFlightRef.current = mutation;
    const current = () =>
      mountedRef.current &&
      activeScopeRef.current === scopeKey &&
      mutationInFlightRef.current === mutation;
    setPending("create");
    setError("");
    setCreatedCredential(null);
    try {
      const scopes = allowedScopeValues.filter((scope) => selectedScopes.includes(scope));
      const projectIds = [...new Set(selectedProjectIds)];
      if (
        restrictProjects &&
        (projectIds.length > 100 ||
          projectIds.some((id) => !projectPage.items.some((project) => project.id === id)))
      ) {
        throw new Error(
          T(
            "Some selected projects are no longer available. Choose projects again.",
            "部分已选项目已不可用，请重新选择项目。"
          )
        );
      }
      const payload = await pullwiseApi.apiKeys.create({
        name: name.trim() || T("API key", "API 密钥"),
        scopes,
        restrictions: {
          shared: allowShared,
          ...(workspaceId ? { workspaceId, workspaceMemberRevision: memberRevision } : {}),
          ...(restrictProjects ? { projectIds } : {}),
        },
      });
      if (!current()) return;
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
      setSelectedScopes(defaultScopes);
      setRestrictProjects(false);
      setSelectedProjectIds([]);
      setProjectQuery("");
      setAllowShared(false);
    } catch (err) {
      if (!current()) return;
      handleAccessFailure(err);
      setError(err?.message || T("Unable to create API key.", "无法创建 API key。"));
    } finally {
      if (current()) {
        mutationInFlightRef.current = null;
        setPending("");
      }
    }
  };

  const revokeKey = async (keyId) => {
    if (!currentScope || !keyId || mutationInFlightRef.current) return;
    const mutation = {};
    mutationInFlightRef.current = mutation;
    const current = () =>
      mountedRef.current &&
      activeScopeRef.current === scopeKey &&
      mutationInFlightRef.current === mutation;
    setPending(keyId);
    setError("");
    try {
      await pullwiseApi.apiKeys.revoke(keyId);
      if (!current()) return;
      setKeys((current) => current.filter((key) => key.id !== keyId));
      setCreatedCredential((current) => (current?.keyId === keyId ? null : current));
    } catch (err) {
      if (!current()) return;
      handleAccessFailure(err);
      setError(err?.message || T("Unable to revoke API key.", "无法吊销 API key。"));
    } finally {
      if (current()) {
        mutationInFlightRef.current = null;
        setPending("");
        setRevokeTarget(null);
      }
    }
  };

  const requestRevokeKey = (key) => {
    if (!currentScope || !key?.id || mutationInFlightRef.current || pending) return;
    setRevokeTarget(key);
  };

  const copyToken = async () => {
    if (!currentScope || !createdCredential?.token) return;
    const credential = createdCredential;
    const current = () => mountedRef.current && activeScopeRef.current === scopeKey;
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
      await navigator.clipboard.writeText(credential.token);
    } catch {
      if (!current()) return;
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
          loading={loading || !currentScope}
        />
        <div className="with-side">
          <Sidebar section="apiKeys" go={go} />
          <div className="main" role="main">
            <div className="page-h">
              <div>
                <h1>{T("API Keys", "API 密钥")}</h1>
                <div className="sub">
                  {T(
                    "Scoped REST credentials for projects, expenses and reports.",
                    "用于项目、支出和报表的分范围 REST 凭据。"
                  )}
                </div>
              </div>
              <div className="actions">
                <a className="btn" {...screenLinkProps(go, "api")}>
                  <I.FileCode size={14} /> {T("API docs", "API 文档")}
                </a>
              </div>
            </div>

            {currentScope && createdCredential?.token && (
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

              {loading || !currentScope ? (
                <ApiKeysSkeleton />
              ) : error && !loadedOnce ? (
                <ApiKeysLoadError error={error} onRetry={load} />
              ) : (
                <div className="set-body">
                  {error && (
                    <div className="notice notice-error" role="status" aria-live="polite">
                      <p>{error}</p>
                      <button type="button" className="btn sm" onClick={load}>
                        <I.Refresh size={12} /> {T("Retry", "Retry")}
                      </button>
                    </div>
                  )}
                  <form className="api-key-create panel" onSubmit={createKey}>
                    <div className="panel-h">
                      <I.Shield size={16} />
                      <h2>{T("Create API key", "创建 API 密钥")}</h2>
                    </div>
                    <div className="api-key-create-main">
                      <p className="muted">
                        {T(
                          "Name the key, choose scopes, then create the token.",
                          "为密钥命名，选择权限范围，然后创建令牌。"
                        )}
                      </p>
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
                            {
                              selectedScopes.filter((scope) => allowedScopeValues.includes(scope))
                                .length
                            }{" "}
                            / {allowedScopeValues.length} {T("selected", "已选择")}
                          </span>
                        </div>
                        <div className="api-scope-list">
                          {API_KEY_SCOPES.filter((scope) =>
                            allowedScopeValues.includes(scope.value)
                          ).map((scope) => {
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
                      <fieldset className="api-scope-panel">
                        <legend className="api-scope-legend">
                          {T("Ledger targets", "账本目标")}
                        </legend>
                        <div className="api-scope-head">
                          <span className="api-scope-kicker">
                            <I.Layout size={13} /> {T("Ledger targets", "账本目标")}
                          </span>
                        </div>
                        <label className="api-scope-row">
                          <input
                            type="checkbox"
                            checked={restrictProjects}
                            disabled={Boolean(pending)}
                            onChange={(event) => toggleProjectRestriction(event.target.checked)}
                          />
                          {T("Limit to selected projects", "仅允许所选项目")}
                        </label>
                        {restrictProjects && (
                          <details className="disclosure api-project-picker" open>
                            <summary>
                              <I.Folder size={14} aria-hidden="true" />
                              {T("Choose projects", "选择项目")}
                              <span className="tag" aria-label={T("Selected projects", "已选项目")}>
                                {selectedProjectIds.length} / 100
                              </span>
                            </summary>
                            <div className="api-project-picker-body" aria-busy={projectLoading}>
                              <div className="auth-field">
                                <label htmlFor={projectSearchId}>
                                  {T("Find a project", "查找项目")}
                                </label>
                                <div className="auth-input">
                                  <I.Search size={14} aria-hidden="true" />
                                  <input
                                    ref={projectSearchRef}
                                    id={projectSearchId}
                                    type="search"
                                    value={projectQuery}
                                    disabled={Boolean(pending)}
                                    placeholder={T("Find a project", "查找项目")}
                                    onChange={(event) => setProjectQuery(event.target.value)}
                                  />
                                  {projectQuery && (
                                    <button
                                      className="btn ghost sm"
                                      type="button"
                                      disabled={Boolean(pending)}
                                      aria-label={T("Clear search", "清除搜索")}
                                      title={T("Clear search", "清除搜索")}
                                      onClick={() => {
                                        setProjectQuery("");
                                        projectSearchRef.current?.focus({ preventScroll: true });
                                      }}
                                    >
                                      <I.X size={14} aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="muted">
                                {T("Choose up to 100 projects.", "最多选择 100 个项目。")}
                              </p>
                              {projectLoading && (
                                <p role="status">{T("Loading projects…", "正在加载项目…")}</p>
                              )}
                              {projectError && (
                                <div className="notice notice-error" role="alert">
                                  <p>{projectError}</p>
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={projectLoading || Boolean(pending)}
                                    onClick={() =>
                                      loadProjects(
                                        projectPaginationBlocked ? null : projectRetryCursor
                                      )
                                    }
                                  >
                                    <I.Refresh size={13} aria-hidden="true" />
                                    {projectPaginationBlocked
                                      ? T("Reload projects", "重新加载项目")
                                      : T("Retry projects", "重试项目列表")}
                                  </button>
                                </div>
                              )}
                              {matchingProjects.length > 0 && (
                                <div className="api-scope-list">
                                  {matchingProjects.map((project) => {
                                    const checked = selectedProjectIds.includes(project.id);
                                    return (
                                      <label
                                        key={project.id}
                                        className={"api-scope-row" + (checked ? " selected" : "")}
                                      >
                                        <input
                                          type="checkbox"
                                          aria-label={project.label}
                                          checked={checked}
                                          disabled={
                                            Boolean(pending) ||
                                            (!checked && selectedProjectIds.length >= 100)
                                          }
                                          onChange={() => toggleProject(project.id)}
                                        />
                                        <span className="api-scope-copy">
                                          <b>{project.label}</b>
                                          {project.description &&
                                            project.description !== project.label && (
                                              <span>{project.description}</span>
                                            )}
                                          {project.repository &&
                                            project.repository !== project.label && (
                                              <span>{project.repository}</span>
                                            )}
                                        </span>
                                        {project.archived && (
                                          <span className="api-scope-value">
                                            {T("Archived", "已归档")}
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                              {projectPage.loaded &&
                                !projectLoading &&
                                !projectError &&
                                matchingProjects.length === 0 && (
                                  <div className="empty">
                                    <I.Folder size={24} aria-hidden="true" />
                                    <h3>
                                      {projectPage.items.length
                                        ? T("No matching projects", "没有匹配的项目")
                                        : T("No projects in this ledger", "此账本中暂无项目")}
                                    </h3>
                                    <p>
                                      {projectPage.items.length
                                        ? T(
                                            "Try another name or load more projects.",
                                            "换个名称搜索，或加载更多项目。"
                                          )
                                        : T(
                                            "Create a project to make it available here.",
                                            "创建项目后即可在此选择。"
                                          )}
                                    </p>
                                    {!projectPage.items.length && (
                                      <a className="btn" {...screenLinkProps(go, "ledgerProjects")}>
                                        {T("Your projects", "你的项目")}
                                      </a>
                                    )}
                                  </div>
                                )}
                              {projectPage.nextCursor && !projectError && (
                                <div className="panel-actions">
                                  <button
                                    className="btn"
                                    type="button"
                                    disabled={projectLoading || Boolean(pending)}
                                    onClick={() => loadProjects(projectPage.nextCursor)}
                                  >
                                    {T("Load more projects", "加载更多项目")}
                                  </button>
                                </div>
                              )}
                              <p role="status" className="muted">
                                {selectedProjectIds.length === 0
                                  ? T(
                                      "No projects selected. This key cannot access any project.",
                                      "未选择项目，此密钥无法访问任何项目。"
                                    )
                                  : T(
                                      "Only the selected projects are allowed. The shared pool is controlled separately.",
                                      "仅允许访问所选项目，公共池权限单独设置。"
                                    )}
                              </p>
                            </div>
                          </details>
                        )}
                        {!restrictProjects && (
                          <p>
                            {T(
                              "All projects in this ledger are allowed.",
                              "允许访问此账本中的所有项目。"
                            )}
                          </p>
                        )}
                        <label className="api-scope-row">
                          <input
                            type="checkbox"
                            checked={allowShared}
                            disabled={Boolean(pending)}
                            onChange={(event) => setAllowShared(event.target.checked)}
                          />
                          {T("Allow shared expense pool", "允许访问公共池")}
                        </label>
                        <p>
                          {T(
                            "Project restrictions never grant access to another account or to the shared pool. An empty project list permits no projects.",
                            "项目限制不会授予其他账户或公共池权限。空项目列表代表不允许任何项目。"
                          )}
                        </p>
                      </fieldset>
                      <div className="panel-actions">
                        <button
                          className="btn primary"
                          type="submit"
                          disabled={
                            Boolean(pending) ||
                            !allowedScopeValues.length ||
                            (restrictProjects &&
                              (!projectPage.loaded || projectLoading || Boolean(projectError)))
                          }
                        >
                          {pending === "create" && (
                            <span className="spin">
                              <I.Refresh size={14} />
                            </span>
                          )}
                          <I.Plus size={14} /> {T("Create key", "创建密钥")}
                        </button>
                      </div>
                    </div>
                  </form>

                  <section className="panel">
                    <div className="panel-h">
                      <I.Code size={16} />
                      <h2>{T("Keys", "密钥")}</h2>
                      <span className="count">{keys.length}</span>
                    </div>
                    <div className="key-list">
                      {keys.map((key) => (
                        <div key={key.id || key.prefix || key.name} className="key-row">
                          <div className="key-sev sev-bg-info">
                            <I.Code size={12} /> {T("key", "key")}
                          </div>
                          <div className="key-id">{key.prefix || key.id || "-"}</div>
                          <div className="key-main">
                            <div className="key-t">{key.name}</div>
                            <div className="key-meta">
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
                            disabled={Boolean(pending)}
                            onClick={() => requestRevokeKey(key)}
                          >
                            <I.X size={13} /> {T("Revoke", "吊销")}
                          </button>
                        </div>
                      ))}
                      {!loading && keys.length === 0 && (
                        <div className="empty">
                          <I.Code size={28} />
                          <h3>
                            {T("No API keys have been created yet.", "尚未创建任何 API 密钥。")}
                          </h3>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={currentScope && Boolean(revokeTarget)}
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
