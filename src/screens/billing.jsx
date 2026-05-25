import { useEffect, useMemo, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { Sidebar, Topbar } from "../shell.jsx";

function providerLabel(provider) {
  if (provider === "stripe") return "Stripe";
  if (provider === "creem") return "Creem";
  return "Disabled";
}

function billingReturnUrl(kind, screen = "billing") {
  const url = new URL(window.location.href);
  url.searchParams.set("screen", screen);
  url.searchParams.set("billing", kind);
  return url.toString();
}

function safeBillingUrl(value, label) {
  if (typeof value !== "string") throw new Error(`A safe ${label} is required.`);
  const url = value.trim();
  if ([...url].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new Error(`A safe ${label} is required.`);
  }
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol) && parsed.hostname) return url;
  } catch {
    // handled by the common error below
  }
  throw new Error(`A safe ${label} is required.`);
}

function planById(payload, id) {
  return (payload?.plans || []).find((plan) => plan.id === id) || null;
}

function priceFor(plan, interval) {
  return plan?.prices?.[interval] || plan?.prices?.month || null;
}

function priceLabel(price) {
  if (!price) return T("Configured in provider", "Configured in provider");
  const amount = priceAmount(price.amount);
  if (amount == null) return T("Configured in provider", "Configured in provider");
  if (amount === 0) return "$0";
  return `${currencySymbol(price.currency)}${amount}`;
}

function currencySymbol(currency) {
  return String(currency || "USD").toUpperCase() === "USD" ? "$" : `${currency || "USD"} `;
}

function priceAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function isActiveStatus(status) {
  return ["active", "trialing", "canceling"].includes(String(status || "").toLowerCase());
}

