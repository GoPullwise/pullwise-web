import { useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

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
            <div className="legal-side-d">2026-05-17</div>
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
                "Questions? Email support@pullwise.dev.",
                "如有问题，请联系 support@pullwise.dev。"
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

export function PrivacyScreen({ go, auth }) {
  useLang();
  const sections = [
    { id: "data", title: T("Data we collect", "收集的数据") },
    { id: "code", title: T("Repository code", "仓库代码") },
    { id: "payments", title: T("Payments", "支付") },
    { id: "retention", title: T("Retention", "保留期限") },
    { id: "rights", title: T("Your choices", "你的选择") },
  ];

  return (
    <LegalDocLayout
      go={go}
      auth={auth}
      current="privacy"
      sections={sections}
      title={T("Privacy Policy", "隐私政策")}
      subtitle={T(
        "Pullwise uses account, GitHub, payment, and scan data only to provide repository review and subscription management.",
        "Pullwise 只将账户、GitHub、支付和扫描数据用于提供仓库审查和订阅管理。"
      )}
    >
      <Section id="data" title={sections[0].title}>
        <p>
          {T(
            "We collect your email address, GitHub profile metadata, authorized repository metadata, scan records, issue findings, and basic operational logs.",
            "我们会收集邮箱地址、GitHub 资料元数据、已授权仓库元数据、扫描记录、问题发现和基础运行日志。"
          )}
        </p>
      </Section>
      <Section id="code" title={sections[1].title}>
        <p>
          {T(
            "Repository contents are cloned by the backend worker only for the scan you start. Source code is not stored in the browser and is not used to train models by Pullwise.",
            "仓库内容仅由后端 worker 为你启动的扫描而克隆。源代码不会存入浏览器，Pullwise 不会将你的代码用于模型训练。"
          )}
        </p>
      </Section>
      <Section id="payments" title={sections[2].title}>
        <p>
          {T(
            "Payments are processed by the enabled provider, Stripe or Creem. Pullwise stores provider customer and subscription identifiers, but does not store card numbers.",
            "支付由启用的 Stripe 或 Creem 处理。Pullwise 只保存支付平台的客户和订阅标识，不保存银行卡号。"
          )}
        </p>
      </Section>
      <Section id="retention" title={sections[3].title}>
        <p>
          {T(
            "Account and subscription metadata is kept while your account is active. Scan findings may be retained for product operation and can be deleted when you close your account.",
            "账户和订阅元数据会在账户有效期间保留。扫描发现会为产品运行而保留，并可在关闭账户时删除。"
          )}
        </p>
      </Section>
      <Section id="rights" title={sections[4].title}>
        <p>
          {T(
            "You can request export, correction, or deletion of your account data by contacting support@pullwise.dev.",
            "你可以通过 support@pullwise.dev 请求导出、更正或删除账户数据。"
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
    { id: "account", title: T("Account", "账户") },
    { id: "billing", title: T("Billing", "支付") },
    { id: "limits", title: T("Limits", "限制") },
    { id: "liability", title: T("Liability", "责任") },
  ];

  return (
    <LegalDocLayout
      go={go}
      auth={auth}
      current="terms"
      sections={sections}
      title={T("Terms of Service", "服务条款")}
      subtitle={T(
        "These terms govern your use of Pullwise repository review and billing features.",
        "这些条款适用于 Pullwise 仓库审查和支付功能。"
      )}
    >
      <Section id="service" title={sections[0].title}>
        <p>
          {T(
            "Pullwise provides GitHub-connected code review workflows. Findings are recommendations and must be reviewed by you before acting on them.",
            "Pullwise 提供连接 GitHub 的代码审查流程。审查发现仅为建议，你需要自行确认后再采取行动。"
          )}
        </p>
      </Section>
      <Section id="account" title={sections[1].title}>
        <p>
          {T(
            "You are responsible for keeping your GitHub account, email inbox, and Pullwise sessions secure.",
            "你需要负责保护 GitHub 账户、邮箱和 Pullwise 会话的安全。"
          )}
        </p>
      </Section>
      <Section id="billing" title={sections[2].title}>
        <p>
          {T(
            "Subscriptions are billed by the configured provider, Stripe or Creem. You can manage or cancel an active subscription from the billing page when a customer portal is available.",
            "订阅由配置的 Stripe 或 Creem 收费。当支付平台提供客户门户时，你可以从支付页面管理或取消订阅。"
          )}
        </p>
      </Section>
      <Section id="limits" title={sections[3].title}>
        <p>
          {T(
            "Do not use Pullwise to scan repositories you are not authorized to access, to process illegal content, or to attack GitHub, payment providers, or Pullwise infrastructure.",
            "不得使用 Pullwise 扫描未授权仓库、处理违法内容，或攻击 GitHub、支付平台及 Pullwise 基础设施。"
          )}
        </p>
      </Section>
      <Section id="liability" title={sections[4].title}>
        <p>
          {T(
            "Pullwise is provided as a software service. To the maximum extent permitted by law, Pullwise is not liable for indirect or consequential damages.",
            "Pullwise 作为软件服务提供。在法律允许的最大范围内，Pullwise 不承担间接或后果性损失责任。"
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
        "Pullwise requests read-only repository access for metadata and code checkout unless you add future write features.",
        "Pullwise 默认只请求只读仓库权限，用于元数据读取和代码 checkout。"
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
      title: T("Read-only review runner", "只读审查运行器"),
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
        <a className="btn primary lg" href="mailto:security@pullwise.dev">
          <I.Mail /> security@pullwise.dev
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

export function StatusScreen({ go, auth }) {
  useLang();
  const [now, setNow] = useState(() => new Date());
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      setNow(new Date());
      try {
        const payload = await pullwiseApi.system.health();
        if (!cancelled) {
          setHealth(payload);
          setError("");
        }
      } catch (healthError) {
        if (!cancelled) {
          setHealth(null);
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
        `${limits.maxConcurrentScans ?? "-"} global / ${limits.maxConcurrentScansPerUser ?? "-"} per user`,
        `Rate limiting ${limits.rateLimitEnabled ? "enabled" : "disabled"}`,
      ].join(" - ")
    : "";
  const databaseDetail = health?.database?.type
    ? `${health.database.type}: ${health.database.path || "configured backend path"}`
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
                status={limits.maxConcurrentScans ? "operational" : "degraded"}
                detail={limitsDetail}
              />
            )}
          </div>
        )}
      </section>
    </LegalChrome>
  );
}
