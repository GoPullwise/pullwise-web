# Pullwise Web

## Safari date-field sizing (2026-10-08)

Fix overlapping filter dates and expense date inputs wider than sibling fields,
including one/two-column resizable entry panes and recurring start/end dates.
Keep native date inputs and picker behavior. Shared fields use shrinkable single
grid tracks; control widths include padding/borders, and date appearance must
not reintroduce WebKit intrinsic width. Preserve visible 16px field gaps, native
editing/selection, focus, date bounds, fixed expense targets and the original
theme. Touch controls use at least 44px height and 16px input text. Check analogous
date fields across project/shared views and recurring editors, then push main
and publish only Web preview. Report browser-engine/device evidence accurately.
The shared topbar ledger picker uses an explicit label/selector grid with a
shrinkable selector track. Preserve the native arrow, ownership prefixes and
horizontal label/selector layout; long option names must not create horizontal
overflow on short-breadcrumb pages. Check both long and short breadcrumbs at
mobile widths, including API Keys and its name/scopes form.
Run the persistent `npm run test:layout` browser geometry check after building;
CI exercises Chromium, WebKit and Firefox at desktop, tablet, iPhone-sized and
Android-sized widths with isolated local GET fixtures. A shared input/container
change must keep field boundary, gap and long-ledger picker checks passing.
Emulation and Linux browser engines do not establish actual iOS/Android device
acceptance.

## Shared expense toolbar (2026-10-08)

After publishing the simplified Projects list, redesign the large totals/filter
block in project expenses and shared pool with the same shared layout. Expenses
starts with records; Reports starts directly with trend and category charts.
The latest follow-up removes the standalone Totals by currency section from
Reports as well, including its unused summary request and exclusive styles.
Place Filters and CSV export beside the view tabs, with one compact
date/category field group expanded only on request. Active filters can stay
collapsed with a clear indicator; retain clear/reset and cross-tab values.
Hide tools in project settings and clear/abort on identity/workspace changes.
Preserve fixed project/shared/export targets, current permissions, before-date
semantics, full precise currencies, drafts and recurring rules. Remove the
oversized totals/filter loading skeleton. Keep the original theme and common
responsive containers, and publish only Web preview after checks.

## Projects list simplification (2026-10-08)

The latest user request supersedes the earlier all-link Projects list design.
The list shows project identity/description, exact per-currency expense totals
and only a product shortcut. Development, GitHub repository/Organization links
and expandable repository groups remain in project detail, with settings and
creation unchanged. Do not show repository access/count placeholders in the
list. Remove the entire Projects ledger overview, its loading skeleton, filters
and overview-only requests; retain project/shared Reports and the Server APIs.
Reduce Projects-only decorative lines and permanent link underlines. Use calm
equal-row spacing and aligned columns, retaining native data selection, clear
hover/focus, full values, responsive container reflow and the original theme.
Publish the Web change to GitHub main and Cloudflare preview only.

## Project links and recurring expenses (2026-10-08)

Implement optional development/product links in project settings and shortcuts
in the existing Projects layout. Linked GitHub destinations require per-item
authorized metadata; manual development URLs appear only for true not_linked
projects. Keep external anchors as siblings of internal project links, with
safe absolute HTTP(S) normalization and native link/copy behavior.

Project and shared-pool expense entry share one-time/recurring controls and keep
the page's fixed target. Recurring rules use an explicit category, IANA timezone,
start date and weekly/monthly/calendar-quarter/yearly selectors. Manage rules
separately from actual expenses; show server-provided next occurrences, editing,
pause/resume and cancel with the existing revision/permission guards. Preserve
ordinary expense editing/drafts and charts; future costs do not count as spent.
Keep all six locales, shared flat layouts, equal record rows and original theme.
The latest user authorizes the required Server/schema/hourly scheduling changes,
main pushes and deployment only to preview; production stays paused.

## Product UI goals

The user defines the frontend goals as: simple layouts, prominent priorities,
and clear, understandable actions (布局简洁、重点突出、操作清晰明了).
Use shared containers and interaction patterns across similar pages. Remove
unnecessary visual competition; emphasize important financial values while
keeping supporting labels readable. Give each area a clear purpose and make
the next action easy to recognize. These goals guide future frontend work,
including normal/hover states, responsive reflow and keyboard/touch behavior.

