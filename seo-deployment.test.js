import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const robotsFile = readFileSync(join(process.cwd(), "public", "robots.txt"), "utf-8");
const sitemapFile = readFileSync(join(process.cwd(), "public", "sitemap.xml"), "utf-8");

describe("search discovery files", () => {
  it("allows search discovery while separating ChatGPT search from model training", () => {
    expect(robotsFile).toContain("User-agent: OAI-SearchBot\nAllow: /");
    expect(robotsFile).toContain("User-agent: GPTBot\nDisallow: /");
    expect(robotsFile).toContain("Sitemap: https://pull-wise.com/sitemap.xml");
  });

  it("publishes only canonical public pages in the sitemap", () => {
    expect(sitemapFile).toContain("<loc>https://pull-wise.com/</loc>");
    expect(sitemapFile).toContain("<loc>https://pull-wise.com/pricing</loc>");
    expect(sitemapFile).toContain("<loc>https://pull-wise.com/developers/docs</loc>");
    expect(sitemapFile).toContain("<loc>https://pull-wise.com/developers/api</loc>");
    expect(sitemapFile).not.toContain("/dashboard");
    expect(sitemapFile).not.toContain("/login");
  });
});
