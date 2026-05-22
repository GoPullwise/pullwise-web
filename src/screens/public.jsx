import { useState } from "react";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import {
  connectGitHubRepositories,
  requestMagicLink,
  startGitHubLogin,
} from "../lib/auth.js";

function getAuthErrorMessage(error) {
  return (
    error?.message ||
    T(
      "Authentication is unavailable. Check the backend auth service.",
      "Authentication is unavailable. Check the backend auth service."
    )
  );
}

function getRepositoryAuthErrorMessage(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  if (error?.status === 409 || message.includes("private or not publicly visible")) {
    return T(
      "This GitHub App is owner-only right now. Make the GitHub App Public / Any account so users can install it on their own account or organization, then try again.",
      "This GitHub App is owner-only right now. Make the GitHub App Public / Any account so users can install it on their own account or organization, then try again."
    );
  }
  if (error?.status === 503 || message.includes("Unable to verify GitHub App")) {
    return T(
      "Pullwise could not verify this GitHub App is public. Try again after GitHub API access is available.",
      "Pullwise could not verify this GitHub App is public. Try again after GitHub API access is available."
    );
  }
  if (code === "github_app_installation_not_completed" || message.includes("github_app_installation_not_completed")) {
    return T(
      "GitHub did not install the app. If you chose an organization, an organization owner may need to approve the request before repositories can be connected.",
      "GitHub did not install the app. If you chose an organization, an organization owner may need to approve the request before repositories can be connected."
    );
  }
  if (code === "missing_installation_id" || message.includes("missing_installation_id")) {
    return T(
      "GitHub returned without an installation id. Check that the GitHub App setup URL points to the Pullwise backend callback, then try installing the app again.",
      "GitHub returned without an installation id. Check that the GitHub App setup URL points to the Pullwise backend callback, then try installing the app again."
    );
  }
  if (message.includes("Contents: read")) {
    return T(
      "The GitHub App must use Contents: read-only permission. Write access is not accepted.",
      "The GitHub App must use Contents: read-only permission. Write access is not accepted."
    );
  }
  return getAuthErrorMessage(error);
}

