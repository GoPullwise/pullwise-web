import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencyPicker } from "./currency-picker.jsx";
import { COMMON_CURRENCIES } from "../locales/currency-picker.js";
import { setLang } from "../i18n.jsx";
import { installAnimationFrameMock } from "../test/animation-frame.js";

afterEach(async () => {
  await act(async () => {
    await setLang("en");
  });
});

function harness(props = {}) {
  const onChange = props.onChange || vi.fn();
  function Example() {
    const [value, setValue] = useState(props.value ?? "USD");
    return (
      <>
        <label htmlFor="fixture-currency">Currency</label>
        <CurrencyPicker
          id="fixture-currency"
          label="Currency"
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          disabled={props.disabled}
          required
        />
        <button type="button">Outside action</button>
        <output aria-label="Parent currency">{value}</output>
      </>
    );
  }
  return { ...render(<Example />), onChange };
}

const trigger = () => screen.getByRole("combobox", { name: "Currency", exact: true });
function custom(code) {
  fireEvent.click(trigger());
  fireEvent.click(screen.getByRole("option", { name: "Custom currency", exact: true }));
  const input = screen.getByLabelText("Currency code");
  if (code !== undefined) fireEvent.change(input, { target: { value: code } });
  return input;
}

describe("CurrencyPicker", () => {
  it.each(["en", "zh", "ja", "ko", "fr", "es"])(
    "shows code plus localized names in the %s list and only the selected code when closed",
    async (locale) => {
      await act(async () => {
        await setLang(locale);
      });
      const { onChange } = harness();
      expect(screen.getByLabelText("Currency")).toBe(trigger());
      expect(trigger()).toHaveTextContent(/^USD$/);
      expect(trigger()).toHaveAttribute("aria-expanded", "false");
      expect(trigger()).toHaveAttribute("aria-required", "true");
      fireEvent.click(trigger());
      const list = screen.getByRole("listbox", { name: "Currency" });
      for (const currency of COMMON_CURRENCIES) {
        expect(
          within(list).getByRole("option", {
            name: `${currency.code} - ${currency.names[locale]}`,
            exact: true,
          })
        ).toBeVisible();
      }
      expect(
        within(list).getByRole("option", {
          name: `USD - ${COMMON_CURRENCIES.find((currency) => currency.code === "USD").names[locale]}`,
        })
      ).toHaveAttribute("aria-selected", "true");
      fireEvent.keyDown(trigger(), { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(trigger()).toHaveTextContent(/^USD$/);
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it("commits a common currency as one code and restores trigger focus", async () => {
    const user = userEvent.setup();
    const { onChange } = harness();
    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: /^EUR - / }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("EUR");
    expect(trigger()).toHaveTextContent(/^EUR$/);
    expect(trigger()).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps custom text separate from the parent until explicit confirmation", () => {
    const { onChange } = harness();
    const input = custom("se");
    expect(input).toHaveValue("SE");
    expect(input).toHaveFocus();
    expect(trigger()).toHaveTextContent(/^USD$/);
    expect(screen.getByLabelText("Parent currency")).toHaveTextContent(/^USD$/);
    expect(onChange).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Use currency code" });
    expect(confirm).toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "sek" } });
    expect(input).toHaveValue("SEK");
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("SEK");
    expect(trigger()).toHaveTextContent(/^SEK$/);
    expect(trigger()).toHaveFocus();
  });

  it("discards custom changes on Escape and outside click without stealing outside focus", async () => {
    const user = userEvent.setup();
    const { onChange } = harness({ value: "EUR" });
    const input = custom("SEK");
    await user.keyboard("{Escape}");
    expect(input).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent(/^EUR$/);
    expect(trigger()).toHaveFocus();
    custom("NOK");
    const outside = screen.getByRole("button", { name: "Outside action" });
    await user.click(outside);
    expect(screen.queryByLabelText("Currency code")).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
    expect(trigger()).toHaveTextContent(/^EUR$/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses keyboard selection and Enter without submitting the containing form", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <CurrencyPicker id="keyboard-currency" label="Currency" value="USD" onChange={onChange} />
        <button type="submit">Save expense</button>
      </form>
    );
    trigger().focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox", { name: "Currency" })).toBeVisible();
    await user.keyboard("{Home}");
    const first = screen.getAllByRole("option")[0];
    expect(trigger()).toHaveAttribute("aria-activedescendant", first.id);
    const firstCode = first.textContent.split(" - ")[0];
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(firstCode);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}{End}{Enter}");
    const input = screen.getByLabelText("Currency code");
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "nok{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("NOK");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes and discards custom text on focus leaving the picker", async () => {
    const user = userEvent.setup();
    const { onChange } = harness();
    custom("NOK");
    const outside = screen.getByRole("button", { name: "Outside action" });
    fireEvent.blur(screen.getByLabelText("Currency code"), { relatedTarget: outside });
    outside.focus();
    expect(screen.queryByLabelText("Currency code")).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent(/^USD$/);
    expect(onChange).not.toHaveBeenCalled();
    await user.click(trigger());
    expect(screen.getByRole("listbox")).toBeVisible();
  });

  it("preserves an unknown existing code without normalization or automatic changes", () => {
    const { onChange } = harness({ value: "ZZZ" });
    expect(trigger()).toHaveTextContent(/^ZZZ$/);
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "Escape" });
    expect(trigger()).toHaveTextContent(/^ZZZ$/);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables selection and closes an open custom draft when its parent becomes busy", () => {
    const onChange = vi.fn();
    const view = render(
      <CurrencyPicker id="busy-currency" label="Currency" value="USD" onChange={onChange} />
    );
    custom("SEK");
    view.rerender(
      <CurrencyPicker
        id="busy-currency"
        label="Currency"
        value="USD"
        onChange={onChange}
        disabled
      />
    );
    expect(trigger()).toBeDisabled();
    expect(screen.queryByLabelText("Currency code")).not.toBeInTheDocument();
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["close", "unmount"])(
    "repositions from queued resize notifications and cancels pending positioning on %s",
    (completion) => {
      const frames = installAnimationFrameMock();
      const observers = [];
      vi.stubGlobal("innerHeight", 800);
      vi.stubGlobal("visualViewport", undefined);
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(callback) {
            this.notify = callback;
            this.disconnect = vi.fn();
            observers.push(this);
          }
          observe() {}
        }
      );
      let anchorTop = 100;
      const bounds = vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(() => ({
          top: anchorTop,
          bottom: anchorTop + 44,
          left: 0,
          right: 240,
          width: 240,
          height: 44,
          x: 0,
          y: anchorTop,
          toJSON() {},
        }));
      let view;
      try {
        view = harness();
        fireEvent.click(trigger());
        const popover = screen.getByRole("listbox").closest(".currency-picker-popover");
        expect(popover).toHaveAttribute("data-side", "bottom");
        const observer = observers.at(-1);
        bounds.mockClear();
        anchorTop = 300;
        act(() => observer.notify());
        anchorTop = 650;
        act(() => observer.notify());
        expect(bounds).not.toHaveBeenCalled();
        expect(popover).toHaveAttribute("data-side", "bottom");
        act(() => frames.flush());
        expect(popover).toHaveAttribute("data-side", "top");
        expect(trigger()).toHaveTextContent(/^USD$/);
        expect(view.onChange).not.toHaveBeenCalled();

        // Queue a return to the lower edge, then close before it can measure.
        anchorTop = 50;
        act(() => observer.notify());
        const pendingFrame = frames.request.mock.results.at(-1).value;
        bounds.mockClear();
        if (completion === "close") fireEvent.keyDown(trigger(), { key: "Escape" });
        else view.unmount();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(observer.disconnect).toHaveBeenCalledOnce();
        expect(frames.cancel).toHaveBeenCalledWith(pendingFrame);
        act(() => {
          observer.notify();
          frames.flush();
        });
        expect(bounds).not.toHaveBeenCalled();
        expect(view.onChange).not.toHaveBeenCalled();

        if (completion === "close") {
          expect(trigger()).toHaveFocus();
          fireEvent.click(trigger());
          const reopened = screen.getByRole("listbox").closest(".currency-picker-popover");
          expect(reopened).toHaveAttribute("data-side", "bottom");
          bounds.mockClear();
          anchorTop = 650;
          act(() => {
            observer.notify();
            frames.flush();
          });
          expect(bounds).not.toHaveBeenCalled();
          expect(reopened).toHaveAttribute("data-side", "bottom");
        }
      } finally {
        view?.unmount();
        bounds.mockRestore();
        vi.unstubAllGlobals();
      }
    }
  );
});
