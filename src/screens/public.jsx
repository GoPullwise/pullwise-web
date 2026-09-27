import { useEffect, useRef, useState } from "react";
import { I } from "../icons.jsx";
import { useErrorNotification } from "../components/notifications.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, signOut, startGitHubLogin } from "../lib/auth.js";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

function getAuthErrorMessage(error) {
  return (
    error?.message ||
    T(
      "Authentication is unavailable. Check the backend auth service.",
      "认证不可用。请检查后端认证服务。"
    )
  );
}

function getRepositoryAuthErrorMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  if (error?.status === 409 || message.includes("private or not publicly visible")) {
    return T(
      "This GitHub App is owner-only right now. Make the GitHub App Public / Any account so users can install it on their own account or organization, then try again.",
      "此 GitHub App 当前仅所有者可安装。请将 GitHub App 设为公开（任何账户），以便用户可在自己的账户或组织中安装后再试。"
    );
  }
  if (error?.status === 503 || message.includes("Unable to verify GitHub App")) {
    return T(
      "Pullwise could not verify this GitHub App is public. Try again after GitHub API access is available.",
      "Pullwise 无法验证此 GitHub App 是否公开。请在 GitHub API 可用后再试。"
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
      "GitHub returned without an installation id. Check that the GitHub App setup URL points to the Pullwise backend callback, then try installing the app again.",
      "GitHub 返回时未携带 installation id。请检查 GitHub App 设置 URL 是否指向 Pullwise 后端回调，然后再试安装。"
    );
  }
  if (
    code === "github_app_api_unconfigured" ||
    message.includes("GitHub App API is not configured")
  ) {
    return T(
      "Pullwise found the GitHub App installation, but the backend cannot sync repositories because the GitHub App private key is missing or invalid. Set PULLWISE_GITHUB_APP_ID plus PULLWISE_GITHUB_APP_PRIVATE_KEY_PATH or PULLWISE_GITHUB_APP_PRIVATE_KEY_BASE64, then restart the backend.",
      "Pullwise 已找到 GitHub App 安装，但后端无法同步仓库，因为 GitHub App 私钥缺失或无效。请设置 PULLWISE_GITHUB_APP_ID 和 PULLWISE_GITHUB_APP_PRIVATE_KEY_PATH 或 PULLWISE_GITHUB_APP_PRIVATE_KEY_BASE64，然后重启后端。"
    );
  }
  if (message.includes("Contents: read")) {
    return T(
      "The GitHub App needs the repository access required to read PR, CI, and release facts. Check its permissions and try again.",
      "GitHub App 需要读取 PR、CI 和版本发布事实所需的仓库权限。请检查权限后重试。"
    );
  }
  return getAuthErrorMessage(error);
}

