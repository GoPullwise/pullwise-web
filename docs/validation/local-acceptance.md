# Current local acceptance

Updated 2026-09-29. Companion: [Server acceptance](../../../pullwise-server/docs/validation/local-acceptance.md).

## Stage 3 preview publication (2026-09-29)

The user explicitly requested committing, pushing and deploying the completed
UI unification. This authorizes the Web preview release and supersedes the
local-only/deployment-pending statements in the following Stage 3 record.
Server and production configurations are unchanged. Publication verification
is capped at one HTML GET and three exact hashed static assets, with no
redirects/retries, authenticated API calls or provider traffic. These checks
have a D1 bound of zero Rows Read and zero Rows Written; no migration, cron or
budget reset is involved. Verification and release results are recorded after
completion.

The release candidate passed a fresh `npm run check` (lint, 34 files / 280
tests, production build), `npm run check:workers` and pinned Wrangler 4.136.3
preview packaging dry-run. The supplied eight-page loopback browser evidence
remains local UI acceptance; real provider/database acceptance is separate.

## Stage 3 workbench unification (2026-09-29, local only)

The approved Stage 3 visual proposals are implemented. Authenticated pages
now share one container language: flat, hairline-separated `.panel` sections
with `.panel-h` headings on Ledger, Billing, API Keys and Settings;
bordered boxes remain only for overlays, notices and nested control groups.
Item lists (projects, expenses, categories, API keys, GitHub installations,
subscription activity) are hairline rows, and the dashed `.empty` state is
shared. The Add repository/Add category panels lost their accent rail and
soft fill; Categories now mirrors Projects (list left, creation panel right)
via one `.ledger-split` grid. Detail pages merge filters and CSV export
into the Expenses section, render per-currency totals as large mono numerals
and place the two report charts side by side. The empty-state call to action
focuses the repository picker through a panel ref instead of a global
document query. The now-unused "Find an expense" heading was removed from
the locale catalogs. Stage 1/2 also removed the `.bill-card` family.

Local verification passed `npm run check`: lint, 34 test files / 280 tests
(including a new empty-state focus test and updated billing skeleton
assertion) and production build. No Wrangler/workerd/D1 commands were run;
Cloudflare runtime acceptance and deployment remain pending under the
existing pause. These changes are unpushed working-tree edits on top of the
deployed 12da105 baseline (current documentation HEAD: 409b70e).

Resume verification completed on 2026-09-29: `npm run check` passed again
(34 files / 280 tests, lint and build), as did the offline `check:workers`.
The API Keys loading skeleton's remaining `.bill-card` reference was changed
to `.panel`; no `.bill-card` consumers remain. This single-class visual cleanup
uses the existing skeleton test and browser review rather than a new test
that merely asserts its class name.

Loopback Playwright checks with synthetic API responses covered Projects,
project detail, Shared Pool, Categories, OAuth, Settings, Billing and API Keys.
All eight pages fit a 390px document width; desktop captures used 1440px.
Project creation opened its detail route, and Chinese/dark Projects was
visually checked. No JavaScript page errors occurred in the six-page ledger/
settings journey. External requests were blocked, including Google Fonts, so
captures exercise fallback fonts. API Keys direct navigation encountered the
local Vite `/api` proxy prefix; its HTML was supplied from the loopback index
for this UI check. This does not validate hosting/proxy behavior.
GitHub `gh run list` returned no runs; CI acceptance remains unavailable.
No deployment, provider traffic or D1 commands were performed in this resume.

## Joint preview release (2026-09-29)

The user approved deploying the completed Projects behavior repair together
with the current onboarding/layout/copy and the other agent's Stage 1/2 CSS
consolidation. Stage 3 visual proposals remain unimplemented. The consolidation
keeps the existing final appearance, moves OAuth overrides into their owning
rules, removes unused tokens and uses the shared `.notice` message variants.
The unchanged inline brand PNG and all five non-English locale catalogs are
included. Server source/config, production hosting, cron and D1 are unchanged.

Joint verification passed `npm run check`: lint, 34 test files / 279 tests and
production build. `npm run check:workers` and pinned Wrangler 4.136.3 preview
packaging dry-run passed. Publication evidence is appended after deployment.
The final production build also passed a loopback Playwright journey with
synthetic API responses: explicit project creation opened its detail page;
Projects, Shared Pool, Categories, OAuth and Settings had document width 390px
at a 390px viewport and no JavaScript page errors. Final light/English and
dark/Chinese captures were checked. A stale Vite development-session attempt
timed out; the final-build check supersedes that attempt.

