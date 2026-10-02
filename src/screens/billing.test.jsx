import { readFileSync } from "node:fs";
import { act, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { NotificationProvider } from "../components/notifications.jsx";
import { BillingScreen, PricingScreen } from "./billing.jsx";

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
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
    expect(document.body).not.toHaveTextContent("Configured in provider");
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
    expect(container.querySelectorAll(".billing-skeleton .panel")).toHaveLength(2);
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

  it("renders configurable ledger allowances and Max monthly Jev budget without inventing availability", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [...billingCatalog.plans, maxPlan].map((plan) => ({
        ...plan,
        entitlements: {
          limits: {
            projects: plan.id === "free" ? 3 : 100,
            expenseRecords: plan.id === "free" ? 500 : 20000,
          },
          jev: {
            eligible: plan.id === "max",
            available: false,
            monthlyBudgetUsd: plan.id === "max" ? "5.00" : "0.00",
            rollover: false,
          },
        },
      })),
    });
    const user = userEvent.setup();
    render(<PricingScreen go={vi.fn()} auth={{ authenticated: false }} navigate={vi.fn()} />);
    expect(await screen.findByText("Projects: 3")).toBeInTheDocument();
    expect(screen.getAllByText("Projects: 100")).toHaveLength(2);
    expect(screen.getByText("Expense records: 500")).toBeInTheDocument();
    expect(screen.getAllByText("Expense records: 20,000")).toHaveLength(2);
    expect(screen.getByText("Jev budget: $5.00 / month")).toBeInTheDocument();
    expect(screen.getByText("Activation pending · no rollover")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /yearly/i }));
    expect(screen.getByText("Jev budget: $5.00 / month")).toBeInTheDocument();
  });

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

    expect(await screen.findAllByText("Configured in provider")).toHaveLength(3);
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
    expect(dialog).toHaveTextContent(/prorated charge today/i);
    expect(dialog).toHaveTextContent(/Creem charges the prorated difference/i);

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
    expect(dialog).toHaveTextContent(/prorated charge today/i);
    expect(dialog).toHaveTextContent(/Creem charges the prorated difference/i);

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
