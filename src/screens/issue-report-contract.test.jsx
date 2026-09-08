import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { pullwiseApi } from "../api/pullwise.js";
import { IssueDetailScreen } from "./issues.jsx";
import { setLang } from "../i18n.jsx";
// Produced by the Server's worker_protocol_findings -> issue_payload projection.
import issue from "../test/fixtures/pi-public-issue.json";

it("Server finding handoff facts survive detail loading and Copy Page", async () => {
  setLang("en");
  vi.spyOn(pullwiseApi.issues, "get").mockResolvedValue(issue);
  const writeText = vi.fn().mockResolvedValue();
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    render(<IssueDetailScreen go={() => {}} issueId={issue.id} />);
    await screen.findByRole("heading", { name: issue.title, level: 1 });
    for (const field of ["recommendation", "nextAgentTask", "disproofAttempt"]) {
      expect(document.body.textContent).toContain(issue[field]);
    }
    fireEvent.click(screen.getByRole("button", { name: "Copy Page" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    for (const field of ["recommendation", "nextAgentTask", "disproofAttempt"]) {
      expect(writeText.mock.calls[0][0]).toContain(issue[field]);
    }
  } finally {
    if (descriptor) Object.defineProperty(navigator, "clipboard", descriptor);
    else delete navigator.clipboard;
  }
});
