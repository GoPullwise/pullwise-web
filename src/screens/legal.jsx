import { useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { useErrorNotification } from "../components/notifications.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const CONTACT_EMAIL = "contact@pull-wise.com";
const SECURITY_EMAIL = CONTACT_EMAIL;
const LAST_UPDATED = "2026-10-08";

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
    { id: "use", title: T("How we use data", "数据用途") },
    { id: "sharing", title: T("Processors and sharing", "处理方与共享") },
    { id: "storage", title: T("Cookies and browser storage", "Cookie 与浏览器存储") },
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
        "This policy describes how Pullwise handles account, GitHub, expense ledger, API key and platform billing data.",
        "本政策说明 Pullwise 如何处理账户、GitHub、支出账本、API 密钥及平台账单数据。"
      )}
    >
      <Section id="scope" title={sections[0].title}>
        <p>
          {T(
            "Pullwise provides project and shared expense tracking for developers and teams through the web app and REST API. GitHub sign-in identifies your account; linking repositories to projects is optional. This policy also covers shared ledgers, subscriptions and support interactions.",
            "Pullwise 通过 Web 应用和 REST API 为开发者与团队提供项目及公共支出记账。GitHub 登录用于识别账户，项目关联仓库是可选的。本政策也适用于共享账本、订阅和支持沟通。"
          )}
        </p>
      </Section>
      <Section id="data" title={sections[1].title}>
        <LegalList
          items={[
            T(
              "Account and GitHub data: GitHub user ID, username, display name, avatar, sessions, encrypted GitHub access tokens, and authorized repository, Organization and installation metadata when you use repository integration.",
              "账户与 GitHub 数据：GitHub 用户 ID、用户名、显示名称、头像、会话、加密保存的 GitHub 访问令牌，以及使用仓库关联时的已授权仓库、Organization 和安装元数据。"
            ),
            T(
              "Ledger data: project names and descriptions, repository associations, categories, expense dates, amounts, currencies, purpose, notes, quantity, unit and audit history, including model-assistance outcomes when used.",
              "账本数据：项目名称与描述、仓库关联、类别、支出日期、金额、币种、用途、备注、数量、单位和审计历史，以及使用模型辅助时的处理结果。"
            ),
            T(
              "API key data: name, prefix, hashed token, scopes, target restrictions and usage metadata. The full token is displayed once.",
              "API 密钥数据：名称、前缀、令牌哈希、权限、目标限制和使用元数据。完整令牌仅显示一次。"
            ),
            T(
              "Team ledger data: workspace membership, roles, stable GitHub invitation recipient IDs, hashed invitation tokens and the actual actor's audit history.",
              "团队账本数据：成员关系、角色、邀请对象的稳定 GitHub ID、邀请令牌哈希及实际操作成员的审计历史。"
            ),
            T(
              "Platform billing data: customer, subscription, checkout and payment event identifiers, payment amounts, currencies, status, billing periods and customer email where provided by the payment processor. Checkout payment details are handled by Creem.",
              "平台账单数据：客户、订阅、结账和支付事件标识、支付金额、币种、状态、计费周期，以及支付处理方提供的客户邮箱。结账时的支付信息由 Creem 处理。"
            ),
            T(
              "Service and support data: messages you send us, operational logs, and technical request data processed by our infrastructure, including IP addresses. Abuse protection uses hashed request identifiers and rate counters.",
              "服务与支持数据：你发送给我们的消息、运营日志及基础设施处理的技术请求数据，包括 IP 地址。滥用防护使用请求标识哈希和限流计数。"
            ),
          ]}
        />
      </Section>
      <Section id="use" title={sections[2].title}>
        <p>
          {T(
            "We use this data to authenticate users, check ledger roles and GitHub authorization, store and report expenses, manage invitations, API keys and subscriptions, prevent abuse and answer support requests. Platform charges are kept separate from user-entered expenses.",
            "我们用这些数据认证用户、检查账本角色与 GitHub 授权、保存和汇总支出、管理邀请、API 密钥与订阅、防止滥用并处理支持请求。平台收费与用户录入的支出分开保存。"
          )}
        </p>
        <p>
          {T(
            "Max automatically uses Jev during expense saves when enabled, available and within the plan allowance, for categorization and advice on project or shared expenses. Expense data sent to the model consists of the submitted purpose and note plus allowed category IDs and names. Pullwise checks possible duplicates in its own service using a bounded authorized expense lookup; historical expense text is not sent to the model. Repository code and stored GitHub and API key tokens are excluded from model input. Do not enter secrets in purpose, notes or category names, as those fields may be sent to the model. Explicit amounts, currencies, targets and categories are preserved; uncertain categorization requires you to choose a category.",
            "Max 在模型已启用、可用且套餐额度内，会在保存支出时自动使用 Jev 分类，并提供项目或公共支出归属建议。发送给模型的支出数据包括本次提交的用途、备注，以及可用类别的 ID 和名称。Pullwise 在自身服务内通过有限的已授权支出查询检查疑似重复记录，不向模型发送历史支出文字。仓库代码、已保存的 GitHub 令牌及 API 密钥令牌不纳入模型输入。请勿在用途、备注或类别名称中填写秘密信息，这些字段可能发送给模型。明确填写的金额、币种、目标和类别会保留；无法可靠分类时需要你选择类别。"
          )}
        </p>
      </Section>
      <Section id="sharing" title={sections[3].title}>
        <p>
          {T(
            "Cloudflare hosts the web app, API and data storage. GitHub provides sign-in and optional repository authorization. Creem processes platform payments, and TypeSafe processes Jev expense assistance for Max when enabled and available. These providers process the data needed for their functions under their own applicable terms and privacy policies. We do not sell your personal data or repository code.",
            "Cloudflare 托管 Web 应用、API 和数据存储。GitHub 提供登录及可选的仓库授权。Creem 处理平台支付，TypeSafe 在已启用且可用时提供 Max 的 Jev 支出辅助。这些提供方会根据各自适用的条款与隐私政策处理其功能所需数据。我们不出售个人数据或仓库代码。"
          )}
        </p>
        <p>
          {T(
            "The interface loads fonts from Google Fonts. Your browser sends font requests directly to Google, which receives technical request data such as your IP address.",
            "界面从 Google Fonts 加载字体。浏览器会直接向 Google 发送字体请求，Google 会接收 IP 地址等技术请求数据。"
          )}
        </p>
        <p>
          {T(
            "When a member accepts an invitation, their role gives them access to all existing and future projects, categories, expenses, reports and CSV exports in that ledger. An invitation is not limited to one project. Membership does not share GitHub credentials or grant access to repository code, personal billing or other ledgers. Remove members or change roles in Members to restrict subsequent access; this cannot recall copies they already exported.",
            "成员接受邀请后，其角色会授予该账本全部现有及未来的项目、分类、支出、报表和 CSV 导出的访问权，邀请并非仅限于某个项目。成员资格不会共享 GitHub 凭据，也不会授予仓库代码、个人账单或其他账本的访问权。可在成员页面移除成员或更改角色，限制后续访问，但无法收回成员此前已经导出的副本。"
          )}
        </p>
      </Section>
      <Section id="storage" title={sections[4].title}>
        <p>
          {T(
            "Pullwise uses a secure, HttpOnly session cookie for sign-in. Browser local storage remembers your language and theme, and session storage records a pending GitHub access refresh. Signing out clears the session cookie; you can clear browser storage in your browser settings. Blocking the session cookie prevents signed-in use. GitHub and Creem may use their own cookies when you visit their services.",
            "Pullwise 使用安全的 HttpOnly 会话 Cookie 维持登录。浏览器本地存储记住语言和主题，会话存储记录待完成的 GitHub 权限刷新。退出登录会清除会话 Cookie；你可以在浏览器设置中清除浏览器存储。阻止会话 Cookie 会影响登录后的使用。访问 GitHub 和 Creem 时，它们可能使用自己的 Cookie。"
          )}
        </p>
      </Section>
      <Section id="retention" title={sections[5].title}>
        <p>
          {T(
            "Signing out, revoking GitHub access or removing a member does not erase ledger history. Removed expenses are hidden from active lists, reports and exports, while stored records and audit history remain. Archiving a project also preserves its history. Account, API key, payment, model-assistance and operational records are retained for service, security, tax, audit or legal needs. Contact us about account closure or deletion; product removal controls do not promise immediate permanent erasure.",
            "退出登录、撤销 GitHub 授权或移除成员不会抹去账本历史。移除的支出不再显示于当前列表、报表和导出中，但存储记录与审计历史仍保留。归档项目也会保留其历史。账户、API 密钥、支付、模型辅助和运营记录会因服务、安全、税务、审计或法律需要保留。账户关闭或删除请联系我们；产品中的移除操作不承诺立即永久擦除数据。"
          )}
        </p>
      </Section>
      <Section id="rights" title={sections[6].title}>
        <p>
          {T(
            `Contact ${CONTACT_EMAIL} to request access, export, correction or deletion of account data. We may verify your identity and consider applicable law and other ledger members' rights before acting. You can export authorized expenses as CSV, manage members and GitHub access according to your permissions, and revoke your API keys in the product.`,
            `请联系 ${CONTACT_EMAIL} 请求访问、导出、更正或删除账户数据。处理前我们可能核实身份，并考虑适用法律及其他账本成员的权利。你可以导出有权访问的支出 CSV、按权限管理成员与 GitHub 授权，并在产品中撤销自己的 API 密钥。`
          )}
        </p>
      </Section>
      <Section id="security" title={sections[7].title}>
        <p>
          {T(
            "Pullwise uses scoped, hashed API keys, ledger role and ownership checks, GitHub authorization checks, encrypted GitHub token storage and backend-held secrets. These controls reduce risk but cannot guarantee absolute security. Protect your sessions, API keys and invitation links.",
            "Pullwise 使用有范围且以哈希保存的 API 密钥、账本角色与所有权检查、GitHub 授权检查、加密保存的 GitHub 令牌以及后端密钥。这些措施可以降低风险，但无法保证绝对安全。请保护会话、API 密钥和邀请链接。"
          )}
        </p>
      </Section>
      <Section id="contact" title={sections[8].title}>
        <p>
          {T(
            `Contact ${SECURITY_EMAIL} with privacy or security questions.`,
            `隐私或安全问题请联系 ${SECURITY_EMAIL}。`
          )}
        </p>
      </Section>
    </LegalDocLayout>
  );
}

