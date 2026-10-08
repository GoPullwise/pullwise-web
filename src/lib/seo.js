const SITE_NAME = "Pullwise";
const PRODUCTION_ORIGIN = "https://pull-wise.com";
const SOCIAL_IMAGE_PATH = "/social-card.png";

const PAGE_DEFINITIONS = {
  landing: {
    path: "/",
    title: {
      en: "Pullwise — Project Expense Tracking for Developers and Teams",
      zh: "Pullwise — 面向开发者与团队的项目支出账本",
    },
    description: {
      en: "Track project and shared expenses, share a ledger with your team, and review totals by currency. GitHub repository links are optional.",
      zh: "记录项目与公共支出，与团队共享账本，按币种查看汇总。GitHub 仓库可按需关联。",
    },
    schemaType: "software",
  },
  pricing: {
    path: "/pricing",
    title: {
      en: "Pullwise Pricing — Project Expense Ledger",
      zh: "Pullwise 价格 — 项目支出账本",
    },
    description: {
      en: "Compare Pullwise platform plans for your project expense ledger.",
      zh: "比较 Pullwise 项目支出账本的平台套餐。",
    },
    schemaType: "software",
  },
  docs: {
    path: "/developers/docs",
    title: {
      en: "Pullwise Docs — Project Expense Ledger",
      zh: "Pullwise 文档 — 项目支出账本",
    },
    description: {
      en: "Learn how to create projects, record and share expenses, review per-currency reports, and optionally link GitHub repositories.",
      zh: "了解如何创建项目、记录并共享支出、查看逐币报表，以及按需关联 GitHub 仓库。",
    },
    schemaType: "article",
  },
  api: {
    path: "/developers/api",
    title: {
      en: "Pullwise API — Ledger Contract",
      zh: "Pullwise API — 账本接口",
    },
    description: {
      en: "Explore the Pullwise REST contract for projects, categories, expenses and reports.",
      zh: "查看 Pullwise REST 接口中的项目、类别、支出和报表。",
    },
    schemaType: "article",
  },
  privacy: {
    path: "/privacy",
    title: {
      en: "Pullwise Privacy Policy — Account and Ledger Data",
      zh: "Pullwise 隐私政策 — 账户与账本数据",
    },
    description: {
      en: "Read how Pullwise handles account, GitHub, ledger, billing and support data.",
      zh: "了解 Pullwise 如何处理账户、GitHub、账本、账单和支持数据。",
    },
    schemaType: "page",
  },
  terms: {
    path: "/terms",
    title: {
      en: "Pullwise Terms of Service — Ledger",
      zh: "Pullwise 服务条款 — 账本",
    },
    description: {
      en: "Read the terms governing Pullwise web, API, GitHub-connected services, account keys, subscriptions, and billing.",
      zh: "阅读适用于 Pullwise Web、API、GitHub 连接服务、账户密钥、订阅和账单的服务条款。",
    },
    schemaType: "page",
  },
  status: {
    path: "/status",
    title: {
      en: "Pullwise Status — API Reachability and Service Configuration",
      zh: "Pullwise 状态 — API 连通性与服务配置",
    },
    description: {
      en: "Check Pullwise API reachability and reported database, GitHub, and billing configuration. This is not an end-to-end availability check.",
      zh: "查看 Pullwise API 连通性以及返回的数据库、GitHub 和账单配置；这些信息不代表端到端服务可用性。",
    },
    schemaType: "page",
  },
};

const PATH_TO_SCREEN = Object.fromEntries(
  Object.entries(PAGE_DEFINITIONS).map(([screen, definition]) => [definition.path, screen])
);

export const PUBLIC_INDEXABLE_PATHS = Object.values(PAGE_DEFINITIONS).map(
  (definition) => definition.path
);

function cleanPathname(pathname) {
  try {
    const parsed = new URL(String(pathname || "/"), PRODUCTION_ORIGIN);
    const clean = parsed.pathname.replace(/\/+$/, "");
    return clean || "/";
  } catch {
    return "/";
  }
}

