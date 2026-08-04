import { useId, useRef } from "react";
import { useModalFocus } from "../lib/modal-focus.js";

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  busy = false,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const close = () => {
    if (!busy) onClose?.();
  };

  useModalFocus({
    open,
    dialogRef,
    initialFocusRef: cancelRef,
    onClose: close,
  });

  if (!open) return null;

  return (
    <div className="modal-back" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={busy || undefined}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-h">
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="modal-body" id={descriptionId}>
          {description}
        </div>
        <div className="modal-foot">
          <button ref={cancelRef} className="btn" type="button" disabled={busy} onClick={close}>
            {cancelLabel}
          </button>
          <button className="btn primary" type="button" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
