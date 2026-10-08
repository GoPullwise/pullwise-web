export const PROJECT_URL_MAX_BYTES = 2048;

const HTTP_SCHEME = /^https?:\/\//i;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOST_WITH_PORT = /^(?:localhost|[^/?#:@]+\.[^/?#:@]+|\[[^\]]+\]):\d+(?:[/?#]|$)/i;
const GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const GITHUB_REPOSITORY = /^[a-z\d._-]{1,100}$/i;

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function invalidProjectUrl() {
  throw new Error("Invalid project URL.");
}

function parseProjectUrl(value, allowBareHost) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || hasControlCharacter(value)) return invalidProjectUrl();

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    /\s/u.test(trimmed) ||
    trimmed.includes("\\") ||
    trimmed.startsWith("//") ||
    byteLength(trimmed) > PROJECT_URL_MAX_BYTES
  ) {
    return invalidProjectUrl();
  }

  let candidate = trimmed;
  if (!HTTP_SCHEME.test(candidate)) {
    if (!allowBareHost || (URL_SCHEME.test(candidate) && !HOST_WITH_PORT.test(candidate))) {
      return invalidProjectUrl();
    }
    candidate = `https://${candidate}`;
  }

  // URL drops an empty userinfo marker, so check the original authority as well.
  const authority = candidate.slice(candidate.indexOf("://") + 3).split(/[/?#]/, 1)[0];
  if (!authority || authority.includes("@")) return invalidProjectUrl();

  try {
    const parsed = new URL(candidate);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      byteLength(parsed.href) > PROJECT_URL_MAX_BYTES
    ) {
      return invalidProjectUrl();
    }
    return parsed.href;
  } catch {
    return invalidProjectUrl();
  }
}

export function normalizeProjectUrl(value) {
  return parseProjectUrl(value, true);
}

export function projectUrlHref(value) {
  try {
    return parseProjectUrl(value, false);
  } catch {
    return null;
  }
}

export function githubRepositoryHref(repository) {
  if (
    repository?.githubAccess !== "authorized" ||
    typeof repository.githubFullName !== "string" ||
    hasControlCharacter(repository.githubFullName) ||
    /\s/u.test(repository.githubFullName)
  ) {
    return null;
  }

  const parts = repository.githubFullName.split("/");
  if (
    parts.length !== 2 ||
    !GITHUB_LOGIN.test(parts[0]) ||
    !GITHUB_REPOSITORY.test(parts[1]) ||
    [".", ".."].includes(parts[1])
  ) {
    return null;
  }
  return `https://github.com/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

export function githubOrganizationHref(organization) {
  if (
    organization?.githubAccess !== "authorized" ||
    typeof organization.login !== "string" ||
    hasControlCharacter(organization.login) ||
    /\s/u.test(organization.login) ||
    !GITHUB_LOGIN.test(organization.login)
  ) {
    return null;
  }
  return `https://github.com/${encodeURIComponent(organization.login)}`;
}
