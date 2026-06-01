# Pullwise Web

Pullwise Web is a Vite React app for the Pullwise backend in
`../pullwise-server`. The current product surfaces only server-backed flows:

- GitHub identity login through the backend OAuth endpoint
- GitHub App repository authorization
- Repository listing and sync
- Scan creation, polling, cancellation, and history
- Rich issue review plus manual triage/status changes
- Deterministic fix preview and GitHub pull request creation for auto-fixable issues
- Workspace-aware GitHub integration settings
- Stripe or Creem workspace billing through backend-created checkout and portal sessions
- Legal, privacy, security, and live status/readiness pages

Stage 2 remediation is intentionally narrow in this build. The browser can ask
the backend to preview deterministic fix diffs and open GitHub pull requests for
auto-fixable findings. Still unavailable:

- Direct in-place fix application
- Batch fixes
- Auto-merge
- Notifications
- Slack or Linear writes
- AI-generated replacement patches beyond the finding payload

Secret-bearing Git and GitHub App work stays on the backend. The GitHub App
installation must grant `Contents: write` and `Pull requests: write` for branch
push and pull request creation.

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

Use `/` for the normal product entry. Use `/review.html` for the built-in
prototype navigator that can jump between all registered screens.

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

Billing and free scan limits are resource-scoped. The frontend displays account
billing status plus repository quota from `/repositories`.

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
review.html         Prototype navigator entry
src/main.jsx        Vite entry for index.html
src/review-main.jsx Vite entry for review.html
src/App.jsx         Screen router and app chrome
src/app.css         Language/theme/prototype-nav chrome styles
styles/*            Existing CSS
src/i18n.jsx        Inline language helper
src/icons.jsx       Inline icon set
src/shell.jsx       Shared authenticated shell components
src/screens/*       Screen components
src/api/http.js     Shared HTTP request helper
src/api/pullwise.js Pullwise backend endpoint wrapper
src/config/env.js   Frontend env validation with zod
src/lib/auth.js     GitHub OAuth and GitHub App redirect helpers
vite.config.js      Vite dev/build config
vitest.config.js    Vitest test config
eslint.config.js    ESLint config
```

## Backend Boundary

Secret-bearing and privileged operations stay server-side: GitHub OAuth client
secrets, GitHub App private keys, repository cloning, scan workers, AI provider
credentials, payment provider keys, webhook handling, fix branch pushes, and
pull request creation credentials.

## Cloudflare Workers Deployment

The recommended production topology is:

- Cloudflare Workers serves the Vite app with Workers static assets.
- `worker.js` proxies same-origin browser requests from `/api/*` to the backend origin.
- `pullwise-server` runs on a separate VM/container/server platform.

This keeps browser API calls, session cookies, and GitHub OAuth callbacks on the
frontend domain. The Cloudflare Worker is only a proxy; it does not run repository
scans, Git, SQLite, or Codex.

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
```

`VITE_*` variables are bundled into browser code. `PULLWISE_API_ORIGIN` is read
only by `worker.js` at runtime and should point to the deployed
Python backend origin.

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

Only enable that flag behind a trusted proxy.

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

Stripe and Creem webhooks can point either to the backend directly or through
the Worker proxy:

```text
https://api.your-domain.com/webhooks/stripe
https://api.your-domain.com/webhooks/creem
```

or:

```text
https://app.your-domain.com/api/webhooks/stripe
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
GitHub repository authorization, checkout creation, and the billing portal using
the production URLs above.
