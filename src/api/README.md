# Browser API boundary

`ledger.js` implements the shared Server ledger REST contract for workspaces,
members and invitations, projects, categories, project/shared expenses,
per-currency reports, CSV exports and optional suggestions. `pullwise.js`
implements sessions, GitHub authorization, settings, API-key management,
subscriptions and public health reads.

The workspace/team and multi-repository version is implemented locally as of
2026-10-06 and awaits release verification.

`http.js` joins each route to the configured base. With browser base `/api`,
ledger `/api/v1/*` becomes `/api/api/v1/*`; `worker.js` strips exactly the outer
prefix. Server ownership and key restrictions remain authoritative. GitHub,
Creem and Jev secrets never belong in this client. Reads and manual GitHub
access refresh do not invoke suggestions or save expenses.

`createLedgerApi(workspaceId, onAccessChanged)` captures the view's selected
workspace and sends `X-Pullwise-Workspace` on its requests. Native CSV links
include `workspaceId` because browser navigation cannot add that header.
Conflicting selectors are rejected by Server. Switching workspace or changing
membership/access scope clears protected views and aborts obsolete reads;
late results cannot restore the previous ledger. Account and subscription
requests remain on their separate client.

API-key listing selects `workspaceId`; creation binds restrictions to that
workspace and its `workspaceMemberRevision`, alongside project/shared-pool
restrictions. Effective scopes intersect the key's scopes with the issuing
member's current role. Membership revision changes invalidate team keys, and
a workspace header cannot override a key's binding. Owner ledger quotas, plan
and model allowance pool team usage; members' personal ledgers remain separate.

Project writes use `githubRepoIds` with 1–30 distinct stable authorized numeric
repository IDs, plus optional `name`, `description` and `githubOrganizationId`.
GitHub authorization belongs to the actual actor, independently of ledger
membership. Changing associations preserves the project ID and financial
history. New project expenses require at least one currently authorized linked
repository; unavailable protected repository metadata is hidden. Member,
invitation and existing resource changes use `If-Match` revisions; expense
creation uses a fresh `Idempotency-Key`.
