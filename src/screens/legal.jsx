import { useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const CONTACT_EMAIL = "contact@pull-wise.com";
const SECURITY_EMAIL = "security@pull-wise.com";

function LegalChrome({ go, current, children, auth }) {
  useLang();
  return (
    <div className="landing fade-in">
      <PublicHeader go={go} current={current} auth={auth} />

      {children}

      <PublicFooter go={go} current={current} />
    </div>
  );
}

function LegalDocLayout({ go, current, sections, title, subtitle, children, auth }) {
  return (
    <LegalChrome go={go} current={current} auth={auth}>
      <div className="legal-shell">
        <aside className="legal-side">
          <div className="legal-side-h">{T("On this page", "本页内容")}</div>
          {sections.map((section) => (
            <a key={section.id} className="legal-side-i" href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
          <div className="legal-side-foot">
            <div className="legal-side-l">{T("Last updated", "最后更新")}</div>
            <div className="legal-side-d">2026-05-29</div>
          </div>
        </aside>
        <main className="legal-main">
          <div className="legal-crumbs">
            <a {...screenLinkProps(go, "landing")}>
              Pullwise
            </a>
            <span className="sep">/</span>
            <span className="now">{title}</span>
          </div>
          <h1 className="legal-h1">{title}</h1>
          {subtitle && <p className="legal-lede">{subtitle}</p>}
          {children}
          <div className="legal-foot-actions">
            <span className="muted">
              {T(
                `Questions? Email ${CONTACT_EMAIL}.`,
                `如有问题，请联系 ${CONTACT_EMAIL}。`
              )}
            </span>
          </div>
        </main>
      </div>
    </LegalChrome>
  );
}

function Section({ id, title, children }) {
  return (
    <>
      <h2 className="legal-h2" id={id}>
        {title}
      </h2>
      {children}
    </>
  );
}

function LegalList({ items }) {
  return (
    <ul className="legal-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PrivacyScreen({ go, auth }) {
  useLang();
  const sections = [
    { id: "scope", title: T("Scope", "适用范围") },
    { id: "data", title: T("Data we collect", "我们收集的数据") },
    { id: "code", title: T("Repository code", "仓库代码") },
    { id: "use", title: T("How we use data", "数据用途") },
    { id: "sharing", title: T("Processors and sharing", "处理方和共享") },
    { id: "retention", title: T("Retention", "保留期限") },
    { id: "rights", title: T("Your choices and rights", "你的选择和权利") },
    { id: "security", title: T("Security", "安全") },
    { id: "contact", title: T("Contact", "联系方式") },
  ];

  return (
    <LegalDocLayout
      go={go}
      auth={auth}
      current="privacy"
      sections={sections}
      title={T("Privacy Policy", "隐私政策")}
      subtitle={T(
        "This Privacy Policy explains how Pullwise collects and uses account, GitHub, billing, API, and scan data for the Pullwise code review service.",
        "本隐私政策说明 Pullwise 如何为了代码审查服务收集和使用账户、GitHub、支付、API 和扫描数据。"
      )}
    >
      <Section id="scope" title={sections[0].title}>
        <p>
          {T(
            "Pullwise is operated for the official website pull-wise.com and the API service at https://api.pull-wise.com. This policy applies to the web app, public REST API, GitHub-connected review workflows, billing pages, and support communications.",
            "Pullwise 面向官方网站 pull-wise.com 和 API 服务 https://api.pull-wise.com 运营。本政策适用于 Web 应用、公开 REST API、连接 GitHub 的审查流程、支付页面和支持沟通。"
          )}
        </p>
        <p>
          {T(
            "Pullwise is intended for users who connect repositories they are authorized to access. If you use Pullwise for an organization, you confirm that you have authority to connect that organization's GitHub resources.",
            "Pullwise 面向连接其有权访问仓库的用户。如果你代表组织使用 Pullwise，你确认自己有权连接该组织的 GitHub 资源。"
          )}
        </p>
      </Section>
      <Section id="data" title={sections[1].title}>
        <p>
          {T(
            "We collect the information needed to provide and operate Pullwise. This includes your email address, GitHub profile metadata, GitHub identity identifiers, authorized repository metadata, installation metadata, account settings, subscription status, billing provider identifiers, API key metadata, scan records, issue findings, pull request workflow records, and operational logs.",
            "我们会收集提供和运营 Pullwise 所需的信息，包括邮箱地址、GitHub 资料元数据、GitHub 身份标识、已授权仓库元数据、安装元数据、账户设置、订阅状态、支付平台标识、API key 元数据、扫描记录、问题发现、pull request 工作流记录和运行日志。"
          )}
        </p>
        <LegalList
          items={[
            T("Account data: email, session state, GitHub login, and linked GitHub identities.", "账户数据：邮箱、会话状态、GitHub 登录名和已关联的 GitHub 身份。"),
            T("Repository data: repository id, full name, owner, default branch, visibility, GitHub App installation, permissions, and repository quota.", "仓库数据：仓库 id、完整名称、所有者、默认分支、可见性、GitHub App 安装、权限和仓库配额。"),
            T("API data: API key name, key prefix, hashed key value, scopes, creation time, last used time, and revocation state. The full API key token is shown only once.", "API 数据：API key 名称、key 前缀、哈希后的 key 值、权限范围、创建时间、最近使用时间和吊销状态。完整 API key token 只显示一次。"),
            T("Review data: scan id, branch, commit, status, phase, issue counts, structured findings, and fix or pull request workflow records when you use those features.", "审查数据：扫描 id、分支、commit、状态、阶段、问题计数、结构化发现，以及你使用修复或 pull request 功能时产生的工作流记录。"),
          ]}
        />
      </Section>
      <Section id="code" title={sections[2].title}>
        <p>
          {T(
            "Repository contents are cloned by backend workers only to perform scans or fix previews that you initiate. Source code is not stored in the browser, is not exposed to other Pullwise accounts, and is not used by Pullwise to train models.",
            "仓库内容只会由后端 worker 为你主动启动的扫描或修复预览而克隆。源代码不会存入浏览器，不会暴露给其他 Pullwise 账户，Pullwise 不会将你的代码用于训练模型。"
          )}
        </p>
        <p>
          {T(
            "When Pullwise calls an external review provider, repository content and scan context may be processed by that provider solely to generate findings or proposed fixes for your repository. Pullwise keeps provider credentials on the backend.",
            "当 Pullwise 调用外部审查提供方时，仓库内容和扫描上下文可能会由该提供方处理，但目的仅限于为你的仓库生成发现或建议修复。Pullwise 将提供方凭据保存在后端。"
          )}
        </p>
      </Section>
      <Section id="use" title={sections[3].title}>
        <p>
          {T(
            "We use data to authenticate users, connect GitHub repositories, run scans, show findings, manage API keys, enforce quota and rate limits, process subscriptions, prevent abuse, maintain service reliability, investigate errors, and respond to support requests.",
            "我们使用数据来认证用户、连接 GitHub 仓库、运行扫描、展示发现、管理 API key、执行配额和限流、处理订阅、防止滥用、维护服务可靠性、排查错误并响应支持请求。"
          )}
        </p>
        <p>
          {T(
            "We do not sell your personal data or repository code. We do not use private repository code for advertising.",
            "我们不会出售你的个人数据或仓库代码。我们不会将私有仓库代码用于广告。"
          )}
        </p>
      </Section>
      <Section id="sharing" title={sections[4].title}>
        <p>
          {T(
            "Pullwise uses service providers only as needed to operate the product. These may include hosting and database infrastructure, GitHub for authentication and repository access, payment processors such as Stripe or Creem when enabled, email or support systems, and configured review providers.",
            "Pullwise 只在运营产品所需范围内使用服务提供商。这些提供商可能包括托管和数据库基础设施、用于认证和仓库访问的 GitHub、启用时的 Stripe 或 Creem 等支付处理方、邮件或支持系统，以及已配置的审查提供方。"
          )}
        </p>
        <p>
          {T(
            "Payment card details are handled by the payment provider. Pullwise stores provider customer and subscription identifiers, plan state, and webhook event records, but does not store full card numbers.",
            "银行卡详情由支付提供方处理。Pullwise 保存支付平台客户和订阅标识、套餐状态和 webhook 事件记录，但不保存完整银行卡号。"
          )}
        </p>
      </Section>
      <Section id="retention" title={sections[5].title}>
        <p>
          {T(
            "Account, GitHub authorization, API key metadata, billing metadata, and subscription records are kept while your account is active or while needed for service operation, security, tax, audit, or legal reasons. Scan findings and scan history may be retained so you can review past results and may be deleted when you close your account, subject to backup, security, and legal retention needs.",
            "账户、GitHub 授权、API key 元数据、支付元数据和订阅记录会在账户有效期间保留，或在服务运营、安全、税务、审计或法律需要期间保留。扫描发现和扫描历史可能会被保留，以便你查看历史结果；关闭账户时可以删除，但仍受备份、安全和法律保留需求限制。"
          )}
        </p>
        <p>
          {T(
            "Revoked API keys are no longer accepted, but metadata may be kept to support audit trails and abuse prevention.",
            "已吊销的 API key 不再被接受，但其元数据可能会为审计记录和防止滥用而保留。"
          )}
        </p>
      </Section>
      <Section id="rights" title={sections[6].title}>
        <p>
          {T(
            `You can request access, export, correction, or deletion of your account data by contacting ${CONTACT_EMAIL}. You can also revoke API keys, disconnect GitHub access, and cancel or manage subscriptions from the product where those controls are available.`,
            `你可以通过 ${CONTACT_EMAIL} 请求访问、导出、更正或删除账户数据。你也可以在产品提供相应控件时吊销 API key、断开 GitHub 访问，以及取消或管理订阅。`
          )}
        </p>
      </Section>
      <Section id="security" title={sections[7].title}>
        <p>
          {T(
            "Pullwise uses backend-held secrets, scoped API keys, GitHub authorization checks, body-size limits, optional rate limiting, CORS controls, and server-side persistence. No internet service can be guaranteed perfectly secure, so you are responsible for protecting your GitHub account, Pullwise sessions, and API keys.",
            "Pullwise 使用后端保存的密钥、带权限范围的 API key、GitHub 授权检查、body 大小限制、可选限流、CORS 控制和服务端持久化。任何互联网服务都无法保证绝对安全，因此你需要保护自己的 GitHub 账户、Pullwise 会话和 API key。"
          )}
        </p>
      </Section>
      <Section id="contact" title={sections[8].title}>
        <p>
          {T(
            `For privacy questions or data requests, contact ${CONTACT_EMAIL}. For security reports, contact ${SECURITY_EMAIL}.`,
            `隐私问题或数据请求请联系 ${CONTACT_EMAIL}。安全问题报告请联系 ${SECURITY_EMAIL}。`
          )}
        </p>
      </Section>
    </LegalDocLayout>
  );
}

export function TermsScreen({ go, auth }) {
  useLang();
  const sections = [
    { id: "acceptance", title: T("Acceptance", "接受条款") },
    { id: "service", title: T("Service", "服务") },
    { id: "account", title: T("Account and GitHub access", "账户和 GitHub 访问") },
    { id: "api", title: T("API use", "API 使用") },
    { id: "billing", title: T("Billing", "支付") },
    { id: "limits", title: T("Acceptable use", "可接受使用") },
    { id: "content", title: T("Customer content", "客户内容") },
    { id: "liability", title: T("Disclaimers and liability", "免责声明和责任") },
    { id: "termination", title: T("Termination", "终止") },
    { id: "contact", title: T("Contact", "联系方式") },
  ];

  return (
    <LegalDocLayout
      go={go}
      auth={auth}
      current="terms"
      sections={sections}
      title={T("Terms of Service", "服务条款")}
      subtitle={T(
        "These Terms govern your use of Pullwise, including the web app at pull-wise.com, the API service at https://api.pull-wise.com, GitHub-connected review workflows, API keys, and billing features.",
        "本条款适用于你对 Pullwise 的使用，包括 pull-wise.com 上的 Web 应用、https://api.pull-wise.com 上的 API 服务、连接 GitHub 的审查流程、API key 和支付功能。"
      )}
    >
      <Section id="acceptance" title={sections[0].title}>
        <p>
          {T(
            "By accessing or using Pullwise, you agree to these Terms. If you use Pullwise on behalf of an organization, you represent that you have authority to bind that organization and to connect the GitHub repositories you authorize.",
            "访问或使用 Pullwise 即表示你同意本条款。如果你代表组织使用 Pullwise，你声明自己有权约束该组织，并有权连接你授权的 GitHub 仓库。"
          )}
        </p>
      </Section>
      <Section id="service" title={sections[1].title}>
        <p>
          {T(
            "Pullwise provides GitHub-connected code review workflows. The service can list authorized repositories, queue scans, store scan history, generate structured findings, expose account-scoped REST API endpoints, and help with fix or pull request workflows when those features are enabled.",
            "Pullwise 提供连接 GitHub 的代码审查流程。服务可以列出已授权仓库、排队扫描、保存扫描历史、生成结构化发现、提供账户范围的 REST API 端点，并在启用相关功能时协助修复或 pull request 工作流。"
          )}
        </p>
        <p>
          {T(
            "Findings, summaries, proposed fixes, and generated pull request content are recommendations. You are responsible for reviewing the underlying code and deciding whether to rely on or merge any result.",
            "审查发现、摘要、建议修复和生成的 pull request 内容均为建议。你需要负责审查底层代码，并决定是否采纳或合并任何结果。"
          )}
        </p>
      </Section>
      <Section id="account" title={sections[2].title}>
        <p>
          {T(
            "You are responsible for maintaining the security of your GitHub account, email inbox, Pullwise sessions, API keys, and connected repositories. Repository access is controlled through GitHub OAuth and GitHub App authorization.",
            "你需要负责维护 GitHub 账户、邮箱、Pullwise 会话、API key 和已连接仓库的安全。仓库访问通过 GitHub OAuth 和 GitHub App 授权控制。"
          )}
        </p>
        <p>
          {T(
            "You may only connect repositories and organizations that you are authorized to access. If your authorization changes, you must update or disconnect the relevant Pullwise access.",
            "你只能连接自己有权访问的仓库和组织。如果你的授权发生变化，你必须更新或断开相应的 Pullwise 访问。"
          )}
        </p>
      </Section>
      <Section id="api" title={sections[3].title}>
        <p>
          {T(
            "Pullwise API keys are account-scoped credentials. They inherit the creator's authorized repositories and are limited by configured scopes such as repositories:read, scans:write, scans:read, and quota:read. You must keep API keys confidential and revoke keys that may be exposed.",
            "Pullwise API key 是账户范围的凭据。它们继承创建者已授权的仓库，并受 repositories:read、scans:write、scans:read、quota:read 等配置权限限制。你必须保密 API key，并吊销可能已暴露的密钥。"
          )}
        </p>
        <p>
          {T(
            "You may not bypass rate limits, quota controls, authentication, authorization checks, or repository access restrictions. Pullwise may suspend or revoke API access that risks service stability or security.",
            "你不得绕过限流、配额控制、认证、授权检查或仓库访问限制。对于影响服务稳定性或安全性的 API 访问，Pullwise 可以暂停或吊销。"
          )}
        </p>
      </Section>
      <Section id="billing" title={sections[4].title}>
        <p>
          {T(
            "Paid subscriptions, if available, are billed through the configured payment provider, such as Stripe or Creem. Prices, quotas, plan limits, renewal terms, taxes, and cancellation options are shown in the product or payment flow before purchase.",
            "如提供付费订阅，订阅将通过配置的支付提供方收费，例如 Stripe 或 Creem。价格、配额、套餐限制、续费条款、税费和取消选项会在购买前于产品或支付流程中展示。"
          )}
        </p>
        <p>
          {T(
            "You can manage or cancel an active subscription from the billing page when a provider portal is available. Unless required by law or explicitly stated in the product, fees already incurred are non-refundable.",
            "当支付提供方门户可用时，你可以从支付页面管理或取消有效订阅。除非法律要求或产品中明确说明，已经产生的费用不予退款。"
          )}
        </p>
      </Section>
      <Section id="limits" title={sections[5].title}>
        <p>
          {T(
            "You must not use Pullwise to scan repositories you are not authorized to access, process illegal or harmful content, exfiltrate secrets, attack GitHub, payment providers, review providers, or Pullwise infrastructure, overload the service, reverse engineer non-public systems, or violate another party's rights.",
            "你不得使用 Pullwise 扫描未授权仓库、处理违法或有害内容、窃取密钥、攻击 GitHub、支付提供方、审查提供方或 Pullwise 基础设施、过载服务、逆向非公开系统，或侵犯他人权利。"
          )}
        </p>
      </Section>
      <Section id="content" title={sections[6].title}>
        <p>
          {T(
            "You retain ownership of your repository code and other customer content. You grant Pullwise the limited rights needed to host, clone, process, analyze, display, and transmit that content only to provide, secure, support, and improve the service.",
            "你保留对仓库代码和其他客户内容的所有权。你授予 Pullwise 为提供、保护、支持和改进服务所必需的有限权利，以托管、克隆、处理、分析、展示和传输这些内容。"
          )}
        </p>
        <p>
          {T(
            "Pullwise retains ownership of the service, software, documentation, trademarks, and product design, except for customer content and third-party materials.",
            "Pullwise 保留对服务、软件、文档、商标和产品设计的所有权，但不包括客户内容和第三方材料。"
          )}
        </p>
      </Section>
      <Section id="liability" title={sections[7].title}>
        <p>
          {T(
            "Pullwise is provided as a software service and may change over time. To the maximum extent permitted by law, the service is provided without warranties of uninterrupted availability, error-free operation, or fitness for a particular purpose.",
            "Pullwise 作为软件服务提供，并可能随时间变化。在法律允许的最大范围内，服务不保证持续可用、无错误运行或适合特定目的。"
          )}
        </p>
        <p>
          {T(
            "To the maximum extent permitted by law, Pullwise is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost data, security incidents caused by your credential handling, or decisions you make based on review findings.",
            "在法律允许的最大范围内，Pullwise 不对间接、附带、特殊、后果性、惩戒性或惩罚性损害承担责任，也不对利润损失、收入损失、数据损失、因你的凭据处理导致的安全事件，或你基于审查发现作出的决定承担责任。"
          )}
        </p>
      </Section>
      <Section id="termination" title={sections[8].title}>
        <p>
          {T(
            "You may stop using Pullwise at any time. Pullwise may suspend or terminate access if you violate these Terms, create security or operational risk, fail to pay applicable fees, or use the service unlawfully. After termination, some records may be retained as described in the Privacy Policy.",
            "你可以随时停止使用 Pullwise。如果你违反本条款、造成安全或运营风险、未支付适用费用，或非法使用服务，Pullwise 可以暂停或终止访问。终止后，部分记录可能会按隐私政策所述继续保留。"
          )}
        </p>
      </Section>
      <Section id="contact" title={sections[9].title}>
        <p>
          {T(
            `For questions about these Terms, contact ${CONTACT_EMAIL}.`,
            `如对本条款有疑问，请联系 ${CONTACT_EMAIL}。`
          )}
        </p>
      </Section>
    </LegalDocLayout>
  );
}

export function SecurityScreen({ go, auth }) {
  useLang();
  const controls = [
    {
      icon: <I.Github size={18} />,
      title: T("GitHub App permissions", "GitHub App 权限"),
      text: T(
        "Pullwise requires repository contents and pull request permissions to scan code, push fix branches, and open pull requests.",
        "Pullwise 需要仓库内容和 PR 权限来扫描代码、推送修复分支并创建 PR。"
      ),
    },
    {
      icon: <I.Lock size={18} />,
      title: T("Secret isolation", "密钥隔离"),
      text: T(
        "OAuth secrets, GitHub App private keys, payment API keys, and Codex credentials stay on the backend.",
        "OAuth 密钥、GitHub App 私钥、支付 API key 和 Codex 凭据只保存在后端。"
      ),
    },
    {
      icon: <I.Terminal size={18} />,
      title: T("Repository review runner", "仓库审查运行器"),
      text: T(
        "Codex review runs against a backend checkout with read-only sandbox settings and emits structured findings.",
        "Codex 审查在后端 checkout 中以只读沙箱运行，并输出结构化发现。"
      ),
    },
    {
      icon: <I.Database size={18} />,
      title: T("Server-backed state", "服务端状态"),
      text: T(
        "Sessions, repository authorization, scans, findings, and billing status are persisted by the backend, not browser fixtures.",
        "会话、仓库授权、扫描、发现和支付状态由后端持久化，而不是浏览器假数据。"
      ),
    },
  ];

  return (
    <LegalChrome go={go} current="security" auth={auth}>
      <section className="security-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: "var(--accent)" }} />
          <span>{T("Security", "安全")}</span>
        </div>
        <h1 className="lp-title">
          {T("A conservative security baseline", "保守可靠的安全基线")}
          <br />
          <span className="lp-title-em">
            {T("for GitHub-connected review.", "用于连接 GitHub 的代码审查。")}
          </span>
        </h1>
        <p className="lp-sub">
          {T(
            "This page describes implemented controls only. Pullwise does not claim third-party certifications unless they are explicitly published here later.",
            "本页只描述已实现的控制措施。除非未来在此明确发布，Pullwise 不声明第三方合规认证。"
          )}
        </p>
      </section>

      <section className="security-section">
        <div className="security-section-h">
          <h2>{T("Implemented controls", "已实现控制")}</h2>
          <p>
            {T(
              "Controls that exist in the product architecture today.",
              "当前产品架构中已经存在的控制措施。"
            )}
          </p>
        </div>
        <div className="security-grid">
          {controls.map((item) => (
            <div key={item.title} className="security-card">
              <div className="security-card-i">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta-band">
        <h2>{T("Report a security issue", "报告安全问题")}</h2>
        <a className="btn primary lg" href={`mailto:${SECURITY_EMAIL}`}>
          <I.Mail /> {SECURITY_EMAIL}
        </a>
      </section>
    </LegalChrome>
  );
}

const STATUS_REFRESH_MS = 30_000;

function statusClass(ok, error) {
  if (ok) return "operational";
  return error ? "incident" : "degraded";
}

function StatusRow({ icon, title, status, detail }) {
  return (
    <div className="status-row">
      <div className="status-row-meta">
        <div className="status-row-t">
          <span className={"status-dot " + status} />
          <b>{title}</b>
        </div>
        <div className="status-row-region">{detail}</div>
      </div>
      <div className="status-row-pct" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span>{status}</span>
      </div>
    </div>
  );
}

function configuredLabel(value, configured, missing) {
  return value ? configured : missing;
}

function readinessAvailable(health) {
  return Boolean(health?.reviewProvider || health?.github || health?.billing || health?.limits);
}

function AdminWorkerControls({ worker, onChanged }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [copyValue, setCopyValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [region, setRegion] = useState(worker.region || "");
  const [version, setVersion] = useState(worker.version || "");
  const [capacity, setCapacity] = useState(String(worker.max_concurrent_jobs || 1));

  async function runAction(action, fn) {
    setBusy(action);
    setMessage("");
    setCopyValue("");
    setConfirmDelete(false);
    try {
      const payload = await fn();
      if (payload?.deleted) {
        setMessage("Worker deleted.");
      } else if (payload?.message) {
        setMessage(payload.message);
      } else if (payload?.worker_token) {
        setMessage(`New token: ${payload.worker_token}`);
        setCopyValue(payload.worker_token);
      } else if (payload?.install_command) {
        setMessage(payload.install_command);
        setCopyValue(payload.install_command);
      } else if (payload?.result) {
        setMessage(payload.result.ok ? "Worker checks passed." : "Worker checks need attention.");
      } else {
        setMessage("Worker updated.");
      }
      onChanged?.(payload);
    } catch (error) {
      setMessage(error?.message || "Worker action failed.");
    } finally {
      setBusy("");
    }
  }

  async function copyMessage() {
    if (!copyValue || !navigator.clipboard) return;
    await navigator.clipboard.writeText(copyValue);
  }

  const workerId = worker.worker_id;
  return (
    <div className="status-row-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, flexBasis: "100%" }}>
        <input aria-label="Worker region" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Region" />
        <input aria-label="Worker version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="Version" />
        <input aria-label="Worker capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)} type="number" min="1" placeholder="Capacity" />
      </div>
      <button
        className="btn sm"
        disabled={Boolean(busy)}
        onClick={() =>
          runAction("save", () =>
            pullwiseApi.system.updateWorker(workerId, {
              region,
              version,
              max_concurrent_jobs: Number(capacity) || 1,
            })
          )
        }
      >
        <I.Check size={14} /> Save
      </button>
      {worker.enabled === false ? (
        <button
          className="btn sm"
          disabled={Boolean(busy)}
          onClick={() => runAction("enable", () => pullwiseApi.system.enableWorker(workerId))}
        >
          <I.Play size={14} /> Enable
        </button>
      ) : (
        <button
          className="btn sm"
          disabled={Boolean(busy)}
          title="Stop this worker from accepting new jobs. Running jobs continue."
          onClick={() => runAction("disable", () => pullwiseApi.system.disableWorker(workerId))}
        >
          <I.X size={14} /> Stop new jobs
        </button>
      )}
      <button
        className="btn sm"
        disabled={Boolean(busy)}
        onClick={() => runAction("test", () => pullwiseApi.system.testWorker(workerId))}
      >
        <I.Activity size={14} /> Test
      </button>
      <button
        className="btn sm"
        disabled={Boolean(busy)}
        onClick={() =>
          runAction("audit", async () => {
            const payload = await pullwiseApi.system.getWorker(workerId);
            const events = Array.isArray(payload?.auditEvents) ? payload.auditEvents : [];
            return {
              worker: payload?.worker || worker,
              message: events.length
                ? events.map((event) => `${event.action}: ${event.success ? "ok" : "failed"}`).join("\n")
                : "No audit events.",
            };
          })
        }
      >
        <I.List size={14} /> Audit
      </button>
      <button
        className="btn sm"
        disabled={Boolean(busy)}
        onClick={() => runAction("rotate", () => pullwiseApi.system.rotateWorkerToken(workerId))}
      >
        <I.Refresh size={14} /> Rotate token
      </button>
      <button
        className="btn sm"
        disabled={Boolean(busy)}
        onClick={() => {
          if (confirmDelete) {
            runAction("delete", () => pullwiseApi.system.deleteWorker(workerId));
          } else {
            setConfirmDelete(true);
            setMessage("Confirm delete to remove this worker. Disable it first if you only want to stop new jobs.");
          }
        }}
      >
        <I.X size={14} /> {confirmDelete ? "Confirm delete" : "Delete"}
      </button>
      {message && (
        <div className="status-row-region" style={{ flexBasis: "100%" }}>
          {copyValue && (
            <button className="btn sm" type="button" onClick={copyMessage} style={{ marginRight: 8 }}>
              <I.Copy size={12} /> Copy
            </button>
          )}
          {message}
        </div>
      )}
    </div>
  );
}

function AdminWorkerCreate({ onCreated }) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [version, setVersion] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copyValue, setCopyValue] = useState("");

  async function createWorker(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setCopyValue("");
    try {
      const payload = await pullwiseApi.system.createWorker({
        name: name || "Worker",
        provider: "codex",
        region,
        version,
        max_concurrent_jobs: Number(capacity) || 1,
      });
      const installCommand = payload?.install_command || "";
      setMessage(installCommand || `Worker token: ${payload?.worker_token || ""}`);
      setCopyValue(installCommand || payload?.worker_token || "");
      setName("");
      setRegion("");
      setVersion("");
      setCapacity("1");
      onCreated?.(payload);
    } catch (error) {
      setMessage(error?.message || "Worker creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCreated() {
    if (!copyValue || !navigator.clipboard) return;
    await navigator.clipboard.writeText(copyValue);
  }

  return (
    <form onSubmit={createWorker} className="worker-create" style={{ display: "grid", gap: 8, marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <input aria-label="New worker name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Worker name" />
        <input aria-label="New worker region" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Region" />
        <input aria-label="New worker version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="Version" />
        <input aria-label="New worker capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)} type="number" min="1" placeholder="Capacity" />
      </div>
      <button className="btn sm" disabled={busy} type="submit">
        <I.Plus size={14} /> Create worker
      </button>
      {message && (
        <div className="status-row-region" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>
          {copyValue && (
            <button className="btn sm" type="button" onClick={copyCreated} style={{ marginRight: 8 }}>
              <I.Copy size={12} /> Copy
            </button>
          )}
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message}</pre>
        </div>
      )}
    </form>
  );
}

export function StatusScreen({ go, auth }) {
  useLang();
  const [now, setNow] = useState(() => new Date());
  const [health, setHealth] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [adminStatus, setAdminStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      setNow(new Date());
      try {
        const payload = await pullwiseApi.system.health();
        const statusPayload =
          typeof pullwiseApi.system.status === "function"
            ? await pullwiseApi.system.status().catch(() => payload?.scanSystem || null)
            : payload?.scanSystem || null;
        const adminPayload =
          auth?.session?.admin && typeof pullwiseApi.system.adminStatus === "function"
            ? await pullwiseApi.system.adminStatus().catch(() => null)
            : null;
        if (!cancelled) {
          setHealth(payload);
          setSystemStatus(statusPayload || payload?.scanSystem || null);
          setAdminStatus(adminPayload);
          setError("");
        }
      } catch (healthError) {
        if (!cancelled) {
          setHealth(null);
          setSystemStatus(null);
          setAdminStatus(null);
          setError(healthError?.message || "Unable to reach the Pullwise API.");
        }
      }
    }

    loadHealth();
    const id = setInterval(loadHealth, STATUS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [auth?.session?.admin]);

  const apiStatus = statusClass(Boolean(health?.ok), error);
  const title = health?.ok
    ? T("API reachable", "API 可访问")
    : error
      ? T("API unreachable", "API 不可访问")
      : T("Checking API", "正在检查 API");
  const apiDetail = health?.service
    ? `${health.service} / ${health.mode || "unknown mode"}`
    : error || "GET /health";
  const github = health?.github || null;
  const billing = health?.billing || null;
  const limits = health?.limits || null;
  const githubReady = Boolean(
    github?.oauthConfigured && github?.appInstallConfigured && github?.appApiConfigured
  );
  const githubDetail = github
    ? [
        configuredLabel(github.oauthConfigured, "OAuth configured", "OAuth missing"),
        configuredLabel(
          github.appInstallConfigured,
          "App install configured",
          "App install missing"
        ),
        configuredLabel(github.appApiConfigured, "App API configured", "App API missing"),
        github.appVisibilityCheck ? "Visibility check on" : "Visibility check off",
      ].join(" / ")
    : "";
  const billingDetail = billing
    ? `${billing.provider || "unknown"} (${billing.enabled ? "enabled" : "not enabled"})`
    : "";
  const limitsDetail = limits
    ? [
        `${limits.maxConcurrentScansPerUser ?? "-"} per user running`,
        `${limits.maxQueuedScansGlobal ?? "-"} global / ${limits.maxQueuedScansPerUser ?? "-"} per user queued`,
        `Rate limiting ${limits.rateLimitEnabled ? "enabled" : "disabled"}`,
      ].join(" - ")
    : "";
  const databaseDetail = health?.database?.type
    ? `${health.database.type}: ${health.database.path || "configured backend path"}`
    : T("Waiting for backend health.", "等待后端健康检查。");

  const scanSystem = adminStatus || systemStatus || health?.scanSystem || null;
  const scanStatus = scanSystem?.scanSystemStatus || "down";
  const scanSystemDetail = scanSystem
    ? `${scanSystem.queuedJobs ?? 0} queued / ${scanSystem.runningJobs ?? 0} running / ${scanSystem.availableCapacity ?? 0} slots available`
    : "Waiting for scan system status.";
  const visibleWorkers = adminStatus && Array.isArray(adminStatus.workers) ? adminStatus.workers : [];

  function refreshAdminWorkers(payload) {
    const worker = payload?.worker;
    if (!worker) return;
    setAdminStatus((current) => {
      if (!current) return current;
      const existing = Array.isArray(current.workers) ? current.workers : [];
      const withoutWorker = existing.filter((item) => item.worker_id !== worker.worker_id);
      if (payload?.deleted) {
        return { ...current, workers: withoutWorker };
      }
      return { ...current, workers: [worker, ...withoutWorker] };
    });
  }

  return (
    <LegalChrome go={go} current="status" auth={auth}>
      <section className="status-hero">
        <div className={"status-overall " + apiStatus}>
          <span className="status-dot" />
          <h1>{title}</h1>
        </div>
        <p className="status-sub">
          {T("Last checked", "最近检查")} {now.toLocaleTimeString()} ·{" "}
          {T("Reads live /health data every 30s", "每 30 秒读取实时 /health 数据")}
        </p>
      </section>

      <section className="status-section">
        <div className="status-card card">
          <div className="status-card-h">
            <h2>{T("Live components", "实时组件")}</h2>
            <span className="muted">
              {T("No generated uptime or incident history", "无生成的 uptime 或事故历史")}
            </span>
          </div>
          <StatusRow
            icon={<I.Code size={14} />}
            title={T("Web app", "Web 应用")}
            status="operational"
            detail={window.location.host || "local browser"}
          />
          <StatusRow
            icon={<I.Activity size={14} />}
            title={T("REST API", "REST API")}
            status={apiStatus}
            detail={apiDetail}
          />
          <StatusRow
            icon={<I.Database size={14} />}
            title={T("State database", "状态数据库")}
            status={health?.database ? "operational" : apiStatus}
            detail={databaseDetail}
          />
          <StatusRow
            icon={<I.Activity size={14} />}
            title="Scan system"
            status={scanStatus === "ok" ? "operational" : scanStatus === "degraded" ? "degraded" : "incident"}
            detail={scanSystemDetail}
          />
          {error && (
            <div className="auth-error" role="alert" style={{ marginTop: 14 }}>
              <I.X size={13} /> {error}
            </div>
          )}
        </div>

        {readinessAvailable(health) && (
          <div className="status-card card" style={{ marginTop: 14 }}>
            <div className="status-card-h">
              <h2>Backend readiness</h2>
              <span className="muted">Configuration visible from safe /health fields</span>
            </div>
            <StatusRow
              icon={<I.Terminal size={14} />}
              title="Review provider"
              status={
                health?.reviewProvider && health.reviewProvider !== "disabled"
                  ? "operational"
                  : "degraded"
              }
              detail={health?.reviewProvider || "disabled"}
            />
            {github && (
              <StatusRow
                icon={<I.Github size={14} />}
                title="GitHub integration"
                status={githubReady ? "operational" : "degraded"}
                detail={githubDetail}
              />
            )}
            {billing && (
              <StatusRow
                icon={<I.Package size={14} />}
                title="Billing provider"
                status={billing.enabled ? "operational" : "degraded"}
                detail={billingDetail}
              />
            )}
            {limits && (
              <StatusRow
                icon={<I.Activity size={14} />}
                title="Runtime limits"
                status={limits.maxConcurrentScansPerUser ? "operational" : "degraded"}
                detail={limitsDetail}
              />
            )}
          </div>
        )}
        {auth?.session?.admin && (
          <div className="status-card card" style={{ marginTop: 14 }}>
            <div className="status-card-h">
              <h2>Worker registry</h2>
              <span className="muted">
                Admin worker lifecycle. Stopping new jobs does not cancel running jobs.
              </span>
            </div>
            <AdminWorkerCreate onCreated={refreshAdminWorkers} />
            {visibleWorkers.map((worker, index) => (
              <div key={worker.worker_id || worker.name || index}>
                <StatusRow
                  icon={<I.Terminal size={14} />}
                  title={worker.name || worker.worker_id}
                  status={
                    ["idle", "busy"].includes(worker.status)
                      ? "operational"
                      : worker.status === "degraded"
                        ? "degraded"
                        : "incident"
                  }
                  detail={`${worker.status} / ${worker.running_jobs ?? 0}/${worker.max_concurrent_jobs ?? 0} jobs / ${worker.provider || "codex"} ${worker.version || ""} / ${worker.region || "unassigned"}`}
                />
                <AdminWorkerControls worker={worker} onChanged={refreshAdminWorkers} />
              </div>
            ))}
          </div>
        )}
      </section>
    </LegalChrome>
  );
}
