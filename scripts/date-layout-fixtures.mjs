// Local layout evidence only. These DTOs follow openapi/ledger-v1.yaml and
// Server's default Free entitlements; they do not represent a real account.
export const PROJECT_ID = "prj_date_layout";
export const WORKSPACE_ID = "usr_date_layout";
export const EXPENSE_PURPOSE = "Existing hosting expense";
export const RULE_PURPOSE = "Recurring hosting schedule";
export const SECOND_RULE_PURPOSE = "Recurring backup schedule";
export const LARGE_RULE_AMOUNT = "90071992547409.91";
export const DEVELOPMENT_URL = "https://example.com/pullwise-layout/development";
export const PRODUCT_URL = "https://example.com/pullwise-layout/product";
export const LONG_CATEGORY_NAME =
  "InfrastructureHostingDomainsAndAIServiceCostsForSharedTeamOperations";
export const ARCHIVED_CATEGORY_NAME = "Retired subscriptions";

const CATEGORY_ID = "cat_date_hosting";
const CREATED_AT = "2026-09-01T00:00:00Z";
const workspace = {
  id: WORKSPACE_ID,
  ownerId: WORKSPACE_ID,
  name: "Pullwise preview team ledger",
  role: "owner",
  revision: 1,
  permissions: {
    writeExpenses: true,
    manageProjects: true,
    manageCategories: true,
    manageMembers: true,
    manageAdmins: true,
  },
};
const sharedWorkspace = {
  ...workspace,
  id: "usr_date_shared",
  ownerId: "usr_date_shared",
  name: "Shared operational ledger with a longer workspace name",
  role: "viewer",
  permissions: Object.fromEntries(
    Object.keys(workspace.permissions).map((permission) => [permission, false])
  ),
};
const project = {
  id: PROJECT_ID,
  name: "Date layout project",
  description: "Local hosting costs for native date-field layout checks.",
  githubRepoId: null,
  githubFullName: null,
  githubRepoIds: [],
  repositories: [],
  githubOrganizationId: null,
  githubOrganization: null,
  developmentUrl: DEVELOPMENT_URL,
  productUrl: PRODUCT_URL,
  status: "active",
  githubAccess: "not_linked",
  canCreateExpense: true,
  revision: 1,
  totals: [{ currency: "USD", amountMinor: 1200 }],
};
const categories = [
  { id: CATEGORY_ID, name: "Hosting", color: null, revision: 1, archivedAt: null },
  { id: "cat_date_long", name: LONG_CATEGORY_NAME, color: null, revision: 1, archivedAt: null },
  {
    id: "cat_date_archived",
    name: ARCHIVED_CATEGORY_NAME,
    color: null,
    revision: 2,
    archivedAt: "2026-09-30T00:00:00Z",
  },
];
const targets = [{ kind: "project", projectId: PROJECT_ID }, { kind: "shared" }];
const expenses = targets.map((target) => ({
  id: `exp_date_${target.kind}`,
  target,
  occurredOn: "2026-09-30",
  amount: "12.00",
  amountMinor: 1200,
  currency: "USD",
  categoryId: CATEGORY_ID,
  purpose: EXPENSE_PURPOSE,
  note: null,
  quantity: null,
  unit: null,
  revision: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}));
const rules = targets.map((target) => ({
  id: `rec_date_${target.kind}`,
  target,
  amount: "24.50",
  currency: "USD",
  categoryId: CATEGORY_ID,
  purpose: RULE_PURPOSE,
  note: null,
  quantity: null,
  unit: null,
  schedule: {
    frequency: "monthly",
    timezone: "Europe/Paris",
    startOn: "2026-09-01",
    endOn: "2027-12-31",
    day: 31,
  },
  status: "active",
  revision: 1,
  nextOccurrenceOn: "2026-10-31",
  // Paris is UTC+1 after the October daylight-saving transition.
  nextRunAt: Date.parse("2026-10-30T23:00:00Z") / 1000,
  blockedCode: null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}));
