import { useEffect, useMemo, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { quotaResetText } from "../lib/quota-display.js";
import { safeBillingRedirectUrl } from "../lib/trusted-redirects.js";
import { Sidebar, Topbar } from "../shell.jsx";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

function billingReturnUrl(kind, screen = "billing") {
  const url = new URL(window.location.href);
  url.searchParams.set("screen", screen);
  url.searchParams.set("billing", kind);
  return url.toString();
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
  return T(`${used} / ${limit} reviews used`, `${used} / ${limit} 次审查已用`);
}

function subscriptionRecords(account) {
  return Array.isArray(account?.subscriptions)
    ? account.subscriptions.filter((record) => record && typeof record === "object")
    : [];
}

function subscriptionRecordId(record) {
  return record?.subscriptionId || record?.customerId || T("Subscription", "Subscription");
}

function subscriptionRecordMeta(record) {
  return [record?.status || "none", record?.interval || "month"].filter(Boolean).join(" - ");
}

function subscriptionEventText(record) {
  const event = record?.lastEventType || T("billing update", "billing update");
  return record?.lastEventId ? `${event} - ${record.lastEventId}` : event;
}

function billingAccount(plan) {
  if (plan?.account && typeof plan.account === "object") return plan.account;
  return { status: "none", plan: "free" };
}

function fallbackPaidPlan(id, payload) {
  const max = id === "max";
  return {
    id,
    name: max ? "Pullwise Max" : payload?.name || "Pullwise Pro",
    description:
      payload?.description ||
      (max
        ? T("Higher-capacity repository review for production teams.", "Higher-capacity repository review for production teams.")
        : T("Repository review for production teams.", "面向生产团队的仓库审查。")),
    reviewLimit: max ? 90 : 60,
    prices: {
      month: {
        amount: max ? null : payload?.amount || "29",
        currency: payload?.currency || "USD",
        interval: "month",
        configured: Boolean(payload?.enabled) && !max,
      },
      year: {
        amount: max ? null : "290",
        currency: payload?.currency || "USD",
        interval: "year",
        configured: Boolean(payload?.enabled) && !max,
      },
    },
  };
}

function paidPlansFromPayload(payload) {
  const plans = Array.isArray(payload?.plans) ? payload.plans : [];
  const paid = plans.filter((item) => item && item.id && item.id !== "free");
  return paid.length ? paid : [fallbackPaidPlan("pro", payload)];
}

function planName(plan) {
  return plan?.name || T("Plan", "套餐");
}

function planLabel(plan) {
  return String(plan?.id || "").toUpperCase() || T("Plan", "套餐");
}

function accountNameLabel(plan) {
  return plan?.account?.name || T("Account", "账户");
}

export function BillingScreen({
  go,
  setIssue = null,
  navigate = (url) => window.location.assign(url),
}) {
  useLang();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pullwiseApi.billing
      .getPlan()
      .then((payload) => {
        if (cancelled) return;
        setPlan(payload);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load billing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
        description: T(
          "Try Pullwise with shared account and repository quota.",
          "使用共享账户和仓库配额试用 Pullwise。"
        ),
        reviewLimit: 10,
        prices: { month: { amount: "0", currency: "USD", interval: "month", configured: true } },
      },
    [plan]
  );
  const paidPlans = useMemo(() => paidPlansFromPayload(plan), [plan]);
  const paidPlanById = useMemo(
    () => Object.fromEntries(paidPlans.map((paidPlan) => [paidPlan.id, paidPlan])),
    [paidPlans]
  );
  const proPlan = paidPlanById.pro || fallbackPaidPlan("pro", plan);

  const account = billingAccount(plan);
  const accountStatus = account.status || "none";
  const accountName = accountNameLabel(plan);
  const active = isActiveStatus(accountStatus);
  const activePaid = active && account.plan && account.plan !== "free";
  const subscriptionInterval = account.interval || "month";
  const currentPlan = activePaid ? paidPlanById[account.plan] || proPlan : freePlan;
  const usage = account.usage || {
    used: 0,
    limit: activePaid ? currentPlan.reviewLimit : freePlan.reviewLimit,
    remaining: activePaid ? currentPlan.reviewLimit : freePlan.reviewLimit,
    period: "",
  };
  const subscriptions = subscriptionRecords(account);
  const usageResetText = quotaResetText(usage, "Monthly quota resets");
  const billingEnabled = Boolean(plan?.enabled);
  const alternatePaidPlans = paidPlans.filter((paidPlan) => paidPlan.id !== account.plan);

  const openPortal = async () => {
    setPendingAction("portal");
    setError("");
    try {
      const session = await pullwiseApi.billing.createPortalSession({
        returnUrl: billingReturnUrl("return"),
      });
      if (!session?.url) throw new Error("Billing provider did not return a portal URL.");
      navigate(safeBillingRedirectUrl(session.url, "billing portal URL"));
    } catch (err) {
      setError(err?.message || "Unable to open billing portal.");
      setPendingAction("");
    }
  };

  const changeSubscription = async ({ targetPlan = account.plan, targetInterval = subscriptionInterval }) => {
    const actionKey = `change-${targetPlan}-${targetInterval}`;
    setPendingAction(actionKey);
    setError("");
    try {
      const result = await pullwiseApi.billing.changeSubscriptionInterval({
        plan: targetPlan,
        interval: targetInterval,
        returnUrl: billingReturnUrl("return"),
      });
      if (result?.url) {
        navigate(safeBillingRedirectUrl(result.url, "billing interval URL"));
        return;
      }
      const nextPlan = result?.plan || targetPlan;
      const nextInterval = result?.interval || targetInterval;
      setPlan((current) => ({
        ...current,
        account: {
          ...(billingAccount(current) || {}),
          plan: nextPlan,
          interval: nextInterval,
          status: result?.status || accountStatus,
        },
      }));
      setPendingAction("");
    } catch (err) {
      setError(err?.message || "Unable to change subscription.");
      setPendingAction("");
    }
  };

  const cancelSubscription = async () => {
    setPendingAction("cancel");
    setError("");
    try {
      const result = await pullwiseApi.billing.cancelSubscription({
        mode: "scheduled",
        returnUrl: billingReturnUrl("return"),
      });
      if (result?.url) {
        navigate(safeBillingRedirectUrl(result.url, "billing portal URL"));
        return;
      }
      setPlan((current) => ({
        ...current,
        account: {
          ...(billingAccount(current) || {}),
          status: result?.status || "canceling",
          cancelAtPeriodEnd: result?.cancelAtPeriodEnd ?? true,
        },
      }));
      setPendingAction("");
    } catch (err) {
      setError(err?.message || "Unable to cancel subscription.");
      setPendingAction("");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Billing", "Billing") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="billing" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Billing", "Billing")}</h1>
              <div className="sub">
                {T(
                  "Account billing status, usage, and provider actions.",
                  "Account billing status, usage, and provider actions."
                )}
              </div>
            </div>
            <div className="actions">
              <a className="btn" {...screenLinkProps(go, "pricing")}>
                <I.Trend size={14} /> {T("View pricing", "查看价格")}
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
                    <b>{T("Account usage", "账户用量")}</b>
                    <div className="muted">
                      {accountName} - {usageText(usage)}
                    </div>
                    {usageResetText && <div className="muted">{usageResetText}</div>}
                  </div>
                </div>
                <div className="billing-summary-meter">
                  <div className="usage-bar">
                    <div style={{ width: `${usagePercent(usage)}%` }} />
                  </div>
                  <span className="tag">{currentPlan?.name || T("Plan", "套餐")}</span>
                </div>
              </div>

              <div className="bill-card billing-summary">
                <div className="billing-summary-main">
                  <I.Package size={18} />
                  <div>
                    <b>{planName(currentPlan) || T("Free", "免费")}</b>
                    <div className="muted">
                      {accountStatus} -{" "}
                      {activePaid
                        ? T(`Billed ${subscriptionInterval}`, `按 ${subscriptionInterval} 计费`)
                        : T("Upgrade from Pricing", "前往价格页升级")}
                    </div>
                  </div>
                </div>
                {activePaid && (
                  <div className="billing-actions">
                    {alternatePaidPlans.map((paidPlan) => (
                      <button
                        key={paidPlan.id}
                        className="btn primary"
                        disabled={Boolean(pendingAction)}
                        onClick={() =>
                          changeSubscription({
                            targetPlan: paidPlan.id,
                            targetInterval: subscriptionInterval,
                          })
                        }
                      >
                        {pendingAction === `change-${paidPlan.id}-${subscriptionInterval}` && (
                          <span className="spin" style={{ display: "inline-block" }}>
                            <I.Refresh size={14} />
                          </span>
                        )}
                        <I.Trend size={14} /> {T(`Switch to ${planLabel(paidPlan)}`, `切换到 ${planLabel(paidPlan)}`)}
                      </button>
                    ))}
                    {subscriptionInterval === "month" ? (
                      <button
                        className="btn"
                        disabled={Boolean(pendingAction)}
                        onClick={() => changeSubscription({ targetInterval: "year" })}
                      >
                        {pendingAction === `change-${account.plan}-year` && (
                          <span className="spin" style={{ display: "inline-block" }}>
                            <I.Refresh size={14} />
                          </span>
                        )}
                        <I.Package size={14} /> {T("Switch to yearly", "切换为按年")}
                      </button>
                    ) : (
                      <button
                        className="btn"
                        disabled={Boolean(pendingAction)}
                        onClick={() => changeSubscription({ targetInterval: "month" })}
                      >
                        {pendingAction === `change-${account.plan}-month` && (
                          <span className="spin" style={{ display: "inline-block" }}>
                            <I.Refresh size={14} />
                          </span>
                        )}
                        <I.Clock size={14} /> {T("Switch to monthly", "切换为按月")}
                      </button>
                    )}
                    <button className="btn" disabled={Boolean(pendingAction)} onClick={openPortal}>
                      {pendingAction === "portal" && (
                        <span className="spin" style={{ display: "inline-block" }}>
                          <I.Refresh size={14} />
                        </span>
                      )}
                      <I.Settings size={14} /> {T("Manage billing", "管理账单")}
                    </button>
                    {accountStatus !== "canceling" && (
                      <button
                        className="btn"
                        disabled={Boolean(pendingAction)}
                        onClick={cancelSubscription}
                      >
                        {pendingAction === "cancel" && (
                          <span className="spin" style={{ display: "inline-block" }}>
                            <I.Refresh size={14} />
                          </span>
                        )}
                        <I.X size={14} /> {T("Cancel renewal", "取消续订")}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {subscriptions.length > 0 && (
                <div className="bill-card bill-card-list">
                  <div className="billing-summary-main">
                    <I.FileCode size={18} />
                    <div>
                      <b>{T("Subscription records", "Subscription records")}</b>
                    </div>
                  </div>
                  <div className="sub-record-list">
                    {subscriptions.map((record, index) => (
                      <div
                        className="sub-record-row"
                        key={`${subscriptionRecordId(record)}-${index}`}
                      >
                        <div className="sub-record-main">
                          <b>{subscriptionRecordId(record)}</b>
                          <div className="muted">{subscriptionRecordMeta(record)}</div>
                          <div className="muted">{subscriptionEventText(record)}</div>
                        </div>
                        <span className="tag">{record?.plan || account.plan || "free"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
        const billingInterval = payload?.account?.interval || "";
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
        description: T(
          "Try Pullwise with shared account and repository quota.",
          "使用共享账户和仓库配额试用 Pullwise。"
        ),
        reviewLimit: 10,
        prices: { month: { amount: "0", currency: "USD", interval: "month", configured: true } },
      },
    [plan]
  );
  const paidPlans = useMemo(() => paidPlansFromPayload(plan), [plan]);

  const account = billingAccount(plan);
  const activePaid = isActiveStatus(account.status) && account.plan && account.plan !== "free";
  const billingEnabled = Boolean(plan?.enabled);

  const startCheckout = async (targetPlan) => {
    if (!signedIn) {
      go("login");
      return;
    }
    setPendingAction(`checkout-${targetPlan.id}`);
    setError("");
    try {
      const session = await pullwiseApi.billing.createCheckoutSession({
        plan: targetPlan.id,
        interval,
        successUrl: billingReturnUrl("success", "pricing"),
        cancelUrl: billingReturnUrl("cancel", "pricing"),
      });
      if (!session?.url) throw new Error("Billing provider did not return a checkout URL.");
      navigate(safeBillingRedirectUrl(session.url, "billing checkout URL"));
    } catch (err) {
      setError(err?.message || "Unable to start checkout.");
      setPendingAction("");
    }
  };

  return (
    <div className="landing fade-in">
      <PublicHeader go={go} current="pricing" auth={auth} />

      <section className="pricing-hero">
        <div className="lp-hero-tag">
          <span className="dot" style={{ background: "var(--accent)" }} />
          <span>{T("Account plans", "Account plans")}</span>
          <I.ArrowR size={12} />
        </div>
        <h1 className="lp-title">{T("Pricing", "Pricing")}</h1>
        <p className="lp-sub">
          {T(
            "Choose review capacity for the account. Billing status and invoices stay on Billing.",
            "Choose review capacity for the account. Billing status and invoices stay on Billing."
          )}
        </p>
        <div className="pricing-toggle" role="group" aria-label={T("Billing interval", "计费周期")}>
          <button
            className={"seg-i" + (interval === "month" ? " active" : "")}
            onClick={() => setInterval("month")}
          >
            <I.Clock size={13} /> {T("Monthly", "按月")}
          </button>
          <button
            className={"seg-i" + (interval === "year" ? " active" : "")}
            onClick={() => setInterval("year")}
          >
            <I.Package size={13} /> {T("Yearly", "按年")}{" "}
            <span className="pricing-save">{T("save", "节省")}</span>
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
          active={account.plan === "free" || !activePaid}
          featured={false}
          cta={
            <a className="btn" {...screenLinkProps(go, signedIn ? "dashboard" : "login")}>
              <I.Check size={14} />{" "}
              {signedIn ? T("Open dashboard", "打开工作台") : T("Start free", "免费开始")}
            </a>
          }
        />

        {paidPlans.map((paidPlan) => {
          const selectedPrice = priceFor(paidPlan, interval);
          const activePlan = activePaid && account.plan === paidPlan.id;
          const canStartPlan = billingEnabled && Boolean(selectedPrice?.configured) && !activePaid;
          const hasMax = paidPlans.some((candidate) => candidate.id === "max");
          return (
            <PlanCard
              key={paidPlan.id}
              plan={paidPlan}
              price={selectedPrice}
              interval={interval}
              active={activePlan}
              featured={hasMax ? paidPlan.id === "max" : paidPlan.id === "pro"}
              cta={
                <div className="billing-actions">
                  {activePaid ? (
                    <a className="btn" {...screenLinkProps(go, "billing")}>
                      <I.Settings size={14} /> {T("Manage billing", "管理账单")}
                    </a>
                  ) : (
                    <button
                      className="btn primary"
                      disabled={!canStartPlan || Boolean(pendingAction)}
                      onClick={() => startCheckout(paidPlan)}
                    >
                      {pendingAction === `checkout-${paidPlan.id}` && (
                        <span className="spin" style={{ display: "inline-block" }}>
                          <I.Refresh size={14} />
                        </span>
                      )}
                      <I.Package size={14} />{" "}
                      {signedIn
                        ? T(`Start ${planLabel(paidPlan)}`, `升级 ${planLabel(paidPlan)}`)
                        : T("Sign in to subscribe", "登录后订阅")}
                    </button>
                  )}
                </div>
              }
            />
          );
        })}
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

      <PublicFooter go={go} current="pricing" />
    </div>
  );
}

function PlanCard({ plan, price, interval, active, featured, cta }) {
  const reviewLimit = nonNegativeInteger(plan?.reviewLimit);
  return (
    <div className={"pricing-card" + (featured ? " featured" : "")}>
      {featured && <div className="pricing-badge">{planLabel(plan)}</div>}
      <div className="pricing-card-h">
        <h3>{plan?.name || T("Plan", "套餐")}</h3>
        <div className="pricing-tag">{plan?.description || ""}</div>
      </div>
      <div className="pricing-price">
        <div className="pricing-num">
          <span>{priceLabel(price)}</span>
          <span className="pricing-per">/{interval}</span>
        </div>
        {plan?.id === "pro" && interval === "year" && (
          <div className="pricing-billed">{T("2 months free", "免费 2 个月")}</div>
        )}
        {active && (
          <div className="pricing-billed">{T("Current account plan", "当前账户套餐")}</div>
        )}
      </div>
      <ul className="pricing-feats">
        <li>
          <I.Check size={13} />{" "}
          {T(
            `${reviewLimit} shared account reviews / month`,
            `${reviewLimit} 次/月 共享账户审查`
          )}
        </li>
        <li>
          <I.Check size={13} />{" "}
          {T(
            "Repository quota is shared by GitHub repo ID",
            "仓库配额按 GitHub repo ID 共享"
          )}
        </li>
        <li>
          <I.Check size={13} />{" "}
          {T("GitHub repository review history", "GitHub 仓库审查历史")}
        </li>
        {plan?.id && plan.id !== "free" && (
          <li>
            <I.Check size={13} />{" "}
            {T("Cancel from the billing portal", "从账单门户取消")}
          </li>
        )}
      </ul>
      {cta}
    </div>
  );
}
