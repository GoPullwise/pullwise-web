import assert from "node:assert/strict";
import { createDateLayoutFixture, WORKSPACE_ID } from "./date-layout-fixtures.mjs";

// Synthetic, bounded GET responses. This guard never forwards a business read
// or any write to a Server. Reuse the contract-backed ledger/date DTOs.
export function createMobileLayoutFixture({ baseURL }) {
  const base = new URL(baseURL);
  const core = createDateLayoutFixture({ baseURL, cap: 100 });
  const requests = [];
  const violations = [];
  let longInbox = false;
  const normalize = (path) =>
    path
      .replace(/^\/api\/api\/v1(?=\/|$)/, "/api/v1")
      .replace(/^\/api\/auth(?=\/|$)/, "/auth")
      .replace(/^\/api\/billing(?=\/|$)/, "/billing");
  const inbox = Array.from({ length: 16 }, (_, index) => ({
    id: `req_mobile_${index}`,
    status: "pending",
    revision: 1,
    invitationId: `inv_mobile_${index}`,
    invitation: { id: `inv_mobile_${index}`, role: "viewer" },
    workspaceId: WORKSPACE_ID,
    workspace: { id: WORKSPACE_ID, name: "Local mobile compatibility ledger" },
    applicant: {
      userId: `usr_mobile_applicant_${index}`,
      name: `Local applicant ${index + 1} · long readable account name`,
      githubLogin: `mobile-layout-applicant-${index + 1}`,
    },
    createdAt: "2026-10-01T00:00:00Z",
  }));
  function extraPayload(path) {
    if (path === "/api/v1/workspace-invitation-requests")
      return { items: longInbox ? inbox : [], hasMore: false };
    if (path === `/api/v1/workspaces/${WORKSPACE_ID}/members`)
      return {
        items: [
          {
            userId: WORKSPACE_ID,
            name: "Local fixture owner",
            githubLogin: "date-layout-fixture",
            role: "owner",
            revision: 1,
            joinedAt: "2026-09-01T00:00:00Z",
          },
          {
            userId: "usr_mobile_viewer",
            name: "A local member with a long name for wrapping",
            githubLogin: "mobile-layout-viewer",
            role: "viewer",
            revision: 1,
            joinedAt: "2026-09-01T00:00:00Z",
          },
        ],
      };
    if (
      path === `/api/v1/workspaces/${WORKSPACE_ID}/invites` ||
      path === `/api/v1/workspaces/${WORKSPACE_ID}/join-requests`
    )
      return { items: [], hasMore: false };
    if (path === "/api/integrations")
      return { github: { connected: true, repositories: [], installations: [] } };
    if (path === "/api/v1/account/jev")
      return {
        enabled: false,
        eligible: false,
        available: false,
        monthlyBudgetUsd: "0.00",
        revision: 1,
      };
    if (path === "/api/v1/account/expense-retention")
      return { autoRemoveOldestExpense: false, revision: 1 };
    if (path === "/billing/plan")
      return {
        enabled: true,
        provider: "creem",
        currency: "USD",
        plans: [
          {
            id: "free",
            name: "Free",
            entitlements: null,
            prices: {
              month: { amount: "0", currency: "USD", interval: "month", configured: true },
            },
          },
        ],
        account: { status: "free", plan: "free", interval: "month" },
        ledgerUsage: {
          workspaceId: WORKSPACE_ID,
          projects: { used: 1, limit: 3 },
          expenseRecords: { used: 2, limit: 100 },
        },
      };
    return undefined;
  }
  return {
    setLongInbox() {
      longInbox = true;
    },
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());
      const record = {
        path: normalize(url.pathname),
        url: url.href,
        method: request.method(),
        resourceType: request.resourceType(),
        workspace: request.headers()["x-pullwise-workspace"] || null,
      };
      requests.push(record);
      try {
        assert(requests.length <= 160, "Mobile context request cap exceeded (160)");
        assert.equal(record.method, "GET", "Mobile fixtures allow only GET requests");
        const api =
          record.resourceType !== "document" && /^\/(?:api|auth|billing)(?:\/|$)/.test(record.path);
        record.api = api;
        assert(requests.filter((item) => item.api).length <= 80, "API GET cap exceeded (80)");
        if (url.origin !== base.origin) {
          // Core blocks known font requests and rejects every other destination.
          await core.handle(route);
          return;
        }
        if (!api)
          assert(
            record.resourceType === "document" ||
              /^\/(?:assets\/[^/]+\.(?:js|css|woff2?)|brand-mark\.png|favicon\.ico)$/.test(
                url.pathname
              ),
            `Unexpected local resource: ${url.pathname}`
          );
        const payload = api ? extraPayload(record.path) : undefined;
        if (payload === undefined) {
          await core.handle(route);
          return;
        }
        assert.equal(url.search, "", `Unexpected extra-fixture query: ${record.path}`);
        if (record.path === "/billing/plan" || record.path.startsWith("/api/v1/account/"))
          assert.equal(record.workspace, null, "Personal account read inherited workspace header");
        else if (record.workspace)
          assert.equal(record.workspace, WORKSPACE_ID, "Unexpected fixture workspace");
        record.extraFixture = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          headers: { "Cache-Control": "no-store" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        violations.push({ ...record, reason: error.message });
        await route.abort("blockedbyclient");
      }
    },
    recordResponse: core.recordResponse,
    snapshot() {
      return { requests, violations, core: core.getRequests() };
    },
    assertClean() {
      assert.deepEqual(violations, [], "Mobile fixture request violations");
      core.assertClean();
      return {
        total: requests.length,
        api: requests.filter((item) => item.api).length,
        blockedFonts: core.getRequests().counts.blockedFonts,
        writes: requests.filter((item) => item.method !== "GET").length,
        externalDelivered: core.getRequests().counts.externalDelivered,
      };
    },
  };
}