## Equal record rows and terminal dividers (2026-10-08)

Every record in the same console list has equal outer height. Shared natural
CSS grid tracks handle wrapping, filtering, pagination and inline editing;
avoid fixed pixel heights, clipping and JavaScript height measurement. Keep
headers, empty states, helpers and pagination outside record-only grids, and
put bounded scrolling on an outer wrapper so equal tracks retain natural
height. This applies to projects, members/invitations, categories, expenses,
keys, billing/GitHub records and selection lists. Each independent
list sizes to its own content; preserve complete text, money and hover insets.
Center each row's natural content group so surplus height surrounds it rather
than stretching internal track spacing.
Remove terminal decoration lines, including beneath parallel report panels
and before a trailing availability note. Keep genuine following sections,
stacked report boundaries, record separators and tab/control borders. Preserve
Pullwise's original visual style and publish Web preview only.

## Expense entry and visual reports follow-up (2026-10-08)

Project expense creation belongs to the current project; shared-pool creation
belongs to the shared pool. Remove the target chooser and its mutable state,
submit the explicit page target for new expenses and preserve the original
record target on edits. Open entry with Date focused, retain draft/category,
permission, identity, idempotency and revision guards.
Project and shared-pool Reports share real responsive charts rather than row
lists: a chronological expense trend and category columns with an inspectable
exact amount. Keep currencies on independent scales and all arithmetic in
BigInt until the bounded visual ratio; do not convert currencies, invent
missing-day zeros or turn unavailable values into zero. Mouse, keyboard and
touch must reveal complete data in a persistent readout. Preserve report error,
empty, filter and export behavior, Pullwise tokens and flat sections. The newer
ZIP may inform report hierarchy only; do not import income/profit features or
its theme. These charts replace the earlier report-row equal-height rule.
Inspect hover through non-touch pointer movement only; compatibility mouse
enter events after a touch tap must never replace the tapped value.

## Projects reference follow-up (2026-10-08)

The newer DevLedger ZIP is a layout reference for `/projects` only. Keep
Pullwise's existing palette, typography, hard edges, financial hierarchy and
shared containers. Organize project identity/description, expense totals and
repository/organization metadata into aligned regions, with quiet column
labels and a compact count/search toolbar. Remove repetitive project icon
frames and the duplicate large list title. Reflow by actual list-container
width to identity, amounts and associations in that order; retain full
multi-currency values, native copying, stable hover insets and row navigation.
Repository/organization labels use current authorized metadata, with real
binding counts and existing access-state guidance. This reference work does
not extend to project detail or other pages, global themes or business APIs.

## Financial typography follow-up (2026-10-08)

Real financial values share `FinancialValue` and the `base.css` value-size
tokens: bold display/sans tabular figures, with primary totals, row amounts,
secondary subtotals and plan prices sized by context. Keep labels quiet and
numeric counts distinct from their descriptions. Dates, IDs, plan names,
cadences, missing prices and unavailable/empty states retain body typography.
The renderer accepts already formatted text and explicit validity; it never
changes monetary arithmetic, precision, currency or source data. Soft breaks
after grouping commas preserve exact textContent and native copying. Show
each project currency independently, keep full amounts in narrow panes and
reflow labels, amounts, charts and actions by actual container width.
Focus indicators belong to divider grips. The navigation divider stays fixed
below the measured workspace header; its grip is centered in that visible
area and does not move on document scroll. Secondary-pane grips stay at the
midpoint of their own divider and scroll with it. Retain the shared hit area,
bounds and keyboard behavior.

## Console layout follow-up (2026-10-08)

