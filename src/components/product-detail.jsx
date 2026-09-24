import { useEffect, useRef, useState } from "react";
import { T } from "../i18n.jsx";
import { productApi } from "../api/product.js";
import { useProductRead, safeSourceUrl, requireTimeline } from "../lib/product-data.js";
import { useModalFocus } from "../lib/modal-focus.js";

const labels = {
  needs_action: ["Needs action", "待行动"], needs_confirmation: ["Needs confirmation", "待确认"],
  waiting: ["Waiting", "等待中"], optional: ["Optional", "可选"], closed: ["Closed", "已关闭"],
  mine: ["Needs me", "需要我处理"], unassigned: ["Unassigned", "未分配"], all: ["All items", "全部事项"],
  change_requested: ["Changes requested", "需修改"], reply_needed: ["Reply needed", "需回复"],
  review_requested: ["Review requested", "需评审"], optional_suggestion: ["Optional suggestion", "可选建议"],
  confirm_next_step: ["Confirm next step", "确认下一步"], investigate_failure: ["Investigate failure", "排查失败"],
  review_update: ["Review update", "检查更新"], analysis_disabled: ["Analysis disabled", "分析已停用"],
  rules_only: ["Rules only", "仅规则"], pending: ["Pending analysis", "待分析"], processing: ["Processing", "处理中"],
  assessed: ["Assessed", "已分析"], not_scheduled: ["Not scheduled", "未安排分析"],
  needs_manual: ["Insufficient material", "材料不足"], throttled: ["Throttled", "等待处理额度"],
  paused_quota: ["Quota paused", "额度暂停"], provider_unavailable: ["Provider unavailable", "分析服务不可用"],
  failed: ["Analysis failed", "分析失败"], open: ["Open", "未处理"], done: ["Done", "已完成"],
  dismissed: ["Not following up", "不跟进"], context_stale: ["Context stale", "关注范围已变更"],
  relevant: ["Relevant", "相关"], not_relevant: ["Not relevant", "不相关"], unclear: ["Unclear", "待确认"],
  migration_stated: ["Migration", "迁移"], deprecation_stated: ["Deprecation", "弃用"],
  breaking_change_stated: ["Breaking change", "破坏性变化"], security_fix_stated: ["Security fix", "安全修复"],
  present: ["Explicitly stated", "明确提及"], absent: ["Not explicitly stated", "未明确提及"],
  dependency_install: ["Dependency install", "依赖安装"], build: ["Build", "构建"],
  test: ["Test", "测试"], deploy: ["Deploy", "部署"], runtime: ["Runtime", "运行时"],
  unknown: ["Unknown stage", "阶段未知"],
  connection_timeout: ["Connection timeout", "连接超时"],
  name_resolution_failure: ["Name resolution failure", "域名解析失败"],
  authentication_denied: ["Authentication denied", "身份验证失败"],
  authorization_denied: ["Authorization denied", "权限被拒绝"],
  assertion_failure: ["Assertion failure", "断言失败"],
  syntax_or_type_error: ["Syntax or type error", "语法或类型错误"],
  package_resolution_failure: ["Package resolution failure", "依赖包解析失败"],
  resource_exhausted: ["Resource exhausted", "资源耗尽"],
  configuration_error: ["Configuration error", "配置错误"],
  unclassified: ["Symptom unclassified", "现象未确定"],
  snapshot_observed: ["Snapshot first observed", "首次观察到快照"],
  event_assessed: ["Assessment saved", "判断已保存"],
  disposition_changed: ["Disposition changed", "处理状态已变更"],
  assignee_changed: ["Assignee changed", "处理人已变更"],
  feedback_changed: ["Feedback changed", "反馈已变更"],
  disposition_carried_forward: ["Handling carried forward", "处理状态已继承"],
};
export const productLabel = value => labels[value] ? T(...labels[value]) : String(value || T("Unknown", "未知"));
// Timeline event types share wire values with processing statuses (e.g.
// "assessed"); namespace the event label so both stay distinct.
export const eventTypeLabel = value => productLabel(value === "assessed" ? "event_assessed" : value);

