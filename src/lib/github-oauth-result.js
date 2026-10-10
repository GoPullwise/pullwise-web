const CALLBACK_FAILURE_CODES = new Set(["GITHUB_IDENTITY_CONFLICT", "ACCOUNT_CHANGED", "AUTHORIZATION_FAILED"]);

export function githubOAuthFailureCode(location = window.location) {
  if (location.pathname !== "/oauth") return null;
  const code = new URLSearchParams(location.search).get("github_error");
  return CALLBACK_FAILURE_CODES.has(code) ? code : null;
}
