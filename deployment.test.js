import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const wrangler = JSON.parse(readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf-8"));
const headersFile = readFileSync(join(process.cwd(), "public", "_headers"), "utf-8");

function headerLinesFor(route) {
  const lines = headersFile.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === route);
  if (start === -1) return [];
  const end = lines.findIndex(
    (line, index) => index > start && line.trim() && !line.startsWith(" ") && !line.startsWith("\t")
  );
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .map((line) => line.trim())
    .filter(Boolean);
}

describe("web Worker deployment", () => {
  it("runs API and HTML through middleware while serving hashed assets directly", () => {
    expect(wrangler.assets?.binding).toBe("ASSETS");
    expect(wrangler.assets?.run_worker_first).toEqual(["/*", "!/assets/*"]);
    expect(wrangler.vars?.PULLWISE_MODE).toBe("production");
  });

  it("sets explicit SPA shell revalidation and anti-framing headers", () => {
    expect(headerLinesFor("/*")).toEqual(
      expect.arrayContaining([
        "X-Frame-Options: DENY",
        "Content-Security-Policy: frame-ancestors 'none'",
        "Cache-Control: no-cache",
      ])
    );
    expect(headerLinesFor("/assets/*")).toEqual(
      expect.arrayContaining([
        "! Cache-Control",
        "Cache-Control: public, max-age=31536000, immutable",
      ])
    );
  });
});