function nonNegativeInteger(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

function usagePercent(usage) {
  const limit = nonNegativeInteger(usage?.limit);
  if (!limit) return 0;
  return Math.min(100, (nonNegativeInteger(usage?.used) / limit) * 100);
}

function usageText(usage) {
  const used = nonNegativeInteger(usage?.used);
  const limit = nonNegativeInteger(usage?.limit);
  return `${used} / ${limit} reviews used`;
}

function billingWorkspace(plan) {
  if (plan?.workspace && typeof plan.workspace === "object") return plan.workspace;
  if (plan?.account && typeof plan.account === "object") return plan.account;
  return { status: "none", plan: "free" };
}

export function BillingScreen({
  go,
  setIssue = null,
  navigate = (url) => window.location.assign(url),
}) {
  useLang();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  useEffect(() => {
    let cancelled = false;
    pullwiseApi.billing
      .getPlan()
      .then((payload) => {
        if (cancelled) return;
        setPlan(payload);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load billing.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const freePlan = useMemo(
    () =>
      planById(plan, "free") || {
        id: "free",
        name: "Free",
        description: "Try Pullwise with shared workspace and repository quota.",
        reviewLimit: 10,
        prices: { month: { amount: "0", currency: "USD", interval: "month", configured: true } },
      },
    [plan]
  );
  const proPlan = useMemo(
    () =>
      planById(plan, "pro") || {
        id: "pro",
        name: plan?.name || "Pullwise Pro",
        description: plan?.description || "Repository review for production teams.",
        reviewLimit: 100,
        prices: {
          month: {
            amount: plan?.amount || "29",
            currency: plan?.currency || "USD",
            interval: "month",
            configured: plan?.enabled,
          },
          year: {
            amount: "290",
            currency: plan?.currency || "USD",
            interval: "year",
            configured: plan?.enabled,
          },
        },
      },
    [plan]
  );

  const workspace = billingWorkspace(plan);
  const workspaceStatus = workspace.status || "none";
  const workspaceName = workspace.name || "Workspace";
  const active = isActiveStatus(workspaceStatus);
  const activePro = active && workspace.plan === "pro";
  const proInterval = workspace.interval || "month";
  const currentPlan = activePro ? proPlan : freePlan;
  const usage = workspace.usage || {
    used: 0,
    limit: activePro ? proPlan.reviewLimit : freePlan.reviewLimit,
    remaining: activePro ? proPlan.reviewLimit : freePlan.reviewLimit,
    period: "",
  };
  const provider = providerLabel(plan?.provider);
  const billingEnabled = Boolean(plan?.enabled);

  const openPortal = async () => {
    setPendingAction("portal");
    setError("");
    try {
      const session = await pullwiseApi.billing.createPortalSession({
        returnUrl: billingReturnUrl("return"),
      });
      if (!session?.url) throw new Error("Billing provider did not return a portal URL.");
      navigate(safeBillingUrl(session.url, "billing portal URL"));
    } catch (err) {
      setError(err?.message || "Unable to open billing portal.");
      setPendingAction("");
    }
  };

  const switchToYearly = async () => {
    setPendingAction("switch-yearly");
    setError("");
    try {
      const result = await pullwiseApi.billing.changeSubscriptionInterval({
        interval: "year",
        returnUrl: billingReturnUrl("return"),
      });
      if (result?.url) {
        navigate(safeBillingUrl(result.url, "billing interval URL"));
        return;
      }
      setPlan((current) => ({
        ...current,
        workspace: {
          ...(billingWorkspace(current) || {}),
          plan: "pro",
          interval: "year",
          status: result?.status || workspaceStatus,
        },
        account: current?.account ? { ...current.account, deprecated: true } : current?.account,
      }));
      setPendingAction("");
    } catch (err) {
      setError(err?.message || "Unable to switch billing interval.");
      setPendingAction("");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: "Pullwise", go: "dashboard" }, { label: T("Billing", "Billing") }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="billing" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Billing", "Billing")}</h1>
              <div className="sub">
                {T(
                  "Workspace billing status, usage, and provider actions.",
                  "Workspace billing status, usage, and provider actions."
                )}
              </div>
            </div>
            <div className="actions">
              <span className="tag">{provider}</span>
              <a className="btn" {...screenLinkProps(go, "pricing")}>
                <I.Trend size={14} /> View pricing
              </a>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
              <I.X size={13} /> {error}
            </div>
          )}

          <div className="set-shell">
            <aside className="set-side">
              <button className="set-side-i active">
                <I.Package size={14} />
                <span>{T("Plan", "Plan")}</span>
              </button>
              <a className="set-side-i" {...screenLinkProps(go, "terms")}>
                <I.FileCode size={14} />
                <span>{T("Terms", "Terms")}</span>
              </a>
              <a className="set-side-i" {...screenLinkProps(go, "privacy")}>
                <I.Lock size={14} />
                <span>{T("Privacy", "Privacy")}</span>
              </a>
            </aside>

            <div className="set-body">
              <div className="bill-card billing-summary">
                <div className="billing-summary-main">
                  <I.Activity size={18} />
                  <div>
                    <b>Workspace usage</b>
                    <div className="muted">
                      {workspaceName} - {usageText(usage)}
                    </div>
                  </div>
                </div>
                <div className="billing-summary-meter">
                  <div className="usage-bar">
                    <div style={{ width: `${usagePercent(usage)}%` }} />
                  </div>
                  <span className="tag">{workspaceStatus}</span>
                </div>
              </div>

              <div className="bill-card billing-summary">
                <div className="billing-summary-main">
                  <I.Package size={18} />
                  <div>
                    <b>{currentPlan?.name || "Free"}</b>
                    <div className="muted">
                      {workspaceStatus} -{" "}
                      {activePro ? `Billed ${proInterval}` : "Upgrade from Pricing"}
                    </div>
                  </div>
                </div>
                <div className="billing-actions">
                  {!activePro && (
                    <a className="btn primary" {...screenLinkProps(go, "pricing")}>
                      <I.Trend size={14} /> View pricing
                    </a>
                  )}
                  {activePro && proInterval === "month" && (
                    <button
                      className="btn primary"
                      disabled={Boolean(pendingAction)}
                      onClick={switchToYearly}
                    >
                      {pendingAction === "switch-yearly" && (
                        <span className="spin" style={{ display: "inline-block" }}>
                          <I.Refresh size={14} />
                        </span>
                      )}
                      <I.Trend size={14} /> Switch to yearly
                    </button>
                  )}
                  {activePro && (
                    <button className="btn" disabled={Boolean(pendingAction)} onClick={openPortal}>
                      {pendingAction === "portal" && (
                        <span className="spin" style={{ display: "inline-block" }}>
                          <I.Refresh size={14} />
                        </span>
                      )}
                      <I.Settings size={14} /> Manage billing
                    </button>
                  )}
                </div>
              </div>

              {!billingEnabled && !error && (
                <div className="muted">
                  {T(
                    "Billing is not configured on the backend yet.",
                    "Billing is not configured on the backend yet."
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PricingScreen({
  go,
  auth = null,
  navigate = (url) => window.location.assign(url),
}) {
  useLang();
  const [plan, setPlan] = useState(null);
  const [interval, setInterval] = useState("month");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const signedIn = Boolean(auth?.authenticated);

  useEffect(() => {
    let cancelled = false;
    pullwiseApi.billing
      .getPlan()
      .then((payload) => {
        if (cancelled) return;
        setPlan(payload);
        const billingInterval = payload?.workspace?.interval || payload?.account?.interval || "";
        if (billingInterval === "year") setInterval("year");
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load pricing.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const freePlan = useMemo(
    () =>
      planById(plan, "free") || {
        id: "free",
        name: "Free",
        description: "Try Pullwise with shared workspace and repository quota.",
        reviewLimit: 10,
        prices: { month: { amount: "0", currency: "USD", interval: "month", configured: true } },
      },
    [plan]
  );
  const proPlan = useMemo(
    () =>
      planById(plan, "pro") || {
        id: "pro",
        name: plan?.name || "Pullwise Pro",
        description: plan?.description || "Repository review for production teams.",
        reviewLimit: 100,
        prices: {
          month: {
            amount: plan?.amount || "29",
            currency: plan?.currency || "USD",
            interval: "month",
            configured: plan?.enabled,
          },
          year: {
            amount: "290",
            currency: plan?.currency || "USD",
            interval: "year",
            configured: plan?.enabled,
          },
        },
      },
    [plan]
  );

  const workspace = billingWorkspace(plan);
  const activePro = isActiveStatus(workspace.status) && workspace.plan === "pro";
  const selectedProPrice = priceFor(proPlan, interval);
  const billingEnabled = Boolean(plan?.enabled);
  const proConfigured = Boolean(selectedProPrice?.configured);

  const startCheckout = async () => {
    if (!signedIn) {
      go("login");
      return;
    }
    setPendingAction("checkout");
    setError("");
    try {
      const session = await pullwiseApi.billing.createCheckoutSession({
        plan: "pro",
        interval,
        successUrl: billingReturnUrl("success", "pricing"),
        cancelUrl: billingReturnUrl("cancel", "pricing"),
      });
      if (!session?.url) throw new Error("Billing provider did not return a checkout URL.");
      navigate(safeBillingUrl(session.url, "billing checkout URL"));
    } catch (err) {
      setError(err?.message || "Unable to start checkout.");
      setPendingAction("");
    }
  };

  return (
    <div className="landing fade-in">
      <header className="lp-top">
        <a
          className="brand topbar-brand-button"
          aria-label="Go to Pullwise home"
          {...screenLinkProps(go, "landing")}
        >
          <div className="brand-mark">PR</div>
          <span>Pullwise</span>
        </a>
        <nav className="lp-nav">
          <a className="btn ghost sm" {...screenLinkProps(go, "landing")}>
            {T("Product", "Product")}
          </a>
          <a className="btn ghost sm" {...screenLinkProps(go, "pricing")}>
            {T("Pricing", "Pricing")}
          </a>
          <a className="btn ghost sm" {...screenLinkProps(go, "api")}>
            {T("API", "API")}
          </a>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          {signedIn ? (
            <a className="btn primary sm" {...screenLinkProps(go, "dashboard")}>
              {T("Dashboard", "Dashboard")}
            </a>
          ) : (
            <a className="btn primary sm" {...screenLinkProps(go, "login")}>
              {T("Sign in", "Sign in")}
            </a>
          )}
        </div>
      </header>

      <section className="pricing-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: "var(--accent)" }} />
          <span>{providerLabel(plan?.provider)}</span>
          <I.ArrowR size={12} />
        </div>
        <h1 className="lp-title">{T("Pricing", "Pricing")}</h1>
        <p className="lp-sub">
          {T(
            "Choose review capacity for the workspace. Billing status and invoices stay on Billing.",
            "Choose review capacity for the workspace. Billing status and invoices stay on Billing."
          )}
        </p>
        <div className="pricing-toggle" role="group" aria-label="Billing interval">
          <button
            className={"seg-i" + (interval === "month" ? " active" : "")}
            onClick={() => setInterval("month")}
          >
            <I.Clock size={13} /> Monthly
          </button>
          <button
            className={"seg-i" + (interval === "year" ? " active" : "")}
            onClick={() => setInterval("year")}
          >
            <I.Package size={13} /> Yearly <span className="pricing-save">save</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="auth-error" role="alert" style={{ maxWidth: 760, margin: "0 auto 12px" }}>
          <I.X size={13} /> {error}
        </div>
      )}

      <section className="pricing-tiers">
        <PlanCard
          plan={freePlan}
          price={priceFor(freePlan, "month")}
          interval="month"
          active={workspace.plan === "free" || !activePro}
          featured={false}
          cta={
            <a className="btn" {...screenLinkProps(go, signedIn ? "dashboard" : "login")}>
              <I.Check size={14} /> {signedIn ? "Open dashboard" : "Start free"}
            </a>
          }
        />

        <PlanCard
          plan={proPlan}
          price={selectedProPrice}
          interval={interval}
          active={activePro}
          featured
          cta={
            <div className="billing-actions">
              {activePro ? (
                <a className="btn" {...screenLinkProps(go, "billing")}>
                  <I.Settings size={14} /> Manage billing
                </a>
              ) : (
                <button
                  className="btn primary"
                  disabled={!billingEnabled || !proConfigured || Boolean(pendingAction)}
                  onClick={startCheckout}
                >
                  {pendingAction === "checkout" && (
                    <span className="spin" style={{ display: "inline-block" }}>
                      <I.Refresh size={14} />
                    </span>
                  )}
                  <I.Package size={14} /> {signedIn ? "Start Pro" : "Sign in to subscribe"}
                </button>
              )}
            </div>
          }
        />
      </section>

      {!billingEnabled && !error && (
        <div className="pricing-faq" style={{ paddingTop: 0 }}>
          <div className="muted">
            {T(
              "Billing is not configured on the backend yet.",
              "Billing is not configured on the backend yet."
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({ plan, price, interval, active, featured, cta }) {
  const reviewLimit = nonNegativeInteger(plan?.reviewLimit);
  return (
    <div className={"pricing-card" + (featured ? " featured" : "")}>
      {featured && <div className="pricing-badge">PRO</div>}
      <div className="pricing-card-h">
        <h3>{plan?.name || "Plan"}</h3>
        <div className="pricing-tag">{plan?.description || ""}</div>
      </div>
      <div className="pricing-price">
        <div className="pricing-num">
          <span>{priceLabel(price)}</span>
          <span className="pricing-per">/{interval}</span>
        </div>
        {plan?.id === "pro" && interval === "year" && (
          <div className="pricing-billed">2 months free</div>
        )}
        {active && <div className="pricing-billed">Current workspace plan</div>}
      </div>
      <ul className="pricing-feats">
        <li>
          <I.Check size={13} /> {reviewLimit} shared workspace reviews / month
        </li>
        <li>
          <I.Check size={13} /> Repository quota is shared by GitHub repo ID
        </li>
        <li>
          <I.Check size={13} /> GitHub repository review history
        </li>
        {plan?.id === "pro" && (
          <li>
            <I.Check size={13} /> Cancel from the billing portal
          </li>
        )}
      </ul>
      {cta}
    </div>
  );
}
