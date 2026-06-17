import { T } from "../i18n.jsx";

function markdownText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(markdownText).filter(Boolean).join("\n");
  if (typeof value === "object") return "";
  return String(value).replace(/\r/g, "").trim();
}

function graphVerifiedFinalMarkdown(report) {
  return markdownText(report?.finalMarkdown);
}

export function GraphVerifiedReport({ report, compact = false }) {
  const finalMarkdown = graphVerifiedFinalMarkdown(report);
  if (!finalMarkdown) return null;
  return (
    <section className={"graph-verified-report" + (compact ? " compact" : "")}>
      <div className="graph-verified-report-h">
        <span>{T("GraphVerified report", "GraphVerified 报告")}</span>
        {(report.confirmedCount || report.rejectedCount || report.blockedCount) && (
          <span className="graph-verified-report-meta">
            {T(
              `${report.confirmedCount || 0} confirmed / ${report.rejectedCount || 0} rejected / ${report.blockedCount || 0} blocked`,
              `${report.confirmedCount || 0} 个确认 / ${report.rejectedCount || 0} 个拒绝 / ${report.blockedCount || 0} 个阻止`
            )}
          </span>
        )}
      </div>
      <pre className="graph-verified-markdown">{finalMarkdown}</pre>
    </section>
  );
}
