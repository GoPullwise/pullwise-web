export const IMPACT_RELATION_GROUPS = [
  { key: "tests", label: "Tests", empty: "No related tests" },
  { key: "documents", label: "Docs", empty: "No related docs" },
  { key: "configures", label: "Config", empty: "No related config" },
  { key: "ci", label: "CI", empty: "No related CI" },
  { key: "importedBy", label: "Imported by", empty: "No importers detected" },
  { key: "imports", label: "Imports", empty: "No imports detected" },
  { key: "symbols", label: "Symbols", empty: "No symbols detected" },
];

export const IMPACT_DEFAULT_GRAPH_RELATIONS = ["tests", "documents", "configures", "ci"];

export const IMPACT_COVERAGE_SECTIONS = [
  {
    key: "sourceFilesWithoutTests",
    label: "Files without direct tests",
    empty: "No direct test gaps detected",
  },
  {
    key: "sourceFilesWithoutDocs",
    label: "Files without docs",
    empty: "No doc gaps detected",
  },
  {
    key: "testsWithoutTargets",
    label: "Tests without detected targets",
    empty: "No orphan tests detected",
  },
  {
    key: "docsWithoutTargets",
    label: "Docs without detected targets",
    empty: "No orphan docs detected",
  },
];

export function impactPathKey(value) {
  return String(value || "").trim().replaceAll("\\", "/").toLowerCase();
}

export function findImpactTargetByPath(impactGraph, path) {
  const targetPath = impactPathKey(path);
  if (!targetPath || !Array.isArray(impactGraph?.targets)) return null;
  return (
    impactGraph.targets.find((target) => impactPathKey(target.path) === targetPath) ||
    impactGraph.targets.find((target) => impactPathKey(target.id).endsWith(targetPath)) ||
    null
  );
}

export function impactRelationItems(target, key) {
  return Array.isArray(target?.relations?.[key]) ? target.relations[key] : [];
}

export function impactRelationCount(target) {
  return IMPACT_RELATION_GROUPS.reduce(
    (total, group) => total + impactRelationItems(target, group.key).length,
    0
  );
}

export function impactEvidenceItems(target) {
  const evidence = [];
  if (Array.isArray(target?.evidence)) evidence.push(...target.evidence);
  for (const group of IMPACT_RELATION_GROUPS) {
    for (const relation of impactRelationItems(target, group.key)) {
      if (Array.isArray(relation.evidence)) {
        evidence.push(
          ...relation.evidence.map((item) => ({
            ...item,
            relationLabel: relation.label || relation.path || relation.id,
            relationType: group.label,
          }))
        );
      }
    }
  }
  return evidence;
}

export function impactCoverageCount(coverage) {
  return IMPACT_COVERAGE_SECTIONS.reduce(
    (total, section) =>
      total + (Array.isArray(coverage?.[section.key]) ? coverage[section.key].length : 0),
    0
  );
}

export function impactRiskLabel(value) {
  const risk = Number(value);
  if (!Number.isFinite(risk)) return "";
  return `${Math.round(Math.max(0, Math.min(1, risk)) * 100)}% risk`;
}

export function impactRelationLabel(item) {
  if (!item) return "";
  if (item.path && item.line) return `${item.path}:${item.line}`;
  return item.path || item.label || item.id || "";
}

export function compactCount(count, singular, plural = `${singular}s`) {
  const safe = Number.isFinite(Number(count)) ? Number(count) : 0;
  return `${safe} ${safe === 1 ? singular : plural}`;
}
