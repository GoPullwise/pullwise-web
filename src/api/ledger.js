import { request } from "./http.js";

// The Web base is /api. The Worker removes only that proxy prefix, so the
// Server receives /api/v1/... and OAuth continues to use /auth/....
const ledgerRequest = (path, options) => request(`/api/v1${path}`, options);
const resource = (kind, id) => `/${kind}/${encodeURIComponent(id)}`;
const version = (revision) => ({ "If-Match": `"${revision}"` });

export const ledgerApi = {
  me: (options) => ledgerRequest("/me", options),
  repositories: (params, options) => ledgerRequest("/repositories", { ...options, params }),
  projects: (params, options) => ledgerRequest("/projects", { ...options, params }),
  project: (id, options) => ledgerRequest(resource("projects", id), options),
  createProject: (fields, options) => ledgerRequest("/projects", { ...options, method: "POST", body: fields }),
  updateProject: (id, revision, fields, options) => ledgerRequest(resource("projects", id), {
    ...options, method: "PATCH", headers: { ...options?.headers, ...version(revision) }, body: fields,
  }),
  categories: (options) => ledgerRequest("/categories", options),
  createCategory: (fields, options) => ledgerRequest("/categories", { ...options, method: "POST", body: fields }),
  updateCategory: (id, revision, fields, options) => ledgerRequest(resource("categories", id), {
    ...options, method: "PATCH", headers: { ...options?.headers, ...version(revision) }, body: fields,
  }),
  archiveCategory: (id, revision, options) => ledgerRequest(resource("categories", id), {
    ...options, method: "DELETE", headers: { ...options?.headers, ...version(revision) },
  }),
  expenses: (params, options) => ledgerRequest("/expenses", { ...options, params }),
  expense: (id, options) => ledgerRequest(resource("expenses", id), options),
  createExpense: (fields, idempotencyKey, options) => ledgerRequest("/expenses", {
    ...options, method: "POST", headers: { ...options?.headers, "Idempotency-Key": idempotencyKey }, body: fields,
  }),
  updateExpense: (id, revision, fields, options) => ledgerRequest(resource("expenses", id), {
    ...options, method: "PATCH", headers: { ...options?.headers, ...version(revision) }, body: fields,
  }),
  removeExpense: (id, revision, options) => ledgerRequest(resource("expenses", id), {
    ...options, method: "DELETE", headers: { ...options?.headers, ...version(revision) },
  }),
  exportExpenses: (params, options) => ledgerRequest("/expenses/export", { ...options, params, responseType: "blob" }),
  reportSummary: (params, options) => ledgerRequest("/reports/summary", { ...options, params }),
  reportTimeseries: (params, options) => ledgerRequest("/reports/timeseries", { ...options, params }),
  reportCategories: (params, options) => ledgerRequest("/reports/categories", { ...options, params }),
  suggestExpense: (fields, options) => ledgerRequest("/expense-suggestions", { ...options, method: "POST", body: fields }),
};
