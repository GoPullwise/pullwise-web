# Stage 2 Fix And Pull Request Workflow Design

## Goal

Turn Pullwise from a review report tool into a closed-loop remediation product:
after a scan produces an auto-fixable issue, the user can inspect the proposed
patch, approve it, and open a GitHub pull request from Pullwise.

This stage should feel production-grade from the user's perspective: no fake
success states, no browser-held secrets, no hidden repository writes, and clear
failure messages when the issue cannot be fixed safely.

## Product Scope

Stage 2 adds a conservative single-issue workflow:

- `Preview fix` on issue detail for findings with `autoFix=true`.
- A server-generated patch preview showing file path, original lines, proposed
  lines, and validation status.
- `Open PR` after preview validation passes.
- A success state with PR title, branch name, and GitHub URL.
- Actionable failure states for unavailable GitHub App API credentials, missing
  installation permissions, stale issue data, patch mismatch, git push failure,
  and GitHub PR creation failure.

Stage 2 deliberately does not add batch fixes, auto-merge, force pushes,
AI-generated patches beyond the finding payload, cross-repository edits, or
Slack/Linear notification writes.

## Recommended Approach

Use a backend-owned GitHub App write workflow. The browser requests preview and
PR creation, but the server validates the user's session, issue ownership, repo
authorization, installation id, and patch safety. The server then uses the
GitHub App installation token to clone the repo, create a branch, apply a
deterministic replacement, commit, push, and call the GitHub REST API to open
the pull request.

This is slower than direct GitHub content API updates, but it is easier to make
safe and auditable because the same git machinery can validate branch state,
file contents, and patch application before any remote write.

## Backend Architecture

Add a focused fix workflow module in `pullwise_server`:

- Patch validation:
  - Accept only one issue id owned by the current user.
  - Require `autoFix=true`.
  - Require exactly one target file from the issue payload.
  - Require non-empty `badCode` and `goodCode` arrays.
  - Reject absolute paths, `..`, Windows drive paths, and paths outside the
    checkout.
  - Apply the replacement only when the expected old block appears exactly once.
  - Produce a unified diff for preview.

- Pull request creation:
  - Require GitHub App API credentials and an installation id from the original
    scan/repository authorization.
  - Clone the repository into an isolated workspace under
    `PULLWISE_CHECKOUT_ROOT`.
  - Create a deterministic branch name such as
    `pullwise/fix-<issue-id>-<short-token>`.
  - Apply the validated replacement, commit with a Pullwise-authored message,
    push the branch, and create a PR through GitHub's REST API.
  - Persist a PR record on the issue so repeated clicks return the existing PR
    instead of creating duplicates.
  - Clean up temporary checkouts after success or failure.

Existing Stage 1 scan checkout code stays read-oriented. Stage 2 may reuse
safe path, auth env, clone URL, installation token, and checkout-root helpers,
but PR creation should live in a separate module so scan worker behavior remains
easy to reason about.

## API Contract

Add two authenticated endpoints:

```text
POST /issues/{id}/fixes/preview
POST /issues/{id}/pull-requests
```

`POST /issues/{id}/fixes/preview` returns:

```json
{
  "issueId": "f_123",
  "autoFixable": true,
  "valid": true,
  "repository": "owner/repo",
  "branch": "main",
  "file": "src/auth.py",
  "diff": "--- a/src/auth.py\n+++ b/src/auth.py\n...",
  "summary": "1 file changed"
}
```

`POST /issues/{id}/pull-requests` returns:

```json
{
  "issueId": "f_123",
  "branch": "pullwise/fix-f_123-a1b2c3",
  "url": "https://github.com/owner/repo/pull/42",
  "number": 42,
  "title": "Fix: Validate redirect targets"
}
```

Errors return JSON `{ "message": "..." }` with specific HTTP status codes.
Expected validation failures should use `400`, missing session `401`, missing
repo authorization `403`, missing issue `404`, stale or already-linked PR
conflicts `409`, unavailable GitHub configuration `501`, and GitHub/API
outages `503`.

## Frontend UX

Issue detail should replace the disabled Stage 2 buttons with an explicit
workflow:

- If the issue is not auto-fixable, keep the action disabled and explain why.
- `Preview fix` opens an inline preview panel in the action column.
- The panel shows file path, validation state, unified diff, and warning copy
  that the user is about to create a branch and PR.
- `Open PR` is enabled only after a successful preview.
- While creating the PR, show a spinner and keep duplicate clicks disabled.
- On success, show a link to the PR and keep the issue status unchanged until
  the user marks it fixed or the product later learns merge state.

The UI should avoid marketing-style copy. The screen is an operational review
tool, so the primary value is clear state, readable diffs, precise actions, and
fast recovery when a failure happens.

## Security And Safety

The browser never receives GitHub installation tokens, clone URLs containing
credentials, private key paths, private key content, OAuth client secrets, or
raw environment values.

Server-side safeguards:

- Require session ownership for every issue action.
- Re-check repository authorization before preview and PR creation.
- Do not trust file paths or patch data from the browser.
- Do not apply patches if the expected old content is missing or ambiguous.
- Do not push if the working tree contains unrelated changes.
- Do not overwrite an existing remote branch without an explicit future design.
- Log workflow events without token values or secret-bearing paths.

## Testing Strategy

Backend tests should cover:

- Preview rejects non-auto-fixable issues.
- Preview rejects unsafe paths.
- Preview rejects missing or ambiguous old code blocks.
- Preview returns a unified diff for a valid deterministic replacement.
- PR creation requires session, issue ownership, repository authorization, and
  GitHub App API configuration.
- PR creation reuses an existing issue PR record idempotently.
- PR creation calls git without leaking installation tokens in command args or
  persisted payloads.
- Failure cleanup removes temporary workspaces.

Frontend tests should cover:

- Auto-fixable issues show `Preview fix`; non-auto-fixable issues show a
  disabled explanation.
- Successful preview renders the diff and enables `Open PR`.
- PR success renders the GitHub link.
- Preview/PR failures show actionable errors and keep the user on issue detail.

Full verification remains:

```powershell
npm run check
python -m unittest discover -s tests
```

## Open Future Work

After this stage, production-grade coverage still needs notification delivery,
Slack/Linear writes, PR merge-state syncing, bulk remediation, stronger
multi-tenant persistence, pagination, retention policies, and deeper runtime
observability.
