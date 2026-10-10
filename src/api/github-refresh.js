import { request } from "./http.js";

let currentScope = null;

const PROVIDER_UNAVAILABLE_CODES = new Set([
  "GITHUB_PERMISSION_DENIED",
  "GITHUB_RATE_LIMITED",
  "GITHUB_UNAVAILABLE",
  "GITHUB_RESPONSE_INVALID",
  "GITHUB_CONFIGURATION_ERROR",
  "GITHUB_NOT_CONFIGURED",
  "GITHUB_TOKEN_UNREADABLE",
  "IDENTITY_UNAVAILABLE",
]);

function abortReason(signal) {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

function assertActive(scope, signal) {
  if (signal?.aborted) throw abortReason(signal);
  if (scope && (scope !== currentScope || scope.controller.signal.aborted))
    throw new DOMException("Account changed", "AbortError");
}

function waitFor(promise, signals) {
  const activeSignals = signals.filter(Boolean);
  return new Promise((resolve, reject) => {
    const listeners = [];
    const cleanup = () => {
      for (const [signal, listener] of listeners) signal.removeEventListener("abort", listener);
    };
    for (const signal of activeSignals) {
      if (signal.aborted) {
        cleanup();
        // Observe the shared request even when this consumer has already left.
        promise.catch(() => {});
        reject(abortReason(signal));
        return;
      }
      const listener = () => {
        cleanup();
        reject(abortReason(signal));
      };
      listeners.push([signal, listener]);
      signal.addEventListener("abort", listener, { once: true });
    }
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      }
    );
  });
}

// Only App's confirmed account ID establishes this scope. No token or refresh
// state is persisted in browser storage, and signing out ends its generation.
export function setGitHubRefreshIdentity(accountId) {
  const identity = typeof accountId === "string" && accountId.trim() ? accountId : null;
  if (currentScope?.identity === identity || (!currentScope && !identity)) return;
  currentScope?.controller.abort(new DOMException("Account changed", "AbortError"));
  currentScope = identity ? { identity, controller: new AbortController(), round: null } : null;
}

export function captureGitHubRefreshScope(accountId = currentScope?.identity) {
  return accountId && currentScope?.identity === accountId ? currentScope : null;
}

function startRefresh(scope) {
  const round = { running: true, promise: null };
  scope.round = round;
  round.promise = request("/integrations/github/refresh", {
    method: "POST",
    body: {},
    signal: scope.controller.signal,
  })
    .then(
      (result) => {
        if (result?.ok !== true || typeof result.refreshed !== "boolean") {
          const failure = new Error("GitHub returned an unexpected credential refresh response.");
          failure.code = "GITHUB_RESPONSE_INVALID";
          throw failure;
        }
        return true;
      },
      (error) => {
        const code = error?.code || error?.payload?.error?.code;
        if (code === "GITHUB_REAUTHORIZATION_REQUIRED") return false;
        if (error?.status === 409 && code === "GITHUB_REFRESH_PENDING") return true;
        throw error;
      }
    )
    .finally(() => {
      round.running = false;
    });
  return round;
}

function unavailableMetadata(value) {
  if (Array.isArray(value)) return value.map(unavailableMetadata);
  if (!value || typeof value !== "object") return value;
  const result = { ...value };
  if (result.githubAccess === "reauthorization_required") result.githubAccess = "unavailable";
  for (const key of ["items", "repositories", "githubOrganization", "github"])
    if (result[key]) result[key] = unavailableMetadata(result[key]);
  return result;
}

function preserveProviderRead(payload, error) {
  const code = typeof error?.code === "string" ? error.code : error?.payload?.error?.code;
  const providerUnavailable = PROVIDER_UNAVAILABLE_CODES.has(code);
  const networkUnavailable =
    !error?.status && !code && ["TypeError", "Error", "TimeoutError"].includes(error?.name);
  if (
    error?.name === "AbortError" ||
    error?.status === 401 ||
    (!providerUnavailable && !networkUnavailable)
  )
    throw error;
  return {
    ...unavailableMetadata(payload),
    githubRefreshRequired: false,
    githubRefreshError: error,
  };
}

// A provider read may explicitly request renewal. At most one refresh round
// and one repeated read belong to each call; business writes never use this.
export async function withGitHubRefresh(read, { signal, scope = currentScope } = {}) {
  assertActive(scope, signal);
  const roundAtStart = scope?.round;
  const runningAtStart = roundAtStart?.running === true;
  const signals = [signal, scope?.controller.signal];
  const activeRead = () => {
    assertActive(scope, signal);
    return read();
  };
  const payload = await waitFor(Promise.resolve().then(activeRead), signals);
  assertActive(scope, signal);
  if (!scope || payload?.githubRefreshRequired !== true) return payload;

  // Parallel reads that began before the completed round share its outcome.
  // A later independent navigation/read can start a new round when necessary.
  let round = scope.round;
  if (!round || (round === roundAtStart && !runningAtStart && !round.running))
    round = startRefresh(scope);
  let retry;
  try {
    retry = await waitFor(round.promise, signals);
    assertActive(scope, signal);
  } catch (error) {
    assertActive(scope, signal);
    return preserveProviderRead(payload, error);
  }
  if (!retry) return payload;
  try {
    const result = await waitFor(Promise.resolve().then(activeRead), signals);
    assertActive(scope, signal);
    return result;
  } catch (error) {
    assertActive(scope, signal);
    // The successful read still contains financial history and binding IDs.
    // A provider outage must not erase them or claim authorization was revoked.
    return preserveProviderRead(payload, error);
  }
}
