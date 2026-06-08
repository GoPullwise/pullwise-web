import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { useIssues, useRepositories } from "../lib/pullwise-data.js";
import { ApiDocsScreen, ApiKeysScreen } from "./api.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    apiKeys: {
      list: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    },
  },
}));

vi.mock("../lib/pullwise-data.js", () => ({
  useIssues: vi.fn(),
  useRepositories: vi.fn(),
}));

describe("API screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIssues.mockReturnValue({ items: [] });
    useRepositories.mockReturnValue({
      items: [{ id: "repo_1", name: "api", fullName: "acme/api" }],
    });
  });

  it("documents repository automation endpoints", () => {
    const go = vi.fn();

    render(<ApiDocsScreen go={go} auth={{ authenticated: true }} />);

    expect(screen.getByRole("heading", { name: /pullwise rest api/i })).toBeInTheDocument();
    expect(screen.getByText("/api/v1/repositories")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/repositories/{repoId}/scans")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/repositories/{repoId}/scans/stop")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/repositories/{repoId}/scans/current")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/repositories/{repoId}/quota")).toBeInTheDocument();
  });

  it("renders endpoint docs as scannable cards instead of a compressed table", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    expect(document.querySelector(".docs-endpoint-list")).toBeInTheDocument();
    expect(document.querySelectorAll(".docs-endpoint-card")).toHaveLength(5);
  });

  it("keeps a wider docs layout inside the marketing header bounds", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);
    const styles = readFileSync("styles/screens.css", "utf8");
    const appStyles = readFileSync("src/app.css", "utf8");

    expect(document.querySelector(".docs-toc")).not.toBeInTheDocument();
    expect(styles).toMatch(/\.docs-shell\s*{[^}]*max-width:\s*1120px;/);
    expect(styles).toMatch(/\.docs-shell\s*{[^}]*grid-template-columns:\s*176px minmax\(0,\s*1fr\);/);
    expect(appStyles).toMatch(/\.docs-shell\s*{[^}]*grid-template-columns:\s*176px minmax\(0,\s*1fr\);/);
    expect(styles).toMatch(/\.docs-side\s*{[^}]*justify-self:\s*start;/);
    expect(styles).toMatch(/\.docs-side-h\s*{[^}]*text-align:\s*left;/);
    expect(styles).toMatch(/\.docs-side-i\s*{[^}]*text-align:\s*left;/);
    expect(styles).toMatch(/\.docs-h1\s*{[^}]*max-width:\s*none;/);
    expect(styles).toMatch(/\.docs-lede\s*{[^}]*max-width:\s*none;/);
  });

  it("keeps scan response examples aligned with the public API payload", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    const scanResponse = screen.getByText("Scan response").closest(".docs-code");
    expect(scanResponse?.querySelector("pre")).not.toHaveTextContent(/"requestId"/);
  });

  it("uses the implemented free-plan quota defaults in response examples", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    const quotaResponse = screen.getByText("Quota response").closest(".docs-code");
    const quotaExample = quotaResponse?.querySelector("pre");

    expect(quotaExample).toHaveTextContent(/"scope": "user"[\s\S]*"limit": 10,/);
    expect(quotaExample).toHaveTextContent(/"scope": "repository"[\s\S]*"limit": 3,/);
  });

  it("documents the GitHub App write permissions required by implementation", () => {
    render(<ApiDocsScreen go={vi.fn()} auth={{ authenticated: true }} />);

    const repositoryResponse = screen.getByText("Repository response").closest(".docs-code");
    const repositoryExample = repositoryResponse?.querySelector("pre");

    expect(repositoryExample).toHaveTextContent(/"contents": "write"/);
    expect(repositoryExample).toHaveTextContent(/"pull_requests": "write"/);
    expect(repositoryExample).not.toHaveTextContent(/"contents": "read"/);
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
        scopes: ["repositories:read", "scans:write", "scans:read", "quota:read"],
      });
    });
    expect(await screen.findByText("pwk_live_secret")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /revoke/i })[0]);

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalled();
    });
  });

  it("creates API keys with the selected scopes", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({ apiKeys: [] });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_2",
      name: "CI scanner",
      prefix: "pwk_new",
      scopes: ["repositories:read", "scans:read"],
      key: "pwk_live_secret",
    });
    const user = userEvent.setup();

    render(<ApiKeysScreen go={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: /api keys/i })).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/key name/i));
    await user.type(screen.getByLabelText(/key name/i), "CI scanner");
    await user.click(screen.getByRole("checkbox", { name: /start repository scans/i }));
    await user.click(screen.getByRole("checkbox", { name: /read quota/i }));
    await user.click(screen.getByRole("button", { name: /create key/i }));

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({
        name: "CI scanner",
        scopes: ["repositories:read", "scans:read"],
      });
    });
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
    expect(screen.queryByText(/Keys inherit the creator Pullwise account role/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose only the REST scopes each key needs/i)).not.toBeInTheDocument();
    expect(createForm).toHaveClass("api-key-create");
    expect(createForm.querySelector(".api-key-create-main")).toBeInTheDocument();
    expect(createForm.querySelector(".api-key-name-row")).toContainElement(
      screen.getByRole("button", { name: /create key/i })
    );
    expect(scopes).toHaveClass("api-scope-panel");
    expect(scopes.querySelector(".api-scope-head")).toHaveTextContent(/^Scopes/);
    expect(scopes.querySelector(".api-scope-count")).toHaveTextContent("4 / 4 selected");
    expect(scopes.querySelectorAll(".api-scope-row")).toHaveLength(4);
    expect(scopes.querySelectorAll(".api-scope-value")).toHaveLength(4);
    expect(styles).toMatch(/\.api-key-name-row\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/);
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
      apiKeys: [
        null,
        "bad key",
        { id: "key_1", name: "Old key", prefix: "pwk_old" },
      ],
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
