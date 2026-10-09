import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { useModalFocus } from "../lib/modal-focus.js";
import { useNotify } from "./notifications.jsx";

const InboxContext = createContext(null);
const AUTOMATIC_REFRESH_GAP_MS = 10000;
const title = () =>
  T("Join requests", {
    zh: "加入申请",
    ja: "参加申請",
    ko: "참여 요청",
    fr: "Demandes d’accès",
    es: "Solicitudes para unirse",
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
  onReview,
  children,
  api = ledgerApi,
}) {
  useLang();
  const { notify, dismiss } = useNotify();
  const [state, setState] = useState({
    identity,
    items: [],
    status: "idle",
    error: "",
    hasMore: false,
  });
  const [open, setOpen] = useState(false);
  const current = useRef({ identity, enabled, onReview });
  current.current = { identity, enabled, onReview };
  const previousIdentity = useRef(identity);
  const request = useRef(null);
  const lastAutomaticRead = useRef(0);
  const seen = useRef(new Set());
  const toastIds = useRef(new Set());
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  const review = useCallback((item, owner = current.current.identity) => {
    if (!current.current.enabled || current.current.identity !== owner) return;
    setOpen(false);
    current.current.onReview(item);
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
      setState((old) => ({ ...old, status: "loading", error: "" }));
      try {
        const result = await api.invitationRequests({ signal: controller.signal });
        if (
          controller.signal.aborted ||
          !current.current.enabled ||
          current.current.identity !== requestIdentity
        )
          return;
        if (
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
        ) {
          throw new Error(
            T("Join requests unavailable.", {
              zh: "暂时无法加载加入申请。",
              ja: "参加申請を読み込めません。",
              ko: "참여 요청을 불러올 수 없습니다.",
              fr: "Les demandes d’accès sont indisponibles.",
              es: "Las solicitudes no están disponibles.",
            })
          );
        }
        setState({
          identity: requestIdentity,
          items: result.items,
          status: "ready",
          error: "",
          hasMore: result.hasMore === true,
        });
        // Coalesce new requests into one notification. The durable inbox retains
        // every visible applicant after a toast is dismissed or the tab reloads.
        const fresh = result.items.filter((item) => !seen.current.has(item.id));
        for (const item of result.items) seen.current.add(item.id);
        if (fresh.length) {
          const item = fresh[0];
          const who = item.applicant.name || item.applicant.githubLogin || item.applicant.userId;
          const id = notify({
            title: title(),
            tone: "info",
            message: `${who} · ${item.workspace.name}: ${T("Requesting to join", { zh: "申请加入", ja: "参加を申請中", ko: "참여 요청 중", fr: "Demande d’accès", es: "Solicita unirse" })}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ""}`,
            action:
              fresh.length === 1
                ? { label: reviewLabel(), onClick: () => review(item, requestIdentity) }
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
    [api, notify, review]
  );

  useEffect(() => {
    if (!enabled || previousIdentity.current !== identity) {
      request.current?.abort();
      request.current = null;
      seen.current.clear();
      lastAutomaticRead.current = 0;
      setState({ identity, items: [], status: "idle", error: "", hasMore: false });
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
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("pw-invitationrequestschange", onChanged);
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
              count: state.items.length,
              hasMore: state.hasMore,
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
            aria-labelledby="join-requests-title"
            ref={dialogRef}
          >
            <div className="modal-h">
              <h3 id="join-requests-title">{title()}</h3>
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
              <p>
                {T("Requests refresh when you return to Pullwise. You can also reload them here.", {
                  zh: "返回 Pullwise 时会刷新申请，也可以在此手动重新加载。",
                  ja: "Pullwise に戻ると申請を更新します。ここで再読み込みもできます。",
                  ko: "Pullwise로 돌아오면 요청을 새로 고칩니다. 여기서 다시 불러올 수도 있습니다.",
                  fr: "Les demandes sont actualisées à votre retour sur Pullwise. Vous pouvez aussi les recharger ici.",
                  es: "Las solicitudes se actualizan al volver a Pullwise. También puedes recargarlas aquí.",
                })}
              </p>
              {state.error && (
                <div className="notice notice-error" role="alert">
                  {state.error}
                </div>
              )}
              {!state.items.length && state.status === "loading" && (
                <p role="status">{T("Loading...", "正在加载...")}</p>
              )}
              {!state.items.length && state.status === "ready" && (
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
                        {item.applicant.name || item.applicant.githubLogin || item.applicant.userId}
                      </strong>
                      {item.applicant.githubLogin && <p>@{item.applicant.githubLogin}</p>}
                      <p>{item.workspace.name}</p>
                    </div>
                    <button className="btn sm" type="button" onClick={() => review(item)}>
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
