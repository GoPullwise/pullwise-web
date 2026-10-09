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
    requestEmailCode: (payload, options = {}) =>
      request("/auth/email/request-code", {
        method: "POST",
        body: payload,
        signal: options.signal,
      }),
    verifyEmailCode: (payload, options = {}) =>
      request("/auth/email/verify-code", {
        method: "POST",
        body: payload,
        signal: options.signal,
      }),
  },

  account: {
    getJev: (options = {}) => getRequest("/api/v1/account/jev", options),
    updateJev: (revision, enabled, options = {}) =>
      request("/api/v1/account/jev", {
        method: "PATCH",
        headers: { "If-Match": `"${revision}"` },
        body: { enabled },
        signal: options.signal,
      }),
  },

  repositories: {
    list: (params = {}, options = {}) =>
      getRequest(withSearchParams("/repositories", params), options),
    sync: (payload, options = {}) =>
      request("/repositories/sync", { method: "POST", body: payload, signal: options.signal }),
  },

  integrations: {
    list: (options = {}) => getRequest("/integrations", options),
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
    list: (params = {}, options = {}) => getRequest(withSearchParams("/api-keys", params), options),
    create: (payload = {}, options = {}) =>
      request("/api-keys", { method: "POST", body: payload, signal: options.signal }),
    revoke: (keyId, options = {}) =>
      request(`/api-keys/${pathSegment(keyId)}`, { method: "DELETE", signal: options.signal }),
  },

  system: {
    health: (options = {}) => request("/health", { signal: options.signal }),
  },
};
