import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { DOCS_GUIDE } from "../locales/docs-guide.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const SECTIONS = [
  {
    id: "sign-in",
    title: ["Sign in or create an account", "登录或创建账户"],
    text: [
      "Enter your email and verify the 6-digit code to sign in. Your first successful verification creates your account automatically; no password is needed. GitHub sign-in is also available. If you already use GitHub, sign in first and link an email from Settings to keep the same account and ledgers. A matching GitHub profile email never links or merges accounts.",
      "输入邮箱并验证 6 位验证码即可登录，首次验证成功会自动创建账户，无需密码。也可以使用 GitHub 登录。如果你已有 GitHub 登录账户，请先登录，再到设置中验证并绑定邮箱，以保留同一个账户和账本。GitHub 资料中的相同邮箱不会自动绑定或合并账户。",
    ],
  },
  {
    id: "connect",
    title: ["Create a project", "创建项目"],
    text: DOCS_GUIDE.projectSetup,
  },
  DOCS_GUIDE.projectSettings,
  {
    id: "categories",
    title: ["Create categories", "创建类别"],
    text: DOCS_GUIDE.categories,
  },
  {
    id: "expenses",
    title: ["Record expenses", "记录支出"],
    text: DOCS_GUIDE.expenses,
  },
  DOCS_GUIDE.recurring,
  {
    id: "max-assistance",
    title: ["Automatic Jev assistance", "Jev 自动辅助"],
    text: [
      "With the ledger Owner's effective Pro or Max plan, Jev automatically assists when you save an expense in the web app or REST API, while the model is available and within the ledger's allowance. Default monthly model allowances are $3 for Pro and $5 for Max; your displayed server-provided allowance applies. For new or edited ordinary expenses, select Automatic to leave the category blank, or choose a category yourself. Editing keeps the original category unless you choose Automatic or another category. Explicit category, project or shared target, amount and currency stay unchanged. If no category can be selected confidently, the expense is not saved; choose a category and retry. Recurring schedules always require an explicit category. Possible duplicates appear as advice after saving.",
      "账本所有者的 Pro 或 Max 权益有效、模型可用且账本额度允许时，Web 应用或 REST API 保存支出会自动使用 Jev 辅助。默认月度模型额度为 Pro 3 美元、Max 5 美元；实际以服务端提供并展示的额度为准。普通支出的新增和编辑都可主动选择“自动分类”以留空类别，也可自行选择类别。编辑默认保留原类别，除非你选择“自动分类”或其他类别。明确填写的类别、项目或公共池目标、金额和币种会保持不变。无法有把握地选出类别时，支出不会保存；请选择类别后重试。周期计划始终需要明确类别。疑似重复记录会在保存后以提示呈现。",
    ],
  },
  {
    id: "expense-review",
    title: ["Review saved expenses", "检查已保存支出"],
    text: [
      "In project expenses or the shared pool, open Expense review and select up to 10 expenses from the currently loaded filtered list. Opening the dialog does not run Jev; only Start review sends requests, one record at a time. Stop ends the remaining queue; requests already started may still consume allowance. Reviews share the ledger Owner's effective Pro or Max daily and monthly allowance. Model checks use predefined choices and any returned confidence scores; the interface uses fixed wording. Possible duplicates are checked locally, even when model checks are disabled or unavailable. Checks never change saved records. Edit reloads the current expense and opens its saved values without applying the results. Uncertain or unavailable checks do not mean a clear result.",
      "在项目支出或公共池中打开“账目巡检”，从当前已加载且经过筛选的列表中最多选择 10 笔支出。打开对话框不会运行 Jev，只有点击“开始巡检”才逐笔发送请求。“停止巡检”会结束剩余队列，已经发出的请求仍可能消耗额度。巡检共同使用账本所有者有效 Pro 或 Max 套餐的日度与月度额度。模型检查使用预定义选项及返回的置信评分，界面用固定文案展示；即使模型检查已停用或不可用，疑似重复仍可由本地规则检查。巡检不会修改已保存记录。点击编辑会重新读取该笔支出并打开当前保存值，不会套用巡检结果。不确定或不可用的检查不代表没有问题。",
    ],
  },
  {
    id: "reports",
    title: ["Review reports", "查看报表"],
    text: [
      "Filter detail and charts by date and category. Totals stay separate by currency; Pullwise does not convert currencies. All ledger members can read reports and export CSV; Owner, Admin and Editor can edit and remove entries.",
      "按日期和类别筛选明细及图表。总额按币种分开，Pullwise 不进行货币转换。账本成员可以查看报表和导出 CSV；Owner、Admin 和 Editor 可以修改和移除记录。",
    ],
  },
  DOCS_GUIDE.activity,
  {
    id: "keys",
    title: ["Use API keys", "使用 API 密钥"],
    text: DOCS_GUIDE.keys,
  },
  {
    id: "members",
    title: ["Share a ledger", "共享账本"],
    text: [
      "In Members, choose a role and create an invitation link without naming a recipient. Anyone signed in to a Pullwise account, including an email-only account, can request to join. Only the original inviter can approve or reject requests while their original permissions remain valid. Opening the link or sending a request grants no ledger access. Links expire after 24 hours and close when one person is approved. Legacy invitations to a specific GitHub account still check that identity. Owner manages Admins; Admin manages Editors and Viewers. Approved members can access existing and future ledger data according to their role and share the Owner's plan and allowances. Joining a ledger never grants GitHub repository access.",
      "在成员页面选择角色并生成邀请链接，无需指定接收人。任何已登录的 Pullwise 账户（包括仅使用邮箱的账户）都可以申请加入。只有原邀请人在原有权限仍有效时可以批准或拒绝申请。打开链接或提交申请不会授予账本访问权。链接 24 小时后失效，一人获批后即关闭。旧版指定 GitHub 账户的邀请仍校验该身份。Owner 管理 Admin，Admin 管理 Editor 和 Viewer。获批成员按角色访问当前及未来账本数据，共同使用 Owner 的套餐和额度。加入账本不会授予 GitHub 仓库访问权。",
    ],
    detail: DOCS_GUIDE.membersManagement,
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
          <h1 className="docs-h1">{T("Project expense ledger", "项目支出账本")}</h1>
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
              {section.detail && <p>{T(...section.detail)}</p>}
              {section.id === "keys" && (
                <a className="auth-link" href="/developers/api#quickstart">
                  {T(...DOCS_GUIDE.quickstartLink)}
                </a>
              )}
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
