# Current local acceptance

Updated 2026-10-08. Companion: [Server acceptance](../../../pullwise-server/docs/validation/local-acceptance.md).

## Shared console containers and named project selection (2026-10-08)

All authenticated modules inherit full available width, gutters and bottom
clearance from the shared `.main` rule in `base.css`. The fixed 1200px default
and per-page `wide` opt-in are removed. Settings, Members, Projects, project
detail, Shared Pool, Categories, API Keys and Billing therefore use the same
outer container in normal, loading and error states. Existing shared split
and settings navigation grids allocate their inner columns; individual
controls and prose retain their purposeful readability limits.

API key restrictions select projects by name from the current ledger's
existing authorized project list. A native disclosure, shared search input and
selection rows provide local name/description search, multiple selection and
explicit pagination. Selected real IDs still form the backend allowlist;
manual ID entry is removed. An explicit empty selection allows no projects,
and shared-pool access remains independent. Unknown or failed project reads
block restricted creation until recovery. Scope changes clear choices and
abort reads; stale responses cannot restore protected data.

`npm run check` passes lint, **36 test files / 490 tests** and the build.
Worker configuration/syntax checks and the preview Wrangler packaging dry run
pass. [Built-browser acceptance](console-container-project-picker-local-2026-10-08.json)
passes 24 console contexts with 82 measured states, including loading, normal
and recoverable 503 states at 1600/2560px, loaded 320/390px touch layouts, and
explicit creation/entry/report/settings views. All headings and sections track
their allocated columns; 24 additional API Keys/Billing panel measurements
confirm the nested settings-grid allocation. Purposeful visual samples pass.

The same accepted build passes three project-picker profiles with 41 states
and eight reviewed captures. Nine entirely intercepted local fixture POSTs
confirm selected IDs, independent shared-pool access and the explicit empty
allowlist. Search/clear, selection retention, pagination, error/retry, archived
mobile badges, bounded list scrolling and coarse touch targets pass. The full
artifact manifest stays identical through both suites. These are local
synthetic checks; publication verification remains static-only and preview-only.

## Projects and Members layout refinement (2026-10-08)

Projects search now highlights the entire square control, including its search
icon and clear action. Clearing the filter restores input focus. The topbar
Ledger label and selector share one row; long ledger names remain inside the
native selector. Language, theme and back-to-top controls return to the bottom
right on every page. Console content and notification offsets reserve their
clearance, including mobile safe areas, and the language menu opens above its
button within the viewport.

Member rows separate name, GitHub account and role from management controls.
Desktop rows align the controls on the right; narrow containers stack identity,
role selection and wrapping actions. Visible action labels are concise, while
accessible labels retain the member identity in all supported languages.
Pending invitation actions use the same concise labels; the full recipient
stays in the translated accessible name, so long GitHub usernames cannot
stretch the 320px layout. Native touch inputs/selects retain the actual 44px
minimum despite the lazy ledger stylesheet's shared control rules.
Owner/Admin authority, optimistic-concurrency revisions and request lifecycles
remain unchanged.

`npm run check` passes lint, **36 test files / 476 tests** and the build.
`npm run check:workers`, Worker syntax checks and the Wrangler 4.136.3 preview
packaging dry run pass. Preview artifacts use the preview app URL and GitHub
App slug. Local browser evidence and the finite remote publication check are
recorded in the dated companion records for this release; local fixtures do
not establish authenticated remote acceptance. The release covers only the
Web Worker/assets at `preview.pull-wise.com`, with the existing preview Server
binding. Production and Server/D1 deployment are outside this task.

[Local browser acceptance](console-layout-local-2026-10-08.json) passes the
12-profile matrix (1440/390/320px, en/zh, light/dark) with 84 capture states,
plus eight settled-scroll long-identity supplements. Coarse-pointer media,
touch restoration, actual 44px control targets, search/clear without API
refresh, theme/back-to-top actions and member role/confirmation/cancel flows
pass. No document overflow or script error remains. Artifacts remain identical
throughout both accepted phases; all API traffic uses local synthetic fixtures.
Sticky-header pixels after smooth scrolling use the explicitly settled
diagnostic captures because native Chromium can intermittently omit that
header paint in single-shot captures with otherwise correct measured bounds.

[Preview publication](console-layout-preview-release-2026-10-08.json) deploys
runtime commit `2adaddd62bd71da0149b0426aa175f665ce31d9e` as Web version
`9a811fde-68b9-4914-880a-5308f2dc0612` at `preview.pull-wise.com`. Remote
configuration readback confirms the preview Server binding and asset routing.
One homepage GET plus three exact hashed asset GETs return 200; the homepage
has preview noindex and references the accepted build entry, and all three
asset bodies match the local hashes. No business API, Server/D1 operation,
real session or production deployment is part of this publication check.

## Final real REST and temporary-key acceptance (2026-10-07)

