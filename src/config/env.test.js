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
});
