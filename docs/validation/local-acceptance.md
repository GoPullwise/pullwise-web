# Current local acceptance

Updated 2026-10-02. Companion: [Server acceptance](../../../pullwise-server/docs/validation/local-acceptance.md).

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
Preview backend deployment requires separate authorization. Commit CI and any
frontend publication status will be recorded after they are reviewed; neither
has yet verified the real preview identity chain.

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
