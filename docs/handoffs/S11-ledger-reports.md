# S11 — Ledger reports and filters

Status: local implementation complete. The developer requested continuous work through S18, so development proceeds to S12.

## Changes and contract

- `src/screens/ledger.jsx` and `ledger.css`: date range (inclusive `from`, exclusive `to`) and category filters feed the expense list, its later pages, currency summary, time series, and category chart with the same query. The projects page shows account, project, and shared totals separately for each currency. Chart labels come from saved category and date buckets; totals come from Server minor units.
- `src/screens/ledger.test.jsx`: confirms identical detail/chart filters and separate currency totals.
- Filter refresh retains controls while requests are in flight; scope changes clear protected prior data. Requests are abortable.

## Local checks

- `npx vitest run src/screens/ledger.test.jsx`: 7 passed.
- `npm run check`: 377 passed, 2 skipped; build passed. Its lint warning about hook dependencies was then fixed by memoizing queries. No Cloudflare/GitHub/Creem remote test was run.

## Risks and next entry

- Chart bars are relative within each response; no currency conversion or account wide sum is inferred. Browser visual check at 390px remains for S17.
- S12: update API key guidance, distinguish platform billing from user expenses, and replace marketing, legal, and translated product copy.
