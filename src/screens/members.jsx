import { useCallback, useEffect, useRef, useState } from "react";
import { ledgerApi } from "../api/ledger.js";
import { T, useLang } from "../i18n.jsx";
import { Sidebar, Topbar } from "../shell.jsx";
import "./ledger.css";

const EDITABLE_ROLES = ["admin", "editor", "viewer"];

function recipientLogin(value) {
  const input = value.trim();
  const profile = /^(?:https:\/\/)?github\.com\/([A-Za-z0-9-]+)\/?(?:\?tab=[A-Za-z0-9_-]+)?$/i.exec(
    input
  );
  const login = profile ? profile[1] : input.startsWith("@") ? input.slice(1) : input;
  // Keep the API's existing ASCII login grammar and send no URL/provider query.
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login) ? login : "";
}

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

function items(result) {
  if (!Array.isArray(result?.items))
    throw new Error(T("Member data unavailable.", "成员数据暂不可用。"));
  return result.items;
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
      "You already own this ledger. Invite another GitHub account.",
      "你已是此账本的所有者，请邀请其他 GitHub 账户。"
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
    return T(
      "That GitHub account is already a member of this ledger.",
      "此 GitHub 账户已经是此账本的成员。"
    );
  if (failure?.status === 409 || failure?.status === 412) {
    return T(
      "Changes conflict with a newer version. Reload members before trying again.",
      "数据版本已变化。请重新加载成员后再试。"
    );
  }
  if (failure?.status === 403)
    return T(
      "Your access changed or this invitation is for another GitHub account.",
      "你的权限已变化，或此邀请属于另一个 GitHub 账户。"
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
  clearInvitation,
}) {
  const workspaceId = workspace?.id || "";
  const canManage = workspace?.permissions?.manageMembers === true;
  const canManageAdmins = canManage && workspace?.permissions?.manageAdmins === true;
  const grantableRoles = canManageAdmins ? EDITABLE_ROLES : ["editor", "viewer"];
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [roles, setRoles] = useState({});
  const [removeId, setRemoveId] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const inviteLoginInput = useRef(null);
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
  callbacks.current = { onMembershipChanged, onAccessChanged, clearInvitation };

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
    setError("");
    setConflict(false);
    setAccessLost(false);
    setRoles({});
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
    // Confirm the single-use token is still pending before allowing another
    // explicit acceptance. A failed mutation is never retried automatically.
    await Promise.resolve();
    if (!current(ticket) || controller.signal.aborted) return;
    try {
      const result = await api.previewInvitation({ token }, { signal: controller.signal });
      if (!current(ticket) || controller.signal.aborted || requestId !== previewId.current) return;
      if (
        !result?.recipient?.login ||
        !EDITABLE_ROLES.includes(result.role) ||
        !result.expiresAt ||
        (result.status === "accepted" && !result.workspace?.id)
      ) {
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
  const createInvite = (event) => {
    event.preventDefault();
    if (!canManage) return;
    const login = recipientLogin(githubLogin);
    if (!login) {
      setError(
        T(
          "Enter a valid GitHub username, @username or GitHub profile URL.",
          "请输入有效的 GitHub 用户名、@用户名或 GitHub 个人主页链接。"
        )
      );
      inviteLoginInput.current?.focus();
      return;
    }
    if (!grantableRoles.includes(inviteRole)) return;
    runAction(
      () => api.inviteMember(workspaceId, { githubLogin: login, role: inviteRole }, {}),
      (result) => {
        if (!result?.token || !result?.recipient?.login)
          throw new Error(T("Invitation link unavailable.", "邀请链接暂不可用。"));
        inviteVersion.current += 1;
        setCreatedInvite({
          ...result,
          link: `${window.location.origin}/members#invite=${encodeURIComponent(result.token)}`,
        });
        setCopied(false);
        setGithubLogin("");
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
    if (!preview || acceptAttempted || actionPending.current) return;
    setAcceptAttempted(true);
    runAction(
      () => api.acceptInvitation({ token }, {}),
      (result) => {
        const acceptedId = result?.workspaceId || result?.workspace?.id;
        if (!acceptedId)
          throw new Error(
            T(
              "Accepted ledger unavailable. Reload your ledgers.",
              "已加入的账本暂不可用，请重新加载账本列表。"
            )
          );
        callbacks.current.clearInvitation();
        callbacks.current.onMembershipChanged?.(acceptedId);
      },
      true
    );
  };

  return (
    <div className="app product-workspace ledger-screen members-screen fade-in">
      <Topbar
        go={go}
        breadcrumbs={[{ label: T("Members", "成员") }]}
        loading={loading || previewLoading}
      />
      <div className="with-side">
        <Sidebar section="ledgerMembers" go={go} />
        <main className="main">
          <div className="page-h">
            <div>
              <h1>{T("Members", "成员")}</h1>
              <p className="sub">{workspace?.name || T("Ledger access", "账本权限")}</p>
            </div>
            {workspaceId && (
              <button className="btn" onClick={load} disabled={loading || busy}>
                {T("Reload", "重新加载")}
              </button>
            )}
          </div>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          {token && (
            <section
              className="panel"
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
                        "Check the invitation before trying again. If acceptance succeeded, reload your ledgers and choose the shared ledger.",
                        "请先检查邀请再重试。如果已经成功加入，请重新加载账本并选择共享账本。"
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
                    {acceptAttempted && onMembershipChanged && (
                      <button
                        className="btn ghost"
                        disabled={busy || previewLoading}
                        onClick={() => callbacks.current.onMembershipChanged?.()}
                      >
                        {T("Reload ledgers", "重新加载账本")}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {preview && (
                <div className="panel-body">
                  {preview.workspace?.name && <h3>{preview.workspace.name}</h3>}
                  <p>
                    {T("GitHub account", "GitHub 账户")}: {preview.recipient.login}
                  </p>
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
                      "Accepting gives you access to all existing and future ledger data, including projects, categories, shared expenses and reports.",
                      "接受邀请后，你将能按所授角色访问此账本现有及未来的全部数据，包括项目、分类、公共支出和报表。"
                    )}
                  </p>
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
                    ) : (
                      <button
                        className="btn primary"
                        onClick={accept}
                        disabled={busy || acceptAttempted}
                      >
                        {T("Accept invitation", "接受邀请")}
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
            <section
              className="panel"
              aria-label={T("Ledger members", "账本成员")}
              aria-busy={loading}
            >
              <div className="panel-h">
                <h2>{T("Ledger members", "账本成员")}</h2>
              </div>
              {loading && <p role="status">{T("Loading members…", "正在加载成员…")}</p>}
              {members && (
                <div className="ledger-list member-list">
                  {members.map((member) => {
                    const label = memberName(member);
                    const editable =
                      canManage &&
                      member.role !== "owner" &&
                      EDITABLE_ROLES.includes(member.role) &&
                      (canManageAdmins || member.role !== "admin");
                    return (
                      <article key={member.userId} className="member-row">
                        <div className="member-identity">
                          <h3>{member.name || label}</h3>
                          <div className="member-meta">
                            {member.githubLogin && (
                              <span className="member-login">@{member.githubLogin}</span>
                            )}
                            <span className="tag">{roleName(member.role)}</span>
                          </div>
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
                        </div>
                        {editable && (
                          <>
                            <form
                              className="member-controls"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const role = roles[member.userId] || member.role;
                                if (
                                  !canManage ||
                                  role === member.role ||
                                  !grantableRoles.includes(role)
                                )
                                  return;
                                runAction(() =>
                                  api.updateMember(
                                    workspaceId,
                                    member.userId,
                                    member.revision,
                                    { role },
                                    {}
                                  )
                                );
                              }}
                            >
                              <div className="ledger-field">
                                <label htmlFor={`role-${member.userId}`}>{T("Role", "角色")}</label>
                                <select
                                  id={`role-${member.userId}`}
                                  aria-label={T("Role for {member}", "{member} 的角色").replace(
                                    "{member}",
                                    label
                                  )}
                                  value={roles[member.userId] || member.role}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    setRoles((values) => ({
                                      ...values,
                                      [member.userId]: event.target.value,
                                    }))
                                  }
                                >
                                  {grantableRoles.map((role) => (
                                    <option key={role} value={role}>
                                      {roleName(role)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="panel-actions">
                                <button
                                  className="btn"
                                  type="submit"
                                  aria-label={T(
                                    "Save role for {member}",
                                    "保存 {member} 的角色"
                                  ).replace("{member}", label)}
                                  disabled={
                                    disabled ||
                                    !roles[member.userId] ||
                                    roles[member.userId] === member.role
                                  }
                                >
                                  {T("Save role", "保存角色")}
                                </button>
                                {removeId !== member.userId && (
                                  <button
                                    className="btn ghost"
                                    type="button"
                                    aria-label={T("Remove {member}", "移除 {member}").replace(
                                      "{member}",
                                      label
                                    )}
                                    disabled={disabled}
                                    onClick={() => setRemoveId(member.userId)}
                                  >
                                    {T("Remove", "移除")}
                                  </button>
                                )}
                              </div>
                            </form>
                            {removeId === member.userId && (
                              <div className="notice">
                                <p>
                                  {T(
                                    "Removing this member ends their ledger access.",
                                    "移除此成员后，对方将失去账本权限。"
                                  )}
                                </p>
                                <div className="panel-actions">
                                  <button
                                    className="btn"
                                    disabled={disabled}
                                    onClick={() => {
                                      if (canManage && member.role !== "owner")
                                        runAction(() =>
                                          api.removeMember(
                                            workspaceId,
                                            member.userId,
                                            member.revision,
                                            {}
                                          )
                                        );
                                    }}
                                  >
                                    {T(`Confirm remove ${label}`, `确认移除 ${label}`)}
                                  </button>
                                  <button
                                    className="btn ghost"
                                    disabled={busy}
                                    onClick={() => setRemoveId("")}
                                  >
                                    {T("Cancel", "取消")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          {workspaceId && canManage && (
            <>
              <section className="panel" aria-label={T("Invite member", "邀请成员")}>
                <div className="panel-h">
                  <h2>{T("Invite member", "邀请成员")}</h2>
                </div>
                <div className="panel-body">
                  <p className="notice">
                    {T(
                      "Inviting shares all existing and future ledger data, including projects, categories, shared expenses and reports.",
                      "邀请成员将按所授角色共享此所有者账本现有及未来的全部数据，包括项目、分类、公共支出和报表。"
                    )}
                  </p>
                  <form className="ledger-form" onSubmit={createInvite}>
                    <div className="ledger-field">
                      <label htmlFor="invite-github-login">
                        {T("GitHub username", "GitHub 用户名")}
                      </label>
                      <input
                        id="invite-github-login"
                        className="auth-input"
                        ref={inviteLoginInput}
                        aria-describedby="invite-github-help"
                        value={githubLogin}
                        required
                        maxLength={100}
                        disabled={disabled}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="octocat / @octocat / https://github.com/octocat"
                        onChange={(event) => setGithubLogin(event.target.value)}
                      />
                      <p className="ledger-help" id="invite-github-help">
                        {T(
                          "Use a username, @username or GitHub profile URL. Only that GitHub account can accept the link.",
                          "支持用户名、@用户名或 GitHub 个人主页链接，只有对应的 GitHub 账户可以接受邀请。"
                        )}
                      </p>
                    </div>
                    <div className="ledger-field">
                      <label htmlFor="invite-role">{T("Invitation role", "邀请角色")}</label>
                      <select
                        id="invite-role"
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
                          {T("GitHub account", "GitHub 账户")}: {createdInvite.recipient.login} ·{" "}
                          {roleName(createdInvite.role)}
                        </p>
                        <p>
                          {T(
                            "Send this link to @{username}. Only that GitHub account can accept it.",
                            "请将此链接发送给 @{username}，只有该 GitHub 账户可以接受邀请。"
                          ).replace("{username}", createdInvite.recipient.login)}
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
                aria-label={T("Pending invitations", "待接受邀请")}
                aria-busy={loading}
              >
                <div className="panel-h">
                  <h2>{T("Pending invitations", "待接受邀请")}</h2>
                </div>
                {invites && invites.length === 0 && (
                  <p>{T("No pending invitations.", "没有待接受的邀请。")}</p>
                )}
                {invites && (
                  <div className="ledger-list">
                    {invites.map((invite) => (
                      <article key={invite.id}>
                        <h3>{invite.recipient?.login}</h3>
                        <p>
                          {roleName(invite.role)} · {T("Expires", "有效期至")}: {invite.expiresAt}
                        </p>
                        {(canManageAdmins || invite.role !== "admin") && (
                          <button
                            className="btn"
                            aria-label={T(
                              "Revoke invitation for {member}",
                              "撤销 {member} 的邀请"
                            ).replace("{member}", invite.recipient?.login)}
                            disabled={disabled}
                            onClick={() => {
                              if (canManage && (canManageAdmins || invite.role !== "admin"))
                                runAction(
                                  () =>
                                    api.revokeInvite(workspaceId, invite.id, invite.revision, {}),
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
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
