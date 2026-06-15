import { useCallback, useEffect, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { PublicFooter, PublicHeader } from "./public-layout.jsx";

const PLAN_ORDER = ["free", "pro", "max"];
const PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  max: "Max",
};

function objectRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function textValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") continue;
    const text = String(value)
      .replaceAll("\x00", "")
      .split(/\r?\n|\r/, 1)[0]
      .trim();
    if (text) return text;
  }
  return "";
}

function titleCase(value) {
  return String(value || "")
    .replaceAll(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const PLAN_SERVER_GROUP_IDS = new Set([
  "plans",
  "planquotas",
  "subscriptionplans",
]);

const PUBLIC_SERVER_GROUP_IDS = new Set([
  ...PLAN_SERVER_GROUP_IDS,
  "scan",
  "scanlimits",
  "ratelimit",
  "billing",
  "billingcatalog",
]);

const SENSITIVE_CONFIG_FIELD_PATTERN =
  /secret|token|password|private\s*key|private_key|webhook|cookie|oauth|database|sqlite|worker|credential|internal\s*path|internal_path|local\s*path|local_path|filesystem/i;

const FALLBACK_SERVER_CONFIG_GROUPS = [
  {
    id: "plans",
    title: "Plan quotas",
    description: "Monthly scan quotas enforced by the server for each subscription plan.",
    fields: PLAN_ORDER.flatMap((plan) => [
      {
        path: `plans.${plan}.userReviewLimit`,
        candidates: [`plans.${plan}.userReviewLimit`],
        label: `${PLAN_LABELS[plan]} user monthly scans`,
        description: `Maximum scans one ${PLAN_LABELS[plan]} user can start in a billing cycle.`,
      },
      {
        path: `plans.${plan}.repositoryReviewLimit`,
        candidates: [`plans.${plan}.repositoryReviewLimit`],
        label: `${PLAN_LABELS[plan]} repository monthly scans`,
        description: `Maximum scans one repository can receive in a billing cycle for ${PLAN_LABELS[plan]} users.`,
      },
      {
        path: `plans.${plan}.maxRepoFiles`,
        candidates: [`plans.${plan}.maxRepoFiles`],
        label: `${PLAN_LABELS[plan]} repository file limit`,
        description: `Repository checkouts above this file count stop before verifier or AI review for ${PLAN_LABELS[plan]} users.`,
      },
      {
        path: `plans.${plan}.maxRepoBytes`,
        candidates: [`plans.${plan}.maxRepoBytes`],
        label: `${PLAN_LABELS[plan]} repository byte limit`,
        description: `Repository checkouts above this size stop before verifier or AI review for ${PLAN_LABELS[plan]} users.`,
      },
    ]),
  },
  {
    id: "scan",
    title: "Scan limits",
    description:
      "Queue limits visible to users when scans are accepted or rejected.",
    fields: [
      {
        path: "scan.maxRunningScansPerUser",
        candidates: ["scan.maxRunningScansPerUser"],
        label: "Concurrent scans per user",
        description: "Maximum scans one user can have running at the same time.",
      },
      {
        path: "scan.maxQueuedScansPerUser",
        candidates: ["scan.maxQueuedScansPerUser"],
        label: "Queued scans per user",
        description: "Maximum queued scans one user may hold before the server asks them to wait.",
      },
      {
        path: "scan.maxQueuedScansGlobal",
        candidates: ["scan.maxQueuedScansGlobal"],
        label: "Global queued scans",
        description: "Maximum queued scans across the service.",
      },
    ],
  },
  {
    id: "rateLimit",
    title: "API rate limit",
    description: "Request rate limiting applied by the server to browser and API-key traffic.",
    fields: [
      {
        path: "rateLimit.enabled",
        candidates: ["rateLimit.enabled"],
        label: "Rate limiting enabled",
        description: "Whether non-exempt user/API requests are rate limited.",
      },
      {
        path: "rateLimit.requests",
        candidates: ["rateLimit.requests"],
        label: "Requests per window",
        description: "Allowed requests per subject in one rate-limit window.",
      },
      {
        path: "rateLimit.windowSeconds",
        candidates: ["rateLimit.windowSeconds"],
        label: "Rate-limit window",
        description: "Rate-limit accounting window in seconds.",
      },
    ],
  },
  {
    id: "billing",
    title: "Billing catalog",
    description:
      "Non-secret billing catalog status. API keys and webhook secrets are not displayed.",
    fields: [
      {
        path: "billing.creemProProductCount",
        candidates: ["billing.creemProProductCount"],
        label: "Creem Pro products",
        description: "Number of Creem product IDs configured to grant Pro access.",
      },
      {
        path: "billing.creemMaxProductCount",
        candidates: ["billing.creemMaxProductCount"],
        label: "Creem Max products",
        description: "Number of Creem product IDs configured to grant Max access.",
      },
      {
        path: "billing.creemTestMode",
        candidates: ["billing.creemTestMode"],
        label: "Creem test mode",
        description:
          "Whether the server uses Creem's test API host when no custom base URL is configured.",
      },
    ],
  },
];

function recordsFromMap(value) {
  if (!objectRecord(value)) return [];
  return Object.entries(value)
    .filter(([, record]) => objectRecord(record))
    .map(([plan, record]) => ({ plan, ...record }));
}

function recordsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!objectRecord(payload)) return [];

  const containers = [
    payload.plans,
    payload.subscriptionPlans,
    payload.items,
  ];

  for (const container of containers) {
    if (Array.isArray(container)) return container;
    const mapped = recordsFromMap(container);
    if (mapped.length) return mapped;
  }

  if (objectRecord(payload.data)) {
    const nested = recordsFromPayload(payload.data);
    if (nested.length) return nested;
  }

  return recordsFromMap(payload);
}

