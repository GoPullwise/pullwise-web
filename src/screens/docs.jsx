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
    payload.subscription_plans,
    payload.agentConfigs,
    payload.agent_configs,
    payload.configs,
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
  const agentConfig = objectRecord(record.agentConfig)
    ? record.agentConfig
    : objectRecord(record.agent_config)
      ? record.agent_config
      : {};
  const agent = objectRecord(record.agent)
    ? record.agent
    : objectRecord(agentConfig.agent)
      ? agentConfig.agent
      : {};
  const config = objectRecord(record.config) ? record.config : {};
  const settings = objectRecord(record.settings) ? record.settings : {};
  const rawPlan = textValue(
    record.plan,
    agentConfig.plan,
    record.tier,
    record.key,
    record.id,
    record.slug,
    record.name
  );
  if (!rawPlan) return null;
  const plan = rawPlan.toLowerCase();

  return {
    plan,
    label: PLAN_LABELS[plan] || titleCase(rawPlan),
    agentCli: textValue(
      record.agentCli,
      record.agentCLI,
      record.agent_cli,
      record.cli,
      record.agentCliCommand,
      record.agent_cli_command,
      record.provider,
      record.providerName,
      record.provider_name,
      agent.agentCli,
      agent.agent_cli,
      agent.cli,
      agentConfig.agentCli,
      agentConfig.agent_cli,
      agentConfig.provider,
      agentConfig.cli,
      config.agentCli,
      config.agent_cli,
      config.cli,
      settings.agentCli,
      settings.agent_cli
    ),
    model: textValue(
      record.model,
      record.modelName,
      record.model_name,
      record.reviewModel,
      record.review_model,
      agentConfig.model,
      agentConfig.modelName,
      agentConfig.model_name,
      agent.model,
      agent.modelName,
      agent.model_name,
      config.model,
      config.modelName,
      config.model_name,
      settings.model
    ),
    reasoningEffort: textValue(
      record.reasoningEffort,
      record.reasoning_effort,
      record.effort,
      record.reasoning,
      agentConfig.reasoningEffort,
      agentConfig.reasoning_effort,
      agentConfig.effort,
      agent.reasoningEffort,
      agent.reasoning_effort,
      agent.effort,
      config.reasoningEffort,
      config.reasoning_effort,
      config.effort,
      settings.reasoningEffort,
      settings.reasoning_effort
    ),
  };
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

function isCanceled(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "CanceledError" ||
    error?.code === "ERR_CANCELED"
  );
}

function ConfigValue({ value }) {
  if (!value)
    return (
      <span className="docs-plan-missing">{T("Not provided by API", "Not provided by API")}</span>
    );
  return <code>{value}</code>;
}

export function DocsScreen({ go, auth }) {
  useLang();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const nav = [
    ["plans", T("Subscription plans", "Subscription plans")],
    ["contract", T("API contract", "API contract")],
  ];

  const loadPlans = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const payload = await pullwiseApi.docs.getSubscriptionPlanConfigs({ signal });
      if (signal?.aborted) return;
      setPlans(normalizePlanConfigs(payload));
    } catch (err) {
      if (isCanceled(err) || signal?.aborted) return;
      setPlans([]);
      setError(
        err?.message ||
          T(
            "Unable to load subscription plan configs.",
            "Unable to load subscription plan configs."
          )
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPlans(controller.signal);
    return () => controller.abort();
  }, [loadPlans]);

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
              "Subscription plan runtime configuration for Pullwise review agents. The values below are loaded from the server so the web docs stay aligned with backend policy.",
              "Subscription plan runtime configuration for Pullwise review agents. The values below are loaded from the server so the web docs stay aligned with backend policy."
            )}
          </p>

          <div className="docs-callout">
            <I.Shield size={16} />
            <div>
              <b>{T("Server-sourced configuration", "Server-sourced configuration")}</b>
              <p>
                {T(
                  "The UI only fixes the plan order and field labels. Agent CLI, model, and reasoning effort come from the docs configuration endpoint.",
                  "The UI only fixes the plan order and field labels. Agent CLI, model, and reasoning effort come from the docs configuration endpoint."
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
                {T("Loading subscription plan configs...", "Loading subscription plan configs...")}
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="docs-state error" role="alert">
              <I.X size={14} />
              <span>{error}</span>
              <button className="btn sm" type="button" onClick={() => loadPlans()}>
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
                </article>
              ))}
            </div>
          )}

          <h2 id="contract" className="docs-h2">
            {T("Configuration API", "Configuration API")}
          </h2>
          <p>
            {T(
              "The web client calls GET /docs/subscription-plans and reads each plan's agentConfig.agent.cli, model, and reasoningEffort fields. Flat agentCli, model, and reasoning_effort aliases are accepted for compatibility.",
              "The web client calls GET /docs/subscription-plans and reads each plan's agentConfig.agent.cli, model, and reasoningEffort fields. Flat agentCli, model, and reasoning_effort aliases are accepted for compatibility."
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