export function UpdateClassification({ context }) {
  if (context.contextStale) return null;
  return <div className="product-tags">
    {context.relevance && <span>{productLabel(context.relevance)}</span>}
    {Object.entries(context.updateSignals || {}).filter(([, state]) => state != null).map(([signal, state]) =>
      <span key={signal}>{productLabel(signal)}: {productLabel(state)}</span>)}
  </div>;
}

export function Coverage({ coverage }) {
  if (!coverage) return <span>{T("Coverage unknown", "覆盖范围未知")}</span>;
  return <div className="product-coverage">
    <span>{coverage.selectedUnits ?? "?"} / {coverage.totalUnits ?? "?"} {T("units selected", "个单元已选")}</span>
    <span>{coverage.state === "complete" ? T("Discovered material only", "仅已发现材料") : T("Partial or unavailable material", "材料不完整或不可用")}</span>
    {(coverage.limitations || []).map(limit => <span key={limit}>{limit}</span>)}
  </div>;
}

function ItemTimeline({ itemId, onAccessLost }) {
  const [cursor, setCursor] = useState("");
  const key = JSON.stringify([itemId, cursor]);
  const read = useProductRead(key, signal => productApi.itemTimeline(itemId,
    cursor ? { cursor } : {}, { signal }).then(requireTimeline));
  useEffect(() => {
    if ([401, 403, 404].includes(read.error?.status)) onAccessLost(read.error);
  }, [read.error, onAccessLost]);
  return <section className="product-timeline" aria-label={T("Saved event timeline", "已保存事件时间线")}>
    <h3>{T("Saved event timeline", "已保存事件时间线")}</h3>
    {read.loading ? <p role="status">{T("Loading events…", "正在加载事件…")}</p> :
      read.error ? <p role="alert">{read.error.message}</p> : read.value && <>
        {read.value.items.length === 0 ? <p>{T("No saved events.", "暂无已保存事件。")}</p> :
          <ol className="product-history">{read.value.items.map(event => <li key={event.id}>
            <strong>{eventTypeLabel(event.eventType)}</strong> · {event.sourceKind}
            <p>{event.timeBasis === "observed" ? T("First observed", "首次观察") : T("Occurred", "发生时间")}: <time>{event.occurredAt || event.observedAt}</time></p>
            {event.evidenceIds?.length > 0 && <p>{event.evidenceIds.length} {T("evidence references", "条证据引用")}</p>}
          </li>)}</ol>}
        {read.value.relations.map(relation => <p className="product-timeline-relation" key={`${relation.fromEventId}:${relation.kind}`}>
          <strong>{relation.kind === "later_run_succeeded" ?
            T("Verified successor execution succeeded", "已核验的后续执行成功") :
            T("Corresponding later attempt succeeded", "对应的后续尝试成功")}</strong>
          <span> · {relation.toExecution.runId} / {relation.toExecution.jobId}</span>
          {!relation.fromLoaded && <span> · {T("Earlier event is on another page", "先前事件在其他页")}</span>}
        </p>)}
        {read.value.coverage?.limitations?.map(limit => <p className="sub" key={limit}>{limit}</p>)}
        {read.value.hasMore && <button className="btn" disabled={!read.value.nextCursor || read.value.nextCursor === cursor}
          onClick={() => setCursor(read.value.nextCursor)}>{T("Next events", "下一页事件")}</button>}
      </>}
  </section>;
}

function Assessments({ assessments }) {
  return assessments.map(assessment => <details key={assessment.id} className="product-assessment">
    <summary>{T("Model assessment", "模型判断")} · {assessment.model} · {assessment.questionVersion}</summary>
    <p>{T("Option probabilities are model allocations, not accuracy.", "选项概率是模型分配，不代表正确率。")}</p>
    {Object.entries(assessment.answers || {}).map(([key, answer]) => <section key={key}>
      <h4>{key} · {answer.choice}</h4>
      <p>{T("Confidence", "置信度")}: {answer.confidence ?? T("Unknown", "未知")}</p>
      {Object.entries(answer.probabilities || {}).map(([option, probability]) => <div key={option} className="product-probability">
        <span>{option}</span><meter min="0" max="1" value={probability} aria-label={option} /><span>{Math.round(probability * 100)}%</span>
      </div>)}
      {(assessment.bindings?.[key]?.evidenceIds || []).map(id => <a key={id} href={`#evidence-${encodeURIComponent(id)}`}>{T("Evidence", "证据")} {id}</a>)}
    </section>)}
  </details>);
}

