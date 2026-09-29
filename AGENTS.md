# Pullwise Web

## Product and contract

The current product is the GitHub project expense ledger in
`../pullwise-server/docs/design/github-project-ledger/README.md`. Server owns
authorization, money, aggregates and platform payment facts. Web and external
clients share `../pullwise-server/openapi/ledger-v1.yaml`; use `src/api/ledger.js`
for ledger resources and `src/api/pullwise.js` for account/payment operations.

## Runtime

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
  stay per currency. Suggestions only populate drafts after user confirmation.
- Billing shows subscriptions and payment history separately from expenses.
  Preserve checkout, upgrade, cancellation, resume, trusted redirects and
  webhook-driven entitlement. Do not display retired processing usage or
  invent unconfigured prices/allowances. Mutation completion after unmount
  must not navigate or update state. Keep one-time tokens tied to their key.

## Visual and localization rules

- Preserve the hard-edged design, square overlays, restrained monochrome
  palette, indigo accent, `--fs-*` typography and `--cat-*` chart tokens.
  Keep explicit CJK font fallbacks and accent foreground `--accent-fg`.
- Public pages share the 1240px frame, 40px desktop and 16px small-screen
  gutters. Preserve existing 760/761 and 899/900 breakpoint pairs and CSS
  source order (`base.css`, `screens.css`, `app.css`); do not impose new layers.
- Modals trap focus, close on Escape, restore their opener and inert the
  background. Use the shared scrim rgba(8, 12, 20, 0.52). Floating controls stay
  below modal backdrops. Small-screen notifications sit above the pickers;
  coarse-pointer targets are at least 44px. Verify 390px document overflow.
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
- All Wrangler/workerd/D1 commands remain paused until explicit user
  authorization. Never enable cron triggers. Remote validation needs reviewed
  row/operation bounds, frequency, pagination/cache policy and cost guard.
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
  separate from availability. An explicit suggestion click checks /me once;
  abort on draft change/unmount and never poll or dispatch after a stale check.
  Annual pricing never changes the monthly Jev budget or enables rollover.
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
