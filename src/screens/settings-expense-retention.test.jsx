import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/http.js";
import { pullwiseApi } from "../api/pullwise.js";
import { WorkspaceContext } from "../components/workspace-context.jsx";
import { setLang } from "../i18n.jsx";
import { connectGitHubRepositories, signOut } from "../lib/auth.js";
import { SettingsScreen } from "./settings.jsx";

vi.mock("../api/pullwise.js", () => ({
  pullwiseApi: {
    auth: { getSession: vi.fn(), requestEmailCode: vi.fn(), verifyEmailCode: vi.fn() },
    integrations: { list: vi.fn() },
    account: {
      getJev: vi.fn(),
      updateJev: vi.fn(),
      getExpenseRetention: vi.fn(),
      updateExpenseRetention: vi.fn(),
    },
  },
}));
vi.mock("../lib/auth.js", () => ({
  connectGitHubRepositories: vi.fn(),
  manageGitHubInstallation: vi.fn(),
  signOut: vi.fn(),
}));

const account = {
  authenticated: true,
  user: { id: "actor_1", name: "Personal account", providers: ["github"] },
};
const off = { autoRemoveOldestExpense: false, revision: 1 };
const on = { autoRemoveOldestExpense: true, revision: 2 };
const jev = {
  enabled: false,
  revision: 7,
  eligible: true,
  available: false,
  monthlyBudgetUsd: "3",
};
const switchName = "Automatically remove the oldest expense at capacity";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function renderSettings(props = {}) {
  const go = vi.fn(), onSelect = vi.fn();
  const shared = { id: "other_owner", name: "Other owner's ledger", role: "viewer" };
  const view = render(
    <WorkspaceContext.Provider
      value={{
        workspace: shared,
        items: [shared, { id: "own_ledger", name: "My ledger", role: "owner" }],
        onSelect,
      }}
    >
      <SettingsScreen go={go} {...props} />
    </WorkspaceContext.Provider>
  );
  return { ...view, go, onSelect };
}

async function readySwitch() {
  await screen.findByText("Personal account");
  const control = screen.getByRole("switch", { name: switchName });
  await waitFor(() => expect(control).toBeEnabled());
  return control;
}

