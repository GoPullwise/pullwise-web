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
      "The GitHub App must grant Contents: write and Pull requests: write so Pullwise can push fix branches and open pull requests.",
      "GitHub App 必须授予 Contents: write 和 Pull requests: write 权限，Pullwise 才能推送修复分支并创建拉取请求。"
    );
  }
  return getAuthErrorMessage(error);
}

export function LandingScreen({ go, accent, auth }) {
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
    <span className="spin" style={{ display: "inline-block" }}>
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
          <span>{T("AI code review for GitHub repositories", "面向 GitHub 仓库的 AI 代码审查")}</span>
        </div>
        <h1 id="lp-title" className="lp-title">
          {T("Find repository-wide risks.", "发现全仓风险。")}
          <br />
          <span className="lp-title-em">
            {T("Ship fixes with evidence.", "用证据推动修复。")}
          </span>
        </h1>
        <p className="lp-sub">
          {T(
            "Pullwise is an AI code review platform for engineering teams. Connect a GitHub repository to scan the full codebase for security, correctness, and test gaps—then get validated findings with exact file locations and next steps.",
            "Pullwise 是面向工程团队的 AI 代码审查平台。连接 GitHub 仓库，扫描完整代码库中的安全、正确性和测试缺口，并获得经过验证、包含准确文件位置与下一步建议的发现。"
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
            <I.Check size={12} /> {T("Full-repository context", "全仓库上下文")}
          </span>
          <span>
            <I.Check size={12} />{" "}
            {T("Security, correctness, and tests", "安全、正确性与测试")}
          </span>
          <span>
            <I.Check size={12} /> {T("Validator-checked findings", "经 Validator 检查的发现")}
          </span>
          <span>
            <I.Check size={12} /> {T("CI-ready REST API", "可接入 CI 的 REST API")}
          </span>
        </div>
      </section>

      <section className="lp-preview">
        <div className="lp-preview-card">
          <div className="lp-preview-bar">
            <span className="lp-preview-kicker">{T("REVIEW TRACE / LIVE", "审查轨迹 / 实时")}</span>
            <div className="lp-preview-url">pull-wise.com / dashboard</div>
          </div>
          <div className="lp-preview-body">
            <div className="lp-preview-side">
              {[
                T("Snapshot", "Snapshot"),
                T("Risk routes", "风险路由"),
                T("Validate", "验证"),
                T("Report", "报告"),
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
                  <span>{T("Snapshot", "Snapshot")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Layers size={18} />
                  </b>
                  <span>{T("Bundle", "Bundle")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b style={{ color: accent }}>
                    <I.Bug size={18} />
                  </b>
                  <span>{T("Review", "审查")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Shield size={18} />
                  </b>
                  <span>{T("Validate", "验证")}</span>
                </div>
              </div>
              <div className="lp-preview-issues">
                <div className="lp-preview-issue">
                  <span className="sev sev-info">
                    <span className="dot" style={{ background: "currentColor" }} />
                    {T("confirmed", "已确认")}
                  </span>
                  <div className="lp-preview-issue-t">
                    {T(
                      "Confirmed and plausible findings include file locations, evidence, impact, and next-agent tasks.",
                      "已确认和可信的问题会包含文件位置、证据、影响与下一步 agent 任务。"
                    )}
                  </div>
                  <span className="lp-preview-issue-f">
                    {T("Stable envelope + versioned artifacts", "稳定 envelope + 版本化 artifacts")}
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
            <h2 id="lp-capabilities-title">{T("How Pullwise reviews a repository.", "Pullwise 如何审查一个仓库。")}</h2>
            <p>
              {T(
                "From repository mapping to validated findings, every stage is designed to reduce noise and make the result usable by developers.",
                "从仓库映射到发现验证，每个阶段都在减少噪声，让开发者能够直接使用审查结果。"
              )}
            </p>
          </div>
        </div>
        <div className="lp-features">
          {[
            {
              i: <I.Layers />,
              h: T("Map the whole repository", "映射完整仓库"),
              p: T(
                "Read the current code tree, symbols, entry points, and trust boundaries before deciding where review effort matters most.",
                "先读取当前代码树、符号、入口与信任边界，再决定审查精力最应该投入的位置。"
              ),
            },
            {
              i: <I.Bug />,
              h: T("Review high-risk code paths", "审查高风险代码路径"),
              p: T(
                "Focus security, correctness, and test-gap reviewers on planned code areas instead of treating every file as equal.",
                "让安全、正确性和测试缺口审查聚焦于规划后的代码区域，而不是平等对待每个文件。"
              ),
            },
            {
              i: <I.Terminal />,
              h: T("Run in isolated workers", "在隔离 Worker 中运行"),
              p: T(
                "Keep each review workspace, Codex state, artifacts, and logs isolated so one run cannot leak into another.",
                "隔离每次审查的工作区、Codex 状态、产物与日志，避免不同运行之间相互污染。"
              ),
            },
            {
              i: <I.Shield />,
              h: T("Verify before reporting", "报告前先验证"),
              p: T(
                "Check file locations, merge duplicate claims, and challenge candidate findings before they reach the main report.",
                "检查文件位置、合并重复结论并质疑候选发现，然后才允许它们进入主报告。"
              ),
            },
            {
              i: <I.FileCode />,
              h: T("Deliver fix-ready evidence", "交付可直接修复的证据"),
              p: T(
                "Return severity, exact file locations, evidence, impact, and next steps that developers or coding agents can act on.",
                "返回严重程度、准确文件位置、证据、影响与下一步，让开发者或编码 Agent 可以直接行动。"
              ),
            },
            {
              i: <I.Code />,
              h: T("Automate through the API", "通过 API 自动化"),
              p: T(
                "Start scans, read results, and check account or repository quota from CI, scripts, and internal engineering tools.",
                "从 CI、脚本和内部工程工具启动扫描、读取结果，并检查账户或仓库配额。"
              ),
            },
          ].map((feature, index) => (
            <article key={feature.h} className="lp-feat">
              <div className="lp-feat-top">
                <span className="lp-feat-n">{String(index + 1).padStart(2, "0")}</span>
                <div className="lp-feat-i" style={{ color: accent }}>
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
                : T("Review your next repository.", "审查你的下一个仓库。")}
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
          <img className="brand-mark" src="/favicon.ico" alt="" aria-hidden="true" width="24" height="24" />
          <span style={{ fontSize: 16 }}>Pullwise</span>
        </div>
        <h2 className="auth-title">{T("Sign in to Pullwise", "登录 Pullwise")}</h2>
        <p className="auth-sub">
          {T(
            "Use GitHub to sign in. Repository access is requested later, when you start a scan.",
            "使用 GitHub 登录。仓库权限将在你开始扫描时再请求。"
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
              <span className="spin" style={{ display: "inline-block" }}>
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
              {T(
                "Connect repositories only when you start a scan.",
                "仅在开始扫描时连接仓库。"
              )}
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
          T(
            "GitHub installation was cancelled. Please try again.",
            "GitHub 安装已取消。请重试。"
          )
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
            <img className="oauth-logo app" src="/favicon.ico" alt="Pullwise" width="48" height="48" />
          </div>
          <h2>{T("Connect GitHub repository access", "连接 GitHub 仓库访问")}</h2>
          <p className="oauth-org">
            {T(
              "Install Pullwise on your GitHub account or organization, then choose the repositories to scan.",
              "在你的 GitHub 账户或组织上安装 Pullwise，然后选择要扫描的仓库。"
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
                "Contents: write and Pull requests: write are required for scan checkout, fix branches, and pull request creation.",
                "Contents: write 和 Pull requests: write 是扫描 checkout、修复分支和拉取请求所必需的权限。"
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
                <span className="spin" style={{ display: "inline-block" }}>
                  <I.Refresh size={14} />
                </span>
                {T("Opening GitHub...", "正在打开 GitHub...")}
              </>
            ) : (
              <>
                {T("Connect GitHub repositories", "连接 GitHub 仓库")}{" "}
                <I.ArrowR size={14} />
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
