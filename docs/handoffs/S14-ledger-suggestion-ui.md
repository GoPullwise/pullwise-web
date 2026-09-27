# S14 — Suggestion review in expense form

Status: Local UI complete; continued to S15 by the developer's explicit S18 instruction.

`src/screens/ledger.jsx`, `ledger.css`, `src/api/ledger.js` and `ledger.test.jsx` add an optional suggestion request, category/target/duplicate review, explicit application to the draft and decision feedback. Suggestions never call expense creation. Provider failure leaves the manual draft intact. Later work includes amount/date/currency context for duplicate hints.

Targeted `npx vitest run src/screens/ledger.test.jsx` passed 8 tests. The full Web check passed after S16 cleanup (266 tests and build). No real Jev or Cloudflare test ran. The S12 locale gap also affects this UI. Next: S15 Server cleanup, then S16 Web cleanup; S17 must test the suggestion-disabled path across the proxy.
