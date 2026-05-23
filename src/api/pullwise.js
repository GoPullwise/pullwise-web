import { request } from "./http.js";

function withSearchParams(path, params = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
  const search = new URLSearchParams(cleanParams).toString();
  return search ? `${path}?${search}` : path;
}

export const pullwiseApi = {
  auth: {
    getSession: () => request("/auth/session"),
    signOut: () => request("/auth/sign-out", { method: "POST" }),
    getGitHubAuthorizeUrl: (params = {}) =>
      request(withSearchParams("/auth/github/authorize", params)),
  },

  repositories: {
    list: (params = {}) => request(withSearchParams("/repositories", params)),
    sync: () => request("/repositories/sync", { method: "POST" }),
  },

  scans: {
    create: (payload) => request("/scans", { method: "POST", body: payload }),
    get: (scanId) => request(`/scans/${scanId}`),
    list: (params = {}) => request(withSearchParams("/scans", params)),
    cancel: (scanId) => request(`/scans/${scanId}/cancel`, { method: "POST" }),
  },

  issues: {
    list: (params = {}) => request(withSearchParams("/issues", params)),
    get: (issueId) => request(`/issues/${issueId}`),
    updateStatus: (issueId, payload) =>
      request(`/issues/${issueId}/status`, { method: "PATCH", body: payload }),
  },

  integrations: {
    list: () => request("/integrations"),
    getGitHubAuthorizeUrl: (params = {}) =>
      request(withSearchParams("/integrations/github/authorize", params)),
    disconnect: (provider) => request(`/integrations/${provider}`, { method: "DELETE" }),
  },

  settings: {
    get: () => request("/settings"),
    update: (payload) => request("/settings", { method: "PATCH", body: payload }),
  },

  billing: {
    getPlan: () => request("/billing/plan"),
    createCheckoutSession: (payload = {}) =>
      request("/billing/checkout-sessions", { method: "POST", body: payload }),
    createPortalSession: (payload = {}) =>
      request("/billing/portal-sessions", { method: "POST", body: payload }),
  },

  system: {
    health: () => request("/health"),
  },

};
