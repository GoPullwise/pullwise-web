import { T, useLang } from "../i18n.jsx";

export function GitHubAuthorizationGuidance() {
  useLang();
  return (
    <p className="muted">
      {T(
        "On GitHub, finish saving, then close the window or return to Pullwise. Repository access will be checked again."
      )}
    </p>
  );
}

export function GitHubClosedNotice({ outcome }) {
  useLang();
  if (outcome?.status !== "closed_unverified") return null;
  const repositories = outcome.repositories;
  const hasAccess =
    repositories?.githubAccess === "authorized" &&
    repositories?.needsAuthorization === false &&
    Array.isArray(repositories.items) &&
    repositories.items.length > 0;
  return (
    <div className="notice" role="status">
      {hasAccess
        ? T("GitHub window closed. Current repository access has been refreshed.")
        : T("No repository access was found. Finish saving on GitHub and reconnect.")}
    </div>
  );
}