export function ProductDetail({ selection, onClose, onSaved, onAccessLost }) {
  const [reload, setReload] = useState(0);
  const [writeError, setWriteError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const lock = useRef(null);
  const dialogRef = useRef(null);
  const key = JSON.stringify([selection.kind, selection.id, reload]);
  const read = useProductRead(key, signal => productApi[selection.kind](selection.id, { signal }));
  const item = read.value;
  const noteRef = useRef(null);
  const assigneeRef = useRef(null);
  useModalFocus({ open: true, dialogRef, onClose });
  useEffect(() => () => lock.current?.abort(), []);
  useEffect(() => {
    if ([401, 403, 404].includes(read.error?.status)) onAccessLost(read.error);
  }, [read.error, onAccessLost]);

  async function save(fields) {
    if (lock.current || conflict || !item) return;
    const controller = new AbortController();
    lock.current = controller;
    setSaving(true);
    setWriteError("");
    try {
      await productApi.handle(item, fields, { signal: controller.signal });
      if (!controller.signal.aborted) onSaved();
    } catch (error) {
      if (controller.signal.aborted) return;
      if ([401, 403, 404].includes(error.status)) onAccessLost(error);
      else if ([409, 412].includes(error.status)) {
        setConflict(true);
        setWriteError(T("This item changed. Reload it before handling it again.", "事项已变化，请重新加载后再处理。"));
      } else setWriteError(error.message || T("Save failed", "保存失败"));
    } finally {
      if (!controller.signal.aborted) { lock.current = null; setSaving(false); }
    }
  }
  const reloadItem = () => { setConflict(false); setWriteError(""); setReload(value => value + 1); };
  const url = safeSourceUrl(item?.sourceUrl);
  return <div className="product-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-detail" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="product-detail-title" tabIndex={-1}>
      <header><h2 id="product-detail-title">{T("Evidence and handling", "证据与处理")}</h2><button className="btn" onClick={onClose}>{T("Close", "关闭")}</button></header>
      {read.loading ? <p role="status">{T("Loading evidence…", "正在加载证据…")}</p> : read.error ? <div role="alert"><p>{read.error.message}</p><button className="btn" onClick={reloadItem}>{T("Reload item", "重新加载事项")}</button></div> : item && <>
        <h3>{item.title || item.sourceFacts?.name || item.sourceFacts?.tagName || item.id}</h3>
        {url && <a className="product-source-link" href={url} target="_blank" rel="noopener noreferrer">{T("Open on GitHub", "在 GitHub 打开")}</a>}
        <h3>{T("GitHub facts", "GitHub 事实")}</h3>
        <pre className="product-evidence">{JSON.stringify(item.sourceFacts || {}, null, 2)}</pre>
        {item.module === "ci" && !item.sourceFacts?.recovery && <p>{T("Successor relationship unknown unless verified by the server.", "后续执行的对应关系以服务端核验为准。")}</p>}
        <h3>{T("Source evidence", "来源证据")}</h3>
        {selection.kind === "source" && <pre className="product-evidence">{typeof item.content?.body === "string" ? item.content.body : JSON.stringify(item.content || {}, null, 2)}</pre>}
        {(item.evidence || []).map(evidence => <section id={`evidence-${encodeURIComponent(evidence.id)}`} key={evidence.id}>
          <p>{(evidence.actionTypes || []).map(productLabel).join(" · ")}</p>
          {evidence.status === "available" && evidence.progressType === "completion_claim" && <p>{T("Completion claim · model classification, not verified completion", "完成声明 · 模型分类，实际完成情况未核验")}</p>}
          {evidence.status === "expired" ? <p>{T("Evidence expired", "证据已过期")}</p> : evidence.status && evidence.status !== "available" ? <p>{T("Evidence unavailable", "证据不可用")}</p> : <pre className="product-evidence">{evidence.text || T("No text evidence", "无正文证据")}</pre>}
        </section>)}
        <Assessments assessments={item.assessments || []} />
        {selection.kind === "source" && (item.contexts || []).filter(context => !selection.contextId || context.id === selection.contextId).map(context => <section key={context.id}>
          <h3>{context.watchId} · {T("Context version", "关注版本")} {context.contextVersion}</h3>
          <Coverage coverage={context.coverage} />
          <UpdateClassification context={context} />
          {!context.contextStale && <>
            {(context.evidence || []).map(evidence => <section key={evidence.id} id={`evidence-${encodeURIComponent(evidence.id)}`}>
              {evidence.status === "expired" ? <p>{T("Evidence expired", "证据已过期")}</p> : evidence.status && evidence.status !== "available" ? <p>{T("Evidence unavailable", "证据不可用")}</p> : <pre className="product-evidence">{evidence.text}</pre>}
            </section>)}
            <Assessments assessments={context.assessments || []} />
          </>}
        </section>)}
        {selection.kind === "item" && <>
          <h3>{T("Pullwise handling", "Pullwise 处理")}</h3>
          <p>{productLabel(item.handling?.disposition)} · {productLabel(item.attentionState)}</p>
          {item.closureReason && <p>{item.closureReason}</p>}
          {item.handling?.carriedFromItemVersion != null && <p>{T("Carried from version", "继承自版本")} {item.handling.carriedFromItemVersion}</p>}
          <p className="sub">{T("These actions only update Pullwise, not GitHub.", "这些操作只更新 Pullwise，不修改 GitHub。")}</p>
          <label>{T("Optional note", "可选备注")}<textarea key={`note-${key}`} ref={noteRef} defaultValue={item.handling?.note || ""} maxLength={2048} disabled={saving || conflict} /></label>
          <div className="product-actions">
            <button className="btn primary" disabled={saving || conflict} onClick={() => save({ disposition: "done", note: noteRef.current.value || null })}>{T("Mark done", "标记完成")}</button>
            <button className="btn" disabled={saving || conflict} onClick={() => save({ disposition: "dismissed", note: noteRef.current.value || null })}>{T("Do not follow up", "不跟进")}</button>
            <button className="btn" disabled={saving || conflict} onClick={() => save({ disposition: "open", note: noteRef.current.value || null })}>{T("Reopen handling", "重新处理")}</button>
          </div>
          <label>{T("Assignee GitHub ID", "处理人 GitHub ID")}<input key={`assignee-${key}`} ref={assigneeRef} defaultValue={item.handling?.assigneeId || ""} disabled={saving || conflict} /></label>
          <div className="product-actions"><button className="btn" disabled={saving || conflict} onClick={() => save({ assigneeId: assigneeRef.current.value.trim() || null })}>{T("Save assignee", "保存处理人")}</button>
          <button className="btn" disabled={saving || conflict} onClick={() => save({ feedback: "classification_inaccurate" })}>{T("Classification inaccurate", "分类不准确")}</button></div>
          {item.handling?.feedback && <p>{T("Classification feedback recorded", "已记录分类反馈")}</p>}
          {writeError && <p role="alert">{writeError}</p>}
          {conflict && <button className="btn" onClick={reloadItem}>{T("Reload item", "重新加载事项")}</button>}
          <h3>{T("Handling history", "处理历史")}</h3>
          {(item.handlingHistory || []).length === 0 ? <p>{T("No handling records.", "暂无处理记录。")}</p> : <ol className="product-history">{item.handlingHistory.map(event => <li key={event.id}>
            <p>v{event.itemVersion} · {event.actorId} · {productLabel(event.disposition)} · {event.eventKind}</p>
            <time>{new Date(event.createdAt * 1000).toLocaleString()}</time>
            {event.note && <pre className="product-evidence">{event.note}</pre>}
            {event.feedback && <p>{T("Classification feedback recorded", "已记录分类反馈")}</p>}
          </li>)}</ol>}
          <ItemTimeline itemId={item.id} onAccessLost={onAccessLost} />
        </>}
      </>}
    </section>
  </div>;
}
