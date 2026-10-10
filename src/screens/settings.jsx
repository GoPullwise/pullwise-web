import { useCallback, useEffect, useId, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import {
  GitHubAuthorizationGuidance,
  GitHubClosedNotice,
} from "../components/github-authorization-notice.jsx";
import { EmailSignIn } from "../components/email-sign-in.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import {
  connectGitHubRepositories,
  manageGitHubInstallation,
  signOut,
  startGitHubLogin,
} from "../lib/auth.js";
import { Sidebar, Topbar } from "../shell.jsx";
import { ConsoleLayout } from "../components/console-layout.jsx";
import { EXPENSE_RETENTION_COPY } from "../locales/expense-retention.js";
import "./settings.css";

function retentionText(key) {
  return T(...EXPENSE_RETENTION_COPY[key]);
}

function githubIntegrationReady(value) {
  return (
    !value?.githubRefreshError &&
    typeof value?.github?.connected === "boolean" &&
    (value.githubAccess === undefined ||
      ["authorized", "not_connected", "lost"].includes(value.githubAccess))
  );
}

function validExpenseRetention(value) {
  return (
    value &&
    typeof value.autoRemoveOldestExpense === "boolean" &&
    Number.isSafeInteger(value.revision) &&
    value.revision > 0
  );
}

function validJevSettings(value) {
  return (
    value &&
    typeof value.enabled === "boolean" &&
    Number.isSafeInteger(value.revision) &&
    value.revision > 0 &&
    typeof value.eligible === "boolean" &&
    typeof value.available === "boolean" &&
    (!value.available || (value.eligible && value.enabled)) &&
    typeof value.monthlyBudgetUsd === "string" &&
    /^\d+(?:\.\d+)?$/.test(value.monthlyBudgetUsd)
  );
}

