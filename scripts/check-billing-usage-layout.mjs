import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { BILLING_USAGE_COPY } from "../src/locales/billing-usage.js";

// Build dist first. Fixtures never reach a Server, deliver external requests,
// write data, install browsers, or use caches under the user's home directory.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:4249";
const tolerance = 1;
const ownerId = "usr_billing_layout_owner";
const sharedId = "usr_billing_layout_shared";
const requested = process.argv.slice(2);
const saveScreenshots = requested.includes("--screenshots");
const browserArgs = requested.filter((arg) => arg !== "--screenshots");
assert(
  browserArgs.length === 0 ||
    (browserArgs.length === 1 && /^--browser=(chromium|webkit|firefox)$/.test(browserArgs[0])),
  "Usage: node scripts/check-billing-usage-layout.mjs [--browser=chromium|webkit|firefox] [--screenshots]"
);
const engines = browserArgs.length
  ? [browserArgs[0].split("=")[1]]
  : ["chromium", "webkit", "firefox"];
const profiles = [
  { name: "desktop-1906", width: 1906, height: 1000, touch: false },
  { name: "intermediate-1024", width: 1024, height: 1000, touch: false },
  { name: "phone-390", width: 390, height: 844, touch: true },
  { name: "phone-320", width: 320, height: 844, touch: true },
];
const normalUsage = {
  workspaceId: ownerId,
  projects: { used: 3, limit: 100 },
  expenseRecords: { used: 0, limit: 100000 },
  jev: { month: "2026-10", currency: "USD", usedMicrousd: 1234567, limitMicrousd: 5000000 },
};
const stressUsage = {
  workspaceId: ownerId,
  // A deliberately inconsistent legacy field must neither invalidate nor
  // produce a calculated status in this two-value presentation.
  projects: { used: Number.MAX_SAFE_INTEGER, limit: Number.MAX_SAFE_INTEGER - 1, remaining: -1 },
  expenseRecords: { used: Number.MAX_SAFE_INTEGER, limit: Number.MAX_SAFE_INTEGER, remaining: 999 },
  jev: { month: "2026-10", currency: "USD", usedMicrousd: Number.MAX_SAFE_INTEGER, limitMicrousd: 4250001 },
};
const forbiddenCopy = [
  "Remaining",
  "Limit reached",
  "Over limit by",
  "剩余",
  "已达到上限",
  "超出上限",
  "残り",
  "上限に到達",
  "上限超過",
  "남음",
  "한도 도달",
  "한도 초과",
  "Restant",
  "Limite atteinte",
  "Dépassement de la limite",
  "Restante",
  "Límite alcanzado",
  "Exceso sobre el límite",
];

