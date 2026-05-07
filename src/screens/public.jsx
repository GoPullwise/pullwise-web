// screens/public.jsx — Landing, Login, OAuth screens

import React, { useState } from "react";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import {
  connectGitHubRepositories,
  requestEmailMagicLink,
  startGitHubLogin,
} from "../lib/auth.js";

// ── Landing ─────────────────────────────────────────────────────────────
export function LandingScreen({ go, accent }) {
  useLang();
  return (
    <div className="landing fade-in">
      <header className="lp-top">
        <div className="brand">
          <div className="brand-mark">PR</div>
          <span>Pullwise</span>
        </div>
        <nav className="lp-nav">
          <button className="btn ghost sm">{T("Product", "产品")}</button>
          <button className="btn ghost sm" onClick={() => go("pricing")}>{T("Pricing", "定价")}</button>
          <button className="btn ghost sm" onClick={() => go("docs")}>{T("Docs", "文档")}</button>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => go("login")}>{T("Sign in", "登录")}</button>
          <button className="btn primary sm" onClick={() => go("login")}>{T("Get started", "开始使用")}</button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: accent }}></span>
          <span>{T("v1.4 · Reviewer is live", "v1.4 · Reviewer 上线")}</span>
          <I.ArrowR size={12} />
        </div>
        <h1 className="lp-title">
          {T("Quiet confidence", "每一次 commit,")}<br/>
          <span className="lp-title-em">{T("in every commit.", "都安心。")}</span>
        </h1>
        <p className="lp-sub">
          {T(
            "Pullwise quietly reviews your GitHub repos for security holes, performance bottlenecks, dependency risks and architectural smells — and ships click-to-apply fixes. So you can ship without second-guessing.",
            "Pullwise 安静地为你的 GitHub 仓库 review 代码,识别安全漏洞、性能瓶颈、依赖隐患和架构异味,并给出可点击应用的修复方案 — 让每次发布都不用再三犹豫。"
          )}
        </p>
        <div className="lp-cta">
          <button className="btn primary lg" onClick={() => go("login")}>
            <I.Github /> {T("Sign in with GitHub", "用 GitHub 登录")}
          </button>
          <button className="btn lg" onClick={() => go("dashboard")}>
            {T("View example dashboard", "查看示例 Dashboard")} <I.ArrowR size={14} />
          </button>
        </div>
        <div className="lp-meta">
          <span><I.Check size={12} /> {T("Free to start", "免费开始")}</span>
          <span><I.Check size={12} /> {T("No credit card", "无需信用卡")}</span>
          <span><I.Check size={12} /> {T("Private repo support", "私有仓库支持")}</span>
        </div>
      </section>

      <section className="lp-preview">
        <div className="lp-preview-card">
          <div className="lp-preview-bar">
            <span></span><span></span><span></span>
            <div className="lp-preview-url">pullwise.dev / dashboard</div>
          </div>
          <div className="lp-preview-body">
            <div className="lp-preview-side">
              {[T("Overview","总览"), T("Issues","问题"), T("History","历史"), T("Settings","设置")].map((x,i) => (
                <div key={i} className={"lp-preview-side-i" + (i===1?" active":"")}>{x}</div>
              ))}
            </div>
            <div className="lp-preview-main">
              <div className="lp-preview-row">
                <div className="lp-preview-stat"><b>27</b><span>{T("Open issues","未解决")}</span></div>
                <div className="lp-preview-stat"><b style={{ color: "var(--sev-critical)" }}>2</b><span>Critical</span></div>
                <div className="lp-preview-stat"><b style={{ color: accent }}>89%</b><span>Auto-fixable</span></div>
                <div className="lp-preview-stat"><b>3.4s</b><span>{T("Last scan","最近扫描")}</span></div>
              </div>
              <div className="lp-preview-issues">
                {[
                  { s: "critical", t: T("Hardcoded API key leaked into frontend bundle", "硬编码的 API 密钥泄露在前端 bundle"), f: "lib/payments.ts:14" },
                  { s: "critical", t: T("SQL string concatenation enables injection", "SQL 字符串拼接导致注入风险"), f: "routes/search.ts:42" },
                  { s: "high", t: T("Dashboard triggers N+1 data fetch", "Dashboard 触发 N+1 数据获取"), f: "(dashboard)/page.tsx:88" },
                  { s: "high", t: T("axios@0.21.1 SSRF vulnerability", "axios@0.21.1 SSRF 漏洞"), f: "package.json:28" },
                ].map((r,i) => (
                  <div key={i} className="lp-preview-issue">
                    <span className={"sev sev-"+r.s}><span className="dot" style={{ background: "currentColor" }}></span>{r.s}</span>
                    <div className="lp-preview-issue-t">{r.t}</div>
                    <span className="lp-preview-issue-f">{r.f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-features">
        {[
          { i: <I.Github />, h: T("One-click GitHub","一键连接 GitHub"), p: T("OAuth in, scan public and private repos instantly. No webhook or CI setup.","OAuth 授权后立刻扫描公开和私有仓库, 无需配置 webhook 或 CI。") },
          { i: <I.Sparkle />, h: T("AI applies fixes","AI 给出可应用修复"), p: T("Reviewer doesn't just flag — it writes the patch. You skim, you merge.","不只是指出问题, Reviewer 会写好 patch — 你审一眼即可合入。") },
          { i: <I.Shield />, h: T("Six issue categories","覆盖 6 大类问题"), p: T("Security, performance, dependencies, tests, docs, architecture — one scan, every angle.","Security、性能、依赖、测试、文档、架构 — 一份扫描看清所有维度。") },
          { i: <I.GitPull />, h: T("Auto-open PRs","自动开 PR"), p: T("Pick a fix, click Create PR. We push the branch with a full description.","选择修复后, 点击 Create PR, 我们会推送 branch 并附上完整说明。") },
          { i: <I.Activity />, h: T("Trends & regression alerts","趋势与回归告警"), p: T("Track key metrics. When critical issues spike, get an email or Slack ping.","持续追踪关键指标, 当 critical 数量上升立刻通过邮件 / Slack 提醒。") },
          { i: <I.Lock />, h: T("Self-host friendly","私有部署友好"), p: T("Code never persisted, analyzed in memory. SSO, SAML, self-hosted runners.","代码不留存, 仅在内存中分析。支持 SSO、SAML、自托管 Runner。") },
        ].map((f, i) => (
          <div key={i} className="lp-feat">
            <div className="lp-feat-i" style={{ color: accent }}>{f.i}</div>
            <h3>{f.h}</h3>
            <p>{f.p}</p>
          </div>
        ))}
      </section>

      <section className="lp-cta-band">
        <h2>{T("Starting today, review is no longer the bottleneck.", "从今天开始,让 review 不再是瓶颈。")}</h2>
        <button className="btn primary lg" onClick={() => go("login")}><I.Github /> {T("Sign in with GitHub","用 GitHub 登录")}</button>
      </section>

      <footer className="lp-foot">
        <div>© 2026 Pullwise</div>
        <div style={{ display: "flex", gap: 18 }}>
          <a className="legal-foot-l" onClick={() => go("privacy")}>{T("Privacy","隐私")}</a>
          <a className="legal-foot-l" onClick={() => go("terms")}>{T("Terms","条款")}</a>
          <a className="legal-foot-l" onClick={() => go("security")}>{T("Security","安全")}</a>
          <a className="legal-foot-l" onClick={() => go("status")}>{T("Status ●","状态 ●")}</a>
        </div>
      </footer>
    </div>
  );
}

// ── Login ───────────────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getAuthErrorMessage(error) {
  return (
    error?.message ||
    T(
      "Authentication is unavailable. Check the backend auth service.",
      "认证服务暂不可用，请检查后端 auth 服务。"
    )
  );
}

export function LoginScreen({ go }) {
  useLang();
  const [email, setEmail] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [magicLink, setMagicLink] = useState("");

  const pending = Boolean(pendingAction);

  const handleGitHubLogin = async () => {
    setPendingAction("github");
    setError("");

    try {
      await startGitHubLogin();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
      setPendingAction("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      setError(T("Enter a valid email address.", "请输入有效的邮箱地址。"));
      return;
    }

    setPendingAction("email");
    setError("");
    setSentEmail("");
    setMagicLink("");

    try {
      const result = await requestEmailMagicLink({ email: normalizedEmail });
      setSentEmail(normalizedEmail);
      setMagicLink(result?.devMagicLink || result?.magicLink || "");
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setPendingAction("");
    }
  };

  return (
    <div className="auth-shell fade-in">
      <button className="auth-back btn ghost sm" onClick={() => go("landing")}>
        <I.ArrowL size={14} /> {T("Back","返回")}
      </button>
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
          <div className="brand-mark">PR</div>
          <span style={{ fontSize: 16 }}>Pullwise</span>
        </div>
        <h2 className="auth-title">{T("Sign in to Pullwise", "登录 Pullwise")}</h2>
        <p className="auth-sub">
          {T(
            "Use GitHub or a magic email link. First sign-in creates your account automatically.",
            "使用 GitHub 或邮箱魔法链接登录。首次登录会自动创建账号。"
          )}
        </p>

        <button
          className="btn lg primary auth-gh"
          type="button"
          disabled={pending}
          onClick={handleGitHubLogin}
        >
          {pendingAction === "github" ? (
            <>
              <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>
              {T("Opening GitHub...", "正在打开 GitHub...")}
            </>
          ) : (
            <>
              <I.Github /> {T("Continue with GitHub", "使用 GitHub 继续")}
            </>
          )}
        </button>

        <div className="auth-or"><span>{T("or","或")}</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{T("Email","邮箱")}</span>
            <div className="auth-input">
              <I.Mail size={14} />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  setSentEmail("");
                  setMagicLink("");
                }}
                placeholder="you@company.com"
                disabled={pending}
              />
            </div>
          </label>
          {error && (
            <div className="auth-error" role="alert">
              <I.X size={13} /> {error}
            </div>
          )}
          {sentEmail && (
            <div className="auth-success" role="status">
              <I.Check size={13} />
              <div>
                <b>{T("Check your email", "请查收邮箱")}</b>
                <span>
                  {T(
                    `We sent a magic link to ${sentEmail}. After signing in, continue to GitHub repository authorization.`,
                    `我们已向 ${sentEmail} 发送魔法链接。登录后继续授权 GitHub 仓库权限。`
                  )}
                </span>
                {magicLink && (
                  <a className="btn sm auth-dev-link" href={magicLink}>
                    {T("Open local magic link", "打开本地魔法链接")}
                  </a>
                )}
              </div>
            </div>
          )}
          <button className="btn lg" type="submit" disabled={pending}>
            {pendingAction === "email" ? (
              <>
                <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>
                {T("Sending link...", "正在发送链接...")}
              </>
            ) : (
              T("Send magic link", "发送魔法链接")
            )}
          </button>
        </form>

        <div className="auth-next">
          <div className="auth-next-i">
            <span>1</span>
            <p>{T("Sign in without passwords.", "无需密码登录。")}</p>
          </div>
          <div className="auth-next-i">
            <span>2</span>
            <p>{T("Then connect GitHub repositories for scanning.", "随后单独连接 GitHub 仓库用于扫描。")}</p>
          </div>
        </div>
      </div>
      <div className="auth-legal">
        {T("By signing in you agree to our","登录即代表同意")}{" "}
        <a>{T("Terms of Service","服务条款")}</a> {T("and","与")} <a>{T("Privacy Policy","隐私政策")}</a>{T(".","。")}
      </div>
    </div>
  );
}

