import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const SECTIONS = [
  {
    id: "connect",
    title: ["Connect and configure", "连接并配置"],
    text: [
      "Sign in with GitHub, connect authorized repositories, then enable the PR and CI services you need. Create update watches for the upstream projects you follow.",
      "使用 GitHub 登录并连接已授权仓库，再启用所需的 PR 和 CI 服务。为关注的上游项目创建更新关注。",
    ],
  },
  {
    id: "pr",
    title: ["Pull request actions", "拉取请求待办"],
    text: [
      "The PR view groups saved source facts and action items. Open an item to inspect its evidence, source link, assessment and handling history.",
      "PR 视图汇集已保存的来源事实与待办事项。打开事项可查看证据、来源链接、判断和处理历史。",
    ],
  },
  {
    id: "ci",
    title: ["CI failures", "CI 失败"],
    text: [
      "Use the CI view to compare failed runs by stage and symptom. A later success is shown as recovery only when the server has verified the corresponding run relationship.",
      "使用 CI 视图按阶段和症状比较失败运行。只有服务端核验了对应运行关系，后续成功才会显示为恢复。",
    ],
  },
  {
    id: "updates",
    title: ["Upstream updates", "上游更新"],
    text: [
      "Use watches to follow public upstream releases. The Updates view keeps release rows visible even when no action item has been classified, and links available signals to saved evidence.",
      "通过关注跟进公开上游项目的版本发布。即使尚未分类出待办事项，更新视图仍显示版本行，并将可用信号关联到已保存证据。",
    ],
  },
  {
    id: "handling",
    title: ["Evidence and handling", "证据与处理"],
    text: [
      "Mark an item done or dismissed, assign a follow-up owner, and review its saved history. These handling actions update Pullwise only; they do not change GitHub content.",
      "标记事项为已完成或不跟进、分配处理人，并查看已保存的历史。这些处理操作只更新 Pullwise，不修改 GitHub 内容。",
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
            {SECTIONS.map(section => <a key={section.id} className="docs-side-i" href={`#${section.id}`}>
              {T(...section.title)}
            </a>)}
          </div>
        </aside>
        <main className="docs-main">
          <div className="docs-crumbs">
            <a className="auth-link" {...screenLinkProps(go, "landing")}>Pullwise</a>
            <span className="sep">/</span>
            <span className="now">{T("Docs", "文档")}</span>
          </div>
          <h1 className="docs-h1">{T("Configure PR, CI, and Updates", "配置 PR、CI 与更新服务")}</h1>
          <p className="docs-lede">{T(
            "Pullwise organizes saved GitHub facts, evidence, and team handling across pull requests, CI failures, and upstream releases.",
            "Pullwise 将拉取请求、CI 失败与上游版本发布的已保存 GitHub 事实、证据和团队处理记录汇集在一起。"
          )}</p>
          <div className="docs-callout">
            <I.Shield size={16} />
            <div>
              <b>{T("Reading is safe", "浏览不会启动处理")}</b>
              <p>{T(
                "Browser reads do not start intelligent processing or increase processing usage.",
                "浏览器读取不会启动智能处理，也不会增加处理用量。"
              )}</p>
            </div>
          </div>
          {SECTIONS.map(section => <section key={section.id} id={section.id} className="docs-section">
            <h2>{T(...section.title)}</h2>
            <p>{T(...section.text)}</p>
          </section>)}
          <div className="docs-foot-actions">
            <a className="btn primary" {...screenLinkProps(go, "services")}>
              {T("Configure services", "配置服务")}
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
