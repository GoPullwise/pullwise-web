# S17 — Web local integration and acceptance boundary

Status: **local Web checks complete; S17 runtime acceptance remains open** on 2026-09-28. Companion: [Server S17 handoff](../../../pullwise-server/docs/handoffs/S17-local-integration.md). S18 preview is deferred.

## Contract, UI and proxy checks

- The Web API docs now list the same 21 method/path operations as Server `openapi/ledger-v1.yaml`, including the suggestion decision route. `src/api/ledger.js` sends one `/api/v1` prefix; `worker.js` removes the outer Web `/api` prefix. Local tests cover Bearer forwarding, Cookie/OAuth callback headers, spoofed forwarding headers and CSV response streaming with a mocked upstream.
- Project, shared-pool, category, report and suggestion UI tests cover saved revisions, create idempotency, removal confirmation, shared/project separation, date/category filters, and manual entry after suggestion failure. A new test failed for a later authorized repository page; the project selector now loads more repository pages and the test passes.
- `src/locales/ledger*.js` covers the current guide, API/key, legal and expense-page English source phrases in Chinese, Japanese, Korean, French and Spanish. Locale tests failed on the former long-copy fallback, then passed. Provider-supplied and user-entered text is shown verbatim.

## Local commands and results

- `npm run check`: ESLint, **268 tests** and production build passed.
- `npm run check:workers` and `git diff --check`: passed.
- Server counterpart: **139 passed** synthetic tests, Worker package import/static config checks, placeholder deploy guards. CI status was unavailable locally (`gh` absent).

## Open acceptance and next machine

No browser against a real Server Worker, real workerd, Cloudflare preview or deployment was run. The Web CSV stream test verifies forwarding only; Server Python-to-`ReadableStream` FFI is unverified. OAuth Cookie domain/SameSite behavior and real Creem/GitHub provider flows require preview acceptance after S17 runtime checks. The existing `wrangler.jsonc` targets the production Web domains; review a preview route/config before S18 rather than publishing this file to preview unchanged.

The developer deferred S18 until preview domains, a D1 ID and Wrangler credentials are provided. Also review GitHub OAuth/App callbacks, Creem test products/secrets, migration and rollback. Keep `deploy:workers` unrun until that review. Continue with the [Server S17 handoff](../../../pullwise-server/docs/handoffs/S17-local-integration.md) and the design's S18 gate.
