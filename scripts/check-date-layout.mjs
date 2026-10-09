import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import {
  createDateLayoutFixture,
  ARCHIVED_CATEGORY_NAME,
  DEVELOPMENT_URL,
  EXPENSE_PURPOSE,
  LARGE_RULE_AMOUNT,
  LONG_CATEGORY_NAME,
  PROJECT_ID,
  PRODUCT_URL,
  RULE_PURPOSE,
  SECOND_RULE_PURPOSE,
  WORKSPACE_ID,
} from "./date-layout-fixtures.mjs";

// Run after building dist. These are isolated browser-engine layout checks,
// not iOS/Android device acceptance or evidence of an old Safari reproduction.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:4248";
const tolerance = 1;
const profiles = [
  { name: "desktop-1440", width: 1440, height: 1000, lang: "en", touch: false },
  { name: "tablet-1280-zh", width: 1280, height: 900, lang: "zh", touch: true },
  { name: "phone-390-to-320", width: 390, narrow: 320, height: 844, lang: "en", touch: true },
  {
    name: "android-size-412-to-360",
    width: 412,
    narrow: 360,
    height: 844,
    lang: "en",
    touch: true,
  },
];
const requested = process.argv.slice(2);
assert(
  requested.length === 0 ||
    (requested.length === 1 && /^--browser=(chromium|webkit|firefox)$/.test(requested[0])),
  "Usage: node scripts/check-date-layout.mjs [--browser=chromium|webkit|firefox]"
);
const engines = requested.length ? [requested[0].split("=")[1]] : ["chromium", "webkit", "firefox"];
const currencyStyles = await readFile(join(root, "styles", "base.css"), "utf8");
const currencyCodes = [
  ...new Set(
    Array.from(
      currencyStyles.matchAll(
        /\.financial-value-currency\[data-currency="([A-Z]{3})"\]\s*\{\s*--financial-currency-hue:\s*[\d.]+\s*;/g
      ),
      ([, code]) => code
    )
  ),
].sort();
assert(currencyCodes.length > 1, "No distinct currency color rules were found in base.css");
assert(!currencyCodes.includes("ZZZ"), "ZZZ must remain an unsupported neutral currency probe");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
    );
  });
}

async function geometry(page) {
  return page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const grids = Array.from(document.querySelectorAll(".ledger-fields, .ledger-filters"))
      .filter(visible)
      .map((grid) => ({
        className: grid.className,
        gap: Number.parseFloat(getComputedStyle(grid).columnGap),
        rect: rect(grid),
        fields: Array.from(grid.children)
          .filter(visible)
          .flatMap((field) =>
            Array.from(field.querySelectorAll('input:not([type="checkbox"]), select'))
              .filter(visible)
              .map((control) => ({
                field: rect(field),
                control: rect(control),
                tag: control.tagName,
                type: control.type,
                value: control.value,
                fontSize: Number.parseFloat(getComputedStyle(control).fontSize),
                nativeDate: control.tagName === "INPUT" && control.type === "date",
                showPicker: typeof control.showPicker === "function",
                dateNumber: control.type === "date" && control.value ? control.valueAsNumber : null,
              }))
          ),
      }));
    return {
      coarse: matchMedia("(pointer: coarse)").matches,
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      grids,
    };
  });
}

function checkGeometry(measured, label, touch) {
  assert(measured.grids.length > 0, `${label}: no visible ledger fields measured`);
  if (touch !== null) assert.equal(measured.coarse, touch, `${label}: unexpected pointer media`);
  assert(
    measured.documentWidth <= measured.viewport + tolerance,
    `${label}: document overflows its viewport (${measured.documentWidth}/${measured.viewport})`
  );
  let dates = 0;
  for (const grid of measured.grids) {
    for (const field of grid.fields) {
      const { control, field: bounds } = field;
      assert(
        control.left >= bounds.left - tolerance && control.right <= bounds.right + tolerance,
        `${label}: ${field.type} control overflows field ${JSON.stringify(field)}`
      );
      assert(
        Math.abs(control.left - bounds.left) <= tolerance &&
          Math.abs(control.right - bounds.right) <= tolerance,
        `${label}: ${field.type} border box does not align with its field ${JSON.stringify(field)}`
      );
      assert(
        bounds.left >= grid.rect.left - tolerance && bounds.right <= grid.rect.right + tolerance,
        `${label}: field escapes grid ${JSON.stringify(field)}`
      );
      if (measured.coarse) {
        assert(control.height >= 44 - tolerance, `${label}: touch control shorter than 44px`);
      }
      if (measured.coarse || measured.viewport <= 760) {
        assert(field.fontSize >= 16 - 0.05, `${label}: touch font smaller than 16px`);
      }
      if (field.type === "date") {
        dates += 1;
        assert(field.nativeDate, `${label}: date field replaced with a custom control`);
        assert(
          !field.value || Number.isFinite(field.dateNumber),
          `${label}: native date value unsupported`
        );
        for (const sibling of grid.fields) {
          if (sibling === field || sibling.type === "date") continue;
          // At narrow widths date/amount/currency occupy the same column;
          // at wider widths compare equal column widths, rather than x positions.
          if (Math.abs(sibling.field.left - bounds.left) <= tolerance)
            assert(
              Math.abs(sibling.control.right - control.right) <= tolerance,
              `${label}: date right edge differs from same-column ${sibling.type}`
            );
          if (Math.abs(sibling.field.width - bounds.width) <= tolerance)
            assert(
              Math.abs(sibling.control.width - control.width) <= tolerance,
              `${label}: date width differs from equal-width ${sibling.type} field`
            );
        }
      }
    }
    const byColumn = [...grid.fields].sort((left, right) => left.field.left - right.field.left);
    for (let index = 0; index < byColumn.length; index += 1) {
      const left = byColumn[index];
      for (const right of byColumn.slice(index + 1)) {
        if (Math.abs(left.field.top - right.field.top) > tolerance) continue;
        assert(
          right.control.left - left.control.right >= Math.max(16, grid.gap) - tolerance,
          `${label}: adjacent controls overlap or consume the grid gap ${JSON.stringify({ left, right })}`
        );
      }
    }
  }
  assert(dates > 0, `${label}: no native date control measured`);
  return {
    grids: measured.grids.length,
    dates,
    showPickerControls: measured.grids
      .flatMap((grid) => grid.fields)
      .filter((field) => field.nativeDate && field.showPicker).length,
    dateValues: measured.grids
      .flatMap((grid) => grid.fields)
      .filter((field) => field.nativeDate)
      .map((field) => field.value),
    coarse: measured.coarse,
    viewport: measured.viewport,
  };
}

async function measure(page, report, name) {
  await settle(page);
  const measured = await geometry(page);
  const touch = report.engine === "firefox" ? null : report.profile.touch;
  report.states.push({
    name,
    ...checkGeometry(measured, name, touch),
    presentation: await checkPresentation(page, name),
  });
}

function inside(bounds, container) {
  return (
    bounds.left >= container.left - tolerance &&
    bounds.right <= container.right + tolerance &&
    bounds.top >= container.top - tolerance &&
    bounds.bottom <= container.bottom + tolerance
  );
}

