import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { useModalFocus } from "../lib/modal-focus.js";
import { FinancialValue } from "./financial-value.jsx";
import { useNotify } from "./notifications.jsx";

const InboxContext = createContext(null);
const AUTOMATIC_REFRESH_GAP_MS = 10000;
const joinRequestsTitle = () =>
  T("Join requests", {
    zh: "加入申请",
    ja: "参加申請",
    ko: "참여 요청",
    fr: "Demandes d’accès",
    es: "Solicitudes para unirse",
  });
const title = () =>
  T("Inbox", {
    zh: "站内信",
    ja: "受信トレイ",
    ko: "받은 편지함",
    fr: "Boîte de réception",
    es: "Bandeja de entrada",
  });
const pendingExpensesTitle = () =>
  T("Pending expenses", {
    zh: "待补记支出",
    ja: "未記帳の支出",
    ko: "미기록 지출",
    fr: "Dépenses à enregistrer",
    es: "Gastos pendientes de registrar",
  });
const openRecurringLabel = () =>
  T("Open recurring plan", {
    zh: "打开周期计划",
    ja: "定期プランを開く",
    ko: "정기 계획 열기",
    fr: "Ouvrir le plan récurrent",
    es: "Abrir plan recurrente",
  });
const expenseLimitLabel = () =>
  T("Expense record limit reached", {
    zh: "支出记录已满额",
    ja: "支出記録の上限に達しました",
    ko: "지출 기록 한도에 도달했습니다",
    fr: "Limite des dépenses enregistrées atteinte",
    es: "Se alcanzó el límite de registros de gastos",
  });
const recurringUnavailable = () =>
  T("Pending expenses unavailable.", {
    zh: "暂时无法加载待补记支出。",
    ja: "未記帳の支出を読み込めません。",
    ko: "미기록 지출을 불러올 수 없습니다.",
    fr: "Les dépenses à enregistrer sont indisponibles.",
    es: "Los gastos pendientes no están disponibles.",
  });
const emptyState = (identity) => ({
  identity,
  items: [],
  status: "idle",
  error: "",
  hasMore: false,
  requestsReady: false,
  expenses: [],
  expenseError: "",
  expenseHasMore: false,
  expensesReady: false,
});
const reviewLabel = () =>
  T("Review request", {
    zh: "审核申请",
    ja: "申請を確認",
    ko: "요청 검토",
    fr: "Examiner la demande",
    es: "Revisar solicitud",
  });

