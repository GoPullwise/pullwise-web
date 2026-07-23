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
- Repository scan quota is a single global monthly value from
  `quota.repositoryReviewLimit`; do not parse, document, or display repository
  scan quota as a subscription-plan field.

## Quota UI Behavior

- Selection blocking should account for both account remaining quota and each
  repository's remaining quota.
- Structured quota errors such as `QUOTA_EXCEEDED_USER` and
  `QUOTA_EXCEEDED_REPOSITORY` should drive billing/upgrade routing; do not route
  arbitrary unstructured error text as if it were a quota signal.
- Public REST API docs are account-scoped and should continue to describe
  repository listing, scan control, scan status, and quota checks with account
  and repository terminology.
- When docs or copied examples derive the API base from a root-relative value
  such as `/api`, resolve examples against the current browser origin and keep
  generated `curl` URLs same-origin; do not fall back to
  `https://api.pull-wise.com` for those examples.

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
- "Mark all fixed" is filter-wide, not loaded-page-only. Read every remaining
  matching issue page before changing any statuses, then send explicit status
  updates in batches of at most 100 because the server processes only the first
  100 updates in one request. Do not mutate a status-filtered page before
  collecting later offsets, because the result set can shift and skip issues.

## Localization

- For `T(english, chinese)` calls, the inline Chinese argument overrides the shared phrase table
  while Chinese is active. Keep that argument production-ready; do not use placeholder text even
  when the English key already exists in `PHRASE_TRANSLATIONS`.
- Review output-language saves use a synchronous ref-backed in-flight lock. Disabled select state alone is not the mutation guard, because programmatic or same-render-frame change events must not start overlapping saves.

## Whole-Scan ETA Display

- `scan.estimate` is the worker-authored estimate for the whole running scan,
  never the current phase. Normalize it defensively, prefer the sanitized
  top-level field, and use nested review-run progress only as a compatibility
  fallback; do not calculate an ETA in Web.
- Queued scans show queue state without an execution ETA. Running scans render
  an ETA only after the worker supplies a valid `available` estimate; keep
  `estimating`, `unavailable`, missing, and invalid estimates hidden. Render the
  valid estimate as an outward-rounded whole-minute lower/upper range. Do not
  show false second-level precision, a phase ETA, or a countdown that the worker
  did not provide.
- Once a running scan has a valid ETA, retain the latest valid range across
  same-status list refreshes and status polls that omit, invalidate, downgrade,
  or arrive older than that estimate. Replace it only with an equally new or
  newer valid estimate, and clear it as soon as the scan leaves `running`.
- Scan detail shows actual elapsed duration for terminal scans and never retains
  the running forecast. Scan history rows show a valid running ETA as a
  standalone badge immediately after the status badge in the title tag row;
  once a scan leaves `running`, hide timing from that history row entirely.
  Keep ETA status changes screen-reader friendly with polite live status, and
  keep the display safe for long content and narrow mobile layouts.
- Terminal duration must prefer a complete `reviewRun.startedAt` /
  `reviewRun.completedAt` pair, then a complete top-level scan timestamp pair.
  Use `reviewRun.durationMs` and finally top-level `durationMs` only as
  fallbacks; do not mix timestamp sources or let a stale scan mirror override
  the canonical review-run duration.

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
Treat every server-provided artifact/debug URL as untrusted display data. Links
may use only same-origin root-relative paths (a single leading `/`, never
protocol-relative `//`) or absolute `http:`/`https:` URLs; reject
`javascript:`, `data:`, and every other scheme before rendering an anchor or
starting a download.
Do not keep graph-rendering dependencies, global graph styles, or graph vendor
chunks as placeholders. Add them only with an explicit server-provided v1 graph
contract and regression tests for that display path.
Treat `partial_completed` as a result-bearing terminal state for history/detail
actions when the server exposes scan or `reviewRun` data. It may have fewer
issues or artifacts than a completed scan, but it should not be hidden behind
queued/running/failed-only UI gates.
Debug bundle downloads are a scan detail-only action. Do not expose debug bundle
download controls from scan history rows or other Web pages. On scan detail, use
only a real server-provided `debugBundleUrl`; do not copy debug URLs in the UI,
and do not fall back to the stable scan audit bundle URL
(`/scans/:id/audit-bundle.zip`) when the worker debug artifact is not uploaded
yet.
Progress UI must be driven by worker-reported flow data exposed by the server,
not by a web-owned or server-owned fixed step list. Job scan detail pages should
render `progressSteps` / `reviewRun.progress.steps` from scan payloads exactly as
the worker reports them after server sanitization. Different worker types may
report different phase ids, labels, counts, order, and progress states. Do not
recreate the current Codex worker phase list in web code, do not assume 30
steps, and do not map legacy phase aliases into a synthetic full flow. If older
payloads lack `progressSteps`, show only the currently reported phase/log data
rather than filling in a guessed pipeline.
Keep the scan detail flow as an accessible horizontal list: nodes use worker-reported
status and `percent`, expose per-node progressbars, and connectors distinguish
completed, active, and pending transitions. Preserve active-node auto-centering and
pan/zoom behavior on narrow screens when changing the flow layout.
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