export function LandingScreen({ go, accent }) {
  useLang();
  return (
    <div className="landing fade-in">
      <header className="lp-top">
        <div className="brand">
          <div className="brand-mark">PR</div>
          <span>Pullwise</span>
        </div>
        <nav className="lp-nav">
          <button className="btn ghost sm">{T("Product", "Product")}</button>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => go("login")}>{T("Sign in", "Sign in")}</button>
          <button className="btn primary sm" onClick={() => go("login")}>{T("Get started", "Get started")}</button>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: accent }} />
          <span>{T("GitHub review workflow", "GitHub review workflow")}</span>
          <I.ArrowR size={12} />
        </div>
        <h1 className="lp-title">
          {T("Review real repos", "Review real repos")}<br />
          <span className="lp-title-em">{T("without sample data.", "without sample data.")}</span>
        </h1>
        <p className="lp-sub">
          {T(
            "Pullwise scans authorized GitHub repositories, stores agent-written findings, and keeps scan history in the backend.",
            "Pullwise scans authorized GitHub repositories, stores agent-written findings, and keeps scan history in the backend."
          )}
        </p>
        <div className="lp-cta">
          <button className="btn primary lg" onClick={() => go("login")}>
            <I.Github /> {T("Sign in with GitHub", "Sign in with GitHub")}
          </button>
        </div>
        <div className="lp-meta">
          <span><I.Check size={12} /> {T("GitHub OAuth", "GitHub OAuth")}</span>
          <span><I.Check size={12} /> {T("GitHub App repository access", "GitHub App repository access")}</span>
          <span><I.Check size={12} /> {T("Server-backed scans", "Server-backed scans")}</span>
        </div>
      </section>

      <section className="lp-preview">
        <div className="lp-preview-card">
          <div className="lp-preview-bar">
            <span /><span /><span />
            <div className="lp-preview-url">pullwise.dev / dashboard</div>
          </div>
          <div className="lp-preview-body">
            <div className="lp-preview-side">
              {[
                T("Overview", "Overview"),
                T("Issues", "Issues"),
                T("History", "History"),
                T("Settings", "Settings"),
              ].map((item, index) => (
                <div key={item} className={"lp-preview-side-i" + (index === 1 ? " active" : "")}>{item}</div>
              ))}
            </div>
            <div className="lp-preview-main">
              <div className="lp-preview-row">
                <div className="lp-preview-stat"><b><I.Github size={18} /></b><span>{T("Connect", "Connect")}</span></div>
                <div className="lp-preview-stat"><b><I.Refresh size={18} /></b><span>{T("Scan", "Scan")}</span></div>
                <div className="lp-preview-stat"><b style={{ color: accent }}><I.Bug size={18} /></b><span>{T("Review", "Review")}</span></div>
                <div className="lp-preview-stat"><b><I.Check size={18} /></b><span>{T("Triage", "Triage")}</span></div>
              </div>
              <div className="lp-preview-issues">
                <div className="lp-preview-issue">
                  <span className="sev sev-info"><span className="dot" style={{ background: "currentColor" }} />ready</span>
                  <div className="lp-preview-issue-t">{T("Connect GitHub to load repository findings.", "Connect GitHub to load repository findings.")}</div>
                  <span className="lp-preview-issue-f">{T("No sample findings", "No sample findings")}</span>
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
            h: T("GitHub identity", "GitHub identity"),
            p: T("Sign in with GitHub OAuth instead of a local demo account.", "Sign in with GitHub OAuth instead of a local demo account."),
          },
          {
            i: <I.Folder />,
            h: T("Repository authorization", "Repository authorization"),
            p: T("Authorize repositories through the GitHub App before scanning.", "Authorize repositories through the GitHub App before scanning."),
          },
          {
            i: <I.Bug />,
            h: T("Stored findings", "Stored findings"),
            p: T("Issues are loaded from backend scan results, not frontend fixtures.", "Issues are loaded from backend scan results, not frontend fixtures."),
          },
          {
            i: <I.Check />,
            h: T("Manual triage", "Manual triage"),
            p: T("Mark findings fixed or snoozed after reviewing the underlying code.", "Mark findings fixed or snoozed after reviewing the underlying code."),
          },
          {
            i: <I.Activity />,
            h: T("Scan history", "Scan history"),
            p: T("Track queued, running, done, failed, and cancelled scans from server state.", "Track queued, running, done, failed, and cancelled scans from server state."),
          },
          {
            i: <I.Lock />,
            h: T("No browser-side repo storage", "No browser-side repo storage"),
            p: T("The frontend reads repository metadata and findings through the API.", "The frontend reads repository metadata and findings through the API."),
          },
        ].map((feature, index) => (
          <div key={index} className="lp-feat">
            <div className="lp-feat-i" style={{ color: accent }}>{feature.i}</div>
            <h3>{feature.h}</h3>
            <p>{feature.p}</p>
          </div>
        ))}
      </section>

      <section className="lp-cta-band">
        <h2>{T("Start with GitHub sign-in.", "Start with GitHub sign-in.")}</h2>
        <button className="btn primary lg" onClick={() => go("login")}><I.Github /> {T("Sign in with GitHub", "Sign in with GitHub")}</button>
      </section>

      <footer className="lp-foot">
        <div>Copyright 2026 Pullwise</div>
        <div style={{ display: "flex", gap: 18 }}>
          <a className="legal-foot-l" onClick={() => go("privacy")}>{T("Privacy", "Privacy")}</a>
          <a className="legal-foot-l" onClick={() => go("terms")}>{T("Terms", "Terms")}</a>
          <a className="legal-foot-l" onClick={() => go("security")}>{T("Security", "Security")}</a>
          <a className="legal-foot-l" onClick={() => go("status")}>{T("Status", "Status")}</a>
        </div>
      </footer>
    </div>
  );
}

