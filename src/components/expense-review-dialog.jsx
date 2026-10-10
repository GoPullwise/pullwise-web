import { useEffect, useId, useRef, useState } from "react";
import { FinancialValue } from "./financial-value.jsx";
import { useModalFocus } from "../lib/modal-focus.js";
import { useModalBackdrop } from "../lib/modal-backdrop.js";
import { categoryDisplayName } from "../lib/category-label.js";
import { T, useLang } from "../i18n.jsx";
import { I } from "../icons.jsx";
import "./expense-review-dialog.css";

const LIMIT = 100;
const CHECK_STATUSES = new Set(["checked", "issue", "uncertain", "unavailable"]);

function validScore(value) {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)
  );
}

function validResult(result, expense, target) {
  const category = result?.checks?.category;
  const destination = result?.checks?.target;
  const duplicate = result?.checks?.duplicate;
  return (
    result?.expenseId === expense.id &&
    result.revision === expense.revision &&
    category?.current === expense.categoryId &&
    sameTarget(destination?.current, target) &&
    CHECK_STATUSES.has(category.status) &&
    CHECK_STATUSES.has(destination.status) &&
    validScore(category.confidence) &&
    validScore(destination.confidence) &&
    (category.suggested === undefined ||
      (typeof category.suggested === "string" && category.suggested.length > 0)) &&
    (category.status !== "issue" || Boolean(category.suggested)) &&
    (destination.suggested === undefined ||
      (["project", "shared"].includes(destination.suggested?.kind) &&
        destination.suggested.projectId === undefined)) &&
    (destination.status !== "issue" || Boolean(destination.suggested)) &&
    ["checked", "issue"].includes(duplicate?.status) &&
    (duplicate.status !== "issue" ||
      (typeof duplicate.candidate?.id === "string" &&
        duplicate.candidate.id.length > 0 &&
        duplicate.candidate.id !== expense.id &&
        Number.isSafeInteger(duplicate.candidate.revision) &&
        duplicate.candidate.revision > 0))
  );
}

function sameTarget(left, right) {
  return (
    left?.kind === right?.kind &&
    (left?.kind === "shared" || (left?.kind === "project" && left.projectId === right.projectId))
  );
}

function reviewRecords(page, target) {
  if (
    !Array.isArray(page?.items) ||
    page.items.length > LIMIT ||
    page.items.some(
      (expense) =>
        typeof expense?.id !== "string" ||
        !expense.id ||
        !Number.isSafeInteger(expense.revision) ||
        expense.revision < 1 ||
        !sameTarget(expense.target, target)
    ) ||
    new Set(page.items.map((expense) => expense.id)).size !== page.items.length ||
    (!page.items.length && page.nextCursor) ||
    (page.nextCursor != null && (typeof page.nextCursor !== "string" || !page.nextCursor))
  )
    throw new Error("Invalid review selection");
  return page.items;
}

function reviewError(failure) {
  const code = failure?.code || failure?.payload?.error?.code;
  if (code === "JEV_BUDGET_LIMIT")
    return T(
      "Monthly Jev budget reached. Continue manually.",
      "本月 Jev 预算已用完，请继续手工记账。"
    );
  if (code === "JEV_PLAN_REQUIRED" || code === "MAX_REQUIRED")
    return T(
      "Jev assistance requires the ledger Owner's Pro or Max plan.",
      "Jev 辅助需要账本所有者的 Pro 或 Max 套餐。"
    );
  if (failure?.status === 412)
    return T(
      "This expense changed. Reload it before reviewing again.",
      "此支出已变更，请重新加载后再巡检。"
    );
  if ([401, 403].includes(failure?.status))
    return T(
      "Access changed. Reload the ledger before reviewing.",
      "访问权限已变更，请重新加载账本后再巡检。"
    );
  if (failure?.status === 404) return T("This expense is no longer available.", "此支出已不可用。");
  return T(
    "This expense could not be reviewed. Start a new review to try again.",
    "无法巡检此支出，请主动开始新的巡检后重试。"
  );
}

function statusLabel(status) {
  return (
    {
      checked: T("Checked", "已检查"),
      issue: T("Needs review", "待复核"),
      uncertain: T("Uncertain", "不确定"),
      unavailable: T("Unavailable", "不可用"),
    }[status] || T("Uncertain", "不确定")
  );
}

function Score({ confidence }) {
  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  )
    return null;
  return (
    <p>
      {T("Confidence (0–1)", "评分（0–1）")}:{" "}
      <span className="numeric-count">{String(confidence)}</span>
    </p>
  );
}

