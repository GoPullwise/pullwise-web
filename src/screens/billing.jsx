import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { ConfirmDialog } from "../components/confirm-dialog.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { FinancialValue } from "../components/financial-value.jsx";
import { useErrorNotification } from "../components/notifications.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { pathFromScreen, screenLinkProps } from "../lib/navigation.js";
import { formatBillingTimestamp } from "../lib/billing-date.js";
import { safeBillingRedirectUrl } from "../lib/trusted-redirects.js";
import { useModalFocus } from "../lib/modal-focus.js";
import { Sidebar, Topbar } from "../shell.jsx";
import { ConsoleLayout } from "../components/console-layout.jsx";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const CHECKOUT_PENDING_TIMEOUT_MS = 15 * 1000;

function billingReturnUrl(kind, screen = "billing") {
  const url = new URL(pathFromScreen(screen), window.location.origin);
  url.searchParams.set("screen", screen);
  url.searchParams.set("billing", kind);
  return url.toString();
}

function planById(payload, id) {
  return (payload?.plans || []).find((plan) => plan.id === id) || null;
}

function priceFor(plan, interval) {
  return plan?.prices?.[interval] || null;
}

function priceLabel(price) {
  if (!price) return T("Price unavailable", "价格暂不可用");
  const amount = priceAmount(price.amount);
  if (amount == null) return T("Price unavailable", "价格暂不可用");
  if (amount === 0) return "$0";
  return `${currencySymbol(price.currency)}${amount}`;
}

function priceLabelWithInterval(plan, interval) {
  return `${priceLabel(priceFor(plan, interval))}/${intervalUnit(interval)}`;
}

function intervalUnit(interval) {
  return interval === "year" ? "year" : "month";
}

function currencySymbol(currency) {
  return String(currency || "USD").toUpperCase() === "USD" ? "$" : `${currency || "USD"} `;
}

function priceAmount(value) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value))
  )
    return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function normalizedCurrency(price) {
  return String(price?.currency || "USD").toUpperCase();
}

function formattedAmount(value) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function moneyLabel(value, currency) {
  return `${currencySymbol(currency)}${formattedAmount(Math.abs(value))}`;
}

function annualizedPriceAmount(amount, interval) {
  return interval === "year" ? amount : amount * 12;
}

function yearlySavingsLabel(plan) {
  const month = priceFor(plan, "month");
  const year = priceFor(plan, "year");
  const monthly = priceAmount(month?.amount);
  const yearly = priceAmount(year?.amount);
  if (
    !month?.configured ||
    !year?.configured ||
    monthly == null ||
    monthly <= 0 ||
    yearly == null ||
    normalizedCurrency(month) !== normalizedCurrency(year)
  )
    return "";
  const saving = monthly * 12 - yearly;
  if (saving <= 0) return "";
  if (Math.abs(saving - monthly * 2) < 0.000001) return T("2 months free", "免费 2 个月");
  return `${moneyLabel(saving, year.currency)} ${T("less per year", "每年节省")}`;
}

function billingChangeDeltaText(currentPlan, currentInterval, targetPlan, targetInterval) {
  const currentPrice = priceFor(currentPlan, currentInterval);
  const targetPrice = priceFor(targetPlan, targetInterval);
  const currentAmount = priceAmount(currentPrice?.amount);
  const targetAmount = priceAmount(targetPrice?.amount);
  if (
    currentAmount == null ||
    targetAmount == null ||
    normalizedCurrency(currentPrice) !== normalizedCurrency(targetPrice)
  ) {
    return T("Final amount is calculated by Creem.", "Final amount is calculated by Creem.");
  }

  const currency = normalizedCurrency(targetPrice);
  if (currentInterval === targetInterval) {
    const delta = targetAmount - currentAmount;
    if (delta > 0) {
      return T(
        `${moneyLabel(delta, currency)} more per ${intervalUnit(targetInterval)}`,
        `${moneyLabel(delta, currency)} more per ${intervalUnit(targetInterval)}`
      );
    }
    if (delta < 0) {
      return T(
        `${moneyLabel(delta, currency)} less per ${intervalUnit(targetInterval)}`,
        `${moneyLabel(delta, currency)} less per ${intervalUnit(targetInterval)}`
      );
    }
    return T("No listed price change.", "No listed price change.");
  }

  const annualDelta =
    annualizedPriceAmount(targetAmount, targetInterval) -
    annualizedPriceAmount(currentAmount, currentInterval);
  if (annualDelta > 0) {
    return T(
      `${moneyLabel(annualDelta, currency)} more per year`,
      `${moneyLabel(annualDelta, currency)} more per year`
    );
  }
  if (annualDelta < 0) {
    return T(
      `${moneyLabel(annualDelta, currency)} less per year`,
      `${moneyLabel(annualDelta, currency)} less per year`
    );
  }
  return T("No listed annual price change.", "No listed annual price change.");
}

function planRank(plan) {
  const ranks = { free: 0, pro: 1, max: 2 };
  if (Object.prototype.hasOwnProperty.call(ranks, plan?.id)) return ranks[plan.id];
  return 0;
}

function subscriptionChangeIsUpgrade(currentPlan, currentInterval, targetPlan, targetInterval) {
  const currentRank = planRank(currentPlan);
  const targetRank = planRank(targetPlan);
  if (targetRank > currentRank) {
    return !(currentInterval === "year" && targetInterval === "month");
  }
  return targetRank === currentRank && currentInterval === "month" && targetInterval === "year";
}

function billingChangeImpactText() {
  return T(
    "Creem may charge the prorated difference immediately. Your plan updates after payment confirmation. Final tax and proration are calculated by Creem.",
    "Creem 可能立即收取按比例计算的差额。支付确认后，套餐才会更新。最终税费与差额由 Creem 计算。"
  );
}

// Localized cadence description for the comparison card.
function intervalShortLabel(interval) {
  return interval === "year" ? T("per year", "每年") : T("per month", "每月");
}

function cadenceLabel(interval) {
  return interval === "year"
    ? T("Billed once a year", "按年计费，每年一次")
    : T("Billed every month", "按月计费，每月一次");
}

