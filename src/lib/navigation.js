const SCREEN_TO_PATH = {
  landing: "/",
  login: "/login",
  oauth: "/oauth",
  repos: "/repos",
  scanning: "/scanning",
  dashboard: "/dashboard",
  issues: "/issues",
  issue: "/issues/detail",
  history: "/history",
  apiKeys: "/api-keys",
  settings: "/settings",
  billing: "/billing",
  pricing: "/pricing",
  api: "/developers/api",
  privacy: "/privacy",
  terms: "/terms",
  security: "/security",
  status: "/status",
  workers: "/workers",
  notfound: "/404",
};

const PATH_TO_SCREEN = {};
for (const [screen, path] of Object.entries(SCREEN_TO_PATH)) {
  PATH_TO_SCREEN[path] = screen;
}

export function screenHref(screen) {
  return SCREEN_TO_PATH[screen] || "/404";
}

export function screenFromPath(pathname) {
  if (!pathname || pathname === "/") return "landing";
  const clean = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return PATH_TO_SCREEN[clean] || null;
}

export function pathFromScreen(screen) {
  return SCREEN_TO_PATH[screen] || "/404";
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