// Two records expose equal-row regressions when an editor is opened. Keep the
// fixtures read-only; their plans are never saved or scheduled on a real Server.
rules.push(
  ...rules.map((rule) => ({
    ...rule,
    id: `${rule.id}_backup`,
    purpose: SECOND_RULE_PURPOSE,
    // USD retains two decimals; the exact minor value is the Server's safe
    // integer upper bound. This is presentation evidence, never a write.
    amount: LARGE_RULE_AMOUNT,
  }))
);
const profile = {
  id: WORKSPACE_ID,
  workspace,
  scopes: [
    "profile:read",
    "projects:read",
    "projects:write",
    "categories:read",
    "categories:write",
    "expenses:read",
    "expenses:write",
    "reports:read",
    "suggestions:use",
  ],
  entitlements: {
    plan: "free",
    limits: { projects: 3, expenseRecords: 500, writesPerMinute: 10, writesPerMonth: 1000 },
    jev: {
      eligible: false,
      available: false,
      monthlyBudgetUsd: "0.00",
      period: "utc-calendar-month",
      rollover: false,
    },
  },
};

function normalizedPath(path) {
  return path
    .replace(/^\/api\/api\/v1(?=\/|$)/, "/api/v1")
    .replace(/^\/api\/auth(?=\/|$)/, "/auth");
}

function assertQuery(params, allowed) {
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) {
      throw new Error(`Unexpected fixture query field: ${key}`);
    }
  }
  if (params.has("cursor")) throw new Error("The one-page fixture has no pagination cursor.");
  if (params.has("limit") && !/^(?:[1-9][0-9]?|100)$/.test(params.get("limit"))) {
    throw new Error("Invalid fixture page limit.");
  }
  for (const name of ["from", "to"]) {
    const value = params.get(name);
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.startsWith("0000-") ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      throw new Error(`Invalid fixture ${name} date.`);
    }
  }
}

function fixedTarget(params) {
  if (params.get("target") === "shared" && !params.has("projectId")) return "shared";
  if (params.get("target") === "project" && params.get("projectId") === PROJECT_ID) {
    return "project";
  }
  throw new Error("Fixture reads require the current project or shared-pool target.");
}

function filteredExpenses(params) {
  const kind = fixedTarget(params);
  return expenses.filter(
    (row) =>
      row.target.kind === kind &&
      (!params.get("from") || row.occurredOn >= params.get("from")) &&
      (!params.get("to") || row.occurredOn < params.get("to")) &&
      (!params.get("categoryId") || row.categoryId === params.get("categoryId")) &&
      (!params.get("currency") || row.currency === params.get("currency"))
  );
}

function report(rows, dimension, params) {
  const groups = new Map();
  for (const row of rows) {
    const bucket =
      dimension === "timeseries"
        ? params.get("bucket") === "month"
          ? row.occurredOn.slice(0, 7)
          : row.occurredOn
        : null;
    const categoryId = dimension === "categories" ? row.categoryId : null;
    const key = `${row.target.kind}:${bucket}:${categoryId}:${row.currency}`;
    const group = groups.get(key) || {
      target: row.target.kind,
      projectId: row.target.projectId || null,
      categoryId,
      bucket,
      currency: row.currency,
      amountMinor: 0,
    };
    group.amountMinor += row.amountMinor;
    groups.set(key, group);
  }
  return { groups: [...groups.values()] };
}

function payloadFor(path, params) {
  if (path === "/api/api-keys") {
    assertQuery(params, ["workspaceId"]);
    if (params.get("workspaceId") !== WORKSPACE_ID) {
      throw new Error("API key fixtures require the current ledger workspaceId.");
    }
    return { apiKeys: [] };
  }
  if (path === "/auth/session") {
    assertQuery(params, []);
    return {
      authenticated: true,
      user: { id: WORKSPACE_ID, name: "Local fixture owner", githubLogin: "date-layout-fixture" },
    };
  }
  if (path === "/api/v1/me") {
    assertQuery(params, []);
    return profile;
  }
  if (path === "/api/v1/workspaces") {
    assertQuery(params, []);
    return { items: [workspace, sharedWorkspace] };
  }
  if (path === "/api/v1/workspace-invitation-requests") {
    assertQuery(params, []);
    return { items: [], hasMore: false };
  }
  if (path === "/api/v1/projects") {
    assertQuery(params, ["limit", "cursor"]);
    return { items: [project], nextCursor: null };
  }
  if (path === `/api/v1/projects/${PROJECT_ID}`) {
    assertQuery(params, []);
    return project;
  }
  if (path === "/api/v1/categories") {
    assertQuery(params, []);
    return categories;
  }
  if (path === "/api/v1/expense-recurring-rules") {
    assertQuery(params, ["target", "projectId", "limit", "cursor"]);
    return {
      items: rules.filter((rule) => rule.target.kind === fixedTarget(params)),
      nextCursor: null,
    };
  }
  const reportKind =
    path === "/api/v1/reports/timeseries"
      ? "timeseries"
      : path === "/api/v1/reports/categories"
        ? "categories"
        : null;
  if (path === "/api/v1/expenses" || reportKind) {
    assertQuery(params, [
      "target",
      "projectId",
      "from",
      "to",
      "categoryId",
      "currency",
      ...(reportKind ? [] : ["limit", "cursor"]),
      ...(reportKind === "timeseries" ? ["bucket"] : []),
    ]);
    if (params.has("bucket") && !["day", "month"].includes(params.get("bucket"))) {
      throw new Error("Invalid fixture timeseries bucket.");
    }
    const rows = filteredExpenses(params);
    return reportKind ? report(rows, reportKind, params) : { items: rows, nextCursor: null };
  }
  return undefined;
}