function insideInline(bounds, container) {
  return bounds.left >= container.left - tolerance && bounds.right <= container.right + tolerance;
}

function overlaps(left, right) {
  return (
    Math.min(left.right, right.right) - Math.max(left.left, right.left) > tolerance &&
    Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > tolerance
  );
}

function computedRgb(value) {
  const match = /^rgba?\((.+)\)$/.exec(value);
  assert(match, `Unsupported computed RGB color: ${value}`);
  const parts = match[1].trim().split(/[\s,/]+/);
  assert([3, 4].includes(parts.length), `Invalid computed RGB color: ${value}`);
  const channels = parts
    .slice(0, 3)
    .map((part) => (part.endsWith("%") ? (Number.parseFloat(part) * 255) / 100 : Number(part)));
  const alpha =
    parts.length === 3
      ? 1
      : parts[3].endsWith("%")
        ? Number.parseFloat(parts[3]) / 100
        : Number(parts[3]);
  assert(
    channels.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255) &&
      Number.isFinite(alpha) &&
      alpha >= 0 &&
      alpha <= 1,
    `Invalid computed RGB channels: ${value}`
  );
  return [...channels, alpha];
}

function compositeRgb(foreground, background) {
  const alpha = foreground[3] + background[3] * (1 - foreground[3]);
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    ...foreground
      .slice(0, 3)
      .map(
        (channel, index) =>
          (channel * foreground[3] + background[index] * background[3] * (1 - foreground[3])) /
          alpha
      ),
    alpha,
  ];
}

function rgbLuminance(rgb) {
  const linear = rgb.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function currencyContrast(palette) {
  // Fold every actual ancestor background into the badge background so an
  // alpha color is checked against its rendered surface, not transparent black.
  const background = palette.backgrounds.reduce(
    (surface, color) => compositeRgb(computedRgb(color), surface),
    [255, 255, 255, 1]
  );
  const foreground = compositeRgb(computedRgb(palette.foreground), background);
  const luminances = [rgbLuminance(foreground), rgbLuminance(background)].sort((a, b) => a - b);
  return (luminances[1] + 0.05) / (luminances[0] + 0.05);
}

async function checkCurrencyPalette(page) {
  const measured = await page.evaluate((codes) => {
    const source = document.querySelector(".ledger-expense-row .financial-value-money");
    if (!source) throw new Error("Currency contrast probe has no actual expense value to clone");
    const probe = source.cloneNode(true);
    const badge = probe.querySelector(".financial-value-currency");
    if (!badge) throw new Error("Currency contrast probe has no currency badge");
    const previousTheme = document.documentElement.getAttribute("data-theme");
    probe.setAttribute("aria-hidden", "true");
    Object.assign(probe.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      visibility: "hidden",
      pointerEvents: "none",
    });
    source.parentElement.append(probe);
    const palettes = [];
    try {
      for (const theme of ["light", "dark"]) {
        document.documentElement.setAttribute("data-theme", theme);
        for (const code of [...codes, "ZZZ"]) {
          badge.setAttribute("data-currency", code);
          badge.textContent = code;
          const style = getComputedStyle(badge);
          const backgrounds = [];
          for (let element = badge; element; element = element.parentElement)
            backgrounds.unshift(getComputedStyle(element).backgroundColor);
          palettes.push({
            theme,
            currency: code,
            foreground: style.color,
            background: style.backgroundColor,
            backgrounds,
          });
        }
      }
      return palettes;
    } finally {
      probe.remove();
      if (previousTheme === null) document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", previousTheme);
    }
  }, currencyCodes);
  assert.equal(
    measured.length,
    (currencyCodes.length + 1) * 2,
    "Currency palette probe is incomplete"
  );
  const themes = [];
  for (const theme of ["light", "dark"]) {
    const palettes = measured.filter((palette) => palette.theme === theme);
    const contrasts = palettes.map((palette) => {
      const contrast = currencyContrast(palette);
      assert(
        contrast >= 4.5,
        `${theme}/${palette.currency}: currency badge contrast ${contrast.toFixed(2)} is below 4.5:1 ${JSON.stringify(palette)}`
      );
      return contrast;
    });
    const signatures = new Set(
      palettes.map((palette) => `${palette.foreground}/${palette.background}`)
    );
    assert.equal(
      signatures.size,
      palettes.length,
      `${theme}: built-in currencies and neutral fallback do not have distinct palettes`
    );
    const unknown = palettes.find((palette) => palette.currency === "ZZZ");
    for (const color of [unknown.foreground, unknown.background]) {
      const [red, green, blue] = computedRgb(color);
      assert(
        red === green && green === blue,
        `${theme}: unsupported currency is not neutral ${color}`
      );
    }
    themes.push({
      theme,
      minimumContrast: Number(Math.min(...contrasts).toFixed(2)),
      distinctPalettes: signatures.size,
      neutral: { foreground: unknown.foreground, background: unknown.background },
    });
  }
  return { currencies: currencyCodes, unsupportedCurrency: "ZZZ", themes };
}

