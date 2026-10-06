# Pullwise Web

Pullwise Web is the browser client for the [GitHub project expense ledger](../pullwise-server/docs/design/github-project-ledger/README.md). It uses GitHub for sign-in and repository authorization, then lets an account record project or shared expenses, manage categories, and review per-currency reports. API keys and platform subscription billing are separate from user-entered expenses.

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
