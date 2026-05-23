# API Layer

This folder is the browser-side integration boundary for the Pullwise server.

Currently wired backend responsibilities:

- GitHub identity login
- GitHub repository authorization through the GitHub App flow
- Repository listing and sync
- Scan creation, polling, cancellation, and history
- Issue listing and manual status changes
- Account session and GitHub integration state
- Billing plan, checkout sessions, and customer portal sessions

Not wired because the backend does not implement them yet:

- Notifications
- Applying fixes, creating branches, pushing changes, or opening pull requests
- Slack and Linear integration authorization

Keep secret-bearing work on the backend. The browser must not hold GitHub App
private keys, OAuth client secrets, repository clones, scan workers, or AI
provider credentials.
