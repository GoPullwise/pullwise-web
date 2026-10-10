import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
const modalDocuments = new WeakMap();

function available(element, dialog) {
  if (!element || !dialog?.contains(element) || typeof element.focus !== "function") return false;
  if (element.matches(":disabled") || element.closest('[hidden], [inert], [aria-hidden="true"]'))
    return false;
  const closedDetails = element.closest("details:not([open])");
  if (closedDetails && !closedDetails.querySelector(":scope > summary")?.contains(element))
    return false;
  for (let node = element; node; node = node.parentElement) {
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (node === dialog) break;
  }
  return true;
}

function focusableElements(dialog) {
  return Array.from(dialog?.querySelectorAll(FOCUSABLE_SELECTOR) || []).filter(
    (element) => element.tabIndex >= 0 && available(element, dialog)
  );
}

function saveStyle(element, properties) {
  const previous = properties.map((property) => [
    property,
    element.style.getPropertyValue(property),
    element.style.getPropertyPriority(property),
  ]);
  return () => {
    for (const [property, value, priority] of previous) {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }
  };
}

function lockScroll(document) {
  const view = document.defaultView;
  const body = document.body;
  const html = document.documentElement;
  const x = view.scrollX;
  const y = view.scrollY;
  const scrollbar = Math.max(0, view.innerWidth - html.clientWidth);
  const restoreBody = saveStyle(body, [
    "position",
    "top",
    "left",
    "width",
    "overflow",
    "padding-right",
  ]);
  const restoreHtml = saveStyle(html, ["overflow", "scroll-behavior"]);
  const padding = Number.parseFloat(view.getComputedStyle(body).paddingRight) || 0;

  // A fixed body also stops Safari's document scrolling behind a touch overlay.
  // The dialog's own scroll container remains available, including while busy.
  body.style.setProperty("position", "fixed");
  body.style.setProperty("top", `${-y}px`);
  body.style.setProperty("left", `${-x}px`);
  body.style.setProperty("width", "100%");
  body.style.setProperty("overflow", "hidden");
  if (scrollbar) body.style.setProperty("padding-right", `${padding + scrollbar}px`);
  html.style.setProperty("overflow", "hidden");
  return () => {
    restoreBody();
    restoreHtml();
    const restoreBehavior = saveStyle(html, ["scroll-behavior"]);
    html.style.setProperty("scroll-behavior", "auto");
    try {
      view.scrollTo(x, y);
    } finally {
      restoreBehavior();
    }
  };
}

function restoreInert(state) {
  for (const [element, original] of state.inert) {
    element.inert = original.value;
    element.toggleAttribute("inert", original.attribute);
  }
  state.inert.clear();
}

function syncInert(state) {
  restoreInert(state);
  const dialog = state.stack.at(-1)?.dialog;
  if (!dialog?.isConnected) return;
  // This includes floating app controls and works for both inline and portal
  // dialogs. Only the newest modal remains interactive when dialogs overlap.
  const makeInert = (element) => {
    if (!element || state.inert.has(element)) return;
    state.inert.set(element, {
      value: Boolean(element.inert),
      attribute: element.hasAttribute("inert"),
    });
    element.inert = true;
    element.setAttribute("inert", "");
  };
  for (let branch = dialog; branch?.parentElement; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling === branch) continue;
      makeInert(sibling);
    }
    if (branch.parentElement === dialog.ownerDocument.body) break;
  }
  const current = state.stack.at(-1);
  if (current.background && !current.background.contains(dialog)) makeInert(current.background);
  current.updateViewport?.();
}

