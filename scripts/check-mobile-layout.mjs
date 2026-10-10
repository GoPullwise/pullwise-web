import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { createMobileLayoutFixture } from "./mobile-layout-fixtures.mjs";
import { checkEntryControlLayout } from "./entry-control-layout.mjs";

// Build dist first. Finite loopback fixtures establish engine/layout evidence;
// they do not establish physical iOS/Android or native virtual-keyboard acceptance.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:4248";
const tolerance = 1;
const profiles = [
  { name: "phone-320-en-light", width: 320, height: 720, lang: "en", theme: "light", touch: true },
  { name: "phone-320-fr-dark", width: 320, height: 720, lang: "fr", theme: "dark", touch: true },
  { name: "phone-390-zh-dark", width: 390, height: 844, lang: "zh", theme: "dark", touch: true },
  { name: "phone-390-en-light", width: 390, height: 844, lang: "en", theme: "light", touch: true },
  {
    name: "android-412-en-light",
    width: 412,
    height: 915,
    lang: "en",
    theme: "light",
    touch: true,
  },
  { name: "android-412-fr-dark", width: 412, height: 915, lang: "fr", theme: "dark", touch: true },
  {
    name: "tablet-768-zh-light",
    width: 768,
    height: 1024,
    lang: "zh",
    theme: "light",
    touch: true,
  },
  { name: "tablet-1024-fr-dark", width: 1024, height: 768, lang: "fr", theme: "dark", touch: true },
  {
    name: "desktop-1440-en-light",
    width: 1440,
    height: 1000,
    lang: "en",
    theme: "light",
    touch: false,
  },
  {
    name: "short-landscape-640-en-light",
    width: 640,
    height: 320,
    lang: "en",
    theme: "light",
    touch: true,
  },
];
const requested = process.argv.slice(2);
const saveScreenshots = requested.includes("--screenshots");
const args = requested.filter((argument) => argument !== "--screenshots");
assert(
  args.length === 0 || (args.length === 1 && /^--browser=(chromium|webkit)$/.test(args[0])),
  "Usage: node scripts/check-mobile-layout.mjs [--browser=chromium|webkit] [--screenshots]"
);
const engines = args.length ? [args[0].split("=")[1]] : ["chromium", "webkit"];
assert(engines.length * profiles.length <= 20, "Context cap exceeded (20)");
const screenshotTouchSessions = new WeakMap();

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
    // Read settled geometry after the existing finite entrance transitions;
    // preserve real animations and ignore perpetual loading indicators.
    const animations = document.getAnimations().filter((animation) => {
      const end = animation.effect?.getComputedTiming().endTime;
      return Number.isFinite(end) && end <= 1000;
    });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function measure(page, report, name) {
  await settle(page);
  const measured = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return (
        element.getClientRects().length > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !(Number.parseFloat(style.opacity) === 0 && style.pointerEvents === "none")
      );
    };
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const label = (element) =>
      element.getAttribute("aria-label") ||
      (element.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
        .trim() ||
      Array.from(element.labels || [])
        .map((item) => item.textContent)
        .join(" ") ||
      element.textContent.trim();
    const nav = Array.from(document.querySelectorAll(".mobile-tabbar")).find(visible);
    const main = document.querySelector(".main");
    const controls = Array.from(
      document.querySelectorAll(
        '.main button, .main input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), .main select, .main textarea, .main .btn[href], .topbar button, .topbar .btn[href], .topbar select, .side a[href], .side select, .mobile-tabbar a[href], .mobile-tabbar button, .mobile-tabbar select, .preferences-toggle, .preferences-actions button'
      )
    ).filter(visible);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pathname: location.pathname,
      measuredNavHeight: Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--mobile-nav-height")
      ),
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      lang: document.documentElement.lang,
      theme: document.documentElement.dataset.theme,
      coarse: matchMedia("(pointer: coarse)").matches,
      touchPoints: navigator.maxTouchPoints,
      main: main ? rect(main) : null,
      nav: nav
        ? {
            rect: rect(nav),
            position: getComputedStyle(nav).position,
            accessibleName: label(nav),
            landmark:
              nav.tagName === "NAV" ||
              nav.getAttribute("role") === "navigation" ||
              Boolean(nav.querySelector("nav[aria-label], [role='navigation'][aria-label]")),
            controls: Array.from(nav.querySelectorAll("a[href], button, select"))
              .filter(visible)
              .map((control) => ({
                rect: rect(control),
                tag: control.tagName,
                href: control.getAttribute("href"),
                label: label(control),
                current: control.getAttribute("aria-current"),
                selected: control.tagName === "SELECT" ? control.value : null,
                options:
                  control.tagName === "SELECT"
                    ? Array.from(control.options).map((option) => option.value)
                    : [],
              })),
          }
        : null,
      sidebarLinks: Array.from(document.querySelectorAll(".side a[href]"))
        .filter(visible)
        .map((link) => link.getAttribute("href")),
      controls: controls.map((control) => ({
        rect: rect(control),
        tag: control.tagName,
        type: control.type,
        className: control.className,
        label: label(control),
        disabled: control.matches(":disabled"),
        fontSize: Number.parseFloat(getComputedStyle(control).fontSize),
      })),
    };
  });
  const prefix = `${report.engine}/${report.profile.name}/${name}`;
  const details = `${prefix}: ${JSON.stringify(measured)}`;
  assert.equal(measured.lang.split("-")[0], report.profile.lang, details);
  assert.equal(measured.theme, report.profile.theme, details);
  assert.equal(measured.coarse, report.profile.touch, details);
  if (report.profile.touch && report.engine === "chromium")
    assert(measured.touchPoints > 0, `Chromium touch emulation unavailable: ${details}`);
  assert(
    measured.documentWidth <= measured.viewport.width + tolerance,
    `Document overflow: ${details}`
  );
  assert(measured.bodyWidth <= measured.viewport.width + tolerance, `Body overflow: ${details}`);
  assert(measured.main && measured.main.width > 0, `Main content missing: ${details}`);
  const phone = measured.viewport.width <= 760;
  if (phone) {
    assert(measured.nav, `Phone bottom navigation missing: ${details}`);
    assert.equal(measured.nav.position, "fixed", details);
    assert(
      measured.nav.landmark,
      `Bottom navigation lacks a named navigation landmark: ${details}`
    );
    assert(
      measured.nav.rect.height >= 64 - tolerance,
      `Bottom navigation shorter than 64px: ${details}`
    );
    assert(
      Math.abs(measured.nav.rect.bottom - measured.viewport.height) <= tolerance,
      `Bottom navigation is not at viewport bottom: ${details}`
    );
    assert.equal(
      measured.nav.controls.length,
      5,
      `Phone navigation must expose 5 controls: ${details}`
    );
    assert.deepEqual(
      measured.nav.controls.filter((item) => item.href).map((item) => item.href),
      ["/overview", "/projects", "/shared", "/categories"],
      details
    );
    for (const control of measured.nav.controls)
      assert(control.label.trim(), `Unnamed bottom navigation control: ${details}`);
    const firstTop = measured.nav.controls[0].rect.top;
    for (const control of measured.nav.controls)
      assert(
        Math.abs(control.rect.top - firstTop) <= tolerance,
        `Bottom navigation wrapped to a second row: ${details}`
      );
    assert(
      Math.abs(measured.measuredNavHeight - measured.nav.rect.height) <= tolerance,
      `Measured bottom navigation height does not reserve its full border box: ${details}`
    );
    const current = measured.nav.controls.filter((control) => control.current === "page");
    if (["/overview", "/projects", "/shared", "/categories"].includes(measured.pathname)) {
      assert.equal(
        current.length,
        1,
        `Primary mobile navigation has no unique current destination: ${details}`
      );
      assert.equal(current[0].href, measured.pathname, details);
    } else {
      assert.equal(current.length, 0, `Unrelated primary destination remains active: ${details}`);
      const expected = {
        "/api-keys": "apiKeys",
        "/members": "ledgerMembers",
        "/billing": "billing",
        "/settings": "settings",
      }[measured.pathname];
      assert.equal(
        measured.nav.controls.find((control) => control.tag === "SELECT")?.selected,
        expected,
        `More selection does not identify current destination: ${details}`
      );
    }
  } else {
    assert(
      measured.nav && measured.nav.position !== "fixed",
      `Tablet/desktop unexpectedly uses phone bottom navigation: ${details}`
    );
    for (const path of [
      "/projects",
      "/shared",
      "/categories",
      "/api-keys",
      "/members",
      "/billing",
      "/settings",
    ])
      assert(
        measured.sidebarLinks.includes(path),
        `Desktop sidebar destination missing (${path}): ${details}`
      );
  }
  for (const control of measured.controls) {
    assert(
      control.rect.left >= -tolerance && control.rect.right <= measured.viewport.width + tolerance,
      `Control escapes viewport horizontally: ${details}`
    );
    if (report.profile.touch)
      assert(
        control.rect.height >= 44 - tolerance,
        `Touch target shorter than 44px (${control.label}): ${details}`
      );
    if (report.profile.touch && ["INPUT", "SELECT", "TEXTAREA"].includes(control.tag))
      assert(
        control.fontSize >= 16 - 0.05,
        `Input text smaller than 16px (${control.label}): ${details}`
      );
  }
  report.states.push({
    name,
    viewport: measured.viewport,
    controls: measured.controls.length,
    bottomNavigation: phone && measured.nav.position === "fixed",
    coarse: measured.coarse,
    touchPoints: measured.touchPoints,
    entryControls: await checkEntryControlLayout(page, prefix),
  });
  return measured;
}

