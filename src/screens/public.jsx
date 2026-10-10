import { useEffect, useRef, useState } from "react";
import { I } from "../icons.jsx";
import { useErrorNotification } from "../components/notifications.jsx";
import { EmailSignIn } from "../components/email-sign-in.jsx";
import {
  GitHubAuthorizationGuidance,
  GitHubClosedNotice,
} from "../components/github-authorization-notice.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, signOut, startGitHubLogin } from "../lib/auth.js";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

export function GitHubOAuthFailureScreen({ code }) {
  useLang();
  const conflict = code === "GITHUB_IDENTITY_CONFLICT";
  return (
    <main id="main-content" tabIndex={-1} className="oauth-wrap fade-in">
      <div className="oauth-card">
        <div className="oauth-head">
          <div className="oauth-brand">Pullwise / GitHub</div>
          <h1>
            {T("GitHub connection was not completed", {
              zh: "GitHub 连接未完成",
              ja: "GitHub の接続は完了していません",
              ko: "GitHub 연결이 완료되지 않았습니다",
              fr: "La connexion GitHub n’a pas abouti",
              es: "La conexión con GitHub no se completó",
            })}
          </h1>
          <p className="oauth-org" role="alert">
            {conflict
              ? T("The selected GitHub account does not match the GitHub account linked to your current Pullwise account, or it is already linked to another Pullwise account.", {
                  zh: "所选 GitHub 账号与当前 Pullwise 账号已绑定的 GitHub 账号不一致，或已绑定另一个 Pullwise 账号。",
                  ja: "選択した GitHub アカウントは現在の Pullwise アカウントに連携済みのアカウントと一致しないか、別の Pullwise アカウントに連携されています。",
                  ko: "선택한 GitHub 계정이 현재 Pullwise 계정에 연결된 GitHub 계정과 다르거나, 다른 Pullwise 계정에 이미 연결되어 있습니다.",
                  fr: "Le compte GitHub choisi ne correspond pas à celui lié à votre compte Pullwise actuel, ou il est déjà lié à un autre compte Pullwise.",
                  es: "La cuenta de GitHub elegida no coincide con la vinculada a tu cuenta actual de Pullwise, o ya está vinculada a otra cuenta de Pullwise.",
                })
              : code === "ACCOUNT_CHANGED"
                ? T("Your Pullwise session changed during GitHub authorization. Return to Pullwise, check which account is signed in, and try again.", {
                  zh: "GitHub 授权期间，Pullwise 登录会话发生了变化。请返回 Pullwise，确认当前登录账号后重试。",
                  ja: "GitHub の認証中に Pullwise のセッションが変わりました。Pullwise に戻り、ログイン中のアカウントを確認して再試行してください。",
                  ko: "GitHub 인증 중 Pullwise 로그인 세션이 변경되었습니다. Pullwise로 돌아가 로그인된 계정을 확인하고 다시 시도하세요.",
                  fr: "Votre session Pullwise a changé pendant l’autorisation GitHub. Revenez à Pullwise, vérifiez le compte connecté et réessayez.",
                  es: "Tu sesión de Pullwise cambió durante la autorización de GitHub. Vuelve a Pullwise, comprueba qué cuenta está conectada e inténtalo de nuevo.",
                })
                : T("GitHub authorization could not be completed. Return to Pullwise and try again from Settings. If the problem continues, contact support.", {
                    zh: "GitHub 授权未能完成。请返回 Pullwise，从设置重新尝试。如果问题持续出现，请联系支持。",
                    ja: "GitHub の認証を完了できませんでした。Pullwise に戻り、設定から再試行してください。問題が続く場合はサポートにお問い合わせください。",
                    ko: "GitHub 인증을 완료하지 못했습니다. Pullwise로 돌아가 설정에서 다시 시도하세요. 문제가 계속되면 지원팀에 문의하세요.",
                    fr: "L’autorisation GitHub n’a pas abouti. Revenez à Pullwise et réessayez depuis les paramètres. Si le problème persiste, contactez l’assistance.",
                    es: "No se pudo completar la autorización de GitHub. Vuelve a Pullwise e inténtalo de nuevo desde Configuración. Si el problema continúa, contacta con soporte.",
                  })}
          </p>
        </div>
        <div className="oauth-orgs">
          {conflict && (
            <p className="oauth-org-p">
              {T("On GitHub, switch to the GitHub account associated with your current Pullwise account, then return to Settings and retry. Shared-ledger admins authorize their own GitHub accounts. If this GitHub account belongs to another Pullwise account, sign in to that Pullwise account instead.", {
                zh: "请在 GitHub 切换到当前 Pullwise 账号对应的 GitHub 账号，再返回设置重试。共享账本管理员应授权自己的 GitHub 账号。如果此 GitHub 账号属于另一个 Pullwise 账号，请登录对应的 Pullwise 账号。",
                ja: "GitHub で現在の Pullwise アカウントに対応するアカウントへ切り替え、設定に戻って再試行してください。共有台帳の管理者は自分の GitHub アカウントを認証します。この GitHub アカウントが別の Pullwise アカウントに属する場合は、そちらにログインしてください。",
                ko: "GitHub에서 현재 Pullwise 계정에 해당하는 계정으로 전환한 뒤 설정으로 돌아가 다시 시도하세요. 공유 장부 관리자는 자신의 GitHub 계정을 인증해야 합니다. 이 GitHub 계정이 다른 Pullwise 계정에 속한다면 해당 Pullwise 계정으로 로그인하세요.",
                fr: "Sur GitHub, choisissez le compte associé à votre compte Pullwise actuel, puis revenez aux paramètres pour réessayer. Les administrateurs d’un registre partagé autorisent leur propre compte GitHub. Si ce compte GitHub appartient à un autre compte Pullwise, connectez-vous à ce dernier.",
                es: "En GitHub, cambia a la cuenta asociada a tu cuenta actual de Pullwise y vuelve a Configuración para reintentarlo. Los administradores de un registro compartido autorizan sus propias cuentas de GitHub. Si esta cuenta de GitHub pertenece a otra cuenta de Pullwise, inicia sesión en esa cuenta.",
              })}
            </p>
          )}
          <p className="oauth-org-p">
            {T("You can close this window and return to Pullwise to try again.", {
              zh: "你可以关闭此窗口，返回 Pullwise 后重新尝试。",
              ja: "このウィンドウを閉じて Pullwise に戻り、再試行できます。",
              ko: "이 창을 닫고 Pullwise로 돌아가 다시 시도할 수 있습니다.",
              fr: "Vous pouvez fermer cette fenêtre et revenir à Pullwise pour réessayer.",
              es: "Puedes cerrar esta ventana y volver a Pullwise para intentarlo de nuevo.",
            })}
          </p>
        </div>
        <div className="oauth-actions">
          <a className="btn lg primary" href="/settings">
            <I.ArrowL size={14} /> {T("Settings", "设置")}
          </a>
          <a className="btn lg" href="/login">{T("Sign in", "登录")}</a>
        </div>
      </div>
    </main>
  );
}

