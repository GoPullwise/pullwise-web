import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { createLedgerApi } from "../api/ledger.js";
import { NotificationProvider } from "../components/notifications.jsx";
import { WorkspaceContext } from "../components/workspace-context.jsx";
import { env } from "../config/env.js";
import { ApiKeysScreen } from "./api.jsx";
import { ApiDocsScreen } from "./api-docs.jsx";

const { projects } = vi.hoisted(() => ({ projects: vi.fn() }));

vi.mock("../api/ledger.js", () => ({ createLedgerApi: vi.fn() }));

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    apiKeys: {
      list: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

function render(ui, options) {
  return rtlRender(<NotificationProvider>{ui}</NotificationProvider>, options);
}

function deferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const readScopes = [
  "profile:read",
  "projects:read",
  "categories:read",
  "expenses:read",
  "reports:read",
];
const workspaceFixture = (id, overrides = {}) => ({
  id,
  name: id,
  role: "viewer",
  revision: 3,
  permissions: { manageProjects: false, manageCategories: false, writeExpenses: false },
  scopes: readScopes,
  ...overrides,
});
const projectFixture = (id, name, overrides = {}) => ({
  id,
  name,
  description: "",
  status: "active",
  githubAccess: "not_linked",
  repositories: [],
  ...overrides,
});

describe("API screens", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createLedgerApi.mockReturnValue({ projects });
    projects.mockResolvedValue({ items: [], nextCursor: null });
  });

  it("documents the ledger contract and target restrictions", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByRole("heading", { name: /pullwise ledger rest api/i })).toBeInTheDocument();
    expect(screen.getAllByText("/api/v1/expenses")).toHaveLength(2);
    expect(screen.getByText("/api/v1/reports/summary")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/categories/{id}/remove")).toBeInTheDocument();
    expect(
      screen.getByText(/Project allowlists do not grant shared-pool access/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("/api/v1/items")).not.toBeInTheDocument();
  });

  it("copies the ledger contract as markdown", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      await user.click(screen.getByRole("button", { name: /copy page/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      const markdown = writeText.mock.calls[0][0];
      expect(markdown).toContain("# Pullwise ledger REST API");
      expect(markdown).toContain("### GET /api/v1/expenses");
      expect(markdown).toContain("Idempotency-Key");
      expect(markdown).toContain("Automatic Max assistance");
      expect(markdown).toContain("CATEGORY_REQUIRED");
      expect(markdown).toContain("### POST /api/v1/categories/{id}/remove");
      expect(markdown).toContain("categorySource");
      expect(markdown).toContain('-H "Authorization: Bearer $PULLWISE_API_KEY"');
      expect(markdown).not.toContain("-H 'Authorization: Bearer $PULLWISE_API_KEY'");
    } finally {
      if (originalClipboard)
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      else delete navigator.clipboard;
    }
  });

  it("preserves the Web proxy prefix before the Server API path in same-origin examples", async () => {
    const originalApiBase = env.VITE_API_BASE_URL;
    const originalPublicApiBase = env.VITE_PUBLIC_API_BASE_URL;
    env.VITE_API_BASE_URL = "/api";
    env.VITE_PUBLIC_API_BASE_URL = "";
    try {
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      expect(screen.getByText(`${window.location.origin}/api`)).toBeInTheDocument();
      const examples = screen.getAllByText(/curl.*api\/v1\/expenses/);
      expect(examples).toHaveLength(2);
      for (const example of examples)
        expect(example).toHaveTextContent(`${window.location.origin}/api/api/v1/expenses`);
    } finally {
      env.VITE_API_BASE_URL = originalApiBase;
      env.VITE_PUBLIC_API_BASE_URL = originalPublicApiBase;
    }
  });

  it("links the guide and key management", async () => {
    const go = vi.fn();
    render(<ApiDocsScreen go={go} auth={{ authenticated: true }} />);
    expect(screen.getByRole("link", { name: /^Guide$/ })).toHaveAttribute(
      "href",
      "/developers/docs"
    );
    const keys = within(document.querySelector(".docs-foot-actions")).getByRole("link", {
      name: /api keys/i,
    });
    expect(keys).toHaveAttribute("href", "/api-keys");
    await userEvent.setup().click(keys);
    expect(go).toHaveBeenCalledWith("apiKeys");
  });

  it("documents automatic assistance on regular expense writes with no extra scope", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByRole("heading", { name: "Automatic Max assistance" })).toBeInTheDocument();
    expect(
      screen.getByText(/No separate suggestion request or suggestions:use scope/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/CATEGORY_REQUIRED/)).toBeInTheDocument();
    expect(screen.getByText(/categorySource/)).toBeInTheDocument();
    expect(screen.getByText(/curl.*POST.*\/api\/v1\/expenses/)).toHaveTextContent(
      "Idempotency-Key"
    );
  });

  it("exposes API key management docs navigation as real screen links", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    const user = userEvent.setup();
    const go = vi.fn();

    render(<ApiKeysScreen go={go} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    const pageAction = screen.getByRole("link", { name: /api docs/i });
    const docsSide = within(document.querySelector(".set-side")).getByRole("link", {
      name: /^docs$/i,
    });

    expect(pageAction).toHaveAttribute("href", "/developers/api");
    expect(docsSide).toHaveAttribute("href", "/developers/api");

    await user.click(pageAction);
    expect(go).toHaveBeenCalledWith("api");
  });

  it("shows the topbar loading spinner only while API keys are loading", async () => {
    let resolveList;
    pullwiseApi.apiKeys.list.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(screen.getByRole("status", { name: /^loading$/i })).toHaveClass(
      "topbar-loading",
      "spin"
    );

    resolveList({ apiKeys: [] });
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: /^loading$/i })).not.toBeInTheDocument();
    });
  });

  it("renders API key management skeletons while keys are loading", () => {
    pullwiseApi.apiKeys.list.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ApiKeysScreen go={vi.fn()} />);

    expect(container.querySelector(".api-keys-skeleton")).toBeInTheDocument();
    expect(container.querySelectorAll(".api-keys-skeleton .key-row")).toHaveLength(3);
    expect(screen.queryByText(/no api keys have been created/i)).not.toBeInTheDocument();
  });

  it("creates and revokes account-scoped API keys", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_1", name: "Old key", prefix: "pwk_old" }],
    });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_2",
      name: "Ledger automation",
      prefix: "pwk_new",
      key: "pwk_live_secret",
    });
    pullwiseApi.apiKeys.revoke.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByText("Old key")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/key name/i));
    await user.type(screen.getByLabelText(/key name/i), "Ledger automation");
    await user.click(screen.getByRole("button", { name: /create key/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
        name: "Ledger automation",
        scopes: [
          "profile:read",
          "projects:read",
          "categories:read",
          "expenses:read",
          "reports:read",
        ],
        restrictions: { shared: false },
      });
    });
    expect(await screen.findByText("pwk_live_secret")).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("dialog", { name: "New key created" })).getAllByRole("button", {
        name: "Close",
      })[1]
    );

    await user.click(screen.getAllByRole("button", { name: /revoke/i })[0]);
    await user.click(await screen.findByRole("button", { name: /confirm revoke/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalledWith("key_2");
      expect(screen.queryByText("pwk_live_secret")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^copy$/i })).not.toBeInTheDocument();
    });
  });

  it("lets keyboard users review target access before creating a key", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_keyboard",
      name: "Ledger automation",
      key: "pwk_keyboard_local",
    });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);

    const sharedAccess = await screen.findByRole("checkbox", { name: "Allow shared expense pool" });
    await user.click(sharedAccess);
    await user.tab();
    expect(screen.getByRole("button", { name: "Create key" })).toHaveFocus();
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
        name: "Ledger automation",
        scopes: [
          "profile:read",
          "projects:read",
          "categories:read",
          "expenses:read",
          "reports:read",
        ],
        restrictions: { shared: true },
      })
    );
    expect(await screen.findByText("pwk_keyboard_local")).toBeInTheDocument();
  });

  it("keeps newly created key metadata after closing its one-time token and revoking an unrelated key", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_old", name: "Old key", prefix: "pwk_old" }],
    });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_new",
      name: "New key",
      prefix: "pwk_new",
      key: "pwk_live_new_secret",
    });
    pullwiseApi.apiKeys.revoke.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    const oldKey = await screen.findByText("Old key");
    await user.click(screen.getByRole("button", { name: /create key/i }));
    expect(await screen.findByText("pwk_live_new_secret")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("pwk_live_new_secret")).not.toBeInTheDocument();

    await user.click(within(oldKey.closest(".key-row")).getByRole("button", { name: /revoke/i }));
    await user.click(await screen.findByRole("button", { name: /confirm revoke/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalledWith("key_old");
    });
    expect(screen.getByText("New key")).toBeInTheDocument();
    expect(screen.queryByText("pwk_live_new_secret")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^copy$/i })).not.toBeInTheDocument();
  });

  it.each(["button", "Escape", "backdrop"])(
    "discards the one-time token when closed by %s without creating or reading another key",
    async (method) => {
      pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
      pullwiseApi.apiKeys.create.mockResolvedValue({
        apiKey: { id: "key_once", name: "Once key", prefix: "pwk_once" },
        token: "pwk_local_one_time_001234",
      });
      const user = userEvent.setup();
      render(<ApiKeysScreen go={vi.fn()} />);
      const create = await screen.findByRole("button", { name: "Create key" });
      await user.click(create);
      const dialog = await screen.findByRole("dialog", { name: "New key created" });
      const background = document.querySelector(".api-keys-background");
      expect(background.inert).toBe(true);
      expect(within(dialog).getByLabelText("Bearer token").textContent).toBe(
        "pwk_local_one_time_001234"
      );
      if (method === "button")
        await user.click(within(dialog).getAllByRole("button", { name: "Close" })[1]);
      else if (method === "Escape") await user.keyboard("{Escape}");
      else await user.click(dialog.closest(".modal-back"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText("pwk_local_one_time_001234")).not.toBeInTheDocument();
      expect(background.inert).toBe(false);
      await waitFor(() => expect(create).toHaveFocus());
      expect(screen.getByText("Once key")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Revoke" })).toBeEnabled();
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledOnce();
      expect(pullwiseApi.apiKeys.list).toHaveBeenCalledOnce();
      expect(pullwiseApi.apiKeys.revoke).not.toHaveBeenCalled();
    }
  );

  it("returns focus to the creating button after an allowed preference action during creation", async () => {
    const creation = deferredPromise();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockReturnValueOnce(creation.promise);
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Theme preference</button>
        <ApiKeysScreen go={vi.fn()} />
      </>
    );
    const create = await screen.findByRole("button", { name: "Create key" });
    await user.click(create);
    await user.click(screen.getByRole("button", { name: "Theme preference" }));
    await act(async () => creation.resolve({ id: "key_focus", token: "pwk_local_focus" }));
    const dialog = screen.getByRole("dialog", { name: "New key created" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Copy" })).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(create).toHaveFocus());
  });

  it("keeps creation and revocation dialogs mutually exclusive even for synthetic background events", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_old", name: "Existing key" }],
    });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_once", token: "pwk_local_exclusive" });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    const create = await screen.findByRole("button", { name: "Create key" });
    const form = create.closest("form");
    const revoke = within(screen.getByText("Existing key").closest(".key-row")).getByRole(
      "button",
      { name: "Revoke" }
    );
    await user.click(create);
    const dialog = await screen.findByRole("dialog", { name: "New key created" });
    // jsdom does not suppress events on inert elements; the synchronous guards still must.
    fireEvent.submit(form);
    fireEvent.click(revoke);
    expect(screen.getAllByRole("dialog")).toEqual([dialog]);
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledOnce();
    expect(pullwiseApi.apiKeys.revoke).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await user.click(revoke);
    const confirmation = screen.getByRole("dialog", { name: "Revoke API key?" });
    fireEvent.submit(form);
    expect(screen.getAllByRole("dialog")).toEqual([confirmation]);
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledOnce();
  });

  it("does not reveal a dismissed token again when key metadata is explicitly reloaded", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValueOnce({ apiKeys: [] }).mockResolvedValueOnce({
      apiKeys: [
        {
          id: "key_once",
          name: "Once key",
          prefix: "pwk_once",
          token: "pwk_local_dismissed",
          key: "pwk_local_dismissed",
        },
      ],
    });
    pullwiseApi.apiKeys.create
      .mockResolvedValueOnce({ id: "key_once", name: "Once key", token: "pwk_local_dismissed" })
      .mockRejectedValueOnce(new Error("Creation unavailable"));
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    const create = await screen.findByRole("button", { name: "Create key" });
    await user.click(create);
    await screen.findByRole("dialog", { name: "New key created" });
    await user.keyboard("{Escape}");
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledOnce();
    await user.click(create);
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Once key")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("pwk_local_dismissed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"])(
    "ignores a clipboard %s after switching ledger and opening a different token",
    async (completion) => {
      const copying = deferredPromise();
      const user = userEvent.setup();
      const writeText = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockReturnValueOnce(copying.promise);
      pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
      pullwiseApi.apiKeys.create
        .mockResolvedValueOnce({ id: "key_a", token: "pwk_local_ledger_a" })
        .mockResolvedValueOnce({ id: "key_b", token: "pwk_local_ledger_b" });
      const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_a")} />);
      await user.click(await screen.findByRole("button", { name: "Create key" }));
      const oldDialog = await screen.findByRole("dialog", { name: "New key created" });
      await user.click(within(oldDialog).getByRole("button", { name: "Copy" }));
      view.rerender(
        <NotificationProvider>
          <ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_b")} />
        </NotificationProvider>
      );
      expect(screen.queryByText("pwk_local_ledger_a")).not.toBeInTheDocument();
      await user.click(await screen.findByRole("button", { name: "Create key" }));
      const newDialog = await screen.findByRole("dialog", { name: "New key created" });
      await act(async () =>
        completion === "resolve"
          ? copying.resolve()
          : copying.reject(new Error("Late clipboard denial"))
      );
      expect(within(newDialog).getByLabelText("Bearer token").textContent).toBe(
        "pwk_local_ledger_b"
      );
      expect(within(newDialog).getByRole("button", { name: "Copy" })).toBeEnabled();
      expect(within(newDialog).queryByRole("status")).not.toBeInTheDocument();
      expect(within(newDialog).queryByRole("alert")).not.toBeInTheDocument();
      expect(writeText).toHaveBeenCalledOnce();
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledTimes(2);
      expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(2);
      writeText.mockRestore();
    }
  );

  it("serializes API key mutations before React pending state is committed", async () => {
    const creation = deferredPromise();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockReturnValue(creation.promise);

    render(<ApiKeysScreen go={vi.fn()} />);

    const form = (await screen.findByRole("button", { name: /create key/i })).closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledTimes(1);

    creation.resolve({
      id: "key_serialized",
      name: "Ledger automation",
      prefix: "pwk_serialized",
      key: "pwk_live_serialized",
    });
    expect(await screen.findByText("pwk_live_serialized")).toBeInTheDocument();
  });

  it("coalesces same-frame API key revocations", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_revoke", name: "Deploy key", prefix: "pwk_deploy" }],
    });
    pullwiseApi.apiKeys.revoke.mockReturnValue(new Promise(() => {}));

    render(<ApiKeysScreen go={vi.fn()} />);

    const revoke = await screen.findByRole("button", { name: /revoke/i });
    fireEvent.click(revoke);
    fireEvent.click(revoke);
    await userEvent.setup().click(await screen.findByRole("button", { name: /confirm revoke/i }));

    expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalledWith("key_revoke");
  });

  it("does not revoke a key while creation is already in flight", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_existing", name: "Existing key", prefix: "pwk_existing" }],
    });
    pullwiseApi.apiKeys.create.mockReturnValue(new Promise(() => {}));

    render(<ApiKeysScreen go={vi.fn()} />);

    const create = await screen.findByRole("button", { name: /create key/i });
    const revoke = screen.getByRole("button", { name: /revoke/i });
    fireEvent.submit(create.closest("form"));
    fireEvent.click(revoke);

    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.revoke).not.toHaveBeenCalled();
  });

  it("does not create a key while revocation is already in flight", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_existing", name: "Existing key", prefix: "pwk_existing" }],
    });
    pullwiseApi.apiKeys.revoke.mockReturnValue(new Promise(() => {}));

    render(<ApiKeysScreen go={vi.fn()} />);

    const create = await screen.findByRole("button", { name: /create key/i });
    const revoke = screen.getByRole("button", { name: /revoke/i });
    fireEvent.click(revoke);
    await userEvent.setup().click(await screen.findByRole("button", { name: /confirm revoke/i }));
    fireEvent.submit(create.closest("form"));

    expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
  });

  it("locks the submitted API key draft and navigation until a failed creation settles", async () => {
    const creation = deferredPromise();
    const go = vi.fn();
    const onSelect = vi.fn();
    const own = workspaceFixture("wsp_own", { role: "owner" });
    const other = workspaceFixture("wsp_other");
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_existing", name: "Existing key", prefix: "pwk_existing" }],
    });
    pullwiseApi.apiKeys.create.mockReturnValue(creation.promise);
    const user = userEvent.setup();
    render(
      <WorkspaceContext.Provider value={{ workspace: own, items: [own, other], onSelect }}>
        <ApiKeysScreen go={go} />
      </WorkspaceContext.Provider>
    );
    const create = await screen.findByRole("button", { name: "Create key" });
    const name = screen.getByLabelText("Key name");
    const writeScope = screen.getByRole("checkbox", { name: /manage expenses/i });
    await user.clear(name);
    await user.type(name, "Deployment key");
    await user.click(writeScope);
    await user.click(create);

    expect(name).toBeDisabled();
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeDisabled();
    const docs = screen.getByRole("link", { name: "API docs" });
    const ledger = screen.getByRole("combobox", { name: "Select ledger" });
    expect(docs).toHaveAttribute("aria-disabled", "true");
    expect(docs).not.toHaveAttribute("href");
    expect(ledger).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toHaveClass("topbar-loading");
    fireEvent.change(name, { target: { value: "Unsaved replacement" } });
    fireEvent.click(writeScope);
    fireEvent.change(ledger, { target: { value: other.id } });
    fireEvent.click(docs);
    fireEvent.submit(create.closest("form"));
    expect(name).toHaveValue("Deployment key");
    expect(writeScope).toBeChecked();
    expect(go).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledOnce();
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Deployment key",
        scopes: expect.arrayContaining(["expenses:write"]),
      })
    );

    await act(async () => creation.reject(new Error("Creation unavailable")));
    await waitFor(() => expect(create).toBeEnabled());
    expect(name).toBeEnabled();
    expect(name).toHaveValue("Deployment key");
    expect(writeScope).toBeChecked();
    expect(docs).toHaveAttribute("href", "/developers/api");
    expect(ledger).toBeEnabled();
    expect(screen.queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledOnce();
  });

  it("keeps revocation locked against Escape, backdrop dismissal and stale read retries", async () => {
    const revocation = deferredPromise();
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_existing", name: "Existing key", prefix: "pwk_existing" }],
    });
    pullwiseApi.apiKeys.create.mockRejectedValue(new Error("Creation unavailable"));
    pullwiseApi.apiKeys.revoke.mockReturnValue(revocation.promise);
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Create key" }));
    const retry = await screen.findByRole("button", { name: "Retry" });
    const existing = screen.getByText("Existing key").closest(".key-row");
    await user.click(within(existing).getByRole("button", { name: "Revoke" }));
    const dialog = await screen.findByRole("dialog", { name: "Revoke API key?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm revoke" }));
    for (const cancel of within(dialog).getAllByRole("button", { name: "Cancel" }))
      expect(cancel).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(dialog.parentElement);
    expect(dialog).toBeInTheDocument();
    expect(retry).not.toBeInTheDocument();
    fireEvent.click(retry);
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();

    await act(async () => revocation.resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Create key" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "API docs" })).toHaveAttribute(
      "href",
      "/developers/api"
    );
    expect(screen.queryByText("Existing key")).not.toBeInTheDocument();
  });

  it("retains malformed created-key metadata for revocation when the one-time token is missing", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_without_token",
      name: "Ledger automation",
      prefix: "pwk_missing",
    });
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /create key/i }));

    expect(await screen.findByText("pwk_missing")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/one-time token was missing/i);
    expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument();
  });

  it("creates API keys with the selected scopes", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_2",
      name: "Ledger automation",
      prefix: "pwk_new",
      scopes: [
        "profile:read",
        "projects:read",
        "categories:read",
        "expenses:read",
        "expenses:write",
        "reports:read",
      ],
      key: "pwk_live_secret",
    });
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/key name/i));
    await user.type(screen.getByLabelText(/key name/i), "Ledger automation");
    await user.click(screen.getByRole("checkbox", { name: /manage expenses/i }));
    expect(screen.queryByRole("checkbox", { name: /sync github facts/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create key/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
        name: "Ledger automation",
        scopes: [
          "profile:read",
          "projects:read",
          "categories:read",
          "expenses:read",
          "expenses:write",
          "reports:read",
        ],
        restrictions: { shared: false },
      });
    });
  });

  it("defaults new API keys to product reads and leaves writes opt-in", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_read",
      name: "Read key",
      prefix: "pwk_read",
      key: "pwk_read_secret",
    });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /read expenses/i })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /sync github facts/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create key/i }));
    await waitFor(() =>
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
        name: "Ledger automation",
        scopes: [
          "profile:read",
          "projects:read",
          "categories:read",
          "expenses:read",
          "reports:read",
        ],
        restrictions: { shared: false },
      })
    );
  });

  it("uses a streamlined API key creation panel without redundant scope explainer rows", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    const scopes = screen.getByRole("group", { name: /scopes/i });
    const createForm = scopes.closest("form");

    expect(screen.queryByText("Permission model")).not.toBeInTheDocument();
    expect(screen.queryByText(/^REST scopes$/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Keys inherit the creator Pullwise account role/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Choose only the REST scopes each key needs/i)
    ).not.toBeInTheDocument();
    expect(createForm).toContainElement(screen.getByRole("button", { name: /create key/i }));
    expect(scopes.querySelector(".api-scope-count")).toHaveTextContent("5 / 9 selected");
    expect(within(scopes).getAllByRole("checkbox")).toHaveLength(9);
    expect(within(scopes).getAllByRole("checkbox", { checked: true })).toHaveLength(5);
  });

  it("shows feedback when copying a newly created API key fails", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_2",
      name: "Ledger automation",
      prefix: "pwk_new",
      key: "pwk_live_secret",
    });
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new Error("Clipboard denied"));

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/key name/i));
    await user.type(screen.getByLabelText(/key name/i), "Ledger automation");
    await user.click(screen.getByRole("button", { name: /create key/i }));
    expect(await screen.findByText("pwk_live_secret")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("pwk_live_secret");
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to copy api key/i);
  });

  it("keeps valid API keys visible when the API returns malformed key rows", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [null, "bad key", { id: "key_1", name: "Old key", prefix: "pwk_old" }],
    });

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByText("Old key")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /revoke/i })).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error when API key creation returns malformed data", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue(null);
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/key name/i));
    await user.type(screen.getByLabelText(/key name/i), "Ledger automation");
    await user.click(screen.getByRole("button", { name: /create key/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/api key response was malformed/i);
    expect(screen.queryByText("New key created")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });

  it("creates a Viewer key bound to the selected workspace with only effective read scopes", async () => {
    const workspace = workspaceFixture("wsp_team", { scopes: ["expenses:read", "reports:read"] });
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_view", token: "pwk_view_local" });
    render(<ApiKeysScreen go={vi.fn()} workspace={workspace} />);

    await screen.findByRole("button", { name: "Create key" });
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledWith(
      { workspaceId: "wsp_team" },
      { signal: expect.any(AbortSignal) }
    );
    const scopes = screen.getByRole("group", { name: "Scopes" });
    expect(within(scopes).getAllByRole("checkbox")).toHaveLength(2);
    expect(
      screen.queryByRole("checkbox", { name: /manage|request suggestions/i })
    ).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Create key" }));
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
      name: "Ledger automation",
      scopes: ["expenses:read", "reports:read"],
      restrictions: { shared: false, workspaceId: "wsp_team", workspaceMemberRevision: 3 },
    });
    expect(await screen.findByText("pwk_view_local")).toBeInTheDocument();
  });

  it("intersects workspace capabilities with effective scopes rather than trusting its role label", async () => {
    const workspace = workspaceFixture("wsp_editor", {
      role: "owner",
      permissions: { manageProjects: false, manageCategories: false, writeExpenses: true },
      scopes: [...readScopes, "projects:write", "categories:write", "expenses:write"],
      memberRevision: 7,
    });
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_edit", token: "pwk_edit_local" });
    render(<ApiKeysScreen go={vi.fn()} workspace={workspace} />);
    const writes = await screen.findByRole("checkbox", { name: /manage expenses/i });
    expect(writes).not.toBeChecked();
    expect(
      screen.queryByRole("checkbox", {
        name: /manage projects|manage categories|request suggestions/i,
      })
    ).not.toBeInTheDocument();
    await userEvent.setup().click(writes);
    await userEvent.setup().click(screen.getByRole("button", { name: "Create key" }));
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: [
          "profile:read",
          "projects:read",
          "categories:read",
          "expenses:read",
          "expenses:write",
          "reports:read",
        ],
        restrictions: { shared: false, workspaceId: "wsp_editor", workspaceMemberRevision: 7 },
      })
    );
  });

  it("aborts the old workspace list and ignores its late protected rows", async () => {
    const first = deferredPromise();
    const second = deferredPromise();
    pullwiseApi.apiKeys.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_a")} />);
    const signal = pullwiseApi.apiKeys.list.mock.calls[0][1]?.signal;
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_b")} />
      </NotificationProvider>
    );
    expect(signal?.aborted).toBe(true);
    await act(async () => second.resolve({ apiKeys: [{ id: "key_b", name: "Workspace B key" }] }));
    expect(await screen.findByText("Workspace B key")).toBeInTheDocument();
    await act(async () =>
      first.resolve({ apiKeys: [{ id: "key_a", name: "Workspace A secret" }] })
    );
    expect(screen.queryByText("Workspace A secret")).not.toBeInTheDocument();
    expect(screen.getByText("Workspace B key")).toBeInTheDocument();
  });

  it("does not restore an old workspace token or release the new workspace mutation guard", async () => {
    const first = deferredPromise();
    const second = deferredPromise();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_a")} />);
    fireEvent.submit((await screen.findByRole("button", { name: "Create key" })).closest("form"));
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_b")} />
      </NotificationProvider>
    );
    const secondForm = (await screen.findByRole("button", { name: "Create key" })).closest("form");
    fireEvent.submit(secondForm);
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledTimes(2);
    await act(async () =>
      first.resolve({ id: "key_a", name: "Workspace A key", token: "pwk_stale_a" })
    );
    expect(screen.queryByText("pwk_stale_a")).not.toBeInTheDocument();
    expect(screen.queryByText("Workspace A key")).not.toBeInTheDocument();
    fireEvent.submit(secondForm);
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledTimes(2);
    await act(async () =>
      second.resolve({ id: "key_b", name: "Workspace B key", token: "pwk_current_b" })
    );
    expect(await screen.findByText("pwk_current_b")).toBeInTheDocument();
  });

  it("clears an exposed token and write selections when membership revision changes", async () => {
    const workspace = workspaceFixture("wsp_team", {
      permissions: { manageProjects: true, manageCategories: true, writeExpenses: true },
      scopes: [
        ...readScopes,
        "projects:write",
        "categories:write",
        "expenses:write",
        "suggestions:use",
      ],
    });
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_team", token: "pwk_once_local" });
    const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspace} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: /manage expenses/i }));
    await user.click(screen.getByRole("button", { name: "Create key" }));
    expect(await screen.findByText("pwk_once_local")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "New key created" })).toBeInTheDocument();
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_team", { revision: 4 })} />
      </NotificationProvider>
    );
    await screen.findByRole("button", { name: "Create key" });
    expect(screen.queryByText("pwk_once_local")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /manage expenses/i })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /read expenses/i })).toBeChecked();
  });

  it("refreshes access once on a current forbidden request and never retries automatically", async () => {
    const onAccessChanged = vi.fn();
    const failure = {
      status: 403,
      code: "WORKSPACE_MEMBERSHIP_CHANGED",
      message: "Membership changed",
    };
    pullwiseApi.apiKeys.list.mockRejectedValue(failure);
    render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_team")}
        onAccessChanged={onAccessChanged}
      />
    );
    expect(
      await screen.findByRole("heading", { name: "API keys are unavailable" })
    ).toBeInTheDocument();
    expect(onAccessChanged).toHaveBeenCalledTimes(1);
    expect(onAccessChanged).toHaveBeenCalledWith(failure);
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
  });

  it("waits for an explicit access refresh and the following key read before enabling mutations", async () => {
    const access = deferredPromise();
    const keys = deferredPromise();
    const onReloadAccess = vi.fn().mockReturnValue(access.promise);
    pullwiseApi.apiKeys.list
      .mockRejectedValueOnce(new Error("Keys unavailable"))
      .mockReturnValueOnce(keys.promise);
    render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_team")}
        onReloadAccess={onReloadAccess}
      />
    );
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(onReloadAccess).not.toHaveBeenCalled();
    fireEvent.click(retry);
    expect(onReloadAccess).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Create key" })).not.toBeInTheDocument();
    fireEvent.click(retry);
    expect(onReloadAccess).toHaveBeenCalledTimes(1);
    await act(async () => access.resolve(true));
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Create key" })).not.toBeInTheDocument();
    await act(async () => keys.resolve({ apiKeys: [] }));
    expect(await screen.findByRole("button", { name: "Create key" })).toBeEnabled();
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
    expect(pullwiseApi.apiKeys.revoke).not.toHaveBeenCalled();
  });

  it("reloads current access and keys from the header while preserving an unchanged name draft", async () => {
    const access = deferredPromise();
    const keys = deferredPromise();
    const onReloadAccess = vi.fn().mockReturnValue(access.promise);
    pullwiseApi.apiKeys.list
      .mockResolvedValueOnce({ apiKeys: [] })
      .mockReturnValueOnce(keys.promise);
    render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_team")}
        onReloadAccess={onReloadAccess}
      />
    );
    const name = await screen.findByRole("textbox", { name: "Key name" });
    fireEvent.change(name, {
      target: { value: "Unsubmitted header reload draft" },
    });
    const reload = screen.getByRole("button", { name: "Reload" });
    expect(onReloadAccess).not.toHaveBeenCalled();
    fireEvent.click(reload);
    expect(reload).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Key name" })).toBe(name);
    expect(name).toHaveValue("Unsubmitted header reload draft");
    expect(name).toBeDisabled();
    expect(onReloadAccess).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
    fireEvent.click(reload);
    expect(onReloadAccess).toHaveBeenCalledTimes(1);
    await act(async () => access.resolve(true));
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(2);
    expect(reload).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Key name" })).toBe(name);
    expect(name).toHaveValue("Unsubmitted header reload draft");
    expect(name).toBeDisabled();
    await act(async () => keys.resolve({ apiKeys: [] }));
    expect(await screen.findByRole("textbox", { name: "Key name" })).toHaveValue(
      "Unsubmitted header reload draft"
    );
    expect(reload).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Key name" })).toBe(name);
    expect(name).toBeEnabled();
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
    expect(pullwiseApi.apiKeys.revoke).not.toHaveBeenCalled();
  });

  it("does not continue an old explicit reload after the same ledger's membership changes", async () => {
    const access = deferredPromise();
    const onReloadAccess = vi.fn().mockReturnValue(access.promise);
    pullwiseApi.apiKeys.list
      .mockRejectedValueOnce(new Error("Keys unavailable"))
      .mockResolvedValue({ apiKeys: [{ id: "key_current", name: "Current member key" }] });
    const view = render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_team")}
        onReloadAccess={onReloadAccess}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen
          go={vi.fn()}
          workspace={workspaceFixture("wsp_team", { memberRevision: 4 })}
          onReloadAccess={onReloadAccess}
        />
      </NotificationProvider>
    );
    expect(await screen.findByText("Current member key")).toBeVisible();
    await act(async () => access.resolve(true));
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(2);
    expect(onReloadAccess).toHaveBeenCalledTimes(1);
  });

  it("keeps a permission reload failure recoverable without dispatching or retrying a key read", async () => {
    const onReloadAccess = vi.fn().mockRejectedValueOnce(new Error("Access unavailable"));
    pullwiseApi.apiKeys.list.mockRejectedValueOnce(new Error("Keys unavailable"));
    render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_team")}
        onReloadAccess={onReloadAccess}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Access unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(onReloadAccess).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
  });

  it("skips the old key read when the central access refresh reports a changed scope", async () => {
    const onReloadAccess = vi.fn().mockResolvedValue(false);
    pullwiseApi.apiKeys.list.mockRejectedValueOnce(new Error("Keys unavailable"));
    render(<ApiKeysScreen go={vi.fn()} onReloadAccess={onReloadAccess} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onReloadAccess).toHaveBeenCalledTimes(1));
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "API keys are unavailable" })).toBeVisible();
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
  });

  it("ignores an explicit access refresh completion after unmount", async () => {
    const access = deferredPromise();
    const onReloadAccess = vi.fn().mockReturnValue(access.promise);
    pullwiseApi.apiKeys.list.mockRejectedValueOnce(new Error("Keys unavailable"));
    const view = render(<ApiKeysScreen go={vi.fn()} onReloadAccess={onReloadAccess} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    view.unmount();
    await act(async () => access.resolve(true));
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
  });

  it("preserves key drafts across a read-only access check without starting another key read", async () => {
    const workspace = workspaceFixture("wsp_team");
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspace} />);
    const name = await screen.findByRole("textbox", { name: "Key name" });
    fireEvent.change(name, { target: { value: "Unsubmitted automation" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /read expenses/i }));
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspace} accessRefreshing />
      </NotificationProvider>
    );
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Key name" })).toBe(name);
    expect(name).toBeDisabled();
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspace} />
      </NotificationProvider>
    );
    expect(await screen.findByRole("textbox", { name: "Key name" })).toHaveValue(
      "Unsubmitted automation"
    );
    expect(screen.getByRole("checkbox", { name: /read expenses/i })).not.toBeChecked();
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
  });

  it("retains the same one-time credential dialog during an unchanged access check", async () => {
    const workspace = workspaceFixture("wsp_team");
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_once", token: "pwk_once_kept_local" });
    const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspace} />);
    fireEvent.submit((await screen.findByRole("button", { name: "Create key" })).closest("form"));
    const dialog = await screen.findByRole("dialog", { name: "New key created" });
    const token = within(dialog).getByText("pwk_once_kept_local");
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspace} accessRefreshing />
      </NotificationProvider>
    );
    expect(screen.getByRole("dialog", { name: "New key created" })).toBe(dialog);
    expect(screen.getByText("pwk_once_kept_local")).toBe(token);
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspace} />
      </NotificationProvider>
    );
    expect(screen.getByText("pwk_once_kept_local")).toBe(token);
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledTimes(1);
  });

  it("keeps key drafts when an equivalent access response only reorders permissions and scopes", async () => {
    const workspace = workspaceFixture("wsp_team");
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspace} />);
    const name = await screen.findByRole("textbox", { name: "Key name" });
    fireEvent.change(name, { target: { value: "Keep equivalent access draft" } });
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen
          go={vi.fn()}
          workspace={{
            ...workspace,
            permissions: Object.fromEntries(Object.entries(workspace.permissions).reverse()),
            scopes: [...workspace.scopes].reverse(),
          }}
        />
      </NotificationProvider>
    );
    expect(screen.getByRole("textbox", { name: "Key name" })).toBe(name);
    expect(name).toHaveValue("Keep equivalent access draft");
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
  });

  it("refreshes access only on an explicit project retry and retains its read lock through recovery", async () => {
    const access = deferredPromise();
    const page = deferredPromise();
    const onReloadAccess = vi.fn().mockReturnValue(access.promise);
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    projects
      .mockRejectedValueOnce(new Error("Projects unavailable"))
      .mockReturnValueOnce(page.promise);
    render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_team")}
        onReloadAccess={onReloadAccess}
      />
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    const retry = await screen.findByRole("button", { name: "Retry projects" });
    expect(onReloadAccess).not.toHaveBeenCalled();
    fireEvent.click(retry);
    expect(onReloadAccess).toHaveBeenCalledTimes(1);
    expect(projects).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
    await act(async () => access.resolve(true));
    expect(projects).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
    await act(async () =>
      page.resolve({
        items: [projectFixture("prj_current", "Recovered project")],
        nextCursor: null,
      })
    );
    expect(await screen.findByRole("checkbox", { name: "Recovered project" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create key" })).toBeEnabled();
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
  });

  it("does not refresh current access for an obsolete mutation rejection", async () => {
    const pending = deferredPromise();
    const onAccessChanged = vi.fn();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockReturnValue(pending.promise);
    const view = render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_a")}
        onAccessChanged={onAccessChanged}
      />
    );
    fireEvent.submit((await screen.findByRole("button", { name: "Create key" })).closest("form"));
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen
          go={vi.fn()}
          workspace={workspaceFixture("wsp_b")}
          onAccessChanged={onAccessChanged}
        />
      </NotificationProvider>
    );
    await screen.findByRole("button", { name: "Create key" });
    await act(async () => pending.reject({ status: 404, message: "Old workspace removed" }));
    expect(onAccessChanged).not.toHaveBeenCalled();
    expect(screen.queryByText("Old workspace removed")).not.toBeInTheDocument();
  });

  it("aborts account key reads on unmount and ignores a late failed creation", async () => {
    const pending = deferredPromise();
    const onAccessChanged = vi.fn();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockReturnValue(pending.promise);
    const view = render(<ApiKeysScreen go={vi.fn()} onAccessChanged={onAccessChanged} />);
    fireEvent.submit((await screen.findByRole("button", { name: "Create key" })).closest("form"));
    const readSignal = pullwiseApi.apiKeys.list.mock.calls[0][1]?.signal;
    view.unmount();
    expect(readSignal?.aborted).toBe(true);
    await act(async () => pending.reject({ status: 403, message: "Late denial" }));
    expect(onAccessChanged).not.toHaveBeenCalled();
  });

  it("keeps a dismissed credential cleared and refreshes access when a current revocation is denied", async () => {
    const onAccessChanged = vi.fn();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_team", token: "pwk_revoked_scope" });
    pullwiseApi.apiKeys.revoke.mockRejectedValue({
      status: 404,
      message: "Workspace access removed",
    });
    render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_team")}
        onAccessChanged={onAccessChanged}
      />
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Create key" }));
    expect(await screen.findByText("pwk_revoked_scope")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await user.click(await screen.findByRole("button", { name: "Confirm revoke" }));
    expect(
      await screen.findByRole("heading", { name: "API keys are unavailable" })
    ).toBeInTheDocument();
    expect(screen.queryByText("pwk_revoked_scope")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onAccessChanged).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.list).toHaveBeenCalledTimes(1);
  });

  it("ignores a late revocation after selecting another workspace", async () => {
    const pending = deferredPromise();
    const onAccessChanged = vi.fn();
    pullwiseApi.apiKeys.list
      .mockResolvedValueOnce({ apiKeys: [{ id: "key_a", name: "Workspace A key" }] })
      .mockResolvedValueOnce({ apiKeys: [{ id: "key_b", name: "Workspace B key" }] });
    pullwiseApi.apiKeys.revoke.mockReturnValue(pending.promise);
    const view = render(
      <ApiKeysScreen
        go={vi.fn()}
        workspace={workspaceFixture("wsp_a")}
        onAccessChanged={onAccessChanged}
      />
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    await user.click(await screen.findByRole("button", { name: "Confirm revoke" }));
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen
          go={vi.fn()}
          workspace={workspaceFixture("wsp_b")}
          onAccessChanged={onAccessChanged}
        />
      </NotificationProvider>
    );
    expect(await screen.findByText("Workspace B key")).toBeInTheDocument();
    await act(async () => pending.reject({ status: 403, message: "Old workspace lost" }));
    expect(screen.getByText("Workspace B key")).toBeInTheDocument();
    expect(screen.queryByText("Workspace A key")).not.toBeInTheDocument();
    expect(screen.queryByText("Old workspace lost")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeEnabled();
    expect(onAccessChanged).not.toHaveBeenCalled();
  });

  it("selects projects by name across search and pagination and submits only the chosen real IDs", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_projects",
      token: "pwk_projects_local",
    });
    projects
      .mockResolvedValueOnce({
        items: [
          projectFixture("prj_web", "Website", { description: "Customer site" }),
          projectFixture("prj_api", "API service", { description: "Backend" }),
        ],
        nextCursor: "next",
      })
      .mockResolvedValueOnce({
        items: [projectFixture("prj_later", "Later project")],
        nextCursor: null,
      });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    const restrict = await screen.findByRole("checkbox", { name: "Limit to selected projects" });
    expect(projects).not.toHaveBeenCalled();
    await user.click(restrict);
    await user.click(await screen.findByRole("checkbox", { name: "Website" }));
    const search = screen.getByRole("searchbox", { name: "Find a project" });
    fireEvent.change(search, { target: { value: "BACKEND" } });
    expect(screen.queryByRole("checkbox", { name: "Website" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "API service" }));
    await user.click(screen.getByRole("checkbox", { name: "API service" }));
    fireEvent.change(search, { target: { value: "Later" } });
    expect(screen.getByText("No matching projects")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Load more projects" }));
    expect(projects).toHaveBeenNthCalledWith(
      2,
      { limit: 50, cursor: "next" },
      { signal: expect.any(AbortSignal) }
    );
    await user.click(await screen.findByRole("checkbox", { name: "Later project" }));
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveFocus();
    expect(screen.getByRole("checkbox", { name: "Website" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "API service" })).not.toBeChecked();
    const picker = document.querySelector(".api-project-picker");
    await user.click(picker.querySelector("summary"));
    expect(picker).not.toHaveAttribute("open");
    await user.click(picker.querySelector("summary"));
    expect(screen.getByRole("checkbox", { name: "Later project" })).toBeChecked();
    expect(projects).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("prj_web")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Allow shared expense pool" }));
    await user.click(screen.getByRole("button", { name: "Create key" }));
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
      name: "Ledger automation",
      scopes: readScopes,
      restrictions: { shared: true, projectIds: ["prj_web", "prj_later"] },
    });
    expect(await screen.findByText("pwk_projects_local")).toBeInTheDocument();
  });

  it.each([false, true])(
    "keeps an empty selection restricted with shared access set to %s",
    async (shared) => {
      pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
      pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_empty", token: "pwk_empty_local" });
      const go = vi.fn();
      const user = userEvent.setup();
      render(<ApiKeysScreen go={go} />);
      await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
      expect(await screen.findByText("No projects in this ledger")).toBeVisible();
      expect(
        screen.getByText("No projects selected. This key cannot access any project.")
      ).toBeVisible();
      const link = screen.getByRole("link", { name: "Your projects" });
      expect(link).toHaveAttribute("href", "/projects");
      await user.click(link);
      expect(go).toHaveBeenCalledWith("ledgerProjects");
      if (shared)
        await user.click(screen.getByRole("checkbox", { name: "Allow shared expense pool" }));
      await user.click(screen.getByRole("button", { name: "Create key" }));
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith(
        expect.objectContaining({ restrictions: { shared, projectIds: [] } })
      );
    }
  );

  it("blocks a restricted create while project access is unknown and recovers only on explicit retry", async () => {
    const pendingProjects = deferredPromise();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_retry", token: "pwk_retry_local" });
    projects.mockReturnValueOnce(pendingProjects.promise).mockResolvedValueOnce({
      items: [projectFixture("prj_retry", "Recovered project")],
      nextCursor: null,
    });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    const create = screen.getByRole("button", { name: "Create key" });
    expect(create).toBeDisabled();
    fireEvent.submit(create.closest("form"));
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
    await act(async () => pendingProjects.reject(new Error("Project service unavailable")));
    const picker = document.querySelector(".api-project-picker");
    expect(within(picker).getByRole("alert")).toHaveTextContent("Project service unavailable");
    expect(create).toBeDisabled();
    expect(projects).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("No projects in this ledger")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry projects" }));
    await user.click(await screen.findByRole("checkbox", { name: "Recovered project" }));
    await user.click(screen.getByRole("button", { name: "Create key" }));
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith(
      expect.objectContaining({ restrictions: { shared: false, projectIds: ["prj_retry"] } })
    );
  });

  it("treats malformed project data as an error rather than a successful empty allowlist", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    projects.mockResolvedValue({ items: null, nextCursor: null });
    render(<ApiKeysScreen go={vi.fn()} />);
    await userEvent
      .setup()
      .click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    expect(await screen.findByText("Project list response was malformed.")).toBeVisible();
    const create = screen.getByRole("button", { name: "Create key" });
    expect(create).toBeDisabled();
    fireEvent.submit(create.closest("form"));
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
    expect(screen.queryByText("No projects in this ledger")).not.toBeInTheDocument();
    expect(projects).toHaveBeenCalledTimes(1);
  });

  it("deduplicates project choices, hides unverified repository names and retains selections after a failed next page", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_pages", token: "pwk_pages_local" });
    projects
      .mockResolvedValueOnce({
        items: [
          projectFixture("prj_a", "Standalone project"),
          projectFixture("prj_a", "Duplicate project"),
          projectFixture("prj_lost", "Historical project", {
            githubAccess: "lost",
            githubFullName: "secret/repo",
          }),
        ],
        nextCursor: "next",
      })
      .mockRejectedValueOnce(new Error("Next page unavailable"))
      .mockResolvedValueOnce({
        items: [
          projectFixture("prj_a", "Standalone project"),
          projectFixture("prj_b", "Second project"),
        ],
        nextCursor: null,
      });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    await user.click(await screen.findByRole("checkbox", { name: "Standalone project" }));
    expect(screen.queryByText("Duplicate project")).not.toBeInTheDocument();
    expect(screen.queryByText("secret/repo")).not.toBeInTheDocument();
    expect(screen.queryByText("false")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more projects" }));
    expect(await screen.findByText("Next page unavailable")).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Standalone project" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry projects" }));
    expect(projects).toHaveBeenNthCalledWith(
      3,
      { limit: 50, cursor: "next" },
      { signal: expect.any(AbortSignal) }
    );
    await user.click(await screen.findByRole("checkbox", { name: "Second project" }));
    expect(screen.getAllByRole("checkbox", { name: "Standalone project" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Create key" }));
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith(
      expect.objectContaining({ restrictions: { shared: false, projectIds: ["prj_a", "prj_b"] } })
    );
  });

  it("stops a cursor cycle and reloads only after explicit intent", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    projects
      .mockResolvedValueOnce({
        items: [projectFixture("prj_a", "First project")],
        nextCursor: "page_1",
      })
      .mockResolvedValueOnce({
        items: [projectFixture("prj_b", "Second project")],
        nextCursor: "page_2",
      })
      .mockResolvedValueOnce({
        items: [projectFixture("prj_c", "Third project")],
        nextCursor: "page_1",
      })
      .mockResolvedValueOnce({
        items: [projectFixture("prj_b", "Second project")],
        nextCursor: null,
      });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    await user.click(await screen.findByRole("checkbox", { name: "First project" }));
    await user.click(screen.getByRole("button", { name: "Load more projects" }));
    await screen.findByRole("checkbox", { name: "Second project" });
    await user.click(screen.getByRole("button", { name: "Load more projects" }));
    expect(await screen.findByText("Pagination did not advance. Reload to retry.")).toBeVisible();
    expect(projects).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("button", { name: "Load more projects" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reload projects" }));
    expect(await screen.findByRole("checkbox", { name: "Second project" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "First project" })).not.toBeInTheDocument();
    expect(projects).toHaveBeenCalledTimes(4);
  });

  it("aborts old workspace project reads and never submits old IDs or restores late protected names", async () => {
    const oldPage = deferredPromise();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_b", token: "pwk_b_local" });
    projects.mockReturnValueOnce(oldPage.promise).mockResolvedValueOnce({
      items: [projectFixture("prj_b", "Workspace B project")],
      nextCursor: null,
    });
    const user = userEvent.setup();
    const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_a")} />);
    await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    const signal = projects.mock.calls[0][1].signal;
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_b")} />
      </NotificationProvider>
    );
    expect(signal.aborted).toBe(true);
    const restriction = await screen.findByRole("checkbox", { name: "Limit to selected projects" });
    expect(restriction).not.toBeChecked();
    await user.click(restriction);
    await user.click(await screen.findByRole("checkbox", { name: "Workspace B project" }));
    await act(async () =>
      oldPage.resolve({
        items: [projectFixture("prj_a", "Workspace A private project")],
        nextCursor: null,
      })
    );
    expect(screen.queryByText("Workspace A private project")).not.toBeInTheDocument();
    expect(createLedgerApi).toHaveBeenCalledWith("wsp_a");
    expect(createLedgerApi).toHaveBeenCalledWith("wsp_b");
    await user.click(screen.getByRole("button", { name: "Create key" }));
    expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restrictions: {
          shared: false,
          projectIds: ["prj_b"],
          workspaceId: "wsp_b",
          workspaceMemberRevision: 3,
        },
      })
    );
  });

  it.each([{ memberRevision: 4 }, { permissionsRevision: 4 }])(
    "clears project targets and search on a same-workspace access revision change: %j",
    async (revision) => {
      pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
      projects
        .mockResolvedValueOnce({
          items: [projectFixture("prj_old", "Old project")],
          nextCursor: null,
        })
        .mockResolvedValueOnce({
          items: [projectFixture("prj_new", "New project")],
          nextCursor: null,
        });
      const user = userEvent.setup();
      const view = render(<ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_team")} />);
      await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
      await user.click(await screen.findByRole("checkbox", { name: "Old project" }));
      fireEvent.change(screen.getByRole("searchbox", { name: "Find a project" }), {
        target: { value: "Old" },
      });
      await user.click(screen.getByRole("checkbox", { name: "Allow shared expense pool" }));
      view.rerender(
        <NotificationProvider>
          <ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_team", revision)} />
        </NotificationProvider>
      );
      const restriction = await screen.findByRole("checkbox", {
        name: "Limit to selected projects",
      });
      expect(restriction).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Allow shared expense pool" })).not.toBeChecked();
      await user.click(restriction);
      expect(await screen.findByRole("checkbox", { name: "New project" })).not.toBeChecked();
      expect(screen.getByRole("searchbox", { name: "Find a project" })).toHaveValue("");
      expect(screen.queryByText("Old project")).not.toBeInTheDocument();
    }
  );

  it("aborts project reads when restrictions close or the screen unmounts and ignores late access failures", async () => {
    const first = deferredPromise();
    const second = deferredPromise();
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    projects.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onAccessChanged = vi.fn();
    const user = userEvent.setup();
    const view = render(<ApiKeysScreen go={vi.fn()} onAccessChanged={onAccessChanged} />);
    const restriction = await screen.findByRole("checkbox", { name: "Limit to selected projects" });
    await user.click(restriction);
    const firstSignal = projects.mock.calls[0][1].signal;
    await user.click(restriction);
    expect(firstSignal.aborted).toBe(true);
    await act(async () => first.reject({ status: 403, message: "Obsolete project access denied" }));
    expect(onAccessChanged).not.toHaveBeenCalled();
    expect(screen.queryByText("Obsolete project access denied")).not.toBeInTheDocument();
    await user.click(restriction);
    const secondSignal = projects.mock.calls[1][1].signal;
    view.unmount();
    expect(secondSignal.aborted).toBe(true);
    await act(async () =>
      second.reject({ status: 403, message: "Unmounted project access denied" })
    );
    expect(onAccessChanged).not.toHaveBeenCalled();
  });

  it("invalidates a concurrent key-list read when project access is denied", async () => {
    const keyReload = deferredPromise();
    const projectRead = deferredPromise();
    pullwiseApi.apiKeys.list
      .mockResolvedValueOnce({ apiKeys: [] })
      .mockReturnValueOnce(keyReload.promise);
    projects.mockReturnValue(projectRead.promise);
    const onAccessChanged = vi.fn();
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} onAccessChanged={onAccessChanged} />);
    await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    fireEvent.submit(screen.getByRole("button", { name: "Create key" }).closest("form"));
    await user.click(
      within(document.querySelector(".set-body > .notice")).getByRole("button", { name: "Retry" })
    );
    const keyReadSignal = pullwiseApi.apiKeys.list.mock.calls[1][1].signal;
    const failure = {
      status: 403,
      code: "WORKSPACE_MEMBERSHIP_CHANGED",
      message: "Project access changed",
    };
    await act(async () => projectRead.reject(failure));
    expect(keyReadSignal.aborted).toBe(true);
    expect(
      await screen.findByRole("heading", { name: "API keys are unavailable" })
    ).toBeInTheDocument();
    await act(async () =>
      keyReload.resolve({ apiKeys: [{ id: "key_private", name: "Denied ledger key" }] })
    );
    expect(screen.queryByText("Denied ledger key")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Limit to selected projects" })
    ).not.toBeInTheDocument();
    expect(onAccessChanged).toHaveBeenCalledTimes(1);
    expect(onAccessChanged).toHaveBeenCalledWith(failure);
  });

  it("refreshes current access for an authorization error code even when its status is 409", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    const failure = {
      status: 409,
      payload: { error: { code: "AUTHORIZATION_CHANGED" } },
      message: "Authorization changed",
    };
    projects.mockRejectedValue(failure);
    const onAccessChanged = vi.fn();
    render(<ApiKeysScreen go={vi.fn()} onAccessChanged={onAccessChanged} />);
    await userEvent
      .setup()
      .click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    expect(
      await screen.findByRole("heading", { name: "API keys are unavailable" })
    ).toBeInTheDocument();
    expect(onAccessChanged).toHaveBeenCalledTimes(1);
    expect(projects).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
  });

  it("caps selected projects at 100 while allowing a checked project to be removed", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({ id: "key_limit", token: "pwk_limit_local" });
    projects.mockResolvedValue({
      items: Array.from({ length: 101 }, (_, index) =>
        projectFixture(`prj_${index}`, `Project ${index}`)
      ),
      nextCursor: null,
    });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    await user.click(await screen.findByRole("checkbox", { name: "Limit to selected projects" }));
    await screen.findByRole("checkbox", { name: "Project 100" });
    const choices = within(document.querySelector(".api-project-picker")).getAllByRole("checkbox");
    choices.slice(0, 100).forEach((checkbox) => fireEvent.click(checkbox));
    expect(choices[100]).toBeDisabled();
    expect(choices[0]).not.toBeDisabled();
    fireEvent.click(choices[0]);
    expect(choices[100]).not.toBeDisabled();
    fireEvent.click(choices[100]);
    await user.click(screen.getByRole("button", { name: "Create key" }));
    const restrictions = pullwiseApi.apiKeys.create.mock.calls[0][0].restrictions;
    expect(restrictions.projectIds).toHaveLength(100);
    expect(restrictions.projectIds).not.toContain("prj_0");
    expect(restrictions.projectIds).toContain("prj_100");
    expect(restrictions.shared).toBe(false);
  });

  it("disallows writes when workspace capabilities are missing and disables empty effective access", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    const view = render(
      <ApiKeysScreen go={vi.fn()} workspace={{ id: "wsp_unknown", revision: 1, role: "owner" }} />
    );
    await screen.findByRole("button", { name: "Create key" });
    expect(screen.queryAllByRole("checkbox", { name: /manage|request suggestions/i })).toHaveLength(
      0
    );
    expect(
      within(screen.getByRole("group", { name: "Scopes" })).getAllByRole("checkbox", {
        checked: true,
      })
    ).toHaveLength(5);
    view.rerender(
      <NotificationProvider>
        <ApiKeysScreen go={vi.fn()} workspace={workspaceFixture("wsp_unknown", { scopes: [] })} />
      </NotificationProvider>
    );
    const create = await screen.findByRole("button", { name: "Create key" });
    expect(create).toBeDisabled();
    fireEvent.submit(create.closest("form"));
    expect(pullwiseApi.apiKeys.create).not.toHaveBeenCalled();
  });
});
