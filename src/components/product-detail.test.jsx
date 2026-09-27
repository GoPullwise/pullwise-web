import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CiTriage, eventTypeLabel, productLabel } from "./product-detail.jsx";

describe("productLabel", () => {
  it("keeps processing-status and timeline-event 'assessed' labels distinct", () => {
    expect(productLabel("assessed")).toBe("Assessed");
    expect(eventTypeLabel("assessed")).toBe("Assessment saved");
  });
});

describe("CI triage", () => {
  it("links visible symptoms to evidence and historical handling to its source", () => {
    render(<CiTriage item={{observedErrorSignature: "AssertionError: expected 2",
      sourceFacts: {windows: [{windowId: "w1", symptoms: ["assertion_failure"],
      evidenceIds: ["ev-1"]}]}, evidence: [{id: "ev-1", text: "AssertionError: expected 2"}],
      historyCandidates: [{itemId: "old", relation: "same_observed_symptom", disposition: "done",
        note: "Updated lockfile", sourceUrl: "https://github.com/acme/api/actions/runs/1"}]}} />);
    expect(screen.getByText("Assertion failure")).toBeTruthy();
    expect(screen.getByText("AssertionError: expected 2")).toBeTruthy();
    expect(screen.getByRole("link", {name: /Evidence/}).getAttribute("href")).toBe("#evidence-ev-1");
    expect(screen.getByText("Updated lockfile")).toBeTruthy();
    expect(screen.getByRole("link", {name: /Prior failure on GitHub/}).getAttribute("href"))
      .toBe("https://github.com/acme/api/actions/runs/1");
    expect(screen.queryByText(/same cause/i)).toBeNull();
    expect(screen.getByText("Flaky status unknown")).toBeTruthy();
  });

  it("does not show history when the server supplies no candidates", () => {
    render(<CiTriage item={{sourceFacts: {windows: []}, historyCandidates: []}} />);
    expect(screen.queryByText(/Historical handling candidates/)).toBeNull();
  });
});
