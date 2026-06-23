import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("accepts root-relative API paths for same-origin deployment proxies", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "/api" }).VITE_API_BASE_URL).toBe("/api");
  });

  it("accepts HTTPS API URLs for separate backend deployments", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "https://api.example.com" }).VITE_API_BASE_URL).toBe(
      "https://api.example.com"
    );
  });

  it.each(["http://localhost:8000", "http://127.0.0.1:8000", "http://[::1]:8000"])(
    "accepts loopback HTTP API URLs for local development: %s",
    (apiBaseUrl) => {
      expect(parseEnv({ VITE_API_BASE_URL: apiBaseUrl }).VITE_API_BASE_URL).toBe(apiBaseUrl);
    }
  );

  it.each(["http://api.example.com", "http://pull-wise.com", "http://192.168.1.5:8000"])(
    "rejects remote HTTP API URLs: %s",
    (apiBaseUrl) => {
      expect(() => parseEnv({ VITE_API_BASE_URL: apiBaseUrl })).toThrow();
    }
  );

  it("rejects non-root-relative API paths", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "api" })).toThrow();
  });

  it("rejects non-http API URL schemes", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "javascript:alert(1)" })).toThrow();
  });

  it.each(["pull-wise.com", "www.pull-wise.com"])(
    "falls back to the same-origin API proxy on %s when the build env is missing",
    (hostname) => {
      expect(
        parseEnv(
          {},
          {
            location: { hostname },
          }
        ).VITE_API_BASE_URL
      ).toBe("/api");
    }
  );

  it("accepts a configurable public API base URL for docs", () => {
    expect(parseEnv({ VITE_PUBLIC_API_BASE_URL: "https://api.example.com" }).VITE_PUBLIC_API_BASE_URL).toBe(
      "https://api.example.com"
    );
  });
});
