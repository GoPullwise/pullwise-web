import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { SkeletonLine } from "../components/skeleton.jsx";
import { ScanProgressBar, scanProgressPresentation } from "../components/scan-progress.jsx";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation } from "../lib/auth.js";
import { env } from "../config/env.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { screenLinkProps } from "../lib/navigation.js";
import { downloadBlob } from "../lib/download.js";
import {
  isTerminalScan,
  scanQueueSummary,
  useRepositories,
  useScanBatchRun,
  useScanRun,
} from "../lib/pullwise-data.js";
import { quotaResetText } from "../lib/quota-display.js";
import { Sidebar, Topbar } from "../shell.jsx";

function renderInlineMarkdown(text, keyPrefix) {
  return String(text || "")
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={key}>{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
}

function MarkdownReport({ markdown }) {
  const lines = String(markdown || "").split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) {
      blocks.push(
        <p key={`p-${blocks.length}`}>{renderInlineMarkdown(text, `p-${blocks.length}`)}</p>
      );
    }
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{renderInlineMarkdown(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };
  const flushCode = () => {
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{code.join("\n")}</code>
      </pre>
    );
    code = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      return;
    }
    if (inCode) {
      code.push(line);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(6, Math.max(4, heading[1].length + 3));
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={`h-${blocks.length}`}>
          {renderInlineMarkdown(heading[2].trim(), `h-${blocks.length}`)}
        </Tag>
      );
      return;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1].trim());
      return;
    }
    flushList();
    paragraph.push(line.trim());
  });

  if (inCode || code.length) flushCode();
  flushParagraph();
  flushList();

  return <div className="scan-human-report-markdown">{blocks}</div>;
}

function HumanReviewReport({ report }) {
  const markdown = typeof report?.summaryMarkdown === "string" ? report.summaryMarkdown.trim() : "";
  if (!markdown) return null;
  return (
    <div className="scan-human-report card section">
      <div className="section-h">
        <h3>{T("Review report", "Review report")}</h3>
      </div>
      <MarkdownReport markdown={markdown} />
    </div>
  );
}
function quotaNumber(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.trunc(number));
}