// Charge callout for the dialog — derived from the listed delta. Downgrade
// is no longer a supported flow, so this always shows the upgrade copy:
// describe a possible provider charge and keep plan activation tied to
// payment confirmation.
function chargeCallout(deltaText) {
  const noPrice =
    deltaText === T("Final amount is calculated by Creem.", "Final amount is calculated by Creem.");
  if (noPrice) {
    return {
      tone: "neutral",
      icon: I.Lightbulb,
      title: T("Final amount is calculated by Creem", "最终金额由 Creem 计算"),
      body: T(
        "Creem calculates the final charge and tax. Your plan updates after payment confirmation.",
        "Creem 计算最终扣款与税费。套餐在支付确认后更新。"
      ),
      deltaText,
      showDelta: false,
    };
  }
  return {
    tone: "charge",
    icon: I.Trend,
    title: T("Possible charge today", "今天可能产生扣款"),
    body: T(
      "Creem may charge a prorated difference immediately and may start a new billing cycle. Your plan updates after payment confirmation.",
      "Creem 可能立即按比例收取差额，并可能开始新的计费周期。支付确认后套餐才会更新。"
    ),
    deltaText,
    showDelta: true,
  };
}

// Feature deltas derived from current vs target plan — never hardcoded
function planFeatureDeltas(currentPlan, targetPlan) {
  if (!currentPlan || !targetPlan) return [];
  const rows = [];
  const currentName = planName(currentPlan);
  const targetName = planName(targetPlan);
  if (currentName && targetName && currentName !== targetName) {
    rows.push({
      key: "planName",
      label: T("Plan tier", "套餐等级"),
      before: currentName,
      after: targetName,
    });
  }
  return rows;
}

// Renewal date formatting derived from the account payload
function formatRenewalDate(value) {
  if (value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return "";
    const seconds = value > 1e12 ? Math.trunc(value / 1000) : Math.trunc(value);
    return formatBillingTimestamp(seconds).split(" ")[0];
  }
  const text = String(value).trim();
  if (!text) return "";
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return formatRenewalDate(numeric);
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) return "";
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function subscriptionChangeActionKey(targetPlan, targetInterval) {
  return `change-${targetPlan}-${targetInterval}`;
}

function isActiveStatus(status) {
  return ["active", "trialing", "canceling"].includes(String(status || "").toLowerCase());
}

function isRestoredSubscriptionStatus(status) {
  return ["active", "trialing"].includes(String(status || "").toLowerCase());
}

function subscriptionRecords(account) {
  return Array.isArray(account?.subscriptionEvents)
    ? account.subscriptionEvents.filter((record) => record && typeof record === "object")
    : [];
}

function subscriptionRecordKey(record) {
  return (
    record?.eventId ||
    record?.subscriptionId ||
    record?.customerId ||
    T("Subscription", "Subscription")
  );
}

function subscriptionRecordTitle(record) {
  return (
    record?.eventType ||
    record?.subscriptionId ||
    record?.customerId ||
    T("Subscription update", "订阅更新")
  );
}

function subscriptionRecordMeta(record) {
  const subject = record?.subscriptionId || record?.customerId || T("Subscription", "Subscription");
  return [subject, record?.status || "none", record?.interval || "month"]
    .filter(Boolean)
    .join(" - ");
}

function subscriptionEventText(record) {
  const parts = [];
  if (record?.eventId) parts.push(record.eventId);
  if (record?.eventCreated) parts.push(formatBillingTimestamp(record.eventCreated));
  else if (record?.processedAt) parts.push(formatBillingTimestamp(record.processedAt));
  if (record?.stale) parts.push(T("stale", "stale"));
  return parts.join(" - ") || T("billing update", "billing update");
}

function billingAccount(plan) {
  if (plan?.account && typeof plan.account === "object") return plan.account;
  return { status: "none", plan: "free" };
}

function fallbackFreePlan(loading = false) {
  return {
    id: "free",
    name: "Free",
    description: T("Record project and shared expenses.", "记录项目与公共支出。"),
    entitlements: null,
    loading,
    prices: { month: { amount: "0", currency: "USD", interval: "month", configured: true } },
  };
}

function fallbackPaidPlan(id, payload, loading = false) {
  const max = id === "max";
  return {
    id,
    name: max ? "Pullwise Max" : payload?.name || "Pullwise Pro",
    description:
      payload?.description ||
      (max
        ? T("Pullwise project expense ledger for teams.", "面向团队的 Pullwise 项目支出账本。")
        : T("Pullwise project expense ledger for teams.", "面向团队的 Pullwise 项目支出账本。")),
    entitlements: null,
    loading,
    prices: {
      month: {
        amount: null,
        currency: payload?.currency || "USD",
        interval: "month",
        configured: false,
      },
      year: {
        amount: null,
        currency: payload?.currency || "USD",
        interval: "year",
        configured: false,
      },
    },
  };
}

function paidPlansFromPayload(payload) {
  const plans = Array.isArray(payload?.plans) ? payload.plans : [];
  const paid = plans.filter((item) => item && item.id && item.id !== "free");
  return paid.length ? paid : [fallbackPaidPlan("pro", payload)];
}

const PRICING_PLAN_IDS = ["free", "pro", "max"];

function pricingPlanWithFallback(payload, id, loading) {
  const fallback =
    id === "free" ? fallbackFreePlan(loading) : fallbackPaidPlan(id, payload, loading);
  const loaded = planById(payload, id);
  if (!loaded) return fallback;
  return {
    ...fallback,
    ...loaded,
    loading: false,
    prices: {
      ...fallback.prices,
      ...(loaded.prices || {}),
    },
  };
}

function pricingPlansFromPayload(payload, loading = false) {
  return PRICING_PLAN_IDS.map((id) => pricingPlanWithFallback(payload, id, loading));
}

function planName(plan) {
  return plan?.name || T("Plan", "套餐");
}

function planLabel(plan) {
  return String(plan?.id || "").toUpperCase() || T("Plan", "套餐");
}

