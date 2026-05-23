import { pullwiseApi } from "../api/pullwise.js";
import { openGitHubInstallPopup } from "./install-popup.js";

function getScreenRedirectUrl(screen) {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.searchParams.set("screen", screen);
  redirectUrl.hash = "";
  return redirectUrl.toString();
}

function repositoryItemsFrom(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.repositories)) return payload.repositories;
  return [];
}

function repositoryAuthorizationError(payload) {
  const code = payload?.authorizationIssue || "no_authorized_repositories";
  const message = payload?.message || "No authorized repositories are available. Manage GitHub repository access and choose at least one repository.";
  const error = new Error(message);
  error.code = code;
  return error;
}

async function verifyConnectedRepositories() {
  const payload = await pullwiseApi.repositories.sync();
  if (!payload?.needsAuthorization && repositoryItemsFrom(payload).length > 0) return;
  throw repositoryAuthorizationError(payload);
}

export async function startGitHubLogin({ redirectTo } = {}) {
  const result = await pullwiseApi.auth.getGitHubAuthorizeUrl({
    redirectTo: redirectTo || getScreenRedirectUrl("landing"),
  });

  if (!result?.url) {
    throw new Error("GitHub authorize URL is missing from the auth response.");
  }

  window.location.assign(result.url);
}

export async function requestMagicLink({ email, redirectTo } = {}) {
  return pullwiseApi.auth.requestMagicLink({
    email,
    redirectTo: redirectTo || getScreenRedirectUrl("landing"),
  });
}

export async function connectGitHubRepositories({ redirectTo } = {}) {
  const result = await pullwiseApi.integrations.getGitHubAuthorizeUrl({
    redirectTo: redirectTo || getScreenRedirectUrl("repos"),
  });

  if (!result?.url) {
    if (result?.connected) {
      await verifyConnectedRepositories();
      return;
    }
    throw new Error("GitHub repository authorization URL is missing from the integrations response.");
  }

  const completion = openGitHubInstallPopup(result.url);
  if (!completion) {
    window.location.assign(result.url);
    return;
  }
  await completion;
}

export async function signOut() {
  await pullwiseApi.auth.signOut();
  window.location.assign("/");
}
