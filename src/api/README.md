# Browser API boundary

`product.js` calls the shared product-v1 REST service for saved PR follow-ups,
GitHub Actions failures, upstream Releases, watch and repository configuration,
handling history, usage, and visualizations. `pullwise.js` retains account
session, GitHub App authorization, API keys, billing, and public health calls.
The retired full-repository scan, issue-fix, worker, and manual fact-sync
endpoints are not part of the browser contract.

The browser only handles public responses and user-scoped credentials. GitHub
App secrets, installation tokens, and Jev credentials belong on the server.
The new product reads GitHub facts and does not need repository write
permissions. Production GitHub ingestion and Jev remain pending; the Cloudflare
product service is still a candidate until those paths are connected.