const screenshotDir = join(root, "..", "work", "mobile-redesign-validation", "captures");

async function capture(page, report, name) {
  if (!saveScreenshots) return;
  const phone = report.profile.width === 390 && ["zh", "en"].includes(report.profile.lang);
  const projects =
    name === "projects" &&
    (phone ||
      (report.profile.width === 768 && report.profile.lang === "zh") ||
      report.profile.width === 1440);
  const reports =
    name === "shared-reports" &&
    (phone || (report.profile.width === 768 && report.profile.lang === "zh"));
  if (!projects && !reports && !(phone && ["shared-form", "inbox"].includes(name))) return;
  const path = join(screenshotDir, `${report.engine}-${report.profile.name}-${name}.png`);
  const previousScroll =
    projects || reports ? await page.evaluate(() => ({ x: scrollX, y: scrollY })) : null;
  if (previousScroll) {
    // Compose overview captures from the top while leaving the earlier focused
    // geometry measurement and subsequent interaction scroll state intact.
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await settle(page);
  }
  await page.screenshot({ path });
  if (report.engine === "chromium" && report.profile.touch) {
    // Some capture environments reset Chromium's touch device after a shot.
    // Restore its real emulation before subsequent geometry and interactions.
    let session = screenshotTouchSessions.get(page);
    if (!session) {
      session = await page.context().newCDPSession(page);
      screenshotTouchSessions.set(page, session);
    }
    await session.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
  }
  const pointer = await page.evaluate(() => ({
    coarse: matchMedia("(pointer: coarse)").matches,
    touchPoints: navigator.maxTouchPoints,
  }));
  assert.equal(pointer.coarse, report.profile.touch, "Screenshot changed pointer media");
  if (report.engine === "chromium" && report.profile.touch)
    assert(pointer.touchPoints > 0, "Screenshot cleared Chromium touch emulation");
  (report.screenshots ||= []).push({ path, ...pointer });
  if (previousScroll) {
    await page.evaluate(
      ({ x, y }) => window.scrollTo({ left: x, top: y, behavior: "instant" }),
      previousScroll
    );
    await settle(page);
  }
}

