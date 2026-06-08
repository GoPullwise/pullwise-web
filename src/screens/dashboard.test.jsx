import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "./dashboard.jsx";

vi.mock("../lib/pullwise-data.js", () => ({
  useIssues: vi.fn(),
  useRepositories: vi.fn(),
  useScans: vi.fn(),
}));

import { useIssues, useRepositories, useScans } from "../lib/pullwise-data.js";

describe("DashboardScreen issue list", () => {
  it("labels the dashboard as an account overview with real page-jump links", async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    useIssues.mockReturnValue({
      items: [
        {
          id: "f_1",
          repo: "acme/api",
          severity: "high",
          category: "Security",
          title: "Test issue",
          file: "src/test.js",
          line: 10,
          confidence: 0.9,
          effort: "S",
          status: "open",
        },
      ],
      loading: false,
      error: "",
    });
    useRepositories.mockReturnValue({
      items: [{ id: "repo_1", name: "api", fullName: "acme/api", private: true }],
      loading: false,
      needsAuthorization: false,
    });
    useScans.mockReturnValue({
      items: [{ id: "scan_1", repo: "acme/api", branch: "main", commit: "abc123", time: "now" }],
      loading: false,
    });

    render(<DashboardScreen go={go} layout="list" setIssue={vi.fn()} accent="#6366f1" />);

    expect(screen.getByRole("heading", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByText(/account overview/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /connected repositories/i })).toBeInTheDocument();

    const newScan = screen.getByRole("link", { name: /new scan/i });
    expect(newScan).toHaveAttribute("href", "/repos");

    const allIssues = screen.getAllByRole("link", { name: /all issues/i });
    allIssues.forEach((link) => {
      expect(link).toHaveAttribute("href", "/issues");
    });

    await user.click(newScan);
    expect(go).toHaveBeenCalledWith("repos");
  });

  it("keeps overview KPI sparklines aligned across all cards", () => {
    useIssues.mockReturnValue({ items: [], loading: false, error: "" });
    useRepositories.mockReturnValue({
      items: [{ id: "repo_1", name: "api", fullName: "acme/api", private: true }],
      loading: false,
      needsAuthorization: false,
    });
    useScans.mockReturnValue({
      items: [{ id: "scan_1", repo: "acme/api", branch: "main", commit: "abc123", time: "now" }],
      loading: false,
    });

    const { container } = render(
      <DashboardScreen go={vi.fn()} layout="list" setIssue={vi.fn()} accent="#6366f1" />
    );

    const kpis = Array.from(container.querySelectorAll(".kpi"));
    expect(kpis).toHaveLength(4);
    kpis.forEach((kpi) => {
      expect(kpi.querySelectorAll(".kpi-foot")).toHaveLength(1);
      const chart = kpi.querySelector(".kpi-chart");
      expect(chart).toBeInTheDocument();
      expect(chart.querySelector("svg")).toHaveStyle({ height: "20px" });
    });
  });

  it("shows a topbar loading spinner only while dashboard data is loading", () => {
    useIssues.mockReturnValue({ items: [], loading: true, error: "" });
    useRepositories.mockReturnValue({
      items: [],
      loading: false,
      needsAuthorization: false,
    });
    useScans.mockReturnValue({ items: [], loading: false });

    const { rerender } = render(
      <DashboardScreen go={vi.fn()} layout="list" setIssue={vi.fn()} accent="#6366f1" />
    );

    expect(screen.getByRole("status", { name: /^loading$/i })).toHaveClass(
      "topbar-loading",
      "spin"
    );

    useIssues.mockReturnValue({ items: [], loading: false, error: "" });
    rerender(<DashboardScreen go={vi.fn()} layout="list" setIssue={vi.fn()} accent="#6366f1" />);

    expect(screen.queryByRole("status", { name: /^loading$/i })).not.toBeInTheDocument();
  });

  it("pins KPI footnote text to a fixed slot above the sparkline", () => {
    const appCss = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");

    expect(appCss).toMatch(/grid-template-rows:\s*20px 39px 32px 20px;/);
    expect(appCss).not.toMatch(/grid-template-rows:\s*auto auto 32px 20px;/);
    expect(appCss).toMatch(/\.kpi-h\s*\{[^}]*margin-bottom:\s*0;/s);
    expect(appCss).toMatch(/\.kpi-v\s*\{[^}]*margin-bottom:\s*0;/s);
    expect(appCss).toMatch(/\.kpi-v\s*\{[^}]*white-space:\s*nowrap;/s);
    expect(appCss).toMatch(/\.kpi-foot\s*\{[^}]*align-self:\s*end;/s);
    expect(appCss).toMatch(/\.kpi-foot\s*\{[^}]*line-height:\s*16px;/s);
    expect(appCss).toMatch(/\.kpi-foot\s*\{[^}]*max-height:\s*32px;/s);
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

    const openIssue = screen.getByRole("button", { name: /validate redirect targets/i });
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