Flat console records share stable 16px inline insets in `base.css`, including
Projects, members/invitations, categories, expenses, keys, billing records and
GitHub installations. Row owners set block density only; first rows retain
their full vertical inset. Hover changes background only and excludes loading
skeletons. Members role editors use a compact neutral nested control group,
with aligned fields/actions and container-based mobile wrapping.
All console screens use `ConsoleLayout`; its navigation width is shared within
the signed-in tab, defaults to 220px, ranges from 180 to 320px and preserves at
least 660px for main content. All creation/entry splits use `LedgerSplit`; the
secondary width ranges from 260 to 520px while reserving a 280px primary pane
and the shared 48px gap. Both dividers use `useResizablePane` for pointer,
keyboard, bounds and cleanup, and appear only at viewport widths >=900px.
Clamp to actual available width, cancel captures on scope/layout changes and
retain the existing mobile navigation/stacking rules. Sidebar preferences
reset with identity, while ledger split drafts remain local to their scope.
Record names, descriptions, accounts, amounts, dates, key prefixes/scopes and
ordinary links remain selectable. Navigation/actions/drag handles prevent
accidental selection; drag suppression is temporary and released on every
completion/cancellation path. Do not disable selection on complete data rows,
informational tags or dynamic page headings.
Keep public status details, legal update dates, requested 404 paths, preview
examples and dialog titles/descriptions selectable too. Apply non-selection
to their navigation/action elements rather than whole mixed-content regions.
Section hairlines separate following content. Terminal panels omit their bottom
border across shared containers, ignoring hidden views and resize overlays.
Keep list-item and genuine section boundaries; mobile expense-entry order
places the form first, so the last records panel has no closing line.
Project detail uses Project expenses while its name is unavailable, explicit
loading/failure guidance, and the real name after loading. Its short description
explains expenses/reports; nameless projects use Project rather than history.

Projects search uses one square accent focus perimeter around the icon, input
and clear action. The topbar Ledger label and picker stay side by side, with
long ledger names constrained inside the native selector. Prefix each option
with the translated Your ledger/Shared ledger label from its actual workspace
role, so ownership stays visible before long names truncate. Keep the real
workspace ID as the option value and avoid extra owner-identity queries.
Language, theme and
back-to-top controls stay at the bottom right on all pages; reserve content
clearance below console modules and bound the language menu above its opener.
Members uses the shared `.ledger-split`: the member roster is primary, and
invitation creation/pending invitations share the secondary management area.
Read-only views keep the roster full-width. Member rows show local square
initials, name/login, a single current role and explicit Edit role/Remove
actions. Show the role form only on editing intent; do not repeat the role
badge alongside an idle selector and disabled Save button. Editing and removal
confirmation are mutually exclusive. Restore the row action's focus after
cancel/save, including after row reload, and reflow by actual list width.
Preserve hard edges, permission checks and identity/revision isolation.
All authenticated console modules use the shared `.main` content container.
`base.css` owns its full available width, gutters and bottom clearance; there
is no per-page width opt-in or `.wide` modifier. Settings, Members, Ledger,
API Keys and Billing inherit that same rule, including loading/error states.
Verify live resizing beyond 1440px rather than checking only one desktop
viewport; keep bounded individual inputs and readable prose.
API key project restrictions select project names from the current ledger's
authorized, paginated project list rather than requiring copied project IDs.
Reuse native disclosures, shared inputs and selection rows; keep searches local
and load additional pages on explicit intent. Submit the selected real IDs,
preserve the explicit empty-list/no-project semantics and independent shared
pool permission, and isolate reads/selections across workspace/access changes.
The current release is Web-only: push main and publish preview.pull-wise.com.
Production deployment and Server/D1 operations are outside this task.

## Standalone projects follow-up (2026-10-07)

Project creation defaults to a name and optional description, with GitHub
repository/Organization association optional. Do not enumerate repositories
until explicit association intent or require GitHub candidates for a blank
project. Standalone projects use real null GitHub anchors, empty repository
arrays and `githubAccess=not_linked`; they keep ordinary ledger expense/report,
role/key/CAS and plan behavior. Preserve linked-project GitHub access checks and
historical data, responsive layout, identity/workspace draft isolation and
explicit association changes. Push all related changes to main and publish
preview after local Server/schema/Web verification; production D1 stays paused.

## Layout follow-up authority (2026-10-07)