async function activate(locator, report) {
  if (report.engine === "chromium" && report.profile.touch) await locator.tap();
  else await locator.click();
}

async function ready(page) {
  await page.locator(".main h1").first().waitFor();
  await page.locator(".topbar-loading").waitFor({ state: "detached" });
  await page.locator('.main [class*="skeleton"]').first().waitFor({ state: "detached" });
  await settle(page);
}

async function navigate(page, report, path, key) {
  if (page.viewportSize().width <= 760) {
    if (["/overview", "/projects", "/shared", "/categories"].includes(path))
      await activate(page.locator(`.mobile-tabbar a[href="${path}"]`), report);
    else {
      const more = page.locator(".mobile-tabbar select");
      assert(
        await more.isVisible(),
        "Mobile More must expose a native accessible destination selector"
      );
      await more.selectOption(key);
    }
  } else await page.locator(`.side a[href="${path}"]`).click();
  await page.waitForURL(`${baseURL}${path}`);
  await ready(page);
}

async function checkLastControl(page, report, name) {
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })
  );
  await settle(page);
  const scrolledToControl = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll(
        '.main button:not(:disabled), .main input:not(:disabled):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), .main select:not(:disabled), .main textarea:not(:disabled), .main a.btn[href]'
      )
    ).filter(
      (element) =>
        element.getClientRects().length && getComputedStyle(element).visibility !== "hidden"
    );
    const control = controls.sort(
      (left, right) => right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom
    )[0];
    const header = document.querySelector(".topbar");
    const visibleTop =
      header && getComputedStyle(header).position === "sticky"
        ? Math.max(0, header.getBoundingClientRect().bottom)
        : 0;
    // Read-only material can follow the last action, especially on Billing.
    // An action above the viewport at document end must be reachable by scroll;
    // actions already at the end still face the stricter bottom-dock check.
    if (control && control.getBoundingClientRect().top < visibleTop) {
      control.scrollIntoView({ block: "center", behavior: "instant" });
      return true;
    }
    return false;
  });
  await settle(page);
  const last = await page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll(
        '.main button:not(:disabled), .main input:not(:disabled):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), .main select:not(:disabled), .main textarea:not(:disabled), .main a.btn[href]'
      )
    ).filter(
      (element) =>
        element.getClientRects().length && getComputedStyle(element).visibility !== "hidden"
    );
    const control = controls.sort(
      (left, right) => right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom
    )[0];
    if (!control) return null;
    const box = control.getBoundingClientRect();
    const point = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    const nav = document.querySelector(".mobile-tabbar");
    const header = document.querySelector(".topbar");
    return {
      label: control.getAttribute("aria-label") || control.textContent.trim() || control.tagName,
      top: box.top,
      bottom: box.bottom,
      height: innerHeight,
      visibleTop:
        header && getComputedStyle(header).position === "sticky"
          ? Math.max(0, header.getBoundingClientRect().bottom)
          : 0,
      navTop:
        nav?.getClientRects().length && getComputedStyle(nav).position === "fixed"
          ? nav.getBoundingClientRect().top
          : innerHeight,
      hit: hit === control || control.contains(hit),
    };
  });
  assert(last, `${name}: no final interactive control to inspect`);
  assert(
    last.top >= last.visibleTop - tolerance &&
      last.bottom <= Math.min(last.height, last.navTop) + tolerance,
    `${name}: final control obscured at document end ${JSON.stringify(last)}`
  );
  assert(last.hit, `${name}: final control is not hit-testable ${JSON.stringify(last)}`);
  report.states.push({ name, footerControl: last.label, hit: last.hit, scrolledToControl });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

