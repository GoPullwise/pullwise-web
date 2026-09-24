import { describe, expect, it } from "vitest";
import { eventTypeLabel, productLabel } from "./product-detail.jsx";

describe("productLabel", () => {
  it("keeps processing-status and timeline-event 'assessed' labels distinct", () => {
    expect(productLabel("assessed")).toBe("Assessed");
    expect(eventTypeLabel("assessed")).toBe("Assessment saved");
  });
});
