import { useCallback, useEffect, useRef, useState } from "react";
import { T, useLang } from "../i18n.jsx";
import { Topbar, ProductSidebar } from "../shell.jsx";
import { connectGitHubRepositories } from "../lib/auth.js";
import { productApi } from "../api/product.js";
import { requirePage, useProductRead } from "../lib/product-data.js";
import "./product.css";

function requestKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function defaultService(service) {
  return {enabled: service?.enabled ?? false,
    modules: {pr: service?.modules?.pr ?? false, ci: service?.modules?.ci ?? false},
    analysisEnabled: {pr: service?.analysisEnabled?.pr ?? false,
      ci: service?.analysisEnabled?.ci ?? false},
    allowMemberSync: service?.allowMemberSync ?? false,
    defaultAssigneeId: service?.defaultAssigneeId ?? null,
    priorityOrder: service?.priorityOrder ?? 0};
}

function RepositoryEditor({ repository, busy, onSave, onSync }) {
  const [draft, setDraft] = useState(() => defaultService(repository.service));
  const setModule = (module, enabled) => setDraft(value => ({...value,
    modules: {...value.modules, [module]: enabled},
    analysisEnabled: {...value.analysisEnabled,
      [module]: enabled && value.analysisEnabled[module]}}));
  const setAnalysis = (module, enabled) => setDraft(value => ({...value,
    analysisEnabled: {...value.analysisEnabled, [module]: enabled}}));
  return <article className="product-management-row">
    <div className="product-list-heading"><h2>{repository.fullName || repository.id}</h2>
      <span>{repository.private ? T("Private", "私有") : T("Public", "公开")}</span></div>
    <label><input type="checkbox" checked={draft.enabled} disabled={busy}
      onChange={event => setDraft(value => ({...value, enabled: event.target.checked}))} /> {T("Enable service", "启用服务")}</label>
    <div className="product-management-grid">
      {[["pr", "PR"], ["ci", "CI"]].map(([module, label]) => <fieldset key={module}>
        <legend>{label}</legend>
        <label><input type="checkbox" checked={draft.modules[module]} disabled={busy}
          onChange={event => setModule(module, event.target.checked)} /> {T("Sync facts", "同步事实")}</label>
        <label><input type="checkbox" checked={draft.analysisEnabled[module]}
          disabled={busy || !draft.modules[module]}
          onChange={event => setAnalysis(module, event.target.checked)} /> {T("Analyze new eligible sources", "分析新的合格来源")}</label>
      </fieldset>)}
    </div>
    <label><input type="checkbox" checked={draft.allowMemberSync} disabled={busy}
      onChange={event => setDraft(value => ({...value, allowMemberSync: event.target.checked}))} /> {T("Allow member fact sync", "允许成员同步事实")}</label>
    <div className="product-management-grid">
      <label>{T("Default assignee GitHub ID", "默认处理人 GitHub ID")}
        <input value={draft.defaultAssigneeId || ""} disabled={busy}
          onChange={event => setDraft(value => ({...value, defaultAssigneeId: event.target.value || null}))} /></label>
      <label>{T("Priority order", "优先顺序")}
        <input type="number" min="0" value={draft.priorityOrder} disabled={busy}
          onChange={event => setDraft(value => ({...value, priorityOrder: Number(event.target.value)}))} /></label>
    </div>
    <div className="product-actions">
      <button className="btn primary" disabled={busy}
        aria-label={`Save service for ${repository.fullName || repository.id}`}
        onClick={() => onSave(repository.id, repository.service?.revision ?? 0, draft)}>{T("Save service", "保存服务")}</button>
      <button className="btn" disabled={busy || !repository.service?.enabled}
        aria-label={`Sync facts for ${repository.fullName || repository.id}`}
        onClick={() => onSync(repository.id)}>{T("Sync GitHub facts", "同步 GitHub 事实")}</button>
    </div>
  </article>;
}

