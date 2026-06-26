import { useCallback, useEffect, useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
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

const PATH_SEPARATOR = /\s*(?:->|=>|\u2192|\u21d2|\u203a|\u00bb)\s*/u;
const GRAPH_NODE_WIDTH = 160;
const GRAPH_FILE_NODE_WIDTH = 200;
const GRAPH_NODE_BASE_HEIGHT = 58;
const GRAPH_NODE_LINE_HEIGHT = 15;
const GRAPH_MIN_HEIGHT = 190;
const GRAPH_MAX_HEIGHT = 520;
const GRAPH_MAX_PATHS = 4;
const GRAPH_MAX_FILES = 5;
const GRAPH_NODE_TYPES = { evidence: GraphEvidenceNode };
const GRAPH_FIT_VIEW_OPTIONS = { padding: 0.14, minZoom: 0.55, maxZoom: 1.12 };

function splitGraphPath(value) {
  return text(value)
    .split(PATH_SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

function safeTestId(value) {
  return text(value).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "evidence";
}

function pathRows(evidence) {
  return evidence.pathSummary
    .map(splitGraphPath)
    .filter((row) => row.length)
    .slice(0, GRAPH_MAX_PATHS);
}

function graphNodeWidth(kind) {
  return kind === "file" ? GRAPH_FILE_NODE_WIDTH : GRAPH_NODE_WIDTH;
}

function graphNodeHeight(label, kind) {
  const charsPerLine = kind === "file" ? 24 : 19;
  const lines = Math.max(1, Math.ceil(text(label).length / charsPerLine));
  return GRAPH_NODE_BASE_HEIGHT + Math.max(0, lines - 1) * GRAPH_NODE_LINE_HEIGHT;
}

function GraphEvidenceNode({ data }) {
  return (
    <div className={`graph-verified-flow-node ${data.kind}`} title={data.label}>
      <Handle className="graph-verified-flow-handle" type="target" position={Position.Left} />
      <div className="graph-verified-flow-node-caption">{data.caption}</div>
      <div className="graph-verified-flow-node-label">{data.label}</div>
      <Handle className="graph-verified-flow-handle" type="source" position={Position.Right} />
    </div>
  );
}

function buildGraphFlow(evidence) {
  const nodesByKey = new Map();
  const edgesByKey = new Map();
  const terminals = new Set();

  const addNode = (label, kind) => {
    const cleanLabel = text(label);
    if (!cleanLabel) return null;
    const key = `${kind}:${cleanLabel}`;
    const existing = nodesByKey.get(key);
    if (existing) return existing;
    const node = {
      id: `gv-node-${nodesByKey.size}`,
      type: "evidence",
      data: {
        kind,
        label: cleanLabel,
        caption: kind === "slice" ? "slice" : kind === "file" ? "file" : "path",
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: true,
      selectable: true,
    };
    nodesByKey.set(key, node);
    return node;
  };

  const addEdge = (source, target, kind = "path") => {
    if (!source?.id || !target?.id || source.id === target.id) return;
    const key = `${source.id}:${target.id}:${kind}`;
    if (edgesByKey.has(key)) return;
    edgesByKey.set(key, {
      id: `gv-edge-${edgesByKey.size}`,
      source: source.id,
      target: target.id,
      type: "smoothstep",
      className: kind === "file" ? "graph-verified-flow-edge file-link" : "graph-verified-flow-edge",
      label: kind === "file" ? "file" : "path",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 22,
        height: 22,
      },
      data: { kind },
      selectable: true,
      focusable: false,
    });
  };

  const sliceNode = evidence.sliceId ? addNode(evidence.sliceId, "slice") : null;
  const rows = pathRows(evidence);
  if (rows.length) {
    rows.forEach((row) => {
      let previous = sliceNode;
      row.forEach((label) => {
        if (sliceNode && label === evidence.sliceId) return;
        const current = addNode(label, "path");
        if (previous && current) addEdge(previous, current);
        previous = current || previous;
      });
      if (previous) terminals.add(previous);
    });
  }

  evidence.codegraphFiles.slice(0, GRAPH_MAX_FILES).forEach((file) => {
    const fileNode = addNode(file, "file");
    if (!fileNode) return;
    if (terminals.size) {
      terminals.forEach((terminal) => addEdge(terminal, fileNode, "file"));
    } else if (sliceNode) {
      addEdge(sliceNode, fileNode, "file");
    }
  });

  return {
    nodes: Array.from(nodesByKey.values()),
    edges: Array.from(edgesByKey.values()),
  };
}

function layoutGraphFlow(flow) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    align: "UL",
    nodesep: 26,
    ranksep: 32,
    marginx: 18,
    marginy: 18,
  });

  flow.nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: graphNodeWidth(node.data.kind),
      height: graphNodeHeight(node.data.label, node.data.kind),
    });
  });
  flow.edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);

  let minY = 0;
  let maxY = GRAPH_MIN_HEIGHT;
  const nodes = flow.nodes.map((node) => {
    const point = graph.node(node.id) || { x: 0, y: 0 };
    const width = graphNodeWidth(node.data.kind);
    const nodeHeight = graphNodeHeight(node.data.label, node.data.kind);
    const x = point.x - width / 2;
    const y = point.y - nodeHeight / 2;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + nodeHeight);
    return {
      ...node,
      position: { x, y },
      style: { width, height: nodeHeight },
    };
  });

  const height = Math.min(
    GRAPH_MAX_HEIGHT,
    Math.max(GRAPH_MIN_HEIGHT, Math.ceil(maxY - minY + 52))
  );
  return { nodes, edges: flow.edges, height };
}

