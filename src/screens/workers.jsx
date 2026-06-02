import { useCallback, useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

/* ── helpers ────────────────────────────────────────────── */

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

function formatDate(value) {
  if (!value) return T("Never", "从未");
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return textValue(value);
  return date.toLocaleString();
}

function formatRelative(value) {
  if (!value) return "";
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return T("just now", "刚刚");
  if (seconds < 3600) return T(`${Math.floor(seconds / 60)}m ago`, `${Math.floor(seconds / 60)} 分钟前`);
  if (seconds < 86400) return T(`${Math.floor(seconds / 3600)}h ago`, `${Math.floor(seconds / 3600)} 小时前`);
  return T(`${Math.floor(seconds / 86400)}d ago`, `${Math.floor(seconds / 86400)} 天前`);
}

function breakableText(value, chunkSize = 16) {
  const text = String(value || "");
  if (!text) return "";
  const chunks = text.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [text];
  return chunks.map((chunk, index) => (
    <span key={`${chunk}-${index}`}>
      {chunk}
      {index < chunks.length - 1 ? <wbr /> : null}
    </span>
  ));
}

const WORKER_REFRESH_MS = 15000;

/* ── status helpers ─────────────────────────────────────── */

function workerStatusMeta(status) {
  switch (status) {
    case "idle":
      return { label: T("Idle", "空闲"), cls: "wk-status-idle", dotCls: "wk-dot-idle" };
    case "busy":
      return { label: T("Busy", "忙碌"), cls: "wk-status-busy", dotCls: "wk-dot-busy" };
    case "degraded":
      return { label: T("Degraded", "异常"), cls: "wk-status-degraded", dotCls: "wk-dot-degraded" };
    case "offline":
    case "disabled":
      return { label: T("Offline", "离线"), cls: "wk-status-offline", dotCls: "wk-dot-offline" };
    default:
      return { label: T(status || "Unknown", status || "未知"), cls: "wk-status-unknown", dotCls: "wk-dot-unknown" };
  }
}

function installCommandOptions(result) {
  const standard = result?.install_commands?.standard || result?.install_command || "";
  const local = result?.install_commands?.local || result?.local_install_command || "";
  const commands = [];
  if (standard) {
    commands.push({
      key: "standard",
      title: T("Standard deployment", "常规部署"),
      detail: T(
        "Use this when the worker reaches the Pullwise API through the public or configured server URL.",
        "当 Worker 通过公网或已配置的 Server URL 访问 Pullwise API 时使用。"
      ),
      value: standard,
    });
  }
  if (local && local !== standard) {
    commands.push({
      key: "local",
      title: T("Local same-host deployment", "本机同机部署"),
      detail: T(
        "Use this when this worker runs on the same host as Pullwise server. It connects to the existing server at 127.0.0.1:8080; the worker does not listen on port 8080.",
        "当 Worker 和 Pullwise server 在同一台机器上时使用。它连接已运行在 127.0.0.1:8080 的 server；Worker 不会监听 8080 端口。"
      ),
      value: local,
    });
  }
  return commands;
}

function tokenFromResult(result) {
  return (
    result?.worker_token ||
    result?.worker?.worker_token ||
    result?.suggested_env?.PULLWISE_WORKER_TOKEN ||
    result?.token ||
    ""
  );
}

function InstallCommandBlocks({ result }) {
  useLang();
  const commands = installCommandOptions(result);
  const token = tokenFromResult(result);
  const [copiedKey, setCopiedKey] = useState("");

  const copyToClipboard = async (key, value) => {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? "" : current)), 1600);
  };

  if (!commands.length && !token) return null;

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
      {commands.map((command) => (
        <div className="docs-code" key={command.key}>
          <div className="docs-code-h">
            <span>
              <I.Terminal size={12} /> {command.title}
            </span>
            <button className="docs-code-copy" type="button" onClick={() => copyToClipboard(command.key, command.value)}>
              <I.Copy size={12} /> {copiedKey === command.key ? T("Copied", "已复制") : T("Copy", "复制")}
            </button>
          </div>
          <div className="muted" style={{ padding: "8px 12px 0", fontSize: 12 }}>
            {command.detail}
          </div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{command.value}</pre>
        </div>
      ))}
      {token && (
        <div className="docs-code">
          <div className="docs-code-h">
            <span>
              <I.Shield size={12} /> {T("Worker token", "Worker Token")}
            </span>
            <button className="docs-code-copy" type="button" onClick={() => copyToClipboard("token", token)}>
              <I.Copy size={12} /> {copiedKey === "token" ? T("Copied", "已复制") : T("Copy", "复制")}
            </button>
          </div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{token}</pre>
        </div>
      )}
    </div>
  );
}

