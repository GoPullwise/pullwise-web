import { env } from "../config/env.js";

const TRUSTED_GITHUB_HOST = "github.com";
const TRUSTED_GITHUB_OAUTH_AUTHORIZE_PATH = "/login/oauth/authorize";
const TRUSTED_GITHUB_API_ORIGINS = new Set(["https://api.pull-wise.com"]);
const GITHUB_AUTH_PATHS = new Set(["/auth/github/authorize", "/api/auth/github/authorize"]);
const GITHUB_INTEGRATION_PATH_PREFIXES = ["/integrations/github/", "/api/integrations/github/"];

const TRUSTED_BILLING_PROVIDER_HOSTS = new Set(["checkout.creem.io", "creem.io", "www.creem.io"]);
const TRUSTED_BILLING_FIRST_PARTY_HOSTS = new Set(["pull-wise.com", "app.pullwise.dev"]);

function currentOrigin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function configuredApiOrigin() {
  const baseUrl = env.VITE_API_BASE_URL;
  if (!baseUrl) return "";
  try {
    return new URL(baseUrl, currentOrigin() || "https://pull-wise.com").origin;
  } catch {
    return "";
  }
}

function trustedGitHubApiOrigins() {
  const origins = new Set(TRUSTED_GITHUB_API_ORIGINS);
  const configured = configuredApiOrigin();
  const current = currentOrigin();
  if (configured) origins.add(configured);
  if (current) origins.add(current);
  return origins;
}

function hasGitHubIntegrationPath(parsed) {
  return GITHUB_INTEGRATION_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));
}

function hasGitHubAuthPath(parsed) {
  return GITHUB_AUTH_PATHS.has(parsed.pathname);
}

function isSameOrigin(parsed) {
  const origin = currentOrigin();
  return Boolean(origin) && parsed.origin === origin;
}

function hasControlCharacter(value) {
  return [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
}

export function safeHttpUrl(value, label) {
  if (typeof value !== "string") throw new Error(`A safe ${label} is required.`);
  const url = value.trim();
  if (hasControlCharacter(url)) {
    throw new Error(`A safe ${label} is required.`);
  }

  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) return url;
  } catch {
    // handled by the common error below
  }
  throw new Error(`A safe ${label} is required.`);
}

export function safeGitHubAuthorizeUrl(value, label) {
  const url = safeHttpUrl(value, label);
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (
    parsed.protocol === "https:" &&
    hostname === TRUSTED_GITHUB_HOST &&
    parsed.pathname === TRUSTED_GITHUB_OAUTH_AUTHORIZE_PATH
  ) {
    return url;
  }
  if (hasGitHubAuthPath(parsed) && trustedGitHubApiOrigins().has(parsed.origin)) return url;

  throw new Error(`A safe ${label} is required.`);
}

export function safeGitHubInstallationUrl(value, label) {
  const url = safeHttpUrl(value, label);
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (parsed.protocol === "https:" && hostname === TRUSTED_GITHUB_HOST) return url;
  if (hasGitHubIntegrationPath(parsed) && trustedGitHubApiOrigins().has(parsed.origin)) return url;

  throw new Error(`A safe ${label} is required.`);
}

export function safeBillingRedirectUrl(value, label) {
  const url = safeHttpUrl(value, label);
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (parsed.protocol === "https:" && TRUSTED_BILLING_PROVIDER_HOSTS.has(hostname)) return url;
  if (isSameOrigin(parsed)) return url;
  if (parsed.protocol === "https:" && TRUSTED_BILLING_FIRST_PARTY_HOSTS.has(hostname)) return url;

  throw new Error(`A safe ${label} is required.`);
}