function ReviewChecks({ result, expense, records, categories }) {
  const category = result.checks.category;
  const target = result.checks.target;
  const duplicate = result.checks.duplicate;
  const categoryName = (id) =>
    categoryDisplayName(
      categories.find((item) => item.id === id),
      T("Removed", "已移除"),
      T("Category not loaded", "类别尚未加载")
    );
  const targetName = (kind) => (kind === "shared" ? T("Shared expense pool") : T("Project"));
  const candidate =
    duplicate.candidate &&
    records.find(
      (item) =>
        item.id === duplicate.candidate.id &&
        item.revision === duplicate.candidate.revision &&
        sameTarget(item.target, expense.target)
    );
  return (
    <div className="expense-review-checks">
      <section data-check="category" data-status={category.status}>
        <h4>
          {T("Category")}: <span>{statusLabel(category.status)}</span>
        </h4>
        <p>
          {T("Current", "当前")}: {categoryName(expense.categoryId)}
        </p>
        {category.suggested && (
          <p>
            {T("Suggested choice", "建议选项")}: {categoryName(category.suggested)}
          </p>
        )}
        <Score confidence={category.confidence} />
        {category.status === "uncertain" && (
          <p>{T("No confident choice. Review it manually.", "没有可靠选项，请手动复核。")}</p>
        )}
        {category.status === "unavailable" && (
          <p>
            {category.reason === "no_categories"
              ? T("No active category can be compared.", "没有可用于比较的启用类别。")
              : T("Jev is unavailable for this check.", "此项检查暂时无法使用 Jev。")}
          </p>
        )}
      </section>
      <section data-check="target" data-status={target.status}>
        <h4>
          {T("Target", "归属")}: <span>{statusLabel(target.status)}</span>
        </h4>
        <p>
          {T("Current", "当前")}: {targetName(expense.target.kind)}
        </p>
        {target.suggested && (
          <p>
            {T("Suggested choice", "建议选项")}: {targetName(target.suggested.kind)}
          </p>
        )}
        <Score confidence={target.confidence} />
        {target.status === "uncertain" && (
          <p>{T("No confident choice. Review it manually.", "没有可靠选项，请手动复核。")}</p>
        )}
        {target.status === "unavailable" && (
          <p>{T("Jev is unavailable for this check.", "此项检查暂时无法使用 Jev。")}</p>
        )}
      </section>
      <section data-check="duplicate" data-status={duplicate.status}>
        <h4>
          {T("Possible duplicate", "疑似重复")}: <span>{statusLabel(duplicate.status)}</span>
        </h4>
        {duplicate.status === "checked" ? (
          <p>{T("No matching duplicate found.", "未找到匹配的重复记录。")}</p>
        ) : (
          <p>
            {candidate ? (
              <>
                {candidate.purpose} · {candidate.occurredOn} ·{" "}
                <FinancialValue
                  value={`${candidate.currency} ${candidate.amount}`}
                  currency={candidate.currency}
                />
              </>
            ) : (
              T(
                "A possible duplicate is outside the loaded records.",
                "疑似重复记录不在当前已加载的账目中。"
              )
            )}
          </p>
        )}
      </section>
    </div>
  );
}