async function checkPreferences(page, report) {
  const toggle = page.locator(".preferences-toggle");
  const phone = page.viewportSize().width <= 760;
  if (phone) {
    await toggle.waitFor();
    assert.equal(
      await toggle.getAttribute("aria-expanded"),
      "false",
      "Preferences must start collapsed"
    );
    await activate(toggle, report);
    assert.equal(
      await toggle.getAttribute("aria-expanded"),
      "true",
      "Preferences toggle did not expand"
    );
    const controlledId = await toggle.getAttribute("aria-controls");
    assert(controlledId, "Preferences toggle lacks aria-controls");
    assert(await page.locator(`[id="${controlledId}"]`).isVisible(), "Preferences panel missing");
  } else {
    assert.equal(
      await toggle.count(),
      0,
      "Tablet/desktop should preserve direct floating controls"
    );
    assert(
      await page.locator(".preferences-actions").isVisible(),
      "Desktop floating controls unavailable"
    );
  }
  await measure(page, report, phone ? "preferences-expanded" : "desktop-display-controls");
  await page.locator(".lang-toggle").click();
  const menu = page.locator(".lang-menu");
  await menu.waitFor();
  const box = await menu.boundingBox();
  assert(
    box &&
      box.x >= -tolerance &&
      box.y >= -tolerance &&
      box.x + box.width <= report.profile.width + tolerance &&
      box.y + box.height <= report.profile.height + tolerance,
    `Language menu escapes viewport: ${JSON.stringify(box)}`
  );
  await page.locator(".lang-toggle").press("Escape");
  await menu.waitFor({ state: "detached" });
  await page.locator(".theme-toggle").click();
  assert.equal(
    await page.locator("html").getAttribute("data-theme"),
    report.profile.theme === "light" ? "dark" : "light"
  );
  await page.locator(".theme-toggle").click();
  if (phone) {
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  }
}