function repoQuotaLabel(quota) {
  if (!quota) return "";
  const limit = quotaNumber(quota.limit);
  const used = quotaNumber(quota.used);
  const remaining = Object.prototype.hasOwnProperty.call(quota, "remaining")
    ? quotaNumber(quota.remaining)
    : Math.max(0, limit - used);
  const scope = quota.scope === "user" ? "account" : "repo";
  if (!limit) {
    return scope === "account"
      ? T("account quota unavailable", "账户配额不可�?)
      : T("repo quota unavailable", "仓库配额不可�?);
  }
  const reset = quotaResetText(quota);
  const leftText =
    scope === "account"
      ? T(`${remaining} of ${limit} account scans left`, `账户扫描剩余 ${remaining} / ${limit}`)
      : T(`${remaining} of ${limit} repo scans left`, `仓库扫描剩余 ${remaining} / ${limit}`);
  return reset ? `${leftText} - ${reset}` : leftText;
}

function formatCount(value) {
  return String(quotaNumber(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatBytes(value) {
  const bytes = quotaNumber(value);
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = size >= 10 ? Math.round(size) : Math.round(size * 10) / 10;
  return `${rounded.toLocaleString()} ${units[unitIndex]}`;
}

function reviewRunArtifactHref(storage) {
  const url = typeof storage?.url === "string" ? storage.url.trim() : "";
  if (!url) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const base =
    typeof env.VITE_API_BASE_URL === "string" ? env.VITE_API_BASE_URL.replace(/\/$/, "") : "";
  return `${base}/${url.replace(/^\/+/, "")}`;
}

function reviewRunStatusLabel(status) {
  switch (status) {
    case "completed":
      return T("Completed", "Completed");
    case "failed":
      return T("Failed", "Failed");
    case "cancelled":
      return T("Cancelled", "Cancelled");
    case "partial_completed":
      return T("Partially completed", "Partially completed");
    case "running":
      return T("Running", "Running");
    case "leased":
      return T("Leased", "Leased");
    default:
      return String(status || "unknown").replace(/_/g, " ");
  }
}

function qualityGateLabel(status) {
  switch (status) {
    case "pass":
      return T("Passed", "通过");
    case "warn":
      return T("Warnings", "警告");
    case "fail":
      return T("Failed", "失败");
    default:
      return String(status || "unknown").replace(/_/g, " ");
  }
}

function informativeSummaryTag(value, hiddenValues = []) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text.toLowerCase().replace(/_/g, " ");
  const hidden = new Set(["unknown", "none", "n/a", "not available", ...hiddenValues]);
  return hidden.has(normalized) ? "" : text;
}

function ReviewRunSummary({ reviewRun }) {
  if (!reviewRun || typeof reviewRun !== "object") return null;
  const artifacts = Array.isArray(reviewRun.artifacts) ? reviewRun.artifacts : [];
  const summary =
    reviewRun.summary && typeof reviewRun.summary === "object" ? reviewRun.summary : {};
  const qualityGate =
    reviewRun.qualityGate && typeof reviewRun.qualityGate === "object" ? reviewRun.qualityGate : {};
  const progress =
    reviewRun.progress && typeof reviewRun.progress === "object" ? reviewRun.progress : {};
  const findingCounts =
    summary.finding_counts && typeof summary.finding_counts === "object"
      ? summary.finding_counts
      : {};
  const countedConfirmed =
    quotaNumber(findingCounts.confirmed_high) + quotaNumber(findingCounts.confirmed_critical);
  const confirmed = countedConfirmed || quotaNumber(summary.top_findings?.length);
  const overallRiskTag = informativeSummaryTag(summary.overall_risk);
  const resultStatusTag = informativeSummaryTag(summary.result_status, ["complete", "completed"]);
  const progressLabel =
    typeof progress.overall_percent === "number"
      ? `${Math.round(progress.overall_percent)}%`
      : reviewRun.status === "completed"
        ? "100%"
        : "�?;

  return (
    <div className="review-run-card card section">
      <div className="section-h">
        <h3>{T("Review run", "审查运行")}</h3>
      </div>
      <div className="review-run-metrics">
        <div>
          <b>{reviewRunStatusLabel(reviewRun.status)}</b>
          <span>{T("Run status", "运行状�?)}</span>
        </div>
        <div>
          <b>{qualityGateLabel(qualityGate.status)}</b>
          <span>{T("Quality gate", "质量�?)}</span>
        </div>
        <div>
          <b>{progressLabel}</b>
          <span>{T("Final progress", "最终进�?)}</span>
        </div>
        <div>
          <b>{formatCount(reviewRun.artifactCount || artifacts.length)}</b>
          <span>{T("Artifacts", "产物")}</span>
        </div>
      </div>
      {overallRiskTag || resultStatusTag || confirmed > 0 ? (
        <div className="review-run-summary-line">
          {overallRiskTag && <span className="tag">{overallRiskTag}</span>}
          {resultStatusTag && <span className="tag">{resultStatusTag}</span>}
          {confirmed > 0 && (
            <span className="tag">{T(`${confirmed} confirmed`, `${confirmed} confirmed`)}</span>
          )}
        </div>
      ) : null}
      {artifacts.length > 0 && (
        <details className="review-run-artifacts" aria-label={T("Review artifacts", "\u5ba1\u67e5\u4ea7\u7269")}>
          <summary className="btn sm ghost">
            <I.Archive size={14} />
            <span>{T("Review artifacts", "\u5ba1\u67e5\u4ea7\u7269")}</span>
            <span className="tag">{formatCount(artifacts.length)}</span>
          </summary>
          <div className="review-run-artifact-menu">
            {artifacts.map((artifact) => {
              const href = reviewRunArtifactHref(artifact.storage);
              const title = artifact.name || artifact.kind || artifact.artifactId;
              return (
                <div className="review-run-artifact" key={artifact.artifactId || title}>
                  <div className="review-run-artifact-main">
                    <I.FileCode size={14} />
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer">
                        {title}
                      </a>
                    ) : (
                      <span>{title}</span>
                    )}
                  </div>
                  <div className="review-run-artifact-meta">
                    {artifact.kind && <span>{artifact.kind}</span>}
                    {artifact.sizeBytes > 0 && <span>{formatBytes(artifact.sizeBytes)}</span>}
                    {artifact.required && <span>{T("required", "\u5fc5\u9700")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function copyText(value) {
  const clipboard = globalThis.navigator?.clipboard;
  if (!value || !clipboard?.writeText) return Promise.resolve(false);
  return clipboard
    .writeText(value)
    .then(() => true)
    .catch(() => false);
}

function apiKeyTokenFromPayload(payload) {
  return String(
    payload?.key ||
      payload?.token ||
      payload?.apiKey?.key ||
      payload?.apiKey?.token ||
      (typeof payload?.key === "string" ? payload.key : "")
  ).trim();
}

function agentFixBundlePath(scan) {
  const scanId = String(scan?.id || "").trim();
  if (!scanId) return "";
  const repoId = String(scan?.repoId || "").trim();
  if (repoId) {
    return (
      "/api/v1/repositories/" +
      encodeURIComponent(repoId) +
      "/scans/" +
      encodeURIComponent(scanId) +
      "/audit-bundle.zip"
    );
  }
  return "/scans/" + encodeURIComponent(scanId) + "/audit-bundle.zip";
}

function agentFixBundleUrl(scan) {
  const path = agentFixBundlePath(scan);
  if (!path) return "";
  const configuredApiBase = String(env.VITE_API_BASE_URL || "");
  const absoluteApiBase = /^[a-z][a-z0-9+.-]*:/i.test(configuredApiBase) ? configuredApiBase : "";
  const base = String(
    env.VITE_PUBLIC_API_BASE_URL || absoluteApiBase || "https://api.pull-wise.com"
  ).replace(/\/$/, "");
  return base + path;
}

function agentFixPromptWithBundleKey(basePrompt, scan, keyPayload) {
  const token = apiKeyTokenFromPayload(keyPayload);
  const bundleUrl = agentFixBundleUrl(scan);
  if (!basePrompt || !token || !bundleUrl) return "";
  const scanId = String(scan?.id || "scan").trim() || "scan";
  const expiresAt = keyPayload?.expiresAt
    ? new Date(Number(keyPayload.expiresAt) * 1000).toISOString()
    : "15 minutes from creation";
  return [
    basePrompt.trim(),
    "",
    "Temporary audit bundle access:",
    "- Use this short-lived Pullwise API key only to download this scan's audit bundle.",
    "- Expires: " + expiresAt + ".",
    "- Download command:",
    "~~~bash",
    'curl -L "' + bundleUrl + '" \\',
    '  -H "Authorization: Bearer ' + token + '" \\',
    '  -o "pullwise-audit-' + scanId + '.zip"',
    'unzip -o "pullwise-audit-' + scanId + '.zip" -d "pullwise-audit-' + scanId + '"',
    "~~~",
    "After unzipping, inspect pullwise-audit-" +
      scanId +
      "/report.md, pullwise-audit-" +
      scanId +
      "/scan/scan.json, and pullwise-audit-" +
      scanId +
      "/issues/*.md before editing code.",
  ].join("\n");
}

function repositoryLimitReasonLabel(reason) {
  switch (reason) {
    case "file_count":
      return T("file count", "文件数量");
    case "total_bytes":
      return T("total size", "总大�?);
    default:
      return String(reason || "").replace(/_/g, " ");
  }
}

function hasRepositoryLimitEvidence(preflight) {
  return Boolean(
    preflight?.repositoryStats ||
    preflight?.repositoryLimits ||
    preflight?.repositoryLimitExceeded ||
    preflight?.repositoryLimitReasons?.length
  );
}

function normalizeRepositoryScanPolicyLimits(value) {
  if (!value || typeof value !== "object") return null;
  const maxFiles = quotaNumber(value.maxFiles);
  const maxBytes = quotaNumber(value.maxBytes);
  return maxFiles || maxBytes ? { maxFiles, maxBytes } : null;
}

function repositoryScanPolicyLimitText(limits) {
  if (!limits) {
    return T(
      "Current checkout limits are confirmed during scan preflight and shown with the measured repository size.",
      "当前 checkout 限制会在扫描预检中确认，并和实际仓库大小一起展示�?
    );
  }
  return T(
    `Current checkout limit: ${formatCount(limits.maxFiles)} files / ${formatBytes(limits.maxBytes)}.`,
    `当前 checkout 限制�?{formatCount(limits.maxFiles)} 个文�?/ ${formatBytes(limits.maxBytes)}。`
  );
}

function quotaRemaining(quota) {
  if (!quota || typeof quota !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(quota, "remaining")) {
    return quotaNumber(quota.remaining);
  }
  if (
    Object.prototype.hasOwnProperty.call(quota, "limit") &&
    Object.prototype.hasOwnProperty.call(quota, "used")
  ) {
    return Math.max(0, quotaNumber(quota.limit) - quotaNumber(quota.used));
  }
  return null;
}

function scansWord(count) {
  return count === 1 ? T("scan", "次扫�?) : T("scans", "次扫�?);
}

function accountQuotaNotice(remaining) {
  if (remaining === 0) {
    return T(
      "Your account has 0 scans left for this billing period. Upgrade or wait for the quota reset before selecting a repository.",
      "此计费周期账户剩�?0 次扫描。请升级或等待配额重置后再选择仓库�?
    );
  }
  return T(
    `Your account has ${remaining} ${scansWord(remaining)} left for this billing period. Deselect another repository before selecting more.`,
    `此计费周期账户剩�?${remaining} ${scansWord(remaining)}。请先取消选择其他仓库，再选择更多仓库。`
  );
}

function repositoryQuotaNotice(repo) {
  const label = repo?.fullName || repo?.name || T("This repository", "此仓�?);
  return T(
    `${label} has 0 repository scans left for this billing period.`,
    `${label} 此计费周期仓库扫描剩�?0 次。`
  );
}

function preflightAllowedCount(payload, fallback) {
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, "allowedCount")) return fallback;
  return Math.min(fallback, quotaNumber(payload.allowedCount));
}

function preflightRows(payload) {
  return Array.isArray(payload?.repositories) ? payload.repositories : [];
}

function repoLookupValues(repo) {
  return new Set(
    [repo?.id, repo?.repoId, repo?.githubRepoId, repo?.fullName, repo?.name, repo?.repo]
      .map((value) => String(value || ""))
      .filter(Boolean)
  );
}

function preflightRowForRepo(rows, repo) {
  const values = repoLookupValues(repo);
  return rows.find((row) =>
    [row?.repoId, row?.githubRepoId, row?.repo, row?.fullName, row?.id]
      .map((value) => String(value || ""))
      .some((value) => values.has(value))
  );
}

function repoOwner(repo) {
  const fullName = repo.fullName || repo.name || "";
  return fullName.includes("/") ? fullName.split("/")[0] : "";
}

const REPO_LANGUAGE_COLORS = {
  javascript: "#f1e05a",
  typescript: "#3178c6",
  python: "#3572A5",
  go: "#00ADD8",
  java: "#b07219",
  kotlin: "#A97BFF",
  swift: "#F05138",
  rust: "#dea584",
  ruby: "#701516",
  php: "#4F5D95",
  c: "#555555",
  cpp: "#f34b7d",
  csharp: "#178600",
  html: "#e34c26",
  css: "#563d7c",
  scss: "#c6538c",
  shell: "#89e051",
  powershell: "#012456",
  vue: "#41b883",
  svelte: "#ff3e00",
  dart: "#00B4AB",
  scala: "#c22d40",
  r: "#198CE7",
  elixir: "#6e4a7e",
  hcl: "#844FBA",
  dockerfile: "#384d54",
  jupyter: "#da5b0b",
  objectivec: "#438eff",
  perl: "#0298c3",
  lua: "#000080",
  haskell: "#5e5086",
  clojure: "#db5855",
  other: "#8b949e",
};

const REPO_LANGUAGE_COLOR_ALIASES = new Map([
  ["javascript", "javascript"],
  ["js", "javascript"],
  ["node", "javascript"],
  ["typescript", "typescript"],
  ["ts", "typescript"],
  ["tsx", "typescript"],
  ["javascript/typescript", "typescript"],
  ["js/ts", "typescript"],
  ["python", "python"],
  ["py", "python"],
  ["go", "go"],
  ["golang", "go"],
  ["java", "java"],
  ["kotlin", "kotlin"],
  ["swift", "swift"],
  ["rust", "rust"],
  ["ruby", "ruby"],
  ["rb", "ruby"],
  ["php", "php"],
  ["c", "c"],
  ["c++", "cpp"],
  ["cpp", "cpp"],
  ["cxx", "cpp"],
  ["c#", "csharp"],
  ["csharp", "csharp"],
  ["c-sharp", "csharp"],
  ["html", "html"],
  ["css", "css"],
  ["scss", "scss"],
  ["sass", "scss"],
  ["shell", "shell"],
  ["bash", "shell"],
  ["sh", "shell"],
  ["zsh", "shell"],
  ["powershell", "powershell"],
  ["pwsh", "powershell"],
  ["vue", "vue"],
  ["vue.js", "vue"],
  ["svelte", "svelte"],
  ["dart", "dart"],
  ["scala", "scala"],
  ["r", "r"],
  ["elixir", "elixir"],
  ["hcl", "hcl"],
  ["terraform", "hcl"],
  ["dockerfile", "dockerfile"],
  ["jupyter notebook", "jupyter"],
  ["notebook", "jupyter"],
  ["objective-c", "objectivec"],
  ["objective c", "objectivec"],
  ["objc", "objectivec"],
  ["perl", "perl"],
  ["lua", "lua"],
  ["haskell", "haskell"],
  ["clojure", "clojure"],
]);

function repoLanguageColorKey(language) {
  const normalized = String(language || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!normalized || normalized === "-") return "other";
  const exact = REPO_LANGUAGE_COLOR_ALIASES.get(normalized);
  if (exact) return exact;
  const composite = normalized
    .split(/[,&/]+/)
    .map((part) => part.trim())
    .find((part) => REPO_LANGUAGE_COLOR_ALIASES.has(part));
  return composite ? REPO_LANGUAGE_COLOR_ALIASES.get(composite) : "other";
}

function repoLanguageColor(languageKey) {
  return REPO_LANGUAGE_COLORS[languageKey] || REPO_LANGUAGE_COLORS.other;
}

function makeScanRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `scan_req_${globalThis.crypto.randomUUID()}`;
  }
  return `scan_req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function scanInputFromRepo(repo) {
  const request = {
    repo: repo?.fullName || repo?.name || repo?.repo || "",
    branch: repo?.branch || repo?.defaultBranch || "main",
    commit: repo?.commit || "pending",
    requestId: repo?.scanRequestId || "",
  };
  if (repo?.repoId) request.repoId = repo.repoId;
  return request;
}

function scanCreatePayloadFromInput({
  repoId = "",
  repo,
  branch,
  commit = "pending",
  requestId = "",
}) {
  const payload = { branch: branch || "main", commit: commit || "pending" };
  if (repoId) payload.repoId = repoId;
  if (repo) payload.repo = repo;
  if (requestId) payload.requestId = requestId;
  return payload;
}

const BATCH_SCAN_CREATE_CONCURRENCY = 3;
const BRANCH_LOOKUP_CONCURRENCY = 4;

async function allSettledWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = { status: "fulfilled", value: await worker(items[index], index) };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    })
  );
  return results;
}

async function createBatchScans(scanInputs) {
  const requests = scanInputs.filter((request) => request.repo || request.repoId);
  const results = await allSettledWithConcurrency(
    requests,
    BATCH_SCAN_CREATE_CONCURRENCY,
    (request) => pullwiseApi.scans.create(scanCreatePayloadFromInput(request))
  );
  const created = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.find((result) => result.status === "rejected");
  if (!created && failed) throw failed.reason;
  return results;
}

function scanIdFromBatchCreateResult(result) {
  if (result?.status !== "fulfilled") return "";
  const value = result.value || {};
  return String(value.id || value.scanId || value.scan?.id || "").trim();
}

function createdScanIdsFromBatchResults(results) {
  const ids = [];
  const seen = new Set();
  for (const result of results || []) {
    const id = scanIdFromBatchCreateResult(result);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function createdScanRequestsFromBatchResults(results, scanInputs) {
  return (results || [])
    .map((result, index) => (result?.status === "fulfilled" ? scanInputs?.[index] : null))
    .filter(Boolean)
    .map((request) => ({
      repoId: request.repoId || "",
      repo: request.repo || "",
      branch: request.branch || "main",
      requestId: request.requestId || "",
    }));
}

function repoBranchKey(repo) {
  return String(
    repo?.repoId || repo?.githubRepoId || repo?.id || repo?.fullName || repo?.name || ""
  );
}

function repoBranchApiId(repo) {
  return String(
    repo?.repoId || repo?.githubRepoId || repo?.id || repo?.fullName || repo?.name || ""
  );
}

function cleanBranchList(values) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(
          (value) =>
            value &&
            !value.includes("\r") &&
            !value.includes("\n") &&
            !value.includes(String.fromCharCode(0))
        )
    ),
  ];
}

function branchPayloadBranches(payload, fallbackBranch) {
  const branches = cleanBranchList(payload?.branches);
  if (branches.length) return branches;
  return cleanBranchList([payload?.defaultBranch, fallbackBranch]);
}

function batchScanStatus(scans, expectedCount, hasError) {
  if (!expectedCount) return "no_repo";
  if (hasError && scans.length === 0) return "failed";
  if (scans.some((scan) => scan.status === "running")) return "running";
  if (scans.some((scan) => scan.status === "queued")) return "queued";
  if (scans.length < expectedCount) return hasError ? "failed" : "queued";
  if (scans.every((scan) => scan.status === "done")) return "done";
  if (scans.every((scan) => scan.status === "cancelled")) return "cancelled";
  if (scans.some((scan) => scan.status === "failed")) return "failed";
  if (hasError) return "failed";
  return "queued";
}

function batchCreationSummary(batchRows, scans, expectedCount) {
  const created = batchRows.length
    ? batchRows.filter((row) => row.scanId || row.scan?.id).length
    : scans.length;
  const failedToCreate = batchRows.filter((row) => row.status === "failed" && !row.scanId).length;
  return { created, failedToCreate, expected: expectedCount };
}

function isTerminalBatchRow(row) {
  return (
    ["done", "failed", "cancelled", "partial_completed"].includes(row?.status) ||
    isTerminalScan(row?.scan)
  );
}

function scanErrorAction(error) {
  const code = typeof error === "object" && error ? String(error.code || "") : "";
  const message = typeof error === "object" && error ? error.message : error;
  const text = `${code} ${String(message || "")}`.toLowerCase();
  if (code.startsWith("QUOTA_EXCEEDED")) {
    return { label: T("Open billing", "打开账单"), screen: "billing" };
  }
  if (
    text.includes("review provider") ||
    text.includes("cli") ||
    text.includes("not authenticated")
  ) {
    return { label: T("Open settings", "打开设置"), screen: "settings" };
  }
  if (
    text.includes("sync github repositories") ||
    ["REPOSITORY_SYNC_REQUIRED", "REPOSITORY_NOT_AUTHORIZED"].includes(code)
  ) {
    return { label: T("Sync repositories", "同步仓库"), screen: "repos" };
  }
  return { label: T("Retry", "重试"), screen: "repos" };
}

const REVIEW_RUNNER_CLI_RE = /\b[A-Za-z][A-Za-z0-9_-]*\s+cli\b/gi;

function publicScanErrorMessage(error) {
  const message = typeof error === "object" && error ? error.message : error;
  return String(message || "")
    .replace(REVIEW_RUNNER_CLI_RE, T("Review runner", "审查运行�?))
    .replace(/\bcli\b/gi, T("review runner", "审查运行�?));
}

function scanIssueTotals(scans) {
  return scans.reduce(
    (totals, scan) => {
      const issues = scan?.issues || {};
      return {
        critical: totals.critical + Number(issues.critical || 0),
        high: totals.high + Number(issues.high || 0),
        medium: totals.medium + Number(issues.medium || 0),
        low: totals.low + Number(issues.low || 0),
      };
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function hasRawPreflightEvidence(preflight) {
  if (!preflight) return false;
  const environment = preflight.environment || {};
  return Boolean(
    preflight.summary ||
    preflight.execution ||
    preflight.mode ||
    preflight.repositoryStats ||
    preflight.repositoryLimits ||
    preflight.repositoryLimitExceeded ||
    preflight.repositoryLimitReasons?.length ||
    preflight.packageManagers?.length ||
    preflight.languages?.length ||
    preflight.availableScripts?.length ||
    preflight.manifests?.length ||
    preflight.toolVersions?.length ||
    environment.os ||
    environment.osRelease ||
    environment.machine
  );
}

function scanPreflightSummary(scans) {
  const preflights = scans.map((scan) => scan?.preflight).filter(hasRawPreflightEvidence);
  if (!preflights.length) return null;
  const environments = preflights.map((preflight) => preflight.environment).filter(Boolean);
  const environmentLabels = uniqueStrings(
    environments.map((environment) =>
      [environment.os, environment.osRelease, environment.machine].filter(Boolean).join(" ")
    )
  ).slice(0, 3);
  return {
    mode: uniqueStrings(preflights.map((preflight) => preflight.mode)).join(", "),
    execution: uniqueStrings(preflights.map((preflight) => preflight.execution)).join(", "),
    summary:
      preflights.length === 1
        ? preflights[0].summary
        : `${preflights.length} repository preflights captured without running project scripts.`,
    repositoryStats: preflights.length === 1 ? preflights[0].repositoryStats || null : null,
    repositoryLimits:
      preflights.find((preflight) => preflight.repositoryLimits)?.repositoryLimits || null,
    repositoryLimitExceeded: preflights.some((preflight) => preflight.repositoryLimitExceeded),
    repositoryLimitReasons: uniqueStrings(
      preflights.flatMap((preflight) => preflight.repositoryLimitReasons || [])
    ),
    languages: uniqueStrings(preflights.flatMap((preflight) => preflight.languages || [])).slice(
      0,
      6
    ),
    packageManagers: uniqueStrings(
      preflights.flatMap((preflight) => preflight.packageManagers || [])
    ).slice(0, 6),
    availableScripts: uniqueStrings(
      preflights.flatMap((preflight) => preflight.availableScripts || [])
    ).slice(0, 8),
    manifestsCount: preflights.reduce(
      (total, preflight) => total + (preflight.manifests?.length || 0),
      0
    ),
    toolCount: preflights.reduce(
      (total, preflight) => total + (preflight.toolVersions?.length || 0),
      0
    ),
    environmentLabels,
  };
}

function hasScanPreflightEvidence(preflight) {
  if (!preflight) return false;
  return Boolean(
    preflight.summary ||
    preflight.execution ||
    preflight.mode ||
    preflight.packageManagers?.length ||
    preflight.languages?.length ||
    preflight.availableScripts?.length ||
    preflight.manifestsCount > 0 ||
    preflight.toolCount > 0 ||
    preflight.environmentLabels?.length ||
    hasRepositoryLimitEvidence(preflight)
  );
}

function scanAiUsageSummary(scans) {
  const usages = scans.map((scan) => scan?.aiUsage).filter(Boolean);
  if (!usages.length) return null;
  const usage = {};
  const summarize = (key, label) => {
    const values = uniqueStrings(usages.map((item) => item?.[key]));
    if (values.length === 1) return values[0];
    if (values.length > 1) return `${values.length} ${label}`;
    return "";
  };
  const agentCli = summarize("agentCli", "agents");
  const provider = summarize("provider", "providers");
  const model = summarize("model", "models");
  const reasoningEffort = summarize("reasoningEffort", "reasoning levels");
  if (agentCli) usage.agentCli = agentCli;
  if (provider) usage.provider = provider;
  if (model) usage.model = model;
  if (reasoningEffort) usage.reasoningEffort = reasoningEffort;
  return Object.keys(usage).length ? usage : null;
}

function scanAiUsageTags(aiUsage) {
  if (!aiUsage) return [];
  const tags = [];
  const push = (value) => {
    const text = String(value || "").trim();
    if (text && !tags.includes(text)) tags.push(text);
  };
  push(aiUsage.agentCli || aiUsage.provider);
  push(aiUsage.model);
  if (aiUsage.reasoningEffort) {
    push(T(`reasoning: ${aiUsage.reasoningEffort}`, `推理�?{aiUsage.reasoningEffort}`));
  }
  return tags;
}

const RETRYABLE_SCAN_STATUSES = new Set(["failed", "cancelled", "lost"]);

function isRetryableScan(scan) {
  return Boolean(scan?.id && RETRYABLE_SCAN_STATUSES.has(scan.status));
}

function BranchPicker({ repoLabel, value, options, loading, error, disabled, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const minWidth = Math.max(rect.width, 140);
    const maxLeft = viewportWidth - minWidth - 8;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, maxLeft)),
      minWidth,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const handlePointerDown = (event) => {
      const container = containerRef.current;
      const menu = menuRef.current;
      const target = event.target;
      if (container && container.contains(target)) return;
      if (menu && menu.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        if (triggerRef.current) triggerRef.current.focus();
      }
    };
    const handleScrollOrResize = () => updateMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  const handleSelect = (branch) => {
    if (branch === value) {
      setOpen(false);
      return;
    }
    onChange(branch);
    setOpen(false);
  };

  const pickerClass = "repo-branch-picker" + (error ? " repo-branch-error" : "");
  const branchTitle = error || `Branch: ${value}`;
  const branchValueLabel = loading ? T("Loading...", "加载�?..") : value;

  return (
    <span
      key={branchTitle}
      ref={containerRef}
      className={pickerClass}
      title={branchTitle}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="repo-branch-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Branch for ${repoLabel}`}
        title={branchTitle}
        disabled={disabled}
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((prev) => !prev);
        }}
      >
        <I.GitBranch size={12} />
        <span className="repo-branch-value">{branchValueLabel}</span>
        <I.ChevD size={11} className="repo-branch-chev" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={menuRef}
          role="listbox"
          className="repo-branch-menu"
          aria-label={`Branches for ${repoLabel}`}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            minWidth: menuPos.minWidth,
          }}
        >
          {loading && (
            <li className="repo-branch-empty" role="presentation">
              {T("Loading branches...", "正在加载分支...")}
            </li>
          )}
          {!loading && options.length === 0 && (
            <li className="repo-branch-empty" role="presentation">
              {T("No branches available", "暂无分支")}
            </li>
          )}
          {!loading &&
            options.map((branch) => {
              const isSelected = branch === value;
              return (
                <li
                  key={branch}
                  role="option"
                  aria-selected={isSelected}
                  className={"repo-branch-option" + (isSelected ? " selected" : "")}
                  onClick={() => handleSelect(branch)}
                >
                  <I.GitBranch size={11} aria-hidden="true" />
                  <span className="repo-branch-option-label">{branch}</span>
                  {isSelected && (
                    <I.Check size={11} className="repo-branch-option-check" aria-hidden="true" />
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </span>
  );
}

function RepositoriesSkeleton() {
  return (
    <div className="repos-skeleton" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="repo-row skeleton-row" key={`repo-row-skeleton-${index}`}>
          <div className="repo-check">
            <SkeletonLine className="sk-square sk-size-18" />
          </div>
          <div className="repo-icon">
            <SkeletonLine className="sk-square sk-size-28" />
          </div>
          <div className="repo-main">
            <div className="repo-name">
              <SkeletonLine className="sk-line sk-w-42 sk-h-16" />
              <SkeletonLine className="sk-line sk-w-14 sk-h-20" />
            </div>
            <div className="repo-desc">
              <SkeletonLine className="sk-line sk-w-80" />
            </div>
          </div>
          <div className="repo-meta">
            <SkeletonLine className="sk-line sk-w-28" />
            <SkeletonLine className="sk-line sk-w-18" />
            <SkeletonLine className="sk-line sk-w-16" />
            <SkeletonLine className="sk-line sk-w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReposScreen({
  go,
  setActiveRepo,
  setIssue = null,
  authorizationError = "",
  clearAuthorizationError = () => {},
}) {
  useLang();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const [connectError, setConnectError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [checkingQuota, setCheckingQuota] = useState(false);
  const [resolvingBranches, setResolvingBranches] = useState(false);
  const [quotaPreflight, setQuotaPreflight] = useState(null);
  const [quotaDialogSelected, setQuotaDialogSelected] = useState([]);
  const [quotaDialogNotice, setQuotaDialogNotice] = useState("");
  const [repoBranches, setRepoBranches] = useState({});
  const [selectedBranches, setSelectedBranches] = useState({});
  const branchRequestsRef = useRef(new Map());
  const [org, setOrg] = useState("All");
  const activeOwner = org?.startsWith("@") ? org.slice(1) : "";
  const query = q.trim().toLowerCase();
  const {
    items: availableRepos,
    installations,
    installationAccounts,
    userQuota,
    loading,
    loadingMore,
    error,
    needsAuthorization,
    meta: repositoriesMeta = {},
    reload,
    loadMore,
  } = useRepositories({ owner: activeOwner, q: query });
  const displayError = error || connectError || authorizationError;
  const hasInstallationDetails = Array.isArray(installations) && installations.length > 0;
  const [scanPolicyLimits, setScanPolicyLimits] = useState(null);
  const allLabel = T("All", "所�?);
  const orgs = useMemo(
    () => [
      allLabel,
      ...Array.from(
        new Set([...availableRepos.map(repoOwner), ...(installationAccounts || [])].filter(Boolean))
      ).map((owner) => `@${owner}`),
    ],
    [allLabel, availableRepos, installationAccounts]
  );
  const ownerTabsRef = useRef(null);
  const ownerTabsScrollable = orgs.length > 4;
  const scrollOwnerTabs = useCallback((direction) => {
    const track = ownerTabsRef.current;
    if (!track) return;
    const distance = Math.max(Math.round(track.clientWidth * 0.8), 160);
    const left = direction * distance;
    if (typeof track.scrollBy === "function") {
      track.scrollBy({ left, behavior: "smooth" });
      return;
    }
    track.scrollLeft += left;
  }, []);
  const selectOwnerTab = useCallback((event, item) => {
    setOrg(item);
    event.currentTarget.scrollIntoView?.({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
  }, []);
  const refreshGitHubRepositoryAccess = useCallback(async () => {
    await reload({ sync: true });
  }, [reload]);
  useEffect(() => {
    if (typeof pullwiseApi.system?.health !== "function") return undefined;
    let cancelled = false;
    pullwiseApi.system
      .health()
      .then((payload) => {
        if (!cancelled) {
          setScanPolicyLimits(normalizeRepositoryScanPolicyLimits(payload?.limits?.repository));
        }
      })
      .catch(() => {
        if (!cancelled) setScanPolicyLimits(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const repos = availableRepos.filter((repo) => {
    const matchesOrg = !activeOwner || repoOwner(repo) === activeOwner;
    const matchesQuery =
      !query ||
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      repo.desc.toLowerCase().includes(query);
    return matchesOrg && matchesQuery;
  });
  const repositoryTotal = Number.isFinite(Number(repositoriesMeta.total))
    ? Number(repositoriesMeta.total)
    : availableRepos.length;
  const loadedRepositoryCount = availableRepos.length;
  const accountQuotaRemaining = quotaRemaining(userQuota);
  const accountQuotaLabel = repoQuotaLabel(userQuota);
  const branchForRepo = useCallback(
    (repo) => {
      const key = repoBranchKey(repo);
      return (
        selectedBranches[key] ||
        repoBranches[key]?.defaultBranch ||
        repo?.branch ||
        repo?.defaultBranch ||
        "main"
      );
    },
    [repoBranches, selectedBranches]
  );
  const selectedRepoObjects = selected
    .map((id) => availableRepos.find((item) => item.id === id))
    .filter(Boolean)
    .map((repo) => ({ ...repo, branch: branchForRepo(repo) }));

  const loadRepoBranches = useCallback(
    async (repo) => {
      const key = repoBranchKey(repo);
      const apiId = repoBranchApiId(repo);
      if (!key || !apiId) return null;
      const current = repoBranches[key];
      if (current?.branches?.length && !current.loading) return current;
      const pending = branchRequestsRef.current.get(key);
      if (pending) return pending;
      const fallbackBranch = repo?.branch || repo?.defaultBranch || "main";
      setRepoBranches((state) => ({
        ...state,
        [key]: {
          branches: branchPayloadBranches(state[key], fallbackBranch),
          defaultBranch: state[key]?.defaultBranch || fallbackBranch,
          loading: true,
          error: "",
        },
      }));
      const request = pullwiseApi.repositories
        .branches(apiId)
        .then((payload) => {
          const branches = branchPayloadBranches(payload, fallbackBranch);
          const defaultBranch =
            cleanBranchList([payload?.defaultBranch])[0] || fallbackBranch || branches[0] || "main";
          const resolved = { branches, defaultBranch, loading: false, error: "" };
          setRepoBranches((state) => ({
            ...state,
            [key]: resolved,
          }));
          setSelectedBranches((state) => ({
            ...state,
            [key]: branches.includes(state[key]) ? state[key] : defaultBranch,
          }));
          return resolved;
        })
        .catch((branchError) => {
          const resolved = {
            branches: branchPayloadBranches(repoBranches[key], fallbackBranch),
            defaultBranch: fallbackBranch,
            loading: false,
            error: branchError?.message || "Unable to load branches.",
          };
          setRepoBranches((state) => ({
            ...state,
            [key]: resolved,
          }));
          return resolved;
        })
        .finally(() => {
          branchRequestsRef.current.delete(key);
        });
      branchRequestsRef.current.set(key, request);
      return request;
    },
    [repoBranches]
  );

  const resolveBranchesForRepos = useCallback(
    async (reposToResolve) => {
      const branchResults = await allSettledWithConcurrency(
        reposToResolve,
        BRANCH_LOOKUP_CONCURRENCY,
        (repo) => loadRepoBranches(repo)
      );
      return reposToResolve.map((repo, index) => {
        const key = repoBranchKey(repo);
        const result = branchResults[index];
        const loaded = result?.status === "fulfilled" ? result.value : null;
        const selectedBranch = selectedBranches[key];
        const selectedBranchIsAvailable =
          selectedBranch && (!loaded?.branches?.length || loaded.branches.includes(selectedBranch));
        const branch =
          (selectedBranchIsAvailable ? selectedBranch : "") ||
          loaded?.defaultBranch ||
          loaded?.branches?.[0] ||
          branchForRepo(repo);
        return { ...repo, branch };
      });
    },
    [branchForRepo, loadRepoBranches, selectedBranches]
  );

  useEffect(() => {
    if (!orgs.includes(org)) setOrg(allLabel);
  }, [allLabel, org, orgs]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => availableRepos.some((repo) => repo.id === id)));
  }, [availableRepos]);

  useEffect(() => {
    const availableKeys = new Set(availableRepos.map(repoBranchKey).filter(Boolean));
    setSelectedBranches((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => availableKeys.has(key)))
    );
    setRepoBranches((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => availableKeys.has(key)))
    );
  }, [availableRepos]);

  useGitHubRepositoryAccessAutoRefresh(refreshGitHubRepositoryAccess);

  const runScanForRepos = async (reposToScan) => {
    if (!reposToScan.length) return;
    const selectedRepos = reposToScan.map((repo) => ({
      ...repo,
      scanRequestId: makeScanRequestId(),
    }));
    if (selectedRepos.length > 1) {
      const scanInputs = selectedRepos.map(scanInputFromRepo);
      const batchSubmittedAt = Math.floor(Date.now() / 1000);
      const batchResults = await createBatchScans(scanInputs);
      const pendingScanIds = createdScanIdsFromBatchResults(batchResults);
      const pendingScanRequests = createdScanRequestsFromBatchResults(batchResults, scanInputs);
      setActiveRepo(null);
      go(
        "history",
        pendingScanIds.length
          ? { pendingScanIds }
          : {
              pendingScanRequests,
              pendingScanStartedAt: batchSubmittedAt,
            }
      );
      return;
    }
    setActiveRepo({ ...selectedRepos[0], selectedRepos });
    go("scanning");
  };

  const toggle = (id) => {
    const isSelected = selected.includes(id);
    if (isSelected) {
      setSelected((current) => current.filter((item) => item !== id));
      setSelectionNotice("");
      return;
    }

    const repo = availableRepos.find((item) => item.id === id);
    const repoRemaining = quotaRemaining(repo?.quota);
    if (repoRemaining !== null && repoRemaining <= 0) {
      setSelectionNotice(repositoryQuotaNotice(repo));
      return;
    }
    if (accountQuotaRemaining !== null && selected.length >= accountQuotaRemaining) {
      setSelectionNotice(accountQuotaNotice(accountQuotaRemaining));
      return;
    }

    setSelectionNotice("");
    setSelected((current) => (current.includes(id) ? current : [...current, id]));
    loadRepoBranches(repo);
  };

  const activateRepositorySelection = (event, repoId) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle(repoId);
  };

  const visibleRepoIds = useMemo(() => repos.map((repo) => repo.id), [repos]);
  const visibleSelectedCount = useMemo(
    () => visibleRepoIds.reduce((sum, id) => sum + (selected.includes(id) ? 1 : 0), 0),
    [visibleRepoIds, selected]
  );
  const hasVisibleSelection = visibleSelectedCount > 0;
  const selectAllLabel = hasVisibleSelection
    ? T("Deselect all", "取消全�?)
    : T("Select all", "全�?);

  const toggleSelectAll = () => {
    if (repos.length === 0) return;
    if (hasVisibleSelection) {
      const visibleSet = new Set(visibleRepoIds);
      setSelected((current) => current.filter((id) => !visibleSet.has(id)));
      setSelectionNotice("");
      return;
    }
    const blocked = [];
    const next = [...selected];
    for (const repo of repos) {
      if (next.includes(repo.id)) continue;
      const repoRemaining = quotaRemaining(repo?.quota);
      if (repoRemaining !== null && repoRemaining <= 0) {
        blocked.push(repositoryQuotaNotice(repo));
        continue;
      }
      if (accountQuotaRemaining !== null && next.length >= accountQuotaRemaining) {
        blocked.push(accountQuotaNotice(accountQuotaRemaining));
        break;
      }
      next.push(repo.id);
      loadRepoBranches(repo);
    }
    setSelected(next);
    if (blocked.length > 0) {
      const head = blocked[0];
      const extra = blocked.length > 1 ? ` (+${blocked.length - 1})` : "";
      setSelectionNotice(`${head}${extra}`);
    } else {
      setSelectionNotice("");
    }
  };

  const startScan = async () => {
    if (checkingQuota || resolvingBranches) return;
    const selectedReposToScan = selectedRepoObjects;
    if (selectedReposToScan.length === 0) return;

    setResolvingBranches(true);
    setConnectError("");
    setSelectionNotice("");
    clearAuthorizationError();
    try {
      const reposToScan = await resolveBranchesForRepos(selectedReposToScan);
      setResolvingBranches(false);
      setCheckingQuota(true);
      const preflight = await pullwiseApi.scans.preflight({
        repositories: reposToScan.map(scanInputFromRepo),
      });
      const allowedCount = preflightAllowedCount(preflight, reposToScan.length);
      if (allowedCount < reposToScan.length) {
        const remaining = quotaRemaining(preflight?.userQuota);
        const notice =
          remaining !== null && remaining < reposToScan.length
            ? T(
                `Your account currently has ${remaining} ${scansWord(remaining)} left. Choose up to ${allowedCount} repositories to scan now.`,
                `此账户当前剩�?${remaining} ${scansWord(remaining)}。请最多选择 ${allowedCount} 个仓库进行扫描。`
              )
            : T(
                `Only ${allowedCount} of these repositories can be scanned right now based on current quota. Choose which repositories to scan.`,
                `根据当前配额，现在只能扫描这些仓库中�?${allowedCount} 个。请选择要扫描的仓库。`
              );
        setQuotaPreflight({ ...preflight, selectedRepos: reposToScan });
        setQuotaDialogSelected([]);
        setQuotaDialogNotice(notice);
        return;
      }
      await runScanForRepos(reposToScan);
    } catch (scanError) {
      setConnectError(
        scanError?.message ||
          T(
            "Unable to start scan. Check quota and repository access, then try again.",
            "无法启动扫描。请检查配额和仓库访问权限后重试�?
          )
      );
    } finally {
      setResolvingBranches(false);
      setCheckingQuota(false);
    }
  };

  const quotaDialogRepos = Array.isArray(quotaPreflight?.selectedRepos)
    ? quotaPreflight.selectedRepos
    : [];
  const quotaDialogAllowed = preflightAllowedCount(quotaPreflight, quotaDialogRepos.length);
  const quotaDialogRows = preflightRows(quotaPreflight);
  const quotaDialogCanConfirm =
    quotaDialogSelected.length > 0 && quotaDialogSelected.length <= quotaDialogAllowed;

  const closeQuotaDialog = () => {
    setQuotaPreflight(null);
    setQuotaDialogSelected([]);
    setQuotaDialogNotice("");
  };

  const toggleQuotaDialogRepo = (repo) => {
    const row = preflightRowForRepo(quotaDialogRows, repo);
    if (row?.available === false) {
      setQuotaDialogNotice(
        row.reason === "repository_quota_exceeded"
          ? repositoryQuotaNotice(repo)
          : T(
              "This repository cannot be scanned with the current GitHub authorization.",
              "此仓库无法使用当�?GitHub 授权进行扫描�?
            )
      );
      return;
    }
    if (quotaDialogSelected.includes(repo.id)) {
      setQuotaDialogSelected((current) => current.filter((item) => item !== repo.id));
      return;
    }
    if (quotaDialogSelected.length >= quotaDialogAllowed) {
      setQuotaDialogNotice(
        T(
          `You can choose ${quotaDialogAllowed} ${scansWord(quotaDialogAllowed)} because that is the current effective quota.`,
          `当前有效配额下，你只能选择 ${quotaDialogAllowed} ${scansWord(quotaDialogAllowed)}。`
        )
      );
      return;
    }
    setQuotaDialogSelected((current) => [...current, repo.id]);
  };

  const confirmQuotaDialogSelection = async () => {
    if (!quotaDialogCanConfirm) return;
    const reposToScan = quotaDialogRepos.filter((repo) => quotaDialogSelected.includes(repo.id));
    closeQuotaDialog();
    setCheckingQuota(true);
    setConnectError("");
    try {
      await runScanForRepos(reposToScan);
    } catch (scanError) {
      setConnectError(
        scanError?.message ||
          T(
            "Unable to start scan. Check quota and repository access, then try again.",
            "无法启动扫描。请检查配额和仓库访问权限后重试�?
          )
      );
    } finally {
      setCheckingQuota(false);
    }
  };

  const connectRepositories = async (options = {}) => {
    if (connecting) return;
    setConnecting(true);
    setConnectError("");
    clearAuthorizationError();
    try {
      await connectGitHubRepositories(options);
      await reload({ sync: true });
    } catch (authError) {
      setConnectError(
        authError?.message ||
          T("Unable to connect GitHub repository access.", "无法连接 GitHub 仓库访问�?)
      );
    } finally {
      setConnecting(false);
    }
  };

  const manageInstallation = async (installation) => {
    if (managingInstallationId) return;
    const targetInstallationId = installation?.id || installation?.installationId;
    setManagingInstallationId(targetInstallationId || "");
    setConnectError("");
    clearAuthorizationError();
    try {
      await manageGitHubInstallation(targetInstallationId, {
        githubIdentityId: installation?.manage?.githubIdentityId || undefined,
      });
      await reload();
    } catch (authError) {
      setConnectError(
        authError?.message || T("Unable to manage GitHub installation.", "无法管理 GitHub 安装�?)
      );
    } finally {
      setManagingInstallationId("");
    }
  };

  const activateConnectRepositories = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    connectRepositories();
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Repositories", "仓库") }]}
        setIssue={setIssue}
        loading={loading}
      />
      <div className="with-side">
        <Sidebar section="repos" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Choose repositories to scan", "选择要扫描的仓库")}</h1>
              {(needsAuthorization || !hasInstallationDetails) && (
                <div className="sub">
                  {needsAuthorization
                    ? T(
                        "GitHub repository access is not connected yet.",
                        "尚未连接 GitHub 仓库权限�?
                      )
                    : T(`${repositoryTotal} authorized repos`, `${repositoryTotal} 个已授权仓库`)}
                </div>
              )}
              {accountQuotaLabel && (
                <div className="sub account-quota-summary">
                  {T("Account quota", "账户配额")}: {accountQuotaLabel}
                </div>
              )}
            </div>
            <div className="actions">
              <button className="btn" disabled={loading} onClick={() => reload({ sync: true })}>
                <I.Refresh size={14} /> {T("Sync", "同步")}
              </button>
              <button
                className="btn primary"
                disabled={selected.length === 0 || checkingQuota || resolvingBranches}
                onClick={startScan}
              >
                {checkingQuota || resolvingBranches ? (
                  <span className="spin" style={{ display: "inline-block" }}>
                    <I.Refresh size={12} />
                  </span>
                ) : (
                  <I.Play size={12} />
                )}{" "}
                {checkingQuota ? T("Checking quota", "正在检查配�?) : T("Start scan", "开始扫�?)}{" "}
                ({selected.length})
              </button>
            </div>
          </div>

          {!needsAuthorization && hasInstallationDetails && (
            <GitHubInstallationsList
              installations={installations}
              onManage={manageInstallation}
              managingInstallationId={managingInstallationId}
            />
          )}

          <div className="repos-toolbar">
            <div className="repos-toolbar-row">
              <div className="repos-search">
                <I.Search size={14} />
                <input
                  placeholder={T("Search repositories...", "搜索仓库...")}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn repos-select-all"
                onClick={toggleSelectAll}
                disabled={repos.length === 0}
                aria-pressed={hasVisibleSelection}
                aria-label={
                  hasVisibleSelection
                    ? T("Deselect all visible repositories", "取消全选可见仓�?)
                    : T("Select all visible repositories", "全选可见仓�?)
                }
                title={
                  hasVisibleSelection
                    ? T("Deselect all visible repositories", "取消全选可见仓�?)
                    : T("Select all visible repositories", "全选可见仓�?)
                }
              >
                {hasVisibleSelection ? <I.X size={12} /> : <I.Check size={12} />}
                {selectAllLabel}
                {hasVisibleSelection
                  ? visibleSelectedCount > 0 && (
                      <span className="repos-select-all-count">({visibleSelectedCount})</span>
                    )
                  : visibleRepoIds.length > 0 && (
                      <span className="repos-select-all-count">({visibleRepoIds.length})</span>
                    )}
              </button>
            </div>
            <div className="repos-orgs-shell">
              <button
                type="button"
                className="repos-org-scroll"
                aria-label={T("Scroll repository filters left", "向左滑动仓库筛�?)}
                onClick={() => scrollOwnerTabs(-1)}
                disabled={!ownerTabsScrollable}
              >
                <I.ArrowL size={13} />
              </button>
              <div
                ref={ownerTabsRef}
                className="repos-orgs"
                role="tablist"
                aria-label={T("Repository owner filters", "仓库所有者筛�?)}
                aria-orientation="horizontal"
                data-scrollable={ownerTabsScrollable ? "true" : "false"}
              >
                {orgs.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={org === item}
                    className={"repos-org" + (org === item ? " active" : "")}
                    onClick={(event) => selectOwnerTab(event, item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="repos-org-scroll"
                aria-label={T("Scroll repository filters right", "向右滑动仓库筛�?)}
                onClick={() => scrollOwnerTabs(1)}
                disabled={!ownerTabsScrollable}
              >
                <I.ArrowR size={13} />
              </button>
            </div>
          </div>

          <div className="repos-list">
            {loading ? (
              <RepositoriesSkeleton />
            ) : (
              <>
                <div className="repo-row repo-row-status repo-scan-policy">
                  <div className="repo-icon">
                    <I.Shield size={16} />
                  </div>
                  <div className="repo-main">
                    <div className="repo-name">
                      <span>{T("Which repositories can be scanned", "哪些仓库可以扫描")}</span>
                    </div>
                    <div className="repo-desc">
                      {T(
                        "Pullwise can scan repositories selected in GitHub authorization, with account and repository quota available, and within worker checkout size limits. If a checkout is too large, the scan stops before Codex review and shows the measured size.",
                        "Pullwise 只能扫描已在 GitHub 授权中选中、账户和仓库配额仍可用、并�?checkout 后未超过 worker 体积限制的仓库。如果仓库过大，扫描会在验证器和 AI 审查前停止，并显示实际大小�?
                      )}
                    </div>
                    <div className="repo-desc">
                      {repositoryScanPolicyLimitText(scanPolicyLimits)}
                    </div>
                    <div className="repo-desc">
                      {T(
                        "Private repositories and forks can be scanned when authorized. Forks share repository quota with their source repository; language is detected for context and is not an allowlist. The selected branch must exist in GitHub.",
                        "私有仓库�?fork 仓库只要已授权即可扫描。fork 会与源仓库共享仓库配额；语言只作为上下文识别，不是允许名单。所选分支必须存在于 GitHub�?
                      )}
                    </div>
                  </div>
                </div>
                {selectionNotice && (
                  <div className="repo-row repo-row-status quota-selection-alert" role="alert">
                    <div className="repo-icon">
                      <I.Activity size={16} />
                    </div>
                    <div className="repo-main">
                      <div className="repo-name">
                        <span>{T("Scan quota limit", "扫描配额限制")}</span>
                      </div>
                      <div className="repo-desc">{selectionNotice}</div>
                    </div>
                  </div>
                )}
                {needsAuthorization && (
                  <div
                    className="repo-row repo-row-status"
                    role="button"
                    tabIndex={0}
                    onClick={() => connectRepositories()}
                    onKeyDown={activateConnectRepositories}
                  >
                    <div className="repo-icon">
                      {connecting ? (
                        <span className="spin" style={{ display: "inline-block" }}>
                          <I.Refresh size={16} />
                        </span>
                      ) : (
                        <I.Github size={16} />
                      )}
                    </div>
                    <div className="repo-main">
                      <div className="repo-name">
                        <span>
                          {connecting
                            ? T("Opening GitHub...", "Opening GitHub...")
                            : T("Connect GitHub repositories", "连接 GitHub 仓库")}
                        </span>
                      </div>
                      <div className="repo-desc">
                        {T(
                          "Choose the repositories Pullwise can read for this scan.",
                          "选择 Pullwise 可只读访问并扫描的仓库�?
                        )}
                      </div>
                    </div>
                    <I.ArrowR size={14} />
                  </div>
                )}
                {displayError && (
                  <div className="repo-row repo-row-status">
                    <div className="repo-icon">
                      <I.X size={16} />
                    </div>
                    <div className="repo-main">
                      <div className="repo-name">
                        <span>{T("Unable to load repositories", "无法加载仓库")}</span>
                      </div>
                      <div className="repo-desc">{displayError}</div>
                    </div>
                  </div>
                )}
                {loading && (
                  <div className="repo-row repo-row-status">
                    <div className="repo-icon">
                      <span className="spin" style={{ display: "inline-block" }}>
                        <I.Refresh size={16} />
                      </span>
                    </div>
                    <div className="repo-main">
                      <div className="repo-name">
                        <span>{T("Loading repositories", "正在加载仓库")}</span>
                      </div>
                      <div className="repo-desc">
                        {T("Reading GitHub App authorization.", "正在读取 GitHub App 授权�?)}
                      </div>
                    </div>
                  </div>
                )}
                {!loading && !error && !needsAuthorization && repos.length === 0 && (
                  <div className="repo-row repo-row-status">
                    <div className="repo-icon">
                      <I.Folder size={16} />
                    </div>
                    <div className="repo-main">
                      <div className="repo-name">
                        <span>{T("No authorized repositories", "没有已授权仓�?)}</span>
                      </div>
                      <div className="repo-desc">
                        {T(
                          "Authorize repositories in GitHub, then sync again.",
                          "请先�?GitHub 授权仓库，然后重新同步�?
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {repos.map((repo) => {
                  const on = selected.includes(repo.id);
                  const quotaLabel = repoQuotaLabel(repo.quota);
                  const quotaEmpty = repo.quota && quotaNumber(repo.quota.remaining) <= 0;
                  const repoLabel = repo.fullName || repo.name;
                  const branchKey = repoBranchKey(repo);
                  const branchState = repoBranches[branchKey] || null;
                  const selectedBranch = branchForRepo(repo);
                  const branchOptions = branchState?.branches?.length
                    ? branchState.branches
                    : [selectedBranch].filter(Boolean);
                  const languageColorKey = repoLanguageColorKey(repo.lang);
                  return (
                    <div
                      key={repo.id}
                      className={"repo-row" + (on ? " on" : "")}
                      role="button"
                      tabIndex={0}
                      aria-pressed={on}
                      aria-label={`Select repository ${repoLabel}`}
                      onClick={() => toggle(repo.id)}
                      onKeyDown={(event) => activateRepositorySelection(event, repo.id)}
                    >
                      <div className="repo-check">
                        <span className="repo-check-box">{on && <I.Check size={11} />}</span>
                      </div>
                      <div className="repo-icon">
                        <I.Folder size={16} />
                      </div>
                      <div className="repo-main">
                        <div className="repo-name">
                          <span>{repo.fullName || repo.name}</span>
                          {repo.private && (
                            <span className="tag">
                              <I.Lock size={10} />{" "}
                              {T("private", {
                                zh: "私有",
                                ja: "プライベート",
                                ko: "비공�?,
                                fr: "privé",
                                es: "privado",
                              })}
                            </span>
                          )}
                          {repo.fork && (
                            <span className="tag">
                              <I.GitBranch size={10} />{" "}
                              {T("fork", {
                                zh: "派生",
                                ja: "フォーク",
                                ko: "포크",
                                fr: "fork",
                                es: "fork",
                              })}
                            </span>
                          )}
                        </div>
                        <div className="repo-desc">{repo.desc}</div>
                      </div>
                      <div className="repo-meta">
                        {on ? (
                          <BranchPicker
                            repoLabel={repoLabel}
                            value={selectedBranch}
                            options={branchOptions}
                            loading={!!branchState?.loading}
                            error={branchState?.error || ""}
                            disabled={!!branchState?.loading}
                            onChange={(nextBranch) => {
                              setSelectedBranches((current) => ({
                                ...current,
                                [branchKey]: nextBranch,
                              }));
                            }}
                          />
                        ) : (
                          <span
                            className="repo-branch-picker repo-branch-placeholder"
                            aria-hidden="true"
                          >
                            <span className="repo-branch-trigger">
                              <I.GitBranch size={12} />
                              <span className="repo-branch-value">{selectedBranch}</span>
                              <I.ChevD size={11} className="repo-branch-chev" />
                            </span>
                          </span>
                        )}
                        <span className="repo-meta-lang">
                          <span
                            className="lang-dot"
                            data-lang-color={languageColorKey}
                            style={{ "--repo-lang-color": repoLanguageColor(languageColorKey) }}
                          ></span>{" "}
                          {repo.lang}
                        </span>
                        <span>
                          <I.Star size={12} /> {repo.stars}
                        </span>
                        <span>
                          <I.GitBranch size={12} /> {repo.branches}
                        </span>
                        <span>
                          <I.Clock size={12} /> {repo.updated}
                        </span>
                        {quotaLabel && (
                          <span className={"repo-quota" + (quotaEmpty ? " empty" : "")}>
                            <I.Activity size={12} /> {quotaLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!loading && repositoriesMeta.hasMore && (
                  <div className="repo-row repo-row-status">
                    <div className="repo-icon">
                      {loadingMore ? (
                        <span className="spin" style={{ display: "inline-block" }}>
                          <I.Refresh size={16} />
                        </span>
                      ) : (
                        <I.Folder size={16} />
                      )}
                    </div>
                    <div className="repo-main">
                      <div className="repo-name">
                        <span>{T("More repositories available", "还有更多仓库")}</span>
                      </div>
                      <div className="repo-desc">
                        {T(
                          `Loaded ${loadedRepositoryCount} of ${repositoryTotal} repositories.`,
                          `已加�?${loadedRepositoryCount} / ${repositoryTotal} 个仓库。`
                        )}
                      </div>
                    </div>
                    <button className="btn sm" disabled={loadingMore} onClick={loadMore}>
                      {loadingMore ? T("Loading...", "正在加载...") : T("Load more", "加载更多")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="repos-foot">
            <span className="muted">
              {T("Missing a repository? ", "缺少仓库�?)}
              <button
                type="button"
                className="auth-link"
                onClick={() => connectRepositories({ add: true })}
              >
                {T("Add GitHub account or organization", "添加 GitHub 账号或组�?)}
              </button>
            </span>
          </div>
        </div>
      </div>
      {quotaPreflight && (
        <div className="quota-modal-back">
          <div
            className="quota-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quota-dialog-title"
          >
            <div className="modal-h">
              <div>
                <h2 id="quota-dialog-title">
                  {T("Choose repositories to scan", "选择要扫描的仓库")}
                </h2>
                <p>{quotaDialogNotice}</p>
              </div>
              <button className="btn ghost icon" type="button" onClick={closeQuotaDialog}>
                <I.X size={14} />
              </button>
            </div>
            <div className="quota-choice-count">
              {T(
                `${quotaDialogSelected.length} of ${quotaDialogAllowed} selected`,
                `已�?${quotaDialogSelected.length} / ${quotaDialogAllowed}`
              )}
            </div>
            <div className="quota-choice-list">
              {quotaDialogRepos.map((repo) => {
                const row = preflightRowForRepo(quotaDialogRows, repo);
                const on = quotaDialogSelected.includes(repo.id);
                const unavailable = row?.available === false || quotaDialogAllowed <= 0;
                const quotaLabel = repoQuotaLabel(row?.repoQuota || row?.quota || repo.quota);
                return (
                  <button
                    key={repo.id}
                    type="button"
                    className={
                      "quota-choice-row" + (on ? " on" : "") + (unavailable ? " unavailable" : "")
                    }
                    aria-pressed={on}
                    onClick={() => toggleQuotaDialogRepo(repo)}
                    disabled={unavailable}
                  >
                    <span className="repo-check-box">{on && <I.Check size={11} />}</span>
                    <span className="quota-choice-copy">
                      <strong>{repo.fullName || repo.name}</strong>
                      <span>
                        {quotaLabel || repo.desc || T("Authorized repository", "已授权仓�?)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="modal-foot">
              {quotaDialogAllowed <= 0 && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    closeQuotaDialog();
                    go("billing");
                  }}
                >
                  <I.Activity size={14} /> {T("Open billing", "打开账单")}
                </button>
              )}
              <button className="btn ghost" type="button" onClick={closeQuotaDialog}>
                {T("Cancel", "取消")}
              </button>
              <button
                className="btn primary"
                type="button"
                disabled={!quotaDialogCanConfirm}
                onClick={confirmQuotaDialogSelection}
              >
                <I.Play size={12} /> {T("Scan selected", "扫描所�?)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function workerPhaseLabel(phase) {
  return String(phase || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function scanPhaseDefinition(scan, phase) {
  const phaseKey = String(phase || "").trim();
  if (!phaseKey) return null;
  const step = (scan?.progressSteps || []).find((item) => item.id === phaseKey);
  if (step) return step;
  return { id: phaseKey, label: workerPhaseLabel(phaseKey), description: "" };
}

function fallbackCurrentScanStep(scan, currentPhase, status) {
  if (!currentPhase) return [];
  const def = scanPhaseDefinition(scan, currentPhase);
  if (!def) return [];
  const terminalStatus = terminalProgressStepStatus(status);
  return [
    {
      ...def,
      id: def.id || currentPhase,
      status: terminalStatus || "running",
      percent: ["failed", "cancelled", "lost"].includes(status)
        ? Math.min(scan?.progress || 0, 94)
        : scan?.progress || 0,
    },
  ];
}

function terminalProgressStepStatus(status) {
  if (status === "done") return "completed";
  if (status === "failed" || status === "lost") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "partial_completed") return "partial_completed";
  return "";
}

function scanPhasesForScan(scan, currentPhase, status) {
  if (Array.isArray(scan?.progressSteps) && scan.progressSteps.length) {
    const terminalStatus = terminalProgressStepStatus(status);
    if (!terminalStatus) return scan.progressSteps;
    return scan.progressSteps.map((step) => {
      const stepStatus = String(step?.status || "").toLowerCase();
      const isCurrentStep = currentPhase && String(step?.id || "") === currentPhase;
      if (stepStatus !== "running" && !isCurrentStep) return step;
      return { ...step, status: terminalStatus };
    });
  }
  return fallbackCurrentScanStep(scan, currentPhase, status);
}
function scanLogDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return new Date(value * 1000);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return new Date(Number(text) * 1000);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function scanLogTimestamp(scan) {
  for (const value of [scan?.updatedAt, scan?.completedAt, scan?.startedAt, scan?.createdAt]) {
    const date = scanLogDate(value);
    if (date) return date.toLocaleTimeString();
  }
  return "";
}
function fallbackScanProgressLogs(scan) {
  const phase = scan?.phase;
  const message = scan?.progressMessage || "";
  const logsSummary = scan?.logsSummary || "";
  if (!phase || (!message && !logsSummary)) return [];
  return [
    {
      time: scan?.updatedAt ?? scan?.completedAt ?? scan?.startedAt ?? scan?.createdAt,
      phase,
      progress: scan?.progress,
      message,
      logsSummary,
    },
  ];
}

function scanProgressLogLine(entry, fallbackScan) {
  const phase = entry?.phase || fallbackScan?.phase;
  const def = scanPhaseDefinition(fallbackScan, phase);
  const label = def?.label || phase || T("Worker update", "Worker update");
  const stamp = scanLogTimestamp({
    updatedAt: entry?.time ?? fallbackScan?.updatedAt,
    completedAt: fallbackScan?.completedAt,
    startedAt: fallbackScan?.startedAt,
    createdAt: fallbackScan?.createdAt,
  });
  const detailText = entry?.message || entry?.logsSummary || "";
  const detail = detailText ? ` - ${detailText}` : "";
  return `${stamp ? `[${stamp}] ` : ""}${label}${detail}`;
}

const FLOW_ZOOM_MIN = 0.65;
const FLOW_ZOOM_MAX = 1.35;
const FLOW_WHEEL_ZOOM_SPEED = 0.0014;

function clampFlowZoom(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(FLOW_ZOOM_MIN, Math.min(FLOW_ZOOM_MAX, Math.round(number * 100) / 100));
}

function pointerEventCoordinate(event, key) {
  for (const value of [event?.[key], event?.nativeEvent?.[key]]) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function cleanStepErrorMessage(value) {
  return String(value || "")
    .replaceAll("\x00", "")
    .split(/\r?\n|\r/, 1)[0]
    .trim();
}

function scanStepErrorMessage(step, currentPhase, errorMessage) {
  const explicitError = cleanStepErrorMessage(
    step?.error ||
      step?.errorMessage ||
      step?.error_message ||
      step?.errorReason ||
      step?.error_reason ||
      step?.failureReason ||
      step?.failure_reason ||
      step?.reason ||
      step?.cause
  );
  if (explicitError) return explicitError;
  const fallbackError = cleanStepErrorMessage(errorMessage);
  if (!fallbackError) return "";
  const stepStatus = String(step?.status || "").toLowerCase();
  const stepId = String(step?.id || "").trim();
  if (["failed", "cancelled"].includes(stepStatus)) return fallbackError;
  if (currentPhase && stepId === currentPhase) return fallbackError;
  return "";
}

function ScanProgressFlow({
  steps,
  currentPhase,
  phaseIdx,
  terminal,
  progressMessage,
  logsSummary,
  errorMessage = "",
}) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const dragRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const focusedPhaseRef = useRef("");

  const resetView = useCallback(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return;

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    setView((current) => {
      const nextScale = clampFlowZoom(
        current.scale *
          (1 -
            Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 120) * FLOW_WHEEL_ZOOM_SPEED)
      );
      if (nextScale === current.scale) return current;
      const contentX = (pointerX - current.x) / current.scale;
      const contentY = (pointerY - current.y) / current.scale;
      return {
        scale: nextScale,
        x: Math.round((pointerX - contentX * nextScale) * 100) / 100,
        y: Math.round((pointerY - contentY * nextScale) * 100) / 100,
      };
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  const handlePointerDown = useCallback(
    (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target?.closest?.("button,a,input,textarea,select")) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: pointerEventCoordinate(event, "clientX"),
        startY: pointerEventCoordinate(event, "clientY"),
        x: Number.isFinite(Number(view.x)) ? Number(view.x) : 0,
        y: Number.isFinite(Number(view.y)) ? Number(view.y) : 0,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [view.x, view.y]
  );

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const clientX = pointerEventCoordinate(event, "clientX");
    const clientY = pointerEventCoordinate(event, "clientY");
    setView((current) => ({
      ...current,
      x: drag.x + clientX - drag.startX,
      y: drag.y + clientY - drag.startY,
    }));
  }, []);

  const finishDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const target = trackRef.current?.querySelector('[data-flow-current="true"]');
    if (!viewport || !target || dragRef.current) return;

    const viewportRect = viewport.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (!viewportRect.width || !targetRect.width) return;

    const phaseKey = currentPhase || target.getAttribute("data-phase-id") || "";
    const focusKey = `${phaseKey}:${phaseIdx}`;
    if (!phaseKey || focusedPhaseRef.current === focusKey) return;

    const viewportCenterX = viewportRect.left + viewportRect.width / 2;
    const viewportCenterY = viewportRect.top + viewportRect.height / 2;
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const deltaX = viewportCenterX - targetCenterX;
    const deltaY = viewportCenterY - targetCenterY;

    focusedPhaseRef.current = focusKey;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
    setView((current) => ({
      ...current,
      x: Math.round((current.x + deltaX) * 100) / 100,
      y: Math.round((current.y + deltaY) * 100) / 100,
    }));
  }, [currentPhase, phaseIdx]);

  return (
    <div className="scanning-flow" aria-label={T("Worker progress flow", "Worker progress flow")}>
      <div
        className="scanning-flow-toolbar"
        aria-label={T("Progress flow controls", "Progress flow controls")}
      >
        <button
          className="btn ghost sm scanning-flow-locate"
          type="button"
          onClick={resetView}
          aria-label={T("Reset progress flow view", "Reset progress flow view")}
          title={T("Reset view", "Reset view")}
        >
          <I.Compass size={13} />
        </button>
      </div>
      <div
        ref={viewportRef}
        className="scanning-flow-viewport"
        role="group"
        aria-label={T("Pan worker progress flow", "Pan worker progress flow")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div
          ref={trackRef}
          className="scanning-phases scanning-flow-track"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {steps.map((p, i) => {
            const stepStatus = String(p.status || "").toLowerCase();
            const isPartial = stepStatus === "partial_completed";
            const isCancelled = stepStatus === "cancelled";
            const isDone =
              ["completed", "skipped"].includes(stepStatus) ||
              (phaseIdx > i && stepStatus !== "failed");
            const isOn = !terminal && (stepStatus === "running" || (phaseIdx === i && !isDone));
            const stepError = scanStepErrorMessage(p, currentPhase, errorMessage);
            const isFailed = stepStatus === "failed";
            const cls = [
              "scanning-phase",
              isDone ? "done" : "",
              isOn ? "on" : "",
              isFailed ? "failed" : "",
              isCancelled ? "cancelled" : "",
              isPartial ? "partial" : "",
              stepError ? "errored" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const bullet = isDone ? (
              <I.Check size={11} />
            ) : isFailed || isCancelled || isPartial || stepError ? (
              <I.X size={11} />
            ) : isOn ? (
              <span className="pulse scanning-flow-pulse" />
            ) : (
              i + 1
            );
            const label = p.label || workerPhaseLabel(p.id);
            const detail =
              p.id === currentPhase && progressMessage ? progressMessage : p.description || "";
            const statusLabel = isFailed
              ? T("Failed", "Failed")
              : stepError
                ? T("Error", "Error")
                : isCancelled
                  ? T("Cancelled", "Cancelled")
                  : isPartial
                    ? T("Partially completed", "Partially completed")
                    : isOn
                      ? T("Running", "Running")
                      : isDone
                        ? T("Complete", "Complete")
                        : T("Queued", "Queued");
            const key = p.id || `${label}-${i}`;
            return (
              <div className="scanning-flow-step" key={key}>
                <div
                  className={cls}
                  data-phase-id={p.id || key}
                  data-flow-current={isOn ? "true" : undefined}
                  data-status={stepStatus || "pending"}
                  aria-current={isOn ? "step" : undefined}
                >
                  <div className="scanning-phase-bullet">{bullet}</div>
                  <div className="scanning-phase-body">
                    <div className="scanning-phase-top">
                      <div className="scanning-phase-t">{label}</div>
                      <div className="scanning-phase-kpis">
                        <span className="scanning-phase-status">{statusLabel}</span>
                      </div>
                    </div>
                    <div className="scanning-phase-d">{detail}</div>
                    {p.id === currentPhase && logsSummary && (
                      <div className="scanning-phase-meta">{logsSummary}</div>
                    )}
                    {stepError && (
                      <div className="scanning-phase-error" role="alert">
                        <I.X size={11} />
                        <span>{stepError}</span>
                      </div>
                    )}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={"scanning-flow-edge" + (isDone ? " done" : "")}
                    aria-hidden="true"
                  >
                    <span />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScanDetailSkeleton() {
  const rows = [
    ["sk-w-28", "sk-w-62"],
    ["sk-w-32", "sk-w-70"],
    ["sk-w-26", "sk-w-56"],
  ];

  return (
    <div
      className="scan-detail-skeleton scanning-flow"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={T("Loading scan details", "正在加载扫描详情")}
    >
      <div className="scanning-flow-toolbar" aria-hidden="true">
        <SkeletonLine className="sk-line sk-w-10 sk-h-28" />
      </div>
      <div className="scanning-flow-viewport" aria-hidden="true">
        <div className="scanning-phases scanning-flow-track scan-detail-skeleton-phases">
          {rows.map(([titleWidth, detailWidth], index) => (
            <div className="scanning-flow-step" key={`scan-detail-skeleton-phase-${index}`}>
              <div className="scanning-phase skeleton-row">
                <div className="scanning-phase-bullet">
                  <SkeletonLine className="sk-line sk-w-100 sk-h-10" />
                </div>
                <div className="scanning-phase-body">
                  <div className="scanning-phase-top">
                    <SkeletonLine className={`sk-line ${titleWidth} sk-h-16`} />
                    <SkeletonLine className="sk-line sk-w-12 sk-h-20" />
                  </div>
                  <SkeletonLine className={`sk-line ${detailWidth}`} />
                  {index === 1 && <SkeletonLine className="sk-line sk-w-50" />}
                </div>
              </div>
              {index < rows.length - 1 && (
                <div className="scanning-flow-edge" aria-hidden="true">
                  <span />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanDetailProgressSkeleton() {
  return (
    <div className="scan-progress scanning-progress scan-progress-skeleton" aria-hidden="true">
      <div className="scan-progress-track">
        <SkeletonLine className="sk-line sk-w-30 sk-h-10" />
      </div>
    </div>
  );
}

function ScanDetailSideSkeleton() {
  return (
    <div className="scanning-side scan-detail-skeleton-side" aria-hidden="true">
      <div className="card scanning-counts scan-detail-skeleton-card">
        <SkeletonLine className="sk-line sk-w-42 sk-h-10" />
        <div className="scanning-counts-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={`scan-detail-skeleton-count-${index}`}>
              <SkeletonLine className="sk-line sk-w-35 sk-h-24" />
              <SkeletonLine className="sk-line sk-w-55 sk-h-10" />
            </div>
          ))}
        </div>
        <SkeletonLine className="sk-line sk-w-34 sk-h-10 scan-detail-skeleton-subh" />
        <div className="scan-preflight-meta scan-agent-meta">
          <SkeletonLine className="sk-line sk-w-32 sk-h-22" />
          <SkeletonLine className="sk-line sk-w-38 sk-h-22" />
        </div>
      </div>
      <div className="card scanning-preflight scan-detail-skeleton-card">
        <SkeletonLine className="sk-line sk-w-50 sk-h-10" />
        <SkeletonLine className="sk-line sk-w-80" />
        <div className="scan-preflight-tags">
          <SkeletonLine className="sk-line sk-w-24 sk-h-22" />
          <SkeletonLine className="sk-line sk-w-30 sk-h-22" />
          <SkeletonLine className="sk-line sk-w-20 sk-h-22" />
        </div>
        <div className="scan-preflight-meta">
          <SkeletonLine className="sk-line sk-w-42" />
          <SkeletonLine className="sk-line sk-w-36" />
          <SkeletonLine className="sk-line sk-w-60" />
          <SkeletonLine className="sk-line sk-w-48" />
        </div>
      </div>
      <div className="card scanning-log scan-detail-skeleton-card">
        <SkeletonLine className="sk-line sk-w-36 sk-h-10" />
        <div className="skeleton-stack">
          <SkeletonLine className="sk-line sk-w-70" />
          <SkeletonLine className="sk-line sk-w-55" />
          <SkeletonLine className="sk-line sk-w-62" />
        </div>
      </div>
    </div>
  );
}

function ScanAgentUsageSlot({ tags }) {
  if (!tags.length) return null;
  return (
    <>
      <div className="scanning-counts-h scanning-counts-subh">{T("Review agent", "审查代理")}</div>
      <div className="scan-preflight-meta scan-agent-meta">
        {tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
    </>
  );
}

function ScanLogSkeletonLines() {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      <SkeletonLine className="sk-line sk-w-70" />
      <SkeletonLine className="sk-line sk-w-55" />
      <SkeletonLine className="sk-line sk-w-62" />
    </div>
  );
}
export function ScanningScreen({ go, activeRepo, setIssue = null, onScanResolved = null }) {
  useLang();
  const [bundleLoading, setBundleLoading] = useState(false);
  const [agentPromptLoading, setAgentPromptLoading] = useState(false);
  const [agentPromptCopied, setAgentPromptCopied] = useState(false);
  const agentPromptResetRef = useRef(null);
  const resolvedScanIdRef = useRef("");
  const selectedRepos = useMemo(
    () => (Array.isArray(activeRepo?.selectedRepos) ? activeRepo.selectedRepos : []),
    [activeRepo?.selectedRepos]
  );
  const batchMode = selectedRepos.length > 1;
  const singleRepo = selectedRepos.length === 1 ? selectedRepos[0] : activeRepo;
  const initialScan = singleRepo?.initialScan || null;
  const scanId = singleRepo?.scanId || "";
  const singleScanInput = scanInputFromRepo(singleRepo);
  const repoId = singleScanInput.repoId || initialScan?.repoId || "";
  const repoFullName = singleScanInput.repo || initialScan?.repo || "";
  const branch = singleScanInput.branch || initialScan?.branch || "main";
  const commit = singleScanInput.commit || initialScan?.commit || "pending";
  const requestId = singleScanInput.requestId || "";
  const batchRepositories = useMemo(() => {
    if (!batchMode) return [];
    return selectedRepos.map(scanInputFromRepo).filter((request) => request.repo || request.repoId);
  }, [batchMode, selectedRepos]);

  const singleRun = useScanRun({
    repoId: batchMode ? "" : repoId,
    repo: batchMode ? "" : repoFullName,
    branch,
    commit,
    requestId,
    scanId: batchMode ? "" : scanId,
    initialScan: batchMode ? null : initialScan,
  });
  const batchRun = useScanBatchRun({ repositories: batchRepositories });
  const scans = batchMode ? batchRun.scans : singleRun.scan ? [singleRun.scan] : [];
  const batchRows = batchMode ? batchRun.batchResults || [] : [];
  const scan = batchMode
    ? scans.find((item) => !isTerminalScan(item)) || scans[0] || null
    : singleRun.scan;
  const error = batchMode ? batchRun.error : singleRun.error;
  const errorCode = batchMode ? batchRun.errorCode : singleRun.errorCode;
  const cancel = batchMode ? batchRun.cancel : singleRun.cancel;
  const retry = batchMode ? null : singleRun.retry;
  const retrying = batchMode ? false : Boolean(singleRun.retrying);
  const canceling = batchMode ? Boolean(batchRun.canceling) : Boolean(singleRun.canceling);
  const detailLoading = !batchMode && Boolean(scanId && singleRun.loading);
  const agentFixPrompt =
    !batchMode && typeof scan?.agentFixPrompt === "string" ? scan.agentFixPrompt : "";

  useEffect(() => {
    if (batchMode || !scan?.id || typeof onScanResolved !== "function") return;
    if (resolvedScanIdRef.current === scan.id) return;
    resolvedScanIdRef.current = scan.id;
    onScanResolved(scan);
  }, [batchMode, scan, onScanResolved]);

  useEffect(
    () => () => {
      if (agentPromptResetRef.current) clearTimeout(agentPromptResetRef.current);
    },
    []
  );

  useEffect(() => {
    setAgentPromptCopied(false);
    if (agentPromptResetRef.current) {
      clearTimeout(agentPromptResetRef.current);
      agentPromptResetRef.current = null;
    }
  }, [scan?.id]);

  const expectedBatchCount = batchRepositories.length;
  const status = batchMode
    ? batchScanStatus(scans, expectedBatchCount, Boolean(error))
    : scan?.status || (error ? "failed" : repoFullName ? "queued" : "no_repo");
  const reportedCurrentStep =
    scan?.progressSteps?.find((step) => ["running", "failed", "cancelled"].includes(step.status)) ||
    null;
  const rawCurrentPhase = scan?.phase || reportedCurrentStep?.id || null;
  const currentPhase = rawCurrentPhase ? String(rawCurrentPhase).trim() : null;
  const scanProgressMessage = batchMode ? "" : scan?.progressMessage || "";
  const scanProgressLogsSummary = batchMode ? "" : scan?.logsSummary || "";
  const liveLogEntries = batchMode
    ? []
    : scan?.progressLogs?.length
      ? scan.progressLogs
      : fallbackScanProgressLogs(scan);
  const liveLogLines = liveLogEntries
    .map((entry) => scanProgressLogLine(entry, scan))
    .filter(Boolean);
  const scanPhases = scanPhasesForScan(scan, currentPhase, status);
  const phaseIdx = currentPhase ? scanPhases.findIndex((p) => p.id === currentPhase) : -1;
  const found = batchMode
    ? scanIssueTotals(scans)
    : scan?.issues || { critical: 0, high: 0, medium: 0, low: 0 };
  const preflight = batchMode
    ? scanPreflightSummary(scans)
    : scanPreflightSummary(scan ? [scan] : []);
  const showPreflight = hasScanPreflightEvidence(preflight);
  const humanReport = batchMode ? null : scan?.humanReport || null;
  const reviewRun = batchMode ? null : scan?.reviewRun || null;
  const aiUsage = batchMode ? scanAiUsageSummary(scans) : scan?.aiUsage || null;
  const aiUsageTags = scanAiUsageTags(aiUsage);
  const terminal =
    !detailLoading &&
    (batchMode
      ? expectedBatchCount > 0 &&
        batchRows.length === expectedBatchCount &&
        batchRows.every(isTerminalBatchRow)
      : isTerminalScan(scan));
  const queueSummary = scanQueueSummary(scan);
  const canCancel =
    !detailLoading &&
    (batchMode
      ? !canceling && scans.some((item) => item?.id && !isTerminalScan(item))
      : Boolean(scan && !terminal && !canceling));
  const canRetry = !detailLoading && !batchMode && isRetryableScan(scan);
  const errorAction = error ? scanErrorAction({ message: error, code: errorCode }) : null;
  const publicError = error ? publicScanErrorMessage(error) : "";
  const batchSummary = batchMode
    ? batchCreationSummary(batchRows, scans, expectedBatchCount)
    : null;
  const scanProgress = !batchMode && scan ? scanProgressPresentation(scan) : null;

  const handleCancel = async () => {
    if (canCancel) await cancel();
  };
  const handleBack = () => {
    go("history");
  };
  const handleRetry = async () => {
    if (!canRetry || typeof retry !== "function") return;
    const nextScan = await retry();
    if (nextScan?.id && nextScan.id !== scan?.id) {
      go("scanning", { scanId: nextScan.id });
    }
  };

  const handleDownloadBundle = async () => {
    const targetScanId = batchMode ? "" : scanId;
    if (!targetScanId || bundleLoading || !terminal) return;
    setBundleLoading(true);
    try {
      const bundle = await pullwiseApi.scans.auditBundleArchive(targetScanId);
      downloadBlob(`pullwise-audit-${targetScanId}.zip`, bundle, "application/zip");
    } catch (error) {
      globalThis.alert?.(
        error?.message || T("Unable to download audit bundle.", "无法下载审计包�?)
      );
    } finally {
      setBundleLoading(false);
    }
  };

  const handleCopyAgentFixPrompt = async () => {
    if (!agentFixPrompt || agentPromptLoading || !scan?.id) return;
    setAgentPromptLoading(true);
    try {
      const keyPayload = await pullwiseApi.apiKeys.createAuditBundleKey(
        scan.id,
        scan.repoId || repoId
      );
      const prompt = agentFixPromptWithBundleKey(agentFixPrompt, scan, keyPayload);
      if (!prompt)
        throw new Error(
          T(
            "Unable to create audit bundle download key.",
            "Unable to create audit bundle download key."
          )
        );
      const copied = await copyText(prompt);
      if (!copied) {
        globalThis.alert?.(
          T("Unable to copy agent fix prompt.", "Unable to copy agent fix prompt.")
        );
        return;
      }
      setAgentPromptCopied(true);
      if (agentPromptResetRef.current) clearTimeout(agentPromptResetRef.current);
      agentPromptResetRef.current = setTimeout(() => {
        setAgentPromptCopied(false);
        agentPromptResetRef.current = null;
      }, 2000);
    } catch (error) {
      globalThis.alert?.(
        error?.message ||
          T(
            "Unable to create audit bundle download key.",
            "Unable to create audit bundle download key."
          )
      );
    } finally {
      setAgentPromptLoading(false);
    }
  };

  const headerLabel = detailLoading
    ? T("Loading scan details", "正在加载扫描详情")
    : status === "done"
      ? batchMode
        ? T("Scan batch complete", "批量扫描完成")
        : T("Scan complete", "扫描完成")
      : status === "partial_completed"
        ? batchMode
          ? T("Scan batch partially completed", "Scan batch partially completed")
          : T("Scan partially completed", "Scan partially completed")
        : status === "failed"
          ? batchMode
            ? T("Scan batch failed", "批量扫描失败")
            : T("Scan failed", "扫描失败")
          : status === "lost"
            ? T("Scan lost", "Scan lost")
            : status === "cancelled"
              ? batchMode
                ? T("Scan batch cancelled", "批量扫描已取�?)
                : T("Scan cancelled", "扫描已取�?)
              : status === "no_repo"
                ? T("No repository selected", "未选择仓库")
                : batchMode
                  ? T("Scanning repositories", "正在扫描仓库")
                  : T("Scanning�?, "扫描进行�?);

  const headerIcon = detailLoading ? (
    <SkeletonLine className="sk-line sk-w-18 sk-h-18" />
  ) : ["done", "partial_completed"].includes(status) ? (
    <I.Check size={18} />
  ) : status === "failed" || status === "cancelled" || status === "lost" ? (
    <I.X size={18} />
  ) : (
    <span className="spin" style={{ display: "inline-block" }}>
      <I.Refresh size={18} />
    </span>
  );

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Scan", "扫描") }]}
        setIssue={setIssue}
        loading={detailLoading}
      />
      <div className="main" style={{ margin: "0 auto", maxWidth: "none" }}>
        <div className="scanning scanning-wide">
          <div className="scanning-card card">
            <div className="scanning-h">
              {headerIcon && <div className="scanning-icon">{headerIcon}</div>}
              <div className="scanning-copy">
                <div className="scanning-title">
                  {detailLoading
                    ? headerLabel
                    : status === "queued"
                      ? batchMode
                        ? T("Scan batch queued", "批量扫描排队�?)
                        : T("Scan queued", "Scan queued")
                      : headerLabel}{" "}
                  <b>
                    {batchMode
                      ? T(`${expectedBatchCount} repositories`, `${expectedBatchCount} 个仓库`)
                      : scan?.repo || repoFullName || "�?}
                  </b>
                </div>
                <div className="scanning-sub">
                  {batchMode ? (
                    <span className="tag">
                      {batchSummary.failedToCreate
                        ? T(
                            `${batchSummary.created}/${batchSummary.expected} scans created, ${batchSummary.failedToCreate} not created`,
                            `${batchSummary.created}/${batchSummary.expected} 个扫描已创建�?{batchSummary.failedToCreate} 个未创建`
                          )
                        : T(
                            `${batchSummary.created}/${batchSummary.expected} scans created`,
                            `${batchSummary.created}/${batchSummary.expected} 个扫描已创建`
                          )}
                    </span>
                  ) : (
                    <>
                      <span className="scanning-sub-label">{T("branch", "分支")}</span>
                      <span className="tag">{scan?.branch || branch}</span>
                      {scan?.commit && scan.commit !== "pending" && scan.commit !== "-" && (
                        <>
                          <span className="scanning-sub-sep" aria-hidden="true">
                            ·
                          </span>
                          <span className="scanning-sub-label">{T("commit", "commit")}</span>
                          <span className="tag">{scan.commit}</span>
                        </>
                      )}
                      {scan?.id && (
                        <>
                          <span className="scanning-sub-sep" aria-hidden="true">
                            ·
                          </span>
                          <span className="tag">{scan.id}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
                {!batchMode &&
                  (detailLoading || !scanProgress ? (
                    <ScanDetailProgressSkeleton />
                  ) : (
                    <ScanProgressBar
                      className="scanning-progress"
                      progress={scanProgress.progress}
                      label={scanProgress.label}
                      message={scanProgressMessage}
                      meta={scanProgressLogsSummary}
                      valueLabel={scanProgress.valueLabel}
                      ariaValueText={scanProgress.ariaValueText}
                      barOnly
                    />
                  ))}
              </div>
              <div className="scanning-actions">
                <button className="btn ghost" onClick={handleBack}>
                  <I.ArrowL size={13} /> {T("Back", "返回")}
                </button>
                {canCancel && (
                  <>
                    <span className="scanning-actions-sep" aria-hidden="true" />
                    <button className="btn ghost" disabled={canceling} onClick={handleCancel}>
                      <I.X size={13} /> {T("Cancel", "取消")}
                    </button>
                  </>
                )}
                {canRetry && (
                  <>
                    <span className="scanning-actions-sep" aria-hidden="true" />
                    <button className="btn ghost" disabled={retrying} onClick={handleRetry}>
                      <I.Refresh size={13} />{" "}
                      {retrying ? T("Retrying...", "正在重试...") : T("Retry", "重试")}
                    </button>
                  </>
                )}
                {terminal && (
                  <>
                    <span className="scanning-actions-sep" aria-hidden="true" />
                    {!batchMode && (
                      <button
                        className="btn ghost"
                        disabled={bundleLoading}
                        onClick={handleDownloadBundle}
                      >
                        <I.Download size={13} />{" "}
                        {bundleLoading
                          ? T("Preparing...", "准备�?..")
                          : T("Audit bundle", "审计�?)}
                      </button>
                    )}
                    {!batchMode && agentFixPrompt && (
                      <>
                        <span className="scanning-actions-sep" aria-hidden="true" />
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={handleCopyAgentFixPrompt}
                          disabled={agentPromptLoading}
                          aria-live="polite"
                        >
                          {agentPromptCopied ? <I.Check size={13} /> : <I.Copy size={13} />}{" "}
                          {agentPromptLoading
                            ? T("Preparing...", "Preparing...")
                            : agentPromptCopied
                              ? T("Copied", "Copied")
                              : T("Use agent to fix", "Use agent to fix")}
                        </button>
                      </>
                    )}
                    {!batchMode && <span className="scanning-actions-sep" aria-hidden="true" />}
                    <button className="btn primary" onClick={() => go("dashboard")}>
                      <I.Layout size={13} /> {T("Overview", "总览")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div
                className="auth-error"
                role="alert"
                style={{ margin: "0 0 12px", alignItems: "center" }}
              >
                <I.X size={13} />
                <span style={{ flex: 1 }}>{publicError}</span>
                {errorAction && (
                  <a className="btn sm" {...screenLinkProps(go, errorAction.screen)}>
                    {errorAction.label} <I.ArrowR size={11} />
                  </a>
                )}
              </div>
            )}

            {detailLoading ? (
              <ScanDetailSkeleton />
            ) : (
              <>
                {status === "queued" && queueSummary && (
                  <div className="scanning-queue">
                    {queueSummary.message && (
                      <div className="scanning-queue-message">{queueSummary.message}</div>
                    )}
                    <div className="scanning-queue-meta">
                      {queueSummary.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <ScanProgressFlow
                  steps={scanPhases}
                  currentPhase={currentPhase}
                  phaseIdx={phaseIdx}
                  terminal={terminal}
                  progressMessage={scanProgressMessage}
                  logsSummary={scanProgressLogsSummary}
                  errorMessage={scan?.error || publicError}
                />

                {reviewRun ? <ReviewRunSummary reviewRun={reviewRun} /> : null}
                {humanReport ? <HumanReviewReport report={humanReport} /> : null}
              </>
            )}
          </div>

          {detailLoading ? (
            <ScanDetailSideSkeleton />
          ) : (
            <div className="scanning-side">
              <div className="card scanning-counts">
                <div className="scanning-counts-h">{T("Live findings", "实时发现")}</div>
                <div className="scanning-counts-grid">
                  <div>
                    <b style={{ color: "var(--sev-critical)" }}>{found.critical || 0}</b>
                    <span>{T("Critical", "关键")}</span>
                  </div>
                  <div>
                    <b style={{ color: "var(--sev-high)" }}>{found.high || 0}</b>
                    <span>{T("High", "�?)}</span>
                  </div>
                  <div>
                    <b style={{ color: "var(--sev-medium)" }}>{found.medium || 0}</b>
                    <span>{T("Medium", "�?)}</span>
                  </div>
                  <div>
                    <b style={{ color: "var(--sev-low)" }}>{found.low || 0}</b>
                    <span>{T("Low", "�?)}</span>
                  </div>
                </div>
                <ScanAgentUsageSlot tags={aiUsageTags} />
              </div>

              {showPreflight && (
                <div className="card scanning-preflight">
                  <div className="scanning-counts-h">{T("Preflight evidence", "预检证据")}</div>
                  {preflight.summary && (
                    <div className="muted scan-preflight-summary">{preflight.summary}</div>
                  )}
                  <div className="scan-preflight-tags">
                    {preflight.execution && <span className="tag">{preflight.execution}</span>}
                    {preflight.mode && <span className="tag">{preflight.mode}</span>}
                    {preflight.packageManagers.map((item) => (
                      <span className="tag" key={`pm-${item}`}>
                        {item}
                      </span>
                    ))}
                    {preflight.languages.map((item) => (
                      <span className="tag" key={`lang-${item}`}>
                        {item}
                      </span>
                    ))}
                  </div>
                  {hasRepositoryLimitEvidence(preflight) && (
                    <div
                      className={
                        "scan-repository-limits" +
                        (preflight.repositoryLimitExceeded ? " exceeded" : "")
                      }
                    >
                      <div className="scan-repository-limits-head">
                        <I.Database size={13} />
                        <span>{T("Repository scan limits", "仓库扫描限制")}</span>
                      </div>
                      <div className="muted scan-preflight-summary">
                        {preflight.repositoryLimitExceeded
                          ? T(
                              "This checkout exceeded the worker limits, so Codex review was not run.",
                              "此仓�?checkout 超过 worker 限制，因此未运行验证器命令和 AI 审查�?
                            )
                          : T(
                              "This checkout was within the worker limits used for this scan.",
                              "此仓�?checkout 未超过本次扫描使用的 worker 限制�?
                            )}
                      </div>
                      <div className="scan-preflight-meta">
                        {preflight.repositoryStats && (
                          <span
                            className={preflight.repositoryLimitExceeded ? "preflight-warn" : ""}
                          >
                            {T(
                              `Checkout: ${formatCount(preflight.repositoryStats.fileCount)} files / ${formatBytes(preflight.repositoryStats.totalBytes)}`,
                              `检出规模：${formatCount(preflight.repositoryStats.fileCount)} 个文�?/ ${formatBytes(preflight.repositoryStats.totalBytes)}`
                            )}
                          </span>
                        )}
                        {preflight.repositoryLimits && (
                          <span>
                            {T(
                              `Limit: ${formatCount(preflight.repositoryLimits.maxFiles)} files / ${formatBytes(preflight.repositoryLimits.maxBytes)}`,
                              `限制�?{formatCount(preflight.repositoryLimits.maxFiles)} 个文�?/ ${formatBytes(preflight.repositoryLimits.maxBytes)}`
                            )}
                          </span>
                        )}
                        {preflight.repositoryLimitReasons?.length > 0 &&
                          (() => {
                            const reasons = uniqueStrings(
                              preflight.repositoryLimitReasons.map(repositoryLimitReasonLabel)
                            ).join(", ");
                            return (
                              <span className="preflight-warn">
                                {T(`Reasons: ${reasons}`, `命中限制�?{reasons}`)}
                              </span>
                            );
                          })()}
                        {preflight.repositoryStats?.scanStoppedEarly && (
                          <span className="preflight-warn">
                            {T(
                              "Counting stopped after a limit was reached.",
                              "达到限制后已停止继续计数�?
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="scan-preflight-meta">
                    <span>
                      {T(
                        `${preflight.manifestsCount || 0} manifests`,
                        `${preflight.manifestsCount || 0} 个清单`
                      )}
                    </span>
                    <span>
                      {T(
                        `${preflight.toolCount || 0} tool checks`,
                        `${preflight.toolCount || 0} 项工具检查`
                      )}
                    </span>
                    {preflight.environmentLabels.map((item) => (
                      <span key={`env-${item}`}>{item}</span>
                    ))}
                    {preflight.availableScripts.length > 0 && (
                      <span>{preflight.availableScripts.join(", ")}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="card scanning-log">
                <div className="scanning-counts-h">{T("Live log", "实时日志")}</div>
                <div className="scanning-log-body">
                  {liveLogLines.length === 0 ? (
                    <ScanLogSkeletonLines />
                  ) : (
                    liveLogLines.map((l, i) => (
                      <div key={i} className="scanning-log-line">
                        {l}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {batchMode && (
                <div className="card scanning-log">
                  <div className="scanning-counts-h">{T("Repository results", "仓库结果")}</div>
                  <div className="scanning-log-body">
                    {batchRows.length === 0 && (
                      <div className="muted">
                        {T("Creating scan requests�?, "正在创建扫描请求�?)}
                      </div>
                    )}
                    {batchRows.map((row) => (
                      <div
                        key={row.requestId || row.repo || row.scanId}
                        className="scanning-log-line"
                      >
                        <b>{row.repo || "�?}</b>
                        <span className="tag" style={{ marginLeft: 8 }}>
                          {row.status}
                        </span>
                        {row.scanId && (
                          <span className="tag" style={{ marginLeft: 8 }}>
                            {row.scanId}
                          </span>
                        )}
                        {row.error && <div className="muted">{row.error}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
