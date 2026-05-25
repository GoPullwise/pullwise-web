export function screenHref(screen) {
  return `?screen=${encodeURIComponent(screen)}`;
}

export function shouldHandleScreenLinkClick(event) {
  if (event?.defaultPrevented) return false;
  if (event?.button !== undefined && event.button !== 0) return false;
  if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey) return false;
  const target =
    event?.currentTarget?.getAttribute?.("target") || event?.currentTarget?.target || "";
  return !target || target === "_self";
}

export function screenLinkProps(go, screen) {
  return {
    href: screenHref(screen),
    onClick: (event) => {
      if (typeof go !== "function") return;
      if (!shouldHandleScreenLinkClick(event)) return;
      event.preventDefault();
      go(screen);
    },
  };
}
