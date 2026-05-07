// screens/legal.jsx — Privacy, Terms, Security, Status

import { useEffect, useState } from "react";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";

function LegalChrome({ go, current, children }) {
  return (
    <div className="landing fade-in">
      <header className="lp-top">
        <div className="brand" onClick={() => go("landing")} style={{ cursor: "pointer" }}>
          <div className="brand-mark">PR</div>
          <span>Pullwise</span>
        </div>
        <nav className="lp-nav">
          <button className="btn ghost sm" onClick={() => go("landing")}>{T("Product", "产品")}</button>
          <button className="btn ghost sm" onClick={() => go("pricing")}>{T("Pricing", "定价")}</button>
          <button className="btn ghost sm" onClick={() => go("docs")}>{T("Docs", "文档")}</button>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => go("login")}>{T("Sign in", "登录")}</button>
          <button className="btn primary sm" onClick={() => go("login")}>{T("Get started", "开始使用")}</button>
        </div>
      </header>

      {children}

      <footer className="lp-foot">
        <div>© 2026 Pullwise</div>
        <div style={{ display: "flex", gap: 18 }}>
          <a className="legal-foot-l" onClick={() => go("privacy")} style={{ color: current === "privacy" ? "var(--text)" : undefined }}>{T("Privacy", "隐私")}</a>
          <a className="legal-foot-l" onClick={() => go("terms")} style={{ color: current === "terms" ? "var(--text)" : undefined }}>{T("Terms", "条款")}</a>
          <a className="legal-foot-l" onClick={() => go("security")} style={{ color: current === "security" ? "var(--text)" : undefined }}>{T("Security", "安全")}</a>
          <a className="legal-foot-l" onClick={() => go("status")} style={{ color: current === "status" ? "var(--text)" : undefined }}>{T("Status ●", "状态 ●")}</a>
        </div>
      </footer>
    </div>
  );
}

function LegalDocLayout({ go, current, sections, title, subtitle, lastUpdated, children }) {
  return (
    <LegalChrome go={go} current={current}>
      <div className="legal-shell">
        <aside className="legal-side">
          <div className="legal-side-h">{T("On this page", "本页内容")}</div>
          {sections.map((s) => (
            <a key={s.id} className="legal-side-i" href={`#${s.id}`}>{s.t}</a>
          ))}
          <div className="legal-side-foot">
            <div className="legal-side-l">{T("Last updated", "最后更新")}</div>
            <div className="legal-side-d">{lastUpdated}</div>
          </div>
        </aside>
        <main className="legal-main">
          <div className="legal-crumbs">
            <span onClick={() => go("landing")} style={{ cursor: "pointer" }}>Pullwise</span>
            <span className="sep">/</span>
            <span className="now">{title}</span>
          </div>
          <h1 className="legal-h1">{title}</h1>
          {subtitle && <p className="legal-lede">{subtitle}</p>}
          {children}
          <div className="legal-foot-actions">
            <span className="muted">{T("Last updated", "最后更新")} · {lastUpdated}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn sm ghost"><I.MessageSquare size={11} /> {T("Send feedback", "反馈")}</button>
            </div>
          </div>
        </main>
      </div>
    </LegalChrome>
  );
}

