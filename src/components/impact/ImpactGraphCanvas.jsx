import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { I } from "../../icons.jsx";
import { T } from "../../i18n.jsx";
import { IMPACT_DEFAULT_GRAPH_RELATIONS, impactRelationItems } from "./impact-utils.js";

function graphNodeId(prefix, value) {
  return `${prefix}:${String(value || "").slice(0, 160)}`;
}

function relationNodeData(relation, key) {
  const label = relation.label || relation.path || relation.id || key;
  return {
    id: graphNodeId(key, relation.id || relation.path || label),
    label,
    role: key,
    path: relation.path || "",
  };
}

function buildImpactElements(impactGraph, relationKeys) {
  const elements = [];
  const nodeIds = new Set();
  const edgeIds = new Set();
  const addNode = (data) => {
    if (!data.id || nodeIds.has(data.id)) return;
    nodeIds.add(data.id);
    elements.push({ data });
  };
  const addEdge = (data) => {
    if (!data.id || edgeIds.has(data.id) || !nodeIds.has(data.source) || !nodeIds.has(data.target)) {
      return;
    }
    edgeIds.add(data.id);
    elements.push({ data });
  };

  for (const target of impactGraph?.targets || []) {
    const targetId = target.id || graphNodeId("target", target.path);
    addNode({
      id: targetId,
      label: target.label || target.path,
      role: "target",
      path: target.path,
    });
    for (const key of relationKeys) {
      for (const relation of impactRelationItems(target, key)) {
        const relationNode = relationNodeData(relation, key);
        addNode(relationNode);
        const source = key === "imports" ? targetId : relationNode.id;
        const targetNode = key === "imports" ? relationNode.id : targetId;
        addEdge({
          id: `${key}:${source}->${targetNode}`.slice(0, 220),
          source,
          target: targetNode,
          label: key,
        });
      }
    }
  }

  return elements;
}

function impactGraphElementsKey(elements) {
  const nodes = [];
  const edges = [];
  for (const element of elements) {
    const data = element?.data || {};
    if (data.source && data.target) {
      edges.push([data.id, data.source, data.target, data.label || ""]);
    } else {
      nodes.push([data.id, data.label || "", data.role || "", data.path || ""]);
    }
  }
  nodes.sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  edges.sort((left, right) => String(left[0]).localeCompare(String(right[0])));
  return JSON.stringify({ nodes, edges });
}

export function ImpactGraphCanvas({ impactGraph }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const elementCacheRef = useRef({ key: "", elements: [] });
  const [showImports, setShowImports] = useState(false);
  const relationKeys = useMemo(
    () =>
      showImports
        ? [...IMPACT_DEFAULT_GRAPH_RELATIONS, "imports", "importedBy"]
        : IMPACT_DEFAULT_GRAPH_RELATIONS,
    [showImports]
  );
  const elements = useMemo(() => {
    const nextElements = buildImpactElements(impactGraph, relationKeys);
    const nextKey = impactGraphElementsKey(nextElements);
    if (elementCacheRef.current.key === nextKey) {
      return elementCacheRef.current.elements;
    }
    elementCacheRef.current = { key: nextKey, elements: nextElements };
    return nextElements;
  }, [impactGraph, relationKeys]);

  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return undefined;
    const containerWidth = containerRef.current.clientWidth || 960;
    const containerHeight = containerRef.current.clientHeight || Math.round(containerWidth * 9 / 16);
    const layoutHeight = Math.max(containerHeight, 320);
    const layoutWidth = Math.max(containerWidth, Math.round(layoutHeight * 16 / 9));
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#2563eb",
            "border-color": "#eff6ff",
            "border-width": 1,
            color: "#0f172a",
            content: "data(label)",
            "font-size": 10,
            height: 18,
            label: "data(label)",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.88,
            "text-background-padding": 2,
            "text-halign": "center",
            "text-margin-y": 7,
            "text-max-width": 110,
            "text-opacity": 1,
            "text-valign": "bottom",
            "text-wrap": "ellipsis",
            width: 18,
          },
        },
        { selector: 'node[role = "target"]', style: { "background-color": "#16a34a", height: 26, width: 26 } },
        { selector: 'node[role = "tests"]', style: { "background-color": "#7c3aed" } },
        { selector: 'node[role = "documents"]', style: { "background-color": "#0891b2" } },
        { selector: 'node[role = "configures"]', style: { "background-color": "#ea580c" } },
        { selector: 'node[role = "ci"]', style: { "background-color": "#475569" } },
        { selector: 'node[role = "imports"]', style: { "background-color": "#64748b" } },
        { selector: 'node[role = "importedBy"]', style: { "background-color": "#0f766e" } },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            "text-opacity": 0,
            width: 1.4,
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        direction: "downward",
        grid: true,
        avoidOverlap: true,
        avoidOverlapPadding: 14,
        boundingBox: { x1: 0, y1: 0, w: layoutWidth, h: layoutHeight },
        nodeDimensionsIncludeLabels: true,
        spacingFactor: 1.35,
        animate: true,
        animationDuration: 550,
        animationEasing: "ease-out-cubic",
        fit: true,
        padding: 28,
      },
      userPanningEnabled: true,
      userZoomingEnabled: true,
      wheelSensitivity: 0.16,
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      if (cyRef.current === cy) cyRef.current = null;
    };
  }, [elements]);

  const fitGraph = () => {
    cyRef.current?.fit?.(undefined, 28);
  };

  return (
    <div className="impact-graph-canvas-wrap">
      <div className="impact-graph-toolbar">
        <label className="impact-toggle">
          <input
            type="checkbox"
            checked={showImports}
            onChange={(event) => setShowImports(event.target.checked)}
          />
          <span>{T("Imports", "Imports")}</span>
        </label>
        <button type="button" className="btn sm ghost" onClick={fitGraph}>
          <I.Search size={12} />
          {T("Fit graph", "Fit graph")}
        </button>
      </div>
      {elements.length === 0 ? (
        <div className="impact-empty">{T("No impact graph edges to render.", "No impact graph edges to render.")}</div>
      ) : (
        <div
          className="impact-graph-canvas"
          ref={containerRef}
          role="img"
          aria-label={T("Impact context graph", "Impact context graph")}
        />
      )}
    </div>
  );
}
