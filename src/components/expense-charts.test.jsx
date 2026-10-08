import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseCharts } from "./expense-charts.jsx";

function minorAmount(value) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value);
  return null;
}

function formatTotal(row) {
  const value = minorAmount(row.amountMinor);
  const divisor = row.currency === "JPY" ? 1n : 100n;
  const whole = (value / divisor).toLocaleString("en");
  const fraction = divisor === 1n ? "" : `.${(value % divisor).toString().padStart(2, "0")}`;
  return `${row.currency} ${whole}${fraction}`;
}

function fixture(props = {}) {
  return (
    <ExpenseCharts
      title="Expenses over time"
      dimension="bucket"
      formatTotal={formatTotal}
      minorAmount={minorAmount}
      {...props}
    />
  );
}

function chart(currency) {
  return screen.getByRole("group", { name: `Expenses over time · ${currency}` }).closest("figure");
}

function readout(currency) {
  return chart(currency).querySelector(".expense-chart-readout");
}

function points(currency) {
  return within(chart(currency)).getAllByRole("button");
}

function movePointer(node, clientX, pointerType = "mouse") {
  const event = new MouseEvent("pointermove", { bubbles: true, clientX });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(node, event);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ExpenseCharts", () => {
  it("places chronological dates at their real calendar distances without inserting dates", () => {
    render(
      fixture({
        groups: [
          { bucket: "2026-10-04", currency: "USD", amountMinor: "0" },
          { bucket: "2026-10-01", currency: "USD", amountMinor: "400" },
          { bucket: "2026-10-02", currency: "USD", amountMinor: "200" },
        ],
      })
    );
    const marks = points("USD");
    expect(marks.map((mark) => mark.dataset.label)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-04",
    ]);
    expect(marks.map((mark) => Number(mark.dataset.x))).toEqual([12, 204, 588]);
    expect(marks.map((mark) => Number(mark.dataset.y))).toEqual([12, 100, 188]);
    expect(readout("USD")).toHaveTextContent("2026-10-04USD 0.00");
    expect(chart("USD").querySelector(".expense-chart-line")).toHaveAttribute(
      "points",
      "12,12 204,100 588,188"
    );
    expect(chart("USD").querySelector(".expense-chart-area")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("scales currencies separately and preserves the caller's exact monetary values", () => {
    const groups = [
      { bucket: "2026-10-01", currency: "USD", amountMinor: "200" },
      { bucket: "2026-10-02", currency: "JPY", amountMinor: "25000" },
      { bucket: "2026-10-01", currency: "JPY", amountMinor: "100000" },
      { bucket: "2026-10-02", currency: "USD", amountMinor: "100" },
    ];
    const formatter = vi.fn(formatTotal);
    render(fixture({ groups, formatTotal: formatter }));
    expect(points("USD").map((mark) => Number(mark.dataset.y))).toEqual([12, 100]);
    expect(points("JPY").map((mark) => Number(mark.dataset.y))).toEqual([12, 144]);
    expect(readout("USD")).toHaveTextContent("USD 1.00");
    expect(readout("JPY")).toHaveTextContent("JPY 25,000");
    expect(formatter.mock.calls.every(([row]) => groups.includes(row))).toBe(true);
  });

  it("keeps huge integer amounts complete and natively selectable while only scaling coordinates", () => {
    render(
      fixture({
        groups: [
          {
            bucket: "2026-10-01",
            currency: "USD",
            amountMinor: "900719925474099312345678901",
          },
          {
            bucket: "2026-10-02",
            currency: "USD",
            amountMinor: "1801439850948198624691357802",
          },
        ],
      })
    );
    expect(points("USD").map((mark) => Number(mark.dataset.y))).toEqual([100, 12]);
    fireEvent.click(points("USD")[0]);
    const money = readout("USD").querySelector(".financial-value");
    expect(money.textContent).toBe("USD 9,007,199,254,740,993,123,456,789.01");
    const range = document.createRange();
    range.selectNodeContents(money);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.toString()).toBe("USD 9,007,199,254,740,993,123,456,789.01");
    selection.removeAllRanges();
  });

  it("supports one roving focus stop, keyboard boundaries and exact selected readouts", () => {
    render(
      fixture({
        groups: [
          { bucket: "2026-10-01", currency: "USD", amountMinor: "100" },
          { bucket: "2026-10-02", currency: "USD", amountMinor: "200" },
          { bucket: "2026-10-03", currency: "USD", amountMinor: "300" },
        ],
      })
    );
    const marks = points("USD");
    expect(marks.map((mark) => mark.getAttribute("tabindex"))).toEqual(["-1", "-1", "0"]);
    act(() => marks[2].focus());
    expect(document.activeElement).toBe(marks[2]);
    fireEvent.keyDown(marks[2], { key: "Home" });
    expect(document.activeElement).toBe(marks[0]);
    expect(readout("USD")).toHaveTextContent("2026-10-01USD 1.00");
    fireEvent.keyDown(marks[0], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(marks[0]);
    fireEvent.keyDown(marks[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(marks[1]);
    expect(readout("USD")).toHaveTextContent("2026-10-02USD 2.00");
    fireEvent.keyDown(marks[1], { key: "End" });
    expect(document.activeElement).toBe(marks[2]);
    fireEvent.keyDown(marks[2], { key: "ArrowUp" });
    expect(document.activeElement).toBe(marks[2]);
    expect(marks.filter((mark) => mark.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(marks[2]).toHaveAttribute("aria-pressed", "true");
  });

  it("inspects points on hover, direct touch-style clicks and clicks across the plot", () => {
    render(
      fixture({
        groups: [
          { bucket: "2026-10-01", currency: "USD", amountMinor: "100" },
          { bucket: "2026-10-02", currency: "USD", amountMinor: "200" },
          { bucket: "2026-10-03", currency: "USD", amountMinor: "300" },
        ],
      })
    );
    const marks = points("USD");
    const plot = screen.getByRole("group", { name: "Expenses over time · USD" });
    vi.spyOn(plot, "getBoundingClientRect").mockReturnValue({ left: 100, width: 600 });
    movePointer(plot, 112);
    expect(readout("USD")).toHaveTextContent("2026-10-01USD 1.00");
    fireEvent.click(marks[1]);
    expect(readout("USD")).toHaveTextContent("2026-10-02USD 2.00");
    fireEvent.click(plot, { clientX: 690 });
    expect(readout("USD")).toHaveTextContent("2026-10-03USD 3.00");
  });

  it("keeps a touch-selected zero point when compatibility mouse-enter events follow", () => {
    render(
      fixture({
        dimension: "category",
        categories: [{ id: "ai", name: "AI tools" }],
        groups: [
          { categoryId: "ai", currency: "USD", amountMinor: "200" },
          { categoryId: "archived", currency: "USD", amountMinor: "0" },
        ],
      })
    );
    const marks = points("USD");
    const plot = screen.getByRole("group", { name: "Expenses over time · USD" });
    vi.spyOn(plot, "getBoundingClientRect").mockReturnValue({ left: 100, width: 600 });
    fireEvent.click(marks[1]);
    expect(readout("USD")).toHaveTextContent("Archived categoryUSD 0.00");
    fireEvent.mouseOver(marks[0]);
    fireEvent.mouseEnter(marks[0]);
    expect(readout("USD")).toHaveTextContent("Archived categoryUSD 0.00");
    expect(marks[1]).toHaveAttribute("aria-pressed", "true");
    movePointer(plot, 112, "touch");
    expect(readout("USD")).toHaveTextContent("Archived categoryUSD 0.00");
    movePointer(plot, 112, "mouse");
    expect(readout("USD")).toHaveTextContent("AI toolsUSD 2.00");
    expect(marks[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("renders category bars with exact relative heights and complete selected category labels", () => {
    const longName = "International infrastructure, deployment and observability services";
    render(
      fixture({
        dimension: "category",
        categories: [
          { id: "cat_a", name: longName },
          { id: "cat_b", name: "Hosting" },
          { id: "cat_c", name: "Storage" },
        ],
        groups: [
          { categoryId: "cat_a", currency: "USD", amountMinor: "100" },
          { categoryId: "cat_c", currency: "USD", amountMinor: "0" },
          { categoryId: "cat_b", currency: "USD", amountMinor: "400" },
        ],
      })
    );
    const marks = points("USD");
    expect(marks.map((mark) => mark.dataset.label)).toEqual(["Hosting", longName, "Storage"]);
    expect(
      [...chart("USD").querySelectorAll(".expense-chart-bar")].map((bar) =>
        Number(bar.getAttribute("height"))
      )
    ).toEqual([176, 44, 0]);
    expect(readout("USD")).toHaveTextContent("HostingUSD 4.00");
    fireEvent.click(marks[1]);
    expect(readout("USD").querySelector(".expense-chart-selected-label").textContent).toBe(
      longName
    );
    expect(readout("USD")).toHaveTextContent("USD 1.00");
    expect(chart("USD").querySelectorAll(".expense-chart-zero")).toHaveLength(1);
  });

  it("uses an archived category fallback without inventing a category or amount", () => {
    render(
      fixture({
        dimension: "category",
        groups: [{ categoryId: "removed", currency: "USD", amountMinor: "123" }],
      })
    );
    expect(readout("USD")).toHaveTextContent("Archived categoryUSD 1.23");
    expect(points("USD")[0]).toHaveAttribute("data-amount-minor", "123");
  });

  it("shows a single trend datum without a fabricated line or filled time range", () => {
    render(fixture({ groups: [{ bucket: "2026-10-01", currency: "USD", amountMinor: 0 }] }));
    expect(points("USD")).toHaveLength(1);
    expect(points("USD")[0]).toHaveAttribute("data-x", "300");
    expect(points("USD")[0]).toHaveAttribute("data-y", "188");
    expect(chart("USD").querySelector(".expense-chart-line")).not.toBeInTheDocument();
    expect(chart("USD").querySelector(".expense-chart-area")).not.toBeInTheDocument();
    expect(readout("USD")).toHaveTextContent("USD 0.00");
  });

  it("keeps all-zero series at the baseline without division by zero or positive bars", () => {
    const { rerender } = render(
      fixture({
        groups: [
          { bucket: "2026-10-01", currency: "USD", amountMinor: "0" },
          { bucket: "2026-10-02", currency: "USD", amountMinor: "0" },
        ],
      })
    );
    expect(points("USD").map((mark) => mark.dataset.y)).toEqual(["188", "188"]);
    expect(chart("USD").querySelector(".expense-chart-area")).not.toBeInTheDocument();
    rerender(
      fixture({
        dimension: "category",
        groups: [
          { categoryId: "a", currency: "USD", amountMinor: "0" },
          { categoryId: "b", currency: "USD", amountMinor: "0" },
        ],
      })
    );
    expect(
      [...chart("USD").querySelectorAll(".expense-chart-bar")].map((bar) =>
        bar.getAttribute("height")
      )
    ).toEqual(["0", "0"]);
    expect(chart("USD").querySelectorAll(".expense-chart-zero")).toHaveLength(2);
    expect(chart("USD").innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("keeps subpixel positive values inspectable and distinct from actual zero", () => {
    render(
      fixture({
        dimension: "category",
        categories: [
          { id: "large", name: "Infrastructure" },
          { id: "small", name: "Small purchase" },
          { id: "zero", name: "No charge" },
        ],
        groups: [
          {
            categoryId: "large",
            currency: "USD",
            amountMinor: "10000000000000000000000000000000000000000",
          },
          { categoryId: "small", currency: "USD", amountMinor: "1" },
          { categoryId: "zero", currency: "USD", amountMinor: "0" },
        ],
      })
    );
    const marks = points("USD");
    expect(marks[1]).toHaveAttribute("data-y", "188");
    expect(marks[1].querySelector(".expense-chart-hit")).toHaveAttribute("height", "200");
    expect(marks[1].querySelector(".expense-chart-zero")).not.toBeInTheDocument();
    fireEvent.click(marks[1]);
    expect(readout("USD")).toHaveTextContent("Small purchaseUSD 0.01");
    act(() => marks[1].focus());
    fireEvent.keyDown(marks[1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(marks[2]);
    expect(readout("USD")).toHaveTextContent("No chargeUSD 0.00");
  });

  it("rejects malformed amounts and dates instead of drawing them as zero", () => {
    render(
      fixture({
        groups: [
          { bucket: "2026-10-01", currency: "USD", amountMinor: "100" },
          { bucket: "2026-10-02", currency: "USD", amountMinor: Number.MAX_SAFE_INTEGER + 1 },
          { bucket: "2026-10-03", currency: "USD", amountMinor: "01" },
          { bucket: "2026-10-04", currency: "USD", amountMinor: "-1" },
          { bucket: "2026-02-30", currency: "USD", amountMinor: "200" },
          { bucket: "2026-10-05", currency: "", amountMinor: "300" },
        ],
      })
    );
    expect(points("USD")).toHaveLength(1);
    expect(readout("USD")).toHaveTextContent("USD 1.00");
    expect(screen.getByRole("status")).toHaveTextContent("Some report amounts are unavailable.");
    expect(chart("USD").innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("distinguishes absent records from unavailable amounts and creates no fake chart", () => {
    const { rerender } = render(fixture({ groups: [] }));
    expect(screen.getByText("No expenses in this range.")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    rerender(
      fixture({ groups: [{ bucket: "2026-10-01", currency: "USD", amountMinor: "invalid" }] })
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByText("USD 0.00")).not.toBeInTheDocument();
  });

  it("retains a selected date through reordered refreshes and returns to the latest when removed", () => {
    const first = { bucket: "2026-10-01", currency: "USD", amountMinor: "100" };
    const second = { bucket: "2026-10-02", currency: "USD", amountMinor: "200" };
    const third = { bucket: "2026-10-03", currency: "USD", amountMinor: "300" };
    const { rerender } = render(fixture({ groups: [first, second, third] }));
    fireEvent.click(points("USD")[0]);
    rerender(fixture({ groups: [third, second, { ...first, amountMinor: "400" }] }));
    expect(readout("USD")).toHaveTextContent("2026-10-01USD 4.00");
    rerender(fixture({ groups: [second, third] }));
    expect(readout("USD")).toHaveTextContent("2026-10-03USD 3.00");
    expect(points("USD").filter((point) => point.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("reflows geometry to its actual container width and disconnects its observer", () => {
    let width = 320;
    let onResize;
    const disconnect = vi.fn();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ width }));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback) {
          onResize = callback;
        }
        observe() {}
        disconnect() {
          disconnect();
        }
      }
    );
    const { unmount } = render(
      fixture({ groups: [{ bucket: "2026-10-01", currency: "USD", amountMinor: "100" }] })
    );
    expect(points("USD")[0]).toHaveAttribute("data-x", "160");
    width = 0;
    act(() => onResize());
    expect(points("USD")[0]).toHaveAttribute("data-x", "160");
    width = 280;
    act(() => onResize());
    expect(points("USD")[0]).toHaveAttribute("data-x", "140");
    expect(screen.getByRole("group", { name: "Expenses over time · USD" })).toHaveAttribute(
      "viewBox",
      "0 0 280 200"
    );
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
