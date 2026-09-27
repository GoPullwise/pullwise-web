import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
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

  it("documents the PR CI Updates product contract without scan routes", () => {
    const go = vi.fn();

    render(<ApiDocsScreen go={go} auth={{ authenticated: true }} />);

    expect(screen.getByRole("heading", { name: /pullwise rest api/i })).toBeInTheDocument();
    expect(screen.getByText("/api/v1/items")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/sources")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/items/overview")).toBeInTheDocument();
    expect(screen.queryByText("/api/v1/watches/{watchId}/sync")).not.toBeInTheDocument();
    expect(screen.queryByText(/\/scans(\/|$)/)).not.toBeInTheDocument();
  });

  it("copies the rendered API docs page as markdown", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

      await user.click(screen.getByRole("button", { name: /copy page/i }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
      });
      const markdown = writeText.mock.calls[0][0];
      expect(markdown).toContain("# Pullwise REST API");
      expect(markdown).toContain("## Authentication");
      expect(markdown).toContain("### Base URL");
      expect(markdown).toContain("```");
      expect(markdown).toContain("### GET /api/v1/repositories");
      expect(markdown).toContain("| Code | Description |");
      expect(markdown).toContain("API routes are versioned under /api/v1.");
      expect(markdown).not.toContain("Copy Page");
      expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it("renders endpoint docs as scannable cards instead of a compressed table", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(document.querySelector(".docs-endpoint-list")).toBeInTheDocument();
    const cards = [...document.querySelectorAll(".docs-endpoint-card")];
    expect(cards.length).toBeGreaterThanOrEqual(18);
    expect(cards.some(card => card.textContent.includes("/api/v1/visualizations?kind=workload"))).toBe(true);
    expect(cards.some(card => card.textContent.includes("/api/v1/visualizations?kind=pr_actions"))).toBe(true);
  });
  it("resolves root-relative API base URLs for same-origin API docs examples", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    const originalApiBase = env.VITE_API_BASE_URL;
    const originalPublicApiBase = env.VITE_PUBLIC_API_BASE_URL;
    env.VITE_API_BASE_URL = "/api";
    env.VITE_PUBLIC_API_BASE_URL = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

      expect(screen.getByText(`${window.location.origin}/api`)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /copy page/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText.mock.calls[0][0]).toContain(`${window.location.origin}/api/v1/items?module=pr&view=mine`);
      expect(writeText.mock.calls[0][0]).not.toContain("curl https://api.pull-wise.com");
    } finally {
      env.VITE_API_BASE_URL = originalApiBase;
      env.VITE_PUBLIC_API_BASE_URL = originalPublicApiBase;
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: originalClipboard,
        });
      } else {
        delete navigator.clipboard;
      }
    }
  });

  it("matches the docs layout width to the marketing header", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    const styles = readFileSync("styles/screens.css", "utf8");
    const appStyles = readFileSync("src/app.css", "utf8");

    expect(document.querySelector(".docs-toc")).not.toBeInTheDocument();
    expect(appStyles).toMatch(
      /\.pricing-hero,\s*\.pricing-tiers,\s*\.pricing-faq,\s*\.docs-shell,\s*\.legal-shell,\s*\.status-hero,\s*\.status-section\s*{[^}]*max-width:\s*1240px;/s
    );
    expect(styles).toMatch(
      /\.docs-shell\s*{[^}]*grid-template-columns:\s*176px minmax\(0,\s*1fr\);/
    );
    expect(appStyles).toMatch(
      /\.docs-shell\s*{[^}]*grid-template-columns:\s*176px minmax\(0,\s*1fr\);/
    );
    expect(styles).toMatch(/\.docs-side\s*{[^}]*justify-self:\s*start;/);
    expect(styles).toMatch(/\.docs-side-h\s*{[^}]*text-align:\s*left;/);
    expect(styles).toMatch(/\.docs-side-i\s*{[^}]*text-align:\s*left;/);
    expect(styles).toMatch(/\.docs-h1\s*{[^}]*max-width:\s*none;/);
    expect(styles).toMatch(/\.docs-lede\s*{[^}]*max-width:\s*none;/);
  });

  it("describes saved product reads without a model submission route", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByText("/api/v1/items/overview")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/usage/events")).toBeInTheDocument();
    expect(screen.getByText(/GET never starts model processing/i)).toBeInTheDocument();
    expect(screen.queryByText(/agentFixPrompt/i)).not.toBeInTheDocument();
  });

  it("does not advertise retired manual sync", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.queryByText("Sync watch facts")).not.toBeInTheDocument();
    expect(screen.queryByText("/api/v1/jobs/{jobId}")).not.toBeInTheDocument();
  });

  it("shows usage and availability without scan quota examples", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByText("/api/v1/usage")).toBeInTheDocument();
    expect(screen.getByText(/repository listing\/creation, watch creation/i)).toBeInTheDocument();
    expect(screen.queryByText(/scan quota/i)).not.toBeInTheDocument();
  });

  it("marks the Cloudflare product Server as a preview", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    expect(screen.getByText(/cloudflare server is not deployed yet/i)).toBeInTheDocument();
    expect(screen.getAllByText("/api/v1/repositories/{repositoryId}/service")).toHaveLength(2);
  });

  it("exposes API docs navigation destinations as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<ApiDocsScreen go={go} auth={{ authenticated: true }} />);

    const docsSide = within(document.querySelector(".docs-side"));
    const docsFoot = within(document.querySelector(".docs-foot-actions"));
    const pricing = docsFoot.getByRole("link", { name: /pricing/i });
    const apiKeysFoot = docsFoot.getByRole("link", { name: /api keys/i });
    const home = within(document.querySelector(".docs-crumbs")).getByRole("link", {
      name: /pullwise/i,
    });

    expect(docsSide.queryByRole("link", { name: /api keys/i })).not.toBeInTheDocument();
    expect(apiKeysFoot).toHaveAttribute("href", "/api-keys");
    expect(pricing).toHaveAttribute("href", "/pricing");
    expect(home).toHaveAttribute("href", "/");

    await user.click(apiKeysFoot);
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
    expect(container.querySelectorAll(".api-keys-skeleton .issue-row")).toHaveLength(3);
    expect(screen.queryByText(/no api keys have been created/i)).not.toBeInTheDocument();
  });

  it("creates and revokes account-scoped API keys", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_1", name: "Old key", prefix: "pwk_old" }],
    });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_2",
      name: "CI scanner",
      prefix: "pwk_new",
      key: "pwk_live_secret",
    });
    pullwiseApi.apiKeys.revoke.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByText("Old key")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/key name/i));
    await user.type(screen.getByLabelText(/key name/i), "CI scanner");
    await user.click(screen.getByRole("button", { name: /create key/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
        name: "CI scanner",
        scopes: ["profile:read", "repositories:read", "items:read", "watches:read", "usage:read"],
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

    await user.click(within(oldKey.closest(".issue-row")).getByRole("button", { name: /revoke/i }));
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
      name: "CI scanner",
      prefix: "pwk_new",
      scopes: ["profile:read", "repositories:read", "items:read", "watches:read", "usage:read", "items:write"],
      key: "pwk_live_secret",
    });
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/key name/i));
    await user.type(screen.getByLabelText(/key name/i), "CI scanner");
    await user.click(screen.getByRole("checkbox", { name: /handle items/i }));
    expect(screen.queryByRole("checkbox", { name: /sync github facts/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create key/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
        name: "CI scanner",
        scopes: ["profile:read", "repositories:read", "items:read", "watches:read", "usage:read", "items:write"],
      });
    });
  });

  it("defaults new API keys to product reads and leaves writes opt-in", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_read", name: "Read key", prefix: "pwk_read", key: "pwk_read_secret",
    });
    const user = userEvent.setup();
    render(<ApiKeysScreen go={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /read items and sources/i })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /sync github facts/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create key/i }));
    await waitFor(() => expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
      name: "Account automation",
      scopes: ["profile:read", "repositories:read", "items:read", "watches:read", "usage:read"],
    }));
  });

  it("uses a streamlined API key creation panel without redundant scope explainer rows", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    const scopes = screen.getByRole("group", { name: /scopes/i });
    const createForm = scopes.closest("form");
    const styles = readFileSync("styles/screens.css", "utf8");

    expect(screen.queryByText("Permission model")).not.toBeInTheDocument();
    expect(screen.queryByText(/^REST scopes$/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Keys inherit the creator Pullwise account role/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Choose only the REST scopes each key needs/i)
    ).not.toBeInTheDocument();
    expect(createForm).toHaveClass("api-key-create");
    expect(createForm.querySelector(".api-key-create-main")).toBeInTheDocument();
    expect(createForm.querySelector(".api-key-name-row")).toContainElement(
      screen.getByRole("button", { name: /create key/i })
    );
    expect(scopes).toHaveClass("api-scope-panel");
    expect(scopes.querySelector(".api-scope-head")).toHaveTextContent(/^Scopes/);
    expect(scopes.querySelector(".api-scope-count")).toHaveTextContent("5 / 8 selected");
    expect(scopes.querySelectorAll(".api-scope-row")).toHaveLength(8);
    expect(scopes.querySelectorAll(".api-scope-value")).toHaveLength(8);
    expect(styles).toMatch(
      /\.api-key-name-row\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/
    );
    expect(styles).toMatch(/\.api-scope-panel\s*{[^}]*border:\s*1px solid var\(--border\);/);
    expect(styles).toMatch(
      /\.api-scope-row\s*{[^}]*grid-template-columns:\s*18px minmax\(0,\s*1fr\) auto;/
    );
  });

  it("shows feedback when copying a newly created API key fails", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_2",
      name: "CI scanner",
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
    await user.type(screen.getByLabelText(/key name/i), "CI scanner");
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
    await user.type(screen.getByLabelText(/key name/i), "CI scanner");
    await user.click(screen.getByRole("button", { name: /create key/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/api key response was malformed/i);
    expect(screen.queryByText("New key created")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revoke/i })).not.toBeInTheDocument();
  });
});
