# Current local acceptance

## Spending overview period alignment (2026-10-10)

The period selector, native month/custom date fields and This month shortcut
now share visible backgrounds, borders and 44px control heights (48px on
phones). The shortcut uses the shared secondary button. A dedicated grid keeps
wide rows aligned; containers at or below 640px stack all controls at equal
width. Custom dates share equal columns when wide. The existing totals and
composition presentation, native pickers and inclusive-date behavior remain.

[Local verification](overview-filter-local-2026-10-10.json) records lint,
75 test files / 1,565 tests, production build, offline Worker config and preview
dry-run passing. Overview passes 15 Chromium contexts / 113 settled states plus
38 focused filter checks, including six locales, light/dark, native keyboard
focus/reset, invalid and inclusive custom dates, actual 640/641px container
bounds and 760/761px viewport bounds. Each context permits exactly seven summary
reads and at most 20 API reads, all through bounded local GET-only fixtures.
Billing's 24 contexts / 72 states and the phone/tablet suite's ten contexts /
207 states pass. Existing native date-layout checks also pass. The 1906px dark
desktop and 390px dark phone captures were inspected. No other browser engine
or physical device acceptance is claimed. The main/preview publication receipt
will record the matching source version and finite static asset verification.

## Expense currency dropdown (2026-10-10)

Project and Shared Pool one-time/recurring create/edit forms now share a
currency picker. Fifteen common options show code plus the currency name in
the current English, Chinese, Japanese, Korean, French or Spanish UI. The
closed trigger and save payload contain only the code. The final custom
option exposes a separately labeled three-letter code input and confirmation;
typing, navigation and cancellation leave the parent expense draft unchanged.
Non-common existing codes are preserved. Custom Enter confirms only the
currency, and all non-submit buttons have explicit button types. Busy states
close the menu and disable selection. Existing amount precision, scope fences,
Server currency validation and API contracts remain intact.

