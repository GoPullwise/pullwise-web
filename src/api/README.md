# API Layer

This folder is the browser-side integration boundary for the Pullwise server.

Currently wired backend responsibilities:

- GitHub identity login
- GitHub repository authorization through the GitHub App flow
- Repository listing and sync
- Scan creation, polling, cancellation, and history
- Rich issue review and manual status changes
- Deterministic issue fix preview
- GitHub pull request creation for auto-fixable issue fixes
- Account session and GitHub integration state
- Billing plan, checkout sessions, supported upgrades, and scheduled cancellation
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
