# Pullwise Web

Pullwise Web is a Vite React app for the Pullwise backend in
`F:\pullwise-server`. The active app surfaces only server-backed flows:

- GitHub identity login through the backend OAuth endpoint
- GitHub App repository authorization
- Repository listing and sync
- Scan creation, polling, cancellation, and history
- Issue listing plus manual status changes
- Account and GitHub integration settings

The frontend intentionally does not expose billing, notifications, local email
magic links, auto-fix application, or pull request creation because those
backend capabilities are not implemented.

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

The Python API now requires real GitHub OAuth/App configuration by default. If
you explicitly need local auth mocks, enable them in `F:\pullwise-server`; they
are not enabled by the frontend.

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
credentials, webhook handling, and future PR creation credentials.