export function LandingScreen({ go, auth }) {
  useLang();
  const checkingSession = auth?.status === "checking";
  const signedIn = !checkingSession && Boolean(auth?.authenticated);
  const primaryActionTarget = signedIn ? "dashboard" : "login";
  const primaryActionLabel = checkingSession
    ? T("Checking session...", "正在检查会话...")
    : signedIn
      ? T("Open dashboard", "打开工作台")
      : T("Sign in with GitHub", "使用 GitHub 登录");
  const primaryActionIcon = checkingSession ? (
    <span className="spin">
      <I.Refresh />
    </span>
  ) : signedIn ? (
    <I.Layout />
  ) : (
    <I.Github />
  );
  return (
    <div className="landing fade-in">
      <PublicHeader go={go} current="landing" auth={auth} />

      <section className="lp-hero" aria-labelledby="lp-title">
        <div className="lp-eyebrow">
          <span>PULLWISE / 01</span>
          <span>
            {T("PR, CI, and Updates for GitHub teams", "面向 GitHub 团队的 PR、CI 与更新工作台")}
          </span>
        </div>
        <h1 id="lp-title" className="lp-title">
          {T("Follow pull requests, CI failures, and upstream updates.", "跟进拉取请求、CI 失败与上游更新。")}
          <br />
          <span className="lp-title-em">{T("Keep the next action clear.", "让下一步行动更清晰。")}</span>
        </h1>
        <p className="lp-sub">
          {T(
            "Connect GitHub to organize pull request activity, CI failures, and upstream releases in one workspace. Pullwise keeps source facts, saved evidence, and your team's handling history together.",
            "连接 GitHub，在一个工作台整理拉取请求动态、CI 失败和上游版本发布。Pullwise 将来源事实、已保存证据和团队处理记录关联呈现。"
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
            <I.Check size={12} /> {T("Pull request actions", "拉取请求待办")}
          </span>
          <span>
            <I.Check size={12} /> {T("CI failure context", "CI 失败上下文")}
          </span>
          <span>
            <I.Check size={12} /> {T("Upstream release watches", "上游版本关注")}
          </span>
          <span>
            <I.Check size={12} /> {T("Saved evidence and handling", "已保存证据与处理记录")}
          </span>
        </div>
      </section>

      <section className="lp-preview">
        <div className="lp-preview-card">
          <div className="lp-preview-bar">
            <span className="lp-preview-kicker">{T("WORKSPACE / PREVIEW", "工作台 / 预览")}</span>
            <div className="lp-preview-url">pull-wise.com / dashboard</div>
          </div>
          <div className="lp-preview-body">
            <div className="lp-preview-side">
              {[
                T("Overview", "总览"),
                T("Pull requests", "拉取请求"),
                T("CI failures", "CI 失败"),
                T("Updates", "更新"),
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
                  <span>{T("PR", "PR")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Layers size={18} />
                  </b>
                  <span>{T("CI", "CI")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b style={{ color: "var(--accent)" }}>
                    <I.Bug size={18} />
                  </b>
                  <span>{T("Updates", "更新")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Shield size={18} />
                  </b>
                  <span>{T("Evidence", "证据")}</span>
                </div>
              </div>
              <div className="lp-preview-issues">
                <div className="lp-preview-issue">
                  <span className="sev sev-info">
                    <span className="dot" style={{ background: "currentColor" }} />
                    {T("saved", "已保存")}
                  </span>
                  <div className="lp-preview-issue-t">
                    {T(
                      "Saved source evidence and handling history stay linked to the work they describe.",
                      "已保存的来源证据与处理记录会关联到对应事项。"
                    )}
                  </div>
                  <span className="lp-preview-issue-f">
                    {T("Source facts + team handling", "来源事实 + 团队处理")}
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
              {T("How Pullwise keeps work in view.", "Pullwise 如何持续呈现待处理事项。")}
            </h2>
            <p>
              {T(
                "Configure the services you need, then use saved facts and evidence to decide what deserves attention.",
                "配置所需服务，再根据已保存的事实和证据判断哪些事项值得关注。"
              )}
            </p>
          </div>
        </div>
        <div className="lp-features">
          {[
            {
              i: <I.Layers />,
              h: T("Connect authorized repositories", "连接已授权仓库"),
              p: T(
                "Choose the GitHub repositories and services your team wants to follow.",
                "选择团队希望关注的 GitHub 仓库和服务。"
              ),
            },
            {
              i: <I.Bug />,
              h: T("Track pull request actions", "跟进拉取请求待办"),
              p: T(
                "Bring requested changes, discussion, and review follow-up into one actionable list.",
                "将修改请求、讨论和审查跟进汇集成可处理的列表。"
              ),
            },
            {
              i: <I.Terminal />,
              h: T("Investigate CI failures", "调查 CI 失败"),
              p: T(
                "See failed runs, stages, symptoms, and saved context together.",
                "集中查看失败运行、阶段、症状和已保存上下文。"
              ),
            },
            {
              i: <I.Shield />,
              h: T("Watch upstream releases", "关注上游版本发布"),
              p: T(
                "Follow selected upstream projects and inspect relevant release changes.",
                "关注选定的上游项目并查看相关版本变化。"
              ),
            },
            {
              i: <I.FileCode />,
              h: T("Inspect saved evidence", "查看已保存证据"),
              p: T(
                "Read source facts and saved assessments without starting new processing from the browser.",
                "读取来源事实与已保存的判断；浏览操作不会启动新的处理。"
              ),
            },
            {
              i: <I.Code />,
              h: T("Record team handling", "记录团队处理"),
              p: T(
                "Mark items done or dismissed, assign follow-up, and keep a saved handling history.",
                "标记完成或不跟进、分配后续处理，并保留处理历史。"
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
                : T("Bring your team's work into view.", "让团队事项清晰可见。")}
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

export function LoginScreen({ go } = {}) {
  useLang();
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  useErrorNotification(error, {
    title: T("Sign in error", "Sign in error"),
    key: `login:${error}`,
  });
  const pending = Boolean(pendingAction);
  const loginAbortRef = useRef(null);

  const handleGitHubLogin = async () => {
    if (loginAbortRef.current) loginAbortRef.current.abort();
    const controller = new AbortController();
    loginAbortRef.current = controller;
    setPendingAction("github");
    setError("");

    try {
      await startGitHubLogin({ signal: controller.signal });
    } catch (authError) {
      if (controller.signal.aborted) return;
      setError(getAuthErrorMessage(authError));
      setPendingAction("");
    }
  };

  useEffect(() => {
    return () => {
      if (loginAbortRef.current) loginAbortRef.current.abort();
    };
  }, []);

  return (
    <div className="auth-wrap fade-in">
      <a className="auth-back-home" {...screenLinkProps(go, "landing")}>
        <I.ArrowL size={14} /> {T("Back to home", "返回首页")}
      </a>
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
          <img
            className="brand-mark"
            src="/favicon.ico"
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
            "Use GitHub to sign in. Connect repositories later to configure PR, CI, and Updates services.",
            "使用 GitHub 登录。之后连接仓库，配置 PR、CI 和更新服务。"
          )}
        </p>

        <button
          className="btn lg primary auth-gh"
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
            <p>{T("Sign in with your GitHub identity.", "使用你的 GitHub 身份登录。")}</p>
          </div>
          <div className="auth-next-i">
            <span>2</span>
            <p>
              {T("Connect repositories and configure PR, CI, and Updates services.", "连接仓库并配置 PR、CI 和更新服务。")}
            </p>
          </div>
        </div>
      </div>
      <div className="auth-legal">
        {T("By signing in you agree to our", "登录即表示你同意我们的")}{" "}
        <a {...screenLinkProps(go, "terms")}>{T("Terms of Service", "服务条款")}</a>{" "}
        {T("and", "和")}{" "}
        <a {...screenLinkProps(go, "privacy")}>{T("Privacy Policy", "隐私政策")}</a>.
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
  const backTarget = auth?.authenticated ? "repos" : "login";

  const handleAuthorize = async () => {
    setAuthing(true);
    setError("");

    try {
      await connectGitHubRepositories();
      go("repos");
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
              src="/favicon.ico"
              alt="Pullwise"
              width="48"
              height="48"
            />
          </div>
          <h2>{T("Connect GitHub repository access", "连接 GitHub 仓库访问")}</h2>
          <p className="oauth-org">
            {T(
              "Install Pullwise on your GitHub account or organization, then choose repositories and configure services.",
              "在你的 GitHub 账户或组织上安装 Pullwise，然后选择仓库并配置服务。"
            )}
          </p>
        </div>

        <div className="oauth-perms">
          <div className="oauth-perm-h">
            {T("Requested GitHub permissions", "请求的 GitHub 权限")}
          </div>
          {[
            {
              i: <I.Folder size={15} />,
              h: T("Repository metadata", "仓库元数据"),
              p: T(
                "List authorized repositories, branches, languages, and installation status.",
                "列出已授权的仓库、分支、语言和安装状态。"
              ),
            },
            {
              i: <I.FileCode size={15} />,
              h: T("Contents and pull requests", "内容和拉取请求"),
              p: T(
                "Repository access lets Pullwise read authorized PR, CI, and Updates facts. Pullwise handling does not change GitHub content.",
                "仓库权限让 Pullwise 读取已授权的 PR、CI 和更新事实。Pullwise 内的处理操作不会修改 GitHub 内容。"
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
              "On GitHub, choose your personal account or organization, then grant access to all repositories or selected public/private repositories.",
              "在 GitHub 上选择你的个人账户或组织，然后授予对所有仓库或选定的公开/私有仓库的访问权限。"
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
