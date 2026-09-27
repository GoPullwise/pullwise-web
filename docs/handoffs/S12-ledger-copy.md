# S12 — Ledger documentation, billing and multilingual copy

Status: **local copy and locale implementation complete** on 2026-09-28. Real browser and deployment acceptance remains outside this stage.

## Changes and contract

`src/screens/docs.jsx` and `api-docs.jsx` explain ledger targets, scopes, filters, `Idempotency-Key` and `If-Match`. `api.jsx` uses the Server's nine ledger scopes and separate project/shared restrictions. Billing distinguishes Pullwise platform charges from user-recorded expenses; landing, SEO, privacy and terms describe the ledger. The current English source phrases are translated for Chinese, Japanese, Korean, French and Spanish in `src/locales/ledger*.js`, including long guide/legal paragraphs, API endpoint and error descriptions, key-management copy and expense-page labels. Dynamic email contact phrases are localized without translating the address. The old split locale catalogs still contain inactive historic keys; those are not used by current ledger pages.

## Local evidence

The new `src/locales.test.js` long-copy cases failed in all five translated locales before the additions, then passed. After all copy changes, `npm run check` passed ESLint, **268 tests** and production build; `npm run check:workers` passed. Existing docs/legal/API page tests passed. No real browser, Cloudflare or live payment test was run. CI status was unavailable locally.

## Remaining and next entry

Some server-generated data (for example plan descriptions or error messages) is displayed verbatim and may remain English; the UI must not pretend to translate arbitrary provider or user content. Move to S17 local contract/permission/accounting/payment/deployment checks. Preview domain, D1 ID and Wrangler credentials are absent; S18 remote acceptance is deferred.
