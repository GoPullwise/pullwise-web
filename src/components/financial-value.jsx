import { Fragment } from "react";

function GroupedValue({ text }) {
  const groups = text.split(",");
  return groups.map((group, index) => (
    <Fragment key={index}>
      {group}
      {index < groups.length - 1 && (
        <>
          ,<wbr />
        </>
      )}
    </Fragment>
  ));
}

export function CurrencyBadge({ currency }) {
  return (
    <span className="financial-value-currency" data-currency={currency}>
      {currency}
    </span>
  );
}

// Formatting and validity belong to the caller. A declared currency identifies
// its exact prefix; arbitrary text, precision and monetary arithmetic stay intact.
export function FinancialValue({ value, currency, numeric = true, className = "" }) {
  const text = String(value ?? "");
  const currencyPrefix = typeof currency === "string" && currency ? `${currency} ` : "";
  const money = numeric && currencyPrefix && text.startsWith(currencyPrefix);
  return (
    <span
      className={[
        numeric ? "financial-value" : "financial-unavailable",
        money ? "financial-value-money" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {money ? (
        <>
          <CurrencyBadge currency={currency} />{" "}
          <span className="financial-value-number">
            <GroupedValue text={text.slice(currencyPrefix.length)} />
          </span>
        </>
      ) : numeric ? (
        <GroupedValue text={text} />
      ) : (
        text
      )}
    </span>
  );
}
