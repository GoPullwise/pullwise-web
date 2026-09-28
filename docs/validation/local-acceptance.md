# Current local acceptance

Updated 2026-09-28. Companion: [Server acceptance](../../../pullwise-server/docs/validation/local-acceptance.md).

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
