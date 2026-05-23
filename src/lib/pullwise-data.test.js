import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { useScans } from "./pullwise-data.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    scans: {
      list: vi.fn(),
    },
  },
}));

describe("useScans", () => {
  beforeEach(() => {
    pullwiseApi.scans.list.mockReset();
  });

  it("keeps polling while queued or running scans are active", async () => {
    pullwiseApi.scans.list
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "queued" }] })
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "running" }] })
      .mockResolvedValueOnce({ items: [{ id: "sc_1", status: "done" }] });

    renderHook(() => useScans({ pollIntervalMs: 25 }));

    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(2), { timeout: 250 });
    await waitFor(() => expect(pullwiseApi.scans.list).toHaveBeenCalledTimes(3), { timeout: 250 });
  });
});
