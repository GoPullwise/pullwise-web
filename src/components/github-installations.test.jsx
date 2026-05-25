import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("uses a controlled manage button instead of a raw GitHub settings link", () => {
    const onManage = vi.fn();
    render(
      <GitHubInstallationsList
        onManage={onManage}
        installations={[
          {
            installationId: "999",
            installationAccount: "GoPullwise",
            installationTargetType: "Organization",
            repositorySelection: "selected",
            repositoryCount: 2,
            installationHtmlUrl: "https://github.com/organizations/GoPullwise/settings/installations/999",
            workspaceId: "ws_1",
            workspaceName: "GoPullwise",
            manage: {
              mode: "verified_identity",
              githubIdentityId: "ghi_1",
              githubLogin: "alice",
              lastVerifiedAt: 1779670000,
            },
          },
        ]}
      />
    );

    expect(screen.queryByRole("link", { name: /manage/i })).not.toBeInTheDocument();
    expect(screen.getByText("Last verified by @alice")).toBeInTheDocument();
    expect(screen.getByText("Workspace GoPullwise")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /manage gopullwise/i }));

    expect(onManage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "999",
        account: "GoPullwise",
        manage: expect.objectContaining({ githubIdentityId: "ghi_1" }),
      })
    );
  });
});