function copy(key, lang) {
  const [english, translations] = BILLING_USAGE_COPY[key];
  return translations[lang] || english;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function createFixture() {
  const requests = [];
  const violations = [];
  let usage = normalUsage;
  const permissions = {
    writeExpenses: true,
    manageProjects: true,
    manageCategories: true,
    manageMembers: true,
    manageAdmins: true,
  };
  const personal = {
    id: ownerId,
    ownerId,
    name: "Personal billing fixture ledger",
    role: "owner",
    revision: 1,
    permissions,
  };
  const shared = {
    ...personal,
    id: sharedId,
    ownerId: sharedId,
    name: "Another owner's shared ledger",
    role: "viewer",
    permissions: Object.fromEntries(Object.keys(permissions).map((key) => [key, false])),
  };
  const payloadFor = (path) => {
    if (path === "/auth/session")
      return { authenticated: true, user: { id: ownerId, name: "Local billing fixture owner" } };
    if (path === "/api/v1/workspace-invitation-requests") return { items: [], hasMore: false };
    if (path === "/api/v1/recurring-expense-notifications") return { items: [], hasMore: false };
    if (path === "/api/v1/workspaces") return { items: [personal, shared] };
    if (path === "/api/v1/projects") return { items: [], nextCursor: null };
    if (path === "/api/v1/me")
      return { id: ownerId, workspace: personal, scopes: [], entitlements: { plan: "max" } };
    if (path === "/billing/plan")
      return {
        enabled: true,
        provider: "creem",
        currency: "USD",
        plans: [
          {
            id: "free",
            name: "Free",
            entitlements: null,
            prices: {
              month: { amount: "0", currency: "USD", interval: "month", configured: true },
            },
          },
          {
            id: "max",
            name: "Pullwise Max",
            entitlements: null,
            prices: {
              month: { amount: "49", currency: "USD", interval: "month", configured: true },
              year: { amount: "490", currency: "USD", interval: "year", configured: true },
            },
          },
        ],
        account: { status: "trialing", plan: "max", interval: "month" },
        ledgerUsage: usage,
      };
    return undefined;
  };
  return {
    requests,
    stress() {
      usage = stressUsage;
    },
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());
      const record = {
        method: request.method(),
        url: url.href,
        type: request.resourceType(),
        workspace: request.headers()["x-pullwise-workspace"] || null,
        path: url.pathname
          .replace(/^\/api\/api\/v1(?=\/|$)/, "/api/v1")
          .replace(/^\/api\/auth(?=\/|$)/, "/auth")
          .replace(/^\/api\/billing(?=\/|$)/, "/billing"),
      };
      requests.push(record);
      try {
        assert(requests.length <= 64, "Total intercepted request cap exceeded (64)");
        assert.equal(record.method, "GET", "Only GET requests are allowed");
        if (
          url.origin !== baseURL &&
          ((url.hostname === "fonts.googleapis.com" && record.type === "stylesheet") ||
            (url.hostname === "fonts.gstatic.com" && record.type === "font"))
        ) {
          record.blockedFont = true;
          await route.abort("blockedbyclient");
          return;
        }
        assert.equal(url.origin, baseURL, "External requests are forbidden");
        const api =
          record.type !== "document" && /^\/(?:api|auth|billing)(?:\/|$)/.test(record.path);
        record.api = api;
        if (!api) {
          assert(
            record.type === "document" ||
              /^\/(?:assets\/[^/]+\.(?:js|css|woff2?)|brand-mark\.png|favicon\.ico)$/.test(
                url.pathname
              ),
            `Unexpected local static resource: ${url.pathname}`
          );
          await route.continue();
          return;
        }
        assert(requests.filter((item) => item.api).length <= 8, "API GET request cap exceeded (8)");
        const allowedQuery = record.path === "/api/v1/projects" ? ["limit"] : [];
        for (const key of url.searchParams.keys())
          assert(allowedQuery.includes(key), `Unexpected query field: ${record.path}/${key}`);
        if (record.path === "/billing/plan")
          assert.equal(record.workspace, null, "Billing read inherited the selected workspace");
        else if (record.path === "/api/v1/recurring-expense-notifications")
          assert.equal(record.workspace, null, "Account inbox inherited the selected workspace");
        else if (record.workspace)
          assert([ownerId, sharedId].includes(record.workspace), "Unexpected selected workspace");
        const payload = payloadFor(record.path);
        assert.notEqual(payload, undefined, `Missing local GET fixture: ${record.path}`);
        await route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          headers: { "Cache-Control": "no-store" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        violations.push({ ...record, reason: error.message });
        await route.abort("blockedbyclient");
      }
    },
    assertClean(expectedPlanReads) {
      assert.deepEqual(violations, [], `Fixture request violations: ${JSON.stringify(violations)}`);
      assert.equal(
        requests.filter((item) => item.path === "/billing/plan").length,
        expectedPlanReads,
        "Unexpected automatic billing reads"
      );
    },
  };
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolveFrame) =>
      requestAnimationFrame(() => requestAnimationFrame(resolveFrame))
    );
  });
}

function inside(inner, outer) {
  return (
    inner.left >= outer.left - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.bottom <= outer.bottom + tolerance
  );
}

function overlaps(left, right) {
  return (
    left.left < right.right - tolerance &&
    right.left < left.right - tolerance &&
    left.top < right.bottom - tolerance &&
    right.top < left.bottom - tolerance
  );
}

