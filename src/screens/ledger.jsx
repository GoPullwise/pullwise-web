import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
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

function isLedgerAccessFailure(failure) {
  const code = failure?.code || failure?.payload?.error?.code;
  return (
    [403, 404].includes(failure?.status) &&
    !code?.startsWith("GITHUB_") &&
    code !== "RECURRING_RULE_LIMIT"
  );
}

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
    RECORD_LIMIT: T(
      "Expense record allowance reached. Existing records remain available.",
      "支出记录额度已用完，已有记录仍可访问。"
    ),
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
    MAX_REQUIRED: T("Jev suggestions require Max.", "Jev 建议仅向 Max 开放。"),
    CATEGORY_REQUIRED: T(
      "Choose a category to finish saving. Your draft is still here.",
      "请选择类别后保存，已填写的内容已保留。"
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
      numeric={minorAmount(total.amountMinor) !== null && typeof total.currency === "string"}
    />
  );
}

function formatRecurringTotal(rule) {
  return typeof rule.currency === "string" && typeof rule.amount === "string"
    ? `${rule.currency} ${rule.amount}`
    : T("Unavailable");
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
    <div className="ledger-project-links">
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
          {T("Development", "开发环境")}
        </a>
      )}
      {productHref && (
        <a href={productHref} target="_blank" rel="noopener noreferrer" draggable={false}>
          {T("Product", "产品")}
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

function ProjectListRow({ project, go }) {
  return (
    <article className="ledger-project-row">
      <div className="ledger-row-main">
        <h2>
          <a draggable={false} {...screenLinkProps(go, "ledgerProject", { id: project.id })}>
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
        <span className="ledger-project-label">{T("Project links", "项目链接")}</span>
        {project.githubAccess === "not_linked" ? (
          <p>{T("No repositories linked", "未关联仓库")}</p>
        ) : null}
        <ProjectExternalLinks project={project} />
        {["lost", "reauthorization_required"].includes(project.githubAccess) && (
          <p className="ledger-access-lost">{T("GitHub access lost", "GitHub 授权已失效")}</p>
        )}
        {project.githubAccess === "unavailable" && (
          <p>{T("GitHub access could not be verified", "暂时无法验证 GitHub 授权")}</p>
        )}
      </div>
      <I.ArrowR size={16} aria-hidden="true" />
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
    if (!value) {
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
  }, [value, api]);
  const categoryRequired = Boolean(
    value || expenseType === "recurring" || !automaticCategory || requiresCategory
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
          { type: "date", required: true }
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
              .filter((category) => !category.archivedAt || category.id === value?.categoryId)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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
    ? `${workspace.id}:${workspace.memberRevision ?? workspace.revision}:${JSON.stringify(workspace.permissions)}`
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
}) {
  useLang();
  const canManageProjects = workspace ? workspace.permissions?.manageProjects === true : true;
  const canManageCategories = workspace ? workspace.permissions?.manageCategories === true : true;
  const canWriteExpenses = workspace ? workspace.permissions?.writeExpenses === true : true;
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
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
  const [confirmCategoryId, setConfirmCategoryId] = useState("");
  const [editing, setEditing] = useState(null);
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [confirmId, setConfirmId] = useState("");
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
      const field =
        panel?.querySelector('input[type="date"]:not([disabled])') ||
        panel?.querySelector("input:not([disabled]), select:not([disabled])");
      field?.scrollIntoView?.({ block: "center" });
      field?.focus({ preventScroll: true });
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
    setLoading(true);
    setError("");
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
      setConfirmCategoryId("");
      categoryEditorRowRef.current = null;
      restoreCategoryFocus.current = false;
    }
    loadedScope.current = scope;
    const options = { signal: controller.signal };
    const load = async () => {
      if (mode === "projects") {
        const [projects, categories, summary] = await Promise.all([
          api.projects({}, options),
          api.categories(options),
          api.reportSummary(filtered, options).then(
            (value) => ({ value }),
            (failure) => ({ failure })
          ),
        ]);
        return {
          projects,
          repositories: null,
          repositoryError: null,
          categories,
          summary: summary.value,
          summaryError: summary.failure ? errorText(summary.failure) : "",
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
      const [categories, expenses, project, projects, summary, timeseries, categoryReport] =
        await Promise.all([
          api.categories(options),
          api.expenses(detailQuery, options),
          mode === "project" ? api.project(projectId, options) : Promise.resolve(null),
          api.projects({}, options),
          optionalReport(api.reportSummary(detailQuery, options)),
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
        summary: summary.value,
        summaryError: summary.failure ? errorText(summary.failure) : "",
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
      if (request === requestId.current) {
        setActionError(
          failure?.payload?.error?.code === "CATEGORY_REQUIRED" ? "" : errorText(failure)
        );
        if (isLedgerAccessFailure(failure)) {
          setData(null);
          setEditing(null);
          setCreatingExpense(false);
          setCategoryEdit(null);
          setConfirmId("");
          onAccessChanged?.(failure);
        }
      }
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
  const activeCategories = data?.categories?.filter((category) => !category.archivedAt) || [];
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
    if (!addingProject && restoreProjectFocus.current) {
      restoreProjectFocus.current = false;
      projectOpenerRef.current?.focus();
    }
    if (!addingProject || !showProjectForm) return;
    const panel = addProjectPanelRef.current;
    const control = panel?.querySelector("input, select, button");
    panel?.scrollIntoView?.({ block: "center" });
    control?.focus({ preventScroll: true });
  }, [addingProject, showProjectForm]);
  const startAddingProject = () => {
    if (busy || loading) return;
    setAddingProject(true);
    const input = addProjectPanelRef.current?.querySelector("input");
    input?.scrollIntoView?.({ block: "center" });
    input?.focus({ preventScroll: true });
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
      <ConsoleLayout>
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
        <main className={`main ledger-${mode}`}>
          <div className="page-h">
            <div>
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
              {mode === "project" && data?.project?.githubAccess === "not_linked" && (
                <p className="ledger-meta">{T("No repositories linked", "未关联仓库")}</p>
              )}
              {mode === "project" && data?.project && (
                <ProjectExternalLinks project={data.project} />
              )}
            </div>
            <div className="actions">
              {canManageProjects && mode === "projects" && data?.projects.items.length > 0 && (
                <button
                  className="btn primary"
                  disabled={busy || loading || addingProject}
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
                onClick={() => {
                  projectSettingsBase.current = null;
                  projectSettingsDirty.current = false;
                  reload();
                }}
                disabled={loading || busy}
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
          {savedAssistance &&
            (savedAssistance.categorySource === "jev" ||
              savedAssistance.suggestions?.duplicateExpenseId ||
              targetAdvice) && (
              <div className="notice" role="status">
                {savedAssistance.categorySource === "jev" && (
                  <p>
                    {T("Jev categorized this expense", "Jev 已自动为这笔支出分类")}:{" "}
                    {data?.categories?.find(
                      (item) => item.id === savedAssistance.suggestions?.categoryId
                    )?.name || T("Saved", "已保存")}
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
              <button className="btn" disabled={busy || loading} onClick={retryRepositories}>
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
                <button
                  className="btn primary"
                  disabled={busy || loading}
                  onClick={reconnectGitHub}
                >
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
                        <span>{T("Project links", "项目链接")}</span>
                      </div>
                    )}
                    <div className="ledger-list">
                      {matchingProjects.map((project) => (
                        <ProjectListRow key={project.id} project={project} go={go} />
                      ))}
                    </div>
                    {data.projects.nextCursor && (
                      <div className="panel-actions">
                        <button
                          className="btn"
                          disabled={loadingMore}
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
                          disabled={busy}
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
                            disabled={busy}
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
                            disabled={busy}
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
                                disabled={busy || repositoryLoading || needsGitHubReconnect}
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
                                  disabled={busy || repositoryLoading}
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
                                disabled={busy || loadingMore || repositoryLoading}
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
                            disabled={busy}
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
                <details
                  className="panel ledger-overview"
                  open={data.summaryError || Object.keys(filtered).length ? true : undefined}
                >
                  <summary className="panel-h">
                    <I.Activity size={20} />
                    <h2>{T("Ledger overview")}</h2>
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
                          <h3>
                            <LedgerTotal total={group} />
                          </h3>
                          <p>
                            {T("Projects")}:{" "}
                            <LedgerTotal
                              total={
                                data.summary.groups.find(
                                  (item) =>
                                    item.target === "project" &&
                                    item.projectId == null &&
                                    item.currency === group.currency
                                ) || { currency: group.currency, amountMinor: 0 }
                              }
                            />
                          </p>
                          <p>
                            {T("Shared pool")}:{" "}
                            <LedgerTotal
                              total={
                                data.summary.groups.find(
                                  (item) =>
                                    item.target === "shared" && item.currency === group.currency
                                ) || { currency: group.currency, amountMinor: 0 }
                              }
                            />
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
              </LedgerSplit>
            </>
          )}
          {data && mode === "categories" && (
            <LedgerSplit enabled={canManageCategories} scope={`${workspaceScope}:categories`}>
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
                      {canManageCategories && categoryEdit?.id === category.id && (
                        <form
                          className="ledger-actions"
                          onSubmit={(event) => {
                            event.preventDefault();
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
                      {canManageCategories &&
                        !category.archivedAt &&
                        categoryEdit?.id !== category.id && (
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
                                      api.archiveCategory(category.id, category.revision, {})
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
                        disabled={busy}
                        onChange={(event) => setCategoryName(event.target.value)}
                      />
                    </label>
                    <button className="btn primary" type="submit" disabled={busy}>
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
                  <p role="status">
                    {T(
                      "Spending summary is unavailable. Reload to try again.",
                      "支出汇总暂不可用，重新加载后可再试。"
                    )}
                  </p>
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
                        <h3>
                          <LedgerTotal total={group} />
                        </h3>
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
                        <button className="btn" onClick={() => go("ledgerCategories")}>
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
                              <FinancialValue value={`${expense.currency} ${expense.amount}`} />
                            </strong>
                            {canWriteExpenses && (
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
                            <button className="btn" onClick={() => go("ledgerCategories")}>
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
                </LedgerSplit>
                <RecurringExpenses
                  api={api}
                  target={target}
                  categories={data.categories}
                  canManage={canWriteExpenses}
                  disabled={busy || loading}
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
                          disabled={busy || loading}
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
                          disabled={busy || loading}
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
                                  busy ||
                                  loading ||
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
                                      busy ||
                                      loading ||
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
                                disabled={busy || loading}
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
                              disabled={loadingMore}
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
                        disabled={busy || loading}
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
                          disabled={busy || loading}
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
                            busy ||
                            loading ||
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
                </section>
              )}
            </>
          )}
        </main>
      </ConsoleLayout>
    </div>
  );
}
