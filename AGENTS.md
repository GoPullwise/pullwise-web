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

## Public REST API Rate Limits

API rate limit copy and docs are about public REST API automation, not ordinary
browser web app requests.

- Keep public docs and UI copy scoped to REST API/API-key traffic.
- Do not imply that signed-in web app calls such as session refresh,
  repositories, scans, issues, settings, or billing are governed by the narrow
  REST API rate limit.
- If the server exposes rate-limit settings in `/docs/server-config`, render
  them as public REST API limits.

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
- Repository selection on the scan setup screen must survive owner/organization filters, search, and paginated repository pages. Keep selected repository ids, repository objects, and selected branch state independent from the current `useRepositories({ owner, q })` page; do not prune selected repositories merely because they are absent from the currently visible owner page.
- Batch scan submission that navigates to Scan history must pass the newly
  created scan ids as pending/expected ids. Scan history should keep the
  skeleton state and quietly refresh until the loaded list contains every
  expected id; only then should it switch to the list UI. Do not rely only on
  the first paginated history page while waiting: use a targeted by-id status
  refresh for missing expected ids so newly created scans can be inserted even
  when pagination or ordering keeps them out of the current list page. If that
  wait expires, show the existing refresh guidance rather than rendering a
  partial/empty list as if the batch were loaded.
- Batch issue status updates should use the batch endpoint for bulk "mark fixed"
  flows. Keep single-issue update only as a narrow fallback.

## Review Worker Result Display

Web displays only data supplied by the server for the `review-worker-protocol/v1`
worker. Do not require extra derived artifacts or non-protocol report fields for new
scan detail, dashboard, issue, or audit-bundle views.

Primary completed-run display should use server-provided `humanReport`, summary,
progress snapshot, `reviewRun` terminal state, `reviewRun.artifacts` metadata,
issue counts, and any normalized finding index the server exposes. Do not fetch
or infer raw worker internals to construct terminal state. If future server data
contains a natural graph or visual structure, render it from that explicit
structure; otherwise use clear text/tables from supplied artifacts and summaries.
Do not keep graph-rendering dependencies, global graph styles, or graph vendor
chunks as placeholders. Add them only with an explicit server-provided v1 graph
contract and regression tests for that display path.
Treat `partial_completed` as a result-bearing terminal state for history/detail
actions when the server exposes scan or `reviewRun` data. It may have fewer
issues or artifacts than a completed scan, but it should not be hidden behind
queued/running/failed-only UI gates.
Scan history debug bundle actions must download a real server-provided
`debugBundleUrl`. Do not copy debug URLs in the UI, and do not fall back to the
stable scan audit bundle URL (`/scans/:id/audit-bundle.zip`) when the worker
debug artifact is not uploaded yet. Disable or omit the debug bundle action
until a real debug bundle endpoint exists for the scan row.
Progress UI must be driven by worker-reported flow data exposed by the server,
not by a web-owned or server-owned fixed step list. Job scan detail pages should
render `progressSteps` / `reviewRun.progress.steps` from scan payloads exactly as
the worker reports them after server sanitization. Different worker types may
report different phase ids, labels, counts, order, and progress states. Do not
recreate the current Codex worker phase list in web code, do not assume 30
steps, and do not map legacy phase aliases into a synthetic full flow. If older
payloads lack `progressSteps`, show only the currently reported phase/log data
rather than filling in a guessed pipeline.
Worker readiness and status views may receive server-sanitized Codex app-server
quota telemetry (`codexQuota` / `codex_quota`). Preserve that data when changing
worker status or scan eligibility displays so users can distinguish an idle
worker that cannot claim jobs because Codex quota is exhausted from an offline or
misconfigured worker.
## Audit Bundle Actions

Audit bundle download controls must share the same eligibility rule everywhere in the web app. Use `scanCanDownloadAuditBundle(scan)` from `src/lib/pullwise-data.js` for Scan history row menus and Scan detail header actions instead of recreating local status checks.

- Result-bearing scans are `done`, `failed`, and `partial_completed` unless they carry the blocking `WORKER_ARTIFACT_INVALID` error.
- `cancelled`, `lost`, `queued`, and `running` scans must not start audit bundle downloads; keep the control disabled when the surface shows a disabled action.
- The Scan detail terminal action area should reserve the primary action slot for Audit bundle. Do not reintroduce the old Overview button there unless product direction changes.
## Debug Bundle Contract

A debug bundle is not the audit bundle and must never silently fall back to the audit bundle.

- A real debug bundle combines worker-side live evidence and server-side evidence for the same scan/job/run.
- Worker-side evidence should include run-local logs, Codex app-server events, progress logs, run-state, phase outputs, terminal QA/error reports, and the worker artifact manifest. It must not include repository source files, raw API keys, unredacted environment dumps, or unrelated worker-instance state.
- Server-side evidence should include only scoped records for the same scan/job/run: scan/job/attempt/run identifiers, phase/progress/error snapshots, review-run events, artifact metadata/storage references, quota state, and relevant timestamps. It must not include full database dumps, secrets, other users' data, or unrelated scans.
- The UI must disable or omit debug bundle actions when no real debug_bundle artifact/server debug bundle endpoint exists. Do not substitute /scans/{scanId}/audit-bundle.zip as a debug zip URL.
- Scan detail header actions should expose a Debug bundle download link whenever the scan payload or reviewRun debug_bundle artifact contains a real debugBundleUrl/storage URL.
- Tests should protect this contract: missing debugBundleUrl must not produce an audit-bundle URL, and server/worker tests must verify failed runs still expose a real debug_bundle artifact or explicit absence.