export function TermsScreen({ go, auth }) {
  useLang();
  const sections = [
    { id: "service", title: T("Service", "服务") },
    { id: "account", title: T("Account and GitHub access", "账户与 GitHub 访问") },
    { id: "api", title: T("API use", "API 使用") },
    { id: "billing", title: T("Billing", "计费") },
    { id: "content", title: T("Your content", "你的内容") },
    { id: "use", title: T("Responsible use and availability", "合理使用与服务可用性") },
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
        "These terms cover the Pullwise project expense ledger, API keys and platform subscription.",
        "本条款适用于 Pullwise 项目支出账本、API 密钥和平台订阅。"
      )}
    >
      <Section id="service" title={sections[0].title}>
        <p>
          {T(
            "Pullwise lets developers and teams record, report and export project expenses and shared costs across projects. Projects can be created without linking a GitHub repository. Max includes automatic expense assistance when enabled, available and within the plan allowance. Reports keep currencies separate and do not perform exchange-rate conversion. Review saved entries and model suggestions; Pullwise does not provide accounting, tax or investment advice.",
            "Pullwise 帮助开发者与团队记录、汇总和导出项目支出及跨项目公共费用。创建项目无需关联 GitHub 仓库。Max 在模型已启用、可用且套餐额度内提供自动支出辅助。报表按币种分别汇总，不进行汇率换算。请核对保存的记录与模型建议；Pullwise 不提供会计、税务或投资建议。"
          )}
        </p>
      </Section>
      <Section id="account" title={sections[1].title}>
        <p>
          {T(
            "You sign in with GitHub and are responsible for protecting your account and credentials. Only connect repositories you are authorized to access; repository integration is optional. Changed GitHub repository access does not erase financial history, but can restrict new expenses in linked projects. Shared-ledger access depends on your current membership and role.",
            "你通过 GitHub 登录，并负责保护账户与凭据。只能关联你有权访问的仓库；仓库关联是可选的。GitHub 仓库权限变化不会抹去财务历史，但可能限制关联项目的新支出。共享账本的访问取决于当前成员资格与角色。"
          )}
        </p>
      </Section>
      <Section id="api" title={sections[2].title}>
        <p>
          {T(
            "API keys are credentials bound to a ledger and limited by selected scopes, your current role, and project or shared-expense restrictions. Keep tokens private, revoke unused keys and do not bypass rate, plan or authorization limits. Changing a shared-ledger member's role, removing them or rejoining invalidates their existing keys for that ledger.",
            "API 密钥绑定账本，受所选权限、当前角色以及项目或公共支出范围限制。请保密令牌，撤销不再使用的密钥，不要绕过限流、套餐或授权限制。共享账本成员角色变化、被移除或重新加入，会使其在该账本的已有密钥失效。"
          )}
        </p>
      </Section>
      <Section id="billing" title={sections[3].title}>
        <p>
          {T(
            "Pullwise platform subscriptions are billed through Creem. Subscription charges and payment history are separate from expenses you record in your ledger. Review the displayed price, tax and renewal terms before purchase.",
            "Pullwise 平台订阅通过 Creem 收费。订阅费用和支付历史与账本中你录入的支出分开。购买前请核对显示的价格、税费和续订条款。"
          )}
        </p>
        <p>
          {T(
            "You can cancel renewal for an active subscription from Pullwise Billing. It ends at the current paid period. You can resume renewal from Pullwise Billing before that date. Upgrades update your plan after payment confirmation; Creem calculates any proration. Lower-tier changes or yearly-to-monthly changes are unavailable in the product.",
            "你可以在 Pullwise 账单页取消有效订阅的续订，取消会在当前已付周期结束时生效。在此之前可从账单页恢复续订。升级在支付确认后更新套餐，差额由 Creem 计算。产品内不支持降级或年付改月付。"
          )}
        </p>
        <p>
          {T(
            "Paid subscription fees are non-refundable except where required by applicable law. Cancelling renewal does not refund the current paid period; paid access continues until that period ends.",
            "除适用法律另有强制规定外，已支付的订阅费用不予退还。取消续订不会退还当前周期费用，付费权益保留至该周期结束。"
          )}
        </p>
      </Section>
      <Section id="content" title={sections[4].title}>
        <p>
          {T(
            "You retain ownership of your ledger entries and other customer content, and allow Pullwise to store and process them to provide and secure the service as described in the Privacy Policy. Only enter data you are entitled to use and share. When an invitation is accepted, all existing and future projects, categories, expenses, reports and CSV exports in that ledger become accessible according to the member's role. Removing access cannot recall exported copies. Automatic Max assistance runs as part of your expense write; it does not create expenses during reads or change explicit choices.",
            "你保留账目和其他客户内容的所有权，并允许 Pullwise 按隐私政策说明存储和处理这些内容，以提供和保护服务。仅录入你有权使用与共享的数据。邀请被接受后，该账本全部现有及未来的项目、分类、支出、报表和 CSV 导出会按成员角色开放访问。撤销访问无法收回已经导出的副本。Max 自动辅助随支出写入运行，不会在读取时新增支出或改动明确选择。"
          )}
        </p>
      </Section>
      <Section id="use" title={sections[5].title}>
        <p>
          {T(
            "Do not use Pullwise for unlawful activity, attempt to access another ledger without authorization, compromise credentials or interfere with the service. Access may be restricted to address abuse or security incidents. Service availability and third-party integrations can be interrupted; model assistance is not guaranteed on every save. Keep exports of records you need, and contact us about account closure. Data retention and deletion are described in the Privacy Policy.",
            "请勿使用 Pullwise 从事违法活动、未经授权访问其他账本、侵害凭据安全或干扰服务。为处理滥用或安全事件，服务访问可能受到限制。服务与第三方集成可能中断，无法保证每次保存都有模型辅助。请保留所需记录的导出副本，账户关闭请联系我们。数据保留与删除见隐私政策。"
          )}
        </p>
      </Section>
      <Section id="contact" title={sections[6].title}>
        <p>
          {T(`For questions, contact ${CONTACT_EMAIL}.`, `如有问题，请联系 ${CONTACT_EMAIL}。`)}
        </p>
      </Section>
    </LegalDocLayout>
  );
}

