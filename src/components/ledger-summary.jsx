import { T } from "../i18n.jsx";
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

export function LedgerSummary({ report, error = false, sharedOnly = false }) {
  const rows = error ? null : summaryCurrencies(report);
  return (
    <section
      className="panel ledger-summary"
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
            <dl className="ledger-summary-currency" key={row.currency} data-currency={row.currency}>
              {sharedOnly ? (
                <div>
                  <dt>{T("Shared pool", "公共支出池")}</dt>
                  <dd>
                    <SummaryValue currency={row.currency} amount={row.shared} />
                  </dd>
                </div>
              ) : (
                <>
                  <div className="ledger-summary-primary">
                    <dt>{T("All expenses")}</dt>
                    <dd>
                      <SummaryValue currency={row.currency} amount={row.account} />
                    </dd>
                  </div>
                  <div>
                    <dt>{T("All projects")}</dt>
                    <dd>
                      <SummaryValue currency={row.currency} amount={row.project} />
                    </dd>
                  </div>
                  <div>
                    <dt>{T("Shared pool", "公共支出池")}</dt>
                    <dd>
                      <SummaryValue currency={row.currency} amount={row.shared} />
                    </dd>
                  </div>
                </>
              )}
            </dl>
          ))}
        </div>
      )}
    </section>
  );
}
