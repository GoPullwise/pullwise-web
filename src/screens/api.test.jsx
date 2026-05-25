import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { useIssues, useRepositories } from "../lib/pullwise-data.js";
import { ApiDocsScreen, ApiKeysScreen, WorkspacesScreen } from "./api.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    apiKeys: {
      list: vi.fn(),
      create: vi.fn(),
      revoke: vi.fn(),
    },
    workspaces: {
      list: vi.fn(),
      create: vi.fn(),
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
      workspace: { name: "Acme" },
    });
  });

  it("documents repository automation endpoints", () => {
    const go = vi.fn();

    render(<ApiDocsScreen go={go} auth={{ authenticated: true }} />);

    expect(screen.getByRole("heading", { name: /pullwise rest api/i })).toBeInTheDocument();
    expect(screen.getByText("GET /api/v1/repositories")).toBeInTheDocument();
    expect(screen.getByText("POST /api/v1/repositories/{repoId}/scans")).toBeInTheDocument();
    expect(screen.getByText("GET /api/v1/repositories/{repoId}/quota")).toBeInTheDocument();
  });

  it("exposes API docs navigation destinations as real screen links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(<ApiDocsScreen go={go} auth={{ authenticated: true }} />);

    const docsSide = within(document.querySelector(".docs-side"));
    const docsFoot = within(document.querySelector(".docs-foot-actions"));
    const apiKeysSide = docsSide.getByRole("link", { name: /api keys/i });
    const pricing = docsFoot.getByRole("link", { name: /pricing/i });
    const apiKeysFoot = docsFoot.getByRole("link", { name: /api keys/i });
    const home = within(document.querySelector(".docs-crumbs")).getByRole("link", {
      name: /pullwise/i,
    });

    expect(apiKeysSide).toHaveAttribute("href", expect.stringContaining("screen=apiKeys"));
    expect(apiKeysFoot).toHaveAttribute("href", expect.stringContaining("screen=apiKeys"));
    expect(pricing).toHaveAttribute("href", expect.stringContaining("screen=pricing"));
    expect(home).toHaveAttribute("href", expect.stringContaining("screen=landing"));

    await user.click(apiKeysSide);
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

    expect(pageAction).toHaveAttribute("href", expect.stringContaining("screen=api"));
    expect(docsSide).toHaveAttribute("href", expect.stringContaining("screen=api"));

    await user.click(pageAction);
    expect(go).toHaveBeenCalledWith("api");
  });

  it("creates and revokes workspace-scoped API keys", async () => {
    pullwiseApi.apiKeys.list.mockResolvedValue({
      apiKeys: [{ id: "key_1", name: "Old key", prefix: "pwk_old", workspaceName: "Acme" }],
    });
    pullwiseApi.apiKeys.create.mockResolvedValue({
      id: "key_2",
      name: "CI scanner",
      prefix: "pwk_new",
      workspaceName: "Acme",
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
      expect(pullwiseApi.apiKeys.create).toHaveBeenCalledWith({ name: "CI scanner" });
    });
    expect(await screen.findByText("pwk_live_secret")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /revoke/i })[0]);

    await waitFor(() => {
      expect(pullwiseApi.apiKeys.revoke).toHaveBeenCalled();
    });
  });

  it("creates workspaces from the dashboard workspace page", async () => {
    pullwiseApi.workspaces.list.mockResolvedValue({
      currentWorkspace: { id: "ws_1", name: "Acme", role: "owner" },
      workspaces: [{ id: "ws_1", name: "Acme", role: "owner" }],
    });
    pullwiseApi.workspaces.create.mockResolvedValue({
      workspace: { id: "ws_2", name: "Platform", role: "owner" },
    });
    const user = userEvent.setup();

    render(<WorkspacesScreen go={vi.fn()} />);

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/workspace name/i));
    await user.type(screen.getByLabelText(/workspace name/i), "Platform");
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(() => {
      expect(pullwiseApi.workspaces.create).toHaveBeenCalledWith({ name: "Platform" });
    });
    expect(await screen.findByText("Platform")).toBeInTheDocument();
  });

  it("exposes workspace repository navigation as real screen links", async () => {
    pullwiseApi.workspaces.list.mockResolvedValue({
      currentWorkspace: { id: "ws_1", name: "Acme", role: "owner" },
      workspaces: [{ id: "ws_1", name: "Acme", role: "owner" }],
    });
    const user = userEvent.setup();
    const go = vi.fn();

    render(<WorkspacesScreen go={go} />);

    expect(await screen.findByText("Acme")).toBeInTheDocument();
    const settingsNav = within(document.querySelector(".set-side"));
    const repositories = settingsNav.getByRole("link", { name: /repositories/i });
    const repoRow = screen.getByRole("link", { name: /^repos$/i });

    expect(repositories).toHaveAttribute("href", expect.stringContaining("screen=repos"));
    expect(repoRow).toHaveAttribute("href", expect.stringContaining("screen=repos"));

    await user.click(repoRow);
    expect(go).toHaveBeenCalledWith("repos");
  });
});
