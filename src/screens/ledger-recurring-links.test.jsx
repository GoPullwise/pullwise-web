import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { LedgerScreen } from "./ledger.jsx";

const project = (fields = {}) => ({
  id: "prj_one",
  name: "Operating costs",
  description: "Local services",
  status: "active",
  githubRepoIds: [],
  repositories: [],
  githubOrganizationId: null,
  githubOrganization: null,
  githubAccess: "not_linked",
  canCreateExpense: true,
  developmentUrl: null,
  productUrl: null,
  revision: 7,
  totals: [],
  ...fields,
});
const rule = (fields = {}) => ({
  id: "rul_one",
  target: { kind: "shared" },
  amount: "12.50",
  currency: "USD",
  categoryId: "cat_one",
  purpose: "Scheduled hosting",
  note: null,
  quantity: null,
  unit: null,
  schedule: {
    frequency: "monthly",
    day: 31,
    timezone: "Europe/Paris",
    startOn: "2026-10-08",
    endOn: null,
  },
  status: "active",
  revision: 2,
  nextOccurrenceOn: "2026-10-31",
  nextRunAt: 1793397600,
  blockedCode: null,
  ...fields,
});
function client(current = project()) {
  return {
    me: vi.fn().mockResolvedValue({ entitlements: { jev: { eligible: true, available: true } } }),
    projects: vi.fn().mockResolvedValue({ items: [current], nextCursor: null }),
    project: vi.fn().mockResolvedValue(current),
    categories: vi.fn().mockResolvedValue([{ id: "cat_one", name: "Hosting", archivedAt: null }]),
    expenses: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createRecurringRule: vi.fn().mockResolvedValue(rule()),
    updateRecurringRule: vi.fn(),
    removeRecurringRule: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    removeExpense: vi.fn(),
    createProject: vi.fn().mockResolvedValue(project({ id: "prj_new" })),
    updateProject: vi.fn().mockResolvedValue(current),
    repositories: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportSummary: vi.fn().mockResolvedValue({ groups: [] }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
  };
}
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
async function settings(api) {
  render(<LedgerScreen api={api} go={vi.fn()} mode="project" projectId="prj_one" />);
  fireEvent.click(await screen.findByRole("tab", { name: "Project settings" }));
}
async function recurring(api, mode = "shared") {
  render(
    <LedgerScreen
      api={api}
      go={vi.fn()}
      mode={mode}
      projectId={mode === "project" ? "prj_one" : ""}
    />
  );
  fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
  await waitFor(() => expect(screen.getByLabelText("Category")).not.toBeRequired());
  change("Expense type", "recurring");
  change("Start date (on or after)", "2026-10-08");
  change("Amount", "12.50");
  change("What did you pay for?", "Scheduled hosting");
  change("Time zone", "Europe/Paris");
}

describe("Project links in the real ledger views", () => {
  it.each(["projects", "project"])(
    "keeps %s data links explicitly selectable without turning a selection into navigation",
    async (mode) => {
      const styles = readFileSync("src/screens/ledger.css", "utf8");
      const rule = styles.match(
        /\.ledger-project-links > a,\s*\.ledger-row-main h2 > a\s*\{[^}]*\}/
      )?.[0];
      expect(rule).toBeTruthy();
      const stylesheet = document.createElement("style");
      stylesheet.textContent = rule;
      document.head.append(stylesheet);
      const selection = document.getSelection();
      try {
        const current = project({
          developmentUrl: "https://dev.example.com/",
          productUrl: "https://product.example.com/",
        });
        const go = vi.fn();
        const view = render(
          <LedgerScreen api={client(current)} go={go} mode={mode} projectId="prj_one" />
        );
        await screen.findByRole("link", { name: "Development" });
        const links = view.container.querySelectorAll(
          ".ledger-project-links > a, .ledger-row-main h2 > a"
        );
        expect(links).toHaveLength(mode === "projects" ? 3 : 2);
        for (const link of links) {
          expect(getComputedStyle(link).userSelect).toBe("text");
          expect(link).toHaveAttribute("draggable", "false");
        }
        if (mode === "projects") {
          const entry = screen.getByRole("link", { name: current.name });
          const range = document.createRange();
          range.selectNodeContents(entry);
          selection.removeAllRanges();
          selection.addRange(range);
          fireEvent.click(entry, { detail: 1 });
          expect(selection.toString()).toBe(current.name);
          expect(go).not.toHaveBeenCalled();
          selection.removeAllRanges();
          fireEvent.click(entry, { detail: 1 });
          expect(go).toHaveBeenCalledExactlyOnceWith("ledgerProject", { id: "prj_one" });
        }
      } finally {
        selection.removeAllRanges();
        stylesheet.remove();
      }
    }
  );

  it("keeps project entry and safe external links separate, and does not expose lost GitHub names", async () => {
    const linked = project({
      githubRepoIds: [202, 303, 303],
      repositories: [
        { githubRepoId: 202, githubAccess: "lost", githubFullName: "secret/private" },
        { githubRepoId: 303, githubAccess: "authorized", githubFullName: "team/service" },
      ],
      githubOrganization: { id: 8, login: "team", githubAccess: "authorized" },
      githubAccess: "partial",
      developmentUrl: "https://dev.example.com/",
      productUrl: "https://product.example.com/",
    });
    const api = client(linked);
    const go = vi.fn();
    render(<LedgerScreen api={api} go={go} mode="projects" />);
    const entry = await screen.findByRole("link", { name: linked.name });
    const row = entry.closest("article");
    expect(row).toHaveClass("ledger-project-row");
    expect(row.querySelector("a a")).toBeNull();
    expect(entry).toHaveAttribute("href", "/projects/prj_one");
    expect(entry).toHaveAttribute("draggable", "false");
    expect(within(row).getByText("2 repositories", { selector: "summary" })).toBeVisible();
    fireEvent.click(within(row).getByText("2 repositories", { selector: "summary" }));
    expect(within(row).getByText("Repository #202")).toBeVisible();
    expect(within(row).getByRole("link", { name: "team/service" })).toHaveAttribute(
      "href",
      "https://github.com/team/service"
    );
    expect(within(row).getByRole("link", { name: "team" })).toHaveAttribute(
      "href",
      "https://github.com/team"
    );
    expect(screen.queryByText("secret/private")).not.toBeInTheDocument();
    expect(within(row).queryByRole("link", { name: "Development" })).not.toBeInTheDocument();
    const productLink = within(row).getByRole("link", { name: "Product" });
    expect(productLink).toHaveAttribute("target", "_blank");
    expect(productLink).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(productLink);
    expect(go).not.toHaveBeenCalled();
    fireEvent.click(entry);
    expect(go).toHaveBeenCalledExactlyOnceWith("ledgerProject", { id: "prj_one" });
  });

  it("shows manual development links only for truly unlinked projects and refuses unsafe stored URLs", async () => {
    const unlinked = project({
      developmentUrl: "http://localhost:3000/app",
      productUrl: "javascript:alert(1)",
    });
    const api = client(unlinked);
    render(<LedgerScreen api={api} go={vi.fn()} mode="projects" />);
    const row = (await screen.findByRole("link", { name: unlinked.name })).closest("article");
    expect(within(row).getByRole("link", { name: "Development" })).toHaveAttribute(
      "href",
      "http://localhost:3000/app"
    );
    expect(within(row).queryByRole("link", { name: "Product" })).not.toBeInTheDocument();
  });

  it("normalizes optional links on creation without requiring GitHub association", async () => {
    const api = client();
    const go = vi.fn();
    render(<LedgerScreen api={api} go={go} mode="projects" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add project" }));
    change("Project name", "New service");
    fireEvent.click(screen.getByText("Project links (optional)", { selector: "summary" }));
    change("Development URL (optional)", "localhost:3000/app");
    change("Product URL (optional)", "example.com/product");
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledTimes(1));
    expect(api.createProject.mock.calls[0][0]).toEqual({
      name: "New service",
      description: "",
      githubRepoIds: [],
      developmentUrl: "https://localhost:3000/app",
      productUrl: "https://example.com/product",
    });
    expect(api.repositories).not.toHaveBeenCalled();
    await waitFor(() => expect(go).toHaveBeenCalledWith("ledgerProject", { id: "prj_new" }));
  });

  it("sends null to clear a link and omits an unchanged link with the captured settings revision", async () => {
    const api = client(
      project({
        developmentUrl: "https://dev.example.com/",
        productUrl: "https://app.example.com/",
      })
    );
    await settings(api);
    change("Development URL (optional)", "");
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    await waitFor(() => expect(api.updateProject).toHaveBeenCalledTimes(1));
    expect(api.updateProject).toHaveBeenCalledWith(
      "prj_one",
      7,
      { description: "Local services", developmentUrl: null },
      {}
    );
  });

  it("keeps a rejected URL draft locally without dispatching a project write", async () => {
    const api = client();
    await settings(api);
    change("Product URL (optional)", "https://user:password@example.com/");
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(await screen.findByText("Invalid project URL.")).toBeVisible();
    expect(screen.getByLabelText("Product URL (optional)")).toHaveValue(
      "https://user:password@example.com/"
    );
    expect(api.updateProject).not.toHaveBeenCalled();
  });
});

