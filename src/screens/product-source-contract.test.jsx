import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProductDetail, UpdateClassification } from "../components/product-detail.jsx";
import { productApi } from "../api/product.js";
import { setLang } from "../i18n.jsx";

// Opt in to the sibling checkout and its existing Python test environment.
// Ordinary Web-only CI does not install or reconstruct a Server environment.
it.skipIf(!process.env.PULLWISE_CONTRACT_PYTHON)("renders a fresh Server SQLite/REST source result without an Item", async () => {
  const server = resolve(process.cwd(), "../pullwise-server");
  const dto = JSON.parse(execFileSync(process.env.PULLWISE_CONTRACT_PYTHON,
    ["tests/export_source_contract.py"], { cwd: server, encoding: "utf8", timeout: 20000,
      env: { ...process.env, PYTHONPATH: server } }));
  setLang("en");
  const detail = vi.spyOn(productApi, "source").mockResolvedValue(dto.detail);
  try {
    expect(dto.detail.contexts[0].itemId).toBeNull();
    expect(dto.listing.items[0].contexts[0].assessments).toBeUndefined();
    const row = render(<UpdateClassification context={dto.listing.items[0].contexts[0]} />);
    expect(screen.getByText("Not relevant")).toBeVisible();
    row.unmount();
    render(<ProductDetail selection={{ kind: "source", id: dto.detail.id }} onClose={() => {}} onSaved={() => {}} onAccessLost={() => {}} />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByText(/Model assessment.*jev-1.13.0/));
    expect(within(dialog).getByText("u0_relevance · not_relevant")).toBeVisible();
    expect(within(dialog).getAllByText("Documentation update.")[0]).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "Mark done" })).toBeNull();
  } finally {
    detail.mockRestore();
  }
}, 30000);
