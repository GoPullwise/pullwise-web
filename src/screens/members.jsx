import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { I } from "../icons.jsx";
import { LedgerSplit } from "../components/ledger-split.jsx";
import { ConsoleLayout } from "../components/console-layout.jsx";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";
import "./ledger.css";

const EDITABLE_ROLES = ["admin", "editor", "viewer"];

function invitationToken() {
  const values = new URLSearchParams(window.location.hash.slice(1)).getAll("invite");
  return values.length === 1 && values[0].length <= 8192 ? values[0] : "";
}

function roleName(role) {
  return (
    {
      owner: T("Owner", "所有者"),
      admin: T("Admin", "管理员"),
      editor: T("Editor", "编辑者"),
      viewer: T("Viewer", "查看者"),
    }[role] || role
  );
}

function memberName(member) {
  return member.githubLogin || member.name || member.userId;
}

function MemberIdentity({ name, login, children }) {
  const initial = Array.from(String(name || login || "?").trim())[0]?.toLocaleUpperCase() || "?";
  return (
    <div className="member-identity">
      <span className="member-avatar" aria-hidden="true">
        {initial}
      </span>
      <div className="member-identity-copy">
        <h3>{name || login}</h3>
        {login && <span className="member-login">@{login}</span>}
        {children}
      </div>
    </div>
  );
}

function items(result) {
  if (!Array.isArray(result?.items))
    throw new Error(T("Member data unavailable.", "成员数据暂不可用。"));
  return result.items;
}

function validInvitation(result) {
  return Boolean(
    result &&
    EDITABLE_ROLES.includes(result.role) &&
    result.expiresAt &&
    result.workspace?.id &&
    (!result.request ||
      (result.request.id && ["pending", "approved", "rejected"].includes(result.request.status)))
  );
}

function failureMessage(failure) {
  if (failure?.code === "INVITATION_EXISTS")
    return T(
      "An invitation is already pending for this GitHub account. Revoke it below before creating a new link.",
      "此 GitHub 账户已有待接受的邀请，原链接仍可使用。若丢失链接，请先在下方撤销邀请，再生成新链接。"
    );
  if (failure?.code === "INVITATION_LIMIT")
    return T(
      "The pending invitation limit has been reached. Revoke an unused invitation below, then try again.",
      "待接受邀请已达到上限，请在下方撤销一个不用的邀请后再试。"
    );
  if (failure?.code === "OWNER_IMMUTABLE")
    return T(
      "You already own this ledger. Invite another Pullwise account.",
      "你已是此账本的所有者，请邀请其他 Pullwise 账户。"
    );
  if (failure?.code === "INVITATION_RECIPIENT_MISMATCH")
    return T(
      "This invitation is for another GitHub account. Sign in with the invited account.",
      "此邀请属于另一个 GitHub 账户，请使用受邀账户登录。"
    );
  if (failure?.code === "INVITATION_NOT_FOUND")
    return T(
      "This invitation is unavailable. Ask the ledger owner for a new link.",
      "此邀请已不可用，请向账本所有者索取新链接。"
    );
  if (failure?.code === "INVITATION_AUTHORITY_LOST")
    return T(
      "The inviter no longer has permission. Ask the ledger owner for a new link.",
      "邀请人已失去邀请权限，请向账本所有者索取新链接。"
    );
  if (failure?.code === "INVITATION_ACCEPTED")
    return T(
      "This invitation has already been accepted. Reload your ledgers to check current access.",
      "此邀请已被接受，请重新加载账本以查看当前权限。"
    );
  if (failure?.code === "INVITATION_REVOKED")
    return T(
      "This invitation was revoked. Ask the ledger owner for a new link.",
      "此邀请已撤销，请向账本所有者索取新链接。"
    );
  if (failure?.code === "INVITATION_EXPIRED" || failure?.status === 410)
    return T(
      "This invitation has expired. Ask the ledger owner for a new link.",
      "此邀请已过期，请向账本所有者索取新链接。"
    );
  if (failure?.code === "ALREADY_MEMBER")
    return T("That account is already a member of this ledger.", "此账户已经是此账本的成员。");
  if (failure?.code === "INVITATION_REQUEST_REJECTED")
    return T(
      "Your request was rejected. Ask the inviter for a new link.",
      "你的申请已被拒绝，请向邀请人索取新链接。"
    );
  if (failure?.code === "INVITATION_REQUEST_LIMIT")
    return T(
      "This invitation has too many requests. Ask the inviter for a new link.",
      "此邀请的申请数量已达上限，请向邀请人索取新链接。"
    );
  if (failure?.status === 409 || failure?.status === 412) {
    return T(
      "Changes conflict with a newer version. Reload members before trying again.",
      "数据版本已变化。请重新加载成员后再试。"
    );
  }
  if (failure?.status === 403)
    return T(
      "Your access changed. Reload members before trying again.",
      "你的权限已变化，请重新加载成员后再试。"
    );
  if (failure?.status === 404)
    return T(
      "This member or invitation is no longer available. Reload members to check access.",
      "此成员或邀请已不可用。请重新加载成员以检查权限。"
    );
  return failure?.message || T("Member data unavailable.", "成员数据暂不可用。");
}

