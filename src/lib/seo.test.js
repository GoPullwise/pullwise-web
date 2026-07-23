import { describe, expect, it } from "vitest";
import {
  PUBLIC_INDEXABLE_PATHS,
  renderSeoHead,
  seoMetadataForPath,
  seoMetadataForScreen,
} from "./seo.js";

describe("public SEO metadata", () => {
  it("describes the landing page as full-repository AI code review", () => {
    const metadata = seoMetadataForScreen("landing", {
      lang: "en",
      origin: "https://pull-wise.com",
      pathname: "/",
    });

    expect(metadata.title).toBe("Pullwise — AI Code Review for GitHub Repositories");
    expect(metadata.description).toMatch(/entire GitHub repositories/i);
    expect(metadata.description).toMatch(/security, correctness, and test gaps/i);
    expect(metadata.canonical).toBe("https://pull-wise.com/");
    expect(metadata.robots).toBe("index,follow");
    expect(metadata.schema["@graph"].map((entry) => entry["@type"])).toEqual(
      expect.arrayContaining(["Organization", "WebSite", "SoftwareApplication"])
    );
  });

  it("gives each indexable public route a unique canonical title and description", () => {
    const pages = PUBLIC_INDEXABLE_PATHS.map((pathname) =>
      seoMetadataForPath(pathname, {
        lang: "en",
        origin: "https://pull-wise.com",
      })
    );

    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);
    expect(pages.map((page) => page.canonical)).toEqual(
      PUBLIC_INDEXABLE_PATHS.map((pathname) => `https://pull-wise.com${pathname}`)
    );
    expect(pages.every((page) => page.robots === "index,follow")).toBe(true);
  });

  it("keeps authenticated, sign-in, and unknown routes out of search results", () => {
    for (const pathname of ["/login", "/dashboard/overview", "/scanning/sc_1", "/missing"]) {
      const metadata = seoMetadataForPath(pathname, {
        lang: "en",
        origin: "https://pull-wise.com",
      });

      expect(metadata.robots).toBe("noindex,nofollow");
      expect(metadata.canonical).toBe("");
      expect(metadata.schema).toBeNull();
    }
  });

  it("normalizes canonical URLs to the apex production domain", () => {
    const metadata = seoMetadataForPath("/pricing?ref=campaign", {
      lang: "en",
      origin: "https://www.pull-wise.com",
    });

    expect(metadata.canonical).toBe("https://pull-wise.com/pricing");
  });

  it("renders social, canonical, and structured-data head tags", () => {
    const html = renderSeoHead(
      seoMetadataForPath("/", {
        lang: "en",
        origin: "https://pull-wise.com",
      })
    );

    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('<link rel="canonical" href="https://pull-wise.com/"');
    expect(html).toContain('<script type="application/ld+json"');
    expect(html).not.toContain("<script>alert");
  });
});
