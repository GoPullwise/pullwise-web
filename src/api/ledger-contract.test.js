import { afterEach, describe, expect, it, vi } from "vitest";
import contract from "../data/api-contract.json";
import { API_KEY_SCOPE_VALUES } from "../screens/ledger-api-scopes.js";
import { createLedgerApi } from "./ledger.js";
import { http } from "./http.js";
import { pullwiseApi } from "./pullwise.js";

const WORKSPACE = "contract_owner";
const PROJECT = "prj_contract";
const CATEGORY = "cat_contract";
const REVISION = 7;
const EXPENSE_FIELDS = {
  occurredOn: "2026-10-09", amount: "12.30", currency: "USD",
  categoryId: CATEGORY, purpose: "Contract fixture hosting",
};
const RULE_FIELDS = {
  amount: "12.30", currency: "USD", categoryId: CATEGORY, purpose: "Contract fixture hosting",
  schedule: { frequency: "monthly", timezone: "Asia/Shanghai", startOn: "2026-10-09", day: 31 },
};

// Bind product actions to stable OpenAPI operation IDs, not duplicated URL
// strings. The requests below are captured from the real Web adapter.
const ACCOUNT_AND_PROJECT_ACTIONS = [
  ["workspaces", "listWorkspaces", []],
  ["members", "listWorkspaceMembers", [WORKSPACE]],
  ["updateMember", "updateWorkspaceMember", [WORKSPACE, "member_contract", REVISION, { role: "viewer" }]],
  ["removeMember", "removeWorkspaceMember", [WORKSPACE, "member_contract", REVISION]],
  ["invites", "listWorkspaceInvites", [WORKSPACE]],
  ["inviteMember", "inviteWorkspaceMember", [WORKSPACE, { role: "editor" }]],
  ["revokeInvite", "revokeWorkspaceInvitation", [WORKSPACE, "invite_contract", REVISION]],
  ["previewInvitation", "previewWorkspaceInvitation", [{ token: `pwi_${"a".repeat(43)}` }]],
  ["acceptInvitation", "acceptWorkspaceInvitation", [{ token: `pwi_${"a".repeat(43)}` }]],
  ["invitationRequests", "listWorkspaceInvitationRequests", []],
  ["recurringExpenseNotifications", "listRecurringExpenseNotifications", []],
  ["workspaceInvitationRequests", "listWorkspaceJoinRequests", [WORKSPACE]],
  ["inviteRequests", "listWorkspaceInvitationJoinRequests", [WORKSPACE, "invite_contract"]],
  ["approveInviteRequest", "approveWorkspaceJoinRequest", [WORKSPACE, "invite_contract", "request_contract", REVISION]],
  ["rejectInviteRequest", "rejectWorkspaceJoinRequest", [WORKSPACE, "invite_contract", "request_contract", REVISION]],
  ["me", "getLedgerMe", []],
  ["repositories", "listLedgerRepositories", [{ limit: 50 }]],
  ["projects", "listLedgerProjects", [{ limit: 50 }]],
  ["project", "getLedgerProject", [PROJECT]],
  ["createProject", "createLedgerProject", [{ name: "Contract project", githubRepoIds: [], productUrl: "https://example.com/product" }]],
  ["updateProject", "updateLedgerProject", [PROJECT, REVISION, { name: "Updated contract project", status: "archived" }]],
  ["removeProject", "removeLedgerProject", [PROJECT, REVISION]],
  ["categories", "listExpenseCategories", []],
  ["createCategory", "createExpenseCategory", [{ name: "Hosting" }]],
  ["updateCategory", "updateExpenseCategory", [CATEGORY, REVISION, { name: "Cloud hosting" }]],
  ["archiveCategory", "archiveExpenseCategory", [CATEGORY, REVISION]],
  ["removeCategory", "removeExpenseCategory", [CATEGORY, REVISION]],
  ["suggestDecision", "recordExpenseSuggestionDecision", ["suggestion_contract", { categoryId: CATEGORY, target: { kind: "shared" } }]],
];

