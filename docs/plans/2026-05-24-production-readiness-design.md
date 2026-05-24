# Pullwise Production Readiness Design

> **Historical note:** This Stage 1 design records the pre-Stage 2 product
> state. Current README files are authoritative for implemented behavior; Stage
> 2 now includes deterministic fix preview and GitHub pull request creation.

## Context

Pullwise is a GitHub code-review product. The current product surface includes
GitHub identity login, GitHub App repository authorization, repository listing,
scan creation and polling, scan cancellation and history, agent-written issue
findings, manual issue status changes, account settings, billing, legal pages,
security pages, and a live status page.

The approved Stage 1 goal is to make the existing product stable, trustworthy,
and usable before adding heavier workflow automation such as applying fixes,
opening pull requests, notifications, or Slack/Linear write integrations.

Current evidence from the workspace:

- `web` cannot run `npm run check` from this checkout because dependencies are
  not installed.
- `server` tests run, but fail in this environment because `Authlib`,
  `PyGithub`, and the launcher test shell path converter are unavailable.
- The backend stores broad logical state as JSON blobs in SQLite. This is
  acceptable for trials, but not an unbounded multi-tenant system of record.
- Backend issue findings already include rich review fields such as `impact`,
  `steps`, `badCode`, `goodCode`, and `references`.
- The frontend issue detail currently shows only the finding header and summary,
  so users cannot fully act on the agent output.
- The backend intentionally returns `501 Not Implemented` for fix application,
  pull request creation, and non-GitHub integration writes.

## Requirements

Stage 1 must make the existing product credible for production trials:

1. Verification must be repeatable for both repos.
2. Runtime setup failures must be obvious and actionable.
3. Secret-bearing local configuration must not be treated as safe repository
   state.
4. Core user flows must have success, empty, pending, and failure states:
   login, repository authorization, repository sync, scan start, queued scan,
   running scan, failed scan, cancelled scan, completed scan, issue triage,
   history, billing, and settings.
5. Issue detail must expose enough information for a user to understand and act
   on a finding without leaving the product.
6. Documentation must match implemented behavior and not imply that Stage 2
   automation already exists.
7. Stage 2 capability points must remain honest: fix application, PR creation,
   notifications, and third-party writes can be visible only as unavailable or
   planned features unless implemented end to end.

## Design

### Architecture

Keep the current two-repo architecture:

- `pullwise-web` remains a Vite React app and the browser integration boundary.
- `pullwise-server` remains a Python HTTP API with SQLite persistence and a
  background scan worker.

Stage 1 should avoid changing the deployment topology. Cloudflare Pages plus
the `/api` proxy to the Python server remains the supported production path.

The implementation should harden existing behavior before adding new domain
surfaces. The frontend should consume the fields the backend already returns
instead of inventing fixture-only behavior. The backend should expose clearer
health/config/audit information and make persisted scan state recoverable after
process restarts.

### Frontend

Issue detail becomes the main review workspace for a single finding. It should
render:

- Severity, category, confidence, repository, file, line, scan id, and status.
- Summary and impact.
- Concrete remediation steps.
- Bad/good code examples when provided.
- References when provided.
- Actions for `Mark fixed`, `Snooze`, and `Reopen`.
- Honest disabled actions for `Apply fix` and `Open pull request` when the
  backend reports those capabilities as unavailable.

Scanning and history screens should explain queue state, provider configuration
errors, entitlement limits, cancellation, and completed scans without generic
or misleading copy.

Global search should continue to index issues, repositories, and pages, but
issue search results should route to the selected issue detail when possible.

### Backend

The backend should add production-readiness contracts without redesigning the
whole service:

- A clear health/config/audit payload for operational checks.
- Startup recovery for stale `running` scans persisted before a crash or
  restart. Such scans should not remain permanently running without a worker.
- Tests that distinguish missing optional local test dependencies from real
  application failures.
- Documentation that makes SQLite JSON state limitations explicit and gives the
  next database migration direction.

The backend should not implement Stage 2 automation in Stage 1 unless the full
security and GitHub write workflow is included. Returning truthful unavailable
responses is better than partial automation.

### Data Flow

The main review flow remains:

1. Browser signs in through `/auth/github/authorize`.
2. Browser authorizes repositories through `/integrations/github/authorize`.
3. Browser lists repositories through `/repositories`.
4. Browser starts scans with `POST /scans`.
5. Server persists a queued scan and worker advances it.
6. Worker runs the configured provider and stores issues.
7. Browser polls `/scans/{id}` and lists `/issues`.
8. User opens an issue detail and updates status through
   `PATCH /issues/{id}/status`.

The frontend should render the backend issue object directly after normalization.
No new issue-detail-only fake schema should be introduced.

### Error Handling

Errors should be specific and actionable:

- Missing GitHub OAuth config: explain which variables are missing.
- Missing GitHub App config: explain slug/app id/private key requirements.
- Private or owner-only GitHub App: tell the operator to make it public/any
  account.
- Review provider disabled: explain `PULLWISE_REVIEW_PROVIDER=codex` or
  `claude_code`.
- CLI missing or unauthenticated: show the exact CLI login/install action.
- Review quota exceeded: route the user to billing.
- Scan queued: show queue position and concurrency limits.
- Stage 2 actions unavailable: say the backend does not implement them yet.

### Testing

Stage 1 verification target:

- `web`: `npm run check`
- `server`: `python -m unittest discover -s tests`

When a local platform cannot execute launcher tests, those tests should skip
with a clear reason instead of failing with unrelated shell bootstrap noise.
When Python dependencies are required by a test, missing dependencies should be
reported as setup failure or skipped only where the test cannot run without the
external package.

### Stage 2 Scope

After Stage 1 is stable, the next stage can implement:

- Apply deterministic fixes.
- Create branches and pull requests through the GitHub App.
- Notification inbox and outbound email/webhook events.
- Slack and Linear authorization plus issue writes.
- Dedicated database tables and pagination for high-volume multi-tenant use.

Stage 1 should leave clear seams for these capabilities but should not fake
successful automation.