async function checkPresentation(page, name) {
  const measured = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const textGeometry = (element) => {
      if (!element) return null;
      const range = document.createRange();
      range.selectNodeContents(element);
      const style = getComputedStyle(element);
      return {
        rect: rect(element),
        text: element.textContent,
        fragments: Array.from(range.getClientRects())
          .filter((bounds) => bounds.width > 0 && bounds.height > 0)
          .map((bounds) => ({
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
          })),
        fontSize: Number.parseFloat(style.fontSize),
        currencyCode: element.getAttribute("data-currency"),
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        textOverflow: style.textOverflow,
      };
    };
    const rows = Array.from(
      document.querySelectorAll(".ledger-expense-row, .recurring-expenses-row")
    )
      .filter((row) => row.getClientRects().length > 0)
      .map((row) => {
        const value = row.querySelector(".financial-value");
        const side = row.querySelector(".ledger-row-side, .recurring-expenses-side");
        return {
          ordinary: row.classList.contains("ledger-expense-row"),
          purpose: row.querySelector("h3")?.textContent,
          row: rect(row),
          side: side ? textGeometry(side) : null,
          value: textGeometry(value),
          currency: textGeometry(value?.querySelector(".financial-value-currency")),
          number: textGeometry(value?.querySelector(".financial-value-number")),
          actions: Array.from(row.querySelectorAll(".ledger-actions, .panel-actions")).map(rect),
          actionGroups: Array.from(row.querySelectorAll(".ledger-actions, .panel-actions")).map(
            (group) => ({
              rect: rect(group),
              buttons: Array.from(group.querySelectorAll("button")).map(rect),
            })
          ),
        };
      });
    const header = document.querySelector(".ledger-project .page-h");
    const identity = header?.querySelector(".ledger-project-identity");
    const shortcuts = identity?.querySelector(".ledger-project-shortcuts");
    return {
      rows,
      projectCurrencies: Array.from(
        document.querySelectorAll(".ledger-project-total .financial-value-currency")
      ).map((badge) => ({
        text: badge.textContent,
        currencyCode: badge.getAttribute("data-currency"),
      })),
      header: header
        ? {
            rect: rect(header),
            main: rect(header.closest(".main")),
            identity: textGeometry(identity),
            title: textGeometry(identity?.querySelector("h1")),
            description: textGeometry(identity?.querySelector(".sub")),
            shortcuts: shortcuts ? rect(shortcuts) : null,
            metadata: textGeometry(shortcuts?.querySelector(".ledger-meta")),
            items: Array.from(shortcuts?.children || []).map(textGeometry),
            links: Array.from(shortcuts?.querySelectorAll("a") || []).map((link) => ({
              ...textGeometry(link),
              href: link.href,
              target: link.target,
              rel: link.rel,
            })),
            actions: Array.from(header.querySelectorAll(":scope > .actions")).map(rect),
          }
        : null,
    };
  });
  const expected = new Map([
    [EXPENSE_PURPOSE, "USD 12.00"],
    [RULE_PURPOSE, "USD 24.50"],
    [SECOND_RULE_PURPOSE, `USD ${LARGE_RULE_AMOUNT}`],
  ]);
  assert.equal(
    measured.rows.length,
    3,
    `${name}: financial fixtures did not render all three records`
  );
  for (const row of measured.rows) {
    const details = JSON.stringify(row);
    assert(
      row.value && row.currency && row.number && row.side,
      `${name}: financial currency/number parts are missing ${details}`
    );
    assert.equal(
      row.value.text,
      expected.get(row.purpose),
      `${name}: displayed financial text changed precision`
    );
    assert.equal(row.currency.text, "USD", `${name}: currency text changed`);
    assert.equal(
      row.currency.currencyCode,
      row.currency.text,
      `${name}: ordinary/recurring currency color does not identify its displayed code`
    );
    assert.equal(
      row.number.text,
      expected.get(row.purpose)?.slice(4),
      `${name}: amount text changed precision`
    );
    assert(
      row.number.fontSize > row.currency.fontSize,
      `${name}: currency and amount have no visible type hierarchy ${details}`
    );
    for (const part of [row.value, row.currency, row.number, row.side]) {
      assert(
        !["hidden", "clip"].includes(part.overflowX) &&
          !["hidden", "clip"].includes(part.overflowY) &&
          part.textOverflow !== "ellipsis",
        `${name}: financial content can be clipped ${details}`
      );
    }
    for (const part of [row.currency, row.number]) {
      // Inline font boxes can extend vertically beyond their CSS line box.
      // The record must contain the full text; the side column constrains its
      // inline extent while visible overflow preserves ordinary font metrics.
      assert(
        inside(part.rect, row.row) && insideInline(part.rect, row.side.rect),
        `${name}: financial part escapes its row/side bounds ${details}`
      );
      assert(part.fragments.length > 0, `${name}: financial part has no rendered text ${details}`);
      for (const fragment of part.fragments) {
        assert(
          inside(fragment, row.row) && insideInline(fragment, row.side.rect),
          `${name}: financial text escapes its row/side bounds ${details}`
        );
        assert(
          row.actions.every((action) => !overlaps(fragment, action)),
          `${name}: financial text overlaps row actions ${details}`
        );
      }
    }
    if (row.ordinary && row.actionGroups.length > 0) {
      const amountBottom = Math.max(
        row.currency.rect.bottom,
        row.number.rect.bottom,
        ...row.currency.fragments.map((fragment) => fragment.bottom),
        ...row.number.fragments.map((fragment) => fragment.bottom)
      );
      for (const group of row.actionGroups) {
        assert(
          group.rect.top >= amountBottom + 4 - tolerance,
          `${name}: ordinary expense amount is not above its actions with a clear gap ${details}`
        );
        assert(
          inside(group.rect, row.row) && insideInline(group.rect, row.side.rect),
          `${name}: ordinary expense actions escape the record ${details}`
        );
        for (let index = 0; index < group.buttons.length; index += 1) {
          const button = group.buttons[index];
          assert(
            inside(button, group.rect),
            `${name}: ordinary expense action escapes its group ${details}`
          );
          for (const sibling of group.buttons.slice(index + 1)) {
            assert(
              Math.abs(button.top - sibling.top) <= tolerance &&
                button.right <= sibling.left + tolerance,
              `${name}: ordinary expense edit/remove actions do not share a horizontal row ${details}`
            );
          }
        }
      }
    }
  }
  for (const badge of measured.projectCurrencies) {
    assert.equal(
      badge.currencyCode,
      badge.text,
      `${name}: project total currency color does not identify its displayed code`
    );
  }
  if (measured.header) {
    const header = measured.header;
    const details = JSON.stringify(header);
    assert(
      header.identity && header.title && header.description && header.shortcuts && header.metadata,
      `${name}: project header metadata is incomplete ${details}`
    );
    assert(
      inside(header.rect, header.main),
      `${name}: project header escapes main bounds ${details}`
    );
    assert.equal(header.links.length, 2, `${name}: project header did not render both shortcuts`);
    assert.deepEqual(
      header.links.map((link) => link.href),
      [DEVELOPMENT_URL, PRODUCT_URL],
      `${name}: project shortcut destinations changed`
    );
    for (const content of [header.title, header.description, ...header.items]) {
      assert(
        inside(content.rect, header.identity.rect),
        `${name}: project header item escapes identity bounds ${details}`
      );
      for (const fragment of content.fragments) {
        assert(
          inside(fragment, header.identity.rect),
          `${name}: project header text overflows identity bounds ${details}`
        );
        assert(
          header.actions.every((action) => !overlaps(fragment, action)),
          `${name}: project header text overlaps its actions ${details}`
        );
      }
    }
    for (let index = 0; index < header.items.length; index += 1) {
      assert(
        inside(header.items[index].rect, header.shortcuts),
        `${name}: shortcut escapes metadata group ${details}`
      );
      for (const sibling of header.items.slice(index + 1)) {
        assert(
          !overlaps(header.items[index].rect, sibling.rect),
          `${name}: project metadata/link items overlap ${details}`
        );
      }
    }
    for (const link of header.links) {
      assert(
        link.target === "_blank" &&
          link.rel.split(/\s+/).includes("noopener") &&
          link.rel.split(/\s+/).includes("noreferrer"),
        `${name}: project shortcut lost native safe-link behavior`
      );
    }
  }
  return {
    money: measured.rows.map((row) => ({
      value: row.value.text,
      numberLines: new Set(row.number.fragments.map((fragment) => Math.round(fragment.top))).size,
    })),
    projectHeader: measured.header
      ? {
          links: measured.header.links.map((link) => link.href),
          metadataRows: new Set(measured.header.items.map((item) => Math.round(item.rect.top)))
            .size,
        }
      : null,
  };
}

