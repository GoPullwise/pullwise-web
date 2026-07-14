const SCREEN_TO_PATH = {
  landing: "/",
  login: "/login",
  oauth: "/oauth",
  repos: "/repos",
  scanning: "/scanning",
  dashboard: "/dashboard/overview",
  issues: "/issues",
  issue: "/issues/detail",
  history: "/history",
  apiKeys: "/api-keys",
  settings: "/settings",
  billing: "/billing",
  pricing: "/pricing",
  docs: "/developers/docs",
  api: "/developers/api",
  privacy: "/privacy",
  terms: "/terms",
  status: "/status",
  notfound: "/404",
};

const PATH_TO_SCREEN = {};
for (const [screen, path] of Object.entries(SCREEN_TO_PATH)) {
  PATH_TO_SCREEN[path] = screen;
}
PATH_TO_SCREEN["/dashboard"] = "dashboard";

const ISSUE_DETAIL_PREFIX = "/issues/";
const SCAN_DETAIL_PREFIX = "/scanning/";

function cleanPathname(pathname) {
  const raw = String(pathname || "/").split(/[?#]/, 1)[0] || "/";
  return raw.endsWith("/") && raw !== "/" ? raw.slice(0, -1) : raw;
}

function hasRouteParams(params) {
  return params && typeof params === "object" && Object.keys(params).length > 0;
}

export function issueIdFromPath(pathname) {
  const clean = cleanPathname(pathname);
  if (!clean.startsWith(ISSUE_DETAIL_PREFIX)) return "";
  const encodedIssueId = clean.slice(ISSUE_DETAIL_PREFIX.length);
  if (!encodedIssueId) return "";
  try {
    const issueId = decodeURIComponent(encodedIssueId);
    return issueId.trim() && issueId !== "detail" ? issueId : "";
  } catch {
    return "";
  }
}

export function scanIdFromPath(pathname) {
  const clean = cleanPathname(pathname);
  if (!clean.startsWith(SCAN_DETAIL_PREFIX)) return "";
  const encodedScanId = clean.slice(SCAN_DETAIL_PREFIX.length);
  if (!encodedScanId) return "";
  try {
    const scanId = decodeURIComponent(encodedScanId);
    return scanId.trim() ? scanId : "";
  } catch {
    return "";
  }
}

export function screenHref(screen, params = {}) {
  return pathFromScreen(screen, params);
}

export function screenFromPath(pathname) {
  if (!pathname || pathname === "/") return "landing";
  const clean = cleanPathname(pathname);
  if (clean.startsWith(ISSUE_DETAIL_PREFIX)) return issueIdFromPath(clean) ? "issue" : null;
  if (clean.startsWith(SCAN_DETAIL_PREFIX)) return scanIdFromPath(clean) ? "scanning" : null;
  return PATH_TO_SCREEN[clean] || null;
}

export function pathFromScreen(screen, params = {}) {
  if (screen === "issue") {
    return params?.issueId
      ? `${ISSUE_DETAIL_PREFIX}${encodeURIComponent(params.issueId)}`
      : "/404";
  }
  if (screen === "scanning" && params?.scanId) {
    return `${SCAN_DETAIL_PREFIX}${encodeURIComponent(params.scanId)}`;
  }
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

export function screenLinkProps(go, screen, params = {}) {
  return {
    href: screenHref(screen, params),
    onClick: (event) => {
      if (typeof go !== "function") return;
      if (!shouldHandleScreenLinkClick(event)) return;
      event.preventDefault();
      if (hasRouteParams(params)) go(screen, params);
      else go(screen);
    },
  };
}
