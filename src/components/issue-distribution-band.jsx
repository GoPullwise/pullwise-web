// Aggregated distribution band for the issues list. All aggregations
// are derived from already-normalized issue objects that the screen
// has in hand, so no new API call is required.

import { useMemo } from "react";
import { T } from "../i18n.jsx";
import {
  CONFIDENCE_BUCKETS,
  DistributionCard,
  SEVERITY_BUCKETS,
  VERIFICATION_BUCKETS,
  countBy,
} from "./distribution-primitives.jsx";

const CATEGORY_BUCKETS = [
  { key: "Security", color: "var(--sev-critical)" },
  { key: "Performance", color: "var(--sev-high)" },
  { key: "Quality", color: "var(--sev-medium)" },
  { key: "Reliability", color: "var(--sev-low)" },
  { key: "Compliance", color: "var(--sev-info)" },
  { key: "Style", color: "#7c3aed" },
];

const REPO_BUCKETS = [
  { key: "acme/api", color: "var(--accent, #6366f1)" },
  { key: "acme/web", color: "#0ea5e9" },
  { key: "acme/worker", color: "#16a34a" },
  { key: "acme/cli", color: "#ea580c" },
  { key: "acme/infra", color: "#a855f7" },
];

function aggregateCategories(items) {
  const counts = countBy(items, (item) => item.category, CATEGORY_BUCKETS.map((b) => b.key));
  // Add unknown categories as their own bucket (color from text-3) so
  // anything we don't know about still shows up.
  const known = new Set(CATEGORY_BUCKETS.map((b) => b.key));
  for (const item of items) {
    const key = item.category;
    if (!key || known.has(key)) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function aggregateRepos(items) {
  const counts = {};
  for (const item of items) {
    const key = item.repo;
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function pickTopRepos(counts, max = 5) {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, max);
  const buckets = top.map(([key], index) => ({
    key,
    color: REPO_BUCKETS[index % REPO_BUCKETS.length].color,
  }));
  return { buckets, counts: Object.fromEntries(top) };
}

function pickTopCategories(counts, max = 5) {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, max);
  const buckets = top.map(([key]) => {
    const preset = CATEGORY_BUCKETS.find((b) => b.key === key);
    return { key, color: preset ? preset.color : "var(--text-3, #6b7280)" };
  });
  return { buckets, counts: Object.fromEntries(top) };
}

export function IssueDistributionBand({ issues, activeSeverity = "", onSeverityClick = null }) {
  const severityCounts = useMemo(
    () => countBy(issues, (item) => item.severity, SEVERITY_BUCKETS.map((b) => b.key)),
    [issues]
  );
  const verificationCounts = useMemo(
    () =>
      countBy(issues, (item) => item.verificationStatus, VERIFICATION_BUCKETS.map((b) => b.key)),
    [issues]
  );
  const confidenceCounts = useMemo(
    () => countBy(issues, (item) => item.confidenceLevel, CONFIDENCE_BUCKETS.map((b) => b.key)),
    [issues]
  );
  const { buckets: categoryBuckets, counts: categoryCounts } = useMemo(() => {
    const all = aggregateCategories(issues);
    return pickTopCategories(all, 5);
  }, [issues]);
  const { buckets: repoBuckets, counts: repoCounts } = useMemo(() => {
    const all = aggregateRepos(issues);
    return pickTopRepos(all, 5);
  }, [issues]);

  const total = issues.length;
  if (total === 0) return null;

  const verifiedShare = (verificationCounts.verified || 0) + (verificationCounts.static_proof || 0);

  return (
    <div className="issue-disto" aria-label={T("Issue distribution", "问题分布")}>
      <DistributionCard
        title={T("Severity", "严重度")}
        subtitle={T("Click to filter", "点击筛选")}
        counts={severityCounts}
        buckets={SEVERITY_BUCKETS}
        activeKey={activeSeverity}
        onBucketClick={onBucketClick(onSeverityClick, activeSeverity)}
      />
      <DistributionCard
        title={T("Verification", "验证状态")}
        subtitle={T(`${verifiedShare} of ${total} verified or static`, `${verifiedShare} / ${total} 已验证或静态证明`)}
        counts={verificationCounts}
        buckets={VERIFICATION_BUCKETS}
      />
      <DistributionCard
        title={T("Confidence", "置信度")}
        subtitle={T("Self-reported evidence level", "系统给出的证据强度")}
        counts={confidenceCounts}
        buckets={CONFIDENCE_BUCKETS}
      />
      {categoryBuckets.length > 0 && (
        <DistributionCard
          title={T("Category", "类别")}
          subtitle={T(`Top ${categoryBuckets.length}`, `Top ${categoryBuckets.length}`)}
          counts={categoryCounts}
          buckets={categoryBuckets}
        />
      )}
      {repoBuckets.length > 0 && (
        <DistributionCard
          title={T("Repository", "仓库")}
          subtitle={T(`Top ${repoBuckets.length}`, `Top ${repoBuckets.length}`)}
          counts={repoCounts}
          buckets={repoBuckets}
        />
      )}
    </div>
  );
}

function onBucketClick(handler, activeKey) {
  if (!handler) return null;
  return (key) => {
    if (key === activeKey) handler("all");
    else handler(key);
  };
}