async function negativeControl(page, report) {
  const date = page.locator('.ledger-filter-strip input[type="date"]').first();
  const oldStyle = await date.getAttribute("style");
  try {
    // Deliberately inject an oversized host control. This proves the bounds
    // checker fails; it is not a simulation or reproduction of Safari's bug.
    await date.evaluate((element) => {
      element.style.setProperty("width", "calc(100% + 24px)", "important");
      element.style.setProperty("inline-size", "calc(100% + 24px)", "important");
      element.style.setProperty("max-width", "none", "important");
      element.style.setProperty("max-inline-size", "none", "important");
    });
    await settle(page);
    const injectedMeasurement = await geometry(page);
    assert.throws(
      () =>
        checkGeometry(
          injectedMeasurement,
          "injected oversized control",
          report.engine === "firefox" ? null : report.profile.touch
        ),
      /overflows (?:field|its viewport)/,
      "Bounds checker did not reject the controlled 24px overflow"
    );
  } finally {
    await date.evaluate((element, style) => {
      if (style === null) element.removeAttribute("style");
      else element.setAttribute("style", style);
    }, oldStyle);
  }
  report.negativeControl = "24px injected overflow rejected; inline style restored";
  await measure(page, report, "negative-control-restored");
}

function paneTargets(page, panelSelector) {
  const panel = page.locator(panelSelector);
  const split = panel.locator("..");
  return { panel, split, handle: split.locator(":scope > .ledger-split-resizer") };
}

async function checkPaneWidth(page, panelSelector, width, name) {
  await page.waitForFunction(
    ({ selector, expected }) =>
      Number(
        document
          .querySelector(selector)
          ?.parentElement.querySelector(":scope > .ledger-split-resizer")
          ?.getAttribute("aria-valuenow")
      ) === expected,
    { selector: panelSelector, expected: width }
  );
  const { panel, split } = paneTargets(page, panelSelector);
  const actual = await panel.evaluate((element) => element.getBoundingClientRect().width);
  assert(
    Math.abs(actual - width) <= tolerance,
    `${name}: actual pane width ${actual}, expected ${width}`
  );
  assert(
    !(await split.getAttribute("class")).includes("is-resizing"),
    `${name}: drag capture not released`
  );
}

async function dragSide(
  page,
  width,
  report,
  name,
  panelSelector = "#expense-form",
  measureState = measure
) {
  const { handle } = paneTargets(page, panelSelector);
  await handle.scrollIntoViewIfNeeded();
  const initial = Number(await handle.getAttribute("aria-valuenow"));
  const maximum = Number(await handle.getAttribute("aria-valuemax"));
  assert(maximum >= width, `${name}: pane cannot reach ${width}px (${maximum})`);
  const bounds = await handle.boundingBox();
  assert(bounds, `${name}: divider has no pointer geometry`);
  const point = {
    x: bounds.x + bounds.width / 2,
    y: Math.max(80, Math.min(bounds.y + bounds.height / 2, page.viewportSize().height - 48)),
  };
  assert(
    await handle.evaluate(
      (element, position) => element.contains(document.elementFromPoint(position.x, position.y)),
      point
    ),
    `${name}: divider pointer position is obscured`
  );
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  try {
    await page.mouse.move(point.x + initial - width, point.y, { steps: 8 });
  } finally {
    await page.mouse.up();
  }
  await checkPaneWidth(page, panelSelector, width, name);
  await measureState(page, report, name);
}

async function keyboardSide(page, report, name, panelSelector) {
  const { handle } = paneTargets(page, panelSelector);
  const minimum = Number(await handle.getAttribute("aria-valuemin"));
  const maximum = Number(await handle.getAttribute("aria-valuemax"));
  assert(maximum >= minimum + 16, `${name}: divider has no keyboard adjustment range`);
  await handle.focus();
  for (const [key, expected] of [
    ["Home", minimum],
    ["ArrowLeft", minimum + 16],
    ["ArrowRight", minimum],
    ["End", maximum],
  ]) {
    await handle.press(key);
    await checkPaneWidth(page, panelSelector, expected, `${name}-${key}`);
    assert(
      await handle.evaluate((element) => document.activeElement === element),
      `${name}-${key}: divider lost keyboard focus`
    );
    await measure(page, report, `${name}-${key}`);
  }
}

async function measureRecurring(page, report, name, editorOpen) {
  await settle(page);
  const measured = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const rowNodes = Array.from(document.querySelectorAll(".recurring-expenses-row"));
    const primary = rowNodes[0]?.closest(".panel");
    const editor = document.querySelector(".recurring-expenses-editor");
    const split = editor?.parentElement || primary?.parentElement;
    const handle = split?.querySelector(":scope > .ledger-split-resizer");
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      primary: primary ? rect(primary) : null,
      editor: editor ? rect(editor) : null,
      siblingPanels: Boolean(editor && primary && editor.parentElement === primary.parentElement),
      editorInRecord: Boolean(editor?.closest(".recurring-expenses-row")),
      resizing: Boolean(split?.classList.contains("is-resizing")),
      handle: handle
        ? { rect: rect(handle), width: Number(handle.getAttribute("aria-valuenow")) }
        : null,
      rows: rowNodes.map((row) => {
        const style = getComputedStyle(row);
        const children = Array.from(row.children).map(rect);
        return {
          rect: rect(row),
          contentHeight:
            Math.max(...children.map((child) => child.bottom)) -
            Math.min(...children.map((child) => child.top)),
          blockInsets:
            Number.parseFloat(style.paddingTop) +
            Number.parseFloat(style.paddingBottom) +
            Number.parseFloat(style.borderTopWidth) +
            Number.parseFloat(style.borderBottomWidth),
        };
      }),
    };
  });
  const details = JSON.stringify(measured);
  assert(measured.primary, `${name}: recurring primary panel is missing ${details}`);
  assert.equal(measured.rows.length, 2, `${name}: equal-row fixture did not render two records`);
  assert(
    measured.documentWidth <= measured.viewport + tolerance,
    `${name}: recurring layout overflows the viewport ${details}`
  );
  assert(!measured.editorInRecord, `${name}: recurring editor is still inside a record ${details}`);
  const heights = measured.rows.map((row) => row.rect.height);
  assert(
    Math.max(...heights) - Math.min(...heights) <= tolerance,
    `${name}: recurring records are not equally tall ${details}`
  );
  const naturalHeight = Math.max(
    ...measured.rows.map((row) => row.contentHeight + row.blockInsets)
  );
  assert(
    Math.max(...heights) <= naturalHeight + tolerance * 2,
    `${name}: recurring record tracks are stretched beyond their natural content ${details}`
  );
  assert.equal(Boolean(measured.editor), editorOpen, `${name}: unexpected recurring editor state`);
  assert(!measured.resizing, `${name}: recurring divider capture was not released`);
  if (editorOpen) {
    assert(measured.siblingPanels, `${name}: list and editor do not share a split ${details}`);
    if (measured.viewport >= 900) {
      assert(measured.handle, `${name}: desktop recurring divider is missing ${details}`);
      assert(
        measured.editor.left >= measured.primary.right + 48 - tolerance &&
          Math.abs(measured.editor.top - measured.primary.top) <= tolerance,
        `${name}: desktop recurring editor is not in the right-hand pane ${details}`
      );
      assert(
        measured.primary.width >= 280 - tolerance &&
          measured.editor.width >= 260 - tolerance &&
          measured.editor.width <= 520 + tolerance,
        `${name}: recurring panes escape their shared width bounds ${details}`
      );
    } else {
      assert(!measured.handle, `${name}: narrow recurring divider remains interactive ${details}`);
      assert(
        measured.editor.bottom <= measured.primary.top + tolerance &&
          Math.abs(measured.editor.width - measured.primary.width) <= tolerance,
        `${name}: narrow recurring form does not precede the full-width records ${details}`
      );
    }
  } else {
    assert(!measured.handle, `${name}: closed recurring editor left a divider behind ${details}`);
  }
  report.states.push({ name, recurring: measured });
  return measured;
}

