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
  visualizations: (params, options) => productRequest("/visualizations", { ...options, params }),
  prActions: (params, options) => productRequest("/visualizations", { ...options, params }),
  ciFailures: (params, options) => productRequest("/visualizations", { ...options, params }),
  updatesReleases: (params, options) => productRequest("/visualizations", { ...options, params }),
  items: (params, options) => productRequest("/items", { ...options, params }),
  sources: (params, options) => productRequest("/sources", { ...options, params }),
  repositories: (options) => productRequest("/repositories", options),
  watches: (options) => productRequest("/watches", options),
  item: (id, options) => productRequest(`/items/${encodeURIComponent(id)}`, options),
  itemTimeline: (id, params, options) => productRequest(`/items/${encodeURIComponent(id)}/timeline`, { ...options, params }),
  source: (id, options) => productRequest(`/sources/${encodeURIComponent(id)}`, options),
  handle: (item, fields, options) => productRequest(`/items/${encodeURIComponent(item.id)}`, {
    ...options, method: "PATCH", headers: { "If-Match": `"${item.revision}"` },
    body: { ...fields, itemVersion: item.itemVersion },
  }),
};
