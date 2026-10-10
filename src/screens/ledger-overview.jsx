import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { ConsoleLayout } from "../components/console-layout.jsx";
import { LedgerSummary } from "../components/ledger-summary.jsx";
import { inclusiveRange, localMonth, monthRange } from "../lib/ledger-summary.js";
import { T, useLang } from "../i18n.jsx";
import { I } from "../icons.jsx";
import { Sidebar, Topbar } from "../shell.jsx";
import "./ledger.css";

export function LedgerOverviewScreen(props) {
  const scope = JSON.stringify([
    props.workspace?.id,
    props.workspace?.role,
    props.workspace?.revision,
    props.workspace?.memberRevision,
    props.workspace?.permissions,
  ]);
  return <ScopedOverview key={scope} {...props} />;
}

function ScopedOverview({
  go,
  api = ledgerApi,
  onAccessChanged,
  onReloadAccess,
  accessRefreshing = false,
}) {
  useLang();
  const id = useId();
  const [month, setMonth] = useState(localMonth);
  const [period, setPeriod] = useState("month");
  const [custom, setCustom] = useState(() => {
    const range = monthRange(localMonth());
    return { from: range?.from || "", end: range?.end || "" };
  });
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const mounted = useRef(false);
  const reloading = useRef(false);
  const range = useMemo(
    () => (period === "month" ? monthRange(month) : inclusiveRange(custom.from, custom.end)),
    [period, month, custom]
  );
  const from = range?.from;
  const to = range?.to;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setError(false);
    if (!from || !to) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    Promise.resolve()
      .then(() => api.reportSummary({ from, to }, { signal: controller.signal }))
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(true);
        if ([403, 404].includes(failure?.status)) onAccessChanged?.(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, from, to, revision, onAccessChanged]);
  const reload = async () => {
    if (reloading.current || loading || accessRefreshing) return;
    reloading.current = true;
    setAccessLoading(true);
    try {
      const unchanged = onReloadAccess ? await onReloadAccess() : true;
      if (mounted.current && unchanged) setRevision((value) => value + 1);
    } catch (failure) {
      if (mounted.current) {
        setResult(null);
        setError(true);
        if ([403, 404].includes(failure?.status)) onAccessChanged?.(failure);
      }
    } finally {
      reloading.current = false;
      if (mounted.current) setAccessLoading(false);
    }
  };
  const busy = loading || accessRefreshing || accessLoading;
  return (
    <div className="app product-workspace ledger-screen ledger-overview-screen fade-in">
      <Topbar go={go} loading={busy} breadcrumbs={[{ label: T("Spending overview") }]} />
      <ConsoleLayout>
        <Sidebar go={go} section="ledgerOverview" />
        <main className="main">
          <div className="page-h">
            <div>
              <h1>{T("Spending overview")}</h1>
              <p className="sub">
                {T(
                  "All projects and the shared pool in the selected ledger, counted once. Currencies stay separate."
                )}
              </p>
            </div>
            <div className="actions">
              <button
                className="btn ghost"
                type="button"
                disabled={busy || !range}
                onClick={reload}
              >
                <I.Refresh size={14} /> {T("Reload")}
              </button>
            </div>
          </div>
          <section className="panel ledger-overview-period" aria-label={T("Displayed period")}>
            <div className="ledger-filters ledger-summary-filters">
              <div className="ledger-field">
                <label htmlFor={`${id}-period`}>{T("Period")}</label>
                <select
                  id={`${id}-period`}
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                >
                  <option value="month">{T("Month")}</option>
                  <option value="custom">{T("Custom dates")}</option>
                </select>
              </div>
              {period === "month" ? (
                <div className="ledger-field">
                  <label htmlFor={`${id}-month`}>{T("Month")}</label>
                  <input
                    id={`${id}-month`}
                    type="month"
                    min="0001-01"
                    max="9999-11"
                    required
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div className="ledger-field">
                    <label htmlFor={`${id}-from`}>{T("From date")}</label>
                    <input
                      id={`${id}-from`}
                      type="date"
                      min="0001-01-01"
                      max={custom.end || "9999-12-30"}
                      required
                      value={custom.from}
                      onChange={(event) =>
                        setCustom((value) => ({ ...value, from: event.target.value }))
                      }
                    />
                  </div>
                  <div className="ledger-field">
                    <label htmlFor={`${id}-end`}>{T("End date (included)")}</label>
                    <input
                      id={`${id}-end`}
                      type="date"
                      min={custom.from || "0001-01-01"}
                      max="9999-12-30"
                      required
                      value={custom.end}
                      onChange={(event) =>
                        setCustom((value) => ({ ...value, end: event.target.value }))
                      }
                    />
                  </div>
                </>
              )}
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setMonth(localMonth());
                  setPeriod("month");
                }}
              >
                {T("This month")}
              </button>
            </div>
            {!range ? (
              <p className="notice notice-error ledger-help" role="status">
                {T("Choose a valid date range with the end on or after the start.")}
              </p>
            ) : (
              <p className="ledger-overview-range">
                <span>{T("Displayed period")}</span>
                <span>
                  <time>{range.from}</time> – <time>{range.end}</time>
                </span>
                <span>{T("Start and end dates are included.")}</span>
              </p>
            )}
          </section>
          <div aria-busy={busy} aria-label={T("Expense totals")}>
            {busy ? (
              <p role="status">{T("Loading spending totals…")}</p>
            ) : (
              range && <LedgerSummary report={result} error={error} />
            )}
          </div>
        </main>
      </ConsoleLayout>
    </div>
  );
}
