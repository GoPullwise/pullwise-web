import { useEffect, useMemo, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

function itemsFrom(payload, ...keys) {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

function textValue(value, fallback = "") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).replaceAll("\x00", "").split(/\r?\n|\r/, 1)[0].trim();
}

function statusLabel(status) {
  const value = textValue(status, "unknown");
  return value.replace(/^\w/, (char) => char.toUpperCase());
}

function timestampDate(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
}

function formatTimestamp(value) {
  const date = timestampDate(value);
  if (!date) return T("Never", "从未");
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function quotaPercentValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function formatQuotaPercent(value) {
  const number = quotaPercentValue(value);
  if (number === null) return T("Unavailable", "不可用");
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}

function quotaWindowLabel(window) {
  const kind = textValue(window?.windowKind || window?.window_kind).toLowerCase();
  if (kind === "five_hour") return "5 hour";
  if (kind === "weekly") return "Weekly";
  return textValue(window?.label || window?.name, T("Quota window", "配额窗口"));
}

function quotaResetLabel(value) {
  return formatTimestamp(value);
}

function quotaStatusClass(status) {
  const normalized = textValue(status, "unknown").toLowerCase();
  if (["low", "exhausted"].includes(normalized)) return normalized;
  if (normalized === "ok") return "ok";
  return "unknown";
}

function workerCodexQuota(worker) {
  return objectValue(worker?.codexQuota) || objectValue(worker?.codex_quota);
}

function defaultWorkerVersionFromPayload(payload) {
  return textValue(
    payload?.workerVersion ||
      payload?.latestWorkerVersion ||
      payload?.release?.latestVersion ||
      payload?.version ||
      payload?.defaults?.version
  );
}

function WorkerQuotaPanel({ quota }) {
  if (!quota) return null;
  const status = textValue(quota.status, quota.ready === false ? "not ready" : "unknown");
  const statusClass = quotaStatusClass(status);
  const windows = Array.isArray(quota.windows) ? quota.windows.filter(Boolean) : [];
  const resetCredits = objectValue(quota.rateLimitResetCredits)?.availableCount;

  return (
    <section className="private-worker-quota" aria-label={T("Codex quota", "Codex 配额")}>
      <div className="private-worker-quota-head">
        <span>{T("Codex quota", "Codex 配额")}</span>
        <b className={`private-worker-quota-status ${statusClass}`}>{statusLabel(status)}</b>
      </div>
      <div className="private-worker-quota-facts">
        <div>
          <span>{T("Plan", "套餐")}</span>
          <b>{textValue(quota.planType, T("Unavailable", "不可用"))}</b>
        </div>
        <div>
          <span>{T("Remaining", "剩余")}</span>
          <b>{formatQuotaPercent(quota.remainingPercent)}</b>
        </div>
        <div>
          <span>{T("Reset credits", "重置额度")}</span>
          <b>{resetCredits ?? T("Unavailable", "不可用")}</b>
        </div>
        <div>
          <span>{T("Checked", "检查时间")}</span>
          <b>{quotaResetLabel(quota.checkedAt)}</b>
        </div>
      </div>
      {quota.rateLimitReachedType && (
        <p className="private-worker-quota-note">
          {T("Rate limit reached", "触发速率限制")}: {textValue(quota.rateLimitReachedType)}
        </p>
      )}
      {windows.length > 0 && (
        <div className="private-worker-quota-windows">
          {windows.map((window, index) => {
            const label = quotaWindowLabel(window);
            const remaining = quotaPercentValue(window.remainingPercent ?? window.remaining_percent);
            return (
              <div className="private-worker-quota-window" key={`${window.windowKind || window.name || "window"}-${index}`}>
                <div className="private-worker-quota-window-head">
                  <strong>{label}</strong>
                  <span>
                    {formatQuotaPercent(window.remainingPercent ?? window.remaining_percent)} {T("remaining", "剩余")}
                  </span>
                </div>
                <div className="private-worker-quota-meter" aria-hidden="true">
                  <span style={{ width: `${remaining ?? 0}%` }} />
                </div>
                <div className="private-worker-quota-window-meta">
                  <span>
                    {formatQuotaPercent(window.usedPercent ?? window.used_percent)} {T("used", "已用")}
                  </span>
                  <span>
                    {T("Resets", "重置")} {quotaResetLabel(window.resetsAt ?? window.resets_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function normalizeWorker(worker) {
  if (!worker || typeof worker !== "object") return null;
  const workerId = textValue(worker.worker_id || worker.workerId || worker.id);
  if (!workerId) return null;
  return {
    ...worker,
    worker_id: workerId,
    name: textValue(worker.name, workerId),
    status: textValue(worker.status, "offline"),
    enabled: worker.enabled !== false,
    running_jobs: Number(worker.running_jobs || worker.runningJobs || 0) || 0,
    last_heartbeat_at: worker.last_heartbeat_at || worker.lastHeartbeatAt || 0,
    version: textValue(worker.version),
    region: textValue(worker.region),
    hostname: textValue(worker.hostname),
    readyProviders: Array.isArray(worker.readyProviders) ? worker.readyProviders : [],
    codexQuota: workerCodexQuota(worker),
    latest_command: worker.latest_command || worker.latestCommand || null,
  };
}

function workerFromPayload(payload) {
  return normalizeWorker(payload?.worker || payload?.item || payload);
}

function installCommandFromPayload(payload) {
  return (
    textValue(payload?.install_commands?.standard) ||
    textValue(payload?.installCommands?.standard) ||
    textValue(payload?.install_command) ||
    textValue(payload?.installCommand)
  );
}

function workerTokenFromPayload(payload) {
  return textValue(payload?.worker_token || payload?.workerToken || payload?.token);
}

function commandStatus(command) {
  return textValue(command?.status).toLowerCase();
}

function commandName(command) {
  return textValue(command?.command).toLowerCase();
}

function activeLifecycleCommand(worker) {
  const command = worker?.latest_command;
  const status = commandStatus(command);
  if (!["pending", "running"].includes(status)) return null;
  return ["stop", "uninstall"].includes(commandName(command)) ? command : null;
}

function lifecycleText(command) {
  const action = commandName(command) === "uninstall" ? T("Delete queued", "删除已排队") : T("Stop queued", "停止已排队");
  return `${action} · ${statusLabel(commandStatus(command))}`;
}

function WorkerInstallResult({ result, onCopy }) {
  const command = installCommandFromPayload(result);
  const token = workerTokenFromPayload(result);
  if (!command && !token) return null;
  return (
    <div className="auth-success private-worker-result" role="status">
      <I.Check size={14} />
      <div>
        <b>{T("Private worker ready", "私有 Worker 已就绪")}</b>
        {command && (
          <div className="docs-code">
            <div className="docs-code-h">
              <span>{T("Linux install command", "Linux 安装命令")}</span>
              <button className="docs-code-copy" type="button" onClick={() => onCopy(command)}>
                <I.Copy size={12} /> {T("Copy", "复制")}
              </button>
            </div>
            <pre>{command}</pre>
          </div>
        )}
        {token && (
          <div className="docs-code">
            <div className="docs-code-h">
              <span>{T("Worker token", "Worker 令牌")}</span>
              <button className="docs-code-copy" type="button" onClick={() => onCopy(token)}>
                <I.Copy size={12} /> {T("Copy", "复制")}
              </button>
            </div>
            <pre>{token}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkerRow({ worker, pending, result, defaultWorkerVersion, onAction, onCopy }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState(worker.name || "");
  const [editRegion, setEditRegion] = useState(worker.region || "");
  const [editVersion, setEditVersion] = useState(worker.version || defaultWorkerVersion || "");
  const disabled = Boolean(pending);
  const isDisabled = worker.enabled === false;
  const displayVersion = worker.version || defaultWorkerVersion || "";

  useEffect(() => {
    if (!editing) {
      setEditName(worker.name || "");
      setEditRegion(worker.region || "");
      setEditVersion(worker.version || defaultWorkerVersion || "");
    }
  }, [defaultWorkerVersion, editing, worker.name, worker.region, worker.version]);

  const activeCommand = activeLifecycleCommand(worker);
  const actionsDisabled = disabled || Boolean(activeCommand);
  const deleteQueued = commandName(activeCommand) === "uninstall";
  const deleteDisabled = disabled || (Boolean(activeCommand) && !deleteQueued);

  const save = async () => {
    const payload = await onAction("update", worker, {
      name: editName.trim(),
      region: editRegion.trim(),
      version: editVersion.trim(),
    });
    if (payload) setEditing(false);
  };

  return (
    <article className="issue-row private-worker-row">
      <div className="issue-sev sev-bg-info">
        <span className={`status-dot status-${worker.status || "unknown"}`} />
        {statusLabel(worker.status)}
      </div>
      <div className="issue-id">{worker.worker_id}</div>
      <div className="issue-main">
        <div className="issue-t">{worker.name}</div>
        <div className="issue-meta">
          <span className="tag">{worker.region || T("No region", "未设置区域")}</span>
          <span className="tag">
            {T("Heartbeat", "心跳")} {formatTimestamp(worker.last_heartbeat_at)}
          </span>
          <span className="tag">
            {T("Running", "运行中")} {worker.running_jobs}
          </span>
          <span className="tag">
            {T("Version", "版本")} {displayVersion || "-"}
          </span>
          {activeCommand && <span className="tag">{lifecycleText(activeCommand)}</span>}
        </div>
        <WorkerQuotaPanel quota={worker.codexQuota} />
      </div>
      <div className="private-worker-actions">
        {editing ? (
          <>
            <button className="btn sm" type="button" disabled={disabled} onClick={() => setEditing(false)}>
              <I.X size={13} /> {T("Cancel", "取消")}
            </button>
            <button className="btn sm primary" type="button" disabled={disabled} onClick={save}>
              <I.Check size={13} /> {T("Save", "保存")}
            </button>
          </>
        ) : (
          <button className="btn sm" type="button" disabled={actionsDisabled} onClick={() => setEditing(true)}>
            <I.Settings size={13} /> {T("Edit", "编辑")}
          </button>
        )}
        {isDisabled ? (
          <button className="btn sm" type="button" disabled={actionsDisabled} onClick={() => onAction("enable", worker)}>
            <I.Check size={13} /> {T("Enable", "启用")}
          </button>
        ) : (
          <button className="btn sm" type="button" disabled={actionsDisabled} onClick={() => onAction("disable", worker)}>
            <I.X size={13} /> {T("Disable", "停用")}
          </button>
        )}
        <button className="btn sm" type="button" disabled={actionsDisabled} onClick={() => onAction("rotate", worker)}>
          <I.Refresh size={13} /> {T("Rotate token", "轮换令牌")}
        </button>
        <button
          className="btn sm danger"
          type="button"
          disabled={deleteDisabled}
          onClick={() => {
            if (deleteQueued) {
              onAction("delete", worker);
              return;
            }
            if (confirmDelete) {
              setConfirmDelete(false);
              onAction("delete", worker);
            } else {
              setConfirmDelete(true);
            }
          }}
        >
          <I.X size={13} />{" "}
          {deleteQueued ? T("Delete queued", "删除已排队") : confirmDelete ? T("Confirm delete", "确认删除") : T("Delete", "删除")}
        </button>
      </div>
      {editing && (
        <div className="private-worker-edit">
          <label className="auth-field">
            <span>{T("Name", "名称")}</span>
            <div className="auth-input">
              <I.Terminal size={14} />
              <input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </div>
          </label>
          <label className="auth-field">
            <span>{T("Region", "区域")}</span>
            <div className="auth-input">
              <I.Folder size={14} />
              <input value={editRegion} onChange={(event) => setEditRegion(event.target.value)} />
            </div>
          </label>
          <label className="auth-field">
            <span>{T("Version", "版本")}</span>
            <div className="auth-input">
              <I.Package size={14} />
              <input
                value={editVersion}
                onChange={(event) => setEditVersion(event.target.value)}
                placeholder={defaultWorkerVersion || "0.8.11"}
              />
            </div>
          </label>
        </div>
      )}
      {result && <WorkerInstallResult result={result} onCopy={onCopy} />}
    </article>
  );
}

export function PrivateWorkersScreen({ go, setIssue = null }) {
  useLang();
  const [workers, setWorkers] = useState([]);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [version, setVersion] = useState("");
  const [defaultWorkerVersion, setDefaultWorkerVersion] = useState("");
  const [codexUseLatest, setCodexUseLatest] = useState(true);
  const [codexVersion, setCodexVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [createdResult, setCreatedResult] = useState(null);
  const [actionResults, setActionResults] = useState({});

  const activeCount = useMemo(
    () => workers.filter((worker) => worker.enabled !== false && ["idle", "busy"].includes(worker.status)).length,
    [workers]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await pullwiseApi.privateWorkers.list();
      const payloadDefaultVersion = defaultWorkerVersionFromPayload(payload);
      if (payloadDefaultVersion) {
        setDefaultWorkerVersion(payloadDefaultVersion);
        setVersion((current) => current || payloadDefaultVersion);
      }
      setWorkers(itemsFrom(payload, "workers", "items").map(normalizeWorker).filter(Boolean));
    } catch (err) {
      setWorkers([]);
      setError(err?.message || T("Unable to load private workers.", "无法加载私有 Worker。"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upsertWorker = (worker) => {
    if (!worker) return;
    setWorkers((current) => {
      const existing = current.find((item) => item.worker_id === worker.worker_id);
      const merged = existing ? { ...existing, ...worker } : worker;
      const next = current.filter((item) => item.worker_id !== worker.worker_id);
      return [merged, ...next];
    });
  };

  const copyValue = async (value) => {
    if (!value) return;
    setError("");
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError(T("Unable to copy. Select the value manually.", "无法复制，请手动选择。"));
    }
  };

  const createWorker = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending("create");
    setError("");
    setCreatedResult(null);
    try {
      const payload = await pullwiseApi.privateWorkers.create({
        name: name.trim() || T("Private worker", "私有 Worker"),
        region: region.trim(),
        version: version.trim() || defaultWorkerVersion,
        codexUseLatest,
        codexVersion: codexUseLatest ? "" : codexVersion.trim(),
      });
      setCreatedResult(payload);
      upsertWorker(workerFromPayload(payload));
      setName("");
      setRegion("");
      setVersion(defaultWorkerVersion);
      setCodexUseLatest(true);
      setCodexVersion("");
    } catch (err) {
      setError(err?.message || T("Unable to create private worker.", "无法创建私有 Worker。"));
    } finally {
      setPending("");
    }
  };

  const runAction = async (action, worker, patch = {}) => {
    if (!worker?.worker_id || pending) return;
    const actionKey = `${action}:${worker.worker_id}`;
    setPending(actionKey);
    setError("");
    try {
      let payload;
      if (action === "enable") payload = await pullwiseApi.privateWorkers.enable(worker.worker_id);
      else if (action === "disable") payload = await pullwiseApi.privateWorkers.disable(worker.worker_id);
      else if (action === "rotate") payload = await pullwiseApi.privateWorkers.rotateToken(worker.worker_id);
      else if (action === "delete") payload = await pullwiseApi.privateWorkers.delete(worker.worker_id);
      else if (action === "update") payload = await pullwiseApi.privateWorkers.update(worker.worker_id, patch);
      const nextWorker = workerFromPayload(payload);
      if (action === "delete") {
        if (nextWorker) upsertWorker(nextWorker);
      } else {
        upsertWorker(nextWorker);
      }
      if (action === "rotate") {
        setActionResults((current) => ({ ...current, [worker.worker_id]: payload }));
      }
      return payload;
    } catch (err) {
      setError(err?.message || T("Private worker action failed.", "私有 Worker 操作失败。"));
      return null;
    } finally {
      setPending("");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Private workers", "私有 Worker") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="privateWorkers" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Private workers", "私有 Worker")}</h1>
              <div className="sub">
                {T(`${activeCount} active · ${workers.length} total`, `${activeCount} 个活跃 · 共 ${workers.length} 个`)}
              </div>
            </div>
            <div className="actions">
              <button className="btn" type="button" disabled={loading || Boolean(pending)} onClick={load}>
                <I.Refresh size={13} className={loading ? "spin" : undefined} /> {T("Refresh", "刷新")}
              </button>
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
                <I.Terminal size={14} />
                <span>{T("Workers", "Worker")}</span>
              </button>
              <button className="set-side-i" type="button" disabled>
                <I.Check size={14} />
                <span>{T(`${activeCount} active`, `${activeCount} 个活跃`)}</span>
              </button>
            </aside>

            <div className="set-body">
              {createdResult && <WorkerInstallResult result={createdResult} onCopy={copyValue} />}

              <form className="bill-card api-key-create private-worker-create" onSubmit={createWorker}>
                <div className="api-key-create-head">
                  <div className="api-key-create-icon">
                    <I.Terminal size={16} />
                  </div>
                  <div>
                    <b>{T("Create private worker", "创建私有 Worker")}</b>
                    <span>{T("Linux · Codex provider", "Linux · Codex provider")}</span>
                  </div>
                </div>
                <div className="api-key-create-main">
                  <div className="private-worker-create-fields">
                    <label className="auth-field">
                      <span>{T("Name", "名称")}</span>
                      <div className="auth-input">
                        <I.Terminal size={14} />
                        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Home lab" />
                      </div>
                    </label>
                    <label className="auth-field">
                      <span>{T("Region", "区域")}</span>
                      <div className="auth-input">
                        <I.Folder size={14} />
                        <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="local" />
                      </div>
                    </label>
                    <label className="auth-field">
                      <span>{T("Version", "版本")}</span>
                      <div className="auth-input">
                        <I.Package size={14} />
                        <input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="0.8.11" />
                      </div>
                    </label>
                    <label className="auth-field private-worker-codex-latest">
                      <span>{T("Codex CLI", "Codex CLI")}</span>
                      <div className="auth-input">
                        <input
                          type="checkbox"
                          checked={codexUseLatest}
                          onChange={(event) => setCodexUseLatest(event.target.checked)}
                        />
                        <span>{T("Use latest", "Use latest")}</span>
                      </div>
                    </label>
                    {!codexUseLatest && (
                      <label className="auth-field">
                        <span>{T("Codex version", "Codex version")}</span>
                        <div className="auth-input">
                          <I.Package size={14} />
                          <input
                            value={codexVersion}
                            onChange={(event) => setCodexVersion(event.target.value)}
                            placeholder="0.13.0"
                          />
                        </div>
                      </label>
                    )}
                  </div>
                  <button className="btn primary" type="submit" disabled={Boolean(pending)}>
                    {pending === "create" && (
                      <span className="spin" style={{ display: "inline-block" }}>
                        <I.Refresh size={14} />
                      </span>
                    )}
                    <I.Plus size={14} /> {pending === "create" ? T("Creating...", "创建中...") : T("Create worker", "创建 Worker")}
                  </button>
                </div>
              </form>

              {loading ? (
                <div className="card section muted">{T("Loading...", "正在加载...")}</div>
              ) : (
                <div className="issue-list private-worker-list">
                  {workers.map((worker) => (
                    <WorkerRow
                      key={worker.worker_id}
                      worker={worker}
                      pending={pending && pending.endsWith(worker.worker_id) ? pending : ""}
                      result={actionResults[worker.worker_id]}
                      onAction={runAction}
                      onCopy={copyValue}
                    />
                  ))}
                  {workers.length === 0 && (
                    <div className="card section muted">
                      {T("No private workers.", "暂无私有 Worker。")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
