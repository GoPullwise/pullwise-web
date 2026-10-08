import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { Sidebar, Topbar } from "../shell.jsx";
import { ConsoleLayout } from "../components/console-layout.jsx";

export function SettingsScreen({ go }) {
  useLang();
  const [session, setSession] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const requestRef = useRef(0);
  const actionRef = useRef(false);
  const mountedRef = useRef(false);
  const loadControllerRef = useRef(null);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    const [sessionResult, integrationsResult] = await Promise.allSettled([
      pullwiseApi.auth.getSession({ signal: controller.signal }),
      pullwiseApi.integrations.list({ signal: controller.signal }),
    ]);
    if (controller.signal.aborted || requestId !== requestRef.current) return;
    if (loadControllerRef.current === controller) loadControllerRef.current = null;
    setSession(sessionResult.status === "fulfilled" ? sessionResult.value : null);
    setIntegrations(integrationsResult.status === "fulfilled" ? integrationsResult.value : null);
    setError(
      [sessionResult, integrationsResult]
        .filter((result) => result.status === "rejected")
        .map(
          (result) => result.reason?.message || T("Account data unavailable.", "账户数据暂不可用。")
        )
        .join(" ")
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
      loadControllerRef.current?.abort();
    };
  }, [load]);

  const runGitHubAction = async (action, installationId = "") => {
    if (actionRef.current) return;
    actionRef.current = true;
    setManagingInstallationId(installationId);
    setError("");
    try {
      await action();
      if (mountedRef.current) await load();
    } catch (failure) {
      if (mountedRef.current)
        setError(failure?.message || T("GitHub authorization failed.", "GitHub 授权失败。"));
    } finally {
      actionRef.current = false;
      if (mountedRef.current) setManagingInstallationId("");
    }
  };

  const github = integrations?.github;
  const githubReady = typeof github?.connected === "boolean";
  const user = session?.user;
  const accounts = Array.from(
    new Set(
      [
        ...(Array.isArray(github?.installationAccounts) ? github.installationAccounts : []),
        github?.installationAccount,
      ].filter(Boolean)
    )
  );
  const repositoryCount = Array.isArray(github?.repositories) ? github.repositories.length : 0;

  return (
    <div className="app fade-in settings-screen">
      <Topbar go={go} breadcrumbs={[{ label: T("Settings", "设置") }]} loading={loading} />
      <ConsoleLayout>
        <Sidebar section="settings" go={go} />
        <main className="main">
          <div className="page-h">
            <div>
              <h1>{T("Settings", "设置")}</h1>
              <p className="sub">{T("Account and GitHub access", "账户与 GitHub 授权")}</p>
            </div>
            <button className="btn" onClick={load} disabled={loading}>
              {T("Reload", "重新加载")}
            </button>
          </div>
          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          <section className="panel" aria-label={T("Profile", "个人资料")}>
            <h2>{T("Profile", "个人资料")}</h2>
            {session ? (
              <>
                <div className="set-row">
                  <I.User size={18} />
                  <span>{user?.name || user?.login || T("GitHub account", "GitHub 账户")}</span>
                </div>
                {user?.email && (
                  <div className="set-row">
                    <I.Mail size={16} />
                    <span>{user.email}</span>
                  </div>
                )}
                <button className="btn sm" onClick={signOut}>
                  {T("Sign out", "退出登录")}
                </button>
              </>
            ) : (
              !loading && <p>{T("Account profile unavailable.", "账户资料暂不可用。")}</p>
            )}
          </section>
          <section className="panel" aria-label={T("GitHub access", "GitHub 授权")}>
            <h2>{T("GitHub access", "GitHub 授权")}</h2>
            {!githubReady ? (
              <p className="muted">
                {loading
                  ? T("Loading...", "正在加载...")
                  : T("GitHub access unavailable.", {
                      zh: "GitHub 授权暂不可用。",
                      ja: "GitHub のアクセス情報を取得できません。",
                      ko: "GitHub 접근 정보를 불러올 수 없습니다.",
                      fr: "Les accès GitHub sont indisponibles.",
                      es: "El acceso a GitHub no está disponible.",
                    })}
              </p>
            ) : (
              <>
                <p className="muted">
                  {github?.connected
                    ? T(
                        `${repositoryCount} repositories authorized${accounts.length ? ` on ${accounts.join(", ")}` : ""}.`,
                        `已授权 ${repositoryCount} 个仓库${accounts.length ? `（${accounts.join("、")}）` : ""}。`
                      )
                    : T(
                        "Repository links are optional. Connect GitHub repositories to associate them with your projects.",
                        "仓库关联为可选项，你可以连接 GitHub 仓库并将其关联到项目。"
                      )}
                </p>
                <p className="github-next-step">
                  {T(
                    "Open Projects to create a named project and record expenses. You can add or change repository links later.",
                    "打开项目页面，为项目起名即可记账，仓库关联可在之后添加或修改。"
                  )}
                </p>
                <div className="panel-actions">
                  {github?.connected && (
                    <button className="btn primary" onClick={() => go("ledgerProjects")}>
                      {T("Open projects", "打开项目")} <I.ArrowR size={14} />
                    </button>
                  )}
                  <button
                    className="btn sm"
                    onClick={() =>
                      runGitHubAction(() =>
                        connectGitHubRepositories(github?.connected ? { add: true } : {})
                      )
                    }
                  >
                    {github?.connected
                      ? T("Add account or organization", "添加账户或组织")
                      : T("Connect repositories", "连接仓库")}
                  </button>
                </div>
                {github?.connected && (
                  <GitHubInstallationsList
                    installations={github.installations}
                    managingInstallationId={managingInstallationId}
                    onManage={(installation) => {
                      const installationId = installation?.id || installation?.installationId;
                      runGitHubAction(
                        () =>
                          manageGitHubInstallation(installationId, {
                            githubIdentityId: installation?.manage?.githubIdentityId || undefined,
                            redirectTo: window.location.href,
                          }),
                        installationId
                      );
                    }}
                  />
                )}
              </>
            )}
          </section>
        </main>
      </ConsoleLayout>
    </div>
  );
}