describe("personal expense capacity preference", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pullwiseApi.auth.getSession.mockResolvedValue(account);
    pullwiseApi.integrations.list.mockResolvedValue({
      github: { connected: false, repositories: [], installations: [] },
    });
    pullwiseApi.account.getJev.mockResolvedValue(jev);
    pullwiseApi.account.updateJev.mockResolvedValue({
      ...jev, enabled: true, available: true, revision: 8,
    });
    pullwiseApi.account.getExpenseRetention.mockResolvedValue(off);
    pullwiseApi.account.updateExpenseRetention.mockResolvedValue(on);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await setLang("en");
  });

  it.each([
    ["Free", false, "0"],
    ["Pro", true, "3"],
    ["Max", true, "5"],
  ])("loads the server default Off and permits an explicit choice on %s", async (_plan, eligible, monthlyBudgetUsd) => {
    pullwiseApi.account.getJev.mockResolvedValue({ ...jev, eligible, monthlyBudgetUsd });
    renderSettings();
    const control = await readySwitch();
    expect(control).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Select ledger" })).toHaveValue("other_owner");
    expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
    pullwiseApi.account.getExpenseRetention.mockResolvedValue(on);
    fireEvent.click(control);
    await waitFor(() => expect(control).toBeChecked());
    await waitFor(() => expect(control).toBeEnabled());
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledWith(1, true, { signal: expect.any(AbortSignal) });
  });

  it("renders a saved On preference and sends the current revision when turning it Off", async () => {
    const savedOff = { ...off, revision: 3 };
    pullwiseApi.account.getExpenseRetention.mockResolvedValueOnce(on).mockResolvedValue(savedOff);
    pullwiseApi.account.updateExpenseRetention.mockResolvedValue(savedOff);
    renderSettings();
    const control = await readySwitch();
    expect(control).toBeChecked();
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
    fireEvent.click(control);
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).not.toBeChecked();
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledWith(2, false, { signal: expect.any(AbortSignal) });
  });

  it("keeps the confirmed value and one Settings mutation guard through PATCH and the required GET", async () => {
    const write = deferred(), refresh = deferred(), onOperationBusy = vi.fn();
    pullwiseApi.account.updateExpenseRetention.mockReturnValueOnce(write.promise);
    pullwiseApi.account.getExpenseRetention.mockResolvedValueOnce(off).mockReturnValueOnce(refresh.promise);
    const { go, onSelect } = renderSettings({ onOperationBusy });
    const control = await readySwitch();
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "new@example.com" } });
    act(() => {
      fireEvent.click(control);
      fireEvent.click(control);
      fireEvent.click(screen.getByRole("switch", { name: "Enable Jev" }));
      fireEvent.click(screen.getByRole("button", { name: "Send code" }));
      fireEvent.click(screen.getByRole("button", { name: "Connect repositories" }));
    });
    expect(control).not.toBeChecked();
    const expectLocked = () => {
      expect(control).toBeDisabled();
      expect(screen.getByRole("switch", { name: "Enable Jev" })).toBeDisabled();
      for (const name of ["Reload", "Sign out", "Connect repositories", "Send code"])
        expect(screen.getByRole("button", { name })).toBeDisabled();
      expect(screen.getByRole("textbox", { name: "Email" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: "Select ledger" })).toBeDisabled();
      const projects = screen.getByRole("link", { name: "Projects" });
      expect(projects).toHaveAttribute("aria-disabled", "true");
      expect(projects).not.toHaveAttribute("href");
      fireEvent.click(projects);
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      expect(go).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    };
    expectLocked();
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.account.updateJev).not.toHaveBeenCalled();
    expect(pullwiseApi.auth.requestEmailCode).not.toHaveBeenCalled();
    expect(connectGitHubRepositories).not.toHaveBeenCalled();
    await act(async () => write.resolve(on));
    expect(control).toBeChecked();
    expectLocked();
    expect(onOperationBusy).toHaveBeenLastCalledWith(true);
    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.integrations.list).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.account.getJev).toHaveBeenCalledTimes(1);
    await act(async () => refresh.resolve(on));
    expect(control).toBeEnabled();
    expect(onOperationBusy).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  it("cannot start a retention write while a Jev write and its required refresh hold the guard", async () => {
    const write = deferred(), refresh = deferred();
    const jevOn = { ...jev, enabled: true, available: true, revision: 8 };
    pullwiseApi.account.updateJev.mockReturnValueOnce(write.promise);
    pullwiseApi.account.getJev.mockResolvedValueOnce(jev).mockReturnValueOnce(refresh.promise);
    renderSettings();
    const control = await readySwitch();
    act(() => {
      fireEvent.click(screen.getByRole("switch", { name: "Enable Jev" }));
      fireEvent.click(control);
    });
    expect(control).toBeDisabled();
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
    await act(async () => write.resolve(jevOn));
    expect(control).toBeDisabled();
    fireEvent.click(control);
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
    await act(async () => refresh.resolve(jevOn));
    expect(control).toBeEnabled();
  });

  it("does not write when the surrounding operation guard refuses a mutation", async () => {
    renderSettings({ onOperationBusy: vi.fn((active) => !active) });
    const control = await readySwitch();
    fireEvent.click(control);
    expect(control).not.toBeChecked();
    expect(control).toBeEnabled();
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
  });

  it("requires manual Reload after 412 and uses the newly read revision without retrying the write", async () => {
    pullwiseApi.account.updateExpenseRetention
      .mockRejectedValueOnce(new ApiError("conflict", { status: 412, payload: { code: "PRECONDITION_FAILED" } }))
      .mockResolvedValueOnce({ ...on, revision: 5 });
    pullwiseApi.account.getExpenseRetention
      .mockResolvedValueOnce(off)
      .mockResolvedValueOnce({ ...off, revision: 4 })
      .mockResolvedValueOnce({ ...on, revision: 5 });
    renderSettings();
    const control = await readySwitch();
    fireEvent.click(control);
    expect(await screen.findByRole("alert")).toHaveTextContent("Expense retention settings changed elsewhere. Reload and choose again.");
    expect(control).not.toBeChecked();
    expect(control).toBeDisabled();
    expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledTimes(1);
    fireEvent.click(control);
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(control).toBeEnabled());
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledTimes(1);
    fireEvent.click(control);
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).toBeChecked();
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenLastCalledWith(4, true, { signal: expect.any(AbortSignal) });
  });

  it("retains Off after a failed write and requires an explicit Reload", async () => {
    pullwiseApi.account.updateExpenseRetention.mockRejectedValueOnce(new Error("write failed"));
    renderSettings();
    const control = await readySwitch();
    fireEvent.click(control);
    expect(await screen.findByRole("alert")).toHaveTextContent("Expense retention settings could not be saved. Reload before trying again.");
    expect(control).not.toBeChecked();
    expect(control).toBeDisabled();
    expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reload" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).not.toBeChecked();
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...on, revision: 1 },
    { ...on, revision: 3 },
    { ...off, revision: 2 },
  ])("does not accept a write response with an unconfirmed revision or choice %#", async (payload) => {
    pullwiseApi.account.updateExpenseRetention.mockResolvedValueOnce(payload);
    renderSettings();
    const control = await readySwitch();
    fireEvent.click(control);
    expect(await screen.findByRole("alert")).toHaveTextContent("Expense retention settings could not be saved");
    expect(control).not.toBeChecked();
    expect(control).toBeDisabled();
    expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledTimes(1);
  });

  it("keeps the accepted server preference after refresh failure and blocks another write until Reload", async () => {
    pullwiseApi.account.getExpenseRetention
      .mockResolvedValueOnce(off)
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValueOnce(on);
    renderSettings();
    const control = await readySwitch();
    fireEvent.click(control);
    expect(await screen.findByRole("alert")).toHaveTextContent("Expense retention preference was saved, but current status could not be refreshed. Reload before changing it again.");
    expect(control).toBeChecked();
    expect(control).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reload" })).toBeEnabled();
    fireEvent.click(control);
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(control).toBeEnabled());
    expect(control).toBeChecked();
  });

  it("keeps an unread preference disabled without claiming a confirmed default", async () => {
    const read = deferred();
    pullwiseApi.account.getExpenseRetention.mockReturnValueOnce(read.promise);
    renderSettings();
    const control = screen.getByRole("switch", { name: switchName });
    expect(control).toBeDisabled();
    fireEvent.click(control);
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
    await act(async () => read.reject(new Error("read unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Expense retention settings could not be loaded. Reload to try again.");
    expect(control).toBeDisabled();
    expect(screen.getByText("Expense retention settings are unavailable until reloaded.")).toBeInTheDocument();
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
  });

  it.each([
    { autoRemoveOldestExpense: "false", revision: 1 },
    { autoRemoveOldestExpense: false, revision: 0 },
    { autoRemoveOldestExpense: false, revision: Number.MAX_SAFE_INTEGER + 1 },
  ])("fails closed on an invalid expense retention DTO %#", async (payload) => {
    pullwiseApi.account.getExpenseRetention.mockResolvedValueOnce(payload);
    renderSettings();
    expect(await screen.findByRole("alert")).toHaveTextContent("Expense retention settings could not be loaded");
    expect(screen.getByRole("switch", { name: switchName })).toBeDisabled();
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
  });

  it("does not expose an On preference without a confirmed signed-in identity", async () => {
    pullwiseApi.auth.getSession.mockResolvedValue({ authenticated: false });
    pullwiseApi.account.getExpenseRetention.mockResolvedValue(on);
    renderSettings();
    await screen.findByRole("alert");
    const control = screen.getByRole("switch", { name: switchName });
    expect(control).not.toBeChecked();
    expect(control).toBeDisabled();
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
  });

  it("aborts an unmounted write and ignores its late success after another account is mounted", async () => {
    const write = deferred(), onOperationBusy = vi.fn();
    pullwiseApi.account.updateExpenseRetention.mockReturnValueOnce(write.promise);
    const first = renderSettings({ onOperationBusy });
    fireEvent.click(await readySwitch());
    const signal = pullwiseApi.account.updateExpenseRetention.mock.calls[0][2].signal;
    first.unmount();
    expect(signal.aborted).toBe(true);
    expect(onOperationBusy).toHaveBeenLastCalledWith(false);
    pullwiseApi.auth.getSession.mockResolvedValue({ ...account, user: { ...account.user, id: "actor_2" } });
    renderSettings();
    const current = await readySwitch();
    expect(current).not.toBeChecked();
    await act(async () => write.resolve(on));
    expect(current).not.toBeChecked();
    expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledTimes(2);
    expect(pullwiseApi.account.updateExpenseRetention).toHaveBeenCalledTimes(1);
  });

  it("aborts an old account read and prevents its late response from replacing the next account's value", async () => {
    const oldRead = deferred();
    pullwiseApi.account.getExpenseRetention.mockReturnValueOnce(oldRead.promise);
    const first = renderSettings();
    const signal = pullwiseApi.account.getExpenseRetention.mock.calls[0][0].signal;
    first.unmount();
    expect(signal.aborted).toBe(true);
    pullwiseApi.auth.getSession.mockResolvedValue({ ...account, user: { ...account.user, id: "actor_2" } });
    pullwiseApi.account.getExpenseRetention.mockResolvedValue(on);
    renderSettings();
    const current = await readySwitch();
    expect(current).toBeChecked();
    await act(async () => oldRead.resolve(off));
    expect(current).toBeChecked();
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
  });

  it("aborts the required refresh on unmount and ignores the old account's response", async () => {
    const refresh = deferred();
    pullwiseApi.account.getExpenseRetention.mockResolvedValueOnce(off).mockReturnValueOnce(refresh.promise);
    const first = renderSettings();
    fireEvent.click(await readySwitch());
    await waitFor(() => expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledTimes(2));
    const signal = pullwiseApi.account.getExpenseRetention.mock.calls[1][0].signal;
    first.unmount();
    expect(signal.aborted).toBe(true);
    pullwiseApi.auth.getSession.mockResolvedValue({ ...account, user: { ...account.user, id: "actor_2" } });
    pullwiseApi.account.getExpenseRetention.mockResolvedValue(off);
    renderSettings();
    const current = await readySwitch();
    await act(async () => refresh.resolve(on));
    expect(current).not.toBeChecked();
    expect(current).toBeEnabled();
    expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledTimes(3);
  });

  it("does not poll or create preference writes while the account screen stays open", async () => {
    renderSettings();
    await readySwitch();
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(5 * 60 * 1000));
    expect(pullwiseApi.account.getExpenseRetention).toHaveBeenCalledTimes(1);
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
    expect(pullwiseApi.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["en", "Expense capacity", switchName, "Off by default", "Removed expenses cannot be restored", "Selecting another owner's ledger does not change this setting"],
    ["zh", "支出容量", "满额时自动移除最旧支出", "默认关闭", "已移除的支出无法恢复", "选择其他所有者的账本不会改变此设置"],
    ["ja", "支出の容量", "上限に達したら最も古い支出を自動削除", "初期設定はオフ", "削除した支出は復元できません", "他の所有者の帳簿を選択しても、この設定は変わりません"],
    ["ko", "지출 용량", "한도에 도달하면 가장 오래된 지출 자동 제거", "기본값은 꺼짐", "제거된 지출은 복원할 수 없습니다", "다른 소유자의 장부를 선택해도 이 설정은 바뀌지 않습니다"],
    ["fr", "Capacité des dépenses", "Supprimer automatiquement la dépense la plus ancienne à la limite", "Désactivé par défaut", "Les dépenses supprimées ne peuvent pas être restaurées", "Choisir le registre d’un autre propriétaire ne modifie pas ce réglage"],
    ["es", "Capacidad de gastos", "Eliminar automáticamente el gasto más antiguo al alcanzar el límite", "Desactivado por defecto", "Los gastos eliminados no se pueden restaurar", "Seleccionar el libro de otro propietario no cambia este ajuste"],
  ])("provides accessible localized ownership and irreversible-removal guidance in %s", async (locale, title, label, defaultOff, irreversible, scope) => {
    await setLang(locale);
    renderSettings();
    await screen.findByText("Personal account");
    const panel = screen.getByRole("region", { name: title });
    expect(within(panel).getByRole("heading", { name: title })).toBeInTheDocument();
    const control = within(panel).getByRole("switch", { name: label });
    expect(control).toBeEnabled();
    expect(control).not.toBeChecked();
    expect(control).toHaveAccessibleDescription(new RegExp(defaultOff));
    expect(control).toHaveAccessibleDescription(new RegExp(irreversible));
    expect(panel).toHaveTextContent(scope);
    expect(pullwiseApi.account.updateExpenseRetention).not.toHaveBeenCalled();
  });
});
