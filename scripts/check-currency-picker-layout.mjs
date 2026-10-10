import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { COMMON_CURRENCIES, CURRENCY_PICKER_COPY } from "../src/locales/currency-picker.js";
import { createMobileLayoutFixture } from "./mobile-layout-fixtures.mjs";

// Run after build. Local GET-only fixtures reject every attempted business
// write, including unintended form submission from picker Enter handling.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:4248";
const screenshots = process.argv.slice(2).includes("--screenshots");
assert(
  process.argv.slice(2).every((argument) => argument === "--screenshots"),
  "Usage: node scripts/check-currency-picker-layout.mjs [--screenshots]"
);
const profiles = [
  ...["en", "fr", "es"].map((lang) => ({
    name: `desktop-1440-${lang}-rail260`,
    width: 1440,
    height: 1000,
    lang,
    theme: lang === "es" ? "dark" : "light",
    touch: false,
  })),
  ...["en", "zh", "ja", "ko", "fr", "es"].map((lang, index) => ({
    name: `phone-320-${lang}`,
    width: 320,
    height: 844,
    lang,
    theme: index % 2 ? "dark" : "light",
    touch: true,
  })),
];
const copy = (key, lang) => CURRENCY_PICKER_COPY[key][1][lang] || CURRENCY_PICKER_COPY[key][0];
const reports = [];
const activate = (locator, profile) => (profile.touch ? locator.tap() : locator.click());
const runtimeHome = await mkdtemp(join(tmpdir(), "pullwise-currency-picker-"));
const screenshotDir = join(root, "..", "work", "currency-picker-layout");
if (screenshots) await mkdir(screenshotDir, { recursive: true });
let server;
let browser;

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

async function dismissOutside(page, profile) {
  await settle(page);
  const point = await page.evaluate(() => {
    const menu = document.querySelector(".currency-picker-popover");
    const picker = menu.closest(".currency-picker");
    const box = menu.getBoundingClientRect();
    const top = document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0;
    const nav = innerWidth <= 760 ? document.querySelector(".mobile-tabbar") : null;
    const bottom = nav?.getBoundingClientRect().top || innerHeight;
    const interactive =
      'a, button, input, select, textarea, label, [role="button"], [role="separator"]';
    for (const x of [box.left - 8, box.right + 8, 5, innerWidth - 5]) {
      for (const y of [(top + bottom) / 2, top + 20, bottom - 20]) {
        if (x <= 0 || x >= innerWidth || y <= top || y >= bottom) continue;
        const target = document.elementFromPoint(x, y);
        if (target && !picker.contains(target) && !target.closest(interactive))
          return { x, y, target: target.tagName };
      }
    }
    return null;
  });
  assert(point, "No visible non-interactive background outside currency picker");
  if (profile.touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  return point;
}

async function measure(page, profile, stage) {
  await settle(page);
  const data = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const picker = document.querySelector('#expense-form button[role="combobox"]');
    const menu = document.querySelector(".currency-picker-popover");
    const nav =
      innerWidth <= 760
        ? [...document.querySelectorAll(".mobile-tabbar")].find(
            (element) =>
              element.getBoundingClientRect().height > 0 &&
              getComputedStyle(element).visibility !== "hidden"
          )
        : null;
    const topbar = document.querySelector(".topbar");
    const controls = menu
      ? [...menu.querySelectorAll("input, button")].map((element) => ({
          rect: rect(element),
          tag: element.tagName,
          font: Number.parseFloat(getComputedStyle(element).fontSize),
        }))
      : [];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      scrollY,
      coarse: matchMedia("(pointer: coarse)").matches,
      touchPoints: navigator.maxTouchPoints,
      trigger: {
        rect: rect(picker),
        font: Number.parseFloat(getComputedStyle(picker).fontSize),
        text: picker.textContent,
        labelled: Boolean(picker.getAttribute("aria-label")),
      },
      field: rect(picker.closest(".ledger-field")),
      menu: menu
        ? {
            rect: rect(menu),
            overflow: getComputedStyle(menu).overflowY,
            scrollWidth: menu.scrollWidth,
            clientWidth: menu.clientWidth,
          }
        : null,
      options: menu
        ? [...menu.querySelectorAll('[role="option"]')].map((element) => ({
            rect: rect(element),
            text: element.textContent,
          }))
        : [],
      controls,
      navTop: nav ? rect(nav).top : innerHeight,
      topbarBottom: topbar ? rect(topbar).bottom : 0,
    };
  });
  const details = `${profile.name}/${stage}: ${JSON.stringify(data)}`;
  assert(data.documentWidth <= data.viewport.width + 1, `Document overflow: ${details}`);
  assert.equal(data.coarse, profile.touch, details);
  if (profile.touch) assert(data.touchPoints > 0, `Touch emulation missing: ${details}`);
  assert(data.trigger.labelled, `Trigger is unlabelled: ${details}`);
  assert(
    Math.abs(data.trigger.rect.left - data.field.left) <= 1 &&
      Math.abs(data.trigger.rect.right - data.field.right) <= 1,
    `Picker does not align with form field: ${details}`
  );
  if (profile.touch) {
    assert(
      data.trigger.rect.height >= 44 && data.trigger.font >= 16,
      `Small touch trigger: ${details}`
    );
    for (const control of data.controls)
      assert(
        control.rect.height >= 44 && (control.tag !== "INPUT" || control.font >= 16),
        `Small custom touch control: ${details}`
      );
  }
  if (data.menu) {
    assert(
      data.menu.scrollWidth <= data.menu.clientWidth + 1,
      `Popover horizontal overflow: ${details}`
    );
    assert(
      data.menu.rect.left >= -1 && data.menu.rect.right <= data.viewport.width + 1,
      `Popover escapes horizontal viewport: ${details}`
    );
    assert(
      data.menu.rect.top >= Math.max(0, data.topbarBottom) - 1 &&
        data.menu.rect.bottom <= data.navTop + 1,
      `Popover is obscured by header or phone navigation: ${details}`
    );
    for (const option of data.options) {
      assert(option.rect.height >= 44, `Small option target: ${details}`);
      assert(
        option.rect.left >= data.menu.rect.left - 1 &&
          option.rect.right <= data.menu.rect.right + 1,
        `Option escapes popover: ${details}`
      );
    }
  }
  return { stage, ...data };
}