function isBlockedFont(url, resourceType) {
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    ((url.hostname === "fonts.googleapis.com" && resourceType === "stylesheet") ||
      (url.hostname === "fonts.gstatic.com" && resourceType === "font"))
  );
}

// Create exactly one guard per BrowserContext. Install its handle with
// context.route("**/*", handle) and observe context.on("response", recordResponse).
// The cap includes every intercepted request, not just fixture/API GETs.
export function createDateLayoutFixture({ baseURL, cap = 100 }) {
  const base = new URL(baseURL);
  if (
    base.protocol !== "http:" ||
    base.port !== "4248" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("Date layout fixtures require a loopback HTTP origin on port 4248.");
  }
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) {
    throw new Error("Date layout fixture cap must be an integer from 1 to 100.");
  }
  const requests = [];
  const blockedFonts = [];
  const violations = [];
  const externalDelivered = [];

  async function handle(route) {
    const request = route.request();
    const record = {
      index: requests.length + 1,
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      workspaceHeader: request.headers()["x-pullwise-workspace"] || null,
      kind: "unclassified",
      outcome: "pending",
    };
    requests.push(record);
    try {
      const url = new URL(record.url);
      record.path = normalizedPath(url.pathname);
      if (requests.length > cap)
        throw new Error(`Request cap exceeded: ${requests.length}/${cap}.`);
      if (record.method !== "GET") throw new Error("Only GET requests are allowed.");
      if (url.origin !== base.origin) {
        if (isBlockedFont(url, record.resourceType)) {
          record.kind = "blocked-font";
          record.outcome = "aborted";
          blockedFonts.push(record);
          await route.abort("blockedbyclient");
          return;
        }
        record.kind = "external";
        throw new Error("External requests are forbidden.");
      }
      record.kind = /^\/(?:api|auth)(?:\/|$)/.test(record.path) ? "api" : "static";
      if (record.kind === "static") {
        record.outcome = "continued";
        await route.continue();
        return;
      }
      if (record.workspaceHeader && record.workspaceHeader !== WORKSPACE_ID) {
        throw new Error("Unexpected fixture ledger selection.");
      }
      const payload = payloadFor(record.path, url.searchParams);
      if (payload === undefined) throw new Error(`Missing GET fixture: ${record.path}.`);
      record.outcome = "fulfilled";
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      record.outcome = "aborted";
      record.reason = error.message;
      violations.push(record);
      try {
        await route.abort("blockedbyclient");
      } catch (abortError) {
        record.abortError = abortError.message;
      }
    }
  }

  function recordResponse(response) {
    if (new URL(response.url()).origin === base.origin) return;
    externalDelivered.push({ url: response.url(), status: response.status() });
  }

  function getRequests() {
    return structuredClone({
      requests,
      counts: {
        total: requests.length,
        api: requests.filter((request) => request.kind === "api").length,
        static: requests.filter((request) => request.kind === "static").length,
        blockedFonts: blockedFonts.length,
        violations: violations.length,
        externalDelivered: externalDelivered.length,
      },
      blockedFonts,
      violations,
      externalDelivered,
    });
  }

  function assertClean() {
    const snapshot = getRequests();
    if (violations.length || externalDelivered.length || requests.length > cap) {
      throw new Error(
        `Date layout request guard failed: ${JSON.stringify({
          counts: snapshot.counts,
          violations: snapshot.violations,
          externalDelivered: snapshot.externalDelivered,
          blockedFonts: snapshot.blockedFonts,
        })}`
      );
    }
    return snapshot;
  }

  return { handle, recordResponse, getRequests, assertClean };
}