export function MembersScreen({
  go,
  api = ledgerApi,
  workspace = null,
  onMembershipChanged,
  onAccessChanged,
  onInvitationRequestsChanged,
  reviewIntent,
  onReviewHandled,
}) {
  useLang();
  const [token, setToken] = useState(invitationToken);
  useEffect(() => {
    const changed = () => setToken(invitationToken());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const clearInvitation = () => {
    if (invitationToken() !== token) return;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    );
    setToken("");
  };
  const scope = JSON.stringify([
    workspace?.id,
    workspace?.memberRevision ?? workspace?.revision,
    workspace?.role,
    workspace?.permissions?.manageMembers === true,
    workspace?.permissions?.manageAdmins === true,
    token,
  ]);
  return (
    <MembersContent
      key={scope}
      go={go}
      api={api}
      workspace={workspace}
      token={token}
      onMembershipChanged={onMembershipChanged}
      onAccessChanged={onAccessChanged}
      onInvitationRequestsChanged={onInvitationRequestsChanged}
      reviewIntent={reviewIntent}
      onReviewHandled={onReviewHandled}
      clearInvitation={clearInvitation}
    />
  );
}

function MembersContent({
  go,
  api,
  workspace,
  token,
  onMembershipChanged,
  onAccessChanged,
  onInvitationRequestsChanged,
  reviewIntent,
  onReviewHandled,
  clearInvitation,
}) {
  const workspaceId = workspace?.id || "";
  const canManage = workspace?.permissions?.manageMembers === true;
  const canManageAdmins = canManage && workspace?.permissions?.manageAdmins === true;
  const grantableRoles = canManageAdmins ? EDITABLE_ROLES : ["editor", "viewer"];
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState(null);
  const [requests, setRequests] = useState(null);
  const [requestsError, setRequestsError] = useState("");
  const [requestsHasMore, setRequestsHasMore] = useState(false);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [roles, setRoles] = useState({});
  const [editId, setEditId] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [managementOpen, setManagementOpen] = useState(false);
  const managementId = useId();
  const inviteOpener = useRef(null);
  const inviteRoleInput = useRef(null);
  const focusManagement = useRef("");
  const handledReview = useRef(null);
  const roleInput = useRef(null);
  const removeConfirm = useRef(null);
  const editOpeners = useRef(new Map());
  const removeOpeners = useRef(new Map());
  const focusAction = useRef(null);
  const memberHeading = useRef(null);
  const requestHeading = useRef(null);
  const focusReview = useRef(false);
  const [inviteRole, setInviteRole] = useState("viewer");
  const [createdInvite, setCreatedInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(Boolean(token));
  const [invitationError, setInvitationError] = useState("");
  const [acceptAttempted, setAcceptAttempted] = useState(false);
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const loadId = useRef(0);
  const loadController = useRef(null);
  const previewController = useRef(null);
  const previewId = useRef(0);
  const actionPending = useRef(false);
  const copyPending = useRef(false);
  const inviteVersion = useRef(0);
  const accessNotified = useRef(false);
  const callbacks = useRef({});
  callbacks.current = {
    onMembershipChanged,
    onAccessChanged,
    onInvitationRequestsChanged,
    onReviewHandled,
    clearInvitation,
  };

  const current = useCallback(
    (ticket) => mounted.current && lifecycle.current === ticket && invitationToken() === token,
    [token]
  );

  const failed = useCallback((failure, invitation = false) => {
    const invitationConflict =
      failure?.status === 409 && ["INVITATION_EXISTS", "ALREADY_MEMBER"].includes(failure.code);
    const invitationForbidden =
      failure?.status === 403 && ["INVITATION_LIMIT", "OWNER_IMMUTABLE"].includes(failure.code);
    if (invitation) setInvitationError(failureMessage(failure));
    else {
      setError(failureMessage(failure));
      if (!invitationConflict && (failure?.status === 409 || failure?.status === 412))
        setConflict(true);
    }
    // The incoming capability can name another or deleted ledger. Its failure
    // must not invalidate the independently loaded current ledger or replay preview.
    if (
      !invitation &&
      !invitationForbidden &&
      (failure?.status === 403 || failure?.status === 404)
    ) {
      setAccessLost(true);
      if (!accessNotified.current) {
        accessNotified.current = true;
        callbacks.current.onAccessChanged?.(failure);
      }
    }
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId || !mounted.current) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const requestId = ++loadId.current;
    const ticket = lifecycle.current;
    setLoading(true);
    setMembers(null);
    setInvites(null);
    setRequests(null);
    setRequestsError("");
    setRequestsHasMore(false);
    setError("");
    setConflict(false);
    setAccessLost(false);
    setRoles({});
    setEditId("");
    setRemoveId("");
    accessNotified.current = false;
    // StrictMode's first setup is cancelled before dispatch, rather than
    // posting two invitation previews or reading a discarded ledger scope.
    await Promise.resolve();
    if (!current(ticket) || controller.signal.aborted) return;
    const results = await Promise.allSettled([
      Promise.resolve()
        .then(() => api.members(workspaceId, { signal: controller.signal }))
        .then(items),
      ...(canManage
        ? [
            Promise.resolve()
              .then(() => api.invites(workspaceId, { signal: controller.signal }))
              .then(items),
            Promise.resolve()
              .then(() =>
                api.workspaceInvitationRequests(workspaceId, { signal: controller.signal })
              )
              .then((result) => ({ items: items(result), hasMore: result.hasMore === true })),
          ]
        : []),
    ]);
    if (!current(ticket) || controller.signal.aborted || requestId !== loadId.current) return;
    if (loadController.current === controller) loadController.current = null;
    setLoading(false);
    if (results[0].status === "fulfilled") setMembers(results[0].value);
    else failed(results[0].reason);
    if (canManage) {
      if (results[1].status === "fulfilled") setInvites(results[1].value);
      else failed(results[1].reason);
      if (results[2].status === "fulfilled") {
        setRequests(
          items(results[2].value).filter(
            (request) => request.workspaceId === workspaceId && request.status === "pending"
          )
        );
        setRequestsHasMore(results[2].value.hasMore === true);
      } else setRequestsError(failureMessage(results[2].reason));
    }
  }, [api, workspaceId, canManage, current, failed]);

  const loadInvitation = useCallback(async () => {
    if (
      !token ||
      !mounted.current ||
      actionPending.current ||
      (previewController.current && !previewController.current.signal.aborted)
    )
      return;
    const ticket = lifecycle.current;
    const requestId = ++previewId.current;
    const controller = new AbortController();
    previewController.current = controller;
    setPreviewLoading(true);
    setPreview(null);
    setInvitationError("");
    // Confirm the current request status before allowing another explicit
    // submission. A failed mutation is never retried automatically.
    await Promise.resolve();
    if (!current(ticket) || controller.signal.aborted) return;
    try {
      const result = await api.previewInvitation({ token }, { signal: controller.signal });
      if (!current(ticket) || controller.signal.aborted || requestId !== previewId.current) return;
      if (!validInvitation(result)) {
        throw new Error(T("Invitation data unavailable.", "邀请数据暂不可用。"));
      }
      setPreview(result);
      setAcceptAttempted(false);
    } catch (failure) {
      if (current(ticket) && !controller.signal.aborted && requestId === previewId.current)
        failed(failure, true);
    } finally {
      if (previewController.current === controller) previewController.current = null;
      if (current(ticket) && !controller.signal.aborted && requestId === previewId.current)
        setPreviewLoading(false);
    }
  }, [api, token, current, failed]);

  useEffect(() => {
    mounted.current = true;
    lifecycle.current += 1;
    load();
    loadInvitation();
    return () => {
      mounted.current = false;
      lifecycle.current += 1;
      loadId.current += 1;
      previewId.current += 1;
      loadController.current?.abort();
      previewController.current?.abort();
    };
  }, [load, loadInvitation]);

  const runAction = async (operation, success, invitation = false) => {
    const ticket = lifecycle.current;
    if (!current(ticket)) return;
    if (actionPending.current || (!invitation && (loading || !members || conflict || accessLost)))
      return;
    actionPending.current = true;
    setBusy(true);
    if (invitation) setInvitationError("");
    else setError("");
    try {
      const result = await operation();
      if (!current(ticket)) return;
      success?.(result);
      if (!invitation && current(ticket)) {
        callbacks.current.onMembershipChanged?.();
        if (current(ticket)) await load();
      }
    } catch (failure) {
      if (current(ticket)) failed(failure, invitation);
    } finally {
      actionPending.current = false;
      if (current(ticket)) setBusy(false);
    }
  };

  const disabled = busy || loading || !members || conflict || accessLost;
  const showManagement = managementOpen && canManage && !loading && members !== null;
  const toggleManagement = () => {
    if (disabled || actionPending.current || !canManage || !current(lifecycle.current)) return;
    focusManagement.current = managementOpen ? "close" : "open";
    setManagementOpen(!managementOpen);
  };
  useEffect(() => {
    if (loading || busy || !current(lifecycle.current)) return;
    if (focusManagement.current === "close") {
      focusManagement.current = "";
      inviteOpener.current?.focus();
    } else if (focusManagement.current === "open" && showManagement) {
      focusManagement.current = "";
      inviteRoleInput.current?.focus();
    } else if (focusReview.current) {
      focusReview.current = false;
      requestHeading.current?.focus();
    } else if (focusAction.current) {
      const { action, userId } = focusAction.current;
      focusAction.current = null;
      const openers = action === "edit" ? editOpeners : removeOpeners;
      const opener = openers.current.get(userId);
      if (opener && !opener.disabled) opener.focus();
      else memberHeading.current?.focus();
    } else if (members && editId && !disabled) {
      roleInput.current?.focus();
    } else if (members && removeId && !disabled) {
      removeConfirm.current?.focus();
    }
  }, [editId, removeId, loading, busy, members, disabled, current, showManagement]);

  useEffect(() => {
    if (
      !reviewIntent ||
      !reviewIntent.nonce ||
      reviewIntent.workspaceId !== workspaceId ||
      handledReview.current === reviewIntent.nonce ||
      !canManage ||
      disabled ||
      !current(lifecycle.current)
    )
      return;
    handledReview.current = reviewIntent.nonce;
    focusManagement.current = "";
    focusReview.current = true;
    setManagementOpen(true);
    if (requestHeading.current) {
      focusReview.current = false;
      requestHeading.current.focus();
    }
    callbacks.current.onReviewHandled?.(reviewIntent);
  }, [reviewIntent, workspaceId, canManage, disabled, current]);

  const closeRole = (userId) => {
    if (!current(lifecycle.current) || actionPending.current) return;
    focusAction.current = { action: "edit", userId };
    setEditId("");
    setRoles({});
  };
  const closeRemoval = (userId) => {
    if (busy || loading || actionPending.current || !current(lifecycle.current)) return;
    focusAction.current = { action: "remove", userId };
    setRemoveId("");
  };
  const confirmRemoval = (member) => {
    if (
      disabled ||
      actionPending.current ||
      !current(lifecycle.current) ||
      removeId !== member.userId ||
      !canManage ||
      member.role === "owner" ||
      (!canManageAdmins && member.role === "admin")
    )
      return;
    runAction(
      () => api.removeMember(workspaceId, member.userId, member.revision, {}),
      () => {
        focusAction.current = { action: "remove", userId: member.userId };
      }
    );
  };
  const saveRole = (member, role) => {
    if (
      disabled ||
      actionPending.current ||
      !current(lifecycle.current) ||
      editId !== member.userId ||
      !canManage ||
      member.role === "owner" ||
      (!canManageAdmins && member.role === "admin") ||
      role === member.role ||
      !grantableRoles.includes(role)
    )
      return;
    setRoles({ [member.userId]: role });
    runAction(
      () => api.updateMember(workspaceId, member.userId, member.revision, { role }, {}),
      () => {
        focusAction.current = { action: "edit", userId: member.userId };
      }
    );
  };
  const createInvite = (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (!grantableRoles.includes(inviteRole)) return;
    runAction(
      () => api.inviteMember(workspaceId, { role: inviteRole }, {}),
      (result) => {
        if (!result?.token)
          throw new Error(T("Invitation link unavailable.", "邀请链接暂不可用。"));
        inviteVersion.current += 1;
        setCreatedInvite({
          ...result,
          link: `${window.location.origin}/members#invite=${encodeURIComponent(result.token)}`,
        });
        setCopied(false);
      }
    );
  };

  const copyInvite = async () => {
    const ticket = lifecycle.current;
    if (!current(ticket)) return;
    if (copyPending.current || copied || !createdInvite) return;
    copyPending.current = true;
    const version = inviteVersion.current;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(createdInvite.link);
      if (current(ticket) && version === inviteVersion.current) setCopied(true);
    } catch {
      if (current(ticket) && version === inviteVersion.current)
        setError(
          T(
            "Copy unavailable. Select and copy the invitation link.",
            "无法自动复制，请选择并复制邀请链接。"
          )
        );
    } finally {
      copyPending.current = false;
      if (current(ticket)) setCopying(false);
    }
  };

  const accept = () => {
    if (!current(lifecycle.current)) return;
    if (
      !preview ||
      preview.request ||
      preview.status === "accepted" ||
      acceptAttempted ||
      actionPending.current
    )
      return;
    setAcceptAttempted(true);
    runAction(
      () => api.acceptInvitation({ token }, {}),
      (result) => {
        if (!validInvitation(result) || !result.request)
          throw new Error(T("Invitation data unavailable.", "邀请数据暂不可用。"));
        setPreview(result);
        callbacks.current.onInvitationRequestsChanged?.();
      },
      true
    );
  };

  const reviewRequest = (request, decision) => {
    if (
      !canManage ||
      request.status !== "pending" ||
      (!canManageAdmins && request.invitation?.role === "admin")
    )
      return;
    runAction(
      () =>
        api[decision === "approve" ? "approveInviteRequest" : "rejectInviteRequest"](
          workspaceId,
          request.invitationId,
          request.id,
          request.revision,
          {}
        ),
      (result) => {
        if (result?.request?.status !== (decision === "approve" ? "approved" : "rejected"))
          throw new Error(T("Invitation data unavailable.", "邀请数据暂不可用。"));
        focusReview.current = true;
        callbacks.current.onInvitationRequestsChanged?.();
      }
    );
  };

  return (
    <div className="app product-workspace ledger-screen members-screen fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Members", "成员") }]}
        loading={loading || busy || previewLoading}
        navigationDisabled={busy}
      />
      <ConsoleLayout>
        <Sidebar section="ledgerMembers" go={go} navigationDisabled={busy} />
        <main className="main">
          <div className="page-h">
            <div>
              <h1>{T("Members", "成员")}</h1>
              <p className="sub">{workspace?.name || T("Ledger access", "账本权限")}</p>
            </div>
            {workspaceId && (
              <div className="actions">
                {canManage && (
                  <button
                    className="btn primary"
                    type="button"
                    ref={inviteOpener}
                    aria-expanded={showManagement}
                    aria-controls={managementId}
                    onClick={toggleManagement}
                    disabled={disabled}
                  >
                    <I.Plus size={16} aria-hidden="true" />
                    {T("Invite member", "邀请成员")}
                  </button>
                )}
                <button className="btn" onClick={load} disabled={loading || busy}>
                  {T("Reload", "重新加载")}
                </button>
              </div>
            )}
          </div>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          {token && (
            <section
              className="panel member-invitation"
              aria-label={T("Invitation", "邀请")}
              aria-busy={previewLoading}
            >
              <h2>{T("Ledger invitation", "账本邀请")}</h2>
              {previewLoading && <p role="status">{T("Checking invitation…", "正在检查邀请…")}</p>}
              {invitationError && (
                <div className="notice notice-error" role="alert">
                  <p>{invitationError}</p>
                  {acceptAttempted && (
                    <p>
                      {T(
                        "Check the invitation status before trying again. A request only grants access after approval.",
                        "请先检查邀请状态再重试，只有申请获批后才能访问账本。"
                      )}
                    </p>
                  )}
                  <div className="panel-actions">
                    <button
                      className="btn"
                      disabled={busy || previewLoading}
                      onClick={loadInvitation}
                    >
                      {T("Check invitation again", "重新检查邀请")}
                    </button>
                  </div>
                </div>
              )}
              {preview && (
                <div className="panel-body">
                  {preview.workspace?.name && <h3>{preview.workspace.name}</h3>}
                  {preview.recipient?.login && (
                    <p>
                      {T("GitHub account", "GitHub 账户")}: {preview.recipient.login}
                    </p>
                  )}
                  <p>
                    {T("Role", "角色")}:{" "}
                    {roleName(
                      preview.status === "accepted"
                        ? preview.workspace.role || preview.role
                        : preview.role
                    )}
                  </p>
                  {preview.status === "accepted" ? (
                    <p role="status">
                      {T(
                        "You have already joined this ledger. Open it to continue.",
                        "你已经加入此账本，打开账本即可继续使用。"
                      )}
                    </p>
                  ) : (
                    <p>
                      {T("Expires", "有效期至")}: {preview.expiresAt}
                    </p>
                  )}
                  <p className="notice">
                    {T(
                      "After approval, your role grants access to all existing and future ledger data, including projects, categories, shared expenses and reports.",
                      "申请获批后，你将能按所授角色访问此账本现有及未来的全部数据，包括项目、分类、公共支出和报表。"
                    )}
                  </p>
                  {preview.request?.status === "pending" && (
                    <p className="notice" role="status">
                      {T(
                        "Your request was sent. Waiting for the inviter's approval.",
                        "申请已发送，正在等待邀请人批准。"
                      )}
                    </p>
                  )}
                  {preview.request?.status === "rejected" && (
                    <p className="notice" role="status">
                      {T(
                        "Your request was rejected. Ask the inviter for a new link.",
                        "你的申请已被拒绝，请向邀请人索取新链接。"
                      )}
                    </p>
                  )}
                  <div className="panel-actions">
                    {preview.status === "accepted" ? (
                      <button
                        className="btn primary"
                        disabled={busy}
                        onClick={() => {
                          if (!current(lifecycle.current)) return;
                          callbacks.current.clearInvitation();
                          callbacks.current.onMembershipChanged?.(preview.workspace.id);
                        }}
                      >
                        {T("Open shared ledger", "打开共享账本")}
                      </button>
                    ) : !preview.request ? (
                      <button
                        className="btn primary"
                        onClick={accept}
                        disabled={busy || acceptAttempted}
                      >
                        {T("Request to join", "申请加入")}
                      </button>
                    ) : null}
                    {preview.status !== "accepted" && (
                      <button
                        className="btn"
                        onClick={loadInvitation}
                        disabled={busy || previewLoading}
                      >
                        {T("Check status", "检查状态")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
          {!workspaceId && (
            <p className="notice">
              {T("Choose a ledger to view its members.", "选择一个账本以查看成员。")}
            </p>
          )}
          {workspaceId && (
            <LedgerSplit
              className="member-ledger-layout"
              enabled={showManagement}
              scope={`${workspaceId}:${workspace?.memberRevision ?? workspace?.revision ?? 0}`}
            >
              <section
                className="panel member-directory"
                aria-label={T("Ledger members", "账本成员")}
                aria-busy={loading}
              >
                <div className="panel-h">
                  <I.User size={20} aria-hidden="true" />
                  <h2 ref={memberHeading} tabIndex={-1}>
                    {T("Ledger members", "账本成员")}
                  </h2>
                  {members && <span className="count">{members.length}</span>}
                </div>
                {loading && <p role="status">{T("Loading members…", "正在加载成员…")}</p>}
                {members && (
                  <div className="ledger-list member-list" data-manage={canManage}>
                    {members.map((member) => {
                      const label = memberName(member);
                      const editable =
                        canManage &&
                        member.role !== "owner" &&
                        EDITABLE_ROLES.includes(member.role) &&
                        (canManageAdmins || member.role !== "admin");
                      return (
                        <article key={member.userId} className="member-row">
                          <MemberIdentity name={member.name || label} login={member.githubLogin}>
                            {member.role === "owner" && (
                              <p className="ledger-meta">
                                {T(
                                  "Owner access cannot be changed here.",
                                  "此处不能变更所有者权限。"
                                )}
                              </p>
                            )}
                            {canManage && member.role === "admin" && !canManageAdmins && (
                              <p className="ledger-meta">
                                {T(
                                  "Admin access cannot be changed here.",
                                  "此处不能变更管理员权限。"
                                )}
                              </p>
                            )}
                          </MemberIdentity>
                          <div
                            className="member-role-control"
                            data-unlocked={editable && editId === member.userId}
                            aria-busy={busy && editId === member.userId}
                          >
                            {editable ? (
                              <>
                                <select
                                  id={`role-${member.userId}`}
                                  ref={editId === member.userId ? roleInput : undefined}
                                  aria-label={T("Role for {member}", "{member} 的角色").replace(
                                    "{member}",
                                    label
                                  )}
                                  value={roles[member.userId] || member.role}
                                  disabled={disabled || editId !== member.userId}
                                  onChange={(event) => saveRole(member, event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape" && !busy) {
                                      event.preventDefault();
                                      closeRole(member.userId);
                                    }
                                  }}
                                >
                                  {grantableRoles.map((role) => (
                                    <option key={role} value={role}>
                                      {roleName(role)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="btn ghost member-role-lock"
                                  type="button"
                                  ref={(element) => {
                                    if (element) editOpeners.current.set(member.userId, element);
                                    else editOpeners.current.delete(member.userId);
                                  }}
                                  aria-label={(editId !== member.userId
                                    ? T("Edit role for {member}", "编辑 {member} 的角色")
                                    : roles[member.userId] !== member.role
                                      ? T("Save role for {member}", "保存 {member} 的角色")
                                      : T(
                                          "Cancel role editing for {member}",
                                          "取消编辑 {member} 的角色"
                                        )
                                  ).replace("{member}", label)}
                                  aria-pressed={editId === member.userId}
                                  aria-controls={`role-${member.userId}`}
                                  disabled={disabled}
                                  onClick={() => {
                                    if (disabled || !current(lifecycle.current)) return;
                                    if (editId === member.userId) {
                                      const role = roles[member.userId] || member.role;
                                      if (role !== member.role) saveRole(member, role);
                                      else closeRole(member.userId);
                                      return;
                                    }
                                    focusAction.current = null;
                                    setRemoveId("");
                                    setRoles({ [member.userId]: member.role });
                                    setEditId(member.userId);
                                  }}
                                >
                                  {editId === member.userId ? (
                                    <I.Unlock size={16} aria-hidden="true" />
                                  ) : (
                                    <I.Lock size={16} aria-hidden="true" />
                                  )}
                                </button>
                              </>
                            ) : (
                              <p className="member-role">{roleName(member.role)}</p>
                            )}
                          </div>
                          {editable && (
                            <div
                              className="panel-actions member-actions member-remove-actions"
                              aria-busy={busy && removeId === member.userId}
                              onKeyDown={(event) => {
                                if (event.key === "Escape" && removeId === member.userId) {
                                  event.preventDefault();
                                  closeRemoval(member.userId);
                                }
                              }}
                            >
                              {removeId === member.userId ? (
                                <>
                                  <button
                                    className="btn ghost member-remove-confirm"
                                    type="button"
                                    ref={removeConfirm}
                                    aria-label={T(
                                      "Confirm remove {member}",
                                      "确认移除 {member}"
                                    ).replace("{member}", label)}
                                    title={T(
                                      "Confirm remove {member}",
                                      "确认移除 {member}"
                                    ).replace("{member}", label)}
                                    disabled={disabled}
                                    onClick={() => confirmRemoval(member)}
                                  >
                                    <I.Check size={16} aria-hidden="true" />
                                  </button>
                                  <button
                                    className="btn ghost member-remove-cancel"
                                    type="button"
                                    aria-label={T(
                                      "Cancel removing {member}",
                                      "取消移除 {member}"
                                    ).replace("{member}", label)}
                                    title={T(
                                      "Cancel removing {member}",
                                      "取消移除 {member}"
                                    ).replace("{member}", label)}
                                    disabled={busy || loading}
                                    onClick={() => closeRemoval(member.userId)}
                                  >
                                    <I.X size={16} aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn ghost member-remove-trigger"
                                  type="button"
                                  ref={(element) => {
                                    if (element) removeOpeners.current.set(member.userId, element);
                                    else removeOpeners.current.delete(member.userId);
                                  }}
                                  aria-label={T("Remove {member}", "移除 {member}").replace(
                                    "{member}",
                                    label
                                  )}
                                  disabled={disabled}
                                  onClick={() => {
                                    if (disabled || !current(lifecycle.current)) return;
                                    focusAction.current = null;
                                    setEditId("");
                                    setRoles({});
                                    setRemoveId(member.userId);
                                  }}
                                >
                                  {T("Remove", "移除")}
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
              {showManagement && (
                <aside
                  id={managementId}
                  className="panel member-management"
                  aria-label={T("Member management", "成员管理")}
                >
                  <section className="panel" aria-label={T("Invite member", "邀请成员")}>
                    <div className="panel-h">
                      <I.Plus size={20} aria-hidden="true" />
                      <h2>{T("Invite member", "邀请成员")}</h2>
                    </div>
                    <div className="panel-body">
                      <p className="notice">
                        {T(
                          "Inviting shares all existing and future ledger data, including projects, categories, shared expenses and reports.",
                          "邀请成员将按所授角色共享此所有者账本现有及未来的全部数据，包括项目、分类、公共支出和报表。"
                        )}
                      </p>
                      <p className="ledger-help">
                        {T(
                          "Share a link with anyone. You can review their Pullwise account and approve or reject their request before they join.",
                          "把链接发给任何人。对方申请后，你可以查看其 Pullwise 账户并同意或拒绝，获批后对方才会加入。"
                        )}
                      </p>
                      <form className="ledger-form" onSubmit={createInvite}>
                        <div className="ledger-field">
                          <label htmlFor="invite-role">{T("Invitation role", "邀请角色")}</label>
                          <select
                            id="invite-role"
                            ref={inviteRoleInput}
                            className="auth-input"
                            value={inviteRole}
                            disabled={disabled}
                            onChange={(event) => setInviteRole(event.target.value)}
                          >
                            {grantableRoles.map((role) => (
                              <option value={role} key={role}>
                                {roleName(role)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="panel-actions">
                          <button className="btn primary" type="submit" disabled={disabled}>
                            {T("Create invitation", "创建邀请")}
                          </button>
                        </div>
                      </form>
                      {createdInvite && (
                        <div className="notice" role="status">
                          <div className="panel-body">
                            <p>
                              {T("Role", "角色")}: {roleName(createdInvite.role)}
                            </p>
                            <p>
                              {T(
                                "Share this link. Each person requests to join with their signed-in Pullwise account. The link closes after one person is approved.",
                                "分享此链接。对方使用登录的 Pullwise 账户申请加入，一人获批后链接即关闭。"
                              )}
                            </p>
                            <p>
                              {T("Expires", "有效期至")}: {createdInvite.expiresAt}
                            </p>
                            <p>
                              {T(
                                "This link is shown only now. Copy it before leaving this page.",
                                "此链接只在本次创建后显示，请在离开页面前复制。"
                              )}
                            </p>
                            <div className="ledger-field">
                              <label htmlFor="new-invitation-link">
                                {T("New invitation link", "新邀请链接")}
                              </label>
                              <input
                                id="new-invitation-link"
                                value={createdInvite.link}
                                readOnly
                                onFocus={(event) => event.target.select()}
                              />
                            </div>
                            <div className="panel-actions">
                              <button
                                className="btn"
                                onClick={copyInvite}
                                disabled={copied || copying}
                                aria-busy={copying}
                              >
                                {copied
                                  ? T("Copied", "已复制")
                                  : T("Copy invitation link", "复制邀请链接")}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                  <section
                    className="panel"
                    aria-label={T("Join requests", "加入申请")}
                    aria-busy={loading}
                  >
                    <div className="panel-h">
                      <I.User size={20} aria-hidden="true" />
                      <h2 ref={requestHeading} tabIndex={-1}>
                        {T("Join requests", "加入申请")}
                      </h2>
                      {requests && (
                        <span className="count">
                          {requests.length}
                          {requestsHasMore ? "+" : ""}
                        </span>
                      )}
                    </div>
                    <p className="ledger-help">
                      {T(
                        "Only you can review requests to invitation links you created.",
                        "只有你可以审核自己创建的邀请链接收到的申请。"
                      )}
                    </p>
                    {requestsError && (
                      <p className="notice notice-error" role="alert">
                        {requestsError}
                      </p>
                    )}
                    {requests && requests.length === 0 && (
                      <p>{T("No pending join requests.", "没有待审核的加入申请。")}</p>
                    )}
                    {requests && (
                      <div className="ledger-list member-list member-invites">
                        {requests.map((request) => {
                          const applicant = request.applicant;
                          const label = applicant.githubLogin || applicant.name || applicant.userId;
                          return (
                            <article key={request.id} className="member-row">
                              <MemberIdentity
                                name={applicant.name || label}
                                login={applicant.githubLogin}
                              >
                                <span className="member-role">
                                  {roleName(request.invitation.role)}
                                </span>
                                {applicant.githubLogin && (
                                  <a
                                    href={`https://github.com/${encodeURIComponent(applicant.githubLogin)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={T(
                                      "View GitHub profile for {member}",
                                      "查看 {member} 的 GitHub 主页"
                                    ).replace("{member}", label)}
                                  >
                                    {T("GitHub profile", "GitHub 主页")}
                                  </a>
                                )}
                                <p className="ledger-meta">
                                  {T("Requested", "申请时间")}:{" "}
                                  <time dateTime={request.createdAt}>{request.createdAt}</time>
                                </p>
                              </MemberIdentity>
                              {(canManageAdmins || request.invitation.role !== "admin") && (
                                <div className="panel-actions member-actions">
                                  <button
                                    className="btn primary"
                                    disabled={disabled}
                                    aria-label={T(
                                      "Approve request from {member}",
                                      "同意 {member} 的申请"
                                    ).replace("{member}", label)}
                                    onClick={() => reviewRequest(request, "approve")}
                                  >
                                    {T("Approve", "同意")}
                                  </button>
                                  <button
                                    className="btn"
                                    disabled={disabled}
                                    aria-label={T(
                                      "Reject request from {member}",
                                      "拒绝 {member} 的申请"
                                    ).replace("{member}", label)}
                                    onClick={() => reviewRequest(request, "reject")}
                                  >
                                    {T("Reject", "拒绝")}
                                  </button>
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                    {requestsHasMore && (
                      <p className="ledger-help">
                        {T(
                          "More requests will appear as you review these.",
                          "审核这些申请后，将显示更多申请。"
                        )}
                      </p>
                    )}
                  </section>
                  <section
                    className="panel"
                    aria-label={T("Pending invitations", "待接受邀请")}
                    aria-busy={loading}
                  >
                    <div className="panel-h">
                      <I.Mail size={20} aria-hidden="true" />
                      <h2>{T("Pending invitations", "待接受邀请")}</h2>
                      {invites && <span className="count">{invites.length}</span>}
                    </div>
                    {invites && invites.length === 0 && (
                      <p>{T("No pending invitations.", "没有待接受的邀请。")}</p>
                    )}
                    {invites && (
                      <div className="ledger-list member-list member-invites">
                        {invites.map((invite) => (
                          <article key={invite.id} className="member-row">
                            <MemberIdentity
                              name={invite.recipient?.login || T("Invitation link", "邀请链接")}
                            >
                              <span className="member-role">{roleName(invite.role)}</span>
                              <p className="ledger-meta">
                                {T("Expires", "有效期至")}:{" "}
                                <time dateTime={invite.expiresAt}>{invite.expiresAt}</time>
                              </p>
                            </MemberIdentity>
                            {(canManageAdmins || invite.role !== "admin") && (
                              <div className="panel-actions member-actions">
                                <button
                                  className="btn"
                                  aria-label={
                                    invite.recipient?.login
                                      ? T(
                                          "Revoke invitation for {member}",
                                          "撤销 {member} 的邀请"
                                        ).replace("{member}", invite.recipient.login)
                                      : T(
                                          "Revoke invitation link {id}",
                                          "撤销邀请链接 {id}"
                                        ).replace("{id}", invite.id)
                                  }
                                  disabled={disabled}
                                  onClick={() => {
                                    if (canManage && (canManageAdmins || invite.role !== "admin"))
                                      runAction(
                                        () =>
                                          api.revokeInvite(
                                            workspaceId,
                                            invite.id,
                                            invite.revision,
                                            {}
                                          ),
                                        () => {
                                          if (createdInvite?.id === invite.id) {
                                            inviteVersion.current += 1;
                                            setCreatedInvite(null);
                                          }
                                        }
                                      );
                                  }}
                                >
                                  {T("Revoke invitation", "撤销邀请")}
                                </button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </aside>
              )}
            </LedgerSplit>
          )}
        </main>
      </ConsoleLayout>
    </div>
  );
}
