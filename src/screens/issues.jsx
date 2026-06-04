import { useCallback, useEffect, useRef, useState } from "react";
import { pullwiseApi } from "../api/pullwise.js";
import { GitHubInstallationsList } from "../components/github-installations.jsx";
import { I } from "../icons.jsx";
import { T, useLang } from "../i18n.jsx";
import { connectGitHubRepositories, manageGitHubInstallation, signOut } from "../lib/auth.js";
import { useGitHubRepositoryAccessAutoRefresh } from "../lib/github-repository-access-refresh.js";
import { screenLinkProps } from "../lib/navigation.js";
import {
  normalizeIssuePullRequest,
  scanQueueSummary,
  useIssues,
  useScans,
} from "../lib/pullwise-data.js";
import { Sidebar, Topbar } from "../shell.jsx";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function issueConfidence(issue) {
  const confidence = Number(issue?.confidence);
  if (!Number.isFinite(confidence)) return null;
  return Math.max(0, Math.min(1, confidence));
}

function sortIssues(items, key) {
  const sorted = items.slice();
  if (key === "severity") {
    sorted.sort(
      (a, b) =>
        (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
        (issueConfidence(b) ?? -1) - (issueConfidence(a) ?? -1)
    );
  }
  if (key === "confidence")
    sorted.sort((a, b) => (issueConfidence(b) ?? -1) - (issueConfidence(a) ?? -1));
  if (key === "newest")
    sorted.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (key === "file") sorted.sort((a, b) => (a.file || "").localeCompare(b.file || ""));
  return sorted;
}

function issueTotal(scan) {
  if (!scan?.issues) return 0;
  return Object.values(scan.issues).reduce((sum, value) => sum + Number(value || 0), 0);
}

function scanHistorySummary(scan) {
  const queueSummary = scanQueueSummary(scan);
  if (scan.status === "queued" && queueSummary) {
    const queueTags = queueSummary.tags.filter(
      (tag) => !tag.startsWith("Global") && !tag.startsWith("Per user")
    );
    return ["queued", ...queueTags].join(" - ");
  }
  if (scan.issues) return T(`${issueTotal(scan)} issues`, `${issueTotal(scan)} issues`);
  return scan.status;
}

function DetailSection({ title, children, empty = "" }) {
  if (!children && !empty) return null;
  return (
    <div className="card section">
      <div className="section-h">
        <h3>{title}</h3>
      </div>
      {children || <div className="muted">{empty}</div>}
    </div>
  );
}

function issuePullRequestState(issue) {
  if (!issue?.pullRequest) return null;
  const value = normalizeIssuePullRequest(issue.pullRequest, {
    issueId: issue.id,
    title: issue.title,
  });
  return value ? { issueId: issue.id, value } : null;
}

function CodeEvidence({ title, lines }) {
  if (!lines?.length) return null;
  return (
    <div className="code" style={{ marginTop: 10 }}>
      <div className="code-head">{title}</div>
      <div className="code-body">
        <pre>
          {lines.map((line, index) => (
            <div
              key={`${title}-${line.ln || index}-${line.code}`}
              className={"code-line " + (line.t || "")}
            >
              <span className="ln">{line.ln || ""}</span>
              <span className="marker">
                {line.t === "add" ? "+" : line.t === "del" ? "-" : " "}
              </span>
              <code>{line.code}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function IssuesScreen({ go, setIssue }) {
  useLang();
  const [sev, setSev] = useState("all");
  const [status, setStatus] = useState("open");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const query = q.trim();
  const {
    items: all,
    loading,
    loadingMore,
    error,
    reload,
    loadMore,
    meta = {},
  } = useIssues({ status, severity: sev, q: query, limit: 50 });
  const filtered = sortIssues(all, sortBy);
  const totalCount = Number.isFinite(Number(meta.total)) ? Number(meta.total) : filtered.length;

  const updateStatus = async (issue, nextStatus) => {
    await pullwiseApi.issues.updateStatus(issue.id, { status: nextStatus });
    await reload();
  };
  const openIssue = (issue) => {
    setIssue(issue);
    go("issue");
  };
  const activateIssue = (event, issue) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openIssue(issue);
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Issues", "问题") }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Issues", "问题")}</h1>
              <div className="sub">
                {loading
                  ? T("Loading findings", "正在加载 findings")
                  : T(`${filtered.length} of ${totalCount} items`, `${filtered.length} / ${totalCount} 项`)}
              </div>
            </div>
            <div className="actions">
              <button
                className="btn"
                onClick={() => setSortBy(sortBy === "severity" ? "confidence" : "severity")}
              >
                <I.Sort size={14} />{" "}
                {sortBy === "severity" ? T("Severity", "严重度") : T("Confidence", "置信度")}
              </button>
            </div>
          </div>

          <div className="filters card">
            <div className="filters-row">
              <div className="repos-search" style={{ flex: 1 }}>
                <I.Search size={14} />
                <input
                  placeholder={T("Search by title, repo, or file...", "按标题、仓库或文件搜索...")}
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                />
              </div>
              <div className="seg">
                {["open", "fixed", "snoozed", "all"].map((item) => (
                  <button
                    key={item}
                    className={"seg-i" + (status === item ? " active" : "")}
                    onClick={() => setStatus(item)}
                  >
                    {item === "all" ? T("All", "全部") : item}
                  </button>
                ))}
              </div>
            </div>
            <div className="filters-row">
              <div className="filter-pills">
                <span className="filter-l">Severity</span>
                {["all", "critical", "high", "medium", "low", "info"].map((item) => (
                  <button
                    key={item}
                    className={"pill-btn" + (sev === item ? " active" : "")}
                    onClick={() => setSev(item)}
                  >
                    {item === "all" ? (
                      T("All", "全部")
                    ) : (
                      <>
                        <span className="dot" style={{ background: `var(--sev-${item})` }}></span>
                        {item}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="issues-table card">
            <div className="issues-thead">
              <div></div>
              <div>Issue</div>
              <div>File</div>
              <div>Category</div>
              <div>Confidence</div>
              <div>Status</div>
              <div></div>
            </div>
            {error && (
              <div className="muted" style={{ padding: 18 }}>
                {error}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="muted" style={{ padding: 24, textAlign: "center" }}>
                {T("No findings are available yet.", "暂无 findings。")}
              </div>
            )}
            {filtered.map((issue) => {
              const confidence = issueConfidence(issue);
              const confidenceLabel =
                confidence == null ? "--" : `${Math.round(confidence * 100)}%`;
              return (
                <div key={issue.id} className="issues-trow">
                  <div></div>
                  <div
                    className="issues-title-c"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open issue ${issue.id}`}
                    onClick={() => openIssue(issue)}
                    onKeyDown={(event) => activateIssue(event, issue)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span className={"sev sev-" + issue.severity}>
                        <span className="dot" style={{ background: "currentColor" }}></span>
                        {issue.severity}
                      </span>
                      <span className="issue-id">{issue.id}</span>
                    </div>
                    <div className="issue-t">{issue.title}</div>
                    <div className="muted">{issue.repo}</div>
                  </div>
                  <div className="issues-file">
                    {issue.file}
                    {issue.line ? ":" + issue.line : ""}
                  </div>
                  <div>
                    <span className="tag">{issue.category}</span>
                  </div>
                  <div>
                    <div className="conf-bar">
                      <div style={{ width: `${(confidence ?? 0) * 100}%` }}></div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-3)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {confidenceLabel}
                    </span>
                  </div>
                  <div>
                    <span className="tag">{issue.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {issue.status === "open" && (
                      <button className="btn sm" onClick={() => updateStatus(issue, "snoozed")}>
                        {T("Snooze", "推迟")}
                      </button>
                    )}
                    {issue.status !== "fixed" && (
                      <button
                        className="btn sm primary"
                        onClick={() => updateStatus(issue, "fixed")}
                      >
                        {T("Mark fixed", "标记已修复")}
                      </button>
                    )}
                    <button
                      className="btn sm"
                      onClick={() => {
                        openIssue(issue);
                      }}
                    >
                      <I.ArrowR size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
            {meta.hasMore && (
              <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
                <button className="btn sm" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? T("Loading...", "正在加载...") : T("Load more", "加载更多")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IssueDetailScreen({ go, issue, setIssue = null }) {
  useLang();
  const [currentStatus, setCurrentStatus] = useState(issue?.status || "open");
  const [actionError, setActionError] = useState("");
  const [fixPreview, setFixPreview] = useState(null);
  const [pullRequest, setPullRequest] = useState(issuePullRequestState(issue));
  const [fixLoading, setFixLoading] = useState("");
  const fixRequestRef = useRef(0);

  useEffect(() => {
    fixRequestRef.current += 1;
    setCurrentStatus(issue?.status || "open");
    setActionError("");
    setFixPreview(null);
    setPullRequest(issuePullRequestState(issue));
    setFixLoading("");
    return () => {
      fixRequestRef.current += 1;
    };
  }, [issue]);

  if (!issue) {
    return (
      <div className="app fade-in">
        <Topbar
          go={go}
          breadcrumbs={[{ label: T("Issue", "问题") }]}
          setIssue={setIssue}
        />
        <div className="with-side">
          <Sidebar section="issues" go={go} />
          <div className="main">
            <div className="card section muted">
              {T("Select an issue from the list first.", "请先从列表选择一个问题。")}
            </div>
            <a className="btn" style={{ marginTop: 12 }} {...screenLinkProps(go, "issues")}>
              <I.ArrowL size={13} /> {T("Back to issues", "返回问题列表")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const updateStatus = async (nextStatus) => {
    setActionError("");
    try {
      const updated = await pullwiseApi.issues.updateStatus(issue.id, { status: nextStatus });
      setCurrentStatus(updated?.status || nextStatus);
    } catch (error) {
      setActionError(error?.message || "Unable to update issue status.");
    }
  };
  const hasEvidence = issue.badCode?.length || issue.goodCode?.length;
  const autoFixable = Boolean(issue.autoFix || issue.autoFixable);
  const severity = issue.severity || "info";
  const confidence = Number(issue.confidence);
  const hasConfidence = Number.isFinite(confidence);
  const activeFixPreview = fixPreview?.issueId === issue.id ? fixPreview.value : null;
  const activePullRequest =
    pullRequest?.issueId === issue.id
      ? pullRequest.value
      : issuePullRequestState(issue)?.value || null;
  const beginFixRequest = () => {
    const requestId = fixRequestRef.current + 1;
    fixRequestRef.current = requestId;
    return requestId;
  };
  const isCurrentFixRequest = (requestId) => fixRequestRef.current === requestId;
  const previewFix = async () => {
    const requestId = beginFixRequest();
    setActionError("");
    setFixPreview(null);
    setPullRequest(issuePullRequestState(issue));
    setFixLoading("preview");
    try {
      const preview = await pullwiseApi.issues.previewFix(issue.id);
      if (!isCurrentFixRequest(requestId)) return;
      setFixPreview({ issueId: issue.id, value: preview });
    } catch (error) {
      if (!isCurrentFixRequest(requestId)) return;
      setActionError(error?.message || "Unable to preview fix.");
    } finally {
      if (isCurrentFixRequest(requestId)) setFixLoading("");
    }
  };
  const openPullRequest = async () => {
    const requestId = beginFixRequest();
    setActionError("");
    setFixLoading("pr");
    try {
      const result = await pullwiseApi.issues.createPullRequest(issue.id);
      if (!isCurrentFixRequest(requestId)) return;
      setPullRequest({
        issueId: issue.id,
        value: normalizeIssuePullRequest(result, { issueId: issue.id, title: issue.title }) || null,
      });
    } catch (error) {
      if (!isCurrentFixRequest(requestId)) return;
      setActionError(error?.message || "Unable to open pull request.");
    } finally {
      if (isCurrentFixRequest(requestId)) setFixLoading("");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[
          { label: T("Issues", "问题"), go: "issues" },
          { label: issue.id },
        ]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="issues" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <a
            className="btn ghost sm"
            style={{ marginBottom: 12 }}
            {...screenLinkProps(go, "issues")}
          >
            <I.ArrowL size={13} /> {T("Back to list", "返回列表")}
          </a>
          <div className="issue-detail-h">
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span className={"sev sev-" + severity}>
                  <span
                    className="dot"
                    style={{ background: "currentColor", width: 8, height: 8 }}
                  ></span>
                  {severity}
                </span>
                <span className="issue-id">{issue.id}</span>
                {issue.category && <span className="tag">{issue.category}</span>}
                <span className="tag">{currentStatus}</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: 0, marginBottom: 6 }}>
                {issue.title}
              </h1>
              {issue.summary && (
                <div style={{ color: "var(--text-2)", fontSize: 13.5, marginBottom: 4 }}>
                  {issue.summary}
                </div>
              )}
              <div
                className="sub"
                style={{ display: "flex", gap: 10, fontSize: 12.5, marginTop: 6, flexWrap: "wrap" }}
              >
                <span>
                  <I.Folder size={12} /> {issue.repo || "Repository unknown"}
                </span>
                <span>
                  <I.FileCode size={12} /> {issue.file || "File unknown"}
                  {issue.file && issue.line ? ":" + issue.line : ""}
                </span>
                {hasConfidence && (
                  <span
                    title={issue.confidenceRationale || undefined}
                    style={issue.confidenceRationale ? { cursor: "help" } : undefined}
                  >
                    <I.Sparkle size={12} /> {Math.round(confidence * 100)}%{" "}
                    {T("confidence", "置信度")}
                  </span>
                )}
                {issue.scanId && (
                  <span>
                    <I.Activity size={12} /> {issue.scanId}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="issue-detail-grid">
            <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
              <DetailSection title={T("Detection reasoning", "检测推理")} empty="">
                {issue.detectionReasoning && (
                  <p className="muted" style={{ color: "var(--text-2)" }}>
                    {issue.detectionReasoning}
                  </p>
                )}
              </DetailSection>

              <DetailSection title={T("Reproduction path", "复现路径")} empty="">
                {issue.reproductionPath && (
                  <p className="muted" style={{ color: "var(--text-2)" }}>
                    {issue.reproductionPath}
                  </p>
                )}
              </DetailSection>

              <DetailSection title={T("Impact", "影响")} empty={T("No impact statement was provided.", "未提供影响说明。")}>
                {issue.impact && (
                  <p className="muted" style={{ color: "var(--text-2)" }}>
                    {issue.impact}
                  </p>
                )}
              </DetailSection>

              {(issue.fixBenefits || issue.fixRisks) && (
                <DetailSection title={T("Fix impact analysis", "修复影响分析")}>
                  {issue.fixBenefits && (
                    <div style={{ marginBottom: issue.fixRisks ? 10 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 12, fontWeight: 600, color: "#16a34a" }}>
                        <I.Check size={12} /> {T("Benefits", "收益")}
                      </div>
                      <p className="muted" style={{ color: "var(--text-2)", margin: 0 }}>
                        {issue.fixBenefits}
                      </p>
                    </div>
                  )}
                  {issue.fixRisks && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, fontSize: 12, fontWeight: 600, color: "var(--sev-high, #e97316)" }}>
                        <I.X size={12} /> {T("Risks", "风险")}
                      </div>
                      <p className="muted" style={{ color: "var(--text-2)", margin: 0 }}>
                        {issue.fixRisks}
                      </p>
                    </div>
                  )}
                </DetailSection>
              )}

              <DetailSection title={T("Remediation", "修复步骤")} empty={T("No remediation steps were provided.", "未提供修复步骤。")}>
                {issue.steps?.length > 0 && (
                  <ol className="legal-list-flat" style={{ marginBottom: 0 }}>
                    {issue.steps.map((step, index) => (
                      <li key={`${index}-${step}`}>{step}</li>
                    ))}
                  </ol>
                )}
              </DetailSection>

              <DetailSection title={T("Evidence", "代码证据")} empty={T("No code evidence was provided.", "未提供代码证据。")}>
                {hasEvidence && (
                  <>
                    <CodeEvidence title="Current code" lines={issue.badCode || []} />
                    <CodeEvidence title="Suggested code" lines={issue.goodCode || []} />
                  </>
                )}
              </DetailSection>

              {issue.references?.length > 0 && (
                <DetailSection title={T("References", "参考资料")}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {issue.references.map((reference) => (
                      <a
                        key={`${reference.label}-${reference.url}`}
                        className="auth-link"
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 13 }}
                      >
                        {reference.label || reference.url}
                      </a>
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>

            <div className="card section" style={{ display: "grid", gap: 10 }}>
              <div className="section-h">
                <h3>Actions</h3>
              </div>
              {actionError && (
                <div className="auth-error" role="alert">
                  <I.X size={13} /> {actionError}
                </div>
              )}
              {currentStatus === "open" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn sm primary" onClick={() => updateStatus("fixed")}>
                    <I.Check size={13} /> Mark fixed
                  </button>
                  <button className="btn sm" onClick={() => updateStatus("snoozed")}>
                    <I.Clock size={13} /> Snooze
                  </button>
                </div>
              ) : (
                <button className="btn sm" onClick={() => updateStatus("open")}>
                  <I.Refresh size={13} /> Reopen
                </button>
              )}
              <div className="divider" />
              <button
                className="btn sm"
                disabled={!autoFixable || Boolean(fixLoading)}
                onClick={previewFix}
              >
                <I.Sparkle size={13} /> {fixLoading === "preview" ? "Previewing..." : "Preview fix"}
              </button>
              <button
                className="btn sm"
                disabled={!activeFixPreview?.valid || Boolean(fixLoading)}
                onClick={openPullRequest}
              >
                <I.GitBranch size={13} /> {fixLoading === "pr" ? "Opening..." : "Open PR"}
              </button>
              {!autoFixable && (
                <div className="muted" style={{ fontSize: 12 }}>
                  This issue is not auto-fixable.
                </div>
              )}
              {activeFixPreview && (
                <div className="fix-preview">
                  <div className="fix-preview-h">
                    <b>{activeFixPreview.file}</b>
                    <span className="tag">{activeFixPreview.valid ? "validated" : "blocked"}</span>
                  </div>
                  {activeFixPreview.message && (
                    <div className="muted">{activeFixPreview.message}</div>
                  )}
                  {activeFixPreview.diff && (
                    <pre className="diff-block">{activeFixPreview.diff}</pre>
                  )}
                </div>
              )}
              {activePullRequest?.url && (
                <a
                  className="auth-link"
                  href={activePullRequest.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Pull request #{activePullRequest.number}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryScreen({ go, openScan = null, setIssue = null }) {
  useLang();
  const [status, setStatus] = useState("all");
  const {
    items: scans,
    loading,
    loadingMore,
    error,
    loadMore,
    meta = {},
  } = useScans({ status, limit: 50 });
  const filtered = scans;
  const totalCount = Number.isFinite(Number(meta.total)) ? Number(meta.total) : filtered.length;
  const viewScan = (scan) => {
    if (openScan) {
      openScan(scan);
      return;
    }
    go("dashboard");
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[
          { label: T("Scan history", "扫描历史") },
        ]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="history" go={go} />
        <div className="main" style={{ maxWidth: "none" }}>
          <div className="page-h">
            <div>
              <h1>{T("Scan history", "扫描历史")}</h1>
              <div className="sub">
                {loading
                  ? T("Loading scans", "正在加载扫描")
                  : T(`${filtered.length} of ${totalCount} scans`, `${filtered.length} / ${totalCount} 次扫描`)}
              </div>
            </div>
            <div className="actions">
              <div className="seg">
                {["all", "queued", "running", "done", "failed", "cancelled"].map((item) => (
                  <button
                    key={item}
                    className={"seg-i" + (status === item ? " active" : "")}
                    onClick={() => setStatus(item)}
                  >
                    {item === "all" ? T("All", "全部") : item}
                  </button>
                ))}
              </div>
              <a className="btn primary" {...screenLinkProps(go, "repos")}>
                <I.Play size={11} /> {T("New scan", "新扫描")}
              </a>
            </div>
          </div>

          <div className="hist-list card">
            {error && (
              <div className="muted" style={{ padding: 18 }}>
                {error}
              </div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--text-3)",
                  fontSize: 13,
                }}
              >
                {T("No scans yet.", "暂无扫描。")}
              </div>
            )}
            {filtered.map((scan) => (
              <div key={scan.id} className="hist-row">
                <div className="hist-status">
                  {scan.status === "done" && (
                    <span className="hist-dot" style={{ background: "#16a34a" }}></span>
                  )}
                  {["queued", "running"].includes(scan.status) && (
                    <span
                      className="spin"
                      style={{ display: "inline-block", color: "var(--accent)" }}
                    >
                      <I.Refresh size={12} />
                    </span>
                  )}
                  {["failed", "cancelled"].includes(scan.status) && (
                    <span className="hist-dot" style={{ background: "var(--sev-critical)" }}></span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                    <b style={{ fontSize: 13.5 }}>{scan.repo}</b>
                    <span className="tag">
                      <I.GitBranch size={10} /> {scan.branch}
                    </span>
                    <span className="tag">{scan.commit}</span>
                  </div>
                  {scan.status === "queued" && scanQueueSummary(scan) && (
                    <div className="muted">{scanHistorySummary(scan)}</div>
                  )}
                  {!(scan.status === "queued" && scanQueueSummary(scan)) && (
                    <div className="muted">
                      {scan.issues
                        ? T(`${issueTotal(scan)} issues`, `${issueTotal(scan)} 个问题`)
                        : scan.status}
                    </div>
                  )}
                </div>
                <div className="hist-meta">
                  <div>{scan.time}</div>
                  <div className="muted">
                    {T("Triggered by ", "触发：")}
                    {scan.by}
                  </div>
                </div>
                <button className="btn sm" onClick={() => viewScan(scan)}>
                  {T("View", "查看")} <I.ArrowR size={11} />
                </button>
              </div>
            ))}
            {meta.hasMore && (
              <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
                <button className="btn sm" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? T("Loading...", "正在加载...") : T("Load more", "加载更多")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsScreen({ go, setIssue = null }) {
  useLang();
  const [tab, setTab] = useState("profile");
  const [session, setSession] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [integrationError, setIntegrationError] = useState("");
  const [managingInstallationId, setManagingInstallationId] = useState("");
  const integrationRequestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    Promise.all([pullwiseApi.auth.getSession(), pullwiseApi.integrations.list()])
      .then(([sessionPayload, integrationsPayload]) => {
        if (cancelled) return;
        setSession(sessionPayload);
        if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          if (requestId === integrationRequestIdRef.current) setIntegrations(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshGitHubRepositoryAccess = useCallback(async () => {
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    setIntegrationError("");
    try {
      await pullwiseApi.repositories.sync();
      const integrationsPayload = await pullwiseApi.integrations.list();
      if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
    } catch (error) {
      if (requestId === integrationRequestIdRef.current) {
        setIntegrationError(error?.message || "Unable to refresh GitHub repository access.");
      }
      throw error;
    }
  }, []);

  useGitHubRepositoryAccessAutoRefresh(refreshGitHubRepositoryAccess);

  const github = integrations?.github;
  const user = session?.user;
  const githubRepoCount = github?.repositories?.length || 0;
  const githubAccountNames = Array.from(
    new Set(
      [
        ...(Array.isArray(github?.installationAccounts) ? github.installationAccounts : []),
        github?.installationAccount,
      ].filter(Boolean)
    )
  );
  const githubAccount = githubAccountNames.length ? ` on ${githubAccountNames.join(", ")}` : "";
  const githubAccountZh = githubAccountNames.length ? `（${githubAccountNames.join(", ")}）` : "";
  const authorizeRepositories = async () => {
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    setIntegrationError("");
    try {
      await connectGitHubRepositories(github?.connected ? { add: true } : {});
      const integrationsPayload = await pullwiseApi.integrations.list();
      if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
    } catch (error) {
      if (requestId === integrationRequestIdRef.current) {
        setIntegrationError(error?.message || "Unable to connect GitHub repository access.");
      }
    }
  };
  const manageInstallation = async (installation) => {
    if (managingInstallationId) return;
    const targetInstallationId = installation?.id || installation?.installationId;
    const requestId = integrationRequestIdRef.current + 1;
    integrationRequestIdRef.current = requestId;
    setManagingInstallationId(targetInstallationId || "");
    setIntegrationError("");
    try {
      await manageGitHubInstallation(targetInstallationId, {
        githubIdentityId: installation?.manage?.githubIdentityId || undefined,
        redirectTo: window.location.href,
      });
      const integrationsPayload = await pullwiseApi.integrations.list();
      if (requestId === integrationRequestIdRef.current) setIntegrations(integrationsPayload);
    } catch (error) {
      if (requestId === integrationRequestIdRef.current) {
        setIntegrationError(error?.message || "Unable to manage GitHub installation.");
      }
    } finally {
      if (requestId === integrationRequestIdRef.current) setManagingInstallationId("");
    }
  };

  return (
    <div className="app fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Settings", "设置") }]}
        setIssue={setIssue}
      />
      <div className="with-side">
        <Sidebar section="settings" go={go} />
        <div className="main">
          <div className="page-h">
            <div>
              <h1>{T("Settings", "设置")}</h1>
              <div className="sub">{T("Account and integrations", "账号与集成")}</div>
            </div>
          </div>
          <div className="set-shell">
            <aside className="set-side">
              {[
                { k: "profile", t: T("Profile", "个人资料"), i: <I.User size={14} /> },
                { k: "integrations", t: T("Integrations", "集成"), i: <I.Github size={14} /> },
              ].map((item) => (
                <button
                  key={item.k}
                  className={"set-side-i" + (tab === item.k ? " active" : "")}
                  onClick={() => setTab(item.k)}
                >
                  {item.i}
                  <span>{item.t}</span>
                </button>
              ))}
            </aside>
            <div className="set-body">
              {tab === "profile" && (
                <div className="card section">
                  <div className="section-h">
                    <h3>{T("Profile", "个人资料")}</h3>
                  </div>
                  <div className="set-row">
                    <div className="set-av" style={{ background: "var(--accent)" }}>
                      {(user?.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="auth-field">
                        <span>{T("Name", "姓名")}</span>
                        <div className="auth-input">
                          <input value={user?.name || ""} readOnly />
                        </div>
                      </label>
                    </div>
                  </div>
                  <label className="auth-field">
                    <span>{T("Email", "邮箱")}</span>
                    <div className="auth-input">
                      <I.Mail size={13} />
                      <input value={user?.email || ""} readOnly />
                    </div>
                  </label>
                  <div className="set-pref">
                    <div>
                      <b>{T("Session", "会话")}</b>
                      <div className="muted">
                        {T("Stay signed in for 7 days on this browser.", "此浏览器保持登录 7 天。")}
                      </div>
                    </div>
                    <button className="btn sm" onClick={signOut}>
                      {T("Sign out", "退出登录")}
                    </button>
                  </div>
                </div>
              )}
              {tab === "integrations" && (
                <div className="card section">
                  <div className="section-h">
                    <h3>{T("Personal authorizations", "个人授权")}</h3>
                  </div>
                  <div className="int-row">
                    <I.Github size={20} />
                    <div style={{ flex: 1 }}>
                      <b>{T("GitHub repository authorization", "GitHub 仓库授权")}</b>
                      <div className="muted">
                        {github?.connected
                          ? T(
                              `${githubRepoCount} repositories authorized${githubAccount}`,
                              `${githubRepoCount} 个仓库已授权${githubAccountZh}`
                            )
                          : T(
                              "Connect repositories when you are ready to scan. Pullwise uses GitHub App repository access for checkout, fix branches, and pull requests.",
                              "准备扫描时再连接仓库。Pullwise 使用 GitHub App 仓库权限进行 checkout、修复分支和 PR 创建。"
                            )}
                      </div>
                    </div>
                    <span
                      className="pill sev-bg-low"
                      style={{
                        background: "color-mix(in oklch, #16a34a 14%, transparent)",
                        color: "#16a34a",
                      }}
                    >
                      <span className="dot"></span>{" "}
                      {github?.connected ? T("Connected", "已连接") : T("Disconnected", "未连接")}
                    </span>
                    <button className="btn sm" onClick={authorizeRepositories}>
                      {github?.connected
                        ? T("Add account or organization", "添加账号或组织")
                        : T("Connect repositories", "连接仓库")}
                    </button>
                  </div>
                  {Array.isArray(github?.identities) && github.identities.length > 0 && (
                    <div className="gh-identities">
                      {github.identities.map((identity) => (
                        <span className="tag" key={identity.id || identity.login}>
                          <I.User size={10} /> @{identity.login}
                        </span>
                      ))}
                    </div>
                  )}
                  {github?.connected && (
                    <GitHubInstallationsList
                      installations={github?.installations}
                      onManage={manageInstallation}
                      managingInstallationId={managingInstallationId}
                    />
                  )}
                  {integrationError && (
                    <div className="auth-error" role="alert">
                      <I.X size={13} /> {integrationError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
