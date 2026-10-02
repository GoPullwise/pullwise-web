import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { NotificationProvider } from "../components/notifications.jsx";
import { env } from "../config/env.js";
import { ApiKeysScreen } from "./api.jsx";
import { ApiDocsScreen } from "./api-docs.jsx";

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
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("API screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("documents the ledger contract and target restrictions", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByRole("heading", { name: /pullwise ledger rest api/i })).toBeInTheDocument();
    expect(screen.getAllByText("/api/v1/expenses")).toHaveLength(2);
    expect(screen.getByText("/api/v1/reports/summary")).toBeInTheDocument();
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
    } finally {
      if (originalClipboard)
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      else delete navigator.clipboard;
    }
  });

  it("resolves same-origin API base URLs without doubling /api", async () => {
    const originalApiBase = env.VITE_API_BASE_URL;
    const originalPublicApiBase = env.VITE_PUBLIC_API_BASE_URL;
    env.VITE_API_BASE_URL = "/api";
    env.VITE_PUBLIC_API_BASE_URL = "";
    try {
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
      expect(screen.getByText(`${window.location.origin}/api`)).toBeInTheDocument();
      expect(screen.getByText(/curl.*api\/v1\/expenses/)).toBeInTheDocument();
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
      name: "Account automation",
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
        name: "Account automation",
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

  it("keeps a newly created token visible when an unrelated key is revoked", async () => {
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

    await user.click(within(oldKey.closest(".key-row")).getByRole("button", { name: /revoke/i }));
    await user.click(await screen.findByRole("button", { name: /confirm revoke/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalledWith("key_old");
    });
    expect(screen.getByText("pwk_live_new_secret")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^copy$/i })).toBeInTheDocument();
  });

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
      name: "Account automation",
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

  it("retains malformed created-key metadata for revocation when the one-time token is missing", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_without_token",
      name: "Account automation",
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
        name: "Account automation",
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
    expect(within(scopes).getByText("5 / 9 selected")).toBeInTheDocument();
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
});
