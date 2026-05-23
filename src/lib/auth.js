import { pullwiseApi } from "../api/pullwise.js";
import { openGitHubInstallPopup } from "./install-popup.js";

function getScreenRedirectUrl(screen) {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.searchParams.set("screen", screen);
  redirectUrl.hash = "";
  return redirectUrl.toString();
}

function getRepositoryRedirectUrl(redirectTo) {
  const redirectUrl = new URL(redirectTo || getScreenRedirectUrl("repos"));
  redirectUrl.searchParams.set("screen", "repos");
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

function needsGitHubIdentity(error) {
  return error?.status === 401 && String(error?.message || "").includes("Sign in with GitHub");
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

export async function connectGitHubRepositories({ redirectTo, manage = false } = {}) {
  const repositoryRedirect = getRepositoryRedirectUrl(redirectTo);
  let result;
  try {
    result = await pullwiseApi.integrations.getGitHubAuthorizeUrl({
      redirectTo: repositoryRedirect,
      manage: manage ? "1" : undefined,
    });
  } catch (error) {
    if (needsGitHubIdentity(error)) {
      await startGitHubLogin({ redirectTo: getContinueRepositoryRedirectUrl(repositoryRedirect) });
      return;
    }
    throw error;
  }

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
  await verifyConnectedRepositories();
}

export async function signOut() {
  await pullwiseApi.auth.signOut();
  window.location.assign("/");
}
