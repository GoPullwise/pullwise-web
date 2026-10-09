import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { EmailSignIn } from "../components/email-sign-in.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { Sidebar, Topbar } from "../shell.jsx";
import { ConsoleLayout } from "../components/console-layout.jsx";

export function SettingsScreen({ go, onSessionUpdated, onOperationBusy }) {
  useLang();
  const [session, setSession] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const requestRef = useRef(0);
  const actionRef = useRef(false);
  const emailActionRef = useRef(false);
  const mountedRef = useRef(false);
  const loadControllerRef = useRef(null);
  const onOperationBusyRef = useRef(onOperationBusy);
  onOperationBusyRef.current = onOperationBusy;

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
      onOperationBusyRef.current?.(false);
    };
  }, [load]);

  const runGitHubAction = async (action, installationId = "") => {
    if (!mountedRef.current || actionRef.current || loading || loadControllerRef.current) return;
    if (onOperationBusyRef.current?.(true) === false) return;
    actionRef.current = true;
    setBusy(true);
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
      onOperationBusyRef.current?.(false);
      if (mountedRef.current) {
        setBusy(false);
        setManagingInstallationId("");
      }
    }
  };

  const reload = () => {
    if (!mountedRef.current || actionRef.current || loading || loadControllerRef.current) return;
    load();
  };
  const leaveSession = async () => {
    if (!mountedRef.current || actionRef.current || loading || loadControllerRef.current) return;
    if (onOperationBusyRef.current?.(true) === false) return;
    actionRef.current = true;
    setBusy(true);
    setError("");
    try {
      await signOut();
    } catch (failure) {
      if (mountedRef.current) setError(failure?.message || T("Request failed. Please retry."));
    } finally {
      actionRef.current = false;
      onOperationBusyRef.current?.(false);
      if (mountedRef.current) setBusy(false);
    }
  };
  const controlsDisabled = busy || loading;

  const emailBusy = (active) => {
    if (active) {
      if (!mountedRef.current || actionRef.current || loading || loadControllerRef.current)
        return false;
      if (onOperationBusyRef.current?.(true) === false) return false;
      actionRef.current = true;
      emailActionRef.current = true;
      setBusy(true);
      setError("");
      return true;
    }
    if (emailActionRef.current) {
      emailActionRef.current = false;
      actionRef.current = false;
      onOperationBusyRef.current?.(false);
      if (mountedRef.current) setBusy(false);
    }
  };
  const emailLinked = async (updatedSession) => {
    if (!session?.user?.id || updatedSession?.user?.id !== session.user.id) {
      throw new Error(
        T(
          "Email linking could not be confirmed for this account. Please retry.",
          "未能确认邮箱已绑定到此账户，请重试。"
        )
      );
    }
    await onSessionUpdated?.(updatedSession);
    if (mountedRef.current) setSession(updatedSession);
  };

  const github = integrations?.github;
  const githubReady = typeof github?.connected === "boolean";
  const user = session?.user;
  const emailProvider = Array.isArray(user?.providers) && user.providers.includes("email");
  const loginEmail = emailProvider && user?.emailVerified === true ? user.email : null;
  const canLinkEmail =
    session?.authenticated && user?.id && !emailProvider && user?.emailVerified !== true;
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
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Settings", "设置") }]}
        loading={loading || busy}
        navigationDisabled={busy}
      />
      <ConsoleLayout>
        <Sidebar section="settings" go={go} navigationDisabled={busy} />
        <main className="main">
          <div className="page-h">
            <div>
              <h1>{T("Settings", "设置")}</h1>
              <p className="sub">{T("Account and sign-in methods", "账户与登录方式")}</p>
            </div>
            <button className="btn" onClick={reload} disabled={controlsDisabled}>
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
                  <span className="email-sign-in-identity">
                    {user?.name || user?.login || user?.email || T("Account", "账户")}
                  </span>
                </div>
                {user?.email && (
                  <div className="set-row">
                    <I.Mail size={16} />
                    <span className="email-sign-in-identity">{user.email}</span>
                  </div>
                )}
                <button className="btn sm" onClick={leaveSession} disabled={controlsDisabled}>
                  {T("Sign out", "退出登录")}
                </button>
              </>
            ) : (
              !loading && <p>{T("Account profile unavailable.", "账户资料暂不可用。")}</p>
            )}
          </section>
          <section className="panel" aria-label={T("Sign-in methods", "登录方式")}>
            <h2>{T("Sign-in methods", "登录方式")}</h2>
            {loading && <p className="muted">{T("Loading...", "正在加载...")}</p>}
            {loginEmail ? (
              <>
                <div className="set-row">
                  <I.Mail size={16} />
                  <span className="email-sign-in-identity">{loginEmail}</span>
                  <span className="muted">{T("Verified email", "已验证邮箱")}</span>
                </div>
                <p className="muted">
                  {T("Use email codes to sign in to this account.", "使用邮箱验证码登录此账户。")}
                </p>
              </>
            ) : canLinkEmail ? (
              <>
                <p className="muted">
                  {T(
                    "Link an email to sign in with a code. Your existing account and ledgers stay together.",
                    "绑定邮箱后即可使用验证码登录，现有账户和账本保持不变。"
                  )}
                </p>
                <EmailSignIn
                  key={user.id}
                  purpose="link"
                  disabled={controlsDisabled && !emailActionRef.current}
                  onBusy={emailBusy}
                  onVerified={emailLinked}
                />
              </>
            ) : (
              !loading && (
                <p className="muted">
                  {T("Email sign-in information is unavailable.", "邮箱登录信息暂不可用。")}
                </p>
              )
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
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() => {
                        if (!actionRef.current) go("ledgerProjects");
                      }}
                    >
                      {T("Open projects", "打开项目")} <I.ArrowR size={14} />
                    </button>
                  )}
                  <button
                    className="btn sm"
                    disabled={controlsDisabled}
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
                  <fieldset
                    disabled={controlsDisabled}
                    aria-label={T("Authorized GitHub installations", "已授权 GitHub 安装")}
                    style={{ border: 0, padding: 0, margin: 0, minWidth: 0, color: "inherit" }}
                  >
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
                  </fieldset>
                )}
              </>
            )}
          </section>
        </main>
      </ConsoleLayout>
    </div>
  );
}