async function closeForm(form) {
  await form.locator('.ledger-actions > button[type="button"]').click();
  await form.waitFor({ state: "detached" });
}

async function checkScope(page, report, mode) {
  const path = mode === "shared" ? "/shared" : `/projects/${PROJECT_ID}`;
  if (mode === "shared") {
    await page.locator('.side-i[href="/shared"]').click();
    await page.waitForURL(`${baseURL}${path}`);
  } else await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator(".ledger-expense-row").filter({ hasText: EXPENSE_PURPOSE }).waitFor();
  await page.locator(".recurring-expenses-row").filter({ hasText: RULE_PURPOSE }).waitFor();
  await page.locator(".topbar-loading").waitFor({ state: "detached" });
  await page.locator('[role="tabpanel"][id$="-panel-expenses"][aria-busy="false"]').waitFor();
  const toggle = page.locator('.ledger-view-controls button[aria-controls$="-filters"]');
  await toggle.click();
  await measure(page, report, `${mode}-filters-empty`);
  if (!report.negativeControl) await negativeControl(page, report);
  const filters = page.locator(".ledger-filter-strip");
  await filters.locator('input[type="date"]').nth(0).fill("2026-09-01");
  await filters.locator('input[type="date"]').nth(1).fill("2026-11-01");
  await filters.locator("select").selectOption({ index: 1 });
  await page.locator('[role="tabpanel"][id$="-panel-expenses"][aria-busy="false"]').waitFor();
  await measure(page, report, `${mode}-filters-populated`);
  const csv = new URL(
    await page.locator('a[download="expenses.csv"]').getAttribute("href"),
    baseURL
  );
  assert.equal(csv.searchParams.get("target"), mode);
  assert.equal(csv.searchParams.get("projectId"), mode === "project" ? PROJECT_ID : null);
  assert.equal(csv.searchParams.get("from"), "2026-09-01");
  assert.equal(csv.searchParams.get("to"), "2026-11-01");
  assert.equal(csv.searchParams.get("categoryId"), await filters.locator("select").inputValue());
  assert.equal(csv.searchParams.get("workspaceId"), WORKSPACE_ID);
  await toggle.click();
  await page.locator('.page-h button[aria-controls="expense-form"]').click();
  const form = page.locator("#expense-form > .ledger-form");
  await form.waitFor();
  await measure(page, report, `${mode}-create-empty`);
  await form.locator('.ledger-fields input[type="date"]').first().fill("2026-10-08");
  await measure(page, report, `${mode}-create-populated`);
  if (report.profile.width >= 900) {
    await dragSide(page, 260, report, `${mode}-create-pane-260`);
    await dragSide(page, 520, report, `${mode}-create-pane-520`);
  }
  await form.locator(":scope > .ledger-field > select").selectOption("recurring");
  await measure(page, report, `${mode}-recurring-create-end-empty`);
  await form.locator('.recurring-schedule-fields input[type="date"]').fill("2027-12-31");
  await measure(page, report, `${mode}-recurring-create-end-populated`);
  if (report.profile.narrow) {
    await page.setViewportSize({ width: report.profile.narrow, height: report.profile.height });
    await measure(page, report, `${mode}-live-narrow-recurring-create`);
    await page.setViewportSize({ width: report.profile.width, height: report.profile.height });
  } else {
    await dragSide(page, 260, report, `${mode}-recurring-create-pane-260`);
    await dragSide(page, 520, report, `${mode}-recurring-create-pane-520`);
  }
  await closeForm(form);
  await page.locator(".ledger-expense-row .ledger-actions button[aria-label]").first().click();
  await form.waitFor();
  await measure(page, report, `${mode}-edit-expense-populated`);
  await form.locator('.ledger-fields input[type="date"]').first().fill("");
  await measure(page, report, `${mode}-edit-expense-empty`);
  await closeForm(form);
  const recurringBaseline = await measureRecurring(
    page,
    report,
    `${mode}-recurring-list-idle`,
    false
  );
  const editName = report.profile.lang === "zh" ? "编辑周期计划" : "Edit schedule";
  const firstRule = page.locator(".recurring-expenses-row").filter({ hasText: RULE_PURPOSE });
  const editOpener = firstRule.getByRole("button", { name: editName, exact: true });
  await editOpener.click();
  const scheduleForm = page.locator(".recurring-expenses-editor > .ledger-form");
  const schedulePanel = ".recurring-expenses-editor";
  await scheduleForm.waitFor();
  assert(
    await scheduleForm
      .locator('.ledger-fields input[type="date"]')
      .first()
      .evaluate((element) => document.activeElement === element),
    `${mode}: recurring editor did not focus the start date`
  );
  await measure(page, report, `${mode}-edit-recurring-populated`);
  await measureRecurring(page, report, `${mode}-recurring-editor-outside-records`, true);
  await scheduleForm.locator('.recurring-schedule-fields input[type="date"]').fill("");
  await measure(page, report, `${mode}-edit-recurring-end-empty`);
  if (report.profile.width >= 900) {
    await dragSide(page, 260, report, `${mode}-recurring-edit-pane-260`, schedulePanel);
    await measureRecurring(page, report, `${mode}-recurring-edit-list-at-260`, true);
    await dragSide(page, 520, report, `${mode}-recurring-edit-pane-520`, schedulePanel);
    await measureRecurring(page, report, `${mode}-recurring-edit-list-at-520`, true);
    await keyboardSide(page, report, `${mode}-recurring-edit-keyboard`, schedulePanel);

    // Independent ordinary and recurring editors must target their own rail.
    await page.locator(".ledger-expense-row .ledger-actions button[aria-label]").first().click();
    await form.waitFor();
    const ordinaryWidth = await page
      .locator("#expense-form")
      .evaluate((element) => element.getBoundingClientRect().width);
    await dragSide(page, 260, report, `${mode}-recurring-edit-with-expense-pane`, schedulePanel);
    assert(
      Math.abs(
        (await page
          .locator("#expense-form")
          .evaluate((element) => element.getBoundingClientRect().width)) - ordinaryWidth
      ) <= tolerance,
      `${mode}: recurring divider changed the independent ordinary expense pane`
    );
    await measureRecurring(page, report, `${mode}-recurring-edit-independent-list`, true);
    await closeForm(form);
  }
  if (report.profile.narrow) {
    await page.setViewportSize({ width: report.profile.narrow, height: report.profile.height });
    await measure(page, report, `${mode}-live-narrow-recurring-edit`);
    await measureRecurring(page, report, `${mode}-live-narrow-recurring-form-first`, true);
    await page.setViewportSize({ width: report.profile.width, height: report.profile.height });
  } else {
    await page.setViewportSize({ width: 899, height: report.profile.height });
    await measure(page, report, `${mode}-recurring-edit-live-stack-at-899`);
    await measureRecurring(page, report, `${mode}-recurring-edit-form-first-at-899`, true);
    await page.setViewportSize({ width: 900, height: report.profile.height });
    await measure(page, report, `${mode}-recurring-edit-live-rail-at-900`);
    await measureRecurring(page, report, `${mode}-recurring-edit-bounded-at-900`, true);
    await page.setViewportSize({ width: report.profile.width, height: report.profile.height });
    await measureRecurring(page, report, `${mode}-recurring-edit-desktop-restored`, true);
  }
  assert.equal(
    await scheduleForm.locator('.recurring-schedule-fields input[type="date"]').inputValue(),
    "",
    `${mode}: live layout changes discarded the recurring end-date draft`
  );
  await closeForm(scheduleForm);
  assert(
    await editOpener.evaluate((element) => document.activeElement === element),
    `${mode}: cancelling the recurring editor did not restore opener focus`
  );
  const recurringClosed = await measureRecurring(
    page,
    report,
    `${mode}-recurring-editor-closed`,
    false
  );
  assert(
    Math.abs(recurringClosed.primary.width - recurringBaseline.primary.width) <= tolerance &&
      recurringClosed.rows.every(
        (row, index) =>
          Math.abs(row.rect.height - recurringBaseline.rows[index].rect.height) <= tolerance
      ),
    `${mode}: closing the recurring editor did not restore full-width natural records`
  );

  // Switching plans remounts the draft without mutating either fixture record.
  await editOpener.click();
  await scheduleForm.waitFor();
  const purposeInput = scheduleForm.getByRole("textbox", {
    name: report.profile.lang === "zh" ? "这笔钱花在哪儿了？" : "What did you pay for?",
    exact: true,
  });
  assert.equal(await purposeInput.inputValue(), RULE_PURPOSE);
  assert.equal(
    await scheduleForm.locator('.recurring-schedule-fields input[type="date"]').inputValue(),
    "2027-12-31"
  );
  await purposeInput.fill("Unsaved layout draft");
  await editOpener.click();
  assert.equal(
    await purposeInput.inputValue(),
    "Unsaved layout draft",
    `${mode}: repeated edit discarded the draft`
  );
  const secondOpener = page
    .locator(".recurring-expenses-row")
    .filter({ hasText: SECOND_RULE_PURPOSE })
    .getByRole("button", { name: editName, exact: true });
  await secondOpener.click();
  assert.equal(
    await purposeInput.inputValue(),
    SECOND_RULE_PURPOSE,
    `${mode}: switching schedules retained the previous draft`
  );
  await measure(page, report, `${mode}-recurring-edit-second-plan`);
  await measureRecurring(page, report, `${mode}-recurring-second-plan-natural-rows`, true);
  await closeForm(scheduleForm);
  assert(
    await secondOpener.evaluate((element) => document.activeElement === element),
    `${mode}: cancelling the second schedule did not restore its opener focus`
  );
  await measureRecurring(page, report, `${mode}-recurring-final-full-width`, false);
}

