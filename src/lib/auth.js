import { pullwiseApi } from "../api/pullwise.js";

export async function startGitHubLogin(scope = "all") {
  const result = await pullwiseApi.auth.getGitHubAuthorizeUrl(scope);

  if (!result?.url) {
    throw new Error("GitHub authorize URL is missing from the auth response.");
  }

  window.location.assign(result.url);
}

export async function signInWithEmail(credentials) {
  return pullwiseApi.auth.signInWithEmail(credentials);
}

export async function signOut() {
  await pullwiseApi.auth.signOut();
  window.location.assign("/");
}
