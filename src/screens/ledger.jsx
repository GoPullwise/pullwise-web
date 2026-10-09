import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ledgerApi } from "../api/ledger.js";
import { EXPENSE_CAPACITY_COPY, EXPENSE_CAPACITY_ERRORS } from "../locales/expense-capacity.js";
import { SkeletonLine } from "../components/skeleton.jsx";
import { LedgerSplit } from "../components/ledger-split.jsx";
import { ConsoleLayout } from "../components/console-layout.jsx";
import { FinancialValue } from "../components/financial-value.jsx";
import { RecurringExpenses, RecurringScheduleFields } from "../components/recurring-expenses.jsx";
import {
  PROJECT_URL_MAX_BYTES,
  githubOrganizationHref,
  githubRepositoryHref,
  normalizeProjectUrl,
  projectUrlHref,
} from "../lib/project-links.js";
import { ExpenseCharts } from "../components/expense-charts.jsx";
import { ActivityLog } from "../components/activity-log.jsx";
import { ConfirmDialog } from "../components/confirm-dialog.jsx";
import { ExpenseReviewDialog } from "../components/expense-review-dialog.jsx";
import { env } from "../config/env.js";
import {
  categoryDisplayName,
  isActiveCategory,
  isRemovedCategory,
} from "../lib/category-label.js";
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

function isLedgerAccessFailure(failure) {
  const code = failure?.code || failure?.payload?.error?.code;
  return (
    [403, 404].includes(failure?.status) &&
    !code?.startsWith("GITHUB_") &&
    code !== "RECURRING_RULE_LIMIT" && !EXPENSE_CAPACITY_ERRORS.includes(code)
  );
}

