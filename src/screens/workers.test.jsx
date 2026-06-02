import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullwiseApi } from "../api/pullwise.js";
import { WorkersScreen } from "./workers.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    system: {
      listWorkers: vi.fn(),
      createWorker: vi.fn(),
      getWorker: vi.fn(),
      updateWorker: vi.fn(),
      enableWorker: vi.fn(),
      disableWorker: vi.fn(),
      rotateWorkerToken: vi.fn(),
      testWorker: vi.fn(),
      deleteWorker: vi.fn(),
    },
  },
}));

const mockGo = vi.fn();

const sampleWorkers = [
  {
    worker_id: "wk_1",
    name: "US-East Worker",
    status: "idle",
    enabled: true,
    running_jobs: 0,
    max_concurrent_jobs: 4,
    provider: "codex",
    version: "0.2.0",
    region: "us-east",
    last_heartbeat_at: 1760001000,
  },
  {
    worker_id: "wk_2",
    name: "EU Worker",
    status: "busy",
    enabled: true,
    running_jobs: 2,
    max_concurrent_jobs: 2,
    provider: "codex",
    version: "0.1.0",
    region: "eu-west",
    last_heartbeat_at: 1760000500,
  },
  {
    worker_id: "wk_3",
    name: "Degraded Node",
    status: "degraded",
    enabled: true,
    running_jobs: 0,
    max_concurrent_jobs: 1,
    provider: "codex",
    version: "0.1.0",
    region: "ap-south",
    last_heartbeat_at: 1759999000,
  },
  {
    worker_id: "wk_4",
    name: "Offline Node",
    status: "offline",
    enabled: false,
    running_jobs: 0,
    max_concurrent_jobs: 1,
    provider: "codex",
    version: "0.1.0",
    region: "",
    last_heartbeat_at: null,
  },
];

