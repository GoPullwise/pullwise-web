import { pullwiseApi } from "../api/pullwise.js";

const POPUP_NAME = "pullwise-github-install";
const MESSAGE_TYPE = "pullwise:github-install";
const POPUP_FEATURES = "popup=1,width=920,height=820,resizable=1,scrollbars=1";
const POLL_INTERVAL_MS = 400;

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
  const githubError = params.get("github_error");
  try {
    window.opener.postMessage(
      {
        type: MESSAGE_TYPE,
        ok: !githubError,
        error: githubError || null,
      },
      window.location.origin
    );
  } catch {
    // opener may be cross-origin or already torn down
  }
  try {
    window.close();
  } catch {
    // browser may block close; fallback UI will remain visible
  }
}

export function openGitHubInstallPopup(url) {
  const popup = window.open(url, POPUP_NAME, POPUP_FEATURES);
  if (!popup) return null;
  try {
    popup.focus();
  } catch {
    // Focus can be blocked by browser popup policies.
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== MESSAGE_TYPE) return;
      finish();
      if (data.ok) resolve();
      else reject(new Error(data.error || "GitHub installation did not complete."));
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
      try {
        const session = await pullwiseApi.auth.getSession();
        if (session?.user?.githubRepositoryAccess) resolve();
        else reject(new GitHubInstallCancelled());
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
