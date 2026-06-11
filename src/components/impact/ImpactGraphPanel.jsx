import { useMemo, useState } from "react";
import { I } from "../../icons.jsx";
import { T } from "../../i18n.jsx";
import { ImpactCoveragePanel } from "./ImpactCoveragePanel.jsx";
import { ImpactEvidenceDrawer } from "./ImpactEvidenceDrawer.jsx";
import { ImpactGraphCanvas } from "./ImpactGraphCanvas.jsx";
import { ImpactTargetCard } from "./ImpactTargetCard.jsx";
import { compactCount, impactCoverageCount } from "./impact-utils.js";

const IMPACT_TABS = [
  { key: "summary", label: "Summary" },
  { key: "targets", label: "Targets" },
  { key: "coverage", label: "Coverage" },
  { key: "graph", label: "Graph" },
];

function statCards(impactGraph) {
  const stats = impactGraph?.stats || {};
  return [
    { key: "targets", label: "Targets", value: stats.targets ?? impactGraph?.targets?.length ?? 0 },
    { key: "tested", label: "Tested", value: stats.testedTargets ?? 0 },
    { key: "docs", label: "Documented", value: stats.documentedTargets ?? 0 },
    { key: "config", label: "Configured", value: stats.configuredTargets ?? 0 },
  ];
}

export function ImpactGraphPanel({ impactGraph }) {
  const [tab, setTab] = useState("graph");
  const [drawer, setDrawer] = useState(null);
  const targets = Array.isArray(impactGraph?.targets) ? impactGraph.targets : [];
  const changedFiles = Array.isArray(impactGraph?.changedFiles) ? impactGraph.changedFiles : [];
  const coverageGapCount = impactCoverageCount(impactGraph?.coverage);
  const stats = useMemo(() => statCards(impactGraph), [impactGraph]);

  if (!impactGraph) {
    return (
      <section className="impact-panel">
        <div className="impact-panel-head">
          <div>
            <div className="impact-eyebrow">{T("Impact graph", "Impact graph")}</div>
            <h3>{T("Impact graph unavailable", "Impact graph unavailable")}</h3>
          </div>
        </div>
        <div className="impact-empty">
          {T(
            "This scan did not return an impact graph. Repository graph and issue evidence remain available.",
            "This scan did not return an impact graph. Repository graph and issue evidence remain available."
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="impact-panel">
      <div className="impact-panel-head">
        <div>
          <div className="impact-eyebrow">{T("Impact graph", "Impact graph")}</div>
          <h3>{T("Impact context", "Impact context")}</h3>
        </div>
        <div className="impact-panel-tags">
          <span className="tag">{impactGraph.version}</span>
          <span className="tag">{impactGraph.mode}</span>
          {impactGraph.stats?.truncated && <span className="tag">{T("truncated", "truncated")}</span>}
        </div>
      </div>

      <div className="seg impact-tabs" role="tablist" aria-label={T("Impact views", "Impact views")}>
        {IMPACT_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={"seg-i" + (tab === item.key ? " active" : "")}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {T(item.label, item.label)}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="impact-summary">
          <div className="impact-stat-grid">
            {stats.map((stat) => (
              <div className="impact-stat" key={stat.key}>
                <b>{stat.value}</b>
                <span>{T(stat.label, stat.label)}</span>
              </div>
            ))}
          </div>
          {impactGraph.summary && <p className="muted impact-summary-copy">{impactGraph.summary}</p>}
          {changedFiles.length > 0 && (
            <div className="impact-changed-files">
              <div className="impact-section-head compact">
                <div>
                  <div className="impact-eyebrow">{T("Changed files", "Changed files")}</div>
                  <h3>{compactCount(changedFiles.length, "file")}</h3>
                </div>
              </div>
              <div className="impact-path-list">
                {changedFiles.map((file) => (
                  <code key={file}>{file}</code>
                ))}
              </div>
            </div>
          )}
          <div className="impact-preview-grid">
            {targets.slice(0, 3).map((target) => (
              <ImpactTargetCard key={target.id} target={target} compact onEvidence={setDrawer} />
            ))}
            {targets.length === 0 && (
              <div className="impact-empty">{T("No impact targets were reported.", "No impact targets were reported.")}</div>
            )}
          </div>
          {coverageGapCount > 0 && <ImpactCoveragePanel coverage={impactGraph.coverage} />}
        </div>
      )}

      {tab === "targets" && (
        <div className="impact-target-list">
          {targets.map((target) => (
            <ImpactTargetCard key={target.id} target={target} onEvidence={setDrawer} />
          ))}
          {targets.length === 0 && (
            <div className="impact-empty">{T("No impact targets were reported.", "No impact targets were reported.")}</div>
          )}
        </div>
      )}

      {tab === "coverage" && <ImpactCoveragePanel coverage={impactGraph.coverage} />}

      {tab === "graph" && (
        <div className="impact-graph-tab">
          <div className="impact-section-head compact">
            <div>
              <div className="impact-eyebrow">{T("Graph canvas", "Graph canvas")}</div>
              <h3>{T("Tests, docs, config, and CI", "Tests, docs, config, and CI")}</h3>
            </div>
            <I.Activity size={16} />
          </div>
          <ImpactGraphCanvas impactGraph={impactGraph} />
        </div>
      )}

      <ImpactEvidenceDrawer
        title={drawer?.title || T("Impact evidence", "Impact evidence")}
        evidence={drawer?.evidence || []}
        onClose={() => setDrawer(null)}
      />
    </section>
  );
}
