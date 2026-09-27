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
    { id: "use", title: T("How we use data", "数据用途") },
    { id: "sharing", title: T("Processors and sharing", "处理方与共享") },
    { id: "retention", title: T("Retention", "保留期限") },
    { id: "rights", title: T("Your choices and rights", "你的选择与权利") },
    { id: "security", title: T("Security", "安全") },
    { id: "contact", title: T("Contact", "联系方式") },
  ];
  return <LegalDocLayout go={go} auth={auth} current="privacy" sections={sections}
    title={T("Privacy Policy", "隐私政策")}
    subtitle={T("This policy describes how Pullwise handles account, GitHub, expense ledger, API key and platform billing data.",
      "本政策说明 Pullwise 如何处理账户、GitHub、支出账本、API 密钥及平台账单数据。")}>
    <Section id="scope" title={sections[0].title}><p>{T(
      "Pullwise provides a GitHub-connected project expense ledger through the web app and REST API. This policy also covers account, billing and support interactions.",
      "Pullwise 通过 Web 应用和 REST API 提供连接 GitHub 的项目支出账本。本政策也适用于账户、账单和支持沟通。")}</p></Section>
    <Section id="data" title={sections[1].title}><LegalList items={[
      T("Account and GitHub data: identity, session, authorized repository and installation metadata.", "账户与 GitHub 数据：身份、会话、已授权仓库和安装元数据。"),
      T("Ledger data: project descriptions, categories, expense dates, amounts, currencies, purpose, notes, quantity and audit history.", "账本数据：项目描述、类别、支出日期、金额、币种、用途、备注、数量和审计历史。"),
      T("API key data: name, prefix, hashed token, scopes, target restrictions and usage metadata. The full token is displayed once.", "API 密钥数据：名称、前缀、令牌哈希、权限、目标限制和使用元数据。完整令牌仅显示一次。"),
      T("Platform billing data: subscription, checkout and payment event identifiers; operational logs needed to run and secure the service.", "平台账单数据：订阅、结账和支付事件标识；运营与安全所需日志。"),
    ]} /></Section>
    <Section id="use" title={sections[2].title}><p>{T(
      "We use this data to authenticate users, check GitHub authorization, store and report expenses, manage API keys and subscriptions, prevent abuse and answer support requests. Platform charges are kept separate from user-entered expenses.",
      "我们用这些数据认证用户、检查 GitHub 授权、保存和汇总支出、管理 API 密钥与订阅、防止滥用并处理支持请求。平台收费与用户录入的支出分开保存。")}</p>
      <p>{T("Optional Jev suggestions, when enabled, use the submitted expense text and allowed category names. Suggestions do not create or change ledger entries and require your confirmation.",
        "启用可选的 Jev 建议时，系统会使用提交的支出文字和可用类别名称。建议不会创建或修改账目，需要你确认。")}</p></Section>
    <Section id="sharing" title={sections[3].title}><p>{T(
      "GitHub supplies repository authorization, Creem processes platform payments, and the configured model provider processes optional suggestions when enabled. We do not sell your personal data or repository code.",
      "GitHub 提供仓库授权，Creem 处理平台支付；启用可选建议时，配置的模型提供方会处理建议请求。我们不出售个人数据或仓库代码。")}</p></Section>
    <Section id="retention" title={sections[4].title}><p>{T(
      "Ledger history remains with your account when GitHub access changes. Removed expenses and suggestion decisions may be retained in audit records. Account, API key, payment and operational records are kept as needed for service, security, tax, audit or legal purposes. Contact us to ask about deletion.",
      "GitHub 权限变化后，账目历史仍归你的账户。移除的支出及建议决定可能保留在审计记录中。账户、API 密钥、支付和运营记录会按服务、安全、税务、审计或法律需要保留。可联系我们询问删除事宜。")}</p></Section>
    <Section id="rights" title={sections[5].title}><p>{T(
      `Contact ${CONTACT_EMAIL} to request access, export, correction or deletion of account data. You can manage GitHub access and revoke API keys in the product.`,
      `请联系 ${CONTACT_EMAIL} 请求访问、导出、更正或删除账户数据。你也可以在产品中管理 GitHub 授权和撤销 API 密钥。`)}</p></Section>
    <Section id="security" title={sections[6].title}><p>{T(
      "Pullwise uses scoped API keys, account ownership checks, GitHub authorization checks and backend-held secrets. Protect your sessions and API keys.",
      "Pullwise 使用有范围的 API 密钥、账户所有权检查、GitHub 授权检查以及后端保存的密钥。请保护你的会话和 API 密钥。")}</p></Section>
    <Section id="contact" title={sections[7].title}><p>{T(`Contact ${SECURITY_EMAIL} with privacy or security questions.`,
      `隐私或安全问题请联系 ${SECURITY_EMAIL}。`)}</p></Section>
  </LegalDocLayout>;
}

