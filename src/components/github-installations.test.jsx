import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const row = screen.getByText("130258770").closest(".gh-install-row");
    const meta = row.querySelector(".gh-install-meta");
    expect(within(meta).getByText("Account")).toBeInTheDocument();
    expect(within(meta).getByText("selected")).toBeInTheDocument();
    expect(within(meta).getByText("2 repositories")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /manage gopullwise/i }));

    expect(onManage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "999",
        account: "GoPullwise",
        manage: expect.objectContaining({ githubIdentityId: "ghi_1" }),
      })
    );
  });

  it("renders installation metadata as wrapping segments", () => {
    render(
      <GitHubInstallationsList
        installations={[
          {
            installationId: "130258770",
            installationAccount: "GoPullwise",
            installationTargetType: "Organization",
            repositorySelection: "selected",
            repositoryCount: 12,
          },
        ]}
      />
    );

    const meta = screen.getByText("Organization").closest(".gh-install-meta");
    expect(meta).toBeInTheDocument();
    expect(within(meta).getByText("selected")).toBeInTheDocument();
    expect(within(meta).getByText("12 repositories")).toBeInTheDocument();
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
    const row = screen.getByText("GoPullwise").closest(".gh-install-row");
    const meta = row.querySelector(".gh-install-meta");
    expect(within(meta).getByText("Organization")).toBeInTheDocument();
    expect(within(meta).getByText("all repositories")).toBeInTheDocument();
    expect(within(meta).getByText("2 repositories")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("X-Injected");
  });
});
