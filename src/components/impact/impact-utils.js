export const IMPACT_RELATION_GROUPS = [
  {
    key: "tests",
    label: "Tests",
    labelZh: "测试",
    empty: "No related tests",
    emptyZh: "暂无关联测试",
  },
  {
    key: "documents",
    label: "Docs",
    labelZh: "文档",
    empty: "No related docs",
    emptyZh: "暂无关联文档",
  },
  {
    key: "configures",
    label: "Config",
    labelZh: "配置",
    empty: "No related config",
    emptyZh: "暂无关联配置",
  },
  { key: "ci", label: "CI", labelZh: "CI", empty: "No related CI", emptyZh: "暂无关联 CI" },
  {
    key: "importedBy",
    label: "Imported by",
    labelZh: "被导入",
    empty: "No importers detected",
    emptyZh: "未检测到导入方",
  },
  {
    key: "imports",
    label: "Imports",
    labelZh: "导入",
    empty: "No imports detected",
    emptyZh: "未检测到导入",
  },
  {
    key: "symbols",
    label: "Symbols",
    labelZh: "符号",
    empty: "No symbols detected",
    emptyZh: "未检测到符号",
  },
];

export const IMPACT_DEFAULT_GRAPH_RELATIONS = ["tests", "documents", "configures", "ci"];

export const IMPACT_COVERAGE_SECTIONS = [
  {
    key: "sourceFilesWithoutTests",
    label: "Files without direct tests",
    labelZh: "缺少直接测试的文件",
    empty: "No direct test gaps detected",
    emptyZh: "未检测到直接测试缺口",
  },
  {
    key: "sourceFilesWithoutDocs",
    label: "Files without docs",
    labelZh: "缺少文档的文件",
    empty: "No doc gaps detected",
    emptyZh: "未检测到文档缺口",
  },
  {
    key: "testsWithoutTargets",
    label: "Tests without detected targets",
    labelZh: "未匹配目标的测试",
    empty: "No orphan tests detected",
    emptyZh: "未检测到孤立测试",
  },
  {
    key: "docsWithoutTargets",
    label: "Docs without detected targets",
    labelZh: "未匹配目标的文档",
    empty: "No orphan docs detected",
    emptyZh: "未检测到孤立文档",
  },
];

export function impactPathKey(value) {
  return String(value || "")
    .trim()
    .replaceAll("\\", "/")
    .toLowerCase();
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
