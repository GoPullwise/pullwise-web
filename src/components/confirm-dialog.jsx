import { useEffect, useRef } from "react";
import { I } from "../icons.jsx";
import { useModalFocus } from "../lib/modal-focus.js";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
  backgroundRef = null,
  dialogId = "confirm-dialog",
}) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useModalFocus({
    open,
    dialogRef,
    initialFocusRef: cancelRef,
    onClose: onCancel,
  });

  useEffect(() => {
    const background = backgroundRef?.current;
    if (!background) return undefined;
    background.inert = Boolean(open);
    return () => {
      background.inert = false;
    };
  }, [backgroundRef, open]);

  if (!open) return null;

  const titleId = dialogId + "-title";
  const descriptionId = dialogId + "-description";

  return (
    <div
      className="modal-back confirm-dialog-back"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className={"modal confirm-dialog" + (danger ? " confirm-dialog-danger" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-h">
          <h3 id={titleId}>
            <I.Shield size={15} aria-hidden="true" /> {title}
          </h3>
          <button
            ref={cancelRef}
            type="button"
            className="btn ghost icon"
            aria-label={cancelLabel}
            onClick={onCancel}
            disabled={busy}
          >
            <I.X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body confirm-dialog-body">
          <p id={descriptionId}>{description}</p>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={"btn " + (danger ? "danger" : "primary")}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {busy && (
              <span className="spin" aria-hidden="true">
                <I.Refresh size={14} />
              </span>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