function statusClass(ok, error) {
  if (ok) return "operational";
  return error ? "incident" : "degraded";
}

function StatusRow({ icon, title, status, label, detail }) {
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
        <span>{label}</span>
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
  const [loading, setLoading] = useState(true);
  const [requestRevision, setRequestRevision] = useState(0);
  const requestPending = useRef(false);
  useErrorNotification(error, {
    title: T("Status error", "Status error"),
    key: `status:${error}`,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    requestPending.current = true;
    setLoading(true);

    async function loadHealth() {
      // StrictMode cancels its first setup before dispatch. Further checks
      // require explicit user intent; visibility changes never read the API.
      await Promise.resolve();
      if (cancelled || controller.signal.aborted) return;
      const isCurrentRequest = () => !cancelled && !controller.signal.aborted;
      try {
        const payload = await pullwiseApi.system.health({ signal: controller.signal });
        if (isCurrentRequest()) {
          setHealth(payload);
          setError("");
          setNow(new Date());
        }
      } catch (healthError) {
        if (isCurrentRequest()) {
          setHealth(null);
          setError(healthError?.message || "Unable to reach the Pullwise API.");
          setNow(new Date());
        }
      } finally {
        if (isCurrentRequest()) {
          requestPending.current = false;
          setLoading(false);
        }
      }
    }

    void loadHealth();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestRevision]);

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
        configuredLabel(
          github.oauthConfigured,
          T("OAuth configured", "OAuth 已配置"),
          T("OAuth missing", "OAuth 缺失")
        ),
        configuredLabel(
          github.appInstallConfigured,
          T("App install configured", "App 安装已配置"),
          T("App install missing", "App 安装缺失")
        ),
        configuredLabel(
          github.appApiConfigured,
          T("App API configured", "App API 已配置"),
          T("App API missing", "App API 缺失")
        ),
        github.appVisibilityCheck
          ? T("Visibility check on", "可见性检查开启")
          : T("Visibility check off", "可见性检查关闭"),
      ].join(" / ")
    : "";
  const billingDetail = billing
    ? `${billing.provider || "unknown"} (${billing.enabled ? T("enabled", "已启用") : T("not enabled", "未启用")})`
    : "";
  const databaseDetail = health?.database?.type
    ? `${health.database.type}: ${T("backend reported by API", "API 返回的后端信息")}`
    : T("No database information reported.", "未返回数据库信息。");
  const apiLabel = health?.ok
    ? T("Reachable", "可访问")
    : error
      ? T("Unreachable", "不可访问")
      : T("Checking", "检查中");

  return (
    <LegalChrome go={go} current="status" auth={auth}>
      <section className="status-hero">
        <div className={"status-overall " + apiStatus}>
          <span className="status-dot" />
          <h1>{title}</h1>
        </div>
        <p className="status-sub">
          {T("Last checked", "最近检查")} {now.toLocaleTimeString()} ·{" "}
          {T("Initial check, then refresh manually", "首次检查后，请手动刷新")}
        </p>
        <p className="status-sub">
          {T(
            "This check reports API reachability and backend information. It does not verify ledger writes, GitHub authorization or payments.",
            "此检查显示 API 可访问性及后端信息，不验证账本写入、GitHub 授权或支付是否成功。"
          )}
        </p>
        <button
          className="btn"
          disabled={loading}
          aria-busy={loading}
          onClick={() => {
            if (requestPending.current) return;
            requestPending.current = true;
            setLoading(true);
            setRequestRevision((value) => value + 1);
          }}
        >
          <I.Refresh size={14} /> {T("Refresh status", "刷新状态")}
        </button>
      </section>

      <section className="status-section">
        <div className="status-card card">
          <div className="status-card-h">
            <h2>{T("Current connection", "当前连接")}</h2>
            <span className="muted">
              {T("No generated uptime or incident history", "不生成 uptime 或事故历史")}
            </span>
          </div>
          <StatusRow
            icon={<I.Code size={14} />}
            title={T("Web app", "Web 应用")}
            status="operational"
            label={T("Loaded in this browser", "已在当前浏览器加载")}
            detail={window.location.host || "local browser"}
          />
          <StatusRow
            icon={<I.Activity size={14} />}
            title={T("REST API", "REST API")}
            status={apiStatus}
            label={apiLabel}
            detail={apiDetail}
          />
          <StatusRow
            icon={<I.Database size={14} />}
            title={T("Database backend", "数据库后端")}
            status={health?.database?.configured ? "operational" : "degraded"}
            label={health?.database?.configured
              ? T("Configured", "已配置")
              : T("Not reported", "未报告")}
            detail={databaseDetail}
          />
        </div>

        {readinessAvailable(health) && (
          <div className="status-card card" style={{ marginTop: 14 }}>
            <div className="status-card-h">
              <h2>{T("Reported configuration", "返回的配置")}</h2>
              <span className="muted">
                {T(
                  "Configuration flags do not verify integration availability",
                  "配置标志不代表集成可用性已通过验证"
                )}
              </span>
            </div>
            {github && (
              <StatusRow
                icon={<I.Github size={14} />}
                title={T("GitHub integration", "GitHub 集成")}
                status={githubReady ? "operational" : "degraded"}
                label={githubReady
                  ? T("Configured", "已配置")
                  : T("Incomplete configuration", "配置不完整")}
                detail={githubDetail}
              />
            )}
            {billing && (
              <StatusRow
                icon={<I.Package size={14} />}
                title={T("Billing provider", "支付提供方")}
                status={billing.enabled ? "operational" : "degraded"}
                label={billing.enabled ? T("enabled", "已启用") : T("not enabled", "未启用")}
                detail={billingDetail}
              />
            )}
          </div>
        )}
      </section>
    </LegalChrome>
  );
}
