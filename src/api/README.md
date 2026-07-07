# API Layer

This folder is the browser-side integration boundary for the Pullwise server.

Currently wired backend responsibilities:

- GitHub identity login
- GitHub repository authorization through the GitHub App flow
- Repository listing, branch lookup, and sync
- Scan preflight, creation, bulk polling, retry, cancellation, history, and audit bundle downloads
- Rich issue review plus single and batch manual status changes
- Deterministic issue fix preview
- GitHub pull request creation for auto-fixable issue fixes
- Account session, API key, and GitHub integration state
- Billing plan, checkout sessions, supported upgrades, scheduled cancellation, and renewal resume
- Public docs helpers for subscription plan and server configuration metadata
- Backend health and readiness status

Not wired in this stage:

- Direct in-place fix application
- Batch fixes
- Auto-merge
- Notifications
- Slack and Linear integration authorization or writes
- AI-generated replacement patches beyond the finding payload

Keep secret-bearing work on the backend. The browser must not hold GitHub App
private keys, OAuth client secrets, repository clones, installation access
tokens, scan workers, Git credentials, or AI provider credentials. Branch push
and pull request creation require backend-held GitHub App credentials with
`Contents: write` and `Pull requests: write`.

If real GitHub OAuth secrets or GitHub App private keys were ever committed or
shared outside the local machine, rotate them in GitHub before production use.
