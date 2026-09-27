# S10 — Project and shared expense flows

Status: Local implementation complete. The next planned phase is S11.

## Implemented

- `src/screens/ledger.jsx` and `ledger.css` add `/shared` and project expense list/create/edit/remove. Forms capture the business date and decimal amount as strings, select category and target, and support project/shared moves. Shared costs are entered once in the shared pool.
- A synchronous in-flight lock prevents duplicate writes. A create draft retains its idempotency key for an unchanged retry; edits/removal use the current revision. Removal requires explicit confirmation. A 412 conflict keeps the draft and asks for reload. Loading, error, no-category, no-project, lost-access, and empty-expense states are explicit.
- `src/screens/ledger.test.jsx` tests shared expense edit/removal confirmation, empty-state creation/conflict, project description, and category management. The UI uses only REST-returned totals.

## Verification and limitations

- Focused Vitest tests passed. A loopback synthetic API plus headless Chrome showed `/shared` and project detail at 390px with document `scrollWidth=clientWidth=390` and no page errors. The final `npm run check` and `check:workers` results are recorded in the concluding response. No real Cloudflare, D1, GitHub, or Creem flow was run; CI status could not be read because `gh` is absent.
- The existing PR/CI/Updates screens and copy remain until S15–S16. Large-account project selection remains for S17.

## Next entry

S11: connect date/category filters and Server reports to project/shared charts and the per-currency account overview, keeping list and chart filters identical.