The user requests a more spacious Projects console and analogous fixes across
the other console modules, followed by main push and Cloudflare preview
publication. Keep controls and content from overlapping. When available module
width shrinks, forms, records, navigation and charts must reflow, wrap or use
appropriate text ellipsis rather than squeeze into unreadable columns. Preserve
complete financial amounts and dates. This frontend scope does not require
Server publication or D1 writes; browser checks use local intercepted fixtures
and preview publication uses the finite static-only check below.

## Latest follow-up authority (2026-10-06)

The user requests full Projects and two-real-account (DFerryman/SanChai20)
preview acceptance, subscription success/failure checks without real payment,
repairs, main pushes and preview publication. Current Server preview product
operation policy removes lifetime test request/read/write ceilings while keeping
the existing journal, accounting, bounded operations and commercial/role guards.
Historical numeric lifetime test ceilings below must not be reintroduced for
ordinary preview traffic. Production D1 stays paused and provider credentials
or real payment facts are never synthesized for remote acceptance. Distinguish
local/native fixtures from actual logged-in preview user/browser evidence.

The latest cost target is at most USD 200/month across Cloudflare services,
using reasonable implementation and abuse rate limits rather than a hard
monthly/day cutoff. Avoid automatic API polling and high-frequency remote
tests; allow ordinary use within the account and commercial plan limits.
The user explicitly approved the temporary memory-only, 30-minute preview
session handoff for these two accounts after each account confirms consent.

## Current task authority (2026-10-06)

Latest scope: the multi-repository/Organization/shared-ledger version is
implemented, verified and released to preview with its own dated evidence. Use
`../pullwise-server/docs/planning/project-repositories.md` for current roles,
invitation, workspace and repository rules. Preserve role checks on Server,
workspace/revision isolation in Web, actual-actor GitHub authorization and the
warning that invitations share all current and future ledger data. Historical
original-version acceptance does not establish this version's release. Keep
remote verification preview-only and production D1 paused.

The user explicitly authorized the resumed Server/Web audit, repairs, local
verification, main pushes, Cloudflare publication and finite preview user/model
acceptance. This supersedes historical blanket test/Wrangler pauses below.
Preserve the Server's existing preview journal, cumulative 100,000-read /
1,000-written-row ceilings, environment isolation and no reset/retry/cron policy.
Production database activation and authenticated/provider acceptance remain
separate gates; local mocks and static publication do not establish them.
Use `docs/validation/local-acceptance.md` for current release evidence.
The user's later 2026-10-06 scope is preview-only testing/verification. Do not
continue production repair, activation, deployment or validation for this task.

## Product and contract

Use `main` for all work unless the user explicitly requests another branch.
Select preview/production using the matching deployment config and bindings.

The current product is Pullwise, a project expense ledger for developers and
teams at pull-wise.com, described in
`../pullwise-server/docs/design/github-project-ledger/README.md`. Server owns
authorization, money, aggregates and platform payment facts. Web and external
clients share `../pullwise-server/openapi/ledger-v1.yaml`; use `src/api/ledger.js`
for ledger resources and `src/api/pullwise.js` for account/payment operations.
GitHub sign-in remains required; named standalone projects do not require
repository links or GitHub App installation. Optional GitHub associations may
include up to 30 repositories and an Organization. Shared-pool expenses count
once in the selected ledger and are not allocated to projects. Keep totals
separate by currency without conversion, and separate recorded expenses from
the owner's platform subscription and payment history. Use the public slogan
"Track project and shared expenses. Keep every cost in view."

## Runtime

- Clear repository options when `authorizationRevision` changes, and resolve
  the selected repository against the current available list before submitting.
- `src/main.jsx` is the only browser entry. Cloudflare `worker-entry.js` and
  `worker.js` serve assets/SEO and proxy API traffic; there is no Pages function
  or prototype review entry. Preserve credential headers, OAuth redirects,
  Set-Cookie, request bytes and streaming responses at the proxy boundary.
- Bind `PULLWISE_SERVER` to pullwise-server-production/preview for the matching
  Web environment. A same-zone fetch cannot target a zone-route Worker and can
  hit its DNS origin (521). Service-binding failures never retry public origins.
  Keep API origin for target URL construction and direct/external client routing.
