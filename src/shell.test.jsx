import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Topbar } from "./shell.jsx";

describe("Topbar navigation", () => {
  it("supports keyboard activation for brand and breadcrumb navigation", async () => {
    const user = userEvent.setup();
    const go = vi.fn();

    render(
      <Topbar
        go={go}
        breadcrumbs={[
          { label: "Pullwise", go: "dashboard" },
          { label: "Issues" },
        ]}
      />
    );

    const brand = screen.getByRole("button", { name: /go to pullwise home/i });
    brand.focus();
    await user.keyboard("{Enter}");

    expect(go).toHaveBeenCalledWith("landing");

    go.mockClear();
    const breadcrumb = screen.getByRole("button", { name: /^go to pullwise$/i });
    breadcrumb.focus();
    await user.keyboard(" ");

    expect(go).toHaveBeenCalledWith("dashboard");

    await user.click(screen.getByRole("button", { name: /open account settings/i }));

    expect(go).toHaveBeenCalledWith("settings");
  });
});
