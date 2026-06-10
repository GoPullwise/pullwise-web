import { T } from "../../i18n.jsx";
import { IMPACT_COVERAGE_SECTIONS, impactCoverageCount } from "./impact-utils.js";

export function ImpactCoveragePanel({ coverage }) {
  const gapCount = impactCoverageCount(coverage);

  return (
    <div className="impact-coverage-panel">
      <div className="impact-section-head">
        <div>
          <div className="impact-eyebrow">{T("Coverage gaps", "Coverage gaps")}</div>
          <h3>{T("Coverage", "Coverage")}</h3>
        </div>
        <span className="tag">{T(`${gapCount} gaps`, `${gapCount} gaps`)}</span>
      </div>
      <div className="impact-coverage-grid">
        {IMPACT_COVERAGE_SECTIONS.map((section) => {
          const items = Array.isArray(coverage?.[section.key]) ? coverage[section.key] : [];
          return (
            <section className="impact-coverage-section" key={section.key}>
              <div className="impact-coverage-title">
                <span>{T(section.label, section.label)}</span>
                <span className="tag">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className="muted impact-empty-line">{T(section.empty, section.empty)}</div>
              ) : (
                <div className="impact-path-list">
                  {items.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
