import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const SECTIONS = [
  { id: "connect", title: ["Connect a repository", "连接仓库"], text: [
    "Sign in with GitHub, grant access to a repository, and create a project for it. A project belongs to your Pullwise account and follows the repository ID through renames.",
    "通过 GitHub 登录并授权仓库，再为其创建项目。项目属于你的 Pullwise 账户，仓库更名后仍按仓库 ID 关联。"] },
  { id: "categories", title: ["Create categories", "创建类别"], text: [
    "Categories belong to your account and can be used for project or shared expenses. Archived categories remain on historical entries.",
    "类别属于你的账户，可用于项目或公共池支出。归档类别仍保留在历史记录中。"] },
  { id: "expenses", title: ["Record expenses", "记录支出"], text: [
    "Choose a project or the shared pool, date, amount, currency, category and purpose. The shared pool is counted once in your account overview; it is not copied into every project.",
    "选择项目或公共池，并填写日期、金额、币种、类别和用途。公共池在账户总览中只计一次，不会复制到每个项目。"] },
  { id: "reports", title: ["Review reports", "查看报表"], text: [
    "Filter detail and charts by date and category. Totals stay separate by currency; Pullwise does not infer exchange rates. You can edit, remove and export your own historical entries.",
    "按日期和类别筛选明细及图表。总额按币种分开，Pullwise 不推断汇率。你可以修改、移除和导出自己的历史记录。"] },
  { id: "keys", title: ["Use API keys", "使用 API 密钥"], text: [
    "Create a key with only the ledger scopes you need. Restrict it to selected projects and explicitly allow the shared pool when required. Revoking a key stops its access.",
    "只授予 API 密钥所需的记账权限，并限制到指定项目；需要公共池时应显式允许。撤销密钥后将无法继续访问。"] },
];

export function DocsScreen({ go, auth }) {
  useLang();
  return <div className="landing fade-in"><PublicHeader go={go} current="docs" auth={auth} />
    <div className="docs-shell"><aside className="docs-side"><div className="docs-side-g">
      <div className="docs-side-h">{T("Docs", "文档")}</div>
      {SECTIONS.map(section => <a key={section.id} className="docs-side-i" href={`#${section.id}`}>{T(...section.title)}</a>)}
    </div></aside><main className="docs-main">
      <div className="docs-crumbs"><a className="auth-link" {...screenLinkProps(go, "landing")}>Pullwise</a>
        <span className="sep">/</span><span className="now">{T("Docs", "文档")}</span></div>
      <h1 className="docs-h1">{T("GitHub project expense ledger", "GitHub 项目支出账本")}</h1>
      <p className="docs-lede">{T("Record project and shared costs, then review per-currency totals.", "记录项目及公共支出，查看逐币汇总。")}</p>
      <div className="docs-callout"><I.Shield size={16} /><div><b>{T("Your ledger", "你的账本")}</b>
        <p>{T("GitHub access controls new repository bindings. Your existing ledger history stays with your account if repository access changes.",
          "GitHub 授权控制新仓库绑定；仓库权限变化后，已有账目历史仍归你的账户。")}</p></div></div>
      {SECTIONS.map(section => <section key={section.id} id={section.id} className="docs-section"><h2>{T(...section.title)}</h2><p>{T(...section.text)}</p></section>)}
      <div className="docs-foot-actions"><a className="btn primary" {...screenLinkProps(go, "ledgerProjects")}>{T("Open projects", "打开项目")}</a>
        <a className="btn" {...screenLinkProps(go, "api")}>{T("API contract", "API 接口")}</a></div>
    </main></div><PublicFooter go={go} current="docs" /></div>;
}
