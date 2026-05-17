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
});
