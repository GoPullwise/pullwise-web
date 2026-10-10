import { useEffect, useRef } from "react";

/** Dismiss only a complete primary-pointer click on the scrim itself. */
export function useModalBackdrop({ onClose, open = true, busy = false }) {
  const gestureRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    gestureRef.current = null;
  }, [open, busy]);

  return {
    onPointerDownCapture(event) {
      gestureRef.current =
        open &&
        !busyRef.current &&
        event.button === 0 &&
        event.isPrimary !== false &&
        event.target === event.currentTarget
          ? { pointerId: event.pointerId, endedOnBackdrop: false }
          : null;
    },
    onPointerUpCapture(event) {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) {
        gestureRef.current = null;
        return;
      }
      // Touch pointers may be implicitly captured by their starting element.
      // Check the actual release position too, so a scrim-to-dialog drag stays open.
      const document = event.currentTarget.ownerDocument;
      const releasedOn =
        typeof document.elementFromPoint === "function"
          ? document.elementFromPoint(event.clientX, event.clientY)
          : event.target;
      gesture.endedOnBackdrop =
        !busyRef.current &&
        event.button === 0 &&
        event.target === event.currentTarget &&
        releasedOn === event.currentTarget;
    },
    onPointerCancelCapture() {
      gestureRef.current = null;
    },
    onClick(event) {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (
        open &&
        !busyRef.current &&
        event.target === event.currentTarget &&
        gesture?.endedOnBackdrop
      ) {
        closeRef.current?.();
      }
    },
  };
}