- The browser ledger path `/api/v1/*` behind base `/api` becomes
  `/api/api/v1/*`; the Web Worker strips exactly the outer prefix. Vite matches
  that rewrite. Never put GitHub, Creem or Jev secrets into browser variables.
- Keep synchronous in-flight guards for writes and abortable read lifecycles.
  Clear protected data when identity, route, filters or authorization change;
  stale responses must not restore another account's state. Unknown/error data
  is not a successful zero or empty list. Session redirects update history
  and rendered screen together.
- Project selection pages authorized repositories independently. Stop cursor
  loops with recoverable guidance. Preserve lost-access historical expenses.
- Expense creation uses fresh Idempotency-Key; changes/removal use If-Match.
  Conflicts require explicit reload. Reports/list/export share filters; totals
  stay per currency. Parse aggregate amountMinor (safe number or decimal integer
  string) with BigInt and form chart ratios only after exact integer arithmetic.
  Report outages cannot erase loaded expenses or imply successful zero totals.
  Report bars use a separate exact maximum for each currency and explain that
  scale; never compare USD/JPY/KRW minor units on one shared numeric scale.
  Label retained filter results as Updating results and mark their regions
  aria-busy while refreshing; preserve open drafts. Native controls ignore
  focus while disabled, so focus category fallbacks after the write settles
  and the control renders enabled. Keep category help outside the input grid
  so adjacent field heights remain aligned.
- Billing shows subscriptions and payment history separately from expenses.
  Preserve checkout, upgrade, cancellation, resume, trusted redirects and
  webhook-driven entitlement. Do not display retired processing usage or
  invent unconfigured prices/allowances. Mutation completion after unmount
  must not navigate or update state. Keep one-time tokens tied to their key.
- Prices and subscription actions use the exact configured month/year price;
  never infer a missing annual product, invent fallback paid prices, coerce
  null amounts to zero, or hardcode annual savings. Checkout success returns
  to Billing. A pending upgrade preserves the current plan and offers manual
  refresh until the signed payment update confirms it; never optimistically
  grant Max or automatically repeat a potentially charged change. Resume
  scheduled renewal before upgrading. Trust only exact Creem checkout hosts,
  including test-checkout.creem.io for preview.

## Visual and localization rules

- Projects distinguishes authorized repositories from explicitly created
  expense projects. Await popup authorization and reload repositories; catch
  cancellations as action errors. Open a successfully created project only
  while the originating view is still current. Never auto-create on a GET.
- Project detail keeps a clickable Projects parent breadcrumb and visible
  Back to projects header link, including loading/error states. Use shared
  `screenLinkProps` so `/projects` navigation works with SPA history, keyboard
  activation and normal modified-link clicks rather than browser-back guesses.
- The empty-state Add project action opens/focuses the project-name field.
  Load repository candidates only after explicit optional-association intent;
  the chooser may load its next page or start guarded GitHub access on user
  action. Native `showPicker` is optional; keep the focused
  chooser usable when unsupported/restricted. Popup completion verifies access
  via Server's read-only `/repositories/sync` before reloading candidates.
- A failed spending summary must not hide otherwise loaded project/repository
  controls or render successful zero totals. Distinguish missing repositories
  from repositories that already have projects; preserve independent cursors.
- A repository provider/config failure must retain successfully authorized
  project history and hide creation candidates; Pullwise 401/403 stays fatal.
  `reauthorization_required` offers explicit guarded `startGitHubLogin`, without
  sign-out or automatic OAuth/reload. Manual repository recovery fetches only
  repositories and ignores aborted/obsolete responses. `unavailable` grants
  never claim revocation or permit new expenses; historical edits stay usable.
- Use `public/brand-mark.png` for inline brand images; the ICO is for browser
  favicons. The PNG preserves the existing mark and decodes in inline images.
- Ledger onboarding copy explains the next action with concrete expense
  examples. Keep project/add-repository controls ahead of spending reports,
  shared expense entry ahead of charts, and translated optional field labels.
