import { request } from "./http.js";

const AUDIT_BUNDLE_ARCHIVE_TIMEOUT_MS = 120000;

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
    getSession: (options = {}) => request("/auth/session", { signal: options.signal }),
    signOut: (options = {}) =>
      request("/auth/sign-out", { method: "POST", signal: options.signal }),
    getGitHubAuthorizeUrl: (params = {}, options = {}) =>
      request(withSearchParams("/auth/github/authorize", params), { signal: options.signal }),
  },

  repositories: {
    list: (params = {}) => request(withSearchParams("/repositories", params)),
    branches: (repoId) => request(`/repositories/${pathSegment(repoId)}/branches`),
    sync: (payload) => request("/repositories/sync", { method: "POST", body: payload }),
  },

  scans: {
    preflight: (payload) => request("/scans/preflight", { method: "POST", body: payload }),
    create: (payload) => request("/scans", { method: "POST", body: payload }),
    get: (scanId) => request(`/scans/${pathSegment(scanId)}`),
    auditBundle: (scanId) => request(`/scans/${pathSegment(scanId)}/audit-bundle`),
    auditBundleArchive: (scanId) =>
      request(`/scans/${pathSegment(scanId)}/audit-bundle.zip`, {
        responseType: "blob",
        timeout: AUDIT_BUNDLE_ARCHIVE_TIMEOUT_MS,
      }),
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
    getGitHubAuthorizeUrl: (params = {}, options = {}) =>
      request(withSearchParams("/integrations/github/authorize", params), {
        signal: options.signal,
      }),
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
    getBilling: () => request("/billing"),
    getPlan: () => request("/billing/plan"),
    createCheckoutSession: (payload = {}) =>
      request("/billing/checkout-sessions", { method: "POST", body: payload }),
    createPortalSession: (payload = {}) =>
      request("/billing/portal-sessions", { method: "POST", body: payload }),
    changeSubscriptionInterval: (payload = {}) =>
      request("/billing/change-interval", { method: "POST", body: payload }),
  },

  apiKeys: {
    list: (params = {}) => request(withSearchParams("/api-keys", params)),
    create: (payload = {}) => request("/api-keys", { method: "POST", body: payload }),
    revoke: (keyId) => request(`/api-keys/${pathSegment(keyId)}`, { method: "DELETE" }),
  },

  system: {
    health: () => request("/health"),
    status: () => request("/status/system"),
  },
};