export function TermsScreen({ go, auth }) {
  useLang();
  const sections = [
    { id: "service", title: T("Service", "服务") },
    { id: "account", title: T("Account and GitHub access", "账户与 GitHub 访问") },
    { id: "api", title: T("API use", "API 使用") },
    { id: "billing", title: T("Billing", "计费") },
    { id: "content", title: T("Your content", "你的内容") },
    { id: "contact", title: T("Contact", "联系方式") },
  ];
  return <LegalDocLayout go={go} auth={auth} current="terms" sections={sections}
    title={T("Terms of Service", "服务条款")}
    subtitle={T("These terms cover the Pullwise project expense ledger, API keys and platform subscription.",
      "本条款适用于 Pullwise 项目支出账本、API 密钥和平台订阅。")}>
    <Section id="service" title={sections[0].title}><p>{T(
      "Pullwise lets you record costs for GitHub projects and a shared expense pool. Entries, reports and optional suggestions are information supplied or confirmed by you; check amounts, categories and tax treatment yourself. No exchange rate is inferred.",
      "Pullwise 允许你记录 GitHub 项目和公共池的支出。账目、报表和可选建议基于你提供或确认的信息；请自行核对金额、类别及税务处理。系统不会推断汇率。")}</p></Section>
    <Section id="account" title={sections[1].title}><p>{T(
      "Only connect repositories you are authorized to access. GitHub OAuth and App authorization control new repository binding. Your existing account ledger remains available if GitHub access later changes.",
      "只能连接你有权访问的仓库。GitHub OAuth 和 App 授权控制新仓库绑定。之后即使 GitHub 权限变化，已有账户账本仍可访问。")}</p></Section>
    <Section id="api" title={sections[2].title}><p>{T(
      "API keys are account credentials limited by selected scopes and project or shared-pool restrictions. Keep tokens private, revoke unused keys and do not bypass rate or authorization limits.",
      "API 密钥是账户凭据，受所选权限和项目或公共池限制。请保密令牌，撤销不再使用的密钥，不要绕过限流或授权限制。")}</p></Section>
    <Section id="billing" title={sections[3].title}><p>{T(
      "Pullwise platform subscriptions are billed through Creem. Subscription charges and payment history are separate from expenses you record in your ledger. Review the displayed price, tax and renewal terms before purchase.",
      "Pullwise 平台订阅通过 Creem 收费。订阅费用和支付历史与账本中你录入的支出分开。购买前请核对显示的价格、税费和续订条款。")}</p>
      <p>{T("You can cancel renewal for an active subscription from Pullwise Billing. It ends at the current paid period. You can resume renewal from Pullwise Billing before that date. Supported upgrades take effect immediately; Creem calculates any proration. Lower-tier changes or yearly-to-monthly changes are unavailable in the product.",
        "你可以在 Pullwise 账单页取消有效订阅的续订，取消会在当前已付周期结束时生效。在此之前可从账单页恢复续订。支持的升级立即生效，差额由 Creem 计算。产品内不支持降级或年付改月付。")}</p></Section>
    <Section id="content" title={sections[4].title}><p>{T(
      "You retain your ledger entries and other customer content. You allow Pullwise to store and process them to provide and secure the service. Optional suggestions cannot create expenses without your action.",
      "你保留账目和其他客户内容。你允许 Pullwise 为提供和保护服务而存储及处理这些内容。可选建议未经你操作不能创建支出。")}</p></Section>
    <Section id="contact" title={sections[5].title}><p>{T(`For questions, contact ${CONTACT_EMAIL}.`, `如有问题，请联系 ${CONTACT_EMAIL}。`)}</p></Section>
  </LegalDocLayout>;
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