export function ExpenseReviewDialog({
  open,
  query,
  categories,
  target,
  scopeLabel,
  api,
  backgroundRef,
  blocked = false,
  beginOperation,
  beginEditRead,
  onOpenEdit,
  onAccessFailure,
  onClose,
}) {
  useLang();
  const dialogId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const progressRef = useRef(null);
  const mountedRef = useRef(false);
  const profileRef = useRef(null);
  const recordsRef = useRef(null);
  const recordsLoadedRef = useRef(false);
  const runRef = useRef(null);
  const editRef = useRef(null);
  const accessFailureRef = useRef(onAccessFailure);
  accessFailureRef.current = onAccessFailure;
  const [records, setRecords] = useState([]);
  const [recordsState, setRecordsState] = useState("loading");
  const [selected, setSelected] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState("loading");
  const [results, setResults] = useState({});
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const eligible = profile?.entitlements?.jev?.eligible === true;
  const available = profile?.entitlements?.jev?.available === true;
  const budget = profile?.entitlements?.jev?.monthlyBudgetUsd;
  const budgetText =
    typeof budget === "string" && /^\d+(?:\.\d{1,6})?$/.test(budget) ? budget : null;

  const stop = () => {
    const run = runRef.current;
    if (!run || run.controller.signal.aborted) return;
    progressRef.current?.focus({ preventScroll: true });
    setStopping(true);
    run.controller.abort();
    setResults((old) =>
      Object.fromEntries(
        Object.entries(old).map(([id, item]) => [
          id,
          item.state === "queued" || item.state === "running" ? { state: "cancelled" } : item,
        ])
      )
    );
  };
  const close = () => {
    stop();
    recordsRef.current?.controller.abort();
    editRef.current?.controller.abort();
    onClose();
  };
  const backdropProps = useModalBackdrop({ open, onClose: close });
  useModalFocus({ open, dialogRef, initialFocusRef: closeRef, backgroundRef, onClose: close });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      profileRef.current?.abort();
      recordsRef.current?.controller.abort();
      runRef.current?.controller.abort();
      editRef.current?.controller.abort();
    };
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    profileRef.current = controller;
    setProfile(null);
    setProfileState("loading");
    Promise.resolve()
      .then(() => api.me({ signal: controller.signal }))
      .then((value) => {
        if (!controller.signal.aborted && mountedRef.current) {
          setProfile(value);
          setProfileState("loaded");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted && mountedRef.current) {
          if ([401, 403].includes(failure?.status)) {
            setResults({});
            accessFailureRef.current(failure);
          } else setProfileState("failed");
        }
      });
    return () => controller.abort();
  }, [open, api]);
  useEffect(() => {
    if (!open || recordsLoadedRef.current || recordsRef.current) return undefined;
    const release = beginEditRead();
    if (!release) {
      setRecordsState("failed");
      return undefined;
    }
    const request = { controller: new AbortController(), release };
    recordsRef.current = request;
    const current = () =>
      mountedRef.current && recordsRef.current === request && !request.controller.signal.aborted;
    setRecordsState("loading");
    Promise.resolve()
      .then(() => {
        if (!current()) return undefined;
        return api.expenses({ ...query, limit: LIMIT }, { signal: request.controller.signal });
      })
      .then((page) => {
        if (!current()) return;
        const expenses = reviewRecords(page, target);
        recordsLoadedRef.current = true;
        setRecords(expenses);
        setSelected(expenses.map((expense) => expense.id));
        setRecordsState("loaded");
      })
      .catch((failure) => {
        if (!current()) return;
        setRecords([]);
        setSelected([]);
        if ([401, 403].includes(failure?.status)) {
          setResults({});
          accessFailureRef.current(failure);
        } else setRecordsState("failed");
      })
      .finally(() => {
        if (recordsRef.current === request) recordsRef.current = null;
        request.release();
      });
    return () => request.controller.abort();
  }, [open, api, query, target, beginEditRead]);
  const start = async () => {
    if (
      !open ||
      runRef.current ||
      editRef.current ||
      recordsRef.current ||
      recordsState !== "loaded" ||
      blocked ||
      started ||
      !eligible ||
      !mountedRef.current
    )
      return;
    const chosen = records.filter((item) => selected.includes(item.id));
    if (!chosen.length || chosen.length > LIMIT) return;
    const release = beginOperation();
    if (!release) return;
    const run = { controller: new AbortController(), release };
    runRef.current = run;
    const current = () =>
      mountedRef.current && runRef.current === run && !run.controller.signal.aborted;
    progressRef.current?.focus({ preventScroll: true });
    setStarted(true);
    setRunning(true);
    setStopping(false);
    setError("");
    setResults(Object.fromEntries(chosen.map((item) => [item.id, { state: "queued" }])));
    try {
      for (const expense of chosen) {
        if (!current()) break;
        setResults((old) => ({ ...old, [expense.id]: { state: "running" } }));
        try {
          const result = await api.reviewExpense(expense.id, expense.revision, {
            signal: run.controller.signal,
          });
          if (!current()) break;
          if (!validResult(result, expense, target)) throw new Error("Invalid review response");
          setResults((old) => ({ ...old, [expense.id]: { state: "done", result } }));
        } catch (failure) {
          if (!current()) break;
          if ([401, 403].includes(failure?.status)) {
            setResults({});
            onAccessFailure(failure);
            break;
          }
          setResults((old) => ({
            ...old,
            [expense.id]: { state: "error", error: reviewError(failure) },
          }));
          if (failure?.status === 429 || failure?.status >= 500) {
            setError(reviewError(failure));
            break;
          }
        }
      }
    } finally {
      if (runRef.current === run) {
        runRef.current = null;
        if (mountedRef.current) {
          setResults((old) =>
            Object.fromEntries(
              Object.entries(old).map(([id, item]) => [
                id,
                item.state === "queued" || item.state === "running" ? { state: "cancelled" } : item,
              ])
            )
          );
          setRunning(false);
          setStopping(false);
        }
        run.release();
      }
    }
  };

  const edit = async (expense) => {
    if (blocked || runRef.current || editRef.current || !mountedRef.current) return;
    const release = beginEditRead();
    if (!release) return;
    const request = { controller: new AbortController(), id: expense.id };
    editRef.current = request;
    const current = () =>
      mountedRef.current && editRef.current === request && !request.controller.signal.aborted;
    progressRef.current?.focus({ preventScroll: true });
    setEditingId(expense.id);
    setError("");
    try {
      const fresh = await api.expense(expense.id, { signal: request.controller.signal });
      if (!current()) return;
      if (
        fresh?.id !== expense.id ||
        !sameTarget(fresh.target, target) ||
        !Number.isInteger(fresh.revision) ||
        fresh.revision < 1
      )
        throw new Error("Expense target changed");
      onOpenEdit(fresh);
    } catch (failure) {
      if (current()) {
        if ([401, 403].includes(failure?.status)) {
          setResults({});
          onAccessFailure(failure);
        } else
          setError(
            failure?.status === 404
              ? reviewError(failure)
              : T(
                  "Current expense could not be loaded. Close and reload the ledger to try again.",
                  "无法读取当前支出，请关闭巡检并重新加载账本后重试。"
                )
          );
      }
    } finally {
      if (editRef.current === request) {
        editRef.current = null;
        if (mountedRef.current) setEditingId("");
        release();
      }
    }
  };

  if (!open) return null;
  const visibleRecords = started ? records.filter((item) => results[item.id]) : records;
  return (
    <div className="modal-back expense-review-dialog-back" {...backdropProps}>
      <div
        ref={dialogRef}
        className="modal expense-review-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        aria-describedby={`${dialogId}-description`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-h">
          <h3 id={`${dialogId}-title`}>{T("Expense review", "账目巡检")}</h3>
          <button
            ref={closeRef}
            type="button"
            className="btn ghost icon"
            aria-label={T("Close", "关闭")}
            onClick={close}
          >
            <I.X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body expense-review-dialog-body">
          <div ref={progressRef} className="expense-review-description" tabIndex={0}>
            <p id={`${dialogId}-description`}>
              {T(
                "Select up to 100 expenses matching the current filters. Jev only selects choices and scores; it does not change records.",
                "最多选择 100 条符合当前筛选条件的支出进行巡检。Jev 只选择选项和评分，不会修改账目。"
              )}
            </p>
            <p>{scopeLabel}</p>
            <p>
              {T(
                "The first 100 matching expenses are loaded for review. Other history is not included.",
                "巡检单独读取符合当前筛选条件的前 100 条支出，不包含其他历史记录。"
              )}
            </p>
            <p>
              {T(
                "Only Start review sends inspection requests. The monthly Jev allowance applies; stopping cannot refund an already-started check.",
                "只有点击「开始巡检」才会发送巡检请求。巡检使用 Jev 月度额度，停止不能退还已开始检查的消耗。"
              )}
            </p>
            <p>
              {T(
                "Selected saved purposes and notes, with active category names, may be sent to Jev. Other duplicate candidates' text is excluded. Do not include secrets.",
                "所选账目已保存的用途、备注及启用类别名称可能发送给 Jev，其他疑似重复记录的文字不会发送。请勿包含秘密信息。"
              )}
            </p>
            {budgetText && (
              <p>
                {T("Jev assistance allowance", "Jev 辅助额度")}:{" "}
                <FinancialValue value={`USD ${budgetText}`} currency="USD" /> / {T("month", "月")}
              </p>
            )}
          </div>
          {profileState === "loading" && (
            <p role="status">{T("Checking Jev availability…", "正在检查 Jev 是否可用…")}</p>
          )}
          {recordsState === "loading" && (
            <p role="status">{T("Loading expenses for review…", "正在读取待巡检支出…")}</p>
          )}
          {recordsState === "failed" && (
            <p role="alert">
              {T(
                "Expenses could not be loaded for review. Close and reopen to try again.",
                "无法读取待巡检支出，请关闭并重新打开后重试。"
              )}
            </p>
          )}
          {recordsState === "loaded" && !records.length && (
            <p>{T("No expenses match the current filters.", "当前筛选下没有支出。")}</p>
          )}
          {profileState === "failed" && (
            <p role="alert">
              {T(
                "Jev eligibility could not be checked. Close and reopen to try again.",
                "无法检查 Jev 权益，请关闭并重新打开后重试。"
              )}
            </p>
          )}
          {profileState === "loaded" && (!eligible || !available) && (
            <p role="status">
              {eligible
                ? T(
                    "Jev category and target checks are unavailable. Local duplicate checks remain available.",
                    "Jev 类别与归属检查暂不可用，仍可在本地检查疑似重复记录。"
                  )
                : T(
                    "Jev assistance requires the ledger Owner's Pro or Max plan.",
                    "Jev 辅助需要账本所有者的 Pro 或 Max 套餐。"
                  )}
            </p>
          )}
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          {!started && (
            <p role="status">
              {T("Selected: {count} / 100", "已选择：{count} / 100").replace(
                "{count}",
                String(selected.length)
              )}
            </p>
          )}
          {running && (
            <p role="status">
              {stopping
                ? T("Stopping review…", "正在停止巡检…")
                : T("Reviewing selected expenses…", "正在巡检所选支出…")}
            </p>
          )}
          {started && !running && (
            <p role="status">
              {T("Review ended. Check each result below.", "巡检已结束，请逐项查看下方结果。")}
            </p>
          )}
          {editingId && <p role="status">{T("Loading current expense…", "正在读取当前支出…")}</p>}
          <div className="expense-review-records">
            {visibleRecords.map((expense) => {
              const entry = results[expense.id];
              return (
                <article
                  key={expense.id}
                  className="expense-review-record"
                  data-expense-id={expense.id}
                  data-review-state={entry?.state || "selected"}
                >
                  <div className="expense-review-record-h">
                    {!started && (
                      <label className="expense-review-selection">
                        <input
                          type="checkbox"
                          checked={selected.includes(expense.id)}
                          disabled={
                            blocked || (!selected.includes(expense.id) && selected.length >= LIMIT)
                          }
                          aria-label={T("Review {expense}", "巡检 {expense}").replace(
                            "{expense}",
                            expense.purpose
                          )}
                          onChange={(event) => {
                            if (runRef.current || editRef.current || started || blocked) return;
                            setSelected((old) =>
                              event.target.checked
                                ? old.length < LIMIT && !old.includes(expense.id)
                                  ? [...old, expense.id]
                                  : old
                                : old.filter((id) => id !== expense.id)
                            );
                          }}
                        />
                      </label>
                    )}
                    <div>
                      <h4>{expense.purpose}</h4>
                      <p>{expense.occurredOn}</p>
                    </div>
                    <FinancialValue
                      value={`${expense.currency} ${expense.amount}`}
                      currency={expense.currency}
                    />
                  </div>
                  {entry?.state === "done" && (
                    <ReviewChecks
                      result={entry.result}
                      expense={expense}
                      records={records}
                      categories={categories}
                    />
                  )}
                  {entry?.state === "error" && <p role="alert">{entry.error}</p>}
                  {entry && entry.state !== "done" && entry.state !== "error" && (
                    <p>
                      {
                        {
                          queued: T("Waiting", "待检查"),
                          running: T("Checking…", "检查中…"),
                          cancelled: T("Cancelled", "已取消"),
                        }[entry.state]
                      }
                    </p>
                  )}
                  {entry?.state === "done" && (
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={blocked || running || Boolean(editingId)}
                      onClick={() => edit(expense)}
                      aria-label={T(
                        "Edit reviewed expense {expense}",
                        "编辑已巡检支出 {expense}"
                      ).replace("{expense}", expense.purpose)}
                    >
                      {T("Edit expense")}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={close}>
            {T("Close", "关闭")}
          </button>
          {running ? (
            <button type="button" className="btn" disabled={stopping} onClick={stop}>
              {T("Stop review", "停止巡检")}
            </button>
          ) : started ? (
            <button
              type="button"
              className="btn"
              disabled={blocked || Boolean(editingId)}
              onClick={() => {
                if (!runRef.current && !editRef.current && !blocked) {
                  progressRef.current?.focus({ preventScroll: true });
                  setStarted(false);
                  setResults({});
                  setError("");
                }
              }}
            >
              {T("New selection", "重新选择")}
            </button>
          ) : null}
          <button
            type="button"
            className="btn primary"
            disabled={
              started ||
              running ||
              blocked ||
              !selected.length ||
              recordsState !== "loaded" ||
              !eligible ||
              profileState !== "loaded"
            }
            onClick={start}
          >
            {T("Start review", "开始巡检")}
          </button>
        </div>
      </div>
    </div>
  );
}