Code commit `12da105` was pushed to main and deployed to
`pullwise-web-preview`, version `027a1540-6ad3-4df0-893e-21d21dc03021`, at
https://preview.pull-wise.com. The matching Server service binding and preview
variables were retained. Exactly four remote GETs returned 200: `/projects`
and the final index CSS, index JS and ledger JS. HTML had `X-Robots-Tag: noindex`
and referenced the current build; all three assets matched local SHA-256 hashes.
There were no retries or D1/provider requests. GitHub CLI still reports no
workflow run for this commit, so CI acceptance is unavailable despite passing
local checks. This release does not claim real GitHub/provider acceptance.
Remote verification remains limited to one HTML GET and three exact hashed
static assets, with zero retries and zero D1 rows read/written. No browser
provider journey or authenticated API validation is part of this publication.

## Projects onboarding and workspace usability (2026-09-29)

Local regressions reproduced missing repository reload after popup authorization,
summary failure blocking project controls, no navigation after project creation,
and incorrect reconnect guidance when repositories already have projects.
The fixes preserve explicit creation, permission boundaries and independent
pagination. Cancellation errors and late creation completion are covered.

Projects now prioritizes project rows and a repository chooser; Categories
explains reusable expense categories with examples. Shared Pool explains shared
tools/server costs and presents expense entry before reports. GitHub onboarding
shows account/repository/project steps; Settings links connected users to Projects.
English/Chinese copy and hard-edged light/dark styles are preserved.

Playwright CLI drove a loopback-only synthetic journey: create a project, open
it, then inspect Projects, Shared Pool, Categories, OAuth and Settings at 1440px
and 390px. Every mobile document width was 390px, with no JS page errors.
English/light and Chinese/dark screenshots were visually inspected. External
font requests were blocked in the harness. An inline ICO decode failure was
reproduced; extracting its unchanged PNG mark restored 256x256 image decoding.
Ignored screenshots/fixtures are local evidence only; no provider or D1 calls ran.

Publication is explicitly authorized for preview. Remote verification is capped
at one HTML GET and three exact hashed assets (one CSS, two JS), no retries,
no authenticated API or provider requests. These asset requests have a D1 bound
of zero read/zero written rows. No migration, SQL, cron or budget reset is needed.
Real preview OAuth and ledger data acceptance remain separate from this local
UI evidence.

## Projects authorization and creation repair (2026-09-29)

The user reassigned styling/layout/copy work to another agent. This candidate
contains only Projects behavior, regression tests and these functional notes.
It preserves the previously published UI and the Server REST contract.

The original code failed local regressions for popup completion refresh, summary
failure blocking controls, project creation navigation, already-added repository
guidance, stale repository selection and authorization-change data clearing.
The repair reloads once after successful authorization, catches cancellation,
keeps project controls usable when summaries fail and navigates after explicit
creation. It guards duplicate writes and late completions after unmount; stale
authorization responses cannot restore old repository options.

The exact isolated candidate passed `npm run check`: lint, 34 test files /
273 tests and production build. `npm run check:workers` passed offline. The
archive retained CRLF in robots.txt; that local-only fixture was normalized to
match the live checkout's LF before the whole suite passed. No unrelated source
change was included. GitHub CLI currently reports no Web workflow runs;
post-push CI remains to be checked. Deployment was deferred until the other
agent completed the styles; the later joint release supersedes that deferral.
No provider, D1, migration, cron or budget reset is required
for local verification. Real preview OAuth/data acceptance is not proven by
synthetic UI tests.

## Active product preview publication (2026-09-29)

The user explicitly requested product-wide preview. Web route repair was
published to pullwise-web-preview, version 66ff72ed-cd94-4cf0-89f2-9c9af21d71cc,
retaining the preview Server binding. A finite homepage GET verified 200 HTML
and X-Robots-Tag noindex. Production Web config was not changed.

Preview Server now admits product paths with per-SQL reservations and its fixed
1,000-write / 10,000-read budget. It initializes the frozen empty test schema
under the same journal; no new namespace/reset was used. Web auth/session
returned 200 unauthenticated, GitHub authorize 200, and the real test Creem
catalog 200. Its final recorded status was 67 written observed / 135 reserved
and no stop. These are finite HTTP checks, not real browser/login/payment
acceptance. The browser connector remained unavailable. Jev stays unavailable.

