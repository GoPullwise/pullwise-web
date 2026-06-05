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
  if (
    code === "github_app_installation_not_completed" ||
    message.includes("github_app_installation_not_completed")
  ) {
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
  if (
    code === "github_app_api_unconfigured" ||
    message.includes("GitHub App API is not configured")
  ) {
    return T(
      "Pullwise found the GitHub App installation, but the backend cannot sync repositories because the GitHub App private key is missing or invalid. Set PULLWISE_GITHUB_APP_ID plus PULLWISE_GITHUB_APP_PRIVATE_KEY_PATH or PULLWISE_GITHUB_APP_PRIVATE_KEY_BASE64, then restart the backend.",
      "Pullwise found the GitHub App installation, but the backend cannot sync repositories because the GitHub App private key is missing or invalid. Set PULLWISE_GITHUB_APP_ID plus PULLWISE_GITHUB_APP_PRIVATE_KEY_PATH or PULLWISE_GITHUB_APP_PRIVATE_KEY_BASE64, then restart the backend."
    );
  }
  if (message.includes("Contents: read")) {
    return T(
      "The GitHub App must grant Contents: write and Pull requests: write so Pullwise can push fix branches and open pull requests.",
      "The GitHub App must grant Contents: write and Pull requests: write so Pullwise can push fix branches and open pull requests."
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
    ? T("Checking session...", "Checking session...")
    : signedIn
      ? T("Open dashboard", "Open dashboard")
      : T("Sign in with GitHub", "Sign in with GitHub");
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
          {T("Review real repos", "Review real repos")}
          <br />
          <span className="lp-title-em">{T("without sample data.", "without sample data.")}</span>
        </h1>
        <p className="lp-sub">
          {T(
            "Pullwise scans authorized GitHub repositories, stores agent-written findings, and keeps scan history in the backend.",
            "Pullwise scans authorized GitHub repositories, stores agent-written findings, and keeps scan history in the backend."
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
              <I.ArrowL /> {T("Sign out", "Sign out")}
            </button>
          )}
        </div>
        <div className="lp-meta">
          <span>
            <I.Check size={12} /> {T("GitHub OAuth", "GitHub OAuth")}
          </span>
          <span>
            <I.Check size={12} />{" "}
            {T("GitHub App repository access", "GitHub App repository access")}
          </span>
          <span>
            <I.Check size={12} /> {T("Server-backed scans", "Server-backed scans")}
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
                T("Overview", "Overview"),
                T("Issues", "Issues"),
                T("History", "History"),
                T("Settings", "Settings"),
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
                  <span>{T("Connect", "Connect")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Refresh size={18} />
                  </b>
                  <span>{T("Scan", "Scan")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b style={{ color: accent }}>
                    <I.Bug size={18} />
                  </b>
                  <span>{T("Review", "Review")}</span>
                </div>
                <div className="lp-preview-stat">
                  <b>
                    <I.Check size={18} />
                  </b>
                  <span>{T("Triage", "Triage")}</span>
                </div>
              </div>
              <div className="lp-preview-issues">
                <div className="lp-preview-issue">
                  <span className="sev sev-info">
                    <span className="dot" style={{ background: "currentColor" }} />
                    ready
                  </span>
                  <div className="lp-preview-issue-t">
                    {T(
                      "Connect GitHub to load repository findings.",
                      "Connect GitHub to load repository findings."
                    )}
                  </div>
                  <span className="lp-preview-issue-f">
                    {T("No sample findings", "No sample findings")}
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
            h: T("GitHub identity", "GitHub identity"),
            p: T(
              "Sign in with GitHub OAuth instead of a local demo account.",
              "Sign in with GitHub OAuth instead of a local demo account."
            ),
          },
          {
            i: <I.Folder />,
            h: T("Repository authorization", "Repository authorization"),
            p: T(
              "Authorize repositories through the GitHub App before scanning.",
              "Authorize repositories through the GitHub App before scanning."
            ),
          },
          {
            i: <I.Bug />,
            h: T("Stored findings", "Stored findings"),
            p: T(
              "Issues are loaded from backend scan results, not frontend fixtures.",
              "Issues are loaded from backend scan results, not frontend fixtures."
            ),
          },
          {
            i: <I.Check />,
            h: T("Manual triage", "Manual triage"),
            p: T(
              "Mark findings fixed or snoozed after reviewing the underlying code.",
              "Mark findings fixed or snoozed after reviewing the underlying code."
            ),
          },
          {
            i: <I.Activity />,
            h: T("Scan history", "Scan history"),
            p: T(
              "Track queued, running, done, failed, and cancelled scans from server state.",
              "Track queued, running, done, failed, and cancelled scans from server state."
            ),
          },
          {
            i: <I.Lock />,
            h: T("No browser-side repo storage", "No browser-side repo storage"),
            p: T(
              "The frontend reads repository metadata and findings through the API.",
              "The frontend reads repository metadata and findings through the API."
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
            ? T("Restoring your account.", "Restoring your account.")
            : signedIn
              ? T("Continue from your account.", "Continue from your account.")
              : T("Start with GitHub sign-in.", "Start with GitHub sign-in.")}
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
        <h2 className="auth-title">{T("Sign in to Pullwise", "Sign in to Pullwise")}</h2>
        <p className="auth-sub">
          {T(
            "Use GitHub to sign in. Repository access is requested later, when you start a scan.",
            "Use GitHub to sign in. Repository access is requested later, when you start a scan."
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
              {T("Opening GitHub...", "Opening GitHub...")}
            </>
          ) : (
            <>
              <I.Github /> {T("Continue with GitHub", "Continue with GitHub")}
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
            <p>{T("Sign in with your GitHub identity.", "Sign in with your GitHub identity.")}</p>
          </div>
          <div className="auth-next-i">
            <span>2</span>
            <p>
              {T(
                "Connect repositories only when you start a scan.",
                "Connect repositories only when you start a scan."
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="auth-legal">
        {T("By signing in you agree to our", "By signing in you agree to our")}{" "}
        <a {...screenLinkProps(go, "terms")}>{T("Terms of Service", "Terms of Service")}</a>{" "}
        {T("and", "and")}{" "}
        <a {...screenLinkProps(go, "privacy")}>{T("Privacy Policy", "Privacy Policy")}</a>.
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
            "GitHub installation was cancelled. Please try again."
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
          <h2>{T("Connect GitHub repository access", "Connect GitHub repository access")}</h2>
          <p className="oauth-org">
            {T(
              "Install Pullwise on your GitHub account or organization, then choose the repositories to scan.",
              "Install Pullwise on your GitHub account or organization, then choose the repositories to scan."
            )}
          </p>
        </div>

        <div className="oauth-perms">
          <div className="oauth-perm-h">
            {T("Requested GitHub permissions", "Requested GitHub permissions")}
          </div>
          {[
            {
              i: <I.Folder size={15} />,
              h: T("Repository metadata", "Repository metadata"),
              p: T(
                "List authorized repositories, branches, languages, and installation status.",
                "List authorized repositories, branches, languages, and installation status."
              ),
            },
            {
              i: <I.FileCode size={15} />,
              h: T("Contents and pull requests", "Contents and pull requests"),
              p: T(
                "Contents: write and Pull requests: write are required for scan checkout, fix branches, and pull request creation.",
                "Contents: write and Pull requests: write are required for scan checkout, fix branches, and pull request creation."
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
          {authing ? (
            <button className="btn lg" type="button" disabled>
              <I.ArrowL size={14} /> {T("Back", "Back")}
            </button>
          ) : (
            <a className="btn lg" {...screenLinkProps(go, backTarget)}>
              <I.ArrowL size={14} /> {T("Back", "Back")}
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
                {T("Opening GitHub...", "Opening GitHub...")}
              </>
            ) : (
              <>
                {T("Connect GitHub repositories", "Connect GitHub repositories")}{" "}
                <I.ArrowR size={14} />
              </>
            )}
          </button>
        </div>

        <div className="oauth-foot">
          <I.Lock size={12} />{" "}
          {T(
            "Login identity and repository authorization are separate.",
            "Login identity and repository authorization are separate."
          )}
        </div>
      </div>
    </div>
  );
}
