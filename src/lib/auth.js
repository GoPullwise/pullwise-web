import { pullwiseApi } from "../api/pullwise.js";
import { openGitHubInstallPopup } from "./install-popup.js";

function getScreenRedirectUrl(screen) {
  const redirectUrl = new URL(window.location.href);
  redirectUrl.searchParams.set("screen", screen);
  redirectUrl.hash = "";
  return redirectUrl.toString();
}

export async function startGitHubLogin({ redirectTo } = {}) {
  const result = await pullwiseApi.auth.getGitHubAuthorizeUrl({
    redirectTo: redirectTo || getScreenRedirectUrl("oauth"),
  });

  if (!result?.url) {
    throw new Error("GitHub authorize URL is missing from the auth response.");
  }

  window.location.assign(result.url);
}

export async function requestMagicLink({ email, redirectTo } = {}) {
  return pullwiseApi.auth.requestMagicLink({
    email,
    redirectTo: redirectTo || getScreenRedirectUrl("oauth"),
  });
}

export async function connectGitHubRepositories({ redirectTo } = {}) {
  const result = await pullwiseApi.integrations.getGitHubAuthorizeUrl({
    redirectTo: redirectTo || getScreenRedirectUrl("repos"),
  });

  if (!result?.url) {
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
