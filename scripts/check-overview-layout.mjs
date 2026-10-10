import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { createMobileLayoutFixture } from "./mobile-layout-fixtures.mjs";
import { WORKSPACE_ID } from "./date-layout-fixtures.mjs";

// Build first. Every API response is synthetic, finite and GET-only. No
// business request reaches a Server and no browser is installed by this check.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:4248";
const tolerance = 1;
const requested = process.argv.slice(2);
const saveScreenshots = requested.includes("--screenshots");
const args = requested.filter((argument) => argument !== "--screenshots");
assert(
  args.length === 0 || (args.length === 1 && /^--browser=(chromium|webkit|firefox)$/.test(args[0])),
  "Usage: node scripts/check-overview-layout.mjs [--browser=chromium|webkit|firefox] [--screenshots]"
);
const engines = args.length ? [args[0].split("=")[1]] : ["chromium", "webkit", "firefox"];
const languages = ["en", "zh", "ja", "ko", "fr", "es"];
const summaryReadCap = 7;
const apiReadCap = 20;
const contextCap = 45;
const profiles = [
  { name: "desktop-1440", width: 1440, height: 1000, touch: false, lang: "en", theme: "light" },
  { name: "tablet-1024", width: 1024, height: 1000, touch: true, lang: "en", theme: "light" },
  { name: "phone-390", width: 390, height: 844, touch: true, lang: "zh", theme: "dark" },
  ...languages.map((lang, index) => ({
    name: `phone-320-${lang}`,
    width: 320,
    height: 844,
    touch: true,
    lang,
    theme: index % 2 ? "dark" : "light",
  })),
  ...languages.map((lang) => ({
    name: `desktop-dark-${lang}`,
    width: lang === "zh" ? 1906 : 1440,
    height: 1000,
    touch: false,
    lang,
    theme: "dark",
  })),
];
assert(engines.length * profiles.length <= contextCap, `Context cap exceeded (${contextCap})`);
const hugeMinor = 10n ** 72n;
const fixtures = {
  mixed: [
    { currency: "CNY", account: "340000", project: "85000", shared: "255000", shares: [25, 75] },
    { currency: "USD", account: "15000", project: "10500", shared: "4500", shares: [70, 30] },
  ],
  long: [
    {
      currency: "USD",
      account: String(hugeMinor * 4n),
      project: String(hugeMinor * 3n),
      shared: String(hugeMinor),
      shares: [75, 25],
    },
  ],
  zero: [{ currency: "USD", account: "0", project: "0", shared: "0", shares: null }],
};

function createFixture() {
  const core = createMobileLayoutFixture({ baseURL });
  const requests = [];
  const violations = [];
  let stage = "mixed";
  return {
    setStage(value) {
      stage = value;
    },
    summaryRequests() {
      return requests.filter((item) => item.summary);
    },
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());
      const record = { url: url.href, method: request.method(), stage };
      requests.push(record);
      try {
        assert(requests.length <= 100, "Overview request cap exceeded (100)");
        assert.equal(record.method, "GET", "Only GET requests are allowed");
        if (url.origin !== baseURL || url.pathname !== "/api/api/v1/reports/summary") {
          await core.handle(route);
          return;
        }
        record.summary = true;
        assert(
          requests.filter((item) => item.summary).length <= summaryReadCap,
          `Summary read cap exceeded (${summaryReadCap})`
        );
        assert.equal(request.headers()["x-pullwise-workspace"], WORKSPACE_ID);
        assert.deepEqual([...url.searchParams.keys()].sort(), ["from", "to"]);
        for (const key of ["from", "to"])
          assert(/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get(key)), "Invalid summary date");
        assert(url.searchParams.get("from") < url.searchParams.get("to"), "Invalid summary range");
        record.range = Object.fromEntries(url.searchParams);
        const groups =
          stage === "error"
            ? null
            : fixtures[stage].flatMap((row) => [
                ...["account", "project", "shared"].map((target) => ({
                  target,
                  projectId: null,
                  categoryId: null,
                  bucket: null,
                  currency: row.currency,
                  amountMinor: row[target],
                })),
                // Per-project detail must not be added a second time to aggregates.
                {
                  target: "project",
                  projectId: "prj_overview_local",
                  categoryId: null,
                  bucket: null,
                  currency: row.currency,
                  amountMinor: row.project,
                },
              ]);
        await route.fulfill({
          status: stage === "error" ? 503 : 200,
          contentType: "application/json; charset=utf-8",
          headers: { "Cache-Control": "no-store" },
          body: JSON.stringify(
            stage === "error"
              ? { code: "LOCAL_SUMMARY_UNAVAILABLE", message: "Synthetic summary read unavailable" }
              : { groups }
          ),
        });
      } catch (error) {
        violations.push({ ...record, reason: error.message });
        await route.abort("blockedbyclient");
      }
    },
    recordResponse: core.recordResponse,
    assertClean() {
      assert.deepEqual(violations, [], "Overview fixture request violations");
      assert.equal(
        requests.filter((item) => item.summary).length,
        summaryReadCap,
        "Unexpected automatic summary reads"
      );
      const inherited = core.assertClean();
      assert(
        inherited.api + summaryReadCap <= apiReadCap,
        `Overview API read cap exceeded (${apiReadCap})`
      );
      return { total: requests.length, summary: summaryReadCap, inherited };
    },
  };
}

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
    const animations = document.getAnimations().filter((animation) => {
      const end = animation.effect?.getComputedTiming().endTime;
      return Number.isFinite(end) && end <= 1000;
    });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