function graphFlowModel(evidence) {
  const flow = buildGraphFlow(evidence);
  if (!flow.nodes.length) return null;
  return layoutGraphFlow(flow);
}

function graphFallbackLines(evidence) {
  const rows = pathRows(evidence);
  if (rows.length) {
    return rows.map((row) => (evidence.sliceId ? [evidence.sliceId, ...row] : row).join(" -> "));
  }
  return [
    evidence.sliceId ? `slice: ${evidence.sliceId}` : "",
    ...evidence.codegraphFiles.map((file) => `file: ${file}`),
  ].filter(Boolean);
}

function graphFlowClassName(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function GraphVerifiedEvidenceGraph({ graph, label = "" }) {
  const evidence = useMemo(() => graphEvidenceValue(graph), [graph]);
  const model = useMemo(() => graphFlowModel(evidence), [evidence]);
  const [nodes, setNodes, onNodesChange] = useNodesState(model?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(model?.edges || []);
  const [selectedEdgeId, setSelectedEdgeId] = useState("");

  useEffect(() => {
    setNodes(model?.nodes || []);
    setEdges(model?.edges || []);
    setSelectedEdgeId("");
  }, [model, setEdges, setNodes]);

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) || null,
    [edges, selectedEdgeId]
  );
  const linkedNodeIds = useMemo(
    () => new Set(selectedEdge ? [selectedEdge.source, selectedEdge.target] : []),
    [selectedEdge]
  );
  const visibleNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        className: graphFlowClassName(
          node.className,
          selectedEdge && linkedNodeIds.has(node.id) && "graph-verified-flow-node-linked",
          selectedEdge && !linkedNodeIds.has(node.id) && "graph-verified-flow-node-dimmed"
        ),
      })),
    [linkedNodeIds, nodes, selectedEdge]
  );
  const visibleEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        className: graphFlowClassName(
          edge.className,
          selectedEdgeId === edge.id && "highlighted",
          selectedEdgeId && selectedEdgeId !== edge.id && "dimmed"
        ),
      })),
    [edges, selectedEdgeId]
  );
  const onEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    setSelectedEdgeId((current) => (current === edge.id ? "" : edge.id));
  }, []);
  const clearEdgeHighlight = useCallback(() => setSelectedEdgeId(""), []);

  if (!model) return null;

  const graphLabel = text(label) || evidence.sliceId || graphFallbackLines(evidence)[0] || "evidence";
  const ariaLabel = T(
    `GraphVerified code evidence path for ${graphLabel}`,
    `GraphVerified code evidence path for ${graphLabel}`
  );

  return (
    <div className="graph-verified-graph" data-testid={`graph-verified-graph-${safeTestId(graphLabel)}`}>
      <div className="graph-verified-graph-label">{T("Code evidence path", "代码证据路径")}</div>
      <div className="graph-verified-graph-help">
        {T(
          "Shows how this finding connects through the code graph to the related files.",
          "展示这个问题如何通过代码图关联到相关文件。"
        )}
      </div>
      <div
        className="graph-verified-flow"
        role="img"
        aria-label={ariaLabel}
        style={{ height: model.height }}
      >
        <ReactFlow
          ariaLabel={ariaLabel}
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeClick={onEdgeClick}
          onPaneClick={clearEdgeHighlight}
          nodeTypes={GRAPH_NODE_TYPES}
          fitView
          fitViewOptions={GRAPH_FIT_VIEW_OPTIONS}
          minZoom={0.35}
          maxZoom={1.35}
          panOnDrag
          zoomOnPinch
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          onlyRenderVisibleElements
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background className="graph-verified-flow-bg" gap={18} size={1.2} />
        </ReactFlow>
        <div className="sr-only">{graphFallbackLines(evidence).join(" | ")}</div>
      </div>
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
