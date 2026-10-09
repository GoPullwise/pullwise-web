import { useEffect, useRef, useState } from "react";
import { I } from "../icons.jsx";
import { useErrorNotification } from "../components/notifications.jsx";
import { EmailSignIn } from "../components/email-sign-in.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, signOut, startGitHubLogin } from "../lib/auth.js";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

function getAuthErrorMessage(error) {
  return (
    error?.message ||
    T("Sign-in is unavailable. Please try again later.", "登录暂不可用，请稍后重试。")
  );
}

function getRepositoryAuthErrorMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
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
                  <b style={{ color: "var(--accent)" }}>
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
                    <span className="dot" style={{ background: "currentColor" }} />
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
                <div className="lp-feat-i" style={{ color: "var(--accent)" }}>
                  {feature.i}
                </div>
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
    <div className="auth-wrap fade-in">
      <a className="auth-back-home" {...screenLinkProps(go, "landing", {}, pending)}>
        <I.ArrowL size={14} /> {T("Back to home", "返回首页")}
      </a>
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
          <img
            className="brand-mark"
            src="/brand-mark.png"
            alt=""
            aria-hidden="true"
            width="24"
            height="24"
          />
          <span style={{ fontSize: "var(--fs-2xl)" }}>Pullwise</span>
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
    </div>
  );
}
export function OAuthScreen({ go, auth }) {
  useLang();
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState("");
  useErrorNotification(error, {
    title: T("Authorization error", "Authorization error"),
    key: `oauth:${error}`,
  });
  const backTarget = auth?.authenticated ? "ledgerProjects" : "login";

  const handleAuthorize = async () => {
    setAuthing(true);
    setError("");

    try {
      await connectGitHubRepositories();
      go("ledgerProjects");
    } catch (authError) {
      if (authError?.code === "popup_closed") {
        setError(
          T("GitHub installation was cancelled. Please try again.", "GitHub 安装已取消。请重试。")
        );
      } else {
        setError(getRepositoryAuthErrorMessage(authError));
      }
      setAuthing(false);
    }
  };

  return (
    <div className="oauth-wrap fade-in">
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
    </div>
  );
}