// ── Privacy ─────────────────────────────────────────────────────────────
export function PrivacyScreen({ go }) {
  useLang();
  const sections = [
    { id: "intro", t: T("Overview", "概述") },
    { id: "collect", t: T("Data we collect", "我们收集的数据") },
    { id: "use", t: T("How we use data", "数据使用方式") },
    { id: "code", t: T("Your source code", "你的源代码") },
    { id: "share", t: T("Sharing", "数据共享") },
    { id: "retention", t: T("Retention", "数据保留") },
    { id: "rights", t: T("Your rights", "你的权利") },
    { id: "contact", t: T("Contact", "联系我们") },
  ];
  return (
    <LegalDocLayout
      go={go}
      current="privacy"
      sections={sections}
      title={T("Privacy Policy", "隐私政策")}
      subtitle={T(
        "Pullwise is built around a simple premise: your code is yours. This page explains exactly what data we collect, how we use it, and what choices you have.",
        "Pullwise 的产品理念很简单: 你的代码归你所有。本页解释我们收集哪些数据、如何使用,以及你有哪些控制权。"
      )}
      lastUpdated="2026-04-22"
    >
      <h2 className="legal-h2" id="intro">{T("Overview", "概述")}</h2>
      <p>
        {T(
          "Pullwise (\"we\", \"us\") provides automated code review for GitHub repositories. To do this we need limited access to your account and the contents of repositories you authorize.",
          "Pullwise (以下简称\"我们\") 为 GitHub 仓库提供自动化代码 review 服务。为此我们需要有限地访问你的账号和你授权的仓库内容。"
        )}
      </p>
      <p>
        {T(
          "We are GDPR-aligned and operate as a data processor on behalf of your workspace. The Pullwise workspace owner is the data controller for repository content.",
          "我们遵循 GDPR 规范,作为你工作区的\"数据处理者\"。Pullwise 工作区拥有者是仓库内容的\"数据控制者\"。"
        )}
      </p>

      <h2 className="legal-h2" id="collect">{T("Data we collect", "我们收集的数据")}</h2>
      <div className="legal-table">
        <div className="legal-table-r">
          <b>{T("Account", "账号")}</b>
          <span>{T("Email, GitHub login handle, avatar URL.", "邮箱、GitHub 登录用户名、头像 URL。")}</span>
        </div>
        <div className="legal-table-r">
          <b>{T("Repository metadata", "仓库元数据")}</b>
          <span>{T("Names, default branches, commit SHAs, file paths.", "仓库名、默认分支、commit SHA、文件路径。")}</span>
        </div>
        <div className="legal-table-r">
          <b>{T("Findings", "扫描结果")}</b>
          <span>{T("Issue titles, severity, file:line references, generated patches.", "issue 标题、严重度、文件:行 引用、生成的 patch。")}</span>
        </div>
        <div className="legal-table-r">
          <b>{T("Telemetry", "遥测数据")}</b>
          <span>{T("Anonymized usage events (button clicks, scan duration). Never code content.", "匿名使用事件 (按钮点击、扫描耗时)。绝不包含代码内容。")}</span>
        </div>
        <div className="legal-table-r">
          <b>{T("Billing", "计费信息")}</b>
          <span>{T("Handled by Stripe. We never see full card numbers.", "由 Stripe 处理。我们从不接触完整的卡号。")}</span>
        </div>
      </div>

      <h2 className="legal-h2" id="use">{T("How we use data", "数据使用方式")}</h2>
      <ol className="legal-list">
        <li>{T("To run scans, surface findings, and generate fixes inside your workspace.", "运行扫描、展示 finding,以及在你的工作区内生成修复。")}</li>
        <li>{T("To send transactional emails (login links, scan failures, weekly reports).", "发送事务邮件 (登录链接、扫描失败、每周报告)。")}</li>
        <li>{T("To bill, refund, and provide support.", "计费、退款,以及客户支持。")}</li>
        <li>{T("Aggregated, non-identifying analytics to improve the product.", "用于改进产品的聚合化、不可识别的分析。")}</li>
      </ol>
      <p><b>{T("We never:", "我们绝不:")}</b></p>
      <ul className="legal-list-flat">
        <li>{T("Sell or rent your data.", "出售或出租你的数据。")}</li>
        <li>{T("Use your code to train models.", "使用你的代码训练模型。")}</li>
        <li>{T("Read repositories you have not authorized.", "读取你未授权的仓库。")}</li>
      </ul>

      <h2 className="legal-h2" id="code">{T("Your source code", "你的源代码")}</h2>
      <div className="legal-callout">
        <I.Lock size={15} />
        <div>
          <b>{T("Code is analyzed in memory and discarded.", "代码仅在内存中分析后立即丢弃。")}</b>
          <p>
            {T(
              "We shallow-clone the commit being scanned to an ephemeral runner, build an AST, run the lenses, and discard the working tree when the runner exits. We do not back up source code, and we do not retain copies for debugging.",
              "我们将待扫描的 commit 浅克隆到临时 runner、构建 AST、运行 lens,runner 退出后立即丢弃工作树。我们不会备份源代码,也不会因调试目的保留副本。"
            )}
          </p>
        </div>
      </div>

      <h2 className="legal-h2" id="share">{T("Sharing", "数据共享")}</h2>
      <p>{T("We use the following sub-processors. Each one signs a DPA and supports EU-region routing where available.", "我们使用以下子处理者。每一方都签署了 DPA,并在可行时支持欧盟区域路由。")}</p>
      <div className="legal-table">
        <div className="legal-table-r"><b>Anthropic</b><span>{T("LLM provider (haiku-4-5). Training opted out.", "LLM 服务商 (haiku-4-5),已 opt-out 训练。")}</span></div>
        <div className="legal-table-r"><b>AWS / Cloudflare</b><span>{T("Compute and edge delivery.", "计算与边缘分发。")}</span></div>
        <div className="legal-table-r"><b>Stripe</b><span>{T("Payment processing.", "支付处理。")}</span></div>
        <div className="legal-table-r"><b>PostHog</b><span>{T("Product analytics (self-hosted, EU region).", "产品分析 (自托管,EU 区域)。")}</span></div>
        <div className="legal-table-r"><b>Postmark</b><span>{T("Transactional email.", "事务邮件。")}</span></div>
      </div>

      <h2 className="legal-h2" id="retention">{T("Retention", "数据保留")}</h2>
      <ul className="legal-list-flat">
        <li>{T("Findings & metadata: 90 days, then deleted.", "Finding 与元数据: 保留 90 天后删除。")}</li>
        <li>{T("Account record: kept until you delete the workspace.", "账号记录: 保留至你删除工作区。")}</li>
        <li>{T("Backups: rolling 30-day window, encrypted at rest.", "备份: 30 天滚动窗口,静态加密。")}</li>
        <li>{T("Server logs: 14 days, then deleted.", "服务器日志: 保留 14 天后删除。")}</li>
      </ul>

      <h2 className="legal-h2" id="rights">{T("Your rights", "你的权利")}</h2>
      <p>
        {T(
          "Under GDPR / CCPA / equivalent laws you can request a copy of your data, ask us to correct or delete it, and object to processing. Email privacy@pullwise.dev — we respond within 30 days.",
          "根据 GDPR / CCPA 及同等法律,你可以请求获取数据副本、要求更正或删除、并反对处理。请发邮件至 privacy@pullwise.dev,我们将在 30 天内回复。"
        )}
      </p>

      <h2 className="legal-h2" id="contact">{T("Contact", "联系我们")}</h2>
      <p>
        {T(
          "Questions? Email privacy@pullwise.dev. Data Protection Officer: dpo@pullwise.dev.",
          "有疑问? 请联系 privacy@pullwise.dev。数据保护官 (DPO): dpo@pullwise.dev。"
        )}
      </p>
    </LegalDocLayout>
  );
}

