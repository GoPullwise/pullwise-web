import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "./dashboard.jsx";

vi.mock("../lib/pullwise-data.js", () => ({
  useIssues: vi.fn(),
  useRepositories: vi.fn(),
  useScans: vi.fn(),
}));

import { useIssues, useRepositories, useScans } from "../lib/pullwise-data.js";

describe("DashboardScreen issue list", () => {
  it("labels the dashboard as a workspace overview instead of a specific repo", async () => {
    const go = vi.fn();
    useIssues.mockReturnValue({ items: [], loading: false, error: "" });
    useRepositories.mockReturnValue({
      items: [{ id: "repo_1", name: "api", fullName: "acme/api", private: true }],
      workspace: { name: "Acme" },
      loading: false,
      needsAuthorization: false,
    });
    useScans.mockReturnValue({
      items: [{ id: "scan_1", repo: "acme/api", branch: "main", commit: "abc123", time: "now" }],
      loading: false,
    });

    render(<DashboardScreen go={go} layout="list" setIssue={vi.fn()} accent="#6366f1" />);

    expect(screen.getByRole("heading", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByText(/workspace-wide view for acme/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /repository access/i })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: /manage/i }));
    expect(go).toHaveBeenCalledWith("repos");
    expect(screen.getByLabelText(/breadcrumbs/i)).not.toHaveTextContent("acme/api");
  });

  it("opens a dashboard issue row with keyboard activation", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    const setIssue = vi.fn();
    const issue = {
      id: "f_123",
      repo: "acme/api",
      severity: "high",
      category: "Security",
      title: "Validate redirect targets",
      file: "src/auth.py",
      line: 42,
      confidence: 0.91,
      effort: "S",
      status: "open",
    };
    useIssues.mockReturnValue({ items: [issue], loading: false, error: "" });
    useRepositories.mockReturnValue({
      items: [],
      loading: false,
      needsAuthorization: false,
    });
    useScans.mockReturnValue({ items: [], loading: false });

    render(<DashboardScreen go={go} layout="list" setIssue={setIssue} accent="#6366f1" />);

    const openIssue = screen.getByRole("button", { name: /open issue f_123/i });
    openIssue.focus();
    await user.keyboard("{Enter}");

    expect(setIssue).toHaveBeenCalledWith(issue);
    expect(go).toHaveBeenCalledWith("issue");

    setIssue.mockClear();
    go.mockClear();
    await user.keyboard(" ");

    expect(setIssue).toHaveBeenCalledWith(issue);
    expect(go).toHaveBeenCalledWith("issue");
  });
});
