import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LedgerSummary } from "./ledger-summary.jsx";

const report = (rows) => ({
  groups: rows.flatMap(({ currency, account, project, shared }) =>
    Object.entries({ account, project, shared }).map(([target, amountMinor]) => ({
      currency,
      target,
      amountMinor,
    }))
  ),
});

describe("spending composition", () => {
  it("keeps each currency's shares independent and connects the chart to exact readable values", () => {
    const { container } = render(
      <LedgerSummary
        report={report([
          { currency: "USD", account: "1000", project: "100", shared: "900" },
          { currency: "JPY", account: "10", project: "9", shared: "1" },
        ])}
      />
    );
    const usd = container.querySelector('[data-currency="USD"].ledger-summary-currency');
    const jpy = container.querySelector('[data-currency="JPY"].ledger-summary-currency');
    expect(within(usd).getByText("10%")).toBeVisible();
    expect(within(jpy).getByText("90%")).toBeVisible();
    for (const currency of ["USD", "JPY"]) {
      const chart = screen.getByRole("img", { name: `Expense composition · ${currency}` });
      const legend = document.getElementById(chart.getAttribute("aria-describedby"));
      expect(legend).toHaveTextContent("All projects");
      expect(legend).toHaveTextContent("Shared pool");
      expect(legend.querySelectorAll(".financial-value")).toHaveLength(2);
    }
    expect(usd.querySelector(".ledger-summary-primary")).toHaveTextContent("USD 10.00");
    expect(jpy.querySelector(".ledger-summary-primary")).toHaveTextContent("JPY 10");
  });

  it("preserves unsafe-number-sized exact amounts and identifies tiny nonzero shares honestly", () => {
    render(
      <LedgerSummary
        report={report([
          {
            currency: "USD",
            account: "900719925474099302",
            project: "900719925474099301",
            shared: "1",
          },
        ])}
      />
    );
    expect(document.querySelector(".ledger-summary-primary")).toHaveTextContent(
      "USD 9,007,199,254,740,993.02"
    );
    expect(document.querySelector('[data-target="project"] dd')).toHaveTextContent(
      "USD 9,007,199,254,740,993.01"
    );
    expect(document.querySelector('[data-target="shared"] dd')).toHaveTextContent("USD 0.01");
    expect(screen.getByText("<0.1%")).toBeVisible();
    expect(screen.getByText(">99.9%")).toBeVisible();
  });

  it("distinguishes a real zero total from unavailable data and never assigns a share to zero total", () => {
    const view = render(
      <LedgerSummary
        report={report([{ currency: "USD", account: "0", project: "0", shared: "0" }])}
      />
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByRole("img")).toHaveAttribute("data-empty", "true");
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    view.rerender(
      <LedgerSummary
        report={report([{ currency: "USD", account: "invalid", project: "0", shared: "0" }])}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Spending summary is unavailable");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector(".financial-value")).toBeNull();
  });
});