async function measure(page, profile, lang, theme, usage, name, kind = "ledger") {
  await settle(page);
  const measured = await page.evaluate((kind) => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect
        ? element.getBoundingClientRect()
        : element;
      return { left, right, top, bottom, width, height };
    };
    const textBounds = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return Array.from(range.getClientRects())
        .filter((box) => box.width > 0)
        .map(rect);
    };
    const region = document.querySelector(kind === "jev"
      ? '[aria-labelledby="billing-jev-usage-title"]'
      : '[aria-labelledby="billing-usage-title"]');
    const refresh = region.querySelector(".billing-usage-heading button");
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      coarse: matchMedia("(pointer: coarse)").matches,
      touchPoints: navigator.maxTouchPoints,
      theme: document.documentElement.dataset.theme,
      lang: document.documentElement.lang,
      body: rect(document.querySelector(".set-body")),
      region: rect(region),
      text: region.textContent,
      meters: region.querySelectorAll(
        '[role="meter"], [role="progressbar"], meter, progress, .billing-usage-track'
      ).length,
      headingIcons: region.querySelectorAll(".billing-usage-heading > svg").length,
      refresh: refresh ? rect(refresh) : null,
      rows: Array.from(region.querySelectorAll(".billing-usage-row")).map((row) => ({
        rect: rect(row),
        tag: row.tagName,
        namedBy: row.getAttribute("aria-labelledby"),
        titleId: row.querySelector("h3")?.id,
        title: row.querySelector("h3")?.textContent,
        scrollWidth: row.scrollWidth,
        clientWidth: row.clientWidth,
        statuses: row.querySelectorAll(".tag, [data-over-limit]").length,
        groups: Array.from(row.querySelectorAll("dl > div")).map((group) => {
          const label = group.querySelector("dt");
          const dd = group.querySelector("dd");
          const value = dd.querySelector(".financial-value") || dd;
          const style = getComputedStyle(value);
          const clipping = [];
          for (let ancestor = dd; ancestor; ancestor = ancestor.parentElement) {
            const ancestorStyle = getComputedStyle(ancestor);
            const horizontal = ["hidden", "clip", "scroll", "auto"].includes(
              ancestorStyle.overflowX
            );
            const vertical = ["hidden", "clip", "scroll", "auto"].includes(ancestorStyle.overflowY);
            if (horizontal || vertical)
              clipping.push({ rect: rect(ancestor), horizontal, vertical });
            if (ancestor === row) break;
          }
          return {
            className: group.className,
            rect: rect(group),
            label: label.textContent,
            labelRect: rect(label),
            labelFragments: textBounds(label),
            value: dd.textContent,
            valueRect: rect(dd),
            fragments: textBounds(dd),
            scrollWidth: dd.scrollWidth,
            clientWidth: dd.clientWidth,
            scrollHeight: dd.scrollHeight,
            clientHeight: dd.clientHeight,
            fontSize: Number.parseFloat(style.fontSize),
            textOverflow: style.textOverflow,
            userSelect: style.userSelect,
            clipping,
          };
        }),
      })),
    };
  }, kind);
  const context = `${kind}/${name}/${lang}/${theme}`;
  const details = `${context}: ${JSON.stringify(measured)}`;
  assert.equal(measured.theme, theme, details);
  assert.equal(measured.lang.split("-")[0], lang, details);
  assert.equal(measured.coarse, profile.touch, details);
  if (profile.touch) assert(measured.touchPoints > 0, `No touch emulation: ${details}`);
  assert(measured.documentWidth <= measured.viewport + tolerance, `Document overflow: ${details}`);
  assert.equal(measured.meters, 0, `Retired usage meter is visible: ${details}`);
  assert.equal(measured.headingIcons, 0, `Decorative usage heading icon remains: ${details}`);
  const keys = kind === "jev" ? ["jevAllowance"] : ["projects", "expenseRecords"];
  assert.equal(measured.rows.length, keys.length, `Missing usage articles: ${details}`);
  for (const phrase of forbiddenCopy)
    assert(
      !measured.text.includes(phrase),
      `Calculated capacity copy remains (${phrase}): ${details}`
    );
  for (const [index, key] of keys.entries()) {
    const row = measured.rows[index];
    assert.equal(row.tag, "ARTICLE", details);
    assert(
      row.titleId && row.namedBy === row.titleId,
      `Article lacks accessible heading: ${details}`
    );
    assert.equal(row.title, copy(key, lang), details);
    assert.equal(row.statuses, 0, `Calculated status remains: ${details}`);
    assert.equal(row.groups.length, 2, `Usage definition list has extra fields: ${details}`);
    assert(inside(row.rect, measured.region), `Article escapes usage section: ${details}`);
    assert(row.scrollWidth <= row.clientWidth + tolerance, `Article overflow: ${details}`);
    const used = row.groups[0];
    const total = row.groups[1];
    assert.equal(used.className, "billing-usage-used", details);
    assert.equal(total.className, "billing-usage-total", details);
    assert.equal(used.label, copy("used", lang), details);
    assert.equal(total.label, copy("total", lang), details);
    const exactUsd = (micros) => {
      const integer = BigInt(micros);
      const whole = new Intl.NumberFormat(lang).format(integer / 1000000n);
      const fraction = String(integer % 1000000n).padStart(6, "0").replace(/0{1,4}$/, "");
      const separator = new Intl.NumberFormat(lang).formatToParts(0.1)
        .find((part) => part.type === "decimal").value;
      return `USD ${whole}${separator}${fraction}`;
    };
    assert.equal(
      used.value,
      kind === "jev" ? exactUsd(usage.jev.usedMicrousd) : new Intl.NumberFormat(lang).format(usage[key].used),
      `Inexact used value: ${details}`
    );
    assert.equal(
      total.value,
      kind === "jev" ? exactUsd(usage.jev.limitMicrousd) : new Intl.NumberFormat(lang).format(usage[key].limit),
      `Inexact total value: ${details}`
    );
    assert(used.fontSize > total.fontSize, `Used value lacks primary emphasis: ${details}`);
    assert(!overlaps(used.rect, total.rect), `Used/total fields overlap: ${details}`);
    for (const group of row.groups) {
      assert(inside(group.rect, row.rect), `Value group escapes its article: ${details}`);
      assert(inside(group.labelRect, group.rect), `Label escapes its value group: ${details}`);
      assert(inside(group.valueRect, group.rect), `Number escapes its value group: ${details}`);
      assert(
        group.scrollWidth <= group.clientWidth + tolerance,
        `Number overflows horizontally: ${details}`
      );
      assert.notEqual(group.textOverflow, "ellipsis", `Number uses ellipsis: ${details}`);
      assert.notEqual(group.userSelect, "none", `Number cannot be selected: ${details}`);
      for (const fragment of group.fragments) {
        // Font ascenders/descenders can extend beyond the CSS line box while
        // overflow remains visible. Test actual clipping and inline boundaries.
        assert(
          fragment.left >= group.valueRect.left - tolerance &&
            fragment.right <= group.valueRect.right + tolerance,
          `Number escapes its inline bounds: ${details}`
        );
        for (const clip of group.clipping) {
          if (clip.horizontal)
            assert(
              fragment.left >= clip.rect.left - tolerance &&
                fragment.right <= clip.rect.right + tolerance,
              `Number clips horizontally: ${details}`
            );
          if (clip.vertical)
            assert(
              fragment.top >= clip.rect.top - tolerance &&
                fragment.bottom <= clip.rect.bottom + tolerance,
              `Number clips vertically: ${details}`
            );
        }
      }
      for (const fragment of group.labelFragments)
        assert(
          inside(fragment, group.labelRect),
          `Localized label fragment is clipped: ${details}`
        );
    }
  }
  if (kind === "jev") {
    assert(measured.text.includes(`${copy("jevMonth", lang)}: ${usage.jev.month}`), details);
    assert(measured.text.includes(copy("jevPolicy", lang)), details);
  } else assert(
      !overlaps(measured.rows[0].rect, measured.rows[1].rect),
      `Usage articles overlap: ${details}`
    );
  if (profile.touch && measured.refresh)
    assert(measured.refresh.height >= 44 - tolerance, `Small refresh touch target: ${details}`);
  if (profile.width === 1024 && kind !== "jev") {
    assert(measured.body.width < 568, `Intermediate set-body is not narrow enough: ${details}`);
    assert(
      measured.rows[1].rect.top >= measured.rows[0].rect.bottom,
      `Narrow container did not stack rows: ${details}`
    );
  }
  return { name, kind, bodyWidth: measured.body.width, rows: measured.rows.map((row) => row.rect.width) };
}

