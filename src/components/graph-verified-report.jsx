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

function graphEvidenceValue(value) {
  const graph = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    sliceId: text(graph.slice_id ?? graph.sliceId),
    pathSummary: textList(graph.path_summary ?? graph.pathSummary),
    codegraphFiles: textList(graph.codegraph_files ?? graph.codegraphFiles),
  };
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
  const graph = graphEvidenceValue(item?.candidate?.graph_evidence);
  return [
    graph.sliceId ? `slice: ${graph.sliceId}` : "",
    ...graph.pathSummary,
    ...graph.codegraphFiles.map((file) => `file: ${file}`),
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

function reportCount(report, key) {
  const count = Number(report?.[key]);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function countSummary(report, count) {
  const rejected = reportCount(report, "rejectedCount");
  const blocked = reportCount(report, "blockedCount");
  const parts = [`${count} confirmed`];
  if (rejected) parts.push(`${rejected} rejected`);
  if (blocked) parts.push(`${blocked} blocked`);
  return parts.join(" | ");
}

const PATH_SEPARATOR = /\s*(?:->|=>|→|⇒|›|»)\s*/;
const GRAPH_NODE_WIDTH = 132;
const GRAPH_NODE_HEIGHT = 34;
const GRAPH_NODE_GAP = 28;
const GRAPH_ROW_GAP = 58;
const GRAPH_PADDING_X = 18;
const GRAPH_PADDING_TOP = 28;

function splitGraphPath(value) {
  return text(value)
    .split(PATH_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

function shortLabel(value, maxLength = 24) {
  const label = text(value);
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}...`;
}

function safeTestId(value) {
  return text(value).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "evidence";
}

function graphRows(evidence) {
  const pathRows = evidence.pathSummary
    .map(splitGraphPath)
    .filter((row) => row.length)
    .slice(0, 3);
  if (pathRows.length) {
    return pathRows.map((row) => (evidence.sliceId ? [`slice: ${evidence.sliceId}`, ...row] : row));
  }
  const fileRows = evidence.codegraphFiles.slice(0, 4);
  if (fileRows.length) {
    return [evidence.sliceId ? [`slice: ${evidence.sliceId}`, ...fileRows] : fileRows];
  }
  return evidence.sliceId ? [[`slice: ${evidence.sliceId}`]] : [];
}

function GraphNode({ label, x, y, kind }) {
  return (
    <g className={`graph-verified-node ${kind}`} transform={`translate(${x} ${y})`}>
      <title>{label}</title>
      <rect width={GRAPH_NODE_WIDTH} height={GRAPH_NODE_HEIGHT} rx="7" />
      <text x={GRAPH_NODE_WIDTH / 2} y="21" textAnchor="middle">
        {shortLabel(label)}
      </text>
    </g>
  );
}

export function GraphVerifiedEvidenceGraph({ graph, label = "" }) {
  const evidence = graphEvidenceValue(graph);
  const rows = graphRows(evidence);
  if (!rows.length) return null;

  const hasPathRows = evidence.pathSummary.some((entry) => splitGraphPath(entry).length);
  const files = hasPathRows ? evidence.codegraphFiles.slice(0, 4) : [];
  const maxRowLength = Math.max(...rows.map((row) => row.length), files.length || 0, 1);
  const width = Math.max(
    360,
    GRAPH_PADDING_X * 2 + maxRowLength * GRAPH_NODE_WIDTH + (maxRowLength - 1) * GRAPH_NODE_GAP
  );
  const fileRowY = GRAPH_PADDING_TOP + rows.length * GRAPH_ROW_GAP + 18;
  const height = fileRowY + (files.length ? GRAPH_NODE_HEIGHT + 22 : 4);
  const graphLabel = text(label) || evidence.sliceId || rows[0].join(" to ");

  return (
    <div className="graph-verified-graph" data-testid={`graph-verified-graph-${safeTestId(graphLabel)}`}>
      <div className="graph-verified-graph-label">{T("Graph path", "Graph path")}</div>
      <svg
        role="img"
        aria-label={T(`GraphVerified graph path for ${graphLabel}`, `GraphVerified graph path for ${graphLabel}`)}
        viewBox={`0 0 ${width} ${height}`}
      >
        {rows.map((row, rowIndex) => {
          const y = GRAPH_PADDING_TOP + rowIndex * GRAPH_ROW_GAP;
          return (
            <g key={`row-${rowIndex}`}>
              {row.slice(0, -1).map((node, nodeIndex) => {
                const x1 = GRAPH_PADDING_X + nodeIndex * (GRAPH_NODE_WIDTH + GRAPH_NODE_GAP) + GRAPH_NODE_WIDTH;
                const x2 = GRAPH_PADDING_X + (nodeIndex + 1) * (GRAPH_NODE_WIDTH + GRAPH_NODE_GAP);
                const cy = y + GRAPH_NODE_HEIGHT / 2;
                return (
                  <line
                    key={`${rowIndex}-${nodeIndex}-${node}`}
                    className="graph-verified-edge"
                    x1={x1}
                    y1={cy}
                    x2={x2}
                    y2={cy}
                    aria-hidden="true"
                  />
                );
              })}
              {row.map((node, nodeIndex) => (
                <GraphNode
                  key={`${rowIndex}-${nodeIndex}-${node}`}
                  label={node}
                  x={GRAPH_PADDING_X + nodeIndex * (GRAPH_NODE_WIDTH + GRAPH_NODE_GAP)}
                  y={y}
                  kind={nodeIndex === 0 && node.startsWith("slice:") ? "slice" : "path"}
                />
              ))}
            </g>
          );
        })}
        {files.length > 0 && (
          <g className="graph-verified-files">
            {files.map((file, index) => {
              const sourceRow = rows[0];
              const sourceIndex = Math.max(0, sourceRow.length - 1);
              const sourceX = GRAPH_PADDING_X + sourceIndex * (GRAPH_NODE_WIDTH + GRAPH_NODE_GAP) + GRAPH_NODE_WIDTH / 2;
              const sourceY = GRAPH_PADDING_TOP + GRAPH_NODE_HEIGHT;
              const fileX = GRAPH_PADDING_X + index * (GRAPH_NODE_WIDTH + GRAPH_NODE_GAP);
              const fileY = fileRowY;
              return (
                <g key={`file-${file}-${index}`}>
                  <line
                    className="graph-verified-edge file-link"
                    x1={sourceX}
                    y1={sourceY}
                    x2={fileX + GRAPH_NODE_WIDTH / 2}
                    y2={fileY}
                    aria-hidden="true"
                  />
                  <GraphNode label={file} x={fileX} y={fileY} kind="file" />
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

export function GraphVerifiedReport({ report, compact = false, showEmpty = false }) {
  const safeReport = report || {};
  const items = confirmedItems(report);
  const count = confirmedCount(report, items);
  const hasReport =
    report &&
    (count ||
      items.length ||
      reportCount(report, "rejectedCount") ||
      reportCount(report, "blockedCount") ||
      text(report.runId) ||
      text(report.mode));
  if (!hasReport && !showEmpty) return null;

  const visibleItems = compact ? items.slice(0, 2) : items;
  return (
    <section className={"graph-verified-report" + (compact ? " compact" : "")}>
      <div className="graph-verified-report-h">
        <span>{T("GraphVerified findings", "GraphVerified findings")}</span>
        <span className="graph-verified-report-meta">
          {T(countSummary(report, count), countSummary(report, count))}
        </span>
      </div>

      {!compact && (
        <div className="scan-preflight-meta">
          {text(safeReport.mode) && <span className="tag">{safeReport.mode}</span>}
          {text(safeReport.base) && <span className="tag">base {safeReport.base}</span>}
          {text(safeReport.head) && <span className="tag">head {safeReport.head}</span>}
          {text(safeReport.runId) && <span className="tag">{safeReport.runId}</span>}
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
                      <GraphVerifiedEvidenceGraph
                        graph={item?.candidate?.graph_evidence}
                        label={text(item?.candidate?.candidate_id) || itemTitle(item, index)}
                      />
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
        <div className="muted">
          {hasReport
            ? T("No confirmed GraphVerified findings.", "没有已确认的 GraphVerified 问题。")
            : T(
                "No GraphVerified report is available for this scan. Re-run it with the GraphVerified worker.",
                "这个扫描没有可用的 GraphVerified 报告。请使用 GraphVerified worker 重新运行。"
              )}
        </div>
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
