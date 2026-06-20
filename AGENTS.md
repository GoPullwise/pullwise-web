# Pullwise Web Agent Notes

## Worker Deployment Assumptions

When web changes affect worker install links, same-origin API proxying, worker
status, or worker-facing copy, keep these worker invariants intact:

- Worker installs target Ubuntu 22.04 only.
- Each worker instance must use only the `codex` binary under that worker
  instance directory.
- Each worker instance must use only its own login state, config, and cache.
- Worker install, doctor, update, cleanup, and job execution must not depend on
  a global CLI, root login state, host `HOME`, host `CODEX_HOME`, or another
  worker instance directory.

## Account And Repository Quota Language

Pullwise does not expose a workspace quota model. User-facing copy, API docs,
tests, and UI state should describe quota in account/user and repository terms.

- Use account quota for the user-level bucket exposed as `userQuota`.
- Use repository/repo quota for the repository-level bucket exposed as
  `repoQuota` or repository `quota`.
- Keep quota scope values as `user` and `repository`.
- Do not rename account quota, billing usage, or repository quota to workspace
  quota.
- Forks share repository quota with their source repository; keep that copy and
  behavior visible where scan selection explains quota.

## Quota UI Behavior

- Selection blocking should account for both account remaining quota and each
  repository's remaining quota.
- Structured quota errors such as `QUOTA_EXCEEDED_USER` and
  `QUOTA_EXCEEDED_REPOSITORY` should drive billing/upgrade routing; do not route
  arbitrary unstructured error text as if it were a quota signal.
- Public REST API docs are account-scoped and should continue to describe
  repository listing, scan control, scan status, and quota checks with account
  and repository terminology.

## Performance And Data Fetching

Keep route and polling changes aligned with the current scale model.

- Heavy screens such as issues, billing, docs, legal, API docs, settings, and
  dashboard are lazy-loaded. Do not reintroduce broad static screen imports in
  `App.jsx` unless the route is part of the first interaction path.
- Data hooks should preserve stale-while-revalidate behavior: show cached
  successful list state immediately, then refresh quietly when appropriate.
- New API client GET helpers should accept an optional `AbortSignal`. Hook
  effects should abort stale requests on route/filter/page changes.
- Use request de-duplication for concurrent identical list/status requests. Do
  not start duplicate polling requests for the same cache key.
- Active scan polling should use the bulk scan status endpoint instead of one
  `GET /scans/:id` per active scan. Fall back only when the bulk endpoint is not
  available.
- Status and active scan polling should pause while `document.visibilityState`
  is hidden and refresh when the tab becomes visible.
- Batch issue status updates should use the batch endpoint for bulk "mark fixed"
  flows. Keep single-issue update only as a narrow fallback.
- Retry scan actions should update or replace the affected scan from the inline
  retry payload or a targeted scan refresh. Avoid reloading the entire scan
  history after a single retry unless targeted refresh fails.

## Graph-Verified Review Copy

User-facing GraphVerified copy must describe a full-repository snapshot review
of the current checkout. Scan/report views should tolerate and display
review-unit coverage metadata even when no confirmed findings are present.
