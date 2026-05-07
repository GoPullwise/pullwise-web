import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

export function NotificationsScreen({ go }) {
  useLang();

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Pullwise", go: "dashboard" },
        { label: T("Notifications", "通知") },
      ]} />
      <div className="with-side">
        <Sidebar section="notifications" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Notifications", "通知")}</h1>
              <div className="sub">{T("0 unread · 0 total", "0 条未读 · 共 0 条")}</div>
            </div>
            <div className="actions">
              <button className="btn" disabled><I.Check size={13} /> {T("Mark all read", "全部标记为已读")}</button>
              <button className="btn" onClick={() => go("settings")}><I.Settings size={13} /> {T("Preferences", "通知偏好")}</button>
            </div>
          </div>

          <div className="notif-list">
            <div className="notif-empty card">
              <I.Bell size={26} style={{ color: "var(--text-3)" }} />
              <h3>{T("No notifications yet", "暂无通知")}</h3>
              <p>{T("Server notifications will appear here after they are created.", "server 创建通知后会显示在这里。")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
