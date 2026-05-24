import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { BillingScreen } from "./billing.jsx";

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
    provider: "stripe",
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
      provider: "stripe",
      url: "https://checkout.stripe.com/cs/test",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    expect(await screen.findByText("Stripe")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /start pro/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
        plan: "pro",
        interval: "month",
      }));
      expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/cs/test");
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

    render(<BillingScreen go={vi.fn()} navigate={vi.fn()} />);

    expect(await screen.findByText("Free")).toBeInTheDocument();
    expect(screen.getByText("5 reviews / month")).toBeInTheDocument();
    expect(screen.getByText("42 / 100 reviews used")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^yearly$/i }));

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

    expect(await screen.findByText("0 / 0 reviews used")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("NaN");
    expect(screen.getAllByText("0 reviews / month").length).toBeGreaterThan(0);
  });

  it("starts yearly checkout when yearly billing is selected", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      ...billingCatalog,
      account: { status: "none", plan: "free", usage: { used: 0, limit: 5, remaining: 5, period: "2026-05" } },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "stripe",
      url: "https://checkout.stripe.com/cs/yearly",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /^yearly$/i }));
    await user.click(screen.getByRole("button", { name: /start pro/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
        plan: "pro",
        interval: "year",
      }));
      expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/cs/yearly");
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
      provider: "stripe",
      interval: "year",
      url: "https://billing.stripe.com/session",
    });
    const navigate = vi.fn();
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} navigate={navigate} />);

    await user.click(await screen.findByRole("button", { name: /switch to yearly/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.changeSubscriptionInterval).toHaveBeenCalledWith(expect.objectContaining({
        interval: "year",
      }));
      expect(navigate).toHaveBeenCalledWith("https://billing.stripe.com/session");
    });
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeInTheDocument();
  });
});
