import { Fragment } from "react";

// Formatting and validity belong to the caller. This only gives an exact,
// already formatted value a shared hierarchy and safe grouping breakpoints.
export function FinancialValue({ value, numeric = true, className = "" }) {
  const text = String(value ?? "");
  const groups = text.split(",");
  return (
    <span
      className={[numeric ? "financial-value" : "financial-unavailable", className]
        .filter(Boolean)
        .join(" ")}
    >
      {numeric
        ? groups.map((group, index) => (
            <Fragment key={index}>
              {group}
              {index < groups.length - 1 && (
                <>
                  ,<wbr />
                </>
              )}
            </Fragment>
          ))
        : text}
    </span>
  );
}