function getAuthErrorMessage(error) {
  return (
    error?.message ||
    T("Sign-in is unavailable. Please try again later.", "登录暂不可用，请稍后重试。")
  );
}

function getRepositoryAuthErrorMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  if (code === "GITHUB_REAUTHORIZATION_REQUIRED")
    return T("Reconnect your GitHub account before checking repository access.");
  if (error?.status === 409 || message.includes("private or not publicly visible")) {
    return T(
      "Repository connection is currently unavailable for this GitHub account. Please contact Pullwise support.",
      "此 GitHub 账户暂时无法连接仓库，请联系 Pullwise 支持。"
    );
  }
  if (error?.status === 503 || message.includes("Unable to verify GitHub App")) {
    return T(
      "Pullwise could not verify repository access. Please try again later.",
      "Pullwise 暂时无法验证仓库访问权，请稍后重试。"
    );
  }
  if (
    code === "github_app_installation_not_completed" ||
    message.includes("github_app_installation_not_completed")
  ) {
    return T(
      "GitHub did not install the app. If you chose an organization, an organization owner may need to approve the request before repositories can be connected.",
      "GitHub 未完成 App 安装。如果你选择了组织，组织所有者可能需要先批准请求，然后才能连接仓库。"
    );
  }
  if (code === "missing_installation_id" || message.includes("missing_installation_id")) {
    return T(
      "GitHub connection did not complete. Please try connecting again.",
      "GitHub 连接未完成，请重新连接。"
    );
  }
  if (
    code === "github_app_api_unconfigured" ||
    message.includes("GitHub App API is not configured")
  ) {
    return T(
      "Pullwise could not load your connected repositories. Please try again later or contact support.",
      "Pullwise 暂时无法加载已连接的仓库，请稍后重试或联系支持。"
    );
  }
  if (message.includes("Contents: read")) {
    return T(
      "GitHub repository access is required to link a repository. Review the permissions in GitHub and try again.",
      "关联仓库需要 GitHub 仓库访问权，请在 GitHub 检查权限后重试。"
    );
  }
  return getAuthErrorMessage(error);
}

