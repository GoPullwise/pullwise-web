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
        <h1 className="lp-title">
          {T("Find broadly.", "广泛发现。")}
          <br />
          <span className="lp-title-em">
            {T("Prove locally.", "本地证明。")}
          </span>
        </h1>
        <p className="lp-sub">
          {T(
            "Pullwise turns Git diffs into CodeGraph-backed review slices, runs focused agents, reproduces high-signal candidates in isolated workers, and reports only findings that survive judge validation.",
            "Pullwise 将 Git diff 转换为 CodeGraph 支撑的审查切片，运行聚焦 agent，在隔离 worker 中复现高价值候选问题，并且只报告通过 judge 验证的发现。"
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
            {T("CodeGraph evidence", "CodeGraph 证据")}
          </span>
          <span>
            <I.Check size={12} /> {T("Isolated reproduction", "隔离复现")}
          </span>
          <span>
            <I.Check size={12} /> {T("Confirmed-only reports", "只报告已确认问题")}
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
                T("Diff", "Diff"),
                T("Graph slices", "图切片"),
                T("Repro", "复现"),
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
                  <span>{T("Diff", "Diff")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Layers size={18} />
                  </b>
                  <span>{T("Slice", "切片")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b style={{ color: accent }}>
                    <I.Bug size={18} />
                  </b>
                  <span>{T("Find", "发现")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Shield size={18} />
                  </b>
                  <span>{T("Judge", "判定")}</span>
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
                      "Only reproduced, graph-linked findings reach the final report.",
                      "只有已复现并关联图证据的问题会进入最终报告。"
                    )}
                  </div>
                  <span className="lp-preview-issue-f">
                    {T("Graph evidence + local repro + judge approval", "图证据 + 本地复现 + judge 批准")}
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
            i: <I.GitPull />,
            h: T("Diff-first review entry", "从 Diff 开始审查"),
            p: T(
              "Start from the changed files, hunks, and rough changed symbols instead of asking agents to roam the whole repository.",
              "从变更文件、hunk 和粗略变更符号开始，而不是让 agent 在整个仓库里漫游。"
            ),
          },
          {
            i: <I.Layers />,
            h: T("CodeGraph slice planning", "CodeGraph 切片规划"),
            p: T(
              "Build review context from matched symbols, callers, callees, impact radius, entrypoints, and affected tests.",
              "基于匹配符号、调用方、被调用方、影响半径、入口点和受影响测试构建审查上下文。"
            ),
          },
          {
            i: <I.Bug />,
            h: T("Parallel finder agents", "并行 Finder Agents"),
            p: T(
              "Run focused correctness, security, API contract, state, and repro-planning agents inside bounded slice context.",
              "在有边界的切片上下文中运行正确性、安全、API 契约、状态和复现规划等聚焦 agent。"
            ),
          },
          {
            i: <I.Filter />,
            h: T("Candidate normalization", "候选问题归一化"),
            p: T(
              "Validate evidence, dedupe similar claims, score risk, and send only strong candidates to reproduction.",
              "校验证据、去重相似主张、评估风险，并且只把高价值候选问题送入复现。"
            ),
          },
          {
            i: <I.Terminal />,
            h: T("Isolated repro workers", "隔离复现 Worker"),
            p: T(
              "Give each candidate its own worker directory, generated minimal repro, command logs, and filesystem boundary checks.",
              "为每个候选问题分配独立 worker 目录、最小复现、命令日志和文件系统边界检查。"
            ),
          },
          {
            i: <I.Shield />,
            h: T("Judge validation gate", "Judge 验证门禁"),
            p: T(
              "Reject static guesses, ambiguous logs, harness failures, missing reproduction, and workers that cross their boundaries.",
              "拒绝静态猜测、含糊日志、测试夹具失败、缺失复现，以及越过边界的 worker。"
            ),
          },
          {
            i: <I.FileCode />,
            h: T("Confirmed-only reports", "只报告已确认问题"),
            p: T(
              "Final reports include confirmed findings with graph evidence, code evidence, trigger conditions, observed behavior, and repro commands.",
              "最终报告包含已确认问题，以及图证据、代码证据、触发条件、观测行为和复现命令。"
            ),
          },
          {
            i: <I.Activity />,
            h: T("Debuggable pipeline history", "可调试流水线历史"),
            p: T(
              "Keep changed files, slices, finder tasks, raw candidates, repro status, judge reasons, and timing for developer audit.",
              "保留变更文件、切片、finder 任务、原始候选、复现状态、judge 理由和耗时，便于开发者审计。"
            ),
          },
          {
            i: <I.Lock />,
            h: T("Local-first review boundary", "本地优先审查边界"),
            p: T(
              "Default finder, repro, and judge runs avoid free network access, real credentials, production services, and destructive operations.",
              "默认 finder、repro 和 judge 不自由联网，不使用真实凭据、生产服务或破坏性操作。"
            ),
          },
          {
            i: <I.Github />,
            h: T("GitHub repository workflow", "GitHub 仓库工作流"),
            p: T(
              "Use GitHub identity, GitHub App repository authorization, server-backed scans, history, quotas, and account-scoped API keys.",
              "使用 GitHub 身份、GitHub App 仓库授权、服务端扫描、历史记录、配额和账户范围 API 密钥。"
            ),
          },
          {
            i: <I.ArrowR />,
            h: T("Triage and fix workflow", "分流与修复工作流"),
            p: T(
              "Review confirmed findings, mark workflow status, preview deterministic fixes, and open Pullwise pull requests when permitted.",
              "审阅已确认问题、标记工作流状态、预览确定性修复，并在有权限时打开 Pullwise 拉取请求。"
            ),
          },
          {
            i: <I.Code />,
            h: T("Automation-ready API", "面向自动化的 API"),
            p: T(
              "Drive repository listing, scan control, scan status, and quota checks from CI, internal tools, or scripts.",
              "从 CI、内部工具或脚本驱动仓库列表、扫描控制、扫描状态和配额检查。"
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
