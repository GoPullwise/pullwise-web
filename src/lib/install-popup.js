import { pullwiseApi } from "../api/pullwise.js";
import { captureGitHubRefreshScope } from "../api/github-refresh.js";
import { safeGitHubInstallationUrl, safeHttpUrl } from "./trusted-redirects.js";

const POPUP_NAME = "pullwise-github-install";
const MESSAGE_TYPE = "pullwise:github-install";
const POPUP_FEATURES = "popup=1,width=920,height=820,resizable=1,scrollbars=1";
const POLL_INTERVAL_MS = 400;

function safePopupUrl(value) {
  return safeGitHubInstallationUrl(value, "GitHub installation popup URL");
}

function safeManageContinueUrl(value) {
  const url = safeHttpUrl(value, "GitHub installation popup URL");
  const parsed = new URL(url);
  const sameOrigin = parsed.origin === window.location.origin;
  const trustedGitHub = parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "github.com";
  if (sameOrigin || trustedGitHub) return url;
  throw new Error("A safe GitHub installation popup URL is required.");
}

export class GitHubInstallVerificationError extends Error {
  constructor(cause) {
    super(cause?.message || "Unable to verify GitHub installation after the popup closed.");
    this.name = "GitHubInstallVerificationError";
    this.code = cause?.code || cause?.payload?.error?.code || cause?.payload?.code || "github_installation_verification_failed";
    this.status = cause?.status;
    this.cause = cause;
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
        nonce: params.get("github_popup_nonce"),
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

function assertPopupActive(scope, signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
  if (scope !== captureGitHubRefreshScope() || scope?.controller.signal.aborted)
    throw new DOMException("Account changed", "AbortError");
}

export function openGitHubInstallPopup(
  url,
  syncPayload,
  { scope = captureGitHubRefreshScope(), signal, nonce } = {}
) {
  assertPopupActive(scope, signal);
  const popupUrl = safePopupUrl(url);
  const popup = window.open(popupUrl, POPUP_NAME, POPUP_FEATURES);
  if (!popup) return null;
  try {
    popup.focus();
  } catch {
    // Focus can be blocked by browser popup policies.
  }

  let removeAbortListeners = () => {};
  return new Promise((resolve, reject) => {
    let settled = false;
    const repositorySyncPayload =
      syncPayload && typeof syncPayload === "object"
        ? Object.fromEntries(
            Object.entries(syncPayload).filter(([key]) => key !== "requireCloseSyncReady")
          )
        : syncPayload;

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      const data = event.data;
      if (!data || data.type !== MESSAGE_TYPE) return;
      if (nonce && data.nonce !== nonce) return;
      try {
        assertPopupActive(scope, signal);
      } catch (error) {
        finish();
        reject(error);
        return;
      }
      if (data.ok === true && data.closeSyncReady === true) {
        return;
      }
      finish();
      if (data.ok === true) resolve();
      else {
        const error = new Error(data.error || "GitHub installation did not complete.");
        error.code = data.error || "github_installation_failed";
        reject(error);
      }
    };

    const interval = window.setInterval(async () => {
      try {
        assertPopupActive(scope, signal);
      } catch (error) {
        finish();
        reject(error);
        return;
      }
      let closed = true;
      try {
        closed = popup.closed;
      } catch {
        // Cross-origin popup access can throw; treat it as closed.
      }
      if (!closed) return;
      finish();
      try {
        const session = await pullwiseApi.auth.getSession({ signal });
        assertPopupActive(scope, signal);
        // The session's repositoriesConnected field is cached. Only its exact
        // account identity is evidence for this close-time read.
        if (!scope?.identity || session?.authenticated !== true || session.user?.id !== scope.identity)
          throw new DOMException("Account changed", "AbortError");

        const repositories = await pullwiseApi.repositories.sync(repositorySyncPayload, {
          scope,
          signal,
        });
        assertPopupActive(scope, signal);
        if (repositories?.githubRefreshError) throw repositories.githubRefreshError;
        if (repositories?.authorizationIssue) {
          const error = new Error(repositories.message || repositories.authorizationIssue);
          error.code = repositories.authorizationIssue;
          reject(error);
          return;
        }
        if (repositories?.githubAccess === "reauthorization_required") {
          const error = new Error("Reconnect your GitHub account before checking repository access.");
          error.code = "GITHUB_REAUTHORIZATION_REQUIRED";
          throw error;
        }
        if (
          !Array.isArray(repositories?.items) ||
          typeof repositories.needsAuthorization !== "boolean" ||
          !["authorized", "not_connected", "lost"].includes(repositories.githubAccess) ||
          repositories.items.some((item) => !item || typeof item !== "object") ||
          (repositories.githubAccess === "authorized" && repositories.needsAuthorization !== false)
        ) {
          const error = new Error("GitHub returned an unexpected repository access response.");
          error.code = "GITHUB_RESPONSE_INVALID";
          throw error;
        }
        // Even a trusted manage continuation only proves GitHub was opened.
        // Existing grants cannot prove that this particular change was saved.
        resolve({ status: "closed_unverified", repositories });
      } catch (error) {
        if (error?.name === "AbortError") {
          reject(error);
          return;
        }
        try {
          assertPopupActive(scope, signal);
          reject(new GitHubInstallVerificationError(error));
        } catch (inactive) {
          reject(inactive);
        }
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
    const abortListeners = [signal, scope?.controller.signal].filter(Boolean).map((activeSignal) => {
      const listener = () => {
        finish();
        reject(activeSignal.reason ?? new DOMException("Aborted", "AbortError"));
      };
      activeSignal.addEventListener("abort", listener, { once: true });
      return [activeSignal, listener];
    });
    removeAbortListeners = () => {
      for (const [activeSignal, listener] of abortListeners)
        activeSignal.removeEventListener("abort", listener);
    };
  }).finally(() => removeAbortListeners());
}
