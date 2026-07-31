import { env } from "../config/env.js";

export const SERVER_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.code = typeof payload?.code === "string" ? payload.code : "";
  }
}

/** Non-2xx transport failure. Carries the parsed body so request() can map it. */
class HttpStatusError extends Error {
  constructor(message, response) {
    super(message);
    this.name = "HttpStatusError";
    this.response = response;
  }
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.name === "TimeoutError";
}

function buildUrl(path, params) {
  const base = env.VITE_API_BASE_URL || "";
  const url = `${base}${path}`;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.append(key, String(value));
  }
  const query = search.toString();
  if (!query) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function combineSignals(signals) {
  const present = signals.filter(Boolean);
  if (present.length <= 1) return present[0];
  // AbortSignal.any is available in every browser we target and in Node 20+.
  if (typeof AbortSignal.any === "function") return AbortSignal.any(present);
  const controller = new AbortController();
  for (const signal of present) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

async function parseBody(response, responseType) {
  if (responseType === "blob") return response.blob();
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Minimal fetch transport. Kept as an object with `defaults` and `request` so
 * callers and tests retain a single seam to stub, matching the shape the
 * previous axios instance exposed.
 */
export const http = {
  defaults: {
    baseURL: env.VITE_API_BASE_URL || "",
    withCredentials: true,
    timeout: SERVER_REQUEST_TIMEOUT_MS,
    headers: { "Content-Type": "application/json" },
  },

  async request(config = {}) {
    const { url, method = "GET", data, params, headers, responseType, signal } = config;
    const timeout = config.timeout ?? http.defaults.timeout;

    const timeoutSignal =
      timeout > 0 && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(timeout)
        : undefined;

    const hasBody = data !== undefined && data !== null;
    const response = await fetch(buildUrl(url, params), {
      method,
      credentials: http.defaults.withCredentials ? "include" : "same-origin",
      headers: { ...(hasBody ? http.defaults.headers : {}), ...headers },
      body: hasBody ? JSON.stringify(data) : undefined,
      signal: combineSignals([signal, timeoutSignal]),
    });

    const payload = await parseBody(response, responseType);
    if (!response.ok) {
      throw new HttpStatusError(`Request failed with status ${response.status}`, {
        status: response.status,
        data: payload,
      });
    }

    return { data: payload };
  },
};

export async function request(path, options = {}) {
  try {
    const response = await http.request({
      url: path,
      method: options.method || "GET",
      data: options.body,
      params: options.params,
      headers: options.headers,
      responseType: options.responseType,
      signal: options.signal,
      timeout: options.timeout,
    });

    return response.data;
  } catch (error) {
    // Aborted requests stay as-is so callers can ignore them.
    if (isAbortError(error)) {
      throw error;
    }

    if (error instanceof HttpStatusError) {
      throw new ApiError(error.response?.data?.message || error.message, {
        status: error.response?.status,
        payload: error.response?.data,
      });
    }

    throw error;
  }
}
