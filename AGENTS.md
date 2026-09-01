<!-- PULLWISE_REVIEWER_CURRENT_AUTHORITY_START -->
## Pullwise Reviewer — Current Implementation Authority

For every new Pullwise Reviewer implementation task, the only entry point is
[Pullwise Reviewer — Current Implementation Authority](https://app.notion.com/p/3b4e5c88f85f8128bd39dac3a7679c4a).
Follow its [current implementation specification](https://app.notion.com/p/3b4e5c88f85f818e933ecf3864c97469),
[live implementation cards](https://app.notion.com/p/b79ceacfedcd4d34a0d619c1790066c4), and
[Code Authorization Registry](https://app.notion.com/p/760a1698a86b404083662eeb1b637f64).

Before any card, read [00A](https://app.notion.com/p/3b5e5c88f85f81bc840ace8b8a65962e), [00B](https://app.notion.com/p/3b5e5c88f85f81aeaeaef4621d211126),
[00C](https://app.notion.com/p/3b5e5c88f85f81d89deef714c8b23eeb), [00D](https://app.notion.com/p/3b8e5c88f85f814d8296c6c60541946d) whenever a named asset is required,
and [Page 19](https://app.notion.com/p/3b4e5c88f85f8192a488f6db72fa116b). Only an exact live card authorization plus a PASS
running gate permits tracked writes. Never self-authorize a card or treat
documentation status as code authority.

All later Reviewer protocol, runtime, phase, fanout, generated-package, and
production-cutover guidance is retained only as current-state cleanup evidence;
it must not govern new Reviewer implementation. Unrelated repository security,
deployment, frontend, and testing rules remain binding unless they conflict with
the current Reviewer authority.
<!-- PULLWISE_REVIEWER_CURRENT_AUTHORITY_END -->
<!-- PULLWISE_REVIEWER_TARGET_START -->
## Pullwise Reviewer Target — Node.js + Pi Coding Agent

For all new Pullwise Reviewer implementation, the sole Worker target is
Node.js/TypeScript on Node `>=22.19.0`, embedding
`@earendil-works/pi-coding-agent`. One active attempt owns one Pi
`AgentSession`.

This is a clean break. Do not add or preserve a Codex SDK or CLI, `CODEX_HOME`,
a Python Worker runtime, compatibility or shadow adapters, dual runtimes,
provider routing, or automatic provider/model fallback. Pi is not a sandbox:
the Worker supervisor must enforce operating-system containment, process-tree
ownership, cancellation, cleanup, and late-publication fencing.

Do not query or poll subscription/account quota windows, percentages, reset
times, low/exhausted readiness, or refresh-window commands. Preserve immutable
per-attempt input/output/cache-token usage, cost when reported, timing,
provider/model identity, and provider-error facts. Product account/repository
scan quotas are separate business controls and remain in force.

Any later Reviewer-specific Python, Codex, quota-window, runtime, phase, or
generated-consumer rule in this file is historical cleanup evidence only and
must not govern target implementation.
<!-- PULLWISE_REVIEWER_TARGET_END -->

## Public Pi runtime availability

- Public status consumes Server `availableReviewModels` and displays the
  de-identified union of online Worker provider/model pairs.
- Never expose credential ids, account labels, API keys, tokens, per-Worker
  assignments, or infer model availability in Web. Server output is
  authoritative.

## Four-project local debug behavior

- The production entry renders `App` inside React `StrictMode`. Initial session
  cleanup must abort and synchronously release only its own in-flight session
  guard so the remount can start a replacement request; stale request cleanup
  must never clear a newer request's guard.
- `safeGitHubAuthorizeUrl` may accept the exact `/auth/github/callback` or
  `/api/auth/github/callback` path only when both the callback host and trusted
  configured/current API origin are loopback. Never extend that local-mock
  exception to non-loopback first-party origins or arbitrary paths.

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
- Cache clear state belongs in `src/lib/pullwise-data-cache.js`. `App.jsx`,
  `src/lib/auth.js`, and `src/test/setup.js` must import
  `clearPullwiseDataCache` directly from that lightweight module; do not route
  it back through `src/lib/pullwise-data.js` or restore a global test hook,
  because that pulls the heavy data module back into the initial load graph.
- New API client GET helpers should accept an optional AbortSignal. Hook
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
  limited the original work to one unactivated candidate. Its exactly-once
  Generate allowance was consumed, and D35 withdraws that old tuple; never
  restore or fall back to those prior package bytes.
- D35 (`8cde7af149db8e6051f0342bd9490c4be31fce7b1868270ce7206350ee252a9e`)
  authorized exactly one replacement after all Server pre-generation gates were
  green. That allowance is consumed by package `0.1.0`, content
  `11ced3caa5333f5d841a5f5d0ca33e9a91522f9809cd23943f56d1f371409564`,
  and root `e6dc056cb1b61c2a47c28d3e02117352bae35c7fecb07d10bad6afd65b9e194e`.
  Any further Generate requires another append-only superseding decision.
- D36 (`cb40a540cff9af1d350bf1a413aa3aeaee0ca1ddce65afabec7443f294944a1b`)
  authorizes only local repository and CI implementation/verification of S3-S7.
  It does not authorize D24 implementation or enablement, deployment,
  production traffic, canary UI, legacy deletion, fallback package bytes, or
  S8 release/cutover/rollback.
- D37 (`ae16d63b19bcd6ec81c65daf1668a3bf8878210aed137a59761ca9b36f96aa70`)
  is resolved to `bounded_s4_contract_closure_one_generate_no_activation`.
  Every required pre-generation gate passed, and its single Generate allowance
  is consumed by package `0.1.0`, content
  `9dfa928d1a2d139036701b7d69354e6e4ceb16b9fa5d913fc77cd6fd823454fb`,
  root `4a37e789495b8b22d102ef1e87110b8e28abf555fa30bcd5baa1a2568d4b22ef`,
  Server producer commit `a223f1ffdee345da366ab7c3bf8ca230ad7f39cb`,
  wrapper SHA-256
  `5ce5340f90f7ea369bbe1395b63379f34576316d08c19d47f309e0c325f9354f`,
  and package-manifest SHA-256
  `31f468dc2001915b8640c2a78a7c3d95c544e8f82e84c193fe5798614488bf80`.
  Do not Generate again without another append-only superseding decision.
  These exact pins close the S4 wire prerequisite for local S4-S7 TDD only;
  D24 implementation or enablement, production activation, deployment,
  production traffic, canary UI, legacy deletion, fallback/dual paths, and S8
  release/cutover/rollback remain forbidden.
- D38 (`d1cbc20e4220c6d073d01a060cce1ae2f109459e0c110d4e403c41ecd0303368`)
  is resolved to
  `bounded_s5_terminal_control_and_selector_closure_one_generate_no_activation`.
  It authorized only the bounded S5 source closure and exactly one Generate
  after every Server pre-generation gate was green. That allowance is consumed
  exactly once (count `1`) by package `0.1.0`, content
  `51445b46d40b1c61387edfa3a4bd68e18fa388e7ac2139c45e870a3a6a3cc29d`, root
  `76b6c450fecacc5209cfc426c337134c0f8a7361c830d9d17103160d746233d9`, Server
  generated-artifact commit `5048af9`, Web generated-artifact commit `3c703e9`,
  wrapper SHA-256 `c88455efd633746a34c8833e015d26ca4cd1beb5add4eb2cdd711ffeb7ce48d0`,
  and package-manifest SHA-256
  `926b673652924591adb85ed7dbf72495ab113f0e9aa8b2381b5e28bf470e65df`.
  Web may consume only those exact generated bytes and synchronized logical
  digests; do not Generate again without another append-only decision. It must not
  reconstruct the passed-Success-Gate bridge or selector, accept caller-chosen
  outcomes, or add a second authority/store/runner, fallback, dual path,
  compatibility/downgrade shim, activation, deployment, production traffic,
  canary UI, legacy deletion, D24 implementation, or S8 cutover/rollback.
- D39 (`85365d344a6bc0d36d5d11dbc088278722083bf51e98c9cd518dd3d57ac90f9c`)
  is resolved to
  `bounded_s7_transport_attempt_binding_one_generate_no_activation`. It
  supersedes only the pre-D39 S7 `SPEC_GAP` and authorizes bounded local S7
  closure: consume the exact package tuple below while the Worker authenticates
  the outer `transport_attempt_id`, captures debug fragment/descriptor variants,
  enforces replay/conflict/concurrency/redaction/bounded extraction behavior,
  and adds migration 9 with schema-v9 fingerprint
  `028cc25005ce33dd7b16017fe7e5324774205b0b603f2e2582e9930511065e6a`.
  Exactly one Generate was consumed (count `1`) for
  `@pullwise/agent-task-contract@0.1.0`: content
  `35468e289dd08a2b9a91b5c7ffb589f844c4373cfedd8f3846cc40dd1e8f6105`, root
  `ff6fce2d8a0d28adeb880b97ebfaa6037fa0503eb7c1accd68e840994add43b1`,
  Python wrapper `bd099dd825c2b2340061b67500bc02f1bb4fee0a1ce7ff44138b36b8821a59fd`,
  npm wrapper `4027cf1383772871efa293a1c55338e96e17d5c0387efd84d059585cdce6c0ef`,
  and package manifest
  `161c7d7bef846de963a491f2d9f07f9cbc1ced039a3c017467d6f02f14b1925e`;
  Server producer commit is `06ed22299e324a8a39f9030c653aef34044c3d3e`.
  Web remains an exact-pin consumer and local candidate-only surface: do not
  Generate again, invent/project identity, add debug UI semantics or fallback
  URLs, activate D24, deploy, send production traffic/canary, delete legacy
  paths, add fallback/dual/compatibility/downgrade shims, create a second
  authority/store/runner, or begin S8.
- D40 (`ce023be3c467370077f967bb7e17e9dee2064ea1fbe213a7a97b6815aec6cdc9`)
  audited S8 locally and stopped at the missing raw-evidence package contract
  with zero contract changes or Generate.
- D41 (`ccfa987beb48b1158a0122b13ed6bab40bd955e5142fbd1e0fc56f7151b1cca5`)
  authorizes one Server-owned raw-evidence contract closure and exactly one
  Generate after all pre-generation gates pass. The approved public package
  adds `release-gate-sample-set/v1`, exact report ContentRef/digest binding,
  and deterministic Server-owned derivation through
  `deriveReleaseGateEvaluation` / `derive_release_gate_evaluation`.
  All pre-generation gates passed and the exactly-one Generate allowance is
  consumed at count `1` by package
  `@pullwise/agent-task-contract@0.1.0`, content
  `501ed1be77f96f5a00f1fb9cfd59da64ca46b317f117e8661af7d7948a9374e4`,
  root
  `1a79eb16f24c0390b9916255db251e7f607f5c23cc3a1afec5de4a63fb155ed9`,
  npm wrapper
  `76c92a690b35f8c676e391925dd8377ac731a880326fc729360cb122cdeca959`,
  package manifest
  `11f3400110578cbd2e5716f18c41318cc1db7ed6ce728160c5335ee160bddc94`,
  and Server producer commit
  `69c5fcc8964398b2ad156c6d8219230fce908715`. Server/Worker/Web exact
  generated bytes and pins are synchronized; do not Generate again without a
  new append-only superseding decision. Web must not
  reconstruct samples or evaluation, add a second authority/store/runner,
  fallback/dual/compatibility/downgrade behavior, D24 activation, deployment,
  production traffic, real benchmark/signing/attestation/release, canary,
  legacy deletion, or cutover.
- The preceding S7 `SPEC_GAP` text is historical pre-D39 guidance; native
  Attempt ID substitution remains forbidden and D39's no-activation boundary
  controls the current work.
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
- The tri-state evaluator is consumed only through the exact-pinned generated
  `evaluateReleaseGate` / `evaluate_release_gate` exports. Web must not add
  evaluator storage, trust/signing UI, baseline/canary state, production
  activation, deployment, or external-canary claims in this candidate.
- Exclude only `vendor/generated/agent-task-contract-npm/**` from Web ESLint because those bytes are immutable Server-generated output; keep `eslint.config.test.js` protecting both that generated-artifact exclusion and continued linting of Web-owned source.

## Public Search Metadata

- Keep indexable public routes, canonical paths, titles, descriptions, social metadata, and schema definitions centralized in `src/lib/seo.js`; keep `public/sitemap.xml` synchronized with `PUBLIC_INDEXABLE_PATHS`.
- The Cloudflare deployment entry is `worker-entry.js`. It wraps the API/static worker, redirects `www.pull-wise.com` to the apex host, and injects route-specific metadata into the HTML shell before JavaScript runs.
- Public product, pricing, developer docs/API, legal, and status pages are indexable. Login, unknown, and authenticated app routes must emit `noindex,nofollow` without a canonical or JSON-LD payload.
- Keep `public/robots.txt` open to `OAI-SearchBot` while treating `GPTBot` training access as a separate policy. Do not add `llms.txt` or AI-only markup as a substitute for crawlable pages and ordinary structured data.
- Generate the 1200x630 social preview deterministically with `scripts/generate-social-card.ps1` whenever the share-card source or product positioning changes; metadata must never reference a missing image.

## Web Visual And Frontend Resilience

## Frontend Audit Remediation

- Global search uses the server-backed issue/repository hooks with a 300ms debounce; keep native searchbox semantics and authoritative result rendering.
- Global search keeps a 12vh top offset. Subtract that same offset from both vh and dvh max-height calculations, and keep .search-body as the flex scroll region so result-heavy dialogs retain a visible header and footer.
- Search, quota, and billing-change dialogs must trap focus, close on Escape, restore opener focus, and inert the background while open.
- Repository selection is controlled by native checkboxes; Space and Enter must update selection, while branch selection keeps listbox keyboard semantics.
- Mobile Issues labels are real DOM content rather than CSS-generated text. Scan-flow panning must allow ordinary page scrolling and reserve wheel prevention for modifier-key zoom.
- API-key, billing, pricing, and issue loading failures must remain visible with retry actions and must not silently replace unknown/error state with fake empty or fallback data.

- Keep the public UI editorial and hard-edged: zero decorative radius/shadow, a restrained monochrome palette, and one indigo accent. Landing, Pricing, Docs/API, Privacy/Terms, Status, the public header/footer, and major preview sections must share the same 1240px horizontal frame with 40px desktop gutters. At 420px and below, keep the shared public frame on 16px gutters; do not cap the Privacy/Terms main column inside that frame.
- UI font sizes resolve to the `--fs-*` type scale in `base.css` (`--fs-micro` 10px through `--fs-4xl` 22px); display/hero sizes keep local `clamp()` values. Do not introduce off-scale or fractional-px font sizes. Categorical chart hues use the `--cat-*` tokens (with dark-theme variants); the GitHub language colors in `flow.jsx` stay hardcoded by design because they are external identity colors, not theme colors.
- The public Security page and `/security` route are intentionally removed; do not add Security back to the public header or footer navigation without new product direction.
- Landing may use an asymmetric hero, but Pricing owns a separate centered hero rule. Do not let generic landing title/subtitle selectors move the Pricing heading off center.
- Prefer continuous divided data bands for dashboard metrics and summaries. Reserve standalone cards for interactive, result-bearing, or independently actionable content.
- Scan detail findings are result-only. Gate the Finding summary and review-agent metadata with `scanHasResults`; queued, running, cancelled, and lost scans should show execution/log context without a zero-filled result card.
- Hide the scan detail header action group while a history scan is showing its detail skeleton. Render Back and any status-eligible actions such as Cancel only after the detail request finishes.
- Keep scan detail result-first: use a full-width scan identity header, place the human report before the execution trace, and collapse `.scanning.scanning-wide` to one column at 900px or below. On narrow screens, keep the result summary before the report/trace while the progress flow remains internally pannable without creating document overflow.
- Async purchase/save/refresh actions need a synchronous in-flight guard in addition to disabled UI state so two clicks in one render frame cannot create duplicate requests.
- Keep shared `.spin` wrappers as centered inline flex containers. Topbar loading uses a 28px wrapper around a 14px SVG; an inline-block wrapper makes the glyph orbit the wrapper center while rotating.
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
- The final hard-edge override for `.lang-toggle`, `.theme-toggle`, `.back-to-top`, `.notification-toast`, `.notification-icon`, and `.notification-close` must keep an explicit `border-radius: 0;` because the universal square-edge reset loses to those class rules.
- Floating controls such as `.lang-picker` must stay on `--z-float` (60) below `.modal-back` on `--z-modal` (100); do not raise picker/menu chrome above modal backdrops.
- Do not map `base.css`, `screens.css`, and `app.css` directly into progressive `@layer`s. Status/Billing specificity and source order are load-bearing; any migration must happen rule-by-rule against a real computed-style baseline.
- Do not force existing spacing onto a 4px grid or merge distinct breakpoints. `760/761` and `899/900` are complementary boundaries; moving those thresholds changes the rendered UI.
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
