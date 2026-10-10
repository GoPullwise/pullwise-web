import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { T, useLang } from "../i18n.jsx";
import { I, Icon } from "../icons.jsx";
import { createFrameResizeObserver } from "../lib/resize-observer.js";
import { COMMON_CURRENCIES, CURRENCY_PICKER_COPY } from "../locales/currency-picker.js";
import "./currency-picker.css";

const CUSTOM_INDEX = COMMON_CURRENCIES.length;
const validCode = (code) => /^[A-Z]{3}$/.test(code);
const copy = (key) => T(...CURRENCY_PICKER_COPY[key]);

function focusWithoutScroll(element) {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export function CurrencyPicker({ id, label, value, onChange, disabled = false, required = false }) {
  const lang = useLang();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const customRef = useRef(null);
  const optionRefs = useRef(new Map());
  const selected = COMMON_CURRENCIES.findIndex((currency) => currency.code === value);
  const selectedIndex = selected < 0 ? (value ? CUSTOM_INDEX : 0) : selected;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [position, setPosition] = useState({ side: "bottom", maxHeight: 380, offset: null });
  const visible = open && !disabled;
  const listId = `${id}-listbox`;
  const codeId = `${id}-custom-code`;
  const helpId = `${id}-custom-help`;
  const optionId = (index) => `${id}-option-${index}`;

  function close(restoreFocus = true) {
    setOpen(false);
    setCustomOpen(false);
    setDraft("");
    if (restoreFocus && !disabled) focusWithoutScroll(triggerRef.current);
  }

  function show(index = selectedIndex) {
    if (disabled) return;
    setActiveIndex(index);
    setCustomOpen(false);
    setDraft("");
    setOpen(true);
  }

  function commit(code) {
    if (disabled || !validCode(code)) return;
    onChange(code);
    close();
  }

  function choose(index) {
    if (disabled) return;
    if (index === CUSTOM_INDEX) {
      setActiveIndex(index);
      setDraft(selected < 0 && typeof value === "string" ? value.toUpperCase() : "");
      setCustomOpen(true);
    } else {
      const currency = COMMON_CURRENCIES[index];
      if (currency) commit(currency.code);
    }
  }

  useEffect(() => {
    setOpen(false);
    setCustomOpen(false);
    setDraft("");
  }, [value, disabled]);

  useEffect(() => {
    if (!visible) return undefined;
    const dismiss = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setCustomOpen(false);
        setDraft("");
        // Let a clicked control take focus normally after pointerdown.
        if (rootRef.current?.contains(document.activeElement)) focusWithoutScroll(triggerRef.current);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [visible]);

  useLayoutEffect(() => {
    if (!visible) return undefined;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      const anchor = rootRef.current?.getBoundingClientRect();
      if (!rect || !anchor) return;
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const viewportBottom = top + (viewport?.height || window.innerHeight);
      const dock = window.innerWidth <= 760 ? document.querySelector(".product-workspace .side") : null;
      const dockTop = dock?.getBoundingClientRect().top;
      const bottom = Number.isFinite(dockTop) && dockTop > top
        ? Math.min(viewportBottom, dockTop) : viewportBottom;
      const headerBottom = document.querySelector(".product-workspace .topbar")?.getBoundingClientRect().bottom;
      const visibleTop = Number.isFinite(headerBottom) && headerBottom > top
        ? Math.min(bottom, headerBottom) : top;
      const safeTop = visibleTop + 8;
      const safeBottom = Math.max(safeTop, bottom - 8);
      const upperEdge = Math.max(safeTop, Math.min(rect.top - 4, safeBottom));
      const lowerEdge = Math.min(safeBottom, Math.max(rect.bottom + 4, safeTop));
      const above = upperEdge - safeTop;
      const below = safeBottom - lowerEdge;
      const side = below < 240 && above > below ? "top" : "bottom";
      // The trigger can move behind sticky chrome during native focus or scroll.
      // Clamp the popup edge as well as its height so it remains fully reachable.
      setPosition({
        side,
        maxHeight: Math.max(1, Math.min(420, side === "top" ? above : below)),
        offset: side === "top" ? anchor.bottom - upperEdge : lowerEdge - anchor.top,
      });
    };
    measure();
    const observer = createFrameResizeObserver(measure);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [visible, customOpen]);

  useLayoutEffect(() => {
    if (visible && customOpen) focusWithoutScroll(customRef.current);
  }, [visible, customOpen]);

  useLayoutEffect(() => {
    if (!visible) return;
    const list = listRef.current;
    const option = optionRefs.current.get(activeIndex);
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [visible, activeIndex, customOpen, position.maxHeight, lang]);

  function onTriggerKeyDown(event) {
    if (disabled) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? CUSTOM_INDEX
        : Math.max(0, Math.min(CUSTOM_INDEX, activeIndex + (event.key === "ArrowDown" ? 1 : -1)));
      if (!visible) show(event.key === "Home" || event.key === "End" ? next : selectedIndex);
      else setActiveIndex(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (visible) choose(activeIndex);
      else show();
    }
  }

  return (
    <div
      className="currency-picker"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close(false);
      }}
      onKeyDown={(event) => {
        if (visible && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        className="currency-picker-trigger"
        id={id}
        ref={triggerRef}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={visible}
        aria-controls={visible ? listId : undefined}
        aria-activedescendant={visible ? optionId(activeIndex) : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => visible ? close() : show()}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={value ? "currency-picker-value" : "currency-picker-placeholder"}>{value || copy("choose")}</span>
        <Icon d="m6 9 6 6 6-6" size={16} aria-hidden="true" />
      </button>
      {visible && (
        <div
          className="currency-picker-popover"
          data-side={position.side}
          style={{
            maxHeight: `${position.maxHeight}px`,
            ...(position.offset === null ? {} : position.side === "top"
              ? { top: "auto", bottom: `${position.offset}px` }
              : { top: `${position.offset}px`, bottom: "auto" }),
          }}
        >
          <ul className="currency-picker-options" id={listId} ref={listRef} role="listbox" aria-label={label}>
            {[...COMMON_CURRENCIES, { code: null }].map((currency, index) => (
              <li
                key={currency.code || "custom"}
                id={optionId(index)}
                ref={(node) => {
                  if (node) optionRefs.current.set(index, node);
                  else optionRefs.current.delete(index);
                }}
                className={"currency-picker-option" + (activeIndex === index ? " is-active" : "")}
                role="option"
                aria-selected={Boolean(value) && selectedIndex === index}
                onPointerMove={(event) => {
                  if (event.pointerType !== "touch") setActiveIndex(index);
                }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                <span>{currency.code ? `${currency.code} - ${currency.names[lang] || currency.names.en}` : copy("custom")}</span>
                {Boolean(value) && selectedIndex === index && <I.Check size={16} aria-hidden="true" />}
              </li>
            ))}
          </ul>
          {customOpen && (
            <div className="currency-picker-custom" role="group" aria-label={copy("custom")}>
              <label htmlFor={codeId}>{copy("code")}</label>
              <input
                id={codeId}
                ref={customRef}
                type="text"
                maxLength={3}
                pattern="[A-Za-z]{3}"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-describedby={helpId}
                value={draft}
                onChange={(event) => setDraft(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!event.isComposing && !event.nativeEvent.isComposing) commit(draft);
                  }
                }}
              />
              <p id={helpId}>{copy("help")}</p>
              <button className="btn" type="button" disabled={disabled || !validCode(draft)} onClick={() => commit(draft)}>
                {copy("use")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
