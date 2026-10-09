import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinancialValue } from "./financial-value.jsx";

describe("FinancialValue", () => {
  it.each([
    ["USD", "USD 88.00"],
    ["JPY", "JPY 66750"],
    ["KWD", "KWD 180,143,985,094,819,823.007"],
    ["CNY", "CNY 0.00"],
  ])("separates declared %s currency while preserving every formatted digit", (currency, value) => {
    const { container } = render(<FinancialValue currency={currency} value={value} />);
    const money = container.querySelector(".financial-value-money");
    expect(money.textContent).toBe(value);
    expect(money.querySelector(".financial-value-currency")).toHaveTextContent(currency);
    expect(money.querySelector(".financial-value-currency")).toHaveAttribute(
      "data-currency",
      currency
    );
    expect(money.querySelector(".financial-value-number").textContent).toBe(
      value.slice(currency.length + 1)
    );
    expect(money).not.toHaveAttribute("aria-hidden");
    expect(money.querySelector(".financial-value-number")).not.toHaveAttribute("aria-hidden");
  });

  it("adds soft grouping breaks without changing precision or native selectable text", () => {
    const value = "USD 180,143,985,094,819,823.007";
    const { container } = render(<FinancialValue currency="USD" value={value} />);
    expect(container.textContent).toBe(value);
    expect(container.querySelectorAll("wbr")).toHaveLength(5);
    expect(container.querySelector(".financial-value-number").textContent).toBe(
      "180,143,985,094,819,823.007"
    );
  });

  it.each([
    { value: "USD 88.00" },
    { value: "USD 88.00", currency: "EUR" },
    { value: "USD88.00", currency: "USD" },
    { value: "$88.00" },
    { value: "1,234" },
  ])("does not infer currency parts from arbitrary text: $value", (props) => {
    const { container } = render(<FinancialValue {...props} />);
    expect(container.textContent).toBe(props.value);
    expect(container.querySelector(".financial-value-currency")).toBeNull();
  });

  it("keeps unavailable copy in body typography even with a declared currency", () => {
    const { container } = render(
      <FinancialValue
        value="Unavailable"
        currency="USD"
        numeric={false}
        className="ledger-amount"
      />
    );
    expect(container.firstChild).toHaveClass("financial-unavailable", "ledger-amount");
    expect(container.firstChild).not.toHaveClass("financial-value");
    expect(container.textContent).toBe("Unavailable");
    expect(container.querySelector(".financial-value-currency")).toBeNull();
  });
});