async function measureApiKeys(page, report, name) {
  await settle(page);
  const measured = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const input = document.querySelector(".api-key-create .auth-field .auth-input input");
    const wrapper = input?.closest(".auth-input");
    const field = input?.closest(".auth-field");
    const wrapperStyle = wrapper ? getComputedStyle(wrapper) : null;
    const wrapperRect = wrapper ? rect(wrapper) : null;
    const picker = document.querySelector(".workspace-picker");
    const pickerLabel = picker?.querySelector("label");
    const pickerSelect = picker?.querySelector("select");
    const copyRects = (row) => {
      const copy = row.querySelector(".api-scope-copy");
      if (copy) return [rect(copy)];
      // Target labels contain bare JSX text, rather than api-scope-copy spans.
      // Measure their actual anonymous text boxes without changing the DOM.
      return Array.from(row.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
        .flatMap((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return Array.from(range.getClientRects()).map((bounds) => ({
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
            width: bounds.width,
            height: bounds.height,
          }));
        });
    };
    return {
      viewport: innerWidth,
      coarse: matchMedia("(pointer: coarse)").matches,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      workspacePicker:
        picker && pickerLabel && pickerSelect
          ? {
              picker: rect(picker),
              label: rect(pickerLabel),
              select: rect(pickerSelect),
              clientWidth: picker.clientWidth,
              scrollWidth: picker.scrollWidth,
              selectClientWidth: pickerSelect.clientWidth,
              selectScrollWidth: pickerSelect.scrollWidth,
              gap: Number.parseFloat(getComputedStyle(picker).columnGap),
              selectedId: pickerSelect.value,
              optionLabels: Array.from(pickerSelect.options).map((option) => option.text),
            }
          : null,
      keyName:
        input && wrapper && field
          ? {
              input: rect(input),
              wrapper: wrapperRect,
              field: rect(field),
              content: {
                left:
                  wrapperRect.left +
                  Number.parseFloat(wrapperStyle.borderLeftWidth) +
                  Number.parseFloat(wrapperStyle.paddingLeft),
                right:
                  wrapperRect.right -
                  Number.parseFloat(wrapperStyle.borderRightWidth) -
                  Number.parseFloat(wrapperStyle.paddingRight),
              },
            }
          : null,
      rows: Array.from(document.querySelectorAll(".api-key-create label.api-scope-row")).map(
        (row) => ({
          row: rect(row),
          checkbox: row.querySelector('input[type="checkbox"]')
            ? rect(row.querySelector('input[type="checkbox"]'))
            : null,
          copies: copyRects(row),
        })
      ),
      containers: Array.from(
        document.querySelectorAll(
          ".main, .set-body, .api-key-create, .api-key-create-main, .api-scope-panel, .api-scope-list"
        )
      ).map((element) => ({
        className: element.className,
        rect: rect(element),
      })),
    };
  });
  const details = JSON.stringify(measured);
  assert(
    measured.documentWidth <= measured.viewport + tolerance &&
      measured.bodyWidth <= measured.viewport + tolerance,
    `${name}: API Keys document overflows viewport ${details}`
  );
  assert(measured.keyName, `${name}: API key name field was not rendered`);
  assert(measured.workspacePicker, `${name}: native Ledger picker was not rendered`);
  const { picker, label, select, gap, selectedId, optionLabels } = measured.workspacePicker;
  assert.equal(selectedId, WORKSPACE_ID, `${name}: active ledger changed during layout checks`);
  assert(optionLabels.length === 2, `${name}: long own/shared Ledger options were not rendered`);
  // Linux WebKit can count invisible native-option intrinsic widths in the
  // picker scrollWidth. Keep that measurement for diagnostics; actual border
  // boxes and document/body overflow establish whether the layout escapes.
  assert(
    picker.left >= -tolerance &&
      picker.right <= measured.viewport + tolerance &&
      label.left >= picker.left - tolerance &&
      label.right <= picker.right + tolerance &&
      select.left >= label.right + gap - tolerance &&
      select.right <= picker.right + tolerance,
    `${name}: Ledger label/select overlap or escape their picker ${details}`
  );
  const { input, wrapper, field, content } = measured.keyName;
  assert(
    wrapper.left >= field.left - tolerance &&
      wrapper.right <= field.right + tolerance &&
      input.left >= content.left - tolerance &&
      input.right <= content.right + tolerance,
    `${name}: key name input or wrapper escapes its field ${details}`
  );
  assert(measured.rows.length > 0, `${name}: API scopes did not finish loading`);
  for (const row of measured.rows) {
    assert(
      row.checkbox && row.checkbox.width > 0 && row.checkbox.width <= 20,
      `${name}: API scope checkbox was hidden or stretched ${details}`
    );
    assert(
      row.checkbox.left >= row.row.left - tolerance &&
        row.checkbox.right <= row.row.right + tolerance,
      `${name}: API scope checkbox escapes its row ${details}`
    );
    assert(row.copies.length > 0, `${name}: API scope label text was not rendered ${details}`);
    for (const copy of row.copies) {
      assert(
        copy.left >= row.checkbox.right - tolerance && copy.right <= row.row.right + tolerance,
        `${name}: API scope copy overlaps checkbox or escapes its row ${details}`
      );
    }
  }
  report.states.push({ name, ...measured });
}