Actual HTTP-200 documentation reads cover
[Radix Select](https://www.radix-ui.com/primitives/docs/components/select),
[Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover),
[WAI select-only Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)
and [WAI Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).
The picker retains Pullwise's flat theme without another dependency. The custom
input and confirmation sit outside the listbox options, with their own labels.

`npm run check` passes ESLint, 75 files / 1,565 tests and the build;
`npm run check:workers` passes the offline configuration guard. Subsequent
trigger ResizeObserver, focus-without-scroll and safe-edge positioning changes
pass the 26 focused picker/integration tests and JavaScript lint, followed by
the final preview-environment build and successful Wrangler dry-run. Their
independent read-only review finds no blocking issue. Test fixtures cover
six-language option names, code-only payloads, project/shared recurring and
one-time create/edit, preserved non-common codes, pending writes, explicit
custom confirmation, Escape/outside/focus dismissal and keyboard submission
guards. The date-layout checker now includes the button-based combobox in its
field geometry checks. Server and production are not changed or deployed.

Final currency Chromium checks pass nine contexts / 49 settled states, with
317 intercepted GETs / 108 synthetic API reads, no attempted business writes,
external delivery or page errors. They cover English/French/Spanish 260px
editor rails, six-language 320px touch layouts, a reduced 320x360 viewport,
strict header/dock bounds, actual touch taps, code-only closed values, custom
draft cancellation/confirmation and no extra API reads. Chromium's accessibility
tree exposes the closed combobox value as USD. Native QA found and fixed a
French narrow-rail header overlap; the final strict bounds pass. Two harness
issues (a hidden desktop dock and tapping a field covered by the popover) were
corrected without relaxing bounds or forcing clicks. Initial failed attempts
and completed prefixes are retained in the local evidence. Final custom-menu
captures were visually inspected in French desktop and Chinese/French phone.
The currency checker is included in CI. These are bounded local fixtures;
physical devices, OS keyboards, Firefox/WebKit and remote provider/data flows
are outside this evidence.
[Local evidence](currency-picker-local-2026-10-10.json) records the final built
asset hashes and each failed prefix separately. Date-field regression passes
four Chromium contexts / 258 states, including 390-to-320 and 412-to-360 phone
widths. Together, the final currency/date suites pass 13 contexts / 307 states
with 693 intercepted GETs / 400 synthetic API reads and zero business writes
or external delivery.
[Preview publication](currency-picker-preview-release-2026-10-10.json) records
runtime main commit `208ae96` and Web version
`7bb657aa-7524-47db-ad20-5792bc1fe764`. One homepage and three exact hashed
entry/picker-CSS/picker-JavaScript GETs all return 200; the homepage is noindex
and references the built entry, while assets match the final local bytes.
No redirects, retries, JavaScript execution or remote business/provider/D1
operation runs. GitHub CLI reports no workflow runs at publication time.
This publication includes the prior Spending overview and Billing redesign.
The receipt commit is documentation-only and requires no runtime redeployment.

## Spending overview and Billing redesign (2026-10-10)

The Web-only redesign uses per-currency totals beside a horizontal project /
Shared Pool composition, with exact amounts and a visible, accessible legend.
BigInt owns all monetary arithmetic; only bounded ratios reach CSS. True zero
totals have an empty track and no invented percentage. Tiny nonzero shares use
honest bounds. Invalid reports remain unavailable. The period toolbar is compact
and responds to the available container, with existing inclusive-date semantics.
Shared Pool Reports retains its compact total treatment.

Billing aligns Projects, Expense records and paid Jev in flat modules. Used is
dominant, Total allowance is secondary, and native meters retain their existing
ratio and exact accessible values. Personal-ledger scope, paid/free rules,
micro-USD precision, UTC month, refresh, payment and API behavior are unchanged.

The implementation references the actual public documentation and component
examples for [Vercel Usage](https://vercel.com/docs/pricing/manage-and-optimize-usage),
[Linear Insights](https://linear.app/docs/insights),
[shadcn Chart](https://ui.shadcn.com/docs/components/chart),
[Tremor BarList](https://www.tremor.so/docs/visualizations/bar-list) and
[CategoryBar](https://www.tremor.so/docs/visualizations/category-bar).
It uses Pullwise's existing flat theme and no additional chart dependencies.

ESLint, the existing 72-file / 1,536-test suite, build and offline Worker config
pass. Three new composition tests pass; final targeted Billing / Overview /
composition tests pass 119 tests. Chromium layout checks cover Overview's six
locales, multi-currency/long-value/zero/error states, Billing exact/stress values,
phone/tablet flows and native date fields. An independent review found a filter
selector specificity issue, which was fixed before the Overview/mobile/date
checks. The new Overview checker is included in CI. Browser evidence uses
bounded, intercepted, GET-only synthetic fixtures; it does not establish real
OAuth, payment, remote data or physical iOS/Android acceptance. WebKit and Firefox
binaries are unavailable in this environment; none were installed.

[Local evidence](overview-billing-design-local-2026-10-10.json) records 48 Chromium
contexts / 586 settled states, including the final focused compact Shared Pool
readback. It distinguishes the build used by each suite. Server, production and
existing database state remain unchanged.
[Preview publication](overview-billing-design-preview-release-2026-10-10.json)
records runtime commit `c2192e881c57518376b64166102ce5f08e60e7eb` and Web
version `6f624496-e553-40a5-afd0-67064698a061`. One homepage and three exact
hashed-asset GETs return 200; the homepage is noindex and references the built
entry, and every asset matches the local bytes. No redirects, retries, JavaScript
execution or remote business/provider/D1 operation occurs. GitHub CLI returns
no workflow runs at publication time.

[Final console preview publication](github-console-ui-preview-release-2026-10-10.json)
records runtime main commit `1e395e90a311997ebdbd98719239d4405c735dcf`
and Web version `f8e173e9-c8ba-4676-b15c-0b66fe68934a`, confirmed 100% active.
The final finite check succeeds: one homepage GET is 200/noindex and references
the built entry; three exact entry-JavaScript/global-CSS/Billing-JavaScript GETs
are 200 and match the built bytes. No JavaScript, redirect, retry or remote
business/provider/D1 action runs. The prior release's default-client 403 record
is retained; the final new-version check uses the installed Chromium user agent
without changing a security rule. Original Server preview version, database,
coordinator and production pause remain unchanged. This receipt commit is
documentation-only and needs no runtime redeployment.

## Final console presentation verification (2026-10-10)

[Final local evidence](final-console-ui-local-2026-10-10.json) records ESLint,
72 files / 1,536 tests, production build, Worker configuration, contract mirror
and final preview dry-run passing. After the small Project-header reorder,
136 Ledger/Projects tests and its lint pass again. The last Members-only CSS
width correction has final-build native geometry and phone regression evidence.

Billing meters pass 24 Chromium contexts / 72 section states across six locales,
light/dark and 1906/1024/390/320px, with exact/stress values, manual refresh and
personal-ledger scope. Eight WebKit 26 desktop contexts / 16 section states pass;
they cover normal native ratios and accessible text, not the 320px stress branch.
Billing evidence precedes only the unrelated, scoped Members width correction.

The phone/tablet suite covers ten unique profiles / 207 settled states. Its
first seven contexts pass; the eighth reveals that the test only scrolls a final
action into view above y=0, overlooking a sticky header at y=6. The corrected
checker retains the bottom-dock and actual hit-test guards. Only that failed
profile, the two remaining profiles and the two narrow profiles affected by
the Owner correction run again. Thirteen actual contexts include that failed
attempt and repeats; the missing prefix request aggregate is not invented.

[Members/Projects native evidence](owner-projects-native-browser-local-2026-10-10.json)
records exact role boxes and search/count behavior. A real 320px French Owner
label initially wraps; the shared role field now retains enough width and
removal actions wrap below. Final Owner/Admin boxes are both 144×48 at 320px
and 154×48 at 390px. Owner stays bold and immutable. Screenshot touch recovery,
that initial width failure, retained desktop scope and all local request counts
are disclosed. All requests are intercepted; no business/provider/D1 write or
remote account acceptance occurs. Physical devices, WebKit mobile and Firefox
remain outside this local proof.

## Projects count and search alignment (2026-10-10)

Projects keeps its main heading and removes the intermediate Projects/count
label. Search is left-aligned in that toolbar. The loaded project count and
pagination `+` now sit beside the Project column title, using its typography.
That title/count stays visible with one or zero search matches and on phone
layouts, where the other column headings stay hidden above stacked project
cards. Existing search, clear/focus, load-more and reload tests confirm that
filtering does not change the loaded total. Ledger/Projects targeted suites
pass 136 tests; ESLint and whitespace checks pass.

## Compact Billing capacity graphics (2026-10-10)

Billing's Projects, Expense records and paid Jev figures now sit in flat usage
cards with native accessible ratio meters. Used and Total allowance remain exact
and visible, including usage above a lowered allowance. Visual fill clamps at
the allowance; accessible text retains the full actual values. There is no
fabricated minimum fill, remaining-capacity calculation or over-limit status
copy. Positive allowances support true zero use; a valid zero Jev allowance
keeps both values but omits its undefined ratio. Read/refresh, personal-ledger
scope, unavailable states and UTC-month reservation accounting are unchanged.
The targeted Billing suite passes 111 tests, with ESLint and independent review.
The bounded browser checker now validates the native ratio, exact localized
accessible text, visible track and containment rather than the retired no-meter
presentation. Final built-browser checks and publication follow below.

## GitHub popup closure and aligned immutable roles (2026-10-10)

Closing the GitHub window triggers one finite verification of the current
account's repository access and an honest unverified-close notice. Cached
repository access and a manage continuation cannot prove that this particular
GitHub change was saved. Only the matching-origin, matching-popup callback with
the current flow nonce establishes completion. Explicit provider, authorization,
malformed-response and refresh errors remain errors; account, unmount and stale
response fences are preserved. Settings, Projects and the OAuth return include
six-language save/return guidance.

[Native popup evidence](github-popup-close-native-browser-local-2026-10-10.json)
records nine passing real-window Chromium cases, including the original return
gate, retained opener/name, source and nonce checks, account change and sync
failure. All 206 browser requests and 19 API requests, including failed local
navigation fixtures and the initial request-cap stop, were intercepted locally.
No real provider or remote D1 operation ran; source hashes stayed unchanged.
Helper/auth tests (66), Settings/Public/locales (124), Projects (43), Ledger
(93), ESLint and an independent security review passed.

Immutable member roles now occupy the same first control column, with matching
border, background, padding and responsive font size. Owner retains bold text
and its existing noninteractive semantics. Narrow layouts reserve the same
control width even when the row has no removal action. Existing Members tests
(61) pass. Final built-browser geometry and publication are recorded below
after the remaining Billing and Projects presentation changes.

[Jev/overview preview publication](jev-overview-preview-release-2026-10-10.json)
records both main runtime commits and 100%-active preview versions. The original
Server database, coordinator namespace, inherited bindings, hourly schedule and
production D1 pause remain. No migration or remote synthetic/provider/business
acceptance is performed. The bounded static check attempts one homepage plus
three exact built assets once; all are blocked with HTTP 403 / Cloudflare 1010
in the current environment. This is recorded as a failed static readback, not
as successful byte verification. Deployment success is independently confirmed
through Cloudflare management metadata. Subsequent receipt commits are docs-only.

## Monthly Jev allowance, 100-record review, spending overview and Billing (2026-10-10)

The user removes the application daily Jev cap and retains the Owner's existing
UTC-month model allowance. Save assistance, recurring categorization, advanced
drafts and review share the atomic monthly reservation. Current UI and API copy
no longer claims a daily limit. Duplicate candidates now require the same
expense date, currency and exact minor-unit amount within the authorized target;
purpose text does not need to match. Inspection explicitly reads the first
100 filtered records in one bounded request, independent of ordinary ten-record
pagination, and processes selected records serially only after Start. Closing,
filter/access changes, stale/invalid pages and read failures retain the existing
abort, lock and identity fences. It does not follow cursors or poll.

The new `/overview` Spending overview defaults to the local current calendar
month, accepts another month or an inclusive custom date range, and uses the
existing authorized report summary. It displays all expenses, all projects and
Shared pool separately for each currency, counts per-project details only through
the project aggregate, and validates that project plus shared equals the account
amount. Integer/BigInt calculations preserve totals above the JavaScript safe
number bound. Currency precision follows the Server's fixed minor-unit contract,
including MGA, IQD and CLF; browser Intl defaults cannot change its scale.
Shared pool Reports restores a compact filtered total and refreshes it after
ordinary or recurring recovery writes. Read errors remain visible independently
of charts. The phone navigation now has four Ledger destinations plus More.

Billing exposes Pro/Max Jev Used and Total allowance, the current UTC month and
exact microUSD values through its existing GET/manual Refresh. It reads the
actual account's personal ledger even when another ledger is selected. Copy
identifies conservative model reservations, monthly reset without rollover and
the same rule for annual subscriptions. Free hides the paid section; unavailable
or malformed usage does not become a fabricated zero. The user's lower-priority
request to replace the plain usage display with concise charts follows the
GitHub popup and Owner-role styling work.

The final `npm run check` passes ESLint, **72 files / 1,493 tests**, and the
production build after the currency-precision correction. Worker configuration,
API-contract mirror, Server/Web preview dry-run and whitespace checks pass. The
merged Server suite passes **2,546 tests / 62 subtests**, with its separate
canonical/native reservation evidence in the Server repository.

[Spending overview local evidence](jev-overview-layout-local-2026-10-10.json)
records the existing Chromium mobile/date geometry runs and three final-built
captures, including MGA/IQD/CLF, multiple currencies, custom dates and an exact
aggregate above the safe-number limit. Earlier geometry evidence is explicitly
identified as preceding the formatting-only precision fix. Final captures and
unit regressions use the corrected formatter; all requests are intercepted local
fixtures and no provider/remote business operation is delivered.

[Billing local browser evidence](jev-billing-layout-local-2026-10-10.json) passes
24 Chromium 151 contexts / 72 section states across six languages, light/dark,
1906/1024/390/320px and personal-ledger scope/stress/manual-refresh cases. Eight
WebKit 26 desktop contexts / 16 section states pass after locally restoring its
missing dynamic libraries. WebKit mobile stops at required maxTouchPoints>0
(the current host reports zero); Firefox cannot launch under the host's existing
sandbox/graphics constraints. No touch assertion or sandbox protection is bypassed.
These are local intercepted browser fixtures; no remote business request,
provider call or database write is performed. Physical-device, WebKit-mobile and
Firefox acceptance are not claimed.

## HTTPS sign-in entry and control spacing (2026-10-10)

[Preview publication](mobile-controls-preview-release-2026-10-10.json) records
both main commits and the released Web version. One HTTP navigation returns 308
to the HTTPS preview; one HTTPS homepage returns 200/noindex and references the
new build. Three exact entry-JavaScript, global-CSS and expense-CSS assets match
the built bytes. Redirects are inspected without automatic following, and no
page JavaScript, business API, D1 operation or provider call runs remotely.
Server changes are tests/evidence only; its runtime, database/coordinator and
hourly schedule need no redeployment. Production is not deployed. The final
publication-record commit is documentation-only.

The preview HTTP entry previously returned 200 HTML while email login required
the configured HTTPS Origin. The user confirmed that explicitly adding
`https://` restored iPhone Safari email login. Known deployed Web hosts now
upgrade HTTP GET/HEAD to HTTPS before rendering the page. The redirect preserves
the path/query, uses a fixed deployment host, removes nonstandard ports and keeps
preview noindex. Insecure writes are rejected locally without forwarding or
replaying a verification-code request. Local HTTP development is unchanged.
Server's strict trusted-Origin contract and runtime remain unchanged; its local
HTTP403/HTTPS202 mock-mail regressions pass 74 tests.

Expense entry choices use automatic equal heights, 12px vertical/16px horizontal
padding, a 6px title/caption gap and left-aligned text. Narrow containers stack
the choices when needed; translated captions remain fully inside their cards.
The shared topbar control size aligns native ledger selectors and icon actions:
32px desktop, 44px coarse tablet and 48px phone. Phone preferences and inbox
actions have matching square border boxes and aligned top/bottom edges.

Mobile console language/theme preferences are hosted by the actual page header
rather than an independent fixed overlay. Intermediate pages do not render an
orphan Options button. Public pages retain their corner control after content
commits; desktop placement and the nested language menu's keyboard/focus/dismissal
behavior remain available.

The final `npm run check` passes ESLint, **70 files / 1,422 tests**, and the
production build. The twelve new ownership regressions cover real header slots,
old-registration cleanup, route-owner replacement, Suspense hide/recovery,
StrictMode, session/ledger waits, collapsed recovery and preserved draft focus.
Existing language-menu and breakpoint focus regressions also pass. The Worker
configuration check, API-contract artifact check and preview Worker dry-run pass.

[Local browser evidence](entry-control-layout-local-2026-10-10.json) passes **55
Chromium 151 contexts**, including twelve spacing/alignment contexts, five
session/ledger/OAuth/Suspense transitions and **481 persistent layout states**
across mobile, date/pane and Billing checks. It verifies exact equal border
bounds, text containment, a header-owned phone menu, removal of orphan controls,
collapsed recovery, Escape cleanup and preserved draft focus. Dark/light and
320/390/412px phones, touch tablets and a 260px desktop rail are covered.
All 1,986 requests are intercepted: 1,931 loopback deliveries and 55 blocked font
attempts, with 852 synthetic API GETs, zero business writes or external delivery.
The Billing fixture adds the previously published account notification read;
the loading fixture uses the actual visible waiting state instead of a spinner
that the existing phone layout hides. Original request limits and assertions
are retained. This is browser-engine/emulated geometry evidence; independent
physical-device/WebKit UI acceptance is not claimed.

[Pagination preview publication](expense-pagination-preview-release-2026-10-10.json)
records the final main source and Web version, one noindex homepage and three
exact matching assets: entry JavaScript, expense-page JavaScript and expense-page
CSS. No page JavaScript, business API, provider request or D1 operation is executed
remotely. The follow-up changes only Web; the previously published recurring
Server/database/schema/coordinator/hourly schedule and production pause remain.
The final publication-record commit is documentation-only.

## Project and Shared Pool expense pagination (2026-10-10)

The recurring release was committed, pushed to both main repositories and
published before this follow-up began. Project detail and Shared Pool recorded
expenses now request `limit=10` through the existing REST cursor contract.
Previous/Next replaces the displayed records; it does not append more rows.
Pagination is hidden when the complete filtered result fits one page. A short
final page retains Previous, with a localized current-page indicator.

Cursor history stores only visited cursor IDs, scoped to the ledger, current
authorization and complete date/category/currency/target query. Filter/access
changes and accepted writes reset the page; explicit Reload refreshes the current
page with at most one first-page fallback if it became empty. A canceled read
cannot issue that fallback through an obsolete account API. Rejected, oversized,
duplicate and non-advancing pages retain the current records and require explicit
recovery. Expense write guards remain held through required data refresh, including
successful recurring recovery. Reports and CSV retain the entire filtered result.
Projects/repository listing and the Server API defaults remain unchanged.

The final `npm run check` passes lint, **69 files / 1,396 tests**, and the
production build; the offline Worker configuration guard passes. The **38 new
pagination tests** cover both targets, zero/one/ten/eleven/twenty-three records,
previous/next replacement, partial final pages, reload/filter/identity changes,
failed and repeated pages, concurrent reads/writes and expense/recovery refresh.
This follow-up requires no Server source, schema, scheduler or provider change.
Browser acceptance and preview publication are recorded separately below.

[Local pagination evidence](expense-pagination-local-2026-10-10.json) passes eight
Chromium 151 contexts: both project/shared targets, eleven/twenty-three records,
and 1440px desktop/390px touch layouts. It verifies 10→1 and 10→10→3 replacement,
exact previous-page restoration, bound buttons, current-page reload, filtering to
four records with no pagination, clearing to the first ten, and complete currency
values. Every state stays within the document width; phone controls are at least
44px with genuine coarse media and one reported touch point. The final run uses
no screenshots because the capture utility resets touch emulation. The finite
fixtures use **392 local requests / 64 expense GETs**, zero writes, violations or
external delivery. This is engine/emulated UI evidence, not live-account or
physical-device acceptance. The final built assets also pass Worker dry-run.

[Recurring preview publication](recurring-expenses-preview-release-2026-10-10.json)
records both main source commits and deployed versions, matching final built
homepage/three hashed assets, healthy Server schema v12, unchanged original
database/coordinator/hourly schedule and production pause. No JavaScript or
business/provider acceptance is executed remotely. This publication completes
the recurring release before the pagination follow-up begins.

## Recorded expenses, recurring categorization and recovery (2026-10-10)

Project and Shared Pool now distinguish Recorded expenses from Recurring plans.
The entry controls pair Record expense with Already paid and Recurring plan with
Future expenses, using Paid on / Start date fields and a concise historical-start
versus future-start preview. Each scheduled occurrence remains a separate expense
with its own date and original amount. Recurring create and explicit Automatic
edits use the same scoped Jev eligibility as ordinary expense saves; declined
classification retains the complete draft and focuses the category picker.
The saved-category confirmation is neutral for both records and future plans.

A plan retains up to ten frozen failed occurrences with exact dates, amounts and
an explicit Add to expenses action for each. Full-capacity failures preserve those
actions for manual recovery. Successful recovery refreshes recorded expenses,
project totals and reports before releasing the shared write guard, then refreshes
the inbox. Account inbox rows retain the failed expense after toast dismissal and
open the authorized ledger and exact plan, including when the ledger picker needs
an explicit access refresh. Server email/capacity/schema behavior is validated in
the companion Server record.

The final merged Web `npm run check` passes ESLint, **68 test files / 1,358
tests** and the production build. `npm run check:workers` passes its offline
configuration guard. The complete suite includes concurrent phone/Safari/Android
compatibility and automatic GitHub
credential renewal, scoped access boundaries, recurring classification/recovery
and inbox regressions. No git push or deployment is part of this local check.

The persistent local Chromium 151.0.7922.173 layout check passed **258 states**:
81 each at desktop 1440px and Chinese touch tablet 1280px, and 48 each at phone
390→320px and Android-sized 412→360px. Coverage includes ten frozen recovery rows,
44px recovery actions, complete currency values, equal natural record heights,
260/520px independent editor rails and live 899/900px reflow. Separate dark-theme
390px/1440px inbox and entry checks retain the full historical date and precise
large amount, avoid document/modal overflow, and navigate/focus the named plan.
The 390px case verifies coarse-pointer media, one touch point and a 44px action.

Browser evidence uses Playwright 1.57.0, local intercepted GET fixtures and a
100-request cap per context. The separate inbox captures use 40 guarded requests
plus two locally fulfilled notification reads per context, with no external
delivery or writes. The original evidence was collected before merging the concurrent
GitHub-renewal and phone-layout main changes; the merged source receives the complete
local check above and a separate final Chromium rerun. These checks establish
browser-engine/emulated layout behavior, not real
physical-device, provider delivery or live-account acceptance. Logs and screenshots
remain in ignored workspace scratch files; no screenshots are tracked.

[Final merged browser evidence](recurring-browser-local-2026-10-10.json) passes
**258 date/pane states and 187 phone/modal states** in Chromium against the final
merged build. The mobile fixture includes sixteen invitation requests and ten
frozen pending-expense notifications, asserting both sections and each saved
date, exact amount and recovery action. All ten mobile contexts use 28 local API
GETs and 50–57 total requests, without writes or external delivery. The original
empty-tail diagnostic was a fixture false positive: no record row was visible
when the trailing empty section filled the reduced viewport. Adding real pending
records retains the unchanged element-hit obstruction check and passes even at
640×260. No product/CSS change was needed. Fixture lint/format checks pass.
WebKit is unavailable in this workspace, so this final rerun establishes Chromium
engine/emulated geometry only; the concurrent mobile release retains its separate
historical WebKit evidence.

## Mobile Safari, Android Chrome and phone layout (2026-10-10)

[Preview publication](mobile-compatibility-preview-release-2026-10-10.json) records
the released Web version, GitHub main source and three exact assets matching
this final build. The homepage HEAD returned 200/noindex; the only homepage
GET returned 403 and was not repeated, so its body references remain unverified.
No Server or database changes are included.

The approved phone layout uses a compact topbar with a Display options icon,
three primary bottom tabs plus a native More selector, larger titles and
single-column forms and records. iPad and desktop retain the shared sidebar and
component system. The merged source retains automatic GitHub credential renewal
and rejects old-account or aborted popup completions before repository sync.
The original flat theme, six locales, exact financial text,
workspace isolation, drafts and pending-operation guards remain. Navigation
reserves its measured height, including the safe area; phone controls are 48px
and touch-capable tablet controls at least 44px, with 16px text inputs.

Shared modals lock background scrolling and focus, use the visible viewport,
scroll their body and keep footer actions available. Inert notifications render
behind modal backdrops. Phone forms no longer have floating display controls
over their fields. Other fixes cover decimal-comma input without numeric
rounding, visible chart value navigation, failed clipboard fallback, startup
loading, language-menu keyboard/focus behavior and BFCache session,
workspace-permission and inbox return handling. Build targets explicitly retain
Safari/iOS 16.4+ and Chrome/Edge 111+ syntax support. CI separates unit-test and browser-build
environment settings and includes the new mobile layout check.

[Local validation](mobile-compatibility-local-2026-10-10.json) records the checks,
engine versions, fixture bounds and source hashes. The complete unit pipeline
passes 68 files / 1,343 tests, lint and build, plus the offline Worker guard.
The new Chromium/WebKit runner passes 20 contexts / 374 states, including narrow
phones, Android widths, short screens, iPad, desktop, both themes and en/zh/fr.
It produces 22 captures; representative phone, tablet and desktop captures were
visually reviewed. Billing passes 24 Chromium contexts /
36 states across six locales; public-page footer and language controls pass
14 route/viewport cases with Chromium 151. No business requests or writes are
delivered remotely; layout checks use bounded loopback GET fixtures. The three
authorization-renewal cases intercept one simulated renewal POST each, with
no real provider calls or business writes.

The existing date/pane/financial-presentation suite passes four profiles /
258 states in each of Chromium and WebKit. Compact headings allow unclipped
font ascender/descender boxes outside their own line box while retaining inline
and main bounds and adjacent-content/action separation. Negative controls
verify rejection of oversized dates and actually clipped headings. One WebKit
412px resize/cancel run timed out; an isolated 48-state diagnostic and a full
uninstrumented 258-state rerun both passed without forced clicks or added
delays. No application defect was reproduced; the original timeout is retained
with the local diagnostic evidence.

The local browser evidence establishes engine behavior, geometry and simulated
interaction. Linux WebKit reports zero touch points despite coarse-pointer media;
the runner records that value without modifying navigator. A reduced viewport
does not simulate an operating-system keyboard. Physical iPhone/iPad Safari
and Android Chrome keyboard, browser-chrome/safe-area, date-picker, download,
OAuth return and background-return acceptance remains outstanding. BFCache
session checks do not guarantee a repository-metadata reload; the reusable
repository-access helper has isolated pageshow coverage but is not connected
to product screens. Publication is recorded separately from local acceptance.

## Automatic GitHub credential renewal (2026-10-10)

[Preview publication receipt](github-refresh-preview-release-2026-10-10.json) records
the two released versions, matching static assets and preserved database/coordinator,
schedules and production D1 pause. No remote business/provider workflow was invoked.

Only an explicit Server `githubRefreshRequired: true` permits one cookie-authenticated
`POST /integrations/github/refresh` and one repeated read. Parallel requests share
one account-generation renewal; stale account responses, canceled consumers and
successful logout cannot restore obsolete protected state. A failed logout retains
the original scope. Ordinary mutations are never replayed, no timer or OAuth
redirect is introduced, and credentials are never stored in browser storage.

Temporary provider/network failures retain the successfully read financial history
and binding IDs, hide unavailable repository choices and show the existing recovery
message. Explicitly revoked authorization keeps manual reconnect. Actual resource
404, validation 422, account 409, role 403 and session 401 remain errors instead of
restoring old financial data. Existing users must reconnect once because the older
Server did not retain their refresh token. Normal provider expiry can then renew
without a new GitHub authorization flow.

The complete current Web check passes ESLint, **65 files / 1,268 tests** and the
production build. Worker configuration and both generated OpenAPI artifacts pass;
Python Server passes **2,396 tests / 62 subtests**. Focused helper/application/ledger/
settings checks pass **318 tests in eight files**. Final read-only review confirms
bounded retries, current-account isolation and the explicit safe-error allowlist.
[Browser evidence](github-refresh-browser-local-2026-10-10.json) passes three
loopback fixture cases with Playwright 1.57.0 and Chromium 151.0.7922.173 against
the final built `index-CzWR0FRW.js`. Success performs one shared simulated POST and
exactly two GETs each for project/list, restores repository and Organization links,
keeps the existing expense visible/editable and shows no reconnect. Temporary
503 and revoked 403 each perform one POST and one GET per project/list, preserve
expense history and binding IDs, and only revoked authorization shows reconnect.
The cases use 36/34/34 intercepted requests under per-case 64 and total 192 caps.
No business write, OAuth start or external delivery occurs. These synthetic local
cases do not establish acceptance against a real GitHub account. Actual preview
publication is recorded separately.

## Expense category guidance (2026-10-09)

Project and Shared Pool expense pages now explain the next step when no active
category exists: the shared empty state combines a concrete explanation with
one primary Add category action. That action opens Categories. After a category
is available, the usual Add expense entry remains available. Historical records
and filtered empty results retain their own content, with compact setup guidance
before them. Editors ask an Owner/Admin to add a category; Viewers and projects
that cannot accept new expenses do not receive a setup action. Historical edits
can keep the expense's original archived or removed category.

[Local validation](category-guidance-local-2026-10-09.json) records the complete
pipeline, six-language browser checks and shared layout verification. The original
theme and shared empty/notice components remain, with 44px actions on simulated
touch screens. Browser evidence uses finite local GET fixtures, with no external
delivery or writes; it does not establish physical-device or live-account
acceptance. Screenshots and temporary B/C prototypes remain outside the repository.

[Preview publication](category-guidance-preview-release-2026-10-09.json) records
the released Web version and the finite static readback: one noindex homepage
and three exact built assets (entry, expense screen and shared CSS). All returned
200; asset bytes match the final preview build. No business API calls, Server
deployment, database changes or production publication occurred.

[Billing usage preview publication](billing-usage-preview-release-2026-10-09.json)
records the new two-value usage presentation, Web preview version and exact
homepage/three-asset static readback. The matching Billing/CSS/index assets
are verified against the final build; no business API calls, Server/database
changes or production publication are part of this release.

[Final preview publication receipt](rest-capacity-and-retention-preview-release-2026-10-09.json) records the released Web/Server
versions, exact three-asset/static-homepage readback, configured plan capacities
and preserved database, journal, hourly schedule and production D1 pause. No
remote business mutation, forced tick, provider call or real payment is performed
by this publication check. Local fixture acceptance is recorded separately below.


## Billing usage simplification (2026-10-09)

Billing now presents two flat usage groups for Projects and Expense records.
Each has only Used and Total allowance, with larger tabular usage figures and
quieter totals. The progress bars, remaining fields and difference/status
arithmetic are removed, including the decorative usage-heading icon. The
Server's valid used/limit values display independently of any legacy remaining
field, retaining exact over-limit counts and honest unavailable states.
Personal-ledger scope, explicit refresh and subscription mutation locks remain.
Loading placeholders follow the same two-value layout.

[Local validation](billing-usage-local-2026-10-09.json) records lint,
63 test files / 1,206 tests, the preview build and offline Worker guard.
`npm run test:billing-layout -- --browser=chromium --screenshots` passed
24 contexts / 36 states across light/dark, 1906/1024/390/320 widths and six
locales, including full safe-integer values, narrow actual settings-body reflow
and a foreign selected ledger. Captures were visually inspected. Requests were
intercepted local GET fixtures (at most 6 API / 31 total per context), with no
remote business calls or writes. This is Chromium 151 emulation and fallback
font evidence, not real devices or live account/provider acceptance.

## Opt-in expense replacement at capacity (2026-10-09)

Settings adds a personal-account expense retention switch for every plan, with
the Server's actual saved value and a default of Off. It applies to the Owner's
project/shared expenses created by Web members, API keys and recurring schedules,
independently of the selected ledger. Six-language copy explains real removal,
no restoration, no extra charges, expense-date ordering, permissions on the exact
oldest record and manual cleanup above a lowered limit. Switching On makes no
immediate expense removal. Writes use the independent account revision and retain
the shared Settings operation guard through the required status refresh; errors
require explicit Reload. Neither preference reads nor UI navigation poll or write.

Billing and Pricing explain the updated capacity rule: undeleted expenses in
shared pool and active/archived projects use expense slots. Manual or automatic
expense removal and project removal release expense slots. Archived and removed
projects still use the cumulative project allowance. Configured defaults remain
Free **3/100**, Pro **20/20,000**, Max **100/100,000** projects/expense records.

The new preference suite passes **28 tests** for all plans, failed/stale responses,
identity changes, cancellation, six languages and reciprocal Settings guards.
The final generated **59-operation** contract passes **52 focused tests** for
actual ledger/account request mappings and product clients, including both boolean
values, required If-Match and Cookie-only personal preferences. The complete Web
pipeline passes **60 files / 1,167 tests**, lint, build and offline Worker checks.

Local Chromium **151.0.7922.173** with Playwright **1.57.0** passes **36 contexts**
covering six locales, both themes and 320/390/1440px; each plan has 12 contexts.
All switches initially reflect Off and remain available on Free, Pro and Max.
Three explicit synthetic On writes verify separate held-PATCH and held-refresh
lock stages after selecting another Owner's ledger. **74 preference GETs and three
PATCHes** contain no workspace header; each context permits at most six preference
GETs and one explicit preference write. All mobile cases verify coarse-pointer
and touch state, 44px labels and no document overflow. A French copy polish was
rechecked in six contexts. External requests are blocked; no real provider,
authenticated remote API or D1 access occurs. Browser evidence and source hashes
are preserved in `/workspace/work/retention-browser/`, with the finite capture
script at `/workspace/work/retention-browser.mjs`; its isolated Vite has exited.

The final **59-operation** docs pass another **13 Chromium contexts**: six locales
and both themes at 320px, plus English/light at 1440px with every operation opened.
The retention section, Cookie-only curl with Origin/If-Match, new preference schemas
and all response tables pass. Docs' retention deep link settles at its heading on
initial lazy rendering; no document overflow occurs and mobile targets remain
44px with coarse/touch assertions before and after capture. The check makes 91
synthetic session GETs and blocks all external delivery. Its Vite has exited.
[Durable local receipt](rest-capacity-and-retention-local-2026-10-09.json) records
the final source and contract hashes plus both browser matrices. The reviewed
Chinese mobile captures show readable copy and contained code/table scrolling.

## Complete REST integration docs and Billing capacity (2026-10-09)

API docs now include a runnable explicit-category Free journey, real response IDs,
expense replacement PATCH, If-Match/idempotency recovery, project CRUD, project/shared
recurring management and member invitation/approval/role/removal. Cookie and Bearer
clients share Server resources. Six-locale copy explains role/scope boundaries,
whole-ledger member keys and independent applicant authentication. The generated
reference and downloadable OpenAPI initially covered **42 paths / 57 operations**
at this REST/Jev checkpoint. The expense-retention update above expands the current
contract to **43 paths / 59 operations**; `--check` verifies both JSON copies
against Server's current source hash.

Default capacities are Free **3 projects / 100 expense records**, Pro **20 / 20,000**,
Max **100 / 100,000**. Billing displays actual configured used/limit/remaining charts
from its existing personal-ledger read, with over-limit and unavailable states,
capacity-retention guidance and guarded explicit refresh without polling. The actual
Web REST adapter regression checks every client method against the generated contract,
including project/shared CRUD, recurring edit/pause/resume/cancel and member governance.

After retaining concurrent main's personal Jev preference feature, lint, **1,124
tests in 59 files**, build and offline Worker configuration checks pass. The local
Chromium persistent layout runner passes **258 states** in four profiles. Billing
passes **36 local synthetic contexts** covering six locales, both themes and
1440/390/320px, with exact usage numbers, no horizontal overflow, coarse-pointer
controls, one Billing GET per load and no polling. Expanded reference tables and
JSON scroll inside their mobile container; schema disclosures have 44px targets.
API docs resolve their initial lazy-rendered hash so Docs' quickstart link lands
at the requested heading. These are synthetic local checks, not real OAuth/payment,
physical-device or authenticated remote ledger acceptance.

## Current membership permissions and old invitation links (2026-10-09)

Accepted invitation links display the current member role, not the link's initial
role. Reopening a hash reconciles cached access from a confirmed membership;
Open shared ledger selects from freshly read current workspaces and clears the
hash without accepting again. Explicit Reload, scoped navigation and confirmed
session return refresh authority. Changed role, revision or permissions remount
protected views; stale identity/ledger responses cannot restore access.
Read checks have no polling or business writes and defer through an existing
mutation and required refresh. Unchanged authority preserves drafts and API-key
form DOM; project-removal conflict Reload preserves unsaved settings and CAS.

The complete suite passes **953 tests in 50 files**, lint, build and offline
Worker checks at `a3afe7a`. After retaining concurrent main's recurring-date
help update (`7e4bc44`), the final `f1133d6` artifact passes **164 integrated
tests in four files**, lint and a preview-configured build. Both concurrent
main features remain intact; no project-removal or recurring behavior was added
by this permissions patch.

The frozen final build passes **12 local Chromium contexts**, 478 intercepted
requests, at most 72/context with a 100-request cap. Old Viewer links promoted
to Admin, later downgrade/removal, same-hash reopening, hard reload from personal
selection, stale responses, held write/read deferral and API Keys at 390px in both
themes pass. Settled desktop and mobile screenshots were visually reviewed.
Fixtures do not claim a real DF browser session, Safari or physical devices.
A separate actual preview membership lookup confirms current Admin, with
18 rows read and zero writes; private identity and invitation tokens are omitted.

[Preview receipt](member-role-sync-preview-release-2026-10-09.json) records Web
version `f622fa30-cfdf-480d-a9df-a349e94fc67a`. Four finite static GETs verify
homepage asset references and exact bytes of three hashed assets. Server version,
original database/journal, bindings and schedules are preserved. The live journal
stays healthy; its window delta includes other traffic and is not deployment cost.

## Explicit category removal (2026-10-09)

Categories offers Remove on active and archived rows with named confirmation,
Cancel/Escape and focus restoration. Archive and the title pencil remain.
Only unused configuration can be removed; expense history, recurring schedules
and saved actual Jev selections return clear archival guidance. Permission,
workspace and revision boundaries remain; writes and their required refresh
keep conflicting controls locked. All six locales and public API docs are updated.

Lint, **897 tests in 48 files**, build and offline Worker checks pass. The frozen
preview-configured artifact passes local synthetic Chromium workflows in English
and Chinese, both themes, 1440/390px and 320px reflow, including failure, focus,
active/archived removal, held write/refresh, Viewer and scope-change checks.
The persistent Chromium layout runner passes 258 states across four profiles,
at most 87 fixture requests per context with a 100-request ceiling and no external
delivery. The desktop and Chinese mobile screenshots were visually reviewed.
This evidence does not claim real-account, Safari or physical-device acceptance.

[Preview receipt](category-removal-preview-release-2026-10-09.json) records
Web version `54bfb188-c016-4f96-9f35-0c8d576a20ae`. Four finite static GETs verify
the homepage's frozen asset references and exact bytes of three hashed assets;
the existing preview Server binding and schedules are preserved.

Updated 2026-10-09. Companion: [Server acceptance](../../../pullwise-server/docs/validation/local-acceptance.md).

## Recent operation history and topbar label (2026-10-09)

Project detail adds Operation log after Expenses, Reports and Project settings;
Shared pool adds it after Expenses and Reports. It shows the actual actor,
complete local timestamp, affected record and changed values, including exact
currency amounts. The Server supplies the rolling 24-hour window. First explicit
activation loads history; manual reload and bounded pagination remain available
without polling. Expiry uses the advancing Server window even after pagination
or with a skewed client clock. Permission/scope changes abort stale requests and
clear protected rows; pending writes defer conflicting reads and preserve drafts.
All six languages are supported. The topbar's separate Ledger text is removed,
while the native selector retains its accessible localized label and real IDs.

`npm run check` passes lint, **47 files / 867 tests** and build after merging
the concurrent Members invitation-panel update (`b37f9af`, merge `7182427`).
Offline Worker checks pass. The final preview build is frozen as `index-DG1_LAAx.js`,
`ledger-DV-OZzdj.js` and `index-ChhzqjXD.css`.

[Browser evidence](activity-log-local-2026-10-09.json) passes 18 workflow states
in five Chromium contexts, with 88 synthetic API calls and a 100-request cap per
context. The persistent layout check passes 250 states in four profiles with
215 synthetic GETs. Mobile 390/320px touch, long identities/values, both themes,
Chinese copy and Shanghai time, busy controls, pagination, expiry and stale
workspace/403 clearing are checked. All seven unedited screenshots were visually
reviewed. No remote request, JavaScript error or layout violation occurred.
Firefox/WebKit and physical devices were not run for this change.

The Server companion proves native schema and authenticated synthetic activity
flows. [Preview publication](activity-log-preview-release-2026-10-09.json)
records separate static readback; no actual OAuth/provider or remote applicant
account flow is claimed. Activity begins with this release and old history is
not backfilled. Receipt-only follow-up commits require no runtime redeployment.

Preview version `59787df2-05d3-48e1-b2c2-750d13de1755` is published from the
accepted frozen build. Four finite static GETs return 200 and match its homepage
references and exact asset bytes. Existing bindings retain the preview Server
service. The release receipt distinguishes static publication from authenticated
remote workflow acceptance.

## Invitation links with inviter approval (2026-10-09)

Members creates an invitation link from its role alone, without requiring a
GitHub username. An applicant signs in and requests to join; the authenticated
account supplies their identity. Only the original inviter can approve or
reject the request. Approval creates membership, while a pending or rejected
request grants no ledger access. A link closes after one applicant is approved.
Repeated applications do not duplicate requests or audit writes, and checking
an approved link recovers current access without restoring removed membership.

The application-wide join-request inbox shows applicant identity and the
target ledger, with a direct path to its Members review controls. It refreshes
on authenticated login, navigation, returning focus/visibility and explicit
reload, with no interval polling. Invitation hashes survive the login return;
an already signed-in account returns directly to Members. Existing member role
dropdowns, locks and operation boundaries remain intact. Both the topbar inbox
and notification review actions respect an in-flight write before navigating.

The full `npm run check` passes lint, **44 test files / 776 tests** and the
build; the separately frozen preview-configured build is browser-accepted.
After the final notification navigation guard,
the targeted App suite passes **25 tests**. The independent local workflow
check passes **17 states in five Chromium contexts**, using **72 synthetic API
requests** with seven external requests blocked and no remote response or
JavaScript error. It covers role-only creation, identity-backed pending
applications, approval/rejection, approved access recovery without resubmission,
login return, correct shared-ledger selection, notification focus/Tab/Escape,
and navigation rejection during a deferred invitation write.

The persistent Chromium layout check passes **250 states in four contexts**
at desktop/tablet widths and live mobile **390/320px** and **412/360px** widths.
Its 314 interceptions include 215 synthetic API reads and four blocked external
font requests, with no request-guard violation or remote response. The workflow's
touch checks assert coarse-pointer media and touch capability before and after
captures. All **six original, unedited screenshots** were visually reviewed. WebKit and
Firefox were not run for this invitation change; these local browser fixtures
do not establish physical-device, actual OAuth or remote applicant-account
acceptance.

Detailed workflow, frozen artifact hashes, bounded traffic and earlier harness
diagnostics are recorded in
[local invitation acceptance](invite-approval-local-2026-10-09.json).
The Server companion records its separate schema and runtime verification.
[Preview release evidence](invite-approval-preview-release-2026-10-09.json)
records publication and the finite static homepage/asset readback separately;
static publication is not authenticated invitation-flow acceptance.

## Pending operation boundaries and member role locks (2026-10-09)

Project and Shared Pool expense writes now share a synchronous operation guard
with recurring schedule writes. Conflicting edit/remove/create, form fields,
cancel, refresh/pagination, filters, CSV and internal navigation/ledger switching
remain disabled and visibly muted until the write and any required refresh have
finished. Recurring responses remain authoritative; the existing queued refresh
is awaited without adding an unnecessary read after every schedule write.
Pure view tabs/disclosures, scrolling/copying, theme/language, external new-tab
links and pane resizing remain available. Ordinary read-only refreshes allow
navigation and filter refinement while blocking mutations based on stale data;
refresh can still cancel an outstanding read-only pagination request. Failed
writes preserve drafts and restore controls without automatic retries.

Projects and Categories use the same write/refresh boundary. API Keys also lock
the submitted name, scopes and restrictions; one-time token handling is retained.
Billing preserves its write-to-refresh lock and blocks Escape cancellation of
pending dialogs. Pricing pauses the month/year choice during checkout creation.
Settings tracks busy independently of installation ID, covering Connect/Add,
installation management, sign-out and subsequent required account reads.
Native disabled controls and disabled-link semantics share light/dark styling;
disabled links have no href and reject modifier, auxiliary and keyboard activation.

Members replaces the expanded row editor with the role-column native dropdown
and lock icon. Roles default to locked; unlock enables selection, selection saves
immediately and the completed member refresh locks it again. Failed saves retain
the unlocked draft for explicit retry. Owner/admin, revision and access guards
are preserved. Unlocking changes neither row height nor sibling geometry.
Invitation management remains hidden until the member load completes, including
initial reads, manual reloads and post-write reads; it stays hidden on roster
read failure. The member and invitation reads settle together before that rail
appears.

`npm run check` passes lint, **44 files / 783 tests**, and the preview-configured
build. Offline Worker configuration, Worker/script syntax, owned formatting,
whitespace and pinned Wrangler 4.136.3 preview packaging also pass. Deferred
integration tests separately verify pending writes and required reads, exact
draft preservation on failure, role-lock admission, scope/unmount cleanup,
stale-completion protection, modal Escape and safe browsing boundaries.

The persistent browser check passes **500 layout states in eight contexts** with
Chromium 143.0.7499.4 and Linux WebKit 26.0. Previously requested project-header,
financial-value/currency colors, category-pencil, expense action stacks and both
recurring side editors continue passing at desktop/tablet/phone widths, live
899/900px reflow and 260/520px pane limits.

A separate finite local interaction check passes **88 states in eight contexts**
across both engines at 1440px and 320px, light/dark and coarse-pointer profiles.
It verifies muted native fields/actions through ordinary write and refresh,
ordinary/recurring exclusion, retained browsing tabs, trusted native role changes
with exactly one autosave, stable member rows and synchronized invitation rails.
Its accepted run intercepts 336 requests: 100 synthetic GETs, 12 explicitly listed
in-memory PATCHes, 216 static requests and eight blocked fonts. Each context stays
below its 100-request cap (maximum 48); no API request continues to a real server,
no external delivery, violation or page error occurs, and all 46 built artifact
hashes plus the original GET-only fixture remain unchanged. Nine captures support
the stage evidence; Root reviewed member desktop/touch and pending-state captures.

These are local engine/emulation checks, not physical iOS/Android or live-account
acceptance. Chromium touch remains coarse=true/maxTouchPoints=1 around captures;
Linux WebKit reports its unmodified maxTouchPoints=0 with coarse media enabled.
Firefox remains unavailable under the previously recorded managed-runtime
uid-mapping/SWGL limitation; its workflow layout checks remain configured.

Source `29456ae` is published on GitHub main and deployed as Web preview version
`19ae73c0-364d-414f-906d-a91bb0d900e3`; deployment metadata confirms 100% traffic.
The publication used a fast-forward update with an expected-head lease, and the
complete remote Git tree matches the verified local source tree. One homepage
and three exact hashed-asset GETs all return 200. The noindex homepage references
`/assets/index-HqtUu9hl.js`; the requested `/assets/ledger-Dg8cmCDd.js`,
`/assets/members-BxUhIBHI.js` and `/assets/index-CiNwg8Wz.css` match the accepted
local build byte for byte. No redirects, retries, page JavaScript, business API,
Server/D1 or production operation occurred. This publication record is a
documentation-only follow-up and needs no additional deployment.

## Currency identity colors (2026-10-09)

The shared `CurrencyBadge` now gives USD, CNY, JPY, EUR, GBP, AUD, CAD, CHF,
HKD, KRW, SGD, NZD and INR stable, distinct identity colors. Unknown currency
codes retain a neutral gray label. Ordinary/recurring amounts, project totals,
report readouts and chart captions share the same explicit code attribute and
palette. ISO text, exact monetary precision, native copying, number emphasis
and badge geometry are preserved; currency is never inferred or normalized.
The palette uses traditional HSL/custom properties with explicit light/dark
colors, independent of the global action accent.

`npm run check` passes lint, **44 files / 742 tests**, and the preview-configured
build. Offline Worker configuration, Worker/script syntax, owned formatting,
whitespace and pinned Wrangler 4.136.3 preview packaging also pass.
The persistent browser check passes **500 states in eight contexts**, using
Chromium 143.0.7499.4 and Linux WebKit 26.0. Actual expense/recurring badges keep
their displayed currency identity; an isolated clone of a rendered badge probes
all 13 built-in colors and the neutral fallback in both themes. It requires
distinct color pairs and at least 4.5:1 text contrast, composes actual ancestor
backgrounds, then removes the probe and restores the theme without API traffic.
Both engines measure a minimum 5.18:1 in light mode and 6.73:1 in dark mode.

Four frozen-build captures cover five real synthetic currencies (USD/CNY/JPY/
EUR/GBP) in project ordinary/recurring rows, project totals, 320px Shared Pool
and WebKit dark chart captions/readouts. Exact amounts, color consistency and
badge/number boundaries pass; Root reviewed three of the captures. Three local
contexts made 148 interceptions: 29 synthetic GETs, 115 static requests and four
blocked fonts, at most 72/100 requests each, with no writes, external delivery,
violations or page errors. Chromium touch remains coarse=true/points=1 before
and after capture; all 46 built artifact hashes are stable.

These are local browser-engine and emulation checks, not physical-device or
live-account acceptance. Firefox remains unavailable under the previously
recorded managed-runtime uid-mapping/SWGL limitation; its CI checks stay enabled.

Source `a396e6e` was pushed to GitHub main and deployed as Web preview version
`7e1d76f6-8a15-473e-86e2-d0992a806912`; deployment metadata confirms 100% traffic.
One homepage and three exact hashed-asset GETs all returned 200. The noindex
homepage references `/assets/index-B0LMEhSI.js`; that entry,
`/assets/financial-value-Bbfxr_y0.js` and `/assets/index-CxZX2pQg.css` match the
accepted local build byte for byte. No redirects, retries, page JavaScript,
business API, Server/D1 or production operation occurred. The main Actions query
failed with an HTTP 401 credential error; remote CI success is not claimed.
This publication record changes documentation only and needs no extra deployment.

## Expense action stacks and category title rename (2026-10-09)

Ordinary project and Shared Pool expense rows now place the exact amount above
horizontal Edit/Remove actions, matching recurring records with a 12px gap.
Wide lists align the stack to the right; narrow lists place it below the record
description and align it to the start. Financial formatting, copying, equal
natural row sizing and removal confirmation remain unchanged.

Categories replace the right-hand Rename text action with an accessible pencil
beside the active category title. Clicking it edits the name in that title's
left-hand record area. Save/Cancel wrap naturally; input focus, Cancel/Escape
opener restoration and failed-save draft focus are retained. Pending saves lock
the controls, whitespace-only names are rejected and revision/color, access,
archived restrictions and the 80-character bound remain intact.

`npm run check` passes lint, **44 files / 742 tests**, and the preview-configured
build. Offline Worker configuration, Worker/script syntax, owned formatting,
whitespace and pinned Wrangler 4.136.3 preview packaging also pass.
The persistent layout check passes **500 states in eight contexts** using
Chromium 143.0.7499.4 and Linux WebKit 26.0. Project/shared expense checks require
amounts above non-overlapping horizontal actions across desktop/touch profiles,
260/520px rails, 899/900px reflow and 390→320/412→360 widths. Categories cover
long unspaced titles, adjacent pencils, 44px coarse targets, input/control bounds,
inline replacement, draft preservation, cancellation focus and archived records.
Local fixtures accept GETs only, cap each context at 100 requests and block
writes and external delivery.

Nine final viewport captures use the same frozen build: six category idle/edit
views across desktop, Chromium 320px touch and WebKit 320px dark, plus project
desktop, Shared Pool touch and WebKit dark expense action stacks. Three captures
were independently reviewed by Root. All six capture contexts are clean:
213 interceptions, 35 synthetic API GETs, 172 static requests and six blocked
fonts, at most 39/100 per context. Chromium touch remains coarse/points true/1
before and after captures. Linux WebKit reports coarse=true but raw
`maxTouchPoints=0`; both remain stable and two trusted pencil touchstart events
were recorded without changing navigator values. These are browser-engine and
emulation checks, not physical iOS/Android or live-account save acceptance.

Firefox remains unavailable in this managed runtime because of the previously
recorded uid-mapping/SWGL startup errors; no new local Firefox success is claimed.
Its checks remain configured in the existing three-engine CI.

Source `329c528` was pushed to GitHub main and deployed as Web preview version
`acdb83ff-0e7b-49ef-b034-0b873611a3e1`; the deployment list confirms 100% traffic.
One homepage and three exact hashed-asset GETs all returned 200. The homepage
retained noindex and references `/assets/index-pFJUia5q.js`; that entry script,
`/assets/ledger-BKHPT-Pc.js` and the changed ledger stylesheet
`/assets/ledger-CAs9ENqb.css` match the accepted local build byte for byte.
No redirects, retries, page JavaScript, business API, Server/D1 or production
operation occurred. The main Actions query was empty; remote CI success is not
claimed. This publication record changes documentation only and needs no
additional deployment.

## Expense presentation and recurring side editor (2026-10-09)

Project detail and Shared Pool now edit recurring schedules in a separate
`LedgerSplit` secondary panel, matching ordinary expense editing. The editor
stays outside the equal-row record grid; desktop pointer/keyboard resizing uses
the shared 260–520px bounds and narrow layouts place the form before records.
Independent ordinary/recurring panes can coexist. Drafts, start-date focus,
opener restoration, fixed targets, revisions and access isolation are retained.

Project detail groups repository status and safe development/product shortcuts
beneath its introduction in one wrapping metadata row. The original authorized
repository disclosure, native link selection and destinations remain intact.
Financial values now distinguish a small accent ISO currency label from the
dominant tabular number. Callers explicitly declare currency; the renderer keeps
the complete formatted text, precision and copying without monetary arithmetic.
The hierarchy references [Maybe's net-worth component](https://github.com/maybe-finance/maybe/blob/main/app/views/pages/dashboard/_net_worth_chart.html.erb)
and [Actual's amount columns](https://actualbudget.org/docs/tour/user-interface/)
while retaining Pullwise's original light/dark theme and square controls.

`npm run check` passes lint, **44 files / 740 tests**, and the preview-configured
build. Offline Worker configuration, Worker/script syntax, owned formatting,
whitespace and pinned Wrangler 4.136.3 preview packaging also pass.
The persistent layout check passes **452 states in eight contexts**, using
Chromium 143.0.7499.4 and Linux WebKit 26.0. Both project and shared targets cover
1440px desktop, Chinese touch landscape 1280, 390→320 and 412→360 widths,
260/520px mouse drags, keyboard adjustment, simultaneous editors, 899/900px live
reflow, natural equal rows, drafts and plan switching. Each field/amount/header
check keeps native date bounds, exact financial text, currency/number hierarchy,
safe shortcuts, wrapping and action separation. GET-only fixture guards retain
a 100-request per-context cap and block writes and external delivery.

Six final viewport captures cover Chinese desktop, simultaneous editors with a
520px recurring rail, 390/320px touch layouts, the complete long amount at 320px
and WebKit dark mode. Touch media/maxTouchPoints remain true/1 before and after
each touch capture. The dark currency label has 5.89:1 contrast and its primary
number 18.37:1. Visual fixtures made 27 synthetic API GETs across three contexts,
with no writes, external delivery or changes to the accepted build.

WebKit uses isolated runtime libraries; its supported host-validation skip only
avoids a system-library-cache false negative, after actual loading was verified.
Firefox could not start in this managed environment: read-only uid mapping and
SWGL framebuffer errors remain after dependencies/cache preparation. Its checks
remain configured in the existing three-engine CI; local Firefox success is not
claimed. Linux engines and emulated touch do not establish physical iOS/Android
or older Safari acceptance. Browser fixtures do not establish live-account saves.

Source `1dd1b30` was pushed to GitHub main and published to
`preview.pull-wise.com` as Web version `e8f22622-7aeb-450a-9929-46177bde8c4b`.
The finite static check made one homepage and three exact hashed-asset GETs;
all returned 200, the homepage retained noindex and referenced
`/assets/index-GiWMVkSt.js`, and the entry/ledger/CSS bytes matched the accepted
local build. No redirects, retries, page JavaScript, business API, Server/D1 or
production operation occurred. The post-push main Actions query was empty;
remote CI success is not claimed. This publication record changes documentation
only and requires no additional deployment.

## Safari date-field sizing and shared ledger picker (2026-10-08)

Shared date fields now fill shrinkable single-column field tracks with explicit
border-box bounds and normalized native date appearance. Filters, one-time
expense create/edit and recurring start/end fields retain their native picker,
date contracts and 16px column gaps. Narrow/coarse input text correctly uses
16px and touch controls retain a 44px minimum. A supplementary narrow API Keys
check found a real shared topbar overflow: the label/native ledger selector now
use an explicit horizontal grid, retain the arrow and ownership prefixes, and
allow the outer actions to wrap naturally. No API form-specific grid or global
overflow clipping was added.

[Local evidence](date-field-width-local-2026-10-08.json) records lint,
**43 files / 727 tests**, config/syntax, owned formatting, whitespace,
explicit preview build and pinned Wrangler packaging. The persistent
`npm run test:layout` check passes **228 states in eight contexts** across
Chromium 151 and Linux WebKit 26: desktop, Chinese touch landscape,
iPhone-sized 390→320 and Android-sized 412→360 widths. It checks empty/populated
dates, ordinary/recurring editors, actual mouse-driven 260/520px rails, sibling
boundaries/gaps, long ledger options and API name/scopes controls. A controlled
24px injected overflow is rejected and restored in every context.

Independent native WebKit acceptance passes three complete contexts and
47 states with six newly captured, Root-reviewed original viewport PNGs.
Desktop/live1180 and 260/356/520px panes, Chinese/dark 1280px landscape and
mobile390/live320 retain correct date boundaries and peer alignment. The 320px
Date/Amount capture sits below the measured sticky header/navigation. Members
role-editor open/cancel and API scopes provide supplementary shared-form smoke.
PNG hashes/dimensions and full before/after metadata match; all 46 artifact,
70 runtime source and three validation-source hashes remain stable. Accepted
native traffic is 168 interceptions / 89 synthetic GETs, at most57 of100 per
context; three font attempts are blocked, with no writes or external delivery.
Six earlier native attempts and two diagnostic contexts are retained separately
and excluded, including the real topbar failure repaired before this freeze.

Actual rendered border-box bounds and document/body overflow determine escape.
WebKit native options can report a larger internal ancestor scroll extent;
those raw values remain diagnostic and are not equated with visible overflow.
An initial stricter persistent assertion was corrected and excluded, followed
by complete passing runs of both engines. Date value changes are explicitly
programmatic; native trusted focus/picker affordance is recorded separately.
Linux WebKit and emulated touch do not establish actual iOS/Android device or
UIKit picker acceptance. Local Firefox launch was blocked before any page by
the managed sandbox/SWGL environment and is not counted as passed. CI is
configured to install and check all three engines on ordinary Ubuntu;
remote execution is unverified (runs query returned empty and Actions settings
read returned integration403). No repository settings were changed.

[Preview publication](date-field-width-preview-release-2026-10-08.json)
publishes source `5da9481` as version `43c5b8a6-b9e9-4ab6-8dbf-91edd9a0370e`
at 100% preview traffic. Management confirms the preview asset/Server bindings;
one homepage and three exact accepted hashed assets return200 and match,
with noindex HTML referencing `/assets/index-CHtFcbLY.js`. All local source,
artifact and persistent-validation hashes match the committed accepted freeze.
The post-push Actions run query is empty, so remote CI success is not claimed.
No business API, Server/D1 or production operation occurred. This publication
record needs no further build or deployment.

## Shared expense toolbar and chart-only Reports (2026-10-08)

Project expenses and shared pool now use one view toolbar for collapsible
date/category filters and scoped CSV export. Expenses starts directly with
records; Reports starts directly with the existing trend and category charts.
The user's final follow-up removes the standalone currency-total block from
both views, its unused summary request, oversized loading placeholders and
exclusive styles. One labeled field group retains active values across tabs,
can close with active filters and exposes count/clear controls. Project settings
hides the tools. Route, ledger, membership, authorization and permission changes
clear state and abort late responses; fixed expense/export targets remain intact.

[Local evidence](expense-toolbar-charts-local-2026-10-08.json) records lint,
**43 files / 727 tests**, configuration/syntax, owned formatting, whitespace,
explicit preview build and pinned Wrangler packaging. Native acceptance passes
three complete contexts and 57 states with six Root-reviewed original viewport
captures: English/light desktop, actual-touch Chinese/dark landscape and mobile
390px with live 320px. Default/active collapse, reopen, cross-tab retention,
Settings visibility, exact CSV scope and full USD/JPY/KWD chart point readouts
pass; no summary request occurs. PNG hashes/dimensions and raw before/after
metadata match. All 46 artifact / 70 runtime source hashes remain stable.
Traffic is 178 interceptions / 96 synthetic GETs, maximum 63 of 100 per context,
no writes or external delivery; three font attempts are blocked. Browsers and
profiles are cleaned and ports are free.

Dates are explicitly programmatic in the native harness; date payload/boundary
evidence primarily comes from unit tests. Other toolbar controls use trusted
native events. Local fixtures do not prove real-session/provider operations,
native CSV downloads or OS clipboard contents. The earlier passed design with
totals in Reports was superseded by the user's follow-up before any commit or
deployment; its six retained images contribute nothing to final acceptance.

[Preview publication](expense-toolbar-charts-preview-release-2026-10-08.json)
publishes source `aa56e8f` as version `fcc51071-03bb-432b-90e0-73f6ee126c36`
at 100% preview traffic. Management confirms the preview asset/Server bindings;
one homepage and three exact hashed asset GETs return 200, with noindex HTML
referencing `/assets/index-B3bUObTH.js`. All sampled assets and all local runtime
source/artifact hashes match the accepted freeze. No retry, redirect, credential,
page JavaScript, business API, Server deployment, D1 command or production
deployment is involved. Publication-record commits need no extra deployment.

## Projects product-only list (2026-10-08)

The latest user request replaces the earlier all-link list design. Projects
now align name/description, exact expense totals and one safe product shortcut.
Development, repository/Organization shortcuts and their expansion stay in
project detail/settings. Repository/access placeholders and the noninteractive
row arrow leave the list. Projects-only CSS removes row hairlines and permanent
name/link underlines, retaining one quiet table header boundary, natural equal
tracks, full values, hover insets, native text selection and keyboard focus.

The entire ledger overview, its loading skeleton, filter fields and specialized
CSS are removed. Initial load/reload and pagination read only Projects; local
search makes no request. Categories remain in their own page and detail entry,
while project/shared Reports and their existing filters continue to work.

[Local evidence](projects-product-only-local-2026-10-08.json) records lint,
**42 files / 703 tests**, config/syntax, owned formatting, whitespace, explicit
preview build and pinned Wrangler packaging. Native acceptance passes three
complete contexts and 52 states with four Root-reviewed unedited viewport
captures: English/light desktop, actual-touch Chinese/dark landscape and
mobile 390px with live 320px. Held initial loading, product-only safe anchors,
no overview requests, native name/money/input selection, focus/hover/equal
heights, retained detail links/settings and 280px creation split/Cancel pass.
All 46 artifact / 70 runtime source hashes remain stable. Accepted traffic is
145 interceptions / 60 synthetic GETs, maximum 53 of 100 per context, no writes
or external delivery; three font attempts are blocked. One initial harness
navigation deadlock is excluded: one interception and no fixture, state or
capture. Browsers/profiles are cleaned and ports are free. Local fixtures do
not prove real-session/provider operations or OS clipboard contents.

[Preview publication](projects-product-only-preview-release-2026-10-08.json)
publishes source `fa33dbd` as version `75750bd8-4fea-48b7-81be-c09049075885`
at 100% preview traffic. Management confirms the preview Server/asset bindings;
one homepage and three exact hashed asset GETs return 200 and match the accepted
build, with `/assets/index-Crt2hYic.js` referenced by noindex HTML. No credentials,
page JavaScript, business API, Server deployment, D1 command or production
deployment is involved. This release precedes the subsequently requested shared
expense toolbar redesign; receipt-only follow-ups need no extra publication.

## Project links and recurring expenses (2026-10-08)

Project creation/settings support optional product URLs and standalone
development URLs; list and detail shortcuts expose only currently authorized
GitHub repository/Organization metadata. External links remain separate from
the project entry, use safe HTTP(S) destinations and preserve native text
selection. Native dragging caught an internal-anchor selection regression;
the scoped data-link selection fix and two focused regressions pass.

The shared project/pool form creates one-time costs or weekly, monthly,
calendar-quarterly and yearly rules for its fixed page target, with IANA
timezone, original day anchor, inclusive start and optional end. A separate
equal-row list presents next dates, active/paused/blocked/completed states and
role-aware edit, pause/resume and cancellation. Completed rules can be canceled
without an edit/resume control. Cookie sessions manage background grants;
future planned costs enter reports only after actual Server generation.

[Local receipt](recurring-links-local-2026-10-08.json) records lint,
**42 files / 700 tests**, Worker config/syntax, owned-source formatting,
whitespace, explicit preview build and pinned packaging checks. Native browser
acceptance passes **3 complete contexts / 102 scenarios**, desktop English/light,
actual-touch Chinese/dark landscape and actual-touch mobile with live 320px.
Eight routes, fluid/live widths, safe URL attributes, native name/amount/input
selection, shared controls/dividers/reports, fixed-target frequencies and
edit/confirmation/cancel/viewer/workspace-reset states pass. Browser submits no
business mutation; payloads and real scheduled generation have separate unit
and native Server evidence. Traffic is 273 interceptions / 158 synthetic GETs,
maximum 97 of 120 per context, with no runtime errors, unknown routes or
external delivery. Three font attempts are intercepted and blocked.

Root views and verifies all **8 unique native unedited captures**: seven in
the accepted contexts and one retained from a separately recorded partial
context, using the same accepted artifact. PNG hashes, actual viewport sizes
and matching before/after scroll metadata pass. Two earlier failures, one
selection diagnostic and the partial context remain excluded from the three
complete contexts; no request or screenshot is double-counted. Initial failed
cross-target external-delivery observation is unavailable and remains null.
Owned browsers/profiles are cleaned and ports are free. Native selected strings
are not OS clipboard evidence; synthetic fixtures are not real-session or
provider acceptance. All 46 artifact / 66 runtime source hashes remain stable.

[Preview publication](recurring-links-preview-release-2026-10-08.json) publishes
Web source `6ae2a6284dc70edb58cce65809f9d010ef19b175` as version
`cd31aba4-195a-40e5-b2cc-3222bf6cea13` at `preview.pull-wise.com`, after Server
source `200a987955c1545f0542a4e30424967c85f70d66` is published and the original
preview database reaches schema7/storage1 with a healthy cumulative journal.
Management confirms the preview service/asset bindings and Server hourly cron.
Exactly one homepage and three exact asset GETs return 200; sampled assets
match the accepted build, HTML references `/assets/index-BeSRqE0G.js` and
retains noindex. No retry, redirect, credential, page JavaScript, provider test
or forced remote tick is involved. Production receives no deployment or D1
activation for this release. Receipt commits change documentation only.

## Equal records, contextual expense entry and visual Reports (2026-10-08)

Console record lists share naturally sized equal CSS grid tracks with compact,
centered contents. Headers, helpers and pagination remain outside record grids;
bounded project-option scrolling is on an outer wrapper. Wrapping, filtering,
pagination, inline editors and live widths retain equal outer heights and complete
selectable data. Decorative terminal borders are removed from parallel Reports
and before trailing Billing availability notes; genuine following sections,
stacked report boundaries and record/control separators remain.

Expense entry no longer asks Project or shared cost. New expenses use the current
project/shared page target; edits preserve their original target and revision.
Date receives initial focus, with draft, category, permission, identity and
idempotency guards retained. Project and shared-pool Reports share responsive
SVG date trends and category columns, exact persistent readouts and independent
currency scales. Calendar distance and BigInt arithmetic remain exact; no missing
date zeros or currency conversions are invented. Keyboard, pointer and touch
inspection preserve full labels and monetary values and Pullwise's original style.

Native testing exposed compatibility mouse-enter events replacing a touched
category. Removing the redundant point-level handler keeps inspection on real
non-touch pointer movement and explicit click/focus/keyboard actions. A focused
regression and the final native touch runs pass. Earlier positioning diagnostics
and pre-fix runs are recorded separately and contribute no final acceptance.

`npm run check` passes lint, **39 files / 554 tests** and build. Worker
configuration/syntax, source formatting/whitespace, independent source review
and Wrangler 4.136.3 preview packaging pass. The accepted preview entry is
`/assets/index-p1WJqR4M.js`; all **46 artifact / 25 source** hashes remain unchanged.

[Final local evidence](console-rows-charts-local-2026-10-08.json) passes **3
physical contexts / 217 scenarios / 8 native unedited viewport captures**, all
visually reviewed by Root: 1440px English/light desktop, actual-touch 900px
Chinese/dark landscape and actual-touch 390px English/light with live 320px.
Eight console routes, live 2560/1180px and 280px primary-pane resizing, equal
ordinary records, idle/hover/copy, form open/edit/draft/cancel, full graph values,
keyboard/hover/tap, irregular dates, independent currencies, zero/tiny/single
values, empty/503 reports and actual 647/648px boundaries pass. Accepted traffic
is **215 intercepted / 102 fixture GETs / 0 writes**, maximum 77 of 120 per
context. Unknown routes, runtime errors and real external calls are zero.
External fonts are blocked, so captures establish native fallback-font layout.
Copy evidence is the exact browser-selected string, not OS clipboard inspection;
submission payloads are unit evidence, while browsers never submit. Owned
browsers/CDP/Vite/profiles are cleaned and ports are free. Local fixtures do not
establish real-session, provider or payment acceptance.

[Preview publication](console-rows-charts-preview-release-2026-10-08.json)
publishes source `9dcd5dc0671f37360f1b6a657ee506a8695f1eed` as Web version
`5a37a81f-4d16-40d9-a352-2775709ac53c` at `preview.pull-wise.com`.
Management readback confirms preview bindings, SPA assets and HTML-first noindex
routing. Exactly one homepage and three exact hashed asset GETs return 200;
the sampled assets match the accepted build and HTML references its entry.
An offline CSS-chunk selector preflight made no requests. No redirects, retries,
page JavaScript, credentials or business API are used. Production and Server/D1
remain untouched. These evidence files are documentation-only and need no redeploy.

## Projects list information hierarchy (2026-10-08)

The approved newer ZIP informs `/projects` only. Pullwise keeps its original
palette, typography, hard edges, financial tokens and shared layout containers.
Rows now align project name/description, expense totals and repository/organization
metadata in three regions. A compact loaded-count/search toolbar replaces the
duplicate large list heading; repetitive generic icon frames are removed.
Queries use actual list/container width: below 760px each row follows project,
amounts and associations; below 420px the toolbar stacks. Complete currencies,
native text copying, authorized metadata, local search, explicit pagination and
shared hover/resize behavior are preserved. Other page and detail styles are
unchanged. Independent review caught and corrected a paragraph cascade before
freezing the accepted preview build.

`npm run check` passes lint, **38 files / 536 tests** and build. Worker
configuration/syntax, source formatting/whitespace and Wrangler 4.136.3 preview
packaging pass. The preview entry is `/assets/index-BMePTPOr.js`; all **45
artifact / 16 source** hashes remain unchanged after acceptance and publication.

[Local evidence](projects-register-local-2026-10-08.json) passes **3 physical
contexts / 55 targeted scenarios / 6 native unedited viewport captures**, all
reviewed by Root: 1440px English/light desktop, actual-touch 900px Chinese/dark
landscape, and actual-touch 390px English/light mobile with live 320px French.
Live 2560/1180px resizing, a 280px primary list, wide/narrow hover, native exact
name and huge USD/JPY selections without navigation, search clear, one explicit
pagination read, mouse/keyboard/touch dividers and one ordinary detail roundtrip
pass. Traffic is **110 intercepted / 28 local fixture GETs / 0 writes**, maximum
40 of 120 per context, with zero unknown routes, page errors or real external
calls. External font origins are blocked; captures therefore prove the native
fallback-font layout. Owned browsers/CDP/Vite/profiles are cleaned and ports are
free. These fixtures do not establish real-session or payment acceptance.

[Preview publication](projects-register-preview-release-2026-10-08.json)
publishes runtime `be413ef57d783f32c6b35630cb5de1afaa039a3b` as Web version
`f86b2c01-b149-486c-a658-dce04c6ee0ef` at `preview.pull-wise.com`.
Management readback confirms preview bindings, SPA assets and HTML-first
noindex routing. Exactly one homepage and three exact hashed asset GETs return
200; remote assets match the accepted build and HTML references its exact entry.
No retries, redirects, page JavaScript, credentials or business API are used.
Production and Server/D1 are untouched. This evidence follow-up is
documentation-only and requires no redeploy.

## Navigation grip fixed in the visible sidebar (2026-10-08)

The latest user instruction supersedes the earlier document-centered navigation
grip behavior. The shared left navigation separator now uses fixed positioning
from the measured workspace header to viewport bottom, with its existing grip
at 50% of that visible area. It stays at the same viewport midpoint while the
page or sidebar scrolls and tracks the navigation width on horizontal resize.
The secondary-pane grip still scrolls at its own divider midpoint. Shared
bounds, capture/cleanup, keyboard/ARIA, 44px hit area and mobile hiding remain.
No new ZIP reference styles or business behavior are part of this change.

`npm run check` passes lint, **38 files / 535 tests** and build. Worker
configuration/syntax, source formatting/whitespace, independent review and
Wrangler 4.136.3 Preview packaging pass. The Preview-specific build entry is
`/assets/index-DZtT8uc1.js`; all 45 artifact and 9 related source hashes are
unchanged after acceptance and publication.

[Local evidence](sidebar-fixed-midpoint-local-2026-10-08.json) passes **2 physical
contexts / 31 targeted scenarios / 4 native unedited captures**: 1440px
English/light desktop and actual-touch 900px Chinese/dark landscape. Eight
console routes each check top/middle/bottom document positions and trusted
pointer hits at top/middle/bottom of the left separator. The left grip remains
at the visible viewport midpoint; the right stays at its document midpoint.
Mouse/keyboard min/max, native touch cancellation, live 390px hiding and four
root-reviewed API/Members captures pass. Accepted traffic is **131 intercepted
requests / 56 local fixture GETs / 0 writes**, maximum 69 of 120 per context.
Unknown routes, page errors, real remote calls and excluded diagnostics are
zero. External origins are blocked. Owned browser/CDP/Vite/profile cleanup is
complete and ports are free; these fixtures do not establish real-session or
payment acceptance.

[Preview publication](sidebar-fixed-midpoint-preview-release-2026-10-08.json)
publishes runtime `238396b65827f5d4d62a99d192297aece3a6dd29` as Web version
`4a768a79-bef9-4aa8-aba3-4c934d7d6163` at `preview.pull-wise.com`.
Management readback preserves the Preview bindings, SPA assets and HTML-first
noindex routing. Exactly one homepage and three hashed asset GETs return 200;
shared CSS, Members JavaScript and Ledger CSS match the accepted local build,
and the homepage references its exact entry. No retries, redirects, page
JavaScript, credentials or business API are used. Production and Server/D1 are
untouched. These evidence files are documentation-only and need no redeploy.

## Integrated console clarity acceptance (2026-10-08)

The divider midpoint, text-selection, project-detail copy and terminal-border
changes below are integrated with the concurrent product-copy release. The
merge preserves the shared fluid containers, Members hierarchy/role editor,
project chooser, Ledger ownership labels, bottom-right tools, stable hover
insets, bounded resizing and financial typography from the earlier phases.

`npm run check` passes lint, **38 test files / 535 tests** and build. Worker
configuration/syntax, whitespace checks and Wrangler 4.136.3 preview packaging
pass. Independent merged-source review finds no blocker. The preview-specific
build uses entry `/assets/index-BOqOOvin.js`; all 45 artifact files and 30
runtime source hashes remain unchanged through final acceptance.

[Final merged browser evidence](console-clarity-merged-local-2026-10-08.json)
passes **4 physical contexts / 121 accepted states / 24 native unedited
captures**: desktop 1440px English/light, actual-touch 900px Chinese/dark,
public pages with a trusted native modal opener, and readonly project settings.
Live 390/320px layouts, all eight console routes, midpoint scroll geometry,
mouse/keyboard/touch cleanup, native text copying, loading/loaded copy and
terminal/genuine section boundaries pass. Four key root visual samples pass.

Accepted contexts record **234 intercepted requests / 108 local fixture GETs /
0 writes**, with maximum 87 of the 120 per-context cap. Unknown routes, runtime
errors and real remote calls are zero; external origins are blocked. One tablet
interceptor-cancellation diagnostic is excluded separately (44 partial states,
7 captures, 86 intercepted/44 GETs); the accepted desktop segment is counted
once. The final broker logs seven browser-canceled requests and ignores no
stale fulfillment IDs. A canonical filename-sort preflight created no browser
context or requests. These were harness corrections; runtime remained frozen.
Owned browser/CDP/Vite processes and profiles are cleaned, and ports are free.
Local fixtures do not establish real-session or payment acceptance. Publication
uses the exact accepted build and is documented separately; only the Web
preview is in scope, with production and Server/D1 untouched by this release.

[Preview publication](console-clarity-preview-release-2026-10-08.json) publishes
merged runtime `f80dc9e56a9154d6379de0cbe390bad76dfdfd55` as Web version
`979c05c6-1c61-4379-9687-beafd1d72b4c` at `preview.pull-wise.com`.
Management readback confirms the Preview service binding, vars, SPA assets and
HTML-first noindex routing. Exactly one homepage GET and three hashed asset
GETs return 200; shared CSS, Members JavaScript and Ledger CSS match the
accepted local build and HTML references its exact entry. No redirects, retries,
page JavaScript, remote business API or credentials are used. All 45 artifact
and 30 runtime source hashes remain unchanged. Production and Server/D1 remain
untouched by this Web-only release. Publication evidence is documentation-only
and requires no further deployment.

## Divider midpoints, text selection and project detail clarity — pre-merge (2026-10-08)

This local phase validated source `68d90fb8f6beebc4827378e56f1d6081c2979221`
before integrating the concurrent product-copy release below. Its artifacts
are historical evidence; the integrated release receives its own checks.

Both resize grips now inherit the shared absolute midpoint rule and scroll
with their own divider. The sidebar grip retains its matching 10px line offset;
the secondary divider continues to measure the two primary panels and excludes
account overview. This supersedes the earlier viewport-sticky grip behavior.
Pointer/keyboard capture, accessible values, width bounds and mobile hiding
remain unchanged.

Record data and prose remain selectable. The public-page audit removes broad
selection suppression from status details, legal update dates, landing examples,
404 requested paths and dialog titles/descriptions. Only navigation/action
regions suppress selection; input fields, ordinary links and informational tags
remain selectable. Existing native project-name copy protection and drag cleanup
remain in place.

Project detail initially uses Project expenses and Loading project expenses…;
a no-data failure explicitly says Unable to load project expenses. Successful
and retained refresh views keep the actual project name and the short Expenses
and reports for this project description. Unnamed project/picker fallbacks use
Project. All six languages are covered; historical lost-access guidance is intact.

Shared terminal panel rules omit closing borders when no subsequent visible
content exists. Hidden views and resize overlays are ignored; list-item borders
and genuine section boundaries remain. Mobile expense-entry order retains the
form-to-record divider and omits the records' closing border.

`npm run check` passes lint, **38 test files / 529 tests** and build. Worker
configuration/syntax, owned-source formatting/diff and Wrangler 4.136.3 preview
packaging checks pass. Flat locale catalogs/tests keep their established style.
The final preview build has 45 files and uses only preview URL/API/App settings.

[Built-browser acceptance](console-clarity-local-2026-10-08.json) passes **5
physical contributing contexts / 123 accepted states / 25 unedited captures**.
Desktop 1440px English/light, actual-touch 900px Chinese/dark, live 390/320px,
public pages, a trusted native modal opener and readonly project settings
cover midpoint scroll geometry, pointer/keyboard/touch cancellation, complete
native text copying without navigation/extra reads, controlled project loading,
and genuine/terminal borders across eight console routes. The public segment
accepts only its 18 successful selection states; an unrelated non-native-opener
focus assumption is excluded, and a trusted native supplement proves focus.

Accepted contexts record **257 intercepted requests / 110 fixture GETs / 0
mutations**; each stays below the 120-request cap (maximum 87). Seven wholly
excluded diagnostic contexts record 281 intercepted/83 GETs separately. Smooth
scroll measurement, decorative inline/text endpoints and icon separator spaces
required harness corrections only; runtime/artifacts never changed. Different
runs retain explicit provenance with each physical context counted once.
External origins are blocked. All 45 artifact and 11 runtime source hashes
remain stable. Independent source and root visual reviews pass, and owned
browser/CDP/Vite/profile cleanup is complete. These are synthetic local checks;
preview publication remains static-only, with production and Server/D1 untouched.

## Product copy, translations and subscription policies (2026-10-08)

Pullwise / pull-wise.com now consistently describes a project expense ledger
for developers and teams. The landing page, login, docs/API help, console copy,
pricing, metadata and social card explain named standalone projects, optional
GitHub repository links, shared-ledger access and separate currency totals.
Platform subscriptions remain separate from entered expenses. Plan capacities
are shared by the Owner's members/API keys; archived projects and removed
expenses still count. Jev assistance allowances have no cash/payment value.

Terms preserve the two previously reviewed Creem billing paragraphs in full.
One additional paragraph states that paid subscription fees are non-refundable
except where applicable law requires otherwise, and that cancelling renewal
keeps access until the paid period ends without refunding that period.
No refund request workflow or unimplemented refund endpoint is promised.
The operator is identified as Pullwise, without invented company or address
details. Billing explanations tie upgrades to verified payment confirmation.

Privacy now covers actual identity/token, ledger, subscription and membership
data, Cloudflare/GitHub/Creem/TypeSafe processing, Google Fonts requests,
browser storage, model inputs and soft-removal retention. Invitation access
includes all current/future ledger data, while personal billing stays separate.
Status labels report browser loading, API reachability and configuration flags;
they do not assert end-to-end payment, authorization or database availability.
All five non-English catalogs cover the current public/console descriptions
and policies, including previously untranslated interface text.

The final copy commit incorporates the latest main console/financial layout
updates rather than replacing them. `npm run check` passes lint, **38 test files
/ 535 tests** and the build. Worker configuration/syntax checks, whitespace
checks and pinned Wrangler 4.136.3 Preview packaging pass. The accepted build
uses the Preview app URL, same-origin API base and Preview GitHub App slug.

Built-browser acceptance passes **96 route/language/viewport cases**: eight
public routes in en/zh/ja/ko/fr/es at 1440px and 320px. Legal anchors,
translation fallback checks, document overflow and script errors pass. Touch
media/events are asserted and restored after Chromium screenshots. Twenty
English/Chinese captures include the home, privacy, terms, pricing and status
pages; sampled mobile terms/pricing and desktop privacy pass visual review.
All 45 built artifacts remain identical throughout acceptance. The 132 API
requests are intercepted local fixtures, with no mutations; font CSS uses an
empty local fixture, so these captures verify fallback-font layouts without
contacting Google. No remote business request or real payment is part of this
audit. Preview publication is recorded separately below.

[Preview publication](copy-audit-preview-release-2026-10-08.json) publishes Web
runtime commit `9e765d72a8b36aa353059ddd5a1177536aabeb6f` as version
`f31de511-c39b-48ef-8bff-6f21bdb57d67` at `preview.pull-wise.com`, alongside
Server source `9349b48eb043d9b0dc566cae15a63265b7db510f` as version
`ead2b046-b7df-4869-b8d3-c5dbb84e33f1`. Management readback confirms both at
100% traffic and preserves the Preview service binding, SPA assets, runtime
settings, database and budget namespace. The finite one-homepage/three-asset
static check returns 403; the asset bodies identify Cloudflare error 1010.
No redirect, retry, page JavaScript or business API is used. Remote asset
hashes and public-page acceptance are therefore not confirmed by this check.
Production activation and real payment acceptance remain outside this release.
The publication records are documentation-only and require no further deployment.

## Shared console interactions and financial hierarchy (2026-10-08)

The frontend goals are now recorded in `AGENTS.md`: simple layouts, prominent
priorities and clear, understandable actions. Console modules share
`ConsoleLayout`, creation/entry rails share `LedgerSplit`, and both dividers
use one `useResizablePane` lifecycle. Desktop/landscape layouts (>=900px)
support pointer and keyboard resizing, with 180–320px navigation and
260–520px secondary panes clamped to available space. Main/primary content
minima, identity/scope cleanup, draft retention, mobile stacking and accessible
separator values remain intact. Sticky grips and compact focus rings stay visible.

Flat records share stable 16px inline insets in normal/hover states; owners
set symmetric vertical density. Members uses a neutral aligned role editor.
Real data remains selectable while navigation/action chrome avoids accidental
selection. Explicit selectable record links and the shared navigation guard
allow native project-name copying without triggering a route; ordinary,
keyboard and modified activation remain available.

`FinancialValue` shares bold display/sans tabular typography across totals,
records, reports, plan prices and quota values. Primary totals use 32/28px,
records 22/20px, secondary amounts 18px and plan prices 40px. Counts use 16px.
Dates, IDs, plan names and cadence stay subordinate; empty/unavailable/missing
prices retain body text. Original BigInt arithmetic, complete monetary text,
currency exponents and source data stay unchanged. Grouping-comma soft breaks
preserve exact copying. Separate currencies, full-width narrow amounts and
three-row reports protect long values and actions.

`npm run check` passes lint, **38 test files / 529 tests** and the build.
Worker configuration/syntax, owned-source formatting/diff and Wrangler
4.136.3 preview packaging checks pass. Locale catalogs retain their established
flat-row style. A separate preview build uses the preview URL/API/App slug.

[Final built-browser evidence](console-layout-financial-local-2026-10-08.json)
passes **12 contexts / 190 state records / 52 captures**: 8 interaction
contexts plus 4 financial semantics contexts. Normal/hover/exit geometry,
mouse/touch capture, min/max and keyboard adjustments, live 900/2560/390px
reflow, shared sidebar preferences, drafts, native text copying and ordinary
click routing pass. Numeric checks cover precise above-safe USD/JPY/KWD totals,
zero, unavailable/empty/missing prices, report scales, 280px primary panes and
320/390px touch layouts. All 45 artifact files remain identical.

Accepted contexts use **465 locally intercepted requests / 122 fixture GETs /
0 mutations**, with a 120-request cap and a maximum of 48 per context.
External origins are blocked. Seven final diagnostic contexts are excluded
from accepted counts. Font Range metrics are retained separately from verified
Canvas ink boundaries; invisible font extents are not treated as painted text.
Native visibility excludes closed disclosure contents. Six final captures pass
independent root review. Browser/CDP/Vite/profile cleanup is complete.

The earlier layout phase passed 8 contexts/151 states before typography work,
with its complete-title copy supplement recorded separately. These checks use
synthetic local data; publication verification remains static-only. Production,
Server/D1, real sessions, payments and provider operations are outside this release.

[Preview publication](console-layout-financial-preview-release-2026-10-08.json)
deploys runtime commit `b07fde59ddc4dfde4621856d1e0f529aede2cae0` as Web version
`4e8bf287-3d8b-4063-b307-ab1a3c157cf1` at `preview.pull-wise.com`. The preview
Server binding, SPA assets and HTML-first noindex routing pass configuration
readback. Exactly one homepage GET and three hashed asset GETs return 200;
the shared CSS, Members JavaScript and Ledger stylesheet match the accepted
local build, and HTML references its exact entry. All 45 artifact files and
17 runtime source hashes remain unchanged. Production, Server/D1, real
sessions and remote business APIs remain untouched. This publication record
is documentation-only and requires no further Web deployment.

## Members directory and ledger ownership (2026-10-08)

Members now uses the existing `.ledger-split`: the member directory is the
primary area, while invitation creation and pending invitations share the
secondary management area. Read-only users see a full-width directory. The
outer container continues to inherit the same fluid `.main` as all other
authenticated screens; no separate page width or split breakpoint is added.

Member rows separate square local initials, name/GitHub identity, one current
role and concise Edit role/Remove actions. Desktop roles/actions align across
editable and protected rows; narrower list containers wrap these tracks.
Only explicit editing opens the inline role form. Editing and removal
confirmation are mutually exclusive, repeated Edit preserves the draft, and
cancel/save returns focus to the originating row. If a successful mutation's
follow-up read fails, focus falls back to the directory heading and the real
error requires manual recovery. Owner/Admin guards, original workspace IDs,
member revisions and stale-response isolation remain intact.

Pending invitations use the same identity layout with complete expiry and
permission-aware revoke actions. Invitation and acceptance warnings retain
all current/future ledger sharing details in every supported locale.
The topbar native Ledger selector prefixes real workspace names with
translated Your ledger/Shared ledger labels from the current actor's role.
Ownership remains visible before long names truncate, and switching continues
to use the original workspace ID without extra owner-identity reads.

`npm run check` passes lint, **36 test files / 499 tests** and the build.
Worker configuration/syntax checks, changed-file formatting and the Wrangler
4.136.3 preview packaging dry run pass. The separate preview build uses the
preview app URL, same-origin API base and preview GitHub App slug.

[Built-browser acceptance](members-redesign-local-2026-10-08.json) passes
**16 contexts / 86 measured states / 25 captures**, covering 900/960/1440/1920/
2560px desktop allocation, 320/390px English/Chinese touch layouts in both
themes, 320px French long labels and owner/admin/read-only permissions.
Native ledger option/selected-title ownership labels, one role per idle row,
protected-row alignment, edit/draft/cancel/save focus, removal confirmation,
loading/503/manual recovery, complete invitation metadata and created-link
controls pass. Nine purposefully sampled whole-page and whole-row captures
pass visual review. Exactly three role PATCHs and one invitation POST are
fully intercepted local synthetic operations, with no real member/invite
mutation or provider/session request. The 43-file artifact manifest remains
identical throughout acceptance.

The final capture environment consistently hides native scrollbars before
both baseline and capture while retaining functional scrolling and strict
viewport/scroll/coarse-pointer/touch equality. The original rejected screenshot attempt and two GET-only capture diagnostics
that failed when Chromium temporarily removed its 10px scrollbar gutter are
excluded from the accepted counts; they required no product source change.
All QA browser/CDP/Vite processes are cleaned.
These are local synthetic checks; preview publication verification remains
static-only and production/Server/D1 operations are outside this release.

[Preview publication](members-redesign-preview-release-2026-10-08.json)
deploys runtime commit `74d749517806de3cbc28191a46c534787a224b94` as Web version
`4b484a10-245a-44a2-a24b-a9851bec10c3` at `preview.pull-wise.com`. Configuration
readback confirms the preview Server binding, SPA assets and HTML-first
noindex routing. One homepage GET and three exact hashed asset GETs (shared
CSS, Members JavaScript and the shared Ledger stylesheet) return 200; all
three asset bodies match the accepted local build, and the homepage references
its exact entry. Production, Server/D1, real sessions and remote business APIs
remain untouched. Publication/evidence updates are documentation-only and do
not require another Web deployment.

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
Six settled GET-only mobile captures retain the complete chooser summary and
count below the sticky navigation; they supersede the original mobile shots.
The interrupted capture diagnostic is recorded separately from the 123 accepted
states, with no remote application request. All QA processes are cleaned.

[Preview publication](console-container-project-picker-preview-release-2026-10-08.json)
deploys runtime commit `b493260d40d24355779a9d04b92b0d0162ce874f` as Web version
`ac33e344-1d65-42b1-85ec-2ad34d7f44d4` at `preview.pull-wise.com`. Configuration
readback confirms the preview Server binding, SPA asset fallback and HTML-first
noindex routing. One homepage GET and three exact hashed asset GETs (shared
CSS, API Keys and Members JavaScript) return 200; all three asset bodies match
the accepted local build, and the homepage references its exact entry. No page
JavaScript, business API, real session, Server/D1 operation or production
deployment is part of this publication check.

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
