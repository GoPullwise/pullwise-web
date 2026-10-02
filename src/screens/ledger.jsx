import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { SkeletonLine } from "../components/skeleton.jsx";
import { env } from "../config/env.js";
import { T, useLang } from "../i18n.jsx";
import { I } from "../icons.jsx";
import { connectGitHubRepositories, startGitHubLogin } from "../lib/auth.js";
import { screenLinkProps } from "../lib/navigation.js";
import { Topbar, Sidebar, ViewTabs } from "../shell.jsx";
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
    IDENTITY_UNAVAILABLE: T(
      "Repository access could not be checked. Your loaded project history remains available.",
      "暂时无法检查仓库授权，已加载的项目历史仍可访问。"
    ),
    GITHUB_REAUTHORIZATION_REQUIRED: T(
      "GitHub rejected your credential. It may have expired or been revoked. Reconnect GitHub to renew access.",
      "GitHub 拒绝了当前凭据，它可能已过期或被撤销。请重新连接 GitHub 恢复授权。"
    ),
    GITHUB_PERMISSION_DENIED: T(
      "GitHub denied repository access. Review the App installation and repository permissions.",
      "GitHub 拒绝了仓库访问，请检查 App 安装和仓库权限。"
    ),
    GITHUB_RATE_LIMITED: T(
      "GitHub is limiting requests. Wait before checking repository access again.",
      "GitHub 请求受到限流，请等待后再检查仓库授权。"
    ),
    GITHUB_UNAVAILABLE: T(
      "GitHub is temporarily unavailable. Your loaded project history remains available.",
      "GitHub 暂时不可用，已加载的项目历史仍可访问。"
    ),
    GITHUB_RESPONSE_INVALID: T(
      "GitHub returned an unexpected response. Repository access could not be checked.",
      "GitHub 返回了异常响应，暂时无法检查仓库授权。"
    ),
    GITHUB_CONFIGURATION_ERROR: T(
      "GitHub connection configuration needs attention. Contact support before reconnecting.",
      "GitHub 连接配置需要检查，请先联系支持。"
    ),
    GITHUB_TOKEN_UNREADABLE: T(
      "The stored GitHub credential could not be read. Contact support to check the connection configuration.",
      "无法读取已保存的 GitHub 凭据，请联系支持检查连接配置。"
    ),
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
    CATEGORY_REQUIRED: T("Choose a category to finish saving. Your draft is still here.", "请选择类别后保存，已填写的内容已保留。"),
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

function minorAmount(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value);
  return null;
}

function formatTotal({ currency, amountMinor }) {
  const minor = minorAmount(amountMinor);
  if (minor === null || typeof currency !== "string") return T("Unavailable");
  let exponent = 2;
  try {
    exponent = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
  } catch {
    /* Keep a readable fallback for an older browser currency table. */
  }
  const scale = 10n ** BigInt(exponent);
  const whole = (minor / scale).toLocaleString("en");
  const fraction = exponent ? `.${(minor % scale).toString().padStart(exponent, "0")}` : "";
  return `${currency} ${whole}${fraction}`;
}

function LedgerFilters({ filters, onChange, categories = [] }) {
  const categoryFieldId = useId();
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
      <div className="ledger-field">
        <label htmlFor={categoryFieldId}>{T("Filter category")}</label>
        <select
          id={categoryFieldId}
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
      </div>
    </div>
  );
}

function ReportGroups({ title, groups, error, categories = [], dimension, icon: IconComponent }) {
  const rows = groups || [];
  const largestByCurrency = rows.reduce((totals, row) => {
    const amount = minorAmount(row.amountMinor);
    const largest = totals.get(row.currency) ?? 1n;
    if (amount !== null && amount > largest) totals.set(row.currency, amount);
    return totals;
  }, new Map());
  return (
    <section className="panel">
      {IconComponent ? (
        <div className="panel-h">
          <IconComponent size={20} />
          <h2>{title}</h2>
        </div>
      ) : (
        <h2>{title}</h2>
      )}
      {error ? (
        <p role="status">{T("This report is unavailable. Reload to try again.", "此报表暂不可用，重新加载后可再试。")}</p>
      ) : rows.length === 0 ? (
        <p>{T("No expenses in this range.")}</p>
      ) : (
        <>
        <p className="ledger-help">{T("Bars are scaled separately for each currency.", "条形比例按各币种分别计算。")}</p>
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
                <span style={{ width: `${Number(((minorAmount(row.amountMinor) ?? 0n) * 10000n) / (largestByCurrency.get(row.currency) ?? 1n)) / 100}%` }} />
              </span>
              <strong>{formatTotal(row)}</strong>
            </div>
          ))}
        </div>
        </>
      )}
    </section>
  );
}