function normalizePlanConfig(record = {}) {
  if (!objectRecord(record)) return null;
  const agentConfig = objectRecord(record.agentConfig) ? record.agentConfig : {};
  const rawPlan = textValue(
    record.plan,
    agentConfig.plan,
    record.id,
    record.name
  );
  if (!rawPlan) return null;
  const plan = rawPlan.toLowerCase();
  const providerChain = Array.isArray(agentConfig.providerChain) ? agentConfig.providerChain : [];
  const provider = textValue(providerChain[0]).toLowerCase();
  const providerConfig = objectRecord(agentConfig[provider]) ? agentConfig[provider] : {};
  const agentCli = provider === "codex" ? provider : "";

  return {
    plan,
    label: PLAN_LABELS[plan] || titleCase(rawPlan),
    reviewLimit: valueFromPlanRecord(record, "reviewLimit", "userReviewLimit"),
    repositoryReviewLimit: valueFromPlanRecord(record, "repositoryReviewLimit"),
    repositoryLimits: normalizeRepositoryLimits(record.repositoryLimits) || normalizeRepositoryLimits(record),
    agentCli,
    model: textValue(providerConfig.model),
    reasoningEffort: textValue(providerConfig.reasoningEffort),
  };
}

function valueFromPlanRecord(record, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
}

function hasConfigValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function limitNumber(value) {
  const number = numericValue(value);
  if (number === null) return null;
  return Math.max(0, Math.trunc(number));
}

function normalizeRepositoryLimits(value) {
  if (!objectRecord(value)) return null;
  const maxFiles = limitNumber(
    value.maxFiles ?? value.max_files ?? value.maxRepoFiles ?? value.max_repo_files ?? value.fileLimit
  );
  const maxBytes = limitNumber(
    value.maxBytes ?? value.max_bytes ?? value.maxRepoBytes ?? value.max_repo_bytes ?? value.byteLimit
  );
  return maxFiles || maxBytes ? { maxFiles, maxBytes } : null;
}

function planSortIndex(plan) {
  const index = PLAN_ORDER.indexOf(plan);
  return index === -1 ? PLAN_ORDER.length : index;
}

function normalizePlanConfigs(payload) {
  return recordsFromPayload(payload)
    .map(normalizePlanConfig)
    .filter(Boolean)
    .sort((left, right) => {
      const leftIndex = planSortIndex(left.plan);
      const rightIndex = planSortIndex(right.plan);
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return left.label.localeCompare(right.label);
    });
}