## Agent-First Contract Package

- Consume Agent-First schemas only from the Server-generated `@pullwise/agent-task-contract` wrapper checked in at `vendor/generated/agent-task-contract-npm`; never copy schemas or reconstruct a partial bundle in Web code.
- Keep `package.json` and `package-lock.json` locked to the exact local generated artifact. Do not use a version range, registry tag, workspace/link override, sibling-repository path, legacy fallback, or runtime schema substitution.
- `contract-package-pin.json` must pin the package identity/version, logical content/root digests, and exact wrapper/package-manifest bytes. Regenerate it only after the Server generator publishes one final atomic bundle.
- D34 (`2be5b5752b65714204fa6f41a0a126eb30e82bafcdeb38b5ece426938561158c`)
  limits the current work to an unactivated candidate. Accept the updated pin
  only after all Server pre-generation gates are green and the Server Generate
  command has run exactly once. This phase must not add production
  current-task/operator routes, auth integration, D24 activation, deployment,
  canary UI, or any fallback to the prior package bytes.
- Treat `schemaIds()` as the public document projection. The exact nine
  `internal_constraint` TaskResult outcome variants are
  `task-result-completed-variant/v1`,
  `task-result-completed-with-waivers-variant/v1`,
  `task-result-no-change-needed-variant/v1`, `task-result-partial-variant/v1`,
  `task-result-blocked-variant/v1`, `task-result-cancelled-variant/v1`,
  `task-result-cancelled-with-effects-variant/v1`,
  `task-result-failed-variant/v1`, and
  `task-result-terminated-with-unknown-effects-variant/v1`; do not expose them
  as standalone document validators.
- D22 adds these public document schema/family pairs to the generated candidate:
  `benchmark-bundle/v1` / `benchmark-bundle`, `release-gate-policy/v1` /
  `release-gate-policy`, `release-gate-report/v1` / `release-gate-report`, and
  `release-gate-attestation/v1` / `release-gate-attestation`. Their presence
  records the current public projection; it does not mark the Agent-First
  program complete or activated.
- Exclude only `vendor/generated/agent-task-contract-npm/**` from Web ESLint because those bytes are immutable Server-generated output; keep `eslint.config.test.js` protecting both that generated-artifact exclusion and continued linting of Web-owned source.

## Public Search Metadata

- Keep indexable public routes, canonical paths, titles, descriptions, social metadata, and schema definitions centralized in `src/lib/seo.js`; keep `public/sitemap.xml` synchronized with `PUBLIC_INDEXABLE_PATHS`.
- The Cloudflare deployment entry is `worker-entry.js`. It wraps the API/static worker, redirects `www.pull-wise.com` to the apex host, and injects route-specific metadata into the HTML shell before JavaScript runs.
- Public product, pricing, developer docs/API, legal, and status pages are indexable. Login, unknown, and authenticated app routes must emit `noindex,nofollow` without a canonical or JSON-LD payload.
- Keep `public/robots.txt` open to `OAI-SearchBot` while treating `GPTBot` training access as a separate policy. Do not add `llms.txt` or AI-only markup as a substitute for crawlable pages and ordinary structured data.
- Generate the 1200x630 social preview deterministically with `scripts/generate-social-card.ps1` whenever the share-card source or product positioning changes; metadata must never reference a missing image.

## Web Visual And Frontend Resilience

