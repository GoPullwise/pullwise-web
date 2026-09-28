# Current local acceptance

Updated 2026-09-28. Companion: [Server acceptance](../../../pullwise-server/docs/validation/local-acceptance.md).

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

**S17 real runtime integration remains open; S18 remote acceptance is deferred.**
The Python CSV generator/ReadableStream bridge, D1 runtime semantics, Cookie
domain/SameSite and real OAuth/App/Creem flows remain unverified. All
Wrangler/workerd/D1 commands are paused until explicit authorization; none
were run. Review a separate Web preview configuration, Server domain,
callbacks, Secrets, migration/rollback and D1 cost bounds before remote work.
Local checks and generated assets are not deployment approval. Jev stays off.