// ── Terms ───────────────────────────────────────────────────────────────
export function TermsScreen({ go }) {
  useLang();
  const sections = [
    { id: "accept", t: T("Acceptance", "接受条款") },
    { id: "service", t: T("The service", "服务说明") },
    { id: "account", t: T("Your account", "你的账号") },
    { id: "use-rules", t: T("Acceptable use", "可接受的使用") },
    { id: "ip", t: T("Intellectual property", "知识产权") },
    { id: "billing", t: T("Billing & cancellation", "计费与取消") },
    { id: "warranty", t: T("Disclaimers", "免责声明") },
    { id: "liability", t: T("Limitation of liability", "责任限制") },
    { id: "law", t: T("Governing law", "适用法律") },
  ];
  return (
    <LegalDocLayout
      go={go}
      current="terms"
      sections={sections}
      title={T("Terms of Service", "服务条款")}
      subtitle={T(
        "These terms govern your use of Pullwise. By signing in or using the service you agree to them. If you are using Pullwise on behalf of an organization, you confirm you have authority to bind that organization.",
        "本条款约束你对 Pullwise 的使用。登录或使用本服务即表示同意。如果你代表一个组织使用 Pullwise,你确认有权使该组织受本条款约束。"
      )}
      lastUpdated="2026-04-22"
    >
      <h2 className="legal-h2" id="accept">{T("Acceptance", "接受条款")}</h2>
      <p>{T("By creating an account or using Pullwise (the \"Service\") you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the Service.", "创建账号或使用 Pullwise (\"本服务\") 即表示同意本条款与隐私政策。若不同意,请勿使用本服务。")}</p>

      <h2 className="legal-h2" id="service">{T("The service", "服务说明")}</h2>
      <p>{T("Pullwise provides automated code review and remediation for GitHub repositories. We may update, improve, deprecate, or remove features at any time, with reasonable notice for paid plans.", "Pullwise 为 GitHub 仓库提供自动代码 review 与修复。我们可能随时更新、改进、弃用或下线功能,对付费方案会提前合理通知。")}</p>

      <h2 className="legal-h2" id="account">{T("Your account", "你的账号")}</h2>
      <ul className="legal-list-flat">
        <li>{T("You must be at least 16 years old.", "你必须年满 16 周岁。")}</li>
        <li>{T("You are responsible for what happens under your account.", "你需对在自己账号下发生的活动负责。")}</li>
        <li>{T("Keep your sign-in credentials secure. Notify us immediately of any unauthorized access.", "妥善保管登录凭据。如发现未经授权的访问,请立即通知我们。")}</li>
      </ul>

      <h2 className="legal-h2" id="use-rules">{T("Acceptable use", "可接受的使用")}</h2>
      <p>{T("You agree not to:", "你同意不会:")}</p>
      <ul className="legal-list-flat">
        <li>{T("Use the Service to scan repositories you don't have rights to review.", "使用本服务 review 你无权审计的仓库。")}</li>
        <li>{T("Reverse-engineer, scrape, or stress-test the Service.", "对本服务进行逆向工程、爬取或压力测试。")}</li>
        <li>{T("Upload malware, illegal content, or content that infringes third-party rights.", "上传恶意软件、违法内容或侵犯第三方权益的内容。")}</li>
        <li>{T("Resell the Service without a written reseller agreement.", "在没有书面经销协议的情况下转售本服务。")}</li>
      </ul>

      <h2 className="legal-h2" id="ip">{T("Intellectual property", "知识产权")}</h2>
      <p>{T("You retain all rights to your code. We retain all rights to the Service. Generated patches are derivative works of your code and remain your property; you grant us a limited license to process them as needed to deliver the Service.", "你保留对代码的全部权利。我们保留对本服务的全部权利。生成的 patch 属于你代码的衍生作品,仍归你所有;你授予我们处理它们以提供服务所需的有限许可。")}</p>

      <h2 className="legal-h2" id="billing">{T("Billing & cancellation", "计费与取消")}</h2>
      <ul className="legal-list-flat">
        <li>{T("Paid plans bill monthly or annually in advance.", "付费方案按月或按年预先扣费。")}</li>
        <li>{T("Upgrades take effect immediately and are pro-rated.", "升级立即生效并按比例计费。")}</li>
        <li>{T("Downgrades take effect at the end of the current billing period.", "降级在当前账单周期结束时生效。")}</li>
        <li>{T("You can cancel any time. We do not offer refunds for partial periods.", "你可以随时取消订阅。我们不为不完整的周期退款。")}</li>
      </ul>

      <h2 className="legal-h2" id="warranty">{T("Disclaimers", "免责声明")}</h2>
      <p>{T("The Service is provided \"as is\". Findings and patches are suggestions — you remain responsible for reviewing and accepting changes before merging. We make no guarantees that the Service is bug-free or that it will catch every issue.", "本服务按\"现状\"提供。Finding 与 patch 仅为建议,你仍需在合并前自行 review 并确认变更。我们不保证服务无 bug,也不保证能识别所有问题。")}</p>

      <h2 className="legal-h2" id="liability">{T("Limitation of liability", "责任限制")}</h2>
      <p>{T("To the maximum extent permitted by law, our total liability for any claim is limited to the fees you paid us in the 12 months before the claim arose. We are not liable for indirect, incidental, or consequential damages.", "在法律允许的最大范围内,我们就任何索赔的累计责任以索赔发生前 12 个月内你向我们支付的费用为限。我们不对间接、附带或后果性损害承担责任。")}</p>

      <h2 className="legal-h2" id="law">{T("Governing law", "适用法律")}</h2>
      <p>{T("These Terms are governed by the laws of the State of Delaware, USA. Any dispute will be resolved in the federal or state courts located in Delaware, except where mandatory consumer law provides otherwise.", "本条款受美国特拉华州法律管辖。任何争议将在特拉华州的联邦或州法院解决,适用强制性消费者法律的情形除外。")}</p>
    </LegalDocLayout>
  );
}

