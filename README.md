# Pullwise Web

Pullwise Web is a Vite React app for the Pullwise backend in
`F:\pullwise-server`. The active app surfaces only server-backed flows:

- GitHub identity login through the backend OAuth endpoint
- Email magic-link login through the backend email endpoint
- GitHub App repository authorization
- Repository listing and sync
- Scan creation, polling, cancellation, and history
- Issue listing plus manual status changes
- Account and GitHub integration settings
- Stripe or Creem billing through backend-created checkout and portal sessions
- Legal, privacy, security, and live status pages for payment review

The frontend intentionally does not expose notifications, auto-fix application,
or pull request creation because those backend capabilities are not implemented.

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

Use `/` for the normal product entry. Use `/review.html` for the prototype
navigator that can jump between currently registered screens.

## Environment

Create `.env.local`:

```text
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000
VITE_GITHUB_APP_SLUG=pullwise
```

Only `VITE_*` variables are exposed to browser code. Do not put GitHub client
secrets, GitHub App private keys, AI provider keys, or repository credentials in
frontend env files.

The Python API now requires real GitHub OAuth/App and SMTP configuration for
production login flows. Explicit local auth/dev magic-link switches live in
`F:\pullwise-server`; they are not enabled by the frontend.

## Useful Commands

```bash
npm run dev       # run local dev server
npm run build     # build dist output
npm run preview   # preview production build locally
npm run lint      # run ESLint
npm run test      # run Vitest
npm run check     # lint, typecheck, test, then build
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
credentials, payment provider keys, webhook handling, and future PR creation
credentials.

## Cloudflare Pages Deployment

The recommended production topology is:

- Cloudflare Pages serves the Vite app and the lightweight `/api/*` Pages Function.
- `pullwise-server` runs on a separate VM/container/server platform.
- The Pages Function proxies same-origin browser requests from `/api/*` to the backend origin.

This keeps browser API calls, session cookies, GitHub OAuth callbacks, and email
magic-link callbacks on the frontend domain. The Pages Function is only a proxy;
it does not run repository scans, Git, SQLite, or Codex.

Cloudflare references:

- Pages Functions run code on the Workers runtime:
  https://developers.cloudflare.com/pages/functions/
- Workers have CPU, memory, startup, and runtime limits:
  https://developers.cloudflare.com/workers/platform/limits/
- Python Workers are beta and run under Pyodide:
  https://developers.cloudflare.com/workers/languages/python/

### Pages Project Settings

Set these in Cloudflare Pages:

```text
Framework preset: None or Vite
Build command: npm run build
Build output directory: dist
Root directory: pullwise-web, if this repo is inside a monorepo
Node version: 22.12.0 or newer, or 20.19.0 or newer
```

Production environment variables:

```text
VITE_APP_URL=https://app.your-domain.com
VITE_API_BASE_URL=/api
VITE_GITHUB_APP_SLUG=your-github-app-slug
PULLWISE_API_ORIGIN=https://api.your-domain.com
```

`VITE_*` variables are bundled into browser code. `PULLWISE_API_ORIGIN` is read
only by `functions/api/[[path]].js` at runtime and should point to the deployed
Python backend origin.

### Matching Backend Settings

For the same-origin Pages proxy topology, configure the backend with:

```text
PULLWISE_APP_URL=https://app.your-domain.com
PULLWISE_ALLOWED_ORIGINS=https://app.your-domain.com
PULLWISE_API_BASE_URL=https://app.your-domain.com/api
```

`PULLWISE_API_BASE_URL` is important: GitHub OAuth, GitHub App setup callbacks,
and email magic links must return through `/api` so the browser receives the
session cookie on `app.your-domain.com`.

If you cannot set a fixed public API base URL, the Pages Function sends
`X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Prefix: /api`. In that
case set this on the backend:

```text
PULLWISE_TRUST_PROXY_HEADERS=true
```

Only enable that flag behind a trusted proxy.

### External Provider Callback URLs

Use the Pages `/api` URLs when configuring browser-returning providers:

```text
GitHub OAuth callback: https://app.your-domain.com/api/auth/github/callback
GitHub App setup URL: https://app.your-domain.com/api/integrations/github/callback
```

Stripe and Creem webhooks can point either to the backend directly or through
the Pages proxy:

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
email magic-link login, GitHub repository authorization, checkout creation, and
the billing portal using the production URLs above.
