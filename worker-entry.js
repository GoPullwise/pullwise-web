import baseWorker from "./worker.js";
import { renderSeoHead, seoMetadataForPath } from "./src/lib/seo.js";

const CANONICAL_HOST = "pull-wise.com";
const WWW_HOST = "www.pull-wise.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.toLowerCase() === WWW_HOST) {
      url.hostname = CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url, 308);
    }

    const response = await baseWorker.fetch(request, env);
    if (request.method !== "GET" || !isHtmlResponse(response)) return response;

    const metadata = seoMetadataForPath(url.pathname, {
      lang: "en",
      origin: url.origin,
    });
    return injectSeoMetadata(response, metadata);
  },
};

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

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
