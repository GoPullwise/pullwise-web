# Pullwise Web

Pullwise is a project expense ledger for developers and teams at [pull-wise.com](https://pull-wise.com). Pullwise Web is its browser client; the current [product design](../pullwise-server/docs/design/github-project-ledger/README.md) describes the shared Web/Server contract. Members sign in with GitHub, create named projects, record project or shared expenses, manage categories, and review per-currency reports in the selected ledger. GitHub repository links are optional. API keys and platform subscription billing are separate from user-entered expenses.

**Track project and shared expenses. Keep every cost in view.**

The shared pool records costs used across projects once in the selected ledger; it does not allocate or copy them into individual projects. Each currency is totaled separately, without currency conversion. Expenses are entered by users, authenticated API clients or configured recurring rules; linking a repository does not import bills or move money.

As of 2026-10-06, the new workspace/team and multi-repository version is implemented, verified and released to preview. Its separate local native/UI evidence and actual remote publication checks are in the latest acceptance record; the original release history remains separately dated.

## Workspaces and projects

An existing owner's ledger becomes a workspace identified by that owner's ID; personal ownership remains an implicit Owner. The header picker switches between the personal ledger and ledgers joined by invitation. Protected views clear their data, drafts and one-time credentials when the workspace or access scope changes, abort obsolete reads and ignore late results.

Members supports invitation links, applications, original-inviter approval, role changes, removal and invitation revocation. Applicants sign in with their own account; access starts after approval. Owner manages Admins; Admin manages Editors and Viewers. Editors record expenses; Viewers can read reports and export CSV. Invitation creation and acceptance warn that membership shares all current and future ledger data. Membership does not grant GitHub access. Team usage pools the owner's ledger quotas, plan and model allowance; billing stays with the owner, and each member's personal ledger remains separate.

Create a standalone project with a name and optional description; no GitHub App installation or repository authorization is needed for its expense entries. Optionally link 1–30 distinct stable GitHub repository IDs and a GitHub Organization. The chooser uses the acting member's current GitHub authorization, filters by the selected organization and revalidates selections after access changes. Project settings can add, change or remove these associations while preserving the project ID and expense history. A new expense in a linked project requires at least one linked repository authorized for the acting member; unavailable protected repository metadata stays hidden while permitted financial history remains accessible. Removing all repository links requires a nonempty project name and clears the Organization association.

When an expiring GitHub authorization has a saved refresh token, repository and
project reads renew it automatically and retry the read once. Concurrent reads
share one renewal for the signed-in account, and account changes cancel obsolete
results. Financial history remains visible during temporary provider failures.
Legacy accounts need one explicit **Reconnect GitHub** to store the previously
missing refresh token; revoked or expired refresh credentials still require
reconnection. This does not extend the separate Pullwise login session.

The Cloudflare static-asset Worker in `worker-entry.js` proxies `/api/*` to the Server Worker and streams its response body. The browser API helper uses `/api/v1/*` behind the configurable base URL; on the production domain the base URL is `/api`, so the proxy receives `/api/api/v1/*` and strips the first `/api`.

## Shared REST API and capacity

Browser sessions and external Bearer keys use the same ledger REST resources,
DTOs, permissions, revision checks and business validation. This covers project
management, project/shared-pool expenses and recurring rules, categories,
reports/export, activity and member governance. Keys add explicit scopes and
optional project restrictions. Member governance requires whole-ledger keys;
invitation applications use the applicant's independent account session.

The [API guide](https://preview.pull-wise.com/developers/api) includes a runnable
first-expense example, full update/concurrency examples and the complete endpoint
reference. `scripts/sync-api-contract.py` generates the reference and downloadable
OpenAPI JSON from Server's `openapi/ledger-v1.yaml`; run it with `--check` after
contract changes to detect stale copies.

Default limits are Free **3 projects / 100 expense records**, Pro **20 / 20,000**,
and Max **100 / 100,000**. Billing renders the Server's configured limits and
personal-ledger used/remaining counts as accessible charts for every plan.
Project/shared-pool expenses and generated recurring occurrences use the owner's
record allowance. Expense capacity counts current undeleted entries in shared
pool and projects that have not been removed, including archived projects.
Removing an expense or its project frees expense slots. Project capacity still
counts archived and removed projects.
Billing does not switch to a joined team's allowance with the ledger picker.

Global Settings has an **automatically remove oldest expense at capacity** switch
for every plan, default Off, without additional charges. Off blocks full-capacity
creates; On atomically removes the oldest retained entry and adds the new one.
Oldest means expense date, then creation time and ID. The Owner's setting applies
to that ledger's members, API keys and recurring rules. Switching it removes
nothing immediately. An already-over-limit ledger needs manual cleanup first;
automatic replacement removes at most one entry per successful create. A key
that cannot remove the actual oldest entry cannot replace another one instead.
Failed creates and idempotent replays remove no additional records. Removed
expenses leave lists/reports/export and cannot be restored; authorized recent
activity and internal immutable audit/replay records remain.

## Project links and recurring expenses

Implemented and published to `preview.pull-wise.com` on 2026-10-08; both Web and
Server changes are on GitHub main. See the current acceptance for separate
local/native and actual publication evidence.

Project settings and creation accept optional product links and, for standalone
projects, development links. The Projects list provides product shortcuts;
development links and each acting member's authorized GitHub repository/Organization
destinations remain in project detail. The list uses aligned project information,
expense totals and product entry points without an account-wide overview or
expandable repository groups. Domains and store links use validated
HTTP(S) URLs; a bare domain is normalized to HTTPS. Financial data and link text
remain selectable, while ordinary controls keep their shared interaction style.

Project expenses and the shared pool use one compact view toolbar for date/category
filters and CSV export. Expenses focuses on records; Reports starts with trend
and category charts, without a separate currency-total block. Filter fields expand
when requested and retain their values across the two views, with a clear/reset
action.

The project/shared-pool expense form can create a one-time expense or a weekly,
monthly, calendar-quarterly or yearly rule for that page's fixed target. Rules
store an IANA timezone, start date, optional end date and original day anchor.
Short months clamp to their last day without changing later months' anchors.
The separate recurring list shows the next date and supports editing,
pause/resume and permanent cancellation according to ledger permissions.
Resume skips paused periods. Planned costs remain outside reports until the
Server atomically generates an actual expense. Sessions and authorized Bearer
keys can manage rules. A key-created rule retains an internal credential hash;
each occurrence rechecks the key, membership, scopes and target permission.
Revocation or expiry blocks execution until an authorized edit or resume grants
current authority. Tokens and internal grants never appear in public rule DTOs.

The Server checks due rules hourly in preview, with current membership, GitHub
target access, category and owner quota checks, bounded catch-up and permanent
period identity to prevent duplicate charges. The
[feature contract](../pullwise-server/docs/planning/recurring-expenses-project-links.md)
and current acceptance distinguish local/native tests from actual publication.
Production D1 remains paused and has no recurring trigger.

## Local development

```bash
npm ci
npm run dev
```

The development server runs at `http://localhost:5173`. Set `VITE_API_BASE_URL=/api` when proxying to a local Server Worker configured in `vite.config.js`. Set `VITE_GITHUB_APP_SLUG` only for the public GitHub installation link. Browser environment variables must never contain GitHub, Creem, or Jev secrets.

`npm run check` runs lint, Vitest, and the production build. `npm run check:workers` checks the Worker configuration without publishing. `npm run deploy:workers` publishes and must be used only after the Server preview configuration and S17 local checks pass.

`npm run test:layout` checks the built app in Chromium, WebKit and Firefox with
local read-only fixtures at desktop, tablet, iPhone-sized and Android-sized
widths. It verifies input boundaries and gaps across filter dates, expense
entry/editing and recurring start/end dates, including resized split panes.
It also checks the shared ledger picker with long option names and the API key
name/scopes form, including narrow mobile widths.
CI installs all three engines and runs this check after the build. For local
setup, run `PLAYWRIGHT_BROWSERS_PATH=node_modules/.cache/ms-playwright npx playwright install --with-deps chromium firefox webkit`; use
`npm run test:layout -- --browser=webkit` to inspect one engine. Layout changes
must pass these checks as well as the unit suite. Emulation is separate from
real iOS/Android device verification.

`npm run test:mobile-layout` checks the phone bottom navigation, native More
selector, form sizing, footer hit targets, display options and scroll/focus-locked
modals in Chromium and WebKit. It covers phone, tablet, desktop and short-screen
profiles with bounded local GET fixtures. Add `-- --screenshots` for optional
captures in the sibling `work/mobile-redesign-validation/captures` directory.
Linux WebKit touch-point limitations are reported without modifying navigator;
smaller viewport checks do not emulate a native keyboard. CI keeps unit-test
environment defaults separate from the API-prefixed browser build.

The production build explicitly targets Chrome/Edge 111+, Firefox 114+ and
Safari/iOS/iPadOS 16.4+. Android browsers must provide a compatible current
browser engine; old WebViews and embedded browsers are not automatically covered.
These build targets define syntax compatibility, not physical-device acceptance.
Keep them explicit when updating Vite, and validate Safari and Android keyboard,
download, authorization and background-return flows on actual devices.

## Cloudflare configuration

`wrangler.jsonc` currently maps `pull-wise.com` and `www.pull-wise.com` to the Web Worker and sends API traffic to `https://api.pull-wise.com`. Coordinate the Server custom domain, OAuth callback, Cookie domain/SameSite, and allowed origins before preview or production deployment. Do not put secrets in `wrangler.jsonc`.

Both configurations bind `ASSETS` and run the Worker first for HTML/API paths while serving `/assets/*` directly. This lets production apply route-specific SEO, private-page noindex and the `www` canonical redirect; production mode keeps public pages indexable. Preview mode adds a site-wide noindex header. The offline config guard checks both modes and routing shapes. This production-ready configuration does not activate or migrate the Server database.

See [local acceptance](docs/validation/local-acceptance.md) for current verification, published versions and remaining authenticated/provider gates. The resumed audit and publication were explicitly authorized on 2026-10-06. Preview uses its separate configuration and the Server's persistent validation journal; production database activation requires its own migration and provider checks.
