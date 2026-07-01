const API_PREFIX = "/api";
const DEFAULT_PROXY_MAX_BODY_BYTES = 1024 * 1024;
const HTML_SHELL_CACHE_CONTROL = "no-cache";
const STATIC_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
const HTML_SHELL_SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isApiRequest(url)) {
      return proxyApiRequest(request, env, url);
    }
    if (!env.ASSETS) {
      return json({ message: "Static assets binding is not configured." }, 500);
    }
    return withStaticAssetHeaders(await env.ASSETS.fetch(request));
  },
};

export async function proxyApiRequest(request, env, incomingUrl = new URL(request.url)) {
  const origin = env.PULLWISE_API_ORIGIN;
  if (!origin) {
    return json({ message: "PULLWISE_API_ORIGIN is not configured." }, 500);
  }
  const upstreamOrigin = apiOrigin(origin);
  if (!upstreamOrigin) {
    return json({ message: "PULLWISE_API_ORIGIN must use HTTPS or loopback HTTP." }, 500);
  }

  const backendPathWithSearch = backendPath(incomingUrl.pathname) + incomingUrl.search;
  const targetUrl = new URL(backendPathWithSearch, upstreamOrigin);
  const headers = withoutClientProxyHeaders(request.headers);
  headers.set("X-Forwarded-Proto", incomingUrl.protocol.replace(":", ""));
  headers.set("X-Forwarded-Host", incomingUrl.host);
  headers.set("X-Forwarded-Prefix", API_PREFIX);

  const methodHasBody = hasBody(request.method);
  if (methodHasBody && requestBodyExceedsLimit(request, env)) {
    return json({ message: "Request body is too large." }, 413);
  }

  const init = {
    method: request.method,
    headers,
    body: methodHasBody ? request.body : undefined,
    duplex: methodHasBody ? "half" : undefined,
    redirect: "manual",
  };

  let response = await fetchUpstream(targetUrl, init);
  const fallbackOrigin = fallbackApiOrigin(env);
  if (await shouldRetryCloudflare1003(response, upstreamOrigin, fallbackOrigin, request)) {
    response = await fetchUpstream(new URL(backendPathWithSearch, fallbackOrigin), init);
  }
  return proxyResponse(response);
}

async function fetchUpstream(targetUrl, init) {
  try {
    return await fetch(targetUrl, init);
  } catch {
    return json({ message: "Unable to reach Pullwise API upstream." }, 502);
  }
}

function proxyResponse(response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: withoutHopByHopHeaders(response.headers),
  });
}

function withStaticAssetHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  if (isHtmlResponse(headers)) {
    headers.set("Cache-Control", HTML_SHELL_CACHE_CONTROL);
    for (const [name, value] of Object.entries(HTML_SHELL_SECURITY_HEADERS)) {
      headers.set(name, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isHtmlResponse(headers) {
  return (headers.get("content-type") || "").toLowerCase().includes("text/html");
}

export function isApiRequest(url) {
  return url.pathname === API_PREFIX || url.pathname.startsWith(`${API_PREFIX}/`);
}

export function backendPath(pathname) {
  const stripped = pathname.replace(/^\/api/, "");
  if (!stripped || stripped === "/") return "/";
  return `/${stripped.replace(/^\/+/, "")}`;
}

function apiOrigin(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "https:") return parsed;
    if (parsed.protocol === "http:" && isLoopbackHost(parsed.hostname)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return ["localhost", "127.0.0.1", "::1"].includes(normalized);
}

async function shouldRetryCloudflare1003(response, upstreamOrigin, fallbackOrigin, request) {
  if (response.status !== 403) return false;
  if (!fallbackOrigin || fallbackOrigin.origin === upstreamOrigin.origin) return false;
  if (!canRetryFallback(request)) return false;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return false;
  try {
    return (await response.clone().text()).includes("error code: 1003");
  } catch {
    return false;
  }
}

function fallbackApiOrigin(env) {
  const configured = String(env.PULLWISE_API_FALLBACK_ORIGIN || "").trim();
  return configured ? apiOrigin(configured) : null;
}

function canRetryFallback(request) {
  if (!["GET", "HEAD"].includes(request.method.toUpperCase())) return false;
  return !hasCredentialHeaders(request.headers);
}

function hasCredentialHeaders(headers) {
  return ["authorization", "cookie", "x-pullwise-api-key"].some((name) => headers.has(name));
}

function requestBodyExceedsLimit(request, env) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return false;
  const contentLength = Number(rawLength);
  return Number.isFinite(contentLength) && contentLength > proxyMaxBodyBytes(env);
}

function proxyMaxBodyBytes(env) {
  const configured = Number(env.PULLWISE_PROXY_MAX_BODY_BYTES);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_PROXY_MAX_BODY_BYTES;
}

function hasBody(method) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const CLIENT_PROXY_HEADERS = new Set([
  "cf-connecting-ip",
  "cf-connecting-ipv6",
  "client-ip",
  "fastly-client-ip",
  "forwarded",
  "real-ip",
  "true-client-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "x-original-forwarded-for",
  "x-real-ip",
]);

function withoutHopByHopHeaders(sourceHeaders) {
  const headers = new Headers(sourceHeaders);
  const connectionTokens = headers
    .get("connection")
    ?.split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  for (const name of HOP_BY_HOP_HEADERS) {
    headers.delete(name);
  }
  for (const name of connectionTokens || []) {
    headers.delete(name);
  }
  return headers;
}

function withoutClientProxyHeaders(sourceHeaders) {
  const headers = withoutHopByHopHeaders(sourceHeaders);
  headers.delete("host");
  for (const name of [...headers.keys()]) {
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith("x-forwarded-") || CLIENT_PROXY_HEADERS.has(lowerName)) {
      headers.delete(name);
    }
  }
  return headers;
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
