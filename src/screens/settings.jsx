import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { Sidebar, Topbar } from "../shell.jsx";

export function SettingsScreen({ go }) {
  useLang();
  const [session, setSession] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const requestRef = useRef(0);
  const actionRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    const [sessionResult, integrationsResult] = await Promise.allSettled([
      pullwiseApi.auth.getSession(),
      pullwiseApi.integrations.list(),
    ]);
    if (requestId !== requestRef.current) return;
    setSession(sessionResult.status === "fulfilled" ? sessionResult.value : null);
    setIntegrations(integrationsResult.status === "fulfilled" ? integrationsResult.value : null);
    setError([sessionResult, integrationsResult]
      .filter(result => result.status === "rejected")
      .map(result => result.reason?.message || T("Account data unavailable.", "账户数据暂不可用。"))
      .join(" "));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => { requestRef.current += 1; };
  }, [load]);

  const runGitHubAction = async (action, installationId = "") => {
    if (actionRef.current) return;
    actionRef.current = true;
    setManagingInstallationId(installationId);
    setError("");
    try {
      await action();
      await load();
    } catch (failure) {
      setError(failure?.message || T("GitHub authorization failed.", "GitHub 授权失败。"));
    } finally {
      actionRef.current = false;
      setManagingInstallationId("");
    }
  };

  const github = integrations?.github;
  const user = session?.user;
  const accounts = Array.from(new Set([
    ...(Array.isArray(github?.installationAccounts) ? github.installationAccounts : []),
    github?.installationAccount,
  ].filter(Boolean)));
  const repositoryCount = Array.isArray(github?.repositories) ? github.repositories.length : 0;

  return <div className="app fade-in">
    <Topbar go={go} breadcrumbs={[{ label: T("Settings", "设置") }]} loading={loading} />
    <div className="with-side">
      <Sidebar section="settings" go={go} />
      <main className="main">
        <div className="page-h"><div><h1>{T("Settings", "设置")}</h1>
          <p className="sub">{T("Account and GitHub access", "账户与 GitHub 授权")}</p></div>
          <button className="btn" onClick={load} disabled={loading}>{T("Reload", "重新加载")}</button>
        </div>
        {error && <div className="settings-inline-error" role="alert">{error}</div>}
        <section className="card section" aria-label={T("Profile", "个人资料")}>
          <div className="section-h"><h2>{T("Profile", "个人资料")}</h2></div>
          {session ? <>
            <div className="set-row"><I.User size={18} /><span>{user?.name || user?.login || T("GitHub account", "GitHub 账户")}</span></div>
            {user?.email && <div className="set-row"><I.Mail size={16} /><span>{user.email}</span></div>}
            <button className="btn sm" onClick={signOut}>{T("Sign out", "退出登录")}</button>
          </> : !loading && <p>{T("Account profile unavailable.", "账户资料暂不可用。")}</p>}
        </section>
        <section className="card section" aria-label={T("GitHub access", "GitHub 授权")}>
          <div className="section-h"><h2>{T("GitHub access", "GitHub 授权")}</h2></div>
          <p className="muted">{github?.connected
            ? T(`${repositoryCount} repositories authorized${accounts.length ? ` on ${accounts.join(", ")}` : ""}.`,
              `已授权 ${repositoryCount} 个仓库${accounts.length ? `（${accounts.join("、")}）` : ""}。`)
            : T("Connect repositories to create ledger projects.",
              "连接仓库后可跟进 PR、CI 失败和上游版本更新。")}</p>
          <button className="btn sm" onClick={() => runGitHubAction(() =>
            connectGitHubRepositories(github?.connected ? { add: true } : {}))}>
            {github?.connected ? T("Add account or organization", "添加账户或组织")
              : T("Connect repositories", "连接仓库")}
          </button>
          {github?.connected && <GitHubInstallationsList
            installations={github.installations}
            managingInstallationId={managingInstallationId}
            onManage={installation => {
              const installationId = installation?.id || installation?.installationId;
              runGitHubAction(() => manageGitHubInstallation(installationId, {
                githubIdentityId: installation?.manage?.githubIdentityId || undefined,
                redirectTo: window.location.href,
              }), installationId);
            }} />}
        </section>
      </main>
    </div>
  </div>;
}
