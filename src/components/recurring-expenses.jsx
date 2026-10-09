import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { T, useLang } from "../i18n.jsx";
import { FinancialValue } from "./financial-value.jsx";
import { LedgerSplit } from "./ledger-split.jsx";
import "./recurring-expenses.css";

const frequencies = () => [
  ["weekly", T("Every week", "每周")],
  ["monthly", T("Every month", "每月")],
  ["quarterly", T("Every quarter", "每季度")],
  ["yearly", T("Every year", "每年")],
];
const weekdays = () => [
  T("Monday"),
  T("Tuesday"),
  T("Wednesday"),
  T("Thursday"),
  T("Friday"),
  T("Saturday"),
  T("Sunday"),
];

export function RecurringScheduleFields({ schedule, onChange, disabled = false }) {
  useLang();
  const id = useId();
  const update = (name, value) => onChange({ ...schedule, [name]: value });
  const number = (event) => (event.target.value === "" ? "" : Number(event.target.value));
  const frequency = schedule.frequency || "monthly";
  return (
    <div className="ledger-fields recurring-schedule-fields">
      <div className="ledger-field">
        <label htmlFor={`${id}-frequency`}>{T("Frequency")}</label>
        <select
          id={`${id}-frequency`}
          value={frequency}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...schedule,
              frequency: event.target.value,
              weekday: schedule.weekday ?? 1,
              day: schedule.day ?? 1,
              quarterMonth: schedule.quarterMonth ?? 1,
              month: schedule.month ?? 1,
            })
          }
        >
          {frequencies().map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {frequency === "weekly" && (
        <div className="ledger-field">
          <label htmlFor={`${id}-weekday`}>{T("Weekday")}</label>
          <select
            id={`${id}-weekday`}
            value={schedule.weekday ?? 1}
            disabled={disabled}
            onChange={(event) => update("weekday", Number(event.target.value))}
          >
            {weekdays().map((label, index) => (
              <option key={index + 1} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {frequency !== "weekly" && (
        <label>
          {T("Day of month")}
          <input
            type="number"
            min="1"
            max="31"
            required
            value={schedule.day ?? 1}
            disabled={disabled}
            onChange={(event) => update("day", number(event))}
          />
        </label>
      )}
      {frequency === "quarterly" && (
        <div className="ledger-field">
          <label htmlFor={`${id}-quarter`}>{T("Month of quarter")}</label>
          <select
            id={`${id}-quarter`}
            value={schedule.quarterMonth ?? 1}
            disabled={disabled}
            onChange={(event) => update("quarterMonth", Number(event.target.value))}
          >
            {[T("First month"), T("Second month"), T("Third month")].map((label, index) => (
              <option key={index + 1} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {frequency === "yearly" && (
        <label>
          {T("Month of year")}
          <input
            type="number"
            min="1"
            max="12"
            required
            value={schedule.month ?? 1}
            disabled={disabled}
            onChange={(event) => update("month", number(event))}
          />
        </label>
      )}
      <label>
        {T("Time zone")}
        <input
          value={schedule.timezone || ""}
          required
          maxLength={100}
          disabled={disabled}
          placeholder={T("e.g. Europe/Paris")}
          onChange={(event) => update("timezone", event.target.value)}
        />
      </label>
      <label>
        {T("End date (optional)")}
        <input
          type="date"
          value={schedule.endOn || ""}
          min={schedule.startOn || undefined}
          disabled={disabled}
          onChange={(event) => update("endOn", event.target.value || null)}
        />
      </label>
    </div>
  );
}

const statusName = (status) =>
  ({
    active: T("Active"),
    paused: T("Paused"),
    blocked: T("Blocked"),
    completed: T("Completed"),
    canceled: T("Canceled"),
  })[status] || T("Unavailable");
const canChange = (rule) => ["active", "paused", "blocked"].includes(rule.status);
const canDelete = (rule) => canChange(rule) || rule.status === "completed";
const blockedReason = (code) =>
  ({
    CATCHUP_REVIEW_REQUIRED: T(
      "More than 12 periods are overdue. Review this schedule and change its start date, or resume it for future occurrences."
    ),
    INVALID_CATEGORY: T(
      "This schedule’s category is unavailable. Choose an active category before resuming."
    ),
    GITHUB_ACCESS_REQUIRED: T(
      "Project access changed. Review access before resuming this schedule."
    ),
    SCHEDULE_AUTHORIZATION_CHANGED: T(
      "Schedule access changed. Review your ledger permissions before resuming."
    ),
    RECORD_LIMIT: T("Expense record allowance reached. Existing records remain available."),
    WRITE_RATE_LIMIT: T("Too many changes in a short time. Wait a minute before trying again."),
    MONTHLY_WRITE_LIMIT: T("Monthly write allowance reached."),
  })[code] ||
  T("This schedule is blocked. Review its category and project access before resuming.");
const isAccessFailure = (error) => {
  const code = error?.code || error?.payload?.error?.code;
  return (
    [401, 403, 404].includes(error?.status) &&
    !code?.startsWith("GITHUB_") &&
    code !== "RECURRING_RULE_LIMIT"
  );
};
const scopeKey = (target) =>
  target?.kind === "project"
    ? `project:${target.projectId || ""}`
    : target?.kind === "shared"
      ? "shared"
      : "";
const sameTarget = (left, right) => scopeKey(left) === scopeKey(right) && Boolean(scopeKey(right));
const validRule = (rule, target) =>
  Boolean(
    rule &&
    typeof rule.id === "string" &&
    rule.id &&
    Number.isSafeInteger(rule.revision) &&
    rule.revision > 0 &&
    sameTarget(rule.target, target)
  );

function templateFields(rule, fields, schedule) {
  const frequency = schedule.frequency;
  return {
    target: rule.target,
    amount: fields.amount,
    currency: fields.currency,
    categoryId: fields.categoryId,
    purpose: fields.purpose,
    note: fields.note ?? null,
    quantity: fields.quantity ?? null,
    unit: fields.unit ?? null,
    schedule: {
      frequency,
      timezone: schedule.timezone?.trim(),
      startOn: schedule.startOn || fields.occurredOn,
      endOn: schedule.endOn || null,
      ...(frequency === "weekly"
        ? { weekday: Number(schedule.weekday) }
        : { day: Number(schedule.day) }),
      ...(frequency === "quarterly" ? { quarterMonth: Number(schedule.quarterMonth) } : {}),
      ...(frequency === "yearly" ? { month: Number(schedule.month) } : {}),
    },
  };
}

export function RecurringExpenses({
  api,
  target,
  categories = [],
  canManage = false,
  disabled = false,
  reloadSignal,
  onAccessChanged,
  renderExpenseForm,
  formatTotal,
}) {
  useLang();
  const key = scopeKey(target);
  const live = useRef(null);
  live.current = { api, key, canManage, disabled, onAccessChanged };
  const mounted = useRef(false);
  const readController = useRef(null);
  const mutationController = useRef(null);
  const readSequence = useRef(0);
  const actionPending = useRef(false);
  const refreshPending = useRef(false);
  const needsReload = useRef(false);
  const cursors = useRef(new Set());
  const openers = useRef(new Map());
  const editorRef = useRef(null);
  const reloadRef = useRef(null);
  const pendingFocus = useRef(null);
  const editorFocus = useRef(false);
  const [records, setRecords] = useState({ api, key, items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState("");
  const [pageError, setPageError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editor, setEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const current = useCallback(
    (scope) =>
      mounted.current &&
      live.current.api === scope.api &&
      live.current.key === scope.key &&
      live.current.canManage === scope.canManage,
    []
  );
  const visible = records.api === api && records.key === key;
  const items = visible ? records.items : [];
  const nextCursor = visible ? records.nextCursor : null;

  const loseAccess = useCallback(
    (scope, error) => {
      if (!current(scope)) return;
      readController.current?.abort();
      mutationController.current?.abort();
      readSequence.current += 1;
      setRecords({ api: scope.api, key: scope.key, items: [], nextCursor: null });
      setEditor(null);
      setConfirmation(null);
      setLoading(false);
      setBusy(false);
      actionPending.current = false;
      refreshPending.current = false;
      needsReload.current = true;
      pendingFocus.current = null;
      live.current.onAccessChanged?.(error);
    },
    [current]
  );

  const load = useCallback(
    async ({ append = false, explicit = false } = {}) => {
      const scope = { api, key, canManage };
      if (!current(scope) || !key) return;
      if (actionPending.current) {
        refreshPending.current = true;
        return;
      }
      if (explicit) {
        setConfirmation(null);
        setActionError("");
        pendingFocus.current = null;
        needsReload.current = true;
      }
      const cursor = append ? records.nextCursor : null;
      if (append && !cursor) return;
      readController.current?.abort();
      const controller = new AbortController();
      readController.current = controller;
      const sequence = ++readSequence.current;
      setLoading(true);
      if (append) setPageError("");
      else setReadError("");
      try {
        const response = await api.recurringRules(
          {
            target: target.kind,
            ...(target.kind === "project" ? { projectId: target.projectId } : {}),
            ...(cursor ? { cursor } : {}),
          },
          { signal: controller.signal }
        );
        if (!current(scope) || controller.signal.aborted || sequence !== readSequence.current)
          return;
        if (
          !Array.isArray(response?.items) ||
          response.items.some((rule) => !validRule(rule, target))
        )
          throw new Error("INVALID_RECURRING_RESPONSE");
        if (explicit) {
          needsReload.current = false;
          setEditor((previous) => {
            if (!previous) return null;
            const fresh = response.items.find((rule) => rule.id === previous.rule.id);
            return fresh && canChange(fresh)
              ? { ...previous, rule: { ...previous.rule, revision: fresh.revision } }
              : null;
          });
        }
        if (!append) cursors.current.clear();
        if (cursor) cursors.current.add(cursor);
        const repeated = response.nextCursor && cursors.current.has(response.nextCursor);
        setRecords((previous) => {
          const merged = new Map((append ? previous.items : []).map((rule) => [rule.id, rule]));
          response.items.forEach((rule) => merged.set(rule.id, rule));
          return {
            api,
            key,
            items: [...merged.values()],
            nextCursor: repeated ? null : response.nextCursor || null,
          };
        });
        if (repeated)
          setPageError(T("Pagination did not advance. Reload the schedules before continuing."));
        else setPageError("");
      } catch (error) {
        if (!current(scope) || controller.signal.aborted || sequence !== readSequence.current)
          return;
        if (isAccessFailure(error)) loseAccess(scope, error);
        if (append) setPageError(T("More schedules could not be loaded. Retry to continue."));
        else setReadError(T("Recurring schedules could not be loaded. Reload to try again."));
      } finally {
        if (current(scope) && sequence === readSequence.current) setLoading(false);
      }
    },
    [api, key, canManage, current, loseAccess, records.nextCursor, target]
  );

  // The ref keeps scope setup independent of cursor and parent object identities.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    mounted.current = true;
    actionPending.current = false;
    refreshPending.current = false;
    needsReload.current = false;
    mutationController.current = null;
    cursors.current.clear();
    pendingFocus.current = null;
    setRecords({ api, key, items: [], nextCursor: null });
    setEditor(null);
    setConfirmation(null);
    setActionError("");
    setPageError("");
    setBusy(false);
    loadRef.current();
    return () => {
      mounted.current = false;
      readController.current?.abort();
      mutationController.current?.abort();
      readSequence.current += 1;
    };
  }, [api, key, canManage]);
  const previousReload = useRef(reloadSignal);
  useEffect(() => {
    if (previousReload.current === reloadSignal) return;
    previousReload.current = reloadSignal;
    loadRef.current();
  }, [reloadSignal]);

  useLayoutEffect(() => {
    if (busy || disabled) return;
    if (editor && editorFocus.current) {
      editorFocus.current = false;
      editorRef.current?.querySelector('input[type="date"]')?.focus();
    } else if (pendingFocus.current) {
      const { id, action } = pendingFocus.current;
      pendingFocus.current = null;
      const opener = openers.current.get(`${id}:${action}`);
      (opener && !opener.disabled ? opener : reloadRef.current)?.focus();
    }
  }, [editor, confirmation, busy, disabled, records]);

  const mutate = async (rule, kind, fields) => {
    const scope = { api, key, canManage };
    if (
      !current(scope) ||
      live.current.disabled ||
      !scope.canManage ||
      !(kind === "delete" ? canDelete(rule) : canChange(rule)) ||
      actionPending.current ||
      needsReload.current ||
      !sameTarget(rule.target, target)
    )
      return;
    actionPending.current = true;
    readController.current?.abort();
    readSequence.current += 1;
    setLoading(false);
    const controller = new AbortController();
    mutationController.current = controller;
    setBusy(true);
    setActionError("");
    try {
      const response =
        kind === "delete"
          ? await api.removeRecurringRule(rule.id, rule.revision, { signal: controller.signal })
          : await api.updateRecurringRule(rule.id, rule.revision, fields, {
              signal: controller.signal,
            });
      if (!current(scope) || controller.signal.aborted) return;
      if (kind !== "delete" && (!validRule(response, target) || response.id !== rule.id))
        throw new Error("INVALID_RECURRING_RESPONSE");
      setRecords((previous) => ({
        ...previous,
        items:
          kind === "delete"
            ? previous.items.filter((item) => item.id !== rule.id)
            : previous.items.map((item) => (item.id === rule.id ? response : item)),
      }));
      setEditor(null);
      setConfirmation(null);
      pendingFocus.current = {
        id: rule.id,
        action: kind === "edit" ? "edit" : kind === "delete" ? "delete" : "status",
      };
      return { ok: true };
    } catch (error) {
      if (!current(scope) || controller.signal.aborted) return;
      if (isAccessFailure(error)) loseAccess(scope, error);
      // An uncertain write is never retried with an implicitly refreshed revision.
      needsReload.current = true;
      setActionError(
        error?.status === 412
          ? T("Schedule conflict. Your draft is still here. Reload the schedules before retrying.")
          : T("Recurring schedule could not be changed. Reload before retrying.")
      );
      return { error };
    } finally {
      if (
        current(scope) &&
        mutationController.current === controller &&
        !controller.signal.aborted
      ) {
        actionPending.current = false;
        setBusy(false);
        if (refreshPending.current) {
          refreshPending.current = false;
          loadRef.current();
        }
      }
    }
  };

  const close = (rule, action) => {
    if (actionPending.current || live.current.disabled) return;
    pendingFocus.current = { id: rule.id, action };
    setEditor(null);
    setConfirmation(null);
  };
  const ref = (id, action) => (node) => {
    if (node) openers.current.set(`${id}:${action}`, node);
    else openers.current.delete(`${id}:${action}`);
  };
  const blocked = busy || disabled;
  const activeEditor =
    visible && canManage && items.some((rule) => rule.id === editor?.rule.id) ? editor : null;
  if (!key) return null;
  return (
    <LedgerSplit
      enabled={Boolean(activeEditor)}
      className={activeEditor ? "recurring-expenses ledger-entry" : "recurring-expenses"}
      scope={key}
    >
      <section className="panel" aria-busy={loading || busy}>
        <div className="panel-h">
          <h2>{T("Recurring expenses")}</h2>
          <button
            className="btn ghost"
            type="button"
            aria-label={T("Reload recurring schedules")}
            ref={reloadRef}
            disabled={blocked || loading}
            onClick={() => load({ explicit: true })}
          >
            {T("Reload")}
          </button>
        </div>
        <div className="panel-body">
          {items.length > 0 && (
            <p className="ledger-meta">
              {T("{count} recurring schedules").replace("{count}", items.length)}
            </p>
          )}
          {readError && (
            <div className="notice notice-error" role="alert">
              <p>{readError}</p>
            </div>
          )}
          {actionError && (
            <div className="notice notice-error" role="alert">
              <p>{actionError}</p>
            </div>
          )}
          {loading && <p role="status">{T("Loading recurring schedules…")}</p>}
          {!loading && !readError && !items.length && (
            <div className="empty">
              <p>{T("No recurring schedules yet.")}</p>
            </div>
          )}
          <div className="ledger-list">
            {items.map((rule) => {
              const category = categories.find((item) => item.id === rule.categoryId);
              const money =
                typeof rule.amount === "string" &&
                /^\d+(?:\.\d+)?$/.test(rule.amount) &&
                typeof rule.currency === "string";
              const editable = canManage && canChange(rule);
              const deletable = canManage && canDelete(rule);
              const edit = editor?.rule.id === rule.id ? editor : null;
              return (
                <article className="recurring-expenses-row" key={rule.id}>
                  <div className="ledger-row-main">
                    <h3>{rule.purpose}</h3>
                    <p>
                      {category?.name || T("Archived category")} ·{" "}
                      {frequencies().find(([value]) => value === rule.schedule?.frequency)?.[1] ||
                        T("Unavailable")}
                    </p>
                    <p className="ledger-meta">
                      {T("Next occurrence")}: {rule.nextOccurrenceOn || T("No next occurrence")} ·{" "}
                      {rule.schedule?.timezone || T("Unavailable")}
                    </p>
                    {rule.status === "blocked" && (
                      <p className="ledger-meta">{blockedReason(rule.blockedCode)}</p>
                    )}
                    {["paused", "blocked"].includes(rule.status) && (
                      <p className="ledger-meta">
                        {T(
                          "Resuming starts with future occurrences; paused or blocked periods are not backfilled."
                        )}
                      </p>
                    )}
                  </div>
                  <div className="recurring-expenses-side">
                    <FinancialValue
                      className="ledger-amount"
                      currency={rule.currency}
                      numeric={money}
                      value={money ? formatTotal(rule) : T("Unavailable")}
                    />
                    <span className="tag">{statusName(rule.status)}</span>
                    {(editable || deletable) && (
                      <div className="panel-actions">
                        {editable && (
                          <>
                            <button
                              className="btn ghost"
                              type="button"
                              ref={ref(rule.id, "status")}
                              disabled={blocked || needsReload.current}
                              onClick={() =>
                                mutate(rule, "status", {
                                  status: rule.status === "active" ? "paused" : "active",
                                })
                              }
                            >
                              {rule.status === "active" ? T("Pause") : T("Resume")}
                            </button>
                            <button
                              className="btn ghost"
                              type="button"
                              ref={ref(rule.id, "edit")}
                              disabled={blocked || needsReload.current}
                              onClick={() => {
                                if (actionPending.current || live.current.disabled) return;
                                pendingFocus.current = null;
                                setConfirmation(null);
                                if (edit) {
                                  editorRef.current?.querySelector('input[type="date"]')?.focus();
                                  return;
                                }
                                editorFocus.current = true;
                                setEditor({ rule });
                              }}
                            >
                              {T("Edit schedule")}
                            </button>
                          </>
                        )}
                        {deletable && (
                          <button
                            className="btn ghost"
                            type="button"
                            ref={ref(rule.id, "delete")}
                            disabled={blocked || needsReload.current}
                            onClick={() => {
                              if (actionPending.current || live.current.disabled) return;
                              pendingFocus.current = null;
                              setEditor(null);
                              setConfirmation(rule);
                            }}
                          >
                            {T("Delete schedule")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {confirmation?.id === rule.id && (
                    <div className="notice">
                      <p>
                        {T(
                          "Delete this schedule permanently? Already created expense records are retained."
                        )}
                      </p>
                      <div className="panel-actions">
                        <button
                          className="btn"
                          type="button"
                          autoFocus
                          disabled={blocked || needsReload.current}
                          onClick={() => mutate(confirmation, "delete")}
                        >
                          {T("Confirm delete schedule")}
                        </button>
                        <button
                          className="btn ghost"
                          type="button"
                          disabled={blocked}
                          onClick={() => close(rule, "delete")}
                        >
                          {T("Cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {pageError && (
            <div className="notice notice-error" role="alert">
              <p>{pageError}</p>
            </div>
          )}
          {nextCursor && (
            <div className="panel-actions">
              <button
                className="btn ghost"
                type="button"
                disabled={blocked || loading}
                onClick={() => load({ append: true })}
              >
                {T("Load more schedules")}
              </button>
            </div>
          )}
        </div>
      </section>
      {activeEditor && (
        <section
          className="panel recurring-expenses-editor"
          ref={editorRef}
          key={activeEditor.rule.id}
          aria-busy={busy}
        >
          <div className="panel-h">
            <h2>{T("Edit schedule")}</h2>
          </div>
          {renderExpenseForm({
            value: activeEditor.rule,
            recurrence: activeEditor.rule.schedule,
            busy: blocked,
            submitDisabled: needsReload.current,
            onSubmit: (fields, _key, schedule) =>
              mutate(
                activeEditor.rule,
                "edit",
                templateFields(activeEditor.rule, fields, schedule)
              ),
            onCancel: () => close(activeEditor.rule, "edit"),
          })}
        </section>
      )}
    </LedgerSplit>
  );
}
