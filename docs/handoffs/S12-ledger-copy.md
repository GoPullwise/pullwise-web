# S12 — Ledger documentation, billing and public copy

Status: Partially complete. Continued into S13–S16 under the developer's explicit instruction to work through S18.

## Implemented

`src/screens/docs.jsx` and `api-docs.jsx` explain ledger targets, scopes, filters, Idempotency-Key and If-Match. `api.jsx` uses the Server's nine ledger scopes and separate project/shared restrictions. `billing.jsx` distinguishes platform subscription charges from recorded expenses; privacy/terms, landing and SEO copy describe the ledger. API and page tests were updated.

## Local evidence and gap

`npm run check` passed after the S12 copy changes (371 tests, 2 skipped, build). The later S16 cleanup also passed (266 tests, build). A lazy ledger locale overlay now translates core navigation, filters, actions, marketing, API and legal summaries in Chinese, Japanese, Korean, French and Spanish. Longer new legal and documentation paragraphs still fall back to English in those four languages. Full S12 multilingual acceptance is open. No Cloudflare remote test ran; CI could not be read locally.

## Next entry

Complete the remaining long-form locale strings and verify public/docs/legal/billing/API key pages in all six languages before S17. Keep platform subscription data and ledger entries visibly separate.
