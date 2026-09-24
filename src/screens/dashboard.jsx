import { useCallback, useEffect, useState } from "react";
import { T, useLang } from "../i18n.jsx";
import { Topbar, ProductSidebar } from "../shell.jsx";
import { productApi } from "../api/product.js";
import { useProductRead, requireOverview, requirePage, requireWorkload, requirePRActions, requireCIFailures, requireUpdatesReleases } from "../lib/product-data.js";
import { Coverage, ProductDetail, productLabel } from "../components/product-detail.jsx";
import "./product.css";

const initialFilters = { module: "", repositoryId: "", watchId: "", view: "all", attentionState: "", pullNumber: "", actionType: "", ciStage: "", ciSymptom: "", classificationState: "", q: "" };

function Pager({ page, cursors, onChange, kind }) {
  const current = cursors.at(-1);
  const stuck = page.hasMore && (!page.nextCursor || cursors.includes(page.nextCursor));
  return <div className="product-actions">
    {cursors.length > 1 && <button className="btn" onClick={() => onChange(cursors.slice(0, -1))}>{T("Previous page", "上一页")}</button>}
    {page.hasMore && <button className="btn" disabled={stuck} aria-label={kind === "items" ? T("Next items page", "下一页事项") : T("Next releases page", "下一页发布")} onClick={() => onChange([...cursors, page.nextCursor])}>{T("Next page", "下一页")}</button>}
    {stuck && <p role="alert">{T("Pagination stopped. Reload data to continue.", "分页已停止，请重新加载数据。")}</p>}
    {current && <span className="sub">{T("Paged results; counts cover the full filter.", "结果已分页，计数覆盖完整筛选范围。")}</span>}
  </div>;
}

