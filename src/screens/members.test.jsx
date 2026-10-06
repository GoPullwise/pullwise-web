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
  recipient: { githubId: "202", login: "carol" },
  role: "viewer",
  expiresAt: "2026-10-13T12:00:00Z",
  revision: 1,
};
const preview = { ...invitation, workspace: { id: "ws_alice", name: "Alice ledger" } };
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
    ].map((name) => [name, vi.fn()])
  );
  api.members.mockResolvedValue({ items: [owner, editor] });
  api.invites.mockResolvedValue({ items: [] });
  api.updateMember.mockResolvedValue({ ...editor, role: "viewer", revision: 4 });
  api.removeMember.mockResolvedValue(null);
  api.inviteMember.mockResolvedValue({ ...invitation, token: "only-new-token" });
  api.revokeInvite.mockResolvedValue(null);
  api.previewInvitation.mockResolvedValue(preview);
  api.acceptInvitation.mockResolvedValue({ workspace: { id: "ws_alice" } });
});

afterEach(() => {
  window.history.replaceState(null, "", "/members");
  vi.unstubAllGlobals();
});

describe("Members screen", () => {
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
      screen.queryByRole("button", { name: /Save role|Remove|Revoke|Create invitation/ })
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
    const role = screen.getByRole("combobox", { name: "Role for bob" });
    expect(within(role).queryByRole("option", { name: "Owner" })).not.toBeInTheDocument();
    fireEvent.change(role, { target: { value: "viewer" } });
    expect(api.updateMember).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save role for bob" }));
    await waitFor(() =>
      expect(api.updateMember).toHaveBeenCalledWith("ws_owner", "bob", 3, { role: "viewer" }, {})
    );
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
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
        { ...invitation, id: "admin-invite", role: "admin" },
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
    const memberRole = screen.getByRole("combobox", { name: "Role for bob" });
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
    const oldAccept = await screen.findByRole("button", { name: "Accept invitation" });
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
    fireEvent.change(await screen.findByRole("combobox", { name: "Role for bob" }), {
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
    fireEvent.change(screen.getByRole("combobox", { name: "Role for bob" }), {
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

  it("warns about the entire ledger and reveals/copies only the newly issued invitation link", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    api.invites.mockResolvedValue({
      items: [{ ...invitation, token: "never-render-list-token", tokenHash: "never-render-hash" }],
    });
    const changed = vi.fn();
    show({ onMembershipChanged: changed });
    expect(await screen.findByLabelText("GitHub username")).toBeVisible();
    expect(
      screen.getByText(/Inviting shares all existing and future ledger data/)
    ).toHaveTextContent(/projects, categories, shared expenses and reports/);
    expect(document.body.textContent).not.toMatch(/never-render-list-token|never-render-hash/);
    fireEvent.change(screen.getByLabelText("GitHub username"), { target: { value: " carol " } });
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
    const link = await screen.findByLabelText("New invitation link");
    expect(link).toHaveValue(`${window.location.origin}/members#invite=only-new-token`);
    expect(screen.getByText(/This link is shown only now/)).toBeVisible();
    expect(api.inviteMember).toHaveBeenCalledWith(
      "ws_owner",
      { githubLogin: "carol", role: "viewer" },
      {}
    );
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
    fireEvent.click(await screen.findByRole("button", { name: "Revoke invitation for carol" }));
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
    fireEvent.change(await screen.findByLabelText("GitHub username"), {
      target: { value: "carol" },
    });
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
    fireEvent.change(await screen.findByLabelText("GitHub username"), {
      target: { value: "carol" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Create invitation" }).closest("form"));
    fireEvent.click(await screen.findByRole("button", { name: "Copy invitation link" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create invitation" })).toBeEnabled()
    );
    fireEvent.change(screen.getByLabelText("GitHub username"), { target: { value: "dave" } });
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
    fireEvent.change(await screen.findByLabelText("GitHub username"), {
      target: { value: "carol" },
    });
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
    const accept = await screen.findByRole("button", { name: "Accept invitation" });
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
      pending.resolve({ workspace: { id: "ws_alice" } });
    });
    expect(changed).toHaveBeenCalledWith("ws_alice");
    expect(window.location.hash).toBe("");
  });

  it("checks a failed acceptance explicitly before offering another attempt and never retries the write automatically", async () => {
    window.history.replaceState(null, "", "/members#invite=incoming-token");
    api.acceptInvitation.mockRejectedValueOnce(new Error("Connection lost"));
    const pending = deferred();
    api.previewInvitation.mockResolvedValueOnce(preview).mockReturnValueOnce(pending.promise);
    show({ workspace: null });
    fireEvent.click(await screen.findByRole("button", { name: "Accept invitation" }));
    await screen.findByText("Connection lost");
    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeDisabled();
    expect(api.previewInvitation).toHaveBeenCalledTimes(1);
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Check invitation again" }));
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
    await waitFor(() => expect(api.previewInvitation).toHaveBeenCalledTimes(2));
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(preview));
    fireEvent.click(await screen.findByRole("button", { name: "Accept invitation" }));
    await waitFor(() => expect(api.acceptInvitation).toHaveBeenCalledTimes(2));
    expect(window.location.hash).toBe("");
  });

  it("recovers a confirmed acceptance through a read-only preview without replaying the acceptance write", async () => {
    window.history.replaceState(null, "", "/members#invite=incoming-token");
    api.acceptInvitation.mockRejectedValueOnce(new Error("Connection lost"));
    api.previewInvitation.mockResolvedValueOnce(preview).mockResolvedValueOnce({ ...preview, status: "accepted" });
    const changed = vi.fn();
    show({ workspace: null, onMembershipChanged: changed });
    fireEvent.click(await screen.findByRole("button", { name: "Accept invitation" }));
    await screen.findByText("Connection lost");
    expect(screen.getByRole("button", { name: "Reload ledgers" })).toBeEnabled();
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
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
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
    const accept = await screen.findByRole("button", { name: "Accept invitation" });
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
    expect(screen.queryByRole("button", { name: "Accept invitation" })).not.toBeInTheDocument();
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("does not clear the invitation hash or call back after an acceptance completes on an unmounted page", async () => {
    window.history.replaceState(null, "", "/members#invite=kept-token");
    const pending = deferred();
    api.acceptInvitation.mockReturnValue(pending.promise);
    const changed = vi.fn();
    const view = show({ workspace: null, onMembershipChanged: changed });
    fireEvent.click(await screen.findByRole("button", { name: "Accept invitation" }));
    view.unmount();
    await act(async () => {
      pending.resolve({ workspace: { id: "ws_alice" } });
    });
    expect(window.location.hash).toBe("#invite=kept-token");
    expect(changed).not.toHaveBeenCalled();
  });
});
