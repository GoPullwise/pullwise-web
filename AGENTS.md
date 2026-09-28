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
