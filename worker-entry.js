import baseWorker from "./worker.js";
import { renderSeoHead, seoMetadataForPath } from "./src/lib/seo.js";
import { htmlContentSecurityPolicy } from "./security-headers.js";

const CANONICAL_HOST = "pull-wise.com";
const WWW_HOST = "www.pull-wise.com";
const PREVIEW_HOST = "preview.pull-wise.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const deployedHost = [CANONICAL_HOST, WWW_HOST, PREVIEW_HOST].includes(hostname);
    if (deployedHost && url.protocol === "http:") {
      // A navigation must reach HTTPS before it renders an email sign-in form.
      // Never replay an insecure write, including a verification-code request.
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(JSON.stringify({ error: { code: "HTTPS_REQUIRED" } }), {
          status: 403,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      url.protocol = "https:";
      url.port = "";
      if (hostname === WWW_HOST) url.hostname = CANONICAL_HOST;
      return canonicalRedirect(url, env);
    }
    if (hostname === WWW_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return canonicalRedirect(url, env);
    }

    let response = await baseWorker.fetch(request, env);
    if (env.PULLWISE_MODE === "preview") {
      const headers = new Headers(response.headers);
      headers.set("X-Robots-Tag", "noindex, nofollow");
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    // Server responses include their own OAuth callback documents/redirects.
    // Never rewrite their HTML or apply the app shell's script policy.
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return response;
    if (request.method !== "GET" || !isHtmlResponse(response)) return response;

    const metadata = seoMetadataForPath(url.pathname, {
      lang: "en",
      origin: url.origin,
    });
    return injectSeoMetadata(response, metadata);
  },
};

function canonicalRedirect(url, env) {
  const headers = new Headers({ Location: url.href });
  if (env.PULLWISE_MODE === "preview") headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(null, { status: 308, headers });
}

function isHtmlResponse(response) {
  return (response.headers.get("content-type") || "").toLowerCase().includes("text/html");
}

async function injectSeoMetadata(response, metadata) {
  const html = await response.text();
  const withoutManagedTags = html
    .replace(
      /<(?:title|script)\b[^>]*data-seo-managed=["']true["'][^>]*>[\s\S]*?<\/(?:title|script)>\s*/gi,
      ""
    )
    .replace(/<(?:meta|link)\b[^>]*data-seo-managed=["']true["'][^>]*\/?>\s*/gi, "");
  const head = renderSeoHead(metadata);
  const body = withoutManagedTags.includes("</head>")
    ? withoutManagedTags.replace("</head>", `    ${head}\n  </head>`)
    : `${head}\n${withoutManagedTags}`;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  // Only trust the JSON-LD generated above, never arbitrary inline scripts
  // found in the asset body. The theme bootstrap has its own fixed hash.
  const schemaScript = head.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  const schemaHashes = schemaScript ? [await scriptHash(schemaScript)] : [];
  headers.set("Content-Security-Policy", htmlContentSecurityPolicy(schemaHashes));

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function scriptHash(source) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return `sha256-${encoded}`;
}
