import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("accepts root-relative API paths for same-origin deployment proxies", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "/api" }).VITE_API_BASE_URL).toBe("/api");
  });

  it("accepts absolute API URLs for separate backend deployments", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "https://api.example.com" }).VITE_API_BASE_URL).toBe(
      "https://api.example.com"
    );
  });

  it("rejects non-root-relative API paths", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "api" })).toThrow();
  });

  it("rejects non-http API URL schemes", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "javascript:alert(1)" })).toThrow();
  });

  it("falls back to the production API domain on pull-wise.com when the build env is missing", () => {
    expect(
      parseEnv(
        {},
        {
          location: {
            hostname: "pull-wise.com",
          },
        }
      ).VITE_API_BASE_URL
    ).toBe("https://api.pull-wise.com");
  });
});
