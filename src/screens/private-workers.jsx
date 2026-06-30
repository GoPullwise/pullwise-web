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

function WorkerRow({ worker, pending, result, onAction, onCopy }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState(worker.name || "");
  const [editRegion, setEditRegion] = useState(worker.region || "");
  const [editVersion, setEditVersion] = useState(worker.version || "");
  const disabled = Boolean(pending);
  const isDisabled = worker.enabled === false;

  useEffect(() => {
    if (!editing) {
      setEditName(worker.name || "");
      setEditRegion(worker.region || "");
      setEditVersion(worker.version || "");
    }
  }, [editing, worker.name, worker.region, worker.version]);

  const save = async () => {
    const payload = await onAction("update", worker, {
      name: editName.trim(),
      region: editRegion.trim(),
      version: editVersion.trim(),
    });
    if (payload) setEditing(false);
  };

  return (
    <article className="private-worker-row">
      <div className="private-worker-main">
        <span className={`status-dot status-${worker.status || "unknown"}`} />
        <div className="private-worker-title">
          <strong>{worker.name}</strong>
          <span>
            {statusLabel(worker.status)} · {worker.region || T("No region", "未设置区域")}
          </span>
        </div>
      </div>
      <div className="private-worker-facts">
        <div>
          <span>{T("Last heartbeat", "最近心跳")}</span>
          <b>{formatTimestamp(worker.last_heartbeat_at)}</b>
        </div>
        <div>
          <span>{T("Running", "运行中")}</span>
          <b>{worker.running_jobs}</b>
        </div>
        <div>
          <span>{T("Version", "版本")}</span>
          <b>{worker.version || "-"}</b>
        </div>
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
          <button className="btn sm" type="button" disabled={disabled} onClick={() => setEditing(true)}>
            <I.Settings size={13} /> {T("Edit", "编辑")}
          </button>
        )}
        {isDisabled ? (
          <button className="btn sm" type="button" disabled={disabled} onClick={() => onAction("enable", worker)}>
            <I.Check size={13} /> {T("Enable", "启用")}
          </button>
        ) : (
          <button className="btn sm" type="button" disabled={disabled} onClick={() => onAction("disable", worker)}>
            <I.X size={13} /> {T("Disable", "停用")}
          </button>
        )}
        <button className="btn sm" type="button" disabled={disabled} onClick={() => onAction("rotate", worker)}>
          <I.Refresh size={13} /> {T("Rotate token", "轮换令牌")}
        </button>
        <button
          className="btn sm danger"
          type="button"
          disabled={disabled}
          onClick={() => {
            if (confirmDelete) {
              setConfirmDelete(false);
              onAction("delete", worker);
            } else {
              setConfirmDelete(true);
            }
          }}
        >
          <I.X size={13} /> {confirmDelete ? T("Confirm delete", "确认删除") : T("Delete", "删除")}
        </button>
      </div>
      {editing && (
        <div className="private-worker-edit form-grid compact">
          <label className="field">
            <span>{T("Name", "名称")}</span>
            <input value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <label className="field">
            <span>{T("Region", "区域")}</span>
            <input value={editRegion} onChange={(event) => setEditRegion(event.target.value)} />
          </label>
          <label className="field">
            <span>{T("Version", "版本")}</span>
            <input value={editVersion} onChange={(event) => setEditVersion(event.target.value)} placeholder="0.8.9" />
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
      const next = current.filter((item) => item.worker_id !== worker.worker_id);
      return [worker, ...next];
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
        version: version.trim(),
      });
      setCreatedResult(payload);
      upsertWorker(workerFromPayload(payload));
      setName("");
      setRegion("");
      setVersion("");
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
          {createdResult && <WorkerInstallResult result={createdResult} onCopy={copyValue} />}

          <div className="private-worker-grid">
            <form className="bill-card private-worker-create" onSubmit={createWorker}>
              <div className="private-worker-create-head">
                <span className="api-key-create-icon">
                  <I.Terminal size={16} />
                </span>
                <div>
                  <b>{T("Create private worker", "创建私有 Worker")}</b>
                  <span>{T("Linux · Codex provider", "Linux · Codex provider")}</span>
                </div>
              </div>
              <div className="form-grid compact">
                <label className="field">
                  <span>{T("Name", "名称")}</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Home lab" />
                </label>
                <label className="field">
                  <span>{T("Region", "区域")}</span>
                  <input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="local" />
                </label>
                <label className="field">
                  <span>{T("Version", "版本")}</span>
                  <input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="0.8.9" />
                </label>
              </div>
              <button className="btn primary" type="submit" disabled={Boolean(pending)}>
                <I.Plus size={14} /> {pending === "create" ? T("Creating...", "创建中...") : T("Create", "创建")}
              </button>
            </form>

            <section className="private-worker-list">
              {loading ? (
                <div className="bill-card private-worker-empty">{T("Loading...", "正在加载...")}</div>
              ) : workers.length ? (
                workers.map((worker) => (
                  <WorkerRow
                    key={worker.worker_id}
                    worker={worker}
                    pending={pending && pending.endsWith(worker.worker_id) ? pending : ""}
                    result={actionResults[worker.worker_id]}
                    onAction={runAction}
                    onCopy={copyValue}
                  />
                ))
              ) : (
                <div className="bill-card private-worker-empty">
                  {T("No private workers.", "暂无私有 Worker。")}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
