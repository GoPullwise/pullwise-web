import { describe, expect, it } from "vitest";
import config from "./vite.config.js";

describe("vite production build inputs", () => {
  it("does not publish the prototype review page as a production asset", () => {
    expect(config.build.rollupOptions.input).not.toHaveProperty("review");
  });
});
