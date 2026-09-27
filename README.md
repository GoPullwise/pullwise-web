# Pullwise Web

The requested replacement is the [GitHub project expense ledger design](../pullwise-server/docs/design/github-project-ledger/README.md). The description below records the current runtime until that replacement is implemented.

Pullwise Web is a Vite React app for the Pullwise backend in
`../pullwise-server`. The current product follows GitHub pull requests, CI
failures, and upstream updates:

- GitHub identity login through the backend OAuth endpoint
- GitHub App repository authorization
- Authorized repository and service configuration
- PR and CI item lists, saved source evidence, and handling history
- Upstream release watches and relevant update evidence
- Saved processing usage and plan capacity
- Account-level GitHub integration settings
- Creem account billing through backend-created checkout, supported upgrades, and scheduled cancellation
- API-key contract preview, legal, privacy, and status pages

The old full-repository scan, finding, fix preview, and scan-history screens
have been retired. Browser reads and manual GitHub fact sync do not start model
processing. GitHub credentials and model access stay on the backend.

## Local Development

Install dependencies:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
http://localhost:5173/review.html
```

Use `/` for the normal product entry. In local development only, use
`/review.html` for the built-in prototype navigator that can jump between all
registered screens. The production Vite build does not include `review.html`.

## Environment

Create `.env.local`:

```text
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8080
VITE_GITHUB_APP_SLUG=pullwise
```

Only `VITE_*` variables are exposed to browser code. `PULLWISE_API_ORIGIN` is
a runtime-only variable read by the Cloudflare Worker in `worker.js`; it does
not reach the browser bundle. Do not put
GitHub client secrets, GitHub App private keys, AI provider keys, or repository
credentials in frontend env files.

If real GitHub OAuth secrets or GitHub App private keys were ever committed or
shared outside the local machine, rotate them in GitHub before production use.

The Python API now requires real GitHub OAuth/App configuration for production
login flows. Explicit local auth switches live in the sibling `pullwise-server`
repository; they are not enabled by the frontend.

Billing capacity is shown as active repository and watch limits plus monthly
intelligent processing usage. The current product is still being migrated;
Cloudflare and Jev production gates remain open.

## Useful Commands

Run `npm install` before these commands. If `node_modules` is missing,
verification failures such as `eslint` or Vitest packages not being found mean
the local setup is incomplete, not that the product build is broken.

```bash
npm run dev       # run local dev server
npm run build     # build dist output
npm run preview   # preview production build locally
npm run lint      # run ESLint
npm run test      # run Vitest
npm run check     # lint, test, then build
```

## Project Structure

```text
index.html          Product entry
review.html         Local-development prototype navigator entry
src/main.jsx        Vite entry for index.html
src/review-main.jsx Local-development entry for review.html
src/App.jsx         Screen router and app chrome
src/app.css         Language/theme/prototype-nav chrome styles
styles/*            Existing CSS
src/i18n.jsx        Inline language helper
src/icons.jsx       Inline icon set
src/shell.jsx       Shared authenticated shell components
src/components/*    Shared product detail, notifications, and skeleton components
src/screens/*       Product, configuration, billing, docs, API, and status screens
src/api/http.js     Shared HTTP request helper
src/api/pullwise.js Pullwise backend endpoint wrapper
src/config/env.js   Frontend env validation with zod
src/lib/*           Auth redirects, navigation, downloads, quota display, install popup, and data hooks
worker.js           Cloudflare Worker static-assets/API proxy runtime
functions/api/*     Cloudflare Pages Functions API proxy fallback
vite.config.js      Vite dev/build config
vitest.config.js    Vitest test config
eslint.config.js    ESLint config
```

## Backend Boundary

Secret-bearing and privileged operations stay server-side: GitHub OAuth client
secrets, GitHub App private keys, model provider credentials, payment provider
keys, and webhook handling.

## Cloudflare Workers Deployment

The recommended production topology is:

- Cloudflare Workers serves the Vite app with Workers static assets.
- `worker.js` proxies same-origin browser requests from `/api/*` to the backend origin.
- `pullwise-server` runs on a separate VM/container/server platform.

This keeps browser API calls, session cookies, and GitHub OAuth callbacks on the
frontend domain. The frontend Cloudflare Worker is only a proxy; it does not run
product processing or model calls.

Cloudflare references:

- Workers static assets:
  https://developers.cloudflare.com/workers/static-assets/
- Workers have CPU, memory, startup, and runtime limits:
  https://developers.cloudflare.com/workers/platform/limits/
- Python Workers are beta and run under Pyodide:
  https://developers.cloudflare.com/workers/languages/python/

### Workers Project Settings

Deploy with Wrangler from `pullwise-web`:

```bash
npm run deploy:workers
```

Production environment variables:

```text
VITE_APP_URL=https://app.your-domain.com
VITE_API_BASE_URL=/api
VITE_GITHUB_APP_SLUG=your-github-app-slug
PULLWISE_API_ORIGIN=https://api.your-domain.com
# Optional read-only fallback for Cloudflare 1003 on unauthenticated GET/HEAD.
PULLWISE_API_FALLBACK_ORIGIN=https://api-fallback.your-domain.com
# Optional proxy request body cap; defaults to 1048576 bytes.
PULLWISE_PROXY_MAX_BODY_BYTES=1048576
```

`VITE_*` variables are bundled into browser code. `PULLWISE_API_ORIGIN`,
optional `PULLWISE_API_FALLBACK_ORIGIN`, and optional
`PULLWISE_PROXY_MAX_BODY_BYTES` are read only by `worker.js` or
`functions/api/[[path]].js` at runtime. The fallback origin is only used for
unauthenticated GET/HEAD requests when the primary upstream returns a
Cloudflare 1003 page.

### Matching Backend Settings

For the same-origin Worker proxy topology, configure the backend with:

```text
PULLWISE_APP_URL=https://app.your-domain.com
PULLWISE_ALLOWED_ORIGINS=https://app.your-domain.com
PULLWISE_API_BASE_URL=https://app.your-domain.com/api
```

`PULLWISE_API_BASE_URL` is important: GitHub OAuth and GitHub App setup
callbacks must return through `/api` so the browser receives the session cookie
on `app.your-domain.com`.

If you cannot set a fixed public API base URL, the Worker proxy sends
`X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Prefix: /api`. In that
case set this on the backend:

```text
PULLWISE_TRUST_PROXY_HEADERS=true
```

Only enable that flag behind a trusted proxy. The Worker and Pages proxy strip
client-supplied `Forwarded`, `X-Forwarded-*`, `X-Real-IP`, and provider client
IP headers before setting the canonical `X-Forwarded-Proto`, `X-Forwarded-Host`,
and `X-Forwarded-Prefix` values.

### Direct API Option

You can skip the Worker proxy and call the backend directly:

```text
VITE_API_BASE_URL=https://api.your-domain.com
```

Then set the backend callback URLs to the API domain:

```text
PULLWISE_APP_URL=https://app.your-domain.com
PULLWISE_ALLOWED_ORIGINS=https://app.your-domain.com
PULLWISE_API_BASE_URL=https://api.your-domain.com
```

Use custom domains that are same-site, such as `app.your-domain.com` and
`api.your-domain.com`, so the default `SameSite=Lax` session cookie works with
credentialed API requests. If the frontend is on a Cloudflare preview domain and the backend
is on an unrelated domain, prefer the `/api` proxy topology.

### External Provider Callback URLs

Use the Worker `/api` URLs when configuring browser-returning providers:

```text
GitHub OAuth callback: https://app.your-domain.com/api/auth/github/callback
GitHub App setup URL: https://app.your-domain.com/api/integrations/github/callback
```

Creem webhooks can point either to the backend directly or through
the Worker proxy:

```text
https://api.your-domain.com/webhooks/creem
```

or:

```text
https://app.your-domain.com/api/webhooks/creem
```

### Deployment Check

Before deploying:

```bash
npm run check
```

After deploying:

```text
https://app.your-domain.com/api/health
```

The health response should come from `pullwise-server`. Then test GitHub login,
GitHub repository authorization, checkout creation, supported billing upgrades,
and scheduled cancellation using the production URLs above.