- Preserve the hard-edged design, square overlays, restrained monochrome
  palette, indigo accent, `--fs-*` typography and `--cat-*` chart tokens.
  Keep explicit CJK font fallbacks and accent foreground `--accent-fg`.
  Change accent and foreground together for each theme, and measure contrast
  on the actual page/control background before changing muted text tokens.
- Hard edge is owned by the global reset (`border-radius: 0` on `*`) and no
  shadows exist anywhere: do not add `border-radius`/`box-shadow`
  declarations or radius/shadow tokens. Only the z tokens in `base.css` are
  live; add a new one only with a real consumer.
- `base.css` owns shared components: `.btn`, `.card`, `.tag`, `.notice`
  (accent-railed inline message; `.notice-guide` for the soft-accent icon
  guide, `.notice-grid` for suggestion stacks), `.panel` (the only
  page-section container on authenticated pages: flat, hairline-separated,
  with `.panel-h` heading rows; boxes stay reserved for overlays, notices
  and nested control groups) and `.empty` (shared dashed empty state). Do
  not add per-screen section/message/empty classes; extend these instead.
  Ledger split layouts share `.ledger-split`: primary list left, secondary
  creation/entry panel right, on Projects, Categories and the Shared
  Pool/project detail pages. On small screens, `.ledger-entry` places the
  explicitly opened expense form before the records. Detail totals remain
  per currency; filters use a native disclosure alongside CSV export.
  Use `.panel-actions` for wrapping parallel actions and `.notice-error` for
  recoverable errors, preserving the public frame gutters on Pricing.
- Docs use shared `.docs-h2` headings with anchor IDs on the headings; keep
  mobile section links visible in wrapped rows. API key creation follows name,
  scopes, targets, then submit; target inputs use the shared `.auth-input`.
  Unknown/loading GitHub access in Settings must not show disconnected-account
  guidance or a successful repository count. Keep profile data and manual retry.
- The shared Sidebar separates Ledger from Account & tools. Mobile shows
  the three Ledger links and a native account/tools selector; keep every
  destination reachable without a horizontally scrolled navigation rail.
  Let long localized Ledger labels wrap and move the account selector to a
  second row when needed; do not truncate the three primary destinations.
- Project detail uses the shared `ViewTabs` for Expenses, Reports and Project
  settings; Shared Pool has Expenses and Reports. Tabs are local views, use
  arrow/Home/End keyboard activation, and never trigger API refreshes. Keep
  inactive panels mounted and hidden so drafts survive tab switches. Continue
  draft returns to the existing form without replacing historical edit state.
  Tabs shrink and wrap long labels inside their available width rather than
  hiding the last view in a horizontal scroll area.
  Preserve their `min-content` width on touch devices; horizontal padding and
  the mobile gutter provide hit area without clipping short localized words.
- Projects searches only loaded names/descriptions; keep pagination available
  for no matches. Existing Projects reveal the creation rail on explicit Add
  project intent and restore opener focus on dismissal. The first-project
  flow shows project-name entry with three concise setup steps and an optional
  repository-association disclosure.
  Selected ledger overview is a native disclosure, expanded on summary errors/filters.
  Project rows adapt to the actual list container width: place totals below
  the name when that container is at most 560px, including desktop creation
  rails, so amounts cannot squeeze names into single-character lines.
- Shared Pool/project detail show records first; open the Add/Edit expense
  rail only on explicit intent. Keep required fields visible, optional
  quantity/unit/note in the shared `.disclosure`, and existing optional values
  expanded when editing. Focus the entry control on open and restore the
  opener after cancel/save; clear entry state when route/project/access scope
  changes. Lost GitHub access still permits historical edits with archived
  categories, but never enables new expense entry.
  Category rename focuses its input on open and returns focus to the same
  row's Rename action after cancel/save. Clear its editor and focus refs when
  route/project/access scope changes.
- Keep creation rails hairline-separated on desktop and stacked on mobile.
  Selected ledger overview leads with totals before its filters. Project descriptions
  live in the Project settings tab; creation descriptions remain optional
  native disclosures. `base.css` owns `.view-tabs` and the hidden-panel rule.
