import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import config from "./vite.config.js";

const retiredGraphMarkers = ["@xyflow", "@dagrejs", "reactflow", "graphlib", "vendor-graph"];

function projectText(path) {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

describe("retired graph review UI footprint", () => {
  it("does not keep graph-only runtime dependencies or styles", () => {
    const packageJson = JSON.parse(projectText("package.json"));
    const dependencyNames = Object.keys(packageJson.dependencies ?? {});

    expect(dependencyNames).not.toEqual(expect.arrayContaining(["@xyflow/react", "@dagrejs/dagre"]));
    expect(projectText("src/main.jsx")).not.toContain("@xyflow/react/dist/style.css");
  });

  it("does not keep graph packages in the production bundle policy", () => {
    const manualChunks = config.build.rollupOptions.output.manualChunks;

    for (const marker of retiredGraphMarkers) {
      expect(manualChunks(`/repo/node_modules/${marker}/index.js`)).not.toBe("vendor-graph");
    }
  });

  it("does not keep graph packages in the lockfile", () => {
    const packageLock = projectText("package-lock.json");

    for (const marker of retiredGraphMarkers.slice(0, 4)) {
      expect(packageLock).not.toContain(marker);
    }
  });
});
