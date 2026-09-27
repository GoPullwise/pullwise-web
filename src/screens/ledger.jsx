import { useCallback, useEffect, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { connectGitHubRepositories } from "../lib/auth.js";
import { Topbar, ProductSidebar } from "../shell.jsx";
import "./ledger.css";

const emptyExpense = () => ({ occurredOn: "",
  amount: "", currency: "USD", categoryId: "", purpose: "", note: "", quantity: "", unit: "" });

function errorText(error) {
  if (error?.status === 412) return "Save conflict. Reload the latest record before retrying.";
  if (error?.status === 403) return "Access changed. Review the current project and key permissions.";
  return error?.payload?.error?.code || error?.message || "Request failed. Please retry.";
}

function requestKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

function formatTotal({ currency, amountMinor }) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || typeof currency !== "string") return "Unavailable";
  let exponent = 2;
  try {
    exponent = new Intl.NumberFormat("en", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits;
  } catch { /* Keep a readable fallback for an older browser currency table. */ }
  const scale = 10n ** BigInt(exponent);
  const minor = BigInt(amountMinor);
  const whole = (minor / scale).toLocaleString("en");
  const fraction = exponent ? `.${(minor % scale).toString().padStart(exponent, "0")}` : "";
  return `${currency} ${whole}${fraction}`;
}

