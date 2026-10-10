import { pullwiseApi } from "../api/pullwise.js";
import { captureGitHubRefreshScope } from "../api/github-refresh.js";
import {
  clearGitHubRepositoryAccessRefreshNeeded,
  markGitHubRepositoryAccessRefreshNeeded,
} from "./github-repository-access-refresh.js";
import { openGitHubInstallPopup } from "./install-popup.js";
import { pathFromScreen } from "./navigation.js";
import { safeGitHubAuthorizeUrl, safeGitHubInstallationUrl } from "./trusted-redirects.js";

function getScreenRedirectUrl(screen) {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.pathname = pathFromScreen(screen);
  redirectUrl.search = "";
  redirectUrl.hash = "";
  return redirectUrl.toString();
}

function getRepositoryRedirectUrl(redirectTo) {
  const redirectUrl = new URL(redirectTo || getScreenRedirectUrl("ledgerProjects"));
  redirectUrl.pathname = pathFromScreen("ledgerProjects");
  return redirectUrl.toString();
}

function getContinueRepositoryRedirectUrl(redirectTo) {
  const redirectUrl = new URL(getRepositoryRedirectUrl(redirectTo));
  redirectUrl.searchParams.set("repoAuth", "1");
  return redirectUrl.toString();
}

function popupReturnUrl(redirectTo, nonce) {
  const url = new URL(redirectTo);
  url.searchParams.set("github_popup_nonce", nonce);
  return url.toString();
}

function popupNonce() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function repositoryItemsFrom(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.repositories)) return payload.repositories;
  return [];
}

function repositoryAuthorizationError(payload) {
  const code = payload?.authorizationIssue || "no_authorized_repositories";
  const message =
    payload?.message ||
    "No authorized repositories are available. Manage GitHub repository access and choose at least one repository.";
  const error = new Error(message);
  error.code = code;
  return error;
}

const GITHUB_MANAGE_ERROR_MESSAGES = {
  github_account_mismatch:
    "GitHub account mismatch. Choose a GitHub account with access to this installation, then try again.",
  github_installation_not_visible:
    "This GitHub account cannot access that installation. Choose the right GitHub account or an organization admin account.",
  github_org_admin_required:
    "Use a GitHub organization owner or admin account to manage this installation.",
  github_identity_reauth_required:
    "Reconnect this GitHub account before managing the installation.",
  github_installation_deleted:
    "This GitHub App installation is no longer available. Reinstall it or remove it from Pullwise.",
  github_app_installation_not_completed:
    "GitHub installation was not completed. Open the installation flow again to continue.",
};

function normalizeGitHubPopupError(error) {
  const code = error?.code || "";
  if (!GITHUB_MANAGE_ERROR_MESSAGES[code]) return error;
  const normalized = new Error(GITHUB_MANAGE_ERROR_MESSAGES[code]);
  normalized.code = code;
  return normalized;
}

function assertAuthorizationActive(scope, signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
  if (scope !== captureGitHubRefreshScope() || scope?.controller.signal.aborted)
    throw new DOMException("Account changed", "AbortError");
}

async function verifyConnectedRepositories({ scope, signal, syncPayload }) {
  assertAuthorizationActive(scope, signal);
  const payload = await pullwiseApi.repositories.sync(syncPayload, { scope, signal });
  assertAuthorizationActive(scope, signal);
  assertRepositoryAuthorization(payload, syncPayload?.installationId);
}

function assertRepositoryAuthorization(payload, installationId) {
  if (payload?.githubRefreshError) throw payload.githubRefreshError;
  if (payload?.authorizationIssue) throw repositoryAuthorizationError(payload);
  if (payload?.githubAccess === "reauthorization_required") {
    const error = new Error("Reconnect your GitHub account before checking repository access.");
    error.code = "GITHUB_REAUTHORIZATION_REQUIRED";
    throw error;
  }
  const items = repositoryItemsFrom(payload);
  if ((!Array.isArray(payload?.items) && !Array.isArray(payload?.repositories)) ||
      typeof payload?.needsAuthorization !== "boolean" ||
      !["authorized", "not_connected", "lost"].includes(payload?.githubAccess) ||
      items.some((item) => !item || typeof item !== "object") ||
      (payload.githubAccess === "authorized" && payload.needsAuthorization !== false)) {
    const error = new Error("GitHub returned an unexpected repository access response.");
    error.code = "GITHUB_RESPONSE_INVALID";
    throw error;
  }
  if (payload?.needsAuthorization === false && payload?.githubAccess === "authorized" &&
      items.length > 0 && items.every((item) => item && typeof item === "object") &&
      (!installationId || items.some((item) => String(item.installationId) === installationId))) return;
  throw repositoryAuthorizationError(payload);
}

function installationIdFrom(value) {
  const id = String(value ?? "").trim();
  if (!id) throw new Error("A GitHub App installation id is required.");
  return id;
}

function identityIdFrom(value) {
  const id = String(value ?? "").trim();
  return id || undefined;
}

function needsGitHubIdentity(error) {
  const code = error?.code || error?.payload?.error?.code || error?.payload?.code;
  return code === "GITHUB_IDENTITY_REQUIRED" ||
    (error?.status === 401 && String(error?.message || "").includes("Sign in with GitHub"));
}