await access(join(root, "dist", "index.html"));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, "node_modules", ".cache", "ms-playwright");
try {
  server = await preview({
    configFile: false,
    root,
    appType: "spa",
    logLevel: "warn",
    server: { proxy: {} },
    preview: { host: "127.0.0.1", port: 4248, strictPort: true, proxy: {} },
  });
  const { chromium } = await import("playwright");
  let executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (
    !executablePath &&
    !(await exists(chromium.executablePath())) &&
    (await exists("/usr/bin/chromium"))
  )
    executablePath = "/usr/bin/chromium";
  browser = await chromium.launch({
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
    const fixture = createMobileLayoutFixture({ baseURL });
    const requests = [];
    const violations = [];
    const errors = [];
    const report = { profile, engine: "chromium", version: browser.version(), states: [] };
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      locale: profile.lang,
      hasTouch: profile.touch,
      isMobile: profile.touch,
      serviceWorkers: "block",
    });
    try {
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const api =
          request.resourceType() !== "document" &&
          /^\/(?:api|auth|billing)(?:\/|$)/.test(url.pathname);
        requests.push({ method: request.method(), url: url.href, api });
        try {
          assert.equal(
            request.method(),
            "GET",
            "Picker interactions must never submit the expense form"
          );
          assert(requests.length <= 60, "Request cap exceeded (60)");
          assert(requests.filter((item) => item.api).length <= 20, "API read cap exceeded (20)");
          await fixture.handle(route);
        } catch (error) {
          violations.push({ ...requests.at(-1), reason: error.message });
          await route.abort("blockedbyclient");
        }
      });
      context.on("response", fixture.recordResponse);
      await context.addInitScript(({ lang, theme }) => {
        localStorage.setItem("pw-lang", lang);
        localStorage.setItem("pw-theme", theme);
      }, profile);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseURL}/shared`, { waitUntil: "domcontentloaded" });
      await activate(page.locator('.page-h button[aria-controls="expense-form"]'), profile);
      const form = page.locator("#expense-form");
      await form.locator('input[type="date"]').fill("2026-10-10");
      await form.locator('input[placeholder="12.00"]').fill("12.50");
      await form.locator("select").first().selectOption("cat_date_hosting");
      await form.locator('input[maxlength="500"]').fill("Local currency UI fixture");
      const trigger = form
        .getByRole("combobox")
        .filter({ has: page.locator("span.currency-picker-value") });
      await trigger.waitFor();
      if (!profile.touch) {
        const handle = form.locator("..").locator(":scope > .ledger-split-resizer");
        await handle.press("Home");
        assert.equal(await handle.getAttribute("aria-valuenow"), "260");
        await settle(page);
        assert(
          Math.abs((await form.boundingBox()).width - 260) <= 1,
          "Desktop expense rail did not resize to 260px"
        );
      }
      await trigger.evaluate((element) => element.scrollIntoView({ block: "center" }));
      await settle(page);
      assert.equal(await trigger.textContent(), "USD");
      if (!profile.touch) {
        const session = await context.newCDPSession(page);
        const document = await session.send("DOM.getDocument");
        const { nodeId } = await session.send("DOM.querySelector", {
          nodeId: document.root.nodeId,
          selector: '#expense-form button[role="combobox"]',
        });
        const { nodes } = await session.send("Accessibility.getPartialAXTree", {
          nodeId,
          fetchRelatives: false,
        });
        report.closedAccessibility =
          nodes.find((node) => node.role?.value === "combobox") || nodes[0];
        assert.equal(
          report.closedAccessibility.value?.value,
          "USD",
          "Closed combobox does not expose its selected currency value"
        );
        await session.detach();
      }
      const baselineReads = requests.filter((item) => item.api).length;
      report.states.push(await measure(page, profile, "closed-code"));
      await activate(trigger, profile);
      const list = page.getByRole("listbox");
      for (const currency of COMMON_CURRENCIES)
        assert.equal(
          await list
            .getByRole("option", {
              name: `${currency.code} - ${currency.names[profile.lang]}`,
              exact: true,
            })
            .count(),
          1
        );
      report.states.push(await measure(page, profile, "common-options"));
      await trigger.press("End");
      await trigger.press("Enter");
      const input = page.getByLabel(copy("code", profile.lang), { exact: true });
      await input.fill("se");
      assert.equal(await input.inputValue(), "SE");
      assert.equal(await trigger.textContent(), "USD");
      const confirm = page.getByRole("button", { name: copy("use", profile.lang), exact: true });
      assert(await confirm.isDisabled());
      await input.fill("sek");
      assert.equal(await input.inputValue(), "SEK");
      assert.equal(await trigger.textContent(), "USD");
      report.states.push(await measure(page, profile, "custom-unconfirmed"));
      if (
        screenshots &&
        ["desktop-1440-fr-rail260", "phone-320-zh", "phone-320-fr"].includes(profile.name)
      ) {
        const path = join(screenshotDir, `${profile.name}-custom.png`);
        await page.screenshot({ path });
        report.screenshot = path;
        if (profile.touch) {
          const session = await context.newCDPSession(page);
          await session.send("Emulation.setTouchEmulationEnabled", {
            enabled: true,
            maxTouchPoints: 1,
          });
        }
        report.states.push(await measure(page, profile, "after-screenshot"));
      }
      await input.press("Escape");
      assert.equal(await page.getByRole("listbox").count(), 0);
      assert.equal(await trigger.textContent(), "USD");
      assert(await trigger.evaluate((element) => document.activeElement === element));
      await trigger.press("ArrowDown");
      await page.keyboard.press("End");
      await page.keyboard.press("Enter");
      await input.fill("nok");
      await input.press("Enter");
      assert.equal(await trigger.textContent(), "NOK");
      assert.equal(await page.getByRole("listbox").count(), 0);
      report.states.push(await measure(page, profile, "confirmed-enter-code"));
      await activate(trigger, profile);
      await activate(page.getByRole("option", { name: /^EUR - / }), profile);
      assert.equal(await trigger.textContent(), "EUR");
      await activate(trigger, profile);
      await activate(
        page.getByRole("option", { name: copy("custom", profile.lang), exact: true }),
        profile
      );
      await input.fill("SEK");
      report.outsideDismissal = await dismissOutside(page, profile);
      assert.equal(await page.getByRole("listbox").count(), 0);
      assert.equal(await trigger.textContent(), "EUR");
      assert.equal(await form.locator('input[placeholder="12.00"]').inputValue(), "12.50");
      report.states.push(await measure(page, profile, "outside-dismissed"));
      if (profile.name === "phone-320-en") {
        await page.setViewportSize({ width: 320, height: 360 });
        await trigger.evaluate((element) => element.scrollIntoView({ block: "center" }));
        await trigger.press("ArrowDown");
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        await input.fill("SEK");
        await confirm.scrollIntoViewIfNeeded();
        const hit = await confirm.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const actual = document.elementFromPoint(
            (box.left + box.right) / 2,
            (box.top + box.bottom) / 2
          );
          return actual === element || element.contains(actual);
        });
        assert(hit, "Custom confirm is obscured in reduced 360px viewport");
        report.states.push(await measure(page, profile, "reduced-viewport-confirm-reachable"));
        await confirm.click();
        assert.equal(await trigger.textContent(), "SEK");
      }
      assert.equal(
        requests.filter((item) => item.api).length,
        baselineReads,
        "Local currency selection initiated extra API reads"
      );
      assert.deepEqual(violations, []);
      assert.deepEqual(errors, []);
      report.requests = fixture.assertClean();
      reports.push(report);
      process.stderr.write(
        `${profile.name}: ${report.states.length} states passed; ${report.requests.total} GET; ${report.requests.api} API\n`
      );
    } catch (error) {
      process.stderr.write(
        JSON.stringify({
          ...report,
          completedReports: reports,
          violations,
          errors,
          requests,
          error: error.message,
        }) + "\n"
      );
      throw error;
    } finally {
      await context.close();
    }
  }
  process.stdout.write(
    JSON.stringify(
      {
        scope:
          "Chromium-only local GET fixtures, six locales, simulated touch and reduced viewport. No business writes, external delivery, browser installation or physical OS keyboard/device acceptance.",
        contexts: reports.length,
        states: reports.reduce((sum, report) => sum + report.states.length, 0),
        perContextRequestCap: 60,
        perContextAPIReadCap: 20,
        reports,
      },
      null,
      2
    ) + "\n"
  );
} finally {
  await browser?.close();
  if (server)
    await new Promise((done, reject) => {
      server.httpServer.closeAllConnections?.();
      server.httpServer.close((error) => (error ? reject(error) : done()));
    });
  await rm(runtimeHome, { recursive: true, force: true });
}
