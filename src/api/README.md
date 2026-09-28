# Browser API boundary

`ledger.js` implements the shared Server ledger REST contract for projects,
categories, project/shared expenses, per-currency reports, CSV exports and
optional suggestions. `pullwise.js` implements sessions, GitHub authorization,
settings, API-key management, subscriptions and public health reads.

`http.js` joins each route to the configured base. With browser base `/api`,
ledger `/api/v1/*` becomes `/api/api/v1/*`; `worker.js` strips exactly the outer
prefix. Server ownership and key restrictions remain authoritative. GitHub,
Creem and Jev secrets never belong in this client. Reads and manual GitHub
access refresh do not invoke suggestions or save expenses.
