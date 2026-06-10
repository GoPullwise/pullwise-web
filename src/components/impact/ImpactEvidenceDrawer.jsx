import { I } from "../../icons.jsx";
import { T } from "../../i18n.jsx";

function evidenceLocation(item) {
  if (!item?.file) return "";
  return item.line ? `${item.file}:${item.line}` : item.file;
}

export function ImpactEvidenceDrawer({ evidence = [], title = "Impact evidence", onClose }) {
  if (!evidence.length) return null;

  return (
    <div className="impact-evidence-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="impact-evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="impact-evidence-head">
          <div>
            <div className="impact-eyebrow">{T("Impact evidence", "Impact evidence")}</div>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="btn sm ghost"
            aria-label={T("Close evidence", "Close evidence")}
            onClick={onClose}
          >
            <I.X size={13} />
          </button>
        </div>
        <div className="impact-evidence-list">
          {evidence.map((item, index) => {
            const location = evidenceLocation(item);
            return (
              <div className="impact-evidence-item" key={`${location}-${item.text}-${index}`}>
                <div className="impact-evidence-meta">
                  {item.relationType && <span className="tag">{item.relationType}</span>}
                  {item.kind && <span className="tag">{item.kind}</span>}
                  {item.relationLabel && <span>{item.relationLabel}</span>}
                </div>
                {location && <code>{location}</code>}
                {item.text && <p>{item.text}</p>}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
