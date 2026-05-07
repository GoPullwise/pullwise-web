# API Layer

This folder is the integration boundary for Pullwise server data.

Expected backend responsibilities:

- Passwordless identity login: GitHub sign-in and email magic links
- GitHub repository authorization: GitHub App installation and repo access scope
- Repository listing and permission sync
- Scan task creation, cancellation, polling, and live events
- Issue listing, status changes, fix application, and pull request creation
- Stripe checkout and billing portal sessions
- Slack and Linear integration authorization
- Workspace settings, security, and notification preferences

Keep secret-bearing work on the backend. The browser should not hold GitHub app
private keys, OAuth client secrets, Stripe secret keys, repository clones, scan
workers, or AI provider credentials.
