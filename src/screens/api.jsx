import { useEffect, useMemo, useState } from "react";
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
    workspaceName: textValue(record.workspaceName, record.workspace_name, record.workspace?.name),
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

function normalizeWorkspace(workspace = {}) {
  if (!objectRecord(workspace)) return null;
  return {
    ...workspace,
    id: textValue(workspace.id, workspace.workspaceId, workspace.workspace_id),
    name:
      textValue(workspace.name, workspace.githubOwnerLogin, workspace.github_owner_login) ||
      "Workspace",
    role: textValue(workspace.role) || "owner",
    githubOwnerLogin: textValue(workspace.githubOwnerLogin, workspace.github_owner_login),
  };
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

export function ApiDocsScreen({ go, auth }) {
  useLang();
  const endpoints = [
    ["GET", "/api/v1/repositories", "List authorized repositories with repoId and quota."],
    ["POST", "/api/v1/repositories/{repoId}/scans", "Start a scan for an authorized repo."],
    ["POST", "/api/v1/repositories/{repoId}/scans/stop", "Stop the active queued or running scan."],
    ["GET", "/api/v1/repositories/{repoId}/scans/current", "Read the current scan state."],
    ["GET", "/api/v1/repositories/{repoId}/quota", "Read remaining scan count."],
  ];

  return (
    <div className="landing fade-in">
      <MarketingHeader go={go} auth={auth} />
      <div className="docs-shell">
        <aside className="docs-side">
          <div className="docs-side-g">
            <div className="docs-side-h">API</div>
            {["Overview", "Authentication", "Repositories", "Scans", "Quota"].map((item) => (
              <a key={item} className="docs-side-i" href={`#${item.toLowerCase()}`}>
                {item}
              </a>
            ))}
          </div>
          <a className="btn" {...screenLinkProps(go, "apiKeys")}>
            <I.Code size={14} /> API Keys
          </a>
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
            Automate repository review from CI, internal tools, or workspace scripts with keys
            scoped to Pullwise workspace permissions for the signed-in user.
          </p>

          <div className="docs-callout">
            <I.Shield size={16} />
            <div>
              <b>Workspace-scoped access</b>
              <p>
                API keys inherit the creator workspace and repository authorization. A key can only
                read and scan repositories already authorized in Pullwise.
              </p>
            </div>
          </div>

          <h2 id="authentication" className="docs-h2">
            Authentication
          </h2>
          <p>Create a key from Dashboard / API Keys, then send it as a bearer token.</p>
          <DocsCode title="Authorization header">
            {`Authorization: Bearer pwk_live_example`}
          </DocsCode>

          <h2 id="repositories" className="docs-h2">
            Repositories
          </h2>
          <div className="docs-table">
            {endpoints.map(([method, path, description]) => (
              <div key={`${method}-${path}`} className="docs-table-r">
                <b>
                  {method} {path}
                </b>
                <span>{description}</span>
              </div>
            ))}
          </div>
          <DocsCode title="List authorized repositories">
            {`curl https://api.pullwise.dev/api/v1/repositories \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>

          <h2 id="scans" className="docs-h2">
            Scans
          </h2>
          <DocsCode title="Start and monitor a scan">
            {`curl -X POST https://api.pullwise.dev/api/v1/repositories/repo_123/scans \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"

curl https://api.pullwise.dev/api/v1/repositories/repo_123/scans/current \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>

          <h2 id="quota" className="docs-h2">
            Quota
          </h2>
          <p>
            Quota is reported per GitHub repository id and reflects the remaining workspace plan
            scan count.
          </p>
          <DocsCode title="Read remaining scan count">
            {`curl https://api.pullwise.dev/api/v1/repositories/repo_123/quota \\
  -H "Authorization: Bearer $PULLWISE_API_KEY"`}
          </DocsCode>

          <div className="docs-foot">
            <span className="muted">API routes are versioned under /api/v1.</span>
            <div className="docs-foot-actions">
              <a className="btn" {...screenLinkProps(go, "pricing")}>
                Pricing
              </a>
              <a className="btn primary" {...screenLinkProps(go, "apiKeys")}>
                API Keys
              </a>
            </div>
          </div>
        </main>

        <aside className="docs-toc">
          <div className="docs-toc-h">On this page</div>
          <a href="#authentication">Authentication</a>
          <a href="#repositories">Repositories</a>
          <a href="#scans">Scans</a>
          <a href="#quota">Quota</a>
        </aside>
      </div>
    </div>
  );
}

export function ApiKeysScreen({ go, setIssue = null }) {
  useLang();
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState("Workspace automation");
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

  const createKey = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending("create");
    setError("");
    setCreatedToken("");
    try {
      const payload = await pullwiseApi.apiKeys.create({ name: name.trim() || "API key" });
      const key = normalizeApiKey(createdApiKeyRecord(payload));
      const token = createdApiKeyToken(payload);
      if (!key) throw new Error("API key response was malformed.");
      setCreatedToken(token);
      setKeys((current) => [key, ...current.filter((item) => item.id !== key.id)]);
      setName("Workspace automation");
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
        breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: "API Keys" }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="apiKeys" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>API Keys</h1>
              <div className="sub">
                REST credentials for workspace-scoped repository scans and quota checks.
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
              <form className="bill-card billing-summary" onSubmit={createKey}>
                <div className="billing-summary-main" style={{ flex: 1 }}>
                  <I.Shield size={18} />
                  <label className="auth-field" style={{ flex: 1 }}>
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
                </div>
                <button className="btn primary" type="submit" disabled={pending === "create"}>
                  {pending === "create" && (
                    <span className="spin" style={{ display: "inline-block" }}>
                      <I.Refresh size={14} />
                    </span>
                  )}
                  <I.Plus size={14} /> Create key
                </button>
              </form>

              <div className="bill-card" style={{ display: "block" }}>
                <div className="docs-table">
                  <div className="docs-table-r">
                    <b>Permission model</b>
                    <span>
                      Keys inherit the creator Pullwise workspace role and authorized GitHub
                      repositories. Repo operations require the target repoId to belong to that
                      workspace.
                    </span>
                  </div>
                  <div className="docs-table-r">
                    <b>REST scopes</b>
                    <span>repositories:read, scans:write, scans:read, quota:read</span>
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
                        <span>{key.workspaceName || "Workspace"}</span>
                        <span className="tag">Created {formatDate(key.createdAt)}</span>
                        <span className="tag">Last used {formatDate(key.lastUsedAt)}</span>
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

export function WorkspacesScreen({ go, setIssue = null }) {
  useLang();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [name, setName] = useState("Pullwise workspace");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const sortedWorkspaces = useMemo(
    () =>
      [...workspaces].sort((a, b) => {
        if (a.id === currentWorkspace?.id) return -1;
        if (b.id === currentWorkspace?.id) return 1;
        return a.name.localeCompare(b.name);
      }),
    [workspaces, currentWorkspace]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await pullwiseApi.workspaces.list();
      setWorkspaces(
        itemsFrom(payload, "workspaces", "items").map(normalizeWorkspace).filter(Boolean)
      );
      setCurrentWorkspace(
        normalizeWorkspace(payload?.currentWorkspace || payload?.workspace || {})
      );
    } catch (err) {
      setError(err?.message || "Unable to load workspaces.");
      setWorkspaces([]);
      setCurrentWorkspace(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createWorkspace = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const payload = await pullwiseApi.workspaces.create({ name: name.trim() || "Workspace" });
      const workspace = normalizeWorkspace(payload?.workspace || payload);
      if (!workspace) throw new Error("Workspace response was malformed.");
      setWorkspaces((current) => [
        workspace,
        ...current.filter((item) => item.id !== workspace.id),
      ]);
      setCurrentWorkspace(workspace);
      setName("Pullwise workspace");
    } catch (err) {
      setError(err?.message || "Unable to create workspace.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: "Workspaces" }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="workspaces" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>Workspaces</h1>
              <div className="sub">
                Create and manage the Pullwise workspace that owns repos, billing, and API keys.
              </div>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
              <I.X size={13} /> {error}
            </div>
          )}

          <div className="set-shell">
            <aside className="set-side">
              <button className="set-side-i active">
                <I.Layers size={14} />
                <span>Workspaces</span>
              </button>
              <a className="set-side-i" {...screenLinkProps(go, "repos")}>
                <I.Folder size={14} />
                <span>Repositories</span>
              </a>
            </aside>

            <div className="set-body">
              <form className="bill-card billing-summary" onSubmit={createWorkspace}>
                <div className="billing-summary-main" style={{ flex: 1 }}>
                  <I.Plus size={18} />
                  <label className="auth-field" style={{ flex: 1 }}>
                    <span>Workspace name</span>
                    <div className="auth-input">
                      <I.Layers size={14} />
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Acme Engineering"
                      />
                    </div>
                  </label>
                </div>
                <button className="btn primary" type="submit" disabled={pending}>
                  {pending && (
                    <span className="spin" style={{ display: "inline-block" }}>
                      <I.Refresh size={14} />
                    </span>
                  )}
                  <I.Plus size={14} /> Create workspace
                </button>
              </form>

              <div className="issue-list">
                {sortedWorkspaces.map((workspace) => (
                  <div key={workspace.id || workspace.name} className="issue-row">
                    <div className="issue-sev sev-bg-info">
                      <I.Layers size={12} /> ws
                    </div>
                    <div className="issue-id">{workspace.id || "-"}</div>
                    <div className="issue-main">
                      <div className="issue-t">{workspace.name}</div>
                      <div className="issue-meta">
                        {workspace.githubOwnerLogin && <span>{workspace.githubOwnerLogin}</span>}
                        <span className="tag">{workspace.role}</span>
                        {workspace.id === currentWorkspace?.id && (
                          <span className="tag">Current</span>
                        )}
                      </div>
                    </div>
                    <a className="btn sm" {...screenLinkProps(go, "repos")}>
                      <I.Folder size={13} /> Repos
                    </a>
                  </div>
                ))}
                {!loading && sortedWorkspaces.length === 0 && (
                  <div className="card section muted">No workspaces have been created yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
