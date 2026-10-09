import { useCallback, useEffect, useRef, useState } from "react";
import { T, useLang } from "../i18n.jsx";
import { I } from "../icons.jsx";
import { FinancialValue } from "./financial-value.jsx";
import "./activity-log.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 50;
const MAX_ITEMS = 500;
const keyForTarget = (target) =>
  target?.kind === "project" ? `project:${target.projectId}` : "shared";
const fieldLabel = (field) =>
  ({
    purpose: T("Purpose"),
    amount: T("Amount"),
    currency: T("Currency"),
    occurredOn: T("Date"),
    categoryId: T("Category"),
    note: T("Note"),
    quantity: T("Quantity"),
    unit: T("Unit"),
    target: T("Target"),
    name: T("Name"),
    description: T("Description"),
    developmentUrl: T("Development URL (optional)"),
    productUrl: T("Product URL (optional)"),
    status: T("Status"),
    githubRepoIds: T("GitHub repositories"),
    githubOrganizationId: T("GitHub organization"),
    schedule: T("Schedule"),
    frequency: T("Frequency"),
    timezone: T("Time zone"),
    startOn: T("Start date"),
    endOn: T("End date"),
    weekday: T("Weekday"),
    day: T("Day of month"),
    quarterMonth: T("Month of quarter"),
    month: T("Month of year"),
  })[field] || field;

const actionLabel = (action) =>
  ({
    create: T("Created"),
    update: T("Updated"),
    delete: T("Deleted"),
    archive: T("Archived"),
    restore: T("Restored"),
    pause: T("Paused"),
    resume: T("Resumed"),
    cancel: T("Canceled"),
    move: T("Moved"),
    generate: T("Generated"),
  })[action] || T("Changed");
const resourceLabel = (kind) =>
  ({
    expense: T("Expense"),
    project: T("Project"),
    recurring_rule: T("Recurring schedule"),
  })[kind] || T("Record");

function changeValue(value, field) {
  if (value === null || value === undefined || value === "") return T("Not set");
  if (field === "status")
    return (
      {
        active: T("Active"),
        archived: T("Archived"),
        paused: T("Paused"),
        blocked: T("Blocked"),
        completed: T("Completed"),
        canceled: T("Canceled"),
      }[value] || String(value)
    );
  if (field === "frequency")
    return (
      {
        weekly: T("Every week"),
        monthly: T("Every month"),
        quarterly: T("Every quarter"),
        yearly: T("Every year"),
      }[value] || String(value)
    );
  if (Array.isArray(value)) return value.length ? value.join(", ") : T("Not set");
  if (typeof value === "object") {
    if (field === "categoryId") return value.name || value.id || T("Unavailable");
    if (field === "target")
      return value.kind === "restricted"
        ? T("Restricted target")
        : value.kind === "shared"
          ? T("Shared pool")
          : value.kind === "project"
            ? `${T("Project")}: ${value.projectName || value.projectId || T("Unavailable")}`
            : T("Unavailable");
    return Object.entries(value)
      .map(([name, entry]) => `${fieldLabel(name)}: ${changeValue(entry, name)}`)
      .join(" · ");
  }
  return String(value);
}

function ChangeValue({ value, field }) {
  if (field === "amount" && value && typeof value === "object" &&
    typeof value.amount === "string" && typeof value.currency === "string")
    return <FinancialValue value={`${value.currency} ${value.amount}`} currency={value.currency} />;
  return changeValue(value, field);
}

