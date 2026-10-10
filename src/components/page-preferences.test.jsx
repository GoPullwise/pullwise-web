import { StrictMode, Suspense } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Topbar } from "../shell.jsx";
import { PagePreferencesProvider, PagePreferencesReady } from "./page-preferences.jsx";

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function controls(onClick = vi.fn()) {
  return (
    <button type="button" onClick={onClick}>
      Display options
    </button>
  );
}

function header(label, key = label) {
  return <Topbar key={key} go={vi.fn()} breadcrumbs={[{ label }]} />;
}

function provider(children, props = {}) {
  return (
    <PagePreferencesProvider
      owner="projects:alice"
      phone
      consolePage
      publicPage={false}
      controls={controls()}
      {...props}
    >
      {children}
    </PagePreferencesProvider>
  );
}

function options() {
  return screen.getByRole("button", { name: "Display options" });
}

function topbar(label) {
  return screen.getByText(label).closest("header");
}

function SuspensiblePage({ suspended, pending, label = "Committed page" }) {
  if (suspended) throw pending.promise;
  return <h1>{label}</h1>;
}

describe("page-owned phone display controls", () => {
  it("places the control inside the real Topbar actions without a separate console control", () => {
    const onVisibilityChange = vi.fn();
    render(provider(header("Projects"), { onVisibilityChange }));
    const actionGroup = topbar("Projects").querySelector(".topbar-actions");
    expect(actionGroup).toContainElement(options());
    expect(screen.getAllByRole("button", { name: "Display options" })).toHaveLength(1);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  it("removes controls with their header and attaches them to the replacement header", () => {
    const onClick = vi.fn();
    const onVisibilityChange = vi.fn();
    const props = { controls: controls(onClick), onVisibilityChange };
    const view = render(provider(header("Projects"), props));
    const oldHeader = topbar("Projects");
    view.rerender(provider(<p role="status">Loading ledger</p>, props));
    expect(oldHeader).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Display options" })).not.toBeInTheDocument();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
    view.rerender(provider(header("Shared Pool"), props));
    expect(topbar("Shared Pool").querySelector(".topbar-actions")).toContainElement(options());
    fireEvent.click(options());
    expect(onClick).toHaveBeenCalledOnce();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  it("retains a newly registered header when the old header cleanup arrives later", () => {
    const onVisibilityChange = vi.fn();
    const props = { onVisibilityChange };
    const view = render(provider([header("Old projects"), header("Current project")], props));
    const current = topbar("Current project");
    expect(current.querySelector(".topbar-actions")).toContainElement(options());
    expect(
      within(topbar("Old projects")).queryByRole("button", { name: "Display options" })
    ).not.toBeInTheDocument();
    onVisibilityChange.mockClear();
    view.rerender(provider([header("Current project")], props));
    expect(topbar("Current project")).toBe(current);
    expect(current.querySelector(".topbar-actions")).toContainElement(options());
    expect(screen.getAllByRole("button", { name: "Display options" })).toHaveLength(1);
    expect(onVisibilityChange).not.toHaveBeenCalledWith(false);
  });

  it("reports a control teardown when its owner and portal target change", () => {
    const onVisibilityChange = vi.fn();
    const view = render(provider(header("Old projects"), { onVisibilityChange }));
    onVisibilityChange.mockClear();
    view.rerender(
      provider(header("New projects"), {
        owner: "projects:bob",
        onVisibilityChange,
      })
    );
    expect(onVisibilityChange).toHaveBeenCalledWith(false);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
    expect(topbar("New projects").querySelector(".topbar-actions")).toContainElement(options());
    expect(screen.queryByText("Old projects")).not.toBeInTheDocument();
  });

  it("keeps committed public-page controls hidden until readiness registers and removes them on cleanup", () => {
    const props = { consolePage: false, publicPage: true };
    const view = render(provider(<h1>Public page</h1>, props));
    expect(screen.queryByRole("button", { name: "Display options" })).not.toBeInTheDocument();
    view.rerender(
      provider(
        <>
          <h1>Public page</h1>
          <PagePreferencesReady />
        </>,
        props
      )
    );
    expect(options()).toBeVisible();
    expect(options().closest("header")).toBeNull();
    view.rerender(provider(<h1>Public page</h1>, props));
    expect(screen.queryByRole("button", { name: "Display options" })).not.toBeInTheDocument();
  });

  it("does not let an older ready registration cleanup clear the current public page", () => {
    const props = { consolePage: false, publicPage: true };
    const view = render(
      provider(
        <>
          <PagePreferencesReady key="old" />
          <PagePreferencesReady key="current" />
        </>,
        props
      )
    );
    expect(options()).toBeVisible();
    view.rerender(provider(<PagePreferencesReady key="current" />, props));
    expect(options()).toBeVisible();
    view.rerender(provider(null, props));
    expect(screen.queryByRole("button", { name: "Display options" })).not.toBeInTheDocument();
  });

  it("does not display controls in an ineligible session, OAuth or ledger interim view", () => {
    render(
      provider(
        <>
          {header("Interim")}
          <PagePreferencesReady />
        </>,
        { consolePage: false, publicPage: false }
      )
    );
    expect(screen.queryByRole("button", { name: "Display options" })).not.toBeInTheDocument();
  });

  it("waits for a suspended public page and hides controls when a committed page suspends again", async () => {
    const pending = deferred();
    const onVisibilityChange = vi.fn();
    const page = (suspended) =>
      provider(
        <Suspense fallback={<p role="status">Loading page</p>}>
          <SuspensiblePage suspended={suspended} pending={pending} />
          <PagePreferencesReady />
        </Suspense>,
        { consolePage: false, publicPage: true, onVisibilityChange }
      );
    const view = render(page(true));
    expect(screen.getByRole("status")).toHaveTextContent("Loading page");
    expect(screen.queryByRole("button", { name: "Display options" })).not.toBeInTheDocument();
    view.rerender(page(false));
    expect(screen.getByRole("heading", { name: "Committed page" })).toBeVisible();
    expect(options()).toBeVisible();
    view.rerender(page(true));
    expect(screen.getByRole("status")).toHaveTextContent("Loading page");
    expect(screen.queryByRole("button", { name: "Display options" })).not.toBeInTheDocument();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
    await act(async () => {
      view.rerender(page(false));
      pending.resolve();
    });
    expect(options()).toBeVisible();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  it("unmounts a console portal when Suspense hides the committed header and restores only its current slot", async () => {
    const pending = deferred();
    const onVisibilityChange = vi.fn();
    const page = (suspended) =>
      provider(
        <Suspense fallback={<p role="status">Loading console</p>}>
          {header("Projects")}
          <SuspensiblePage suspended={suspended} pending={pending} />
          <PagePreferencesReady />
        </Suspense>,
        { onVisibilityChange }
      );
    const view = render(page(false));
    const actualHeader = topbar("Projects");
    expect(actualHeader.querySelector(".topbar-actions")).toContainElement(options());
    view.rerender(page(true));
    expect(screen.getByRole("status")).toHaveTextContent("Loading console");
    expect(actualHeader).not.toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Display options", hidden: true })
    ).not.toBeInTheDocument();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(false);
    await act(async () => {
      view.rerender(page(false));
      pending.resolve();
    });
    expect(actualHeader).toBeVisible();
    expect(actualHeader.querySelector(".topbar-actions")).toContainElement(options());
    expect(screen.getAllByRole("button", { name: "Display options" })).toHaveLength(1);
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
  });

  it("preserves desktop corner controls without page readiness or a header", () => {
    const onVisibilityChange = vi.fn();
    const view = render(
      provider(<p role="status">Checking session</p>, {
        phone: false,
        consolePage: false,
        publicPage: false,
        onVisibilityChange,
      })
    );
    expect(options()).toBeVisible();
    expect(onVisibilityChange).toHaveBeenLastCalledWith(true);
    view.rerender(provider(header("Projects"), { phone: false, onVisibilityChange }));
    expect(options().closest("header")).toBeNull();
    expect(topbar("Projects").querySelector(".topbar-preferences-slot")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Display options" })).toHaveLength(1);
  });

  it("keeps one current portal through StrictMode registration cleanup and remount", () => {
    render(
      <StrictMode>
        {provider(
          <>
            {header("Projects")}
            <PagePreferencesReady />
          </>
        )}
      </StrictMode>
    );
    expect(topbar("Projects").querySelector(".topbar-actions")).toContainElement(options());
    expect(screen.getAllByRole("button", { name: "Display options" })).toHaveLength(1);
  });
});
