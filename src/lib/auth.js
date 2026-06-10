import { pullwiseApi } from "../api/pullwise.js";
import {
  clearGitHubRepositoryAccessRefreshNeeded,
  markGitHubRepositoryAccessRefreshNeeded,
} from "./github-repository-access-refresh.js";
import { openGitHubInstallPopup } from "./install-popup.js";
import { pathFromScreen } from "./navigation.js";
import { clearPullwiseDataCache } from "./pullwise-data.js";
import { safeGitHubAuthorizeUrl, safeGitHubInstallationUrl } from "./trusted-redirects.js";

function getScreenRedirectUrl(screen) {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.pathname = pathFromScreen(screen);
  redirectUrl.search = "";
  redirectUrl.hash = "";
  return redirectUrl.toString();
}

function getRepositoryRedirectUrl(redirectTo) {
  const redirectUrl = new URL(redirectTo || getScreenRedirectUrl("repos"));
  redirectUrl.pathname = pathFromScreen("repos");
  return redirectUrl.toString();
}

function getContinueRepositoryRedirectUrl(redirectTo) {
  const redirectUrl = new URL(getRepositoryRedirectUrl(redirectTo));
  redirectUrl.searchParams.set("repoAuth", "1");
  return redirectUrl.toString();
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

async function verifyConnectedRepositories() {
  const payload = await pullwiseApi.repositories.sync();
  if (!payload?.needsAuthorization && repositoryItemsFrom(payload).length > 0) return;
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
  return error?.status === 401 && String(error?.message || "").includes("Sign in with GitHub");
}

export async function startGitHubLogin({ redirectTo, signal } = {}) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");

  const result = await pullwiseApi.auth.getGitHubAuthorizeUrl(
    { redirectTo: redirectTo || getScreenRedirectUrl("dashboard") },
    { signal }
  );

  if (signal?.aborted) return;

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
  const repositoryRedirect = getRepositoryRedirectUrl(redirectTo);
  let result;
  try {
    result = await pullwiseApi.integrations.getGitHubAuthorizeUrl(
      {
        redirectTo: repositoryRedirect,
        manage: manage && !add ? "1" : undefined,
        add: add ? "1" : undefined,
      },
      { signal }
    );
  } catch (error) {
    if (needsGitHubIdentity(error)) {
      await startGitHubLogin({
        redirectTo: getContinueRepositoryRedirectUrl(repositoryRedirect),
        signal,
      });
      return;
    }
    throw error;
  }

  if (!result?.url) {
    if (result?.connected) {
      await verifyConnectedRepositories();
      clearGitHubRepositoryAccessRefreshNeeded();
      return;
    }
    throw new Error(
      "GitHub repository authorization URL is missing from the integrations response."
    );
  }

  const authorizeUrl = safeGitHubInstallationUrl(result.url, "GitHub repository authorization URL");
  markGitHubRepositoryAccessRefreshNeeded();
  const completion = openGitHubInstallPopup(authorizeUrl);
  if (!completion) {
    window.location.assign(authorizeUrl);
    return;
  }
  try {
    await completion;
    await verifyConnectedRepositories();
    clearGitHubRepositoryAccessRefreshNeeded();
  } catch (error) {
    clearGitHubRepositoryAccessRefreshNeeded();
    throw normalizeGitHubPopupError(error);
  }
}

export async function manageGitHubInstallation(
  installationId,
  { githubIdentityId, redirectTo } = {}
) {
  const cleanInstallationId = installationIdFrom(installationId);
  const cleanIdentityId = identityIdFrom(githubIdentityId);
  const result = await pullwiseApi.integrations.createGitHubInstallationManageSession(
    cleanInstallationId,
    {
      githubIdentityId: cleanIdentityId,
      returnUrl: getRepositoryRedirectUrl(redirectTo),
    }
  );
  const manageUrl = safeGitHubInstallationUrl(result?.url, "GitHub installation manage URL");
  const repositorySyncPayload = {
    installationId: cleanInstallationId,
    githubIdentityId: cleanIdentityId,
  };
  const popupSyncPayload = {
    ...repositorySyncPayload,
    requireCloseSyncReady: true,
  };
  const completion = openGitHubInstallPopup(manageUrl, popupSyncPayload);
  if (!completion) {
    markGitHubRepositoryAccessRefreshNeeded();
    window.location.assign(manageUrl);
    return;
  }
  try {
    await completion;
    await pullwiseApi.repositories.sync(repositorySyncPayload);
    clearGitHubRepositoryAccessRefreshNeeded();
  } catch (error) {
    clearGitHubRepositoryAccessRefreshNeeded();
    throw normalizeGitHubPopupError(error);
  }
}

export async function signOut() {
  await pullwiseApi.auth.signOut();
  clearPullwiseDataCache();
  window.location.assign("/");
}
