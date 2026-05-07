import { pullwiseApi } from "../api/pullwise.js";

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

export async function requestEmailMagicLink({ email, redirectTo } = {}) {
  return pullwiseApi.auth.requestMagicLink({
    email,
    redirectTo: redirectTo || getScreenRedirectUrl("oauth"),
  });
}

export async function startGitHubRepositoryAccess({ redirectTo } = {}) {
  const result = await pullwiseApi.integrations.getGitHubAuthorizeUrl({
    redirectTo: redirectTo || getScreenRedirectUrl("repos"),
  });

  if (!result?.url) {
    throw new Error("GitHub repository authorization URL is missing from the integrations response.");
  }

  window.location.assign(result.url);
}

export async function signOut() {
  await pullwiseApi.auth.signOut();
  window.location.assign("/");
}