async function checkApiKeys(page, report) {
  if (page.viewportSize().width <= 760) {
    await page.locator(".side-compact").selectOption("apiKeys");
  } else await page.locator('.side-i[href="/api-keys"]').click();
  await page.waitForURL(`${baseURL}/api-keys`);
  await page.locator('.api-key-create input:not([type="checkbox"])').waitFor();
  await page.locator(".api-key-create .api-scope-list .api-scope-row").first().waitFor();
  await page.locator(".api-keys-skeleton, .topbar-loading").waitFor({ state: "detached" });
  await measureApiKeys(page, report, "api-keys-scope-and-name-bounds");
  if (report.profile.narrow) {
    await page.setViewportSize({ width: report.profile.narrow, height: report.profile.height });
    await measureApiKeys(page, report, "api-keys-live-narrow-scope-and-name-bounds");
    await page.setViewportSize({ width: report.profile.width, height: report.profile.height });
  }
}

async function measureCategories(page, report, name) {
  await settle(page);
  const measured = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      coarse: matchMedia("(pointer: coarse)").matches,
      rows: Array.from(document.querySelectorAll(".ledger-category-row")).map((row) => {
        const main = row.querySelector(".ledger-row-main");
        const title = main.querySelector(".ledger-category-title");
        const heading = title?.querySelector("h3");
        const opener = title?.querySelector("[data-category-rename]");
        const editor = main.querySelector(".ledger-category-editor");
        const range = document.createRange();
        if (heading) range.selectNodeContents(heading);
        return {
          row: rect(row),
          main: rect(main),
          clientWidth: row.clientWidth,
          scrollWidth: row.scrollWidth,
          heading: heading
            ? {
                text: heading.textContent,
                rect: rect(heading),
                fragments: Array.from(range.getClientRects())
                  .filter((bounds) => bounds.width > 0)
                  .map((bounds) => ({
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    bottom: bounds.bottom,
                  })),
              }
            : null,
          title: title ? rect(title) : null,
          opener: opener
            ? {
                rect: rect(opener),
                text: opener.textContent,
                svg: Boolean(opener.querySelector("svg")),
              }
            : null,
          rightRename: Array.from(row.querySelectorAll(":scope > .ledger-actions button")).some(
            (button) =>
              button.hasAttribute("data-category-rename") ||
              ["Rename", "重命名"].includes(button.textContent.trim())
          ),
          buttons: row.querySelectorAll("button").length,
          editor: editor
            ? {
                rect: rect(editor),
                parentMain: editor.parentElement === main,
                controls: Array.from(editor.querySelectorAll("input, button")).map((control) => ({
                  rect: rect(control),
                  fontSize: Number.parseFloat(getComputedStyle(control).fontSize),
                })),
              }
            : null,
        };
      }),
    };
  });
  const details = JSON.stringify(measured);
  assert(
    measured.documentWidth <= measured.viewport + tolerance,
    `${name}: categories page overflows viewport ${details}`
  );
  assert.equal(measured.rows.length, 3, `${name}: category fixture is incomplete`);
  for (const row of measured.rows) {
    assert(
      row.scrollWidth <= row.clientWidth + tolerance,
      `${name}: category record overflows ${details}`
    );
    assert(!row.rightRename, `${name}: Rename remains in the right-hand actions ${details}`);
    if (row.opener) {
      assert(
        row.heading && row.title && row.opener.svg && !row.opener.text.trim(),
        `${name}: category rename is not an icon beside the title ${details}`
      );
      assert(
        inside(row.opener.rect, row.row) && inside(row.opener.rect, row.title),
        `${name}: long category name pushes its pencil outside the title ${details}`
      );
      assert(
        !overlaps(row.heading.rect, row.opener.rect),
        `${name}: category name overlaps pencil ${details}`
      );
      // A wrapping heading retains its allocated flex width even when no text
      // fragment reaches the final few pixels. Keep the icon beside that box;
      // single-line names additionally stay beside the actual visible text.
      const textRight =
        row.heading.fragments.length === 1
          ? row.heading.fragments[0].right
          : row.heading.rect.right;
      assert(
        row.opener.rect.left >= textRight - tolerance &&
          row.opener.rect.left <= textRight + 16 + tolerance,
        `${name}: pencil is not adjacent to the category name ${details}`
      );
      if (measured.coarse)
        assert(
          row.opener.rect.width >= 44 - tolerance && row.opener.rect.height >= 44 - tolerance,
          `${name}: category pencil has no 44px touch target ${details}`
        );
    }
    for (const fragment of row.heading?.fragments || []) {
      assert(
        inside(fragment, row.row) && insideInline(fragment, row.main),
        `${name}: category name escapes its record ${details}`
      );
    }
    if (row.editor) {
      assert(
        row.editor.parentMain && !row.heading,
        `${name}: category editor does not replace its title in place ${details}`
      );
      assert(
        inside(row.editor.rect, row.row),
        `${name}: category editor escapes record bounds ${details}`
      );
      assert.equal(
        row.editor.controls.length,
        3,
        `${name}: category editor lacks input/save/cancel`
      );
      for (let index = 0; index < row.editor.controls.length; index += 1) {
        const control = row.editor.controls[index];
        assert(
          inside(control.rect, row.editor.rect),
          `${name}: category edit control escapes form ${details}`
        );
        assert(
          row.editor.controls
            .slice(index + 1)
            .every((other) => !overlaps(control.rect, other.rect)),
          `${name}: category edit input/save/cancel overlap ${details}`
        );
        if (measured.coarse)
          assert(
            control.rect.height >= 44 - tolerance,
            `${name}: category editor control has no 44px touch target ${details}`
          );
      }
      if (measured.coarse || measured.viewport <= 760)
        assert(
          row.editor.controls[0].fontSize >= 16 - 0.05,
          `${name}: category edit input text is too small ${details}`
        );
    }
  }
  const archived = measured.rows[2];
  assert.equal(
    archived.heading?.text,
    ARCHIVED_CATEGORY_NAME,
    `${name}: archived category name is unavailable`
  );
  assert.equal(archived.buttons, 0, `${name}: archived category exposes mutation controls`);
  report.states.push({ name, categories: measured });
}

