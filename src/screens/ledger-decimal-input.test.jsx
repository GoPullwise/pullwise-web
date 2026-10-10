import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LedgerScreen } from "./ledger.jsx";

function fixture(mode = "shared") {
  const projectId = "prj_decimal";
  const target = mode === "project" ? { kind: "project", projectId } : { kind: "shared" };
  const project = {
    id: projectId, name: "Hosting", status: "active", revision: 1,
    githubAccess: "not_linked", githubRepoIds: [], repositories: [],
    canCreateExpense: true, totals: [],
  };
  const rule = {
    id: "rul_decimal", target, amount: "12.00", currency: "USD", categoryId: "cat_decimal",
    purpose: "Monthly hosting", quantity: "1.0001", unit: "hours", revision: 1,
    status: "active", schedule: { frequency: "monthly", day: 10, startOn: "2026-10-10", timezone: "UTC" },
  };
  const api = {
    project: vi.fn().mockResolvedValue(project),
    projects: vi.fn().mockResolvedValue({ items: [project], nextCursor: null }),
    categories: vi.fn().mockResolvedValue([{ id: "cat_decimal", name: "Hosting", archivedAt: null }]),
    expenses: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    recurringRules: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    createExpense: vi.fn().mockResolvedValue({ id: "exp_decimal", categoryId: "cat_decimal" }),
    createRecurringRule: vi.fn().mockResolvedValue(rule),
    updateRecurringRule: vi.fn().mockResolvedValue({ ...rule, revision: 2 }),
    reportTimeseries: vi.fn().mockResolvedValue({ groups: [] }),
    reportCategories: vi.fn().mockResolvedValue({ groups: [] }),
  };
  return { api, projectId, target, rule };
}

async function openExpense(mode = "shared") {
  const data = fixture(mode);
  render(<LedgerScreen api={data.api} go={vi.fn()} mode={mode} projectId={data.projectId} />);
  fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
  fireEvent.change(screen.getByLabelText("Paid on"), { target: { value: "2026-10-10" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "cat_decimal" } });
  fireEvent.change(screen.getByLabelText("What did you pay for?"), { target: { value: "Hosting" } });
  return data;
}

describe("expense decimal keyboard input", () => {
  it.each(["project", "shared"])("sends exact comma decimals for %s expenses", async (mode) => {
    const { api, target } = await openExpense(mode);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12345678901234,50" } });
    fireEvent.click(screen.getByText("More details (optional)", { selector: "summary" }));
    fireEvent.change(screen.getByLabelText("Quantity (optional)"), { target: { value: "1,25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.calls[0][0]).toMatchObject({
      target, amount: "12345678901234.50", quantity: "1.25",
    });
  });

  it.each([
    ["Amount", "1,234", /Enter an amount/],
    ["Amount", "1,234.50", /Enter an amount/],
    ["Quantity (optional)", "1,234", /Enter a quantity/],
    ["Quantity (optional)", "12,0000", /Enter a quantity/],
  ])("blocks ambiguous %s input %s before writing and keeps the draft", async (label, value, error) => {
    const { api } = await openExpense();
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.50" } });
    const details = screen.getByText("More details (optional)", { selector: "summary" }).parentElement;
    if (label !== "Amount") {
      fireEvent.click(details.querySelector("summary"));
    }
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value } });
    if (label !== "Amount") details.open = false;
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    expect(api.createExpense).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(input).toHaveValue(value);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    if (label !== "Amount") expect(details).toHaveAttribute("open");
    expect(screen.getByLabelText("What did you pay for?")).toHaveValue("Hosting");
    fireEvent.change(input, { target: { value: "1234.0000" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }));
    await waitFor(() => expect(api.createExpense).toHaveBeenCalledTimes(1));
    expect(api.createExpense.mock.calls[0][0][label === "Amount" ? "amount" : "quantity"])
      .toBe("1234.0000");
  });

  it("uses the same exact normalization when editing a recurring schedule", async () => {
    const { api, projectId, target, rule } = fixture("project");
    api.recurringRules.mockResolvedValue({ items: [rule], nextCursor: null });
    render(<LedgerScreen api={api} go={vi.fn()} mode="project" projectId={projectId} />);
    const row = (await screen.findByRole("heading", { name: rule.purpose })).closest("article");
    fireEvent.click(within(row).getByRole("button", { name: "Edit schedule" }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12,50" } });
    fireEvent.change(screen.getByLabelText("Quantity (optional)"), {
      target: { value: "0.00000012345678901234567890" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(api.updateRecurringRule).toHaveBeenCalledTimes(1));
    expect(api.updateRecurringRule.mock.calls[0][2]).toMatchObject({
      target, amount: "12.50", quantity: "0.00000012345678901234567890",
    });
  });
});