async function checkModal(page, fixture, report) {
  fixture.setLongInbox();
  await page.evaluate(() => window.scrollTo({ top: 96, behavior: "instant" }));
  const before = await page.evaluate(() => ({
    y: scrollY,
    body: document.body.style.cssText,
    html: document.documentElement.style.cssText,
  }));
  const opener = page.locator(".topbar-actions > button:not(.preferences-toggle)").first();
  await opener.focus();
  await activate(opener, report);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page
    .locator('.invitation-inbox-body[aria-busy="false"] .invitation-inbox-row')
    .nth(15)
    .waitFor();
  const joinRows = dialog.locator('[aria-labelledby="join-requests-title"] .invitation-inbox-row');
  const pendingRows = dialog.locator(
    '[aria-labelledby="pending-expenses-title"] .invitation-inbox-row'
  );
  await pendingRows.nth(9).waitFor();
  assert.equal(await joinRows.count(), 16, "Long inbox join-request fixture is incomplete");
  assert.equal(await pendingRows.count(), 10, "Long inbox pending-expense fixture is incomplete");
  for (let index = 0; index < 10; index++) {
    const row = pendingRows.nth(index);
    const scheduledOn = `2026-${String(index + 1).padStart(2, "0")}-01`;
    assert.equal(await row.locator("time").getAttribute("datetime"), scheduledOn);
    assert.equal(await row.locator("time").textContent(), scheduledOn);
    assert.equal(await row.locator(".financial-value").textContent(), "USD 24.50");
    assert.equal(await row.locator("button").count(), 1, "Pending expense has no recovery action");
  }
  await settle(page);
  const inspect = async (name) => {
    await settle(page);
    const result = await dialog.evaluate((element) => {
      const box = (item) => {
        const { left, right, top, bottom, height } = item.getBoundingClientRect();
        return { left, right, top, bottom, height };
      };
      const body = element.querySelector(".modal-body");
      const foot = element.querySelector(".modal-foot");
      const action = foot.querySelector("button");
      const control = action.getBoundingClientRect();
      const hit = document.elementFromPoint(
        (control.left + control.right) / 2,
        (control.top + control.bottom) / 2
      );
      const bodyBox = body.getBoundingClientRect();
      const samples = Array.from(body.querySelectorAll(".invitation-inbox-row"))
        .map((row) => {
          const bounds = row.getBoundingClientRect();
          const top = Math.max(bodyBox.top + 4, bounds.top + 4);
          const bottom = Math.min(bodyBox.bottom - 4, bounds.bottom - 4);
          return { row, bounds, top, bottom };
        })
        .filter((sample) => sample.bottom > sample.top)
        .sort(
          (left, right) =>
            Math.abs((left.top + left.bottom) / 2 - (bodyBox.top + bodyBox.bottom) / 2) -
            Math.abs((right.top + right.bottom) / 2 - (bodyBox.top + bodyBox.bottom) / 2)
        );
      const sample = samples[0];
      const middleHit = sample
        ? sample.row.contains(
            document.elementFromPoint(
              (sample.bounds.left + sample.bounds.right) / 2,
              (sample.top + sample.bottom) / 2
            )
          )
        : false;
      const notifications = Array.from(document.querySelectorAll(".notification-stack"))
        .filter((stack) => stack.children.length > 0)
        .map((stack) => ({
          inert: Boolean(stack.closest("[inert]")),
          zIndex: Number.parseFloat(getComputedStyle(stack).zIndex),
        }));
      return {
        width: innerWidth,
        height: innerHeight,
        dialog: box(element),
        backdropZIndex: Number.parseFloat(getComputedStyle(element.closest(".modal-back")).zIndex),
        notifications,
        middleHit,
        body: box(body),
        footer: box(foot),
        overflow: getComputedStyle(body).overflowY,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight,
        bodyPosition: getComputedStyle(document.body).position,
        bodyOverflow: getComputedStyle(document.body).overflowY,
        htmlOverflow: getComputedStyle(document.documentElement).overflowY,
        focusWithin: element.contains(document.activeElement),
        footerHit: hit === action || action.contains(hit),
        backgroundInert: Array.from(
          document.querySelectorAll(".screen-root, .preferences-toggle")
        ).every((item) => Boolean(item.closest("[inert]"))),
      };
    });
    const details = `${report.engine}/${report.profile.name}/${name}: ${JSON.stringify(result)}`;
    assert(
      result.dialog.left >= -tolerance &&
        result.dialog.right <= result.width + tolerance &&
        result.dialog.top >= -tolerance &&
        result.dialog.bottom <= result.height + tolerance,
      `Modal escapes viewport: ${details}`
    );
    if (result.width <= 760)
      assert(
        Math.abs(result.dialog.bottom - result.height) <= tolerance,
        `Phone modal does not meet bottom edge: ${details}`
      );
    assert(
      ["auto", "scroll"].includes(result.overflow),
      `Modal body is not independently scrollable: ${details}`
    );
    assert(
      result.scrollHeight > result.clientHeight,
      `Long modal fixture is not scrollable: ${details}`
    );
    assert(
      result.body.top >= result.dialog.top - tolerance &&
        result.body.bottom <= result.footer.top + tolerance,
      `Modal body overlaps footer: ${details}`
    );
    assert(
      result.footer.bottom <= result.dialog.bottom + tolerance && result.footerHit,
      `Modal footer unavailable: ${details}`
    );
    assert(
      result.bodyPosition === "fixed" &&
        result.bodyOverflow === "hidden" &&
        result.htmlOverflow === "hidden",
      `Background scroll is unlocked: ${details}`
    );
    assert(
      result.focusWithin && result.backgroundInert,
      `Modal focus/background isolation failed: ${details}`
    );
    assert(result.middleHit, `Modal list is obscured at its visible middle: ${details}`);
    for (const notification of result.notifications)
      assert(
        notification.inert && notification.zIndex < result.backdropZIndex,
        `Background notification remains above or active through modal: ${details}`
      );
    report.states.push({ name, modal: result });
  };
  await inspect("modal-long-body");
  await capture(page, report, "inbox");
  const focusable = dialog.locator(
    "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)"
  );
  await focusable.last().focus();
  await page.keyboard.press("Tab");
  assert(
    await focusable.first().evaluate((element) => document.activeElement === element),
    "Modal Tab did not wrap to first control"
  );
  await page.keyboard.press("Shift+Tab");
  assert(
    await focusable.last().evaluate((element) => document.activeElement === element),
    "Modal Shift+Tab did not wrap to last control"
  );
  const body = dialog.locator(".modal-body");
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  assert(await body.evaluate((element) => element.scrollTop > 0), "Modal body cannot scroll");
  if (report.profile.width <= 760) {
    // A short visual viewport exercises CSS sizing and focused-control reach.
    // This does not emulate an OS keyboard or iOS visualViewport offsets.
    await page.setViewportSize({ width: report.profile.width, height: 260 });
    await inspect("modal-reduced-viewport-260");
    await page.setViewportSize({ width: report.profile.width, height: report.profile.height });
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await settle(page);
  const restored = await page.evaluate(() => ({
    y: scrollY,
    body: document.body.style.cssText,
    html: document.documentElement.style.cssText,
    inert: document.querySelectorAll("[inert]").length,
  }));
  assert.equal(restored.body, before.body, "Body styles were not restored after modal close");
  assert.equal(restored.html, before.html, "Root styles were not restored after modal close");
  assert.equal(restored.inert, 0, "Background remained inert after modal close");
  assert(
    Math.abs(restored.y - before.y) <= tolerance,
    "Modal close lost background scroll position"
  );
  assert(
    await opener.evaluate((element) => document.activeElement === element),
    "Modal close did not restore opener focus"
  );
  report.states.push({
    name: "modal-keyboard-scroll-restoration",
    focusRestored: true,
    scrollRestored: true,
  });
}

await access(join(root, "dist", "index.html"));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, "node_modules", ".cache", "ms-playwright");
const runtimeHome = await mkdtemp(join(tmpdir(), "pullwise-mobile-layout-"));
if (saveScreenshots) await mkdir(screenshotDir, { recursive: true });
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
      const fixture = createMobileLayoutFixture({ baseURL });
      const report = { engine, version: activeBrowser.version(), profile, states: [] };
      const context = await activeBrowser.newContext({
        viewport: { width: profile.width, height: profile.height },
        locale: profile.lang === "zh" ? "zh-CN" : profile.lang,
        hasTouch: profile.touch,
        isMobile: profile.width <= 760,
        serviceWorkers: "block",
      });
      const errors = [];
      try {
        await context.route("**/*", (route) => fixture.handle(route));
        context.on("response", fixture.recordResponse);
        await context.addInitScript(({ lang, theme }) => {
          localStorage.setItem("pw-lang", lang);
          localStorage.setItem("pw-theme", theme);
        }, profile);
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`${baseURL}/projects`, { waitUntil: "domcontentloaded" });
        await ready(page);
        const initial = await measure(page, report, "projects-navigation");
        report.touchEvidence = profile.touch
          ? engine === "chromium"
            ? "Coarse pointer, maxTouchPoints > 0 and genuine Playwright touchscreen taps"
            : `WebKit coarse-pointer geometry; reported maxTouchPoints=${initial.touchPoints}; no navigator overrides or claimed physical touch acceptance`
          : "Desktop fine-pointer geometry";
        await capture(page, report, "projects");
        await checkPreferences(page, report);
        for (const [path, key] of [
          ["/overview", "ledgerOverview"],
          ["/shared", "ledgerShared"],
          ["/categories", "ledgerCategories"],
          ["/api-keys", "apiKeys"],
          ["/members", "ledgerMembers"],
          ["/billing", "billing"],
          ["/settings", "settings"],
        ]) {
          await navigate(page, report, path, key);
          if (path === "/overview") {
            await page.locator('input[type="month"]').fill("2026-09");
            await page.locator(".ledger-summary-primary .financial-value").waitFor();
            assert.deepEqual(
              await page.locator(".ledger-summary .financial-value").allTextContents(),
              ["USD 24.00", "USD 12.00", "USD 12.00"],
              "Overview must include projects and shared expenses exactly once"
            );
            await page.locator('select[id$="-period"]').selectOption("custom");
            await page.locator('input[id$="-from"]').fill("2026-09-01");
            await page.locator('input[id$="-end"]').fill("2026-09-30");
            await page.locator(".ledger-summary-primary .financial-value").waitFor();
          }
          if (path === "/api-keys") await page.locator(".api-scope-row").first().waitFor();
          if (path === "/shared") {
            await page.locator('.page-h button[aria-controls="expense-form"]').click();
            await page.locator('#expense-form input[type="date"]').first().waitFor();
          }
          await measure(page, report, `${path.slice(1)}-layout`);
          if (path === "/shared") {
            await capture(page, report, "shared-form");
            await page.locator('.view-tabs [id$="-tab-reports"]').click();
            await page
              .locator('[role="tabpanel"][id$="-panel-reports"][aria-busy="false"]')
              .waitFor();
            await page.locator(".expense-chart-readout").nth(1).waitFor();
            await measure(page, report, "shared-reports-layout");
            await capture(page, report, "shared-reports");
          }
          await checkLastControl(page, report, `${path.slice(1)}-footer-hit`);
        }
        await checkModal(page, fixture, report);
        await measure(page, report, "modal-closed-layout");
        report.requests = fixture.assertClean();
        assert.deepEqual(errors, [], `${engine}/${profile.name}: browser errors`);
        results.push(report);
        process.stderr.write(`${engine}/${profile.name}: ${report.states.length} states passed\n`);
      } catch (error) {
        process.stderr.write(
          JSON.stringify({
            engine,
            profile,
            ...fixture.snapshot(),
            states: report.states,
            error: error.message,
          }) + "\n"
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
          "Local bounded GET-only fixtures, Chromium/WebKit and simulated viewports. No remote business requests, writes, polling or physical-device acceptance. Reduced viewport checks are not a native virtual keyboard. Linux WebKit maxTouchPoints is recorded without overriding navigator; touchscreen taps run on Chromium.",
        contexts: results.length,
        maxContexts: 20,
        perContextRequestCap: 160,
        perContextAPIReadCap: 80,
        states: results.reduce((sum, result) => sum + result.states.length, 0),
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
      "Mobile layout cleanup failed"
    );
}
