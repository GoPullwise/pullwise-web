import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { env } from "../config/env.js";
import { T, useLang } from "../i18n.jsx";
import { I } from "../icons.jsx";
import { connectGitHubRepositories } from "../lib/auth.js";
import { Topbar, Sidebar } from "../shell.jsx";
import "./ledger.css";

const emptyExpense = () => ({
  occurredOn: "",
  amount: "",
  currency: "USD",
  categoryId: "",
  purpose: "",
  note: "",
  quantity: "",
  unit: "",
});

function errorText(error) {
  const code = error?.payload?.error?.code;
  const allowanceErrors = {
    PROJECT_LIMIT: T(
      "Project allowance reached. Existing history remains available.",
      "项目额度已用完，已有历史仍可访问。"
    ),
    RECORD_LIMIT: T(
      "Expense record allowance reached. Existing records remain available.",
      "支出记录额度已用完，已有记录仍可访问。"
    ),
    WRITE_RATE_LIMIT: T(
      "Too many changes in a short time. Wait a minute before trying again.",
      "短时间内操作过多，请等一分钟再试。"
    ),
    MONTHLY_WRITE_LIMIT: T("Monthly write allowance reached.", "本月写入额度已用完。"),
    JEV_BUDGET_LIMIT: T(
      "Monthly Jev budget reached. Continue manually.",
      "本月 Jev 预算已用完，请继续手工记账。"
    ),
    MAX_REQUIRED: T("Jev suggestions require Max.", "Jev 建议仅向 Max 开放。"),
  };
  if (allowanceErrors[code]) return allowanceErrors[code];
  if (error?.status === 412) return T("Save conflict. Reload the latest record before retrying.");
  if (error?.status === 403)
    return T("Access changed. Review the current project and key permissions.");
  return error?.payload?.error?.code || error?.message || T("Request failed. Please retry.");
}

function requestKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function formatTotal({ currency, amountMinor }) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || typeof currency !== "string")
    return T("Unavailable");
  let exponent = 2;
  try {
    exponent = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
  } catch {
    /* Keep a readable fallback for an older browser currency table. */
  }
  const scale = 10n ** BigInt(exponent);
  const minor = BigInt(amountMinor);
  const whole = (minor / scale).toLocaleString("en");
  const fraction = exponent ? `.${(minor % scale).toString().padStart(exponent, "0")}` : "";
  return `${currency} ${whole}${fraction}`;
}

