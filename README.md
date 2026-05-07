# Pullwise Web

Pullwise Web is a Vite React application that preserves the existing prototype
screens and visual styling while using normal npm dependencies, ES modules, and
Vite build/dev tooling.

- `index.html` is the normal prototype entry.
- `review.html` is the prototype navigator entry.
- `src/main.jsx` mounts the normal entry.
- `src/review-main.jsx` mounts the prototype navigator entry.
- `styles/*` and `src/screens/*` keep the current visual implementation.
- `src/data.jsx` still provides fixture data until backend APIs are connected.
- `src/api/*` is the new integration boundary for future real API calls.

## Local Debugging

Install dependencies first:

```bash
npm install
```

Start the local Vite dev server:

```bash
npm run dev
```

Open these URLs in the browser:

```text
http://localhost:5173/
http://localhost:5173/review.html
```

Use `/` when you want to inspect the product-like entry. Use `/review.html` when
you want the top prototype navigator that can jump between all screens.

## Environment

Copy the example env file before connecting real backend services:

```bash
copy .env.example .env.local
```

Current variables:

```text
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000
VITE_GITHUB_APP_SLUG=pullwise
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_replace_me
```

Only `VITE_*` variables are exposed to browser code. Do not put GitHub client
secrets, GitHub App private keys, Stripe secret keys, AI provider keys, or repo
access credentials in frontend env files.

## Useful Commands

```bash
npm run dev       # run local dev server
npm run build     # build dist output
npm run preview   # preview the production build locally
npm run lint      # run ESLint
npm run format    # format project files
npm run check     # lint, typecheck, test, then build
```

## Production Build Check

Run:

```bash
npm run build
npm run preview
```

Then open:

```text
http://localhost:4173/
http://localhost:4173/review.html
```

The production build is fully bundled by Vite. There is no React CDN, browser
Babel, or legacy `type="text/babel"` runtime.

## Project Structure

```text
index.html          Existing public prototype entry
review.html         Existing prototype navigator entry
src/main.jsx        Vite entry for index.html
src/review-main.jsx Vite entry for review.html
src/App.jsx         Shared screen router and app chrome
src/app.css         Language/theme/prototype-nav chrome styles
styles/*            Existing CSS
src/data.jsx        Existing fixture data
src/i18n.jsx        Existing language helper
src/icons.jsx       Existing inline icon set
src/shell.jsx       Existing shared shell components
src/screens/*       Existing prototype screens
src/api/http.js     Shared HTTP request helper for future API work
src/api/pullwise.js Future Pullwise backend endpoint wrapper
src/config/env.js   Frontend env validation with zod
src/lib/auth.js     GitHub OAuth redirect helpers
src/lib/stripe.js   Stripe publishable-key loader
src/lib/query-client.js React Query client defaults
vite.config.js      Vite dev/build config
vitest.config.js    Vitest test config
eslint.config.js    ESLint config
jsconfig.json       Editor path alias config
tsconfig.json       TypeScript baseline config for future TS/TSX files
```

## Dependency Groups

Runtime and routing:

- `react`, `react-dom`
- `react-router-dom`
- `zustand`

API and server state:

- `axios`
- `@tanstack/react-query`
- `zod`

Auth, billing, and SaaS integrations:

- `src/lib/auth.js` starts GitHub identity login, sends email magic links, and
  starts the separate GitHub repository authorization flow.
- `@stripe/stripe-js` loads Stripe with a publishable key for checkout flows.
- GitHub OAuth secrets, GitHub App private keys, Stripe secret keys, and AI keys
  must stay in the backend, not in frontend dependencies or env files.

Forms and UI utilities:

- `react-hook-form`
- `clsx`
- `lucide-react`
- `sonner`
- `date-fns`

Quality and testing:

- `eslint`, `prettier`, `typescript`
- `vitest`, `jsdom`
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`

## What Is Still Mocked

These features are still prototype-only and should eventually call backend APIs:

- GitHub identity login, email magic links, repository authorization, and repo sync
- Repository listing, branch/commit lookup, and scan creation
- Scan progress, scan history, issue list, and issue details
- Apply fix, create branch, push changes, and create pull request
- Slack, Linear, billing, notification, profile, and security settings

Privileged operations should stay server-side: GitHub secrets, repository
cloning, scanner execution, PR creation credentials, Stripe secret keys, webhook
handling, and AI provider credentials.

## Troubleshooting

If the page is blank, check the browser console first. This prototype still loads
through the Vite React entry, so runtime errors usually point to a specific
module under `src/`.

If dependencies are missing, rerun:

```bash
npm install
```

If the dev server port is occupied, run:

```bash
npm run dev -- --port 5174
```

If production preview misses styles or screen files, rebuild before previewing:

```bash
npm run build
npm run preview
```