/* ── Create worker modal ────────────────────────────────── */

function CreateWorkerModal({ onClose, onCreated }) {
  useLang();
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [version, setVersion] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const createWorker = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const payload = await pullwiseApi.system.createWorker({
        name: name.trim() || "Worker",
        provider: "codex",
        region: region.trim(),
        version: version.trim(),
        max_concurrent_jobs: Number(capacity) || 1,
      });
      setResult(payload);
      onCreated?.(payload);
    } catch (err) {
      setError(err?.message || "Worker creation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal modal-wk" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{T("Register new worker", "注册新 Worker")}</h2>
          <button className="btn ghost sm" onClick={onClose}>
            <I.X size={16} />
          </button>
        </div>

        {!result ? (
          <form onSubmit={createWorker}>
            <div className="modal-body">
              <p className="wk-modal-desc">
                {T(
                  "Register a new worker node. After creation, you will receive a token and install command to deploy the worker.",
                  "注册新的 Worker 节点。创建后将获得 token 和安装命令来部署 worker。"
                )}
              </p>
              {error && (
                <div className="auth-error" role="alert">
                  <I.X size={13} /> {error}
                </div>
              )}
              <div className="wk-form-grid">
                <label className="auth-field">
                  <span>{T("Name", "名称")}</span>
                  <div className="auth-input">
                    <I.Terminal size={14} />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={T("e.g. US-East-1", "例如 US-East-1")}
                    />
                  </div>
                </label>
                <label className="auth-field">
                  <span>{T("Region", "区域")}</span>
                  <div className="auth-input">
                    <I.Compass size={14} />
                    <input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      placeholder={T("e.g. us-east", "例如 us-east")}
                    />
                  </div>
                </label>
                <label className="auth-field">
                  <span>{T("Version", "版本")}</span>
                  <div className="auth-input">
                    <I.GitBranch size={14} />
                    <input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder={T("e.g. 1.2.0", "例如 1.2.0")}
                    />
                  </div>
                </label>
                <label className="auth-field">
                  <span>{T("Max concurrent jobs", "最大并发数")}</span>
                  <div className="auth-input">
                    <I.Layers size={14} />
                    <input
                      type="number"
                      min="1"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </label>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" type="button" onClick={onClose}>
                {T("Cancel", "取消")}
              </button>
              <button className="btn primary" type="submit" disabled={busy}>
                {busy && (
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={14} />
                  </span>
                )}
                <I.Plus size={14} /> {T("Register worker", "注册 Worker")}
              </button>
            </div>
          </form>
        ) : (
          <div className="modal-body">
            <div className="auth-success" role="status">
              <I.Check size={14} />
              <div>
                <b>{T("Worker registered", "Worker 已注册")}</b>
                <span>
                  {T(
                    "Copy one of the install commands below. The full token is only shown once.",
                    "请从下面的安装命令中选择一个复制执行。完整的 token 仅显示一次。"
                  )}
                </span>
              </div>
            </div>

            {result.worker && (
              <div className="wk-created-info">
                <div className="wk-created-row">
                  <span className="muted">{T("Worker ID", "Worker ID")}</span>
                  <span className="wk-mono" title={result.worker.worker_id}>
                    {breakableText(result.worker.worker_id)}
                  </span>
                </div>
                <div className="wk-created-row">
                  <span className="muted">{T("Name", "名称")}</span>
                  <span>{result.worker.name}</span>
                </div>
              </div>
            )}

            <InstallCommandBlocks result={result} />

            <div className="wk-token-notice">
              <I.Shield size={14} />
              <span>
                {T(
                  "The worker token is shown only once. Store it securely.",
                  "Worker token 仅显示一次，请安全保存。"
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Worker detail panel (expandable) ───────────────────── */

function WorkerDetailPanel({ worker }) {
  useLang();
  const [auditEvents, setAuditEvents] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const payload = await pullwiseApi.system.getWorker(worker.worker_id);
      const events = Array.isArray(payload?.auditEvents) ? payload.auditEvents : [];
      setAuditEvents(events);
    } catch {
      setAuditEvents([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, [worker.worker_id]);

  const lastHeartbeat = formatRelative(worker.last_heartbeat_at);
  const doctorStatus = worker.doctor_status || "—";
  const codexReady = worker.codex_ready === true ? "✓" : worker.codex_ready === false ? "✗" : "—";
  const hostname = worker.hostname || "—";

  return (
    <div className="wk-detail">
      <div className="wk-detail-grid">
        <div className="wk-detail-col">
          <h4>{T("Health", "健康状态")}</h4>
          <div className="wk-detail-row">
            <span className="muted">{T("Doctor status", "Doctor 状态")}</span>
            <span>{doctorStatus}</span>
          </div>
          <div className="wk-detail-row">
            <span className="muted">{T("Codex ready", "Codex 就绪")}</span>
            <span className={worker.codex_ready === true ? "wk-ok" : worker.codex_ready === false ? "wk-err" : ""}>{codexReady}</span>
          </div>
          <div className="wk-detail-row">
            <span className="muted">{T("Last heartbeat", "最近心跳")}</span>
            <span>{lastHeartbeat || "—"}</span>
          </div>
          <div className="wk-detail-row">
            <span className="muted">{T("Hostname", "主机名")}</span>
            <span className="wk-mono">{hostname}</span>
          </div>
          {worker.last_error && (
            <div className="wk-detail-row wk-err-row">
              <span className="muted">{T("Last error", "最近错误")}</span>
              <span className="wk-err-text">{worker.last_error}</span>
            </div>
          )}
        </div>
        <div className="wk-detail-col">
          <h4>{T("Audit log", "审计日志")}</h4>
          {loadingAudit ? (
            <div className="muted" style={{ padding: "8px 0" }}>
              <span className="spin" style={{ display: "inline-block" }}>
                <I.Refresh size={12} />
              </span>{" "}
              {T("Loading...", "加载中...")}
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="muted" style={{ padding: "8px 0" }}>
              {T("No audit events.", "暂无审计记录。")}
            </div>
          ) : (
            <div className="wk-audit-list">
              {auditEvents.slice(0, 20).map((event, index) => (
                <div key={index} className="wk-audit-row">
                  <span className={"wk-audit-dot " + (event.success ? "wk-dot-idle" : "wk-dot-degraded")} />
                  <span className="wk-audit-action">{event.action}</span>
                  <span className="wk-audit-time muted">{formatRelative(event.created_at || event.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Single worker row ──────────────────────────────────── */

function WorkerRow({ worker, onAction, pendingAction }) {
  useLang();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editRegion, setEditRegion] = useState(worker.region || "");
  const [editVersion, setEditVersion] = useState(worker.version || "");
  const [editCapacity, setEditCapacity] = useState(String(worker.max_concurrent_jobs || 1));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusMeta = workerStatusMeta(worker.status);
  const isDisabled = worker.enabled === false;
  const isBusy = Boolean(pendingAction);
  const jobId = worker.worker_id;

  // Sync edit state when worker props change
  useEffect(() => {
    if (!editing) {
      setEditRegion(worker.region || "");
      setEditVersion(worker.version || "");
      setEditCapacity(String(worker.max_concurrent_jobs || 1));
    }
  }, [worker.region, worker.version, worker.max_concurrent_jobs, editing]);

  const saveEdit = () => {
    onAction("save", jobId, {
      region: editRegion,
      version: editVersion,
      max_concurrent_jobs: Number(editCapacity) || 1,
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditRegion(worker.region || "");
    setEditVersion(worker.version || "");
    setEditCapacity(String(worker.max_concurrent_jobs || 1));
    setEditing(false);
  };

  const runningJobs = worker.running_jobs ?? 0;
  const maxJobs = worker.max_concurrent_jobs ?? 1;
  const capacityPct = maxJobs > 0 ? Math.round((runningJobs / maxJobs) * 100) : 0;

  return (
    <div className={"wk-row" + (isDisabled ? " wk-row-disabled" : "")}>
      <div className="wk-row-main" onClick={() => setExpanded(!expanded)}>
        <div className="wk-row-status">
          <span className={"wk-dot " + statusMeta.dotCls} />
        </div>
        <div className="wk-row-info">
          <div className="wk-row-title">
            <span className="wk-row-name" title={worker.name || worker.worker_id}>
              {worker.name || breakableText(worker.worker_id)}
            </span>
            {isDisabled && <span className="wk-disabled-tag">{T("Disabled", "已停用")}</span>}
            <span className={"wk-status-tag " + statusMeta.cls}>{statusMeta.label}</span>
          </div>
          <div className="wk-row-meta">
            <span className="wk-meta-item">
              <I.Activity size={11} /> {runningJobs}/{maxJobs} {T("jobs", "任务")}
            </span>
            <span className="wk-meta-item">
              <I.Compass size={11} /> {worker.region || T("No region", "无区域")}
            </span>
            <span className="wk-meta-item">
              <I.GitBranch size={11} /> {worker.provider || "codex"}{worker.version ? ` ${worker.version}` : ""}
            </span>
            {worker.last_heartbeat_at && (
              <span className="wk-meta-item">
                <I.Clock size={11} /> {formatRelative(worker.last_heartbeat_at)}
              </span>
            )}
          </div>
        </div>
        <div className="wk-row-capacity">
          <div className="wk-cap-bar">
            <div
              className={"wk-cap-fill" + (capacityPct >= 100 ? " wk-cap-full" : capacityPct >= 70 ? " wk-cap-warn" : "")}
              style={{ width: Math.min(100, capacityPct) + "%" }}
            />
          </div>
          <span className="wk-cap-text">{capacityPct}%</span>
        </div>
        <button className={"wk-expand-btn" + (expanded ? " wk-expand-open" : "")} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          <I.ChevD size={14} />
        </button>
      </div>

      {expanded && (
        <div className="wk-row-expanded">
          {/* Inline edit form */}
          <div className="wk-edit-section">
            <div className="wk-edit-header">
              <h4>{T("Configuration", "配置")}</h4>
              {!editing ? (
                <button className="btn sm ghost" onClick={() => setEditing(true)}>
                  <I.Edit size={13} /> {T("Edit", "编辑")}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn sm ghost" onClick={cancelEdit}>
                    {T("Cancel", "取消")}
                  </button>
                  <button className="btn sm primary" onClick={saveEdit} disabled={isBusy}>
                    <I.Check size={13} /> {T("Save", "保存")}
                  </button>
                </div>
              )}
            </div>
            <div className="wk-form-grid">
              <label className="auth-field">
                <span>{T("Region", "区域")}</span>
                <div className="auth-input">
                  <I.Compass size={14} />
                  <input
                    value={editing ? editRegion : (worker.region || "—")}
                    onChange={(e) => setEditRegion(e.target.value)}
                    disabled={!editing}
                    placeholder={T("Region", "区域")}
                  />
                </div>
              </label>
              <label className="auth-field">
                <span>{T("Version", "版本")}</span>
                <div className="auth-input">
                  <I.GitBranch size={14} />
                  <input
                    value={editing ? editVersion : (worker.version || "—")}
                    onChange={(e) => setEditVersion(e.target.value)}
                    disabled={!editing}
                    placeholder={T("Version", "版本")}
                  />
                </div>
              </label>
              <label className="auth-field">
                <span>{T("Max concurrent jobs", "最大并发数")}</span>
                <div className="auth-input">
                  <I.Layers size={14} />
                  <input
                    type="number"
                    min="1"
                    value={editing ? editCapacity : String(worker.max_concurrent_jobs || 1)}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    disabled={!editing}
                  />
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="wk-actions-section">
            <h4>{T("Actions", "操作")}</h4>
            <div className="wk-actions-row">
              {isDisabled ? (
                <button
                  className="btn sm"
                  disabled={isBusy}
                  onClick={() => onAction("enable", jobId)}
                >
                  <I.Play size={14} /> {T("Enable", "启用")}
                </button>
              ) : (
                <button
                  className="btn sm"
                  disabled={isBusy}
                  title={T("Stop accepting new jobs. Running jobs continue.", "停止接受新任务。运行中的任务继续执行。")}
                  onClick={() => onAction("disable", jobId)}
                >
                  <I.X size={14} /> {T("Stop new jobs", "停止新任务")}
                </button>
              )}
              <button
                className="btn sm"
                disabled={isBusy}
                onClick={() => onAction("test", jobId)}
              >
                <I.Activity size={14} /> {T("Health check", "健康检查")}
              </button>
              <button
                className="btn sm"
                disabled={isBusy}
                onClick={() => onAction("rotate", jobId)}
              >
                <I.Refresh size={14} /> {T("Rotate token", "轮换 Token")}
              </button>
              <button
                className={"btn sm" + (confirmDelete ? " wk-btn-danger" : "")}
                disabled={isBusy}
                onClick={() => {
                  if (confirmDelete) {
                    onAction("delete", jobId);
                  } else {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 5000);
                  }
                }}
              >
                <I.X size={14} /> {confirmDelete ? T("Confirm delete", "确认删除") : T("Delete", "删除")}
              </button>
            </div>
          </div>

          {/* Detail panel with health + audit */}
          <WorkerDetailPanel worker={worker} />
        </div>
      )}
    </div>
  );
}

/* ── Token display modal (after rotate) ─────────────────── */

function TokenDisplayModal({ result, onClose }) {
  useLang();

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal modal-wk" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{T("Token rotated", "Token 已轮换")}</h2>
          <button className="btn ghost sm" onClick={onClose}>
            <I.X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="auth-success" role="status">
            <I.Check size={14} />
            <div>
              <b>{T("New token generated", "已生成新 Token")}</b>
              <span>
                {T(
                  "The old token is no longer valid. Copy one of the new install commands now — the token is only shown once.",
                  "旧 token 已失效。请立即复制新的安装命令之一 — token 仅显示一次。"
                )}
              </span>
            </div>
          </div>
          <InstallCommandBlocks result={result} />
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>
            {T("Done", "完成")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main WorkersScreen ─────────────────────────────────── */

export function WorkersScreen({ go, setIssue = null }) {
  useLang();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [tokenResult, setTokenResult] = useState(null);
  const [actionMessage, setActionMessage] = useState({ id: "", text: "", type: "" });
  const [filterStatus, setFilterStatus] = useState("all");

  const loadWorkers = useCallback(async () => {
    try {
      const payload = await pullwiseApi.system.listWorkers();
      const items = itemsFrom(payload, "workers", "items");
      setWorkers(items);
      setError("");
    } catch (err) {
      setError(err?.message || "Unable to load workers.");
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkers();
    const id = setInterval(loadWorkers, WORKER_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadWorkers]);

  const handleAction = async (action, workerId, payload = {}) => {
    const actionKey = `${action}:${workerId}`;
    setPendingAction(actionKey);
    setActionMessage({ id: "", text: "", type: "" });
    try {
      let result;
      switch (action) {
        case "save":
          result = await pullwiseApi.system.updateWorker(workerId, payload);
          setActionMessage({ id: workerId, text: T("Worker updated.", "Worker 已更新。"), type: "success" });
          break;
        case "enable":
          result = await pullwiseApi.system.enableWorker(workerId);
          setActionMessage({ id: workerId, text: T("Worker enabled.", "Worker 已启用。"), type: "success" });
          break;
        case "disable":
          result = await pullwiseApi.system.disableWorker(workerId);
          setActionMessage({ id: workerId, text: T("Worker disabled. Running jobs continue.", "Worker 已停用。运行中的任务继续执行。"), type: "success" });
          break;
        case "test": {
          result = await pullwiseApi.system.testWorker(workerId);
          const ok = result?.result?.ok;
          setActionMessage({
            id: workerId,
            text: ok ? T("Health check passed.", "健康检查通过。") : T("Health check needs attention.", "健康检查需要关注。"),
            type: ok ? "success" : "warning",
          });
          break;
        }
        case "rotate": {
          result = await pullwiseApi.system.rotateWorkerToken(workerId);
          setTokenResult(result);
          break;
        }
        case "delete":
          result = await pullwiseApi.system.deleteWorker(workerId);
          setActionMessage({ id: workerId, text: T("Worker deleted.", "Worker 已删除。"), type: "success" });
          break;
        default:
          return;
      }
      // Refresh workers list
      await loadWorkers();
    } catch (err) {
      setActionMessage({ id: workerId, text: err?.message || "Action failed.", type: "error" });
    } finally {
      setPendingAction("");
    }
  };

  const handleCreated = () => {
    loadWorkers();
  };

  // Filtered workers
  const filteredWorkers = workers.filter((w) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active") return w.enabled !== false && ["idle", "busy"].includes(w.status);
    if (filterStatus === "degraded") return w.status === "degraded";
    if (filterStatus === "disabled") return w.enabled === false;
    return true;
  });

  // Summary stats
  const totalWorkers = workers.length;
  const activeWorkers = workers.filter((w) => w.enabled !== false && ["idle", "busy"].includes(w.status)).length;
  const degradedWorkers = workers.filter((w) => w.status === "degraded").length;
  const disabledWorkers = workers.filter((w) => w.enabled === false).length;
  const totalCapacity = workers.reduce((sum, w) => sum + (w.max_concurrent_jobs || 1), 0);
  const totalRunning = workers.reduce((sum, w) => sum + (w.running_jobs || 0), 0);

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Workers", "Workers") }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="workers" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Worker Registry", "Worker 注册中心")}</h1>
              <div className="sub">
                {T(
                  "Manage scan worker nodes. Register, configure, and monitor workers.",
                  "管理扫描 Worker 节点。注册、配置和监控 Workers。"
                )}
              </div>
            </div>
            <div className="actions">
              <button className="btn" onClick={loadWorkers} disabled={loading}>
                {loading ? (
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={14} />
                  </span>
                ) : (
                  <I.Refresh size={14} />
                )}{" "}
                {T("Refresh", "刷新")}
              </button>
              <button className="btn primary" onClick={() => setShowCreate(true)}>
                <I.Plus size={14} /> {T("Register worker", "注册 Worker")}
              </button>
            </div>
          </div>

          {/* Global error */}
          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
              <I.X size={13} /> {error}
            </div>
          )}

          {/* Action message */}
          {actionMessage.text && (
            <div
              className={
                actionMessage.type === "success"
                  ? "auth-success"
                  : actionMessage.type === "warning"
                    ? "auth-error"
                    : "auth-error"
              }
              role="status"
              style={{ marginBottom: 12 }}
            >
              {actionMessage.type === "success" ? <I.Check size={14} /> : <I.X size={13} />}
              <div>{actionMessage.text}</div>
            </div>
          )}

          {/* KPI summary */}
          <div className="wk-kpis">
            <div className="kpi">
              <div className="kpi-v">{totalWorkers}</div>
              <div className="kpi-foot">{T("Total workers", "Worker 总数")}</div>
            </div>
            <div className="kpi">
              <div className="kpi-v wk-text-ok">{activeWorkers}</div>
              <div className="kpi-foot">{T("Active", "活跃")}</div>
            </div>
            <div className="kpi">
              <div className="kpi-v wk-text-warn">{degradedWorkers}</div>
              <div className="kpi-foot">{T("Degraded", "异常")}</div>
            </div>
            <div className="kpi">
              <div className="kpi-v wk-text-muted">{disabledWorkers}</div>
              <div className="kpi-foot">{T("Disabled", "停用")}</div>
            </div>
            <div className="kpi">
              <div className="kpi-v">{totalRunning}/{totalCapacity}</div>
              <div className="kpi-foot">{T("Running / Capacity", "运行 / 容量")}</div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="wk-filters card">
            <div className="seg">
              {[
                { key: "all", label: T("All", "全部"), count: totalWorkers },
                { key: "active", label: T("Active", "活跃"), count: activeWorkers },
                { key: "degraded", label: T("Degraded", "异常"), count: degradedWorkers },
                { key: "disabled", label: T("Disabled", "停用"), count: disabledWorkers },
              ].map((item) => (
                <button
                  key={item.key}
                  className={"seg-i" + (filterStatus === item.key ? " active" : "")}
                  onClick={() => setFilterStatus(item.key)}
                >
                  {item.label} <span className="wk-count">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Worker list */}
          <div className="wk-list">
            {loading && workers.length === 0 ? (
              <div className="card section muted" style={{ textAlign: "center", padding: 40 }}>
                <span className="spin" style={{ display: "inline-block", marginBottom: 8 }}>
                  <I.Refresh size={20} />
                </span>
                <div>{T("Loading workers...", "正在加载 Workers...")}</div>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="card section muted" style={{ textAlign: "center", padding: 40 }}>
                <I.Terminal size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>
                  {filterStatus === "all"
                    ? T("No workers registered yet. Click 'Register worker' to add one.", "尚未注册 Worker。点击「注册 Worker」添加。")
                    : T("No workers match this filter.", "没有 Worker 匹配此筛选。")}
                </div>
              </div>
            ) : (
              filteredWorkers.map((worker) => (
                <WorkerRow
                  key={worker.worker_id || worker.name}
                  worker={worker}
                  onAction={handleAction}
                  pendingAction={pendingAction}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateWorkerModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
      {tokenResult && (
        <TokenDisplayModal
          result={tokenResult}
          onClose={() => setTokenResult(null)}
        />
      )}
    </div>
  );
}