- Keep the public UI editorial and hard-edged: zero decorative radius/shadow, a restrained monochrome palette, and one indigo accent. Landing, Pricing, Docs/API, Privacy/Terms, Status, the public header/footer, and major preview sections must share the same 1240px horizontal frame with 40px desktop gutters. At 420px and below, keep the shared public frame on 16px gutters; do not cap the Privacy/Terms main column inside that frame.
- The public Security page and `/security` route are intentionally removed; do not add Security back to the public header or footer navigation without new product direction.
- Landing may use an asymmetric hero, but Pricing owns a separate centered hero rule. Do not let generic landing title/subtitle selectors move the Pricing heading off center.
- Prefer continuous divided data bands for dashboard metrics and summaries. Reserve standalone cards for interactive, result-bearing, or independently actionable content.
- Scan detail findings are result-only. Gate the Finding summary and review-agent metadata with `scanHasResults`; queued, running, cancelled, and lost scans should show execution/log context without a zero-filled result card.
- Hide the scan detail header action group while a history scan is showing its detail skeleton. Render Back and any status-eligible actions such as Cancel only after the detail request finishes.
- Keep scan detail result-first: use a full-width scan identity header, place the human report before the execution trace, and collapse `.scanning.scanning-wide` to one column at 900px or below. On narrow screens, keep the result summary before the report/trace while the progress flow remains internally pannable without creating document overflow.
- Async purchase/save/refresh actions need a synchronous in-flight guard in addition to disabled UI state so two clicks in one render frame cannot create duplicate requests.
- Frontend regression coverage should include request timeout/recovery, abort/unmount, stale responses, rapid repeated actions, loading/error/empty states, long unbroken content, and a real 390px browser check where document scrollWidth equals clientWidth.
- Pricing must not render the backend-billing-unconfigured notice until the initial plan request has resolved; loading skeletons represent unknown configuration, not disabled billing.
- API-key and batch-scan mutations must acquire a ref-backed synchronous lock before their first await; React loading state alone is not a duplicate-request guard.
- A created API-key record without its one-time token is a committed partial success: keep the metadata visible for revocation and show a recovery error instead of treating the key as absent.
- Associate a displayed one-time API token with its key id. Clear it only after that same key is successfully revoked, and preserve it when another key is revoked.
- GitHub connect and installation-management actions on the same screen share one ref-backed synchronous lock across both action types.
- Treat server-filtered global issue/repository results as authoritative; do not discard fuzzy or nonliteral matches with a narrower client-side substring filter. Shared pagination must de-duplicate stable identities and terminate with recoverable guidance when a page adds no identities or its next offset does not advance.
- Audit-bundle blocking depends on the structured `WORKER_ARTIFACT_INVALID` code even when display copy is absent. Unknown initial and `popstate` routes must resolve consistently to Not Found.
- Scan-history handoff polling must have a finite deadline. After expiry, stop automatic retries, reveal the current history, and restore manual Refresh.
- Root-relative API bases and audit-bundle paths must resolve to an absolute browser URL without duplicating a shared `/api` prefix.
- Repository-access refresh flags must fall back to memory when any individual `sessionStorage` operation throws.
- Clickable distribution legend entries must use keyboard-operable controls with visible focus and pressed state, and notification chrome must provide real Chinese labels while Chinese is active.
- Global search must pass the typed query to the server-backed issue and repository hooks; do not search only the first cached client page.
- Public status copy for `rateLimitEnabled` must say public REST API rate limiting so browser users do not infer that ordinary browser traffic shares the API/API-key limit.
- Keep Vitest suites non-empty; Vitest 4 treats an empty `describe(...)` block as a suite failure even when every collected assertion passes.
- Automatic session redirects must replace both the rendered screen and `window.history` path (`/login` or `/`) so reload/back navigation cannot revive the stale route.
- `useScans` pagination must de-duplicate stable scan ids and terminate with recoverable guidance when an appended page adds no ids or returns a non-advancing cursor, matching the shared paged-list contract.
- Billing subscription mutation completions must not navigate or update state after `BillingScreen` unmounts.
- Docs initial loads and Retry loads must share an abortable request lifecycle. A retry must replace and abort the previous controller, and screen cleanup must abort whichever request is current.
- Active scan status polling must abort its in-flight request when the page becomes hidden, remain paused while hidden, and resume on the next visible transition.
- Issue-detail GETs must use the same abort discipline on issue-id changes and
  unmount. Tests and API mocks must retain the request-options argument so the
  `AbortSignal` contract cannot silently disappear.
- Composite cache identities must encode component boundaries; concatenating
  repository, scan, and issue ids with an ambiguous delimiter can cross-load
  records. Issue mutation must update an exact/unique compatible entry only,
  never every cache row sharing a raw finding id.
- Render worker-reported progress step ids/statuses verbatim. Do not rewrite a
  running worker step to completed from the scan wrapper status, and preserve
  `partial_completed` as a distinct terminal presentation.
- Pages API proxy tests must assert both the stripped upstream path (`/api/...` to `/...`) and byte-for-byte request-body forwarding; header-only assertions do not protect the proxy contract.
- When joining a root-relative API base to a server-provided debug artifact URL, preserve URLs that already contain that base path; `/api` plus `/api/v1/...` must remain `/api/v1/...`.
