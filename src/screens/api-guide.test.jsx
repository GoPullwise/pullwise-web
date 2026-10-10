import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../i18n.jsx";
import { ApiIntegrationGuide, integrationMarkdown, integrationSections } from "./api-guide.jsx";

afterEach(() => setLang("en"));

describe("REST integration journey", () => {
  it("starts with an explicit category, one-time key setup and actual response IDs", () => {
    render(<ApiIntegrationGuide base="https://preview-api.pull-wise.com" ids={["quickstart"]} />);
    expect(screen.getByRole("heading", { name: "Quickstart: save your first expense" })).toHaveAttribute("id", "quickstart");
    const start = integrationSections("https://preview-api.pull-wise.com")[0].blocks.find(block => block.title === "firstExpense").code;
    expect(start).toContain("export PULLWISE_API_KEY=");
    expect(start).toContain("api /api/v1/me");
    expect(start).toContain("api /api/v1/categories");
    expect(start).toContain("categoryId:$category");
    expect(start).toContain("Idempotency-Key: $IDEMPOTENCY_KEY");
    expect(start).toContain("jq -r .id");
    expect(start).toContain("--fail-with-body");
    expect(start).not.toContain("pwk_example");
  });

  it("copies the same guide sections, permission boundaries and recovery instructions", () => {
    const value = integrationMarkdown("https://preview-api.pull-wise.com");
    for (const expected of ["## Quickstart", "## Environments", "## Scopes", "## Project and shared recurring", "## Invitations", "## Error responses", "members:write", "Cookie", "412", "428", "204", "D1_ACCESS_PAUSED", "categoryId", "nextCursor", "autoRemoveOldestExpense", "/api/v1/account/expense-retention", "PULLWISE_COOKIE_JAR", "Origin: $PULLWISE_APP_ORIGIN"])
      expect(value).toContain(expected);
    expect(value).toContain("the same REST resources and business rules");
  });

  it("distinguishes separate historical retries from future scheduling", () => {
    const value = integrationMarkdown("https://preview-api.pull-wise.com", ["recurring"]);
    for (const expected of ["exactly one expense on startOn", "one separate expense record", "never a cumulative amount",
      "categoryId may be omitted", "CATEGORY_REQUIRED", "strictly after today", "awaitingSync", "first 10 unresolved",
      "Later failures are discarded", "pendingOccurrences", "retryPeriodKey", "If-Match", "English email",
      "/api/v1/recurring-expense-notifications", "cookie-only", "PASTE_RETAINED_PERIOD_KEY"])
      expect(value).toContain(expected);
    expect(value).not.toContain("explicit active category is always required");
  });
});
