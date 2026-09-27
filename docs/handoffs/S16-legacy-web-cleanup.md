# S16 — Retire PR/CI/Updates Web views

Status: Local route and client cleanup complete; S12 locale gap and S15 Server cleanup still block S17 acceptance.

`src/App.jsx`, `src/lib/navigation.js`, `src/shell.jsx`, public navigation, settings and error recovery now point to ledger projects/shared pool. `/dashboard/overview`, `/repos` and `/services` resolve to 404. Removed old Dashboard, product management, item detail, PR/CI/Updates client, CSS and their obsolete tests/fixtures. Renamed API scope catalog to `ledger-api-scopes.js`; `README.md` and API key copy describe the ledger. Preserved GitHub authorization flow through `/projects?repoAuth=1` and surfaced authorization errors on the project page.

`npm run check` passed lint, 266 tests and the production build after cleanup. The full local check was run again after S17 export-link work. No Web Cloudflare deployment or remote test ran; CI status unavailable locally. Older generated locale catalogs still contain dead old-product strings and many new ja/ko/fr/es strings fall back to English; remove/replace them as part of S12 completion.

Next: finish S12 locale copy and S15 Server removal, then S17 cross-project contract and proxy checks with linked handoffs.
