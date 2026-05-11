# API Layer

This folder is the browser-side integration boundary for the Pullwise server.

Currently wired backend responsibilities:

- GitHub identity login
- GitHub repository authorization through the GitHub App flow
- Repository listing and sync
- Scan creation, polling, cancellation, and history
- Issue listing and manual status changes
- Account session and GitHub integration state

Not wired because the backend does not implement them yet:

- Billing plan, checkout, or portal sessions
- Notifications
- Email magic links outside explicit backend dev mode
- Applying fixes, creating branches, pushing changes, or opening pull requests
- Slack and Linear integration authorization

Keep secret-bearing work on the backend. The browser must not hold GitHub App
private keys, OAuth client secrets, repository clones, scan workers, or AI
provider credentials.
