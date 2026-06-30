import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { SkeletonLine } from "../components/skeleton.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { formatQuotaResetAt, quotaResetText } from "../lib/quota-display.js";
import { safeBillingRedirectUrl } from "../lib/trusted-redirects.js";
import { Sidebar, Topbar } from "../shell.jsx";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const CHECKOUT_PENDING_TIMEOUT_MS = 15 * 1000;

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
  return nonNegativeInteger(plan?.reviewLimit);
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
    "Your plan changes now. Creem may charge the prorated difference immediately. Final tax and proration are calculated by Creem.",
    "Your plan changes now. Creem may charge the prorated difference immediately. Final tax and proration are calculated by Creem."
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
// charge prorated diff now, new plan effective immediately, new amount on
// the next renewal date.
function chargeCallout(deltaText) {
  const noPrice =
    deltaText === T("Final amount is calculated by Creem.", "Final amount is calculated by Creem.");
  if (noPrice) {
    return {
      tone: "neutral",
      icon: I.Lightbulb,
      title: T("Final amount is calculated by Creem", "最终金额由 Creem 计算"),
      body: T(
        "Listed prices and tax are shown by Pullwise. The exact charge for this change is calculated by Creem at confirmation.",
        "标价和税费由 Pullwise 显示。本次变更的最终扣款金额在确认时由 Creem 计算。"
      ),
      deltaText,
      showDelta: false,
    };
  }
  return {
    tone: "charge",
    icon: I.Trend,
    title: T("Prorated charge today", "今天按比例扣款"),
    body: T(
      "The new plan is effective now. Creem charges the prorated difference for the rest of the current period, and the new amount is billed on the next renewal date.",
      "新套餐立即生效。Creem 会按当前周期剩余时间收取差额，并在下个续费日按新价格计费。"
    ),
    deltaText,
    showDelta: true,
  };
}

// Feature deltas derived from current vs target plan — never hardcoded
function planFeatureDeltas(currentPlan, targetPlan) {
  if (!currentPlan || !targetPlan) return [];
  const rows = [];
  const currentLimit = nonNegativeInteger(currentPlan.reviewLimit);
  const targetLimit = nonNegativeInteger(targetPlan.reviewLimit);
  if (currentLimit !== targetLimit) {
    rows.push({
      key: "reviewLimit",
      label: T("Shared account reviews / month", "共享账户审查 / 月"),
      before: T(`${currentLimit} reviews`, `${currentLimit} 次审查`),
      after: T(`${targetLimit} reviews`, `${targetLimit} 次审查`),
    });
  }
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
    return formatQuotaResetAt(seconds).split(" ")[0];
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

function nonNegativeInteger(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.trunc(number));
}

function repositoryLimitsForPlan(plan) {
  const limits = plan?.repositoryLimits || plan?.repository_limits || null;
  if (!limits || typeof limits !== "object") return null;
  const maxFiles = nonNegativeInteger(limits.maxFiles ?? limits.max_files);
  const maxBytes = nonNegativeInteger(limits.maxBytes ?? limits.max_bytes);
  return maxFiles || maxBytes ? { maxFiles, maxBytes } : null;
}

function formatCompactBytes(value) {
  const bytes = nonNegativeInteger(value);
  if (!bytes) return "";
  const mib = 1024 * 1024;
  const kib = 1024;
  if (bytes >= mib && bytes % mib === 0) return `${bytes / mib} MB`;
  if (bytes >= kib && bytes % kib === 0) return `${bytes / kib} KB`;
  return `${bytes.toLocaleString("en-US")} bytes`;
}

function repositoryCheckoutFeatureText(plan) {
  const limits = repositoryLimitsForPlan(plan);
  if (!limits) return "";
  const parts = [];
  if (limits.maxFiles) parts.push(`${limits.maxFiles.toLocaleString("en-US")} files`);
  if (limits.maxBytes) parts.push(formatCompactBytes(limits.maxBytes));
  return T(
    `Repository checkout up to ${parts.join(" / ")}`,
    `仓库 checkout 最高 ${parts.join(" / ")}`
  );
}

