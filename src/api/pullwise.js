import { SERVER_REQUEST_TIMEOUT_MS, request } from "./http.js";

const AUDIT_BUNDLE_ARCHIVE_TIMEOUT_MS = SERVER_REQUEST_TIMEOUT_MS;

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

function getRequest(path, options = {}) {
  return options.signal ? request(path, { signal: options.signal }) : request(path);
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
    list: (params = {}, options = {}) =>
      getRequest(withSearchParams("/repositories", params), options),
    branches: (repoId, options = {}) =>
      getRequest(`/repositories/${pathSegment(repoId)}/branches`, options),
    sync: (payload, options = {}) =>
      request("/repositories/sync", { method: "POST", body: payload, signal: options.signal }),
  },

  scans: {
    preflight: (payload) => request("/scans/preflight", { method: "POST", body: payload }),
    create: (payload) => request("/scans", { method: "POST", body: payload }),
    get: (scanId, options = {}) => getRequest(`/scans/${pathSegment(scanId)}`, options),
    status: (ids = [], options = {}) =>
      request("/scans/status", { method: "POST", body: { ids }, signal: options.signal }),
    retry: (scanId, payload = {}) =>
      request(`/scans/${pathSegment(scanId)}/retry`, { method: "POST", body: payload }),
    auditBundle: (scanId) => request(`/scans/${pathSegment(scanId)}/audit-bundle`),
    auditBundleArchive: (scanId) =>
      request(`/scans/${pathSegment(scanId)}/audit-bundle.zip`, {
        responseType: "blob",
        timeout: AUDIT_BUNDLE_ARCHIVE_TIMEOUT_MS,
      }),
    list: (params = {}, options = {}) => getRequest(withSearchParams("/scans", params), options),
    cancel: (scanId) => request(`/scans/${pathSegment(scanId)}/cancel`, { method: "POST" }),
  },

  issues: {
    list: (params = {}, options = {}) => getRequest(withSearchParams("/issues", params), options),
    get: (issueId, options = {}) => getRequest(`/issues/${pathSegment(issueId)}`, options),
    updateStatus: (issueId, payload) =>
      request(`/issues/${pathSegment(issueId)}/status`, { method: "PATCH", body: payload }),
    updateStatuses: (updates = []) =>
      request("/issues/status", { method: "PATCH", body: { updates } }),
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
    createCheckoutSession: (payload = {}, options = {}) =>
      request("/billing/checkout-sessions", {
        method: "POST",
        body: payload,
        signal: options.signal,
      }),
    changeSubscriptionInterval: (payload = {}) =>
      request("/billing/change-interval", { method: "POST", body: payload }),
    cancelSubscription: (payload = {}) =>
      request("/billing/cancel-subscription", { method: "POST", body: payload }),
    resumeSubscription: (payload = {}) =>
      request("/billing/resume-subscription", { method: "POST", body: payload }),
  },

  apiKeys: {
    list: (params = {}) => request(withSearchParams("/api-keys", params)),
    create: (payload = {}) => request("/api-keys", { method: "POST", body: payload }),
    createAuditBundleKey: (scanId, repoId = "") =>
      request("/api-keys", {
        method: "POST",
        body: {
          name: `Audit bundle download ${scanId}`,
          scopes: ["scans:read"],
          expiresInSeconds: 15 * 60,
          restrictions: {
            kind: "audit_bundle",
            scanId,
            ...(repoId ? { repoId } : {}),
          },
        },
      }),
    revoke: (keyId) => request(`/api-keys/${pathSegment(keyId)}`, { method: "DELETE" }),
  },

  privateWorkers: {
    list: () => request("/private-workers"),
    create: (payload = {}) => request("/private-workers", { method: "POST", body: payload }),
    update: (workerId, payload = {}) =>
      request(`/private-workers/${pathSegment(workerId)}`, { method: "PATCH", body: payload }),
    enable: (workerId) => request(`/private-workers/${pathSegment(workerId)}/enable`, { method: "POST" }),
    disable: (workerId) => request(`/private-workers/${pathSegment(workerId)}/disable`, { method: "POST" }),
    rotateToken: (workerId) =>
      request(`/private-workers/${pathSegment(workerId)}/rotate-token`, { method: "POST" }),
    delete: (workerId) => request(`/private-workers/${pathSegment(workerId)}`, { method: "DELETE" }),
  },

  docs: {
    getSubscriptionPlanConfigs: (options = {}) =>
      request("/docs/subscription-plans", { signal: options.signal }),
    getServerConfig: (options = {}) => request("/docs/server-config", { signal: options.signal }),
  },

  system: {
    health: (options = {}) => request("/health", { signal: options.signal }),
    status: (options = {}) => request("/status/system", { signal: options.signal }),
  },
};
