import { I } from "../../icons.jsx";
import { T } from "../../i18n.jsx";
import {
  IMPACT_RELATION_GROUPS,
  impactRelationItems,
  impactRelationLabel,
} from "./impact-utils.js";

function relationConfidence(item) {
  const confidence = Number(item?.confidence);
  if (!Number.isFinite(confidence)) return "";
  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

export function ImpactRelations({
  target,
  groups = IMPACT_RELATION_GROUPS,
  empty = false,
  onEvidence = null,
}) {
  const visibleGroups = groups.filter((group) => empty || impactRelationItems(target, group.key).length);
  if (!visibleGroups.length) return null;

  return (
    <div className="impact-relations">
      {visibleGroups.map((group) => {
        const items = impactRelationItems(target, group.key);
        return (
          <section className="impact-relation-group" key={group.key}>
            <div className="impact-relation-title">
              <span>{T(group.label, group.label)}</span>
              <span className="tag">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="muted impact-empty-line">{T(group.empty, group.empty)}</div>
            ) : (
              <div className="impact-relation-list">
                {items.map((item, index) => {
                  const label = impactRelationLabel(item);
                  const confidence = relationConfidence(item);
                  const hasEvidence = Array.isArray(item.evidence) && item.evidence.length > 0;
                  return (
                    <div
                      className="impact-relation-row"
                      key={`${group.key}-${item.id || label || index}`}
                    >
                      <div className="impact-relation-main">
                        <span className="impact-relation-label">{label}</span>
                        <div className="impact-relation-meta">
                          {item.type && <span>{item.type}</span>}
                          {confidence && <span>{confidence}</span>}
                        </div>
                      </div>
                      {hasEvidence && onEvidence && (
                        <button
                          type="button"
                          className="btn sm ghost impact-evidence-btn"
                          onClick={() =>
                            onEvidence({
                              title: label || group.label,
                              evidence: item.evidence.map((evidence) => ({
                                ...evidence,
                                relationLabel: label,
                                relationType: group.label,
                              })),
                            })
                          }
                        >
                          <I.Eye size={12} />
                          {T("Evidence", "Evidence")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
