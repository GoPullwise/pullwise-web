import { useId } from "react";
import { T, useLang } from "../i18n.jsx";
import { formatLedgerTotal, summaryCurrencies } from "../lib/ledger-summary.js";
import { FinancialValue } from "./financial-value.jsx";

function SummaryValue({ currency, amount }) {
  return (
    <FinancialValue
      currency={currency}
      value={formatLedgerTotal({ currency, amountMinor: amount.toString() })}
    />
  );
}

function CurrencySummary({ row, sharedOnly, lang }) {
  const id = useId();
  // Amounts stay exact. Only a bounded visual share leaves BigInt, and zero
  // expenses have no defined composition (rather than an invented 100%).
  const ratio = (amount) =>
    row.account === 0n ? 0 : Number((amount * 10000n) / row.account) / 10000;
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 });
  const share = (amount) => {
    if (row.account === 0n) return "—";
    if (amount > 0n && amount * 1000n < row.account) return `<${percent.format(0.001)}`;
    if (amount < row.account && amount * 1000n > row.account * 999n)
      return `>${percent.format(0.999)}`;
    return percent.format(ratio(amount));
  };
  return (
    <article
      className="ledger-summary-currency"
      data-currency={row.currency}
      aria-label={row.currency}
    >
      <dl className="ledger-summary-primary">
        <div>
          <dt>{T(sharedOnly ? "Shared pool" : "All expenses")}</dt>
          <dd>
            <SummaryValue currency={row.currency} amount={sharedOnly ? row.shared : row.account} />
          </dd>
        </div>
      </dl>
      {!sharedOnly && (
        <div className="ledger-summary-composition">
          <div className="ledger-summary-composition-h">
            <h3>{T("Expense composition")}</h3>
            <span>{T("Share of this currency's total")}</span>
          </div>
          <div
            className="ledger-summary-track"
            role="img"
            aria-label={`${T("Expense composition")} · ${row.currency}`}
            aria-describedby={`${id}-breakdown`}
            data-empty={row.account === 0n}
            data-mixed={row.project > 0n && row.shared > 0n}
          >
            <span
              className="ledger-summary-segment"
              data-target="project"
              aria-hidden="true"
              style={{ width: `${ratio(row.project) * 100}%` }}
            />
            <span
              className="ledger-summary-segment"
              data-target="shared"
              aria-hidden="true"
              style={{ width: `${row.account === 0n ? 0 : (1 - ratio(row.project)) * 100}%` }}
            />
          </div>
          <dl className="ledger-summary-breakdown" id={`${id}-breakdown`}>
            {[
              ["project", "All projects"],
              ["shared", "Shared pool"],
            ].map(([target, label]) => (
              <div key={target} data-target={target}>
                <dt>
                  <span className="ledger-summary-key" aria-hidden="true" />
                  {T(label)}
                </dt>
                <dd>
                  <SummaryValue currency={row.currency} amount={row[target]} />
                  <span className="ledger-summary-share">{share(row[target])}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </article>
  );
}

export function LedgerSummary({ report, error = false, sharedOnly = false }) {
  const lang = useLang();
  const rows = error ? null : summaryCurrencies(report);
  return (
    <section
      className={`panel ledger-summary${sharedOnly ? " ledger-summary-shared" : ""}`}
      aria-label={T(sharedOnly ? "Shared pool total" : "Expense totals")}
    >
      <div className="panel-h">
        <h2>{T(sharedOnly ? "Shared pool total" : "Expense totals")}</h2>
      </div>
      {rows === null ? (
        <p className="notice notice-error" role="status">
          {T("Spending summary is unavailable. Reload to try again.")}
        </p>
      ) : rows.length === 0 ? (
        <p>{T(sharedOnly ? "No shared expenses in this range." : "No expenses in this range.")}</p>
      ) : (
        <div className="ledger-summary-currencies">
          {rows.map((row) => (
            <CurrencySummary key={row.currency} row={row} sharedOnly={sharedOnly} lang={lang} />
          ))}
        </div>
      )}
    </section>
  );
}