export async function startGitHubLogin({
  redirectTo,
  signal,
  intent,
  scope = captureGitHubRefreshScope(),
} = {}) {
  assertAuthorizationActive(scope, signal);

  const invite = /^#invite=[A-Za-z0-9_-]{20,200}$/.test(window.location.hash)
    ? window.location.hash
    : "";
  const invitationReturn = invite
    ? new URL(`/members${invite}`, window.location.origin).toString()
    : "";
  const result = await pullwiseApi.auth.getGitHubAuthorizeUrl(
    {
      redirectTo: redirectTo || invitationReturn || getScreenRedirectUrl("ledgerProjects"),
      ...(intent === "link" ? { intent: "link" } : {}),
    },
    { signal }
  );

  if (signal?.aborted) return;
  assertAuthorizationActive(scope, signal);

  if (!result?.url) {
    throw new Error("GitHub authorize URL is missing from the auth response.");
  }

  window.location.assign(safeGitHubAuthorizeUrl(result.url, "GitHub authorize URL"));
}

export async function connectGitHubRepositories({
  redirectTo,
  manage = false,
  add = false,
  signal,
} = {}) {
  const scope = captureGitHubRefreshScope();
  assertAuthorizationActive(scope, signal);
  const repositoryRedirect = getRepositoryRedirectUrl(redirectTo);
  const nonce = popupNonce();
  let result;
  try {
    result = await pullwiseApi.integrations.getGitHubAuthorizeUrl(
      {
        redirectTo: popupReturnUrl(repositoryRedirect, nonce),
        manage: manage && !add ? "1" : undefined,
        add: add ? "1" : undefined,
      },
      { signal }
    );
  } catch (error) {
    assertAuthorizationActive(scope, signal);
    if (needsGitHubIdentity(error)) {
      await startGitHubLogin({
        intent: "link",
        redirectTo: getContinueRepositoryRedirectUrl(repositoryRedirect),
        signal,
        scope,
      });
      return;
    }
    throw error;
  }
  assertAuthorizationActive(scope, signal);

  const repositorySyncPayload = result?.mode === "github-installation-manage" && result.installationId
    ? { installationId: installationIdFrom(result.installationId), githubIdentityId: result.githubIdentityId }
    : undefined;

  if (!result?.url) {
    if (result?.connected) {
      await verifyConnectedRepositories({ scope, signal, syncPayload: repositorySyncPayload });
      clearGitHubRepositoryAccessRefreshNeeded();
      return;
    }
    throw new Error(
      "GitHub repository authorization URL is missing from the integrations response."
    );
  }

  const authorizeUrl = safeGitHubInstallationUrl(result.url, "GitHub repository authorization URL");
  markGitHubRepositoryAccessRefreshNeeded();
  const popupSyncPayload = repositorySyncPayload
    ? { ...repositorySyncPayload, requireCloseSyncReady: true }
    : undefined;
  const completion = openGitHubInstallPopup(authorizeUrl, popupSyncPayload, { scope, signal, nonce });
  if (!completion) {
    window.location.assign(authorizeUrl);
    return;
  }
  try {
    const outcome = await completion;
    assertAuthorizationActive(scope, signal);
    if (outcome?.repositories) {
      clearGitHubRepositoryAccessRefreshNeeded();
      return outcome;
    }
  } catch (error) {
    if (scope === captureGitHubRefreshScope()) clearGitHubRepositoryAccessRefreshNeeded();
    throw normalizeGitHubPopupError(error);
  }
  try {
    await verifyConnectedRepositories({ scope, signal, syncPayload: repositorySyncPayload });
  } catch (error) {
    if (scope === captureGitHubRefreshScope()) markGitHubRepositoryAccessRefreshNeeded();
    throw normalizeGitHubPopupError(error);
  }
  clearGitHubRepositoryAccessRefreshNeeded();
}

export async function manageGitHubInstallation(
  installationId,
  { githubIdentityId, redirectTo, signal } = {}
) {
  const scope = captureGitHubRefreshScope();
  assertAuthorizationActive(scope, signal);
  const cleanInstallationId = installationIdFrom(installationId);
  const cleanIdentityId = identityIdFrom(githubIdentityId);
  const nonce = popupNonce();
  const result = await pullwiseApi.integrations.createGitHubInstallationManageSession(
    cleanInstallationId,
    {
      githubIdentityId: cleanIdentityId,
      returnUrl: popupReturnUrl(getRepositoryRedirectUrl(redirectTo), nonce),
    }
  );
  assertAuthorizationActive(scope, signal);
  const manageUrl = safeGitHubInstallationUrl(result?.url, "GitHub installation manage URL");
  const repositorySyncPayload = {
    installationId: cleanInstallationId,
    githubIdentityId: cleanIdentityId,
  };
  const popupSyncPayload = {
    ...repositorySyncPayload,
    requireCloseSyncReady: true,
  };
  const completion = openGitHubInstallPopup(manageUrl, popupSyncPayload, { scope, signal, nonce });
  if (!completion) {
    markGitHubRepositoryAccessRefreshNeeded();
    window.location.assign(manageUrl);
    return;
  }
  try {
    const outcome = await completion;
    assertAuthorizationActive(scope, signal);
    if (outcome?.repositories) {
      clearGitHubRepositoryAccessRefreshNeeded();
      return outcome;
    }
  } catch (error) {
    throw normalizeGitHubPopupError(error);
  }
  try {
    assertAuthorizationActive(scope, signal);
    const repositories = await pullwiseApi.repositories.sync(repositorySyncPayload, { scope, signal });
    assertAuthorizationActive(scope, signal);
    assertRepositoryAuthorization(repositories, cleanInstallationId);
  } catch (error) {
    if (scope === captureGitHubRefreshScope()) markGitHubRepositoryAccessRefreshNeeded();
    throw normalizeGitHubPopupError(error);
  }
  clearGitHubRepositoryAccessRefreshNeeded();
}

export async function signOut() {
  await pullwiseApi.auth.signOut();
  window.location.assign("/");
}
