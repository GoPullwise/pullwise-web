import React from "react";
import { I } from "./icons.jsx";
import { T, useLang } from "./i18n.jsx";
import { screenLinkProps } from "./lib/navigation.js";

export function Topbar({ go, breadcrumbs, loading = false }) {
  useLang();

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <a
          className="brand topbar-brand-button"
          aria-label={T("Go to Pullwise home", "前往 Pullwise 首页")}
          {...screenLinkProps(go, "landing")}
        >
          <img
            className="brand-mark"
            src="/brand-mark.png"
            alt=""
            aria-hidden="true"
            width="24"
            height="24"
          />
          <span>Pullwise</span>
        </a>
        {breadcrumbs && (
          <nav className="crumbs" aria-label={T("Breadcrumbs", "面包屑")}>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <span className="sep">/</span>}
                {crumb.go && index !== breadcrumbs.length - 1 ? (
                  <a
                    className="crumb-button"
                    aria-label={T(`Go to ${crumb.label}`, `前往 ${crumb.label}`)}
                    {...screenLinkProps(go, crumb.go)}
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="crumb-button crumb-current" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {loading && (
          <span
            className="topbar-loading spin"
            role="status"
            aria-label={T("Loading", "正在加载")}
            title={T("Loading", "正在加载")}
          >
            <I.Refresh size={14} />
          </span>
        )}
        <a
          className="btn ghost sm"
          aria-label={T("Open account settings", "打开账户设置")}
          {...screenLinkProps(go, "settings")}
        >
          <I.User size={14} />
        </a>
      </div>
    </header>
  );
}

export function Sidebar({ go, section = "ledgerProjects" }) {
  useLang();
  return (
    <SidebarLinks
      section={section}
      go={go}
      items={[
        { k: "ledgerProjects", label: T("Projects", "项目"), icon: <I.GitBranch size={15} /> },
        { k: "ledgerShared", label: T("Shared pool", "公共支出池"), icon: <I.Package size={15} /> },
        { k: "ledgerCategories", label: T("Categories", "类别"), icon: <I.Layout size={15} /> },
        { k: "apiKeys", label: T("API Keys", "API Keys"), icon: <I.Code size={15} /> },
        { k: "billing", label: T("Billing", "支付"), icon: <I.Package size={15} /> },
        { k: "settings", label: T("Settings", "设置"), icon: <I.Settings size={15} /> },
      ]}
    />
  );
}

function SidebarLinks({ section, go, items }) {
  return (
    <aside className="side">
      <nav className="side-nav-landmark" aria-label={T("Navigation", "Navigation")}>
        <div className="side-group side-nav" aria-label={T("Navigation", "导航")}>
          <div className="side-h" style={{ marginTop: 6 }}>
            {T("Navigation", "导航")}
          </div>
          {items.map((item) => (
            <a
              key={item.k}
              className={"side-i" + (section === item.k ? " active" : "")}
              aria-current={section === item.k ? "page" : undefined}
              {...screenLinkProps(go, item.k)}
            >
              <div className="ic">{item.icon}</div>
              <span>{item.label}</span>
              {item.badge != null && <span className="badge">{item.badge}</span>}
            </a>
          ))}
        </div>
      </nav>
    </aside>
  );
}
