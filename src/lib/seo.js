const SITE_NAME = "Pullwise";
const PRODUCTION_ORIGIN = "https://pull-wise.com";
const SOCIAL_IMAGE_PATH = "/social-card.png";

const PAGE_DEFINITIONS = {
  landing: {
    path: "/",
    title: {
      en: "Pullwise — AI Code Review for GitHub Repositories",
      zh: "Pullwise — 面向 GitHub 仓库的 AI 代码审查",
    },
    description: {
      en: "Scan entire GitHub repositories for security, correctness, and test gaps. Pullwise validates findings and returns file-level evidence and next steps.",
      zh: "扫描完整 GitHub 仓库中的安全、正确性与测试缺口。Pullwise 验证发现，并提供文件级证据和下一步修复建议。",
    },
    schemaType: "software",
  },
  pricing: {
    path: "/pricing",
    title: {
      en: "Pullwise Pricing — AI Repository Review Plans",
      zh: "Pullwise 价格 — AI 全仓代码审查套餐",
    },
    description: {
      en: "Compare Pullwise plans for full-repository AI code review, validated findings, GitHub workflows, and REST API automation.",
      zh: "比较 Pullwise 全仓 AI 代码审查套餐，涵盖验证后的发现、GitHub 工作流和 REST API 自动化。",
    },
    schemaType: "software",
  },
  docs: {
    path: "/developers/docs",
    title: {
      en: "Pullwise Docs — Run AI Repository Reviews",
      zh: "Pullwise 文档 — 运行 AI 全仓代码审查",
    },
    description: {
      en: "Learn how to connect GitHub repositories, run full-codebase reviews, inspect validated findings, and manage Pullwise scans.",
      zh: "了解如何连接 GitHub 仓库、运行全代码库审查、查看验证后的发现并管理 Pullwise 扫描。",
    },
    schemaType: "article",
  },
  api: {
    path: "/developers/api",
    title: {
      en: "Pullwise API — Automate GitHub Repository Reviews",
      zh: "Pullwise API — 自动化 GitHub 仓库审查",
    },
    description: {
      en: "Use the Pullwise REST API to list authorized repositories, start AI code reviews, read scan results, and check account or repository quota.",
      zh: "使用 Pullwise REST API 列出授权仓库、启动 AI 代码审查、读取扫描结果并检查账户或仓库配额。",
    },
    schemaType: "article",
  },
  privacy: {
    path: "/privacy",
    title: {
      en: "Pullwise Privacy Policy — Repository and Account Data",
      zh: "Pullwise 隐私政策 — 仓库与账户数据",
    },
    description: {
      en: "Read how Pullwise handles account information, GitHub repository access, review artifacts, billing data, and support communications.",
      zh: "了解 Pullwise 如何处理账户信息、GitHub 仓库访问、审查产物、账单数据和支持沟通。",
    },
    schemaType: "page",
  },
  terms: {
    path: "/terms",
    title: {
      en: "Pullwise Terms of Service — AI Code Review",
      zh: "Pullwise 服务条款 — AI 代码审查",
    },
    description: {
      en: "Read the terms governing Pullwise web, API, GitHub-connected review workflows, account keys, subscriptions, and billing.",
      zh: "阅读适用于 Pullwise Web、API、GitHub 审查工作流、账户密钥、订阅和账单的服务条款。",
    },
    schemaType: "page",
  },
  status: {
    path: "/status",
    title: {
      en: "Pullwise Status — Web, API, and Review Worker Health",
      zh: "Pullwise 状态 — Web、API 与审查 Worker 健康度",
    },
    description: {
      en: "Check current Pullwise web, API, database, GitHub integration, billing, and review worker availability.",
      zh: "查看 Pullwise Web、API、数据库、GitHub 集成、账单和审查 Worker 的当前可用性。",
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
      logo: `${origin}/favicon.ico`,
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
        "Full-repository AI code review",
        "Security, correctness, and test-gap analysis",
        "Validator-checked findings",
        "File-level evidence and remediation guidance",
        "GitHub repository integration",
        "REST API automation",
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
      title: "Pullwise — AI Repository Review",
      description: "Pullwise reviews GitHub repositories for security, correctness, and test gaps.",
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
      `<meta ${managed} property="og:image:alt" content="Pullwise AI repository review" />`,
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
