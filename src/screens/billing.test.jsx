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
      createPortalSession: vi.fn(),
      changeSubscriptionInterval: vi.fn(),
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
        prices: {
          month: { amount: "0", currency: "USD", interval: "month", configured: true },
        },
      },
      {
        id: "pro",
        name: "Pullwise Pro",
        description: "Repository review for production teams.",
        reviewLimit: 100,
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

    expect(await screen.findByText("Creem")).toBeInTheDocument();
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

  it("labels the account usage meter with the current plan instead of raw billing status", async () => {
    const resetAt = Date.UTC(2026, 5, 1, 0, 0, 0) / 1000;
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
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
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
        usage: { period: "2026-05", used: 42, limit: 100, remaining: 58 },
      },
    });
    const user = userEvent.setup();

    render(<PricingScreen go={vi.fn()} auth={{ authenticated: true }} navigate={vi.fn()} />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByText("5 shared account reviews / month")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /yearly/i }));

    expect(screen.getByText("$290")).toBeInTheDocument();
    expect(screen.getByText(/2 months free/i)).toBeInTheDocument();
  });

  it("does not leak NaN when billing usage numbers are malformed", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      plans: [
        { ...billingCatalog.plans[0], reviewLimit: "not-a-number" },
        { ...billingCatalog.plans[1], reviewLimit: "not-a-number" },
      ],
      account: {
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
      account: {
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
      account: {
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

  it("lets active monthly subscribers switch to yearly or manage billing", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "month",
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
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeInTheDocument();
  });

  it("rejects unsafe billing portal URLs before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "year",
        usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
      },
    });
    pullwiseApi.billing.createPortalSession.mockResolvedValue({
      provider: "creem",
      url: "javascript:alert(1)",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /manage billing/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing portal URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects non-provider billing portal hosts before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
        status: "active",
        plan: "pro",
        interval: "year",
        usage: { period: "2026-05", used: 12, limit: 100, remaining: 88 },
      },
    });
    pullwiseApi.billing.createPortalSession.mockResolvedValue({
      provider: "creem",
      url: "https://evil.example/portal",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /manage billing/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing portal URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects unsafe interval-change URLs before navigating", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: {
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

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe billing interval URL/i);
    expect(navigate).not.toHaveBeenCalled();
  });
});