function WatchEditor({ watch, busy, onSave, onSync, onArchive }) {
  const [draft, setDraft] = useState(() => ({enabled: watch.enabled,
    analysisEnabled: watch.analysisEnabled, includePrerelease: watch.includePrerelease,
    priorityOrder: watch.priorityOrder, interests: (watch.interests || []).join("\n")}));
  const [confirmArchive, setConfirmArchive] = useState(false);
  return <article className="product-management-row">
    <div className="product-list-heading"><h2>{watch.upstreamFullName || watch.upstreamRepositoryId}</h2>
      <span>{watch.targetRepositoryId ? T("Shared", "共享") : T("Personal", "个人")}</span></div>
    <p className="sub">{watch.id} · {T("Context version", "关注版本")} {watch.contextVersion}</p>
    <div className="product-management-grid">
      <label><input type="checkbox" checked={draft.enabled} disabled={busy}
        onChange={event => setDraft(value => ({...value, enabled: event.target.checked}))} /> {T("Enable watch", "启用关注")}</label>
      <label><input type="checkbox" checked={draft.analysisEnabled} disabled={busy}
        onChange={event => setDraft(value => ({...value, analysisEnabled: event.target.checked}))} /> {T("Analyze new eligible releases", "分析新的合格发布")}</label>
      <label><input type="checkbox" checked={draft.includePrerelease} disabled={busy}
        onChange={event => setDraft(value => ({...value, includePrerelease: event.target.checked}))} /> {T("Include prereleases", "包含预发布")}</label>
    </div>
    <label>{T("Interests", "关注主题")}
      <textarea value={draft.interests} disabled={busy}
        onChange={event => setDraft(value => ({...value, interests: event.target.value}))} /></label>
    <label>{T("Priority order", "优先顺序")}
      <input type="number" min="0" value={draft.priorityOrder} disabled={busy}
        onChange={event => setDraft(value => ({...value, priorityOrder: Number(event.target.value)}))} /></label>
    <div className="product-actions">
      <button className="btn primary" disabled={busy} onClick={() => onSave(watch, draft)}>{T("Save watch", "保存关注")}</button>
      <button className="btn" disabled={busy || !watch.enabled} onClick={() => onSync(watch.id)}>{T("Sync watch facts", "同步关注事实")}</button>
      {confirmArchive ? <>
        <button className="btn" disabled={busy} onClick={() => onArchive(watch)}>{T("Confirm archive", "确认归档")}</button>
        <button className="btn" disabled={busy} onClick={() => setConfirmArchive(false)}>{T("Cancel", "取消")}</button>
      </> : <button className="btn" disabled={busy} onClick={() => setConfirmArchive(true)}>{T("Archive watch", "归档关注")}</button>}
    </div>
  </article>;
}

function interestsFrom(text) {
  return text.split(/[\n,]/).map(value => value.trim()).filter(Boolean);
}

function ManagementPager({page, cursors, onChange, resource}) {
  const stuck = page.hasMore && (!page.nextCursor || cursors.includes(page.nextCursor));
  return <div className="product-actions">
    {cursors.length > 1 && <button className="btn" onClick={() => onChange(cursors.slice(0, -1))}>
      {T("Previous page", "上一页")}</button>}
    {page.hasMore && <button className="btn" disabled={stuck}
      aria-label={`Next ${resource} page`}
      onClick={() => onChange([...cursors, page.nextCursor])}>{T("Next page", "下一页")}</button>}
    {stuck && <p role="alert">{T("Pagination stopped. Reload to continue.", "分页已停止，请重新加载。")}</p>}
  </div>;
}

