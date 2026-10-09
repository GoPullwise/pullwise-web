import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MembersScreen } from "./members.jsx";

const workspace = {
  id: "ws_owner",
  name: "Alice ledger",
  revision: 1,
  role: "owner",
  permissions: { manageMembers: true, manageAdmins: true },
};
const owner = { userId: "alice", name: "Alice", githubLogin: "alice", role: "owner", revision: 1 };
const editor = { userId: "bob", name: "Bob", githubLogin: "bob", role: "editor", revision: 3 };
const invitation = {
  id: "inv_1",
  recipient: null,
  role: "viewer",
  expiresAt: "2026-10-13T12:00:00Z",
  revision: 1,
};
const preview = {
  ...invitation,
  status: "pending",
  request: null,
  workspace: { id: "ws_alice", name: "Alice ledger" },
};
const joinRequest = {
  id: "req_1",
  invitationId: "inv_1",
  workspaceId: "ws_owner",
  applicant: { userId: "carol", name: "Carol", githubLogin: "carol" },
  invitation,
  status: "pending",
  revision: 3,
  createdAt: "2026-10-09T03:00:00Z",
};
let api;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function error(status, code = "") {
  return Object.assign(new Error("Request rejected"), { status, code });
}

function show(props = {}) {
  return render(<MembersScreen go={vi.fn()} api={api} workspace={workspace} {...props} />);
}

async function openRole(login = "bob") {
  fireEvent.click(await screen.findByRole("button", { name: `Edit role for ${login}` }));
  return screen.getByRole("combobox", { name: `Role for ${login}` });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/members");
  api = Object.fromEntries(
    [
      "members",
      "updateMember",
      "removeMember",
      "invites",
      "inviteMember",
      "revokeInvite",
      "previewInvitation",
      "acceptInvitation",
      "workspaceInvitationRequests",
      "approveInviteRequest",
      "rejectInviteRequest",
    ].map((name) => [name, vi.fn()])
  );
  api.members.mockResolvedValue({ items: [owner, editor] });
  api.invites.mockResolvedValue({ items: [] });
  api.workspaceInvitationRequests.mockResolvedValue({ items: [] });
  api.approveInviteRequest.mockResolvedValue({ request: { ...joinRequest, status: "approved" } });
  api.rejectInviteRequest.mockResolvedValue({ request: { ...joinRequest, status: "rejected" } });
  api.updateMember.mockResolvedValue({ ...editor, role: "viewer", revision: 4 });
  api.removeMember.mockResolvedValue(null);
  api.inviteMember.mockResolvedValue({ ...invitation, token: "only-new-token" });
  api.revokeInvite.mockResolvedValue(null);
  api.previewInvitation.mockResolvedValue(preview);
  api.acceptInvitation.mockResolvedValue({
    ...preview,
    request: { id: "req_carol", status: "pending" },
  });
});

afterEach(() => {
  window.history.replaceState(null, "", "/members");
  vi.unstubAllGlobals();
});