function mergeRepositoryLimits(baseLimits, overrideLimits) {
  const maxFiles = hasConfigValue(overrideLimits?.maxFiles)
    ? overrideLimits.maxFiles
    : baseLimits?.maxFiles;
  const maxBytes = hasConfigValue(overrideLimits?.maxBytes)
    ? overrideLimits.maxBytes
    : baseLimits?.maxBytes;
  return hasConfigValue(maxFiles) || hasConfigValue(maxBytes) ? { maxFiles, maxBytes } : null;
}

function mergePlanConfig(base, override) {
  const plan = override.plan || base.plan;
  return {
    plan,
    label: base.label || override.label || PLAN_LABELS[plan] || titleCase(plan),
    reviewLimit: hasConfigValue(override.reviewLimit) ? override.reviewLimit : base.reviewLimit,
    repositoryReviewLimit: hasConfigValue(override.repositoryReviewLimit)
      ? override.repositoryReviewLimit
      : base.repositoryReviewLimit,
    repositoryLimits: mergeRepositoryLimits(base.repositoryLimits, override.repositoryLimits),
    agentCli: hasConfigValue(base.agentCli) ? base.agentCli : override.agentCli,
    model: hasConfigValue(base.model) ? base.model : override.model,
    reasoningEffort: hasConfigValue(base.reasoningEffort)
      ? base.reasoningEffort
      : override.reasoningEffort,
  };
}

function mergePlanConfigs(basePlans, overridePlans) {
  const plansById = new Map();
  for (const plan of basePlans) plansById.set(plan.plan, plan);
  for (const override of overridePlans) {
    const base = plansById.get(override.plan) || { plan: override.plan };
    plansById.set(override.plan, mergePlanConfig(base, override));
  }
  return [...plansById.values()].sort((left, right) => {
    const leftIndex = planSortIndex(left.plan);
    const rightIndex = planSortIndex(right.plan);
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.label.localeCompare(right.label);
  });
}

function normalizeGroupId(value) {
  return textValue(value)
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, "");
}

