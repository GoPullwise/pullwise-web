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
const profiles = [
  { name: "desktop-1440", width: 1440, height: 1000, touch: false, lang: "en", theme: "light" },
  { name: "tablet-1024", width: 1024, height: 1000, touch: true, lang: "en", theme: "light" },
  { name: "phone-390", width: 390, height: 844, touch: true, lang: "zh", theme: "dark" },
  ...["en", "zh", "ja", "ko", "fr", "es"].map((lang, index) => ({
    name: `phone-320-${lang}`,
    width: 320,
    height: 844,
    touch: true,
    lang,
    theme: index % 2 ? "dark" : "light",
  })),
];
assert(engines.length * profiles.length <= 27, "Context cap exceeded (27)");
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
          requests.filter((item) => item.summary).length <= 4,
          "Summary read cap exceeded (4)"
        );
        assert.equal(request.headers()["x-pullwise-workspace"], WORKSPACE_ID);
        assert.deepEqual([...url.searchParams.keys()].sort(), ["from", "to"]);
        for (const key of ["from", "to"])
          assert(/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get(key)), "Invalid summary date");
        assert(url.searchParams.get("from") < url.searchParams.get("to"), "Invalid summary range");
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
        4,
        "Unexpected automatic summary reads"
      );
      const inherited = core.assertClean();
      assert(inherited.api + 4 <= 16, "Overview API read cap exceeded (16)");
      return { total: requests.length, summary: 4, inherited };
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
      const report = { engine, version: activeBrowser.version(), profile, states: [] };
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
        if (saveScreenshots && [1440, 390].includes(profile.width)) {
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
        for (const [stage, month] of [
          ["long", "2026-08"],
          ["zero", "2026-07"],
          ["error", "2026-06"],
        ]) {
          fixture.setStage(stage);
          await Promise.all([
            page.waitForResponse(
              (response) => new URL(response.url()).pathname === "/api/api/v1/reports/summary"
            ),
            page.locator('input[type="month"]').fill(month),
          ]);
          await page.locator(".ledger-summary").waitFor();
          report.states.push(await measure(page, engine, profile, stage));
        }
        report.requests = fixture.assertClean();
        assert.deepEqual(errors, [], `${engine}/${profile.name}: browser errors`);
        reports.push(report);
        process.stdout.write(`${engine}/${profile.name}: ${report.states.length} states passed\n`);
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
        maxContexts: 27,
        perContextRequestCap: 100,
        perContextAPIReadCap: 16,
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