// ── GitHub repository access ────────────────────────────────────────────
export function OAuthScreen({ go }) {
  useLang();
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState("");

  const handleAuthorize = async () => {
    setAuthing(true);
    setError("");

    try {
      await connectGitHubRepositories();
      go("repos");
    } catch (authError) {
      if (authError?.code === "popup_closed") {
        setError(T(
          "GitHub installation was cancelled. Please try again.",
          "GitHub 安装已取消，请重试。"
        ));
      } else {
        setError(getAuthErrorMessage(authError));
      }
      setAuthing(false);
    }
  };

  return (
    <div className="oauth-shell fade-in">
      <div className="oauth-card">
        <div className="oauth-head">
          <div className="oauth-logos">
            <div className="oauth-logo gh"><I.Github size={26} /></div>
            <div className="oauth-dots">
              <span></span><span></span><span></span>
            </div>
            <div className="oauth-logo app">PR</div>
          </div>
          <h2>{T("Connect GitHub repository access", "连接 GitHub 仓库权限")}</h2>
          <p className="oauth-org">
            {T(
              "Your Pullwise account is signed in. Authorize repositories separately before scanning.",
              "Pullwise 账号已登录。扫描前需要单独授权仓库访问范围。"
            )}
          </p>
        </div>

        <div className="oauth-perms">
          <div className="oauth-perm-h">{T("Requested GitHub permissions","请求的 GitHub 权限")}</div>
          {[
            { i: <I.Folder size={15} />, h: T("Repository metadata","仓库元数据"), p: T("List authorized repos, branches, languages, and installation status.","列出已授权仓库、分支、语言和安装状态。") },
            { i: <I.FileCode size={15} />, h: T("Read repository contents","读取仓库内容"), p: T("Read-only access for scans. Repository contents are not stored in the browser.","仅用于扫描的只读权限。仓库内容不会存储在浏览器中。") },
            { i: <I.GitPull size={15} />, h: T("Create branches and pull requests","创建分支与 Pull Request"), p: T("Used only when you approve an auto-fix and ask Pullwise to open a PR.","仅在你批准 auto-fix 并要求创建 PR 时使用。") },
            { i: <I.Bell size={15} />, h: T("Webhook events","Webhook 事件"), p: T("Trigger incremental scans on push and pull request updates.","在 push 和 PR 更新时触发增量扫描。") },
          ].map((p, i) => (
            <div key={i} className="oauth-perm">
              <div className="oauth-perm-i">{p.i}</div>
              <div>
                <div className="oauth-perm-t">{p.h}</div>
                <div className="oauth-perm-p">{p.p}</div>
              </div>
              <I.Check size={14} style={{ color: "#16a34a" }} />
            </div>
          ))}
        </div>

        <div className="oauth-orgs">
          <div className="oauth-perm-h">{T("Repository access","仓库访问范围")}</div>
          <div className="oauth-org-p">
            {T(
              "GitHub will ask whether to grant access to all repositories or only selected ones on the next screen.",
              "下一步 GitHub 会让你选择授予全部仓库还是仅指定仓库。"
            )}
          </div>
        </div>

        {error && (
          <div className="oauth-error" role="alert">
            <I.X size={13} /> {error}
          </div>
        )}

        <div className="oauth-actions">
          <button className="btn lg" onClick={() => go("login")}>{T("Cancel","取消")}</button>
          <button
            className={"btn lg primary" + (authing ? " is-loading" : "")}
            disabled={authing}
            onClick={handleAuthorize}
          >
            {authing ? (
              <>
                <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>
                {T("Opening GitHub...", "正在打开 GitHub...")}
              </>
            ) : (
              <>{T("Connect GitHub repositories", "连接 GitHub 仓库")} <I.ArrowR size={14} /></>
            )}
          </button>
        </div>

        <div className="oauth-foot">
          <I.Lock size={12} /> {T("Login identity and repository authorization are separate, so access can be revoked without deleting your account.","登录身份与仓库授权是分开的，因此你可以撤销仓库权限而不删除账号。")}
        </div>
      </div>
    </div>
  );
}