function LedgerSkeleton({ mode }) {
  const headingSkeleton = (
    <div className="panel-h skeleton-row">
      <SkeletonLine className="sk-square sk-size-16" />
      <SkeletonLine className="sk-line sk-w-26 sk-h-16" />
    </div>
  );
  const listSkeleton = (
    <div className="ledger-list">
      {Array.from({ length: 3 }, (_, index) => (
        <article className="skeleton-row" key={`ledger-row-skeleton-${index}`}>
          <SkeletonLine className="sk-line sk-w-42 sk-h-16" />
          <SkeletonLine className="sk-line sk-w-65" />
          <SkeletonLine className="sk-line sk-w-30" />
        </article>
      ))}
    </div>
  );
  const formSkeleton = (
    <div className="skeleton-stack">
      <SkeletonLine className="sk-line sk-w-34" />
      <SkeletonLine className="sk-line sk-w-70 sk-h-40" />
      <SkeletonLine className="sk-line sk-w-56 sk-h-40" />
      <SkeletonLine className="sk-line sk-w-26 sk-h-34" />
    </div>
  );
  const statsSkeleton = (
    <div className="ledger-stats">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="ledger-stat skeleton-row" key={`ledger-stat-skeleton-${index}`}>
          <SkeletonLine className="sk-line sk-w-22" />
          <SkeletonLine className="sk-line sk-w-45 sk-h-28" />
        </div>
      ))}
    </div>
  );
  return (
    <div role="status" aria-label={T("Loading ledger…")}>
      {mode === "projects" || mode === "categories" ? (
        <div className="ledger-split">
          <div className="panel">
            {headingSkeleton}
            {listSkeleton}
          </div>
          <div className="panel">
            {headingSkeleton}
            {formSkeleton}
          </div>
          {mode === "projects" && (
            <div className="panel ledger-overview">
              {headingSkeleton}
              {statsSkeleton}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="panel">
            {headingSkeleton}
            {statsSkeleton}
            <div className="ledger-filter-bar skeleton-row">
              <SkeletonLine className="sk-line sk-w-30 sk-h-40" />
              <SkeletonLine className="sk-line sk-w-30 sk-h-40" />
              <SkeletonLine className="sk-line sk-w-16 sk-h-34" />
            </div>
          </div>
          <div className="panel">
            {headingSkeleton}
            {listSkeleton}
          </div>
        </>
      )}
    </div>
  );
}

function ExpenseForm({ value, categories, projects, target, busy, onSubmit, onCancel }) {
  const noteId = useId();
  const targetFieldId = useId();
  const categoryFieldId = useId();
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
  const [automaticCategory, setAutomaticCategory] = useState(false);
  const [requiresCategory, setRequiresCategory] = useState(false);
  const categoryRef = useRef(null);
  const mounted = useRef(false);
  const createKey = useRef(requestKey());
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    if (!value) {
      ledgerApi.me({ signal: controller.signal }).then((profile) => {
        if (!controller.signal.aborted) setAutomaticCategory(
          profile?.entitlements?.jev?.eligible === true && profile.entitlements.jev.available === true
        );
      }).catch(() => {
        /* A profile outage leaves ordinary manual entry available. */
      });
    }
    return () => { mounted.current = false; controller.abort(); };
  }, [value]);
  const categoryRequired = Boolean(value || !automaticCategory || requiresCategory);
  useEffect(() => {
    // Chrome ignores focus while a pending write still disables the select.
    if (requiresCategory && !busy && !draft.categoryId) categoryRef.current?.focus();
  }, [requiresCategory, busy, draft.categoryId]);
  const update = (name, next) => {
    createKey.current = requestKey();
    setValidation("");
    setDraft((old) => ({ ...old, [name]: next }));
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
  const submit = async (event) => {
    event.preventDefault();
    if (
      !draft.occurredOn ||
      !draft.amount ||
      !draft.currency ||
      (categoryRequired && !draft.categoryId) ||
      !draft.purpose.trim()
    ) {
      setValidation(T("Date, amount, currency, category and purpose are required."));
      return;
    }
    setValidation("");
    const result = await onSubmit(
      {
        target: selectedTarget,
        occurredOn: draft.occurredOn,
        amount: draft.amount,
        currency: draft.currency.toUpperCase(),
        ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
        purpose: draft.purpose.trim(),
        note: draft.note || null,
        quantity: draft.quantity || null,
        unit: draft.unit || null,
      },
      createKey.current
    );
    if (mounted.current && result?.error?.payload?.error?.code === "CATEGORY_REQUIRED") {
      setRequiresCategory(true);
      setValidation(T("Choose a category to finish saving. Your draft is still here.", "请选择类别后保存，已填写的内容已保留。"));
    }
  };
  return (
    <form className="ledger-form" onSubmit={submit}>
      <div className="ledger-field">
        <label htmlFor={targetFieldId}>{T("Project or shared cost", "归到项目还是公共支出")}</label>
        <select
          id={targetFieldId}
          value={selectedTarget.kind === "shared" ? "shared" : selectedTarget.projectId}
          disabled={busy}
          onChange={(event) => {
            createKey.current = requestKey();
            setValidation("");
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
      </div>
      <div className="ledger-fields">
        {field("occurredOn", T("Date"), { type: "date", required: true })}
        {field("amount", T("Amount"), {
          inputMode: "decimal",
          required: true,
          placeholder: "12.00",
        })}
        {field("currency", T("Currency"), { maxLength: 3, required: true })}
        <div className="ledger-field">
          <label htmlFor={categoryFieldId}>{T("Category")}</label>
          <select
            id={categoryFieldId}
            ref={categoryRef}
            value={draft.categoryId}
            required={categoryRequired}
            disabled={busy}
            onChange={(event) => update("categoryId", event.target.value)}
          >
            <option value="">{categoryRequired ? T("Select category") : T("Automatic", "自动分类")}</option>
            {categories
              .filter((category) => !category.archivedAt || category.id === value?.categoryId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      {!categoryRequired && <p className="ledger-help">{T("Jev will select a category when you save, or choose one yourself.", "保存时 Jev 会自动分类，你也可以自行选择。")}</p>}
      {field("purpose", T("What did you pay for?", "这笔钱花在哪儿了？"), {
        maxLength: 500,
        required: true,
        placeholder: T("e.g. September hosting", "例如：九月托管费用"),
      })}
      <details
        className="disclosure"
        open={Boolean(value?.quantity || value?.unit || value?.note) || undefined}
      >
        <summary>{T("More details (optional)", "更多信息（选填）")}</summary>
        <div className="ledger-fields">
          {field("quantity", T("Quantity (optional)", "数量（选填）"), { inputMode: "decimal" })}
          {field("unit", T("Unit (optional)", "单位（选填）"), {
            maxLength: 40,
            placeholder: T("e.g. hours or requests", "例如：小时、次"),
          })}
        </div>
        <div className="ledger-field">
          <label htmlFor={noteId}>{T("Note (optional)", "备注（选填）")}</label>
          <textarea
            id={noteId}
            value={draft.note}
            maxLength={4000}
            disabled={busy}
            onChange={(event) => update("note", event.target.value)}
          />
        </div>
      </details>
      {validation && <p role="alert">{validation}</p>}
      <div className="ledger-actions">
        <button
          className="btn primary"
          type="submit"
          disabled={busy}
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
  const [savedAssistance, setSavedAssistance] = useState(null);
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
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const [view, setView] = useState("expenses");
  const [projectSearch, setProjectSearch] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const viewId = useId();
  const repositoryFieldId = useId();
  const projectDescriptionId = useId();
  const projectOpenerRef = useRef(null);
  const restoreProjectFocus = useRef(false);
  const inFlight = useRef(false);
  const requestId = useRef(0);
  const moreController = useRef(null);
  const loginController = useRef(null);
  const loadedScope = useRef(null);
  const mounted = useRef(false);
  const addProjectPanelRef = useRef(null);
  const expenseFormPanelRef = useRef(null);
  const expenseOpenerRef = useRef(null);
  const restoreExpenseFocus = useRef(false);
  const categoryEditorRowRef = useRef(null);
  const restoreCategoryFocus = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (editing || creatingExpense) {
      const panel = expenseFormPanelRef.current;
      const picker = panel?.querySelector("select");
      picker?.scrollIntoView?.({ block: "center" });
      picker?.focus({ preventScroll: true });
    }
  }, [editing, creatingExpense]);
  useEffect(() => {
    if (!categoryEdit && restoreCategoryFocus.current) {
      categoryEditorRowRef.current?.querySelector("button")?.focus({ preventScroll: true });
      restoreCategoryFocus.current = false;
    }
  }, [categoryEdit]);

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
    if (loadedScope.current !== scope) {
      setData(null);
      setSavedAssistance(null);
      setEditing(null);
      setCreatingExpense(false);
      setView("expenses");
      setAddingProject(false);
      setProjectSearch("");
      expenseOpenerRef.current = null;
      restoreExpenseFocus.current = false;
      projectOpenerRef.current = null;
      restoreProjectFocus.current = false;
      setCategoryEdit(null);
      setConfirmCategoryId("");
      categoryEditorRowRef.current = null;
      restoreCategoryFocus.current = false;
    }
    loadedScope.current = scope;
    const options = { signal: controller.signal };
    const load = async () => {
      if (mode === "projects") {
        const [projects, repositories, categories, summary] = await Promise.all([
          ledgerApi.projects({}, options),
          ledgerApi.repositories({}, options).then(
            (value) => ({ value }),
            (failure) => {
              if (failure?.status === 401 || (failure?.status === 403 &&
                  !failure?.payload?.error?.code?.startsWith("GITHUB_"))) throw failure;
              return { failure };
            }
          ),
          ledgerApi.categories(options),
          ledgerApi.reportSummary(filtered, options).then(
            (value) => ({ value }),
            (failure) => ({ failure })
          ),
        ]);
        return {
          projects,
          repositories: repositories.value || null,
          repositoryError: repositories.failure || null,
          categories,
          summary: summary.value,
          summaryError: summary.failure ? errorText(summary.failure) : "",
        };
      }
      if (mode === "categories") return { categories: await ledgerApi.categories(options) };
      const optionalReport = (promise) => promise.then(
        (value) => ({ value }),
        (failure) => {
          if (failure?.status === 401 || failure?.status === 403) throw failure;
          return { failure };
        }
      );
      const [categories, expenses, project, projects, summary, timeseries, categoryReport] =
        await Promise.all([
          ledgerApi.categories(options),
          ledgerApi.expenses(detailQuery, options),
          mode === "project" ? ledgerApi.project(projectId, options) : Promise.resolve(null),
          ledgerApi.projects({}, options),
          optionalReport(ledgerApi.reportSummary(detailQuery, options)),
          optionalReport(ledgerApi.reportTimeseries(detailQuery, options)),
          optionalReport(ledgerApi.reportCategories(detailQuery, options)),
        ]);
      return { categories, expenses, project, projects,
        summary: summary.value, summaryError: summary.failure ? errorText(summary.failure) : "",
        timeseries: timeseries.value, timeseriesError: timeseries.failure ? errorText(timeseries.failure) : "",
        categoryReport: categoryReport.value, categoryReportError: categoryReport.failure ? errorText(categoryReport.failure) : "",
      };
    };
    load()
      .then((result) => {
        if (!controller.signal.aborted && request === requestId.current) {
          setData(result);
          if (mode === "project") setDescription(result.project?.description || "");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted && request === requestId.current) {
          setData(null);
          setError(errorText(failure));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && request === requestId.current) setLoading(false);
      });
    return () => {
      controller.abort();
      loginController.current?.abort();
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
      // The expense form shows category fallback beside its picker and focuses it.
      if (request === requestId.current)
        setActionError(failure?.payload?.error?.code === "CATEGORY_REQUIRED" ? "" : errorText(failure));
      return false;
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const reconnectGitHub = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError("");
    const request = requestId.current;
    const controller = new AbortController();
    loginController.current = controller;
    try {
      await startGitHubLogin({ signal: controller.signal });
    } catch (failure) {
      if (!controller.signal.aborted && request === requestId.current)
        setActionError(errorText(failure));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const retryRepositories = async () => {
    if (inFlight.current || loading) return;
    inFlight.current = true;
    setBusy(true);
    const request = requestId.current;
    const controller = new AbortController();
    moreController.current = controller;
    try {
      const repositories = await ledgerApi.repositories({}, { signal: controller.signal });
      if (!controller.signal.aborted && request === requestId.current)
        setData((old) => old && ({ ...old, repositories, repositoryError: null }));
    } catch (failure) {
      if (!controller.signal.aborted && request === requestId.current) {
        if (failure?.status === 401 || (failure?.status === 403 &&
            !failure?.payload?.error?.code?.startsWith("GITHUB_"))) {
          setData(null);
          setError(errorText(failure));
        } else setData((old) => old && ({ ...old, repositories: null, repositoryError: failure }));
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const saveExpense = async (fields, idempotencyKey) => {
    const current = editing;
    let result;
    let failure;
    setSavedAssistance(null);
    const ok = await action(async () => {
      try {
        result = await (current
          ? ledgerApi.updateExpense(current.id, current.revision, fields, {})
          : ledgerApi.createExpense(fields, idempotencyKey, {}));
      } catch (error) { failure = error; throw error; }
    });
    if (ok) {
      setSavedAssistance(result?.assistance ? { ...result.assistance,
        savedTargetKind: result.target?.kind || fields.target?.kind } : null);
      setEditing(null);
      setCreatingExpense(false);
      restoreExpenseFocus.current = true;
    }
    return { error: failure };
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
  const suggestedTargetKind = savedAssistance?.suggestions?.targetKind;
  const targetAdvice = ["shared", "project"].includes(suggestedTargetKind) &&
    ["shared", "project"].includes(savedAssistance?.savedTargetKind) &&
    suggestedTargetKind !== savedAssistance.savedTargetKind
      ? suggestedTargetKind === "shared"
        ? T("This expense may belong in the shared pool. Review its destination.", "这笔支出可能更适合公共池，请核对归属。")
        : T("This expense may be project-specific. Review its destination.", "这笔支出可能仅属于某个项目，请核对归属。")
      : "";
  const activeCategories = data?.categories?.filter((category) => !category.archivedAt) || [];
  const canAddExpense = Boolean(
    activeCategories.length > 0 &&
    (mode === "shared" || (mode === "project" && data?.project?.githubAccess === "authorized"))
  );
  const showExpenseForm = Boolean(editing || (canAddExpense && creatingExpense));
  useEffect(() => {
    if (!showExpenseForm && !loading && !busy && restoreExpenseFocus.current) {
      restoreExpenseFocus.current = false;
      expenseOpenerRef.current?.focus();
    }
  }, [showExpenseForm, loading, busy]);
  const availableRepos =
    data?.repositories?.items?.filter(
      (repo) => !data.projects.items.some((project) => project.githubRepoId === repo.githubRepoId)
    ) || [];
  const selectedRepository =
    availableRepos.find((repo) => String(repo.githubRepoId) === selectedRepo) || availableRepos[0];
  const needsGitHubReconnect = data?.repositories?.githubAccess === "reauthorization_required" ||
    data?.project?.githubAccess === "reauthorization_required";
  const showProjectForm = Boolean(data?.repositories && !needsGitHubReconnect &&
    (addingProject || data.projects?.items.length === 0));
  const matchingProjects =
    data?.projects?.items.filter((project) =>
      `${project.githubFullName || ""} ${project.description || ""}`
        .toLowerCase()
        .includes(projectSearch.trim().toLowerCase())
    ) || [];
  useEffect(() => {
    if (!addingProject && restoreProjectFocus.current) {
      restoreProjectFocus.current = false;
      projectOpenerRef.current?.focus();
    }
    if (!addingProject || !showProjectForm) return;
    const panel = addProjectPanelRef.current;
    const control = panel?.querySelector("select, button");
    panel?.scrollIntoView?.({ block: "center" });
    control?.focus({ preventScroll: true });
  }, [addingProject, showProjectForm]);
  const startAddingRepository = () => {
    if (busy || loading || loadingMore) return;
    if (!data?.repositories || needsGitHubReconnect) return;
    setAddingProject(true);
    const panel = addProjectPanelRef.current;
    const picker = panel?.querySelector("select");
    if (picker) {
      picker.scrollIntoView?.({ block: "center" });
      picker.focus({ preventScroll: true });
      try {
        picker.showPicker?.();
      } catch {
        // Focus remains usable where native pickers are unavailable or restricted.
      }
    } else if (availableRepos.length > 0) {
      // The newly revealed chooser is focused after it mounts.
    } else if (data?.repositories?.nextCursor) {
      panel?.scrollIntoView?.({ block: "center" });
      void loadMore("repositories");
    } else {
      void action(() => connectGitHubRepositories({ add: true }));
    }
  };
  return (
    <div className="app product-workspace ledger-screen fade-in">
      <Topbar
        go={go}
        breadcrumbs={
          mode === "project"
            ? [{ label: T("Projects"), go: "ledgerProjects" }, { label: title }]
            : [{ label: title }]
        }
        loading={loading}
      />
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
                        "Shared tools and services. Record each cost once, separate from project expenses.",
                        "共用工具和服务的费用只记一次，与各项目支出分开。"
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
            <div className="actions">
              {mode === "projects" && data?.projects.items.length > 0 && (
                <button
                  className="btn primary"
                  disabled={busy || loading || addingProject || !data.repositories || needsGitHubReconnect}
                  aria-expanded={showProjectForm}
                  aria-controls="add-repository"
                  onClick={(event) => {
                    projectOpenerRef.current = event.currentTarget;
                    setAddingProject(true);
                  }}
                >
                  <I.Plus size={14} /> {T("Add project", "添加项目")}
                </button>
              )}
              {(canAddExpense || (showExpenseForm && view !== "expenses")) && (
                <button
                  className="btn primary"
                  aria-expanded={showExpenseForm}
                  aria-controls="expense-form"
                  disabled={busy || loading || (showExpenseForm && view === "expenses")}
                  onClick={(event) => {
                    if (!showExpenseForm) {
                      expenseOpenerRef.current = event.currentTarget;
                      setEditing(null);
                      setCreatingExpense(true);
                    }
                    setView("expenses");
                  }}
                >
                  <I.Plus size={14} />{" "}
                  {showExpenseForm && view !== "expenses"
                    ? T("Continue draft", "继续填写")
                    : T("Add expense")}
                </button>
              )}
              {mode === "project" && (
                <a className="btn ghost" {...screenLinkProps(go, "ledgerProjects")}>
                  <I.ArrowL size={14} /> {T("Back to projects", "返回项目列表")}
                </a>
              )}
              <button
                className="btn ghost"
                onClick={reload}
                disabled={loading}
                aria-label={T("Reload")}
                title={T("Reload")}
              >
                <I.Refresh size={14} />
              </button>
            </div>
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
          {savedAssistance && (savedAssistance.categorySource === "jev" || savedAssistance.suggestions?.duplicateExpenseId || targetAdvice) && (
            <div className="notice" role="status">
              {savedAssistance.categorySource === "jev" && <p>
                {T("Jev categorized this expense", "Jev 已自动为这笔支出分类")}: {data?.categories?.find((item) => item.id === savedAssistance.suggestions?.categoryId)?.name || T("Saved", "已保存")}.
              </p>}
              {savedAssistance.suggestions?.duplicateExpenseId && <p>
                {T("This expense may duplicate an existing entry. Review your records.", "这笔支出可能与已有记录重复，请核对账目。")}
              </p>}
              {targetAdvice && <p>{targetAdvice}</p>}
            </div>
          )}
          {data && mode === "projects" && data.repositoryError && (
            <div role="alert" className="notice">
              <p>{errorText(data.repositoryError)}</p>
              <button className="btn" disabled={busy || loading} onClick={retryRepositories}>
                {T("Check repository access", "检查仓库授权")}
              </button>
            </div>
          )}
          {needsGitHubReconnect && (
            <div role="alert" className="notice">
              <p>{errorText({ payload: { error: { code: "GITHUB_REAUTHORIZATION_REQUIRED" } } })}</p>
              <button className="btn primary" disabled={busy || loading} onClick={reconnectGitHub}>
                {T("Reconnect GitHub", "重新连接 GitHub")}
              </button>
            </div>
          )}
          {loading && !data && <LedgerSkeleton mode={mode} />}
          {data && mode === "projects" && (
            <>
              {data.projects.items.length === 0 && data.repositories && !needsGitHubReconnect && (
                <section className="panel" aria-label={T("Get started", "开始使用")}>
                  <div className="panel-h">
                    <h2>{T("A clear path to your first expense", "三步，记下第一笔支出")}</h2>
                  </div>
                  <ol className="setup-steps">
                    <li aria-current="step">
                      <span className="setup-number">01</span>
                      <div>
                        <strong>
                          <a
                            href="#add-repository"
                            onClick={(event) => {
                              event.preventDefault();
                              startAddingRepository();
                            }}
                          >
                            {T("Add a repository", "添加一个仓库")} <I.ArrowR size={12} />
                          </a>
                        </strong>
                        <p>{T("Choose the project you want to track.", "选择你想记账的项目。")}</p>
                      </div>
                    </li>
                    <li>
                      <span className="setup-number">
                        {activeCategories.length ? <I.Check size={14} /> : "02"}
                      </span>
                      <div>
                        <strong>
                          <a {...screenLinkProps(go, "ledgerCategories")}>
                            {T("Create categories")} <I.ArrowR size={12} />
                          </a>
                        </strong>
                        <p>
                          {T(
                            "Hosting, domains, AI tools — make it yours.",
                            "托管、域名、AI 工具，按需分类。"
                          )}
                        </p>
                      </div>
                    </li>
                    <li>
                      <span className="setup-number">03</span>
                      <div>
                        <strong>{T("Record expenses")}</strong>
                        <p>
                          {T(
                            "Open a project and add your first expense.",
                            "打开项目，添加第一笔支出。"
                          )}
                        </p>
                      </div>
                    </li>
                  </ol>
                </section>
              )}
              <div
                className={
                  showProjectForm && data.projects.items.length > 0 ? "ledger-split" : undefined
                }
              >
                {data.projects.items.length > 0 && (
                  <section className="panel ledger-your-projects">
                    <div className="panel-h">
                      <I.Folder size={20} />
                      <h2>{T("Your projects")}</h2>
                      <span className="count">
                        {data.projects.items.length}
                        {data.projects.nextCursor ? "+" : ""}
                      </span>
                    </div>
                    {data.projects.items.length > 0 && (
                      <div className="ledger-search">
                        <I.Search size={16} />
                        <input
                          type="search"
                          aria-label={T("Find a project", "查找项目")}
                          placeholder={T("Find a project", "查找项目")}
                          value={projectSearch}
                          onChange={(event) => setProjectSearch(event.target.value)}
                        />
                        {projectSearch && (
                          <button className="btn ghost sm" onClick={() => setProjectSearch("")}>
                            {T("Clear search", "清除搜索")}
                          </button>
                        )}
                      </div>
                    )}
                    {projectSearch.trim() && matchingProjects.length === 0 && (
                      <div className="empty">
                        <I.Search size={24} />
                        <h3>{T("No matching projects", "没有匹配的项目")}</h3>
                        <p>
                          {T(
                            "Try another name or load more projects.",
                            "换个名称搜索，或加载更多项目。"
                          )}
                        </p>
                      </div>
                    )}
                    <div className="ledger-list">
                      {matchingProjects.map((project) => (
                        <a
                          className="ledger-project-row"
                          key={project.id}
                          {...screenLinkProps(go, "ledgerProject", { id: project.id })}
                        >
                          <span className="ledger-project-icon">
                            <I.GitBranch size={18} />
                          </span>
                          <div className="ledger-row-main">
                            <h3>
                              {project.githubFullName ||
                                project.description ||
                                T("Project history")}
                            </h3>
                            {project.description && project.githubFullName && (
                              <p>{project.description}</p>
                            )}
                            {project.githubAccess === "lost" && (
                              <p className="ledger-access-lost">
                                {T("GitHub access lost", "GitHub 授权已失效")}
                              </p>
                            )}
                            {project.githubAccess === "unavailable" && (
                              <p>{T("GitHub access could not be verified", "暂时无法验证 GitHub 授权")}</p>
                            )}
                          </div>
                          <span className="ledger-project-total">
                            {project.totals.map(formatTotal).join(" · ") || T("No expenses")}
                          </span>
                          <I.ArrowR size={16} />
                        </a>
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
                )}
                {showProjectForm && (
                  <section className="panel" id="add-repository" ref={addProjectPanelRef}>
                    <div className="panel-h">
                      <I.Github size={20} />
                      <h2>
                        {data.projects.items.length === 0
                          ? T("Your first project starts here", "从第一个项目开始")
                          : T("Add a repository", "添加一个仓库")}
                      </h2>
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
                        <div className="ledger-field">
                          <label htmlFor={repositoryFieldId}>{T("Repository")}</label>
                          <select
                            id={repositoryFieldId}
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
                        </div>
                        <details className="disclosure">
                          <summary>
                            {T("Project description (optional)", "项目说明（选填）")}
                          </summary>
                          <div className="ledger-field">
                            <label htmlFor={projectDescriptionId}>{T("Project description")}</label>
                            <textarea
                              id={projectDescriptionId}
                              value={description}
                              maxLength={2000}
                              placeholder={T(
                                "What are you building? (optional)",
                                "这个项目是做什么的？（选填）"
                              )}
                              disabled={busy}
                              onChange={(event) => setDescription(event.target.value)}
                            />
                          </div>
                        </details>
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
                      className={
                        availableRepos.length || data.repositories.nextCursor
                          ? "btn ghost"
                          : "btn primary"
                      }
                      disabled={busy || loading}
                      onClick={() => action(() => connectGitHubRepositories({ add: true }))}
                    >
                      <I.Github size={14} /> {T("Manage GitHub access")}
                    </button>
                    {data.projects.items.length > 0 && (
                      <button
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => {
                          restoreProjectFocus.current = true;
                          setAddingProject(false);
                        }}
                      >
                        {T("Cancel")}
                      </button>
                    )}
                  </section>
                )}
                <details
                  className="panel ledger-overview"
                  open={data.summaryError || Object.keys(filtered).length ? true : undefined}
                >
                  <summary className="panel-h">
                    <I.Activity size={20} />
                    <h2>{T("Account overview")}</h2>
                  </summary>
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
                  <div className="ledger-stats">
                    {data.summary?.groups
                      .filter((group) => group.target === "account")
                      .map((group) => (
                        <article className="ledger-stat" key={group.currency}>
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
                  <LedgerFilters
                    filters={filters}
                    onChange={setFilters}
                    categories={data.categories}
                  />
                </details>
              </div>
            </>
          )}
          {data && mode === "categories" && (
            <div className="ledger-split">
              <section className="panel">
                <div className="panel-h">
                  <I.Layers size={20} />
                  <h2>{T("Your categories")}</h2>
                  <span className="count">{data.categories.length}</span>
                </div>
                {data.categories.length === 0 && (
                  <div className="empty">
                    <I.Folder size={28} />
                    <h3>{T("Give your expenses a home", "先为支出建个分类")}</h3>
                    <p>
                      {T(
                        "Create your first category. You will choose one when recording an expense.",
                        "先创建第一个分类，记账时就可以选择了。"
                      )}
                    </p>
                  </div>
                )}
                <div className="ledger-list">
                  {data.categories.map((category) => (
                    <article className="ledger-category-row" key={category.id}>
                      <div className="ledger-row-main">
                        <h3>{category.name}</h3>
                        <p className="ledger-meta">
                          {category.archivedAt
                            ? T(
                                "Archived · past expenses keep this category",
                                "已归档 · 以前的支出仍保留此分类"
                              )
                            : T("Ready to use", "可用于记账")}
                        </p>
                      </div>
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
                              if (ok) {
                                restoreCategoryFocus.current = true;
                                setCategoryEdit(null);
                              }
                            });
                          }}
                        >
                          <label>
                            {T("New category name")}
                            <input
                              autoFocus
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
                            className="btn ghost sm"
                            type="button"
                            onClick={() => {
                              restoreCategoryFocus.current = true;
                              setCategoryEdit(null);
                            }}
                          >
                            {T("Cancel")}
                          </button>
                        </form>
                      )}
                      {!category.archivedAt && categoryEdit?.id !== category.id && (
                        <div className="ledger-actions">
                          {confirmCategoryId !== category.id && (
                            <button
                              className="btn ghost sm"
                              disabled={busy}
                              onClick={(event) => {
                                categoryEditorRowRef.current =
                                  event.currentTarget.closest("article");
                                setCategoryEdit({ id: category.id, name: category.name });
                              }}
                            >
                              {T("Rename")}
                            </button>
                          )}
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
                              className="btn ghost sm"
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
                <div className="panel-h">
                  <I.Plus size={20} />
                  <h2>{T("Add category")}</h2>
                </div>
                <p className="ledger-help">
                  {T(
                    "Try Hosting, Domains or AI tools. You can use the same categories in every project.",
                    "比如「托管」「域名」「AI 工具」，所有项目都可以使用这些分类。"
                  )}
                </p>
                <form
                  className="ledger-form"
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
              {loading && <p className="ledger-help" role="status">
                {T("Updating results… Previous results remain visible.", "正在更新结果，当前仍显示此前的数据。")}
              </p>}
              <ViewTabs
                id={viewId}
                label={T("Ledger views", "账本视图")}
                tabs={[
                  { key: "expenses", label: T("Expenses") },
                  { key: "reports", label: T("Reports", "报表") },
                  ...(mode === "project"
                    ? [{ key: "settings", label: T("Project settings", "项目设置") }]
                    : []),
                ]}
                value={view}
                onChange={setView}
              />
              {data.project?.githubAccess === "lost" && (
                <div className="notice" role="status">
                  {T(
                    "GitHub access lost. You can review, edit and remove historical expenses. Reconnect GitHub to add new expenses."
                  )}
                </div>
              )}
              {data.project?.githubAccess === "unavailable" && (
                <div className="notice" role="status">
                  {T(
                    "GitHub access could not be verified. You can review, edit and remove historical expenses; adding new expenses is paused.",
                    "暂时无法验证 GitHub 授权。你仍可查看、编辑和删除历史支出，新增支出暂时不可用。"
                  )}
                </div>
              )}
              <section className="panel" hidden={view === "settings"} aria-busy={loading}>
                <div className="panel-h">
                  <I.Trend size={20} />
                  <h2>{T("Totals by currency")}</h2>
                  <span className="count">
                    {Object.keys(filtered).length
                      ? T("Filtered spending", "筛选内支出")
                      : T("All time", "全部时间")}
                  </span>
                </div>
                {data.summaryError && (
                  <p role="status">{T("Spending summary is unavailable. Reload to try again.", "支出汇总暂不可用，重新加载后可再试。")}</p>
                )}
                {data.summary?.groups.length === 0 && (
                  <p className="ledger-help">
                    {T(
                      "Your spending totals will appear after you record an expense.",
                      "记下第一笔支出后，这里就会显示合计。"
                    )}
                  </p>
                )}
                <div className="ledger-stats">
                  {data.summary?.groups
                    .filter(
                      (group) =>
                        group.target === mode &&
                        (mode === "shared" || group.projectId === projectId)
                    )
                    .map((group) => (
                      <article className="ledger-stat" key={group.currency}>
                        <h3>{formatTotal(group)}</h3>
                      </article>
                    ))}
                </div>
                <div className="ledger-filter-bar">
                  <details
                    className="disclosure ledger-filter-disclosure"
                    open={Object.keys(filtered).length ? true : undefined}
                  >
                    <summary>
                      <I.Sliders size={14} />
                      {T("Filters", "筛选")}
                    </summary>
                    <LedgerFilters
                      filters={filters}
                      onChange={setFilters}
                      categories={data.categories}
                    />
                  </details>
                  <div className="ledger-actions">
                    {Object.keys(filtered).length > 0 && (
                      <button
                        className="btn ghost"
                        onClick={() => setFilters({ from: "", to: "", categoryId: "" })}
                      >
                        {T("Clear filters", "清除筛选")}
                      </button>
                    )}
                    <a className="btn" href={exportHref} download="expenses.csv">
                      <I.Download size={14} /> {T("Export CSV")}
                    </a>
                  </div>
                </div>
              </section>
              <div
                role="tabpanel"
                id={`${viewId}-panel-expenses`}
                aria-labelledby={`${viewId}-tab-expenses`}
                aria-busy={loading}
                tabIndex={0}
                hidden={view !== "expenses"}
              >
                <div className={showExpenseForm ? "ledger-split ledger-entry" : undefined}>
                  <section className="panel">
                    <div className="panel-h">
                      <I.Database size={20} />
                      <h2>{T("Expenses")}</h2>
                      <span className="count">
                        {expenses.length}
                        {data.expenses.nextCursor ? "+" : ""}
                      </span>
                    </div>
                    {!showExpenseForm && activeCategories.length === 0 && (
                      <p className="ledger-help">
                        {T(
                          "Start by adding a category, such as Hosting or AI tools.",
                          "先添加一个分类，比如「托管」或「AI 工具」。"
                        )}{" "}
                        <button className="btn" onClick={() => go("ledgerCategories")}>
                          {T("Manage categories")}
                        </button>
                      </p>
                    )}
                    {expenses.length === 0 && (
                      <div className="empty">
                        <I.Database size={28} />
                        <h3>
                          {Object.keys(filtered).length
                            ? T("No expenses match these filters", "没有符合筛选条件的支出")
                            : T("No expenses for this target yet.")}
                        </h3>
                        <p>
                          {Object.keys(filtered).length
                            ? T(
                                "Adjust the date range or category to see other expenses.",
                                "调整日期范围或分类，查看其他支出。"
                              )
                            : T(
                                "Record hosting, a domain, or a tool subscription to get started.",
                                "从托管、域名或工具订阅开始，记下第一笔支出。"
                              )}
                        </p>
                        {canAddExpense && !showExpenseForm && !Object.keys(filtered).length && (
                          <button
                            className="btn primary"
                            onClick={(event) => {
                              expenseOpenerRef.current = event.currentTarget;
                              setEditing(null);
                              setCreatingExpense(true);
                            }}
                          >
                            {T("Record an expense", "记录一笔支出")} <I.ArrowR size={14} />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="ledger-list">
                      {expenses.map((expense) => (
                        <article className="ledger-expense-row" key={expense.id}>
                          <div className="ledger-row-main">
                            <h3>{expense.purpose}</h3>
                            <p className="ledger-meta">
                              {expense.occurredOn} ·{" "}
                              {data.categories.find(
                                (category) => category.id === expense.categoryId
                              )?.name || T("Archived category")}
                            </p>
                            {expense.note && <p>{expense.note}</p>}
                          </div>
                          <div className="ledger-row-side">
                            <strong className="ledger-amount">
                              {expense.currency} {expense.amount}
                            </strong>
                            <div className="ledger-actions">
                              <button
                                className="btn ghost sm"
                                disabled={busy}
                                onClick={(event) => {
                                  expenseOpenerRef.current = event.currentTarget;
                                  setEditing(expense);
                                }}
                                aria-label={`${T("Edit")} ${expense.purpose}`}
                              >
                                {T("Edit")}
                              </button>
                              {confirmId === expense.id ? (
                                <>
                                  <button
                                    className="btn ghost sm"
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
                                  className="btn ghost sm"
                                  disabled={busy}
                                  onClick={() => setConfirmId(expense.id)}
                                  aria-label={`${T("Remove")} ${expense.purpose}`}
                                >
                                  {T("Remove")}
                                </button>
                              )}
                            </div>
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
                  {showExpenseForm && (
                    <section className="panel" id="expense-form" ref={expenseFormPanelRef}>
                      <div className="panel-h">
                        <I.Plus size={20} />
                        <h2>{editing ? T("Edit expense") : T("Add expense")}</h2>
                      </div>
                      {activeCategories.length === 0 ? (
                        <p>
                          {T(
                            "Start by adding a category, such as Hosting or AI tools.",
                            "先添加一个分类，比如「托管」或「AI 工具」。"
                          )}{" "}
                          <button className="btn" onClick={() => go("ledgerCategories")}>
                            {T("Manage categories")}
                          </button>
                        </p>
                      ) : (
                        <p className="ledger-help">
                          {T(
                            "What did you pay for? Add the amount, date and a category below.",
                            "这笔钱花在哪儿了？在下面填好金额、日期和分类。"
                          )}
                        </p>
                      )}
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
                        onCancel={() => {
                          setEditing(null);
                          setCreatingExpense(false);
                          restoreExpenseFocus.current = true;
                        }}
                      />
                    </section>
                  )}
                </div>
              </div>
              <div
                role="tabpanel"
                id={`${viewId}-panel-reports`}
                aria-labelledby={`${viewId}-tab-reports`}
                aria-busy={loading}
                tabIndex={0}
                hidden={view !== "reports"}
              >
                <div className="ledger-reports">
                  <ReportGroups
                    title={T("Expenses over time")}
                    groups={data.timeseries?.groups}
                    error={data.timeseriesError}
                    dimension="bucket"
                    icon={I.Clock}
                  />
                  <ReportGroups
                    title={T("Expenses by category")}
                    groups={data.categoryReport?.groups}
                    error={data.categoryReportError}
                    categories={data.categories}
                    dimension="category"
                    icon={I.Layers}
                  />
                </div>
              </div>
              {mode === "project" && (
                <section
                  className="panel"
                  role="tabpanel"
                  id={`${viewId}-panel-settings`}
                  aria-labelledby={`${viewId}-tab-settings`}
                  tabIndex={0}
                  hidden={view !== "settings"}
                >
                  <div className="panel-h">
                    <I.FileCode size={20} />
                    <h2>{T("Project description")}</h2>
                  </div>
                  <p className="ledger-help">
                    {T(
                      "A short description helps you recognize this project.",
                      "用一句简短说明，方便辨认这个项目。"
                    )}
                  </p>
                  <form
                    className="ledger-form"
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
                    <div className="ledger-field">
                      <label htmlFor={projectDescriptionId}>{T("Description")}</label>
                      <textarea
                        id={projectDescriptionId}
                        value={description}
                        maxLength={2000}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </div>
                    <div className="ledger-actions">
                      <button className="btn primary" type="submit" disabled={busy}>
                        {T("Save description")}
                      </button>
                    </div>
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
