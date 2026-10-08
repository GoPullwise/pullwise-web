# Pullwise Web

Pullwise is a project expense ledger for developers and teams at [pull-wise.com](https://pull-wise.com). Pullwise Web is its browser client; the current [product design](../pullwise-server/docs/design/github-project-ledger/README.md) describes the shared Web/Server contract. Members sign in with GitHub, create named projects, record project or shared expenses, manage categories, and review per-currency reports in the selected ledger. GitHub repository links are optional. API keys and platform subscription billing are separate from user-entered expenses.

**Track project and shared expenses. Keep every cost in view.**

The shared pool records costs used across projects once in the selected ledger; it does not allocate or copy them into individual projects. Each currency is totaled separately, without currency conversion. Expenses are entered by users or authenticated API clients; linking a repository does not import bills or move money.

As of 2026-10-06, the new workspace/team and multi-repository version is implemented, verified and released to preview. Its separate local native/UI evidence and actual remote publication checks are in the latest acceptance record; the original release history remains separately dated.

## Workspaces and projects

An existing owner's ledger becomes a workspace identified by that owner's ID; personal ownership remains an implicit Owner. The header picker switches between the personal ledger and ledgers joined by invitation. Protected views clear their data, drafts and one-time credentials when the workspace or access scope changes, abort obsolete reads and ignore late results.

Members supports invitations, acceptance, role changes, removal and invitation revocation. An invitation entered by GitHub username is bound to the recipient's stable GitHub ID. Owner manages Admins; Admin manages Editors and Viewers. Editors record expenses; Viewers can read reports and export CSV. Invitation creation and acceptance warn that membership shares all current and future ledger data. Membership does not grant GitHub access. Team usage pools the owner's ledger quotas, plan and model allowance; billing stays with the owner, and each member's personal ledger remains separate.

Create a standalone project with a name and optional description; no GitHub App installation or repository authorization is needed for its expense entries. Optionally link 1–30 distinct stable GitHub repository IDs and a GitHub Organization. The chooser uses the acting member's current GitHub authorization, filters by the selected organization and revalidates selections after access changes. Project settings can add, change or remove these associations while preserving the project ID and expense history. A new expense in a linked project requires at least one linked repository authorized for the acting member; unavailable protected repository metadata stays hidden while permitted financial history remains accessible. Removing all repository links requires a nonempty project name and clears the Organization association.

The Cloudflare static-asset Worker in `worker-entry.js` proxies `/api/*` to the Server Worker and streams its response body. The browser API helper uses `/api/v1/*` behind the configurable base URL; on the production domain the base URL is `/api`, so the proxy receives `/api/api/v1/*` and strips the first `/api`.

## Local development

```bash
npm ci
npm run dev
```

The development server runs at `http://localhost:5173`. Set `VITE_API_BASE_URL=/api` when proxying to a local Server Worker configured in `vite.config.js`. Set `VITE_GITHUB_APP_SLUG` only for the public GitHub installation link. Browser environment variables must never contain GitHub, Creem, or Jev secrets.

`npm run check` runs lint, Vitest, and the production build. `npm run check:workers` checks the Worker configuration without publishing. `npm run deploy:workers` publishes and must be used only after the Server preview configuration and S17 local checks pass.

## Cloudflare configuration

`wrangler.jsonc` currently maps `pull-wise.com` and `www.pull-wise.com` to the Web Worker and sends API traffic to `https://api.pull-wise.com`. Coordinate the Server custom domain, OAuth callback, Cookie domain/SameSite, and allowed origins before preview or production deployment. Do not put secrets in `wrangler.jsonc`.

Both configurations bind `ASSETS` and run the Worker first for HTML/API paths while serving `/assets/*` directly. This lets production apply route-specific SEO, private-page noindex and the `www` canonical redirect; production mode keeps public pages indexable. Preview mode adds a site-wide noindex header. The offline config guard checks both modes and routing shapes. This production-ready configuration does not activate or migrate the Server database.

See [local acceptance](docs/validation/local-acceptance.md) for current verification, published versions and remaining authenticated/provider gates. The resumed audit and publication were explicitly authorized on 2026-10-06. Preview uses its separate configuration and the Server's persistent validation journal; production database activation requires its own migration and provider checks.
