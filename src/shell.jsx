import React from "react";
import { I } from "./icons.jsx";
import { T, useLang } from "./i18n.jsx";
import { screenLinkProps } from "./lib/navigation.js";
import { useWorkspace } from "./components/workspace-context.jsx";
import { InvitationInboxButton } from "./components/invitation-inbox.jsx";

function ledgerLabel(workspace) {
  const ownership =
    workspace.role === "owner"
      ? T("Your ledger", "你的账本")
      : ["admin", "editor", "viewer"].includes(workspace.role)
        ? T("Shared ledger", "共享账本")
        : "";
  return ownership ? `${ownership} · ${workspace.name}` : workspace.name;
}

export function Topbar({ go, breadcrumbs, loading = false, navigationDisabled = false }) {
  useLang();
  const ledgers = useWorkspace();
  const headerRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const header = headerRef.current;
    const app = header?.closest(".app");
    if (!app) return;
    const measure = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      if (height > 0) app.style.setProperty("--workspace-header-height", `${height}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      app.style.removeProperty("--workspace-header-height");
    };
  }, []);

  return (
    <header className="topbar" ref={headerRef}>
      <div className="topbar-location">
        <a
          className="brand topbar-brand-button"
          aria-label={T("Go to Pullwise home", "前往 Pullwise 首页")}
          {...screenLinkProps(go, "landing", {}, navigationDisabled)}
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
                    {...screenLinkProps(go, crumb.go, {}, navigationDisabled)}
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
      <div className="topbar-actions">
        <InvitationInboxButton disabled={navigationDisabled} />
        {ledgers?.workspace && (
          <div className="workspace-picker">
            <select
              id="workspace-select"
              aria-label={T("Select ledger", "选择账本")}
              title={ledgerLabel(ledgers.workspace)}
              value={ledgers.workspace.id}
              disabled={navigationDisabled}
              onChange={(event) => {
                if (!navigationDisabled) ledgers.onSelect(event.target.value);
              }}
            >
              {ledgers.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {ledgerLabel(item)}
                </option>
              ))}
            </select>
          </div>
        )}
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
          {...screenLinkProps(go, "settings", {}, navigationDisabled)}
        >
          <I.User size={14} />
        </a>
      </div>
    </header>
  );
}

export function Sidebar({ go, section = "ledgerProjects", id, navigationDisabled = false }) {
  useLang();
  const ledger = [
    { k: "ledgerProjects", label: T("Projects", "项目"), icon: <I.GitBranch size={15} /> },
    { k: "ledgerShared", label: T("Shared pool", "公共支出池"), icon: <I.Package size={15} /> },
    { k: "ledgerCategories", label: T("Categories", "类别"), icon: <I.Layout size={15} /> },
  ];
  const account = [
    { k: "apiKeys", label: T("API Keys", "API Keys"), icon: <I.Code size={15} /> },
    { k: "ledgerMembers", label: T("Members", "成员"), icon: <I.User size={15} /> },
    { k: "billing", label: T("Billing", "账单"), icon: <I.Package size={15} /> },
    { k: "settings", label: T("Settings", "设置"), icon: <I.Settings size={15} /> },
  ];
  return (
    <aside className="side" id={id}>
      <nav className="side-nav-landmark" aria-label={T("Navigation", "导航")}>
        <div className="side-group side-nav" role="group" aria-label={T("Ledger", "账本")}>
          <div className="side-h">{T("Ledger", "账本")}</div>
          <SidebarLinks
            section={section}
            go={go}
            items={ledger}
            navigationDisabled={navigationDisabled}
          />
        </div>
        <div
          className="side-group side-account"
          role="group"
          aria-label={T("Account & tools", "账户与工具")}
        >
          <div className="side-h">{T("Account & tools", "账户与工具")}</div>
          <SidebarLinks
            section={section}
            go={go}
            items={account}
            navigationDisabled={navigationDisabled}
          />
        </div>
        <select
          className="side-compact"
          aria-label={T("Account & tools", "账户与工具")}
          value={account.some((item) => item.k === section) ? section : ""}
          disabled={navigationDisabled}
          onChange={(event) => {
            if (!navigationDisabled && event.target.value) go(event.target.value);
          }}
        >
          <option value="">{T("More", "更多")}</option>
          {account.map((item) => (
            <option key={item.k} value={item.k}>
              {item.label}
            </option>
          ))}
        </select>
      </nav>
    </aside>
  );
}

function SidebarLinks({ section, go, items, navigationDisabled }) {
  return (
    <>
      {items.map((item) => (
        <a
          key={item.k}
          className={"side-i" + (section === item.k ? " active" : "")}
          aria-current={section === item.k ? "page" : undefined}
          {...screenLinkProps(go, item.k, {}, navigationDisabled)}
        >
          <div className="ic">{item.icon}</div>
          <span>{item.label}</span>
          {item.badge != null && <span className="badge">{item.badge}</span>}
        </a>
      ))}
    </>
  );
}

export function ViewTabs({ id, label, tabs, value, onChange }) {
  const activate = (event, index) => {
    const keys = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(keys, event.key)) return;
    event.preventDefault();
    const next = tabs[keys[event.key]];
    onChange(next.key);
    document.getElementById(`${id}-tab-${next.key}`)?.focus();
  };
  return (
    <div className="view-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          id={`${id}-tab-${tab.key}`}
          aria-controls={`${id}-panel-${tab.key}`}
          aria-selected={value === tab.key}
          tabIndex={value === tab.key ? 0 : -1}
          onClick={() => onChange(tab.key)}
          onKeyDown={(event) => activate(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