export function LandingScreen({ go, auth }) {
  useLang();
  const checkingSession = auth?.status === "checking";
  const signedIn = !checkingSession && Boolean(auth?.authenticated);
  const primaryActionTarget = signedIn ? "ledgerProjects" : "login";
  const primaryActionLabel = checkingSession
    ? T("Checking session...", "正在检查会话...")
    : signedIn
      ? T("Open projects", "打开项目")
      : T("Start with email", "使用邮箱开始");
  const primaryActionIcon = checkingSession ? (
    <span className="spin">
      <I.Refresh />
    </span>
  ) : signedIn ? (
    <I.Layout />
  ) : (
    <I.Mail />
  );
  return (
    <div className="landing fade-in">
      <PublicHeader go={go} current="landing" auth={auth} />
      <main id="main-content" tabIndex={-1}>
        <section className="lp-hero" aria-labelledby="lp-title">
          <div className="lp-eyebrow">
            <span>PULLWISE / 01</span>
            <span>
              {T(
                "Project expense tracking for developers and teams",
                "面向开发者与团队的项目支出账本"
              )}
            </span>
          </div>
          <h1 id="lp-title" className="lp-title">
            {T("Track project and shared expenses.", "记录项目与公共支出。")}
            <br />
            <span className="lp-title-em">
              {T("Keep every cost in view.", "让每笔成本清晰可见。")}
            </span>
          </h1>
          <p className="lp-sub">
            {T(
              "Record project and shared costs, review totals by currency, and share a ledger with your team. GitHub repository links are optional.",
              "记录项目与公共支出，按币种查看汇总，与团队共享账本。GitHub 仓库可按需关联。"
            )}
          </p>
          <div className="lp-cta">
            {checkingSession ? (
              <button className="btn primary lg" type="button" disabled>
                {primaryActionIcon} {primaryActionLabel}
              </button>
            ) : (
              <a className="btn primary lg" {...screenLinkProps(go, primaryActionTarget)}>
                {primaryActionIcon} {primaryActionLabel}
              </a>
            )}
            {!checkingSession && !signedIn && (
              <a className="btn lg" {...screenLinkProps(go, "pricing")}>
                {T("See pricing", "查看价格")}
              </a>
            )}
            {signedIn && (
              <button className="btn lg" onClick={signOut}>
                <I.ArrowL /> {T("Sign out", "退出登录")}
              </button>
            )}
          </div>
          <div className="lp-meta">
            <span>
              <I.Check size={12} /> {T("Named projects", "独立项目")}
            </span>
            <span>
              <I.Check size={12} /> {T("Shared expense pool", "公共支出池")}
            </span>
            <span>
              <I.Check size={12} /> {T("Date and category reports", "日期与类别报表")}
            </span>
            <span>
              <I.Check size={12} /> {T("Per-currency totals", "逐币汇总")}
            </span>
          </div>
        </section>

        <section className="lp-preview">
          <div className="lp-preview-card">
            <div className="lp-preview-bar">
              <span className="lp-preview-kicker">{T("WORKSPACE / PREVIEW", "工作台 / 预览")}</span>
              <div className="lp-preview-url">pull-wise.com / projects</div>
            </div>
            <div className="lp-preview-body">
              <div className="lp-preview-side">
                {[
                  T("Overview", "总览"),
                  T("Projects", "项目"),
                  T("Shared pool", "公共池"),
                  T("Categories", "类别"),
                ].map((item, index) => (
                  <div key={item} className={"lp-preview-side-i" + (index === 1 ? " active" : "")}>
                    {item}
                  </div>
                ))}
              </div>
              <div className="lp-preview-main">
                <div className="lp-preview-row">
                  <div className="lp-preview-stat">
                    <b>
                      <I.GitPull size={18} />
                    </b>
                    <span>{T("Projects", "项目")}</span>
                  </div>
                  <div className="lp-preview-stat">
                    <b>
                      <I.Layers size={18} />
                    </b>
                    <span>{T("Shared", "公共池")}</span>
                  </div>
                  <div className="lp-preview-stat">
                    <b className="lp-preview-stat-accent">
                      <I.Bug size={18} />
                    </b>
                    <span>{T("Categories", "类别")}</span>
                  </div>
                  <div className="lp-preview-stat">
                    <b>
                      <I.Shield size={18} />
                    </b>
                    <span>{T("Reports", "报表")}</span>
                  </div>
                </div>
                <div className="lp-preview-expenses">
                  <div className="lp-preview-expense">
                    <span className="sev sev-info">
                      <span className="dot lp-preview-status-dot" />
                      {T("saved", "已保存")}
                    </span>
                    <div className="lp-preview-expense-t">
                      {T(
                        "Every expense stays with its project or the shared pool.",
                        "每笔支出均归于一个项目或公共池。"
                      )}
                    </div>
                    <span className="lp-preview-expense-f">
                      {T("Project + shared costs", "项目 + 公共支出")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-capabilities" aria-labelledby="lp-capabilities-title">
          <div className="lp-section-head">
            <div className="lp-section-index">PROCESS / 02</div>
            <div>
              <h2 id="lp-capabilities-title">
                {T("How Pullwise organizes costs.", "Pullwise 如何整理成本。")}
              </h2>
              <p>
                {T(
                  "Create a project, record expenses, then use the same filters for detail and reports.",
                  "创建项目、记录支出，再用相同条件筛选明细和报表。"
                )}
              </p>
            </div>
          </div>
          <div className="lp-features">
            {[
              {
                i: <I.Layers />,
                h: T("Create projects", "创建项目"),
                p: T(
                  "Start with a project name. Optionally link up to 30 authorized GitHub repositories.",
                  "为项目起个名字即可开始，也可关联最多 30 个已授权 GitHub 仓库。"
                ),
              },
              {
                i: <I.Bug />,
                h: T("Record project expenses", "记录项目支出"),
                p: T(
                  "Save amount, currency, date, category and purpose for each project cost.",
                  "为每笔项目成本保存金额、币种、日期、类别和用途。"
                ),
              },
              {
                i: <I.Terminal />,
                h: T("Record shared expenses", "记录公共支出"),
                p: T(
                  "Keep costs used across projects in one shared pool, counted once.",
                  "跨项目支出放入公共池，只计一次。"
                ),
              },
              {
                i: <I.Shield />,
                h: T("Review category reports", "查看类别报表"),
                p: T("See where costs occur by category and date.", "按类别和日期查看成本分布。"),
              },
              {
                i: <I.FileCode />,
                h: T("Compare currencies separately", "逐币查看汇总"),
                p: T(
                  "View totals separately for each currency. Pullwise does not convert currencies.",
                  "按币种分别查看汇总，Pullwise 不进行货币转换。"
                ),
              },
              {
                i: <I.Code />,
                h: T("Control API access", "控制 API 访问"),
                p: T(
                  "Use scoped API keys with project and shared-pool restrictions.",
                  "使用受权限、项目和公共池限制的 API 密钥。"
                ),
              },
            ].map((feature, index) => (
              <article key={feature.h} className="lp-feat">
                <div className="lp-feat-top">
                  <span className="lp-feat-n">{String(index + 1).padStart(2, "0")}</span>
                  <div className="lp-feat-i">{feature.i}</div>
                </div>
                <h3>{feature.h}</h3>
                <p>{feature.p}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-cta-band" aria-labelledby="lp-cta-title">
          <div>
            <div className="lp-section-index">START / 03</div>
            <h2 id="lp-cta-title">
              {checkingSession
                ? T("Restoring your account.", "正在恢复你的账户。")
                : signedIn
                  ? T("Continue from your account.", "从你的账户继续。")
                  : T("Bring your project costs into view.", "让项目成本清晰可见。")}
            </h2>
          </div>
          {checkingSession ? (
            <button className="btn primary lg" type="button" disabled>
              {primaryActionIcon} {primaryActionLabel}
            </button>
          ) : (
            <a className="btn primary lg" {...screenLinkProps(go, primaryActionTarget)}>
              {primaryActionIcon} {primaryActionLabel}
            </a>
          )}
        </section>
      </main>
      <PublicFooter go={go} current="landing" />
    </div>
  );
}

export function LoginScreen({ go, onAuthenticated, onOperationBusy } = {}) {
  useLang();
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  useErrorNotification(error, {
    title: T("Sign in error", "Sign in error"),
    key: `login:${error}`,
  });
  const pending = Boolean(pendingAction);
  const loginAbortRef = useRef(null);
  const actionRef = useRef("");
  const onOperationBusyRef = useRef(onOperationBusy);
  onOperationBusyRef.current = onOperationBusy;

  const emailBusy = (active) => {
    if (active) {
      if (actionRef.current || onOperationBusyRef.current?.(true) === false) return false;
      actionRef.current = "email";
      setPendingAction("email");
      setError("");
      return true;
    }
    if (actionRef.current === "email") {
      actionRef.current = "";
      onOperationBusyRef.current?.(false);
      setPendingAction("");
    }
  };

  const handleGitHubLogin = async () => {
    if (actionRef.current || onOperationBusyRef.current?.(true) === false) return;
    actionRef.current = "github";
    const controller = new AbortController();
    loginAbortRef.current = controller;
    setPendingAction("github");
    setError("");

    try {
      await startGitHubLogin({ signal: controller.signal });
    } catch (authError) {
      if (controller.signal.aborted) return;
      setError(getAuthErrorMessage(authError));
      actionRef.current = "";
      onOperationBusyRef.current?.(false);
      setPendingAction("");
    }
  };

  useEffect(() => {
    return () => {
      if (loginAbortRef.current) loginAbortRef.current.abort();
      onOperationBusyRef.current?.(false);
    };
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className="auth-wrap fade-in">
      <a className="auth-back-home" {...screenLinkProps(go, "landing", {}, pending)}>
        <I.ArrowL size={14} /> {T("Back to home", "返回首页")}
      </a>
      <div className="auth-card">
        <div className="brand auth-brand">
          <img
            className="brand-mark"
            src="/brand-mark.png"
            alt=""
            aria-hidden="true"
            width="24"
            height="24"
          />
          <span className="auth-brand-name">Pullwise</span>
        </div>
        <h2 className="auth-title">{T("Sign in to Pullwise", "登录 Pullwise")}</h2>
        <p className="auth-sub">
          {T(
            "Use an email code to sign in or create your account. Repository links are optional.",
            "使用邮箱验证码登录或创建账户，仓库关联为可选项。"
          )}
        </p>

        <EmailSignIn
          disabled={pendingAction === "github"}
          onBusy={emailBusy}
          onVerified={onAuthenticated}
        />
        <p className="email-sign-in-alternative">
          {T("Or continue with GitHub", "或使用 GitHub 继续")}
        </p>
        <button
          className="btn lg auth-gh"
          type="button"
          disabled={pending}
          onClick={handleGitHubLogin}
        >
          {pendingAction === "github" ? (
            <>
              <span className="spin">
                <I.Refresh size={14} />
              </span>
              {T("Opening GitHub...", "正在打开 GitHub...")}
            </>
          ) : (
            <>
              <I.Github /> {T("Continue with GitHub", "使用 GitHub 继续")}
            </>
          )}
        </button>

        <div className="auth-next">
          <div className="auth-next-i">
            <span>1</span>
            <p>
              {T("Verify your email or use GitHub to sign in.", "验证邮箱或使用 GitHub 登录。")}
            </p>
          </div>
          <div className="auth-next-i">
            <span>2</span>
            <p>
              {T("Create a project and record your first expense.", "创建项目，记下第一笔支出。")}
            </p>
          </div>
        </div>
      </div>
      <div className="auth-legal">
        {T("By signing in you agree to our", "登录即表示你同意我们的")}{" "}
        <a {...screenLinkProps(go, "terms", {}, pending)}>{T("Terms of Service", "服务条款")}</a>{" "}
        {T("and", "和")}{" "}
        <a {...screenLinkProps(go, "privacy", {}, pending)}>{T("Privacy Policy", "隐私政策")}</a>.
      </div>
    </main>
  );
}
export function OAuthScreen({ go, auth }) {
  useLang();
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState("");
  const [githubClosedNotice, setGithubClosedNotice] = useState(null);
  const identity = auth?.session?.user?.id || "";
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const mountedRef = useRef(false);
  const actionRef = useRef(null);
  useEffect(() => {
    mountedRef.current = true;
    setAuthing(false);
    setError("");
    setGithubClosedNotice(null);
    return () => {
      mountedRef.current = false;
      actionRef.current?.controller.abort();
      actionRef.current = null;
    };
  }, [identity]);
  useErrorNotification(error, {
    title: T("Authorization error", "Authorization error"),
    key: `oauth:${error}`,
  });
  const backTarget = auth?.authenticated ? "ledgerProjects" : "login";

  const handleAuthorize = async () => {
    if (!mountedRef.current || actionRef.current) return;
    const operation = { identity, controller: new AbortController() };
    actionRef.current = operation;
    setAuthing(true);
    setError("");
    setGithubClosedNotice(null);
    const live = () =>
      mountedRef.current &&
      actionRef.current === operation &&
      identityRef.current === operation.identity &&
      !operation.controller.signal.aborted;

    try {
      const outcome = await connectGitHubRepositories({ signal: operation.controller.signal });
      if (!live()) return;
      if (outcome?.status === "closed_unverified")
        setGithubClosedNotice({ identity: operation.identity, outcome });
      else go("ledgerProjects");
    } catch (authError) {
      if (live()) setError(getRepositoryAuthErrorMessage(authError));
    } finally {
      if (actionRef.current === operation) {
        actionRef.current = null;
        if (mountedRef.current) setAuthing(false);
      }
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="oauth-wrap fade-in">
      <div className="oauth-card">
        <div className="oauth-head">
          <div className="oauth-logos">
            <div className="oauth-logo gh">
              <I.Github size={26} />
            </div>
            <div className="oauth-dots">
              <span />
              <span />
              <span />
            </div>
            <img
              className="oauth-logo app"
              src="/brand-mark.png"
              alt="Pullwise"
              width="48"
              height="48"
            />
          </div>
          <div className="oauth-brand">Pullwise / GitHub</div>
          <h1>{T("Link GitHub repositories to your projects", "为项目关联 GitHub 仓库")}</h1>
          <p className="oauth-org">
            {T(
              "Repository links are optional. Authorize the repositories you want to associate with your expense projects.",
              "仓库关联为可选项，授权你希望与支出项目关联的仓库。"
            )}
          </p>
          <ol className="oauth-steps">
            <li>
              <span>01</span>
              <div>
                <strong>{T("Choose your GitHub account", "选择 GitHub 账户")}</strong>
                <p>
                  {T(
                    "Your personal account or an organization you manage.",
                    "个人账户，或你管理的组织。"
                  )}
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>{T("Pick your repositories", "选择仓库")}</strong>
                <p>
                  {T("Give access to just the repositories you need.", "只授权你需要的仓库即可。")}
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>{T("Link repositories in Projects", "在项目页面关联仓库")}</strong>
                <p>
                  {T(
                    "Back in Pullwise, create or update a project and select its repositories.",
                    "回到 Pullwise，创建或编辑项目并选择关联仓库。"
                  )}
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="oauth-perms">
          <div className="oauth-perm-h">{T("What you are sharing", "会授权哪些信息")}</div>
          {[
            {
              i: <I.Folder size={15} />,
              h: T("Repository metadata", "仓库元数据"),
              p: T(
                "Read the names and basic details of repositories you choose.",
                "读取你所选仓库的名称和基本信息。"
              ),
            },
            {
              i: <I.FileCode size={15} />,
              h: T("Repository access", "仓库权限"),
              p: T(
                "Verify access to linked repositories. Ledger membership and GitHub access are managed separately.",
                "验证关联仓库的访问权，账本成员权限与 GitHub 授权分别管理。"
              ),
            },
          ].map((permission, index) => (
            <div key={index} className="oauth-perm">
              <div className="oauth-perm-i">{permission.i}</div>
              <div>
                <b>{permission.h}</b>
                <p>{permission.p}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="oauth-orgs">
          <div className="oauth-perm-h">{T("Repository access", "仓库访问")}</div>
          <div className="oauth-org-p">
            {T(
              "You can change your repository selection later in Settings. An organization owner may need to approve access.",
              "之后可以在设置中调整已选仓库。组织仓库可能需要组织所有者批准。"
            )}
          </div>
          <div className="oauth-org-p">
            <GitHubAuthorizationGuidance />
          </div>
          {githubClosedNotice && githubClosedNotice.identity === identity && (
            <div className="oauth-org-p">
              <GitHubClosedNotice outcome={githubClosedNotice.outcome} />
            </div>
          )}
        </div>

        <div className="oauth-actions">
          {authing ? (
            <button className="btn lg" type="button" disabled>
              <I.ArrowL size={14} /> {T("Back", "返回")}
            </button>
          ) : (
            <a className="btn lg" {...screenLinkProps(go, backTarget)}>
              <I.ArrowL size={14} /> {T("Back", "返回")}
            </a>
          )}
          <button
            className={"btn lg primary" + (authing ? " is-loading" : "")}
            disabled={authing}
            onClick={handleAuthorize}
          >
            {authing ? (
              <>
                <span className="spin">
                  <I.Refresh size={14} />
                </span>
                {T("Opening GitHub...", "正在打开 GitHub...")}
              </>
            ) : (
              <>
                {T("Connect GitHub repositories", "连接 GitHub 仓库")} <I.ArrowR size={14} />
              </>
            )}
          </button>
        </div>

        <div className="oauth-foot">
          <I.Lock size={12} />{" "}
          {T(
            "Login identity and repository authorization are separate.",
            "登录身份和仓库授权相互独立。"
          )}
        </div>
      </div>
    </main>
  );
}
