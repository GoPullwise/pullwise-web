import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { BillingScreen } from "./billing.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    billing: {
      getPlan: vi.fn(),
      createCheckoutSession: vi.fn(),
      createPortalSession: vi.fn(),
    },
  },
}));

describe("BillingScreen", () => {
  it("starts checkout through the configured backend billing provider", async () => {
    pullwiseApi.billing.getPlan.mockResolvedValue({
      enabled: true,
      provider: "stripe",
      name: "Pullwise Pro",
      amount: "29",
      currency: "USD",
      interval: "month",
      account: { status: "none" },
    });
    pullwiseApi.billing.createCheckoutSession.mockResolvedValue({
      provider: "stripe",
      url: "https://checkout.stripe.com/cs/test",
    });
    const assign = vi.spyOn(window.location, "assign").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<BillingScreen go={vi.fn()} />);

    expect(await screen.findByText("Stripe")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /start checkout/i }));

    await waitFor(() => {
      expect(pullwiseApi.billing.createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/cs/test");
    });
    assign.mockRestore();
  });
});