export function ProductManagementScreen({ go, authorizationError = "", clearAuthorizationError = () => {} }) {
  useLang();
  const [revision, setRevision] = useState(0);
  const [repoCursors, setRepoCursors] = useState([""]);
  const [watchCursors, setWatchCursors] = useState([""]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const [upstreamOwner, setUpstreamOwner] = useState("");
  const [upstreamName, setUpstreamName] = useState("");
  const [interests, setInterests] = useState("");
  const [targetRepositoryId, setTargetRepositoryId] = useState("");
  const [includePrerelease, setIncludePrerelease] = useState(false);
  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const reload = useCallback(() => { setError(""); setBlocked(false);
    setRepoCursors([""]); setWatchCursors([""]); setRevision(value => value + 1); }, []);
  const read = useProductRead(JSON.stringify([revision, repoCursors, watchCursors]), async signal => {
    const [repositories, watches, usage] = await Promise.all([
      productApi.repositoryPage({cursor: repoCursors.at(-1)}, {signal}),
      productApi.watchPage({cursor: watchCursors.at(-1)}, {signal}),
      productApi.usage({signal})]);
    return {repositories: requirePage(repositories), watches: requirePage(watches),
      entitlements: usage?.entitlements};
  });
  async function runAction(name, action) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(name);
    setError("");
    try {
      const result = await action();
      if (!mounted.current) return;
      if (result?.id && result?.status) setNotice(`${T("Fact sync job", "事实同步任务")}: ${result.id} · ${result.status}`);
      reload();
    } catch (failure) {
      if (!mounted.current) return;
      if ([401, 403, 404].includes(failure?.status)) setBlocked(true);
      setError([409, 412].includes(failure?.status)
        ? T("Configuration changed. Reload before saving again.", "配置已变化，请重新加载后再保存。")
        : failure?.message || T("Action failed", "操作失败"));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy("");
    }
  }
  const createWatch = () => {
    const topics = interestsFrom(interests);
    if (!upstreamOwner.trim() || !upstreamName.trim() || !topics.length) {
      setError(T("Enter upstream owner, repository and at least one interest.", "填写上游所有者、仓库及至少一个关注主题。"));
      return;
    }
    runAction("create-watch", () => productApi.createWatch({
      upstream: {owner: upstreamOwner.trim(), repository: upstreamName.trim()},
      targetRepositoryId: targetRepositoryId || null, interests: topics,
      enabled: true, analysisEnabled, includePrerelease, priorityOrder: 0,
    }, requestKey()));
  };
  const data = blocked ? null : read.value;
  return <div className="app product-workspace">
    <Topbar go={go} breadcrumbs={[{label: T("Repositories and watches", "仓库与关注")}]} loading={read.loading} searchEnabled={false} />
    <div className="with-side"><ProductSidebar go={go} section="services" /><main className="main wide">
      <div className="page-h"><div><h1>{T("Repositories and watches", "仓库与关注")}</h1>
        <p className="sub">{T("Configure PR, CI and Updates fact discovery.", "配置 PR、CI 和 Updates 的事实发现。")}</p></div>
        <button className="btn" onClick={() => { clearAuthorizationError(); reload(); }}>{T("Reload data", "重新加载数据")}</button></div>
      {authorizationError && <p role="alert">{authorizationError}</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button className="btn" disabled={!!busy} onClick={() => runAction("github", () =>
        connectGitHubRepositories(data?.repositories.items.length ? {manage: true} : {add: true}))}>
        {data?.repositories.items.length ? T("Manage GitHub access", "管理 GitHub 授权") :
          T("Connect GitHub repositories", "连接 GitHub 仓库")}</button>
      {read.loading ? <p role="status">{T("Loading configurations…", "正在加载配置…")}</p> :
        read.error ? <section className="product-message" role="alert"><p>{read.error.message}</p>
          <button className="btn" onClick={reload}>{T("Retry", "重试")}</button></section> : data && <>
          <section className="product-list" aria-label={T("Repository services", "仓库服务")}>
            <div className="product-list-heading"><h2>{T("Repository services", "仓库服务")}</h2>
              <span>{T("This page", "本页")}: {data.repositories.items.length} · {T("Capacity", "容量")}: {data.entitlements?.activeRepositoryLimit ?? "?"}</span></div>
            {data.repositories.items.length === 0 && <p className="product-message">{T("No authorized repositories are available.", "暂无已授权仓库。")}</p>}
            {data.repositories.items.map(repository => <RepositoryEditor
              key={`${repository.id}:${repository.service?.revision ?? 0}`} repository={repository} busy={!!busy}
              onSave={(id, revision, fields) => runAction(`service:${id}`, () =>
                productApi.saveRepositoryService(id, revision, fields))}
              onSync={id => runAction(`sync:${id}`, () => productApi.syncRepository(id, requestKey()))} />)}
            <ManagementPager page={data.repositories} cursors={repoCursors}
              onChange={setRepoCursors} resource="repositories" />
          </section>
          <section className="product-list" aria-label={T("Updates watches", "Updates 关注")}>
            <div className="product-list-heading"><h2>{T("Updates watches", "Updates 关注")}</h2>
              <span>{T("This page", "本页")}: {data.watches.items.length} · {T("Capacity", "容量")}: {data.entitlements?.activeWatchLimit ?? "?"}</span></div>
            {data.watches.items.length === 0 && <p className="product-message">{T("No watches yet.", "暂无关注。")}</p>}
            {data.watches.items.map(watch => <WatchEditor key={`${watch.id}:${watch.revision}`}
              watch={watch} busy={!!busy}
              onSave={(current, draft) => runAction(`watch:${current.id}`, () => productApi.updateWatch(
                current.id, current.revision, {enabled: draft.enabled,
                  analysisEnabled: draft.analysisEnabled,
                  includePrerelease: draft.includePrerelease,
                  interests: interestsFrom(draft.interests), priorityOrder: draft.priorityOrder}))}
              onSync={id => runAction(`sync:${id}`, () => productApi.syncWatch(id, requestKey()))}
              onArchive={current => runAction(`archive:${current.id}`, () =>
                productApi.archiveWatch(current.id, current.revision))} />)}
            <ManagementPager page={data.watches} cursors={watchCursors}
              onChange={setWatchCursors} resource="watches" />
          </section>
          <section className="product-list product-management-create" aria-label={T("Create watch", "创建关注")}>
            <h2>{T("Create watch", "创建关注")}</h2>
            <div className="product-management-grid">
              <label>{T("Upstream owner", "上游所有者")}<input value={upstreamOwner} disabled={!!busy}
                onChange={event => setUpstreamOwner(event.target.value)} /></label>
              <label>{T("Repository name", "仓库名称")}<input value={upstreamName} disabled={!!busy}
                onChange={event => setUpstreamName(event.target.value)} /></label>
              <label>{T("Watch context", "关注范围")}
                <select value={targetRepositoryId} disabled={!!busy}
                  onChange={event => setTargetRepositoryId(event.target.value)}>
                  <option value="">{T("Personal", "个人")}</option>
                  {targetRepositoryId && !data.repositories.items.some(repository => repository.id === targetRepositoryId) &&
                    <option value={targetRepositoryId}>{targetRepositoryId}</option>}
                  {data.repositories.items.filter(repository => repository.service?.enabled).map(repository =>
                    <option key={repository.id} value={repository.id}>{repository.fullName}</option>)}
                </select></label>
            </div>
            <label>{T("Interests", "关注主题")}<textarea value={interests} disabled={!!busy}
              onChange={event => setInterests(event.target.value)} /></label>
            <div className="product-management-grid">
              <label><input type="checkbox" checked={includePrerelease} disabled={!!busy}
                onChange={event => setIncludePrerelease(event.target.checked)} /> {T("Include prereleases", "包含预发布")}</label>
              <label><input type="checkbox" checked={analysisEnabled} disabled={!!busy}
                onChange={event => setAnalysisEnabled(event.target.checked)} /> {T("Analyze new eligible releases", "分析新的合格发布")}</label>
            </div>
            <button className="btn primary" disabled={!!busy} onClick={createWatch}>{T("Create watch", "创建关注")}</button>
          </section>
        </>}
    </main></div>
  </div>;
}
