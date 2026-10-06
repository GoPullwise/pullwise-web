import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const SECTIONS = [
  {
    id: "connect",
    title: ["Connect a repository", "连接仓库"],
    text: [
      "Sign in with GitHub and explicitly select up to 30 authorized repositories for a ledger project, with an optional project name. You can associate a GitHub Organization and later change the selected repositories without copying expenses or changing the project ID. GitHub access is checked for the acting member.",
      "通过 GitHub 登录，为有名称的账本项目明确选择最多 30 个已授权仓库，也可关联 GitHub Organization。之后更改仓库关联时不会复制支出，也不会改变项目 ID。GitHub 授权按当前操作成员检查。",
    ],
  },
  {
    id: "categories",
    title: ["Create categories", "创建类别"],
    text: [
      "Categories belong to the selected ledger and can be used for project or shared expenses. Owners and Admins manage categories; archived categories remain on historical entries.",
      "类别属于当前账本，可用于项目或公共池支出。Owner 和 Admin 可以管理类别，归档类别仍保留在历史记录中。",
    ],
  },
  {
    id: "expenses",
    title: ["Record expenses", "记录支出"],
    text: [
      "Choose a project or the shared pool, date, amount, currency, category and purpose. The shared pool is counted once in your account overview; it is not copied into every project.",
      "选择项目或公共池，并填写日期、金额、币种、类别和用途。公共池在账户总览中只计一次，不会复制到每个项目。",
    ],
  },
  {
    id: "max-assistance",
    title: ["Automatic Max assistance", "Max 自动辅助"],
    text: [
      "With Max, Jev automatically assists when you save an expense in the web app or REST API, while the model is available and within your monthly allowance. You can leave the category blank for reliable automatic categorization or choose one yourself. Your chosen category, project, amount and currency stay unchanged. If categorization is uncertain, choose a category to finish saving. Possible duplicates appear as advice after saving.",
      "Max 在模型可用且月度额度内，会在 Web 应用或 REST API 保存支出时自动启用 Jev 辅助。分类可留空交由可靠的自动分类，也可自行选择。你明确选择的分类、项目、金额和币种会保持不变。无法可靠分类时，选择分类后即可保存；疑似重复记录会在保存后以提示呈现。",
    ],
  },
  {
    id: "reports",
    title: ["Review reports", "查看报表"],
    text: [
      "Filter detail and charts by date and category. Totals stay separate by currency; Pullwise does not infer exchange rates. All ledger members can read reports and export its history; Owner, Admin and Editor can edit and remove entries.",
      "按日期和类别筛选明细及图表。总额按币种分开，Pullwise 不推断汇率。账本成员可以查看报表和导出历史记录；Owner、Admin 和 Editor 可以修改和移除记录。",
    ],
  },
  {
    id: "keys",
    title: ["Use API keys", "使用 API 密钥"],
    text: [
      "Create a key for the selected ledger with only the scopes you need. Restrict it to selected projects and explicitly allow the shared pool when required. Team keys cannot exceed your role and stop working when your membership revision changes. Revoking a key stops its access.",
      "为当前账本创建 API 密钥，只授予所需权限并限制到指定项目；需要公共池时应显式允许。团队密钥不能超出你的角色权限，成员权限版本变化后会失效。撤销密钥后将无法继续访问。",
    ],
  },
  {
    id: "members",
    title: ["Share a ledger", "共享账本"],
    text: [
      "Use Members to invite a GitHub user to your existing ledger, including its history and future entries. Invitations expire after 24 hours and require the intended GitHub account to accept. Owner manages Admins; Admin manages Editors and Viewers. Editors record expenses; Viewers read reports and export CSV. Use the header picker to switch ledgers. All members share the Owner's plan and allowances. Joining a ledger never grants GitHub organization or repository access.",
      "在成员页面邀请 GitHub 用户，共享现有账本的历史和后续记录。邀请 24 小时后失效，须由指定 GitHub 账户接受。Owner 管理 Admin，Admin 管理 Editor 和 Viewer。Editor 可以记账，Viewer 可以查看报表和导出 CSV。通过顶部选择器切换账本；所有成员共同使用 Owner 的套餐和额度。加入账本不会授予 GitHub 组织或仓库访问权。",
    ],
  },
];

export function DocsScreen({ go, auth }) {
  useLang();
  return (
    <div className="landing fade-in">
      <PublicHeader go={go} current="docs" auth={auth} />
      <div className="docs-shell">
        <aside className="docs-side">
          <div className="docs-side-g">
            <div className="docs-side-h">{T("Docs", "文档")}</div>
            {SECTIONS.map((section) => (
              <a key={section.id} className="docs-side-i" href={`#${section.id}`}>
                {T(...section.title)}
              </a>
            ))}
          </div>
        </aside>
        <main className="docs-main">
          <div className="docs-crumbs">
            <a className="auth-link" {...screenLinkProps(go, "landing")}>
              Pullwise
            </a>
            <span className="sep">/</span>
            <span className="now">{T("Docs", "文档")}</span>
          </div>
          <h1 className="docs-h1">{T("GitHub project expense ledger", "GitHub 项目支出账本")}</h1>
          <p className="docs-lede">
            {T(
              "Record project and shared costs, then review per-currency totals.",
              "记录项目及公共支出，查看逐币汇总。"
            )}
          </p>
          <div className="docs-callout">
            <I.Shield size={16} />
            <div>
              <b>{T("Your ledger", "你的账本")}</b>
              <p>
                {T(
                  "GitHub access controls new repository bindings. Existing history stays in the original ledger when repository access changes, with access governed by member roles.",
                  "GitHub 授权控制新仓库绑定；仓库权限变化后，已有账目历史仍保留在原账本，按成员角色开放访问。"
                )}
              </p>
            </div>
          </div>
          {SECTIONS.map((section) => (
            <section key={section.id} className="docs-section">
              <h2 id={section.id} className="docs-h2">
                {T(...section.title)}
              </h2>
              <p>{T(...section.text)}</p>
            </section>
          ))}
          <div className="docs-foot-actions">
            <a className="btn primary" {...screenLinkProps(go, "ledgerProjects")}>
              {T("Open projects", "打开项目")}
            </a>
            <a className="btn" {...screenLinkProps(go, "api")}>
              {T("API contract", "API 接口")}
            </a>
          </div>
        </main>
      </div>
      <PublicFooter go={go} current="docs" />
    </div>
  );
}