function cleanDisplayText(value, maxLength = 180) {
  const text = textValue(value);
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function nestedGet(source, path) {
  if (!objectRecord(source) || !path) return { found: false, value: undefined };
  const parts = String(path).split(".").filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (!objectRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

function valueFromField(field, settings) {
  const valueKeys = ["value", "current", "setting", "configValue", "config_value", "count"];
  for (const key of valueKeys) {
    if (Object.prototype.hasOwnProperty.call(field, key)) return field[key];
  }
  const path = textValue(field.path, field.key, field.id);
  const found = nestedGet(settings, path);
  return found.found ? found.value : undefined;
}

function fieldRecordsFromMap(value) {
  if (!objectRecord(value)) return [];
  return Object.entries(value).map(([path, field]) =>
    objectRecord(field) ? { path, ...field } : { path, value: field }
  );
}

function fieldsFromServerGroup(group) {
  if (!objectRecord(group)) return [];
  const containers = [group.fields, group.items, group.settings, group.values];
  for (const container of containers) {
    if (Array.isArray(container)) return container;
    const mapped = fieldRecordsFromMap(container);
    if (mapped.length) return mapped;
  }
  return [];
}

function serverConfigPathKey(path) {
  return textValue(path).toLowerCase().replaceAll(/[-_]/g, "");
}

function isPlanServerConfigField(field) {
  const path = textValue(field.path, field.key, field.id, field.name);
  const pathKey = serverConfigPathKey(path);
  return /^plans\.[^.]+\.(userreviewlimit|repositoryreviewlimit|reviewlimit|maxrepofiles|maxrepobytes)$/.test(
    pathKey
  );
}

function isAllowedServerConfigField(field, group, options = {}) {
  const groupId = normalizeGroupId(group.id || group.key || group.title || group.name);
  if (
    options.omitPlanConfigFields &&
    (PLAN_SERVER_GROUP_IDS.has(groupId) || isPlanServerConfigField(field))
  ) {
    return false;
  }
  if (!PUBLIC_SERVER_GROUP_IDS.has(groupId)) return false;

  const path = textValue(field.path, field.key, field.id, field.name);
  const label = textValue(field.label, field.title, field.name);
  const fieldText = `${path} ${label}`;
  if (!fieldText.trim() || SENSITIVE_CONFIG_FIELD_PATTERN.test(fieldText)) return false;

  const pathKey = serverConfigPathKey(path);
  if (/^plans\.[^.]+\.(userreviewlimit|repositoryreviewlimit|reviewlimit|maxrepofiles|maxrepobytes)$/.test(pathKey)) {
    return true;
  }

  if (
    [
      "scan.maxrunningscansperuser",
      "scan.maxqueuedscansglobal",
      "scan.maxqueuedscansperuser",
      "ratelimit.enabled",
      "ratelimit.requests",
      "ratelimit.windowseconds",
      "billing.creemproproductcount",
      "billing.creemmaxproductcount",
      "billing.creemproproductids",
      "billing.creemmaxproductids",
      "billing.catalogconfigured",
      "billing.productcount",
      "billing.creemtestmode",
    ].includes(pathKey)
  ) {
    return true;
  }

  if (pathKey) return false;

  const labelKey = label.toLowerCase();
  if (groupId === "plans" || groupId === "planquotas" || groupId === "subscriptionplans") {
    return /quota|monthly scans|review limit|repository|repo|checkout|file limit|byte limit/.test(labelKey);
  }
  if (groupId === "scan" || groupId === "scanlimits") {
    return /queue|queued|running|repository|repo|limit/.test(labelKey);
  }
  if (groupId === "ratelimit") {
    return /rate|requests|window|enabled/.test(labelKey);
  }
  if (groupId === "billing" || groupId === "billingcatalog") {
    return /catalog|product|configured|test mode/.test(labelKey);
  }
  return false;
}

function normalizeServerField(field, group, settings, options = {}) {
  if (!objectRecord(field) || !isAllowedServerConfigField(field, group, options)) return null;
  const path = cleanDisplayText(field.path ?? field.key ?? field.id);
  const label = cleanDisplayText(field.label ?? field.title ?? field.name ?? titleCase(path));
  const description = cleanDisplayText(field.description ?? field.help ?? field.summary, 260);
  return {
    path,
    label: label || titleCase(path),
    description,
    value: valueFromField(field, settings),
  };
}

function normalizeServerGroupsFromPayload(payload, options = {}) {
  if (!objectRecord(payload)) return [];
  const settings = objectRecord(payload.settings) ? payload.settings : {};
  const groups = Array.isArray(payload.groups)
    ? payload.groups
    : Array.isArray(payload.items)
      ? payload.items
      : [];

  return groups
    .map((group) => {
      if (!objectRecord(group)) return null;
      const id = cleanDisplayText(group.id ?? group.key ?? group.title ?? group.name);
      const normalizedId = normalizeGroupId(id);
      if (!PUBLIC_SERVER_GROUP_IDS.has(normalizedId)) return null;
      const fields = fieldsFromServerGroup(group)
        .map((field) => normalizeServerField(field, group, settings, options))
        .filter(Boolean);
      if (!fields.length) return null;
      return {
        id: id || normalizedId,
        title: cleanDisplayText(group.title ?? group.label ?? titleCase(id)),
        description: cleanDisplayText(group.description ?? group.summary, 280),
        fields,
      };
    })
    .filter(Boolean);
}

function configRoots(payload) {
  if (!objectRecord(payload)) return [];
  return [payload.settings, payload.config, payload.data, payload].filter(objectRecord);
}

function valueFromCandidates(payload, candidates) {
  for (const root of configRoots(payload)) {
    for (const path of candidates) {
      const found = nestedGet(root, path);
      if (found.found) return { found: true, value: found.value };
    }
  }
  return { found: false, value: undefined };
}

function planConfigFieldFromPath(path) {
  const parts = textValue(path).split(".").filter(Boolean);
  if (parts.length < 3 || normalizeGroupId(parts[0]) !== "plans") return null;
  const plan = textValue(parts[1]).toLowerCase();
  if (!plan) return null;
  const fieldKey = parts.slice(2).map(serverConfigPathKey).join(".");
  if (fieldKey === "userreviewlimit" || fieldKey === "reviewlimit") {
    return { plan, field: "reviewLimit" };
  }
  if (fieldKey === "repositoryreviewlimit") {
    return { plan, field: "repositoryReviewLimit" };
  }
  if (fieldKey === "maxrepofiles" || fieldKey === "repositorylimits.maxfiles") {
    return { plan, field: "maxFiles" };
  }
  if (fieldKey === "maxrepobytes" || fieldKey === "repositorylimits.maxbytes") {
    return { plan, field: "maxBytes" };
  }
  return null;
}

function planRecordFor(records, plan) {
  if (!records.has(plan)) records.set(plan, { plan });
  return records.get(plan);
}

function applyPlanConfigField(record, field, value) {
  if (!hasConfigValue(value)) return;
  if (field === "reviewLimit" || field === "repositoryReviewLimit") {
    record[field] = value;
    return;
  }
  record.repositoryLimits = objectRecord(record.repositoryLimits) ? record.repositoryLimits : {};
  if (field === "maxFiles") record.repositoryLimits.maxFiles = value;
  if (field === "maxBytes") record.repositoryLimits.maxBytes = value;
}

function collectPlanRecordsFromSettings(payload, records) {
  for (const root of configRoots(payload)) {
    const plans = root.plans;
    if (!objectRecord(plans)) continue;
    for (const [plan, settings] of Object.entries(plans)) {
      if (!objectRecord(settings)) continue;
      const record = planRecordFor(records, String(plan).toLowerCase());
      applyPlanConfigField(record, "reviewLimit", settings.reviewLimit ?? settings.userReviewLimit);
      applyPlanConfigField(record, "repositoryReviewLimit", settings.repositoryReviewLimit);
      const repositoryLimits =
        normalizeRepositoryLimits(settings.repositoryLimits) || normalizeRepositoryLimits(settings);
      if (repositoryLimits) {
        applyPlanConfigField(record, "maxFiles", repositoryLimits.maxFiles);
        applyPlanConfigField(record, "maxBytes", repositoryLimits.maxBytes);
      }
    }
  }
}

function collectPlanRecordsFromGroups(payload, records) {
  const settings = objectRecord(payload.settings) ? payload.settings : {};
  const groups = Array.isArray(payload.groups)
    ? payload.groups
    : Array.isArray(payload.items)
      ? payload.items
      : [];
  for (const group of groups) {
    for (const field of fieldsFromServerGroup(group)) {
      if (!objectRecord(field)) continue;
      const parsed = planConfigFieldFromPath(field.path ?? field.key ?? field.id ?? field.name);
      if (!parsed) continue;
      applyPlanConfigField(
        planRecordFor(records, parsed.plan),
        parsed.field,
        valueFromField(field, settings)
      );
    }
  }
}

function planConfigsFromServerConfig(payload) {
  if (!objectRecord(payload)) return [];
  const records = new Map();
  collectPlanRecordsFromSettings(payload, records);
  collectPlanRecordsFromGroups(payload, records);
  return normalizePlanConfigs([...records.values()]);
}

function normalizeServerGroupsFromSettings(payload, options = {}) {
  return FALLBACK_SERVER_CONFIG_GROUPS.map((group) => {
    const fields = group.fields
      .map((field) => {
        if (
          options.omitPlanConfigFields &&
          (PLAN_SERVER_GROUP_IDS.has(normalizeGroupId(group.id)) || isPlanServerConfigField(field))
        ) {
          return null;
        }
        const found = valueFromCandidates(payload, field.candidates);
        if (!found.found) return null;
        return {
          path: field.path,
          label: field.label,
          description: field.description,
          value: found.value,
        };
      })
      .filter(Boolean);
    return fields.length ? { ...group, fields } : null;
  }).filter(Boolean);
}

function normalizeServerConfig(payload, options = {}) {
  const groups = normalizeServerGroupsFromPayload(payload, options);
  return groups.length ? groups : normalizeServerGroupsFromSettings(payload, options);
}

function numericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

function plural(count, singular) {
  return `${count.toLocaleString("en-US")} ${singular}${count === 1 ? "" : "s"}`;
}

function countConfigured(value) {
  if (Array.isArray(value)) return value.filter((item) => textValue(item)).length;
  const numeric = numericValue(value);
  if (numeric !== null) return Math.max(0, numeric);
  if (objectRecord(value)) {
    return Object.values(value).filter((item) => item !== undefined && item !== null && item !== "")
      .length;
  }
  const text = textValue(value);
  if (!text) return 0;
  return text.split(",").filter((item) => item.trim()).length;
}

function formatBytes(value) {
  const bytes = numericValue(value);
  if (bytes === null) return cleanDisplayText(value);
  if (bytes < 1024) return plural(bytes, "byte");
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let amount = bytes;
  let unit = "";
  for (const nextUnit of units) {
    amount /= 1024;
    unit = nextUnit;
    if (amount < 1024) break;
  }
  return `${bytes.toLocaleString("en-US")} bytes (${amount.toFixed(amount >= 10 ? 0 : 1)} ${unit})`;
}

function formatRepositoryLimits(limits) {
  if (!limits) return "";
  const parts = [];
  if (limits.maxFiles) parts.push(`${limits.maxFiles.toLocaleString("en-US")} files`);
  if (limits.maxBytes) parts.push(formatBytes(limits.maxBytes));
  return parts.join(" / ");
}

function formatServerConfigValue(field) {
  const pathKey = serverConfigPathKey(field.path);
  const value = field.value;
  if (value === undefined || value === null || value === "") return "";

  if (/product(ids|count)$|catalogconfigured|productcount/.test(pathKey)) {
    if (/configured$/.test(pathKey) && typeof value === "boolean") {
      return value ? "Configured" : "Not configured";
    }
    const count = countConfigured(value);
    return `${plural(count, "product")} configured`;
  }

  if (typeof value === "boolean") {
    if (pathKey.includes("testmode")) return value ? "On" : "Off";
    return value ? "Enabled" : "Disabled";
  }

  if (pathKey.includes("bytes")) return formatBytes(value);

  const numeric = numericValue(value);
  if (numeric !== null) {
    if (pathKey.includes("seconds")) return `${numeric.toLocaleString("en-US")} seconds`;
    return numeric.toLocaleString("en-US");
  }

  if (objectRecord(value)) return Object.keys(value).length ? "Configured" : "Not configured";
  if (Array.isArray(value)) return `${plural(countConfigured(value), "item")} configured`;

  return cleanDisplayText(value);
}

function isCanceled(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED"
  );
}

function ConfigValue({ value }) {
  if (!hasConfigValue(value))
    return (
      <span className="docs-plan-missing">{T("Not provided by API", "Not provided by API")}</span>
    );
  return <code>{value}</code>;
}

function ServerConfigValue({ field }) {
  const value = formatServerConfigValue(field);
  if (!value) {
    return (
      <span className="docs-plan-missing">{T("Not provided by API", "Not provided by API")}</span>
    );
  }
  return <code>{value}</code>;
}

export function DocsScreen({ go, auth }) {
  useLang();
  const [plans, setPlans] = useState([]);
  const [serverGroups, setServerGroups] = useState([]);
  const [serverConfigError, setServerConfigError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nav = [
    ["plans", T("Subscription plans", "Subscription plans")],
    ["server-config", T("Server config", "Server config")],
    ["contract", T("API contract", "API contract")],
  ];

  const loadDocs = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    setServerConfigError("");
    try {
      const [plansResult, serverConfigResult] = await Promise.allSettled([
        pullwiseApi.docs.getSubscriptionPlanConfigs({ signal }),
        typeof pullwiseApi.docs.getServerConfig === "function"
          ? pullwiseApi.docs.getServerConfig({ signal })
          : Promise.reject(new Error("Server config docs endpoint is not available.")),
      ]);
      if (signal?.aborted) return;

      const serverConfigPayload =
        serverConfigResult.status === "fulfilled" ? serverConfigResult.value : null;
      const serverPlanConfigs = planConfigsFromServerConfig(serverConfigPayload);
      let normalizedPlans = [];
      if (plansResult.status === "fulfilled") {
        normalizedPlans = mergePlanConfigs(normalizePlanConfigs(plansResult.value), serverPlanConfigs);
        setPlans(normalizedPlans);
      } else if (isCanceled(plansResult.reason)) {
        return;
      } else {
        setPlans([]);
        setError(
          plansResult.reason?.message ||
            T(
              "Unable to load subscription plan configs.",
              "Unable to load subscription plan configs."
            )
        );
      }

      if (serverConfigResult.status === "fulfilled") {
        setServerGroups(
          normalizeServerConfig(serverConfigPayload, {
            omitPlanConfigFields: true,
          })
        );
      } else if (isCanceled(serverConfigResult.reason)) {
        return;
      } else {
        setServerGroups([]);
        setServerConfigError(
          T(
            "Server configuration docs are not available from this backend yet.",
            "Server configuration docs are not available from this backend yet."
          )
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDocs(controller.signal);
    return () => controller.abort();
  }, [loadDocs]);

  return (
    <div className="landing fade-in">
      <PublicHeader go={go} current="docs" auth={auth} />
      <div className="docs-shell">
        <aside className="docs-side">
          <div className="docs-side-g">
            <div className="docs-side-h">Docs</div>
            {nav.map(([id, label]) => (
              <a key={id} className="docs-side-i" href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>
        </aside>

        <main className="docs-main">
          <div className="docs-crumbs">
            <a className="auth-link" {...screenLinkProps(go, "landing")}>
              Pullwise
            </a>
            <span className="sep">/</span>
            <span className="now">Docs</span>
          </div>
          <h1 id="plans" className="docs-h1">
            Pullwise Docs
          </h1>
          <p className="docs-lede">
            {T(
              "Runtime configuration for Pullwise review agents and public server limits. The values below are loaded from the server so the web docs stay aligned with backend policy.",
              "Runtime configuration for Pullwise review agents and public server limits. The values below are loaded from the server so the web docs stay aligned with backend policy."
            )}
          </p>

          <div className="docs-callout">
            <I.Shield size={16} />
            <div>
              <b>{T("Server-sourced configuration", "Server-sourced configuration")}</b>
              <p>
                {T(
                  "Agent CLI, model, reasoning effort, plan quotas, scan limits, rate limits, and billing catalog status come from public docs endpoints. Secrets, host paths, and worker-private settings are not rendered.",
                  "Agent CLI, model, reasoning effort, plan quotas, scan limits, rate limits, and billing catalog status come from public docs endpoints. Secrets, host paths, and worker-private settings are not rendered."
                )}
              </p>
            </div>
          </div>

          {loading && (
            <div className="docs-state" role="status" aria-live="polite">
              <span className="spin" style={{ display: "inline-block" }}>
                <I.Refresh size={14} />
              </span>
              <span>
                {T(
                  "Loading subscription plan configs and server settings...",
                  "Loading subscription plan configs and server settings..."
                )}
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="docs-state error" role="alert">
              <I.X size={14} />
              <span>{error}</span>
              <button className="btn sm" type="button" onClick={() => loadDocs()}>
                <I.Refresh size={13} /> {T("Retry", "Retry")}
              </button>
            </div>
          )}

          {!loading && !error && plans.length === 0 && (
            <div className="docs-state" role="status">
              <I.FileCode size={14} />
              <span>
                {T(
                  "No subscription plan configs were returned by the API.",
                  "No subscription plan configs were returned by the API."
                )}
              </span>
            </div>
          )}

          {!loading && !error && plans.length > 0 && (
            <div
              className="docs-plan-grid"
              aria-label={T("Subscription plan configs", "Subscription plan configs")}
            >
              {plans.map((plan) => (
                <article key={plan.plan} className="docs-plan-card">
                  <div className="docs-plan-card-h">
                    <span className="docs-plan-name">{plan.label}</span>
                    <span className="docs-plan-key">{plan.plan}</span>
                  </div>
                  <div className="docs-plan-kv">
                    <b>{T("Agent CLI", "Agent CLI")}</b>
                    <ConfigValue value={plan.agentCli} />
                  </div>
                  <div className="docs-plan-kv">
                    <b>{T("Model", "Model")}</b>
                    <ConfigValue value={plan.model} />
                  </div>
                  <div className="docs-plan-kv">
                    <b>{T("Reasoning effort", "Reasoning effort")}</b>
                    <ConfigValue value={plan.reasoningEffort} />
                  </div>
                  <div className="docs-plan-kv">
                    <b>{T("Monthly account scans", "Monthly account scans")}</b>
                    <ConfigValue
                      value={formatServerConfigValue({
                        path: "plans.reviewLimit",
                        value: plan.reviewLimit,
                      })}
                    />
                  </div>
                  <div className="docs-plan-kv">
                    <b>{T("Monthly repository scans", "Monthly repository scans")}</b>
                    <ConfigValue
                      value={formatServerConfigValue({
                        path: "plans.repositoryReviewLimit",
                        value: plan.repositoryReviewLimit,
                      })}
                    />
                  </div>
                  <div className="docs-plan-kv">
                    <b>{T("Repository checkout", "Repository checkout")}</b>
                    <ConfigValue value={formatRepositoryLimits(plan.repositoryLimits)} />
                  </div>
                </article>
              ))}
            </div>
          )}

          <h2 id="server-config" className="docs-h2">
            {T("Public server configuration", "Public server configuration")}
          </h2>
          <p>
            {T(
              "These settings describe additional customer-visible policy enforced by the backend: scan queue limits, API rate limiting, and billing catalog readiness.",
              "These settings describe additional customer-visible policy enforced by the backend: scan queue limits, API rate limiting, and billing catalog readiness."
            )}
          </p>

          {!loading && serverConfigError && (
            <div className="docs-state docs-state-soft">
              <I.FileCode size={14} />
              <span>{serverConfigError}</span>
            </div>
          )}

          {!loading && serverGroups.length > 0 && (
            <div
              className="docs-config-grid"
              aria-label={T("Public server configuration", "Public server configuration")}
            >
              {serverGroups.map((group) => (
                <article key={group.id} className="docs-config-group">
                  <div className="docs-config-group-h">
                    <div>
                      <h3>{group.title}</h3>
                      {group.description && <p>{group.description}</p>}
                    </div>
                  </div>
                  <div className="docs-config-list">
                    {group.fields.map((field) => (
                      <div key={field.path || field.label} className="docs-config-row">
                        <div className="docs-config-copy">
                          <b>{field.label}</b>
                          {field.path && <code className="docs-config-path">{field.path}</code>}
                          {field.description && <p>{field.description}</p>}
                        </div>
                        <div className="docs-config-value">
                          <ServerConfigValue field={field} />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          <h2 id="contract" className="docs-h2">
            {T("Configuration API", "Configuration API")}
          </h2>
          <p>
            {T(
              "The web client calls GET /docs/subscription-plans for plan agent configs and quotas, and GET /docs/server-config for additional public server limits. The server-config endpoint may return groups with fields or a settings object; missing fields or an unavailable endpoint are treated as unavailable docs, not as a page failure.",
              "The web client calls GET /docs/subscription-plans for plan agent configs and quotas, and GET /docs/server-config for additional public server limits. The server-config endpoint may return groups with fields or a settings object; missing fields or an unavailable endpoint are treated as unavailable docs, not as a page failure."
            )}
          </p>

          <div className="docs-foot">
            <span className="muted">
              {T(
                "These docs reflect runtime configuration served by the Pullwise backend.",
                "These docs reflect runtime configuration served by the Pullwise backend."
              )}
            </span>
            <div className="docs-foot-actions">
              <a className="btn" {...screenLinkProps(go, "api")}>
                <I.FileCode size={14} /> API
              </a>
              <a className="btn primary" {...screenLinkProps(go, "pricing")}>
                {T("Pricing", "Pricing")}
              </a>
            </div>
          </div>
        </main>
      </div>
      <PublicFooter go={go} current="docs" />
    </div>
  );
}
