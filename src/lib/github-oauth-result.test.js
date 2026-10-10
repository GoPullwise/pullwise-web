import { describe, expect, it } from "vitest";
import { githubOAuthFailureCode } from "./github-oauth-result.js";

describe("GitHub OAuth failure recognition", () => {
  it.each(["GITHUB_IDENTITY_CONFLICT", "ACCOUNT_CHANGED", "AUTHORIZATION_FAILED"])("accepts the fixed failure code %s", (code) => {
    expect(githubOAuthFailureCode({ pathname: "/oauth", search: `?github_error=${code}` })).toBe(code);
  });

  it.each([
    { pathname: "/projects", search: "?github_error=GITHUB_IDENTITY_CONFLICT" },
    { pathname: "/oauth", search: "?github_error=%3Cscript%3Ealert(1)%3C%2Fscript%3E" },
    { pathname: "/oauth", search: "?github_error=unknown" },
    { pathname: "/oauth", search: "?repoAuth=1" },
    { pathname: "/oauth", search: "" },
  ])("does not treat arbitrary route/query data as a supported failure", (location) => {
    expect(githubOAuthFailureCode(location)).toBeNull();
  });
});
