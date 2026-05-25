import { request } from "./http.js";

function withSearchParams(path, params = {}) {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
  const search = new URLSearchParams(cleanParams).toString();
  return search ? `${path}?${search}` : path;
}

function pathSegment(value) {
  const text = String(value ?? "");
  if (!text) throw new Error("API path segment is required.");
  return encodeURIComponent(text);
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
    sync: (payload) => request("/repositories/sync", { method: "POST", body: payload }),
  },

  scans: {
    create: (payload) => request("/scans", { method: "POST", body: payload }),
    get: (scanId) => request(`/scans/${pathSegment(scanId)}`),
    list: (params = {}) => request(withSearchParams("/scans", params)),
    cancel: (scanId) => request(`/scans/${pathSegment(scanId)}/cancel`, { method: "POST" }),
  },

  issues: {
    list: (params = {}) => request(withSearchParams("/issues", params)),
    get: (issueId) => request(`/issues/${pathSegment(issueId)}`),
    updateStatus: (issueId, payload) =>
      request(`/issues/${pathSegment(issueId)}/status`, { method: "PATCH", body: payload }),
    previewFix: (issueId) =>
      request(`/issues/${pathSegment(issueId)}/fixes/preview`, { method: "POST" }),
    createPullRequest: (issueId) =>
      request(`/issues/${pathSegment(issueId)}/pull-requests`, { method: "POST" }),
  },

  integrations: {
    list: () => request("/integrations"),
    getGitHubAuthorizeUrl: (params = {}) =>
      request(withSearchParams("/integrations/github/authorize", params)),
    createGitHubInstallationManageSession: (installationId, payload = {}) =>
      request(`/integrations/github/installations/${pathSegment(installationId)}/manage-sessions`, {
        method: "POST",
        body: payload,
      }),
    disconnect: (provider) =>
      request(`/integrations/${pathSegment(provider)}`, { method: "DELETE" }),
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
    changeSubscriptionInterval: (payload = {}) =>
      request("/billing/change-interval", { method: "POST", body: payload }),
  },

  system: {
    health: () => request("/health"),
  },
};
