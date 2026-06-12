import { z } from "zod";

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1") return true;
  const parts = normalized.split(".");
  return (
    parts.length === 4 &&
    parts[0] === "127" &&
    parts.every((part) => {
      if (!/^\d+$/.test(part)) return false;
      const value = Number(part);
      return value >= 0 && value <= 255;
    })
  );
}

const absoluteUrlOrRootRelativePath = z.string().refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
}, "Expected a root-relative path, HTTPS URL, or loopback HTTP URL.");

const envSchema = z.object({
  VITE_API_BASE_URL: absoluteUrlOrRootRelativePath.optional(),
  VITE_APP_URL: z.string().url().optional(),
  VITE_GITHUB_APP_SLUG: z.string().optional(),
});

const PRODUCTION_API_BASE_URL_BY_HOST = {
  "pull-wise.com": "/api",
};

function productionApiBaseUrlForLocation(location) {
  const hostname = location?.hostname;
  if (typeof hostname !== "string") return undefined;
  return PRODUCTION_API_BASE_URL_BY_HOST[hostname.toLowerCase()];
}

export function parseEnv(rawEnv, options = {}) {
  const parsed = envSchema.parse(rawEnv);
  return {
    ...parsed,
    VITE_API_BASE_URL:
      parsed.VITE_API_BASE_URL || productionApiBaseUrlForLocation(options.location),
  };
}

export const env = parseEnv(import.meta.env, {
  location: typeof window === "undefined" ? undefined : window.location,
});
