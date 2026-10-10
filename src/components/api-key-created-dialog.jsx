import { useEffect, useId, useRef, useState } from "react";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { useModalFocus } from "../lib/modal-focus.js";
import "./api-key-created-dialog.css";

export function ApiKeyCreatedDialog({
  credential,
  backgroundRef,
  onRestoreFocus = null,
  onClose,
  busy = false,
}) {
  useLang();
  const dialogRef = useRef(null);
  const copyRef = useRef(null);
  const tokenRef = useRef(null);
  const mountedRef = useRef(false);
  const copyRequestRef = useRef(null);
  const copyFocusRef = useRef(null);
  const credentialRef = useRef(credential);
  const [copyState, setCopyState] = useState("idle");
  const dialogId = useId();
  credentialRef.current = credential;

  const close = () => {
    if (!busy) onClose();
  };
  useModalFocus({
    open: true,
    dialogRef,
    initialFocusRef: copyRef,
    backgroundRef,
    onClose: close,
    busy,
  });

  useEffect(() => {
    mountedRef.current = true;
    setCopyState("idle");
    copyRequestRef.current = null;
    copyFocusRef.current = null;
    return () => {
      mountedRef.current = false;
      copyRequestRef.current = null;
      copyFocusRef.current = null;
    };
  }, [credential]);

  useEffect(() => {
    if ((copyState !== "copied" && copyState !== "failed") || copyRequestRef.current) return;
    const temporaryFocus = copyFocusRef.current;
    copyFocusRef.current = null;
    if (
      mountedRef.current &&
      temporaryFocus?.credential === credential &&
      credentialRef.current === credential &&
      document.activeElement === tokenRef.current &&
      !copyRef.current?.disabled
    )
      copyRef.current?.focus({ preventScroll: true });
  }, [copyState, credential]);

  useEffect(() => {
    return () => {
      queueMicrotask(() => {
        onRestoreFocus?.();
      });
    };
  }, [onRestoreFocus]);

  const copy = async () => {
    if (!mountedRef.current || !credential?.token || copyRequestRef.current) return;
    const request = {};
    copyRequestRef.current = request;
    copyFocusRef.current = null;
    // Native disabled buttons can drop focus to body. Keep it inside the modal
    // until the button is enabled again, without interrupting other controls.
    if (document.activeElement === copyRef.current && tokenRef.current) {
      tokenRef.current.focus({ preventScroll: true });
      copyFocusRef.current = { request, credential };
    }
    const current = () =>
      mountedRef.current &&
      credentialRef.current === credential &&
      copyRequestRef.current === request;
    setCopyState("pending");
    try {
      if (typeof navigator.clipboard?.writeText !== "function")
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(credential.token);
      if (current()) setCopyState("copied");
    } catch {
      if (current()) setCopyState("failed");
    } finally {
      if (current()) copyRequestRef.current = null;
    }
  };

  return (
    <div
      className="modal-back api-key-created-dialog-back"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        className="modal api-key-created-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={dialogId + "-title"}
        aria-describedby={dialogId + "-description"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-h">
          <h3 id={dialogId + "-title"} className="api-key-created-dialog-title">
            <I.Check size={16} aria-hidden="true" />
            <span>{T("New key created", "已创建新密钥")}</span>
          </h3>
          <button
            type="button"
            className="btn ghost icon"
            aria-label={T("Close", "关闭")}
            onClick={close}
            disabled={busy}
          >
            <I.X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body api-key-created-dialog-body">
          <p id={dialogId + "-description"}>
            {T(
              "Copy it now. The full token is only shown once.",
              "请立即复制。完整令牌只显示一次。"
            )}
          </p>
          <div className="api-key-created-token-group">
            <span className="muted">{T("Bearer token", "Bearer 令牌")}</span>
            <pre
              ref={tokenRef}
              className="api-key-created-token"
              aria-label={T("Bearer token", "Bearer 令牌")}
              tabIndex={0}
              onPointerDown={() => {
                copyFocusRef.current = null;
              }}
              onKeyDown={() => {
                copyFocusRef.current = null;
              }}
            >
              {credential.token}
            </pre>
          </div>
          {copyState === "copied" && <p role="status">{T("Copied", "已复制")}</p>}
          {copyState === "failed" && (
            <p className="api-key-created-copy-error" role="alert">
              {T(
                "Unable to copy API key. Select and copy the token manually.",
                "无法复制 API key，请手动选择并复制令牌。"
              )}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={close} disabled={busy}>
            {T("Close", "关闭")}
          </button>
          <button
            ref={copyRef}
            type="button"
            className="btn primary"
            onClick={copy}
            disabled={copyState === "pending"}
            aria-busy={copyState === "pending"}
          >
            {copyState === "pending" ? (
              <span className="spin" aria-hidden="true">
                <I.Refresh size={14} />
              </span>
            ) : copyState === "copied" ? (
              <I.Check size={14} aria-hidden="true" />
            ) : (
              <I.Copy size={14} aria-hidden="true" />
            )}
            {copyState === "copied" ? T("Copied", "已复制") : T("Copy", "复制")}
          </button>
        </div>
      </div>
    </div>
  );
}
