export async function onRequest(context) {
  const origin = context.env.PULLWISE_API_ORIGIN;
  if (!origin) {
    return json({ message: "PULLWISE_API_ORIGIN is not configured." }, 500);
  }

  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(incomingUrl.pathname.replace(/^\/api/, "") + incomingUrl.search, origin);
  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.set("X-Forwarded-Proto", incomingUrl.protocol.replace(":", ""));
  headers.set("X-Forwarded-Host", incomingUrl.host);
  headers.set("X-Forwarded-Prefix", "/api");

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: hasBody(context.request.method) ? context.request.body : undefined,
    redirect: "manual",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function hasBody(method) {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