function errorText(error) {
  const code = error?.payload?.error?.code;
  const jevPlanRequired = T(
    "Jev assistance requires the ledger Owner's Pro or Max plan.",
    "Jev 辅助需要账本所有者的 Pro 或 Max 套餐。"
  );
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
    GITHUB_ACCESS_REQUIRED: T(
      "Repository access changed. Reload repositories and choose ones you can access.",
      "仓库授权已变化。请重新加载仓库，并选择你有权访问的仓库。"
    ),
    GITHUB_ORGANIZATION_ACCESS_REQUIRED: T(
      "Organization access changed. Reload your GitHub repositories before changing this project.",
      "组织授权已变化。修改项目之前请重新加载 GitHub 仓库。"
    ),
    PROJECT_CONFLICT: T(
      "A selected repository already belongs to another project. Reload projects and choose another repository.",
      "所选仓库已属于另一个项目。请重新加载项目，并选择其他仓库。"
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
    RECORD_LIMIT: T(...EXPENSE_CAPACITY_COPY.full),
    RETENTION_CLEANUP_REQUIRED: T(...EXPENSE_CAPACITY_COPY.cleanup),
    RETENTION_TARGET_FORBIDDEN: T(...EXPENSE_CAPACITY_COPY.forbidden),
    RECURRING_RULE_LIMIT: T(
      "Recurring schedule allowance reached. Existing schedules and expenses remain available.",
      "周期计划额度已用完，已有计划和支出仍可访问。"
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
    JEV_PLAN_REQUIRED: jevPlanRequired,
    MAX_REQUIRED: jevPlanRequired,
    CATEGORY_REQUIRED: T(
      "Choose a category to finish saving. Your draft is still here.",
      "请选择类别后保存，已填写的内容已保留。"
    ),
    CATEGORY_IN_USE: T(
      "Category removal could not be completed. Reload and try again.",
      "未能完成类别移除，请重新加载后重试。",
    ),
    INVALID_CATEGORY: T(
      "Choose an active category and retry. Your draft is still here.",
      "请选择启用的类别后重试，已填写的内容已保留。",
    ),
    CATEGORY_REMOVED: T(
      "This category was removed. Reload to update your choices.",
      "此类别已移除，请重新加载以更新选项。",
    ),
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

function projectRemovalErrorText(error) {
  const code = error?.code || error?.payload?.error?.code;
  if (code === "PROJECT_OWNER_SESSION_REQUIRED")
    return T(
      "Sign in as the ledger Owner to remove this project.",
      "请以账本 Owner 身份登录后移除此项目。"
    );
  if (error?.status === 428 || ["REVISION_LIMIT", "PROJECT_BINDINGS_INVALID"].includes(code))
    return T("Save conflict. Reload the latest record before retrying.");
  return errorText(error);
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

function LedgerTotal({ total }) {
  return (
    <FinancialValue
      value={formatTotal(total)}
      currency={total.currency}
      numeric={minorAmount(total.amountMinor) !== null && typeof total.currency === "string"}
    />
  );
}

function formatRecurringTotal(rule) {
  return typeof rule.currency === "string" && typeof rule.amount === "string"
    ? `${rule.currency} ${rule.amount}`
    : T("Unavailable");
}

function LedgerFilters({ filters, onChange, categories = [], disabled = false }) {
  const fieldId = useId();
  const update = (name, value) => {
    if (!disabled) onChange((old) => ({ ...old, [name]: value }));
  };
  return (
    <div className="ledger-filters">
      <div className="ledger-field">
        <label htmlFor={`${fieldId}-from`}>{T("From date")}</label>
        <input
          id={`${fieldId}-from`}
          type="date"
          disabled={disabled}
          value={filters.from}
          onChange={(event) => update("from", event.target.value)}
        />
      </div>
      <div className="ledger-field">
        <label htmlFor={`${fieldId}-before`}>{T("Before date", "截止日期（不含当天）")}</label>
        <input
          id={`${fieldId}-before`}
          type="date"
          disabled={disabled}
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => update("to", event.target.value)}
        />
      </div>
      <div className="ledger-field">
        <label htmlFor={`${fieldId}-category`}>{T("Filter category")}</label>
        <select
          disabled={disabled}
          id={`${fieldId}-category`}
          value={filters.categoryId}
          onChange={(event) => update("categoryId", event.target.value)}
        >
          <option value="">{T("All categories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryDisplayName(
                category,
                T("Removed", "已移除"),
                T("Category not loaded", "类别尚未加载"),
              )}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function LedgerViewToolbar({
  id,
  mode,
  view,
  onViewChange,
  filters,
  onFiltersChange,
  categories,
  expanded,
  onExpandedChange,
  exportHref,
  disabled = false,
  exportDisabled = false,
  onReview = null,
  reviewDisabled = false,
}) {
  const filterCount = Object.values(filters).filter(Boolean).length;
  const filtersId = `${id}-filters`;
  return (
    <>
      <div className="ledger-view-toolbar">
        <ViewTabs
          id={id}
          label={T("Ledger views", "账本视图")}
          tabs={[
            { key: "expenses", label: T("Expenses") },
            { key: "reports", label: T("Reports", "报表") },
            ...(mode === "project"
              ? [{ key: "settings", label: T("Project settings", "项目设置") }]
              : []),
            { key: "activity", label: T("Operation log", "操作记录") },
          ]}
          value={view}
          onChange={onViewChange}
        />
        <div className="ledger-view-controls" hidden={["settings", "activity"].includes(view)}>
          {view === "expenses" && onReview && (
            <button
              className="btn ghost"
              type="button"
              disabled={reviewDisabled}
              onClick={onReview}
            >
              <I.Check size={14} aria-hidden="true" /> {T("Expense review", "账目巡检")}
            </button>
          )}
          <button
            className="btn ghost"
            type="button"
            aria-expanded={expanded}
            aria-controls={filtersId}
            onClick={() => onExpandedChange(!expanded)}
          >
            <I.Sliders size={14} aria-hidden="true" /> {T("Filters", "筛选")}
            {filterCount > 0 && (
              <span className="numeric-count ledger-filter-count">{filterCount}</span>
            )}
          </button>
          {filterCount > 0 && (
            <button
              className="btn ghost"
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onFiltersChange({ from: "", to: "", categoryId: "" });
              }}
            >
              {T("Clear filters", "清除筛选")}
            </button>
          )}
          <a
            className="btn ghost"
            href={exportDisabled ? undefined : exportHref}
            download={exportDisabled ? undefined : "expenses.csv"}
            role={exportDisabled ? "link" : undefined}
            aria-disabled={exportDisabled || undefined}
            tabIndex={exportDisabled ? -1 : undefined}
            onClick={(event) => {
              if (exportDisabled) event.preventDefault();
            }}
            onAuxClick={(event) => {
              if (exportDisabled) event.preventDefault();
            }}
          >
            <I.Download size={14} aria-hidden="true" /> {T("Export CSV")}
          </a>
        </div>
      </div>
      <div
        className="ledger-filter-strip"
        id={filtersId}
        hidden={["settings", "activity"].includes(view) || !expanded}
      >
        <LedgerFilters
          filters={filters}
          onChange={onFiltersChange}
          categories={categories}
          disabled={disabled}
        />
      </div>
    </>
  );
}

function ReportGroups({ title, groups, error, categories = [], dimension, icon: IconComponent }) {
  const rows = groups || [];
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
        <p role="status">
          {T(
            "This report is unavailable. Reload to try again.",
            "此报表暂不可用，重新加载后可再试。"
          )}
        </p>
      ) : rows.length === 0 ? (
        <p>{T("No expenses in this range.")}</p>
      ) : (
        <ExpenseCharts
          title={title}
          groups={rows}
          categories={categories}
          dimension={dimension}
          formatTotal={formatTotal}
          minorAmount={minorAmount}
        />
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
  return (
    <div
      role="status"
      aria-label={T(mode === "project" ? "Loading project expenses…" : "Loading ledger…")}
    >
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
        </div>
      ) : (
        <div className="panel">
          {headingSkeleton}
          {listSkeleton}
        </div>
      )}
    </div>
  );
}

const boundRepositoryIds = (project) =>
  project?.githubRepoIds ||
  project?.repositories?.map((repo) => repo.githubRepoId) ||
  [project?.githubRepoId].filter(Boolean);
const projectLabel = (project) =>
  project.name ||
  project.repositories?.find((repo) => repo.githubAccess === "authorized" && repo.githubFullName)
    ?.githubFullName ||
  (!["lost", "unavailable", "reauthorization_required"].includes(project.githubAccess) &&
    project.githubFullName) ||
  project.description ||
  T("Project", "项目");

function ProjectExternalLinks({ project }) {
  const repositories = [...new Set(boundRepositoryIds(project))].map((id) => {
    const repository = project.repositories?.find((item) => item.githubRepoId === id);
    const metadata = repository || (!project.repositories?.length ? project : null);
    const href = githubRepositoryHref(metadata);
    return {
      id,
      href,
      label: href ? metadata.githubFullName : `${T("Repository", "仓库")} #${id}`,
    };
  });
  const organizationHref = githubOrganizationHref(project.githubOrganization);
  const developmentHref =
    project.githubAccess === "not_linked" ? projectUrlHref(project.developmentUrl) : null;
  const productHref = projectUrlHref(project.productUrl);
  const repositoryLink = ({ id, href, label }) =>
    href ? (
      <a key={id} href={href} target="_blank" rel="noopener noreferrer" draggable={false}>
        {label}
      </a>
    ) : (
      <span key={id}>{label}</span>
    );
  return (
    <div className="panel-actions ledger-project-links ledger-project-shortcuts">
      {project.githubAccess === "not_linked" && (
        <span className="ledger-meta">{T("No repositories linked", "未关联仓库")}</span>
      )}
      {repositories.length > 1 ? (
        <details className="disclosure ledger-project-repositories">
          <summary>
            {repositories.length} {T("repositories", "个仓库")}
          </summary>
          <div className="ledger-project-links">{repositories.map(repositoryLink)}</div>
        </details>
      ) : repositories.length === 1 ? (
        repositoryLink(repositories[0])
      ) : null}
      {organizationHref && (
        <a href={organizationHref} target="_blank" rel="noopener noreferrer" draggable={false}>
          {project.githubOrganization.login}
        </a>
      )}
      {developmentHref && (
        <a href={developmentHref} target="_blank" rel="noopener noreferrer" draggable={false}>
          {T("Development", "开发环境")} <span aria-hidden="true">↗</span>
        </a>
      )}
      {productHref && (
        <a href={productHref} target="_blank" rel="noopener noreferrer" draggable={false}>
          {T("Product", "产品")} <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  );
}

function ProjectLinkFields({ developmentUrl, productUrl, onChange, disabled }) {
  const developmentId = useId();
  const productId = useId();
  return (
    <>
      <div className="ledger-field">
        <label htmlFor={developmentId}>{T("Development URL (optional)", "开发网址（选填）")}</label>
        <input
          id={developmentId}
          value={developmentUrl}
          maxLength={PROJECT_URL_MAX_BYTES}
          inputMode="url"
          autoComplete="url"
          disabled={disabled}
          onChange={(event) => onChange("developmentUrl", event.target.value)}
        />
      </div>
      <div className="ledger-field">
        <label htmlFor={productId}>{T("Product URL (optional)", "产品网址（选填）")}</label>
        <input
          id={productId}
          value={productUrl}
          maxLength={PROJECT_URL_MAX_BYTES}
          inputMode="url"
          autoComplete="url"
          disabled={disabled}
          onChange={(event) => onChange("productUrl", event.target.value)}
        />
      </div>
      <p className="ledger-help">
        {T(
          "Use an HTTP or HTTPS URL. A bare domain will use HTTPS.",
          "使用 HTTP 或 HTTPS 网址，只填写域名时会使用 HTTPS。"
        )}
      </p>
      <p className="ledger-help">
        {T(
          "Development links are shown only when no GitHub repositories are linked.",
          "仅未关联 GitHub 仓库的项目显示开发链接。"
        )}
      </p>
    </>
  );
}

function ProjectListRow({ project, go, navigationDisabled = false }) {
  const productHref = projectUrlHref(project.productUrl);
  return (
    <article className="ledger-project-row">
      <div className="ledger-row-main">
        <h2>
          <a
            draggable={false}
            {...screenLinkProps(go, "ledgerProject", { id: project.id }, navigationDisabled)}
          >
            {projectLabel(project)}
          </a>
        </h2>
        {project.description && projectLabel(project) !== project.description && (
          <p>{project.description}</p>
        )}
        {project.status === "archived" && (
          <p className="ledger-meta">{T("Archived project", "已归档项目")}</p>
        )}
      </div>
      <div className="ledger-project-total">
        <span className="ledger-project-label">{T("Expense total", "支出合计")}</span>
        {project.totals.length
          ? project.totals.map((total) => <LedgerTotal key={total.currency} total={total} />)
          : T("No expenses")}
      </div>
      <div className="ledger-project-associations">
        {productHref && (
          <div className="ledger-project-links">
            <a href={productHref} target="_blank" rel="noopener noreferrer" draggable={false}>
              {T("Product", "产品")} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

function ExpenseForm({
  value,
  recurrence = null,
  categories,
  target,
  busy,
  submitDisabled = false,
  onSubmit,
  onCancel,
  api = ledgerApi,
}) {
  const noteId = useId();
  const categoryFieldId = useId();
  const expenseTypeId = useId();
  const recurringDateHelpId = useId();
  const [expenseType, setExpenseType] = useState(recurrence ? "recurring" : "one-time");
  const [schedule, setSchedule] = useState(() => {
    const now = new Date();
    let timezone = "UTC";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      /* UTC is a valid fallback for an older browser. */
    }
    return {
      frequency: "monthly",
      weekday: now.getDay() || 7,
      day: now.getDate(),
      quarterMonth: (now.getMonth() % 3) + 1,
      month: now.getMonth() + 1,
      timezone,
      endOn: null,
      ...recurrence,
    };
  });
  const [draft, setDraft] = useState(() =>
    value
      ? {
          occurredOn: value.occurredOn || recurrence?.startOn || "",
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
  const [automaticCategory, setAutomaticCategory] = useState(false);
  const [requiresCategory, setRequiresCategory] = useState(false);
  const categoryRef = useRef(null);
  const mounted = useRef(false);
  const createKey = useRef(requestKey());
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setAutomaticCategory(false);
    if (!recurrence && typeof api.me === "function") {
      api
        .me({ signal: controller.signal })
        .then((profile) => {
          if (!controller.signal.aborted)
            setAutomaticCategory(
              profile?.entitlements?.jev?.eligible === true &&
                profile.entitlements.jev.available === true
            );
        })
        .catch(() => {
          /* A profile outage leaves ordinary manual entry available. */
        });
    }
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [value, recurrence, api]);
  const categoryRequired = Boolean(
    expenseType === "recurring" || !automaticCategory || requiresCategory
  );
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
    if (busy || submitDisabled) return;
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
    const recurringSchedule =
      expenseType === "recurring"
        ? {
            frequency: schedule.frequency,
            timezone: schedule.timezone.trim(),
            startOn: draft.occurredOn,
            endOn: schedule.endOn || null,
            ...(schedule.frequency === "weekly" ? { weekday: Number(schedule.weekday) } : {}),
            ...(["monthly", "quarterly", "yearly"].includes(schedule.frequency)
              ? { day: Number(schedule.day) }
              : {}),
            ...(schedule.frequency === "quarterly"
              ? { quarterMonth: Number(schedule.quarterMonth) }
              : {}),
            ...(schedule.frequency === "yearly" ? { month: Number(schedule.month) } : {}),
          }
        : null;
    const result = await onSubmit(
      {
        target: value?.target || target,
        ...(recurringSchedule ? {} : { occurredOn: draft.occurredOn }),
        amount: draft.amount,
        currency: draft.currency.toUpperCase(),
        ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
        purpose: draft.purpose.trim(),
        note: draft.note || null,
        quantity: draft.quantity || null,
        unit: draft.unit || null,
      },
      createKey.current,
      recurringSchedule
    );
    if (mounted.current && result?.error?.payload?.error?.code === "CATEGORY_REQUIRED") {
      setRequiresCategory(true);
      setValidation(
        T(
          "Choose a category to finish saving. Your draft is still here.",
          "请选择类别后保存，已填写的内容已保留。"
        )
      );
    }
  };
  return (
    <form className="ledger-form" onSubmit={submit}>
      {!value && (
        <div className="ledger-field">
          <label htmlFor={expenseTypeId}>{T("Expense type", "支出类型")}</label>
          <select
            id={expenseTypeId}
            value={expenseType}
            disabled={busy}
            onChange={(event) => {
              createKey.current = requestKey();
              setValidation("");
              setExpenseType(event.target.value);
            }}
          >
            <option value="one-time">{T("One-time", "单次")}</option>
            <option value="recurring">{T("Recurring", "周期")}</option>
          </select>
        </div>
      )}
      <div className="ledger-fields">
        {field(
          "occurredOn",
          expenseType === "recurring"
            ? T("Start date (on or after)", "起始日期（当日或之后）")
            : T("Date"),
          {
            type: "date",
            required: true,
            "aria-describedby": expenseType === "recurring" ? recurringDateHelpId : undefined,
          }
        )}
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
            <option value="">
              {categoryRequired ? T("Select category") : T("Automatic", "自动分类")}
            </option>
            {categories
              .filter(
                (category) =>
                  isActiveCategory(category) ||
                  (category.id === value?.categoryId &&
                    (!isRemovedCategory(category) || !recurrence)),
              )
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryDisplayName(
                    category,
                    T("Removed", "已移除"),
                    T("Category not loaded", "类别尚未加载"),
                  )}
                </option>
              ))}
          </select>
        </div>
      </div>
      {expenseType === "recurring" && (
        <>
          <RecurringScheduleFields
            schedule={{ ...schedule, startOn: draft.occurredOn }}
            disabled={busy}
            onChange={(next) => {
              createKey.current = requestKey();
              setValidation("");
              setSchedule(next);
            }}
          />
          <p className="ledger-help" id={recurringDateHelpId}>
            {T(
              "The start date is the earliest date the schedule can run. Repeat dates follow the selected weekday or day of month; changing the start date does not change them. Save the schedule to apply changes.",
              "起始日期是计划最早可执行的日期。重复日期由所选星期或每月几号决定，修改起始日期不会改变重复日期；保存周期计划后改动才会生效。"
            )}
          </p>
          {schedule.frequency !== "weekly" && (
            <p className="ledger-help">
              {T(
                "If a month has fewer days, the schedule uses its last day.",
                "当月不足所选日期时，使用当月最后一天。"
              )}
            </p>
          )}
          {schedule.frequency === "quarterly" && (
            <p className="ledger-help">
              {T(
                "Quarterly dates use the selected month in each calendar quarter.",
                "季度日期使用每个自然季度中所选的月份。"
              )}
            </p>
          )}
          <p className="ledger-help">
            {T(
              "This schedule records an expense on each due date.",
              "此计划会在每个到期日记下一笔支出。"
            )}
          </p>
          {!value && (
            <p className="ledger-help">
              {T(
                "A past start date can create earlier expense records.",
                "过去的起始日期可能补记之前的支出。"
              )}
            </p>
          )}
        </>
      )}
      {!categoryRequired && (
        <p className="ledger-help">
          {T(
            "Jev will select a category when you save, or choose one yourself.",
            "保存时 Jev 会自动分类，你也可以自行选择。"
          )}
        </p>
      )}
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
        <button className="btn primary" type="submit" disabled={busy || submitDisabled}>
          {expenseType === "recurring" ? T("Save schedule", "保存周期计划") : T("Save expense")}
        </button>
        <button className="btn" type="button" disabled={busy} onClick={onCancel}>
          {T("Cancel")}
        </button>
      </div>
    </form>
  );
}

export function LedgerScreen(props) {
  const workspace = props.workspace;
  const identity = workspace
    ? `${workspace.id}:${workspace.role || ""}:${workspace.revision}:${workspace.memberRevision ?? workspace.revision}:${JSON.stringify(Object.entries(workspace.permissions || {}).sort(([left], [right]) => left.localeCompare(right)))}`
    : "personal";
  const scope = `${identity}:${props.mode || "projects"}:${props.projectId || ""}:${props.authorizationRevision || 0}`;
  return <ScopedLedgerScreen key={scope} {...props} />;
}

function ScopedLedgerScreen({
  go,
  mode = "projects",
  projectId = "",
  authorizationError = "",
  authorizationRevision = 0,
  api = ledgerApi,
  workspace = null,
  onAccessChanged,
  onReloadAccess,
  accessRefreshing = false,
}) {
  useLang();
  const canManageProjects = workspace ? workspace.permissions?.manageProjects === true : true;
  const canManageCategories = workspace ? workspace.permissions?.manageCategories === true : true;
  const canWriteExpenses = workspace ? workspace.permissions?.writeExpenses === true : true;
  const isWorkspaceOwner = Boolean(workspace?.id && workspace.role === "owner");
  const workspaceScope = `${workspace?.id || "personal"}:${workspace?.revision || 0}:${canManageProjects}:${canManageCategories}:${canWriteExpenses}`;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [savedAssistance, setSavedAssistance] = useState(null);
  const [savedSchedule, setSavedSchedule] = useState(null);
  const [revision, setRevision] = useState(0);
  const [loadedRequest, setLoadedRequest] = useState(0);
  const [filters, setFilters] = useState({ from: "", to: "", categoryId: "" });
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [parentBusy, setBusy] = useState(false);
  const [recurringBusy, setRecurringBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inspection, setInspection] = useState(null);
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewReadBusy, setReviewReadBusy] = useState(false);
  const writing = parentBusy || recurringBusy || reviewBusy || reviewReadBusy;
  const busy = writing || loadingMore || accessRefreshing || reviewReadBusy;
  const blocked = busy || loading;
  const [repositoryLoading, setRepositoryLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [developmentUrl, setDevelopmentUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectStatus, setProjectStatus] = useState("active");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [additionalRepoIds, setAdditionalRepoIds] = useState([]);
  const [organizationId, setOrganizationId] = useState("");
  const [projectRepoIds, setProjectRepoIds] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryEdit, setCategoryEdit] = useState(null);
  const [categoryAction, setCategoryAction] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const [projectRemoval, setProjectRemoval] = useState(null);
  const [projectRemovalError, setProjectRemovalError] = useState("");
  const [projectRemovalConflict, setProjectRemovalConflict] = useState(false);
  const [view, setView] = useState("expenses");
  const [projectSearch, setProjectSearch] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [linkRepositories, setLinkRepositories] = useState(false);
  const viewId = useId();
  const repositoryFieldId = useId();
  const projectNameId = useId();
  const organizationFieldId = useId();
  const projectDescriptionId = useId();
  const projectStatusId = useId();
  const projectSettingsBase = useRef(null);
  const projectSettingsDirty = useRef(false);
  const projectSearchRef = useRef(null);
  const projectOpenerRef = useRef(null);
  const restoreProjectFocus = useRef(false);
  const inFlight = useRef(false);
  const inspectionRef = useRef(null);
  const inspectionOpenRef = useRef(false);
  const inspectionOpenerRef = useRef(null);
  const restoreInspectionFocus = useRef(false);
  const reviewOperationRef = useRef(null);
  const reviewReadRef = useRef(null);
  const pendingReviewEdit = useRef(null);
  const projectRemovalRef = useRef(null);
  const removalOperationRef = useRef(null);
  const removalControllerRef = useRef(null);
  const removalBackgroundRef = useRef(null);
  const removalDescriptionRef = useRef(null);
  const writeRefreshPending = useRef(false);
  const recurringOperation = useRef(null);
  const readingGuard = useRef(false);
  readingGuard.current = loading || loadingMore || accessRefreshing || reviewReadBusy;
  const requestId = useRef(0);
  const moreController = useRef(null);
  const repositoryController = useRef(null);
  const loginController = useRef(null);
  const loadedScope = useRef(null);
  const mounted = useRef(false);
  const addProjectPanelRef = useRef(null);
  const expenseFormPanelRef = useRef(null);
  const expenseOpenerRef = useRef(null);
  const restoreExpenseFocus = useRef(false);
  const categoryEditorRowRef = useRef(null);
  const categoryEditorInputRef = useRef(null);
  const restoreCategoryDraftFocus = useRef(false);
  const restoreCategoryFocus = useRef(false);
  const categoryHeadingRef = useRef(null);
  const categoryActionOpeners = useRef(new Map());
  const categoryActionConfirm = useRef(null);
  const restoreCategoryActionFocus = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      removalOperationRef.current = null;
      removalControllerRef.current?.abort();
      reviewOperationRef.current = null;
      reviewReadRef.current = null;
      pendingReviewEdit.current = null;
    };
  }, []);
  const beginRecurringOperation = useCallback(() => {
    if (
      inFlight.current ||
      readingGuard.current ||
      projectRemovalRef.current ||
      inspectionOpenRef.current ||
      !mounted.current
    )
      return false;
    inFlight.current = true;
    const operation = {};
    recurringOperation.current = operation;
    setRecurringBusy(true);
    return () => {
      if (recurringOperation.current !== operation) return;
      recurringOperation.current = null;
      inFlight.current = false;
      if (mounted.current) setRecurringBusy(false);
    };
  }, []);
  const beginReviewOperation = useCallback(() => {
    if (
      !canWriteExpenses ||
      !inspectionOpenRef.current ||
      inFlight.current ||
      readingGuard.current ||
      !mounted.current
    )
      return null;
    const operation = {};
    reviewOperationRef.current = operation;
    inFlight.current = true;
    setReviewBusy(true);
    return () => {
      if (reviewOperationRef.current !== operation) return;
      reviewOperationRef.current = null;
      inFlight.current = false;
      if (mounted.current) setReviewBusy(false);
    };
  }, [canWriteExpenses]);
  const beginReviewEditRead = useCallback(() => {
    if (
      !canWriteExpenses ||
      !inspectionOpenRef.current ||
      inFlight.current ||
      readingGuard.current ||
      !mounted.current
    )
      return null;
    const read = {};
    reviewReadRef.current = read;
    readingGuard.current = true;
    setReviewReadBusy(true);
    return () => {
      if (reviewReadRef.current !== read) return;
      reviewReadRef.current = null;
      readingGuard.current = false;
      if (mounted.current) setReviewReadBusy(false);
    };
  }, [canWriteExpenses]);
  useEffect(() => {
    if (editing || creatingExpense) {
      const panel = expenseFormPanelRef.current;
      const field =
        panel?.querySelector('input[type="date"]:not([disabled])') ||
        panel?.querySelector("input:not([disabled]), select:not([disabled])");
      field?.scrollIntoView?.({ block: "center" });
      field?.focus({ preventScroll: true });
    }
  }, [editing, creatingExpense]);
  useEffect(() => {
    if (!categoryEdit) restoreCategoryDraftFocus.current = false;
    else if (!blocked && restoreCategoryDraftFocus.current) {
      categoryEditorInputRef.current?.focus({ preventScroll: true });
      restoreCategoryDraftFocus.current = false;
    }
    if (!categoryEdit && !blocked && restoreCategoryFocus.current) {
      categoryEditorRowRef.current
        ?.querySelector("[data-category-rename]")
        ?.focus({ preventScroll: true });
      restoreCategoryFocus.current = false;
    }
  }, [categoryEdit, blocked]);
  useEffect(() => {
    if (blocked) return;
    if (restoreCategoryActionFocus.current) {
      const { id, kind } = restoreCategoryActionFocus.current;
      restoreCategoryActionFocus.current = null;
      const opener = categoryActionOpeners.current.get(`${id}:${kind}`);
      if (opener && !opener.disabled) opener.focus({ preventScroll: true });
      else categoryHeadingRef.current?.focus({ preventScroll: true });
    } else if (categoryAction) {
      categoryActionConfirm.current?.focus({ preventScroll: true });
    }
  }, [categoryAction, blocked, data]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const reloadWithAccess = async ({ preserveProjectDraft = false } = {}) => {
    if (
      inFlight.current ||
      reviewReadRef.current ||
      inspectionOpenRef.current ||
      loading ||
      accessRefreshing ||
      !mounted.current
    )
      return;
    moreController.current?.abort();
    moreController.current = null;
    setLoadingMore(false);
    if (!preserveProjectDraft) {
      projectSettingsBase.current = null;
      projectSettingsDirty.current = false;
    }
    if (!onReloadAccess) {
      reload();
      return;
    }
    const request = requestId.current;
    readingGuard.current = true;
    setLoading(true);
    try {
      const unchanged = await onReloadAccess();
      if (!mounted.current || request !== requestId.current) return;
      if (unchanged) reload();
      else setLoading(false);
    } catch (failure) {
      if (mounted.current && request === requestId.current) {
        setActionError(errorText(failure));
        setLoading(false);
      }
    }
  };
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
      `${env.VITE_API_BASE_URL || ""}/api/v1/expenses/export?${new URLSearchParams({
        ...detailQuery,
        ...(workspace?.id ? { workspaceId: workspace.id } : {}),
      }).toString()}`,
    [detailQuery, workspace?.id]
  );
  useEffect(() => {
    const controller = new AbortController();
    moreController.current?.abort();
    moreController.current = null;
    setLoadingMore(false);
    const request = ++requestId.current;
    inspectionRef.current = null;
    inspectionOpenRef.current = false;
    pendingReviewEdit.current = null;
    setInspection(null);
    setInspectionOpen(false);
    setLoading(true);
    setError("");
    projectRemovalRef.current = null;
    setProjectRemoval(null);
    setProjectRemovalError("");
    setProjectRemovalConflict(false);
    const scope = `${workspaceScope}:${mode}:${projectId}:${authorizationRevision}`;
    if (loadedScope.current !== scope) {
      setData(null);
      setSavedAssistance(null);
      setSavedSchedule(null);
      setEditing(null);
      setCreatingExpense(false);
      setView("expenses");
      setAddingProject(false);
      setLinkRepositories(false);
      setProjectSearch("");
      setProjectName("");
      setProjectStatus("active");
      setDevelopmentUrl("");
      setProductUrl("");
      projectSettingsBase.current = null;
      projectSettingsDirty.current = false;
      setSelectedRepo("");
      setAdditionalRepoIds([]);
      setOrganizationId("");
      setProjectRepoIds([]);
      setConfirmId("");
      setActionError("");
      expenseOpenerRef.current = null;
      restoreExpenseFocus.current = false;
      projectOpenerRef.current = null;
      restoreProjectFocus.current = false;
      setCategoryEdit(null);
      setCategoryAction(null);
      categoryEditorRowRef.current = null;
      restoreCategoryDraftFocus.current = false;
      restoreCategoryFocus.current = false;
      restoreCategoryActionFocus.current = null;
    }
    loadedScope.current = scope;
    const options = { signal: controller.signal };
    const load = async () => {
      if (mode === "projects") {
        return {
          projects: await api.projects({}, options),
          repositories: null,
          repositoryError: null,
        };
      }
      if (mode === "categories") return { categories: await api.categories(options) };
      const optionalReport = (promise) =>
        promise.then(
          (value) => ({ value }),
          (failure) => {
            if (failure?.status === 401 || failure?.status === 403) throw failure;
            return { failure };
          }
        );
      const [
        categories,
        expenses,
        project,
        projects,
        timeseries,
        categoryReport,
      ] = await Promise.all([
        api.categories({ ...options, params: { includeRemoved: true } }),
        api.expenses(detailQuery, options),
        mode === "project"
          ? api.project(projectId, options)
          : Promise.resolve(null),
        api.projects({}, options),
        optionalReport(api.reportTimeseries(detailQuery, options)),
        optionalReport(api.reportCategories(detailQuery, options)),
      ]);
      return {
        categories,
        expenses,
        project,
        projects,
        repositories: null,
        repositoryError: null,
        timeseries: timeseries.value,
        timeseriesError: timeseries.failure ? errorText(timeseries.failure) : "",
        categoryReport: categoryReport.value,
        categoryReportError: categoryReport.failure ? errorText(categoryReport.failure) : "",
      };
    };
    load()
      .then((result) => {
        if (!controller.signal.aborted && request === requestId.current) {
          setData(result);
          setLoadedRequest(request);
          if (
            mode === "project" &&
            (!projectSettingsBase.current || !projectSettingsDirty.current)
          ) {
            projectSettingsBase.current = {
              revision: result.project.revision,
              name: result.project.name || "",
              githubRepoIds: boundRepositoryIds(result.project),
              githubOrganizationId: String(result.project.githubOrganizationId || ""),
              status: result.project.status || "active",
              developmentUrl: result.project.developmentUrl || null,
              productUrl: result.project.productUrl || null,
            };
            setDescription(result.project?.description || "");
            setProjectName(result.project?.name || "");
            setProjectStatus(result.project?.status || "active");
            setDevelopmentUrl(result.project?.developmentUrl || "");
            setProductUrl(result.project?.productUrl || "");
            setProjectRepoIds(boundRepositoryIds(result.project));
            setOrganizationId(String(result.project?.githubOrganizationId || ""));
            setLinkRepositories(boundRepositoryIds(result.project).length > 0);
          }
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted && request === requestId.current) {
          setData(null);
          setError(errorText(failure));
          if (isLedgerAccessFailure(failure)) onAccessChanged?.(failure);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && request === requestId.current) {
          setLoading(false);
          if (writeRefreshPending.current) {
            writeRefreshPending.current = false;
            inFlight.current = false;
            if (mounted.current) setBusy(false);
          }
        }
      });
    return () => {
      controller.abort();
      repositoryController.current?.abort();
      loginController.current?.abort();
      moreController.current?.abort();
      if (request === requestId.current) requestId.current += 1;
    };
  }, [
    mode,
    projectId,
    revision,
    filtered,
    detailQuery,
    authorizationRevision,
    workspaceScope,
    api,
    canManageProjects,
    onAccessChanged,
  ]);

  const hasData = Boolean(data);
  useEffect(() => {
    if (
      loading ||
      !hasData ||
      !canManageProjects ||
      !linkRepositories ||
      (mode !== "projects" && !(mode === "project" && view === "settings"))
    ) {
      setRepositoryLoading(false);
      return;
    }
    const controller = new AbortController();
    repositoryController.current = controller;
    const request = loadedRequest;
    setRepositoryLoading(true);
    api
      .repositories({}, { signal: controller.signal })
      .then((repositories) => {
        if (!controller.signal.aborted && request === requestId.current)
          setData((old) => old && { ...old, repositories, repositoryError: null });
      })
      .catch((failure) => {
        if (controller.signal.aborted || request !== requestId.current) return;
        if (failure?.status === 401 || isLedgerAccessFailure(failure)) {
          setData(null);
          setError(errorText(failure));
          if (isLedgerAccessFailure(failure)) onAccessChanged?.(failure);
        } else setData((old) => old && { ...old, repositories: null, repositoryError: failure });
      })
      .finally(() => {
        if (repositoryController.current === controller) repositoryController.current = null;
        if (!controller.signal.aborted && request === requestId.current)
          setRepositoryLoading(false);
      });
    return () => {
      controller.abort();
      repositoryController.current?.abort();
    };
  }, [
    api,
    canManageProjects,
    hasData,
    linkRepositories,
    loadedRequest,
    loading,
    mode,
    onAccessChanged,
    view,
    workspaceScope,
    authorizationRevision,
  ]);

  const loadMore = async (kind) => {
    const cursor = data?.[kind]?.nextCursor;
    if (
      !cursor ||
      loading ||
      loadingMore ||
      (moreController.current && !moreController.current.signal.aborted)
    )
      return;
    const request = requestId.current;
    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);
    setActionError("");
    try {
      const next =
        kind === "projects"
          ? await api.projects({ cursor }, { signal: controller.signal })
          : kind === "repositories"
            ? await api.repositories({ cursor }, { signal: controller.signal })
            : await api.expenses({ ...detailQuery, cursor }, { signal: controller.signal });
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
      if (!controller.signal.aborted && request === requestId.current) {
        setActionError(errorText(failure));
        if (isLedgerAccessFailure(failure)) {
          setData(null);
          onAccessChanged?.(failure);
        }
      }
    } finally {
      if (moreController.current === controller) moreController.current = null;
      if (request === requestId.current) setLoadingMore(false);
    }
  };

  const action = async (callback) => {
    if (
      inFlight.current ||
      readingGuard.current ||
      projectRemovalRef.current ||
      inspectionOpenRef.current
    )
      return false;
    inFlight.current = true;
    setBusy(true);
    setActionError("");
    const request = requestId.current;
    try {
      await callback();
      if (request !== requestId.current) return false;
      writeRefreshPending.current = true;
      setLoading(true);
      reload();
      return true;
    } catch (failure) {
      // The expense form shows category fallback beside its picker and focuses it.
      if (request === requestId.current) {
        setActionError(
          failure?.payload?.error?.code === "CATEGORY_REQUIRED" ? "" : errorText(failure)
        );
        if (isLedgerAccessFailure(failure)) {
          setData(null);
          setEditing(null);
          setCreatingExpense(false);
          setCategoryEdit(null);
          setCategoryAction(null);
          restoreCategoryActionFocus.current = null;
          setConfirmId("");
          onAccessChanged?.(failure);
        }
      }
      return false;
    } finally {
      if (!writeRefreshPending.current) {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };

  const closeCategoryAction = () => {
    if (blocked || inFlight.current || readingGuard.current) return;
    restoreCategoryActionFocus.current = categoryAction;
    setCategoryAction(null);
  };
  const confirmCategoryAction = (category) => {
    if (
      blocked ||
      !canManageCategories ||
      categoryAction?.id !== category.id ||
      categoryAction.scope !== loadedScope.current ||
      !mounted.current
    )
      return;
    const confirmation = categoryAction;
    action(() =>
      confirmation.kind === "remove"
        ? api.removeCategory(category.id, category.revision, {})
        : api.archiveCategory(category.id, category.revision, {})
    ).then((ok) => {
      if (ok && mounted.current && confirmation.scope === loadedScope.current) {
        restoreCategoryActionFocus.current = confirmation;
        setCategoryAction(null);
      }
    });
  };

  const reconnectGitHub = async () => {
    if (inFlight.current || readingGuard.current) return;
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
    if (
      repositoryLoading ||
      loading ||
      (repositoryController.current && !repositoryController.current.signal.aborted)
    )
      return;
    repositoryController.current?.abort();
    setRepositoryLoading(true);
    const request = requestId.current;
    const controller = new AbortController();
    repositoryController.current = controller;
    try {
      const repositories = await api.repositories({}, { signal: controller.signal });
      if (!controller.signal.aborted && request === requestId.current)
        setData((old) => old && { ...old, repositories, repositoryError: null });
    } catch (failure) {
      if (!controller.signal.aborted && request === requestId.current) {
        if (failure?.status === 401 || isLedgerAccessFailure(failure)) {
          setData(null);
          setError(errorText(failure));
          if (isLedgerAccessFailure(failure)) onAccessChanged?.(failure);
        } else setData((old) => old && { ...old, repositories: null, repositoryError: failure });
      }
    } finally {
      if (repositoryController.current === controller) repositoryController.current = null;
      if (!controller.signal.aborted && request === requestId.current) setRepositoryLoading(false);
    }
  };

  const saveExpense = async (fields, idempotencyKey, recurringSchedule = null) => {
    const current = editing;
    let result;
    let failure;
    setSavedAssistance(null);
    setSavedSchedule(null);
    const ok = await action(async () => {
      try {
        result = await (current
          ? api.updateExpense(current.id, current.revision, fields, {})
          : recurringSchedule
            ? api.createRecurringRule(
                { ...fields, schedule: recurringSchedule },
                idempotencyKey,
                {}
              )
            : api.createExpense(fields, idempotencyKey, {}));
      } catch (error) {
        failure = error;
        throw error;
      }
    });
    if (ok) {
      if (recurringSchedule && result?.id) setSavedSchedule(result);
      setSavedAssistance(
        result?.assistance
          ? { ...result.assistance, savedTargetKind: result.target?.kind || fields.target?.kind }
          : null
      );
      setEditing(null);
      setCreatingExpense(false);
      restoreExpenseFocus.current = true;
    }
    return { error: failure };
  };
  const removeExpense = async (expense) => {
    const ok = await action(() => api.removeExpense(expense.id, expense.revision, {}));
    if (ok) setConfirmId("");
  };

  const canRemoveCurrentProject = Boolean(
    isWorkspaceOwner &&
    mode === "project" &&
    data?.project?.id === projectId &&
    Number.isInteger(data.project.revision) &&
    data.project.revision > 0
  );
  const openProjectRemoval = () => {
    if (!canRemoveCurrentProject || inFlight.current || readingGuard.current || !mounted.current)
      return;
    const snapshot = {
      id: projectId,
      revision: data.project.revision,
      name: projectLabel(data.project),
    };
    projectRemovalRef.current = snapshot;
    setProjectRemoval(snapshot);
    setProjectRemovalError("");
    setProjectRemovalConflict(false);
  };
  const closeProjectRemoval = () => {
    if (inFlight.current || accessRefreshing) return;
    projectRemovalRef.current = null;
    setProjectRemoval(null);
    setProjectRemovalError("");
    setProjectRemovalConflict(false);
  };
  const removeCurrentProject = async () => {
    const snapshot = projectRemovalRef.current;
    if (
      !mounted.current ||
      !canRemoveCurrentProject ||
      !snapshot ||
      snapshot.id !== projectId ||
      projectRemovalConflict ||
      inFlight.current ||
      readingGuard.current
    )
      return;
    const operation = {};
    const controller = new AbortController();
    const request = requestId.current;
    removalOperationRef.current = operation;
    removalControllerRef.current = controller;
    const current = () =>
      mounted.current &&
      !controller.signal.aborted &&
      removalOperationRef.current === operation &&
      requestId.current === request;
    inFlight.current = true;
    removalDescriptionRef.current?.focus({ preventScroll: true });
    setBusy(true);
    setProjectRemovalError("");
    try {
      await api.removeProject(snapshot.id, snapshot.revision, { signal: controller.signal });
      if (!current()) return;
      projectRemovalRef.current = null;
      setProjectRemoval(null);
      setData(null);
      setEditing(null);
      setCreatingExpense(false);
      setCategoryEdit(null);
      setConfirmId("");
      setSavedAssistance(null);
      setSavedSchedule(null);
      setProjectName("");
      setDescription("");
      setDevelopmentUrl("");
      setProductUrl("");
      projectSettingsBase.current = null;
      projectSettingsDirty.current = false;
      removalOperationRef.current = null;
      inFlight.current = false;
      setBusy(false);
      go("ledgerProjects");
    } catch (failure) {
      if (!current()) return;
      if (isLedgerAccessFailure(failure)) {
        projectRemovalRef.current = null;
        setProjectRemoval(null);
        setData(null);
        setEditing(null);
        setCreatingExpense(false);
        setCategoryEdit(null);
        setConfirmId("");
        setError(projectRemovalErrorText(failure));
        onAccessChanged?.(failure);
      } else {
        setProjectRemovalError(projectRemovalErrorText(failure));
        const code = failure?.code || failure?.payload?.error?.code;
        setProjectRemovalConflict(
          [412, 428].includes(failure?.status) ||
            ["REVISION_LIMIT", "PROJECT_BINDINGS_INVALID"].includes(code)
        );
      }
    } finally {
      if (removalControllerRef.current === controller) removalControllerRef.current = null;
      if (removalOperationRef.current === operation) {
        removalOperationRef.current = null;
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };

  const title =
    mode === "projects"
      ? T("Projects")
      : mode === "categories"
        ? T("Categories")
        : mode === "shared"
          ? T("Shared expense pool")
          : data?.project
            ? projectLabel(data.project)
            : T("Project expenses", "项目支出");
  const target = mode === "shared" ? { kind: "shared" } : { kind: "project", projectId };
  const expenses = data?.expenses?.items || [];
  const suggestedTargetKind = savedAssistance?.suggestions?.targetKind;
  const targetAdvice =
    ["shared", "project"].includes(suggestedTargetKind) &&
    ["shared", "project"].includes(savedAssistance?.savedTargetKind) &&
    suggestedTargetKind !== savedAssistance.savedTargetKind
      ? suggestedTargetKind === "shared"
        ? T(
            "This expense may belong in the shared pool. Review its destination.",
            "这笔支出可能更适合公共池，请核对归属。"
          )
        : T(
            "This expense may be project-specific. Review its destination.",
            "这笔支出可能仅属于某个项目，请核对归属。"
          )
      : "";
  const managedCategories =
    data?.categories?.filter((category) => !isRemovedCategory(category)) || [];
  const activeCategories = data?.categories?.filter(isActiveCategory) || [];
  const canAddExpense = Boolean(
    canWriteExpenses &&
    activeCategories.length > 0 &&
    (mode === "shared" ||
      (mode === "project" &&
        data?.project?.status !== "archived" &&
        (typeof data?.project?.canCreateExpense === "boolean"
          ? data.project.canCreateExpense
          : data?.project?.githubAccess === "authorized")))
  );
  const showExpenseForm = Boolean(
    canWriteExpenses && (editing || (canAddExpense && creatingExpense))
  );
  const closeInspection = () => {
    inspectionOpenRef.current = false;
    setInspectionOpen(false);
    restoreInspectionFocus.current = true;
  };
  const openInspection = (event) => {
    if (
      !canWriteExpenses ||
      blocked ||
      showExpenseForm ||
      projectRemovalRef.current ||
      inFlight.current ||
      readingGuard.current
    )
      return;
    const validRecords = expenses.filter(
      (expense) =>
        typeof expense.id === "string" &&
        Number.isInteger(expense.revision) &&
        expense.revision > 0 &&
        expense.target?.kind === target.kind &&
        (target.kind === "shared" || expense.target.projectId === target.projectId)
    );
    if (!validRecords.length) return;
    inspectionOpenerRef.current = event.currentTarget;
    if (!inspectionRef.current) {
      const snapshot = {
        records: validRecords,
        categories: data.categories,
        target,
        label: title,
        scope: loadedScope.current,
        request: requestId.current,
      };
      inspectionRef.current = snapshot;
      setInspection(snapshot);
    }
    inspectionOpenRef.current = true;
    setInspectionOpen(true);
  };
  const openReviewedExpense = (expense) => {
    const snapshot = inspectionRef.current;
    if (
      !snapshot ||
      !canWriteExpenses ||
      !mounted.current ||
      snapshot.scope !== loadedScope.current ||
      snapshot.request !== requestId.current ||
      !reviewReadRef.current
    )
      return;
    pendingReviewEdit.current = { expense, snapshot };
    inspectionOpenRef.current = false;
    setInspectionOpen(false);
    restoreInspectionFocus.current = false;
  };
  const reviewAccessFailure = (failure) => {
    if (!mounted.current) return;
    inspectionRef.current = null;
    inspectionOpenRef.current = false;
    pendingReviewEdit.current = null;
    setInspection(null);
    setInspectionOpen(false);
    setData(null);
    setEditing(null);
    setCreatingExpense(false);
    setSavedAssistance(null);
    setActionError(errorText(failure));
    onAccessChanged?.(failure);
  };
  useEffect(() => {
    if (inspectionOpen || blocked || removalBackgroundRef.current?.inert) return;
    const pending = pendingReviewEdit.current;
    if (pending) {
      pendingReviewEdit.current = null;
      if (
        pending.snapshot === inspectionRef.current &&
        pending.snapshot.scope === loadedScope.current &&
        pending.snapshot.request === requestId.current
      ) {
        expenseOpenerRef.current = inspectionOpenerRef.current;
        setCreatingExpense(false);
        setEditing(pending.expense);
        setView("expenses");
      }
    } else if (restoreInspectionFocus.current) {
      restoreInspectionFocus.current = false;
      inspectionOpenerRef.current?.focus({ preventScroll: true });
    }
  }, [inspectionOpen, blocked]);
  useEffect(() => {
    if (!showExpenseForm && !loading && !busy && restoreExpenseFocus.current) {
      restoreExpenseFocus.current = false;
      expenseOpenerRef.current?.focus();
    }
  }, [showExpenseForm, loading, busy]);
  const availableRepos =
    data?.repositories?.items?.filter(
      (repo) =>
        (repo.isBound !== true || boundRepositoryIds(data?.project).includes(repo.githubRepoId)) &&
        !data.projects.items.some(
          (project) =>
            project.id !== projectId && boundRepositoryIds(project).includes(repo.githubRepoId)
        ) &&
        (!organizationId || String(repo.account?.id) === organizationId)
    ) || [];
  const selectedRepository = availableRepos.find(
    (repo) => String(repo.githubRepoId) === selectedRepo
  );
  const selectedCreateIds = selectedRepository
    ? [
        selectedRepository.githubRepoId,
        ...additionalRepoIds.filter(
          (id) =>
            id !== selectedRepository.githubRepoId &&
            availableRepos.some((repo) => repo.githubRepoId === id)
        ),
      ]
    : [];
  const organizations = data?.repositories?.organizations || [];
  const needsGitHubReconnect =
    data?.repositories?.githubAccess === "reauthorization_required" ||
    data?.project?.githubAccess === "reauthorization_required";
  const showProjectForm = Boolean(
    canManageProjects && data && (addingProject || data.projects?.items.length === 0)
  );
  const matchingProjects =
    data?.projects?.items.filter((project) =>
      `${projectLabel(project)} ${project.description || ""} ${
        project.repositories
          ?.filter((repo) => repo.githubAccess === "authorized")
          .map((repo) => repo.githubFullName)
          .join(" ") || ""
      }`
        .toLowerCase()
        .includes(projectSearch.trim().toLowerCase())
    ) || [];
  useEffect(() => {
    if (blocked) return;
    if (!addingProject && restoreProjectFocus.current) {
      restoreProjectFocus.current = false;
      projectOpenerRef.current?.focus();
    }
    if (!addingProject || !showProjectForm) return;
    const panel = addProjectPanelRef.current;
    const control = panel?.querySelector("input, select, button");
    panel?.scrollIntoView?.({ block: "center" });
    control?.focus({ preventScroll: true });
  }, [addingProject, showProjectForm, blocked]);
  const startAddingProject = () => {
    if (busy || loading) return;
    setAddingProject(true);
    const input = addProjectPanelRef.current?.querySelector("input");
    input?.scrollIntoView?.({ block: "center" });
    input?.focus({ preventScroll: true });
  };
  return (
    <div ref={removalBackgroundRef} className="app product-workspace ledger-screen fade-in">
      <Topbar
        go={go}
        navigationDisabled={writing}
        breadcrumbs={
          mode === "project"
            ? [{ label: T("Projects"), go: "ledgerProjects" }, { label: title }]
            : [{ label: title }]
        }
        loading={loading || busy || repositoryLoading}
      />
      <ConsoleLayout>
        <Sidebar
          go={go}
          navigationDisabled={writing}
          section={
            mode === "shared"
              ? "ledgerShared"
              : mode === "categories"
                ? "ledgerCategories"
                : "ledgerProjects"
          }
        />
        <main className={`main ledger-${mode}`} aria-busy={writing}>
          <div className="page-h">
            <div className={mode === "project" ? "ledger-project-identity" : undefined}>
              <h1>{title}</h1>
              <p className="sub">
                {mode === "projects"
                  ? T(
                      "Create a project with a name. Link GitHub repositories whenever you need them.",
                      "为项目起个名字就能开始，GitHub 仓库可以按需关联。"
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
                      : loading && !data
                        ? T("Loading project expenses…", "正在加载项目支出…")
                        : error && !data
                          ? T("Unable to load project expenses.", "无法加载项目支出。")
                          : T("Expenses and reports for this project.", "此项目的支出与报表。")}
              </p>
              {mode === "project" && data?.project && (
                <ProjectExternalLinks project={data.project} />
              )}
            </div>
            <div className="actions">
              {canManageProjects && mode === "projects" && data?.projects.items.length > 0 && (
                <button
                  className="btn primary"
                  disabled={blocked || addingProject}
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
                  disabled={blocked || (showExpenseForm && view === "expenses")}
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
                <a className="btn ghost" {...screenLinkProps(go, "ledgerProjects", {}, writing)}>
                  <I.ArrowL size={14} /> {T("Back to projects", "返回项目列表")}
                </a>
              )}
              <button
                className="btn ghost"
                onClick={reloadWithAccess}
                disabled={loading || writing || accessRefreshing}
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
              <button className="btn" disabled={blocked} onClick={reloadWithAccess}>
                {T("Retry")}
              </button>
            </div>
          )}
          {actionError && (
            <p role="alert" className="notice">
              {actionError}
            </p>
          )}
          {savedAssistance &&
            (savedAssistance.categorySource === "jev" ||
              savedAssistance.suggestions?.duplicateExpenseId ||
              targetAdvice) && (
              <div className="notice" role="status">
                {savedAssistance.categorySource === "jev" && (
                  <p>
                    {T("Jev categorized this expense", "Jev 已自动为这笔支出分类")}:{" "}
                    {categoryDisplayName(
                      data?.categories?.find(
                        (item) =>
                          item.id === savedAssistance.suggestions?.categoryId,
                      ),
                      T("Removed", "已移除"),
                      T("Saved", "已保存"),
                    )}
                    .
                  </p>
                )}
                {savedAssistance.suggestions?.duplicateExpenseId && (
                  <p>
                    {T(
                      "This expense may duplicate an existing entry. Review your records.",
                      "这笔支出可能与已有记录重复，请核对账目。"
                    )}
                  </p>
                )}
                {targetAdvice && <p>{targetAdvice}</p>}
              </div>
            )}
          {workspace && !canWriteExpenses && !canManageProjects && !canManageCategories && (
            <p className="notice" role="status">
              {T(
                "You have read-only access to this ledger. Reports and CSV export remain available.",
                "你对此账本只有查看权限，仍可查看报表和导出 CSV。"
              )}
            </p>
          )}
          {savedSchedule && (
            <div className="notice" role="status">
              <p>
                {T("Schedule saved.", "周期计划已保存。")}: {savedSchedule.purpose}
              </p>
              <p>
                {T("Next occurrence", "下一次发生日期")}:{" "}
                {savedSchedule.nextOccurrenceOn || T("No next occurrence", "没有下一次发生日期")}
              </p>
            </div>
          )}
          {data && mode === "projects" && data.repositoryError && (
            <div role="alert" className="notice">
              <p>{errorText(data.repositoryError)}</p>
              <button className="btn" disabled={blocked} onClick={retryRepositories}>
                {T("Check repository access", "检查仓库授权")}
              </button>
            </div>
          )}
          {canManageProjects &&
            needsGitHubReconnect &&
            (linkRepositories || mode === "project") && (
              <div role="alert" className="notice">
                <p>
                  {errorText({ payload: { error: { code: "GITHUB_REAUTHORIZATION_REQUIRED" } } })}
                </p>
                <button className="btn primary" disabled={blocked} onClick={reconnectGitHub}>
                  {T("Reconnect GitHub", "重新连接 GitHub")}
                </button>
              </div>
            )}
          {loading && !data && <LedgerSkeleton mode={mode} />}
          {data && mode === "projects" && (
            <>
              {canManageProjects && data.projects.items.length === 0 && (
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
                              startAddingProject();
                            }}
                          >
                            {T("Add project", "添加项目")} <I.ArrowR size={12} />
                          </a>
                        </strong>
                        <p>
                          {T("Name the project you want to track.", "为你想记账的项目起个名字。")}
                        </p>
                      </div>
                    </li>
                    <li>
                      <span className="setup-number">02</span>
                      <div>
                        <strong>
                          <a {...screenLinkProps(go, "ledgerCategories", {}, writing)}>
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
              <LedgerSplit
                enabled={showProjectForm && data.projects.items.length > 0}
                scope={`${workspaceScope}:projects`}
              >
                {data.projects.items.length > 0 && (
                  <section className="panel ledger-your-projects" aria-label={T("Projects")}>
                    <div className="ledger-project-toolbar">
                      <div className="ledger-project-count">
                        <span>{T("Projects")}</span>
                        <span className="count">
                          {data.projects.items.length}
                          {data.projects.nextCursor ? "+" : ""}
                        </span>
                      </div>
                      <div className="ledger-search">
                        <I.Search size={16} aria-hidden="true" />
                        <input
                          ref={projectSearchRef}
                          type="search"
                          aria-label={T("Find a project", "查找项目")}
                          placeholder={T("Find a project", "查找项目")}
                          value={projectSearch}
                          onChange={(event) => setProjectSearch(event.target.value)}
                        />
                        {projectSearch && (
                          <button
                            className="btn ghost sm"
                            type="button"
                            aria-label={T("Clear search", "清除搜索")}
                            title={T("Clear search", "清除搜索")}
                            onClick={() => {
                              setProjectSearch("");
                              projectSearchRef.current?.focus({ preventScroll: true });
                            }}
                          >
                            <I.X size={16} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
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
                    {matchingProjects.length > 0 && (
                      <div className="ledger-project-head" aria-hidden="true">
                        <span>{T("Project", "项目")}</span>
                        <span className="ledger-project-head-amount">
                          {T("Expense total", "支出合计")}
                        </span>
                        <span>{T("Product", "产品")}</span>
                      </div>
                    )}
                    <div className="ledger-list">
                      {matchingProjects.map((project) => (
                        <ProjectListRow
                          key={project.id}
                          project={project}
                          go={go}
                          navigationDisabled={writing}
                        />
                      ))}
                    </div>
                    {data.projects.nextCursor && (
                      <div className="panel-actions">
                        <button
                          className="btn"
                          disabled={blocked}
                          onClick={() => loadMore("projects")}
                        >
                          {T("Load more projects")}
                        </button>
                      </div>
                    )}
                  </section>
                )}
                {showProjectForm && (
                  <section className="panel" id="add-repository" ref={addProjectPanelRef}>
                    <div className="panel-h">
                      <I.Folder size={20} />
                      <h2>
                        {data.projects.items.length === 0
                          ? T("Your first project starts here", "从第一个项目开始")
                          : T("Add project", "添加项目")}
                      </h2>
                    </div>
                    <form
                      className="ledger-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (
                          !canManageProjects ||
                          !projectName.trim() ||
                          (linkRepositories &&
                            (repositoryLoading ||
                              !data.repositories ||
                              needsGitHubReconnect ||
                              selectedCreateIds.length < 1 ||
                              selectedCreateIds.length > 30))
                        )
                          return;
                        const request = requestId.current;
                        let links;
                        try {
                          links = {
                            developmentUrl: normalizeProjectUrl(developmentUrl),
                            productUrl: normalizeProjectUrl(productUrl),
                          };
                        } catch {
                          setActionError(T("Invalid project URL.", "项目网址无效。"));
                          return;
                        }
                        action(async () => {
                          const project = await api.createProject(
                            {
                              name: projectName.trim(),
                              description,
                              githubRepoIds: linkRepositories ? selectedCreateIds : [],
                              ...(links.developmentUrl
                                ? { developmentUrl: links.developmentUrl }
                                : {}),
                              ...(links.productUrl ? { productUrl: links.productUrl } : {}),
                              ...(linkRepositories && organizationId
                                ? { githubOrganizationId: Number(organizationId) }
                                : {}),
                            },
                            {}
                          );
                          if (request === requestId.current && project?.id)
                            go("ledgerProject", { id: project.id });
                        });
                      }}
                    >
                      <div className="ledger-field">
                        <label htmlFor={projectNameId}>{T("Project name", "项目名称")}</label>
                        <input
                          id={projectNameId}
                          value={projectName}
                          required
                          maxLength={120}
                          disabled={blocked}
                          onChange={(event) => setProjectName(event.target.value)}
                        />
                      </div>
                      <details className="disclosure">
                        <summary>{T("Project description (optional)", "项目说明（选填）")}</summary>
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
                            disabled={blocked}
                            onChange={(event) => setDescription(event.target.value)}
                          />
                        </div>
                      </details>
                      <details className="disclosure">
                        <summary>{T("Project links (optional)", "项目链接（选填）")}</summary>
                        <div className="panel-body">
                          <ProjectLinkFields
                            developmentUrl={developmentUrl}
                            productUrl={productUrl}
                            disabled={blocked}
                            onChange={(field, value) =>
                              field === "developmentUrl"
                                ? setDevelopmentUrl(value)
                                : setProductUrl(value)
                            }
                          />
                        </div>
                      </details>
                      <details
                        className="disclosure"
                        open={linkRepositories}
                        onToggle={(event) => setLinkRepositories(event.currentTarget.open)}
                      >
                        <summary>
                          {T("Link GitHub repositories (optional)", "关联 GitHub 仓库（选填）")}
                        </summary>
                        <div className="panel-body">
                          <p className="ledger-help">
                            {T(
                              "GitHub repositories are optional. You can create and use this project without linking a repository.",
                              "GitHub 仓库为选填项，无需关联仓库即可创建项目并记账。"
                            )}
                          </p>
                          {repositoryLoading && (
                            <p role="status">{T("Loading repositories…", "正在加载仓库…")}</p>
                          )}
                          {organizations.length > 0 && (
                            <div className="ledger-field">
                              <label htmlFor={organizationFieldId}>
                                {T("GitHub organization (optional)", "GitHub 组织（选填）")}
                              </label>
                              <select
                                id={organizationFieldId}
                                value={organizationId}
                                disabled={blocked || repositoryLoading || needsGitHubReconnect}
                                onChange={(event) => {
                                  setOrganizationId(event.target.value);
                                  setSelectedRepo("");
                                  setAdditionalRepoIds([]);
                                }}
                              >
                                <option value="">
                                  {T("All accessible repositories", "所有已授权仓库")}
                                </option>
                                {organizations.map((org) => (
                                  <option key={org.id} value={org.id}>
                                    {org.login}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {availableRepos.length > 0 && !needsGitHubReconnect && (
                            <>
                              <p className="ledger-help">
                                {T(
                                  "Choose one to thirty authorized repositories for this expense project. Your own GitHub access is used.",
                                  "为这个支出项目选择 1 到 30 个已授权仓库，使用你自己的 GitHub 授权。"
                                )}
                              </p>
                              <div className="ledger-field">
                                <label htmlFor={repositoryFieldId}>{T("Repository")}</label>
                                <select
                                  id={repositoryFieldId}
                                  value={
                                    selectedRepository
                                      ? String(selectedRepository.githubRepoId)
                                      : ""
                                  }
                                  required={linkRepositories}
                                  disabled={blocked || repositoryLoading}
                                  onChange={(event) => setSelectedRepo(event.target.value)}
                                >
                                  <option value="">{T("Choose a repository", "选择仓库")}</option>
                                  {availableRepos.map((repo) => (
                                    <option key={repo.githubRepoId} value={repo.githubRepoId}>
                                      {repo.fullName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {selectedRepository && availableRepos.length > 1 && (
                                <fieldset className="api-scope-panel">
                                  <legend>
                                    {T("Additional repositories (optional)", "其他仓库（选填）")}
                                  </legend>
                                  <div className="api-scope-list">
                                    {availableRepos
                                      .filter(
                                        (repo) =>
                                          repo.githubRepoId !== selectedRepository.githubRepoId
                                      )
                                      .map((repo) => (
                                        <label className="api-scope-row" key={repo.githubRepoId}>
                                          <input
                                            type="checkbox"
                                            checked={additionalRepoIds.includes(repo.githubRepoId)}
                                            disabled={
                                              busy ||
                                              repositoryLoading ||
                                              (selectedCreateIds.length >= 30 &&
                                                !additionalRepoIds.includes(repo.githubRepoId))
                                            }
                                            onChange={(event) =>
                                              setAdditionalRepoIds((old) =>
                                                event.target.checked
                                                  ? [...old, repo.githubRepoId]
                                                  : old.filter((id) => id !== repo.githubRepoId)
                                              )
                                            }
                                          />
                                          <span className="api-scope-copy">
                                            <span>{repo.fullName}</span>
                                          </span>
                                        </label>
                                      ))}
                                  </div>
                                  <p className="ledger-help">
                                    {selectedCreateIds.length} / 30 {T("repositories", "个仓库")}
                                  </p>
                                </fieldset>
                              )}
                            </>
                          )}
                          {data.repositories &&
                            !repositoryLoading &&
                            availableRepos.length === 0 &&
                            !data.repositories.nextCursor &&
                            !needsGitHubReconnect && (
                              <p className="ledger-help">
                                {data.repositories.items.length > 0
                                  ? T(
                                      "These repositories are already in your projects. Open one to record an expense, or connect another repository.",
                                      "这些仓库已经添加到项目了。打开项目即可记账，也可以再连接其他仓库。"
                                    )
                                  : T(
                                      "No repositories are available yet. You can keep this project unlinked or manage GitHub access.",
                                      "还没有可用仓库。你可以不关联仓库，或管理 GitHub 授权。"
                                    )}
                              </p>
                            )}
                          <div className="panel-actions">
                            {data.repositories?.nextCursor && (
                              <button
                                className="btn"
                                type="button"
                                disabled={blocked || repositoryLoading}
                                onClick={() => loadMore("repositories")}
                              >
                                {T("Load more repositories")}
                              </button>
                            )}
                            <button
                              className="btn ghost"
                              type="button"
                              disabled={
                                busy || loading || repositoryLoading || needsGitHubReconnect
                              }
                              onClick={() => action(() => connectGitHubRepositories({ add: true }))}
                            >
                              <I.Github size={14} /> {T("Manage GitHub access")}
                            </button>
                          </div>
                        </div>
                      </details>
                      <div className="panel-actions">
                        <button
                          className="btn primary"
                          type="submit"
                          disabled={
                            busy ||
                            !projectName.trim() ||
                            (linkRepositories &&
                              (repositoryLoading ||
                                !data.repositories ||
                                needsGitHubReconnect ||
                                selectedCreateIds.length < 1 ||
                                selectedCreateIds.length > 30))
                          }
                        >
                          {T("Create project")}
                        </button>
                        {data.projects.items.length > 0 && (
                          <button
                            className="btn ghost"
                            type="button"
                            disabled={blocked}
                            onClick={() => {
                              restoreProjectFocus.current = true;
                              setAddingProject(false);
                            }}
                          >
                            {T("Cancel")}
                          </button>
                        )}
                      </div>
                    </form>
                  </section>
                )}
              </LedgerSplit>
            </>
          )}
          {data && mode === "categories" && (
            <LedgerSplit enabled={canManageCategories} scope={`${workspaceScope}:categories`}>
              <section className="panel">
                <div className="panel-h">
                  <I.Layers size={20} />
                  <h2 ref={categoryHeadingRef} tabIndex={-1}>
                    {T("Your categories")}
                  </h2>
                  <span className="count">{managedCategories.length}</span>
                </div>
                {canManageCategories && managedCategories.length > 0 && (
                  <p className="ledger-help">
                    {T(
                      "Removing a category hides it from management and new choices. Saved expenses keep its name; blocked schedules need an active category and explicit Resume. Archive keeps the category in this list.",
                      "移除类别后，它会从管理列表和新建选项中消失。已保存支出保留其名称；被阻止的周期计划须换用启用类别并主动恢复。归档会将类别保留在此列表中。",
                    )}
                  </p>
                )}
                {managedCategories.length === 0 && (
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
                  {managedCategories.map((category) => (
                    <article
                      className={
                        canManageCategories && categoryEdit?.id === category.id
                          ? "ledger-category-row is-editing"
                          : "ledger-category-row"
                      }
                      key={category.id}
                    >
                      <div className="ledger-row-main">
                        {canManageCategories && categoryEdit?.id === category.id ? (
                          <form
                            className="ledger-actions ledger-category-editor"
                            onKeyDown={(event) => {
                              if (event.key === "Escape" && !blocked) {
                                event.preventDefault();
                                restoreCategoryFocus.current = true;
                                setCategoryEdit(null);
                              }
                            }}
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (!categoryEdit.name.trim()) return;
                              restoreCategoryDraftFocus.current = true;
                              action(() =>
                                api.updateCategory(
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
                            <input
                              ref={categoryEditorInputRef}
                              aria-label={T("New category name")}
                              autoFocus
                              value={categoryEdit.name}
                              required
                              maxLength={80}
                              disabled={blocked}
                              onChange={(event) =>
                                setCategoryEdit({ id: category.id, name: event.target.value })
                              }
                            />
                            <button
                              className="btn primary"
                              type="submit"
                              disabled={blocked || !categoryEdit.name.trim()}
                            >
                              {T("Save category")}
                            </button>
                            <button
                              className="btn ghost sm"
                              type="button"
                              disabled={blocked}
                              onClick={() => {
                                restoreCategoryFocus.current = true;
                                setCategoryEdit(null);
                              }}
                            >
                              {T("Cancel")}
                            </button>
                          </form>
                        ) : (
                          <div className="ledger-category-title">
                            <h3 id={`${viewId}-category-${category.id}`}>{category.name}</h3>
                            {canManageCategories &&
                              !category.archivedAt &&
                              categoryAction?.id !== category.id && (
                                <button
                                  className="btn ghost sm ledger-category-rename"
                                  type="button"
                                  data-category-rename
                                  aria-label={T("Rename")}
                                  aria-describedby={`${viewId}-category-${category.id}`}
                                  title={T("Rename")}
                                  disabled={blocked}
                                  onClick={(event) => {
                                    categoryEditorRowRef.current =
                                      event.currentTarget.closest("article");
                                    setCategoryAction(null);
                                    restoreCategoryActionFocus.current = null;
                                    setCategoryEdit({ id: category.id, name: category.name });
                                  }}
                                >
                                  <I.Pencil size={15} aria-hidden="true" />
                                </button>
                              )}
                          </div>
                        )}
                        <p className="ledger-meta">
                          {category.archivedAt
                            ? T(
                                "Archived · past expenses keep this category",
                                "已归档 · 以前的支出仍保留此分类"
                              )
                            : T("Ready to use", "可用于记账")}
                        </p>
                      </div>
                      {canManageCategories && categoryEdit?.id !== category.id && (
                          <div
                            className="ledger-actions"
                            onKeyDown={(event) => {
                              if (event.key === "Escape" && categoryAction?.id === category.id) {
                                event.preventDefault();
                                closeCategoryAction();
                              }
                            }}
                          >
                            {categoryAction?.id === category.id ? (
                              <>
                                <button
                                  className="btn"
                                  type="button"
                                  ref={categoryActionConfirm}
                                  aria-label={
                                    categoryAction.kind === "remove"
                                      ? T("Confirm remove {category}", "确认移除 {category}").replace(
                                          "{category}",
                                          category.name
                                        )
                                      : undefined
                                  }
                                  disabled={blocked}
                                  onClick={() => confirmCategoryAction(category)}
                                >
                                  {categoryAction.kind === "remove"
                                    ? T("Confirm remove", "确认移除")
                                    : T("Confirm archive")}
                                </button>
                                <button
                                  className="btn"
                                  type="button"
                                  aria-label={
                                    categoryAction.kind === "remove"
                                      ? T("Cancel removing {category}", "取消移除 {category}").replace(
                                          "{category}",
                                          category.name
                                        )
                                      : undefined
                                  }
                                  disabled={blocked}
                                  onClick={closeCategoryAction}
                                >
                                  {T("Cancel")}
                                </button>
                              </>
                            ) : (
                              <>
                                {!category.archivedAt && (
                                  <button
                                    className="btn ghost sm"
                                    type="button"
                                    ref={(element) => {
                                      const key = `${category.id}:archive`;
                                      if (element) categoryActionOpeners.current.set(key, element);
                                      else categoryActionOpeners.current.delete(key);
                                    }}
                                    disabled={blocked}
                                    onClick={() => {
                                      if (blocked || inFlight.current || readingGuard.current)
                                        return;
                                      setCategoryEdit(null);
                                      restoreCategoryActionFocus.current = null;
                                      setCategoryAction({
                                        id: category.id,
                                        kind: "archive",
                                        scope: loadedScope.current,
                                      });
                                    }}
                                  >
                                    {T("Archive")}
                                  </button>
                                )}
                                <button
                                  className="btn ghost sm"
                                  type="button"
                                  ref={(element) => {
                                    const key = `${category.id}:remove`;
                                    if (element) categoryActionOpeners.current.set(key, element);
                                    else categoryActionOpeners.current.delete(key);
                                  }}
                                  aria-label={T("Remove {category}", "移除 {category}").replace(
                                    "{category}",
                                    category.name
                                  )}
                                  disabled={blocked}
                                  onClick={() => {
                                    if (blocked || inFlight.current || readingGuard.current) return;
                                    setCategoryEdit(null);
                                    restoreCategoryActionFocus.current = null;
                                    setCategoryAction({
                                      id: category.id,
                                      kind: "remove",
                                      scope: loadedScope.current,
                                    });
                                  }}
                                >
                                  {T("Remove")}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                    </article>
                  ))}
                </div>
              </section>
              {canManageCategories && (
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
                      action(() => api.createCategory({ name: categoryName.trim() }, {})).then(
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
                        disabled={blocked}
                        onChange={(event) => setCategoryName(event.target.value)}
                      />
                    </label>
                    <button className="btn primary" type="submit" disabled={blocked}>
                      {T("Add category")}
                    </button>
                  </form>
                </section>
              )}
            </LedgerSplit>
          )}
          {data && (mode === "shared" || mode === "project") && (
            <>
              {loading && (
                <p className="ledger-help" role="status">
                  {T(
                    "Updating results… Previous results remain visible.",
                    "正在更新结果，当前仍显示此前的数据。"
                  )}
                </p>
              )}
              <LedgerViewToolbar
                id={viewId}
                mode={mode}
                view={view}
                onViewChange={setView}
                filters={filters}
                onFiltersChange={setFilters}
                categories={data.categories}
                expanded={filtersExpanded}
                onExpandedChange={setFiltersExpanded}
                exportHref={exportHref}
                disabled={writing}
                exportDisabled={blocked}
                onReview={canWriteExpenses ? openInspection : null}
                reviewDisabled={blocked || showExpenseForm || expenses.length === 0}
              />
              {data.project?.status === "archived" && (
                <div className="notice" role="status">
                  {canManageProjects
                    ? T(
                        "This project is archived. Its expenses, reports and exports remain available. Reactivate it in Project settings to add expenses.",
                        "此项目已归档，历史支出、报表和导出仍可使用。若要新增支出，请在项目设置中重新启用。"
                      )
                    : T(
                        "This project is archived. Its expenses, reports and exports remain available. An Owner or Admin can reactivate it to add expenses.",
                        "此项目已归档，历史支出、报表和导出仍可使用。所有者或管理员可以重新启用此项目，以便新增支出。"
                      )}
                </div>
              )}
              {data.project?.githubAccess === "lost" && canWriteExpenses && (
                <div className="notice" role="status">
                  {T(
                    "GitHub access lost. You can review, edit and remove historical expenses. Reconnect GitHub to add new expenses."
                  )}
                </div>
              )}
              {data.project?.githubAccess === "unavailable" && canWriteExpenses && (
                <div className="notice" role="status">
                  {T(
                    "GitHub access could not be verified. You can review, edit and remove historical expenses; adding new expenses is paused.",
                    "暂时无法验证 GitHub 授权。你仍可查看、编辑和删除历史支出，新增支出暂时不可用。"
                  )}
                </div>
              )}
              <div
                role="tabpanel"
                id={`${viewId}-panel-expenses`}
                aria-labelledby={`${viewId}-tab-expenses`}
                aria-busy={loading || writing}
                tabIndex={0}
                hidden={view !== "expenses"}
              >
                <LedgerSplit
                  enabled={showExpenseForm}
                  className={showExpenseForm ? "ledger-entry" : ""}
                  scope={`${workspaceScope}:${mode}:${projectId}:expenses`}
                >
                  <section className="panel">
                    <div className="panel-h">
                      <I.Database size={20} />
                      <h2>{T("Expenses")}</h2>
                      <span className="count">
                        {expenses.length}
                        {data.expenses.nextCursor ? "+" : ""}
                      </span>
                    </div>
                    {canManageCategories && !showExpenseForm && activeCategories.length === 0 && (
                      <p className="ledger-help">
                        {T(
                          "Start by adding a category, such as Hosting or AI tools.",
                          "先添加一个分类，比如「托管」或「AI 工具」。"
                        )}{" "}
                        <button
                          className="btn"
                          disabled={writing}
                          onClick={() => go("ledgerCategories")}
                        >
                          {T("Manage categories")}
                        </button>
                      </p>
                    )}
                    {!canManageCategories && canWriteExpenses && activeCategories.length === 0 && (
                      <p className="ledger-help">
                        {T(
                          "Ask an Owner or Admin to add a category before recording an expense.",
                          "请先让所有者或管理员添加一个分类，再记录支出。"
                        )}
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
                            disabled={blocked}
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
                              {categoryDisplayName(
                                data.categories.find(
                                  (category) =>
                                    category.id === expense.categoryId,
                                ),
                                T("Removed", "已移除"),
                                T("Category not loaded", "类别尚未加载"),
                              )}
                            </p>
                            {expense.note && <p>{expense.note}</p>}
                          </div>
                          <div className="ledger-row-side">
                            <strong className="ledger-amount">
                              <FinancialValue
                                value={`${expense.currency} ${expense.amount}`}
                                currency={expense.currency}
                              />
                            </strong>
                            {canWriteExpenses && (
                              <div className="ledger-actions">
                                <button
                                  className="btn ghost sm"
                                  disabled={blocked}
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
                                      disabled={blocked}
                                      onClick={() => removeExpense(expense)}
                                    >
                                      {T("Confirm removal")}
                                    </button>
                                    <button
                                      className="btn"
                                      disabled={blocked}
                                      onClick={() => setConfirmId("")}
                                    >
                                      {T("Cancel")}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="btn ghost sm"
                                    disabled={blocked}
                                    onClick={() => setConfirmId(expense.id)}
                                    aria-label={`${T("Remove")} ${expense.purpose}`}
                                  >
                                    {T("Remove")}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                    {data.expenses.nextCursor && (
                      <button
                        className="btn"
                        disabled={blocked}
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
                          {canManageCategories && (
                            <button
                              className="btn"
                              disabled={writing}
                              onClick={() => go("ledgerCategories")}
                            >
                              {T("Manage categories")}
                            </button>
                          )}
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
                        api={api}
                        key={editing?.id || "new"}
                        value={editing}
                        target={target}
                        categories={data.categories}
                        busy={blocked}
                        onSubmit={saveExpense}
                        onCancel={() => {
                          setEditing(null);
                          setCreatingExpense(false);
                          restoreExpenseFocus.current = true;
                        }}
                      />
                    </section>
                  )}
                </LedgerSplit>
                <RecurringExpenses
                  api={api}
                  target={target}
                  categories={data.categories}
                  canManage={canWriteExpenses}
                  beginOperation={beginRecurringOperation}
                  disabled={
                    parentBusy ||
                    reviewBusy ||
                    reviewReadBusy ||
                    loading ||
                    loadingMore ||
                    accessRefreshing
                  }
                  reloadSignal={revision}
                  onAccessChanged={onAccessChanged}
                  formatTotal={formatRecurringTotal}
                  renderExpenseForm={(props) => (
                    <ExpenseForm
                      {...props}
                      api={api}
                      target={target}
                      categories={data.categories}
                    />
                  )}
                />
              </div>
              <div
                role="tabpanel"
                id={`${viewId}-panel-reports`}
                aria-labelledby={`${viewId}-tab-reports`}
                aria-busy={loading || writing}
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
                    <h2>{T("Project settings", "项目设置")}</h2>
                  </div>
                  <p className="ledger-help">
                    {T(
                      "Keep a financial name for this project independently of GitHub access. Repository changes use your own GitHub authorization.",
                      "财务项目名称独立于 GitHub 授权保留。更换仓库使用你自己的 GitHub 授权。"
                    )}
                  </p>
                  {canManageProjects ? (
                    <form
                      className="ledger-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (
                          !canManageProjects ||
                          loading ||
                          (projectRepoIds.length === 0 && !projectName.trim()) ||
                          projectRepoIds.length > 30
                        )
                          return;
                        const base = projectSettingsBase.current;
                        if (!base) return;
                        let links;
                        try {
                          links = {
                            developmentUrl: normalizeProjectUrl(developmentUrl),
                            productUrl: normalizeProjectUrl(productUrl),
                          };
                        } catch {
                          setActionError(T("Invalid project URL.", "项目网址无效。"));
                          return;
                        }
                        const changedRepositories =
                          JSON.stringify([...projectRepoIds].sort()) !==
                          JSON.stringify([...base.githubRepoIds].sort());
                        const nextOrganizationId = projectRepoIds.length ? organizationId : "";
                        const changedOrganization =
                          base.githubOrganizationId !== nextOrganizationId;
                        const request = requestId.current;
                        action(async () => {
                          await api.updateProject(
                            projectId,
                            base.revision,
                            {
                              description,
                              ...(links.developmentUrl !== base.developmentUrl
                                ? { developmentUrl: links.developmentUrl }
                                : {}),
                              ...(links.productUrl !== base.productUrl
                                ? { productUrl: links.productUrl }
                                : {}),
                              ...(projectName.trim() !== base.name
                                ? { name: projectName.trim() }
                                : {}),
                              ...(projectStatus !== base.status ? { status: projectStatus } : {}),
                              ...(changedRepositories ? { githubRepoIds: projectRepoIds } : {}),
                              ...(changedOrganization
                                ? {
                                    githubOrganizationId: nextOrganizationId
                                      ? Number(nextOrganizationId)
                                      : null,
                                  }
                                : {}),
                            },
                            {}
                          );
                          if (request === requestId.current) {
                            projectSettingsBase.current = null;
                            projectSettingsDirty.current = false;
                          }
                        });
                      }}
                    >
                      <div className="ledger-field">
                        <label htmlFor={projectNameId}>{T("Project name", "项目名称")}</label>
                        <input
                          id={projectNameId}
                          value={projectName}
                          required={projectRepoIds.length === 0}
                          maxLength={120}
                          disabled={blocked}
                          onChange={(event) => {
                            projectSettingsDirty.current = true;
                            setProjectName(event.target.value);
                          }}
                        />
                        {projectRepoIds.length === 0 && (
                          <p className="ledger-help">
                            {T(
                              "A project name is required when no repositories are linked.",
                              "未关联仓库时，需要填写项目名称。"
                            )}
                          </p>
                        )}
                      </div>
                      <div className="ledger-field">
                        <label htmlFor={projectStatusId}>{T("Project status", "项目状态")}</label>
                        <select
                          id={projectStatusId}
                          value={projectStatus}
                          disabled={blocked}
                          onChange={(event) => {
                            projectSettingsDirty.current = true;
                            setProjectStatus(event.target.value);
                          }}
                        >
                          <option value="active">{T("Active project", "启用中项目")}</option>
                          <option value="archived">{T("Archived", "已归档")}</option>
                        </select>
                        <p className="ledger-help">
                          {T(
                            "Archiving pauses new expenses and keeps project history and repository associations. You can reactivate this project anytime.",
                            "归档后暂停新增支出，保留历史账目和仓库关联。你随时可以重新启用此项目。"
                          )}
                        </p>
                      </div>
                      <details
                        className="disclosure"
                        open={linkRepositories}
                        onToggle={(event) => setLinkRepositories(event.currentTarget.open)}
                      >
                        <summary>
                          {T("Link GitHub repositories (optional)", "关联 GitHub 仓库（选填）")}
                        </summary>
                        <div className="panel-body">
                          {repositoryLoading && (
                            <p role="status">{T("Loading repositories…", "正在加载仓库…")}</p>
                          )}
                          {boundRepositoryIds(data.project).length === 0 && (
                            <p className="ledger-help">
                              {T(
                                "No repositories are linked. This project can record expenses without repository authorization.",
                                "项目未关联仓库，无需仓库授权即可记账。"
                              )}
                            </p>
                          )}
                          {(organizations.length > 0 || data.project.githubOrganizationId) && (
                            <div className="ledger-field">
                              <label htmlFor={organizationFieldId}>
                                {T("GitHub organization (optional)", "GitHub 组织（选填）")}
                              </label>
                              <select
                                id={organizationFieldId}
                                value={organizationId}
                                disabled={
                                  blocked ||
                                  repositoryLoading ||
                                  !data.repositories ||
                                  needsGitHubReconnect
                                }
                                onChange={(event) => {
                                  projectSettingsDirty.current = true;
                                  setOrganizationId(event.target.value);
                                  if (event.target.value) setProjectRepoIds([]);
                                }}
                              >
                                <option value="">
                                  {T("All accessible repositories", "所有已授权仓库")}
                                </option>
                                {data.project.githubOrganizationId &&
                                  !organizations.some(
                                    (org) => org.id === data.project.githubOrganizationId
                                  ) && (
                                    <option value={data.project.githubOrganizationId}>
                                      {T("Organization", "组织")} #
                                      {data.project.githubOrganizationId}
                                    </option>
                                  )}
                                {organizations.map((org) => (
                                  <option key={org.id} value={org.id}>
                                    {org.login}
                                  </option>
                                ))}
                              </select>
                              <p className="ledger-help">
                                {T(
                                  "Choose repositories again when changing organization.",
                                  "更换组织后请重新选择仓库。"
                                )}
                              </p>
                            </div>
                          )}
                          <fieldset className="api-scope-panel">
                            <legend>{T("Project repositories", "项目仓库")}</legend>
                            <div className="api-scope-list">
                              {[
                                ...boundRepositoryIds(data.project)
                                  .map((id) => {
                                    const repository = data.project.repositories?.find(
                                      (repo) => repo.githubRepoId === id
                                    );
                                    return {
                                      githubRepoId: id,
                                      fullName:
                                        repository?.githubAccess === "authorized"
                                          ? repository.githubFullName
                                          : !repository &&
                                              data.project.githubAccess === "authorized"
                                            ? data.project.githubFullName
                                            : null,
                                      account: repository?.account,
                                    };
                                  })
                                  .filter(
                                    (repo) =>
                                      !organizationId ||
                                      String(repo.account?.id) === organizationId ||
                                      projectRepoIds.includes(repo.githubRepoId)
                                  ),
                                ...availableRepos.filter(
                                  (repo) =>
                                    !boundRepositoryIds(data.project).includes(repo.githubRepoId)
                                ),
                              ].map((repo) => (
                                <label className="api-scope-row" key={repo.githubRepoId}>
                                  <input
                                    type="checkbox"
                                    checked={projectRepoIds.includes(repo.githubRepoId)}
                                    disabled={
                                      blocked ||
                                      (!projectRepoIds.includes(repo.githubRepoId) &&
                                        (repositoryLoading ||
                                          !data.repositories ||
                                          needsGitHubReconnect ||
                                          projectRepoIds.length >= 30))
                                    }
                                    onChange={(event) => {
                                      projectSettingsDirty.current = true;
                                      setProjectRepoIds((old) =>
                                        event.target.checked
                                          ? [...old, repo.githubRepoId]
                                          : old.filter((id) => id !== repo.githubRepoId)
                                      );
                                    }}
                                  />
                                  <span className="api-scope-copy">
                                    <span>
                                      {repo.fullName ||
                                        `${T("Repository", "仓库")} #${repo.githubRepoId}`}
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </div>
                            <p className="ledger-help">
                              {projectRepoIds.length} / 30 {T("repositories", "个仓库")}
                            </p>
                          </fieldset>
                          {data.repositoryError && (
                            <div className="notice notice-error" role="alert">
                              <p>{errorText(data.repositoryError)}</p>
                              <button
                                className="btn"
                                type="button"
                                disabled={blocked}
                                onClick={retryRepositories}
                              >
                                {T("Check repository access", "检查仓库授权")}
                              </button>
                            </div>
                          )}
                          {data.repositories?.nextCursor && (
                            <button
                              className="btn"
                              type="button"
                              disabled={blocked}
                              onClick={() => loadMore("repositories")}
                            >
                              {T("Load more repositories")}
                            </button>
                          )}
                          <div className="panel-actions">
                            <button
                              className="btn ghost"
                              type="button"
                              disabled={
                                busy || loading || repositoryLoading || needsGitHubReconnect
                              }
                              onClick={() => action(() => connectGitHubRepositories({ add: true }))}
                            >
                              <I.Github size={14} /> {T("Manage GitHub access")}
                            </button>
                          </div>
                        </div>
                      </details>
                      <ProjectLinkFields
                        developmentUrl={developmentUrl}
                        productUrl={productUrl}
                        disabled={blocked}
                        onChange={(field, value) => {
                          projectSettingsDirty.current = true;
                          if (field === "developmentUrl") setDevelopmentUrl(value);
                          else setProductUrl(value);
                        }}
                      />
                      <div className="ledger-field">
                        <label htmlFor={projectDescriptionId}>{T("Description")}</label>
                        <textarea
                          id={projectDescriptionId}
                          value={description}
                          maxLength={2000}
                          disabled={blocked}
                          onChange={(event) => {
                            projectSettingsDirty.current = true;
                            setDescription(event.target.value);
                          }}
                        />
                      </div>
                      <div className="ledger-actions">
                        <button
                          className="btn primary"
                          type="submit"
                          disabled={
                            blocked ||
                            (projectRepoIds.length === 0 && !projectName.trim()) ||
                            projectRepoIds.length > 30
                          }
                        >
                          {T("Save project", "保存项目")}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="panel-body">
                      <p>{data.project.description || T("No description", "暂无说明")}</p>
                      {data.project.githubOrganization?.githubAccess === "authorized" &&
                        data.project.githubOrganization.login && (
                          <p>
                            {T("Organization", "组织")}: {data.project.githubOrganization.login}
                          </p>
                        )}
                      <h3>{T("Project repositories", "项目仓库")}</h3>
                      {boundRepositoryIds(data.project).length === 0 && (
                        <p className="ledger-help">{T("No repositories linked", "未关联仓库")}</p>
                      )}
                      <div className="ledger-list">
                        {boundRepositoryIds(data.project).map((id) => {
                          const repo = data.project.repositories?.find(
                            (item) => item.githubRepoId === id
                          );
                          const name =
                            repo?.githubAccess === "authorized"
                              ? repo.githubFullName
                              : !repo && data.project.githubAccess === "authorized"
                                ? data.project.githubFullName
                                : null;
                          return (
                            <article key={id}>
                              <p>{name || `${T("Repository", "仓库")} #${id}`}</p>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {canRemoveCurrentProject && (
                    <section className="ledger-project-removal">
                      <h3>{T("Remove project", "移除项目")}</h3>
                      <p>
                        {T(
                          "Permanently delete this project, its current expenses, all its recurring schedules and related business history.",
                          "永久删除此项目、当前归属于它的支出、全部周期计划及相关业务历史。",
                        )}
                      </p>
                      <button
                        type="button"
                        className="btn danger"
                        disabled={blocked}
                        onClick={openProjectRemoval}
                      >
                        <I.X size={14} aria-hidden="true" /> {T("Remove project", "移除项目")}
                      </button>
                    </section>
                  )}
                </section>
              )}
              <div
                role="tabpanel"
                id={`${viewId}-panel-activity`}
                aria-labelledby={`${viewId}-tab-activity`}
                tabIndex={0}
                hidden={view !== "activity"}
              >
                <ActivityLog
                  api={api}
                  target={target}
                  active={view === "activity"}
                  disabled={loading || writing || accessRefreshing}
                  reloadSignal={revision}
                  onAccessChanged={onAccessChanged}
                />
              </div>
            </>
          )}
        </main>
      </ConsoleLayout>
      {projectRemoval &&
        canRemoveCurrentProject &&
        createPortal(
          <ConfirmDialog
            open
            title={T("Remove project?", "移除项目？")}
            description={
              <span
                ref={removalDescriptionRef}
                tabIndex={0}
                className="ledger-project-removal-description"
              >
                <strong>{projectRemoval.name}</strong>
                <span>
                  {T(
                    "This permanently deletes the project, expenses currently assigned to it, all its recurring schedules in any state, and related business history. Expenses already moved to another project or the shared pool remain. This cannot be undone.",
                    "此操作会永久删除项目、当前归属于它的支出、所有状态的周期计划及相关业务历史。已移到其他项目或公共池的现存支出将保留。此操作无法撤销。",
                  )}
                </span>
                {projectRemovalError && (
                  <span className="ledger-project-removal-error" role="alert">
                    {projectRemovalError}
                  </span>
                )}
              </span>
            }
            confirmLabel={
              projectRemovalConflict
                ? T("Reload project", "刷新项目")
                : T("Confirm remove project", "确认移除项目")
            }
            cancelLabel={T("Cancel", "取消")}
            onCancel={closeProjectRemoval}
            onConfirm={() => {
              if (!projectRemovalConflict) removeCurrentProject();
              else if (!inFlight.current && !readingGuard.current) {
                closeProjectRemoval();
                reloadWithAccess({ preserveProjectDraft: true });
              }
            }}
            busy={writing || accessRefreshing}
            danger={!projectRemovalConflict}
            backgroundRef={removalBackgroundRef}
            dialogId="remove-ledger-project"
          />,
          document.body
        )}
      {inspection &&
        createPortal(
          <ExpenseReviewDialog
            open={inspectionOpen}
            records={inspection.records}
            categories={inspection.categories}
            target={inspection.target}
            scopeLabel={inspection.label}
            api={api}
            backgroundRef={removalBackgroundRef}
            blocked={blocked}
            beginOperation={beginReviewOperation}
            beginEditRead={beginReviewEditRead}
            onOpenEdit={openReviewedExpense}
            onAccessFailure={reviewAccessFailure}
            onClose={closeInspection}
          />,
          document.body
        )}
    </div>
  );
}