function targetActions(kind) {
  const target = kind === "project" ? { kind, projectId: PROJECT } : { kind };
  const query = { target: kind, ...(kind === "project" ? { projectId: PROJECT } : {}) };
  const expense = { ...EXPENSE_FIELDS, target };
  const rule = { ...RULE_FIELDS, target };
  return [
    ["activity", "listLedgerActivity", [{ ...query, limit: 50 }]],
    ["expenses", "listExpenses", [{ ...query, limit: 50 }]],
    ["expense", "getExpense", [`exp_${kind}`]],
    ["reviewExpense", "reviewExpense", [`exp_${kind}`, REVISION]],
    ["createExpense", "createExpense", [expense, `${kind}-expense-contract`]],
    ["updateExpense", "updateExpense", [`exp_${kind}`, REVISION, expense]],
    ["removeExpense", "removeExpense", [`exp_${kind}`, REVISION]],
    ["recurringRules", "listRecurringExpenseRules", [{ ...query, limit: 50 }]],
    ["recurringRule", "getRecurringExpenseRule", [`rule_${kind}`]],
    ["createRecurringRule", "createRecurringExpenseRule", [rule, `${kind}-rule-contract`]],
    ["updateRecurringRule", "updateRecurringExpenseRule", [`rule_${kind}`, REVISION, rule]],
    ["updateRecurringRule", "updateRecurringExpenseRule", [`rule_${kind}`, REVISION, { status: "paused" }]],
    ["updateRecurringRule", "updateRecurringExpenseRule", [`rule_${kind}`, REVISION, { status: "active" }]],
    ["updateRecurringRule", "updateRecurringExpenseRule", [`rule_${kind}`, REVISION, { retryPeriodKey: "M2026-09" }]],
    ["removeRecurringRule", "cancelRecurringExpenseRule", [`rule_${kind}`, REVISION]],
    ["exportExpenses", "exportExpenses", [query]],
    ["reportSummary", "getLedgerSummary", [query]],
    ["reportTimeseries", "getLedgerTimeseries", [query]],
    ["reportCategories", "getLedgerCategoriesReport", [query]],
    ["suggestExpense", "suggestExpense", [{ purpose: EXPENSE_FIELDS.purpose, target }]],
  ];
}

function resolveReference(value) {
  if (!value?.$ref) return value;
  expect(value.$ref).toMatch(/^#\//);
  return value.$ref.slice(2).split("/").reduce((part, key) => part?.[key], contract);
}

function matchDocumentedResource(url) {
  const concrete = url.split("/");
  return Object.entries(contract.paths).map(([path, item]) => {
    const template = path.split("/");
    if (template.length !== concrete.length) return null;
    const params = {};
    for (let index = 0; index < template.length; index += 1) {
      const segment = template[index];
      if (/^\{[^}]+\}$/.test(segment)) params[segment.slice(1, -1)] = decodeURIComponent(concrete[index]);
      else if (segment !== concrete[index]) return null;
    }
    return { path, item, params };
  }).filter(Boolean).sort((left, right) => Object.keys(left.params).length - Object.keys(right.params).length)[0];
}

// Check documented required fields through references and union/composed
// schemas. Server tests own complete input validation and business rules.
function hasRequiredFields(reference, value) {
  const schema = resolveReference(reference);
  if (!schema) return false;
  if (schema.allOf && !schema.allOf.every((part) => hasRequiredFields(part, value))) return false;
  const alternatives = schema.oneOf || schema.anyOf;
  if (alternatives && !alternatives.some((part) => hasRequiredFields(part, value))) return false;
  if (Object.hasOwn(schema, "const") && schema.const !== value) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.required?.some((field) => !value || !Object.hasOwn(value, field))) return false;
  return Object.entries(schema.properties || {}).every(([field, nested]) =>
    !value || !Object.hasOwn(value, field) || hasRequiredFields(nested, value[field])
  );
}

function assertDocumentedCall(call, operationId) {
  const resource = matchDocumentedResource(call.url);
  expect(resource, `${call.method} ${call.url} must be documented`).toBeTruthy();
  const operation = resource.item[call.method.toLowerCase()];
  expect(operation, `${call.method} must exist on ${resource.path}`).toBeTruthy();
  expect(operation.operationId).toBe(operationId);
  const accountInbox = operationId === "listRecurringExpenseNotifications";
  if (accountInbox) expect(operation["x-pullwise-scope"]).toBe("account:auth");
  else expect(API_KEY_SCOPE_VALUES).toContain(operation["x-pullwise-scope"]);
  expect(call.headers["X-Pullwise-Workspace"]).toBe(WORKSPACE);

  const security = operation.security || contract.security;
  const browserIdentityOnly = ["previewWorkspaceInvitation", "acceptWorkspaceInvitation", "listRecurringExpenseNotifications"].includes(operationId);
  expect(security.some((requirement) => Object.hasOwn(requirement, "bearerKey"))).toBe(!browserIdentityOnly);
  expect(security.some((requirement) => Object.hasOwn(requirement, "cookieSession"))).toBe(true);

  for (const reference of [...resource.item.parameters || [], ...operation.parameters || []]) {
    const parameter = resolveReference(reference);
    const value = parameter.in === "header" ? call.headers?.[parameter.name]
      : parameter.in === "query" ? call.params?.[parameter.name] : resource.params[parameter.name];
    if (parameter.required) expect(value, `${operationId} requires ${parameter.in} ${parameter.name}`).toBeDefined();
    if (value !== undefined && parameter.schema?.pattern) expect(String(value)).toMatch(new RegExp(parameter.schema.pattern));
  }
  const requestBody = resolveReference(operation.requestBody);
  if (requestBody?.required) expect(call.data, `${operationId} requires a body`).toBeDefined();
  if (call.data !== undefined) {
    const schema = requestBody?.content?.["application/json"]?.schema;
    expect(schema, `${operationId} must document its JSON body`).toBeTruthy();
    expect(hasRequiredFields(schema, call.data), `${operationId} must send the documented fields`).toBe(true);
  }
  if (call.responseType === "blob") {
    expect(Object.values(operation.responses).some((response) => resolveReference(response)?.content?.["text/csv"])).toBe(true);
  }
}

