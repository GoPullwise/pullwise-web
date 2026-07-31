import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  __pullwiseDataCacheState,
  clearPullwiseDataCache,
} from "./pullwise-data-cache.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath) {
  return readFileSync(resolve(TEST_DIR, relativePath), "utf8");
}

describe("pullwise-data-cache", () => {
  beforeEach(() => {
    clearPullwiseDataCache();
  });

  it("clears every cache map and aborts in-flight controllers", () => {
    const controller = new AbortController();
    __pullwiseDataCacheState.successfulListCache.set("repos", { items: [{ id: "repo_1" }] });
    __pullwiseDataCacheState.issueUpdateCache.set("issue", { status: "fixed" });
    __pullwiseDataCacheState.issueUpdateKeysById.set("iss_1", new Set(["issue"]));
    __pullwiseDataCacheState.inFlightDataRequests.set("repos", { controller });

    clearPullwiseDataCache();

    expect(__pullwiseDataCacheState.successfulListCache.size).toBe(0);
    expect(__pullwiseDataCacheState.issueUpdateCache.size).toBe(0);
    expect(__pullwiseDataCacheState.issueUpdateKeysById.size).toBe(0);
    expect(__pullwiseDataCacheState.inFlightDataRequests.size).toBe(0);
    expect(controller.signal.aborted).toBe(true);
  });

  it("keeps clearPullwiseDataCache in the lightweight cache module", () => {
    expect(readSource("../App.jsx")).toContain(
      'clearPullwiseDataCache } from "./lib/pullwise-data-cache.js"'
    );
    expect(readSource("./auth.js")).toContain(
      'clearPullwiseDataCache } from "./pullwise-data-cache.js"'
    );
    expect(readSource("../test/setup.js")).toContain(
      'clearPullwiseDataCache } from "../lib/pullwise-data-cache.js"'
    );
    expect(readSource("../test/setup.js")).not.toContain("__clearPullwiseDataCache");
    expect(readSource("./pullwise-data.js")).not.toContain("export function clearPullwiseDataCache");
    expect(readSource("./pullwise-data.js")).not.toContain(
      "globalThis.__clearPullwiseDataCache"
    );
  });
});
