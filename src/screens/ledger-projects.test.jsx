import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LedgerScreen } from "./ledger.jsx";

const api = vi.hoisted(() => ({
  repositories: vi.fn(), projects: vi.fn(), categories: vi.fn(),
  reportSummary: vi.fn(), createProject: vi.fn(),
}));
const github = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("../api/ledger.js", () => ({ ledgerApi: api }));
vi.mock("../lib/auth.js", () => ({ connectGitHubRepositories: github.connect }));

beforeEach(() => {
  vi.resetAllMocks();
  api.repositories.mockResolvedValue({ items: [{ githubRepoId: 202, fullName: "alice/project" }], nextCursor: null });
  api.projects.mockResolvedValue({ items: [], nextCursor: null });
  api.categories.mockResolvedValue([]);
  api.reportSummary.mockResolvedValue({ groups: [] });
  api.createProject.mockResolvedValue({ id: "prj_new" });
  github.connect.mockResolvedValue(undefined);
});

describe("Projects authorization and creation", () => {
  it("reloads repositories after GitHub popup authorization completes", async () => {
    api.repositories.mockResolvedValueOnce({ items: [], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(github.connect).toHaveBeenCalledTimes(1);
    expect(api.repositories).toHaveBeenCalledTimes(2);
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("shows popup cancellation and allows a manual retry", async () => {
    github.connect.mockRejectedValueOnce(new Error("GitHub authorization was cancelled"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("GitHub authorization was cancelled");
    expect(screen.getByRole("button", { name: /Manage GitHub access/i })).toBeEnabled();
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("keeps project controls usable when the spending summary fails", async () => {
    api.reportSummary.mockRejectedValueOnce(new Error("Summary unavailable"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    expect(screen.getByText(/Spending summary is unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText("No expenses in this range.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith({ githubRepoId: 202, description: "" }, {}));
  });

  it("opens the explicitly created project and guards duplicate submission", async () => {
    let finish;
    api.createProject.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const go = vi.fn();
    render(<LedgerScreen go={go} mode="projects" />);
    const button = await screen.findByRole("button", { name: /Create project/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.createProject).toHaveBeenCalledTimes(1);
    finish({ id: "prj_new" });
    await waitFor(() => expect(go).toHaveBeenCalledWith("ledgerProject", { id: "prj_new" }));
  });

  it("does not navigate when creation completes after leaving Projects", async () => {
    let finish;
    api.createProject.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const go = vi.fn();
    const view = render(<LedgerScreen go={go} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Create project/i }));
    view.unmount();
    finish({ id: "prj_late" });
    await Promise.resolve();
    expect(go).not.toHaveBeenCalled();
  });

  it("does not reload after authorization completes on an unmounted view", async () => {
    let finish;
    github.connect.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: /Manage GitHub access/i }));
    view.unmount();
    finish();
    await Promise.resolve();
    expect(api.repositories).toHaveBeenCalledTimes(1);
  });

  it("distinguishes already-added repositories from missing GitHub access", async () => {
    api.projects.mockResolvedValue({ items: [{ id: "prj_1", githubRepoId: 202, githubFullName: "alice/project", totals: [] }], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByText(/These repositories are already in your projects/i)).toBeInTheDocument();
    expect(screen.queryByText(/Connect GitHub to add a project/i)).not.toBeInTheDocument();
  });

  it("uses the displayed repository after a previously selected repository disappears", async () => {
    api.repositories.mockResolvedValueOnce({ items: [{ githubRepoId: 202, fullName: "alice/first" }, { githubRepoId: 303, fullName: "alice/second" }], nextCursor: null });
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    fireEvent.change(await screen.findByLabelText("Repository"), { target: { value: "303" } });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(screen.queryByRole("option", { name: "alice/second" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("Repository")).toHaveValue("202");
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledWith({ githubRepoId: 202, description: "" }, {}));
  });

  it("shows repository load failure instead of a successful empty state", async () => {
    api.repositories.mockRejectedValueOnce(new Error("Repository list unavailable"));
    render(<LedgerScreen go={vi.fn()} mode="projects" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Repository list unavailable");
    expect(screen.queryByRole("button", { name: /Create project/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/No projects yet|Your first project starts here/i)).not.toBeInTheDocument();
  });

  it("clears repositories when authorization changes and ignores the previous response", async () => {
    let finish;
    const view = render(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={0} />);
    expect(await screen.findByRole("option", { name: "alice/project" })).toBeInTheDocument();
    api.repositories.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={1} />);
    expect(screen.queryByRole("option", { name: "alice/project" })).not.toBeInTheDocument();
    api.repositories.mockResolvedValueOnce({ items: [{ githubRepoId: 404, fullName: "alice/current" }], nextCursor: null });
    view.rerender(<LedgerScreen go={vi.fn()} mode="projects" authorizationRevision={2} />);
    expect(await screen.findByRole("option", { name: "alice/current" })).toBeInTheDocument();
    finish({ items: [{ githubRepoId: 303, fullName: "alice/stale" }], nextCursor: null });
    await Promise.resolve();
    expect(screen.queryByRole("option", { name: "alice/stale" })).not.toBeInTheDocument();
  });
});