async function checkCategories(page, report) {
  // Ledger links remain visible on mobile; the compact selector contains only
  // Account & tools destinations and does not offer Categories.
  await page.locator('.side-nav .side-i[href="/categories"]').click();
  await page.waitForURL(`${baseURL}/categories`);
  const rows = page.locator(".ledger-category-row");
  await rows.nth(2).waitFor();
  await page.locator(".topbar-loading").waitFor({ state: "detached" });
  await measureCategories(page, report, "categories-title-pencils-idle");
  assert.equal(await rows.nth(1).locator("h3").textContent(), LONG_CATEGORY_NAME);
  const opener = rows.nth(1).locator("[data-category-rename]");
  await opener.click();
  const form = rows.nth(1).locator(".ledger-row-main .ledger-category-editor");
  const input = form.locator("input");
  await input.waitFor();
  assert(
    await input.evaluate((element) => document.activeElement === element),
    "categories: inline name input did not receive focus"
  );
  assert.equal(await input.inputValue(), LONG_CATEGORY_NAME);
  await input.fill("Unsaved category draft");
  await measureCategories(page, report, "categories-inline-editor-open");
  if (report.profile.width >= 900) {
    const panel = ".ledger-categories .ledger-split > .panel:nth-child(2)";
    await dragSide(
      page,
      260,
      report,
      "categories-inline-editor-pane-260",
      panel,
      measureCategories
    );
    await dragSide(
      page,
      520,
      report,
      "categories-inline-editor-pane-520",
      panel,
      measureCategories
    );
  }
  const narrow = report.profile.narrow || 899;
  await page.setViewportSize({ width: narrow, height: report.profile.height });
  await measureCategories(page, report, `categories-inline-editor-live-${narrow}`);
  assert.equal(
    await input.inputValue(),
    "Unsaved category draft",
    "categories: reflow discarded rename draft"
  );
  await page.setViewportSize({ width: report.profile.width, height: report.profile.height });
  const cancelName = report.profile.lang === "zh" ? "取消" : "Cancel";
  await form.getByRole("button", { name: cancelName, exact: true }).click();
  await form.waitFor({ state: "detached" });
  assert(
    await opener.evaluate((element) => document.activeElement === element),
    "categories: cancel did not restore pencil focus"
  );
  assert.equal(await rows.nth(1).locator("h3").textContent(), LONG_CATEGORY_NAME);
  await measureCategories(page, report, "categories-inline-cancel-restored-title");
  await page.setViewportSize({ width: narrow, height: report.profile.height });
  await measureCategories(page, report, `categories-long-title-pencil-live-${narrow}`);
  await page.setViewportSize({ width: report.profile.width, height: report.profile.height });
}

await access(join(root, "dist", "index.html"));
// Browser installation is an explicit CI/runtime step. This script never
// downloads browsers or writes caches under the user's home directory.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, "node_modules", ".cache", "ms-playwright");
const runtimeHome = await mkdtemp(join(tmpdir(), "pullwise-date-layout-"));
const results = [];
let server;
let activeBrowser;
try {
  server = await preview({
    configFile: false,
    root,
    appType: "spa",
    logLevel: "warn",
    server: { proxy: {} },
    preview: { host: "127.0.0.1", port: 4248, strictPort: true, proxy: {} },
  });
  const playwright = await import("playwright");
  for (const engine of engines) {
    const browserType = playwright[engine];
    let executablePath = process.env[`${engine.toUpperCase()}_EXECUTABLE_PATH`];
    if (!executablePath && !(await exists(browserType.executablePath())) && engine === "chromium") {
      if (await exists("/usr/bin/chromium")) executablePath = "/usr/bin/chromium";
    }
    activeBrowser = await browserType.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      env: {
        ...process.env,
        XDG_CACHE_HOME: join(runtimeHome, "cache"),
        XDG_CONFIG_HOME: join(runtimeHome, "config"),
        XDG_DATA_HOME: join(runtimeHome, "data"),
      },
    });
    for (const profile of profiles) {
      const fixture = createDateLayoutFixture({ baseURL, cap: 100 });
      const context = await activeBrowser.newContext({
        viewport: { width: profile.width, height: profile.height },
        locale: profile.lang === "zh" ? "zh-CN" : "en-US",
        hasTouch: profile.touch,
        ...(engine !== "firefox" ? { isMobile: Boolean(profile.narrow) } : {}),
        serviceWorkers: "block",
      });
      const report = { engine, version: activeBrowser.version(), profile, states: [] };
      const errors = [];
      try {
        await context.route("**/*", (route) => fixture.handle(route));
        context.on("response", fixture.recordResponse);
        await context.addInitScript(({ lang }) => {
          localStorage.setItem("pw-lang", lang);
          localStorage.setItem("pw-theme", "light");
        }, profile);
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("response", (response) => {
          if (new URL(response.url()).origin !== baseURL)
            errors.push(`External response delivered: ${response.url()}`);
        });
        await checkScope(page, report, "project");
        if (profile === profiles[0]) report.currencyPalette = await checkCurrencyPalette(page);
        await checkScope(page, report, "shared");
        await checkApiKeys(page, report);
        await checkCategories(page, report);
        fixture.assertClean();
        assert.deepEqual(errors, [], `${engine}/${profile.name}: browser errors`);
        report.requests = fixture.getRequests();
        results.push(report);
        process.stdout.write(
          `${engine}/${profile.name}: ${report.states.length} layout states passed\n`
        );
      } catch (error) {
        process.stderr.write(
          JSON.stringify({ engine, profile, ...fixture.getRequests(), error: error.message }) + "\n"
        );
        throw error;
      } finally {
        await context.close();
      }
    }
    await activeBrowser.close();
    activeBrowser = null;
  }
  process.stdout.write(
    JSON.stringify(
      {
        scope:
          "Local GET-only fixtures; browser engines and simulated viewports, not physical devices. No save, CSV download, external delivery or screenshots.",
        results,
      },
      null,
      2
    ) + "\n"
  );
} finally {
  const cleanup = await Promise.allSettled([
    activeBrowser?.close(),
    server
      ? new Promise((resolveClose, rejectClose) => {
          server.httpServer.closeAllConnections?.();
          server.httpServer.close((error) => (error ? rejectClose(error) : resolveClose()));
        })
      : Promise.resolve(),
  ]);
  await rm(runtimeHome, { recursive: true, force: true });
  const failedCleanup = cleanup.filter((result) => result.status === "rejected");
  if (failedCleanup.length)
    throw new AggregateError(
      failedCleanup.map((result) => result.reason),
      "Date layout cleanup failed"
    );
}
