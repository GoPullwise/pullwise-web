import { useEffect, useRef, useState } from "react";
import { I } from "../icons.jsx";
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

      <section className="lp-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: accent }} />
          <span>{T("GitHub review workflow", "GitHub review workflow")}</span>
          <I.ArrowR size={12} />
        </div>
        <h1 className="lp-title">
          {T("Review real repos", "审查真实仓库")}
          <br />
          <span className="lp-title-em">
            {T("without sample data.", "不需要样例数据。")}
          </span>
        </h1>
        <p className="lp-sub">
          {T(
            "Pullwise scans authorized GitHub repositories, stores agent-written findings, and keeps scan history in the backend.",
            "Pullwise 扫描已授权的 GitHub 仓库，存储 agent 写入的发现，并在后端保留扫描历史。"
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
          {signedIn && (
            <button className="btn lg" onClick={signOut}>
              <I.ArrowL /> {T("Sign out", "退出登录")}
            </button>
          )}
        </div>
        <div className="lp-meta">
          <span>
            <I.Check size={12} /> {T("GitHub OAuth", "GitHub OAuth")}
          </span>
          <span>
            <I.Check size={12} />{" "}
            {T("GitHub App repository access", "GitHub App 仓库访问")}
          </span>
          <span>
            <I.Check size={12} /> {T("Server-backed scans", "服务端扫描")}
          </span>
        </div>
      </section>

      <section className="lp-preview">
        <div className="lp-preview-card">
          <div className="lp-preview-bar">
            <span />
            <span />
            <span />
            <div className="lp-preview-url">pull-wise.com / dashboard</div>
          </div>
          <div className="lp-preview-body">
            <div className="lp-preview-side">
              {[
                T("Overview", "总览"),
                T("Issues", "问题"),
                T("History", "历史"),
                T("Settings", "设置"),
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
                    <I.Github size={18} />
                  </b>
                  <span>{T("Connect", "连接")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Refresh size={18} />
                  </b>
                  <span>{T("Scan", "扫描")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b style={{ color: accent }}>
                    <I.Bug size={18} />
                  </b>
                  <span>{T("Review", "审查")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Check size={18} />
                  </b>
                  <span>{T("Triage", "分流")}</span>
                </div>
              </div>
              <div className="lp-preview-issues">
                <div className="lp-preview-issue">
                  <span className="sev sev-info">
                    <span className="dot" style={{ background: "currentColor" }} />
                    {T("ready", "就绪")}
                  </span>
                  <div className="lp-preview-issue-t">
                    {T(
                      "Connect GitHub to load repository findings.",
                      "连接 GitHub 以加载仓库发现。"
                    )}
                  </div>
                  <span className="lp-preview-issue-f">
                    {T("No sample findings", "没有样例发现")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-features">
        {[
          {
            i: <I.Github />,
            h: T("GitHub identity", "GitHub 身份"),
            p: T(
              "Sign in with GitHub OAuth instead of a local demo account.",
              "使用 GitHub OAuth 登录，而不是本地演示账户。"
            ),
          },
          {
            i: <I.Folder />,
            h: T("Repository authorization", "仓库授权"),
            p: T(
              "Authorize repositories through the GitHub App before scanning.",
              "扫描前通过 GitHub App 授权仓库。"
            ),
          },
          {
            i: <I.Bug />,
            h: T("Stored findings", "存储的发现"),
            p: T(
              "Issues are loaded from backend scan results, not frontend fixtures.",
              "问题从后端扫描结果加载，而非前端假数据。"
            ),
          },
          {
            i: <I.Check />,
            h: T("Manual triage", "手动分流"),
            p: T(
              "Mark findings fixed, snoozed, false positive, duplicate, or not relevant after review.",
              "审查后，将发现标记为已修复、推迟、误报、重复或不相关。"
            ),
          },
          {
            i: <I.Activity />,
            h: T("Scan history", "扫描历史"),
            p: T(
              "Track queued, running, done, failed, and cancelled scans from server state.",
              "从服务端状态跟踪排队、运行、完成、失败和已取消的扫描。"
            ),
          },
          {
            i: <I.Refresh />,
            h: T("Batch scans and quota preflight", "批量扫描与配额预检"),
            p: T(
              "Select multiple repositories, check account and repository quota, then queue only the allowed scans.",
              "选择多个仓库，检查账户和仓库配额，然后仅对允许的扫描进行排队。"
            ),
          },
          {
            i: <I.FileCode />,
            h: T("Preflight and audit evidence", "预检与审计证据"),
            p: T(
              "Show repository manifests, tool checks, verifier runs, candidate audit counts, and downloadable audit bundles.",
              "展示仓库清单、工具检查、验证器运行、候选审计计数，以及可下载的审计包。"
            ),
          },
          {
            i: <I.Code />,
            h: T("Scoped REST API keys", "范围化 REST API 密钥"),
            p: T(
              "Create account-scoped API keys for repository listing, scan control, scan status, and quota checks.",
              "为仓库列表、扫描控制、扫描状态和配额检查创建账户范围的 API 密钥。"
            ),
          },
          {
            i: <I.Package />,
            h: T("Billing and quota controls", "支付与配额控制"),
            p: T(
              "Surface account usage, repository quota, checkout, cancellation, and supported billing interval actions from the backend.",
              "从后端展示账户用量、仓库配额、checkout、取消续订和受支持的计费周期操作。"
            ),
          },
          {
            i: <I.Github />,
            h: T("Multiple GitHub installations", "多个 GitHub 安装"),
            p: T(
              "Manage personal and organization GitHub App installations without mixing repository access.",
              "分别管理个人和组织的 GitHub App 安装，不混用仓库访问。"
            ),
          },
          {
            i: <I.ArrowR />,
            h: T("Fix preview and pull requests", "修复预览与拉取请求"),
            p: T(
              "Preview deterministic fixes, push Pullwise fix branches, and open GitHub pull requests when write permissions are available.",
              "预览确定性修复、推送 Pullwise 修复分支，并在有写权限时打开 GitHub 拉取请求。"
            ),
          },
          {
            i: <I.Lock />,
            h: T("No browser-side repo storage", "浏览器不存储仓库"),
            p: T(
              "The frontend reads repository metadata and findings through the API.",
              "前端通过 API 读取仓库元数据和发现。"
            ),
          },
        ].map((feature, index) => (
          <div key={index} className="lp-feat">
            <div className="lp-feat-i" style={{ color: accent }}>
              {feature.i}
            </div>
            <h3>{feature.h}</h3>
            <p>{feature.p}</p>
          </div>
        ))}
      </section>

      <section className="lp-cta-band">
        <h2>
          {checkingSession
            ? T("Restoring your account.", "正在恢复你的账户。")
            : signedIn
              ? T("Continue from your account.", "从你的账户继续。")
              : T("Start with GitHub sign-in.", "使用 GitHub 登录开始。")}
        </h2>
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

        {error && (
          <div className="auth-error" role="alert">
            <I.X size={13} /> {error}
          </div>
        )}

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

        {error && (
          <div className="oauth-error" role="alert">
            <I.X size={13} /> {error}
          </div>
        )}

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
