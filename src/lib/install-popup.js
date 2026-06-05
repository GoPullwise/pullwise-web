import { pullwiseApi } from "../api/pullwise.js";

const POPUP_NAME = "pullwise-github-install";
const MESSAGE_TYPE = "pullwise:github-install";
const POPUP_FEATURES = "popup=1,width=920,height=820,resizable=1,scrollbars=1";
const POLL_INTERVAL_MS = 400;

function safePopupUrl(value) {
  if (typeof value !== "string")
    throw new Error("A safe GitHub installation popup URL is required.");
  const url = value.trim();
  if ([...url].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new Error("A safe GitHub installation popup URL is required.");
  }
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) return url;
  } catch {
    // handled by the common error below
  }
  throw new Error("A safe GitHub installation popup URL is required.");
}

function safeManageContinueUrl(value) {
  const url = safePopupUrl(value);
  const parsed = new URL(url);
  const sameOrigin = parsed.origin === window.location.origin;
  const trustedGitHub = parsed.protocol === "https:" && parsed.hostname === "github.com";
  if (sameOrigin || trustedGitHub) return url;
  throw new Error("A safe GitHub installation popup URL is required.");
}

export class GitHubInstallCancelled extends Error {
  constructor() {
    super("GitHub installation was cancelled.");
    this.name = "GitHubInstallCancelled";
    this.code = "popup_closed";
  }
}

export function isInstallPopupReturn() {
  if (typeof window === "undefined") return false;
  if (window.name !== POPUP_NAME) return false;
  const opener = window.opener;
  if (!opener) return false;
  try {
    return !opener.closed;
  } catch {
    return false;
  }
}

export function notifyOpenerAndClose() {
  const params = new URLSearchParams(window.location.search);
  let githubError = params.get("github_error");
  let continueUrl = "";
  if (!githubError && params.get("github_manage_continue_url")) {
    try {
      continueUrl = safeManageContinueUrl(params.get("github_manage_continue_url"));
    } catch {
      githubError = "invalid_manage_continue_url";
    }
  }
  try {
    window.opener.postMessage(
      {
        type: MESSAGE_TYPE,
        ok: !githubError,
        error: githubError || null,
        closeSyncReady: Boolean(continueUrl),
      },
      window.location.origin
    );
  } catch {
    // opener may be cross-origin or already torn down
  }
  if (continueUrl) {
    window.location.replace(continueUrl);
    return;
  }
  try {
    window.close();
  } catch {
    // browser may block close; fallback UI will remain visible
  }
}

export function openGitHubInstallPopup(url, syncPayload) {
  const popupUrl = safePopupUrl(url);
  const popup = window.open(popupUrl, POPUP_NAME, POPUP_FEATURES);
  if (!popup) return null;
  try {
    popup.focus();
  } catch {
    // Focus can be blocked by browser popup policies.
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const requireCloseSyncReady = Boolean(syncPayload?.requireCloseSyncReady);
    const repositorySyncPayload =
      syncPayload && typeof syncPayload === "object"
        ? Object.fromEntries(
            Object.entries(syncPayload).filter(([key]) => key !== "requireCloseSyncReady")
          )
        : syncPayload;
    let closeSyncReady = !requireCloseSyncReady;

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      const data = event.data;
      if (!data || data.type !== MESSAGE_TYPE) return;
      if (data.ok && data.closeSyncReady) {
        closeSyncReady = true;
        return;
      }
      finish();
      if (data.ok) resolve();
      else {
        const error = new Error(data.error || "GitHub installation did not complete.");
        error.code = data.error || "github_installation_failed";
        reject(error);
      }
    };

    const interval = window.setInterval(async () => {
      let closed = true;
      try {
        closed = popup.closed;
      } catch {
        // Cross-origin popup access can throw; treat it as closed.
      }
      if (!closed) return;
      finish();
      if (!closeSyncReady) {
        reject(new GitHubInstallCancelled());
        return;
      }
      try {
        const session = await pullwiseApi.auth.getSession();
        if (session?.github?.repositoriesConnected) {
          resolve();
          return;
        }

        const repositories = await pullwiseApi.repositories.sync(repositorySyncPayload);
        if (repositories?.authorizationIssue) {
          const error = new Error(repositories.message || repositories.authorizationIssue);
          error.code = repositories.authorizationIssue;
          reject(error);
          return;
        }
        if (!repositories?.needsAuthorization) {
          resolve();
          return;
        }

        reject(new GitHubInstallCancelled());
      } catch {
        reject(new GitHubInstallCancelled());
      }
    }, POLL_INTERVAL_MS);

    function finish() {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(interval);
      try {
        popup.close();
      } catch {
        // Popup may already be closed.
      }
    }

    window.addEventListener("message", onMessage);
  });
}