export function SettingsScreen({ go, onSessionUpdated, onOperationBusy }) {
  useLang();
  const jevDescriptionId = useId();
  const retentionDescriptionId = useId();
  const retentionSelectionId = useId();
  const [session, setSession] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [githubClosedNotice, setGithubClosedNotice] = useState(null);
  const [githubReconnectRequired, setGithubReconnectRequired] = useState(false);
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const [jevSettings, setJevSettings] = useState(null);
  const [jevReloadRequired, setJevReloadRequired] = useState(false);
  const [expenseRetention, setExpenseRetention] = useState(null);
  const [retentionReloadRequired, setRetentionReloadRequired] = useState(false);
  const requestRef = useRef(0);
  const actionRef = useRef(false);
  const emailActionRef = useRef(false);
  const mountedRef = useRef(false);
  const githubActionRef = useRef(null);
  const loadControllerRef = useRef(null);
  const jevOperationRef = useRef(null);
  const retentionOperationRef = useRef(null);
  const sessionRef = useRef(session);
  const jevRef = useRef(jevSettings);
  const jevSwitchRef = useRef(null);
  const jevDescriptionRef = useRef(null);
  const jevFocusRef = useRef(null);
  const retentionRef = useRef(expenseRetention);
  const retentionSwitchRef = useRef(null);
  const retentionDescriptionRef = useRef(null);
  const retentionFocusRef = useRef(null);
  sessionRef.current = session;
  jevRef.current = jevSettings;
  retentionRef.current = expenseRetention;
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
    setGithubClosedNotice(null);
    const [sessionResult, integrationsResult, jevResult, retentionResult] =
      await Promise.allSettled([
        pullwiseApi.auth.getSession({ signal: controller.signal }),
        pullwiseApi.integrations.list({ signal: controller.signal }),
        pullwiseApi.account.getJev({ signal: controller.signal }),
        pullwiseApi.account.getExpenseRetention({ signal: controller.signal }),
      ]);
    if (controller.signal.aborted || requestId !== requestRef.current) return;
    if (loadControllerRef.current === controller) loadControllerRef.current = null;
    setSession(sessionResult.status === "fulfilled" ? sessionResult.value : null);
    setIntegrations(integrationsResult.status === "fulfilled" ? integrationsResult.value : null);
    setGithubReconnectRequired(
      integrationsResult.status === "rejected"
        ? integrationsResult.reason?.code === "GITHUB_REAUTHORIZATION_REQUIRED"
        : integrationsResult.value?.githubAccess === "reauthorization_required"
    );
    const jevConfirmed =
      sessionResult.status === "fulfilled" &&
      sessionResult.value?.authenticated &&
      sessionResult.value?.user?.id &&
      jevResult.status === "fulfilled" &&
      validJevSettings(jevResult.value);
    setJevSettings(jevConfirmed ? jevResult.value : null);
    setJevReloadRequired(!jevConfirmed);
    const retentionConfirmed =
      sessionResult.status === "fulfilled" &&
      sessionResult.value?.authenticated &&
      sessionResult.value?.user?.id &&
      retentionResult.status === "fulfilled" &&
      validExpenseRetention(retentionResult.value);
    setExpenseRetention(retentionConfirmed ? retentionResult.value : null);
    setRetentionReloadRequired(!retentionConfirmed);
    setError(
      [sessionResult, integrationsResult]
        .filter((result) => result.status === "rejected")
        .map(
          (result) => result.reason?.message || T("Account data unavailable.", "账户数据暂不可用。")
        )
        .concat(
          jevConfirmed
            ? []
            : [
                T(
                  "Jev settings could not be loaded. Reload to try again.",
                  "无法读取 Jev 设置，请重新加载后重试。"
                ),
              ]
        )
        .concat(retentionConfirmed ? [] : [retentionText("loadFailed")])
        .concat(
          integrationsResult.status === "fulfilled" && integrationsResult.value?.githubRefreshError
            ? [
                integrationsResult.value.githubRefreshError.message ||
                  T("GitHub access unavailable."),
              ]
            : []
        )
        .join(" ")
    );
    setLoading(false);
    return {
      identity:
        sessionResult.status === "fulfilled" && sessionResult.value?.authenticated
          ? sessionResult.value.user?.id
          : null,
      githubReady:
        integrationsResult.status === "fulfilled" &&
        githubIntegrationReady(integrationsResult.value),
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      githubActionRef.current?.controller.abort();
      githubActionRef.current = null;
      requestRef.current += 1;
      loadControllerRef.current?.abort();
      jevOperationRef.current?.controller.abort();
      jevOperationRef.current = null;
      jevFocusRef.current = null;
      retentionOperationRef.current?.controller.abort();
      retentionOperationRef.current = null;
      retentionFocusRef.current = null;
      onOperationBusyRef.current?.(false);
    };
  }, [load]);

  const runGitHubAction = async (action, installationId = "") => {
    if (
      !mountedRef.current ||
      actionRef.current ||
      loading ||
      loadControllerRef.current ||
      !sessionRef.current?.authenticated ||
      !sessionRef.current?.user?.id
    )
      return;
    if (onOperationBusyRef.current?.(true) === false) return;
    const operation = {
      identity: sessionRef.current.user.id,
      controller: new AbortController(),
    };
    githubActionRef.current = operation;
    actionRef.current = true;
    setBusy(true);
    setManagingInstallationId(installationId);
    setError("");
    setGithubClosedNotice(null);
    const live = () =>
      mountedRef.current &&
      githubActionRef.current === operation &&
      sessionRef.current?.user?.id === operation.identity;
    try {
      const outcome = await action(operation.controller.signal);
      if (!live()) return;
      const refreshed = await load();
      if (
        live() &&
        refreshed?.identity === operation.identity &&
        refreshed.githubReady &&
        outcome?.status === "closed_unverified"
      )
        setGithubClosedNotice({ identity: operation.identity, outcome });
    } catch (failure) {
      if (live()) {
        if (failure?.code === "GITHUB_REAUTHORIZATION_REQUIRED")
          setGithubReconnectRequired(true);
        setError(
          failure?.code === "GITHUB_REAUTHORIZATION_REQUIRED"
            ? T("Reconnect your GitHub account before checking repository access.")
            : failure?.message || T("GitHub authorization failed.", "GitHub 授权失败。")
        );
      }
    } finally {
      if (githubActionRef.current === operation) {
        githubActionRef.current = null;
        actionRef.current = false;
        onOperationBusyRef.current?.(false);
        if (mountedRef.current) {
          setBusy(false);
          setManagingInstallationId("");
        }
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

  useEffect(() => {
    if (controlsDisabled || !jevFocusRef.current) return;
    const pending = jevFocusRef.current;
    jevFocusRef.current = null;
    if (session?.user?.id !== pending.identity) return;
    if (document.activeElement !== jevDescriptionRef.current) return;
    if (!jevReloadRequired && jevSettings?.eligible) jevSwitchRef.current?.focus();
  }, [controlsDisabled, jevReloadRequired, jevSettings, session]);

  useEffect(() => {
    if (controlsDisabled || !retentionFocusRef.current) return;
    const pending = retentionFocusRef.current;
    retentionFocusRef.current = null;
    if (session?.user?.id !== pending.identity) return;
    if (document.activeElement !== retentionDescriptionRef.current) return;
    if (!retentionReloadRequired && validExpenseRetention(expenseRetention))
      retentionSwitchRef.current?.focus();
  }, [controlsDisabled, retentionReloadRequired, expenseRetention, session]);

  const updateExpenseRetention = async (enabled) => {
    const current = retentionRef.current;
    const identity = sessionRef.current?.user?.id;
    if (
      !mountedRef.current ||
      actionRef.current ||
      loading ||
      loadControllerRef.current ||
      retentionReloadRequired ||
      !identity ||
      !sessionRef.current?.authenticated ||
      !validExpenseRetention(current) ||
      typeof enabled !== "boolean" ||
      enabled === current.autoRemoveOldestExpense
    )
      return;
    if (onOperationBusyRef.current?.(true) === false) return;
    const operation = {
      controller: new AbortController(),
      identity,
      requestId: requestRef.current,
    };
    retentionOperationRef.current = operation;
    actionRef.current = true;
    if (document.activeElement === retentionSwitchRef.current) {
      retentionFocusRef.current = { identity };
      retentionDescriptionRef.current?.focus();
    }
    setBusy(true);
    setError("");
    const live = () =>
      mountedRef.current &&
      retentionOperationRef.current === operation &&
      !operation.controller.signal.aborted &&
      requestRef.current === operation.requestId &&
      sessionRef.current?.user?.id === identity;
    let accepted = false;
    try {
      const confirmed = await pullwiseApi.account.updateExpenseRetention(
        current.revision,
        enabled,
        {
          signal: operation.controller.signal,
        }
      );
      if (!live()) return;
      if (
        !validExpenseRetention(confirmed) ||
        confirmed.autoRemoveOldestExpense !== enabled ||
        confirmed.revision !== current.revision + 1
      )
        throw new Error("Invalid expense retention response");
      accepted = true;
      setExpenseRetention(confirmed);
      const refreshed = await pullwiseApi.account.getExpenseRetention({
        signal: operation.controller.signal,
      });
      if (!live()) return;
      if (!validExpenseRetention(refreshed) || refreshed.revision < confirmed.revision)
        throw new Error("Invalid expense retention refresh");
      setExpenseRetention(refreshed);
      setRetentionReloadRequired(false);
    } catch (failure) {
      if (!live()) return;
      setRetentionReloadRequired(true);
      if (failure?.status === 401 || failure?.status === 403) setExpenseRetention(null);
      setError(
        retentionText(
          accepted ? "refreshFailed" : failure?.status === 412 ? "changed" : "saveFailed"
        )
      );
    } finally {
      if (retentionOperationRef.current === operation) {
        retentionOperationRef.current = null;
        actionRef.current = false;
        onOperationBusyRef.current?.(false);
        if (mountedRef.current) setBusy(false);
      }
    }
  };

  const updateJev = async (enabled) => {
    const current = jevRef.current;
    const identity = sessionRef.current?.user?.id;
    if (
      !mountedRef.current ||
      actionRef.current ||
      loading ||
      loadControllerRef.current ||
      jevReloadRequired ||
      !identity ||
      !sessionRef.current?.authenticated ||
      !validJevSettings(current) ||
      !current.eligible ||
      enabled === current.enabled ||
      typeof enabled !== "boolean"
    )
      return;
    if (onOperationBusyRef.current?.(true) === false) return;
    const operation = {
      controller: new AbortController(),
      identity,
      requestId: requestRef.current,
    };
    jevOperationRef.current = operation;
    actionRef.current = true;
    if (document.activeElement === jevSwitchRef.current) {
      jevFocusRef.current = { identity };
      jevDescriptionRef.current?.focus();
    }
    setBusy(true);
    setError("");
    const live = () =>
      mountedRef.current &&
      jevOperationRef.current === operation &&
      !operation.controller.signal.aborted &&
      requestRef.current === operation.requestId &&
      sessionRef.current?.user?.id === identity;
    let accepted = false;
    try {
      const confirmed = await pullwiseApi.account.updateJev(current.revision, enabled, {
        signal: operation.controller.signal,
      });
      if (!live()) return;
      if (
        !validJevSettings(confirmed) ||
        confirmed.enabled !== enabled ||
        confirmed.revision !== current.revision + 1
      )
        throw new Error("Invalid Jev preference response");
      accepted = true;
      setJevSettings(confirmed);
      const refreshed = await pullwiseApi.account.getJev({ signal: operation.controller.signal });
      if (!live()) return;
      if (!validJevSettings(refreshed) || refreshed.revision < confirmed.revision)
        throw new Error("Invalid Jev preference refresh");
      setJevSettings(refreshed);
      setJevReloadRequired(false);
    } catch (failure) {
      if (!live()) return;
      setJevReloadRequired(true);
      if (failure?.status === 401 || failure?.status === 403) setJevSettings(null);
      setError(
        accepted
          ? T(
              "Jev preference was saved, but current status could not be refreshed. Reload before changing it again.",
              "Jev 偏好已保存，但无法刷新当前状态。再次修改前请重新加载。"
            )
          : failure?.status === 412
            ? T(
                "Jev settings changed elsewhere. Reload and choose again.",
                "Jev 设置已在其他位置更改，请重新加载后再选择。"
              )
            : failure?.code === "JEV_PLAN_REQUIRED"
              ? T("Jev settings require Pro or Max.", "Jev 设置需要 Pro 或 Max 权益。")
              : T(
                  "Jev settings could not be saved. Reload before trying again.",
                  "无法保存 Jev 设置，请重新加载后再试。"
                )
      );
    } finally {
      if (jevOperationRef.current === operation) {
        jevOperationRef.current = null;
        actionRef.current = false;
        onOperationBusyRef.current?.(false);
        if (mountedRef.current) setBusy(false);
      }
    }
  };

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
  const user = session?.user;
  const canConnectGitHub = session?.authenticated && user?.id;
  const githubReady = canConnectGitHub && githubIntegrationReady(integrations);
  const githubProvider = Array.isArray(user?.providers) && user.providers.includes("github");
  const needsGitHubAccount =
    canConnectGitHub && Array.isArray(user?.providers) && !githubProvider;
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
        <main id="main-content" tabIndex={-1} className="main">
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
            {canConnectGitHub && (
              <div className="panel-actions">
                <button
                  className="btn sm"
                  disabled={controlsDisabled}
                  onClick={() =>
                    runGitHubAction((signal) =>
                      startGitHubLogin({ intent: "link", redirectTo: window.location.href, signal })
                    )
                  }
                >
                  <I.Github size={16} />{" "}
                  {githubProvider || githubReconnectRequired
                    ? T("Reconnect GitHub", "重新连接 GitHub")
                    : T("Connect GitHub account", {
                        zh: "连接 GitHub 账户",
                        ja: "GitHub アカウントを接続",
                        ko: "GitHub 계정 연결",
                        fr: "Connecter un compte GitHub",
                        es: "Conectar cuenta de GitHub",
                      })}
                </button>
              </div>
            )}
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
          <section className="panel settings-retention-panel" aria-label={retentionText("title")}>
            <h2>{retentionText("title")}</h2>
            <p className="muted">{retentionText("scope")}</p>
            <p
              className="muted"
              id={retentionDescriptionId}
              ref={retentionDescriptionRef}
              tabIndex={0}
            >
              {retentionText("description")}
            </p>
            <p className="muted" id={retentionSelectionId}>
              {retentionText("selection")}
            </p>
            <label
              className={`settings-retention-control${controlsDisabled || retentionReloadRequired || !expenseRetention ? " settings-retention-control-disabled" : ""}`}
            >
              <input
                ref={retentionSwitchRef}
                type="checkbox"
                role="switch"
                aria-describedby={`${retentionDescriptionId} ${retentionSelectionId}`}
                checked={expenseRetention?.autoRemoveOldestExpense === true}
                disabled={controlsDisabled || retentionReloadRequired || !expenseRetention}
                onChange={(event) => updateExpenseRetention(event.target.checked)}
              />
              <span>{retentionText("toggle")}</span>
            </label>
            {loading ? (
              <p className="muted">{T("Loading...", "正在加载...")}</p>
            ) : !expenseRetention ? (
              <p className="muted">{retentionText("unavailable")}</p>
            ) : (
              <p className="muted" aria-live="polite">
                {retentionText(expenseRetention.autoRemoveOldestExpense ? "on" : "off")}
              </p>
            )}
          </section>
          <section className="panel settings-jev-panel" aria-label={T("Jev settings", "Jev 设置")}>
            <h2>{T("Jev settings", "Jev 设置")}</h2>
            <p className="muted" id={jevDescriptionId} ref={jevDescriptionRef} tabIndex={0}>
              {T(
                "Controls Jev for your own ledger and its shared members. Other owners control their own ledgers.",
                "此设置控制你自己的账本及其共享成员使用 Jev；其他所有者自行控制各自的账本。"
              )}
            </p>
            <label
              className={`settings-jev-control${controlsDisabled || jevReloadRequired || !jevSettings?.eligible ? " settings-jev-control-disabled" : ""}`}
            >
              <input
                ref={jevSwitchRef}
                type="checkbox"
                role="switch"
                aria-describedby={jevDescriptionId}
                checked={jevSettings?.eligible === true && jevSettings.enabled === true}
                disabled={controlsDisabled || jevReloadRequired || !jevSettings?.eligible}
                onChange={(event) => updateJev(event.target.checked)}
              />
              <span>{T("Enable Jev", "启用 Jev")}</span>
            </label>
            {loading ? (
              <p className="muted">{T("Loading...", "正在加载...")}</p>
            ) : !jevSettings ? (
              <p className="muted">
                {T(
                  "Jev settings are unavailable until reloaded.",
                  "重新加载成功后才能使用 Jev 设置。"
                )}
              </p>
            ) : !jevSettings.eligible ? (
              <>
                <p className="muted">
                  {T("Jev settings require Pro or Max.", "Jev 设置需要 Pro 或 Max 权益。")}
                </p>
                <button
                  className="btn sm"
                  disabled={controlsDisabled}
                  onClick={() => {
                    if (!actionRef.current) go("pricing");
                  }}
                >
                  {T("View plans", "查看套餐")}
                </button>
              </>
            ) : (
              <>
                <p className="muted" role="status">
                  {!jevSettings.enabled
                    ? T(
                        "Jev model checks are off. Local duplicate checks remain available.",
                        "Jev 模型检查已关闭，仍可使用本地疑似重复检查。"
                      )
                    : jevSettings.available
                      ? T(
                          "Jev model choices and scores are enabled.",
                          "已启用 Jev 模型选项和评分。"
                        )
                      : T(
                          "Jev is currently unavailable. Your saved preference is on.",
                          "Jev 当前暂不可用，你保存的偏好仍为开启。"
                        )}
                </p>
                <p className="muted settings-jev-budget">
                  {T("Monthly model allowance (USD)", "月度模型额度（美元）")}:{" "}
                  {jevSettings.monthlyBudgetUsd}
                </p>
              </>
            )}
            <p className="muted">
              {T(
                "Turning Jev off stops model checks without changing saved expenses or resetting used allowance.",
                "关闭 Jev 会停止模型检查，不会修改已保存的支出，也不会重置已使用的额度。"
              )}
            </p>
          </section>
          <section className="panel" aria-label={T("GitHub access", "GitHub 授权")}>
            <h2>{T("GitHub access", "GitHub 授权")}</h2>
            {canConnectGitHub && githubReconnectRequired ? (
              <p className="muted">
                {T("Reconnect GitHub in Sign-in methods, then check repository access again.", {
                  zh: "请先在「登录方式」中重新连接 GitHub，再检查仓库授权。",
                  ja: "ログイン方法で GitHub に再接続してから、リポジトリへのアクセスを確認してください。",
                  ko: "로그인 방식에서 GitHub를 다시 연결한 뒤 저장소 접근 권한을 확인하세요.",
                  fr: "Reconnectez GitHub dans les méthodes de connexion, puis vérifiez à nouveau l’accès aux dépôts.",
                  es: "Vuelve a conectar GitHub en los métodos de inicio de sesión y comprueba de nuevo el acceso a los repositorios.",
                })}
              </p>
            ) : !githubReady ? (
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
            ) : needsGitHubAccount ? (
              <p className="muted">
                {T("Connect your GitHub account in Sign-in methods before authorizing repositories.", {
                  zh: "请先在「登录方式」中连接 GitHub 账户，再授权仓库。",
                  ja: "リポジトリを認可する前に、ログイン方法で GitHub アカウントを接続してください。",
                  ko: "저장소를 승인하기 전에 로그인 방식에서 GitHub 계정을 연결하세요.",
                  fr: "Connectez votre compte GitHub dans les méthodes de connexion avant d’autoriser des dépôts.",
                  es: "Conecta tu cuenta de GitHub en los métodos de inicio de sesión antes de autorizar repositorios.",
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
                <GitHubAuthorizationGuidance />
                {githubClosedNotice && githubClosedNotice.identity === user?.id && (
                  <GitHubClosedNotice outcome={githubClosedNotice.outcome} />
                )}
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
                    className="github-installations-fieldset"
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
