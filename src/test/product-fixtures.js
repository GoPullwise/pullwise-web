export const itemFixture = {
  id: "item-pr", module: "pr", repositoryId: "repo-1", watchId: null,
  unit: { type: "pr_thread", externalId: "thread-42" }, itemVersion: 2, revision: 4,
  title: "Clarify cache invalidation", sourceUrl: "https://github.com/acme/api/pull/42#discussion_r1",
  actionTypes: ["change_requested", "reply_needed"], attentionState: "needs_action", lifecycle: "active",
  sourceFacts: { pullNumber: 42, threadResolved: false }, nextActors: [],
  evidence: [{ id: "ev-1", status: "available", text: "Why is this cached?\n\n```js\nconst cache = new Map();\n```", actionTypes: ["reply_needed"] }],
  assessments: [], handling: { disposition: "open", assigneeId: null, note: null, feedback: null, carriedFromItemVersion: null },
  handlingHistory: [], lastSyncedAt: "2026-09-22T03:00:00Z",
};
export const overviewFixture = {
  totalCount: 1, counts: { needs_action: 1, needs_confirmation: 0, waiting: 0, optional: 0, closed: 0 },
  viewCounts: { mine: 0, unassigned: 1, waiting: 0, all: 1 },
  sourceCoverage: { unit: "source_context", total: 3, processingStatus: { rules_only: 1, analysis_disabled: 2 } },
  lastSyncedAt: "2026-09-22T03:00:00Z",
};
export const releaseFixture = {
  id: "release-1", type: "release", repositoryId: "upstream-1", sourceVersion: "sv-1", sourceRevision: 1,
  sourceFacts: { name: "SDK 2.0", tagName: "v2.0", publishedAt: "2026-09-20T00:00:00Z" },
  sourceUrl: "https://github.com/acme/sdk/releases/tag/v2.0", completeness: "partial",
  content: { title: "SDK 2.0", body: "OAuth clients should check the migration notes." },
  contexts: [{ id: "context-1", watchId: "watch-1", itemId: null, contextVersion: 2, processingStatus: "analysis_disabled", analysisEnabled: false, contextStale: false,
    coverage: { state: "partial", selectedUnits: 1, totalUnits: 4, rawSourcePartial: false, limitations: ["input_limit"] } }],
};
export const page = (items) => ({ items, nextCursor: null, hasMore: false, requestId: "fixture" });