export function LoginScreen() {
  useLang();
  const [email, setEmail] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = Boolean(pendingAction);

  const handleGitHubLogin = async () => {
    setPendingAction("github");
    setError("");
    setNotice("");

    try {
      await startGitHubLogin();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
      setPendingAction("");
    }
  };

  const handleMagicLink = async (event) => {
    event.preventDefault();
    setPendingAction("email");
    setError("");
    setNotice("");

    try {
      await requestMagicLink({ email });
      setNotice(T(
        "Check your email for a Pullwise sign-in link.",
        "请检查邮箱中的 Pullwise 登录链接。"
      ));
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setPendingAction("");
    }
  };

  return (
    <div className="auth-wrap fade-in">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", marginBottom: 18 }}>
          <div className="brand-mark">PR</div>
          <span style={{ fontSize: 16 }}>Pullwise</span>
        </div>
        <h2 className="auth-title">{T("Sign in to Pullwise", "Sign in to Pullwise")}</h2>
        <p className="auth-sub">
          {T(
            "Use GitHub or an email magic link. Repository access is requested later, when you start a scan.",
            "使用 GitHub 或邮箱 Magic Link 登录。仓库权限会在开始扫描时再请求。"
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
              <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>
              {T("Opening GitHub...", "Opening GitHub...")}
            </>
          ) : (
            <>
              <I.Github /> {T("Continue with GitHub", "Continue with GitHub")}
            </>
          )}
        </button>

        <div className="auth-next" style={{ marginTop: 12, marginBottom: 12 }}>
          <div className="muted" style={{ textAlign: "center", width: "100%" }}>
            {T("or", "或")}
          </div>
        </div>

        <form onSubmit={handleMagicLink}>
          <label className="auth-field">
            <span>{T("Email", "邮箱")}</span>
            <div className="auth-input">
              <I.Mail size={13} />
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                disabled={pending}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </label>
          <button
            className="btn lg"
            type="submit"
            disabled={pending}
            style={{ width: "100%", marginTop: 10 }}
          >
            {pendingAction === "email" ? (
              <>
                <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>
                {T("Sending link...", "正在发送链接...")}
              </>
            ) : (
              <>
                <I.Mail /> {T("Email me a magic link", "发送邮箱 Magic Link")}
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="auth-error" role="alert">
            <I.X size={13} /> {error}
          </div>
        )}

        {notice && (
          <div
            className="auth-error"
            role="status"
            style={{ borderColor: "color-mix(in oklch, #16a34a 35%, var(--border))", color: "#16a34a" }}
          >
            <I.Check size={13} /> {notice}
          </div>
        )}

        <div className="auth-next">
          <div className="auth-next-i">
            <span>1</span>
            <p>{T("Sign in with your GitHub identity.", "Sign in with your GitHub identity.")}</p>
          </div>
          <div className="auth-next-i">
            <span>2</span>
            <p>{T("Connect repositories only when you start a scan.", "Connect repositories only when you start a scan.")}</p>
          </div>
        </div>
      </div>
      <div className="auth-legal">
        {T("By signing in you agree to our", "By signing in you agree to our")}{" "}
        <a>{T("Terms of Service", "Terms of Service")}</a> {T("and", "and")} <a>{T("Privacy Policy", "Privacy Policy")}</a>.
      </div>
    </div>
  );
}

export function OAuthScreen({ go }) {
  useLang();
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState("");

  const handleAuthorize = async () => {
    setAuthing(true);
    setError("");

    try {
      await connectGitHubRepositories();
      go("repos");
    } catch (authError) {
      if (authError?.code === "popup_closed") {
        setError(T(
          "GitHub installation was cancelled. Please try again.",
          "GitHub installation was cancelled. Please try again."
        ));
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
            <div className="oauth-logo gh"><I.Github size={26} /></div>
            <div className="oauth-dots">
              <span /><span /><span />
            </div>
            <div className="oauth-logo app">PR</div>
          </div>
          <h2>{T("Connect GitHub repository access", "Connect GitHub repository access")}</h2>
          <p className="oauth-org">
            {T(
              "Install Pullwise on your GitHub account or organization, then choose the repositories to scan.",
              "Install Pullwise on your GitHub account or organization, then choose the repositories to scan."
            )}
          </p>
        </div>

        <div className="oauth-perms">
          <div className="oauth-perm-h">{T("Requested GitHub permissions", "Requested GitHub permissions")}</div>
          {[
            {
              i: <I.Folder size={15} />,
              h: T("Repository metadata", "Repository metadata"),
              p: T("List authorized repositories, branches, languages, and installation status.", "List authorized repositories, branches, languages, and installation status."),
            },
            {
              i: <I.FileCode size={15} />,
              h: T("Read repository contents", "Read repository contents"),
              p: T("Read-only access for scan checkout and review.", "Read-only access for scan checkout and review."),
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
          <div className="oauth-perm-h">{T("Repository access", "Repository access")}</div>
          <div className="oauth-org-p">
            {T(
              "On GitHub, choose your personal account or organization, then grant access to all repositories or selected public/private repositories.",
              "On GitHub, choose your personal account or organization, then grant access to all repositories or selected public/private repositories."
            )}
          </div>
        </div>

        {error && (
          <div className="oauth-error" role="alert">
            <I.X size={13} /> {error}
          </div>
        )}

        <div className="oauth-actions">
          <button className="btn lg" onClick={() => go("login")} disabled={authing}>
            <I.ArrowL size={14} /> {T("Back", "Back")}
          </button>
          <button
            className={"btn lg primary" + (authing ? " is-loading" : "")}
            disabled={authing}
            onClick={handleAuthorize}
          >
            {authing ? (
              <>
                <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>
                {T("Opening GitHub...", "Opening GitHub...")}
              </>
            ) : (
              <>{T("Connect GitHub repositories", "Connect GitHub repositories")} <I.ArrowR size={14} /></>
            )}
          </button>
        </div>

        <div className="oauth-foot">
          <I.Lock size={12} /> {T("Login identity and repository authorization are separate.", "Login identity and repository authorization are separate.")}
        </div>
      </div>
    </div>
  );
}