function canonicalOrigin(origin) {
  try {
    const parsed = new URL(String(origin || PRODUCTION_ORIGIN));
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "pull-wise.com" || hostname === "www.pull-wise.com") {
      return PRODUCTION_ORIGIN;
    }
    const loopback = hostname === "localhost" || hostname === "::1" || hostname.startsWith("127.");
    return loopback ? parsed.origin : PRODUCTION_ORIGIN;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

function localized(copy, lang) {
  return copy?.[lang] || copy?.en || "";
}

function publicSchema(definition, title, description, canonical, origin) {
  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;
  const graph = [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      url: `${origin}/`,
      logo: `${origin}/brand-mark.png`,
      email: "contact@pull-wise.com",
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: SITE_NAME,
      url: `${origin}/`,
      publisher: { "@id": organizationId },
    },
  ];

  if (definition.schemaType === "software") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${origin}/#software`,
      name: SITE_NAME,
      url: `${origin}/`,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description,
      publisher: { "@id": organizationId },
      featureList: [
        "Named expense projects",
        "Shared expense pool",
        "Date and category reports",
        "Per-currency totals",
        "Expense history",
        "Shared ledgers and member roles",
        "Optional GitHub repository links",
      ],
    });
  } else if (definition.schemaType === "article") {
    graph.push({
      "@type": "TechArticle",
      "@id": `${canonical}#article`,
      headline: title,
      description,
      url: canonical,
      isPartOf: { "@id": websiteId },
      publisher: { "@id": organizationId },
    });
  } else {
    graph.push({
      "@type": "WebPage",
      "@id": canonical,
      name: title,
      description,
      url: canonical,
      isPartOf: { "@id": websiteId },
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function seoMetadataForScreen(screen, options = {}) {
  const lang = options.lang || "en";
  const definition = PAGE_DEFINITIONS[screen];

  if (!definition) {
    return {
      title: "Pullwise — Project Expense Ledger",
      description: "Pullwise tracks project and shared expenses for developers and teams.",
      robots: "noindex,nofollow",
      canonical: "",
      image: "",
      locale: lang === "zh" ? "zh_CN" : "en_US",
      schema: null,
    };
  }

  const origin = canonicalOrigin(options.origin);
  const title = localized(definition.title, lang);
  const description = localized(definition.description, lang);
  const canonical = `${origin}${definition.path}`;

  return {
    title,
    description,
    robots: "index,follow",
    canonical,
    image: `${origin}${SOCIAL_IMAGE_PATH}`,
    locale: lang === "zh" ? "zh_CN" : "en_US",
    schema: publicSchema(definition, title, description, canonical, origin),
  };
}

export function seoMetadataForPath(pathname, options = {}) {
  const clean = cleanPathname(pathname);
  return seoMetadataForScreen(PATH_TO_SCREEN[clean] || "notfound", {
    ...options,
    pathname: clean,
  });
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function renderSeoHead(metadata) {
  const managed = 'data-seo-managed="true"';
  const lines = [
    `<title ${managed}>${escapeAttribute(metadata.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(metadata.description)}" ${managed} />`,
    `<meta name="robots" content="${escapeAttribute(metadata.robots)}" ${managed} />`,
  ];

  if (metadata.canonical) {
    lines.push(
      `<link rel="canonical" href="${escapeAttribute(metadata.canonical)}" ${managed} />`,
      `<meta ${managed} property="og:type" content="website" />`,
      `<meta ${managed} property="og:site_name" content="${SITE_NAME}" />`,
      `<meta property="og:title" content="${escapeAttribute(metadata.title)}" ${managed} />`,
      `<meta ${managed} property="og:description" content="${escapeAttribute(metadata.description)}" />`,
      `<meta ${managed} property="og:url" content="${escapeAttribute(metadata.canonical)}" />`,
      `<meta ${managed} property="og:locale" content="${escapeAttribute(metadata.locale)}" />`,
      `<meta ${managed} property="og:image" content="${escapeAttribute(metadata.image)}" />`,
      `<meta ${managed} property="og:image:width" content="1200" />`,
      `<meta ${managed} property="og:image:height" content="630" />`,
      `<meta ${managed} property="og:image:alt" content="Pullwise project expense ledger" />`,
      `<meta name="twitter:card" content="summary_large_image" ${managed} />`,
      `<meta ${managed} name="twitter:title" content="${escapeAttribute(metadata.title)}" />`,
      `<meta ${managed} name="twitter:description" content="${escapeAttribute(metadata.description)}" />`,
      `<meta ${managed} name="twitter:image" content="${escapeAttribute(metadata.image)}" />`
    );
  }

  if (metadata.schema) {
    lines.push(
      `<script type="application/ld+json" ${managed}>${safeJson(metadata.schema)}</script>`
    );
  }

  return lines.join("\n    ");
}