function usagePercent(usage) {
  const limit = nonNegativeInteger(usage?.limit);
  if (!limit) return 0;
  return Math.min(100, (nonNegativeInteger(usage?.used) / limit) * 100);
}

function usageText(usage) {
  const used = nonNegativeInteger(usage?.used);
  const reserved = nonNegativeInteger(usage?.reserved);
  const limit = nonNegativeInteger(usage?.limit);
  const base = T(`${used} / ${limit} reviews used`, `${used} / ${limit} reviews used`);
  if (!reserved) return base;
  return T(`${base} - ${reserved} pending`, `${base} - ${reserved} pending`);
  // eslint-disable-next-line no-unreachable
  return T(`${used} / ${limit} reviews used`, `${used} / ${limit} 次审查已用`);
}

function quotaActivityRecords(account) {
  return Array.isArray(account?.quotaActivity)
    ? account.quotaActivity.filter(
        (record) => record && typeof record === "object" && record.scanId
      )
    : [];
}

function quotaActivityRecordKey(record, index) {
  return record?.id || `${record?.scanId || "scan"}-${record?.action || "quota"}-${index}`;
}

function quotaActivityAction(record) {
  return ["reserved", "released", "refunded"].includes(record?.action) ? record.action : "consumed";
}

function quotaActivityTitle(record) {
  const action = quotaActivityAction(record);
  if (action === "refunded") return T("Quota refunded", "Quota refunded");
  if (action === "reserved") return T("Quota reserved", "Quota reserved");
  if (action === "released") return T("Reservation released", "Reservation released");
  return T("Quota consumed", "Quota consumed");
  // eslint-disable-next-line no-unreachable
  return quotaActivityAction(record) === "refunded"
    ? T("Quota refunded", "配额已回退")
    : T("Quota consumed", "配额已消耗");
}

function quotaActivityAmountText(record) {
  const amount = nonNegativeInteger(record?.amount || Math.abs(Number(record?.delta || 0))) || 1;
  const action = quotaActivityAction(record);
  if (action === "refunded") return T(`+${amount} quota`, `+${amount} quota`);
  if (action === "released") return T(`+${amount} pending`, `+${amount} pending`);
  if (action === "reserved") return T(`-${amount} pending`, `-${amount} pending`);
  return T(`-${amount} quota`, `-${amount} quota`);
  // eslint-disable-next-line no-unreachable
  return quotaActivityAction(record) === "refunded"
    ? T(`+${amount} quota`, `+${amount} 配额`)
    : T(`-${amount} quota`, `-${amount} 配额`);
}

function quotaActivityReasonText(reason) {
  const text = String(reason || "").trim();
  if (!text) return "";
  return text.replace(/[_-]+/g, " ").toLowerCase();
}

function quotaActivityMeta(record) {
  return [
    record?.repo,
    record?.branch,
    record?.commit && record.commit !== "pending" ? record.commit : "",
    record?.status,
  ]
    .filter(Boolean)
    .join(" - ");
}

