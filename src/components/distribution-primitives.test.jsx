import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DistributionCard } from "./distribution-primitives.jsx";

describe("DistributionCard", () => {
  it("exposes clickable distribution buckets as keyboard-operable buttons", async () => {
    const onBucketClick = vi.fn();
    const user = userEvent.setup();
    render(
      <DistributionCard
        title="Severity"
        counts={{ high: 2, low: 1 }}
        buckets={[
          { key: "high", label: "High", color: "red" },
          { key: "low", label: "Low", color: "blue" },
        ]}
        onBucketClick={onBucketClick}
        activeKey="high"
      />
    );

    const high = screen.getByRole("button", { name: /high/i });
    expect(high).toHaveAttribute("aria-pressed", "true");
    high.focus();
    await user.keyboard("{Enter}");

    expect(onBucketClick).toHaveBeenCalledWith("high");
  });

  it("keeps display-only buckets as plain list items", () => {
    render(
      <DistributionCard
        title="Severity"
        counts={{ high: 2 }}
        buckets={[{ key: "high", label: "High", color: "red" }]}
      />
    );

    expect(screen.queryByRole("button", { name: /high/i })).not.toBeInTheDocument();
    expect(screen.getByText("High").closest("li")).toBeInTheDocument();
  });

  it("renders one donut arc for every non-empty bucket", () => {
    const { container } = render(
      <DistributionCard
        title="Severity"
        counts={{ high: 2, low: 1 }}
        buckets={[
          { key: "high", label: "High", color: "red" },
          { key: "low", label: "Low", color: "blue" },
        ]}
        layout="donut"
      />
    );

    expect(container.querySelectorAll(".disto-donut svg circle")).toHaveLength(3);
  });
});
