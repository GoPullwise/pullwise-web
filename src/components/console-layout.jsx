import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { T, useLang } from "../i18n.jsx";
import { useResizablePane } from "./use-resizable-pane.js";

const SidebarWidthContext = createContext(null);
const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 320;
// Reserve main gutters plus the shared primary, gap and secondary minima.
const MIN_MAIN = 660;

// Keep this provider outside route-keyed screens. Width is a tab preference,
// shared by console modules and cleared whenever the signed-in identity changes.
export function ConsoleLayoutProvider({ children, scope = "" }) {
  const [preference, setPreference] = useState({ scope, width: null });
  useEffect(() => {
    setPreference((current) => (current.scope === scope ? current : { scope, width: null }));
  }, [scope]);
  const setWidth = useCallback((width) => setPreference({ scope, width }), [scope]);
  const value = useMemo(
    () => ({ scope, width: preference.scope === scope ? preference.width : null, setWidth }),
    [scope, preference, setWidth]
  );
  return <SidebarWidthContext.Provider value={value}>{children}</SidebarWidthContext.Provider>;
}

export function ConsoleLayout({ children }) {
  useLang();
  const context = useContext(SidebarWidthContext);
  const sidebarId = useId();
  const pane = useResizablePane({
    scope: context?.scope || "",
    minimum: MIN_SIDEBAR,
    maximum: MAX_SIDEBAR,
    remainingMinimum: MIN_MAIN,
    defaultWidth: 220,
    requestedWidth: context?.width,
    onWidthChange: context?.setWidth,
  });
  const childArray = Children.toArray(children);
  const sidebar = childArray[0];
  const controlledId = isValidElement(sidebar)
    ? sidebar.props.id || `${sidebarId}-sidebar`
    : undefined;

  return (
    <div
      ref={pane.element}
      className={"with-side" + (pane.resizing ? " is-resizing" : "")}
      style={
        pane.desktop && pane.width > 0 ? { "--console-sidebar-width": `${pane.size}px` } : undefined
      }
    >
      {childArray.map((child, index) =>
        index === 0 && isValidElement(child) && !child.props.id
          ? cloneElement(child, { id: controlledId })
          : child
      )}
      {pane.desktop && (
        <div
          {...pane.separatorProps}
          className="console-sidebar-resizer"
          aria-label={T("Resize navigation", "调整导航栏宽度")}
          aria-controls={controlledId}
        />
      )}
    </div>
  );
}