function ActivityRow({ item, language }) {
  const actor = item.actor || {};
  const user = actor.name || actor.githubLogin || actor.userId || T("Unavailable");
  const name =
    actor.kind === "system"
      ? `${T("Automated schedule")}${actor.name || actor.githubLogin || actor.userId ? ` · ${user}` : ""}`
      : actor.kind === "api_key"
        ? `${T("API key")} · ${user}`
        : user;
  const created = new Date(item.createdAt);
  const time = Number.isFinite(created.getTime())
    ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "long" }).format(created)
    : T("Unavailable");
  return (
    <article className="activity-log-row">
      <div className="activity-log-row-header">
        <p className="activity-log-actor">
          <strong>{name}</strong>
          {actor.githubLogin && <span>@{actor.githubLogin}</span>}
        </p>
        <time dateTime={item.createdAt} title={time}>{time}</time>
      </div>
      <h3>
        <span className="activity-log-action">{actionLabel(item.action)} · {resourceLabel(item.resource.kind)}</span>
        <span>{item.resource.label || item.resource.id}</span>
      </h3>
      <p className="ledger-meta">{T("Record ID")}: {item.resource.id}</p>
      {item.changes.length > 0 && (
        <dl className="activity-log-changes">
          {item.changes.map((change, index) => (
            <div key={`${change.field}:${index}`}>
              <dt>{fieldLabel(change.field)}</dt>
              <dd>
                <span><span className="activity-log-value-label">{T("Before")}: </span><ChangeValue value={change.before} field={change.field} /></span>
                <I.ArrowR size={14} aria-hidden="true" />
                <span><span className="activity-log-value-label">{T("After")}: </span><ChangeValue value={change.after} field={change.field} /></span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

function validItem(item, target) {
  return Boolean(
    item &&
    typeof item.id === "string" &&
    item.id &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    item.resource &&
    typeof item.resource.id === "string" &&
    typeof item.resource.kind === "string" &&
    item.actor &&
    Array.isArray(item.changes) &&
    item.changes.every((change) => change && typeof change.field === "string") &&
    ["shared", "project"].includes(item.target?.kind) &&
    (item.target.kind !== "project" || typeof item.target.projectId === "string") &&
    keyForTarget(item.target) === keyForTarget(target)
  );
}

export function ActivityLog(props) {
  return <ScopedActivityLog key={keyForTarget(props.target)} {...props} />;
}

function ScopedActivityLog({ api, target, active, disabled = false, reloadSignal = 0, onAccessChanged }) {
  const language = useLang();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now);
  const [needed, setNeeded] = useState(true);
  const mounted = useRef(false);
  const request = useRef(null);
  const seenCursors = useRef(new Set());
  const loadedSignal = useRef(reloadSignal);
  const currentApi = useRef(api);
  const kind = target.kind;
  const projectId = target.projectId || "";
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      request.current = null;
    };
  }, []);
  useEffect(() => {
    if (currentApi.current === api) return;
    currentApi.current = api;
    request.current?.abort();
    request.current = null;
    seenCursors.current.clear();
    setPage(null);
    setError("");
    setLoading(false);
    setNeeded(true);
  }, [api]);

  const load = useCallback(async (cursor = null) => {
    if (disabled || request.current || !mounted.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setNeeded(false);
    const params = { target: kind, ...(kind === "project" ? { projectId } : {}), limit: PAGE_SIZE,
      ...(cursor ? { cursor } : {}) };
    try {
      const result = await api.activity(params, { signal: controller.signal });
      if (controller.signal.aborted || !mounted.current || request.current !== controller) return;
      if (!result || !Array.isArray(result.items) || result.items.length > PAGE_SIZE ||
        !result.items.every((item) => validItem(item, { kind, projectId })) ||
        !Number.isFinite(Date.parse(result.windowStart)) || !Number.isFinite(Date.parse(result.windowEnd)) ||
        (result.nextCursor !== null && typeof result.nextCursor !== "string"))
        throw new Error("Invalid activity response");
      if (result.nextCursor && cursor && (result.nextCursor === cursor || seenCursors.current.has(result.nextCursor))) {
        setPage((old) => old && { ...old, nextCursor: null });
        throw new Error("Pagination did not advance");
      }
      if (!cursor) seenCursors.current.clear();
      if (cursor) seenCursors.current.add(cursor);
      const receivedAt = Date.now();
      setClock(receivedAt);
      setPage((old) => {
        const items = cursor ? [...(old?.items || []), ...result.items] : result.items;
        return { ...result, items: [...new Map(items.map((item) => [item.id, item])).values()].slice(0, MAX_ITEMS), receivedAt };
      });
    } catch (failure) {
      if (controller.signal.aborted || !mounted.current || request.current !== controller) return;
      const code = failure?.code || failure?.payload?.error?.code;
      if ([401, 403].includes(failure?.status) || ["WORKSPACE_NOT_FOUND", "PROJECT_NOT_FOUND"].includes(code)) {
        setPage(null);
        onAccessChanged?.(failure);
      }
      setError(failure?.message === "Pagination did not advance"
        ? "pagination" : cursor ? "more" : "load");
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (mounted.current) setLoading(false);
      }
    }
  }, [api, disabled, kind, projectId, onAccessChanged]);

  useEffect(() => {
    if (loadedSignal.current === reloadSignal) return;
    loadedSignal.current = reloadSignal;
    setNeeded(true);
  }, [reloadSignal]);
  useEffect(() => {
    if (active && needed && !disabled && !loading) load();
  }, [active, needed, disabled, loading, load]);

  // Expire displayed history locally. This timer never makes an API request.
  const cutoff = page ? Date.parse(page.windowStart) + Math.max(0, clock - page.receivedAt) : clock - DAY_MS;
  const items = page?.items.filter((item) => Date.parse(item.createdAt) > cutoff) || [];
  useEffect(() => {
    if (active) setClock(Date.now());
  }, [active]);
  useEffect(() => {
    if (!active || !page) return;
    const now = Date.now();
    const elapsed = Math.max(0, now - page.receivedAt);
    const liveCutoff = Date.parse(page.windowStart) + elapsed;
    const nextExpiry = page.items.map((item) => Date.parse(item.createdAt)).filter((time) => time > liveCutoff).sort((a, b) => a - b)[0];
    if (nextExpiry === undefined) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.max(1, nextExpiry - liveCutoff + 1));
    return () => clearTimeout(timer);
  }, [active, page, clock]);

  const errorMessage = error === "pagination"
    ? T("Operation log pagination did not advance. Reload to continue.")
    : error === "more"
      ? T("More changes could not be loaded. Retry to continue.")
      : T("Operation log could not be loaded. Reload to try again.");
  return (
    <section className="panel activity-log" aria-busy={loading}>
      <div className="panel-h">
        <I.Clock size={20} aria-hidden="true" />
        <h2>{T("Operation log")}</h2>
        <button className="btn ghost" type="button" disabled={disabled || loading} onClick={() => load()}>
          <I.Refresh size={14} aria-hidden="true" /> {T("Reload operation log")}
        </button>
      </div>
      <p className="ledger-help">{T("Changes from the past 24 hours. Times are shown in your local time zone.")}</p>
      {error && <p className="notice notice-error" role="alert">{errorMessage}</p>}
      {loading && <p role="status">{T("Loading operation log…")}</p>}
      {page && items.length === 0 && !loading && !error && <p className="empty">{T("No changes in the past 24 hours.")}</p>}
      {items.length > 0 && (
        <div className="ledger-list activity-log-list">
          {items.map((item) => <ActivityRow key={item.id} item={item} language={language} />)}
        </div>
      )}
      {page?.nextCursor && page.items.length < MAX_ITEMS && (
        <div className="panel-actions">
          <button className="btn" type="button" disabled={disabled || loading} onClick={() => load(page.nextCursor)}>{T("Load more")}</button>
        </div>
      )}
      {page?.nextCursor && page.items.length >= MAX_ITEMS && <p className="ledger-help">{T("Reload to see the latest changes.")}</p>}
    </section>
  );
}
