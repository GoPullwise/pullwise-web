import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
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

describe("BillingScreen", () => {
  const billingCatalog = {
    enabled: true,
    provider: "creem",
    currency: "USD",
    plans: [
      {
        id: "free",
        name: "Free",
        description: "Try Pullwise with a small monthly review allowance.",
        reviewLimit: 5,
        repositoryLimits: { maxFiles: 200, maxBytes: 5 * 1024 * 1024 },
        prices: {
          month: { amount: "0", currency: "USD", interval: "month", configured: true },
        },
      },
      {
        id: "pro",
        name: "Pullwise Pro",
        description: "Repository review for production teams.",
        reviewLimit: 100,
        repositoryLimits: { maxFiles: 1000, maxBytes: 20 * 1024 * 1024 },
        prices: {
          month: { amount: "29", currency: "USD", interval: "month", configured: true },
          year: { amount: "290", currency: "USD", interval: "year", configured: true },
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("keeps pricing skeletons after the initial pricing request times out", async () => {
    pullwiseApi.billing.getPlan.mockRejectedValue(new Error("timeout of 12000ms exceeded"));

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/timeout/i);
    expect(document.querySelectorAll(".pricing-card")).toHaveLength(3);
    expect(document.querySelectorAll(".pricing-skeleton").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole("button", { name: /start max/i })).toBeDisabled();
    expect(document.body).not.toHaveTextContent("Configured in provider");
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
      workspace: { status: "none", plan: "free" },
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

  it("renders billing workspace skeletons while billing data is loading", () => {
    pullwiseApi.billing.getPlan.mockReturnValue(new Promise(() => {}));

    const { container } = render(<BillingScreen go={vi.fn()} setIssue={vi.fn()} />);

    expect(container.querySelector(".billing-skeleton")).toBeInTheDocument();
    expect(container.querySelectorAll(".billing-skeleton .bill-card")).toHaveLength(3);
    expect(screen.queryByText(/billing is not configured/i)).not.toBeInTheDocument();
  });

  it("starts checkout through the configured backend billing provider", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      workspace: { status: "none" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "creem",
      url: "https://creem.io/checkout/chk_test",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={navigate} />);

    expect(await screen.findByText("Workspace plans")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Creem");
    await user.click(screen.getByRole("button", { name: /start pro/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: "pro",
          interval: "month",
        })
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
          description: "Higher-capacity repository review for production teams.",
          reviewLimit: 90,
          prices: {
            month: { amount: "49", currency: "USD", interval: "month", configured: true },
            year: { amount: "490", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
      workspace: { status: "none", plan: "free" },
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
        })
      );
      expect(navigate).toHaveBeenCalledWith("https://creem.io/checkout/chk_max");
    });
  });

  it("shows Max-specific reasoning and yearly savings", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        ...billingCatalog.plans,
        {
          id: "max",
          name: "Pullwise Max",
          description: "Higher-capacity repository review for production teams.",
          reviewLimit: 90,
          prices: {
            month: { amount: "49", currency: "USD", interval: "month", configured: true },
            year: { amount: "490", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
      workspace: { status: "none", plan: "free" },
    });
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findByText("Pullwise Max")).toBeInTheDocument();
    expect(screen.getByText("Deeper reasoning")).toBeInTheDocument();

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
      workspace: { status: "none", plan: "free" },
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
      workspace: { status: "none" },
    });
    const go = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={go} navigate={vi.fn()} />);

    expect(await screen.findByText(/0 \/ 5 reviews used/i)).toBeInTheDocument();
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
      workspace: { status: "none", plan: "free" },
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
      workspace: { status: "none", plan: "free" },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await screen.findByRole("link", { name: /view pricing/i });
    const headerActions = document.querySelector(".page-h .actions");

    expect(headerActions).not.toHaveTextContent("Disabled");
    expect(headerActions.querySelector(".tag")).toBeNull();
  });

  it("labels the workspace usage meter with the current plan instead of raw billing status", async () => {
    const resetAt = Date.UTC(2026, 5, 1, 0, 0, 0) / 1000;
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      workspace: {
        status: "none",
        plan: "free",
        usage: { period: "2026-05", used: 2, limit: 5, remaining: 3, resetAt },
      },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect(await screen.findByText(/2 \/ 5 reviews used/)).toBeInTheDocument();
    expect(screen.getByText(/Monthly quota resets 2026-06-01 00:00 UTC/i)).toBeInTheDocument();
    const usageTag = document.querySelector(".billing-summary-meter .tag");
    expect(usageTag).toHaveTextContent("Free");
    expect(usageTag).not.toHaveTextContent("none");
  });

  it("rejects unsafe checkout URLs before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      workspace: { status: "none" },
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
      workspace: { status: "none" },
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
      workspace: { status: "none" },
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
      workspace: { status: "none" },
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
      workspace: {
        status: "active",
        plan: "pro",
        interval: "month",
        usage: { period: "2026-05", used: 42, limit: 100, remaining: 58 },
      },
    });
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByText("5 shared workspace reviews / month")).toBeInTheDocument();
    expect(screen.getByText("Repository checkout up to 200 files / 5 MB")).toBeInTheDocument();
    expect(screen.getByText("Repository checkout up to 1,000 files / 20 MB")).toBeInTheDocument();
    expect(screen.getByText("Repository checkout up to 2,000 files / 50 MB")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /yearly/i }));

    expect(screen.getByText("$290")).toBeInTheDocument();
    expect(screen.getAllByText(/2 months free/i)).toHaveLength(2);
  });

  it("does not leak NaN when billing usage numbers are malformed", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        { ...billingCatalog.plans[0], reviewLimit: "not-a-number" },
        { ...billingCatalog.plans[1], reviewLimit: "not-a-number" },
      ],
      workspace: {
        status: "active",
        plan: "pro",
        interval: "month",
        usage: { period: "2026-05", used: "not-a-number", limit: "not-a-number", remaining: -3 },
      },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect(await screen.findByText(/0 \/ 0 reviews used/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("NaN");
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
      workspace: {
        status: "none",
        plan: "free",
        usage: { used: 0, limit: 5, remaining: 5, period: "2026-05" },
      },
    });

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findAllByText("Configured in provider")).toHaveLength(2);
    expect(document.body).not.toHaveTextContent("$-5");
    expect(document.body).not.toHaveTextContent("$not-a-number");
  });

  it("starts yearly checkout when yearly billing is selected", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      workspace: {
        status: "none",
        plan: "free",
        usage: { used: 0, limit: 5, remaining: 5, period: "2026-05" },
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
        })
      );
      expect(navigate).toHaveBeenCalledWith("https://creem.io/checkout/chk_yearly");
    });
  });

  it("asks active monthly subscribers to confirm yearly switching before changing billing", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "active",
          plan: "pro",
          interval: "month",
          usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "active",
          plan: "pro",
          interval: "year",
          usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
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

  it("asks active Pro subscribers to confirm Max switching before changing billing", async () => {
    const maxPlan = {
      id: "max",
      name: "Pullwise Max",
      description: "Higher-capacity repository review for production teams.",
      reviewLimit: 90,
      prices: {
        month: { amount: "49", currency: "USD", interval: "month", configured: true },
        year: { amount: "490", currency: "USD", interval: "year", configured: true },
      },
    };
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        workspace: {
          status: "active",
          plan: "pro",
          interval: "month",
          usage: { period: "2026-05", used: 12, limit: 60, remaining: 48 },
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        workspace: {
          status: "active",
          plan: "max",
          interval: "month",
          usage: { period: "2026-05", used: 12, limit: 90, remaining: 78 },
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

  it("refreshes usage, reset time, and subscription activity after an in-app upgrade", async () => {
    const maxPlan = {
      id: "max",
      name: "Pullwise Max",
      description: "Higher-capacity repository review for production teams.",
      reviewLimit: 90,
      prices: {
        month: { amount: "49", currency: "USD", interval: "month", configured: true },
        year: { amount: "490", currency: "USD", interval: "year", configured: true },
      },
    };
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        workspace: {
          status: "active",
          plan: "pro",
          interval: "month",
          usage: { period: "2026-05", used: 12, limit: 60, remaining: 48 },
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        plans: [...billingCatalog.plans, maxPlan],
        workspace: {
          status: "active",
          plan: "max",
          interval: "month",
          usage: {
            period: "2026-06",
            used: 0,
            limit: 90,
            remaining: 90,
            resetAt: 1783555200,
          },
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

    expect(await screen.findByText(/12 \/ 60 reviews used/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /switch to max/i }));
    await user.click(await screen.findByRole("button", { name: /confirm change/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.getPlan).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/0 \/ 90 reviews used/i)).toBeInTheDocument();
    expect(screen.getByText(/Monthly quota resets 2026-07-09 00:00 UTC/i)).toBeInTheDocument();
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
          description: "Higher-capacity repository review for production teams.",
          reviewLimit: 90,
          prices: {
            month: { amount: "49", currency: "USD", interval: "month", configured: true },
            year: { amount: "490", currency: "USD", interval: "year", configured: true },
          },
        },
      ],
      workspace: {
        status: "active",
        plan: "max",
        interval: "year",
        usage: { period: "2026-05", used: 12, limit: 90, remaining: 78 },
      },
    });

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect((await screen.findAllByText("Pullwise Max")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /switch to pro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to monthly/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /confirm billing change/i })).not.toBeInTheDocument();
    expect(pullwiseApi.billing.changeSubscriptionInterval).not.toHaveBeenCalled();
  });

  it("schedules subscription cancellation from Billing", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "active",
          plan: "pro",
          interval: "year",
          usage: { period: "2026-05", used: 12, limit: 60, remaining: 48 },
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "canceling",
          plan: "pro",
          interval: "year",
          cancelAtPeriodEnd: true,
          usage: { period: "2026-05", used: 12, limit: 60, remaining: 48 },
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

    await waitFor(() => {
      expect(pullwiseApi.billing.cancelSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "scheduled",
        })
      );
    });
    expect(screen.queryByRole("button", { name: /cancel renewal/i })).not.toBeInTheDocument();
  });

  it("offers resume renewal while cancellation is scheduled", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "canceling",
          plan: "pro",
          interval: "month",
          cancelAtPeriodEnd: true,
          usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "active",
          plan: "pro",
          interval: "month",
          cancelAtPeriodEnd: false,
          canceledAt: null,
          usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
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
    expect(screen.getByRole("button", { name: /switch to yearly/i })).toBeInTheDocument();
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

  it("lets subscribers upgrade while cancellation is scheduled", async () => {
    pullwiseApi.billing.getPlan
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "canceling",
          plan: "pro",
          interval: "month",
          cancelAtPeriodEnd: true,
          usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
        },
      })
      .mockResolvedValueOnce({
        ...billingCatalog,
        workspace: {
          status: "active",
          plan: "pro",
          interval: "year",
          cancelAtPeriodEnd: false,
          canceledAt: null,
          usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
        },
      });
    pullwiseApi.billing.changeSubscriptionInterval.mockResolvedValue({
      provider: "creem",
      plan: "pro",
      interval: "year",
      status: "active",
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /switch to yearly/i }));
    await user.click(await screen.findByRole("button", { name: /confirm change/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.changeSubscriptionInterval).toHaveBeenCalledWith(
        expect.objectContaining({
          interval: "year",
        })
      );
    });
    expect(screen.queryByRole("button", { name: /resume renewal/i })).not.toBeInTheDocument();
  });

  it("shows the user's subscription activity on Billing", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      workspace: {
        status: "active",
        plan: "pro",
        interval: "month",
        usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
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
      workspace: {
        status: "active",
        plan: "pro",
        interval: "month",
        usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
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

    expect(await screen.findByText(/12 \/ 100 reviews used/i)).toBeInTheDocument();
    expect(screen.queryByText("Subscription activity")).not.toBeInTheDocument();
    expect(screen.queryByText(/checkout\.completed/)).not.toBeInTheDocument();
  });

  it("does not expose a Creem portal entry for active paid subscribers", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      workspace: {
        status: "active",
        plan: "pro",
        interval: "year",
        usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
      },
    });
    const navigate = vi.fn();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    expect(await screen.findByText(/12 \/ 100 reviews used/i)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage billing/i })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects unsafe interval-change URLs before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      workspace: {
        status: "active",
        plan: "pro",
        interval: "month",
        usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
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
      workspace: {
        status: "active",
        plan: "pro",
        interval: "month",
        usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
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
