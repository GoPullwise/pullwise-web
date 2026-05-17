import { useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";

function providerLabel(provider) {
  if (provider === "stripe") return "Stripe";
  if (provider === "creem") return "Creem";
  return "Disabled";
}

function billingReturnUrl(kind) {
  const url = new URL(window.location.href);
  url.searchParams.set("screen", "billing");
  url.searchParams.set("billing", kind);
  return url.toString();
}

export function BillingScreen({ go, navigate = (url) => window.location.assign(url) }) {
  useLang();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  useEffect(() => {
    let cancelled = false;
    pullwiseApi.billing.getPlan()
      .then((payload) => {
        if (!cancelled) {
          setPlan(payload);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load billing.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startCheckout = async () => {
    setPendingAction("checkout");
    setError("");
    try {
      const session = await pullwiseApi.billing.createCheckoutSession({
        successUrl: billingReturnUrl("success"),
        cancelUrl: billingReturnUrl("cancel"),
      });
      if (!session?.url) throw new Error("Billing provider did not return a checkout URL.");
      navigate(session.url);
    } catch (err) {
      setError(err?.message || "Unable to start checkout.");
      setPendingAction("");
    }
  };

  const openPortal = async () => {
    setPendingAction("portal");
    setError("");
    try {
      const session = await pullwiseApi.billing.createPortalSession({
        returnUrl: billingReturnUrl("return"),
      });
      if (!session?.url) throw new Error("Billing provider did not return a portal URL.");
      navigate(session.url);
    } catch (err) {
      setError(err?.message || "Unable to open billing portal.");
      setPendingAction("");
    }
  };

  const provider = providerLabel(plan?.provider);
  const accountStatus = plan?.account?.status || "none";
  const active = accountStatus === "active" || accountStatus === "trialing";
  const price = plan?.amount ? `${plan.currency || "USD"} ${plan.amount}` : T("Configured in provider", "在支付平台配置");

  return (
    <div className="app fade-in">
      <Topbar go={go} breadcrumbs={[
        { label: "Pullwise", go: "dashboard" },
        { label: T("Billing", "支付") },
      ]} />
      <div className="with-side">
        <Sidebar section="billing" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Billing", "支付")}</h1>
              <div className="sub">{T("Subscriptions are created by the backend billing provider.", "订阅由后端支付服务创建。")}</div>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>
              <I.X size={13} /> {error}
            </div>
          )}

          <div className="set-shell">
            <aside className="set-side">
              <button className="set-side-i active"><I.Package size={14} /><span>{T("Plan", "套餐")}</span></button>
              <button className="set-side-i" onClick={() => go("terms")}><I.FileCode size={14} /><span>{T("Terms", "条款")}</span></button>
              <button className="set-side-i" onClick={() => go("privacy")}><I.Lock size={14} /><span>{T("Privacy", "隐私")}</span></button>
            </aside>

            <div className="set-body">
              <div className="card section">
                <div className="section-h">
                  <h3>{plan?.name || T("Loading plan", "正在加载套餐")}</h3>
                  <span className="tag">{provider}</span>
                </div>
                <div className="int-row">
                  <I.Package size={20} />
                  <div style={{ flex: 1 }}>
                    <b>{plan?.name || "Pullwise Pro"}</b>
                    <div className="muted">{plan?.description || T("Real repository review with GitHub and Codex.", "通过 GitHub 与 Codex 审核真实仓库。")}</div>
                  </div>
                  <span className="pricing-num" style={{ fontSize: 24 }}>{price}</span>
                  <span className="pricing-per">/{plan?.interval || "month"}</span>
                </div>
                <div className="int-row">
                  <I.Activity size={20} />
                  <div style={{ flex: 1 }}>
                    <b>{T("Account status", "账户状态")}</b>
                    <div className="muted">{active ? T("Your subscription is active.", "订阅已激活。") : T("No active subscription yet.", "尚无有效订阅。")}</div>
                  </div>
                  <span className="tag">{accountStatus}</span>
                  {active ? (
                    <button className="btn primary" disabled={Boolean(pendingAction)} onClick={openPortal}>
                      {pendingAction === "portal" && <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>}
                      {T("Manage billing", "管理支付")}
                    </button>
                  ) : (
                    <button className="btn primary" disabled={!plan?.enabled || Boolean(pendingAction)} onClick={startCheckout}>
                      {pendingAction === "checkout" && <span className="spin" style={{ display: "inline-block" }}><I.Refresh size={14} /></span>}
                      {T("Start checkout", "开始支付")}
                    </button>
                  )}
                </div>
                {!plan?.enabled && !error && (
                  <div className="muted" style={{ marginTop: 12 }}>
                    {T("Billing is not configured on the backend yet.", "后端尚未配置支付。")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