function ExpenseForm({ value, categories, projects, target, busy, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => value ? {
    occurredOn: value.occurredOn, amount: value.amount, currency: value.currency,
    categoryId: value.categoryId, purpose: value.purpose, note: value.note || "",
    quantity: value.quantity || "", unit: value.unit || "",
  } : emptyExpense());
  const [validation, setValidation] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(value?.target || target);
  const createKey = useRef(requestKey());
  const update = (name, next) => {
    createKey.current = requestKey();
    setDraft(old => ({ ...old, [name]: next }));
  };
  const field = (name, label, extra = {}) => <label key={name}>{label}
    <input value={draft[name]} onChange={event => update(name, event.target.value)}
      disabled={busy} {...extra} /></label>;
  const submit = event => {
    event.preventDefault();
    if (!draft.occurredOn || !draft.amount || !draft.currency || !draft.categoryId || !draft.purpose.trim()) {
      setValidation("Date, amount, currency, category and purpose are required.");
      return;
    }
    setValidation("");
    onSubmit({ target: selectedTarget, occurredOn: draft.occurredOn, amount: draft.amount,
      currency: draft.currency.toUpperCase(), categoryId: draft.categoryId,
      purpose: draft.purpose.trim(), note: draft.note || null,
      quantity: draft.quantity || null, unit: draft.unit || null }, createKey.current);
  };
  return <form className="ledger-form" onSubmit={submit}>
    <h2>{value ? "Edit expense" : "Add expense"}</h2>
    <label>Target<select value={selectedTarget.kind === "shared" ? "shared" : selectedTarget.projectId}
      disabled={busy} onChange={event => {
        createKey.current = requestKey();
        setSelectedTarget(event.target.value === "shared" ? { kind: "shared" } :
          { kind: "project", projectId: event.target.value });
      }}><option value="shared">Shared expense pool</option>
      {projects.map(project => <option key={project.id} value={project.id}>
        {project.githubFullName || project.description || "Project history"}</option>)}</select></label>
    <div className="ledger-fields">
      {field("occurredOn", "Date", { type: "date", required: true })}
      {field("amount", "Amount", { inputMode: "decimal", required: true })}
      {field("currency", "Currency", { maxLength: 3, required: true })}
      <label>Category<select value={draft.categoryId} required disabled={busy}
        onChange={event => update("categoryId", event.target.value)}>
        <option value="">Select category</option>
        {categories.filter(category => !category.archivedAt || category.id === value?.categoryId)
          .map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select></label>
      {field("purpose", "Purpose", { maxLength: 500, required: true })}
      {field("quantity", "Quantity", { inputMode: "decimal" })}
      {field("unit", "Unit", { maxLength: 40 })}
    </div>
    <label>Note<textarea value={draft.note} maxLength={4000} disabled={busy}
      onChange={event => update("note", event.target.value)} /></label>
    {validation && <p role="alert">{validation}</p>}
    <div className="ledger-actions"><button className="btn primary" type="submit" disabled={busy}>
      Save expense</button><button className="btn" type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}

export function LedgerScreen({ go, mode = "projects", projectId = "" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
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

  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    moreController.current?.abort();
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    setData(null);
    const options = { signal: controller.signal };
    const load = async () => {
      if (mode === "projects") {
        const [projects, repositories] = await Promise.all([
          ledgerApi.projects({}, options), ledgerApi.repositories({}, options)]);
        return { projects, repositories };
      }
      if (mode === "categories") return { categories: await ledgerApi.categories(options) };
      const [categories, expenses, project, projects] = await Promise.all([
        ledgerApi.categories(options), ledgerApi.expenses(
          mode === "shared" ? { target: "shared" } : { target: "project", projectId }, options),
        mode === "project" ? ledgerApi.project(projectId, options) : Promise.resolve(null),
        ledgerApi.projects({}, options),
      ]);
      return { categories, expenses, project, projects };
    };
    load().then(result => {
      if (!controller.signal.aborted && request === requestId.current) {
        setData(result);
        if (mode === "project") setDescription(result.project?.description || "");
      }
    }).catch(failure => {
      if (!controller.signal.aborted && request === requestId.current) setError(errorText(failure));
    }).finally(() => {
      if (!controller.signal.aborted && request === requestId.current) setLoading(false);
    });
    return () => { controller.abort(); moreController.current?.abort(); };
  }, [mode, projectId, revision]);

  const loadMore = async kind => {
    const cursor = kind === "projects" ? data?.projects?.nextCursor : data?.expenses?.nextCursor;
    if (!cursor || loadingMore) return;
    const request = requestId.current;
    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);
    setActionError("");
    try {
      const next = kind === "projects"
        ? await ledgerApi.projects({ cursor }, { signal: controller.signal })
        : await ledgerApi.expenses({ ...(mode === "shared" ? { target: "shared" } :
          { target: "project", projectId }), cursor }, { signal: controller.signal });
      if (controller.signal.aborted || request !== requestId.current) return;
      if (next.nextCursor === cursor || (next.items.length === 0 && next.nextCursor)) {
        setActionError("Pagination did not advance. Reload to retry.");
        return;
      }
      const seenBefore = new Set(data[kind].items.map(item => item.id));
      if (next.items.length && next.items.every(item => seenBefore.has(item.id)) && next.nextCursor) {
        setActionError("Pagination repeated existing records. Reload to retry.");
        return;
      }
      setData(old => {
        if (!old) return old;
        const current = old[kind];
        const seen = new Set(current.items.map(item => item.id));
        return { ...old, [kind]: { ...next,
          items: [...current.items, ...next.items.filter(item => !seen.has(item.id))] } };
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
    try {
      await callback();
      reload();
      return true;
    } catch (failure) {
      setActionError(errorText(failure));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const saveExpense = async (fields, idempotencyKey) => {
    const current = editing;
    const ok = await action(() => current
      ? ledgerApi.updateExpense(current.id, current.revision, fields, {})
      : ledgerApi.createExpense(fields, idempotencyKey, {}));
    if (ok) setEditing(null);
  };
  const removeExpense = async expense => {
    const ok = await action(() => ledgerApi.removeExpense(expense.id, expense.revision, {}));
    if (ok) setConfirmId("");
  };

  const title = mode === "projects" ? "Projects" : mode === "categories" ? "Categories" :
    mode === "shared" ? "Shared expense pool" : data?.project?.githubFullName || "Project history";
  const target = mode === "shared" ? { kind: "shared" } : { kind: "project", projectId };
  const expenses = data?.expenses?.items || [];
  const availableRepos = data?.repositories?.items?.filter(repo =>
    !data.projects.items.some(project => project.githubRepoId === repo.githubRepoId)) || [];
  return <div className="app product-workspace ledger-screen">
    <Topbar go={go} breadcrumbs={[{ label: title }]} loading={loading} />
    <div className="with-side"><ProductSidebar go={go} section={mode === "shared" ? "ledgerShared" :
      mode === "categories" ? "ledgerCategories" : "ledgerProjects"} />
      <main className="main wide"><div className="page-h"><div><h1>{title}</h1>
        <p className="sub">{mode === "projects" ? "Track expenses for each GitHub repository." :
          mode === "shared" ? "Costs used across projects stay in this pool once." :
            mode === "categories" ? "Categories are shared by your projects and pool." :
              "Your recorded expenses remain available when GitHub access changes."}</p></div>
        <button className="btn" onClick={reload} disabled={loading}>Reload</button></div>
        {error && <div role="alert" className="ledger-message">{error} <button className="btn" onClick={reload}>Retry</button></div>}
        {actionError && <p role="alert" className="ledger-message">{actionError}</p>}
        {loading && <p role="status">Loading ledger…</p>}
        {data && mode === "projects" && <>
          <section className="ledger-panel"><h2>Create project</h2>
            {availableRepos.length === 0 ? <p>No unbound authorized repositories. Connect GitHub to add a project.</p> :
              <form className="ledger-form" onSubmit={event => { event.preventDefault(); action(() =>
                ledgerApi.createProject({ githubRepoId: Number(selectedRepo || availableRepos[0].githubRepoId),
                  description }, {})); }}>
                <label>Repository<select value={selectedRepo} disabled={busy}
                  onChange={event => setSelectedRepo(event.target.value)}>
                  {availableRepos.map(repo => <option key={repo.githubRepoId} value={repo.githubRepoId}>
                    {repo.fullName}</option>)}</select></label>
                <label>Project description<textarea value={description} maxLength={2000} disabled={busy}
                  onChange={event => setDescription(event.target.value)} /></label>
                <button className="btn primary" type="submit" disabled={busy}>Create project</button>
              </form>}
            <button className="btn" onClick={() => connectGitHubRepositories({ add: true })}>Manage GitHub access</button>
          </section>
          <section className="ledger-panel"><h2>Your projects</h2>
            {data.projects.items.length === 0 && <p>No projects yet. Choose an authorized repository above.</p>}
            <div className="ledger-list">{data.projects.items.map(project => <article key={project.id}>
              <h3>{project.githubFullName || project.description || "Project history"}</h3>
              {project.description && project.githubFullName && <p>{project.description}</p>}
              {project.githubAccess === "lost" && <p role="status">GitHub access lost. Historical expenses remain available; reconnect GitHub to add new expenses.</p>}
              <p>{project.totals.map(formatTotal).join(" · ") || "No expenses"}</p>
              <button className="btn" onClick={() => go("ledgerProject", { id: project.id })}>Open project</button>
            </article>)}</div>
            {data.projects.nextCursor && <button className="btn" disabled={loadingMore}
              onClick={() => loadMore("projects")}>Load more projects</button>}
          </section>
        </>}
        {data && mode === "categories" && <>
          <section className="ledger-panel"><h2>Add category</h2>
            <form className="ledger-actions" onSubmit={event => { event.preventDefault();
              action(() => ledgerApi.createCategory({ name: categoryName.trim() }, {})); }}>
              <label>Category name<input value={categoryName} maxLength={80} required disabled={busy}
                onChange={event => setCategoryName(event.target.value)} /></label>
              <button className="btn primary" type="submit" disabled={busy}>Add category</button></form></section>
          <section className="ledger-panel"><h2>Your categories</h2>
            {data.categories.length === 0 && <p>No categories yet.</p>}
            <div className="ledger-list">{data.categories.map(category => <article key={category.id}>
              <h3>{category.name}</h3><p>{category.archivedAt ? "Archived; retained on historical expenses" : "Active"}</p>
              {categoryEdit?.id === category.id && <form className="ledger-actions" onSubmit={event => {
                event.preventDefault();
                action(() => ledgerApi.updateCategory(category.id, category.revision,
                  { name: categoryEdit.name.trim(), color: category.color }, {})).then(ok => {
                    if (ok) setCategoryEdit(null);
                  });
              }}><label>New category name<input value={categoryEdit.name} required maxLength={80}
                onChange={event => setCategoryEdit({ id: category.id, name: event.target.value })} /></label>
                <button className="btn primary" type="submit" disabled={busy}>Save category</button>
                <button className="btn" type="button" onClick={() => setCategoryEdit(null)}>Cancel</button></form>}
              {!category.archivedAt && <div className="ledger-actions">
                <button className="btn" disabled={busy} onClick={() => setCategoryEdit({ id: category.id,
                  name: category.name })}>Rename</button>
                {confirmCategoryId === category.id ? <>
                  <button className="btn" disabled={busy} onClick={() => action(() =>
                    ledgerApi.archiveCategory(category.id, category.revision, {})).then(ok => {
                      if (ok) setConfirmCategoryId("");
                    })}>Confirm archive</button>
                  <button className="btn" disabled={busy} onClick={() => setConfirmCategoryId("")}>Cancel</button>
                </> : <button className="btn" disabled={busy} onClick={() =>
                  setConfirmCategoryId(category.id)}>Archive</button>}
              </div>}</article>)}</div></section>
        </>}
        {data && (mode === "shared" || mode === "project") && <>
          {data.project?.githubAccess === "lost" && <div className="ledger-message" role="status">
            GitHub access lost. You can review, edit and remove historical expenses. Reconnect GitHub to add new expenses.</div>}
          {mode === "project" && <section className="ledger-panel"><h2>Project description</h2>
            <form onSubmit={event => { event.preventDefault(); action(() =>
              ledgerApi.updateProject(projectId, data.project.revision, { description }, {})); }}>
              <label>Description<textarea value={description} maxLength={2000}
                onChange={event => setDescription(event.target.value)} /></label>
              <button className="btn" type="submit" disabled={busy}>Save description</button></form></section>}
          <section className="ledger-panel"><h2>Expenses</h2>
            {data.categories.filter(category => !category.archivedAt).length === 0 &&
              <p>Add a category before recording expenses. <button className="btn" onClick={() => go("ledgerCategories")}>Manage categories</button></p>}
            {(data.categories.some(category => !category.archivedAt) || editing) &&
              (mode === "shared" || data.project?.githubAccess === "authorized" || editing) &&
              <ExpenseForm key={editing?.id || "new"} value={editing} target={target}
                projects={mode === "project" && !data.projects.items.some(item => item.id === projectId)
                  ? [data.project, ...data.projects.items] : data.projects.items}
                categories={data.categories} busy={busy} onSubmit={saveExpense}
                onCancel={() => setEditing(null)} />}
            {expenses.length === 0 && <p>No expenses for this target yet.</p>}
            <div className="ledger-list">{expenses.map(expense => <article key={expense.id}>
              <h3>{expense.purpose}</h3><p>{expense.occurredOn} · {expense.currency} {expense.amount}</p>
              {expense.note && <p>{expense.note}</p>}
              <div className="ledger-actions">
                <button className="btn" disabled={busy} onClick={() => setEditing(expense)}
                  aria-label={`Edit ${expense.purpose}`}>Edit</button>
                {confirmId === expense.id ? <>
                  <button className="btn" disabled={busy} onClick={() => removeExpense(expense)}>Confirm removal</button>
                  <button className="btn" disabled={busy} onClick={() => setConfirmId("")}>Cancel</button>
                </> : <button className="btn" disabled={busy} onClick={() => setConfirmId(expense.id)}
                  aria-label={`Remove ${expense.purpose}`}>Remove</button>}
              </div></article>)}</div>
            {data.expenses.nextCursor && <button className="btn" disabled={loadingMore}
              onClick={() => loadMore("expenses")}>Load more expenses</button>}
          </section>
        </>}
      </main></div>
  </div>;
}
