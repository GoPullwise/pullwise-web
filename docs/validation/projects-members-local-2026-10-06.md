# Projects and invitation recovery: local acceptance

Updated 2026-10-06. This record covers local Web repairs and actual Chromium
execution of built assets with synthetic fixtures. It does not establish
authenticated Preview, two real GitHub accounts, real repository grants or
payment-provider acceptance. Those require separate remote evidence.

## Repairs

- Project settings now expose the existing Server `active`/`archived` lifecycle.
  Archiving retains expense history, reports, exports and repository associations;
  reactivation permits new expenses when the actor's current grant allows them.
  Archived projects are labeled in the list and detail view. Members without
  management authority receive guidance to contact an Owner or Admin.
- Unrelated expense/filter reads preserve unsaved project settings and their
  original `If-Match` revision. A newer read cannot silently adopt a revision and
  overwrite another member's changes. Explicit Reload replaces the draft with
  current Server values. Untouched settings continue to refresh normally.
  Project controls and the reload action are guarded during pending writes.
- Invitation errors offer an explicit read-only recheck. Failed acceptance is
  never automatically repeated. A still-pending token permits a new explicit
  attempt only after fresh confirmation; an accepted token with current active
  membership offers Open shared ledger, clears its hash and selects that ledger
  without replaying acceptance. Revoked, expired and previously accepted tokens
  have distinct guidance. The recovered ledger's displayed role comes from its
  current workspace authority.
- New control and recovery copy has English, Chinese, Japanese, Korean, French
  and Spanish support. The single shared API contract remains
  `../pullwise-server/openapi/ledger-v1.yaml`; Web has no unused schema mirror.

## Source verification

`npm run check` passed ESLint, all 36 test files / 433 tests and the Vite build.
After the final draft-lifecycle refinement, ESLint, the three relevant screen
files / 113 tests and a fresh build passed. `npm run check:workers` passed the
offline Worker configuration guard. No test forwarded requests to a provider.

New regressions cover archive/reactivate while retaining history, settings draft
and revision preservation across filtered reads, explicit recovery after a failed
acceptance, accepted-membership recovery without write replay, and revoked-token
rejection after manual recheck. Existing permission, workspace isolation,
pagination, historical editing and invitation lifecycle cases remain passing.

## Built Chromium verification

Four cases ran against the stable built assets using system Chromium and
Playwright. Every browser request was intercepted: assets came from `dist`,
account/ledger responses were local synthetic fixtures, external requests were
aborted, and service workers were blocked. Each case had a 120-request cap.
The contexts and browser process were closed after the finite run.

| Scenario | Viewport | Routed requests | Fixture API requests | Result |
| --- | --- | ---: | ---: | --- |
| Projects settings/lifecycle | 1440px desktop | 55 | 36 | Passed |
| Acceptance response loss/recovery | 1440px desktop | 29 | 11 | Passed |
| Projects settings/lifecycle | 390px touch | 55 | 36 | Passed |
| Acceptance response loss/recovery | 390px touch | 29 | 11 | Passed |

Projects cases edited a financial name and description, changed date filters,
verified the draft survived, archived with the captured revision, verified the
historical expense and CSV link remained visible, then reactivated with the next
revision. There were exactly two project writes per case; neither changed
repository associations.

Invitation cases simulated acceptance committing while its HTTP response failed
with 503. The user explicitly checked the invitation again, received accepted
membership, opened the shared ledger and cleared the invitation hash. Each case
made exactly one acceptance write and two read-only previews. There was no
automatic mutation retry or automatic polling.

All four cases had zero page errors, exact 1440/390 document and visual viewport
widths, and zero remote forwards. Touch cases required coarse-pointer media and
at least one touch point before capture and after restoring touch emulation.
The installed Chromium screenshot command clears touch emulation; the first
harness run stopped on that harness assertion, then the corrected complete run
passed all four cases. Project phone and invitation desktop captures were
visually reviewed for readable controls and preserved layout.

The accepted run totals were **168 locally routed requests / 94 fixture API
requests**. Generated harness, JSON and screenshots remain outside Git at
`/tmp/pullwise-project-members-browser.mjs` and
`/tmp/pullwise-project-members-browser/`. They contain only synthetic account,
project and invitation data.