describe("WorkersScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pullwiseApi.system.listWorkers.mockResolvedValue({
      workers: sampleWorkers,
      items: sampleWorkers,
    });
  });

  it("renders the worker registry page heading", async () => {
    render(<WorkersScreen go={mockGo} />);
    expect(await screen.findByText("Worker Registry")).toBeInTheDocument();
  });

  it("lists all workers by name", async () => {
    render(<WorkersScreen go={mockGo} />);

    expect(await screen.findByText("US-East Worker")).toBeInTheDocument();
    expect(screen.getByText("EU Worker")).toBeInTheDocument();
    expect(screen.getByText("Degraded Node")).toBeInTheDocument();
    expect(screen.getByText("Offline Node")).toBeInTheDocument();
  });

  it("renders status tags within worker rows", async () => {
    render(<WorkersScreen go={mockGo} />);

    // Wait for the list to appear
    await screen.findByText("US-East Worker");

    // Status tags exist inside worker rows (wk-status-tag class)
    const statusTags = screen.getAllByText("Idle");
    expect(statusTags.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Busy").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Degraded").length).toBeGreaterThanOrEqual(1);
  });

  it("shows disabled tag for disabled workers", async () => {
    render(<WorkersScreen go={mockGo} />);

    await screen.findByText("Offline Node");

    // The "Disabled" tag is inside the worker row
    const disabledTags = screen.getAllByText("Disabled");
    expect(disabledTags.length).toBeGreaterThanOrEqual(1);
  });

  it("opens create worker modal on button click", async () => {
    const user = userEvent.setup();
    render(<WorkersScreen go={mockGo} />);

    // Find the header "Register worker" button (not the modal title)
    await screen.findByText("Worker Registry");
    const registerButtons = screen.getAllByText("Register worker");
    await user.click(registerButtons[0]);

    expect(screen.getByText("Register new worker")).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
  });

  it("creates a worker via the modal form", async () => {
    const user = userEvent.setup();
    pullwiseApi.system.createWorker.mockResolvedValue({
      worker: {
        worker_id: "wk_new",
        name: "New Worker",
        status: "offline",
        enabled: true,
        running_jobs: 0,
        max_concurrent_jobs: 1,
        provider: "codex",
      },
      worker_token: "pwk_test_new_token",
      install_command: "curl -fsSL http://localhost:8080/install-worker.sh | bash",
      local_install_command:
        "curl -fsSL http://127.0.0.1:8080/install-worker.sh | bash -s -- --server http://127.0.0.1:8080",
      install_commands: {
        standard: "curl -fsSL http://localhost:8080/install-worker.sh | bash",
        local:
          "curl -fsSL http://127.0.0.1:8080/install-worker.sh | bash -s -- --server http://127.0.0.1:8080",
      },
    });

    render(<WorkersScreen go={mockGo} />);

    await screen.findByText("Worker Registry");
    const registerButtons = screen.getAllByText("Register worker");
    await user.click(registerButtons[0]);

    await user.type(screen.getByLabelText(/^name/i), "New Worker");

    // The modal submit button has type="submit", distinguish from the header button
    const submitBtn = screen.getAllByRole("button", { name: /register worker/i }).find(
      (btn) => btn.getAttribute("type") === "submit"
    );
    await user.click(submitBtn);

    await waitFor(() =>
      expect(pullwiseApi.system.createWorker).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Worker" })
      )
    );
    expect(await screen.findByText("Standard deployment")).toBeInTheDocument();
    expect(screen.getByText("Local same-host deployment")).toBeInTheDocument();
    expect(screen.getAllByText(/127\.0\.0\.1:8080/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/worker does not listen on port 8080/i)).toBeInTheDocument();
  });

  it("shows empty state when no workers exist", async () => {
    pullwiseApi.system.listWorkers.mockResolvedValue({
      workers: [],
      items: [],
    });

    render(<WorkersScreen go={mockGo} />);

    expect(await screen.findByText(/No workers registered yet/i)).toBeInTheDocument();
  });

  it("filters workers by status tabs", async () => {
    const user = userEvent.setup();
    render(<WorkersScreen go={mockGo} />);

    await screen.findByText("US-East Worker");

    // Click "Active" filter tab
    const activeBtn = screen.getAllByRole("button", { name: /active/i })[0];
    await user.click(activeBtn);

    // Active workers (idle + busy) should still show
    expect(screen.getByText("US-East Worker")).toBeInTheDocument();
    expect(screen.getByText("EU Worker")).toBeInTheDocument();
  });

  it("expands worker detail on click", async () => {
    const user = userEvent.setup();
    pullwiseApi.system.getWorker.mockResolvedValue({
      worker: sampleWorkers[0],
      auditEvents: [
        { action: "create_worker", success: true, created_at: 1760000000 },
        { action: "heartbeat", success: true, created_at: 1760001000 },
      ],
    });

    render(<WorkersScreen go={mockGo} />);

    const workerRow = (await screen.findByText("US-East Worker")).closest(".wk-row-main");
    await user.click(workerRow);

    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("Audit log")).toBeInTheDocument();
  });

  it("disables a worker via action button", async () => {
    const user = userEvent.setup();
    pullwiseApi.system.disableWorker.mockResolvedValue({
      worker: { ...sampleWorkers[0], enabled: false, status: "offline" },
    });

    render(<WorkersScreen go={mockGo} />);

    // Expand the worker row first
    const workerRow = (await screen.findByText("US-East Worker")).closest(".wk-row-main");
    await user.click(workerRow);

    // Click "Stop new jobs" button
    await user.click(screen.getByRole("button", { name: /stop new jobs/i }));

    await waitFor(() =>
      expect(pullwiseApi.system.disableWorker).toHaveBeenCalledWith("wk_1")
    );
  });

  it("deletes a worker with confirmation", async () => {
    const user = userEvent.setup();
    pullwiseApi.system.deleteWorker.mockResolvedValue({
      worker: { worker_id: "wk_1", name: "US-East Worker" },
      deleted: true,
    });

    render(<WorkersScreen go={mockGo} />);

    // Expand the worker row
    const workerRow = (await screen.findByText("US-East Worker")).closest(".wk-row-main");
    await user.click(workerRow);

    // First click shows confirm, second click confirms
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);
    await user.click(screen.getByRole("button", { name: /confirm delete/i }));

    await waitFor(() =>
      expect(pullwiseApi.system.deleteWorker).toHaveBeenCalledWith("wk_1")
    );
  });

  it("shows health check result after testing", async () => {
    const user = userEvent.setup();
    pullwiseApi.system.testWorker.mockResolvedValue({
      worker: sampleWorkers[0],
      result: { ok: true, checks: { heartbeat: true, codex: true } },
    });

    render(<WorkersScreen go={mockGo} />);

    const workerRow = (await screen.findByText("US-East Worker")).closest(".wk-row-main");
    await user.click(workerRow);

    await user.click(screen.getByRole("button", { name: /health check/i }));

    await waitFor(() =>
      expect(pullwiseApi.system.testWorker).toHaveBeenCalledWith("wk_1")
    );
  });

  it("shows token rotation modal", async () => {
    const user = userEvent.setup();
    pullwiseApi.system.rotateWorkerToken.mockResolvedValue({
      worker: { ...sampleWorkers[0], worker_token: "pwk_rotated_token" },
      worker_token: "pwk_rotated_token",
      install_command: "curl -fsSL http://localhost:8080/install-worker.sh | bash",
      local_install_command:
        "curl -fsSL http://127.0.0.1:8080/install-worker.sh | bash -s -- --server http://127.0.0.1:8080",
    });

    render(<WorkersScreen go={mockGo} />);

    const workerRow = (await screen.findByText("US-East Worker")).closest(".wk-row-main");
    await user.click(workerRow);

    await user.click(screen.getByRole("button", { name: /rotate token/i }));

    await waitFor(() =>
      expect(screen.getByText("Token rotated")).toBeInTheDocument()
    );
    expect(screen.getByText("Local same-host deployment")).toBeInTheDocument();
  });
});