This supersedes the historical undeployed/pause/empty-case notes below. User
manual testing can now start at https://preview.pull-wise.com/. Budget exhaustion
or incomplete native accounting stops the test environment; never treat such
an error as an empty successful ledger or reset its counters.

## Zero-SQL checks and preview HTML routing repair (2026-09-29)

The user authorized only the preview Server access switch at 1; production
stays 0. Its deployed remote plan list remains empty. Source inspection and
one no-redirect/no-retry Web authorize GET verified **503 UNREVIEWED_CASE**
before D1/provider execution, with a row bound of 0/0. This is protection-layer
acceptance, not a login. No remote schema, account or payment SQL ran.

The browser connector inventory failed with nodeRepl.fetch and opened no page.
A fallback homepage GET returned 200 HTML with no expected X-Robots-Tag;
the /pricing and /login checks stopped without being requested. Exactly two
site requests ran in this phase. Cumulative recorded remote D1 usage remains
0 read / 0 written; no D1 monitoring query was used.

The preview vars and service binding were correct, but assets.run_worker_first
only included /api/*, so static HTML bypassed worker-entry's noindex/security
middleware. The config also lacked the ASSETS binding required by worker.js.
Cloudflare [asset-routing documentation](https://developers.cloudflare.com/workers/static-assets/binding/)
supports negative selective patterns. Preview now binds ASSETS and uses
["/*", "!/assets/*"] so HTML/API paths use the Worker while hashed assets
remain served directly. Production configuration was not changed.

Two regression checks failed before the guard repair. `npm run check` passed:
lint, **33 files / 263 tests**, and build. `npm run check:workers` passed for
both environments. GitHub CLI lists no Web workflow runs; this local repair
also passed a pinned Wrangler 4.136.3 preview packaging dry run with the ASSETS
and matching Server bindings. It has no new CI/build result and has not been
deployed. Real-browser, remote
noindex-after-repair and ledger/provider acceptance remain pending.

## Production login proxy 521 correction (2026-09-28)

Reproduced with three finite no-redirect requests: direct production API health
503, production Web GitHub-authorize proxy 521, preview proxy 503. Settings
confirmed API origin api.pull-wise.com, no Web service binding, the exact Server
zone route and an existing proxied A record. Cloudflare's
[routing documentation](https://developers.cloudflare.com/workers/configuration/routing/routes/)
states that same-zone fetch cannot target Routes. The Web request was reaching
the DNS origin instead of the Server Worker; direct-only pause checks missed this
boundary. Production DNS and Server deployment were retained.

Added per-environment PULLWISE_SERVER HTTP Service Binding; the proxy preserves
request bytes/credentials/Origin, redirects, cookies and streams. A binding
failure returns 502 without external-origin fallback/retry. Offline config
checks reject missing/wrong-environment bindings. HTTP errors retain nested
Server codes and render a clear public pause message instead of a generic 503.

Test-first reproductions failed before repair and passed afterwards. Full Web
check: 33 files / **261 tests**, lint/build passed; one subsequent body/cookie
binding regression passed in the **37-test** transport/config focused check.
Offline Worker config passed. GitHub CLI returned no Web CI workflow runs.

Production Web upload: `fae1b441-483a-468e-84f9-c337ac6d8e1c`. Metadata read-back
confirmed binding to pullwise-server-production. One finite post-fix request to
`/api/auth/github/authorize` returned exactly **503 D1_ACCESS_PAUSED**, replacing
521. Server access remains 0; no OAuth/provider action or remote D1 SQL occurred.
Preview Web is updated to the corresponding binding separately.

This repairs transport, not login activation. The user waived real GitHub
acceptance; the intentional pause remains until runtime/cost gates pass.
**Cumulative remote usage remains 0 read / 0 written.** No polling or cron.

## Plan policy and isolated preview (2026-09-28)

Pricing uses Server-provided configurable capacities and monthly Max Jev budget;
annual billing does not change the month/no-rollover rule. Free/Pro suggestion
clicks do not call Jev. The explicit profile check is single-flight and aborts
on draft change/unmount; no polling is added. Quota errors preserve manual drafts.

`npm run check`: lint, **33 files / 257 tests**, build passed. `npm run
check:workers` validates production and preview separately. Preview noindex,
isolated upstream and unavailable-Jev UI behavior are tested locally.

`pullwise-web-preview` was separately deployed at `preview.pull-wise.com`,
version `3a12463b-32e1-4782-85e9-f5345eef3791`, proxying preview-api.pull-wise.com.
Existing production Web was not redeployed. Preview Server remains paused at 0;
its DB is empty/unmigrated and no remote D1 SQL ran. A finite HTTP check stopped
on its first unexpected preview shell result; real browser/payment verification
is pending. The user waived real GitHub login/repository authorization testing.

Creem test webhook URL is `https://preview-api.pull-wise.com/webhooks/creem`;
test return URL is `https://preview.pull-wise.com/billing`. Do not send test
events or start checkout until Server admission/accounting gates permit the
finite run. Never use the production API for test payment data.

## Cost-control continuation (2026-09-28)

Server now has a locally verified persistent budget coordinator and metered D1
adapter. Its finite real local control fixture measured 7 Rows Read / 4 Rows
Written and rejected a third request; cumulative remote usage remains zero.
Remote admission plans are empty and production stays paused. This introduces
no Web source/design/deployment change; the existing 252-test/lint/build and
offline configuration evidence remains applicable.

A bounded browser connector getState attempt timed out after 25.6 seconds;
no browser navigation/provider journey occurred. S17 browser integration and
S18 remote/provider acceptance remain pending. Server migration/index/input
bounds and a reviewed shared preview coordinator are still required; see its
[budget audit](../../../pullwise-server/docs/validation/d1-validation-budget.md).

## Conditional S17/S18 continuation (2026-09-28)

The user authorized S17/S18 conditional on controlling D1 Rows Written.
This session reran `npm run check`: lint, 33 files / 252 tests and build
passed; `npm run check:workers` also passed. The existing Web Worker was not
modified. Server was separately deployed at `api.pull-wise.com`, using an
exact zone route preserving its DNS record, and keeps D1 access paused.
No remote D1 queries or migrations were performed. Server's 17 real local
HTTP checks include the 251-record CSV bridge; S17 browser integration and
S18 provider acceptance remain open;
see the Server [budget candidate](../../../pullwise-server/docs/validation/d1-validation-budget.md).
The previous pause statements below refer to the earlier verification run;
current authorization allows local-only S17 and conditional S18 preparation.

## Verified

- `npm run check`: ESLint, **33 test files / 252 tests**, and the Vite
  production build passed.
- `npm run check:workers`: offline Worker configuration check passed.
- Current ledger, account, key, payment, SEO, localization and proxy tests are
  retained. Billing processing-history UI, prototype entry, Pages duplicate
  proxy, unused helpers, icons, translations and styles were removed.
- Shared locale catalogs retain current account/payment/navigation phrases;
  ledger catalogs stay intact. Dynamic copy retains current interpolated
  phrases. Five shared catalogs each dropped 489 unused keys.
- The social-card SVG/generator/PNG now describe the expense ledger. The
  generated 1200×630 PNG was visually inspected for complete, unclipped copy.
- The Server collected its whole current suite: 107 tests and 22 subtests
  passed. The shared ledger REST contract remains the implementation authority.

## Limits and CI

Tests use synthetic identities and mocked API/Worker responses. No new browser
page capture was possible because the browser connector could not connect.
The CSS cleanup preserves current referenced classes and token/layout tests,
but does not claim real-browser visual acceptance.

The GitHub CLI query returned no Web workflow runs. This record captures local checks; CI for the cleanup commits must be verified
independently after push. The companion
documents the previously failed Server run and its local CI correction.

**S17 browser integration remains open; S18 provider acceptance is pending.**
The CSV bridge has real local Worker/D1 evidence in the companion record.
Remote D1 semantics, browser Cookie/domain behavior and real OAuth/App/Creem
flows remain unverified. Bounded local/runtime work and paused Server
deployment are authorized; do not enable remote D1 application access yet.
Review a separate Web preview configuration, Server domain,
callbacks, Secrets, migration/rollback and D1 cost bounds before remote work.
Local checks and generated assets are not deployment approval. Jev stays off.

S17/S18 must follow the workspace D1 Rows Written budget guard added
2026-09-28. Before authorization, bound browser requests/retries and all
upstream Server writes in a finite validation plan with a user-approved
numeric write/cost ceiling and enforceable caps. No automatic polling or
remote load tests; use a small one-off preview run for S18. A separate preview
database does not provide a separate free allowance assumption. The budget
approval permits bounded validation, not unlimited active-service usage.
