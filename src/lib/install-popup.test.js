import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { openGitHubInstallPopup } from "./install-popup.js";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe("openGitHubInstallPopup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "open").mockReturnValue({
      closed: true,
      close: vi.fn(),
      focus: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("treats a closed popup as successful when the backend session has GitHub repositories", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({
      authenticated: true,
      github: {
        repositoriesConnected: true,
      },
    });

    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");

    await vi.advanceTimersByTimeAsync(400);

    await expect(completion).resolves.toBeUndefined();
  });

  it("preserves backend github_error codes from popup returns", async () => {
    const popup = {
      closed: false,
      close: vi.fn(),
      focus: vi.fn(),
    };
    window.open.mockReturnValueOnce(popup);
    const completion = openGitHubInstallPopup("https://github.com/apps/pullwise/installations/new");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: window.location.origin,
        data: {
          type: "pullwise:github-install",
          ok: false,
          error: "missing_installation_id",
        },
      })
    );

    await expect(completion).rejects.toMatchObject({
      code: "missing_installation_id",
      message: "missing_installation_id",
    });
  });
});
