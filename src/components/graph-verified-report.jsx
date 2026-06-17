import { T } from "../i18n.jsx";

function text(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).replace(/\r/g, "").trim();
  }
  return "";
}

function textList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

function confirmedItems(report) {
  const items = report?.finalJson?.confirmed;
  return Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : [];
}

function itemTitle(item, index) {
  const candidate = item?.candidate || {};
  return (
    text(candidate.claim).split(". ", 1)[0] ||
    text(candidate.candidate_id) ||
    text(candidate.issue_id) ||
    `Finding ${index + 1}`
  );
}

function itemSeverity(item) {
  return text(item?.candidate?.severity) || "info";
}

function graphEvidenceLines(item) {
  const graph = item?.candidate?.graph_evidence || {};
  return [
    text(graph.slice_id) ? `slice: ${text(graph.slice_id)}` : "",
    ...textList(graph.path_summary),
    ...textList(graph.codegraph_files).map((file) => `file: ${file}`),
  ].filter(Boolean);
}

function codeEvidenceLines(item) {
  const evidence = Array.isArray(item?.candidate?.evidence) ? item.candidate.evidence : [];
  return evidence
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const location = [text(entry.file), text(entry.lines)].filter(Boolean).join(":");
      const why = text(entry.why_it_matters);
      return [location, why].filter(Boolean).join(" - ");
    })
    .filter(Boolean);
}

function reproductionCommand(item) {
  const commands = Array.isArray(item?.repro?.commands_run) ? item.repro.commands_run : [];
  const first = commands.find((command) => command && typeof command === "object");
  return text(first?.cmd) || text(item?.judge?.evidence_summary?.command);
}

function reproductionCommandMeta(item) {
  const commands = Array.isArray(item?.repro?.commands_run) ? item.repro.commands_run : [];
  const first = commands.find((command) => command && typeof command === "object") || {};
  return [
    text(first.exit_code) ? `exit ${text(first.exit_code)}` : "",
    text(first.log_path) || text(item?.judge?.evidence_summary?.log_path),
  ].filter(Boolean);
}

function proofLines(item) {
  const proof = item?.repro?.proof || {};
  return [
    text(proof.type) ? `type: ${text(proof.type)}` : "",
    text(proof.expected) ? `expected: ${text(proof.expected)}` : "",
    text(proof.actual) ? `actual: ${text(proof.actual)}` : "",
    text(proof.log_excerpt) ? `log: ${text(proof.log_excerpt)}` : "",
    item?.repro?.graph_path_exercised === true ? "graph path exercised" : "",
  ].filter(Boolean);
}

function judgeLines(item) {
  const judge = item?.judge || {};
  const evidence = judge.evidence_summary || {};
  return [
    text(judge.status) ? `status: ${text(judge.status)}` : "",
    text(judge.level) ? `level: ${text(judge.level)}` : "",
    typeof judge.safe_to_show_user === "boolean" ? `safe: ${judge.safe_to_show_user ? "true" : "false"}` : "",
    text(evidence.observable) ? `observable: ${text(evidence.observable)}` : "",
    text(judge.reason) ? `reason: ${text(judge.reason)}` : "",
  ].filter(Boolean);
}

function confirmedCount(report, items) {
  const count = Number(report?.confirmedCount);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : items.length;
}

export function GraphVerifiedReport({ report, compact = false }) {
  const items = confirmedItems(report);
  const count = confirmedCount(report, items);
  if (!report || (!count && !items.length && !text(report.runId))) return null;

  const visibleItems = compact ? items.slice(0, 2) : items;
  return (
    <section className={"graph-verified-report" + (compact ? " compact" : "")}>
      <div className="graph-verified-report-h">
        <span>{T("GraphVerified findings", "GraphVerified findings")}</span>
        <span className="graph-verified-report-meta">
          {T(`${count} confirmed`, `${count} confirmed`)}
        </span>
      </div>

      {!compact && (
        <div className="scan-preflight-meta">
          {text(report.mode) && <span className="tag">{report.mode}</span>}
          {text(report.base) && <span className="tag">base {report.base}</span>}
          {text(report.head) && <span className="tag">head {report.head}</span>}
          {text(report.runId) && <span className="tag">{report.runId}</span>}
        </div>
      )}

      {visibleItems.length > 0 ? (
        <div className="audit-card-list">
          {visibleItems.map((item, index) => {
            const graphLines = graphEvidenceLines(item);
            const codeLines = codeEvidenceLines(item);
            const command = reproductionCommand(item);
            const commandMeta = reproductionCommandMeta(item);
            const proof = proofLines(item);
            const judge = judgeLines(item);
            return (
              <article
                className="audit-card"
                key={text(item?.candidate?.candidate_id) || text(item?.candidate?.issue_id) || index}
              >
                <div className="audit-card-title">{itemTitle(item, index)}</div>
                <div className="audit-card-meta">
                  <span className="sev-mini">{itemSeverity(item)}</span>
                  {text(item?.candidate?.category) && <span>{item.candidate.category}</span>}
                  {text(item?.judge?.level || item?.repro?.level) && (
                    <span>{text(item?.judge?.level || item?.repro?.level)}</span>
                  )}
                </div>
                {!compact && (
                  <>
                    {graphLines.length > 0 && (
                      <EvidenceBlock title={T("Graph evidence", "Graph evidence")} items={graphLines} />
                    )}
                    {codeLines.length > 0 && (
                      <EvidenceBlock title={T("Code evidence", "Code evidence")} items={codeLines} />
                    )}
                    {command && (
                      <div className="audit-card-row">
                        <b>{T("Repro", "Repro")}</b>
                        <span>
                          <code className="tag evidence-command">{command}</code>
                          {commandMeta.length > 0 && (
                            <span className="graph-verified-inline-meta">{commandMeta.join(" | ")}</span>
                          )}
                        </span>
                      </div>
                    )}
                    {proof.length > 0 && (
                      <EvidenceBlock title={T("Proof", "Proof")} items={proof} />
                    )}
                    {judge.length > 0 && (
                      <EvidenceBlock title={T("Judge", "Judge")} items={judge} />
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="muted">{T("No confirmed findings.", "No confirmed findings.")}</div>
      )}
    </section>
  );
}

function EvidenceBlock({ title, items }) {
  return (
    <div className="audit-card-row graph-verified-evidence-block">
      <b>{title}</b>
      <ul>
        {items.slice(0, 6).map((item, index) => (
          <li key={`${title}-${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
