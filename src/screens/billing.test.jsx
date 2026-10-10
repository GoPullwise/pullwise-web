import { readFileSync } from "node:fs";
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { NotificationProvider } from "../components/notifications.jsx";
import { BillingScreen, PricingScreen } from "./billing.jsx";
import { setLang } from "../i18n.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    billing: {
      getPlan: vi.fn(),
      createCheckoutSession: vi.fn(),
      changeSubscriptionInterval: vi.fn(),
      cancelSubscription: vi.fn(),
      resumeSubscription: vi.fn(),
    },
  },
}));

function render(ui, options) {
  return rtlRender(<NotificationProvider>{ui}</NotificationProvider>, options);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("BillingScreen", () => {
  const billingCatalog = {
    enabled: true,
    provider: "creem",
    currency: "USD",
    plans: [
      {
        id: "free",
        name: "Free",
        description: "Record project and shared expenses.",
        entitlements: null,
        prices: {
          month: { amount: "0", currency: "USD", interval: "month", configured: true },
        },
      },
      {
        id: "pro",
        name: "Pullwise Pro",
        description: "Project expense ledger for teams.",
        entitlements: null,
        prices: {
          month: { amount: "29", currency: "USD", interval: "month", configured: true },
          year: { amount: "290", currency: "USD", interval: "year", configured: true },
        },
      },
    ],
  };

  const maxPlan = {
    id: "max",
    name: "Pullwise Max",
    description: "Higher-capacity Project expense ledger for teams.",
    entitlements: null,
    prices: {
      month: { amount: "49", currency: "USD", interval: "month", configured: true },
      year: { amount: "490", currency: "USD", interval: "year", configured: true },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      await setLang("en");
    });
  });

  function withUsage(planId, projects, expenseRecords) {
    return {
      ...billingCatalog,
      plans: [...billingCatalog.plans, maxPlan],
      account: { status: planId === "free" ? "none" : "active", plan: planId, interval: "month" },
      ledgerUsage: { workspaceId: "personal-owner", projects, expenseRecords },
    };
  }

  function expectUsageValues(
    region,
    label,
    used,
    total,
    locale = "en",
    labels = ["Used", "Total allowance"]
  ) {
    const article = within(region).getByRole("article", { name: label });
    expect(within(article).getByRole("heading", { level: 3, name: label })).toBeInTheDocument();
    expect(article.querySelectorAll("dl")).toHaveLength(1);
    expect(
      within(article)
        .getAllByRole("term")
        .map((term) => term.textContent)
    ).toEqual(labels);
    expect(
      within(article)
        .getAllByRole("definition")
        .map((definition) => definition.textContent)
    ).toEqual([used, total].map((value) => new Intl.NumberFormat(locale).format(value)));
    expect(within(article).queryByRole("meter")).not.toBeInTheDocument();
    return article;
  }

  function withJevUsage(planId = "pro", jev = {
    month: "2026-10", currency: "USD", usedMicrousd: 1234567, limitMicrousd: 3000000,
  }) {
    const payload = withUsage(planId, { used: 2, limit: 20 }, { used: 8, limit: 20000 });
    payload.ledgerUsage.jev = jev;
    return payload;
  }

  it.each(["pro", "max"])(
    "shows exact monthly Jev reservations for %s even when assistance is unavailable",
    async (planId) => {
      const payload = withJevUsage(planId);
      payload.plans = payload.plans.map((plan) => ({
        ...plan,
        entitlements: { jev: { eligible: plan.id !== "free", available: false } },
      }));
      payload.account.interval = "year";
      pullwiseApi.billing.getPlan.mockResolvedValue(payload);
      render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
      const region = await screen.findByRole("region", { name: "Jev usage" });
      expect(region).toHaveTextContent("UTC month: 2026-10");
      expect(within(region).getAllByRole("term").map((node) => node.textContent))
        .toEqual(["Used", "Total allowance"]);
      expect(within(region).getAllByRole("definition").map((node) => node.textContent))
        .toEqual(["USD 1.234567", "USD 3.00"]);
      expect(region).toHaveTextContent("not the provider’s actual invoice");
      expect(region).toHaveTextContent("without rollover, including annual subscriptions");
      expect(region).not.toHaveTextContent(/Remaining|Over limit|Daily/);
      expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
    }
  );

  it("keeps zero reservations and configured zero allowance exact", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue(withJevUsage("pro", {
      month: "2026-10", currency: "USD", usedMicrousd: 0, limitMicrousd: 0,
    }));
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Jev usage" });
    expect(within(region).getAllByRole("definition").map((node) => node.textContent))
      .toEqual(["USD 0.00", "USD 0.00"]);
  });

  it("does not round a safe-integer reservation or hide usage above a changed allowance", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue(withJevUsage("max", {
      month: "2026-10", currency: "USD", usedMicrousd: Number.MAX_SAFE_INTEGER,
      limitMicrousd: 4250001,
    }));
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Jev usage" });
    expect(within(region).getAllByRole("definition").map((node) => node.textContent))
      .toEqual(["USD 9,007,199,254.740991", "USD 4.250001"]);
  });

  it.each([
    null,
    { month: "2026-10", currency: "USD", usedMicrousd: null, limitMicrousd: 3000000 },
    { month: "2026-10", currency: "USD", usedMicrousd: "0", limitMicrousd: 3000000 },
    { month: "2026-10", currency: "USD", usedMicrousd: 1.5, limitMicrousd: 3000000 },
    { month: "2026-10", currency: "USD", usedMicrousd: Number.MAX_SAFE_INTEGER + 1, limitMicrousd: 3000000 },
    { month: "2026-10", currency: "USD", usedMicrousd: -1, limitMicrousd: 3000000 },
    { month: "2026-10", currency: "USD", usedMicrousd: 0 },
    { month: "2026-10", currency: "USD", usedMicrousd: 0, limitMicrousd: -1 },
    { month: "2026-13", currency: "USD", usedMicrousd: 0, limitMicrousd: 3000000 },
    { month: "2026-10", currency: "EUR", usedMicrousd: 0, limitMicrousd: 3000000 },
  ])("shows unavailable for unknown or invalid paid Jev usage: %j", async (jev) => {
    pullwiseApi.billing.getPlan.mockResolvedValue(withJevUsage("pro", jev));
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Jev usage" });
    expect(within(region).getByText("Usage unavailable")).toBeInTheDocument();
    expect(within(region).queryByRole("definition")).not.toBeInTheDocument();
    expect(region).not.toHaveTextContent("USD 0.00");
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
  });

  it("does not display paid Jev usage for a Free account", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue(withJevUsage("free"));
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    await screen.findByRole("region", { name: "Ledger usage" });
    expect(screen.queryByRole("region", { name: "Jev usage" })).not.toBeInTheDocument();
  });

  it("refreshes Jev values only with the existing manual usage read", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce(withJevUsage("pro", null))
      .mockResolvedValueOnce(withJevUsage());
    const user = userEvent.setup();
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const initial = await screen.findByRole("region", { name: "Jev usage" });
    expect(within(initial).getByText("Usage unavailable")).toBeInTheDocument();
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Refresh usage" }));
    const refreshed = await screen.findByRole("region", { name: "Jev usage" });
    expect(refreshed).toHaveTextContent("USD 1.234567");
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["en", "Jev usage", "UTC month", "1.234567", "without rollover"],
    ["zh", "Jev 用量", "UTC 月份", "1.234567", "不结转"],
    ["ja", "Jev の使用量", "UTC の月", "1.234567", "繰り越されません"],
    ["ko", "Jev 사용량", "UTC 월", "1.234567", "이월되지 않습니다"],
    ["fr", "Utilisation de Jev", "Mois UTC", "1,234567", "sans report"],
    ["es", "Uso de Jev", "Mes UTC", "1,234567", "sin acumulación"],
  ])("localizes Jev usage and its monthly policy in %s", async (lang, title, month, amount, rollover) => {
    await setLang(lang);
    pullwiseApi.billing.getPlan.mockResolvedValue(withJevUsage());
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: title });
    expect(region).toHaveTextContent(`${month}: 2026-10`);
    expect(region).toHaveTextContent(`USD ${amount}`);
    expect(region).toHaveTextContent(rollover);
    if (lang !== "en") expect(region).not.toHaveTextContent("Jev usage");
  });

  it.each([
    ["free", 2, 3, 79, 100],
    ["pro", 12, 20, 1200, 20000],
    ["max", 50, 100, 64567, 100000],
  ])(
    "shows exact Server capacity for the current %s plan",
    async (planId, projectsUsed, projectsLimit, recordsUsed, recordsLimit) => {
      pullwiseApi.billing.getPlan.mockResolvedValue(
        withUsage(
          planId,
          { used: projectsUsed, limit: projectsLimit },
          { used: recordsUsed, limit: recordsLimit }
        )
      );
      render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
      const region = await screen.findByRole("region", { name: "Ledger usage" });
      for (const [label, used, limit] of [
        ["Projects", projectsUsed, projectsLimit],
        ["Expense records", recordsUsed, recordsLimit],
      ]) {
        expectUsageValues(region, label, used, limit);
      }
      expect(region).not.toHaveTextContent(/Remaining|Over limit by|Limit reached/);
      expect(region).toHaveTextContent("ledger you own, even when another ledger is selected");
      expect(region).toHaveTextContent(
        "Archived or removed projects still count toward the project limit"
      );
      expect(region).toHaveTextContent(
        "Removing an expense manually or automatically frees its place"
      );
      expect(region).toHaveTextContent("removing a project frees its expense places");
      expect(region).toHaveTextContent("does not reset each month");
      expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
      expect(pullwiseApi.billing.getPlan).toHaveBeenCalledWith();
    }
  );

  it("shows valid usage even when Server remaining values are inconsistent", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue(
      withUsage(
        "free",
        { used: 2, limit: 3, remaining: 300 },
        { used: 8, limit: 100, remaining: -1 }
      )
    );
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Ledger usage" });
    expectUsageValues(region, "Projects", 2, 3);
    expectUsageValues(region, "Expense records", 8, 100);
    expect(within(region).queryByText("Usage unavailable")).not.toBeInTheDocument();
    expect(region).not.toHaveTextContent("Remaining");
  });

  it("preserves exact over-limit usage and total without calculated status", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue(
      withUsage(
        "free",
        { used: 7, limit: 3, remaining: 0 },
        { used: 112, limit: 100, remaining: 0 }
      )
    );
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Ledger usage" });
    expectUsageValues(region, "Projects", 7, 3);
    expectUsageValues(region, "Expense records", 112, 100);
    expect(region).not.toHaveTextContent(/Remaining|Over limit by|Limit reached/);
    expect(within(region).queryByRole("meter")).not.toBeInTheDocument();
  });

  it("keeps missing or malformed usage unavailable until an explicit read succeeds", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce(
        withUsage(
          "free",
          { used: null, limit: 3, remaining: 3 },
          { used: 8, limit: 0, remaining: 100 }
        )
      )
      .mockResolvedValueOnce(withUsage("free", { used: 0, limit: 3 }, { used: 8, limit: 100 }));
    const user = userEvent.setup();
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Ledger usage" });
    expect(within(region).getAllByText("Usage unavailable")).toHaveLength(2);
    expect(within(region).queryByRole("meter")).not.toBeInTheDocument();
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
    await user.click(within(region).getByRole("button", { name: "Refresh usage" }));
    const refreshedRegion = await screen.findByRole("region", { name: "Ledger usage" });
    expectUsageValues(refreshedRegion, "Projects", 0, 3);
    expectUsageValues(refreshedRegion, "Expense records", 8, 100);
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["missing used", { limit: 100 }],
    ["negative used", { used: -1, limit: 100 }],
    ["fractional used", { used: 0.5, limit: 100 }],
    ["unsafe used", { used: Number.MAX_SAFE_INTEGER + 1, limit: 100 }],
    ["string used", { used: "8", limit: 100 }],
    ["missing total", { used: 8 }],
    ["null total", { used: 8, limit: null }],
    ["negative total", { used: 8, limit: -1 }],
    ["fractional total", { used: 8, limit: 100.5 }],
    ["unsafe total", { used: 8, limit: Number.MAX_SAFE_INTEGER + 1 }],
    ["string total", { used: 8, limit: "100" }],
  ])("keeps %s unavailable rather than coercing capacity", async (_case, metric) => {
    pullwiseApi.billing.getPlan.mockResolvedValue(
      withUsage("free", metric, { used: 8, limit: 100 })
    );
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Ledger usage" });
    const projects = within(region).getByRole("article", { name: "Projects" });
    expect(within(projects).getByText("Usage unavailable")).toBeInTheDocument();
    expect(within(projects).queryByRole("definition")).not.toBeInTheDocument();
    expectUsageValues(region, "Expense records", 8, 100);
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
  });

  it("does not invent capacity from catalog limits when the usage DTO is absent", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({ ...billingCatalog, account: { plan: "free" } });
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const region = await screen.findByRole("region", { name: "Ledger usage" });
    expect(within(region).getAllByText("Usage unavailable")).toHaveLength(2);
    expect(within(region).queryByRole("meter")).not.toBeInTheDocument();
  });

  it("coalesces same-frame manual usage refreshes", async () => {
    const refresh = deferred();
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce(
        withUsage(
          "free",
          { used: 2, limit: 3, remaining: 1 },
          { used: 8, limit: 100, remaining: 92 }
        )
      )
      .mockReturnValueOnce(refresh.promise);
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    const button = await screen.findByRole("button", { name: "Refresh usage" });
    act(() => {
      button.click();
      button.click();
    });
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("region", { name: "Ledger usage" })).not.toBeInTheDocument();
    await act(async () =>
      refresh.resolve(
        withUsage(
          "free",
          { used: 2, limit: 3, remaining: 1 },
          { used: 9, limit: 100, remaining: 91 }
        )
      )
    );
    const region = await screen.findByRole("region", { name: "Ledger usage" });
    expectUsageValues(region, "Expense records", 9, 100);
  });

  it.each([
    [
      "en",
      "Ledger usage",
      "Projects",
      "Expense records",
      "Used",
      "Total allowance",
      "Refresh usage",
      "does not reset each month",
    ],
    ["zh", "账本用量", "项目", "支出记录", "已使用", "总额度", "刷新用量", "容量不会每月重置"],
    [
      "ja",
      "帳簿の使用量",
      "プロジェクト",
      "支出記録",
      "使用済み",
      "合計枠",
      "使用量を更新",
      "毎月リセットされません",
    ],
    [
      "ko",
      "장부 사용량",
      "프로젝트",
      "지출 기록",
      "사용됨",
      "총 한도",
      "사용량 새로고침",
      "매월 초기화되지 않습니다",
    ],
    [
      "fr",
      "Utilisation du registre",
      "Projets",
      "Enregistrements de dépenses",
      "Utilisé",
      "Quota total",
      "Actualiser l’utilisation",
      "n’est pas réinitialisée chaque mois",
    ],
    [
      "es",
      "Uso del libro",
      "Proyectos",
      "Registros de gastos",
      "Usado",
      "Cupo total",
      "Actualizar uso",
      "no se restablece cada mes",
    ],
  ])(
    "localizes usage, totals and policy in %s",
    async (locale, title, projects, records, used, total, refresh, retention) => {
      await setLang(locale);
      pullwiseApi.billing.getPlan.mockResolvedValue(
        withUsage(
          "max",
          { used: 50, limit: 100, remaining: 50 },
          { used: 64567, limit: 100000, remaining: 35433 }
        )
      );
      render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
      const region = await screen.findByRole("region", { name: title });
      expectUsageValues(region, projects, 50, 100, locale, [used, total]);
      expectUsageValues(region, records, 64567, 100000, locale, [used, total]);
      expect(within(region).getByRole("button", { name: refresh })).toBeInTheDocument();
      expect(region).toHaveTextContent(retention);
      if (locale !== "en") expect(region).not.toHaveTextContent("Ledger usage");
    }
  );

  it("does not invent paid prices or enable missing yearly products", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        billingCatalog.plans[0],
        {
          ...billingCatalog.plans[1],
          prices: { month: billingCatalog.plans[1].prices.month },
        },
      ],
      account: { status: "none", plan: "free" },
    });
    const user = userEvent.setup();
    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /yearly/i }));
    expect(screen.getByRole("button", { name: /start pro/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /start max/i })).toBeDisabled();
    expect(document.body).not.toHaveTextContent("$290");
    expect(document.body).not.toHaveTextContent("2 months free");
    expect(document.querySelectorAll(".pricing-card")[2]).not.toHaveTextContent("$0");
  });

  it("derives yearly savings from verified matching currency prices", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        billingCatalog.plans[0],
        {
          ...billingCatalog.plans[1],
          prices: {
            month: billingCatalog.plans[1].prices.month,
            year: { amount: "360", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
    });
    const user = userEvent.setup();
    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /yearly/i }));
    expect(document.body).not.toHaveTextContent("2 months free");
  });

  it("accepts the exact preview checkout host and returns purchases to Billing", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({ ...billingCatalog, account: { plan: "free" } });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      url: "https://test-checkout.creem.io/ch_test",
    });
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);
    await user.click(await screen.findByRole("button", { name: /start pro/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("https://test-checkout.creem.io/ch_test")
    );
    const payload = pullwiseApi.billing.createCheckoutSession.mock.calls[0][0];
    expect(new URL(payload.successUrl).pathname).toBe("/billing");
  });

  it("keeps Pro visible while an upgrade awaits signed payment confirmation", async () => {
    const pendingAccount = {
      status: "active",
      plan: "pro",
      interval: "month",
      pendingChange: { plan: "max", interval: "month" },
    };
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        account: { status: "active", plan: "pro", interval: "month" },
      })
      .mockResolvedValue({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        account: pendingAccount,
      });
    pullwiseApi.billing.changeSubscriptionInterval.mockResolvedValue({
      plan: "max",
      interval: "month",
      pending: true,
    });
    const user = userEvent.setup();
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: /switch to max/i }));
    await user.click(await screen.findByRole("button", { name: /confirm change/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.querySelector(".billing-summary-main")).toHaveTextContent("Pullwise Pro");
    expect(screen.getByText(/awaiting payment confirmation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /switch to max/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /refresh billing/i })).toBeEnabled();
  });

  it("shows subscriptions without the retired processing usage panel", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "active", plan: "pro", interval: "month", subscriptionEvents: [] },
    });
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    await waitFor(() =>
      expect(document.querySelector(".billing-skeleton")).not.toBeInTheDocument()
    );
    expect(screen.queryByText(/historical processing usage/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/processing usage unavailable/i)).not.toBeInTheDocument();
  });

  it("separates platform billing from ledger expenses", async () => {
    const ledgerPlans = billingCatalog.plans;
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: ledgerPlans,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
        entitlements: null,
        subscriptionEvents: [],
      },
    });
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    await waitFor(() =>
      expect(document.querySelector(".billing-skeleton")).not.toBeInTheDocument()
    );
    expect(document.body).not.toHaveTextContent("scan quota");

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);
    expect(
      (await screen.findAllByText(/Project and shared expense ledger/i)).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Expenses you record in the ledger are separate/i)).toBeInTheDocument();
  });

  it("renders all pricing tiers immediately with skeletons while pricing loads", () => {
    pullwiseApi.billing.getPlan.mockReturnValue(new Promise(() => {}));

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(document.querySelectorAll(".pricing-card")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pullwise Pro" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pullwise Max" })).toBeInTheDocument();
    expect(document.querySelectorAll(".pricing-skeleton").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole("button", { name: /start max/i })).toBeDisabled();
    expect(screen.queryByText(/billing is not configured/i)).not.toBeInTheDocument();
  });

  it("shows an actionable pricing error instead of a fake free-plan fallback", async () => {
    pullwiseApi.billing.getPlan.mockRejectedValue(new Error("timeout of 12000ms exceeded"));

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/timeout/i);
    expect(screen.getByRole("button", { name: /retry pricing/i })).toBeInTheDocument();
    expect(document.querySelectorAll(".pricing-card")).toHaveLength(0);
    expect(document.body).not.toHaveTextContent("Price unavailable");
  });

  it("keeps the Pricing heading centered independently from the landing hero", () => {
    const styles = readFileSync("src/app.css", "utf8");

    expect(styles).toMatch(
      /\.pricing-hero\s*>\s*\.lp-title\s*{[^}]*margin:\s*0 auto 18px;[^}]*text-align:\s*center;/s
    );
    expect(styles).toMatch(
      /\.pricing-hero\s*>\s*\.lp-title\s*{[^}]*grid-column:\s*auto;[^}]*grid-row:\s*auto;/s
    );
  });
  it("shows the topbar loading spinner only while billing data is loading", async () => {
    let resolvePlan;
    pullwiseApi.billing.getPlan.mockReturnValue(
      new Promise((resolve) => {
        resolvePlan = resolve;
      })
    );

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect(screen.getByRole("status", { name: /^loading$/i })).toHaveClass(
      "topbar-loading",
      "spin"
    );

    resolvePlan({
      ...billingCatalog,
      account: { status: "none", plan: "free" },
    });
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: /^loading$/i })).not.toBeInTheDocument();
    });
  });

  it("keeps the billing change confirmation dialog compact on desktop", () => {
    const styles = readFileSync("styles/screens.css", "utf8");

    expect(styles).toMatch(/\.billing-change-modal\s*{[^}]*max-width:\s*640px;/s);
    expect(styles).not.toMatch(/\.billing-change-modal\s*{[^}]*max-width:\s*720px;/s);
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*640px\)\s*{[\s\S]*\.billing-change-modal\s*{[^}]*max-width:\s*100%;/s
    );
  });

  it("renders billing account skeletons while billing data is loading", () => {
    pullwiseApi.billing.getPlan.mockReturnValue(new Promise(() => {}));

    const { container } = render(<BillingScreen go={vi.fn()} />);

    expect(container.querySelector(".billing-skeleton")).toBeInTheDocument();
    expect(container.querySelectorAll(".billing-skeleton .panel")).toHaveLength(3);
    expect(screen.queryByText(/billing is not configured/i)).not.toBeInTheDocument();
  });

  it("starts checkout through the configured backend billing provider", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://creem.io/checkout/chk_test",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    expect(await screen.findByText("Account plans")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Creem");
    await user.click(screen.getByRole("button", { name: /start pro/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "pro",
          interval: "month",
        }),
        expect.objectContaining({ signal: expect.any(Object) })
      );
      expect(navigate).toHaveBeenCalledWith("https://creem.io/checkout/chk_test");
    });
  });

  it("starts Max checkout when Max is selected from pricing", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        ...billingCatalog.plans,
        {
          id: "max",
          name: "Pullwise Max",
          description: "Project expense ledger for larger teams.",
          entitlements: null,
          prices: {
            month: { amount: "49", currency: "USD", interval: "month", configured: true },
            year: { amount: "490", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
      account: { status: "none", plan: "free" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://creem.io/checkout/chk_max",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /start max/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "max",
          interval: "month",
        }),
        expect.objectContaining({ signal: expect.any(Object) })
      );
      expect(navigate).toHaveBeenCalledWith("https://creem.io/checkout/chk_max");
    });
  });

  it("coalesces rapid pricing checkout clicks into one request", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none", plan: "free" },
    });
    pullwiseApi.billing.createCheckoutSession.mockImplementation(() => new Promise(() => {}));

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    act(() => {
      proButton.click();
      proButton.click();
    });

    expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(proButton).toBeDisabled();
  });

  it.each(["success", "failure"])(
    "keeps the checkout interval fixed until checkout %s settles",
    async (outcome) => {
      const checkout = deferred();
      pullwiseApi.billing.getPlan.mockResolvedValue({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        account: { status: "none", plan: "free" },
      });
      pullwiseApi.billing.createCheckoutSession.mockReturnValue(checkout.promise);
      const navigate = vi.fn();
      const user = userEvent.setup();
      render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);
      const pro = await screen.findByRole("button", { name: /start pro/i });
      const max = screen.getByRole("button", { name: /start max/i });
      const monthly = screen.getByRole("button", { name: "Monthly" });
      const yearly = screen.getByRole("button", { name: "Yearly" });
      await user.click(yearly);
      await user.click(pro);
      expect(monthly).toBeDisabled();
      expect(yearly).toBeDisabled();
      expect(pro).toBeDisabled();
      expect(max).toBeDisabled();
      fireEvent.click(monthly);
      fireEvent.click(max);
      expect(yearly).toHaveClass("active");
      expect(monthly).not.toHaveClass("active");
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledOnce();
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ plan: "pro", interval: "year" }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      await act(async () => {
        if (outcome === "success") checkout.resolve({ url: "https://creem.io/checkout/yearly" });
        else checkout.reject(new Error("Checkout unavailable"));
      });
      await waitFor(() => expect(pro).toBeEnabled());
      expect(max).toBeEnabled();
      expect(monthly).toBeEnabled();
      expect(yearly).toBeEnabled();
      expect(yearly).toHaveClass("active");
      if (outcome === "success")
        expect(navigate).toHaveBeenCalledWith("https://creem.io/checkout/yearly");
      else expect(navigate).not.toHaveBeenCalled();
      await user.click(monthly);
      expect(monthly).toHaveClass("active");
    }
  );
  it("clears pricing checkout pending state before redirecting", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [...billingCatalog.plans, maxPlan],
      account: { status: "none", plan: "free" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://creem.io/checkout/chk_test",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    const maxButton = screen.getByRole("button", { name: /start max/i });
    await user.click(proButton);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("https://creem.io/checkout/chk_test");
    });
    expect(proButton).toBeEnabled();
    expect(maxButton).toBeEnabled();
    expect(proButton.querySelector(".spin")).not.toBeInTheDocument();
  });

  it("resets pricing checkout buttons when restored from browser history", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [...billingCatalog.plans, maxPlan],
      account: { status: "none", plan: "free" },
    });
    let checkoutOptions;
    pullwiseApi.billing.createCheckoutSession.mockImplementation((_payload, options) => {
      checkoutOptions = options;
      return new Promise(() => {});
    });
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    const maxButton = screen.getByRole("button", { name: /start max/i });
    await user.click(proButton);

    await waitFor(() => {
      expect(proButton).toBeDisabled();
      expect(maxButton).toBeDisabled();
      expect(proButton.querySelector(".spin")).toBeInTheDocument();
    });

    const pageShow = new Event("pageshow");
    Object.defineProperty(pageShow, "persisted", { value: true });
    act(() => {
      window.dispatchEvent(pageShow);
    });

    await waitFor(() => {
      expect(proButton).toBeEnabled();
      expect(maxButton).toBeEnabled();
      expect(proButton.querySelector(".spin")).not.toBeInTheDocument();
    });
    expect(checkoutOptions.signal.aborted).toBe(true);
  });

  it("starts another checkout after browser-history recovery", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none", plan: "free" },
    });
    pullwiseApi.billing.createCheckoutSession.mockImplementation(() => new Promise(() => {}));

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    fireEvent.click(proButton);
    expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(1);

    const pageShow = new Event("pageshow");
    Object.defineProperty(pageShow, "persisted", { value: true });
    act(() => window.dispatchEvent(pageShow));

    await waitFor(() => expect(proButton).toBeEnabled());
    fireEvent.click(proButton);

    expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(2);
  });

  it("aborts a pending pricing checkout when unmounted", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none", plan: "free" },
    });
    let checkoutOptions;
    pullwiseApi.billing.createCheckoutSession.mockImplementation((_payload, options) => {
      checkoutOptions = options;
      return new Promise(() => {});
    });
    const user = userEvent.setup();

    const { unmount } = render(
      <PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />
    );

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    await user.click(proButton);

    await waitFor(() => {
      expect(proButton).toBeDisabled();
      expect(checkoutOptions.signal.aborted).toBe(false);
    });

    unmount();

    expect(checkoutOptions.signal.aborted).toBe(true);
  });

  it("times out a stalled pricing checkout and ignores the stale response", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none", plan: "free" },
    });
    let resolveCheckout;
    let checkoutOptions;
    pullwiseApi.billing.createCheckoutSession.mockImplementation((_payload, options) => {
      checkoutOptions = options;
      return new Promise((resolve) => {
        resolveCheckout = resolve;
      });
    });
    const navigate = vi.fn();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    vi.useFakeTimers();

    try {
      act(() => {
        fireEvent.click(proButton);
      });
      expect(proButton).toBeDisabled();
      expect(checkoutOptions.signal.aborted).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15 * 1000);
      });

      expect(screen.getByRole("alert")).toHaveTextContent(/taking longer/i);
      expect(proButton).toBeEnabled();
      expect(checkoutOptions.signal.aborted).toBe(true);

      await act(async () => {
        resolveCheckout({ provider: "creem", url: "https://creem.io/checkout/stale" });
      });

      expect(navigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts another checkout after timeout recovery", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      checkoutTimeoutMs: 1000,
      account: { status: "none", plan: "free" },
    });
    pullwiseApi.billing.createCheckoutSession.mockImplementation(() => new Promise(() => {}));

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    vi.useFakeTimers();
    try {
      fireEvent.click(proButton);
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(1);

      await act(async () => vi.advanceTimersByTimeAsync(1000));

      expect(screen.getByRole("alert")).toHaveTextContent(/taking longer/i);
      expect(proButton).toBeEnabled();
      fireEvent.click(proButton);

      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the server-provided checkout timeout before reopening pricing buttons", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      checkoutTimeoutMs: 30 * 1000,
      account: { status: "none", plan: "free" },
    });
    let checkoutOptions;
    pullwiseApi.billing.createCheckoutSession.mockImplementation((_payload, options) => {
      checkoutOptions = options;
      return new Promise(() => {});
    });

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    const proButton = await screen.findByRole("button", { name: /start pro/i });
    vi.useFakeTimers();

    try {
      act(() => {
        fireEvent.click(proButton);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15 * 1000);
      });

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(proButton).toBeDisabled();
      expect(checkoutOptions.signal.aborted).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15 * 1000);
      });

      expect(screen.getByRole("alert")).toHaveTextContent(/taking longer/i);
      expect(proButton).toBeEnabled();
      expect(checkoutOptions.signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("shows Max-specific reasoning and yearly savings", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        ...billingCatalog.plans,
        {
          id: "max",
          name: "Pullwise Max",
          description: "Project expense ledger for larger teams.",
          entitlements: null,
          prices: {
            month: { amount: "49", currency: "USD", interval: "month", configured: true },
            year: { amount: "490", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
      account: { status: "none", plan: "free" },
    });
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findByText("Pullwise Max")).toBeInTheDocument();
    expect(screen.getAllByText("Per-currency reports and REST API").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /yearly/i }));

    expect(screen.getAllByText("2 months free")).toHaveLength(2);
  });

  it("does not let an admin start Pro when provider billing is disabled", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      enabled: false,
      provider: "disabled",
      plans: [
        billingCatalog.plans[0],
        {
          ...billingCatalog.plans[1],
          prices: {
            month: { amount: "29", currency: "USD", interval: "month", configured: false },
            year: { amount: "290", currency: "USD", interval: "year", configured: false },
          },
        },
      ],
      account: { status: "none", plan: "free" },
    });
    const navigate = vi.fn();

    render(
      <PricingScreen
        go={vi.fn()}
        auth={{ authenticated: true, session: { admin: true } }}
        navigate={navigate}
      />
    );

    const startPro = await screen.findByRole("button", { name: /start pro/i });
    expect(startPro).toBeDisabled();
    expect(pullwiseApi.billing.createCheckoutSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("exposes billing legal side navigation as real screen links", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none" },
    });
    const go = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={go} navigate={vi.fn()} />);

    await waitFor(() =>
      expect(document.querySelector(".billing-skeleton")).not.toBeInTheDocument()
    );
    const terms = screen.getByRole("link", { name: /^terms$/i });
    const privacy = screen.getByRole("link", { name: /^privacy$/i });

    expect(terms).toHaveAttribute("href", "/terms");
    expect(privacy).toHaveAttribute("href", "/privacy");

    await user.click(terms);

    expect(go).toHaveBeenCalledWith("terms");
  });

  it("keeps new subscriptions on Pricing instead of starting checkout from Billing", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none", plan: "free" },
    });
    const go = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={go} navigate={vi.fn()} />);

    const pricingButtons = await screen.findAllByRole("link", { name: /view pricing/i });
    pricingButtons.forEach((link) => {
      expect(link).toHaveAttribute("href", "/pricing");
    });

    await user.click(pricingButtons[0]);

    expect(go).toHaveBeenCalledWith("pricing");
    expect(pullwiseApi.billing.createCheckoutSession).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /start pro/i })).not.toBeInTheDocument();
  });

  it("does not show the billing provider tag beside View pricing", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      provider: "disabled",
      account: { status: "none", plan: "free" },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await screen.findByRole("link", { name: /view pricing/i });
    const headerActions = document.querySelector(".page-h .actions");

    expect(headerActions).not.toHaveTextContent("Disabled");
    expect(headerActions.querySelector(".tag")).toBeNull();
  });

  it("rejects unsafe checkout URLs before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "javascript:alert(1)",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /start pro/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing checkout URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects checkout URLs with control characters before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://creem.io/checkout/chk_test\r\nX-Injected: bad",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /start pro/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing checkout URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects non-provider checkout hosts before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://evil.example/checkout",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /start pro/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing checkout URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("allows Creem checkout redirects from the configured provider host", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      provider: "creem",
      account: { status: "none" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://checkout.creem.io/ch_test",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /start pro/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("https://checkout.creem.io/ch_test");
    });
  });

  it("shows free and pro monthly limits with yearly pricing toggle", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [...billingCatalog.plans, maxPlan],
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
      },
    });
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getAllByText("Project and shared expense ledger").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Per-currency reports and REST API").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /yearly/i }));

    expect(screen.getByText("$290")).toBeInTheDocument();
    expect(screen.getAllByText(/2 months free/i)).toHaveLength(2);
  });

  it("renders Server-provided Pro and Max monthly Jev budgets without inventing availability", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [...billingCatalog.plans, maxPlan].map((plan) => ({
        ...plan,
        entitlements: {
          limits: {
            projects: plan.id === "free" ? 3 : plan.id === "max" ? 100 : 20,
            expenseRecords: plan.id === "free" ? 100 : plan.id === "max" ? 100000 : 20000,
          },
          jev: {
            eligible: plan.id === "pro" || plan.id === "max",
            available: false,
            monthlyBudgetUsd: plan.id === "max" ? "5.00" : plan.id === "pro" ? "3.00" : "0.00",
            rollover: false,
          },
        },
      })),
    });
    const user = userEvent.setup();
    render(<PricingScreen go={vi.fn()} auth={{ authenticated: false }} navigate={vi.fn()} />);
    const projectCopies = await screen.findAllByText("Projects:");
    expect(projectCopies.map((node) => node.textContent)).toEqual([
      "Projects: 3",
      "Projects: 20",
      "Projects: 100",
    ]);
    expect(screen.getAllByText("Expense records:").map((node) => node.textContent)).toEqual([
      "Expense records: 100",
      "Expense records: 20,000",
      "Expense records: 100,000",
    ]);
    expect(
      screen.getByText(
        /Removing expenses manually or automatically, or removing their project, frees expense capacity/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/monthly Jev allowance covers model assistance, has no cash value/i)
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Jev assistance allowance:/).map((node) => node.textContent)
    ).toEqual([
      "Jev assistance allowance: $3.00 / month",
      "Jev assistance allowance: $5.00 / month",
    ]);
    expect(screen.getAllByText("Activation pending · no rollover")).toHaveLength(2);
    expect(screen.getAllByText("Jev: not included")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /yearly/i }));
    expect(
      screen.getAllByText(/Jev assistance allowance:/).map((node) => node.textContent)
    ).toEqual([
      "Jev assistance allowance: $3.00 / month",
      "Jev assistance allowance: $5.00 / month",
    ]);
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.billing.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("uses configured Jev budget amounts and availability for each paid tier", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        billingCatalog.plans[0],
        {
          ...billingCatalog.plans[1],
          entitlements: {
            jev: { eligible: true, available: true, monthlyBudgetUsd: "1.234567" },
          },
        },
        {
          ...maxPlan,
          entitlements: {
            jev: { eligible: true, available: false, monthlyBudgetUsd: "4.25" },
          },
        },
      ],
    });
    render(<PricingScreen go={vi.fn()} auth={{ authenticated: false }} navigate={vi.fn()} />);

    await screen.findAllByText(/Jev assistance allowance:/);
    const pro = screen.getByRole("heading", { name: "Pullwise Pro" }).closest(".pricing-card");
    const max = screen.getByRole("heading", { name: "Pullwise Max" }).closest(".pricing-card");
    expect(pro).toHaveTextContent("Jev assistance allowance: $1.234567 / month");
    expect(pro).toHaveTextContent("Monthly UTC budget · no rollover");
    expect(pro).not.toHaveTextContent("Activation pending");
    expect(max).toHaveTextContent("Jev assistance allowance: $4.25 / month");
    expect(max).toHaveTextContent("Activation pending · no rollover");
    expect(max).not.toHaveTextContent("Monthly UTC budget");
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    { jev: { eligible: true, available: true } },
    { jev: { eligible: true, available: true, monthlyBudgetUsd: 3 } },
    { jev: { eligible: true, available: true, monthlyBudgetUsd: "3e0" } },
    { jev: { eligible: false, available: true, monthlyBudgetUsd: "3.00" } },
  ])(
    "does not invent a Pro Jev allowance from absent or invalid entitlements: %j",
    async (entitlements) => {
      pullwiseApi.billing.getPlan.mockResolvedValue({
        ...billingCatalog,
        plans: [billingCatalog.plans[0], { ...billingCatalog.plans[1], entitlements }],
      });
      render(<PricingScreen go={vi.fn()} auth={{ authenticated: false }} navigate={vi.fn()} />);

      await screen.findByText("Project expense ledger for teams.");
      expect(screen.getByRole("heading", { name: "Pullwise Max" })).toBeInTheDocument();
      expect(screen.queryByText(/Jev assistance allowance:/)).not.toBeInTheDocument();
      expect(
        screen.queryByText("Automatic Jev assistance when saving expenses")
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Monthly UTC budget · no rollover")).not.toBeInTheDocument();
      expect(screen.queryByText("Activation pending · no rollover")).not.toBeInTheDocument();
    }
  );

  it("does not leak malformed billing price amounts", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        {
          ...billingCatalog.plans[0],
          prices: { month: { amount: "-5", currency: "USD", interval: "month", configured: true } },
        },
        {
          ...billingCatalog.plans[1],
          prices: {
            month: { amount: "not-a-number", currency: "USD", interval: "month", configured: true },
            year: { amount: "Infinity", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
      account: {
        status: "none",
        plan: "free",
      },
    });

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    const unavailablePrices = await screen.findAllByText("Price unavailable");
    expect(unavailablePrices).toHaveLength(3);
    unavailablePrices.forEach((price) => expect(price).toHaveClass("financial-unavailable"));
    expect(document.body).not.toHaveTextContent("$-5");
    expect(document.body).not.toHaveTextContent("$not-a-number");
  });

  it("starts yearly checkout when yearly billing is selected", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "none",
        plan: "free",
      },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://creem.io/checkout/chk_yearly",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /yearly/i }));
    await user.click(screen.getByRole("button", { name: /start pro/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "pro",
          interval: "year",
        }),
        expect.objectContaining({ signal: expect.any(Object) })
      );
      expect(navigate).toHaveBeenCalledWith("https://creem.io/checkout/chk_yearly");
    });
  });

  it("asks active monthly subscribers to confirm yearly switching before changing billing", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        account: {
          status: "active",
          plan: "pro",
          interval: "month",
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        account: {
          status: "active",
          plan: "pro",
          interval: "year",
        },
      });
    pullwiseApi.billing.changeSubscriptionInterval.mockResolvedValue({
      provider: "creem",
      interval: "year",
      status: "active",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /switch to yearly/i }));

    expect(pullwiseApi.billing.changeSubscriptionInterval).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: /confirm billing change/i });
    expect(dialog).toHaveTextContent("Pullwise Pro");
    expect(dialog).toHaveTextContent("$29");
    expect(dialog).toHaveTextContent("$290");
    expect(dialog).toHaveTextContent("per year");
    expect(dialog).toHaveTextContent("$58 less per year");
    expect(dialog).toHaveTextContent(/possible charge today/i);
    expect(dialog).toHaveTextContent(/Creem may charge a prorated difference/i);
    expect(dialog).toHaveTextContent(/plan updates after payment confirmation/i);
    expect(dialog).not.toHaveTextContent(/new plan takes effect immediately/i);

    await user.click(screen.getByRole("button", { name: /confirm change/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.changeSubscriptionInterval).toHaveBeenCalledWith(
        expect.objectContaining({
          interval: "year",
        })
      );
      expect(navigate).not.toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /switch to yearly/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it("coalesces same-frame subscription change confirmations", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
      },
    });
    pullwiseApi.billing.changeSubscriptionInterval.mockImplementation(() => new Promise(() => {}));

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /switch to yearly/i }));
    const confirm = await screen.findByRole("button", { name: /confirm change/i });
    act(() => {
      confirm.click();
      confirm.click();
    });

    expect(pullwiseApi.billing.changeSubscriptionInterval).toHaveBeenCalledTimes(1);
  });

  it("does not redirect after a pending subscription change unmounts", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
      },
    });
    let resolveChange;
    const pendingChange = new Promise((resolve) => {
      resolveChange = resolve;
    });
    pullwiseApi.billing.changeSubscriptionInterval.mockReturnValue(pendingChange);
    const navigate = vi.fn();
    const view = render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    fireEvent.click(await screen.findByRole("button", { name: /switch to yearly/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm change/i }));
    await waitFor(() =>
      expect(pullwiseApi.billing.changeSubscriptionInterval).toHaveBeenCalledOnce()
    );

    view.unmount();
    await act(async () => {
      resolveChange({ url: "https://creem.io/checkout/late" });
      await pendingChange;
    });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("asks active Pro subscribers to confirm Max switching before changing billing", async () => {
    const maxPlan = {
      id: "max",
      name: "Pullwise Max",
      description: "Project expense ledger for larger teams.",
      entitlements: null,
      prices: {
        month: { amount: "49", currency: "USD", interval: "month", configured: true },
        year: { amount: "490", currency: "USD", interval: "year", configured: true },
      },
    };
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        account: {
          status: "active",
          plan: "pro",
          interval: "month",
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        account: {
          status: "active",
          plan: "max",
          interval: "month",
        },
      });
    pullwiseApi.billing.changeSubscriptionInterval.mockResolvedValue({
      provider: "creem",
      plan: "max",
      interval: "month",
      status: "active",
    });
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /switch to max/i }));

    expect(pullwiseApi.billing.changeSubscriptionInterval).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: /confirm billing change/i });
    expect(dialog).toHaveTextContent("Pullwise Pro");
    expect(dialog).toHaveTextContent("Pullwise Max");
    expect(dialog).toHaveTextContent("$29");
    expect(dialog).toHaveTextContent("$49");
    expect(dialog).toHaveTextContent("per month");
    expect(dialog).toHaveTextContent("$20 more per month");
    expect(dialog).toHaveTextContent(/possible charge today/i);
    expect(dialog).toHaveTextContent(/Creem may charge a prorated difference/i);
    expect(dialog).toHaveTextContent(/plan updates after payment confirmation/i);
    expect(dialog).not.toHaveTextContent(/new plan takes effect immediately/i);

    await user.click(screen.getByRole("button", { name: /confirm change/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.changeSubscriptionInterval).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "max",
          interval: "month",
        })
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Pullwise Max").length).toBeGreaterThan(0);
    });
  });

  it("refreshes the plan and subscription activity after an in-app upgrade", async () => {
    const maxPlan = {
      id: "max",
      name: "Pullwise Max",
      description: "Project expense ledger for larger teams.",
      entitlements: null,
      prices: {
        month: { amount: "49", currency: "USD", interval: "month", configured: true },
        year: { amount: "490", currency: "USD", interval: "year", configured: true },
      },
    };
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        account: {
          status: "active",
          plan: "pro",
          interval: "month",
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        account: {
          status: "active",
          plan: "max",
          interval: "month",
          subscriptionEvents: [
            {
              provider: "creem",
              subscriptionId: "sub_upgrade",
              status: "active",
              plan: "max",
              interval: "month",
              eventType: "subscription.updated",
              eventId: "evt_upgrade",
              eventCreated: 1780963210,
            },
          ],
        },
      });
    pullwiseApi.billing.changeSubscriptionInterval.mockResolvedValue({
      provider: "creem",
      plan: "max",
      interval: "month",
      status: "active",
    });
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await waitFor(() =>
      expect(document.querySelector(".billing-skeleton")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: /switch to max/i }));
    await user.click(await screen.findByRole("button", { name: /confirm change/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(2);
    });
    await waitFor(() =>
      expect(document.querySelector(".billing-skeleton")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Subscription activity")).toBeInTheDocument();
    expect(screen.getByText(/subscription\.updated/)).toBeInTheDocument();
    expect(screen.getByText(/evt_upgrade - 2026-06-09 00:00 UTC/i)).toBeInTheDocument();
  });

  it("does not offer lower-tier or monthly switching for active yearly Max subscribers", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        ...billingCatalog.plans,
        {
          id: "max",
          name: "Pullwise Max",
          description: "Project expense ledger for larger teams.",
          entitlements: null,
          prices: {
            month: { amount: "49", currency: "USD", interval: "month", configured: true },
            year: { amount: "490", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
      account: {
        status: "active",
        plan: "max",
        interval: "year",
      },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect((await screen.findAllByText("Pullwise Max")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /switch to pro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to monthly/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /confirm billing change/i })
    ).not.toBeInTheDocument();
    expect(pullwiseApi.billing.changeSubscriptionInterval).not.toHaveBeenCalled();
  });

  it("schedules subscription cancellation from Billing", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        account: {
          status: "active",
          plan: "pro",
          interval: "year",
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        account: {
          status: "canceling",
          plan: "pro",
          interval: "year",
          cancelAtPeriodEnd: true,
        },
      });
    pullwiseApi.billing.cancelSubscription.mockResolvedValue({
      provider: "creem",
      plan: "pro",
      interval: "year",
      status: "canceling",
      cancelAtPeriodEnd: true,
    });
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /cancel renewal/i }));
    await user.click(await screen.findByRole("button", { name: /confirm cancellation/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.cancelSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "scheduled",
        })
      );
    });
    expect(screen.queryByRole("button", { name: /cancel renewal/i })).not.toBeInTheDocument();
  });

  it("coalesces same-frame subscription cancellation requests", async () => {
    const user = userEvent.setup();
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
      },
    });
    pullwiseApi.billing.cancelSubscription.mockImplementation(() => new Promise(() => {}));

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    const cancel = await screen.findByRole("button", { name: /cancel renewal/i });
    act(() => {
      cancel.click();
      cancel.click();
    });
    await user.click(await screen.findByRole("button", { name: /confirm cancellation/i }));

    expect(pullwiseApi.billing.cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it("does not refresh billing after a pending cancellation completes post-unmount", async () => {
    const cancellation = deferred();
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
      },
    });
    pullwiseApi.billing.cancelSubscription.mockReturnValue(cancellation.promise);
    const user = userEvent.setup();
    const { unmount } = render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /cancel renewal/i }));
    await user.click(await screen.findByRole("button", { name: /confirm cancellation/i }));
    await waitFor(() => expect(pullwiseApi.billing.cancelSubscription).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      cancellation.resolve({ status: "canceling", cancelAtPeriodEnd: true });
      await cancellation.promise;
      await Promise.resolve();
    });

    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(1);
  });

  it("offers resume renewal while cancellation is scheduled", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        account: {
          status: "canceling",
          plan: "pro",
          interval: "month",
          cancelAtPeriodEnd: true,
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        account: {
          status: "active",
          plan: "pro",
          interval: "month",
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });
    pullwiseApi.billing.resumeSubscription.mockResolvedValue({
      provider: "creem",
      plan: "pro",
      interval: "month",
      status: "active",
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect(await screen.findByRole("button", { name: /resume renewal/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to yearly/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel renewal/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /resume renewal/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.resumeSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          returnUrl: expect.stringContaining("screen=billing"),
        })
      );
    });
    expect(await screen.findByRole("button", { name: /cancel renewal/i })).toBeInTheDocument();
  });

  it("coalesces same-frame subscription resume requests", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "canceling",
        plan: "pro",
        interval: "month",
        cancelAtPeriodEnd: true,
      },
    });
    pullwiseApi.billing.resumeSubscription.mockImplementation(() => new Promise(() => {}));

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    const resume = await screen.findByRole("button", { name: /resume renewal/i });
    act(() => {
      resume.click();
      resume.click();
    });

    expect(pullwiseApi.billing.resumeSubscription).toHaveBeenCalledTimes(1);
  });

  it("keeps billing navigation and actions locked through the required post-write read", async () => {
    const resume = deferred();
    const refresh = deferred();
    const activeAccount = {
      status: "active",
      plan: "pro",
      interval: "month",
      cancelAtPeriodEnd: false,
    };
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        account: { ...activeAccount, status: "canceling", cancelAtPeriodEnd: true },
      })
      .mockReturnValueOnce(refresh.promise);
    pullwiseApi.billing.resumeSubscription.mockReturnValue(resume.promise);
    const go = vi.fn();
    const user = userEvent.setup();
    render(<BillingScreen go={go} navigate={vi.fn()} />);
    const resumeButton = await screen.findByRole("button", { name: "Resume renewal" });
    const pricing = screen.getByRole("link", { name: "View pricing" });
    const usageRefresh = screen.getByRole("button", { name: "Refresh usage" });
    expect(pricing).toHaveAttribute("href", "/pricing");
    await user.click(resumeButton);
    expect(resumeButton).toBeDisabled();
    expect(usageRefresh).toBeDisabled();
    expect(pricing).toHaveAttribute("aria-disabled", "true");
    expect(pricing).not.toHaveAttribute("href");
    expect(document.querySelectorAll('.side-i[aria-disabled="true"]').length).toBeGreaterThan(0);
    expect(screen.getByRole("status", { name: "Loading" })).toHaveClass("topbar-loading");
    fireEvent.click(pricing);
    fireEvent.click(resumeButton);
    expect(go).not.toHaveBeenCalled();
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
    await act(async () => resume.resolve(activeAccount));
    await waitFor(() => expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(2));
    expect(pricing).not.toHaveAttribute("href");
    expect(screen.getByRole("button", { name: "Cancel renewal" })).toBeDisabled();
    expect(usageRefresh).toBeDisabled();
    fireEvent.click(usageRefresh);
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    await act(async () => refresh.resolve({ ...billingCatalog, account: activeAccount }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel renewal" })).toBeEnabled()
    );
    expect(pricing).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: "Cancel renewal" })).toBeEnabled();
    expect(usageRefresh).toBeEnabled();
    expect(screen.queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
  });

  it("does not dismiss a pending cancellation with Escape and restores controls after failure", async () => {
    const cancellation = deferred();
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "active", plan: "pro", interval: "month" },
    });
    pullwiseApi.billing.cancelSubscription.mockReturnValue(cancellation.promise);
    const user = userEvent.setup();
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Cancel renewal" }));
    await user.click(await screen.findByRole("button", { name: "Confirm cancellation" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel subscription renewal?" });
    for (const cancel of screen.getAllByRole("button", { name: "Cancel" }))
      expect(cancel).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View pricing" })).not.toHaveAttribute("href");
    await act(async () => cancellation.reject(new Error("Cancellation unavailable")));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "View pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("button", { name: "Cancel renewal" })).toBeEnabled();
    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledOnce();
  });

  it("does not refresh billing after a pending resume completes post-unmount", async () => {
    const resume = deferred();
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "canceling",
        plan: "pro",
        interval: "month",
        cancelAtPeriodEnd: true,
      },
    });
    pullwiseApi.billing.resumeSubscription.mockReturnValue(resume.promise);
    const user = userEvent.setup();
    const { unmount } = render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /resume renewal/i }));
    await waitFor(() => expect(pullwiseApi.billing.resumeSubscription).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      resume.resolve({ status: "active", cancelAtPeriodEnd: false });
      await resume.promise;
      await Promise.resolve();
    });

    expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(1);
  });

  it("requires resuming renewal before offering an upgrade", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [...billingCatalog.plans, maxPlan],
      account: { status: "canceling", plan: "pro", interval: "month", cancelAtPeriodEnd: true },
    });
    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);
    expect(await screen.findByRole("button", { name: /resume renewal/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to yearly/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to max/i })).not.toBeInTheDocument();
    expect(pullwiseApi.billing.changeSubscriptionInterval).not.toHaveBeenCalled();
  });

  it("shows the user's subscription activity on Billing", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
        subscriptionEvents: [
          {
            provider: "creem",
            subscriptionId: "sub_1",
            customerId: "cust_1",
            status: "active",
            plan: "pro",
            interval: "month",
            currentPeriodStart: 1780963200,
            currentPeriodEnd: 1783555200,
            eventType: "checkout.completed",
            eventId: "evt_1",
            eventCreated: 1780963210,
          },
          {
            provider: "creem",
            subscriptionId: "sub_1",
            customerId: "cust_1",
            status: "canceling",
            plan: "pro",
            interval: "month",
            eventType: "subscription.scheduled_cancel",
            eventId: "evt_2",
            eventCreated: 1780964210,
          },
        ],
      },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect(await screen.findByText("Subscription activity")).toBeInTheDocument();
    expect(screen.getByText(/checkout\.completed/)).toBeInTheDocument();
    expect(screen.getByText(/subscription\.scheduled_cancel/)).toBeInTheDocument();
    expect(screen.getByText(/sub_1 - active - month/i)).toBeInTheDocument();
    expect(screen.getByText(/sub_1 - canceling - month/i)).toBeInTheDocument();
    expect(screen.getByText(/evt_1 - 2026-06-09 00:00 UTC/i)).toBeInTheDocument();
  });

  it("only shows subscription event records as activity", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
        subscriptions: [
          {
            provider: "creem",
            subscriptionId: "sub_1",
            customerId: "cust_1",
            status: "active",
            plan: "pro",
            interval: "month",
            lastEventType: "checkout.completed",
            lastEventId: "evt_snapshot",
            updatedAt: 1780963210,
          },
        ],
      },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await waitFor(() =>
      expect(document.querySelector(".billing-skeleton")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Subscription activity")).not.toBeInTheDocument();
    expect(screen.queryByText(/checkout\.completed/)).not.toBeInTheDocument();
  });

  it("does not expose a Creem portal entry for active paid subscribers", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "year",
      },
    });
    const navigate = vi.fn();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await waitFor(() =>
      expect(document.querySelector(".billing-skeleton")).not.toBeInTheDocument()
    );

    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage billing/i })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects unsafe interval-change URLs before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
      },
    });
    pullwiseApi.billing.changeSubscriptionInterval.mockResolvedValue({
      provider: "creem",
      interval: "year",
      url: "javascript:alert(1)",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /switch to yearly/i }));
    await user.click(await screen.findByRole("button", { name: /confirm change/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing interval URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects non-provider interval-change hosts before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
      },
    });
    pullwiseApi.billing.changeSubscriptionInterval.mockResolvedValue({
      provider: "creem",
      interval: "year",
      url: "https://evil.example/change",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /switch to yearly/i }));
    await user.click(await screen.findByRole("button", { name: /confirm change/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing interval URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });
});