- Shared panel headings and panel bodies use 16px content gaps. Ledger forms
  use 16px field gaps and fit their columns to the available module width;
  desktop split columns use 48px gutters with a 32px secondary-panel inset.
  Ledger section starts use 32px, reducing to 24px on small screens. Projects
  search has 16px before the separate project-list divider.
  Keep the Projects list heading at the same height when its creation rail
  opens; expense entry adds its section gap on the split container. Category
  creation uses `.ledger-form` so the field and primary button share an edge.
  On mobile, keep Categories' reload beside its title, preserve the entry-first
  section spacing, and size sidebar links by their labels rather than equal
  columns so the Shared Pool label remains readable at 320px.
- Use `.ledger-help` for the no-active-category guidance in Shared Pool and
  project detail so Manage categories keeps a 16px gap before empty states
  or expense records, including when its inline button wraps on narrow screens.
- Keep select and controlled textarea labels separate with `htmlFor`/`id`:
  wrapping these controls can make their labels include option/current values.
- Loading skeletons use the same `.panel` sections as loaded content
  (Ledger included); the removed `.bill-card` family must not remain in
  loading-only branches. API key skeletons retain target and key-list sections.
- `app.css` is the last cascade layer, not a patch layer. To change an
  existing rule, edit the owning file (`base.css`/`screens.css`) in place;
  never re-declare the same property downstream. Keep `app.css` for
  app-shell patches, landing and overlays.
- Keep prose and record data selectable, including ordinary links, tags and
  dynamic page headings. `user-select: none` applies to navigation/action
  chrome, buttons, button links and drag handles; avoid disabling whole data
  rows. Project links permit native text selection without starting link drag.
- Public pages share the 1240px frame, 40px desktop and 16px small-screen
  gutters. Preserve existing 760/761 and 899/900 breakpoint pairs and CSS
  source order (`base.css`, `screens.css`, `app.css`); do not impose new layers.
- Modals trap focus, close on Escape, restore their opener and inert the
  background. Use the shared scrim rgba(8, 12, 20, 0.52). Floating controls stay
  below modal backdrops. Small-screen notifications sit above the pickers;
  coarse-pointer targets are at least 44px. Verify 390px document overflow.
  Language/theme/back-to-top controls occupy the bottom right on public and
  authenticated pages. Keep their dropdown above the opener and bounded by
  viewport height; reserve bottom content clearance so floating controls do
  not obscure the final fields or record actions.
  Restore modal focus after all cleanups release the background's inert state.
  Route focus waits for lazy headings; identity-only workspace remounts preserve
  a language/theme control that the user is already operating.
- `i18n.jsx` lazy-loads shared locale catalogs and `ledger*.js`. Keep only copy
  used by current pages. Dynamic rules cover current interpolated phrases.
  Provider/user text is displayed verbatim; preserve English fallback for it.
- Public product/pricing/docs/legal/status pages are indexable; login,
  authenticated and unknown routes emit noindex without canonical/JSON-LD.
  Keep proxy/static SEO behavior and deterministic social-card generation.

## Verification and deployment

- Run `npm run check` (lint, all tests, build) and `npm run check:workers`
  (offline configuration check). Preserve payment/security regressions while
  replacing obsolete fixtures. Tests must use the current ledger contract.
- Use a free, strict Vite port for browser checks; synthetic loopback data is
  local UI evidence, not real OAuth/payment/Cloudflare acceptance.
  For static built-artifact captures, disable the inherited development proxy
  in a temporary preview config and intercept APIs locally: its `/api` prefix
  also matches the `/api-keys` document route and otherwise sends it to 8080.
  Finish builds before browser capture runs; rebuilding replaces `dist` and
  can cause transient navigation failures during a concurrent screenshot run.
  Assert coarse-pointer media and `navigator.maxTouchPoints` for every mobile
  case, including after screenshots: the installed Chrome capture command
  clears touch emulation. Keep coarse media stable during the capture and
  restore touch events before continuing interactions; viewport width alone
  does not prove a touch layout.