export function DashboardScreen({ go }) {
  useLang();
  const [filters, setFilters] = useState(initialFilters);
  const [searchText, setSearchText] = useState("");
  const [itemCursors, setItemCursors] = useState([""]);
  const [releaseCursors, setReleaseCursors] = useState([""]);
  const [prCursors, setPrCursors] = useState([""]);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState(null);
  const [blocked, setBlocked] = useState("");
  const refresh = useCallback(() => {
    setSelection(null);
    setBlocked("");
    setItemCursors([""]);
    setReleaseCursors([""]);
    setPrCursors([""]);
    setRevision(value => value + 1);
  }, []);
  const accessLost = useCallback(error => { setSelection(null); setBlocked(error.message || T("Access unavailable", "访问权不可用")); }, []);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [refresh]);
  const key = JSON.stringify([filters, itemCursors, releaseCursors, prCursors, revision]);
  const read = useProductRead(key, async signal => {
    const options = { signal };
    const releaseFilters = { kind: "updates_releases", module: "updates", repositoryId: filters.repositoryId, watchId: filters.watchId, cursor: releaseCursors.at(-1) };
    const [overview, workload, prActions, ciFailures, items, repositories, watches, releases] = await Promise.all([
      productApi.overview(filters, options),
      productApi.visualizations({ kind: "workload", ...filters }, options),
      filters.module === "pr" ? productApi.prActions({ kind: "pr_actions", ...filters, cursor: prCursors.at(-1) }, options) : null,
      filters.module === "ci" ? productApi.ciFailures({ kind: "ci_failures", ...filters }, options) : null,
      productApi.items({ ...filters, cursor: itemCursors.at(-1) }, options),
      productApi.repositories(options),
      productApi.watches(options),
      filters.module === "updates" ? productApi.updatesReleases(releaseFilters, options) : null,
    ]);
    return { overview: requireOverview(overview), workload: requireWorkload(workload), prActions: prActions && requirePRActions(prActions), ciFailures: ciFailures && requireCIFailures(ciFailures), items: requirePage(items), repositories: requirePage(repositories), watches: requirePage(watches), releases: releases && requireUpdatesReleases(releases) };
  });
  function change(next) {
    setSelection(null);
    setItemCursors([""]);
    setReleaseCursors([""]);
    setPrCursors([""]);
    setFilters(value => ({ ...value, ...next }));
  }
  const data = blocked ? null : read.value;
  const error = blocked || read.error?.message;
  const activeSelection = data && !error ? selection : null;
  return <>
    <div className="app product-workspace" inert={activeSelection ? "" : undefined} aria-hidden={activeSelection ? "true" : undefined}>
      <Topbar go={go} breadcrumbs={[{ label: T("Overview", "总览") }]} loading={read.loading} searchEnabled={false} />
      <div className="with-side">
        <ProductSidebar go={go} />
        <main className="main wide">
          <div className="page-h"><div><h1>{T("Follow-up", "跟进事项")}</h1><p className="sub">PR · CI · Updates</p></div>
            <button className="btn" disabled={read.loading} onClick={refresh}>{T("Reload data", "重新加载数据")}</button>
          </div>
          <div className="product-tabs" role="group" aria-label={T("Modules", "模块")}>
            {[["", T("All", "全部")], ["pr", "PR"], ["ci", "CI"], ["updates", "Updates"]].map(([module, name]) =>
              <button key={module} aria-label={T(name + " module", name + " 模块")} aria-pressed={filters.module === module} onClick={() => change({ module, watchId: module === "updates" ? filters.watchId : "", pullNumber: "", actionType: "", ciStage: "", ciSymptom: "", classificationState: "" })}>{name}</button>)}
          </div>
          <div className="product-filters">
            <form className="product-search" onSubmit={event => { event.preventDefault(); change({q: searchText.trim()}); }}>
              <label>{T("Search items", "搜索事项")}<input value={searchText} maxLength={200}
                onChange={event => setSearchText(event.target.value)} /></label>
              <button className="btn" type="submit">{T("Search items", "搜索事项")}</button>
              {filters.q && <button className="btn" type="button" onClick={() => {
                setSearchText(""); change({q: ""}); }}>{T("Clear search", "清除搜索")}</button>}
            </form>
            <label>{T("Repository scope", "仓库范围")}<select disabled={read.loading} value={filters.repositoryId} onChange={event => change({ repositoryId: event.target.value })}>
              <option value="">{T("All repositories", "全部仓库")}</option>
              {!data && filters.repositoryId && <option value={filters.repositoryId}>{filters.repositoryId}</option>}
              {data?.repositories.items.map(repository => <option value={repository.id} key={repository.id}>{repository.fullName || repository.id}</option>)}
            </select></label>
            {filters.module === "updates" && <label>{T("Watch scope", "关注范围")}<select disabled={read.loading} value={filters.watchId} onChange={event => change({ watchId: event.target.value })}>
              <option value="">{T("All watches", "全部关注")}</option>
              {!data && filters.watchId && <option value={filters.watchId}>{filters.watchId}</option>}
              {data?.watches.items.map(watch => <option value={watch.id} key={watch.id}>{watch.upstreamRepositoryId} · {(watch.interests || []).join(", ")}</option>)}
            </select></label>}
            {filters.attentionState && <button className="btn" onClick={() => change({ attentionState: "" })}>{productLabel(filters.attentionState)} × {T("Clear filter", "清除筛选")}</button>}
            {(filters.pullNumber || filters.actionType) && <button className="btn" onClick={() => change({ pullNumber: "", actionType: "" })}>{T("Clear PR drilldown", "清除 PR 筛选")}</button>}
            {(filters.ciStage || filters.ciSymptom || filters.classificationState) && <button className="btn" onClick={() => change({ ciStage: "", ciSymptom: "", classificationState: "" })}>{T("Clear CI drilldown", "清除 CI 筛选")}</button>}
          </div>
          {error ? <section className="product-message" role="alert"><h2>{T("Overview data unavailable", "总览数据暂不可用")}</h2><p>{error}</p><button className="btn" onClick={refresh}>{T("Retry loading data", "重试加载数据")}</button></section> :
            read.loading ? <p className="product-message" role="status">{T("Loading follow-up…", "正在加载跟进事项…")}</p> : data && <>
              <section className="product-counts" aria-label={T("Distinct item counts", "独立事项计数")}>
                {Object.entries(data.overview.counts).map(([state, count]) => <button key={state} aria-label={productLabel(state) + ": " + count} aria-pressed={filters.attentionState === state} onClick={() => change({ attentionState: filters.attentionState === state ? "" : state })}>
                  <strong>{count}</strong><span>{productLabel(state)}</span>
                </button>)}
              </section>
              <section className="product-workload" aria-label={T("Workload by module", "按模块分布的事项")}>
                <h2>{T("Workload by module", "按模块的事项")}</h2>
                {data.workload.data.rows.map(row => <div className="product-workload-row" key={row.key}>
                  <strong>{row.key.toUpperCase()}</strong><span>{row.totalCount} {T("items", "事项")}</span>
                  <div className="product-workload-cells">{row.cells.filter(cell => cell.count > 0).map(cell =>
                    <button key={cell.key} aria-label={`${row.key.toUpperCase()} ${productLabel(cell.key)}: ${cell.count}`}
                      onClick={() => change(cell.drilldown.filters)}>{productLabel(cell.key)} <span>{cell.count}</span></button>)}</div>
                </div>)}
              </section>
              {data.prActions && <section className="product-workload" aria-label={T("PR action matrix", "PR 行动矩阵")}>
                <h2>{T("PR action matrix", "PR 行动矩阵")}</h2>
                <p className="sub">{data.prActions.data.rowsTotal} PR · {data.prActions.totalCount} {T("distinct items", "独立事项")}</p>
                {data.prActions.data.rows.map(row => <div className="product-workload-row" key={row.key}>
                  <strong>PR #{row.pullNumber}</strong><span>{row.totalCount} {T("items", "事项")}</span>
                  <div className="product-workload-cells">{row.cells.filter(cell => cell.count > 0).map(cell =>
                    <button key={cell.key} aria-label={`PR #${row.pullNumber} ${productLabel(cell.key)}: ${cell.count}`}
                      onClick={() => change(cell.drilldown.filters)}>{productLabel(cell.key)} <span>{cell.count}</span></button>)}</div>
                </div>)}
                <Pager page={data.prActions} cursors={prCursors} onChange={setPrCursors} kind="pr" />
              </section>}
              {data.ciFailures && <section className="product-workload" aria-label={T("CI stage and symptom matrix", "CI 阶段与现象矩阵")}>
                <h2>{T("CI stage and symptom matrix", "CI 阶段与现象矩阵")}</h2>
                <p className="sub">{data.ciFailures.totalCount} {T("failed job attempts", "失败的任务执行")}</p>
                {data.ciFailures.data.rows.map(row => <div className="product-workload-row" key={row.key}>
                  <strong>{productLabel(row.key)}</strong>
                  <div className="product-workload-cells product-workload-wide">{data.ciFailures.data.cells
                    .filter(cell => cell.rowKey === row.key && cell.count > 0).map(cell =>
                    <button key={cell.columnKey} aria-label={`${productLabel(row.key)} ${productLabel(cell.columnKey)}: ${cell.count}`}
                      onClick={() => change(cell.drilldown.filters)}>{productLabel(cell.columnKey)} <span>{cell.count}</span></button>)}</div>
                </div>)}
                {data.ciFailures.data.unclassifiedCount > 0 && data.ciFailures.data.unclassifiedDrilldown &&
                  <button className="btn" onClick={() => change(data.ciFailures.data.unclassifiedDrilldown.filters)}>
                    {productLabel("unclassified")}: {data.ciFailures.data.unclassifiedCount}</button>}
              </section>}
              <div className="product-sync">
                <span>{T("Last synced", "最近同步")}: {data.overview.lastSyncedAt || T("Sync not completed", "尚未完成同步")}</span>
                <span>{T("Coverage is limited to discovered visible sources.", "覆盖范围仅限已发现且可见的来源。")}</span>
                {Object.entries(data.overview.sourceCoverage?.processingStatus || {}).map(([state, count]) => <span key={state}>{productLabel(state)}: {count}</span>)}
              </div>
              <div className="product-tabs" role="group" aria-label={T("Item views", "事项视图")}>
                {["mine", "unassigned", "waiting", "all"].map(view => <button key={view} aria-pressed={filters.view === view} aria-label={productLabel(view) + ": " + data.overview.viewCounts[view]} onClick={() => change({ view })}>{productLabel(view)} <span>{data.overview.viewCounts[view]}</span></button>)}
              </div>
              <section aria-label={T("Items", "事项")} className="product-list">
                <div className="product-list-heading"><h2>{T("Items", "事项")}</h2><span>{data.overview.totalCount} {T("distinct items", "个独立事项")}</span></div>
                {data.items.items.length === 0 ? <p className="product-message">{T("No matching items.", "没有符合筛选的事项。")}</p> : data.items.items.map(item => <article className="product-row" key={item.id}>
                  <div className="product-row-title"><span className="product-module">{item.module}</span><button onClick={() => setSelection({ kind: "item", id: item.id })}>{item.title || item.id}</button><span>{productLabel(item.attentionState)}</span></div>
                  <div className="product-tags">{item.actionTypes.map(action => <span key={action}>{productLabel(action)}</span>)}</div>
                  <div className="sub">{item.repositoryId || item.watchId} · {item.unit?.type} · v{item.itemVersion}</div>
                </article>)}
              </section>
              <Pager page={data.items} cursors={itemCursors} onChange={setItemCursors} kind="items" />
              {data.releases && <section className="product-list" aria-label={T("All releases", "全部发布")}>
                <div className="product-list-heading"><h2>{T("All releases", "全部发布")}</h2><span>{data.releases.totalCount} {T("Release and watch rows", "发布与关注行")}</span></div>
                <p className="product-sync">{T("Release × watch. Item view and action filters do not apply here.", "按发布 × 关注范围展示，不受事项视图和行动筛选影响。")}</p>
                {data.releases.data.rows.length === 0 && <p className="product-message">{T("No discovered releases.", "尚未发现发布。")}</p>}
                {data.releases.data.rows.map(row => <article className="product-row" key={JSON.stringify([row.sourceId, row.contextId])}>
                  <div className="product-row-title"><span className="product-module">{row.tagName}</span><button onClick={() => setSelection({ kind: "source", id: row.sourceId, contextId: row.contextId })}>{row.title || row.sourceId}</button><span>{productLabel(row.processingStatus)}</span></div>
                  <div className="sub">{row.watchId} · {T("Context version", "关注版本")} {row.contextVersion} · {row.publishedAt}</div>
                  {row.contextStale && <p>{productLabel("context_stale")}</p>}
                  <Coverage coverage={row.coverage} />
                  {!row.contextStale && <div className="product-tags">
                    {row.relevance && <span>{productLabel(row.relevance)}</span>}
                    {Object.entries(row.updateSignals || {}).filter(([, state]) => state != null).map(([signal, state]) =>
                      <button key={signal} onClick={() => setSelection({kind: "source", id: row.sourceId,
                        contextId: row.contextId, evidenceId: row.signalEvidenceIds?.[signal]?.[0]})}>
                        {productLabel(signal)}: {productLabel(state)}</button>)}
                  </div>}
                  {!row.contextStale && row.evidenceIds?.length > 0 && <span className="sub">{row.evidenceIds.length} {T("saved evidence references", "条已保存证据引用")}</span>}
                  <p className="sub">{T("No classification is implied for omitted material.", "未覆盖的内容不推定为不相关或未提及。")}</p>
                </article>)}
                <Pager page={data.releases} cursors={releaseCursors} onChange={setReleaseCursors} kind="sources" />
              </section>}
            </>}
        </main>
      </div>
    </div>
    {activeSelection && <ProductDetail key={JSON.stringify(activeSelection)} selection={activeSelection} onClose={() => setSelection(null)} onSaved={refresh} onAccessLost={accessLost} />}
  </>;
}
