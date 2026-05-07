import { request } from "./http.js";

export const pullwiseApi = {
  auth: {
    getSession: () => request("/auth/session"),
    signInWithEmail: (payload) => request("/auth/email", { method: "POST", body: payload }),
    signOut: () => request("/auth/sign-out", { method: "POST" }),
    getGitHubAuthorizeUrl: (scope) =>
      request(`/auth/github/authorize?scope=${encodeURIComponent(scope || "all")}`),
  },

  repositories: {
    list: (params = {}) => request(`/repositories?${new URLSearchParams(params)}`),
    sync: () => request("/repositories/sync", { method: "POST" }),
  },

  scans: {
    create: (payload) => request("/scans", { method: "POST", body: payload }),
    get: (scanId) => request(`/scans/${scanId}`),
    list: (params = {}) => request(`/scans?${new URLSearchParams(params)}`),
    cancel: (scanId) => request(`/scans/${scanId}/cancel`, { method: "POST" }),
  },

  issues: {
    list: (params = {}) => request(`/issues?${new URLSearchParams(params)}`),
    get: (issueId) => request(`/issues/${issueId}`),
    updateStatus: (issueId, payload) =>
      request(`/issues/${issueId}/status`, { method: "PATCH", body: payload }),
  },

  fixes: {
    apply: (issueId, payload) => request(`/issues/${issueId}/fixes/apply`, { method: "POST", body: payload }),
    createPullRequest: (issueId, payload) =>
      request(`/issues/${issueId}/pull-requests`, { method: "POST", body: payload }),
  },

  integrations: {
    list: () => request("/integrations"),
    connect: (provider, payload) =>
      request(`/integrations/${provider}/connect`, { method: "POST", body: payload }),
    disconnect: (provider) => request(`/integrations/${provider}`, { method: "DELETE" }),
  },

  settings: {
    get: () => request("/settings"),
    update: (payload) => request("/settings", { method: "PATCH", body: payload }),
  },

  billing: {
    getPlan: () => request("/billing/plan"),
    createCheckoutSession: (payload) =>
      request("/billing/checkout-sessions", { method: "POST", body: payload }),
    createPortalSession: () => request("/billing/portal-sessions", { method: "POST" }),
  },
};
