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
