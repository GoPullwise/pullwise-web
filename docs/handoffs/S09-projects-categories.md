# S09 — Ledger projects and categories UI

Status: Local implementation complete; continued to S10 by the developer's explicit instruction.

## Implemented

- `src/screens/ledger.jsx` and `ledger.css` add `/projects`, `/projects/:id`, and `/categories` with repository selection, project description edit, category create/rename/archive, and a lost-access history state. `src/lib/navigation.js`, `src/App.jsx`, and `src/shell.jsx` mount the routes and navigation.
- The page uses `src/api/ledger.js`, aborts stale protected reads, clears data on route/account changes, and keeps the hard-edged layout. A lost GitHub repository shows no protected name but leaves historical ledger navigation available.
- `src/screens/ledger.test.jsx` tests project creation/lost access, description revision save, and category flows.

## Verification and limitations

- Focused Vitest tests, ESLint, the full Web check (lint, 372 tests at that point, build), and `check:workers` passed locally. A loopback synthetic API plus headless Chrome showed `/projects`, `/projects/prj_1`, and `/categories` at 390px with document `scrollWidth=clientWidth=390` and no page errors. Final check after S10 includes the added tests. No Cloudflare or real GitHub browser flow was run. CI status was unavailable because `gh` is absent.
- The old PR/CI/Updates screens remain in navigation until S16. Repository option pagination for large accounts remains for S17.

## Next entry

S10: add expense forms and lists for project/shared targets, exact decimal/date inputs, revision conflict handling, confirmation before removal, and error/empty states.