// ── Pricing ─────────────────────────────────────────────────────────────
export function PricingScreen({ go, accent }) {
  useLang();
  const [annual, setAnnual] = useState(true);

  const tiers = [
    {
      k: "free",
      name: T("Free", "免费"),
      tag: T("For solo developers exploring", "适合独立开发者尝鲜"),
      price: { m: 0, y: 0 },
      cta: T("Start free", "免费开始"),
      features: [
        T("Up to 3 public repos", "最多 3 个公开仓库"),
        T("100 scans / month", "每月 100 次扫描"),
        T("Security & dependency lenses", "Security 与依赖 lens"),
        T("Community support", "社区支持"),
      ],
    },
    {
      k: "pro",
      name: T("Pro", "Pro"),
      tag: T("For teams shipping every day", "适合每天 ship 的团队"),
      price: { m: 24, y: 19 },
      cta: T("Start 14-day trial", "开始 14 天试用"),
      featured: true,
      badge: T("Most popular", "最受欢迎"),
      features: [
        T("Unlimited private & public repos", "不限私有 / 公开仓库"),
        T("1,000 scans / month", "每月 1,000 次扫描"),
        T("All 6 lenses incl. architecture", "全部 6 种 lens, 含 architecture"),
        T("Auto-fix patches & PR creation", "Auto-fix 与自动开 PR"),
        T("Slack & Linear integrations", "Slack 与 Linear 集成"),
        T("90-day scan history", "90 天扫描历史"),
      ],
    },
    {
      k: "team",
      name: T("Team", "团队版"),
      tag: T("For organizations with many repos", "适合多仓库的组织"),
      price: { m: 79, y: 64 },
      cta: T("Start trial", "开始试用"),
      features: [
        T("Everything in Pro", "包含 Pro 所有功能"),
        T("Unlimited scans", "不限扫描次数"),
        T("SSO / SAML, audit logs", "SSO / SAML, 审计日志"),
        T("Custom rule packs", "自定义规则包"),
        T("Priority email support", "优先邮件支持"),
        T("Role-based access", "基于角色的权限"),
      ],
    },
    {
      k: "enterprise",
      name: T("Enterprise", "企业版"),
      tag: T("For regulated & self-hosted setups", "适合受监管 / 私有部署"),
      price: null,
      cta: T("Contact sales", "联系销售"),
      features: [
        T("Self-hosted runners", "自托管 Runner"),
        T("Bring your own Claude API key", "可使用自有 Claude API key"),
        T("Dedicated tenant, no shared infra", "独立租户, 不共享基础设施"),
        T("Custom MSA & DPA", "定制 MSA 与 DPA"),
        T("Solutions engineer & SLA", "解决方案工程师 & SLA"),
        T("On-prem deployment guide", "私有部署指南"),
      ],
    },
  ];

  const compare = [
    { g: T("Scanning", "扫描"), rows: [
      { f: T("Public repos", "公开仓库"), v: ["3", "∞", "∞", "∞"] },
      { f: T("Private repos", "私有仓库"), v: ["—", "∞", "∞", "∞"] },
      { f: T("Scans / month", "每月扫描数"), v: ["100", "1,000", T("Unlimited","不限"), T("Unlimited","不限")] },
      { f: T("Architecture lens", "Architecture lens"), v: ["—", "✓", "✓", "✓"] },
    ]},
    { g: T("Fixes & workflow", "修复与流程"), rows: [
      { f: T("Auto-fix patches", "Auto-fix 补丁"), v: ["—", "✓", "✓", "✓"] },
      { f: T("Auto-create PRs", "自动开 PR"), v: ["—", "✓", "✓", "✓"] },
      { f: T("Slack / Linear", "Slack / Linear"), v: ["—", "✓", "✓", "✓"] },
      { f: T("Custom rule packs", "自定义规则包"), v: ["—", "—", "✓", "✓"] },
    ]},
    { g: T("Security & admin", "安全与管理"), rows: [
      { f: T("SSO / SAML", "SSO / SAML"), v: ["—", "—", "✓", "✓"] },
      { f: T("Audit logs", "审计日志"), v: ["—", "—", "✓", "✓"] },
      { f: T("Self-hosted", "私有部署"), v: ["—", "—", "—", "✓"] },
      { f: T("Bring-your-own LLM key", "自有 LLM key"), v: ["—", "—", "—", "✓"] },
    ]},
    { g: T("Support", "支持"), rows: [
      { f: T("Channel", "渠道"), v: [T("Community","社区"), T("Email","邮件"), T("Priority email","优先邮件"), T("Dedicated SE","专属 SE")] },
      { f: T("SLA", "SLA"), v: ["—", "—", "99.5%", "99.95%"] },
    ]},
  ];

  const faqs = [
    {
      q: T("How is a 'scan' counted?", "一次「扫描」是怎么计算的?"),
      a: T(
        "One scan = one full or incremental review of one repo at one commit. Webhook-triggered incremental scans on every push count too.",
        "一次扫描 = 对一个仓库在某个 commit 上的一次完整或增量 review。每次 push 触发的 webhook 增量扫描也会被计入。"
      ),
    },
    {
      q: T("Do you store our code?", "你们会存储我们的代码吗?"),
      a: T(
        "No. Code is cloned to ephemeral runners, analyzed in memory, and discarded immediately. We retain only the findings and metadata for 90 days.",
        "不会。代码在临时 runner 上 clone, 仅在内存中分析后立即丢弃。我们仅保留 finding 与元数据 90 天。"
      ),
    },
    {
      q: T("Can I switch plans later?", "我可以随时切换套餐吗?"),
      a: T(
        "Yes. Upgrades take effect immediately and are pro-rated. Downgrades apply at the end of the current billing cycle.",
        "可以。升级立即生效并按比例计费, 降级在当前账单周期结束时生效。"
      ),
    },
    {
      q: T("Is the AI training on our code?", "AI 会用我们的代码训练吗?"),
      a: T(
        "No. We use the Anthropic API with training opt-out. Your code is not used to improve any model.",
        "不会。我们调用 Anthropic API 并已 opt-out 训练, 你的代码不会被用于改进任何模型。"
      ),
    },
    {
      q: T("What happens after the trial?", "试用结束后会发生什么?"),
      a: T(
        "You drop to Free unless you add a payment method. We never charge automatically without your card on file.",
        "若未添加支付方式, 你将自动转入 Free 套餐。我们绝不会在没有信用卡的情况下自动扣费。"
      ),
    },
  ];

  return (
    <div className="landing fade-in">
      <header className="lp-top">
        <div className="brand" onClick={() => go("landing")} style={{ cursor: "pointer" }}>
          <div className="brand-mark">PR</div>
          <span>Pullwise</span>
        </div>
        <nav className="lp-nav">
          <button className="btn ghost sm" onClick={() => go("landing")}>{T("Product", "产品")}</button>
          <button className="btn ghost sm" style={{ color: "var(--text)" }}>{T("Pricing", "定价")}</button>
          <button className="btn ghost sm" onClick={() => go("docs")}>{T("Docs", "文档")}</button>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => go("login")}>{T("Sign in", "登录")}</button>
          <button className="btn primary sm" onClick={() => go("login")}>{T("Get started", "开始使用")}</button>
        </div>
      </header>

      <section className="pricing-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: accent }}></span>
          <span>{T("Pricing", "定价")}</span>
        </div>
        <h1 className="lp-title">
          {T("Pay for the calm,", "为这份安心买单,")}<br/>
          <span className="lp-title-em">{T("not for every line of code.", "而不是每一行代码。")}</span>
        </h1>
        <p className="lp-sub">
          {T(
            "Simple per-workspace pricing. No seat tax, no surprise overages. Start free, upgrade when your team starts shipping daily.",
            "按工作区计费, 简单透明。不按席位收费, 不会有意外的超额账单。先免费上手, 团队开始每天 ship 时再升级。"
          )}
        </p>
        <div className="pricing-toggle" role="tablist">
          <button className={"seg-i" + (!annual ? " active" : "")} onClick={() => setAnnual(false)}>{T("Monthly", "按月")}</button>
          <button className={"seg-i" + (annual ? " active" : "")} onClick={() => setAnnual(true)}>
            {T("Annual", "按年")} <span className="pricing-save">{T("save 20%", "省 20%")}</span>
          </button>
        </div>
      </section>

      <section className="pricing-tiers">
        {tiers.map(t => (
          <div key={t.k} className={"pricing-card" + (t.featured ? " featured" : "")}>
            {t.badge && <span className="pricing-badge">{t.badge}</span>}
            <div className="pricing-card-h">
              <h3>{t.name}</h3>
              <p className="pricing-tag">{t.tag}</p>
            </div>
            <div className="pricing-price">
              {t.price === null ? (
                <div className="pricing-num"><span className="pricing-custom">{T("Custom", "定制")}</span></div>
              ) : t.price.m === 0 ? (
                <div className="pricing-num">$0<span className="pricing-per">{T("/forever", "/永久免费")}</span></div>
              ) : (
                <>
                  <div className="pricing-num">
                    <span className="pricing-cur">$</span>
                    {annual ? t.price.y : t.price.m}
                    <span className="pricing-per">{T("/mo", "/月")}</span>
                  </div>
                  <div className="pricing-billed">
                    {annual
                      ? T(`Billed annually · $${t.price.y * 12}/yr`, `按年支付 · $${t.price.y * 12}/年`)
                      : T("Billed monthly", "按月支付")}
                  </div>
                </>
              )}
            </div>
            <button
              className={"btn lg " + (t.featured ? "primary" : "")}
              style={{ width: "100%" }}
              onClick={() => go(t.k === "enterprise" ? "landing" : "login")}
            >
              {t.cta}
            </button>
            <ul className="pricing-feats">
              {t.features.map((f, i) => (
                <li key={i}><I.Check size={13} style={{ color: accent }} /> <span>{f}</span></li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="pricing-compare">
        <div className="pricing-compare-h">
          <h2>{T("Compare plans", "套餐详细对比")}</h2>
          <p>{T("Everything we ship, side by side.", "我们提供的所有能力, 一目了然。")}</p>
        </div>
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th></th>
                <th>Free</th>
                <th>Pro</th>
                <th>{T("Team", "团队版")}</th>
                <th>{T("Enterprise", "企业版")}</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((g, gi) => (
                <React.Fragment key={gi}>
                  <tr className="pricing-table-g"><td colSpan={5}>{g.g}</td></tr>
                  {g.rows.map((r, ri) => (
                    <tr key={ri}>
                      <td className="pricing-table-f">{r.f}</td>
                      {r.v.map((v, vi) => (
                        <td key={vi} className={v === "—" ? "pricing-na" : v === "✓" ? "pricing-ok" : ""}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pricing-faq">
        <h2>{T("Questions, answered", "常见问题")}</h2>
        <div className="pricing-faq-list">
          {faqs.map((f, i) => (
            <details key={i} className="pricing-faq-i" open={i === 0}>
              <summary>{f.q}<I.ArrowR size={13} /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-cta-band">
        <h2>{T("Try it on a real repo. Takes about a minute.", "在一个真实仓库上试一下, 大约一分钟。")}</h2>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn primary lg" onClick={() => go("login")}><I.Github /> {T("Sign in with GitHub","用 GitHub 登录")}</button>
          <button className="btn lg" onClick={() => go("dashboard")}>{T("View example dashboard", "查看示例 Dashboard")} <I.ArrowR size={14} /></button>
        </div>
      </section>

      <footer className="lp-foot">
        <div>© 2026 Pullwise</div>
        <div style={{ display: "flex", gap: 18 }}>
          <a className="legal-foot-l" onClick={() => go("privacy")}>{T("Privacy","隐私")}</a>
          <a className="legal-foot-l" onClick={() => go("terms")}>{T("Terms","条款")}</a>
          <a className="legal-foot-l" onClick={() => go("security")}>{T("Security","安全")}</a>
          <a className="legal-foot-l" onClick={() => go("status")}>{T("Status ●","状态 ●")}</a>
        </div>
      </footer>
    </div>
  );
}

// ── Docs ────────────────────────────────────────────
export function DocsScreen({ go, accent }) {
  useLang();
  const sections = [
    {
      id: "getting-started", t: T("Getting started", "入门"),
      items: [
        { id: "intro", t: T("Introduction", "介绍") },
        { id: "install", t: T("Connecting GitHub", "连接 GitHub") },
        { id: "first-scan", t: T("Your first scan", "第一次扫描") },
        { id: "reading", t: T("Reading findings", "阅读扫描结果") },
      ],
    },
    {
      id: "lenses", t: T("Lenses", "扫描维度"),
      items: [
        { id: "security", t: T("Security", "Security") },
        { id: "performance", t: T("Performance", "性能") },
        { id: "deps", t: T("Dependencies", "依赖") },
        { id: "arch", t: T("Architecture", "架构") },
      ],
    },
    {
      id: "workflows", t: T("Workflows", "工作流"),
      items: [
        { id: "autofix", t: T("Auto-fix patches", "Auto-fix 补丁") },
        { id: "prs", t: T("Creating PRs", "创建 PR") },
        { id: "slack", t: T("Slack & Linear", "Slack 与 Linear") },
      ],
    },
    {
      id: "api", t: T("API", "API"),
      items: [
        { id: "auth", t: T("Authentication", "认证") },
        { id: "scans-api", t: T("POST /v1/scans", "POST /v1/scans") },
        { id: "webhooks", t: T("Webhooks", "Webhooks") },
      ],
    },
  ];

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
          <button className="btn ghost sm" style={{ color: "var(--text)" }}>{T("Docs", "文档")}</button>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => go("login")}>{T("Sign in", "登录")}</button>
          <button className="btn primary sm" onClick={() => go("login")}>{T("Get started", "开始使用")}</button>
        </div>
      </header>

      <div className="docs-shell">
        <aside className="docs-side">
          <div className="docs-search">
            <I.Search size={13} />
            <input placeholder={T("Search docs…", "搜索文档…")} />
            <span className="kbd">⌘K</span>
          </div>
          {sections.map(s => (
            <div key={s.id} className="docs-side-g">
              <div className="docs-side-h">{s.t}</div>
              {s.items.map((it, i) => (
                <a key={it.id} className={"docs-side-i" + (s.id === "getting-started" && i === 0 ? " active" : "")} href={`#${it.id}`}>{it.t}</a>
              ))}
            </div>
          ))}
        </aside>

        <main className="docs-main">
          <div className="docs-crumbs">
            <span>{T("Docs", "文档")}</span>
            <span className="sep">/</span>
            <span>{T("Getting started", "入门")}</span>
            <span className="sep">/</span>
            <span className="now">{T("Introduction", "介绍")}</span>
          </div>

          <h1 className="docs-h1">{T("Introduction", "介绍")}</h1>
          <p className="docs-lede">
            {T(
              "Pullwise reads your repository the way a careful senior engineer would: across security, performance, dependencies, tests, documentation and architecture. This guide gets you to your first useful finding in under five minutes.",
              "Pullwise 以一位谨慎的资深工程师的方式阅读你的仓库: 跨安全、性能、依赖、测试、文档与架构。本指南帮你在 5 分钟内拿到第一个有用的扫描结果。"
            )}
          </p>

          <div className="docs-callout">
            <I.Lightbulb size={15} />
            <div>
              <b>{T("In a hurry?", "急于上手?")}</b>
              <p>{T("Skip to ", "直接跳到 ")}<a href="#first-scan">{T("Your first scan", "第一次扫描")}</a>{T(". Everything before is context.", ", 前面都是背景说明。")}</p>
            </div>
          </div>

          <h2 className="docs-h2" id="how-it-works">{T("How it works", "工作原理")}</h2>
          <p>
            {T(
              "After you authorize the GitHub App, Pullwise clones each selected repository to an ephemeral runner, builds an AST index, and runs six analysis lenses in parallel. Findings are merged, deduplicated, and ranked by severity × confidence.",
              "在你授权 GitHub App 后, Pullwise 会将选中的仓库克隆到临时 runner, 构建 AST 索引, 并并行运行 6 个分析 lens。扫描结果会合并去重, 并按 severity × confidence 排序。"
            )}
          </p>

          <ol className="docs-list">
            <li><b>{T("Clone", "克隆")}.</b> {T("Shallow clone, in-memory only. Discarded when the runner exits.", "浅克隆, 仅存在内存中, runner 退出后丢弃。")}</li>
            <li><b>{T("Index", "索引")}.</b> {T("Tree-sitter builds AST + symbol graph. Typical: ~3 s for 1k files.", "使用 tree-sitter 构建 AST 与符号图, 1k 文件约 3 秒。")}</li>
            <li><b>{T("Analyze", "分析")}.</b> {T("6 lenses run in parallel, with Claude haiku-4-5 doing semantic review.", "6 个 lens 并行运行, 由 Claude haiku-4-5 执行语义 review。")}</li>
            <li><b>{T("Rank", "排序")}.</b> {T("Findings scored. Auto-fixable patches generated for confidence ≥ 0.80.", "扫描结果评分, 对 confidence ≥ 0.80 的项目生成 auto-fix 补丁。")}</li>
          </ol>

          <h2 className="docs-h2" id="first-scan">{T("Your first scan", "第一次扫描")}</h2>
          <p>
            {T("Once GitHub is connected, trigger a scan from the CLI or the dashboard. The CLI is useful for one-offs and CI:", "连接 GitHub 后, 你可以从命令行或 dashboard 触发扫描。CLI 适合临时使用与 CI:")}
          </p>

          <div className="docs-code">
            <div className="docs-code-h">
              <span><I.Terminal size={11} /> bash</span>
              <button className="docs-code-copy"><I.Copy size={11} /> Copy</button>
            </div>
            <pre>{`# install\nbrew install pullwise/tap/pullwise\n\n# scan current repo\npullwise scan --repo . --branch main\n\n# wait for results, output JSON\npullwise scan --repo . --json > findings.json`}</pre>
          </div>

          <p>{T("A typical first run on a 50k-line TypeScript repo takes 60–90 seconds. The output looks like this:", "一个 50k 行 TypeScript 仓库的首次扫描约需 60-90 秒。输出示例如下:")}</p>

          <div className="docs-code">
            <div className="docs-code-h">
              <span><I.Terminal size={11} /> findings.json</span>
              <button className="docs-code-copy"><I.Copy size={11} /> Copy</button>
            </div>
            <pre>{`{\n  "scan_id": "sc_2k3a9f",\n  "repo": "yourname/billing-service",\n  "commit": "a3f9c2",\n  "duration_ms": 72148,\n  "summary": { "critical": 2, "high": 4, "medium": 12, "low": 9 },\n  "findings": [\n    {\n      "id": "f_001",\n      "severity": "critical",\n      "title": "Hardcoded API key in client bundle",\n      "file": "lib/payments.ts",\n      "line": 14,\n      "confidence": 0.97,\n      "auto_fixable": true\n    }\n  ]\n}`}</pre>
          </div>

          <h2 className="docs-h2" id="reading">{T("Reading a finding", "阅读一个 finding")}</h2>
          <p>{T("Each finding has four parts:", "每个 finding 包含 4 个部分:")}</p>
          <div className="docs-table">
            <div className="docs-table-r"><b>severity</b><span>{T("critical / high / medium / low. Determined by lens, not by user.", "critical / high / medium / low, 由 lens 决定, 不可手动修改。")}</span></div>
            <div className="docs-table-r"><b>confidence</b><span>{T("0–1. How sure the model is. Below 0.7 we mark it ‘review needed’.", "0–1, 表示模型的把握。低于 0.7 会标记为 'review needed'。")}</span></div>
            <div className="docs-table-r"><b>auto_fixable</b><span>{T("true if Pullwise has a patch ready. You still review it before merging.", "为 true 表示 Pullwise 已准备补丁。合并前仍需你 review。")}</span></div>
            <div className="docs-table-r"><b>references</b><span>{T("Links to OWASP, CWE, related code paths, and our own knowledge base.", "指向 OWASP、CWE、相关代码路径与我们的知识库的链接。")}</span></div>
          </div>

          <h2 className="docs-h2" id="next">{T("Next steps", "下一步")}</h2>
          <div className="docs-cards">
            <a className="docs-card" href="#lenses">
              <I.Shield size={16} style={{ color: accent }} />
              <div>
                <b>{T("Learn the lenses", "了解扫描维度")}</b>
                <p>{T("What each of the 6 lenses actually checks for.", "6 个 lens 各自检查什么。")}</p>
              </div>
            </a>
            <a className="docs-card" href="#autofix">
              <I.Sparkle size={16} style={{ color: accent }} />
              <div>
                <b>{T("Apply auto-fixes", "应用 auto-fix")}</b>
                <p>{T("Review and merge generated patches in two clicks.", "两步 review 并合并生成的补丁。")}</p>
              </div>
            </a>
            <a className="docs-card" href="#scans-api">
              <I.Code size={16} style={{ color: accent }} />
              <div>
                <b>{T("Use the API", "使用 API")}</b>
                <p>{T("POST /v1/scans, webhooks, and JSON output for CI.", "POST /v1/scans、webhook 与用于 CI 的 JSON 输出。")}</p>
              </div>
            </a>
          </div>

          <div className="docs-foot">
            <span className="muted">{T("Last updated", "最后更新")} · May 04, 2026</span>
            <div className="docs-foot-actions">
              <button className="btn sm ghost"><I.Edit size={11} /> {T("Edit on GitHub", "在 GitHub 上编辑")}</button>
              <button className="btn sm ghost"><I.MessageSquare size={11} /> {T("Send feedback", "反馈")}</button>
            </div>
          </div>
        </main>

        <aside className="docs-toc">
          <div className="docs-toc-h">{T("On this page", "本页内容")}</div>
          <a href="#how-it-works">{T("How it works", "工作原理")}</a>
          <a href="#first-scan">{T("Your first scan", "第一次扫描")}</a>
          <a href="#reading">{T("Reading a finding", "阅读一个 finding")}</a>
          <a href="#next">{T("Next steps", "下一步")}</a>
        </aside>
      </div>

      <footer className="lp-foot">
        <div>© 2026 Pullwise</div>
        <div style={{ display: "flex", gap: 18 }}>
          <a className="legal-foot-l" onClick={() => go("privacy")}>{T("Privacy","隐私")}</a>
          <a className="legal-foot-l" onClick={() => go("terms")}>{T("Terms","条款")}</a>
          <a className="legal-foot-l" onClick={() => go("security")}>{T("Security","安全")}</a>
          <a className="legal-foot-l" onClick={() => go("status")}>{T("Status ●","状态 ●")}</a>
        </div>
      </footer>
    </div>
  );
}
