// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { htmlContentSecurityPolicy, THEME_BOOTSTRAP_HASH } from "./security-headers.js";
import { PUBLIC_INDEXABLE_PATHS } from "./src/lib/seo.js";

const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("browser security policy", () => {
  it("keeps the bootstrap hash and static fallback policy aligned with the actual shell", () => {
    const bootstrap = file("./index.html").match(
      /<script\b[^>]*id="pw-theme-bootstrap"[^>]*>([\s\S]*?)<\/script>/
    )?.[1];
    expect(bootstrap).toBeTruthy();
    expect(THEME_BOOTSTRAP_HASH).toBe(
      `sha256-${createHash("sha256").update(bootstrap).digest("base64")}`
    );
    expect(file("./public/_headers")).toContain(
      `Content-Security-Policy: ${htmlContentSecurityPolicy()}`
    );
  });

  it("restricts resources while retaining inline React geometry and provider navigation", () => {
    const directives = Object.fromEntries(
      htmlContentSecurityPolicy()
        .split("; ")
        .map((part) => {
          const [name, ...values] = part.split(" ");
          return [name, values];
        })
    );
    expect(directives["script-src"]).toEqual(["'self'", `'${THEME_BOOTSTRAP_HASH}'`]);
    expect(directives["script-src-attr"]).toEqual(["'none'"]);
    expect(directives["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    for (const name of ["connect-src", "font-src", "form-action"])
      expect(directives[name]).toEqual(["'self'"]);
    for (const name of ["object-src", "base-uri", "frame-src", "frame-ancestors"])
      expect(directives[name]).toEqual(["'none'"]);
    // OAuth popups, checkout and user project links are top-level navigation,
    // not embedded frames or data connections.
    expect(directives).not.toHaveProperty("navigate-to");
    expect(htmlContentSecurityPolicy()).not.toContain("unsafe-eval");
  });

  it("blocks the actual private route families and advertises only real public pages", () => {
    const robots = file("./public/robots.txt").split(/\n\n/)[0];
    expect(robots).toContain("User-agent: OAI-SearchBot");
    for (const path of [
      "/projects",
      "/overview",
      "/categories",
      "/shared",
      "/members",
      "/api-keys",
      "/settings",
      "/billing",
      "/login",
      "/oauth",
      "/api/",
    ]) {
      expect(robots.split("\n")).toContain(`Disallow: ${path}`);
    }
    const sitemap = file("./public/sitemap.xml");
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    expect(locations).toEqual(PUBLIC_INDEXABLE_PATHS.map((path) => `https://pull-wise.com${path}`));
    expect(sitemap).not.toContain("hreflang");
    expect(sitemap).not.toContain("<lastmod>");
  });
});
