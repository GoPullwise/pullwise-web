import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const PagePreferencesContext = createContext(null);

// The route owns its header. A phone control can only outlive it on a committed
// public page, whose existing corner presentation remains available.
export function PagePreferencesProvider({
  owner,
  phone,
  consolePage,
  publicPage,
  controls,
  onVisibilityChange,
  children,
}) {
  const [slot, setSlot] = useState(null);
  const [ready, setReady] = useState(null);
  const registerSlot = useCallback(
    (node) => {
      const registration = { owner, node };
      setSlot(registration);
      return () => setSlot((current) => (current === registration ? null : current));
    },
    [owner]
  );
  const registerReady = useCallback(() => {
    const registration = { owner };
    setReady(registration);
    return () => setReady((current) => (current === registration ? null : current));
  }, [owner]);
  const context = useMemo(
    () => ({ phone, registerSlot, registerReady }),
    [phone, registerSlot, registerReady]
  );
  const target = phone && consolePage && slot?.owner === owner ? slot.node : null;
  const visible = !phone || Boolean(target) || (publicPage && ready?.owner === owner);
  useLayoutEffect(() => {
    onVisibilityChange?.(visible);
    return () => {
      // Replacement headers also start collapsed, even when React commits the
      // new registration before cleaning up the old one.
      if (phone) onVisibilityChange?.(false);
    };
  }, [visible, target, owner, phone, onVisibilityChange]);
  return (
    <PagePreferencesContext.Provider value={context}>
      {children}
      {visible && (target ? createPortal(controls, target) : controls)}
    </PagePreferencesContext.Provider>
  );
}

export function PagePreferencesSlot() {
  const context = useContext(PagePreferencesContext);
  const ref = useRef(null);
  const register = context?.registerSlot;
  const phone = context?.phone;
  useLayoutEffect(() => {
    if (phone && ref.current) return register(ref.current);
    return undefined;
  }, [phone, register]);
  return phone ? <div className="topbar-preferences-slot" ref={ref} /> : null;
}

// A sibling inside Suspense never commits while that page is suspended.
export function PagePreferencesReady() {
  const register = useContext(PagePreferencesContext)?.registerReady;
  useLayoutEffect(() => register?.(), [register]);
  return null;
}