function BillingSkeleton() {
  return (
    <div className="set-body billing-skeleton" aria-busy="true">
      <div className="panel">
        <div className="billing-summary-main">
          <SkeletonLine className="sk-square sk-size-32" />
          <div className="skeleton-stack">
            <SkeletonLine className="sk-line sk-w-34 sk-h-16" />
            <SkeletonLine className="sk-line sk-w-52" />
          </div>
        </div>
        <div className="billing-actions">
          <SkeletonLine className="sk-line sk-w-26 sk-h-34" />
          <SkeletonLine className="sk-line sk-w-24 sk-h-34" />
          <SkeletonLine className="sk-line sk-w-22 sk-h-34" />
        </div>
      </div>

      <div className="panel">
        <div className="billing-summary-main">
          <SkeletonLine className="sk-square sk-size-32" />
          <SkeletonLine className="sk-line sk-w-32 sk-h-16" />
        </div>
        <div className="sub-record-list">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="sub-record-row skeleton-row" key={`billing-record-skeleton-${index}`}>
              <div className="sub-record-main">
                <SkeletonLine className="sk-line sk-w-42 sk-h-16" />
                <SkeletonLine className="sk-line sk-w-56" />
              </div>
              <SkeletonLine className="sk-line sk-w-16 sk-h-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BillingLoadError({ error, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <div className="panel-h">
        <I.Lightbulb size={16} />
        <h2>{T("Billing is unavailable", "Billing is unavailable")}</h2>
      </div>
      <p>{error || T("Unable to load billing data.", "Unable to load billing data.")}</p>
      <button type="button" className="btn" onClick={onRetry}>
        <I.Refresh size={14} /> {T("Retry billing", "Retry billing")}
      </button>
    </div>
  );
}

function PricingLoadError({ error, onRetry }) {
  return (
    <div className="notice notice-error" role="alert">
      <div className="panel-h">
        <I.Lightbulb size={18} />
        <h2>{T("Pricing is unavailable", "Pricing is unavailable")}</h2>
      </div>
      <p>{error || T("Unable to load pricing.", "Unable to load pricing.")}</p>
      <button type="button" className="btn primary" onClick={onRetry}>
        <I.Refresh size={14} /> {T("Retry pricing", "Retry pricing")}
      </button>
    </div>
  );
}