[DFerryman's consented real preview run](rest-final-real-preview-2026-10-07.json)
passes **28 business HTTP requests**, spaced at least five seconds, with six
mutation attempts: one temporary key issuance, four exact `INSUFFICIENT_SCOPE`
rejections and one issuer revocation. The key expires after 900 seconds and
contains only the five default read scopes, one existing project allowlist,
its owner's workspace and `shared: false`. No project, category or expense was
created or changed; no real payment or model request was made.

Profile, project list/detail, categories, one-day expense list, all three
reports and CSV return their expected success. Shared-pool reads/export,
workspace override, the known QA ID and a second existing personal project
outside the allowlist are forbidden. Key management requires the issuer's session; missing authentication
is rejected. Project/category/expense writes and standalone suggestions reject
the absent write/use scope before resource/model work. The known QA project ID
proves an allowlist rejection, not the continued existence of a foreign project.

Issuer revocation succeeds; the token disappears from the active metadata
list and immediately returns **401 UNAUTHENTICATED** on the next request.
The sole consented session/token existed only in process memory; the receiver
has exited and cleared them. Sanitized evidence retains no credential or raw
financial body. This one-key real run covers five present read scopes and four
absent write/use scopes; all nine-scope/four-role issuance/principal matrices
and additional write-success paths are separately local SQL/native evidence.

[Temporary helper cleanup](rest-final-helper-cleanup-2026-10-07.json) is verified:
the exact consent route, Worker and its own Durable Object namespace are absent;
the original product budget namespace remains present. The receiver has exited
and six local helper control files have been removed. One anonymous, DO-only
post-acceptance budget read confirms schema v6 and no permanent row cutoff.
The interval added 906 observed D1 rows read and 25 rows written (reserved
906/35); these counter deltas may include concurrent activity and are not a
per-request attribution. No budget reset or repeated test loop was used.

## Blank projects: local acceptance (2026-10-07)

Projects now default to a required project name and optional description. GitHub
repository/Organization association is an optional disclosure; its candidate
request starts only after explicit association intent. Name-only creation,
standalone detail/settings, rename and expense entry do not require GitHub App
access. A repository-loading failure can be closed to continue creating a blank
project. Later association and explicit removal of all repositories preserve
project IDs and financial history. The latter clears Organization association.
Role permissions still intersect project expense eligibility.

API Docs and their copied Markdown document name-only POST, nullable GitHub
fields, `not_linked`, explicit `githubRepoIds: []` detachment and `If-Match`.
New UI and contract messages have Chinese, Japanese, Korean, French and Spanish
translations. No additional backward-compatibility workflow was introduced.

Final checks pass **476 tests in 36 files**, ESLint, production build and offline
Worker configuration checks. Focused Ledger/Projects/App checks pass 119 tests.
The first full run exposed an API Docs test selecting both valid POST examples;
the expense example now has an endpoint-specific selector and the full suite
passes. No product behavior was changed for that test correction.

[Seven built Chromium cases](blank-projects-web-local-2026-10-07.json) pass at
1440, 390 and 320 pixels: blank creation, optional-repository failure recovery,
explicit-category expense entry/idempotency, rename, later attachment, last
repository detachment, and Viewer controls. Accepted contexts attempted 269
requests/108 mocked API calls/6 synthetic writes; all nine preserved contexts
including one selector failure and one nondefault fixture run attempted
345/132/7. Each context stayed below 120 total, 20 API and one synthetic-write
attempt. No request was forwarded; real credentials, D1, providers and payments
were not used. Screenshots and geometry checks confirm no horizontal overflow
or control overlap, and the date input matches neighboring widths.

[Explicit preview publication](blank-projects-preview-release-2026-10-07.json)
serves Web source `19d134f0dc2532052f69051acb61be501392fdf6`, version
`0a588b77-3625-4943-aee5-4c57e2c2bbc6`, at 100% traffic. Four anonymous,
no-JavaScript GETs verify the current HTML/noindex, Ledger CSS, entry JS and
actual Projects UI module by exact bytes/hash. They invoke no REST/D1. Runtime
asset metadata confirms the SPA fallback, shell security headers, immutable
assets and Worker-first routing. The Server companion source is deployed at
100%, schema v6/health verified with its original DB/journal/Secrets preserved.
The consented DFerryman final REST/key-revocation result is separate.

## Named member invitation UX (2026-10-07)

The invitation review retains named GitHub recipients: the username is resolved
once to a stable GitHub numeric ID, while the single-use link delivers explicit
acceptance. All existing and future ledger data is shared according to role.
A generic application link with Owner approval would need a separate pending
request lifecycle; this change improves the existing directed flow instead.
Server identity, 24-hour expiry, atomic consumption and role checks remain in
the [current contract](../../../pullwise-server/openapi/ledger-v1.yaml).

Web accepts usernames, `@username`, HTTPS GitHub profile URLs and direct
`github.com/username` input, normalizing locally to the existing 39-character
login contract. Exact-host/profile-path checks reject malformed or unrelated
links without an API request. Account-format help is associated with the input,
and newly created links identify their canonical recipient and explain who can
accept them. The existing one-time display/copy flow and Viewer default remain.
Seven new messages have translations for Chinese, Japanese, Korean, French and
Spanish.

Known invitation business failures now have specific recovery messages:
`INVITATION_EXISTS` / `ALREADY_MEMBER` do not trigger a stale-version lock, and
`INVITATION_LIMIT` / `OWNER_IMMUTABLE` do not invalidate an independently loaded
ledger. Users can explicitly revoke an unused pending invitation and then
create another link. Generic 403/404 and actual 409/412 conflict guards remain.
No automatic provider lookup, reissue, retry or polling was added.

Five selected pre-fix tests failed on unnormalized `@username` and four wrong
business-error messages. Those message failures occurred before their later
guard assertions; they do not establish an executed pre-fix guard test.
The corrected Members/App subset passed 72 tests. Final full lint/build and
Worker configuration checks pass 36 files / 465 tests, including the corrected
known-error and generic-status guard assertions.

[Focused built Chromium acceptance](member-invitation-ux-local-2026-10-07.json)
passes all 11 final cases: username/profile normalization, invalid input with
no POST, four recoverable business failures, generic access loss, wrong-recipient
isolation and a 320px long-helper layout. Two mobile visual supplements cover
the canonical recipient/link/copied status and the duplicate-invitation error.
Representative 390px and 320px screenshots were visually reviewed without
overlap or document overflow. All traffic and clipboard activity are synthetic
and intercepted locally; there are no real sessions, provider calls or D1
operations. The first rejected capture run and a supplement copy-expectation
failure are retained separately from the corrected passing evidence.

Source `b39039ef4d0e77fd1435f5977f0f55c0d06a9587` is on main and published
to preview as `54cd490e-3a59-4eea-be4e-12641def0ae4` at 100% traffic.
Management read-back retained preview bindings, SPA handling, Worker-first HTML
and security headers. Exactly four static GETs passed: HTML with noindex,
Ledger CSS, the entry runtime and the actual Members runtime, with resource
sizes/SHA-256 matching the final local build. JavaScript, sessions, business
API and D1 operations were excluded. See the
[publication record](member-invitation-ux-preview-release-2026-10-07.json).
Server and production configuration were not changed.

## Expense date input width (2026-10-07)

Date controls have explicit maximum physical/logical widths and no intrinsic
minimum inline size; wrapping input labels inside the field grid use a
`minmax(0, 1fr)` column. Native date type, picker and ISO values are preserved.
The adjustment stays within the owning Ledger CSS and does not alter checkbox
row layouts. Full lint/build, 434 tests and Worker configuration checks pass.

[Focused built Chromium acceptance](expense-date-width-local-2026-10-07.json)
passes eight project/shared expense forms at 1440, 900, 390 and 320px. Date,
amount, currency and category border-box widths match exactly at 307, 227, 358
and 288px respectively, across blank, fill, clear and refill states. Editing
the date triggers no additional API request. All fixtures are intercepted
locally; this is not a real Safari or authenticated preview acceptance claim.

Source `2db8d2391bc72221f44d253af3033f1f6a333859` is on main and published
to preview as `22216794-c8a3-4fd0-bc5e-55c9726b9f5f` at 100% traffic.
Bindings and asset routing match the preview configuration. Exactly four
static GETs passed, including matching final asset sizes/hashes; no JavaScript,
business API or D1 was invoked. See the
[publication record](expense-date-width-preview-release-2026-10-07.json).

## Projects console spacing (2026-10-07)

The Projects search icon/input share one control border, with 16px before a
separate project-list divider. Creation panels use the shared 16px body stack;
organization controls and forms align within the same 800px maximum width.
Submit and secondary controls use wrapping action groups. Form help no longer
adds a second bottom margin, repository legends have inset labels, and touch
checkboxes keep their native size inside at least 44px clickable rows.
Medium desktop widths retain more space for project records by scaling the
secondary column from 260 to 340px. Desktop split columns have a 48px gutter
and a 32px inset after the rail divider. Ledger sections use 32px vertical
padding, reduced to 24px on small screens; the existing breakpoints remain.

Fields now fit columns to their actual available width. Narrow project records,
API-key rows, subscription records and charts rearrange their contents instead
of squeezing adjacent columns. Settings navigation wraps, invitation fields
keep their label/control groups and shared body spacing, and long content can
wrap without hiding financial amounts or dates. The sticky console header is
opaque so scrolling content cannot show through it.
Mobile subscription summaries use their content height instead of carrying the
desktop 260px flex basis into the vertical layout. Chart amount wrapping targets
the actual amount element; key rows have one container-based layout owner.

Full checks passed 36 files / 434 tests, lint/build and Worker configuration.
The final build incorporates the search-spacing and automatic-layout follow-ups. The
[local browser record](projects-spacing-local-2026-10-07.json) distinguishes
baseline, intermediate geometry and final reliable screenshot checks. Actual
built Chromium uses intercepted synthetic data only, with no real sessions,
remote API/provider calls or D1 writes. The intermediate CDP full-page paint
anomaly is preserved and is not a final visual pass. Final representative
desktop/mobile views use stable viewport, shell and layout assertions.

The final artifact passed 41 built-browser states: 18 Projects/search/overview,
four key ledger forms, six related ledger modules, eight account modules,
three 320px layouts and two long-amount report layouts. Chinese and English
checks cover 1440, 1280, 900, 390 and 320px as appropriate; every state checks
document/control bounds, stable capture layout and zero page errors/unexpected
requests. Representative screenshots were visually reviewed. Mobile Billing's
summary height decreased from 260px to 42.5px. These are local layout checks,
not new authenticated preview or payment acceptance.

Web main `8ba2327844a4f7faa6404c6782325b0a74e45a6b` was published to
preview as `4a78411e-5ea3-431d-947f-f85abe35e0fb` at 100% traffic.
Management read-back retained preview bindings, SPA handling, Worker-first HTML
and security headers. Exactly four static GETs passed: HTML with noindex and
three resources matching local byte counts/SHA-256. JavaScript, sessions, API
requests and D1 operations were excluded. See the
[publication record](projects-spacing-preview-release-2026-10-07.json).
Server and production configuration were not changed by this layout release.

## Earlier real-account acceptance (2026-10-06)

The [first two-real-user run](../../../pullwise-server/docs/validation/projects-two-real-users-baseline-2026-10-06.json)
passed Projects, reports/CSV, invitation acceptance and Viewer checks, then
stopped before Editor update on a stale Owner Members view in the runner.
Its failed result and completed QA cleanup are preserved. Server account
storage is now published as preview `ab500595-328d-4fc2-b897-7c6137659c92`;
893 Server tests, native capacity/migration and actual one-shot cutover pass.
The Web runtime remains unchanged. The [subsequent focused real-account run](../../../pullwise-server/docs/validation/projects-two-real-users-focused-2026-10-06.json)
passed all six checks: actual invitation/Editor expense UI workflows, followed
by Admin project reads, stale key invalidation and removed-member isolation
through actual REST requests. It used 89 business HTTP requests, 150 total
network requests and 12 paced mutation attempts/confirmed writes, no retries,
real payment, model calls or credential persistence. New QA fixtures were
cleaned up, and the [temporary session helper was removed](../../../pullwise-server/docs/validation/real-account-helper-cleanup-2026-10-06.json).
See [publication proof](../../../pullwise-server/docs/validation/state-records-preview-release-2026-10-06.json).

## Projects and cost follow-up (2026-10-06)

Web `4e72574c19daec85ba713dd2d14a40034f7c03e7` is on main and
preview version `ea62c7a0-37e4-4693-b78a-bbb3c96c53b6` serves 100% traffic.
Final full checks pass 434 tests, lint/build and Worker configuration checks.
Project archive/reactivation, revision-safe settings drafts, completed-invite
recovery and stricter billing redirects have local/native evidence in
[Projects and Members](projects-members-local-2026-10-06.md).
Status no longer polls health in the background; its initial/manual requests
have in-flight and unmount protection. Service binding preserves only the
Cloudflare Edge's original client IP for per-visitor abuse controls; external
proxy requests keep stripping forwarding headers and never retry a failed binding.

The [actual public release check](../../../pullwise-server/docs/validation/preview-public-release-2026-10-06.json)
matched 12 deployed resource hashes, verified healthy initial/manual status
checks and 390px mobile layout without page errors. Its global write-delta
assertion was not passed because concurrent OAuth activity overlapped it;
the source audit found no writes in the public read paths. This does not
establish the separate two-real-account collaboration acceptance.
See the [Cloudflare cost plan](../../../pullwise-server/docs/validation/cloudflare-cost-plan-2026-10-06.md)
for the USD 200/month target, cost assumptions and measured DO accounting.

## Shared-ledger release (2026-10-06, final)

The new version was pushed as `775fabdc441abb8c79868497017fb8497872e0c3`
to Web main and explicitly deployed to preview as
`926cf9ce-9beb-4cec-80eb-02d233e16a6e` at 100%. Management read-back confirmed
ASSETS and the `pullwise-server-preview` service binding. Full checks passed
**418 tests**, ESLint/build/config checks; after the browser-found layout fixes,
**159** relevant UI tests and the final build passed. The versioned Server
schema upgraded to v5 under the original journal; production D1 remains paused.

Built Chromium initially passed 12 functional flows but uncovered two 414px
phone layout failures. The repaired final artifact passed six native 390px
phone flows and one desktop smoke case, with measured sticky Header/Sidebar,
actual picker/selector hit tests and no overflow/page errors. The fixtures were
fully intercepted local accounts, **93** simulated API requests and zero remote
forwards. [Detailed browser record](workspace-ui-local.md) preserves failures,
repairs and the 27px API Keys picker boundary; [final structured evidence](workspaces-ui-final-2026-10-06.json)
contains the actual viewport measurements and asset hashes.

Actual deployed preview loaded `index-D2iP-fc1.js`. An anonymous desktop home
check verified the new source/layout/heading before stopping only on a known
blocked Cloudflare analytics asset; that result was retained without replay.
The remaining actual 390px Members→Login case passed with the same external
asset intentionally blocked, HTTP 200 and no page errors. No OAuth button or
provider call was made. These guest checks do not replace new-role tests with
local accounts or claim a new two-real-user preview invitation test. The earlier
consented authenticated preview lifecycle belongs to the original release.

Server source `a799232f` passed GitHub CI and serves preview version
`6a69026a-993e-4afd-849b-671804288211` at 100%. The final numeric journal is
schemaVersion 5, ready and unstopped, reserved 33,358/719 and observed
21,716/359 under the unchanged 100,000/1,000 ceilings. Production D1/Jev remain
0; main Builds may publish paused code. Complete publication evidence is in the
[Server release record](../../../pullwise-server/docs/validation/workspaces-preview-release-2026-10-06.json).

## Frontend continuation audit (2026-10-06)

The current objective resumes audit, repair and verification. The earlier
pause statements below describe historical runs rather than the current task.

Reloading or changing ledger scope while a page was pending could leave all
pagination controls disabled permanently. A failing regression reproduced it;
the read lifecycle now clears canceled pagination state and guards overlapping
page reads synchronously. Completed manual repository recovery releases its
controller so repository pagination stays usable. Obsolete responses remain
ignored.

Finishing GitHub authorization after leaving Settings previously started new
profile and integration reads. Settings now skips that follow-up after unmount,
aborts in-flight account reads and ignores obsolete action completion. New
regressions reproduced the extra reads and missing cancellation before repair.

The fetch transport tests use the Node environment to keep Response and Blob
from the same runtime; Node 24 combined with jsdom's Blob had failed the binary
download assertion. DOM tests retain jsdom.

`npm run check` passed ESLint, **35 test files / 339 tests**, and the production
build. `npm run check:workers` and `git diff --check` passed. These checks used
local mocked responses; this entry makes no remote OAuth, payment, Jev or D1
acceptance claim. Remote publication and preview user validation are recorded
separately when completed.

Actual headless Chromium also passed **8 built-artifact cases**, covering
pagination cancellation/late-response recovery, manual repository recovery,
Settings popup completion after navigating away, and account-read cancellation
at 1440px desktop and 390px touch. The static preview used a free strict
loopback port and an explicit empty Vite proxy; all API responses were local
fixtures. Across the eight cases, 68 fixture API requests included two simulated
repository-sync POSTs. Six canceled reads reported `net::ERR_ABORTED`; no late
record or extra Settings integration read appeared. Every case checked zero
document overflow and page errors. Phone cases confirmed coarse-pointer media
and `navigator.maxTouchPoints` before and after screenshots. Four screenshots
were visually reviewed with no clipped controls or records.

The intercepted GitHub popup used offline HTML and a renderer-initiated local
callback; it does not establish real GitHub authorization. External font CSS
was intercepted with an empty local response, using the declared font fallbacks.
No provider, remote business API or D1 request ran. The harness capped each
case at 100 requests; the maximum observed was 39 local/intercepted requests.
Generated scripts, screenshots and run output remain outside the repository.

## Preview public-browser acceptance (2026-10-06)

The current remote scope is **preview only**. Web source `0ff502c` was published
as preview version `ef9edfbe-f881-4f7a-982a-8fc1d75ace71`. The earlier authorized
static publication check made eight GETs across the two Web domains: all were
200, and the three asset SHA-256 values matched the local build on each domain.
That earlier production check is historical evidence, not an extension of the
current preview scope.

Actual Chromium loaded the published preview with real Server responses and
completed **eight public-page functional cases**: Home, Pricing, Docs and Login
at 1440px desktop and 390px touch. Navigation, monthly/yearly pricing controls,
the Docs Max-assistance anchor and the normal login entry worked. Each completed
case had zero document overflow and page errors. Mobile cases confirmed coarse
pointer media and one touch point before and after captures. Pricing returned
the real Free, Pullwise Pro and Pullwise Max plans; Max displayed activation
pending and no rollover. Every received product document/API response was 200;
no received provider response was 4xx/5xx.

Screenshot review found a **real mobile Home visual failure** despite its
functional and overflow checks passing: the preview card retained its desktop
sidebar, squeezing the expense purpose into individual-character lines. Pricing,
Docs and Login screenshots were usable. The Home repair and its separate local
evidence are recorded below; the original remote capture does not prove the
repair was published or remotely accepted.

Exactly **one** real Continue with GitHub action ran. The authorize API returned
200, followed by actual GitHub document responses at `/login/oauth/authorize`
(302) and `/login` (200). The harness then tried to read the authorize response
body after navigation had discarded it, and stopped on a browser response-body
capture race. It therefore did **not** complete the planned credential-form or
response callback-parameter assertions. No credentials, consent, payment or
account-change action was submitted, and OAuth was not repeated.

The isolated browser's 13 decoded session responses all reported signed out.
The user's successful login in their own ordinary browser is user-reported
evidence; this tool browser did not receive that session. Authenticated ledger,
payment and model/provider acceptance remain unverified by this run.

The request journal was cumulative across harness continuations, without resets,
business retries or polling. The initial browser ceilings of 90 routed forwards /
12 Server API requests were explicitly raised to 99/15, then 130/20. The fixed
Server preview journal ceilings remained 100,000 rows read / 1,000 rows written.
Final harness counters were **128 routed forwards / 19 Server API requests /
one OAuth initiation**. GitHub's observed redirect continuation is additional to
the route-admission counter: two provider document responses were received,
within the four-document boundary. The recorded route counter is not an exact
count of every redirect-follow-up HTTP request. The batch is closed.

Earlier incomplete stages are retained as harness evidence, not product defects:

| Aggregate routed forwards / API | Stage and outcome                                                                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21 / 3                          | Bootstrap expected literal `Max`; the real plan was `Pullwise Max`. Corrected the selector.                                                                                              |
| 59 / 8                          | Four desktop pages passed. Mobile hid the secondary Sign in link; its primary Get started entry remained available.                                                                      |
| 60 / 8                          | Chromium reported `ERR_CERT_VERIFIER_CHANGED` before an HTTP response. Diagnosed proxy/NSS trust and added an internal startup document.                                                 |
| 76 / 10                         | A default five-second expectation expired during signed-out startup. Set explicit 30-second readiness and lazy-heading waits.                                                            |
| 89 / 12                         | Capture cleared touch emulation. Stopped the mobile assertion and verified capture/touch restoration with network-free local HTML.                                                       |
| 107 / 15                        | Mobile Home passed. Mouse-to-touch conversion prevented the next interaction from settling; replaced it with locally verified trusted native touch events.                               |
| 128 / 19                        | Remaining mobile Pricing, Docs and Login passed; the single OAuth navigation reached GitHub. The post-navigation response-body capture race prevented the remaining provider assertions. |

All remote traffic used the configured environment proxy. Chromium used an
exception pinned to the configured proxy CA's exact SPKI; global certificate
error bypass and `ignore_https_errors` remained disabled. Cloudflare analytics
and GitHub subresources were deliberately aborted; the final mobile continuation
also aborted optional Google fonts to conserve its remaining allowance, so its
captures use the declared font fallbacks. These intentional aborts are distinct
from provider failures. No remote business data was mocked. Logs omit URL queries,
OAuth state, cookies and credentials; generated evidence remains under `/tmp`.
Browsers and the local static preview server were stopped after validation.

### Mobile Home visual repair and local verification

The earlier mobile rules in `styles/screens.css` were overwritten by desktop
defaults in the later-loaded `src/app.css`. The existing one-column preview
body/expense and hidden-sidebar rules now live in the owning landing section's
760px media block. Removed stale stat-row rules already had no effect; the
effective two-column mobile stats, four-column desktop stats and 760/761 boundary
remain unchanged.

Network-free actual Chromium reproduced the defect with the original CSS at
390px and 320px: purpose width 0px, height 846px and card height 1146px. The
repaired CSS gives purpose widths 288px/218px and two 18px lines. A fresh built
artifact then passed five local Home captures at 390/320/760px touch and
761/1440px desktop: zero overflow/page errors, correct sidebar visibility and
touch/coarse state before and after screenshots. The native phone cards were
386px high with legible two-line purposes; desktop remained 404px high. The
390px, 320px and 1440px captures were visually reviewed. This used 70 bounded
local/intercepted requests, including ten synthetic signed-out session GETs;
no remote or provider request ran.

After this CSS repair, `npm run check` again passed ESLint, **35 files / 339
tests** and the production build; `npm run check:workers` passed. The checked
build contains `index-DYpTVxXP.js`, `index-CX8wIgR0.css` and the unchanged
`ledger-DH0H9eII.js`. Publication of this repair is recorded separately after
completion; these local captures do not establish remote acceptance.

### Mobile Home repair publication and preview follow-up

Source `ceb4424977193f6783a70e3e3cc5251100957e55` was pushed to `main` and
published **only to preview**, version
`d3b560ec-ba80-4bea-a428-3ad137cad571`. Production was not changed for this
repair.

One new-release Chromium Home capture ran at 390px touch, with separate ceilings
of 40 forwarded HTTP requests including redirects and two session GETs. The old
128/19 batch stayed closed. This new batch made exactly **13 forwarded requests,
including two real initial session GETs and zero redirects**; all 13 responses
were 200. Optional font CSS and Cloudflare analytics were aborted. No other
business API, provider, OAuth, credential or payment action ran. Both session
responses reported signed out.

The real page loaded `index-CX8wIgR0.css`, hid the demo sidebar, rendered its
purpose at 288px wide and 36px high (two lines), and kept the card at 386px high.
Document width remained 390px with zero page errors. The screenshot was visually
reviewed and confirms the formerly vertical purpose is readable. Coarse pointer
and one touch point were true before capture and after the verified CDP touch
restoration. Chromium cleared them to false/zero during capture; an extra strict
raw-capture assertion therefore made the script exit unsuccessfully. That
retained harness limitation does not negate the recorded online CSS geometry or
successful touch restoration, and it does not prove touch media stayed enabled
during the capture itself. No request or OAuth action was repeated to correct the
assertion. The browser was closed; this evidence does not add authenticated
acceptance.

## Product audit and automatic Max assistance (2026-10-02)

Normal expense saves now use the shared Server automatic-assistance contract.
The separate model trigger is removed. Eligible/available Max creates can
omit category; uncertain classification keeps the draft, shows one inline
notice and focuses the enabled native category control. Changed retries receive
a fresh idempotency key. Post-save category, duplicate and target advice is
nonblocking. Explicit category/target/money stay unchanged.

Report outages preserve expense history/editing, pending filter refreshes label
retained data and drafts stay intact. Amount totals use exact BigInt arithmetic,
and report bars have a separate scale for each currency. Pricing no longer
invents paid prices or annual products/savings; subscription upgrades wait for
verified payment confirmation and unknown outcomes cannot trigger another charge.
Public Docs/API/Privacy/Terms and five translated catalogs reflect the contract,
actual model payload and shell-expanded Bearer examples behind the Web proxy.

Behavior regressions failed before their fixes. Actual Chrome also reproduced
disabled-control focus and uneven field heights before their repairs. Final
`npm run check` passed ESLint, **35 files / 334 tests**, and production build;
`npm run check:workers` and `git diff --check` passed. The final built-artifact
browser run passed **20 cases**: four en/zh expense flows at 1440/390px and 16
Docs/API/Privacy/Terms renders. It checked normal saves, category omission,
native focus/draft recovery, fresh retries, advice, filter pending state,
report outage recovery, exact huge totals, per-currency bars and model input
copy. Twelve writes used synthetic loopback fixtures; no external provider,
remote D1 or business request ran. Zero overflow/page errors remained, and
phone touch/coarse state was verified after each capture. Eight final form
captures passed visual review. This is local evidence; publication and CI
verification are recorded separately after release.

### Product audit publication (2026-10-02)

Source `1bc0b57ed992602a8c3666670a0b47b7d0e52229` was published to both Web
environments using the reviewed build. The local checks and 20 synthetic
browser cases above apply to this source.

| Environment                       | Worker                 | Published version                      |
| --------------------------------- | ---------------------- | -------------------------------------- |
| Preview — `preview.pull-wise.com` | `pullwise-web-preview` | `d893c3ec-cb0d-433c-bacb-e9e5e20fd036` |
| Production — `pull-wise.com`      | `pullwise-web`         | `ed8d1647-b4cc-462a-84c5-3b329b569d60` |

Exactly **8 bounded static GETs** checked one homepage and three assets on each
domain: `index-BzdxAS89.js`, `index-ARKSj5jK.css` and `ledger-CkYP8DBE.js`.
Every request returned 200; both homepages referenced the current entry/style
assets, and all six asset SHA-256 values matched the local manifest. Preview
retained `X-Robots-Tag: noindex, nofollow`. There were no redirects, retries,
page script execution, business API requests, provider calls or D1 operations.
These checks prove static publication; they do not establish authenticated
product or provider acceptance.

The exact-SHA GitHub Actions API query was made twice and returned **0 runs**
both times. Remote Web CI remains **unverified**. This documentation update
records the release without rebuilding or redeploying application assets; the
earlier publication record below is retained as history.

## Global frontend publication (2026-10-02)

The user explicitly requested committing, pushing and deploying all reviewed
frontend changes to both production and preview. Source
`9d03385d332c6c2e566a91bab98a0594423c2fe5` was committed and pushed to GitHub
`main`. The exact source passed `npm run check`: ESLint, **35 files / 314 tests**
and production build; `npm run check:workers`, both Worker syntax checks and
`git diff --check` passed. Wrangler 4.146.0 dry runs confirmed the matching
production/preview Server service bindings before publishing the same build.

| Environment                                       | Worker                 | Published version                      |
| ------------------------------------------------- | ---------------------- | -------------------------------------- |
| Preview — `preview.pull-wise.com`                 | `pullwise-web-preview` | `a1472817-48b4-41c5-acff-f8969dd7d2d7` |
| Production — `pull-wise.com`, `www.pull-wise.com` | `pullwise-web`         | `02cd03a3-f11b-42bf-9319-6e81cef92563` |

Preview and the primary production domain each passed exactly one homepage GET
and three exact hashed asset GETs: entry JS, app CSS and API Keys JS. All **8
requests** returned 200. Both homepages referenced the current entry/style
hashes, and each asset's SHA-256 matched the local build. Preview retained
`X-Robots-Tag: noindex, nofollow`. No redirects, retries, page script execution,
business API calls, provider calls or D1 operations ran. Wrangler published the
`www` custom domain, which was not separately probed. This proves static Web
publication; the local UI review below remains synthetic product evidence.

GitHub returned no combined statuses or exact-SHA push workflow runs for
`9d03385`; remote CI remains unverified. This documentation follow-up records
the deployment without changing or redeploying application assets. The local
screenshot gallery now labels the reviewed style as published.

## Global frontend detail review (2026-10-02, local review)

The review covers public pages and the authenticated workspace. Shared panel
headings, action gaps and error notices now follow the existing hard-edged
design. Documentation uses the shared section typography, readable prose width
and wrapped mobile navigation. Public navigation/footer links wrap without
hiding destinations. Mobile inputs use 16px text and common actions retain
44px touch targets; tabs preserve intrinsic word width with padded hit areas.
Observed workspace typography remains 22px page titles, 18px section headings
and 15px record titles. Documentation section headings use 22px with 36px
before and 14px after. Dark accent/foreground now measure 6.71:1; the weakest
light neutral on the soft background measures 4.68:1.

API key creation proceeds through name, scopes, ledger targets and submit;
target inputs, helper insets, loading sections and key-list headings share the
same layout language. Settings keeps profile data when GitHub access cannot be
loaded, states its unavailability and offers manual reload rather than claiming
the account is disconnected. Lazy route headings receive focus on navigation,
while identity-only remounts preserve an active language control. Shared modal
cleanup releases the inert background before restoring the opener.

Seven behavior regressions failed before their fixes and now pass: three route
focus cases, API key keyboard submission after the final access choice, two
Settings loading/error cases and inert-aware modal focus restoration. Real
Chrome also reproduced the modal failure before the change. Presentation
checks use browser geometry, contrast and hit testing. `npm run check` passed
ESLint, **35 files / 314 tests**, and build; `npm run check:workers` and
`git diff --check` passed.

Final browser evidence includes **102 renders** of 17 routes at 1440/390/320px
in light/dark; **32 English/French renders** of Docs, API Keys, Settings and
project detail at 390/320px; **77 light and 33 dark workspace page checks**
including populated/empty records, entry, filters, optional fields, reports and
category actions; **18 focused spacing/font/contrast cases**; and **54 operation,
loading, error and modal captures**. All six locales pass 320/390px navigation
readability, and the language menu remains usable in a 760x320 viewport. Seven
workspace routes at four widths pass header hit testing through repeated
scroll/menu/theme changes. No unresolved overflow, clipped controls or page
errors remain in these fixtures. Touch media and events are checked after each
capture; the screenshot harness preserves coarse layout and restores Chrome's
touch emulation before further interactions.

The [global screenshot gallery](../../../artifacts/ui-review/global-review.html)
offers **38 views / 228 current images**, light/dark and three widths, with
**8 desktop comparisons**. Every image, comparison and the gallery's 390/320px
layout passed local browser verification. Generated artifacts and their JSON
evidence stay outside the tracked Web repository.

At the review cutoff, the local base was
`e048dbd7e6745e44c56724f5a6dfa16d05acb9e6`.
GitHub returned no combined statuses or PR workflow runs for that SHA; the
workflow connector only reports PR-triggered runs. The style candidate was
then uncommitted and unpublished; the publication above supersedes that state.
All review APIs
use synthetic loopback data with external requests blocked; no real provider,
business API or Cloudflare D1 request was executed by this review. The separate
identity-recovery publication recorded below is preserved.

## Repository identity recovery (2026-10-02)

The user's existing Network record confirms the preview repository GET failed
with 503. The Server's generic `IDENTITY_UNAVAILABLE` masks its cause; token
expiration remains unproven. Web now isolates repository failures from loaded
project history/totals, removes creation candidates and explains the failure.
Pullwise identity/scope 401/403 remains fatal. Provider outages are never shown
as successful empty lists or proven revocation. Known credential rejection
offers an explicit guarded Reconnect GitHub login, without sign-out, automatic
OAuth or reload after initiating navigation. Manual recovery makes one repository
request and ignores obsolete responses. Project history remains editable when
GitHub grant verification is unavailable; new expenses remain blocked.

Five initial recovery regressions failed before the change; the history notice
regression also failed before implementation. A clean `main` snapshot with only
this task's three ledger files passed `npm run check`: ESLint, **34 files / 307
tests**, and build; `npm run check:workers` passed. The shared working tree gained
concurrent App, API Keys, Settings and styling edits during verification, and its
new API Keys keyboard test failed while those edits were in progress. They were
preserved and excluded from this task's snapshot/commit. No remote page scripts,
business APIs, login, logout, provider calls or Cloudflare D1 operations were run.
Local tests are synthetic UI evidence, not real preview acceptance.

The companion Server fix, source mirror and contract are locally validated.
Source commit `28dfea078d528954be491c7fe79b44ae5f315cbf` was pushed to main.
GitHub's combined statuses and exact-SHA push workflow query returned no Web CI
runs; remote Web CI remains unverified. Server source `04c8797` passed push CI
[36961634876](https://github.com/GoPullwise/pullwise-server/actions/runs/36961634876).
The user separately authorized preview backend publication. Server source
`04c8797` is now deployed as `ca964508-e9b5-45d6-8c5c-a373d3be8bdd` at 100%.
Management read-back confirms the original preview DB/budget namespace, complete
bindings and environment variables; production Server D1 access remains 0.
No runtime identity/provider or D1 acceptance request was executed.

The existing frontend deployment authorization was used for this checked snapshot
only, excluding all concurrent worktree changes. Wrangler 4.146.0 published
preview version `3f44d1de-4458-4e93-97aa-0ad913af8cc7` and production version
`2301ffb8-63cd-4f58-b932-6a1474bb937e`. The initial preview upload failed before
asset transfer because of the local proxy; one direct attempt succeeded, and
production then used the same direct configuration. Each domain passed one
homepage and three exact hashed asset GETs (entry JS, app CSS, modified ledger
JS), exactly **8 GETs**, all 200 and matching the build's SHA-256. Preview retained
noindex. No redirects, retries or script execution occurred during static checks.
No Cloudflare D1 operation or business request was executed. Production Server
settings still read back D1 access 0. These results prove static Web publication,
not real preview identity/provider acceptance or a confirmed expired token.

## Cloudflare frontend publication (2026-10-02)

The user explicitly authorized publishing both Web environments while excluding
D1 Rows Written. The build from `e65e7443f5f2bc4889f91d03ff42e1620ee3875e`
was already present on GitHub `main` and passed the local checks below. Wrangler
4.146.0 dry runs confirmed the two service bindings before publication. Device
authorization used frontend deployment scopes without `d1:write`.

| Environment                                       | Worker                 | Published version                      |
| ------------------------------------------------- | ---------------------- | -------------------------------------- |
| Preview — `preview.pull-wise.com`                 | `pullwise-web-preview` | `b66bdf68-52f2-4fec-8aa1-482b28f62396` |
| Production — `pull-wise.com`, `www.pull-wise.com` | `pullwise-web`         | `b1803869-507a-47e0-9ebf-73e2c6de6012` |

Preview and the primary production domain each passed exactly one homepage GET
and three hashed asset GETs: entry JS, app CSS and ledger CSS. All **8 requests**
returned HTTP 200; HTML referenced the current entry/style hashes and every
asset's SHA-256 matched the local build. Preview HTML retained
`X-Robots-Tag: noindex, nofollow`. No redirects, retries, page script execution,
business API requests, database queries, migrations or D1 operations ran.
The `www` custom domain was published by Wrangler but was not separately probed.
This proves static publication, not authenticated product/provider acceptance.

GitHub returned no commit statuses or PR workflow runs for the deployed source;
remote CI remains unverified. This documentation follow-up records the release
without changing or redeploying the application build.

## Workspace detail review (2026-10-02, local review)

Project rows now respond to their list container width, placing currency totals
below names at 560px or less. This keeps names readable when the desktop Add
project rail opens at 900/1024px. Workspace language/theme/back-to-top controls
occupy reserved header space instead of covering fields and record actions;
their touch targets and language items are at least 44px, and the menu stays
within short viewports. Category rename focuses its input, restores the same
row's Rename action after cancel/save, and clears editor/focus state on scope
changes. Long localized mobile navigation labels wrap, moving the account
selector below when necessary; tabs keep every view visible and wrap at words.
The approved 16px Manage categories gap is retained.

Two enhanced category-focus tests failed before the fix and pass afterward.
Pre-fix browser checks exposed project name columns of 0–74px, preferences
covering form/row controls, and missing rename focus. A separate French 320px
check failed for all three navigation labels and Project settings; the same
readability check passes after the label changes. Visual regressions use browser
geometry and hit testing rather than CSS-class assertions in unit tests.

`npm run check` passed lint, **34 files / 298 tests**, and build;
`npm run check:workers` passed offline. Browser review covered **88 populated/
empty page checks** across 1440/1024/900/899/761/760/390/320px in light and
**44 checks** at 1440/900/390/320px in dark, including expanded filters,
optional fields, category rename/archive, entry, reports and project settings.
Additional checks covered **22 long-content French pages**, **27 loading/error/
lost-access history pages**, all six languages at 320/390px, and short-landscape
language selection. Seven workspace routes at four widths kept header controls
clickable through repeated scroll/menu/theme changes. No unresolved clipping,
control obstruction, document overflow or page errors remained.

The local screenshot gallery at `artifacts/ui-review/index.html` now offers
20 views, desktop/mobile captures and dark originals. All gallery images,
available comparisons and narrow-screen layout were checked. Artifacts remain
outside the tracked Web repository. Browser APIs used synthetic loopback data;
external requests were blocked. GitHub returned no statuses or PR workflow runs
for the local base commit, so remote CI remains unverified. No deployment or
remote provider/database requests ran.

## Category guidance spacing (2026-10-01, local review)

Shared Pool and project detail now use the existing `.ledger-help` spacing
for no-active-category guidance. Manage categories has 16px of space before
the empty state or records, including when the inline button wraps on mobile.
The pre-change browser geometry check failed with a 0px gap. The same check
now passes for both routes at 1440/390/320px in light and dark: **12 checks**,
each measuring 16px, with no overflow or page errors. Screenshots in the
workspace review gallery have been updated.

`npm run check` passed lint, **34 files / 298 tests**, and build;
`npm run check:workers` passed offline. This presentation-only fix uses real
browser geometry evidence rather than a CSS-class assertion in a unit test.
GitHub returned no statuses or PR workflow runs for the local base commit;
remote CI remains unverified. No deployment or remote provider/D1 request ran.

## Spacing polish (2026-10-01, local review)

Panel headings and form fields now use consistent 16px gaps; desktop ledger
columns use 32px gutters and section starts use 24px. Projects no longer adds
an extra top gap when its creation rail is closed. Category metadata has the
same hierarchy as expense metadata, and the category field and submit button
share one aligned column. Mobile Categories keeps Reload beside the title;
stacked sections avoid accumulating grid gaps with panel padding. Mobile
sidebar links use their label widths so Shared Pool remains readable at 320px.

This pass changes CSS and presentation classes only. No feature or bug logic
was added, so no implementation-mirroring tests were introduced. Existing
`npm run check` passed lint, **34 files / 298 tests**, and the production build;
`npm run check:workers` and `git diff --check` passed. Final loopback Chrome
checks covered **22 populated/empty page checks in each of light and dark**
at 1440/390px, plus **32 checks at 320/360/760/900px**. Reports, entry, project
creation and settings captures also assert no overflow. No page errors occurred.
External requests were blocked and APIs used synthetic data.

The screenshot comparison page in the workspace's `artifacts/ui-review/index.html`
offers current/before views, desktop and mobile captures, and dark originals.
These are generated review artifacts outside the tracked Web repository.
GitHub returned no statuses or PR workflow
runs for the base commit; this unpushed candidate has no remote CI result.
No deployment or remote provider/database requests were performed.

## Workspace navigation and project views (2026-10-01, local review)

The authenticated shell groups Ledger separately from Account & tools. Mobile
keeps the three ledger destinations visible and uses a native selector for
account tools. Projects has searchable, full-row links with aligned currency
totals; its creation rail opens on explicit intent for existing projects. A
new account sees the repository chooser directly with three setup steps.
Account overview uses a disclosure so reports do not compete with project work.

Project detail has Expenses, Reports and Project settings tabs; Shared Pool
has Expenses and Reports. Tabs support arrows/Home/End and preserve mounted
drafts without refreshing data. Continue draft resumes both new entries and
historical edits. Totals stay per currency, filters collapse beside CSV export,
filtered empty lists explain recovery, and mobile entry appears before records.
The changes retain the shared flat panels, hard corners, typography, palette,
and locale catalogs. No Server, payment, money or authorization contract changed.

Design references were [Vercel's navigation redesign](https://vercel.com/changelog/dashboard-navigation-redesign-rollout),
[Linear's project overview](https://linear.app/docs/project-overview), and
[Carbon's tabs guidance](https://v10.carbondesignsystem.com/components/tabs/usage/).
Their navigation grouping, workflow priority and same-context views informed
the hierarchy; the implementation uses Pullwise's existing visual language.

Five new behavioral regressions failed before implementation and pass now:
grouped/compact navigation, keyboard tabs with draft retention, project search
with pagination recovery, project creation intent/focus, and filtered-empty
recovery. Two enhanced draft tests also failed before Continue draft was added,
then passed for both ordinary and lost-access historical edits. Visual-only
layout changes were checked through rendered captures.

Final `npm run check` passed lint, **34 files / 298 tests**, and build.
`npm run check:workers` passed offline. Loopback Chrome checks with external
requests blocked covered 1440/900/760/390px during development. The final built
artifact was captured in Chinese light/dark at 1440px and 390px, including all
six workspace destinations, project detail, populated/empty ledger pages,
reports, project settings and creation/entry rails. No page errors or document
overflow occurred. API data is synthetic and proves local UI behavior only.
The static preview used a temporary config without the development `/api`
proxy, which would otherwise misroute the `/api-keys` document to local 8080.
Both final runs completed **22 page captures** each, plus the view/entry captures.

Follow-up the same day: expense rows were restructured after spacing review —
amount and row actions now share one top-aligned side group (stacked with
space-between on small screens), the date/category line is a smaller dimmer
meta row, and row padding tightened to 16px. The duplicated "Get started"
ledger phrase was removed so the shared catalog translation keeps the public
CTA wording in ja/fr/es. ViewTabs key lookup now uses `Object.hasOwn`, and
project-opener focus refs reset with the rest of the scope state. `npm run
check` passed again (34 files / 298 tests) and the four-width loopback
capture run reported no page errors or document overflow.

GitHub's connected read tools returned no statuses or PR workflow runs for the
current base head. This local candidate has no remote CI result. This
version is for user screenshot review; it has not been pushed or deployed.
No Wrangler/workerd, D1, OAuth or payment requests ran. Captures and
the local browser harness remain in `/tmp`, outside the tracked source.

## Ledger intent and region hierarchy (2026-09-30)

Projects, Shared Pool, Categories and project detail keep the shared flat
`.panel` / `.panel-h` workbench style. Desktop creation rails have a single
hairline separator; mobile stacks the regions. List headings, row titles,
metadata and secondary actions now have distinct visual weights. Category
actions sit beside their record, and expense amounts/actions align separately
from purpose, date, category and note. Account overview shows totals before
filters. Shared/project totals and filters form one section; the large Shared
Pool guidance banner is replaced with concise scope copy in the page header.

Shared/project expense entry opens only from explicit Add/Edit intent. The
primary header action leads to a focused, visible entry control. Required
fields lead; quantity/unit/note use the shared native disclosure, with existing
optional values expanded during edits. Cancel and successful save restore the
opener; scope changes clear the entry state. Historical editing remains usable
with lost GitHub access and archived categories, while new entry stays disabled.
Category rename/archive confirmation display controls for the current action,
with other row actions restored on cancel. Project creation descriptions and
project description settings use optional disclosures. Five non-English
catalogs cover the new labels. The note textarea
and expense/filter selects use separate associated labels so their names stay
stable as values change. No API, provider, money or admission behavior changed.

The intent/scope regressions were written first and failed before implementation.
Four new behavior tests cover explicit entry/cancel/focus, scope changes,
historical edits and category action states. Visual-only spacing/typography changes were verified through
browser captures instead of implementation-mirroring tests. `npm run check`
passed lint, 34 files / 293 tests and build; `npm run check:workers` passed.
The final label/focus changes passed the complete check again.

Loopback Playwright on the built artifact used synthetic fixtures and blocked
all external requests. Populated/empty Projects, Categories, Shared Pool and
detail, lost-access history, initial loading, and Chinese dark screens were
captured at 1440px/390px; 900px boundaries were checked as well. No page errors
or document overflow occurred. Add, cancel, edit, optional-draft retention,
category rename/archive confirmation and direct mobile entry visibility after
the shared smooth-scroll transition were checked. This is local UI evidence, not
real OAuth/payment/Cloudflare runtime acceptance.

GitHub CLI CI review failed with a network EOF. Preview publication remains
pending: Wrangler found an expired OAuth token and could not refresh it in this
non-interactive environment. No Worker deployment, D1 query or provider traffic
occurred in this continuation. Once credentials are available, publication
verification is capped at one HTML GET and three exact hashed asset GETs, no
retries or authenticated API calls: zero D1 Rows Read / zero Rows Written.

## Ledger work area hierarchy (2026-09-30, local only)

The Ledger pages (Projects list, Shared Pool, Categories and project
detail) were reorganized into one visible hierarchy — understand, act,
then analyze — without touching data flow or API behavior. Project detail
and Shared Pool now lead with per-currency totals stats, then a shared
filter bar (date/category filters plus CSV export), then the
`.ledger-split` work area: expense list left, Add/Edit expense entry
right, matching the Projects/Categories creation rail; report charts and
the project description form follow. Account overview keeps its position
after the Projects controls with the same stats treatment. Every panel
uses the `.panel-h` icon heading row, the screen fades in like Billing and
API Keys, and a new `LedgerSkeleton` mirrors each mode's panels while the
first load is pending (later reloads keep showing current data). The
Categories empty state no longer says "above" (the creation panel sits to
the right/below); all five non-English catalogs were updated. Editing an
expense scrolls the entry panel into view. No radius/shadow/token
additions; `base.css`, `screens.css` and `app.css` are untouched.

Local verification passed `npm run check` (lint, 34 test files / 289 tests
including two new skeleton tests, production build) and `npm run
check:workers`. Loopback Playwright with synthetic API fixtures covered
Projects, project detail, Shared Pool and Categories at 1440px and 390px,
plus a Chinese dark detail page and a pending-API skeleton capture: no
page errors and no 390px horizontal overflow. External requests were
blocked, so captures exercise fallback fonts. No Wrangler/workerd/D1
commands were run; Cloudflare runtime acceptance and deployment remain
pending under the existing pause.

## Project detail return navigation (2026-09-29)

Project detail now shows Projects / current project in the shared Topbar, with
Projects linking to the list. A visible Back to projects link sits beside the
page title/actions and remains available while loading or on an API error.
Both links reuse screenLinkProps and its real `/projects` href; the current
project remains aria-current=page. All five non-English catalogs include the
new return label. Shared/project-list/category screens keep their existing
breadcrumbs and no new Server/API behavior was introduced.

Three regressions failed before implementation. `npm run check` passed lint,
34 files / 287 tests and the production build; `npm run check:workers` passed.
Loopback Playwright drove the final build: parent breadcrumb and header link
returned to Projects with its list, including a simulated project-load 503.
Desktop/mobile screenshots were checked; the 390px document did not overflow,
and no JavaScript page errors occurred. All API/provider data was simulated.

Publication verification is limited to one HTML GET and three exact hashed
assets with no retries, authenticated API/provider requests or D1 traffic.
Per-case and total D1 bounds are zero Rows Read / zero Rows Written. Server,
production Web, runtime budget limits, database and schedules are unchanged.

Code `42200b4` was pushed to main and deployed to `pullwise-web-preview`,
version `4ada70d0-0113-4e62-806c-aeb0ed175829`. Four finite remote GETs returned
200: Projects HTML and the current index CSS/index JS/ledger JS. HTML retained
noindex and referenced the new build; all three assets matched local SHA-256.
No D1/provider or authenticated API requests occurred. Web CI still has no run
record; local unit/build/configuration and loopback browser evidence above passed.

## Add repository interaction repair (2026-09-29)

The empty-state action only focused a control, so empty candidates focused
Manage GitHub access without invoking it. Three regressions failed before
the fix. Add now opens/focuses the available native chooser, loads an existing
next repository page, or invokes guarded GitHub access when no candidates exist.
Picker restrictions/unsupported browsers retain the usable focus fallback.
The matching Server change supplies live preinstalled grants and popup sync.

The complete Web suite passed 34 files / 284 tests; lint, build and offline
configuration checks passed. A loopback final-build browser journey verified
chooser opening, synthetic GitHub popup completion, sync and newly visible
candidates. Mobile document width was 390px at a 390px viewport, with no JS page
errors. Real external requests were blocked; synthetic GitHub navigation was
fulfilled locally. This is not real provider acceptance. Publication checks
are capped at one HTML GET and three exact static assets, no retries and zero
D1 reads/writes; no authenticated API request is part of agent validation.

Code `bf43805` was pushed to main and deployed to `pullwise-web-preview` as
`59877c97-34e7-476b-9918-8d2255b097e4`. Exactly four remote GETs returned 200:
the Projects HTML and current index CSS/index JS/ledger JS. HTML retained noindex
and referenced the new build; all three static assets matched local SHA-256.
No retries, provider or D1 requests occurred. Web CI still has no run record;
the companion Server repair's CI passed. Real user GitHub acceptance remains
separate from the loopback simulated authorization journey.

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

Code commit `b16a000` was pushed to main and deployed to
`pullwise-web-preview`, version `8e53153d-af2f-4cfc-ab7c-5697f1059c18`, at
https://preview.pull-wise.com. Wrangler confirmed the custom-domain deployment
and retained the matching Server binding/preview vars. The first planned HTML
check stopped during the local curl Schannel TLS handshake (exit 35, HTTP 000).
No response was received, no asset checks or retries followed, and no D1/API/
provider requests were made. Post-deploy HTTP/content verification remains
pending; do not treat the previous release's asset hashes as this release's
acceptance. GitHub CLI reports no workflow run for this commit.

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

The preview vars and service binding were correct, but `assets.run_worker_first`
only included `/api/*`, so static HTML bypassed worker-entry's noindex/security
middleware. The config also lacked the ASSETS binding required by worker.js.
Cloudflare [asset-routing documentation](https://developers.cloudflare.com/workers/static-assets/binding/)
supports negative selective patterns. Preview now binds ASSETS and uses
["/_", "!/assets/\*"] so HTML/API paths use the Worker while hashed assets
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
`/api/auth/github/authorize` returned exactly **503 D1_ACCESS_PAUSED**, replacing 521. Server access remains 0; no OAuth/provider action or remote D1 SQL occurred.
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
