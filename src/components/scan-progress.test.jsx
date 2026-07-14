import { describe, expect, it } from "vitest";
import { scanProgressPresentation } from "./scan-progress.jsx";

describe("scanProgressPresentation", () => {
  it("presents partial completion as a terminal partial result", () => {
    expect(
      scanProgressPresentation({ status: "partial_completed", progress: 87 })
    ).toMatchObject({
      progress: 87,
      label: "Scan partially completed",
      valueLabel: "Partially completed at 87%",
      ariaValueText: "Scan partially completed at 87%",
    });
  });
});