afterEach(() => vi.restoreAllMocks());

describe("Web ledger actions remain covered by the published REST contract", () => {
  const api = createLedgerApi(WORKSPACE);

  it("requires a contract workflow for every Web ledger adapter action", () => {
    const actions = [...ACCOUNT_AND_PROJECT_ACTIONS, ...targetActions("project"), ...targetActions("shared")];
    expect(new Set(actions.map(([name]) => name))).toEqual(new Set(Object.keys(api)));
  });

  it.each(ACCOUNT_AND_PROJECT_ACTIONS)("documents %s through %s", async (name, operationId, args) => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    await api[name](...args);
    expect(send).toHaveBeenCalledOnce();
    assertDocumentedCall(send.mock.calls[0][0], operationId);
  });

  it.each(["project", "shared"])("covers %s expense CRUD, recurring edit/pause/resume/cancel and reports", async (kind) => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const actions = targetActions(kind);
    for (const [name, operationId, args] of actions) {
      await api[name](...args);
      assertDocumentedCall(send.mock.lastCall[0], operationId);
    }
    expect(send).toHaveBeenCalledTimes(actions.length);
  });
});

describe("personal Settings actions remain covered by the published account contract", () => {
  const actions = [
    ["getJev", "getAccountJevPreference", null],
    ["updateJev", "updateAccountJevPreference", "enabled"],
    ["getExpenseRetention", "getAccountExpenseRetentionPreference", null],
    ["updateExpenseRetention", "updateAccountExpenseRetentionPreference", "autoRemoveOldestExpense"],
  ];

  it("requires a documented account workflow for every personal preference action", () => {
    expect(new Set(actions.map(([name]) => name))).toEqual(new Set(Object.keys(pullwiseApi.account)));
  });

  it.each(actions)("documents the actual %s request through %s", async (name, operationId, field) => {
    const send = vi.spyOn(http, "request").mockResolvedValue({ data: {} });
    const options = { workspaceId: "another_owner", headers: { "X-Pullwise-Workspace": "another_owner", Authorization: "Bearer must_not_forward" } };
    for (const enabled of field ? [false, true] : [undefined]) {
      if (field) await pullwiseApi.account[name](REVISION, enabled, options);
      else await pullwiseApi.account[name](options);
      const call = send.mock.lastCall[0];
      const resource = matchDocumentedResource(call.url);
      expect(resource, `${name} must be documented`).toBeTruthy();
      const operation = resource.item[call.method.toLowerCase()];
      expect(operation?.operationId).toBe(operationId);
      expect(operation["x-pullwise-scope"]).toBe("account:auth");
      expect(operation.security).toEqual([{ cookieSession: [] }]);
      expect(call.headers?.["X-Pullwise-Workspace"]).toBeUndefined();
      expect(call.headers?.Authorization).toBeUndefined();
      expect(call.params).toBeUndefined();
      if (field) {
        const parameters = [...resource.item.parameters || [], ...operation.parameters || []].map(resolveReference);
        expect(parameters.find((parameter) => parameter.name === "If-Match")?.required).toBe(true);
        expect(call.headers["If-Match"]).toBe(`"${REVISION}"`);
        expect(call.data).toEqual({ [field]: enabled });
        const schema = resolveReference(operation.requestBody)?.content?.["application/json"]?.schema;
        expect(hasRequiredFields(schema, call.data)).toBe(true);
        expect(resolveReference(schema).properties[field].type).toBe("boolean");
      } else expect(call.data).toBeUndefined();
    }
    expect(send).toHaveBeenCalledTimes(field ? 2 : 1);
  });
});