- All Wrangler/workerd/D1 commands remain paused until explicit user
  authorization. Never enable cron triggers. Remote validation needs reviewed
  row/operation bounds, frequency, pagination/cache policy and cost guard.
  A frontend deployment approval does not authorize Server/D1 operations.
  When D1 access is excluded, publish only the Web Worker/assets and verify
  each environment with one homepage GET and three exact hashed asset GETs.
  Do not execute page JavaScript, follow redirects, retry, or call business
  APIs during this static check. Worker deployment OAuth needs account/user
  read, Workers/script/routes write and zone read; D1 write is unnecessary.
- Follow the workspace `D1 Rows Written budget guard` for S17/S18: cap browser
  requests/retries and include upstream Server write effects in the finite
  validation budget. No automatic polling, refresh loops or remote load tests.
  A preview database still consumes usage; numeric ceilings and enforceable
  caps require review before an authorized one-off remote run.
- The independent Server Worker handles api.pull-wise.com via an exact zone
  route; Web invokes it with the matching service binding. Server returns
  D1_ACCESS_PAUSED while providers, migrations and bounded admission/accounting
  are pending. Do not treat that response as an empty/successful ledger or
  enable remote access merely to make a browser test pass.
- Server's preview budget coordinator uses one persistent namespace/name
  across all requests/phases/databases. Its remote case list is empty until
  numeric SQL bounds pass. A local measured fixture is not permission to
  enable browser OAuth, payments or ledger requests against remote D1.
- Preview config targets pullwise-web-preview / preview.pull-wise.com and
  proxies only preview-api.pull-wise.com. Keep production config separate.
  Preview must bind ASSETS and run Worker first on ["/*", "!/assets/*"] so
  HTML receives X-Robots-Tag noindex and hashed static assets bypass the Worker.
  API-only Worker-first routing bypasses HTML middleware and is rejected by
  the config guard. The repair was deployed on 2026-09-29 and a finite homepage
  check confirmed the noindex header.
- Preview Server's product-wide mode was explicitly authorized and deployed
  on 2026-09-29. Product paths now use serialized per-SQL reservations in the
  fixed budget journal; 1,000 written / 10,000 read hard ceilings remain.
  Do not confuse an enabled path with completed real login/payment acceptance;
  a budget stop must stay an error and never trigger automated retries/resets.
- Pricing displays Server-provided allowances/Max Jev budget. Eligibility is
  separate from availability. Max assistance runs in normal expense saves,
  without a model trigger button, draft request or polling. New forms fetch
  /me once with an abortable lifecycle; only eligible/available Max creates
  offer automatic category omission, while edits require explicit categories.
  CATEGORY_REQUIRED preserves the draft, focuses the category and requires
  manual selection. Render that notice only inside the form; other action
  failures retain the shared action notice. Changes get a fresh idempotency key. Post-save automatic
  classification, duplicate and mismatched-target advice is nonblocking;
  never change the explicit target or money. Public API examples preserve
  Web's outer /api prefix plus Server's /api/v1 path and shell-expand key vars.
  Annual pricing never changes the monthly Jev budget or enables rollover.
  Privacy describes model input as submitted purpose/note, allowed active
  category IDs and names, and fixed project/shared/uncertain target-choice
  labels. Duplicate comparison is local Server logic; historical expense
  text, repository code and stored credential tokens are not model inputs.
- Web `wrangler.jsonc` targets production domains. Preview routing/config,
  Server domain, Cookie SameSite/domain and provider callbacks require review
  before any deployment. Local checks are not publication approval.
- `docs/validation/local-acceptance.md` is the current verification record.
  Keep durable source/tests/contracts/docs; exclude generated output, logs,
  screenshots and caches. Do not restore deleted prototype or old product code.

## CodeGraph indexing

The installed CodeGraph scanner uses Git visibility and .gitignore rules.
Keep current source, tests and schema/contracts available; exclude dependency
folders, generated mirrors, build/cache output, local tools and data backups.
The workspace .gitignore protects whole-workspace scans; each repository
keeps its own rules because Git boundaries do not inherit workspace rules.
After changing exclusions, force-reindex an already initialized project to
remove previously indexed paths; do not initialize another project implicitly.