describe("Members screen", () => {
  it("shows only current-ledger requests, identifies applicants and approves one with its request revision", async () => {
    api.workspaceInvitationRequests.mockResolvedValueOnce({
      items: [
        joinRequest,
        {
          ...joinRequest,
          id: "other_req",
          workspaceId: "ws_other",
          applicant: { userId: "other", name: "Other applicant" },
        },
      ],
    });
    const changed = vi.fn();
    const inboxChanged = vi.fn();
    show({ onMembershipChanged: changed, onInvitationRequestsChanged: inboxChanged });
    const approve = await screen.findByRole("button", { name: "Approve request from carol" });
    expect(api.workspaceInvitationRequests).toHaveBeenCalledWith(
      "ws_owner",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(screen.getByText("Carol")).toBeVisible();
    expect(screen.getByText("@carol")).toBeVisible();
    expect(screen.getByRole("link", { name: "View GitHub profile for carol" })).toHaveAttribute(
      "href",
      "https://github.com/carol"
    );
    expect(screen.queryByText("Other applicant")).not.toBeInTheDocument();
    fireEvent.click(approve);
    fireEvent.click(approve);
    await waitFor(() => expect(api.approveInviteRequest).toHaveBeenCalledTimes(1));
    expect(api.approveInviteRequest).toHaveBeenCalledWith("ws_owner", "inv_1", "req_1", 3, {});
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(inboxChanged).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Join requests" })).toHaveFocus()
    );
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();
  });

  it("shows a bounded request count as a minimum and explains how further requests become visible", async () => {
    api.workspaceInvitationRequests.mockResolvedValue({ items: [joinRequest], hasMore: true });
    show();
    const section = await screen.findByRole("region", { name: "Join requests" });
    expect(
      await within(section).findByText("More requests will appear as you review these.")
    ).toBeVisible();
    expect(section.querySelector(".count")).toHaveTextContent("1+");
    expect(
      within(section).getByRole("button", { name: "Approve request from carol" })
    ).toBeEnabled();
  });

  it("does not turn failed request data into an empty inbox or disable otherwise loaded member controls", async () => {
    api.workspaceInvitationRequests.mockResolvedValue({ unavailable: true });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Member data unavailable.");
    expect(screen.queryByText("No pending join requests.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit role for bob" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled();
  });

  it("rejects an applicant without dispatching an approval and refreshes the inviter inbox", async () => {
    api.workspaceInvitationRequests.mockResolvedValueOnce({ items: [joinRequest] });
    const changed = vi.fn();
    show({ onInvitationRequestsChanged: changed });
    fireEvent.click(await screen.findByRole("button", { name: "Reject request from carol" }));
    await waitFor(() =>
      expect(api.rejectInviteRequest).toHaveBeenCalledWith("ws_owner", "inv_1", "req_1", 3, {})
    );
    expect(api.approveInviteRequest).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Carol")).not.toBeInTheDocument());
  });

  it("requires a manual reload of a conflicting join request before reviewing its new revision", async () => {
    api.workspaceInvitationRequests
      .mockResolvedValueOnce({ items: [joinRequest] })
      .mockResolvedValue({ items: [{ ...joinRequest, revision: 4 }] });
    api.approveInviteRequest.mockRejectedValueOnce(error(412));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Approve request from carol" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload members");
    expect(screen.getByRole("button", { name: "Approve request from carol" })).toBeDisabled();
    expect(api.workspaceInvitationRequests).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    const approve = await screen.findByRole("button", { name: "Approve request from carol" });
    await waitFor(() => expect(approve).toBeEnabled());
    fireEvent.click(approve);
    await waitFor(() =>
      expect(api.approveInviteRequest).toHaveBeenLastCalledWith("ws_owner", "inv_1", "req_1", 4, {})
    );
  });

  it("rejects a late approval callback after changing ledger scope", async () => {
    const pending = deferred();
    api.workspaceInvitationRequests.mockResolvedValueOnce({ items: [joinRequest] });
    api.approveInviteRequest.mockReturnValue(pending.promise);
    const changed = vi.fn();
    const inboxChanged = vi.fn();
    const view = show({ onMembershipChanged: changed, onInvitationRequestsChanged: inboxChanged });
    fireEvent.click(await screen.findByRole("button", { name: "Approve request from carol" }));
    view.rerender(
      <MembersScreen
        go={vi.fn()}
        api={api}
        workspace={{ ...workspace, id: "ws_other" }}
        onMembershipChanged={changed}
        onInvitationRequestsChanged={inboxChanged}
      />
    );
    await waitFor(() => expect(api.members).toHaveBeenCalledTimes(2));
    await act(async () => pending.resolve({ request: { ...joinRequest, status: "approved" } }));
    expect(changed).not.toHaveBeenCalled();
    expect(inboxChanged).not.toHaveBeenCalled();
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();
  });

  it("keeps a rejected applicant outside the ledger and never replays their request", async () => {
    window.history.replaceState(null, "", "/members#invite=rejected-token");
    api.previewInvitation.mockResolvedValue({
      ...preview,
      request: { ...joinRequest, status: "rejected" },
    });
    const changed = vi.fn();
    show({ workspace: null, onMembershipChanged: changed });
    expect(
      await screen.findByText("Your request was rejected. Ask the inviter for a new link.")
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request to join" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open shared ledger" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    await waitFor(() => expect(api.previewInvitation).toHaveBeenCalledTimes(2));
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#invite=rejected-token");
  });

  it("opens the approved ledger only after an explicit status check confirms current membership", async () => {
    window.history.replaceState(null, "", "/members#invite=waiting-token");
    api.previewInvitation
      .mockResolvedValueOnce({ ...preview, request: { ...joinRequest, status: "pending" } })
      .mockResolvedValue({
        ...preview,
        status: "accepted",
        request: { ...joinRequest, status: "approved" },
      });
    const changed = vi.fn();
    show({ workspace: null, onMembershipChanged: changed });
    expect(
      await screen.findByText("Your request was sent. Waiting for the inviter's approval.")
    ).toBeVisible();
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open shared ledger" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open shared ledger" }));
    expect(changed).toHaveBeenCalledWith("ws_alice");
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("keeps a deleted invitation owner's error local while the current ledger remains accessible", async () => {
    window.history.replaceState(null, "", "/members#invite=deleted-owner-token");
    api.previewInvitation.mockRejectedValue(error(404, "WORKSPACE_NOT_FOUND"));
    const accessChanged = vi.fn();
    show({ onAccessChanged: accessChanged });
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
    expect(await screen.findByText("Bob")).toBeVisible();
    expect(accessChanged).not.toHaveBeenCalled();
    expect(api.previewInvitation).toHaveBeenCalledTimes(1);
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#invite=deleted-owner-token");
  });

  it("uses authoritative permissions, allowing a reader to see members without management requests or controls", async () => {
    show({ workspace: { ...workspace, permissions: { manageMembers: false } } });
    expect(await screen.findByText("Bob")).toBeVisible();
    expect(api.members).toHaveBeenCalledWith(
      "ws_owner",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(api.invites).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("GitHub username")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit role|Save role|Remove|Revoke|Create invitation/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Role for/ })).not.toBeInTheDocument();
    for (const method of ["updateMember", "removeMember", "inviteMember", "revokeInvite"]) {
      expect(api[method]).not.toHaveBeenCalled();
    }
  });

  it("protects the Owner row and saves another member's explicit role with its current revision", async () => {
    const changed = vi.fn();
    show({ onMembershipChanged: changed });
    const ownerRow = (await screen.findByText("Alice")).closest("article");
    expect(within(ownerRow).queryByRole("button")).not.toBeInTheDocument();
    expect(within(ownerRow).queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Role for bob" })).not.toBeInTheDocument();
    const role = await openRole();
    expect(role).toHaveFocus();
    expect(within(role).queryByRole("option", { name: "Owner" })).not.toBeInTheDocument();
    fireEvent.change(role, { target: { value: "viewer" } });
    expect(api.updateMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save role for bob" }));
    await waitFor(() =>
      expect(api.updateMember).toHaveBeenCalledWith("ws_owner", "bob", 3, { role: "viewer" }, {})
    );
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit role for bob" })).toHaveFocus()
    );
  });

  it("allows an Admin to manage Editor/Viewer access while keeping Admin members and invitations read-only", async () => {
    const admin = {
      ...editor,
      userId: "carol",
      name: "Carol",
      githubLogin: "carol",
      role: "admin",
    };
    api.members.mockResolvedValue({ items: [owner, admin, editor] });
    api.invites.mockResolvedValue({
      items: [
        { ...invitation, id: "admin-invite", recipient: { login: "carol" }, role: "admin" },
        { ...invitation, id: "viewer-invite", recipient: { githubId: "303", login: "dave" } },
      ],
    });
    show({
      workspace: {
        ...workspace,
        role: "admin",
        permissions: { manageMembers: true, manageAdmins: false },
      },
    });
    const row = (await screen.findByText("Carol")).closest("article");
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    const memberRole = await openRole();
    expect(within(memberRole).queryByRole("option", { name: "Admin" })).not.toBeInTheDocument();
    expect(within(memberRole).getByRole("option", { name: "Viewer" })).toBeInTheDocument();
    const inviteRole = screen.getByRole("combobox", { name: "Invitation role" });
    expect(within(inviteRole).queryByRole("option", { name: "Admin" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revoke invitation for carol" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke invitation for dave" })).toBeEnabled();
    expect(api.updateMember).not.toHaveBeenCalled();
  });

  it("does not infer Admin management from an Owner label when the authoritative permission is absent", async () => {
    api.members.mockResolvedValue({ items: [owner, { ...editor, role: "admin" }] });
    show({ workspace: { ...workspace, permissions: { manageMembers: true } } });
    const row = (await screen.findByText("Bob")).closest("article");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Invitation role")).queryByRole("option", { name: "Admin" })
    ).not.toBeInTheDocument();
  });

  it("blocks dispatch from an obsolete invitation view before the hash-change render completes", async () => {
    window.history.replaceState(null, "", "/members#invite=old-token");
    show({ workspace: null });
    const oldAccept = await screen.findByRole("button", { name: "Request to join" });
    window.history.replaceState(null, "", "/members#invite=replacement-token");
    fireEvent.click(oldAccept);
    expect(api.acceptInvitation).not.toHaveBeenCalled();
  });

  it("requires explicit removal confirmation and admits only one pending membership write", async () => {
    const pending = deferred();
    api.removeMember.mockReturnValue(pending.promise);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Remove bob" }));
    expect(api.removeMember).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Confirm remove bob" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.removeMember).toHaveBeenCalledTimes(1);
    expect(api.removeMember).toHaveBeenCalledWith("ws_owner", "bob", 3, {});
    expect(screen.getByRole("button", { name: "Create invitation" })).toBeDisabled();
    await act(async () => {
      pending.resolve(null);
    });
  });

  it("requires a manual reload after a revision conflict instead of repeating the stale write", async () => {
    api.updateMember.mockRejectedValueOnce(error(412));
    show();
    fireEvent.change(await openRole(), {
      target: { value: "viewer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save role for bob" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Reload members/);
    expect(api.updateMember).toHaveBeenCalledTimes(1);
    expect(api.members).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save role for bob" })).toBeDisabled();
    api.members.mockResolvedValueOnce({ items: [owner, { ...editor, revision: 4 }] });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    fireEvent.change(await openRole(), {
      target: { value: "viewer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save role for bob" }));
    await waitFor(() =>
      expect(api.updateMember).toHaveBeenLastCalledWith(
        "ws_owner",
        "bob",
        4,
        { role: "viewer" },
        {}
      )
    );
  });

  it("opens a single role editor, discards canceled drafts and returns focus without writing", async () => {
    api.members.mockResolvedValue({
      items: [owner, editor, { ...editor, userId: "dave", name: "Dave", githubLogin: "dave" }],
    });
    show();
    const role = await openRole();
    fireEvent.change(role, { target: { value: "viewer" } });
    expect(screen.getByRole("button", { name: "Save role for bob" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit role for bob" }));
    expect(role).toHaveValue("viewer");
    expect(role).toHaveFocus();
    expect(
      screen.getByText("Bob").closest("article").querySelector(".member-role")
    ).toHaveTextContent("Editor");
    expect(api.updateMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel role editing for bob" }));
    expect(screen.queryByRole("combobox", { name: "Role for bob" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit role for bob" })).toHaveFocus();
    expect(api.updateMember).not.toHaveBeenCalled();
    expect(await openRole()).toHaveValue("editor");
    const secondRole = await openRole("dave");
    expect(secondRole).toHaveFocus();
    expect(screen.queryByRole("combobox", { name: "Role for bob" })).not.toBeInTheDocument();
    expect(secondRole).toHaveValue("editor");
    expect(api.updateMember).not.toHaveBeenCalled();
  });

  it("keeps role editing and removal confirmation exclusive and restores the removal opener on cancel", async () => {
    show();
    await openRole();
    fireEvent.click(screen.getByRole("button", { name: "Remove bob" }));
    expect(screen.queryByRole("combobox", { name: "Role for bob" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm remove bob" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel removing bob" }));
    expect(screen.queryByRole("button", { name: "Confirm remove bob" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove bob" })).toHaveFocus();
    expect(api.removeMember).not.toHaveBeenCalled();
    expect(await openRole()).toHaveValue("editor");
    expect(api.updateMember).not.toHaveBeenCalled();
  });

  it("returns focus to the member heading after a removed row no longer exists", async () => {
    api.members
      .mockResolvedValueOnce({ items: [owner, editor] })
      .mockResolvedValue({ items: [owner] });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Remove bob" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove bob" }));
    await waitFor(() => expect(screen.queryByText("Bob")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Ledger members" })).toHaveFocus()
    );
    expect(api.removeMember).toHaveBeenCalledTimes(1);
  });

  it("focuses the member heading after a successful role save whose follow-up read fails, then recovers only on reload", async () => {
    api.members
      .mockResolvedValueOnce({ items: [owner, editor] })
      .mockRejectedValueOnce(error(503))
      .mockResolvedValue({ items: [owner, { ...editor, role: "viewer", revision: 4 }] });
    show();
    fireEvent.change(await openRole(), { target: { value: "viewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role for bob" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Request rejected");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Ledger members" })).toHaveFocus()
    );
    expect(api.members).toHaveBeenCalledTimes(2);
    expect(api.updateMember).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await screen.findByText("Bob");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText("Bob").closest("article").querySelector(".member-role")
    ).toHaveTextContent("Viewer");
    expect(api.members).toHaveBeenCalledTimes(3);
    expect(api.updateMember).toHaveBeenCalledTimes(1);
  });

  it("clears an open role draft when changing ledgers and rejects a late save without restoring old focus", async () => {
    const pending = deferred();
    api.updateMember.mockReturnValue(pending.promise);
    const changed = vi.fn();
    const view = show({ onMembershipChanged: changed });
    fireEvent.change(await openRole(), { target: { value: "viewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save role for bob" }));
    expect(api.updateMember).toHaveBeenCalledTimes(1);
    api.members.mockResolvedValue({ items: [{ ...owner, name: "Other ledger owner" }] });
    view.rerender(
      <MembersScreen
        go={vi.fn()}
        api={api}
        workspace={{ ...workspace, id: "ws_other" }}
        onMembershipChanged={changed}
      />
    );
    await screen.findByText("Other ledger owner");
    expect(screen.queryByRole("combobox", { name: "Role for bob" })).not.toBeInTheDocument();
    await act(async () => pending.resolve({ ...editor, role: "viewer", revision: 4 }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(api.members).toHaveBeenCalledTimes(2);
  });

  it("creates an unbound invitation with only the selected role", async () => {
    show();
    const role = await screen.findByLabelText("Invitation role");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled()
    );
    expect(screen.queryByLabelText("GitHub username")).not.toBeInTheDocument();
    fireEvent.change(role, { target: { value: "editor" } });
    fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
    await screen.findByLabelText("New invitation link");
    expect(api.inviteMember).toHaveBeenCalledTimes(1);
    expect(api.inviteMember).toHaveBeenCalledWith("ws_owner", { role: "editor" }, {});
    expect(screen.getByText(/Share this link. Each person requests to join/)).toBeVisible();
  });

  it.each([
    [
      409,
      "INVITATION_EXISTS",
      "carol",
      "An invitation is already pending for this GitHub account. Revoke it below before creating a new link.",
    ],
    [409, "ALREADY_MEMBER", "bob", "That GitHub account is already a member of this ledger."],
    [
      403,
      "INVITATION_LIMIT",
      "dave",
      "The pending invitation limit has been reached. Revoke an unused invitation below, then try again.",
    ],
    [
      403,
      "OWNER_IMMUTABLE",
      "alice",
      "You already own this ledger. Invite another GitHub account.",
    ],
  ])(
    "keeps invitation business failure %s/%s local and permits explicit revocation",
    async (status, code, _login, message) => {
      api.invites.mockResolvedValue({ items: [invitation] });
      api.inviteMember.mockRejectedValue(error(status, code));
      const accessChanged = vi.fn();
      show({ onAccessChanged: accessChanged });
      const revoke = await screen.findByRole("button", { name: "Revoke invitation link inv_1" });
      await waitFor(() => expect(revoke).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.queryByText(/Changes conflict with a newer version/)).not.toBeInTheDocument();
      expect(accessChanged).not.toHaveBeenCalled();
      expect(api.inviteMember).toHaveBeenCalledTimes(1);
      expect(api.members).toHaveBeenCalledTimes(1);
      expect(api.invites).toHaveBeenCalledTimes(1);
      expect(revoke).toBeEnabled();
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled();
      expect(screen.getByText("Bob")).toBeVisible();
      fireEvent.click(revoke);
      await waitFor(() =>
        expect(api.revokeInvite).toHaveBeenCalledWith("ws_owner", "inv_1", 1, {})
      );
    }
  );

  it.each([403, 404, 409, 412])(
    "keeps a generic invitation creation %s protected until reload",
    async (status) => {
      api.invites.mockResolvedValue({ items: [invitation] });
      api.inviteMember.mockRejectedValue(error(status));
      const accessChanged = vi.fn();
      show({ onAccessChanged: accessChanged });
      const revoke = await screen.findByRole("button", { name: "Revoke invitation link inv_1" });
      await waitFor(() => expect(revoke).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
      await screen.findByRole("alert");
      expect(revoke).toBeDisabled();
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeDisabled();
      expect(accessChanged).toHaveBeenCalledTimes(status === 403 || status === 404 ? 1 : 0);
      expect(api.inviteMember).toHaveBeenCalledTimes(1);
      expect(api.revokeInvite).not.toHaveBeenCalled();
    }
  );

  it("warns about the entire ledger and reveals/copies only the newly issued invitation link", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    api.invites.mockResolvedValue({
      items: [{ ...invitation, token: "never-render-list-token", tokenHash: "never-render-hash" }],
    });
    const changed = vi.fn();
    show({ onMembershipChanged: changed });
    expect(await screen.findByLabelText("Invitation role")).toBeVisible();
    expect(
      screen.getByText(/Inviting shares all existing and future ledger data/)
    ).toHaveTextContent(/projects, categories, shared expenses and reports/);
    expect(document.body.textContent).not.toMatch(/never-render-list-token|never-render-hash/);
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
    const link = await screen.findByLabelText("New invitation link");
    expect(link).toHaveValue(`${window.location.origin}/members#invite=only-new-token`);
    expect(screen.getByText(/This link is shown only now/)).toBeVisible();
    expect(api.inviteMember).toHaveBeenCalledWith("ws_owner", { role: "viewer" }, {});
    expect(changed).toHaveBeenCalledTimes(1);
    const copyButton = screen.getByRole("button", { name: "Copy invitation link" });
    fireEvent.click(copyButton);
    fireEvent.click(copyButton);
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
    expect(copy).toHaveBeenCalledWith(link.value);
    expect(await screen.findByRole("button", { name: "Copied" })).toBeDisabled();
  });

  it("revokes listed invitation metadata with its revision without revealing a token", async () => {
    api.invites.mockResolvedValue({ items: [invitation] });
    const changed = vi.fn();
    show({ onMembershipChanged: changed });
    fireEvent.click(await screen.findByRole("button", { name: "Revoke invitation link inv_1" }));
    await waitFor(() => expect(api.revokeInvite).toHaveBeenCalledWith("ws_owner", "inv_1", 1, {}));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("New invitation link")).not.toBeInTheDocument();
  });

  it("keeps the one-time link copyable when the required callback refreshes unrelated workspace metadata", async () => {
    const changed = vi.fn();
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    function RefreshingPicker() {
      const [selected, setSelected] = useState({ ...workspace, memberRevision: 1 });
      return (
        <MembersScreen
          go={vi.fn()}
          api={api}
          workspace={selected}
          onMembershipChanged={() => {
            changed();
            setSelected((previous) => ({ ...previous, revision: previous.revision + 1 }));
          }}
        />
      );
    }
    render(<RefreshingPicker />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled()
    );
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    const link = screen.getByLabelText("New invitation link");
    expect(link).toHaveValue(`${window.location.origin}/members#invite=only-new-token`);
    fireEvent.click(screen.getByRole("button", { name: "Copy invitation link" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(link.value));
  });

  it("does not mark a replacement invitation copied when an earlier clipboard write finishes", async () => {
    const firstCopy = deferred();
    const copy = vi.fn().mockReturnValueOnce(firstCopy.promise).mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    api.inviteMember
      .mockResolvedValueOnce({ ...invitation, token: "first-token" })
      .mockResolvedValueOnce({
        ...invitation,
        id: "inv_2",
        recipient: { githubId: "303", login: "dave" },
        token: "second-token",
      });
    show();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled()
    );
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy invitation link" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled()
    );
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
    await waitFor(() =>
      expect(screen.getByLabelText("New invitation link")).toHaveValue(
        `${window.location.origin}/members#invite=second-token`
      )
    );
    await act(async () => {
      firstCopy.resolve(undefined);
    });
    const secondCopy = screen.getByRole("button", { name: "Copy invitation link" });
    expect(secondCopy).toBeEnabled();
    fireEvent.click(secondCopy);
    await waitFor(() =>
      expect(copy).toHaveBeenLastCalledWith(`${window.location.origin}/members#invite=second-token`)
    );
  });

  it("aborts old scope reads and rejects late protected results when the workspace revision changes", async () => {
    const old = deferred();
    api.members.mockReturnValueOnce(old.promise);
    const changed = vi.fn();
    const view = show({ onAccessChanged: changed });
    await waitFor(() => expect(api.members).toHaveBeenCalledTimes(1));
    const signal = api.members.mock.calls[0][1].signal;
    api.members.mockResolvedValueOnce({ items: [{ ...owner, name: "New revision owner" }] });
    view.rerender(
      <MembersScreen
        go={vi.fn()}
        api={api}
        workspace={{ ...workspace, revision: 2 }}
        onAccessChanged={changed}
      />
    );
    expect(signal.aborted).toBe(true);
    expect(await screen.findByText("New revision owner")).toBeVisible();
    await act(async () => {
      old.resolve({ items: [{ ...editor, name: "Stale protected member" }] });
    });
    expect(screen.queryByText("Stale protected member")).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it("does not expose a late invitation token or invoke membership callbacks after changing ledgers", async () => {
    const pending = deferred();
    api.inviteMember.mockReturnValue(pending.promise);
    const changed = vi.fn();
    const view = show({ onMembershipChanged: changed });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled()
    );
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
    expect(api.inviteMember).toHaveBeenCalledTimes(1);
    view.rerender(
      <MembersScreen
        go={vi.fn()}
        api={api}
        workspace={{ ...workspace, id: "ws_other", name: "Other ledger" }}
        onMembershipChanged={changed}
      />
    );
    await screen.findByRole("heading", { name: "Members" });
    await act(async () => {
      pending.resolve({ ...invitation, token: "late-secret" });
    });
    expect(screen.queryByLabelText("New invitation link")).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it.each([403, 404])(
    "notifies the picker after a current-scope %s and stops management writes",
    async (status) => {
      api.members.mockRejectedValue(error(status));
      api.invites.mockRejectedValue(error(status));
      const changed = vi.fn();
      show({ onAccessChanged: changed });
      expect(await screen.findByRole("alert")).toBeVisible();
      expect(changed).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeDisabled();
      expect(api.inviteMember).not.toHaveBeenCalled();
    }
  );

  it("previews a hash invitation only once in StrictMode and accepts only after a single explicit action", async () => {
    window.history.replaceState(null, "", "/members#invite=incoming-token");
    const pending = deferred();
    api.acceptInvitation.mockReturnValue(pending.promise);
    const changed = vi.fn();
    render(
      <StrictMode>
        <MembersScreen go={vi.fn()} api={api} workspace={null} onMembershipChanged={changed} />
      </StrictMode>
    );
    const accept = await screen.findByRole("button", { name: "Request to join" });
    expect(api.previewInvitation).toHaveBeenCalledTimes(1);
    expect(api.previewInvitation).toHaveBeenCalledWith(
      { token: "incoming-token" },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("incoming-token");
    fireEvent.click(accept);
    fireEvent.click(accept);
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(api.acceptInvitation).toHaveBeenCalledWith({ token: "incoming-token" }, {});
    await act(async () => {
      pending.resolve({ ...preview, request: { id: "req_carol", status: "pending" } });
    });
    expect(changed).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Your request was sent. Waiting for the inviter's approval.")
    ).toBeVisible();
    expect(window.location.hash).toBe("#invite=incoming-token");
  });

  it("checks a failed acceptance explicitly before offering another attempt and never retries the write automatically", async () => {
    window.history.replaceState(null, "", "/members#invite=incoming-token");
    api.acceptInvitation.mockRejectedValueOnce(new Error("Connection lost"));
    const pending = deferred();
    api.previewInvitation.mockResolvedValueOnce(preview).mockReturnValueOnce(pending.promise);
    show({ workspace: null });
    fireEvent.click(await screen.findByRole("button", { name: "Request to join" }));
    await screen.findByText("Connection lost");
    expect(screen.getByRole("button", { name: "Request to join" })).toBeDisabled();
    expect(api.previewInvitation).toHaveBeenCalledTimes(1);
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Check invitation again" }));
    expect(screen.queryByRole("button", { name: "Request to join" })).not.toBeInTheDocument();
    await waitFor(() => expect(api.previewInvitation).toHaveBeenCalledTimes(2));
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(preview));
    fireEvent.click(await screen.findByRole("button", { name: "Request to join" }));
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledTimes(2));
    expect(window.location.hash).toBe("#invite=incoming-token");
  });

  it("recovers a confirmed acceptance through a read-only preview without replaying the acceptance write", async () => {
    window.history.replaceState(null, "", "/members#invite=incoming-token");
    api.acceptInvitation.mockRejectedValueOnce(new Error("Connection lost"));
    api.previewInvitation
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, status: "accepted" });
    const changed = vi.fn();
    show({ workspace: null, onMembershipChanged: changed });
    fireEvent.click(await screen.findByRole("button", { name: "Request to join" }));
    await screen.findByText("Connection lost");
    fireEvent.click(screen.getByRole("button", { name: "Check invitation again" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open shared ledger" }));
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith("ws_alice");
    expect(window.location.hash).toBe("");
  });

  it("keeps a revoked invitation unavailable after a manual check instead of offering acceptance", async () => {
    window.history.replaceState(null, "", "/members#invite=revoked-token");
    api.previewInvitation.mockRejectedValue(error(410, "INVITATION_REVOKED"));
    show({ workspace: null });
    await screen.findByText("This invitation was revoked. Ask the ledger owner for a new link.");
    fireEvent.click(screen.getByRole("button", { name: "Check invitation again" }));
    await waitFor(() => expect(api.previewInvitation).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Request to join" })).not.toBeInTheDocument();
    expect(api.acceptInvitation).not.toHaveBeenCalled();
  });

  it("fences invitation previews to their token and aborts the old request on hash changes", async () => {
    window.history.replaceState(null, "", "/members#invite=old-token");
    const old = deferred();
    api.previewInvitation.mockReturnValueOnce(old.promise);
    show({ workspace: null });
    await waitFor(() => expect(api.previewInvitation).toHaveBeenCalledTimes(1));
    const signal = api.previewInvitation.mock.calls[0][1].signal;
    await act(async () => {
      window.history.replaceState(null, "", "/members#invite=new-token");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(signal.aborted).toBe(true);
    const accept = await screen.findByRole("button", { name: "Request to join" });
    await act(async () => {
      old.resolve({ ...preview, workspace: { id: "stale", name: "Stale invitation ledger" } });
    });
    expect(screen.queryByText("Stale invitation ledger")).not.toBeInTheDocument();
    fireEvent.click(accept);
    await waitFor(() =>
      expect(api.acceptInvitation).toHaveBeenCalledWith({ token: "new-token" }, {})
    );
  });

  it("does not offer acceptance when the Server rejects a mismatched recipient", async () => {
    window.history.replaceState(null, "", "/members#invite=wrong-recipient");
    api.previewInvitation.mockRejectedValue(error(403, "INVITATION_RECIPIENT_MISMATCH"));
    const changed = vi.fn();
    show({ workspace: null, onAccessChanged: changed });
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Request to join" })).not.toBeInTheDocument();
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("does not clear the invitation hash or call back after an acceptance completes on an unmounted page", async () => {
    window.history.replaceState(null, "", "/members#invite=kept-token");
    const pending = deferred();
    api.acceptInvitation.mockReturnValue(pending.promise);
    const changed = vi.fn();
    const view = show({ workspace: null, onMembershipChanged: changed });
    fireEvent.click(await screen.findByRole("button", { name: "Request to join" }));
    view.unmount();
    await act(async () => {
      pending.resolve({ ...preview, request: { id: "req_carol", status: "pending" } });
    });
    expect(window.location.hash).toBe("#invite=kept-token");
    expect(changed).not.toHaveBeenCalled();
  });
});
