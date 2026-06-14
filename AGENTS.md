# Pullwise Web Agent Notes

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
