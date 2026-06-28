import { useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const CONTACT_EMAIL = "contact@pull-wise.com";
const SECURITY_EMAIL = CONTACT_EMAIL;
const LAST_UPDATED = "2026-06-29";
const STATUS_REFRESH_MS = 30_000;

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
            <div className="legal-side-d">{LAST_UPDATED}</div>
          </div>
        </aside>
        <main className="legal-main">
          <div className="legal-crumbs">
            <a {...screenLinkProps(go, "landing")}>Pullwise</a>
            <span className="sep">/</span>
            <span className="now">{title}</span>
          </div>
          <h1 className="legal-h1">{title}</h1>
          {subtitle && <p className="legal-lede">{subtitle}</p>}
          {children}
          <div className="legal-foot-actions">
            <span className="muted">
              {T(`Questions? Email ${CONTACT_EMAIL}.`, `如有问题，请联系 ${CONTACT_EMAIL}。`)}
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
    { id: "sharing", title: T("Processors and sharing", "处理方与共享") },
    { id: "retention", title: T("Retention", "保留期限") },
    { id: "rights", title: T("Your choices and rights", "你的选择与权利") },
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
        "This Privacy Policy explains how Pullwise handles account, GitHub, billing, API key, quota, repository preflight, scan, finding, and workflow data for its GitHub-connected code review service.",
        "本隐私政策说明 Pullwise 如何在连接 GitHub 的代码审查服务中处理账户、GitHub、计费、API key、配额、仓库预检、扫描、发现和工作流数据。"
      )}
    >
      <Section id="scope" title={sections[0].title}>
        <p>
          {T(
            "Pullwise operates the web app at pull-wise.com and the API service at https://api.pull-wise.com. This policy applies to the web app, public REST API, GitHub-connected review workflows, billing pages, and support communications.",
            "Pullwise 运营 pull-wise.com 上的 Web 应用，以及 https://api.pull-wise.com 上的 API 服务。本政策适用于 Web 应用、公开 REST API、连接 GitHub 的审查流程、计费页面和支持沟通。"
          )}
        </p>
        <p>
          {T(
            "Pullwise is for users who connect repositories they are authorized to access. If you use Pullwise for an organization, you confirm that you have authority to connect that organization's GitHub resources.",
            "Pullwise 面向连接其有权访问仓库的用户。如果你代表组织使用 Pullwise，你确认自己有权连接该组织的 GitHub 资源。"
          )}
        </p>
      </Section>
      <Section id="data" title={sections[1].title}>
        <p>
          {T(
            "We collect the information needed to provide and operate Pullwise, including account identity, GitHub profile and installation metadata, authorized repository metadata, subscription and billing provider identifiers, API key metadata, quota buckets and ledger activity, scan records, repository preflight evidence, progress logs, issue findings, generated reports, fix preview and pull request workflow records, and operational logs.",
            "我们收集提供和运营 Pullwise 所需的信息，包括账户身份、GitHub 资料和安装元数据、已授权仓库元数据、订阅和支付提供方标识、API key 元数据、配额 bucket 与 ledger 活动、扫描记录、仓库预检证据、进度日志、问题发现、生成报告、修复预览和拉取请求流程记录，以及运行日志。"
          )}
        </p>
        <LegalList
          items={[
            T(
              "Account data: email, session state, GitHub login, and linked GitHub identities.",
              "账户数据：邮箱、会话状态、GitHub 登录名和已关联的 GitHub 身份。"
            ),
            T(
              "Repository data: repository id, full name, owner, default branch, visibility, GitHub App installation, permissions, and repository quota.",
              "仓库数据：仓库 id、完整名称、所有者、默认分支、可见性、GitHub App 安装、权限和仓库配额。"
            ),
            T(
              "API data: API key name, key prefix, hashed key value, scopes, creation time, last used time, and revocation state. The full API key token is shown only once.",
              "API 数据：API key 名称、前缀、哈希后的 key 值、权限范围、创建时间、最近使用时间和吊销状态。完整 API key token 只显示一次。"
            ),
            T(
              "Review data: scan id, branch, commit, status, phase, progress logs, repository preflight evidence, issue and verification counts, structured findings, generated reports, audit bundle metadata, and fix or pull request workflow records when you use those features.",
              "审查数据：扫描 id、分支、commit、状态、阶段、进度日志、仓库预检证据、问题和验证计数、结构化发现、生成报告、审计包元数据，以及你使用修复或 pull request 功能时产生的流程记录。"
            ),
          ]}
        />
      </Section>
      <Section id="code" title={sections[2].title}>
        <p>
          {T(
            "Repository contents are cloned by backend workers only for repository preflight, scans, audit evidence, fix previews, or pull request workflows that you initiate. Source code is not stored in the browser, is not exposed to other Pullwise accounts, and is not used by Pullwise to train models.",
            "仓库内容只会由后端 worker 为你主动发起的仓库预检、扫描、审计证据、修复预览或 pull request 工作流进行克隆。源码不会存入浏览器，不会暴露给其他 Pullwise 账户，也不会被 Pullwise 用于训练模型。"
          )}
        </p>
        <p>
          {T(
            "When Pullwise calls a configured external review provider, repository content and scan context may be processed by that provider solely to generate findings or proposed fixes for your repository. Provider credentials stay on the backend.",
            "当 Pullwise 调用已配置的外部审查提供方时，仓库内容和扫描上下文可能会由该提供方处理，但目的仅限于为你的仓库生成发现或建议修复。提供方凭据保存在后端。"
          )}
        </p>
      </Section>
      <Section id="use" title={sections[3].title}>
        <p>
          {T(
            "We use data to authenticate users, connect and manage GitHub repository access, run preflight checks and scans, show findings and reports, generate audit bundles, manage API keys, reserve and consume quota, enforce rate limits, process subscriptions and subscription changes, prevent abuse, maintain reliability, investigate errors, and respond to support requests.",
            "我们使用数据来认证用户、连接和管理 GitHub 仓库访问、运行预检和扫描、展示发现和报告、生成审计包、管理 API key、预留和消耗配额、执行限流、处理订阅和订阅变更、防止滥用、维护服务可靠性、排查错误并响应支持请求。"
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
            "Pullwise uses service providers only as needed to operate the product. These may include hosting and database infrastructure, GitHub for OAuth, GitHub App installation, repository access, and pull request workflows, Creem payments when enabled, support systems, and configured review providers.",
            "Pullwise 仅在运营产品所需范围内使用服务提供方。这些提供方可能包括托管和数据库基础设施、用于 OAuth、GitHub App 安装、仓库访问和 pull request 工作流的 GitHub、启用时的 Creem 支付、支持系统，以及已配置的审查提供方。"
          )}
        </p>
        <p>
          {T(
            "Payment card details are handled by the payment provider. Pullwise stores provider customer and subscription identifiers, plan state, and webhook event records, but does not store full card numbers.",
            "银行卡详情由支付提供方处理。Pullwise 保存支付平台客户和订阅标识、套餐状态和 webhook 事件记录，但不保存完整卡号。"
          )}
        </p>
      </Section>
      <Section id="retention" title={sections[5].title}>
        <p>
          {T(
            "Account, GitHub authorization, API key metadata, billing metadata, subscription records, quota ledger activity, and operational logs are kept while your account is active or while needed for service operation, security, tax, audit, or legal reasons. Scan findings, generated reports, preflight evidence, audit bundle metadata, and history may be retained so you can review past results.",
            "账户、GitHub 授权、API key 元数据、计费元数据、订阅记录、配额 ledger 活动和运行日志会在账户有效期间保留，或在服务运营、安全、税务、审计或法律需要期间保留。扫描发现、生成报告、预检证据、审计包元数据和历史可能会被保留，以便你查看过去结果。"
          )}
        </p>
        <p>
          {T(
            "Revoked API keys are no longer accepted, but metadata may be kept to support audit trails and abuse prevention.",
            "已吊销的 API key 不再被接受，但其元数据可能会为了审计记录和防止滥用而保留。"
          )}
        </p>
      </Section>
      <Section id="rights" title={sections[6].title}>
        <p>
          {T(
            `You can request access, export, correction, or deletion of your account data by contacting ${CONTACT_EMAIL}. You can also revoke API keys, disconnect or manage GitHub access, cancel or resume renewal, and use supported subscription upgrades from Pullwise Billing where those controls are available.`,
            `你可以通过 ${CONTACT_EMAIL} 请求访问、导出、更正或删除账户数据。你也可以在产品提供相应控件时吊销 API key、断开或管理 GitHub 访问、取消或恢复续订，并使用支持的订阅升级。`
          )}
        </p>
      </Section>
      <Section id="security" title={sections[7].title}>
        <p>
          {T(
            "Pullwise uses backend-held secrets, scoped API keys, GitHub authorization checks, branch and repository validation, body-size limits, optional database-backed rate limiting, CORS controls, and server-side persistence. You remain responsible for protecting your GitHub account, Pullwise sessions, and API keys.",
            "Pullwise 使用后端保存的密钥、带权限范围的 API key、GitHub 授权检查、分支和仓库校验、body 大小限制、可选的数据库支持限流、CORS 控制和服务端持久化。你仍需负责保护自己的 GitHub 账户、Pullwise 会话和 API key。"
          )}
        </p>
      </Section>
      <Section id="contact" title={sections[8].title}>
        <p>
          {T(
            `For privacy questions or data requests, contact ${CONTACT_EMAIL}. For security reports, contact ${SECURITY_EMAIL}.`,
            `隐私问题或数据请求请联系 ${CONTACT_EMAIL}。安全报告请联系 ${SECURITY_EMAIL}。`
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
    { id: "account", title: T("Account and GitHub access", "账户与 GitHub 访问") },
    { id: "api", title: T("API use", "API 使用") },
    { id: "billing", title: T("Billing", "计费") },
    { id: "limits", title: T("Acceptable use", "可接受使用") },
    { id: "content", title: T("Customer content", "客户内容") },
    { id: "liability", title: T("Disclaimers and liability", "免责声明与责任") },
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
        "These Terms govern your use of Pullwise, including pull-wise.com, https://api.pull-wise.com, GitHub-connected review workflows, API keys, and billing features.",
        "本条款适用于你对 Pullwise 的使用，包括 pull-wise.com、https://api.pull-wise.com、连接 GitHub 的审查流程、API key 和计费功能。"
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
            "Pullwise provides GitHub-connected code review workflows. The service can list authorized repositories, run repository preflight checks, queue, cancel, and retry scans, store scan history, generate structured findings and reports, expose account-scoped REST API endpoints, manage API keys, show live configuration and status docs, and help preview deterministic fixes or open GitHub pull requests when those features and permissions are available.",
            "Pullwise 提供连接 GitHub 的代码审查流程。服务可以列出已授权仓库、运行仓库预检、排队、取消和重试扫描、保存扫描历史、生成结构化发现和报告、提供账户范围的 REST API 端点、管理 API key、展示实时配置和状态文档，并在功能和权限可用时帮助预览确定性修复或打开 GitHub 拉取请求。"
          )}
        </p>
        <p>
          {T(
            "Findings, summaries, generated reports, proposed fixes, and generated pull request content are recommendations. You are responsible for reviewing the underlying code and deciding whether to rely on or merge any result.",
            "发现、摘要、生成报告、建议修复和生成的 pull request 内容均为建议。你需要负责审查底层代码，并决定是否依赖或合并任何结果。"
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
            "Pullwise API keys are account-scoped credentials. They inherit the creator's authorized repositories and are limited by configured scopes such as repositories:read, scans:write, scans:read, and quota:read. Public scan creation accepts only authorized repositories and validates requested branches and commit SHA values before queueing where applicable.",
            "Pullwise API key 是账户范围的凭据。它们继承创建者已授权的仓库，并受 repositories:read、scans:write、scans:read、quota:read 等配置权限范围限制。公开扫描创建只接受已授权仓库，并会在适用时校验请求分支和 commit SHA 后再入队。"
          )}
        </p>
        <p>
          {T(
            "You may not bypass rate limits, quota reservation or consumption controls, authentication, authorization checks, branch validation, or repository access restrictions. Pullwise may suspend or revoke API access that risks service stability or security.",
            "你不得绕过限流、配额预留或消耗控制、认证、授权检查、分支校验或仓库访问限制。对于影响服务稳定性或安全性的 API 访问，Pullwise 可以暂停或吊销。"
          )}
        </p>
      </Section>
      <Section id="billing" title={sections[4].title}>
        <p>
          {T(
            "Paid subscriptions, if available, are billed through Creem. Prices, quotas, plan limits, renewal terms, taxes, and cancellation options are shown in the product or payment flow before purchase.",
            {
              zh: "如提供付费订阅，订阅将通过 Creem 收费。价格、配额、套餐限制、续费条款、税费和取消选项会在购买前于产品或支付流程中展示。",
              ja: "有料サブスクリプションが提供される場合、請求は Creem を通じて行われます。価格、クォータ、プラン制限、更新条件、税金、キャンセル方法は、購入前に製品内または決済フローで表示されます。",
              ko: "유료 구독이 제공되는 경우 Creem을 통해 청구됩니다. 가격, 할당량, 플랜 한도, 갱신 조건, 세금, 취소 옵션은 구매 전에 제품 또는 결제 흐름에서 표시됩니다.",
              fr: "Les abonnements payants, lorsqu'ils sont disponibles, sont facturés via Creem. Les prix, quotas, limites de forfait, conditions de renouvellement, taxes et options d'annulation sont affichés dans le produit ou le parcours de paiement avant l'achat.",
              es: "Las suscripciones de pago, cuando estén disponibles, se facturan mediante Creem. Los precios, cuotas, límites del plan, términos de renovación, impuestos y opciones de cancelación se muestran en el producto o en el flujo de pago antes de comprar.",
            }
          )}
        </p>
        <p>
          {T(
            "Pullwise supports subscription upgrades from the billing page, including switching to a higher tier or from monthly to yearly billing. Supported upgrades take effect immediately; Creem may charge the prorated difference for the rest of the current period, and the new recurring amount is billed on the next renewal date. Pullwise does not support lower-tier changes or yearly-to-monthly changes from the product.",
            {
              zh: "Pullwise 支持从计费页面进行订阅升级，包括切换到更高套餐，或从月付切换为年付。支持的升级会立即生效；Creem 可能会按当前周期剩余时间立即收取差额，并在下个续费日按新的周期金额扣款。Pullwise 不支持在产品内切换到更低套餐，也不支持年付切换为月付。",
              ja: "Pullwise は、請求ページからのサブスクリプションアップグレードに対応しています。これには上位プランへの変更、または月額請求から年額請求への変更が含まれます。対応しているアップグレードは直ちに有効になり、Creem は現在の期間の残りに対する按分差額を即時請求する場合があります。次回更新日以降は新しい継続金額で請求されます。Pullwise は、製品内での下位プランへの変更または年額から月額への変更には対応していません。",
              ko: "Pullwise는 결제 페이지에서 구독 업그레이드를 지원합니다. 여기에는 상위 등급으로 변경하거나 월간 결제에서 연간 결제로 변경하는 것이 포함됩니다. 지원되는 업그레이드는 즉시 적용되며, Creem은 현재 기간의 남은 기간에 대한 비례 차액을 즉시 청구할 수 있습니다. 다음 갱신일부터는 새로운 정기 금액이 청구됩니다. Pullwise는 제품 내에서 하위 등급으로 변경하거나 연간 결제에서 월간 결제로 변경하는 것을 지원하지 않습니다.",
              fr: "Pullwise prend en charge les upgrades d'abonnement depuis la page de facturation, y compris le passage à un forfait supérieur ou d'une facturation mensuelle à annuelle. Les upgrades pris en charge prennent effet immédiatement ; Creem peut facturer immédiatement la différence au prorata pour le reste de la période en cours, puis le nouveau montant récurrent est facturé à la prochaine date de renouvellement. Pullwise ne prend pas en charge, depuis le produit, les passages à un forfait inférieur ni les passages de l'annuel au mensuel.",
              es: "Pullwise admite upgrades de suscripción desde la página de facturación, incluido cambiar a un plan superior o pasar de facturación mensual a anual. Los upgrades admitidos entran en vigor de inmediato; Creem puede cobrar de inmediato la diferencia prorrateada por el resto del periodo actual, y el nuevo importe recurrente se cobra en la siguiente fecha de renovación. Pullwise no admite desde el producto cambios a un plan inferior ni cambios de anual a mensual.",
            }
          )}
        </p>
        <p>
          {T(
            "You can cancel renewal for an active subscription from Pullwise Billing. Cancellation is scheduled for the end of the current paid period, so access continues until that period ends. You can resume renewal from Pullwise Billing before the scheduled cancellation takes effect. Unless required by law or explicitly stated in the product, fees already incurred are non-refundable.",
            {
              zh: "你可以从 Pullwise 账单页取消有效订阅的续订。取消续订会安排在当前已付周期结束时生效，因此访问权限会持续到该周期结束。你可以在计划取消生效前从 Pullwise 账单页恢复续订。除非法律要求或产品中明确说明，已经产生的费用不予退款。",
              ja: "有効なサブスクリプションの更新キャンセルは Pullwise の請求ページから行えます。キャンセルは現在の支払い済み期間の終了時に予定されるため、その期間が終わるまでアクセスは継続します。法律で求められる場合、または製品内で明示される場合を除き、すでに発生した料金は返金されません。",
              ko: "활성 구독의 갱신 취소는 Pullwise 결제 페이지에서 할 수 있습니다. 갱신 취소는 현재 결제된 기간이 끝날 때 적용되도록 예약되므로, 해당 기간이 끝날 때까지 접근 권한은 유지됩니다. 법률상 요구되거나 제품에 명시된 경우를 제외하고 이미 발생한 요금은 환불되지 않습니다.",
              fr: "Vous pouvez annuler le renouvellement d'un abonnement actif depuis la page de facturation Pullwise. L'annulation est planifiée pour la fin de la période payée en cours ; l'accès continue donc jusqu'à la fin de cette période. Sauf obligation légale ou mention explicite dans le produit, les frais déjà engagés ne sont pas remboursables.",
              es: "Puedes cancelar la renovación de una suscripción activa desde la página de facturación de Pullwise. La cancelación se programa para el final del periodo pagado actual, por lo que el acceso continúa hasta que termine ese periodo. Salvo que lo exija la ley o se indique explícitamente en el producto, las tarifas ya incurridas no son reembolsables.",
            }
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
            "You retain ownership of your repository code and other customer content. You grant Pullwise the limited rights needed to host, clone, preflight, process, analyze, display, transmit, and generate review artifacts from that content only to provide, secure, support, and improve the service.",
            "你保留对仓库代码和其他客户内容的所有权。你授予 Pullwise 为提供、保护、支持和改进服务所必需的有限权利，以托管、克隆、预检、处理、分析、展示、传输这些内容，并基于这些内容生成审查产物。"
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
            "To the maximum extent permitted by law, Pullwise is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost revenue, lost data, security incidents caused by your credential handling, or decisions you make based on review findings.",
            "在法律允许的最大范围内，Pullwise 不对间接、附带、特殊、后果性、示范性或惩罚性损害、利润损失、收入损失、数据损失、因你的凭据处理导致的安全事件，或你基于审查发现作出的决定承担责任。"
          )}
        </p>
      </Section>
      <Section id="termination" title={sections[8].title}>
        <p>
          {T(
            "You may stop using Pullwise at any time. Pullwise may suspend or terminate access if you violate these Terms, create security or operational risk, fail to pay applicable fees, or use the service unlawfully.",
            "你可以随时停止使用 Pullwise。如果你违反本条款、造成安全或运营风险、未支付适用费用，或非法使用服务，Pullwise 可以暂停或终止访问。"
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
        "Pullwise 需要仓库内容和 pull request 权限来扫描代码、推送修复分支并创建 pull request。"
      ),
    },
    {
      icon: <I.Lock size={18} />,
      title: T("Secret isolation", "密钥隔离"),
      text: T(
        "OAuth secrets, GitHub App private keys, payment API keys, and review runner credentials stay on the backend.",
        "OAuth secret、GitHub App 私钥、支付 API key 和 review runner 凭据只保存在后端。"
      ),
    },
    {
      icon: <I.Terminal size={18} />,
      title: T("Repository review runner", "仓库审查运行器"),
      text: T(
        "Repository review runs against a backend checkout with sandboxed execution and emits structured findings.",
        "仓库审查基于后端 checkout 在沙箱化执行环境中运行，并输出结构化发现。"
      ),
    },
    {
      icon: <I.Database size={18} />,
      title: T("Server-backed state", "服务端状态"),
      text: T(
        "Sessions, repository authorization, scans, findings, API key metadata, and billing status are persisted by the backend, not browser fixtures.",
        "会话、仓库授权、扫描、发现、API key 元数据和计费状态由后端持久化，而不是浏览器假数据。"
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
            "本页只描述已经实现的控制措施。除非未来在这里明确发布，Pullwise 不声明第三方合规认证。"
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

function reviewProviderDetail(value) {
  return value && value !== "disabled" ? T("Configured", "已配置") : T("Disabled", "未启用");
}

function statusCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number)).toLocaleString();
}

function statusBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded.toLocaleString()} ${units[unitIndex]}`;
}

function repositoryLimitDetail(limits) {
  const repository = limits?.repository;
  if (!repository) return "";
  return T(
    `Repo checkout ${statusCount(repository.maxFiles)} files / ${statusBytes(repository.maxBytes)}`,
    `仓库 checkout ${statusCount(repository.maxFiles)} 个文件 / ${statusBytes(repository.maxBytes)}`
  );
}

function readinessAvailable(health) {
  return Boolean(health?.reviewProvider || health?.github || health?.billing || health?.limits);
}

export function StatusScreen({ go, auth }) {
  useLang();
  const [now, setNow] = useState(() => new Date());
  const [health, setHealth] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    let requestId = 0;
    let activeController = null;

    function abortActiveRequest() {
      requestId += 1;
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
    }

    async function loadHealth() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        abortActiveRequest();
        return;
      }
      abortActiveRequest();
      const currentRequestId = requestId;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      activeController = controller;
      const requestOptions = controller ? { signal: controller.signal } : {};
      const isCurrentRequest = () =>
        !cancelled &&
        requestId === currentRequestId &&
        (!controller || !controller.signal.aborted);
      setNow(new Date());
      try {
        const payload = await pullwiseApi.system.health(requestOptions);
        const statusPayload =
          payload?.scanSystem
            ? payload.scanSystem
            : typeof pullwiseApi.system.status === "function"
            ? await pullwiseApi.system.status(requestOptions).catch(() => payload?.scanSystem || null)
            : payload?.scanSystem || null;
        if (isCurrentRequest()) {
          setHealth(payload);
          setSystemStatus(statusPayload || payload?.scanSystem || null);
          setError("");
        }
      } catch (healthError) {
        if (isCurrentRequest()) {
          setHealth(null);
          setSystemStatus(null);
          setError(healthError?.message || "Unable to reach the Pullwise API.");
        }
      } finally {
        if (activeController === controller) {
          activeController = null;
        }
      }
    }

    loadHealth();
    intervalId = setInterval(loadHealth, STATUS_REFRESH_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        abortActiveRequest();
      } else {
        void loadHealth();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }
    return () => {
      cancelled = true;
      abortActiveRequest();
      clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, []);

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
        configuredLabel(github.oauthConfigured, T("OAuth configured", "OAuth 已配置"), T("OAuth missing", "OAuth 缺失")),
        configuredLabel(github.appInstallConfigured, T("App install configured", "App 安装已配置"), T("App install missing", "App 安装缺失")),
        configuredLabel(github.appApiConfigured, T("App API configured", "App API 已配置"), T("App API missing", "App API 缺失")),
        github.appVisibilityCheck ? T("Visibility check on", "可见性检查开启") : T("Visibility check off", "可见性检查关闭"),
      ].join(" / ")
    : "";
  const billingDetail = billing
    ? `${billing.provider || "unknown"} (${billing.enabled ? T("enabled", "已启用") : T("not enabled", "未启用")})`
    : "";
  const limitsDetail = limits
    ? [
        T(
          `${limits.maxQueuedScansGlobal ?? "-"} global queued`,
          `全局排队上限 ${limits.maxQueuedScansGlobal ?? "-"}`
        ),
        repositoryLimitDetail(limits),
        `${T("Rate limiting", "限流")} ${limits.rateLimitEnabled ? T("enabled", "已启用") : T("disabled", "未启用")}`,
      ].filter(Boolean).join(" - ")
    : "";
  const databaseDetail = health?.database?.type
    ? `${health.database.type}: ${T("configured backend", "已配置后端")}`
    : T("Waiting for backend health.", "等待后端健康检查。");

  const scanSystem = systemStatus || health?.scanSystem || null;
  const scanStatus = scanSystem?.scanSystemStatus || "down";
  const scanSystemDetail = scanSystem
    ? T(
        `${scanSystem.queuedJobs ?? 0} queued / ${scanSystem.runningJobs ?? 0} running / ${scanSystem.busyWorkerCount ?? 0} busy / ${scanSystem.idleWorkerCount ?? 0} idle workers`,
        `${scanSystem.queuedJobs ?? 0} queued / ${scanSystem.runningJobs ?? 0} running / ${scanSystem.busyWorkerCount ?? 0} busy / ${scanSystem.idleWorkerCount ?? 0} idle workers`
      )
    : T("Waiting for scan system status.", "等待扫描系统状态。");
  const reviewProviderConfigured = Boolean(
    health?.reviewProvider && health.reviewProvider !== "disabled"
  );

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
              {T("No generated uptime or incident history", "不生成 uptime 或事故历史")}
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
            title={T("Scan system", "扫描系统")}
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
              <h2>{T("Backend readiness", "后端就绪状态")}</h2>
              <span className="muted">
                {T(
                  "Configuration visible from safe /health fields",
                  "来自安全 /health 字段的可见配置"
                )}
              </span>
            </div>
            <StatusRow
              icon={<I.Terminal size={14} />}
              title={T("Review provider", "审查提供方")}
              status={reviewProviderConfigured ? "operational" : "degraded"}
              detail={reviewProviderDetail(health?.reviewProvider)}
            />
            {github && (
              <StatusRow
                icon={<I.Github size={14} />}
                title={T("GitHub integration", "GitHub 集成")}
                status={githubReady ? "operational" : "degraded"}
                detail={githubDetail}
              />
            )}
            {billing && (
              <StatusRow
                icon={<I.Package size={14} />}
                title={T("Billing provider", "支付提供方")}
                status={billing.enabled ? "operational" : "degraded"}
                detail={billingDetail}
              />
            )}
            {limits && (
              <StatusRow
                icon={<I.Activity size={14} />}
                title={T("Runtime limits", "运行时限制")}
                status={limits.maxQueuedScansGlobal ? "operational" : "degraded"}
                detail={limitsDetail}
              />
            )}
          </div>
        )}
      </section>
    </LegalChrome>
  );
}
