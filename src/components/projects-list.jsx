import { memo, useId, useMemo, useRef, useState } from "react";
import { T, useLang } from "../i18n.jsx";
import { I } from "../icons.jsx";
import { screenLinkProps } from "../lib/navigation.js";
import { projectUrlHref } from "../lib/project-links.js";

const ProjectListRow = memo(function ProjectListRow({ model, go, navigationDisabled, Total }) {
  useLang();
  const { project, label } = model;
  const productHref = projectUrlHref(project.productUrl);
  return (
    <article className="ledger-project-row" role="listitem">
      <div className="ledger-row-main">
        <h2>
          <a
            className="ledger-project-title-link ledger-project-link"
            draggable={false}
            {...screenLinkProps(go, "ledgerProject", { id: project.id }, navigationDisabled)}
          >
            <span>{label}</span><I.ArrowR size={14} aria-hidden="true" />
          </a>
        </h2>
        {project.description && label !== project.description && <p>{project.description}</p>}
        {project.status === "archived" && (
          <p className="ledger-meta">{T("Archived project", "已归档项目")}</p>
        )}
      </div>
      <div className="ledger-project-total">
        <span className="ledger-project-label">{T("Expense total", "支出合计")}</span>
        {project.totals.length
          ? project.totals.map((total) => <Total key={total.currency} total={total} />)
          : T("No expenses")}
      </div>
      <div className="ledger-project-associations">
        {productHref && (
          <div className="ledger-project-links">
            <a className="ledger-project-product-link" href={productHref} target="_blank" rel="noopener noreferrer" draggable={false}>
              {T("Product", "产品")} <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </div>
    </article>
  );
});

export function ProjectsList({
  className = "panel ledger-your-projects",
  page,
  go,
  labelForProject,
  Total,
  writing = false,
  loading = false,
  paginationDisabled = false,
  onLoadMore,
}) {
  useLang();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const searchRef = useRef(null);
  const fieldId = useId();
  const guidanceId = `${fieldId}-guidance`;
  const resultsId = `${fieldId}-results`;
  const unnamedLabel = T("Project", "项目");
  const indexedProjects = useMemo(
    () => page.items.map((project) => {
      const label = labelForProject(project, unnamedLabel);
      return {
        project,
        label,
        searchText: `${label} ${project.description || ""}`.toLowerCase(),
      };
    }),
    // The translated fallback can resolve after the language catalog loads.
    [page.items, labelForProject, unnamedLabel],
  );
  const query = search.trim().toLowerCase();
  const matchingProjects = useMemo(
    () => indexedProjects.filter(({ project, searchText }) =>
      searchText.includes(query) &&
      (status === "all" || (project.status === "archived" ? "archived" : "active") === status)
    ),
    [indexedProjects, query, status],
  );
  const results = loading
    ? T("Updating projects…", "正在更新项目…")
    : T("Showing {shown} of {loaded} loaded projects.")
        .replace("{shown}", String(matchingProjects.length))
        .replace("{loaded}", String(page.items.length));
  return (
    <section className={className} aria-label={T("Projects")}>
      <div className="ledger-project-toolbar">
        <div className="ledger-project-filters">
          <div className="ledger-search">
            <I.Search size={16} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              aria-label={T("Find a project", "查找项目")}
              aria-describedby={guidanceId}
              aria-controls={resultsId}
              placeholder={T("Find a project", "查找项目")}
              value={search}
              disabled={writing}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                className="btn ghost sm"
                type="button"
                disabled={writing}
                aria-label={T("Clear search", "清除搜索")}
                title={T("Clear search", "清除搜索")}
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus({ preventScroll: true });
                }}
              >
                <I.X size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="ledger-field ledger-project-status">
            <label htmlFor={`${fieldId}-status`}>{T("Project status", "项目状态")}</label>
            <select
              id={`${fieldId}-status`}
              value={status}
              disabled={writing}
              aria-describedby={guidanceId}
              aria-controls={resultsId}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">{T("All projects", "全部项目")}</option>
              <option value="active">{T("Active", "启用")}</option>
              <option value="archived">{T("Archived", "已归档")}</option>
            </select>
          </div>
        </div>
      </div>
      <div className="ledger-search-guidance">
        <p className="ledger-help" id={guidanceId}>
          {page.nextCursor
            ? T("Search and status filter apply to loaded projects only. Load more projects to include the next page.")
            : T("Search project names and descriptions in the loaded list.")}
        </p>
        <p className="ledger-help" role="status" aria-live="polite" aria-atomic="true">{results}</p>
      </div>
      <div id={resultsId} aria-busy={loading}>
        <div className="ledger-project-head" aria-hidden="true">
          <span className="ledger-project-count">
            <span>{T("Project", "项目")}</span>
            <span className="count">{page.items.length}{page.nextCursor ? "+" : ""}</span>
          </span>
          <span className="ledger-project-head-amount">{T("Expense total", "支出合计")}</span>
          <span>{T("Product", "产品")}</span>
        </div>
        {matchingProjects.length === 0 && (
          <div className="empty">
            <I.Search size={24} aria-hidden="true" />
            <h3>{T("No matching projects", "没有匹配的项目")}</h3>
            <p>{T("Adjust the search or status filter to see other loaded projects.")}</p>
          </div>
        )}
        <div className="ledger-list ledger-project-list" role="list" aria-label={T("Projects")}>
          {matchingProjects.map((model) => (
            <ProjectListRow
              key={model.project.id}
              model={model}
              go={go}
              navigationDisabled={writing}
              Total={Total}
            />
          ))}
        </div>
      </div>
      {page.nextCursor && (
        <div className="panel-actions">
          <button className="btn" type="button" disabled={paginationDisabled} onClick={onLoadMore}>
            {T("Load more projects")}
          </button>
        </div>
      )}
    </section>
  );
}
