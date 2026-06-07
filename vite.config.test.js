import { describe, expect, it } from "vitest";
import config from "./vite.config.js";

describe("vite production build inputs", () => {
  it("does not publish the prototype review page as a production asset", () => {
    expect(config.build.rollupOptions.input).not.toHaveProperty("review");
  });
});

describe("vite development API proxy", () => {
  it("strips the /api prefix to match the production Worker proxy", () => {
    expect(config.server.proxy["/api"].rewrite("/api/auth/session?fresh=1")).toBe(
      "/auth/session?fresh=1"
    );
    expect(config.server.proxy["/api"].rewrite("/api")).toBe("/");
  });
});
