import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GitHubInstallationsList } from "./github-installations.jsx";

describe("GitHubInstallationsList", () => {
  it("sanitizes malformed installation labels and management links", () => {
    render(
      <GitHubInstallationsList
        installations={[
          {
            installationId: { value: "bad" },
            installationAccount: { value: "bad" },
            repositoryCount: { value: 2 },
            installationHtmlUrl: { value: "https://example.com" },
          },
          {
            installationId: "130258770",
            installationAccount: { value: "GoPullwise" },
            installationTargetType: { value: "Organization" },
            repositorySelection: { value: "all" },
            repositoryCount: "2.8",
            installationHtmlUrl: "javascript:alert(1)",
          },
        ]}
      />
    );

    expect(screen.getByText("Authorized GitHub installations")).toBeInTheDocument();
    expect(screen.getByText("130258770")).toBeInTheDocument();
    expect(screen.getByText(/Account .* selected .* 2 repositories/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("[object Object]");
    expect(screen.queryByRole("link", { name: /manage/i })).not.toBeInTheDocument();
  });

  it("rejects installation management links with control characters", () => {
    render(
      <GitHubInstallationsList
        installations={[
          {
            installationId: "130258770",
            installationAccount: "GoPullwise",
            installationHtmlUrl:
              "https://github.com/settings/installations/130258770\r\nX-Injected: bad",
          },
        ]}
      />
    );

    expect(screen.getByText("GoPullwise")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage/i })).not.toBeInTheDocument();
  });

  it("uses display-safe installation text fields", () => {
    render(
      <GitHubInstallationsList
        installations={[
          {
            installationId: "130258770\r\nX-Injected: bad",
            installationAccount: "GoPullwise\r\nX-Injected: bad",
            installationTargetType: "Organization\r\nX-Injected: bad",
            repositorySelection: "all\r\nX-Injected: bad",
            repositoryCount: "2",
            installationHtmlUrl: "https://github.com/settings/installations/130258770",
          },
        ]}
      />
    );

    expect(screen.getByText("GoPullwise")).toBeInTheDocument();
    expect(
      screen.getByText(/Organization .* all repositories .* 2 repositories/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Manage GoPullwise GitHub App installation" })
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("X-Injected");
  });
});