export function InvitationInboxProvider({
  identity = "",
  enabled,
  navigationKey,
  navigationDisabled = false,
  onReview,
  onOpenRecurring,
  children,
  api = ledgerApi,
}) {
  useLang();
  const { notify, dismiss } = useNotify();
  const [state, setState] = useState(() => emptyState(identity));
  const [open, setOpen] = useState(false);
  const current = useRef({ identity, enabled, onReview, onOpenRecurring, navigationDisabled });
  current.current = { identity, enabled, onReview, onOpenRecurring, navigationDisabled };
  const previousIdentity = useRef(identity);
  const request = useRef(null);
  const lastAutomaticRead = useRef(0);
  const seen = useRef(new Set());
  const toastIds = useRef(new Set());
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  const review = useCallback((item, owner = current.current.identity) => {
    if (
      !current.current.enabled ||
      current.current.identity !== owner ||
      current.current.navigationDisabled
    )
      return false;
    if (current.current.onReview?.(item) === false) return false;
    setOpen(false);
    return true;
  }, []);

  const openRecurring = useCallback((item, owner = current.current.identity) => {
    if (
      !current.current.enabled ||
      current.current.identity !== owner ||
      current.current.navigationDisabled ||
      typeof current.current.onOpenRecurring !== "function"
    )
      return false;
    if (current.current.onOpenRecurring(item) === false) return false;
    setOpen(false);
    return true;
  }, []);

  const refresh = useCallback(
    async ({ automatic = false } = {}) => {
      if (!current.current.enabled || (automatic && request.current)) return;
      if (
        automatic &&
        lastAutomaticRead.current &&
        Date.now() - lastAutomaticRead.current < AUTOMATIC_REFRESH_GAP_MS
      )
        return;
      request.current?.abort();
      lastAutomaticRead.current = Date.now();
      const controller = new AbortController();
      const requestIdentity = current.current.identity;
      request.current = controller;
      setState((old) => ({ ...old, status: "loading", error: "", expenseError: "" }));
      try {
        const [invitationRead, expenseRead] = await Promise.allSettled([
          api.invitationRequests({ signal: controller.signal }),
          typeof api.recurringExpenseNotifications === "function"
            ? api.recurringExpenseNotifications({ signal: controller.signal })
            : Promise.reject(new Error(recurringUnavailable())),
        ]);
        if (
          controller.signal.aborted ||
          !current.current.enabled ||
          current.current.identity !== requestIdentity
        )
          return;
        const result = invitationRead.status === "fulfilled" ? invitationRead.value : null;
        const expenses = expenseRead.status === "fulfilled" ? expenseRead.value : null;
        const invitationsValid = !(
          !Array.isArray(result?.items) ||
          result.items.some(
            (item) =>
              !item?.id ||
              item.status !== "pending" ||
              !item.applicant?.userId ||
              !item.workspaceId ||
              item.workspace?.id !== item.workspaceId ||
              !item.invitationId ||
              item.invitation?.id !== item.invitationId
          )
        );
        const invitationError = invitationsValid
          ? ""
          : invitationRead.reason?.message ||
            T("Join requests unavailable.", {
              zh: "暂时无法加载加入申请。",
              ja: "参加申請を読み込めません。",
              ko: "참여 요청을 불러올 수 없습니다.",
              fr: "Les demandes d’accès sont indisponibles.",
              es: "Las solicitudes no están disponibles.",
            });
        const expensesValid =
          Array.isArray(expenses?.items) &&
          !expenses.items.some(
            (item) =>
              !item?.id ||
              !item.ruleId ||
              !item.periodKey ||
              !/^\d{4}-\d{2}-\d{2}$/.test(item.scheduledOn || "") ||
              !item.workspaceId ||
              typeof item.workspaceName !== "string" ||
              !["project", "shared"].includes(item.target?.kind) ||
              (item.target.kind === "project" && !item.target.projectId) ||
              typeof item.amount !== "string" ||
              !/^\d+(?:\.\d+)?$/.test(item.amount) ||
              !/^[A-Z]{3}$/.test(item.currency || "") ||
              typeof item.purpose !== "string" ||
              !item.failedCode
          );
        const expenseError = expensesValid ? "" : recurringUnavailable();
        setState((old) => ({
          ...old,
          identity: requestIdentity,
          ...(invitationsValid
            ? { items: result.items, hasMore: result.hasMore === true, requestsReady: true }
            : {}),
          ...(expensesValid
            ? {
                expenses: expenses.items,
                expenseHasMore: expenses.hasMore === true,
                expensesReady: true,
              }
            : {}),
          status: invitationError || expenseError ? "error" : "ready",
          error: invitationError,
          expenseError,
        }));
        // Coalesce new requests into one notification. The durable inbox retains
        // every visible applicant after a toast is dismissed or the tab reloads.
        const fresh = invitationsValid
          ? result.items.filter((item) => !seen.current.has(`invitation:${item.id}`))
          : [];
        for (const item of invitationsValid ? result.items : [])
          seen.current.add(`invitation:${item.id}`);
        if (fresh.length) {
          const item = fresh[0];
          const who = item.applicant.name || item.applicant.githubLogin || item.applicant.userId;
          const id = notify({
            title: joinRequestsTitle(),
            tone: "info",
            message: `${who} · ${item.workspace.name}: ${T("Requesting to join", { zh: "申请加入", ja: "参加を申請中", ko: "참여 요청 중", fr: "Demande d’accès", es: "Solicita unirse" })}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ""}`,
            action:
              fresh.length === 1
                ? {
                    label: reviewLabel(),
                    navigation: true,
                    onClick: () => review(item, requestIdentity),
                  }
                : { label: title(), onClick: () => setOpen(true) },
          });
          toastIds.current.add(id);
        }
        const freshExpenses = expensesValid
          ? expenses.items.filter((item) => !seen.current.has(`expense:${item.id}`))
          : [];
        for (const item of expensesValid ? expenses.items : [])
          seen.current.add(`expense:${item.id}`);
        if (freshExpenses.length) {
          const item = freshExpenses[0];
          const id = notify({
            title: pendingExpensesTitle(),
            tone: "warning",
            message: `${item.scheduledOn} · ${item.workspaceName} · ${item.currency} ${item.amount}: ${expenseLimitLabel()}${freshExpenses.length > 1 ? ` (+${freshExpenses.length - 1})` : ""}`,
            action:
              freshExpenses.length === 1
                ? {
                    label: openRecurringLabel(),
                    navigation: true,
                    onClick: () => openRecurring(item, requestIdentity),
                  }
                : { label: title(), onClick: () => setOpen(true) },
          });
          toastIds.current.add(id);
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          current.current.enabled &&
          current.current.identity === requestIdentity
        ) {
          setState((old) => ({
            ...old,
            status: "error",
            error: error?.message || "Join requests unavailable.",
          }));
        }
      } finally {
        if (request.current === controller) request.current = null;
      }
    },
    [api, notify, review, openRecurring]
  );

  useEffect(() => {
    if (!enabled || previousIdentity.current !== identity) {
      request.current?.abort();
      request.current = null;
      seen.current.clear();
      lastAutomaticRead.current = 0;
      setState(emptyState(identity));
      setOpen(false);
      for (const id of toastIds.current) dismiss(id);
      toastIds.current.clear();
    }
    previousIdentity.current = identity;
    if (enabled) refresh({ automatic: true });
  }, [identity, enabled, navigationKey, refresh, dismiss]);

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== "hidden") refresh({ automatic: true });
    };
    const onChanged = () => refresh();
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("pw-invitationrequestschange", onChanged);
    window.addEventListener("pw-recurring-expenses-changed", onChanged);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("pw-invitationrequestschange", onChanged);
      window.removeEventListener("pw-recurring-expenses-changed", onChanged);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);

  useModalFocus({ open, dialogRef, initialFocusRef: closeRef, onClose: () => setOpen(false) });
  useEffect(() => {
    if (!open) return;
    const background = Array.from(document.body.children).filter(
      (node) => !node.contains(dialogRef.current)
    );
    // The application root contains the dialog. Inert its sibling app content
    // inside the provider while preserving the dialog's own focusable controls.
    const modal = dialogRef.current?.closest(".modal-back");
    const siblings = Array.from(modal?.parentElement?.children || []).filter(
      (node) => node !== modal && !node.contains(modal)
    );
    const nodes = [...background, ...siblings];
    const previous = nodes.map((node) => [node, node.inert]);
    for (const [node] of previous) node.inert = true;
    return () => {
      for (const [node, inert] of previous) node.inert = inert;
    };
  }, [open]);

  return (
    <InboxContext.Provider
      value={
        enabled && state.identity === identity
          ? {
              count: state.items.length + state.expenses.length,
              hasMore: state.hasMore || state.expenseHasMore,
              open: () => {
                setOpen(true);
                refresh();
              },
            }
          : null
      }
    >
      {children}
      {open && enabled && state.identity === identity && (
        <div
          className="modal-back"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-title"
            ref={dialogRef}
          >
            <div className="modal-h">
              <h3 id="inbox-title">{title()}</h3>
              <button
                className="btn ghost icon"
                type="button"
                ref={closeRef}
                onClick={() => setOpen(false)}
                aria-label={T("Close", "关闭")}
              >
                <I.X size={14} />
              </button>
            </div>
            <div
              className="modal-body invitation-inbox-body"
              aria-busy={state.status === "loading"}
            >
              <section className="panel" aria-labelledby="join-requests-title">
                <div className="panel-h">
                  <h4 id="join-requests-title">{joinRequestsTitle()}</h4>
                </div>
                {state.error && (
                  <div className="notice notice-error" role="alert">
                    {state.error}
                  </div>
                )}
                {!state.items.length && state.status === "loading" && (
                  <p role="status">{T("Loading...", "正在加载...")}</p>
                )}
                {!state.items.length &&
                  state.requestsReady &&
                  !state.error &&
                  state.status !== "loading" && (
                    <p>
                      {T("No join requests.", {
                        zh: "暂无加入申请。",
                        ja: "参加申請はありません。",
                        ko: "참여 요청이 없습니다.",
                        fr: "Aucune demande d’accès.",
                        es: "No hay solicitudes.",
                      })}
                    </p>
                  )}
                <div className="ledger-list">
                  {state.items.map((item) => (
                    <article className="invitation-inbox-row" key={item.id}>
                      <div>
                        <strong>
                          {item.applicant.name ||
                            item.applicant.githubLogin ||
                            item.applicant.userId}
                        </strong>
                        {item.applicant.githubLogin && <p>@{item.applicant.githubLogin}</p>}
                        <p>{item.workspace.name}</p>
                      </div>
                      <button
                        className="btn sm"
                        type="button"
                        disabled={navigationDisabled}
                        onClick={() => review(item)}
                      >
                        {reviewLabel()}
                      </button>
                    </article>
                  ))}
                </div>
                {state.hasMore && (
                  <p>
                    {T("More requests will appear as you review these.", {
                      zh: "处理这些申请后，将显示更多申请。",
                      ja: "これらを確認すると、次の申請が表示されます。",
                      ko: "이 요청들을 검토하면 다음 요청이 표시됩니다.",
                      fr: "D’autres demandes apparaîtront après cet examen.",
                      es: "Aparecerán más solicitudes al revisar estas.",
                    })}
                  </p>
                )}
              </section>
              <section className="panel" aria-labelledby="pending-expenses-title">
                <div className="panel-h">
                  <h4 id="pending-expenses-title">{pendingExpensesTitle()}</h4>
                </div>
                {state.expenseError && (
                  <div className="notice notice-error" role="alert">
                    {state.expenseError}
                  </div>
                )}
                {!state.expenses.length && state.status === "loading" && (
                  <p role="status">{T("Loading...", "正在加载...")}</p>
                )}
                {!state.expenses.length &&
                  state.expensesReady &&
                  !state.expenseError &&
                  state.status !== "loading" && (
                    <p>
                      {T("No pending expenses.", {
                        zh: "暂无待补记支出。",
                        ja: "未記帳の支出はありません。",
                        ko: "미기록 지출이 없습니다.",
                        fr: "Aucune dépense à enregistrer.",
                        es: "No hay gastos pendientes.",
                      })}
                    </p>
                  )}
                <div className="ledger-list">
                  {state.expenses.map((item) => (
                    <article className="invitation-inbox-row" key={item.id}>
                      <div>
                        <strong>{item.purpose}</strong>
                        <p>
                          <time dateTime={item.scheduledOn}>{item.scheduledOn}</time> ·{" "}
                          {item.workspaceName}
                        </p>
                        <p>{expenseLimitLabel()}</p>
                      </div>
                      <div className="panel-body">
                        <FinancialValue
                          value={`${item.currency} ${item.amount}`}
                          currency={item.currency}
                        />
                        <div className="panel-actions">
                          <button
                            className="btn sm"
                            type="button"
                            disabled={navigationDisabled || typeof onOpenRecurring !== "function"}
                            onClick={() => openRecurring(item)}
                          >
                            {openRecurringLabel()}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {state.expenseHasMore && (
                  <p>
                    {T("More pending expenses will appear after you record these.", {
                      zh: "补记这些支出后，将显示更多待补记支出。",
                      ja: "これらを記帳すると、次の未記帳支出が表示されます。",
                      ko: "이 지출을 기록하면 다음 미기록 지출이 표시됩니다.",
                      fr: "D’autres dépenses apparaîtront après cet enregistrement.",
                      es: "Aparecerán más gastos pendientes después de registrar estos.",
                    })}
                  </p>
                )}
              </section>
            </div>
            <div className="modal-foot">
              <button
                className="btn"
                type="button"
                disabled={state.status === "loading"}
                onClick={() => refresh()}
              >
                {T("Reload", "重新加载")}
              </button>
            </div>
          </div>
        </div>
      )}
    </InboxContext.Provider>
  );
}

export function InvitationInboxButton({ disabled = false }) {
  useLang();
  const inbox = useContext(InboxContext);
  if (!inbox) return null;
  return (
    <button
      className="btn sm"
      type="button"
      disabled={disabled}
      aria-label={title()}
      title={title()}
      onClick={inbox.open}
    >
      <I.Mail size={14} aria-hidden="true" />
      {inbox.count > 0 && (
        <b aria-hidden="true">
          {inbox.count}
          {inbox.hasMore ? "+" : ""}
        </b>
      )}
    </button>
  );
}
