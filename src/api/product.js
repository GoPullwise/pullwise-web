import { request } from "./http.js";

async function productRequest(path, options) {
  try {
    return await request(`/v1${path}`, options);
  } catch (error) {
    if (error.payload?.error) {
      error.code = error.payload.error.code || error.code;
      error.message = error.payload.error.message || error.message;
    }
    throw error;
  }
}

export const productApi = {
  overview: (params, options) => productRequest("/items/overview", { ...options, params }),
  usage: (options) => productRequest("/usage", options),
  visualizations: (params, options) => productRequest("/visualizations", { ...options, params }),
  prActions: (params, options) => productRequest("/visualizations", { ...options, params }),
  ciFailures: (params, options) => productRequest("/visualizations", { ...options, params }),
  updatesReleases: (params, options) => productRequest("/visualizations", { ...options, params }),
  items: (params, options) => productRequest("/items", { ...options, params }),
  sources: (params, options) => productRequest("/sources", { ...options, params }),
  repositories: (options) => productRequest("/repositories", options),
  repositoryPage: (params, options) => productRequest("/repositories", {...options, params}),
  repositoryService: (id, options) => productRequest(`/repositories/${encodeURIComponent(id)}/service`, options),
  saveRepositoryService: (id, revision, fields, options) => productRequest(`/repositories/${encodeURIComponent(id)}/service`, {
    ...options, method: "PUT", headers: { "If-Match": `"${revision}"` }, body: fields,
  }),
  watches: (options) => productRequest("/watches", options),
  watchPage: (params, options) => productRequest("/watches", {...options, params}),
  createWatch: (fields, idempotencyKey, options) => productRequest("/watches", {
    ...options, method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: fields,
  }),
  updateWatch: (id, revision, fields, options) => productRequest(`/watches/${encodeURIComponent(id)}`, {
    ...options, method: "PATCH", headers: { "If-Match": `"${revision}"` }, body: fields,
  }),
  archiveWatch: (id, revision, options) => productRequest(`/watches/${encodeURIComponent(id)}`, {
    ...options, method: "DELETE", headers: { "If-Match": `"${revision}"` },
  }),
  syncRepository: (id, idempotencyKey, options) => productRequest(`/repositories/${encodeURIComponent(id)}/sync`, {
    ...options, method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: {},
  }),
  syncWatch: (id, idempotencyKey, options) => productRequest(`/watches/${encodeURIComponent(id)}/sync`, {
    ...options, method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: {},
  }),
  job: (id, options) => productRequest(`/jobs/${encodeURIComponent(id)}`, options),
  item: (id, options) => productRequest(`/items/${encodeURIComponent(id)}`, options),
  itemTimeline: (id, params, options) => productRequest(`/items/${encodeURIComponent(id)}/timeline`, { ...options, params }),
  source: (id, options) => productRequest(`/sources/${encodeURIComponent(id)}`, options),
  handle: (item, fields, options) => productRequest(`/items/${encodeURIComponent(item.id)}`, {
    ...options, method: "PATCH", headers: { "If-Match": `"${item.revision}"` },
    body: { ...fields, itemVersion: item.itemVersion },
  }),
};