export function BillingScreen({ go, navigate = (url) => window.location.assign(url) }) {
  useLang();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  useErrorNotification(error, {
    title: T("Billing error", "Billing error"),
    key: `billing:${error}`,
  });
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState("");
  const writing = Boolean(pendingAction);
  const [changeDraft, setChangeDraft] = useState(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const billingMutationRef = useRef("");
  const mountedRef = useRef(true);
  const changeDialogRef = useRef(null);
  const changeCloseRef = useRef(null);
  const billingBackgroundRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      billingMutationRef.current = "";
    };
  }, []);

  const refreshBillingPlan = useCallback(async () => {
    const payload = await pullwiseApi.billing.getPlan();
    if (!mountedRef.current) return payload;
    setPlan(payload);
    setError("");
    return payload;
  }, []);

  const loadBillingPlan = useCallback(async () => {
    if (billingMutationRef.current) return;
    setLoading(true);
    setError("");
    try {
      const payload = await pullwiseApi.billing.getPlan();
      if (!mountedRef.current) return;
      setPlan(payload);
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Unable to load billing.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBillingPlan();
  }, [loadBillingPlan]);

  const freePlan = useMemo(() => planById(plan, "free") || fallbackFreePlan(), [plan]);
  const paidPlans = useMemo(() => paidPlansFromPayload(plan), [plan]);
  const paidPlanById = useMemo(
    () => Object.fromEntries(paidPlans.map((paidPlan) => [paidPlan.id, paidPlan])),
    [paidPlans]
  );
  const proPlan = paidPlanById.pro || fallbackPaidPlan("pro", plan);

  const account = billingAccount(plan);
  const accountStatus = account.status || "none";
  const active = isActiveStatus(accountStatus);
  const activePaid = active && account.plan && account.plan !== "free";
  const cancellationScheduled = String(accountStatus).toLowerCase() === "canceling";
  const paymentPending = Boolean(account.pendingChange);
  const subscriptionInterval = account.interval || "month";
  const currentPlan = activePaid ? paidPlanById[account.plan] || proPlan : freePlan;
  const subscriptions = subscriptionRecords(account);
  const billingEnabled = Boolean(plan?.enabled);
  const alternatePaidPlans = paidPlans.filter(
    (paidPlan) =>
      !cancellationScheduled &&
      priceFor(paidPlan, subscriptionInterval)?.configured &&
      subscriptionChangeIsUpgrade(currentPlan, subscriptionInterval, paidPlan, subscriptionInterval)
  );
  const changeDetails = useMemo(() => {
    if (!changeDraft) return null;
    const targetPlan = paidPlanById[changeDraft.targetPlan] || currentPlan;
    const targetInterval = changeDraft.targetInterval || subscriptionInterval;
    if (
      !subscriptionChangeIsUpgrade(currentPlan, subscriptionInterval, targetPlan, targetInterval)
    ) {
      return null;
    }
    const deltaText = billingChangeDeltaText(
      currentPlan,
      subscriptionInterval,
      targetPlan,
      targetInterval
    );
    return {
      currentPlan,
      currentInterval: subscriptionInterval,
      currentPrice: priceLabelWithInterval(currentPlan, subscriptionInterval),
      currentCadence: cadenceLabel(subscriptionInterval),
      currentIntervalShort: intervalShortLabel(subscriptionInterval),
      targetPlan,
      targetInterval,
      targetPrice: priceLabelWithInterval(targetPlan, targetInterval),
      targetCadence: cadenceLabel(targetInterval),
      targetIntervalShort: intervalShortLabel(targetInterval),
      deltaText,
      impactText: billingChangeImpactText(),
      callout: chargeCallout(deltaText),
      featureDeltas: planFeatureDeltas(currentPlan, targetPlan),
      renewalDate: formatRenewalDate(account.currentPeriodEnd || account.current_period_end),
      actionKey: subscriptionChangeActionKey(targetPlan.id, targetInterval),
    };
  }, [changeDraft, currentPlan, paidPlanById, subscriptionInterval, account]);

  const changeSubscription = async ({
    targetPlan = account.plan,
    targetInterval = subscriptionInterval,
  }) => {
    const requestedPlan = paidPlanById[targetPlan] || currentPlan;
    if (
      !subscriptionChangeIsUpgrade(currentPlan, subscriptionInterval, requestedPlan, targetInterval)
    ) {
      setError("This subscription change is not supported from Pullwise.");
      setChangeDraft(null);
      return;
    }
    const actionKey = subscriptionChangeActionKey(targetPlan, targetInterval);
    if (billingMutationRef.current) return;
    billingMutationRef.current = actionKey;
    setPendingAction(actionKey);
    setError("");
    try {
      const result = await pullwiseApi.billing.changeSubscriptionInterval({
        plan: targetPlan,
        interval: targetInterval,
        returnUrl: billingReturnUrl("return"),
      });
      if (!mountedRef.current) return;
      if (result?.url) {
        navigate(safeBillingRedirectUrl(result.url, "billing interval URL"));
        return;
      }
      if (result?.pending)
        setPlan((current) => ({
          ...current,
          account: {
            ...billingAccount(current),
            pendingChange: { plan: targetPlan, interval: targetInterval },
          },
        }));
      setChangeDraft(null);
      await refreshBillingPlan();
      if (!mountedRef.current) return;
      setChangeDraft(null);
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Unable to change subscription.");
    } finally {
      if (billingMutationRef.current === actionKey) billingMutationRef.current = "";
      if (mountedRef.current) {
        setPendingAction((current) => (current === actionKey ? "" : current));
      }
    }
  };

  const requestSubscriptionChange = ({
    targetPlan = account.plan,
    targetInterval = subscriptionInterval,
  }) => {
    if (billingMutationRef.current) return;
    setError("");
    const requestedPlan = paidPlanById[targetPlan] || currentPlan;
    if (
      !subscriptionChangeIsUpgrade(currentPlan, subscriptionInterval, requestedPlan, targetInterval)
    ) {
      setError("This subscription change is not supported from Pullwise.");
      setChangeDraft(null);
      return;
    }
    setChangeDraft({
      targetPlan,
      targetInterval,
    });
  };

  const closeChangeConfirmation = () => {
    if (!billingMutationRef.current) setChangeDraft(null);
  };

  useModalFocus({
    open: Boolean(changeDetails),
    dialogRef: changeDialogRef,
    initialFocusRef: changeCloseRef,
    onClose: closeChangeConfirmation,
  });

  useEffect(() => {
    if (billingBackgroundRef.current) {
      billingBackgroundRef.current.inert = Boolean(changeDetails || cancelConfirmationOpen);
    }
  }, [cancelConfirmationOpen, changeDetails]);

  const confirmSubscriptionChange = () => {
    if (!changeDetails) return;
    changeSubscription({
      targetPlan: changeDetails.targetPlan.id,
      targetInterval: changeDetails.targetInterval,
    });
  };

  const cancelSubscription = async () => {
    const actionKey = "cancel";
    if (billingMutationRef.current) return;
    billingMutationRef.current = actionKey;
    setPendingAction(actionKey);
    setError("");
    try {
      const result = await pullwiseApi.billing.cancelSubscription({
        mode: "scheduled",
        returnUrl: billingReturnUrl("return"),
      });
      if (!mountedRef.current) return;
      setPlan((current) => ({
        ...current,
        account: {
          ...(billingAccount(current) || {}),
          status: result?.status || "canceling",
          cancelAtPeriodEnd: result?.cancelAtPeriodEnd ?? true,
        },
      }));
      await refreshBillingPlan();
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Unable to cancel subscription.");
    } finally {
      if (billingMutationRef.current === actionKey) billingMutationRef.current = "";
      if (mountedRef.current) {
        setPendingAction((current) => (current === actionKey ? "" : current));
        setCancelConfirmationOpen(false);
      }
    }
  };

  const requestCancelSubscription = () => {
    if (!billingMutationRef.current && !pendingAction) setCancelConfirmationOpen(true);
  };

  const resumeSubscription = async () => {
    const actionKey = "resume";
    if (billingMutationRef.current) return;
    billingMutationRef.current = actionKey;
    setPendingAction(actionKey);
    setError("");
    try {
      const result = await pullwiseApi.billing.resumeSubscription({
        returnUrl: billingReturnUrl("return"),
      });
      if (!mountedRef.current) return;
      const nextStatus = result?.status || "active";
      const restoredSubscription = isRestoredSubscriptionStatus(nextStatus);
      setPlan((current) => ({
        ...current,
        account: {
          ...(billingAccount(current) || {}),
          plan: result?.plan || billingAccount(current)?.plan,
          interval: result?.interval || billingAccount(current)?.interval,
          status: nextStatus,
          cancelAtPeriodEnd:
            typeof result?.cancelAtPeriodEnd === "boolean"
              ? result.cancelAtPeriodEnd
              : restoredSubscription
                ? false
                : billingAccount(current)?.cancelAtPeriodEnd,
          canceledAt:
            result && Object.prototype.hasOwnProperty.call(result, "canceledAt")
              ? result.canceledAt
              : restoredSubscription
                ? null
                : billingAccount(current)?.canceledAt,
        },
      }));
      await refreshBillingPlan();
    } catch (err) {
      if (mountedRef.current) setError(err?.message || "Unable to resume subscription.");
    } finally {
      if (billingMutationRef.current === actionKey) billingMutationRef.current = "";
      if (mountedRef.current) {
        setPendingAction((current) => (current === actionKey ? "" : current));
      }
    }
  };

  return (
    <div className="app fade-in">
      <div ref={billingBackgroundRef} className="billing-background">
        <Topbar
          go={go}
          breadcrumbs={[{ label: T("Billing", "Billing") }]}
          loading={loading || writing}
          navigationDisabled={writing}
        />
        <ConsoleLayout>
          <Sidebar section="billing" go={go} navigationDisabled={writing} />
          <div className="main" role="main" aria-busy={writing}>
            <div className="page-h">
              <div>
                <h1>{T("Billing", "Billing")}</h1>
                <div className="sub">
                  {T(
                    "Pullwise platform subscription and payment history. Your project expenses are recorded separately in the ledger.",
                    "这里显示 Pullwise 平台订阅和支付历史。项目支出在账本中单独记录。"
                  )}
                </div>
              </div>
              <div className="actions">
                <a className="btn" {...screenLinkProps(go, "pricing", {}, writing)}>
                  <I.Trend size={14} /> {T("View pricing", "查看价格")}
                </a>
              </div>
            </div>

            <div className="set-shell">
              <aside className="set-side">
                <button className="set-side-i active">
                  <I.Package size={14} />
                  <span>{T("Plan", "Plan")}</span>
                </button>
                <a className="set-side-i" {...screenLinkProps(go, "terms", {}, writing)}>
                  <I.FileCode size={14} />
                  <span>{T("Terms", "Terms")}</span>
                </a>
                <a className="set-side-i" {...screenLinkProps(go, "privacy", {}, writing)}>
                  <I.Lock size={14} />
                  <span>{T("Privacy", "Privacy")}</span>
                </a>
              </aside>

              {loading ? (
                <BillingSkeleton />
              ) : error && !plan ? (
                <BillingLoadError error={error} onRetry={loadBillingPlan} />
              ) : (
                <div className="set-body">
                  <section className="panel">
                    <div className="panel-h">
                      <I.Package size={20} />
                      <h2>{T("Plan", "Plan")}</h2>
                    </div>
                    <div className="billing-summary">
                      <div className="billing-summary-main">
                        <div>
                          <b>{planName(currentPlan) || T("Free", "免费")}</b>
                          <div className="muted">
                            {accountStatus} -{" "}
                            {activePaid
                              ? T(
                                  `Billed ${subscriptionInterval}`,
                                  `按 ${subscriptionInterval} 计费`
                                )
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
                              disabled={!billingEnabled || paymentPending || Boolean(pendingAction)}
                              onClick={() =>
                                requestSubscriptionChange({
                                  targetPlan: paidPlan.id,
                                  targetInterval: subscriptionInterval,
                                })
                              }
                            >
                              {pendingAction ===
                                `change-${paidPlan.id}-${subscriptionInterval}` && (
                                <span className="spin">
                                  <I.Refresh size={14} />
                                </span>
                              )}
                              <I.Trend size={14} />{" "}
                              {T(
                                `Switch to ${planLabel(paidPlan)}`,
                                `切换到 ${planLabel(paidPlan)}`
                              )}
                            </button>
                          ))}
                          {subscriptionInterval === "month" &&
                            !cancellationScheduled &&
                            priceFor(currentPlan, "year")?.configured && (
                              <button
                                className="btn"
                                disabled={
                                  !billingEnabled || paymentPending || Boolean(pendingAction)
                                }
                                onClick={() =>
                                  requestSubscriptionChange({ targetInterval: "year" })
                                }
                              >
                                {pendingAction === `change-${account.plan}-year` && (
                                  <span className="spin">
                                    <I.Refresh size={14} />
                                  </span>
                                )}
                                <I.Package size={14} /> {T("Switch to yearly", "切换为按年")}
                              </button>
                            )}
                          {cancellationScheduled ? (
                            <button
                              className="btn"
                              disabled={!billingEnabled || paymentPending || Boolean(pendingAction)}
                              onClick={resumeSubscription}
                            >
                              {pendingAction === "resume" && (
                                <span className="spin">
                                  <I.Refresh size={14} />
                                </span>
                              )}
                              <I.Refresh size={14} /> {T("Resume renewal", "Resume renewal")}
                            </button>
                          ) : (
                            <button
                              className="btn"
                              disabled={!billingEnabled || paymentPending || Boolean(pendingAction)}
                              onClick={requestCancelSubscription}
                              aria-busy={pendingAction === "cancel"}
                            >
                              {pendingAction === "cancel" && (
                                <span className="spin">
                                  <I.Refresh size={14} />
                                </span>
                              )}
                              <I.X size={14} /> {T("Cancel renewal", "取消续订")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {(paymentPending ||
                    new URLSearchParams(window.location.search).get("billing") === "success") && (
                    <div className="notice" role="status">
                      <div>
                        <b>
                          {paymentPending || !activePaid
                            ? T("Awaiting payment confirmation", "正在等待支付确认")
                            : T("Subscription confirmed", "订阅已确认")}
                        </b>
                        <p>
                          {T(
                            "Your plan follows verified payment updates. Refresh billing to check the latest status.",
                            "套餐以验证后的支付更新为准。刷新账单以查看最新状态。"
                          )}
                        </p>
                        <button
                          className="btn"
                          disabled={loading || Boolean(pendingAction)}
                          onClick={loadBillingPlan}
                        >
                          <I.Refresh size={14} /> {T("Refresh billing", "刷新账单")}
                        </button>
                      </div>
                    </div>
                  )}

                  {subscriptions.length > 0 && (
                    <section className="panel">
                      <div className="panel-h">
                        <I.FileCode size={20} />
                        <h2>{T("Subscription activity", "订阅动态")}</h2>
                      </div>
                      <div className="sub-record-list">
                        {subscriptions.map((record, index) => (
                          <div
                            className="sub-record-row"
                            key={`${subscriptionRecordKey(record)}-${index}`}
                          >
                            <div className="sub-record-main">
                              <b>{subscriptionRecordTitle(record)}</b>
                              <div className="muted">{subscriptionRecordMeta(record)}</div>
                              <div className="muted">{subscriptionEventText(record)}</div>
                            </div>
                            <span className="tag">{record?.plan || account.plan || "free"}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {!billingEnabled && !error && (
                    <div className="muted">
                      {T(
                        "Paid subscriptions are currently unavailable.",
                        "Paid subscriptions are currently unavailable."
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ConsoleLayout>
      </div>
      {changeDetails && (
        <div className="modal-back billing-change-back" onClick={closeChangeConfirmation}>
          <div
            className="modal billing-change-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-change-title"
            ref={changeDialogRef}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-h billing-change-h">
              <div>
                <h3 id="billing-change-title">
                  <I.Package size={15} /> {T("Confirm billing change", "Confirm billing change")}
                </h3>
                <p>
                  {T(
                    "Review the plan, cadence, and billing impact before anything changes.",
                    "在变更前确认套餐、计费周期与扣款影响。"
                  )}
                </p>
              </div>
              <button
                ref={changeCloseRef}
                className="btn ghost icon"
                type="button"
                aria-label={T(
                  "Close billing change confirmation",
                  "Close billing change confirmation"
                )}
                disabled={Boolean(pendingAction)}
                onClick={closeChangeConfirmation}
              >
                <I.X size={14} />
              </button>
            </div>
            <div className="modal-body billing-change-body">
              <div className="billing-change-direction billing-change-direction-upgrade">
                {T("Upgrade", "升级")}
              </div>

              <div className="billing-change-grid">
                <div className="billing-change-box">
                  <span>{T("Current", "Current")}</span>
                  <b>{planName(changeDetails.currentPlan)}</b>
                  <em className="billing-change-price">
                    <FinancialValue
                      value={priceLabel(
                        priceFor(changeDetails.currentPlan, changeDetails.currentInterval)
                      )}
                      numeric={
                        priceAmount(
                          priceFor(changeDetails.currentPlan, changeDetails.currentInterval)?.amount
                        ) !== null
                      }
                    />
                    <span className="billing-change-period">
                      {changeDetails.currentIntervalShort}
                    </span>
                  </em>
                  <span className="billing-change-cadence">{changeDetails.currentCadence}</span>
                </div>
                <I.ArrowR className="billing-change-arrow" size={18} />
                <div className="billing-change-box billing-change-box-target">
                  <span>{T("New", "New")}</span>
                  <b>{planName(changeDetails.targetPlan)}</b>
                  <em className="billing-change-price">
                    <FinancialValue
                      value={priceLabel(
                        priceFor(changeDetails.targetPlan, changeDetails.targetInterval)
                      )}
                      numeric={
                        priceAmount(
                          priceFor(changeDetails.targetPlan, changeDetails.targetInterval)?.amount
                        ) !== null
                      }
                    />
                    <span className="billing-change-period">
                      {changeDetails.targetIntervalShort}
                    </span>
                  </em>
                  <span className="billing-change-cadence">{changeDetails.targetCadence}</span>
                </div>
              </div>

              <div className="billing-change-stats">
                <div className="billing-change-stat">
                  <span className="billing-change-stat-label">
                    <I.Clock size={13} /> {T("Billing cadence", "计费周期")}
                  </span>
                  <b>{changeDetails.targetCadence}</b>
                </div>
                <div className="billing-change-stat">
                  <span className="billing-change-stat-label">
                    <I.Refresh size={13} /> {T("Next renewal", "下次续费")}
                  </span>
                  <b>
                    {changeDetails.renewalDate || T("Calculated at confirmation", "确认时计算")}
                  </b>
                </div>
              </div>

              <div
                className={`billing-change-callout billing-change-callout-${changeDetails.callout.tone}`}
              >
                <span className="billing-change-callout-icon" aria-hidden="true">
                  <changeDetails.callout.icon size={16} />
                </span>
                <div className="billing-change-callout-text">
                  <b>{changeDetails.callout.title}</b>
                  <span>{changeDetails.callout.body}</span>
                  {changeDetails.callout.showDelta && (
                    <span className="billing-change-callout-delta">
                      {changeDetails.callout.deltaText}
                    </span>
                  )}
                </div>
              </div>

              {changeDetails.featureDeltas.length > 0 && (
                <div className="billing-change-features">
                  <div className="billing-change-features-h">
                    <I.Sliders size={13} /> {T("What changes now", "本次变更")}
                  </div>
                  <ul className="billing-change-features-list">
                    {changeDetails.featureDeltas.map((row) => (
                      <li key={row.key}>
                        <span className="billing-change-feature-label">{row.label}</span>
                        <span className="billing-change-feature-pair">
                          <span className="billing-change-feature-before">{row.before}</span>
                          <I.ArrowR size={12} className="billing-change-feature-arrow" />
                          <span className="billing-change-feature-after">{row.after}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="billing-change-how">
                <I.Shield size={14} />
                <div>
                  <b>{T("How this works", "变更说明")}</b>
                  <p>
                    {T(
                      "Your plan updates after payment confirmation. Creem calculates any immediate charge and may start a new billing cycle. Review the final amount and renewal details in Creem. You can cancel renewal from Pullwise Billing.",
                      "支付确认后套餐才会更新。Creem 计算可能立即收取的费用，并可能开始新的计费周期。请在 Creem 查看最终金额与续费详情。你可以在 Pullwise 账单页取消续订。"
                    )}
                  </p>
                </div>
              </div>

              <p className="muted billing-change-copy">
                {T(
                  "Pullwise shows listed plan prices only. Taxes, prorations, credits, and the final charge are calculated by Creem.",
                  "Pullwise shows listed plan prices only. Taxes, prorations, credits, and the final charge are calculated by Creem."
                )}
              </p>
            </div>
            <div className="modal-foot billing-change-foot">
              <button
                className="btn ghost"
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={closeChangeConfirmation}
              >
                {T("Cancel", "Cancel")}
              </button>
              <button
                className="btn primary billing-change-confirm"
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={confirmSubscriptionChange}
              >
                {pendingAction === changeDetails.actionKey && (
                  <span className="spin">
                    <I.Refresh size={14} />
                  </span>
                )}
                <I.Check size={14} /> {T("Confirm change", "Confirm change")}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={cancelConfirmationOpen}
        title={T("Cancel subscription renewal?", "Cancel subscription renewal?")}
        description={T(
          "Renewal will be canceled at the end of the current billing period. You can resume renewal later.",
          "Renewal will be canceled at the end of the current billing period. You can resume renewal later."
        )}
        confirmLabel={T("Confirm cancellation", "Confirm cancellation")}
        cancelLabel={T("Cancel", "Cancel")}
        onCancel={() => {
          if (!billingMutationRef.current) setCancelConfirmationOpen(false);
        }}
        onConfirm={cancelSubscription}
        busy={pendingAction === "cancel"}
        danger
        backgroundRef={billingBackgroundRef}
        dialogId="cancel-subscription"
      />
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
  useErrorNotification(error, {
    title: T("Pricing error", "Pricing error"),
    key: `pricing:${error}`,
  });
  const [pendingAction, setPendingAction] = useState("");
  const signedIn = Boolean(auth?.authenticated);
  const checkoutPendingRef = useRef(false);
  const checkoutTimeoutRef = useRef(null);
  const checkoutRequestRef = useRef(0);
  const checkoutAbortRef = useRef(null);

  const clearCheckoutTimeout = useCallback(() => {
    if (checkoutTimeoutRef.current == null) return;
    window.clearTimeout(checkoutTimeoutRef.current);
    checkoutTimeoutRef.current = null;
  }, []);

  const abortCheckoutRequest = useCallback(() => {
    if (checkoutAbortRef.current == null) return;
    checkoutAbortRef.current.abort();
    checkoutAbortRef.current = null;
  }, []);

  const invalidateCheckoutRequest = useCallback(() => {
    checkoutRequestRef.current += 1;
    abortCheckoutRequest();
    clearCheckoutTimeout();
  }, [abortCheckoutRequest, clearCheckoutTimeout]);

  const resetCheckoutPending = useCallback(() => {
    checkoutPendingRef.current = false;
    invalidateCheckoutRequest();
    setPendingAction("");
  }, [invalidateCheckoutRequest]);

  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) resetCheckoutPending();
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      invalidateCheckoutRequest();
    };
  }, [invalidateCheckoutRequest, resetCheckoutPending]);

  const loadPricingPlan = useCallback(async () => {
    setError("");
    try {
      const payload = await pullwiseApi.billing.getPlan();
      setPlan(payload);
      const billingInterval = payload?.account?.interval || "";
      if (billingInterval === "year") setInterval("year");
    } catch (err) {
      setError(err?.message || "Unable to load pricing.");
    }
  }, []);

  useEffect(() => {
    void loadPricingPlan();
  }, [loadPricingPlan]);

  const pricingLoading = plan === null;
  const pricingPlans = useMemo(
    () => pricingPlansFromPayload(plan, pricingLoading),
    [plan, pricingLoading]
  );
  const [freePlan, ...paidPlans] = pricingPlans;

  const account = billingAccount(plan);
  const activePaid = isActiveStatus(account.status) && account.plan && account.plan !== "free";
  const billingEnabled = Boolean(plan?.enabled);
  const checkoutPendingTimeoutMs =
    Number(plan?.checkoutTimeoutMs) > 0
      ? Number(plan.checkoutTimeoutMs)
      : CHECKOUT_PENDING_TIMEOUT_MS;
  const startCheckout = async (targetPlan) => {
    if (checkoutPendingRef.current) return;
    if (!signedIn) {
      go("login");
      return;
    }
    checkoutPendingRef.current = true;
    checkoutRequestRef.current += 1;
    abortCheckoutRequest();
    const requestId = checkoutRequestRef.current;
    const checkoutController = new AbortController();
    checkoutAbortRef.current = checkoutController;
    clearCheckoutTimeout();
    setPendingAction(`checkout-${targetPlan.id}`);
    setError("");
    checkoutTimeoutRef.current = window.setTimeout(() => {
      if (checkoutRequestRef.current !== requestId) return;
      setError(
        T(
          "Checkout is taking longer than expected. Please try again.",
          "Checkout is taking longer than expected. Please try again."
        )
      );
      resetCheckoutPending();
    }, checkoutPendingTimeoutMs);
    try {
      const session = await pullwiseApi.billing.createCheckoutSession(
        {
          plan: targetPlan.id,
          interval,
          successUrl: billingReturnUrl("success", "billing"),
          cancelUrl: billingReturnUrl("cancel", "pricing"),
        },
        { signal: checkoutController.signal }
      );
      if (checkoutRequestRef.current !== requestId) return;
      if (!session?.url) throw new Error("Billing provider did not return a checkout URL.");
      const checkoutUrl = safeBillingRedirectUrl(session.url, "billing checkout URL");
      clearCheckoutTimeout();
      checkoutPendingRef.current = false;
      setPendingAction("");
      navigate(checkoutUrl);
    } catch (err) {
      if (checkoutRequestRef.current !== requestId) return;
      setError(err?.message || "Unable to start checkout.");
      checkoutPendingRef.current = false;
      setPendingAction("");
    } finally {
      if (checkoutRequestRef.current === requestId) {
        clearCheckoutTimeout();
        if (checkoutAbortRef.current === checkoutController) checkoutAbortRef.current = null;
      }
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
            "Compare Pullwise platform subscriptions. Expenses you record in the ledger are separate from these charges.",
            "比较 Pullwise 平台订阅。你在账本中录入的支出与这些费用分开。"
          )}
        </p>
        <div className="pricing-toggle" role="group" aria-label={T("Billing interval", "计费周期")}>
          <button
            className={"seg-i" + (interval === "month" ? " active" : "")}
            disabled={Boolean(pendingAction)}
            onClick={() => {
              if (!checkoutPendingRef.current) setInterval("month");
            }}
          >
            <I.Clock size={13} /> {T("Monthly", "按月")}
          </button>
          <button
            className={"seg-i" + (interval === "year" ? " active" : "")}
            disabled={Boolean(pendingAction)}
            onClick={() => {
              if (!checkoutPendingRef.current) setInterval("year");
            }}
          >
            <I.Package size={13} /> {T("Yearly", "按年")}{" "}
          </button>
        </div>
      </section>

      {error && !plan ? (
        <section className="pricing-tiers">
          <PricingLoadError error={error} onRetry={loadPricingPlan} />
        </section>
      ) : (
        <section className="pricing-tiers">
          <PlanCard
            plan={freePlan}
            price={priceFor(freePlan, "month")}
            interval="month"
            active={account.plan === "free" || !activePaid}
            featured={false}
            cta={
              <a className="btn" {...screenLinkProps(go, signedIn ? "ledgerProjects" : "login")}>
                <I.Check size={14} />{" "}
                {signedIn ? T("Open projects", "打开项目") : T("Start free", "免费开始")}
              </a>
            }
          />

          {paidPlans.map((paidPlan) => {
            const selectedPrice = priceFor(paidPlan, interval);
            const activePlan = activePaid && account.plan === paidPlan.id;
            const canStartPlan =
              billingEnabled && Boolean(selectedPrice?.configured) && !activePaid;
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
                        <I.Settings size={14} /> {T("Open billing", "打开账单")}
                      </a>
                    ) : (
                      <button
                        className="btn primary"
                        disabled={!canStartPlan || Boolean(pendingAction)}
                        onClick={() => startCheckout(paidPlan)}
                      >
                        {pendingAction === `checkout-${paidPlan.id}` && (
                          <span className="spin">
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
      )}

      {!pricingLoading && !error && (
        <div className="pricing-faq" style={{ paddingTop: 0 }}>
          <p className="muted">
            {T(
              "Project and expense limits apply to the Owner's ledger and are shared by members and API keys. Archived projects and removed expenses still count toward capacity.",
              "项目与支出限额按所有者的账本计算，由成员及 API 密钥共同使用。已归档项目和已移除支出仍占用容量。"
            )}
          </p>
          <p className="muted">
            {T(
              "The monthly Jev allowance covers model assistance, has no cash value, and cannot pay expenses or subscription charges.",
              "Jev 月度额度用于模型辅助，没有现金价值，不能用于支付支出或订阅费用。"
            )}
          </p>
          {!billingEnabled && (
            <p className="muted">
              {T("Paid subscriptions are currently unavailable.", "付费订阅暂不可用。")}
            </p>
          )}
        </div>
      )}

      <PublicFooter go={go} current="pricing" />
    </div>
  );
}

function PricingSkeletonLine({ className = "" }) {
  return <SkeletonLine className={["pricing-skeleton", className].filter(Boolean).join(" ")} />;
}

function PlanCard({ plan, price, interval, active, featured, cta }) {
  const loading = Boolean(plan?.loading);
  const yearlySavings = interval === "year" ? yearlySavingsLabel(plan) : "";
  const limits = plan?.entitlements?.limits;
  const jev = plan?.entitlements?.jev;
  const projects =
    Number.isSafeInteger(limits?.projects) && limits.projects > 0 ? limits.projects : null;
  const records =
    Number.isSafeInteger(limits?.expenseRecords) && limits.expenseRecords > 0
      ? limits.expenseRecords
      : null;
  const jevBudget =
    jev?.eligible === true &&
    typeof jev.monthlyBudgetUsd === "string" &&
    /^\d+(?:\.\d{1,6})?$/.test(jev.monthlyBudgetUsd)
      ? jev.monthlyBudgetUsd
      : null;
  return (
    <div className={"pricing-card" + (featured ? " featured" : "")}>
      {featured && <div className="pricing-badge">{planLabel(plan)}</div>}
      <div className="pricing-card-h">
        <h3>{plan?.name || T("Plan", "套餐")}</h3>
        <div className="pricing-tag">
          {loading ? (
            <PricingSkeletonLine className="pricing-skeleton-desc" />
          ) : (
            plan?.description || ""
          )}
        </div>
      </div>
      <div className="pricing-price">
        <div className="pricing-num">
          {loading ? (
            <>
              <PricingSkeletonLine className="pricing-skeleton-price" />
              <PricingSkeletonLine className="pricing-skeleton-per" />
            </>
          ) : (
            <>
              <FinancialValue
                value={priceLabel(price)}
                numeric={priceAmount(price?.amount) !== null}
              />
              <span className="pricing-per">/{interval}</span>
            </>
          )}
        </div>
        {!loading && yearlySavings && <div className="pricing-billed">{yearlySavings}</div>}
        {active && (
          <div className="pricing-billed">{T("Current account plan", "当前账户套餐")}</div>
        )}
      </div>
      <ul className="pricing-feats">
        {!loading && projects !== null && (
          <li>
            <I.Check size={13} />
            <span>
              {T("Projects", "项目")}: <FinancialValue value={projects.toLocaleString("en-US")} />
            </span>
          </li>
        )}
        {!loading && records !== null && (
          <li>
            <I.Check size={13} />
            <span>
              {T("Expense records", "支出记录")}:{" "}
              <FinancialValue value={records.toLocaleString("en-US")} />
            </span>
          </li>
        )}
        {!loading && jev?.eligible === false && (
          <li>
            <I.Check size={13} /> {T("Jev: not included", "不含 Jev")}
          </li>
        )}
        {!loading && jevBudget !== null && (
          <>
            <li>
              <I.Check size={13} />{" "}
              {T("Automatic Jev assistance when saving expenses", "保存支出时自动享受 Jev 加持")}
            </li>
            <li>
              <I.Check size={13} />{" "}
              {T(
                "Automatic categorization and expense advice · Web + REST API",
                "自动分类与支出建议 · 网页及 REST API"
              )}
            </li>
            <li>
              <I.Check size={13} />
              <span>
                {T("Jev assistance allowance", "Jev 辅助额度")}:{" "}
                <FinancialValue value={`$${jevBudget}`} /> / {T("month", "月")}
              </span>
            </li>
            <li>
              <I.Check size={13} />{" "}
              {jev.available === true
                ? T("Monthly UTC budget · no rollover", "UTC 自然月预算 · 不结转")
                : T("Activation pending · no rollover", "待启用 · 不结转")}
            </li>
            <li>
              <I.Check size={13} />{" "}
              {T(
                "Annual subscriptions keep the same monthly Jev budget",
                "年订阅也按同样的月度 Jev 预算计算"
              )}
            </li>
          </>
        )}
        <li>
          <I.Check size={13} />{" "}
          {loading ? (
            <PricingSkeletonLine className="pricing-skeleton-feature" />
          ) : (
            T("Project and shared expense ledger", "项目与公共支出账本")
          )}
        </li>
        <li>
          <I.Check size={13} />{" "}
          {loading ? (
            <PricingSkeletonLine className="pricing-skeleton-feature" />
          ) : (
            T("Per-currency reports and REST API", "逐币报表与 REST API")
          )}
        </li>
        <li>
          <I.Check size={13} />{" "}
          {T("Platform charges stay separate from ledger expenses", "平台收费与账本支出分开")}
        </li>
        {plan?.id && plan.id !== "free" && (
          <li>
            <I.Check size={13} /> {T("Cancel renewal from Billing", "从账单页取消续订")}
          </li>
        )}
      </ul>
      {cta}
    </div>
  );
}
