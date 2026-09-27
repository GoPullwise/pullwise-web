import { useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { useErrorNotification } from "../components/notifications.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const CONTACT_EMAIL = "contact@pull-wise.com";
const SECURITY_EMAIL = CONTACT_EMAIL;
const LAST_UPDATED = "2026-09-27";
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
    { id: "code", title: T("GitHub content", "GitHub 内容") },
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
        "This Privacy Policy explains how Pullwise handles account, GitHub, billing, API key, usage, and product data for its pull request follow-up, CI failure, and upstream release service.",
        "本隐私政策说明 Pullwise 如何在拉取请求跟进、CI 失败定位和上游版本跟踪服务中处理账户、GitHub、计费、API key、用量及产品数据。"
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
            "We collect the information needed to provide Pullwise, including account identity, GitHub profile and installation metadata, authorized repository and watch metadata, subscription and billing identifiers, API key metadata, processing usage, pull request and CI facts, upstream release facts, saved assessments and handling history, and operational logs.",
            "我们收集提供 Pullwise 所需的信息，包括账户身份、GitHub 资料和安装元数据、已授权仓库及关注配置元数据、订阅和计费标识、API key 元数据、处理用量、拉取请求及 CI 事实、上游版本事实、已保存的评估与处理历史，以及运行日志。"
          )}
        </p>
        <LegalList
          items={[
            T(
              "Account data: email, session state, GitHub login, and linked GitHub identities.",
              "账户数据：邮箱、会话状态、GitHub 登录名和已关联的 GitHub 身份。"
            ),
            T(
              "Repository and watch data: repository identity, visibility, GitHub App installation and permissions, selected services, and upstream release watches.",
              "仓库及关注数据：仓库身份、可见性、GitHub App 安装和权限、所选服务及上游版本关注配置。"
            ),
            T(
              "API data: API key name, key prefix, hashed key value, scopes, creation time, last used time, and revocation state. The full API key token is shown only once.",
              "API 数据：API key 名称、前缀、哈希后的 key 值、权限范围、创建时间、最近使用时间和吊销状态。完整 API key token 只显示一次。"
            ),
            T(
              "Product data: pull request activity and review threads, CI runs and failure details, upstream releases, source evidence, saved assessments, item history, and your handling decisions.",
              "产品数据：拉取请求活动和审查讨论、CI 运行及失败详情、上游版本、来源证据、已保存的评估、事项历史和你的处理决定。"
            ),
          ]}
        />
      </Section>
      <Section id="code" title={sections[2].title}>
        <p>
          {T(
            "Pullwise reads authorized GitHub facts needed for selected services, such as pull request metadata, review discussions, CI failure details, and release notes. Access to saved content follows account and repository authorization. Pullwise does not use this content to train models.",
            "Pullwise 读取所选服务所需的已授权 GitHub 事实，例如拉取请求元数据、审查讨论、CI 失败详情和版本说明。已保存内容的访问受账户和仓库授权约束。Pullwise 不会使用这些内容训练模型。"
          )}
        </p>
        <p>
          {T(
            "When model processing is enabled for a selected service, relevant source evidence may be sent to the configured model provider to produce an assessment. Provider credentials remain on the backend.",
            "当所选服务启用模型处理时，相关来源证据可能发送给配置的模型提供方以生成评估。提供方凭据保存在后端。"
          )}
        </p>
      </Section>
      <Section id="use" title={sections[3].title}>
        <p>
          {T(
            "We use data to authenticate users, manage GitHub access and selected services, synchronize source facts, display evidence and saved assessments, track handling decisions, manage API keys and processing usage, process subscriptions, prevent abuse, maintain reliability, investigate errors, and respond to support requests.",
            "我们使用数据来认证用户、管理 GitHub 访问及所选服务、同步来源事实、展示证据和已保存的评估、记录处理决定、管理 API key 和处理用量、处理订阅、防止滥用、维护可靠性、排查错误并响应支持请求。"
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
            "Pullwise uses service providers as needed to operate the product. These may include hosting and database infrastructure, GitHub for OAuth and authorized source facts, Creem payments when enabled, support systems, and a configured model provider when model processing is enabled.",
            "Pullwise 在运营产品所需范围内使用服务提供方，包括托管和数据库基础设施、用于 OAuth 和已授权来源事实的 GitHub、启用时的 Creem 支付、支持系统，以及启用模型处理时配置的模型提供方。"
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
            "Account, GitHub authorization, API key and billing metadata, subscription records, processing usage, and operational logs are kept while needed for service operation, security, tax, audit, or legal reasons. Source facts, saved assessments, and handling history may be retained so you can review past activity.",
            "账户、GitHub 授权、API key 和计费元数据、订阅记录、处理用量及运行日志会在服务运营、安全、税务、审计或法律需要期间保留。来源事实、已保存的评估和处理历史可能会被保留，以便你查看过去的活动。"
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
            "Pullwise uses backend-held secrets, scoped API keys, GitHub authorization checks, request-size limits, rate limits, CORS controls, and server-side persistence. You remain responsible for protecting your GitHub account, Pullwise sessions, and API keys.",
            "Pullwise 使用后端保存的密钥、带权限范围的 API key、GitHub 授权检查、请求大小限制、限流、CORS 控制和服务端持久化。你仍需负责保护自己的 GitHub 账户、Pullwise 会话和 API key。"
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
        "These Terms govern your use of Pullwise, including pull-wise.com, https://api.pull-wise.com, GitHub-connected PR, CI, and Updates services, API keys, and billing features.",
        "本条款适用于你对 Pullwise 的使用，包括 pull-wise.com、https://api.pull-wise.com、连接 GitHub 的 PR、CI 和 Updates 服务、API key 及计费功能。"
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
            "Pullwise provides pull request follow-up, CI failure, and upstream release tracking for selected GitHub sources. The service displays source evidence, saved assessments, and handling history, and provides account-scoped REST API and API key controls where available.",
            "Pullwise 为选定的 GitHub 来源提供拉取请求跟进、CI 失败定位和上游版本跟踪。服务展示来源证据、已保存的评估和处理历史，并在可用时提供账户范围的 REST API 及 API key 管理。"
          )}
        </p>
        <p>
          {T(
            "Assessments and suggested follow-up actions are recommendations. You are responsible for reviewing the source evidence and deciding whether to act on them.",
            "评估和建议的后续操作仅供参考。你需要审查来源证据，并自行决定是否采取行动。"
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
            "Pullwise API keys are account-scoped credentials. They are limited by configured product scopes and the creator's authorized resources. API access to source facts, items, watches, and handling actions is subject to the same authorization checks as account access.",
            "Pullwise API key 是账户范围的凭据，受配置的产品权限范围及创建者已授权资源限制。通过 API 访问来源事实、事项、关注配置和处理操作时，适用与账户访问相同的授权检查。"
          )}
        </p>
        <p>
          {T(
            "You may not bypass rate limits, processing usage controls, authentication, authorization checks, or source access restrictions. Pullwise may suspend or revoke API access that risks service stability or security.",
            "你不得绕过限流、处理用量控制、认证、授权检查或来源访问限制。对于影响服务稳定性或安全性的 API 访问，Pullwise 可以暂停或吊销。"
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
            "You must not connect GitHub sources you are not authorized to access, process illegal or harmful content, exfiltrate secrets, attack GitHub, payment providers, model providers, or Pullwise infrastructure, overload the service, reverse engineer non-public systems, or violate another party's rights.",
            "你不得连接无权访问的 GitHub 来源、处理违法或有害内容、窃取密钥、攻击 GitHub、支付提供方、模型提供方或 Pullwise 基础设施、过载服务、逆向非公开系统，或侵犯他人权利。"
          )}
        </p>
      </Section>
      <Section id="content" title={sections[6].title}>
        <p>
          {T(
            "You retain ownership of your repository data and other customer content. You grant Pullwise the limited rights needed to access, store, process, analyze, display, and transmit selected source facts only to provide, secure, support, and improve the service.",
            "你保留仓库数据及其他客户内容的所有权。你授予 Pullwise 为提供、保护、支持和改进服务所必需的有限权利，以访问、保存、处理、分析、展示和传输选定的来源事实。"
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
            "To the maximum extent permitted by law, Pullwise is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost revenue, lost data, security incidents caused by your credential handling, or decisions you make based on assessments.",
            "在法律允许的最大范围内，Pullwise 不对间接、附带、特殊、后果性、示范性或惩罚性损害、利润损失、收入损失、数据损失、因你的凭据处理导致的安全事件，或你基于评估作出的决定承担责任。"
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
  return Boolean(health?.github || health?.billing);
}

export function StatusScreen({ go, auth }) {
  useLang();
  const [now, setNow] = useState(() => new Date());
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  useErrorNotification(error, {
    title: T("Status error", "Status error"),
    key: `status:${error}`,
  });

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
        if (isCurrentRequest()) {
          setHealth(payload);
          setError("");
        }
      } catch (healthError) {
        if (isCurrentRequest()) {
          setHealth(null);
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
  const databaseDetail = health?.database?.type
    ? `${health.database.type}: ${T("configured backend", "已配置后端")}`
    : T("Waiting for backend health.", "等待后端健康检查。");

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
          </div>
        )}
      </section>
    </LegalChrome>
  );
}
