import { I } from "../../icons.jsx";
import { T } from "../../i18n.jsx";
import { ImpactRelations } from "./ImpactRelations.jsx";
import { impactEvidenceItems, impactRelationCount, impactRiskLabel } from "./impact-utils.js";

export function ImpactTargetCard({ target, compact = false, onEvidence = null }) {
  if (!target) return null;
  const relationCount = impactRelationCount(target);
  const evidence = impactEvidenceItems(target);
  const risk = impactRiskLabel(target.risk);

  return (
    <article className={"impact-target-card" + (compact ? " compact" : "")}>
      <div className="impact-target-head">
        <div className="impact-target-main">
          <div className="impact-target-title">
            <I.FileCode size={14} />
            <span>{target.label || target.path}</span>
          </div>
          <code>{target.path}</code>
        </div>
        <div className="impact-target-tags">
          <span className="tag">{target.type || "file"}</span>
          {risk && <span className="tag">{risk}</span>}
          <span className="tag">{T(`${relationCount} relations`, `${relationCount} 条关系`)}</span>
          {evidence.length > 0 && onEvidence && (
            <button
              type="button"
              className="btn sm ghost"
              onClick={() =>
                onEvidence({
                  title: target.path,
                  evidence,
                })
              }
            >
              <I.Eye size={12} />
              {T("Evidence", "证据")}
            </button>
          )}
        </div>
      </div>
      {target.gaps?.length > 0 && (
        <div className="impact-gap-row">
          {target.gaps.map((gap) => (
            <span className="tag impact-gap-tag" key={gap}>
              {gap.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      )}
      <ImpactRelations target={target} onEvidence={onEvidence} />
    </article>
  );
}