function quotaActivityEventText(record) {
  const parts = [];
  if (record?.requestId) parts.push(record.requestId);
  const reason = quotaActivityReasonText(record?.reason);
  if (reason && reason !== "scan created") parts.push(reason);
  if (record?.eventAt) parts.push(formatQuotaResetAt(record.eventAt));
  return parts.join(" - ");
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
  if (record?.eventCreated) parts.push(formatQuotaResetAt(record.eventCreated));
  else if (record?.processedAt) parts.push(formatQuotaResetAt(record.processedAt));
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
    description: T(
      "Try Pullwise with shared account and repository quota.",
      "使用共享账户和仓库配额试用 Pullwise。"
    ),
    reviewLimit: 10,
    repositoryLimits: { maxFiles: 200, maxBytes: 5 * 1024 * 1024 },
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
        ? T(
            "Higher-capacity repository review for production teams.",
            "Higher-capacity repository review for production teams."
          )
        : T("Repository review for production teams.", "面向生产团队的仓库审查。")),
    reviewLimit: max ? 90 : 60,
    repositoryLimits: max
      ? { maxFiles: 2000, maxBytes: 50 * 1024 * 1024 }
      : { maxFiles: 1000, maxBytes: 20 * 1024 * 1024 },
    loading,
    prices: {
      month: {
        amount: max ? null : payload?.amount || "29",
        currency: payload?.currency || "USD",
        interval: "month",
        configured: !loading && Boolean(payload?.enabled) && !max,
      },
      year: {
        amount: max ? null : "290",
        currency: payload?.currency || "USD",
        interval: "year",
        configured: !loading && Boolean(payload?.enabled) && !max,
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

function accountNameLabel(plan) {
  return plan?.account?.name || T("Account", "账户");
}

function BillingSkeleton() {
  return (
    <div className="set-body billing-skeleton" aria-busy="true">
      <div className="bill-card billing-summary">
        <div className="billing-summary-main">
          <SkeletonLine className="sk-square sk-size-32" />
          <div className="skeleton-stack">
            <SkeletonLine className="sk-line sk-w-30 sk-h-16" />
            <SkeletonLine className="sk-line sk-w-60" />
            <SkeletonLine className="sk-line sk-w-44" />
          </div>
        </div>
        <div className="billing-summary-meter">
          <SkeletonLine className="sk-line sk-w-100 sk-h-10" />
          <SkeletonLine className="sk-line sk-w-24 sk-h-20" />
        </div>
      </div>

      <div className="bill-card billing-summary">
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

      <div className="bill-card bill-card-list">
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
  const [changeDraft, setChangeDraft] = useState(null);
  const [usageExpanded, setUsageExpanded] = useState(false);

  const refreshBillingPlan = useCallback(async () => {
    const payload = await pullwiseApi.billing.getPlan();
    setPlan(payload);
    setError("");
    return payload;
  }, []);

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

  const freePlan = useMemo(() => planById(plan, "free") || fallbackFreePlan(), [plan]);
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
  const cancellationScheduled = String(accountStatus).toLowerCase() === "canceling";
  const subscriptionInterval = account.interval || "month";
  const currentPlan = activePaid ? paidPlanById[account.plan] || proPlan : freePlan;
  const usage = account.usage || {
    used: 0,
    limit: activePaid ? currentPlan.reviewLimit : freePlan.reviewLimit,
    remaining: activePaid ? currentPlan.reviewLimit : freePlan.reviewLimit,
    period: "",
  };
  const quotaActivity = useMemo(() => quotaActivityRecords(account), [account]);
  const subscriptions = subscriptionRecords(account);
  const usageResetText = quotaResetText(usage, "Monthly quota resets");
  const billingEnabled = Boolean(plan?.enabled);
  const alternatePaidPlans = paidPlans.filter((paidPlan) =>
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
      const nextStatus = result?.status || accountStatus;
      const restoredSubscription = isRestoredSubscriptionStatus(nextStatus);
      setPlan((current) => ({
        ...current,
        account: {
          ...(billingAccount(current) || {}),
          plan: nextPlan,
          interval: nextInterval,
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
      setChangeDraft(null);
      setPendingAction("");
    } catch (err) {
      setError(err?.message || "Unable to change subscription.");
      setPendingAction("");
    }
  };

  const requestSubscriptionChange = ({
    targetPlan = account.plan,
    targetInterval = subscriptionInterval,
  }) => {
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
    if (!pendingAction) setChangeDraft(null);
  };

  const confirmSubscriptionChange = () => {
    if (!changeDetails) return;
    changeSubscription({
      targetPlan: changeDetails.targetPlan.id,
      targetInterval: changeDetails.targetInterval,
    });
  };

  const cancelSubscription = async () => {
    setPendingAction("cancel");
    setError("");
    try {
      const result = await pullwiseApi.billing.cancelSubscription({
        mode: "scheduled",
        returnUrl: billingReturnUrl("return"),
      });
      setPlan((current) => ({
        ...current,
        account: {
          ...(billingAccount(current) || {}),
          status: result?.status || "canceling",
          cancelAtPeriodEnd: result?.cancelAtPeriodEnd ?? true,
        },
      }));
      await refreshBillingPlan();
      setPendingAction("");
    } catch (err) {
      setError(err?.message || "Unable to cancel subscription.");
      setPendingAction("");
    }
  };

  const resumeSubscription = async () => {
    setPendingAction("resume");
    setError("");
    try {
      const result = await pullwiseApi.billing.resumeSubscription({
        returnUrl: billingReturnUrl("return"),
      });
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
      setPendingAction("");
    } catch (err) {
      setError(err?.message || "Unable to resume subscription.");
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

            {loading ? (
              <BillingSkeleton />
            ) : (
              <div className="set-body">
                <button
                  type="button"
                  className={`bill-card billing-summary billing-usage-toggle${
                    usageExpanded ? " open" : ""
                  }`}
                  aria-expanded={usageExpanded}
                  aria-controls="billing-quota-activity"
                  onClick={() => setUsageExpanded((expanded) => !expanded)}
                >
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
                    <I.ArrowR className="billing-usage-caret" size={13} aria-hidden="true" />
                  </div>
                </button>

                {usageExpanded && (
                  <div
                    id="billing-quota-activity"
                    className="bill-card bill-card-list billing-usage-activity"
                  >
                    <div className="billing-summary-main">
                      <I.Activity size={18} />
                      <div>
                        <b>{T("Quota activity", "配额明细")}</b>
                        <div className="muted">
                          {quotaActivity.length
                            ? T(
                                `${quotaActivity.length} scan quota events`,
                                `${quotaActivity.length} 条 scan 配额事件`
                              )
                            : T("No scan quota events yet.", "暂无 scan 配额事件。")}
                        </div>
                      </div>
                    </div>
                    <div className="sub-record-list">
                      {quotaActivity.length > 0 ? (
                        quotaActivity.map((record, index) => {
                          const scanId = record.scanId;
                          return (
                            <a
                              className={`sub-record-row quota-activity-row quota-activity-${quotaActivityAction(
                                record
                              )}`}
                              key={quotaActivityRecordKey(record, index)}
                              aria-label={T(
                                `Open quota activity for ${record.repo || scanId}`,
                                `打开 ${record.repo || scanId} 的配额明细`
                              )}
                              {...screenLinkProps(go, "scanning", { scanId })}
                            >
                              <div className="quota-activity-main">
                                <span className="quota-activity-icon" aria-hidden="true">
                                  {["refunded", "released"].includes(
                                    quotaActivityAction(record)
                                  ) ? (
                                    <I.Refresh size={13} />
                                  ) : (
                                    <I.Activity size={13} />
                                  )}
                                </span>
                                <span className="sub-record-main">
                                  <b>{quotaActivityTitle(record)}</b>
                                  <span className="muted">{quotaActivityMeta(record)}</span>
                                  <span className="muted">{quotaActivityEventText(record)}</span>
                                </span>
                              </div>
                              <span className="tag">{quotaActivityAmountText(record)}</span>
                            </a>
                          );
                        })
                      ) : (
                        <div className="sub-record-row quota-activity-empty">
                          <div className="sub-record-main">
                            <b>{T("No quota activity", "暂无配额明细")}</b>
                            <div className="muted">
                              {T(
                                "Scans that consume or refund quota will appear here.",
                                "消耗或回退配额的 scan 会显示在这里。"
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                            requestSubscriptionChange({
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
                          <I.Trend size={14} />{" "}
                          {T(`Switch to ${planLabel(paidPlan)}`, `切换到 ${planLabel(paidPlan)}`)}
                        </button>
                      ))}
                      {subscriptionInterval === "month" && (
                        <button
                          className="btn"
                          disabled={Boolean(pendingAction)}
                          onClick={() => requestSubscriptionChange({ targetInterval: "year" })}
                        >
                          {pendingAction === `change-${account.plan}-year` && (
                            <span className="spin" style={{ display: "inline-block" }}>
                              <I.Refresh size={14} />
                            </span>
                          )}
                          <I.Package size={14} /> {T("Switch to yearly", "切换为按年")}
                        </button>
                      )}
                      {cancellationScheduled ? (
                        <button
                          className="btn"
                          disabled={Boolean(pendingAction)}
                          onClick={resumeSubscription}
                        >
                          {pendingAction === "resume" && (
                            <span className="spin" style={{ display: "inline-block" }}>
                              <I.Refresh size={14} />
                            </span>
                          )}
                          <I.Refresh size={14} /> {T("Resume renewal", "Resume renewal")}
                        </button>
                      ) : (
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
                        <b>{T("Subscription activity", "订阅动态")}</b>
                      </div>
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
            )}
          </div>
        </div>
      </div>
      {changeDetails && (
        <div className="modal-back billing-change-back" onClick={closeChangeConfirmation}>
          <div
            className="modal billing-change-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-change-title"
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
                    {priceLabel(priceFor(changeDetails.currentPlan, changeDetails.currentInterval))}
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
                    {priceLabel(priceFor(changeDetails.targetPlan, changeDetails.targetInterval))}
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
                      "The new plan takes effect immediately. Creem charges the prorated difference for the rest of the current period, and the new amount is billed on the next renewal date. You can cancel renewal from Pullwise Billing.",
                      "新套餐立即生效。Creem 会按当前周期剩余时间收取差额，并在下个续费日按新价格计费。你可以在 Pullwise 账单页取消续订。"
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
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={14} />
                  </span>
                )}
                <I.Check size={14} /> {T("Confirm change", "Confirm change")}
              </button>
            </div>
          </div>
        </div>
      )}
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
    if (!signedIn) {
      go("login");
      return;
    }
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
          successUrl: billingReturnUrl("success", "pricing"),
          cancelUrl: billingReturnUrl("cancel", "pricing"),
        },
        { signal: checkoutController.signal }
      );
      if (checkoutRequestRef.current !== requestId) return;
      if (!session?.url) throw new Error("Billing provider did not return a checkout URL.");
      const checkoutUrl = safeBillingRedirectUrl(session.url, "billing checkout URL");
      clearCheckoutTimeout();
      setPendingAction("");
      navigate(checkoutUrl);
    } catch (err) {
      if (checkoutRequestRef.current !== requestId) return;
      setError(err?.message || "Unable to start checkout.");
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
                      <I.Settings size={14} /> {T("Open billing", "打开账单")}
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

function PricingSkeletonLine({ className = "" }) {
  return <SkeletonLine className={["pricing-skeleton", className].filter(Boolean).join(" ")} />;
}

function PlanCard({ plan, price, interval, active, featured, cta }) {
  const loading = Boolean(plan?.loading);
  const reviewLimit = nonNegativeInteger(plan?.reviewLimit);
  const repositoryLimitText = repositoryCheckoutFeatureText(plan);
  const yearlySavings = (plan?.id === "pro" || plan?.id === "max") && interval === "year";
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
              <span>{priceLabel(price)}</span>
              <span className="pricing-per">/{interval}</span>
            </>
          )}
        </div>
        {!loading && yearlySavings && (
          <div className="pricing-billed">{T("2 months free", "免费 2 个月")}</div>
        )}
        {active && (
          <div className="pricing-billed">{T("Current account plan", "当前账户套餐")}</div>
        )}
      </div>
      <ul className="pricing-feats">
        <li>
          <I.Check size={13} />{" "}
          {loading ? (
            <PricingSkeletonLine className="pricing-skeleton-feature" />
          ) : (
            T(`${reviewLimit} shared account reviews / month`, `${reviewLimit} 次/月 共享账户审查`)
          )}
        </li>
        {repositoryLimitText && (
          <li>
            <I.Check size={13} />{" "}
            {loading ? (
              <PricingSkeletonLine className="pricing-skeleton-feature" />
            ) : (
              repositoryLimitText
            )}
          </li>
        )}
        <li>
          <I.Check size={13} />{" "}
          {T("Repository quota is shared by GitHub repo ID", "仓库配额按 GitHub repo ID 共享")}
        </li>
        <li>
          <I.Check size={13} /> {T("GitHub repository review history", "GitHub 仓库审查历史")}
        </li>
        {plan?.id === "max" && (
          <li>
            <I.Check size={13} /> {T("Deeper reasoning", "更深的思考")}
          </li>
        )}
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
