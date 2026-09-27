import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "./App.jsx";
import { pullwiseApi } from "./api/pullwise.js";
import { NotificationProvider } from "./components/notifications.jsx";
import { screenFromPath } from "./lib/navigation.js";

vi.mock("./api/pullwise.js", () => ({
  pullwiseApi: { auth: { getSession: vi.fn() } },
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: false });
});

it("retires legacy product routes", () => {
  expect(screenFromPath("/dashboard/overview")).toBeNull();
  expect(screenFromPath("/services")).toBeNull();
  expect(screenFromPath("/repos")).toBeNull();
});

it("shows a not found page for a retired route", async () => {
  window.history.replaceState({}, "", "/dashboard/overview");
  render(<NotificationProvider><App /></NotificationProvider>);
  expect(await screen.findByText("This page took a wrong turn")).toBeInTheDocument();
});