// ── Security ────────────────────────────────────────────────────────────
export function SecurityScreen({ go }) {
  useLang();

  const certs = [
    { k: "SOC 2", s: T("Type II", "Type II"), d: T("Audited annually by a Big 4 firm.", "由四大会计师事务所每年审计。") },
    { k: "ISO 27001", s: T("Certified", "已认证"), d: T("Information security management.", "信息安全管理体系。") },
    { k: "GDPR", s: T("Compliant", "合规"), d: T("EU-region data routing available.", "支持欧盟区域路由。") },
    { k: "HIPAA", s: T("BAA on request", "可签 BAA"), d: T("Available for Enterprise plans.", "面向企业版客户。") },
  ];

  const principles = [
    {
      i: <I.Lock size={18} />,
      h: T("Encryption everywhere", "全链路加密"),
      p: T("TLS 1.3 in transit. AES-256 at rest. Per-workspace data keys.", "传输使用 TLS 1.3,静态使用 AES-256,每个工作区独立数据密钥。"),
    },
    {
      i: <I.Database size={18} />,
      h: T("No long-lived code copies", "不长期保存代码副本"),
      p: T("Code is cloned to an ephemeral runner, analyzed in memory, and discarded the moment the runner exits.", "代码 clone 到临时 runner,内存中分析,runner 退出时立即丢弃。"),
    },
    {
      i: <I.Shield size={18} />,
      h: T("Least-privilege GitHub App", "最小权限 GitHub App"),
      p: T("Read-only by default. Write access only when you approve a fix that needs to open a PR.", "默认只读权限。仅当你批准修复并要求开 PR 时才请求写权限。"),
    },
    {
      i: <I.User size={18} />,
      h: T("SSO, SAML, SCIM", "SSO / SAML / SCIM"),
      p: T("Available on Team and Enterprise. Audit logs included.", "团队版与企业版可用。包含审计日志。"),
    },
    {
      i: <I.Sparkle size={18} />,
      h: T("AI without training leakage", "AI 无训练泄漏"),
      p: T("Anthropic API with training opt-out. Your code never enters a model training set.", "调用 Anthropic API 并 opt-out 训练。你的代码不会进入任何模型训练集。"),
    },
    {
      i: <I.Activity size={18} />,
      h: T("Continuous monitoring", "持续监控"),
      p: T("24/7 anomaly detection. On-call response under 15 minutes for security alerts.", "7×24 异常检测。安全告警的 on-call 响应时间 < 15 分钟。"),
    },
  ];

  return (
    <LegalChrome go={go} current="security">
      <section className="security-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: "var(--accent)" }}></span>
          <span>{T("Trust", "信任")}</span>
        </div>
        <h1 className="lp-title">
          {T("Built for the code", "为最敏感的代码")}<br/>
          <span className="lp-title-em">{T("you can't afford to leak.", "而构建。")}</span>
        </h1>
        <p className="lp-sub">
          {T(
            "Pullwise reviews production code for some of the most security-conscious teams in the world. This page describes the controls, certifications, and practices behind that trust.",
            "Pullwise 为全球最在意安全的团队 review 生产代码。本页详细说明支撑这份信任的控制措施、认证与实践。"
          )}
        </p>
        <div className="lp-cta">
          <button className="btn primary lg"><I.FileCode /> {T("Download SOC 2 report", "下载 SOC 2 报告")}</button>
          <button className="btn lg" onClick={() => go("docs")}>{T("Read security docs", "查看安全文档")} <I.ArrowR size={14} /></button>
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-h">
          <h2>{T("Certifications", "认证与合规")}</h2>
          <p>{T("Independent audits and frameworks we adhere to.", "我们坚持的独立审计与合规框架。")}</p>
        </div>
        <div className="security-certs">
          {certs.map((c) => (
            <div key={c.k} className="security-cert">
              <div className="security-cert-h">
                <I.Shield size={15} style={{ color: "var(--accent)" }} />
                <b>{c.k}</b>
              </div>
              <span className="security-cert-s">{c.s}</span>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-h">
          <h2>{T("How we protect your code", "我们如何保护你的代码")}</h2>
          <p>{T("Six principles that show up everywhere in the architecture.", "六条贯穿整个系统架构的原则。")}</p>
        </div>
        <div className="security-grid">
          {principles.map((p, i) => (
            <div key={i} className="security-card">
              <div className="security-card-i">{p.i}</div>
              <h3>{p.h}</h3>
              <p>{p.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-h">
          <h2>{T("Vulnerability disclosure", "漏洞披露")}</h2>
          <p>{T("Found something? Tell us first — we'll make sure it gets fixed and credited.", "发现问题? 请先告知我们 — 我们会负责修复并致谢。")}</p>
        </div>
        <div className="security-vd card">
          <div className="security-vd-l">
            <I.Bug size={18} style={{ color: "var(--sev-critical)" }} />
            <div>
              <b>{T("Email", "邮箱")} security@pullwise.dev</b>
              <p>{T("PGP key on the contact page. Response within 24 hours.", "联系页提供 PGP 公钥。24 小时内回复。")}</p>
            </div>
          </div>
          <div className="security-vd-l">
            <I.Tag size={18} style={{ color: "var(--accent)" }} />
            <div>
              <b>{T("Bug bounty", "漏洞奖励")}</b>
              <p>{T("Paid via HackerOne. Up to $10,000 for critical findings.", "通过 HackerOne 发放,critical 漏洞最高 $10,000。")}</p>
            </div>
          </div>
          <div className="security-vd-l">
            <I.Clock size={18} style={{ color: "var(--text-2)" }} />
            <div>
              <b>{T("Safe-harbor policy", "Safe-harbor 政策")}</b>
              <p>{T("Good-faith research is welcome — we will not pursue legal action.", "欢迎善意研究 — 我们不会采取法律行动。")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-cta-band">
        <h2>{T("Need a deeper dive? Talk to our security team.", "需要更详细的说明? 联系我们的安全团队。")}</h2>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn primary lg"><I.Mail /> {T("Email security team", "联系安全团队")}</button>
          <button className="btn lg" onClick={() => go("status")}>{T("View live status", "查看运行状态")} <I.ArrowR size={14} /></button>
        </div>
      </section>
    </LegalChrome>
  );
}

// ── Status ──────────────────────────────────────────────────────────────
const STATUS_COMPONENTS = [
  { k: "api", t_en: "REST API", t_zh: "REST API", region: "Global" },
  { k: "scanner", t_en: "Scan workers", t_zh: "扫描 worker", region: "us-east-1, eu-west-1" },
  { k: "ai", t_en: "AI inference", t_zh: "AI 推理", region: "Anthropic upstream" },
  { k: "github", t_en: "GitHub integration", t_zh: "GitHub 集成", region: "Webhooks + App" },
  { k: "web", t_en: "Web app", t_zh: "Web 应用", region: "pullwise.dev" },
  { k: "auth", t_en: "Authentication", t_zh: "认证服务", region: "OAuth + magic links" },
  { k: "billing", t_en: "Billing", t_zh: "计费", region: "Stripe upstream" },
];

function generateUptimeSeries(seed, rareDip = 0.03) {
  const days = 90;
  const out = [];
  let rnd = seed;
  for (let i = 0; i < days; i++) {
    rnd = (rnd * 9301 + 49297) % 233280;
    const r = rnd / 233280;
    if (r < rareDip) out.push("incident");
    else if (r < rareDip + 0.04) out.push("degraded");
    else out.push("up");
  }
  return out;
}

const INCIDENTS = [
  {
    id: "i-2026-04-30",
    date: "2026-04-30",
    title_en: "Elevated scan latency in eu-west-1",
    title_zh: "eu-west-1 区域扫描延迟升高",
    sev: "minor",
    duration: "47m",
    updates: [
      { t_en: "Resolved", t_zh: "已解决", time: "12:42 UTC", body_en: "All scan workers back to normal. Root cause was a saturated egress link to GitHub API.", body_zh: "扫描 worker 已恢复正常。根因是出口至 GitHub API 的链路饱和。" },
      { t_en: "Identified", t_zh: "已定位", time: "12:18 UTC", body_en: "Network team rerouted traffic via a secondary peering link.", body_zh: "网络团队已通过备用对等链路重路由流量。" },
      { t_en: "Investigating", t_zh: "排查中", time: "11:55 UTC", body_en: "Customers may see scan times of 2-3x normal.", body_zh: "用户可能看到扫描耗时为正常水平的 2-3 倍。" },
    ],
  },
  {
    id: "i-2026-04-12",
    date: "2026-04-12",
    title_en: "Webhooks delayed during GitHub incident",
    title_zh: "GitHub 故障期间 Webhook 延迟",
    sev: "minor",
    duration: "1h 4m",
    updates: [
      { t_en: "Resolved", t_zh: "已解决", time: "08:52 UTC", body_en: "GitHub status returned to normal; queued events processed.", body_zh: "GitHub 状态恢复正常,排队事件已处理完毕。" },
      { t_en: "Monitoring", t_zh: "监控中", time: "08:11 UTC", body_en: "Backfilling missed webhooks via the GitHub events API.", body_zh: "通过 GitHub events API 补回遗漏的 webhook。" },
    ],
  },
  {
    id: "i-2026-03-19",
    date: "2026-03-19",
    title_en: "Brief web app outage during deploy",
    title_zh: "部署期间 Web 应用短暂不可用",
    sev: "major",
    duration: "8m",
    updates: [
      { t_en: "Resolved", t_zh: "已解决", time: "16:38 UTC", body_en: "Bad migration rolled back. Postmortem at status.pullwise.dev/postmortems/2026-03-19.", body_zh: "异常的数据库迁移已回滚。事故复盘见 status.pullwise.dev/postmortems/2026-03-19。" },
    ],
  },
];

function StatusBar({ series }) {
  return (
    <div className="status-bar">
      {series.map((s, i) => (
        <span key={i} className={"status-bar-i " + s} title={`${90 - i}d ago · ${s}`}></span>
      ))}
    </div>
  );
}

export function StatusScreen({ go }) {
  useLang();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const components = STATUS_COMPONENTS.map((c, i) => {
    const seed = (i + 1) * 7919;
    const series = generateUptimeSeries(seed, c.k === "scanner" ? 0.04 : c.k === "ai" ? 0.05 : 0.02);
    const last = series[series.length - 1];
    const ok = series.filter((s) => s === "up").length;
    return { ...c, series, last, uptime: ((ok / series.length) * 100).toFixed(2) };
  });

  const overall = components.every((c) => c.last === "up")
    ? "operational"
    : components.some((c) => c.last === "incident")
      ? "incident"
      : "degraded";

  const overallTitle = {
    operational: T("All systems operational", "所有系统运行正常"),
    degraded:    T("Some services are degraded", "部分服务降级"),
    incident:    T("Active incident", "有正在发生的事故"),
  }[overall];

  return (
    <LegalChrome go={go} current="status">
      <section className="status-hero">
        <div className={"status-overall " + overall}>
          <span className="status-dot"></span>
          <h1>{overallTitle}</h1>
        </div>
        <p className="status-sub">
          {T("Last checked", "最近检查")} {now.toLocaleTimeString()} · {T("Auto-refreshes every 30s", "每 30 秒自动刷新")}
        </p>
        <div className="status-cta">
          <button className="btn"><I.Bell size={13} /> {T("Subscribe to updates", "订阅状态更新")}</button>
          <button className="btn"><I.Code size={13} /> {T("RSS feed", "RSS 订阅")}</button>
        </div>
      </section>

      <section className="status-section">
        <div className="status-card card">
          <div className="status-card-h">
            <h2>{T("Components", "服务组件")}</h2>
            <span className="muted">{T("Past 90 days", "过去 90 天")}</span>
          </div>
          {components.map((c) => (
            <div key={c.k} className="status-row">
              <div className="status-row-meta">
                <div className="status-row-t">
                  <span className={"status-dot " + c.last}></span>
                  <b>{T(c.t_en, c.t_zh)}</b>
                </div>
                <div className="status-row-region">{c.region}</div>
              </div>
              <StatusBar series={c.series} />
              <div className="status-row-pct">
                <b>{c.uptime}%</b>
                <span>{T("uptime", "可用率")}</span>
              </div>
            </div>
          ))}
          <div className="status-legend">
            <span><span className="status-dot up"></span>{T("Operational", "正常")}</span>
            <span><span className="status-dot degraded"></span>{T("Degraded", "降级")}</span>
            <span><span className="status-dot incident"></span>{T("Incident", "事故")}</span>
          </div>
        </div>
      </section>

      <section className="status-section">
        <div className="status-card card">
          <div className="status-card-h">
            <h2>{T("Recent incidents", "最近事故")}</h2>
            <span className="muted">{T("Last 90 days", "过去 90 天")}</span>
          </div>
          {INCIDENTS.length === 0 && (
            <div className="status-empty">{T("No incidents in the last 90 days.", "过去 90 天内无事故。")}</div>
          )}
          {INCIDENTS.map((inc) => (
            <article key={inc.id} className="status-inc">
              <div className="status-inc-h">
                <span className={"status-inc-sev " + inc.sev}>{inc.sev}</span>
                <h3>{T(inc.title_en, inc.title_zh)}</h3>
                <span className="muted">{inc.date} · {inc.duration}</span>
              </div>
              <ol className="status-inc-tl">
                {inc.updates.map((u, i) => (
                  <li key={i}>
                    <span className="status-inc-tl-h"><b>{T(u.t_en, u.t_zh)}</b><span className="muted">{u.time}</span></span>
                    <p>{T(u.body_en, u.body_zh)}</p>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </LegalChrome>
  );
}