function money(currency, minor) {
  const amount = BigInt(minor);
  return `${currency} ${new Intl.NumberFormat("en").format(amount / 100n)}.${String(amount % 100n).padStart(2, "0")}`;
}

function monthDates(month) {
  const [year, number] = month.split("-").map(Number);
  const endDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const next = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01`, end: `${month}-${endDay}` };
}

async function readRange(page, fixture, action, range) {
  const before = fixture.summaryRequests().length;
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/api/v1/reports/summary" &&
        url.searchParams.get("from") === range.from &&
        url.searchParams.get("to") === range.to
      );
    }),
    action(),
  ]);
  await page.locator('.ledger-overview-screen [aria-busy="false"]').waitFor();
  await settle(page);
  assert.equal(fixture.summaryRequests().length, before + 1, "Filter action made extra reads");
  assert.deepEqual(fixture.summaryRequests().at(-1).range, range, "Summary range is incorrect");
}

async function measureFilters(page, engine, profile, phase) {
  await settle(page);
  const measured = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const filters = document.querySelector(".ledger-overview-filters");
    const section = document.querySelector(".ledger-overview-period");
    const dates = filters?.querySelector(".ledger-overview-date-fields");
    const current = filters?.querySelector(".btn.ledger-overview-current");
    if (!filters || !section || !dates || !current) return null;
    const sectionStyle = getComputedStyle(section);
    const fragments = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()]
        .filter((box) => box.width > 0)
        .map((box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
    };
    const control = (element) => {
      const style = getComputedStyle(element);
      const field = element.closest(".ledger-field");
      const label = field?.querySelector("label");
      return {
        type: element.tagName === "SELECT" ? "select" : element.getAttribute("type"),
        value: element.value,
        rect: rect(element),
        field: field ? rect(field) : null,
        overflow: element.scrollWidth > element.clientWidth + 1,
        background: style.backgroundColor,
        fontSize: Number.parseFloat(style.fontSize),
        borders: ["Top", "Right", "Bottom", "Left"].map((side) => ({
          width: Number.parseFloat(style[`border${side}Width`]),
          style: style[`border${side}Style`],
          color: style[`border${side}Color`],
        })),
        label: label ? { rect: rect(label), fragments: fragments(label) } : null,
        fragments: element.tagName === "BUTTON" ? fragments(element) : [],
      };
    };
    let surface = section;
    while (
      surface.parentElement &&
      /^(?:transparent|rgba\(.+, 0\))$/.test(getComputedStyle(surface).backgroundColor)
    )
      surface = surface.parentElement;
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      period: filters.dataset.period,
      containerWidth:
        section.clientWidth -
        Number.parseFloat(sectionStyle.paddingLeft) -
        Number.parseFloat(sectionStyle.paddingRight),
      rect: rect(filters),
      dateGroup: rect(dates),
      overflow: filters.scrollWidth > filters.clientWidth + 1,
      surface: getComputedStyle(surface).backgroundColor,
      fields: [...filters.querySelectorAll("select, input")].map(control),
      current: control(current),
      times: [...section.querySelectorAll("time")].map((element) => element.textContent),
    };
  });
  const details = `${engine}/${profile.name}/${phase}: ${JSON.stringify(measured)}`;
  assert(measured, `Missing filter structure: ${details}`);
  const near = (actual, expected, message) =>
    assert(Math.abs(actual - expected) <= tolerance, `${message}: ${details}`);
  const visibleColor = (color) =>
    color !== "transparent" && !/^rgba\(.+,\s*0(?:\.0+)?\)$/.test(color);
  const controls = [...measured.fields, measured.current];
  const expectedHeight = measured.viewport <= 760 ? 48 : 44;
  assert(["month", "custom"].includes(measured.period), `Missing period state: ${details}`);
  assert.deepEqual(
    measured.fields.map((field) => field.type),
    measured.period === "month" ? ["select", "month"] : ["select", "date", "date"],
    `Period has the wrong controls: ${details}`
  );
  assert.equal(measured.overflow, false, `Filter grid overflows: ${details}`);
  assert(measured.documentWidth <= measured.viewport + tolerance, `Document overflows: ${details}`);
  for (const item of controls) {
    near(item.rect.height, expectedHeight, "Control height differs from shared size");
    assert.equal(item.overflow, false, `Control content overflows: ${details}`);
    assert(item.fontSize >= 16, `Native field text is too small: ${details}`);
    assert(
      item.rect.left >= measured.rect.left - tolerance &&
        item.rect.right <= measured.rect.right + tolerance &&
        item.rect.left >= -tolerance &&
        item.rect.right <= measured.viewport + tolerance,
      `Control escapes its filter/viewport bounds: ${details}`
    );
    assert(visibleColor(item.background), `Control lacks a background: ${details}`);
    assert.equal(
      item.background,
      measured.current.background,
      `Control backgrounds differ: ${details}`
    );
    for (const [index, border] of item.borders.entries()) {
      near(border.width, 1, "Control lacks a 1px border");
      assert.equal(border.style, "solid", `Control border is not visible: ${details}`);
      assert(visibleColor(border.color), `Control border is transparent: ${details}`);
      assert.equal(
        border.color,
        measured.current.borders[index].color,
        `Control borders differ: ${details}`
      );
      assert.notEqual(
        border.color,
        item.background,
        `Control border blends into background: ${details}`
      );
    }
    if (item.field) {
      near(item.rect.left, item.field.left, "Control and field left edges differ");
      near(item.rect.right, item.field.right, "Control and field right edges differ");
      near(item.label.rect.left, item.field.left, "Label and field left edges differ");
    }
    for (const fragment of [...(item.label?.fragments || []), ...item.fragments])
      assert(
        fragment.left >= item.rect.left - tolerance &&
          fragment.right <= item.rect.right + tolerance,
        `Localized label/button text escapes its column: ${details}`
      );
  }
  assert.notEqual(
    measured.current.background,
    measured.surface,
    `Shortcut background is invisible: ${details}`
  );
  if (measured.containerWidth <= 640) {
    for (const item of controls) {
      near(item.rect.left, measured.rect.left, "Stacked controls have different left edges");
      near(item.rect.right, measured.rect.right, "Stacked controls have different right edges");
    }
    for (let index = 1; index < controls.length; index++)
      assert(
        controls[index].rect.top >= controls[index - 1].rect.bottom + 8 - tolerance,
        `Stacked controls overlap or lose their gap: ${details}`
      );
  } else {
    for (const item of controls) {
      near(item.rect.top, measured.current.rect.top, "Row controls have different top edges");
      near(
        item.rect.bottom,
        measured.current.rect.bottom,
        "Row controls have different bottom edges"
      );
    }
    for (let index = 1; index < controls.length; index++)
      near(
        controls[index].rect.left - controls[index - 1].rect.right,
        16,
        "Row control gap differs"
      );
    if (measured.period === "custom")
      near(
        measured.fields[1].rect.width,
        measured.fields[2].rect.width,
        "Custom date widths differ"
      );
  }
  near(measured.fields[1].rect.left, measured.dateGroup.left, "Dates start outside their group");
  near(
    measured.fields.at(-1).rect.right,
    measured.dateGroup.right,
    "Dates end outside their group"
  );
  return {
    phase,
    period: measured.period,
    viewport: measured.viewport,
    containerWidth: measured.containerWidth,
    stacked: measured.containerWidth <= 640,
    controlHeight: expectedHeight,
    times: measured.times,
  };
}

async function checkKeyboardFocus(page, engine, profile) {
  const controls = page.locator(
    ".ledger-overview-filters select, .ledger-overview-filters input, .ledger-overview-current"
  );
  await controls.first().focus();
  await page.keyboard.press("Shift+Tab");
  for (let index = 0; index < (await controls.count()); index++) {
    const target = controls.nth(index);
    let reached = false;
    // Native date editors may have several internal tab stops; bound traversal.
    for (let attempt = 0; attempt < 8 && !reached; attempt++) {
      await page.keyboard.press("Tab");
      reached = await target.evaluate((element) => document.activeElement === element);
    }
    assert(reached, `${engine}/${profile.name}: keyboard skipped filter control ${index}`);
    const focus = await target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        visible: element.matches(":focus-visible"),
        width: Number.parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        color: style.outlineColor,
      };
    });
    assert(
      focus.visible && focus.width >= 2 && focus.style !== "none",
      `${engine}/${profile.name}: filter control lacks a keyboard focus indicator ${JSON.stringify(focus)}`
    );
    assert(!/^rgba\(.+,\s*0(?:\.0+)?\)$/.test(focus.color), "Keyboard outline is transparent");
  }
}

async function checkResponsiveBoundaries(page, engine, profile, period) {
  const results = [];
  try {
    for (const target of [640, 641]) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const width = await page.locator(".ledger-overview-period").evaluate((element) => {
          const style = getComputedStyle(element);
          return (
            element.clientWidth -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight)
          );
        });
        if (Math.abs(width - target) <= 0.1) break;
        const viewport = page.viewportSize();
        await page.setViewportSize({
          width: Math.round(viewport.width + target - width),
          height: viewport.height,
        });
        await settle(page);
      }
      const result = await measureFilters(page, engine, profile, `${period}-container-${target}`);
      assert(
        Math.abs(result.containerWidth - target) <= 0.1,
        "Could not reach actual container boundary"
      );
      assert.equal(result.stacked, target === 640, "Filter container breakpoint is misplaced");
      results.push(result);
    }
    for (const width of [760, 761]) {
      await page.setViewportSize({ width, height: profile.height });
      results.push(await measureFilters(page, engine, profile, `${period}-viewport-${width}`));
    }
  } finally {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await settle(page);
  }
  return results;
}

async function measure(page, engine, profile, stage) {
  await settle(page);
  const measured = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const summary = document.querySelector(".ledger-summary");
    const textFragments = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()]
        .filter((box) => box.width > 0)
        .map((box) => ({
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
        }));
    };
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      coarse: matchMedia("(pointer: coarse)").matches,
      touchPoints: navigator.maxTouchPoints,
      status: summary?.querySelector('[role="status"]')?.textContent || null,
      cards: [...(summary?.querySelectorAll(".ledger-summary-currency[data-currency]") || [])].map(
        (card) => ({
          currency: card.dataset.currency,
          rect: rect(card),
          overflow: card.scrollWidth > card.clientWidth + 1,
          values: [...card.querySelectorAll(".financial-value")].map((value) => ({
            text: value.textContent,
            rect: rect(value),
            fragments: textFragments(value),
            selectable: getComputedStyle(value).userSelect !== "none",
          })),
          composition: (() => {
            const chart = card.querySelector('[role="img"]');
            if (!chart) return null;
            const describedBy = chart.getAttribute("aria-describedby");
            const legend = document.getElementById(describedBy);
            return {
              rect: rect(chart),
              gap: Number.parseFloat(getComputedStyle(chart).columnGap) || 0,
              label: chart.getAttribute("aria-label"),
              describedBy,
              legendWithinCard: Boolean(legend && card.contains(legend)),
              empty: chart.dataset.empty === "true",
              shares: [...card.querySelectorAll(".ledger-summary-share")].map(
                (item) => item.textContent
              ),
              segments: [...chart.querySelectorAll(".ledger-summary-segment")].map((item) => ({
                target: item.dataset.target,
                width: rect(item).width,
                hidden: item.getAttribute("aria-hidden"),
              })),
            };
          })(),
        })
      ),
    };
  });
  const details = `${engine}/${profile.name}/${stage}: ${JSON.stringify(measured)}`;
  assert(measured.documentWidth <= measured.viewport + tolerance, `Document overflow: ${details}`);
  assert.equal(measured.coarse, profile.touch, `Pointer mismatch: ${details}`);
  if (profile.touch && engine !== "webkit")
    assert(measured.touchPoints > 0, `No touch emulation: ${details}`);
  if (stage === "error") {
    assert(measured.status, `Read error lacks visible status: ${details}`);
    assert.equal(measured.cards.length, 0, `Read error retains amounts/composition: ${details}`);
  } else {
    const rows = fixtures[stage];
    assert.equal(measured.cards.length, rows.length, `Currencies merged or missing: ${details}`);
    for (const [index, row] of rows.entries()) {
      const card = measured.cards[index];
      assert.equal(card.currency, row.currency, details);
      assert.equal(card.overflow, false, `Currency article overflows: ${details}`);
      assert(
        card.rect.left >= -tolerance && card.rect.right <= measured.viewport + tolerance,
        `Currency article escapes viewport: ${details}`
      );
      assert.deepEqual(
        card.values.map((value) => value.text),
        ["account", "project", "shared"].map((target) => money(row.currency, row[target])),
        `Amounts are inexact or double counted: ${details}`
      );
      for (const value of card.values) {
        assert(value.selectable, `Money is not selectable: ${details}`);
        for (const fragment of value.fragments)
          assert(
            fragment.left >= card.rect.left - tolerance &&
              fragment.right <= card.rect.right + tolerance,
            `Exact amount escapes article: ${details}`
          );
      }
      const chart = card.composition;
      assert(chart?.label?.includes(row.currency), `Composition lacks currency name: ${details}`);
      assert(
        chart.describedBy && chart.legendWithinCard,
        `Composition lacks linked text legend: ${details}`
      );
      assert(
        chart.rect.width > 0 && chart.rect.height >= 8,
        `Composition is not visible: ${details}`
      );
      assert.deepEqual(
        chart.segments.map((item) => item.target),
        ["project", "shared"],
        details
      );
      assert(
        chart.segments.every((item) => item.hidden === "true"),
        `Decorative segments exposed: ${details}`
      );
      if (row.shares) {
        const percentage = new Intl.NumberFormat(profile.lang, {
          style: "percent",
          maximumFractionDigits: 1,
        });
        assert.deepEqual(
          chart.shares,
          row.shares.map((value) => percentage.format(value / 100)),
          `Composition labels do not describe independent currency proportions: ${details}`
        );
        const sum = chart.segments.reduce((total, item) => total + item.width, 0);
        for (const [segmentIndex, expected] of row.shares.entries())
          assert(
            Math.abs((chart.segments[segmentIndex].width / sum) * 100 - expected) <= 0.15,
            `Composition geometry disagrees with legend: ${details}`
          );
        assert(
          Math.abs(sum + chart.gap - chart.rect.width) <= tolerance,
          `Composition does not fill its own scale: ${details}`
        );
      } else {
        assert(chart.empty, `Zero totals lack empty composition state: ${details}`);
        assert.deepEqual(
          chart.shares,
          ["—", "—"],
          `Zero totals imply nonzero percentages: ${details}`
        );
        assert(
          chart.segments.every((item) => item.width <= tolerance),
          `Zero totals have filled composition: ${details}`
        );
      }
    }
  }
  return {
    stage,
    documentWidth: measured.documentWidth,
    coarse: measured.coarse,
    touchPoints: measured.touchPoints,
    currencies: measured.cards.map((card) => card.currency),
    filters: await measureFilters(page, engine, profile, stage),
  };
}

await access(join(root, "dist", "index.html"));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, "node_modules", ".cache", "ms-playwright");
const runtimeHome = await mkdtemp(join(tmpdir(), "pullwise-overview-layout-"));
const screenshotDir = join(root, "..", "work", "overview-layout");
if (saveScreenshots) await mkdir(screenshotDir, { recursive: true });
const reports = [];
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
    if (
      !executablePath &&
      engine === "chromium" &&
      !(await exists(browserType.executablePath())) &&
      (await exists("/usr/bin/chromium"))
    )
      executablePath = "/usr/bin/chromium";
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
      const fixture = createFixture();
      const report = {
        engine,
        version: activeBrowser.version(),
        profile,
        states: [],
        filterChecks: [],
      };
      const context = await activeBrowser.newContext({
        viewport: { width: profile.width, height: profile.height },
        locale: profile.lang,
        hasTouch: profile.touch,
        ...(engine !== "firefox" ? { isMobile: profile.width <= 760 } : {}),
        serviceWorkers: "block",
      });
      try {
        const errors = [];
        await context.route("**/*", (route) => fixture.handle(route));
        context.on("response", fixture.recordResponse);
        await context.addInitScript(({ lang, theme }) => {
          localStorage.setItem("pw-lang", lang);
          localStorage.setItem("pw-theme", theme);
        }, profile);
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${baseURL}/overview`, { waitUntil: "domcontentloaded" });
        await page.locator(".ledger-summary-primary .financial-value").first().waitFor();
        report.states.push(await measure(page, engine, profile, "mixed"));
        const currentMonth = await page.locator('input[type="month"]').inputValue();
        const currentRange = monthDates(currentMonth);
        assert.deepEqual(
          fixture.summaryRequests().map((request) => request.range),
          [{ from: currentRange.from, to: currentRange.to }],
          "Initial summary is not the current local month"
        );
        assert.deepEqual(
          report.states[0].filters.times,
          [currentRange.from, currentRange.end],
          "Displayed month does not match the summary request"
        );
        await checkKeyboardFocus(page, engine, profile);
        if (profile.name === "desktop-1440")
          report.filterChecks.push(
            ...(await checkResponsiveBoundaries(page, engine, profile, "month"))
          );
        if (saveScreenshots && [1440, 1906, 390].includes(profile.width)) {
          const path = join(screenshotDir, `${engine}-${profile.name}-mixed.png`);
          await page.screenshot({ path, fullPage: true });
          report.screenshot = path;
          if (profile.touch && engine === "chromium") {
            const session = await context.newCDPSession(page);
            await session.send("Emulation.setTouchEmulationEnabled", {
              enabled: true,
              maxTouchPoints: 1,
            });
          }
          report.states.push(await measure(page, engine, profile, "mixed"));
        }
        const period = page.locator(".ledger-overview-filters select");
        await period.selectOption("custom");
        await page.locator('.ledger-overview-filters[data-period="custom"]').waitFor();
        report.filterChecks.push(await measureFilters(page, engine, profile, "custom-default"));
        assert.equal(
          fixture.summaryRequests().length,
          1,
          "Switching to equivalent custom dates made an unnecessary summary read"
        );
        assert.deepEqual(
          await page
            .locator(".ledger-overview-date-fields input")
            .evaluateAll((inputs) => inputs.map((input) => input.value)),
          [currentRange.from, currentRange.end],
          "Custom dates did not retain the current range"
        );
        if (profile.name === "desktop-1440")
          report.filterChecks.push(
            ...(await checkResponsiveBoundaries(page, engine, profile, "custom"))
          );
        const dates = page.locator('.ledger-overview-date-fields input[type="date"]');
        const start = `${currentMonth}-10`;
        const inclusiveTo = `${currentMonth}-11`;
        await readRange(page, fixture, () => dates.first().fill(start), {
          from: start,
          to: currentRange.to,
        });
        report.states.push(await measure(page, engine, profile, "mixed"));
        await readRange(page, fixture, () => dates.last().fill(start), {
          from: start,
          to: inclusiveTo,
        });
        const oneDay = await measure(page, engine, profile, "mixed");
        assert.deepEqual(
          oneDay.filters.times,
          [start, start],
          "Inclusive same-day range is incorrect"
        );
        report.states.push(oneDay);
        const readsBeforeInvalid = fixture.summaryRequests().length;
        await dates.last().fill(`${currentMonth}-09`);
        await page.locator('.ledger-overview-period [role="status"]').waitFor();
        report.filterChecks.push(await measureFilters(page, engine, profile, "custom-invalid"));
        assert.equal(
          fixture.summaryRequests().length,
          readsBeforeInvalid,
          "Invalid custom dates reached the summary API"
        );
        assert.equal(
          await page.locator(".ledger-summary").count(),
          0,
          "Invalid range retains successful totals"
        );
        await checkKeyboardFocus(page, engine, profile);
        await readRange(page, fixture, () => page.keyboard.press("Enter"), {
          from: currentRange.from,
          to: currentRange.to,
        });
        assert.equal(await period.inputValue(), "month", "Keyboard shortcut did not select Month");
        assert.equal(
          await page.locator('input[type="month"]').inputValue(),
          currentMonth,
          "This month did not restore the initial local month"
        );
        const restored = await measure(page, engine, profile, "mixed");
        assert.deepEqual(
          restored.filters.times,
          [currentRange.from, currentRange.end],
          "This month did not restore the displayed inclusive range"
        );
        report.states.push(restored);
        for (const [stage, month] of [
          ["long", "2026-08"],
          ["zero", "2026-07"],
          ["error", "2026-06"],
        ]) {
          fixture.setStage(stage);
          const selected = monthDates(month);
          await readRange(page, fixture, () => page.locator('input[type="month"]').fill(month), {
            from: selected.from,
            to: selected.to,
          });
          await page.locator(".ledger-summary").waitFor();
          const state = await measure(page, engine, profile, stage);
          assert.deepEqual(
            state.filters.times,
            [selected.from, selected.end],
            "Selected month display does not match the summary range"
          );
          report.states.push(state);
        }
        assert.deepEqual(
          fixture.summaryRequests().map((request) => request.range),
          [
            { from: currentRange.from, to: currentRange.to },
            { from: start, to: currentRange.to },
            { from: start, to: inclusiveTo },
            { from: currentRange.from, to: currentRange.to },
            ...["2026-08", "2026-07", "2026-06"].map((month) => {
              const selected = monthDates(month);
              return { from: selected.from, to: selected.to };
            }),
          ],
          "Unexpected summary range sequence or automatic reads"
        );
        report.requests = fixture.assertClean();
        assert.deepEqual(errors, [], `${engine}/${profile.name}: browser errors`);
        reports.push(report);
        process.stderr.write(`${engine}/${profile.name}: ${report.states.length} states passed\n`);
      } catch (error) {
        process.stderr.write(JSON.stringify({ ...report, error: error.message }) + "\n");
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
          "Bounded loopback GET-only synthetic fixtures. Engine geometry and emulated touch evidence; no remote API, business writes, polling or physical-device acceptance.",
        maxContexts: contextCap,
        perContextRequestCap: 100,
        perContextSummaryReadCap: summaryReadCap,
        perContextAPIReadCap: apiReadCap,
        contexts: reports.length,
        states: reports.reduce((sum, report) => sum + report.states.length, 0),
        reports,
      },
      null,
      2
    ) + "\n"
  );
} finally {
  const cleanup = await Promise.allSettled([
    activeBrowser?.close(),
    server
      ? new Promise((done, reject) => {
          server.httpServer.closeAllConnections?.();
          server.httpServer.close((error) => (error ? reject(error) : done()));
        })
      : Promise.resolve(),
  ]);
  await rm(runtimeHome, { recursive: true, force: true });
  const failures = cleanup.filter((result) => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Overview cleanup failed"
    );
}
