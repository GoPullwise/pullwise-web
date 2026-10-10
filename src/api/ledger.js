import { request } from "./http.js";
import { withGitHubRefresh } from "./github-refresh.js";

// The Web base is /api. The Worker removes only that proxy prefix, so the
// Server receives /api/v1/... and OAuth continues to use /auth/....
const resource = (kind, id) => `/${kind}/${encodeURIComponent(id)}`;
const version = (revision) => ({ "If-Match": `"${revision}"` });

export function createLedgerApi(workspaceId, onAccessChanged, githubRefreshScope) {
  // Capture the ledger for this view. In-flight requests never inherit a later
  // picker selection, and account/billing requests use their own API client.
  const ledgerRequest = async (path, options = {}) => {
    try {
      return await request(`/api/v1${path}`, {
        ...options,
        ...(workspaceId
          ? { headers: { ...options.headers, "X-Pullwise-Workspace": workspaceId } }
          : {}),
      });
    } catch (error) {
      if (
        !path.startsWith("/workspace-invitation") &&
        [
          "ROLE_FORBIDDEN",
          "AUTHORIZATION_CHANGED",
          "WORKSPACE_MEMBERSHIP_CHANGED",
          "WORKSPACE_NOT_FOUND",
          "WORKSPACE_FORBIDDEN",
        ].includes(error?.code || error?.payload?.error?.code)
      )
        onAccessChanged?.(error);
      throw error;
    }
  };
  const githubRead = (path, options = {}) =>
    withGitHubRefresh(() => ledgerRequest(path, options), {
      signal: options.signal,
      ...(githubRefreshScope !== undefined ? { scope: githubRefreshScope } : {}),
    });
  return {
    workspaces: (options) => ledgerRequest("/workspaces", options),
    members: (id, options) =>
      ledgerRequest(`/workspaces/${encodeURIComponent(id)}/members`, options),
    updateMember: (id, userId, revision, fields, options) =>
      ledgerRequest(`/workspaces/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
        ...options,
        method: "PATCH",
        headers: { ...options?.headers, ...version(revision) },
        body: fields,
      }),
    removeMember: (id, userId, revision, options) =>
      ledgerRequest(`/workspaces/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, {
        ...options,
        method: "DELETE",
        headers: { ...options?.headers, ...version(revision) },
      }),
    invites: (id, options) =>
      ledgerRequest(`/workspaces/${encodeURIComponent(id)}/invites`, options),
    inviteMember: (id, fields, options) =>
      ledgerRequest(`/workspaces/${encodeURIComponent(id)}/invites`, {
        ...options,
        method: "POST",
        body: fields,
      }),
    revokeInvite: (id, inviteId, revision, options) =>
      ledgerRequest(
        `/workspaces/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`,
        {
          ...options,
          method: "DELETE",
          headers: { ...options?.headers, ...version(revision) },
        }
      ),
    previewInvitation: (fields, options) =>
      ledgerRequest("/workspace-invitations/preview", { ...options, method: "POST", body: fields }),
    acceptInvitation: (fields, options) =>
      ledgerRequest("/workspace-invitations/accept", { ...options, method: "POST", body: fields }),
    invitationRequests: (options) => ledgerRequest("/workspace-invitation-requests", options),
    recurringExpenseNotifications: (options) =>
      ledgerRequest("/recurring-expense-notifications", options),
    workspaceInvitationRequests: (id, options) =>
      ledgerRequest(`/workspaces/${encodeURIComponent(id)}/join-requests`, options),
    inviteRequests: (id, inviteId, options) =>
      ledgerRequest(
        `/workspaces/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}/requests`,
        options
      ),
    approveInviteRequest: (id, inviteId, requestId, revision, options) =>
      ledgerRequest(
        `/workspaces/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}/requests/${encodeURIComponent(requestId)}/approve`,
        {
          ...options,
          method: "POST",
          headers: { ...options?.headers, ...version(revision) },
          body: {},
        }
      ),
    rejectInviteRequest: (id, inviteId, requestId, revision, options) =>
      ledgerRequest(
        `/workspaces/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}/requests/${encodeURIComponent(requestId)}/reject`,
        {
          ...options,
          method: "POST",
          headers: { ...options?.headers, ...version(revision) },
          body: {},
        }
      ),
    me: (options) => ledgerRequest("/me", options),
    repositories: (params, options) => githubRead("/repositories", { ...options, params }),
    projects: (params, options) => githubRead("/projects", { ...options, params }),
    project: (id, options) => githubRead(resource("projects", id), options),
    activity: (params, options) => ledgerRequest("/activity", { ...options, params }),
    createProject: (fields, options) =>
      ledgerRequest("/projects", { ...options, method: "POST", body: fields }),
    updateProject: (id, revision, fields, options) =>
      ledgerRequest(resource("projects", id), {
        ...options,
        method: "PATCH",
        headers: { ...options?.headers, ...version(revision) },
        body: fields,
      }),
    removeProject: (id, revision, options) =>
      ledgerRequest(resource("projects", id), {
        ...options,
        method: "DELETE",
        headers: { ...options?.headers, ...version(revision) },
      }),
    categories: (options) => ledgerRequest("/categories", options),
    createCategory: (fields, options) =>
      ledgerRequest("/categories", { ...options, method: "POST", body: fields }),
    updateCategory: (id, revision, fields, options) =>
      ledgerRequest(resource("categories", id), {
        ...options,
        method: "PATCH",
        headers: { ...options?.headers, ...version(revision) },
        body: fields,
      }),
    archiveCategory: (id, revision, options) =>
      ledgerRequest(resource("categories", id), {
        ...options,
        method: "DELETE",
        headers: { ...options?.headers, ...version(revision) },
      }),
    removeCategory: (id, revision, options) =>
      ledgerRequest(`${resource("categories", id)}/remove`, {
        ...options,
        method: "POST",
        headers: { ...options?.headers, ...version(revision) },
        body: {},
      }),
    expenses: (params, options) => ledgerRequest("/expenses", { ...options, params }),
    expense: (id, options) => ledgerRequest(resource("expenses", id), options),
    reviewExpense: (id, revision, options) =>
      ledgerRequest(`${resource("expenses", id)}/review`, {
        ...options,
        method: "POST",
        headers: { ...options?.headers, ...version(revision) },
        body: {},
      }),
    createExpense: (fields, idempotencyKey, options) =>
      ledgerRequest("/expenses", {
        ...options,
        method: "POST",
        headers: { ...options?.headers, "Idempotency-Key": idempotencyKey },
        body: fields,
      }),
    updateExpense: (id, revision, fields, options) =>
      ledgerRequest(resource("expenses", id), {
        ...options,
        method: "PATCH",
        headers: { ...options?.headers, ...version(revision) },
        body: fields,
      }),
    removeExpense: (id, revision, options) =>
      ledgerRequest(resource("expenses", id), {
        ...options,
        method: "DELETE",
        headers: { ...options?.headers, ...version(revision) },
      }),
    recurringRules: (params, options) =>
      ledgerRequest("/expense-recurring-rules", { ...options, params }),
    recurringRule: (id, options) => ledgerRequest(resource("expense-recurring-rules", id), options),
    createRecurringRule: (fields, idempotencyKey, options) =>
      ledgerRequest("/expense-recurring-rules", {
        ...options,
        method: "POST",
        headers: { ...options?.headers, "Idempotency-Key": idempotencyKey },
        body: fields,
      }),
    updateRecurringRule: (id, revision, fields, options) =>
      ledgerRequest(resource("expense-recurring-rules", id), {
        ...options,
        method: "PATCH",
        headers: { ...options?.headers, ...version(revision) },
        body: fields,
      }),
    removeRecurringRule: (id, revision, options) =>
      ledgerRequest(resource("expense-recurring-rules", id), {
        ...options,
        method: "DELETE",
        headers: { ...options?.headers, ...version(revision) },
      }),
    exportExpenses: (params, options) =>
      ledgerRequest("/expenses/export", { ...options, params, responseType: "blob" }),
    reportSummary: (params, options) => ledgerRequest("/reports/summary", { ...options, params }),
    reportTimeseries: (params, options) =>
      ledgerRequest("/reports/timeseries", { ...options, params }),
    reportCategories: (params, options) =>
      ledgerRequest("/reports/categories", { ...options, params }),
    suggestExpense: (fields, options) =>
      ledgerRequest("/expense-suggestions", { ...options, method: "POST", body: fields }),
    suggestDecision: (id, fields, options) =>
      ledgerRequest(`/expense-suggestions/${encodeURIComponent(id)}/decision`, {
        ...options,
        method: "POST",
        body: fields,
      }),
  };
}

export const ledgerApi = createLedgerApi();