function LedgerFilters({ filters, onChange, categories = [] }) {
  const update = (name, value) => onChange((old) => ({ ...old, [name]: value }));
  return (
    <div className="ledger-filters">
      <label>
        {T("From date")}
        <input
          type="date"
          value={filters.from}
          onChange={(event) => update("from", event.target.value)}
        />
      </label>
      <label>
        {T("Before date", "截止日期（不含当天）")}
        <input
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => update("to", event.target.value)}
        />
      </label>
      <label>
        {T("Filter category")}
        <select
          value={filters.categoryId}
          onChange={(event) => update("categoryId", event.target.value)}
        >
          <option value="">{T("All categories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ReportGroups({ title, groups, categories = [], dimension }) {
  const rows = groups || [];
  const largest = Math.max(1, ...rows.map((row) => row.amountMinor || 0));
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p>{T("No expenses in this range.")}</p>
      ) : (
        <div className="ledger-chart">
          {rows.map((row) => (
            <div
              className="ledger-chart-row"
              key={`${row.target}:${row.projectId}:${row.categoryId}:${row.bucket}:${row.currency}`}
            >
              <span>
                {dimension === "bucket"
                  ? row.bucket
                  : categories.find((category) => category.id === row.categoryId)?.name ||
                    T("Archived category")}{" "}
                · {row.currency}
              </span>
              <span className="ledger-chart-track">
                <span style={{ width: `${Math.max(1, (row.amountMinor / largest) * 100)}%` }} />
              </span>
              <strong>{formatTotal(row)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ExpenseForm({ value, categories, projects, target, busy, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() =>
    value
      ? {
          occurredOn: value.occurredOn,
          amount: value.amount,
          currency: value.currency,
          categoryId: value.categoryId,
          purpose: value.purpose,
          note: value.note || "",
          quantity: value.quantity || "",
          unit: value.unit || "",
        }
      : emptyExpense()
  );
  const [validation, setValidation] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(value?.target || target);
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [duplicateReviewed, setDuplicateReviewed] = useState(false);
  const createKey = useRef(requestKey());
  const suggestionController = useRef(null);
  useEffect(() => () => suggestionController.current?.abort(), []);
  const update = (name, next) => {
    suggestionController.current?.abort();
    suggestionController.current = null;
    setSuggesting(false);
    createKey.current = requestKey();
    setSuggestion(null);
    setSuggestionError("");
    setDuplicateReviewed(false);
    setDraft((old) => ({ ...old, [name]: next }));
  };
  const requestSuggestion = async () => {
    if (suggestionController.current) return;
    const controller = new AbortController();
    suggestionController.current = controller;
    setSuggesting(true);
    setSuggestionError("");
    setSuggestion(null);
    try {
      // Check only after an explicit user click, without a refresh/poll loop.
      const profile = await ledgerApi.me({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (profile?.entitlements?.jev?.eligible !== true) {
        setSuggestionError(T("Jev suggestions require Max.", "Jev 建议仅向 Max 开放。"));
        return;
      }
      if (profile.entitlements.jev.available !== true) {
        setSuggestionError(T("Suggestion unavailable. Continue manually."));
        return;
      }
      const result = await ledgerApi.suggestExpense(
        {
          purpose: draft.purpose.trim(),
          note: draft.note,
          target: selectedTarget,
          occurredOn: draft.occurredOn || undefined,
          amount: draft.amount || undefined,
          currency: draft.currency?.toUpperCase() || undefined,
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (result?.status === "available" || result?.status === "uncertain") {
        setSuggestion(result);
        setDuplicateReviewed(false);
      } else setSuggestionError(T("Suggestion unavailable. Continue manually."));
    } catch {
      if (!controller.signal.aborted)
        setSuggestionError(T("Suggestion unavailable. Continue manually."));
    } finally {
      if (suggestionController.current === controller) {
        suggestionController.current = null;
        if (!controller.signal.aborted) setSuggesting(false);
      }
    }
  };
  const decideSuggestion = async (useIt) => {
    const suggestions = suggestion?.suggestions || {};
    const nextCategory =
      useIt && suggestions.categoryId ? suggestions.categoryId : draft.categoryId;
    const nextTarget =
      useIt && suggestions.targetKind === "shared" ? { kind: "shared" } : selectedTarget;
    if (useIt) {
      if (suggestions.categoryId) update("categoryId", suggestions.categoryId);
      if (suggestions.targetKind === "shared") setSelectedTarget({ kind: "shared" });
    }
    setSuggestion(null);
    if (suggestion?.suggestionId && nextCategory) {
      try {
        await ledgerApi.suggestDecision(
          suggestion.suggestionId,
          { target: nextTarget, categoryId: nextCategory },
          {}
        );
      } catch {
        /* Feedback does not block manual entry. */
      }
    }
  };
  const field = (name, label, extra = {}) => (
    <label key={name}>
      {label}
      <input
        value={draft[name]}
        onChange={(event) => update(name, event.target.value)}
        disabled={busy}
        {...extra}
      />
    </label>
  );
  const submit = (event) => {
    event.preventDefault();
    if (
      !draft.occurredOn ||
      !draft.amount ||
      !draft.currency ||
      !draft.categoryId ||
      !draft.purpose.trim()
    ) {
      setValidation(T("Date, amount, currency, category and purpose are required."));
      return;
    }
    setValidation("");
    onSubmit(
      {
        target: selectedTarget,
        occurredOn: draft.occurredOn,
        amount: draft.amount,
        currency: draft.currency.toUpperCase(),
        categoryId: draft.categoryId,
        purpose: draft.purpose.trim(),
        note: draft.note || null,
        quantity: draft.quantity || null,
        unit: draft.unit || null,
      },
      createKey.current
    );
  };
  return (
    <form className="ledger-form" onSubmit={submit}>
      <h2>{value ? T("Edit expense") : T("Add expense")}</h2>
      <label>
        {T("Project or shared cost", "归到项目还是公共支出")}
        <select
          value={selectedTarget.kind === "shared" ? "shared" : selectedTarget.projectId}
          disabled={busy}
          onChange={(event) => {
            createKey.current = requestKey();
            setSuggestion(null);
            setSuggestionError("");
            setSelectedTarget(
              event.target.value === "shared"
                ? { kind: "shared" }
                : { kind: "project", projectId: event.target.value }
            );
          }}
        >
          <option value="shared">{T("Shared expense pool")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.githubFullName || project.description || T("Project history")}
            </option>
          ))}
        </select>
      </label>
      <div className="ledger-fields">
        {field("occurredOn", T("Date"), { type: "date", required: true })}
        {field("amount", T("Amount"), {
          inputMode: "decimal",
          required: true,
          placeholder: "12.00",
        })}
        {field("currency", T("Currency"), { maxLength: 3, required: true })}
        <label>
          {T("Category")}
          <select
            value={draft.categoryId}
            required
            disabled={busy}
            onChange={(event) => update("categoryId", event.target.value)}
          >
            <option value="">{T("Select category")}</option>
            {categories
              .filter((category) => !category.archivedAt || category.id === value?.categoryId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </label>
        {field("purpose", T("What did you pay for?", "这笔钱花在哪儿了？"), {
          maxLength: 500,
          required: true,
          placeholder: T("e.g. September hosting", "例如：九月托管费用"),
        })}
        {field("quantity", T("Quantity (optional)", "数量（选填）"), { inputMode: "decimal" })}
        {field("unit", T("Unit (optional)", "单位（选填）"), {
          maxLength: 40,
          placeholder: T("e.g. hours or requests", "例如：小时、次"),
        })}
      </div>
      <label>
        {T("Note (optional)", "备注（选填）")}
        <textarea
          value={draft.note}
          maxLength={4000}
          disabled={busy}
          onChange={(event) => update("note", event.target.value)}
        />
      </label>
      {validation && <p role="alert">{validation}</p>}
      <div className="ledger-actions">
        <button
          className="btn"
          type="button"
          disabled={busy || suggesting || !draft.purpose.trim()}
          onClick={requestSuggestion}
        >
          {suggesting ? T("Checking…") : T("Request suggestion")}
        </button>
      </div>
      {suggestionError && <p role="status">{suggestionError}</p>}
      {suggestion && (
        <div className="notice notice-grid" role="status">
          <h3>{T("Review suggestion")}</h3>
          {suggestion.suggestions?.categoryId && (
            <p>
              {T("Category")}:{" "}
              {categories.find((item) => item.id === suggestion.suggestions.categoryId)?.name ||
                T("Unknown")}
            </p>
          )}
          {suggestion.suggestions?.targetKind && (
            <p>
              {T("Target")}:{" "}
              {suggestion.suggestions.targetKind === "shared"
                ? T("Shared expense pool")
                : T("Project — select the intended project in the form before saving")}
            </p>
          )}
          {suggestion.suggestions?.duplicateExpenseId && (
            <p>
              {T("Possible duplicate")}: {suggestion.suggestions.duplicateExpenseId}.{" "}
              {T("Check existing expenses before saving.")}
            </p>
          )}
          {!suggestion.suggestions?.categoryId &&
            !suggestion.suggestions?.targetKind &&
            !suggestion.suggestions?.duplicateExpenseId && (
              <p>{T("No confident suggestion. Your manual choices remain available.")}</p>
            )}
          {suggestion.suggestions?.duplicateExpenseId && (
            <label>
              <input
                type="checkbox"
                checked={duplicateReviewed}
                onChange={(event) => setDuplicateReviewed(event.target.checked)}
              />{" "}
              {T("I reviewed the possible duplicate")}
            </label>
          )}
          <div className="ledger-actions">
            <button
              className="btn"
              type="button"
              disabled={Boolean(suggestion.suggestions?.duplicateExpenseId) && !duplicateReviewed}
              onClick={() => decideSuggestion(true)}
            >
              {T("Use suggestion")}
            </button>
            <button className="btn" type="button" onClick={() => decideSuggestion(false)}>
              {T("Keep my choices")}
            </button>
          </div>
        </div>
      )}
      <div className="ledger-actions">
        <button
          className="btn primary"
          type="submit"
          disabled={
            busy ||
            suggesting ||
            (Boolean(suggestion?.suggestions?.duplicateExpenseId) && !duplicateReviewed)
          }
        >
          {T("Save expense")}
        </button>
        <button className="btn" type="button" disabled={busy} onClick={onCancel}>
          {T("Cancel")}
        </button>
      </div>
    </form>
  );
}

export function LedgerScreen({
  go,
  mode = "projects",
  projectId = "",
  authorizationError = "",
  authorizationRevision = 0,
}) {
  useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState({ from: "", to: "", categoryId: "" });
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryEdit, setCategoryEdit] = useState(null);
  const [confirmCategoryId, setConfirmCategoryId] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState("");
  const inFlight = useRef(false);
  const requestId = useRef(0);
  const moreController = useRef(null);
  const loadedScope = useRef(null);
  const mounted = useRef(false);
  const addProjectPanelRef = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const filtered = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    [filters]
  );
  const detailQuery = useMemo(
    () =>
      mode === "shared"
        ? { target: "shared", ...filtered }
        : { target: "project", projectId, ...filtered },
    [mode, projectId, filtered]
  );
  const exportHref = useMemo(
    () =>
      `${env.VITE_API_BASE_URL || ""}/api/v1/expenses/export?${new URLSearchParams(
        detailQuery
      ).toString()}`,
    [detailQuery]
  );
  useEffect(() => {
    const controller = new AbortController();
    moreController.current?.abort();
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    const scope = `${mode}:${projectId}:${authorizationRevision}`;
    if (loadedScope.current !== scope) setData(null);
    loadedScope.current = scope;
    const options = { signal: controller.signal };
    const load = async () => {
      if (mode === "projects") {
        const [projects, repositories, categories, summary] = await Promise.all([
          ledgerApi.projects({}, options),
          ledgerApi.repositories({}, options),
          ledgerApi.categories(options),
          ledgerApi.reportSummary(filtered, options).then(
            (value) => ({ value }),
            (failure) => ({ failure })
          ),
        ]);
        return {
          projects,
          repositories,
          categories,
          summary: summary.value,
          summaryError: summary.failure ? errorText(summary.failure) : "",
        };
      }
      if (mode === "categories") return { categories: await ledgerApi.categories(options) };
      const [categories, expenses, project, projects, summary, timeseries, categoryReport] =
        await Promise.all([
          ledgerApi.categories(options),
          ledgerApi.expenses(detailQuery, options),
          mode === "project" ? ledgerApi.project(projectId, options) : Promise.resolve(null),
          ledgerApi.projects({}, options),
          ledgerApi.reportSummary(detailQuery, options),
          ledgerApi.reportTimeseries(detailQuery, options),
          ledgerApi.reportCategories(detailQuery, options),
        ]);
      return { categories, expenses, project, projects, summary, timeseries, categoryReport };
    };
    load()
      .then((result) => {
        if (!controller.signal.aborted && request === requestId.current) {
          setData(result);
          if (mode === "project") setDescription(result.project?.description || "");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted && request === requestId.current)
          setError(errorText(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted && request === requestId.current) setLoading(false);
      });
    return () => {
      controller.abort();
      moreController.current?.abort();
      if (request === requestId.current) requestId.current += 1;
    };
  }, [mode, projectId, revision, filtered, detailQuery, authorizationRevision]);

  const loadMore = async (kind) => {
    const cursor = data?.[kind]?.nextCursor;
    if (!cursor || loadingMore) return;
    const request = requestId.current;
    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);
    setActionError("");
    try {
      const next =
        kind === "projects"
          ? await ledgerApi.projects({ cursor }, { signal: controller.signal })
          : kind === "repositories"
            ? await ledgerApi.repositories({ cursor }, { signal: controller.signal })
            : await ledgerApi.expenses({ ...detailQuery, cursor }, { signal: controller.signal });
      if (controller.signal.aborted || request !== requestId.current) return;
      if (next.nextCursor === cursor || (next.items.length === 0 && next.nextCursor)) {
        setActionError(T("Pagination did not advance. Reload to retry."));
        return;
      }
      const itemKey = (item) => (kind === "repositories" ? item.githubRepoId : item.id);
      const seenBefore = new Set(data[kind].items.map(itemKey));
      if (
        next.items.length &&
        next.items.every((item) => seenBefore.has(itemKey(item))) &&
        next.nextCursor
      ) {
        setActionError(T("Pagination repeated existing records. Reload to retry."));
        return;
      }
      setData((old) => {
        if (!old) return old;
        const current = old[kind];
        const seen = new Set(current.items.map(itemKey));
        return {
          ...old,
          [kind]: {
            ...next,
            items: [...current.items, ...next.items.filter((item) => !seen.has(itemKey(item)))],
          },
        };
      });
    } catch (failure) {
      if (!controller.signal.aborted) setActionError(errorText(failure));
    } finally {
      if (request === requestId.current) setLoadingMore(false);
    }
  };

  const action = async (callback) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError("");
    const request = requestId.current;
    try {
      await callback();
      if (request !== requestId.current) return false;
      reload();
      return true;
    } catch (failure) {
      if (request === requestId.current) setActionError(errorText(failure));
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const saveExpense = async (fields, idempotencyKey) => {
    const current = editing;
    const ok = await action(() =>
      current
        ? ledgerApi.updateExpense(current.id, current.revision, fields, {})
        : ledgerApi.createExpense(fields, idempotencyKey, {})
    );
    if (ok) setEditing(null);
  };
  const removeExpense = async (expense) => {
    const ok = await action(() => ledgerApi.removeExpense(expense.id, expense.revision, {}));
    if (ok) setConfirmId("");
  };

  const title =
    mode === "projects"
      ? T("Projects")
      : mode === "categories"
        ? T("Categories")
        : mode === "shared"
          ? T("Shared expense pool")
          : data?.project?.githubFullName || T("Project history");
  const target = mode === "shared" ? { kind: "shared" } : { kind: "project", projectId };
  const expenses = data?.expenses?.items || [];
  const availableRepos =
    data?.repositories?.items?.filter(
      (repo) => !data.projects.items.some((project) => project.githubRepoId === repo.githubRepoId)
    ) || [];
  const selectedRepository =
    availableRepos.find((repo) => String(repo.githubRepoId) === selectedRepo) || availableRepos[0];
  return (
    <div className="app product-workspace ledger-screen">
      <Topbar go={go} breadcrumbs={[{ label: title }]} loading={loading} />
      <div className="with-side">
        <Sidebar
          go={go}
          section={
            mode === "shared"
              ? "ledgerShared"
              : mode === "categories"
                ? "ledgerCategories"
                : "ledgerProjects"
          }
        />
        <main className={`main wide ledger-${mode}`}>
          <div className="page-h">
            <div>
              <h1>{title}</h1>
              <p className="sub">
                {mode === "projects"
                  ? T(
                      "See what each project costs. Start with a GitHub repository.",
                      "看看每个项目花了多少钱，从添加一个 GitHub 仓库开始。"
                    )
                  : mode === "shared"
                    ? T(
                        "One place for tools and services you use across projects.",
                        "多个项目共用的工具和服务费用，都记在这里。"
                      )
                    : mode === "categories"
                      ? T(
                          "Group your spending so you can see where the money goes.",
                          "给支出分个类，看看钱都花在哪儿了。"
                        )
                      : T(
                          "Hosting, domains, tools — keep this project's costs together.",
                          "托管、域名、工具，把这个项目的费用记在一起。"
                        )}
              </p>
            </div>
            <button className="btn" onClick={reload} disabled={loading}>
              {T("Reload")}
            </button>
          </div>
          {authorizationError && (
            <p role="alert" className="notice">
              {authorizationError}
            </p>
          )}
          {error && (
            <div role="alert" className="notice">
              {error}{" "}
              <button className="btn" onClick={reload}>
                {T("Retry")}
              </button>
            </div>
          )}
          {actionError && (
            <p role="alert" className="notice">
              {actionError}
            </p>
          )}
          {loading && <p role="status">{T("Loading ledger…")}</p>}
          {data && mode === "projects" && (
            <div className="ledger-split">
              <section className="panel ledger-your-projects">
                <div className="panel-h">
                  <I.Folder size={20} />
                  <h2>{T("Your projects")}</h2>
                  <span className="count">
                    {data.projects.items.length}
                    {data.projects.nextCursor ? "+" : ""}
                  </span>
                </div>
                {data.projects.items.length === 0 && (
                  <div className="empty">
                    <I.Folder size={32} />
                    <h3>{T("Your first project starts here", "从第一个项目开始")}</h3>
                    <p>
                      {T(
                        "Add a repository to start tracking hosting, domains and other project costs.",
                        "添加一个仓库，就能记录托管、域名和其他项目费用。"
                      )}
                    </p>
                    <a
                      className="btn"
                      href="#add-repository"
                      onClick={(event) => {
                        event.preventDefault();
                        const panel = addProjectPanelRef.current;
                        if (!panel) return;
                        const control = panel.querySelector("select, button");
                        if (control) control.focus();
                        else panel.scrollIntoView({ block: "start" });
                      }}
                    >
                      {T("Add a repository", "添加一个仓库")} <I.ArrowR size={14} />
                    </a>
                  </div>
                )}
                <div className="ledger-list">
                  {data.projects.items.map((project) => (
                    <article key={project.id}>
                      <h3>
                        {project.githubFullName || project.description || T("Project history")}
                      </h3>
                      {project.description && project.githubFullName && (
                        <p>{project.description}</p>
                      )}
                      {project.githubAccess === "lost" && (
                        <p role="status">
                          {T(
                            "GitHub access lost. Historical expenses remain available; reconnect GitHub to add new expenses."
                          )}
                        </p>
                      )}
                      <p>{project.totals.map(formatTotal).join(" · ") || T("No expenses")}</p>
                      <button
                        className="btn"
                        onClick={() => go("ledgerProject", { id: project.id })}
                      >
                        {T("Open project")}
                      </button>
                    </article>
                  ))}
                </div>
                {data.projects.nextCursor && (
                  <button
                    className="btn"
                    disabled={loadingMore}
                    onClick={() => loadMore("projects")}
                  >
                    {T("Load more projects")}
                  </button>
                )}
              </section>
              <section className="panel" id="add-repository" ref={addProjectPanelRef}>
                <div className="panel-h">
                  <I.Github size={20} />
                  <h2>{T("Add a repository", "添加一个仓库")}</h2>
                </div>
                {availableRepos.length > 0 && (
                  <p className="ledger-help">
                    {T(
                      "GitHub access is ready. Choose a repository and create its expense project below.",
                      "GitHub 已授权。在下面选一个仓库，创建它的支出项目。"
                    )}
                  </p>
                )}
                {availableRepos.length === 0 && !data.repositories.nextCursor ? (
                  <p className="ledger-help">
                    {data.repositories.items.length > 0
                      ? T(
                          "These repositories are already in your projects. Open one to record an expense, or connect another repository.",
                          "这些仓库已经添加到项目了。打开项目即可记账，也可以再连接其他仓库。"
                        )
                      : T(
                          "No repositories are available yet. Connect GitHub and choose the repositories you want to track.",
                          "还没有可用仓库。连接 GitHub，选择你想记账的仓库。"
                        )}
                  </p>
                ) : availableRepos.length > 0 ? (
                  <form
                    className="ledger-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const request = requestId.current;
                      action(async () => {
                        const project = await ledgerApi.createProject(
                          {
                            githubRepoId: Number(selectedRepository.githubRepoId),
                            description,
                          },
                          {}
                        );
                        if (request === requestId.current && project?.id)
                          go("ledgerProject", { id: project.id });
                      });
                    }}
                  >
                    <label>
                      {T("Repository")}
                      <select
                        value={String(selectedRepository.githubRepoId)}
                        disabled={busy}
                        onChange={(event) => setSelectedRepo(event.target.value)}
                      >
                        {availableRepos.map((repo) => (
                          <option key={repo.githubRepoId} value={repo.githubRepoId}>
                            {repo.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {T("Project description")}
                      <textarea
                        value={description}
                        maxLength={2000}
                        placeholder={T(
                          "What are you building? (optional)",
                          "这个项目是做什么的？（选填）"
                        )}
                        disabled={busy}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </label>
                    <button className="btn primary" type="submit" disabled={busy}>
                      {T("Create project")}
                    </button>
                  </form>
                ) : null}
                {data.repositories.nextCursor && (
                  <button
                    className="btn"
                    disabled={loadingMore}
                    onClick={() => loadMore("repositories")}
                  >
                    {T("Load more repositories")}
                  </button>
                )}
                <button
                  className="btn ghost"
                  disabled={busy || loading}
                  onClick={() => action(() => connectGitHubRepositories({ add: true }))}
                >
                  <I.Github size={14} /> {T("Manage GitHub access")}
                </button>
              </section>
              <section className="panel ledger-overview">
                <h2>{T("Account overview")}</h2>
                <LedgerFilters
                  filters={filters}
                  onChange={setFilters}
                  categories={data.categories}
                />
                {data.summaryError && (
                  <p role="status">
                    {T(
                      "Spending summary is unavailable. Your projects are still ready to use.",
                      "支出汇总暂时无法加载，你仍可以使用项目。"
                    )}{" "}
                    {data.summaryError}
                  </p>
                )}
                {data.summary &&
                  data.summary.groups.filter((group) => group.target === "account").length ===
                    0 && <p>{T("No expenses in this range.")}</p>}
                <div className="ledger-list">
                  {data.summary?.groups
                    .filter((group) => group.target === "account")
                    .map((group) => (
                      <article key={group.currency}>
                        <h3>{formatTotal(group)}</h3>
                        <p>
                          {T("Projects")}:{" "}
                          <span>
                            {formatTotal(
                              data.summary.groups.find(
                                (item) =>
                                  item.target === "project" &&
                                  item.projectId == null &&
                                  item.currency === group.currency
                              ) || { currency: group.currency, amountMinor: 0 }
                            )}
                          </span>
                        </p>
                        <p>
                          {T("Shared pool")}:{" "}
                          <span>
                            {formatTotal(
                              data.summary.groups.find(
                                (item) =>
                                  item.target === "shared" && item.currency === group.currency
                              ) || { currency: group.currency, amountMinor: 0 }
                            )}
                          </span>
                        </p>
                      </article>
                    ))}
                </div>
              </section>
            </div>
          )}
          {data && mode === "categories" && (
            <div className="ledger-split">
              <section className="panel">
                <h2>{T("Your categories")}</h2>
                {data.categories.length === 0 && (
                  <div className="empty">
                    <I.Folder size={28} />
                    <h3>{T("Give your expenses a home", "先为支出建个分类")}</h3>
                    <p>
                      {T(
                        "Add your first category above. You will choose one when recording an expense.",
                        "在上方添加第一个分类，记账时就可以选择了。"
                      )}
                    </p>
                  </div>
                )}
                <div className="ledger-list">
                  {data.categories.map((category) => (
                    <article key={category.id}>
                      <h3>{category.name}</h3>
                      <p>
                        {category.archivedAt
                          ? T(
                              "Archived · past expenses keep this category",
                              "已归档 · 以前的支出仍保留此分类"
                            )
                          : T("Ready to use", "可用于记账")}
                      </p>
                      {categoryEdit?.id === category.id && (
                        <form
                          className="ledger-actions"
                          onSubmit={(event) => {
                            event.preventDefault();
                            action(() =>
                              ledgerApi.updateCategory(
                                category.id,
                                category.revision,
                                { name: categoryEdit.name.trim(), color: category.color },
                                {}
                              )
                            ).then((ok) => {
                              if (ok) setCategoryEdit(null);
                            });
                          }}
                        >
                          <label>
                            {T("New category name")}
                            <input
                              value={categoryEdit.name}
                              required
                              maxLength={80}
                              onChange={(event) =>
                                setCategoryEdit({ id: category.id, name: event.target.value })
                              }
                            />
                          </label>
                          <button className="btn primary" type="submit" disabled={busy}>
                            {T("Save category")}
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => setCategoryEdit(null)}
                          >
                            {T("Cancel")}
                          </button>
                        </form>
                      )}
                      {!category.archivedAt && (
                        <div className="ledger-actions">
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() =>
                              setCategoryEdit({ id: category.id, name: category.name })
                            }
                          >
                            {T("Rename")}
                          </button>
                          {confirmCategoryId === category.id ? (
                            <>
                              <button
                                className="btn"
                                disabled={busy}
                                onClick={() =>
                                  action(() =>
                                    ledgerApi.archiveCategory(category.id, category.revision, {})
                                  ).then((ok) => {
                                    if (ok) setConfirmCategoryId("");
                                  })
                                }
                              >
                                {T("Confirm archive")}
                              </button>
                              <button
                                className="btn"
                                disabled={busy}
                                onClick={() => setConfirmCategoryId("")}
                              >
                                {T("Cancel")}
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => setConfirmCategoryId(category.id)}
                            >
                              {T("Archive")}
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              <section className="panel">
                <h2>{T("Add category")}</h2>
                <p className="ledger-help">
                  {T(
                    "Try Hosting, Domains or AI tools. You can use the same categories in every project.",
                    "比如「托管」「域名」「AI 工具」，所有项目都可以使用这些分类。"
                  )}
                </p>
                <form
                  className="ledger-actions"
                  onSubmit={(event) => {
                    event.preventDefault();
                    action(() => ledgerApi.createCategory({ name: categoryName.trim() }, {})).then(
                      (ok) => {
                        if (ok) setCategoryName("");
                      }
                    );
                  }}
                >
                  <label>
                    {T("Category name")}
                    <input
                      value={categoryName}
                      maxLength={80}
                      placeholder={T("e.g. Hosting", "例如：托管")}
                      required
                      disabled={busy}
                      onChange={(event) => setCategoryName(event.target.value)}
                    />
                  </label>
                  <button className="btn primary" type="submit" disabled={busy}>
                    {T("Add category")}
                  </button>
                </form>
              </section>
            </div>
          )}
          {data && (mode === "shared" || mode === "project") && (
            <>
              {mode === "shared" && (
                <div className="notice notice-guide">
                  <I.Folder size={22} />
                  <div>
                    <strong>
                      {T(
                        "Used by more than one project? Record it here.",
                        "不止一个项目在用？记在这里。"
                      )}
                    </strong>
                    <p>
                      {T(
                        "An AI coding subscription or a shared server, for example. Record the cost once; it stays separate from each project's expenses.",
                        "比如 AI 编程订阅或共用服务器。费用只记一笔，与各项目的支出分开展示。"
                      )}
                    </p>
                  </div>
                </div>
              )}
              {data.project?.githubAccess === "lost" && (
                <div className="notice" role="status">
                  {T(
                    "GitHub access lost. You can review, edit and remove historical expenses. Reconnect GitHub to add new expenses."
                  )}
                </div>
              )}
              <section className="panel">
                <h2>{T("Expenses")}</h2>
                <p className="ledger-help">
                  {T(
                    "What did you pay for? Add the amount, date and a category below.",
                    "这笔钱花在哪儿了？在下面填好金额、日期和分类。"
                  )}
                </p>
                {data.categories.filter((category) => !category.archivedAt).length === 0 && (
                  <p>
                    {T(
                      "Start by adding a category, such as Hosting or AI tools.",
                      "先添加一个分类，比如「托管」或「AI 工具」。"
                    )}{" "}
                    <button className="btn" onClick={() => go("ledgerCategories")}>
                      {T("Manage categories")}
                    </button>
                  </p>
                )}
                {(data.categories.some((category) => !category.archivedAt) || editing) &&
                  (mode === "shared" || data.project?.githubAccess === "authorized" || editing) && (
                    <ExpenseForm
                      key={editing?.id || "new"}
                      value={editing}
                      target={target}
                      projects={
                        mode === "project" &&
                        !data.projects.items.some((item) => item.id === projectId)
                          ? [data.project, ...data.projects.items]
                          : data.projects.items
                      }
                      categories={data.categories}
                      busy={busy}
                      onSubmit={saveExpense}
                      onCancel={() => setEditing(null)}
                    />
                  )}
                <LedgerFilters
                  filters={filters}
                  onChange={setFilters}
                  categories={data.categories}
                />
                <div className="ledger-actions">
                  <a className="btn" href={exportHref} download="expenses.csv">
                    {T("Export CSV")}
                  </a>
                </div>
                {expenses.length === 0 && <p>{T("No expenses for this target yet.")}</p>}
                <div className="ledger-list">
                  {expenses.map((expense) => (
                    <article key={expense.id}>
                      <h3>{expense.purpose}</h3>
                      <p>
                        {expense.occurredOn} · {expense.currency} {expense.amount}
                      </p>
                      {expense.note && <p>{expense.note}</p>}
                      <div className="ledger-actions">
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => setEditing(expense)}
                          aria-label={`${T("Edit")} ${expense.purpose}`}
                        >
                          {T("Edit")}
                        </button>
                        {confirmId === expense.id ? (
                          <>
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => removeExpense(expense)}
                            >
                              {T("Confirm removal")}
                            </button>
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => setConfirmId("")}
                            >
                              {T("Cancel")}
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => setConfirmId(expense.id)}
                            aria-label={`${T("Remove")} ${expense.purpose}`}
                          >
                            {T("Remove")}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {data.expenses.nextCursor && (
                  <button
                    className="btn"
                    disabled={loadingMore}
                    onClick={() => loadMore("expenses")}
                  >
                    {T("Load more expenses")}
                  </button>
                )}
              </section>
              <section className="panel">
                <h2>{T("Totals by currency")}</h2>
                {data.summary.groups.length === 0 && (
                  <p className="ledger-help">
                    {T(
                      "Your spending totals will appear after you record an expense.",
                      "记下第一笔支出后，这里就会显示合计。"
                    )}
                  </p>
                )}
                <div className="ledger-list ledger-totals">
                  {data.summary.groups
                    .filter(
                      (group) =>
                        group.target === mode &&
                        (mode === "shared" || group.projectId === projectId)
                    )
                    .map((group) => (
                      <article key={group.currency}>
                        <h3>{formatTotal(group)}</h3>
                      </article>
                    ))}
                </div>
              </section>
              <div className="ledger-reports">
                <ReportGroups
                  title={T("Expenses over time")}
                  groups={data.timeseries.groups}
                  dimension="bucket"
                />
                <ReportGroups
                  title={T("Expenses by category")}
                  groups={data.categoryReport.groups}
                  categories={data.categories}
                  dimension="category"
                />
              </div>
              {mode === "project" && (
                <section className="panel">
                  <h2>{T("Project description")}</h2>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      action(() =>
                        ledgerApi.updateProject(
                          projectId,
                          data.project.revision,
                          { description },
                          {}
                        )
                      );
                    }}
                  >
                    <label>
                      {T("Description")}
                      <textarea
                        value={description}
                        maxLength={2000}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </label>
                    <button className="btn" type="submit" disabled={busy}>
                      {T("Save description")}
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