function addModal(document, entry) {
  let state = modalDocuments.get(document);
  if (!state) {
    state = {
      stack: [],
      inert: new Map(),
      unlock: lockScroll(document),
      observer: null,
      viewport: document.defaultView.visualViewport,
    };
    state.updateViewport = () => state.stack.at(-1)?.updateViewport?.();
    modalDocuments.set(document, state);
    state.viewport?.addEventListener("resize", state.updateViewport);
    state.viewport?.addEventListener("scroll", state.updateViewport);
    if (typeof document.defaultView.MutationObserver === "function") {
      state.observer = new document.defaultView.MutationObserver(() => syncInert(state));
      state.observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  const childIndex = state.stack.findIndex((current) => entry.dialog.contains(current.dialog));
  if (childIndex < 0) state.stack.push(entry);
  else state.stack.splice(childIndex, 0, entry);
  syncInert(state);
  return state;
}

/**
 * Give an application modal predictable focus entry, Escape handling, and a
 * focus trap. The opener is restored when the modal closes.
 */
export function useModalFocus({
  open,
  dialogRef,
  initialFocusRef = null,
  backgroundRef = null,
  onClose,
  busy = false,
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const activeRef = useRef(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const ownerDocument = dialog.ownerDocument;
    const view = ownerDocument.defaultView;
    const opener = ownerDocument.activeElement;
    const previousTabIndex = dialog.getAttribute("tabindex");
    if (previousTabIndex === null) dialog.tabIndex = -1;
    const entry = { dialog, background: backgroundRef?.current };
    const state = addModal(ownerDocument, entry);
    const topmost = () => state.stack.at(-1) === entry;
    const backdrop = dialog.closest(".modal-back");
    const viewport = view.visualViewport;
    const restoreViewport = backdrop
      ? saveStyle(backdrop, ["--modal-viewport-height", "--modal-viewport-top"])
      : () => {};
    const updateViewport = () => {
      if (!topmost() || !backdrop || !viewport || !(viewport.height > 0)) return;
      backdrop.style.setProperty("--modal-viewport-height", `${viewport.height}px`);
      backdrop.style.setProperty("--modal-viewport-top", `${viewport.offsetTop || 0}px`);
    };
    entry.updateViewport = updateViewport;
    updateViewport();
    let lastFocused = null;
    let frame = 0;

    const focusInitial = () => {
      if (!topmost() || available(ownerDocument.activeElement, dialog)) return;
      const preferred = available(lastFocused, dialog)
        ? lastFocused
        : available(initialFocusRef?.current, dialog)
          ? initialFocusRef.current
          : focusableElements(dialog)[0] || dialog;
      preferred.focus({ preventScroll: true });
    };
    activeRef.current = { focusInitial };
    if (typeof view.requestAnimationFrame === "function") {
      frame = view.requestAnimationFrame(focusInitial);
    } else {
      focusInitial();
    }

    const handleKeyDown = (event) => {
      if (!topmost()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!focusable.includes(ownerDocument.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && ownerDocument.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && ownerDocument.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    const handleFocus = (event) => {
      if (!topmost()) return;
      if (dialog.contains(event.target)) lastFocused = event.target;
      else focusInitial();
    };

    ownerDocument.addEventListener("keydown", handleKeyDown, true);
    ownerDocument.addEventListener("focusin", handleFocus, true);
    return () => {
      activeRef.current = null;
      if (frame && typeof view.cancelAnimationFrame === "function") {
        view.cancelAnimationFrame(frame);
      }
      ownerDocument.removeEventListener("keydown", handleKeyDown, true);
      ownerDocument.removeEventListener("focusin", handleFocus, true);
      restoreViewport();
      state.stack.splice(state.stack.indexOf(entry), 1);
      if (previousTabIndex === null) dialog.removeAttribute("tabindex");
      syncInert(state);
      if (!state.stack.length) {
        state.observer?.disconnect();
        state.viewport?.removeEventListener("resize", state.updateViewport);
        state.viewport?.removeEventListener("scroll", state.updateViewport);
        state.unlock();
        modalDocuments.delete(ownerDocument);
      }
      // Let React finish sibling cleanups before restoring a connected opener.
      queueMicrotask(() => {
        const current = modalDocuments.get(ownerDocument)?.stack.at(-1);
        if (
          opener?.isConnected &&
          !opener.closest("[inert]") &&
          typeof opener.focus === "function" &&
          (!current || current.dialog.contains(opener))
        ) {
          opener.focus({ preventScroll: true });
        }
      });
    };
  }, [backgroundRef, dialogRef, initialFocusRef, open]);

  useEffect(() => {
    if (open) activeRef.current?.focusInitial();
  }, [busy, open]);
}