await access(join(root, "dist", "index.html"));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, "node_modules", ".cache", "ms-playwright");
const runtimeHome = await mkdtemp(join(tmpdir(), "pullwise-billing-layout-"));
const screenshotDir = join(root, "..", "work", "billing-usage-layout");
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
    preview: { host: "127.0.0.1", port: 4249, strictPort: true, proxy: {} },
  });
  const playwright = await import("playwright");
  for (const engine of engines) {
    const browserType = playwright[engine];
    let executablePath = process.env[`${engine.toUpperCase()}_EXECUTABLE_PATH`];
    if (
      !executablePath &&
      !(await exists(browserType.executablePath())) &&
      engine === "chromium" &&
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
      const languages = profile.width === 320 ? ["en", "zh", "ja", "ko", "fr", "es"] : ["en", "zh"];
      for (const lang of languages)
        for (const theme of ["light", "dark"]) {
          const fixture = createFixture();
          const report = {
            engine,
            version: activeBrowser.version(),
            profile: profile.name,
            lang,
            theme,
            states: [],
          };
          const context = await activeBrowser.newContext({
            viewport: { width: profile.width, height: profile.height },
            locale: lang,
            hasTouch: profile.touch,
            ...(engine !== "firefox" ? { isMobile: profile.touch } : {}),
            serviceWorkers: "block",
          });
          const errors = [];
          try {
            await context.route("**/*", (route) => fixture.handle(route));
            context.on("response", (response) => {
              if (new URL(response.url()).origin !== baseURL)
                errors.push(`External response: ${response.url()}`);
            });
            await context.addInitScript(
              ({ lang, theme }) => {
                localStorage.setItem("pw-lang", lang);
                localStorage.setItem("pw-theme", theme);
              },
              { lang, theme }
            );
            const page = await context.newPage();
            page.setDefaultTimeout(10000);
            page.on("pageerror", (error) => errors.push(error.message));
            const selectedShared = profile.width === 1906 && lang === "en" && theme === "light";
            if (selectedShared) {
              await page.goto(`${baseURL}/projects`);
              await page.locator("#workspace-select").waitFor();
              await page.locator(".topbar-loading").waitFor({ state: "detached" });
              await page.locator("#workspace-select").selectOption(sharedId);
              await page.locator(".topbar-loading").waitFor({ state: "detached" });
              assert.equal(await page.locator("#workspace-select").inputValue(), sharedId);
              await page.locator('.side-i[href="/billing"]').click();
            } else await page.goto(`${baseURL}/billing`);
            await page.waitForURL(`${baseURL}/billing`);
            await page.getByRole("region", { name: copy("title", lang), exact: true }).waitFor();
            await Promise.all([
              page.locator(".billing-skeleton").waitFor({ state: "detached" }),
              page.locator(".topbar-loading").waitFor({ state: "detached" }),
            ]);
            report.states.push(
              await measure(page, profile, lang, theme, normalUsage, "used-and-total"),
              await measure(page, profile, lang, theme, normalUsage, "used-and-total", "jev")
            );
            if (
              saveScreenshots &&
              lang === "zh" &&
              theme === "dark" &&
              [1906, 390].includes(profile.width)
            ) {
              const path = join(screenshotDir, `${engine}-zh-dark-${profile.width}.png`);
              if (profile.width === 1906)
                await page
                  .getByRole("region", { name: copy("title", lang), exact: true })
                  .screenshot({ path });
              else await page.screenshot({ path, fullPage: true });
              report.screenshot = path;
              const jevPath = join(screenshotDir, `${engine}-zh-dark-${profile.width}-jev.png`);
              await page.getByRole("region", { name: copy("jevTitle", lang), exact: true })
                .screenshot({ path: jevPath });
              report.jevScreenshot = jevPath;
            }
            if (profile.width === 320) {
              fixture.stress();
              await page.getByRole("button", { name: copy("refresh", lang), exact: true }).click();
              await Promise.all([
                page.locator(".billing-skeleton").waitFor({ state: "detached" }),
                page.locator(".topbar-loading").waitFor({ state: "detached" }),
              ]);
              report.states.push(
                await measure(page, profile, lang, theme, stressUsage, "max-safe-integers"),
                await measure(page, profile, lang, theme, stressUsage, "max-safe-integers", "jev")
              );
            }
            fixture.assertClean(profile.width === 320 ? 2 : 1);
            assert.deepEqual(
              errors,
              [],
              `${engine}/${profile.name}/${lang}/${theme}: browser errors`
            );
            report.apiReads = fixture.requests.filter((item) => item.api).length;
            report.totalRequests = fixture.requests.length;
            report.selectedShared = selectedShared;
            reports.push(report);
            process.stdout.write(
              `${engine}/${profile.name}/${lang}/${theme}: ${report.states.length} states passed\n`
            );
          } catch (error) {
            process.stderr.write(
              JSON.stringify({ ...report, requests: fixture.requests, error: error.message }) + "\n"
            );
            throw error;
          } finally {
            await context.close();
          }
        }
    }
    await activeBrowser.close();
    activeBrowser = null;
  }
  process.stdout.write(
    JSON.stringify(
      {
        scope:
          "Local GET-only fixtures; simulated browser engines/viewports, not physical iOS/Android devices. No writes, remote delivery or polling. Screenshots only with --screenshots.",
        contexts: reports.length,
        states: reports.reduce((total, report) => total + report.states.length, 0),
        results: reports,
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
  const failures = cleanup.filter((result) => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Billing layout cleanup failed"
    );
}
