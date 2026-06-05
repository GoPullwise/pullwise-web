import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { signOut } from "../lib/auth.js";
import { screenLinkProps } from "../lib/navigation.js";

const HEADER_NAV = [
  { key: "landing", labelEn: "Product", labelZh: "产品" },
  { key: "pricing", labelEn: "Pricing", labelZh: "价格" },
  { key: "api", labelEn: "API", labelZh: "API" },
  { key: "security", labelEn: "Security", labelZh: "安全" },
  { key: "status", labelEn: "Status", labelZh: "状态" },
];

const FOOTER_LINKS = [
  { key: "privacy", labelEn: "Privacy", labelZh: "隐私" },
  { key: "terms", labelEn: "Terms", labelZh: "条款" },
  { key: "security", labelEn: "Security", labelZh: "安全" },
  { key: "pricing", labelEn: "Pricing", labelZh: "价格" },
  { key: "api", labelEn: "API", labelZh: "API" },
  { key: "status", labelEn: "Status", labelZh: "状态" },
];

export function PublicHeader({ go, current, auth }) {
  useLang();
  const checkingSession = auth?.status === "checking";
  const signedIn = !checkingSession && Boolean(auth?.authenticated);

  return (
    <header className="lp-top">
      <a
        className="brand"
        aria-label="Go to Pullwise home"
        {...screenLinkProps(go, "landing")}
      >
        <img className="brand-mark" src="/favicon.ico" alt="" aria-hidden="true" width="24" height="24" />
        <span>Pullwise</span>
      </a>
      <nav className="lp-nav">
        {HEADER_NAV.map((item) => (
          <a
            key={item.key}
            className="btn ghost sm"
            {...screenLinkProps(go, item.key)}
            aria-current={current === item.key ? "page" : undefined}
          >
            {T(item.labelEn, item.labelZh)}
          </a>
        ))}
      </nav>
      <div style={{ display: "flex", gap: 8 }}>
        {checkingSession ? (
          <button className="btn sm" type="button" disabled>
            <span className="spin" style={{ display: "inline-block" }}>
              <I.Refresh size={14} />
            </span>
            {T("Checking session...", "检查会话...")}
          </button>
        ) : signedIn ? (
          <>
            <button className="btn sm" onClick={signOut}>
              {T("Sign out", "退出登录")}
            </button>
            <a className="btn primary sm" {...screenLinkProps(go, "dashboard")}>
              {T("Dashboard", "工作台")}
            </a>
          </>
        ) : (
          <>
            <a className="btn sm" {...screenLinkProps(go, "login")}>
              {T("Sign in", "登录")}
            </a>
            <a className="btn primary sm" {...screenLinkProps(go, "login")}>
              {T("Get started", "开始使用")}
            </a>
          </>
        )}
      </div>
    </header>
  );
}

export function PublicFooter({ go, current }) {
  useLang();
  return (
    <footer className="lp-foot">
      <div>Copyright 2026 Pullwise</div>
      <div style={{ display: "flex", gap: 18 }}>
        {FOOTER_LINKS.map((item) => (
          <a
            key={item.key}
            className="legal-foot-l"
            {...screenLinkProps(go, item.key)}
            style={{ color: current === item.key ? "var(--text)" : undefined }}
          >
            {T(item.labelEn, item.labelZh)}
          </a>
        ))}
      </div>
    </footer>
  );
}