describe("Recurring entry in project and shared expenses", () => {
  it.each([
    ["weekly", { weekday: 2 }],
    ["monthly", { day: 31 }],
    ["quarterly", { day: 31, quarterMonth: 2 }],
    ["yearly", { day: 31, month: 12 }],
  ])(
    "sends only %s calendar conditions, exact amounts and explicit category",
    async (frequency, conditions) => {
      const api = client();
      await recurring(api);
      change("Frequency", frequency);
      expect(screen.getByLabelText("Category")).toBeRequired();
      fireEvent.submit(screen.getByLabelText("Amount").closest("form"));
      expect(api.createRecurringRule).not.toHaveBeenCalled();
      change("Category", "cat_one");
      if (frequency === "weekly") change("Weekday", "2");
      else change("Day of month", "31");
      if (frequency === "quarterly") {
        change("Month of quarter", "2");
        expect(
          screen.getByText("Quarterly dates use the selected month in each calendar quarter.")
        ).toBeVisible();
      }
      if (frequency === "yearly") change("Month of year", "12");
      change("End date (optional)", "2027-12-31");
      fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
      await waitFor(() => expect(api.createRecurringRule).toHaveBeenCalledTimes(1));
      expect(api.createRecurringRule.mock.calls[0][0]).toEqual({
        target: { kind: "shared" },
        amount: "12.50",
        currency: "USD",
        categoryId: "cat_one",
        purpose: "Scheduled hosting",
        note: null,
        quantity: null,
        unit: null,
        schedule: {
          frequency,
          ...conditions,
          timezone: "Europe/Paris",
          startOn: "2026-10-08",
          endOn: "2027-12-31",
        },
      });
      expect(api.createRecurringRule.mock.calls[0][1]).toMatch(/^[a-f0-9]{32}$/);
      expect(api.createExpense).not.toHaveBeenCalled();
      expect(api.updateExpense).not.toHaveBeenCalled();
    }
  );

  it("keeps the current project target and displays only the server's next date after saving", async () => {
    const api = client();
    api.createRecurringRule.mockResolvedValue(
      rule({ target: { kind: "project", projectId: "prj_one" }, nextOccurrenceOn: "2026-11-27" })
    );
    await recurring(api, "project");
    change("Category", "cat_one");
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(api.createRecurringRule).toHaveBeenCalledTimes(1));
    expect(api.createRecurringRule.mock.calls[0][0].target).toEqual({
      kind: "project",
      projectId: "prj_one",
    });
    expect(await screen.findByText("Schedule saved.: Scheduled hosting")).toBeVisible();
    expect(screen.getByText("Next occurrence: 2026-11-27")).toBeVisible();
    expect(screen.queryByLabelText("Project or shared cost")).not.toBeInTheDocument();
    expect(api.recurringRules).toHaveBeenCalledWith(
      { target: "project", projectId: "prj_one" },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("retains the full recurring draft and idempotency key when a request is retried unchanged", async () => {
    const api = client();
    api.createRecurringRule.mockRejectedValueOnce(new Error("Temporarily unavailable"));
    await recurring(api);
    change("Category", "cat_one");
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(await screen.findByText("Temporarily unavailable")).toBeVisible();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Scheduled hosting");
    expect(screen.getByLabelText("Time zone")).toHaveValue("Europe/Paris");
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(api.createRecurringRule).toHaveBeenCalledTimes(2));
    expect(api.createRecurringRule.mock.calls[0][1]).toEqual(
      api.createRecurringRule.mock.calls[1][1]
    );
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  it("edits a schedule through the shared form while preserving its target and revision", async () => {
    const api = client();
    const saved = rule({ status: "paused" });
    api.recurringRules.mockResolvedValue({ items: [saved], nextCursor: null });
    api.updateRecurringRule.mockImplementation(async (_id, _revision, fields) => ({
      ...saved,
      ...fields,
      revision: 3,
    }));
    render(<LedgerScreen api={api} go={vi.fn()} mode="shared" />);
    const row = (await screen.findByRole("heading", { name: saved.purpose })).closest("article");
    fireEvent.click(within(row).getByRole("button", { name: "Edit schedule" }));
    expect(screen.queryByLabelText("Expense type")).not.toBeInTheDocument();
    change("Start date (on or after)", "2026-11-01");
    change("What did you pay for?", "Updated schedule");
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(api.updateRecurringRule).toHaveBeenCalledTimes(1));
    const [id, revision, fields] = api.updateRecurringRule.mock.calls[0];
    expect([id, revision]).toEqual([saved.id, 2]);
    expect(fields).toMatchObject({
      target: { kind: "shared" },
      purpose: "Updated schedule",
      schedule: { startOn: "2026-11-01" },
    });
    expect(fields).not.toHaveProperty("occurredOn");
    expect(fields).not.toHaveProperty("status");
    expect(api.updateExpense).not.toHaveBeenCalled();
  });

  it("keeps loaded expenses and the recurring draft when the schedule allowance is reached", async () => {
    const api = client();
    api.expenses.mockResolvedValue({
      items: [
        {
          id: "exp_paid",
          target: { kind: "shared" },
          occurredOn: "2026-10-01",
          amount: "4.00",
          currency: "USD",
          categoryId: "cat_one",
          purpose: "Already paid",
          revision: 1,
        },
      ],
      nextCursor: null,
    });
    api.createRecurringRule.mockRejectedValue({
      status: 403,
      payload: { error: { code: "RECURRING_RULE_LIMIT" } },
    });
    const changed = vi.fn();
    render(<LedgerScreen api={api} go={vi.fn()} mode="shared" onAccessChanged={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    change("Expense type", "recurring");
    change("Start date (on or after)", "2026-10-08");
    change("Amount", "12.50");
    change("Category", "cat_one");
    change("What did you pay for?", "Planned hosting");
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(
      await screen.findByText(
        "Recurring schedule allowance reached. Existing schedules and expenses remain available."
      )
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Already paid" })).toBeVisible();
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Planned hosting");
    expect(changed).not.toHaveBeenCalled();
  });

  it("keeps a blocked rule readable when GitHub denies resume without invalidating the workspace", async () => {
    const api = client();
    const blockedRule = rule({
      target: { kind: "project", projectId: "prj_one" },
      status: "blocked",
      blockedCode: "GITHUB_ACCESS_REQUIRED",
    });
    api.recurringRules.mockResolvedValue({ items: [blockedRule], nextCursor: null });
    api.updateRecurringRule.mockRejectedValue({
      status: 403,
      payload: { error: { code: "GITHUB_ACCESS_REQUIRED" } },
    });
    const changed = vi.fn();
    render(
      <LedgerScreen
        api={api}
        go={vi.fn()}
        mode="project"
        projectId="prj_one"
        onAccessChanged={changed}
      />
    );
    const row = (await screen.findByRole("heading", { name: blockedRule.purpose })).closest(
      "article"
    );
    fireEvent.click(within(row).getByRole("button", { name: "Resume" }));
    expect(
      await screen.findByText("Recurring schedule could not be changed. Reload before retrying.")
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: blockedRule.purpose })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload recurring schedules" })).toBeEnabled();
    expect(changed).not.toHaveBeenCalled();
  });

  it("does not let a late recurring creation failure invalidate a different workspace", async () => {
    let reject;
    const api = client();
    api.createRecurringRule.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    );
    const changed = vi.fn();
    const permissions = { manageProjects: true, manageCategories: true, writeExpenses: true };
    const props = { api, go: vi.fn(), mode: "shared", onAccessChanged: changed };
    const view = render(
      <LedgerScreen {...props} workspace={{ id: "one", revision: 1, permissions }} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    change("Expense type", "recurring");
    change("Start date (on or after)", "2026-10-08");
    change("Amount", "12.50");
    change("Category", "cat_one");
    change("What did you pay for?", "Old workspace schedule");
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(api.createRecurringRule).toHaveBeenCalledTimes(1));
    view.rerender(<LedgerScreen {...props} workspace={{ id: "two", revision: 1, permissions }} />);
    await screen.findByRole("button", { name: "Add expense" });
    await act(async () => reject({ status: 403, payload: { error: { code: "ROLE_FORBIDDEN" } } }));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.queryByText("Old workspace schedule")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeEnabled();
  });
});
