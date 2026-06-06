import { z } from "zod";

const absoluteUrlOrRootRelativePath = z.string().refine((value) => {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}, "Expected an absolute URL or a root-relative path.");

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
