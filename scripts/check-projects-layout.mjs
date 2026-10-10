import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { createMobileLayoutFixture } from "./mobile-layout-fixtures.mjs";
import { WORKSPACE_ID } from "./date-layout-fixtures.mjs";

// Run after a finished build. All business requests are fulfilled locally;
// this finite check never installs browsers or contacts a remote Server.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:4248";
const tolerance = 1;
const requested = process.argv.slice(2);
const saveScreenshots = requested.includes("--screenshots");
const args = requested.filter((argument) => argument !== "--screenshots");
assert(
  args.length === 0 || (args.length === 1 && /^--browser=(chromium|webkit|firefox)$/.test(args[0])),
  "Usage: node scripts/check-projects-layout.mjs [--browser=chromium|webkit|firefox] [--screenshots]"
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

const commonProject = {
  githubRepoId: null,
  githubFullName: null,
  githubRepoIds: [],
  repositories: [],
  githubOrganizationId: null,
  githubOrganization: null,
  githubAccess: "not_linked",
  canCreateExpense: true,
  revision: 1,
  developmentUrl: null,
  productUrl: "https://example.com/local-projects-product",
  status: "active",
};
const firstPage = [
  {
    ...commonProject,
    id: "prj_projects_long",
    name: "InfrastructureHostingDomainsAndAIServiceCostsForSharedTeamOperations"
      .repeat(2)
      .slice(0, 120),
    description:
      "A local project with a complete, naturally wrapping description and independent currency totals. ".repeat(
        4
      ),
    totals: [
      { currency: "USD", amountMinor: "9".repeat(72) },
      { currency: "CNY", amountMinor: "112233" },
      { currency: "JPY", amountMinor: "850000" },
    ],
  },
  {
    ...commonProject,
    id: "prj_projects_short",
    name: "Short project",
    description: "",
    totals: [{ currency: "USD", amountMinor: 1200 }],
  },
  {
    ...commonProject,
    id: "prj_projects_archived",
    name: "Archived hosting",
    description: "Historical expenses remain readable.",
    status: "archived",
    canCreateExpense: false,
    totals: [{ currency: "USD", amountMinor: 10000 }],
  },
];
const nextPage = [
  {
    ...commonProject,
    id: "prj_projects_later",
    name: "Later page project",
    description: "",
    totals: [],
  },
];
const nextCursor = "prj_projects_page2";
const expectedMoney = new Map([
  [
    "prj_projects_long",
    [
      `USD ${"9".repeat(70).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.99`,
      "CNY 1,122.33",
      "JPY 850,000",
    ],
  ],
  ["prj_projects_short", ["USD 12.00"]],
  ["prj_projects_archived", ["USD 100.00"]],
  ["prj_projects_later", []],
]);

function createFixture() {
  const core = createMobileLayoutFixture({ baseURL });
  const requests = [];
  const violations = [];
  let releaseFirst;
  let releaseNext;
  const firstRead = new Promise((done) => {
    releaseFirst = done;
  });
  const nextRead = new Promise((done) => {
    releaseNext = done;
  });
  let reads = 0;
  return {
    releaseFirstRead: () => releaseFirst(),
    releaseNextRead: () => releaseNext(),
    projectReads: () => reads,
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());
      const record = { url: url.href, path: url.pathname, method: request.method() };
      requests.push(record);
      try {
        assert(requests.length <= 100, "Projects request cap exceeded (100)");
        assert.equal(record.method, "GET", "Only GET requests are allowed");
        if (url.origin !== baseURL || url.pathname !== "/api/api/v1/projects") {
          await core.handle(route);
          return;
        }
        record.projects = true;
        reads += 1;
        assert(reads <= 2, "Projects page read cap exceeded (2)");
        assert.equal(request.headers()["x-pullwise-workspace"], WORKSPACE_ID);
        for (const key of url.searchParams.keys()) {
          assert(["limit", "cursor"].includes(key), `Unexpected project query: ${key}`);
          assert.equal(url.searchParams.getAll(key).length, 1, "Duplicate project query");
        }
        const limit = url.searchParams.get("limit");
        if (limit !== null) assert(/^(?:[1-9][0-9]?|100)$/.test(limit), "Invalid page limit");
        const cursor = url.searchParams.get("cursor");
        assert.equal(cursor, reads === 1 ? null : nextCursor, "Unexpected page cursor");
        await (reads === 1 ? firstRead : nextRead);
        await route.fulfill({
          status: 200,
          contentType: "application/json; charset=utf-8",
          headers: { "Cache-Control": "no-store" },
          body: JSON.stringify({
            items: cursor ? nextPage : firstPage,
            nextCursor: cursor ? null : nextCursor,
          }),
        });
      } catch (error) {
        violations.push({ ...record, reason: error.message });
        await route.abort("blockedbyclient");
      }
    },
    recordResponse: core.recordResponse,
    assertClean() {
      assert.deepEqual(violations, [], "Projects fixture request violations");
      assert.equal(reads, 2, "Unexpected automatic or missing Projects reads");
      const inherited = core.assertClean();
      assert(inherited.api + reads <= 14, "Projects API read cap exceeded (14)");
      assert(
        !requests.some((request) =>
          /\/(?:categories|reports|repositories)(?:\/|$)/.test(request.path)
        ),
        "Projects fetched unrelated ledger data"
      );
      return { total: requests.length, projects: reads, inherited };
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
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => {
          const end = animation.effect?.getComputedTiming().endTime;
          return Number.isFinite(end) && end <= 1000;
        })
        .map((animation) => animation.finished.catch(() => {}))
    );
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function measure(page, engine, profile, stage, expectedIds) {
  await settle(page);
  const measured = await page.evaluate(() => {
    const rect = (element) => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const fragments = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()]
        .filter((box) => box.width > 0)
        .map((box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
    };
    const section = document.querySelector(".ledger-your-projects");
    const list = section.querySelector(".ledger-project-list");
    const search = section.querySelector(".ledger-search input");
    const describedBy = search.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) || [];
    const guidance = describedBy.map((id) => document.getElementById(id));
    const form = document.querySelector("#add-repository");
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      coarse: matchMedia("(pointer: coarse)").matches,
      touchPoints: navigator.maxTouchPoints,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      headingFontSize: getComputedStyle(document.querySelector(".page-h h1")).fontSize,
      section: rect(section),
      sectionOverflow: section.scrollWidth > section.clientWidth + 1,
      listRole: list.getAttribute("role"),
      busy: section.querySelector("[aria-busy]")?.getAttribute("aria-busy") === "true",
      live: (() => {
        const status = section.querySelector('.ledger-search-guidance [role="status"]');
        return status
          ? {
              text: status.textContent.trim(),
              live: status.getAttribute("aria-live") || "polite",
              hidden: getComputedStyle(status).display === "none",
            }
          : null;
      })(),
      guidanceValid:
        guidance.length > 0 &&
        guidance.every((element) =>
          Boolean(element && section.contains(element) && element.textContent.trim())
        ),
      rows: [...list.querySelectorAll(".ledger-project-row")].map((row) => ({
        id: row.querySelector(".ledger-project-link")?.getAttribute("href")?.split("/").pop(),
        role: row.getAttribute("role"),
        rect: rect(row),
        columns: getComputedStyle(row).gridTemplateColumns.split(" ").length,
        overflow: row.scrollWidth > row.clientWidth + 1,
        values: [...row.querySelectorAll(".financial-value")].map((value) => ({
          text: value.textContent,
          selectable: getComputedStyle(value).userSelect !== "none",
          fragments: fragments(value),
        })),
        links: [...row.querySelectorAll(".ledger-project-link, .ledger-project-product-link")].map(
          (link) => ({
            rect: rect(link),
            selectable: getComputedStyle(link).userSelect !== "none",
            href: link.getAttribute("href"),
            target: link.getAttribute("target"),
            rel: link.getAttribute("rel"),
            fragments: fragments(link),
            labelLineCount: Math.max(
              0,
              ...[...link.childNodes]
                .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
                .map((node) => fragments(node).length)
            ),
          })
        ),
      })),
      form: form
        ? {
            rect: rect(form),
            overflow: form.scrollWidth > form.clientWidth + 1,
            controls: [
              ...form.querySelectorAll("input:not([type=checkbox]), select, textarea, button"),
            ]
              .filter((control) => control.getClientRects().length)
              .map((control) => ({
                rect: rect(control),
                fontSize: parseFloat(getComputedStyle(control).fontSize),
                textInput: ["INPUT", "SELECT", "TEXTAREA"].includes(control.tagName),
              })),
          }
        : null,
    };
  });
  const details = `${engine}/${profile.name}/${stage}: ${JSON.stringify(measured)}`;
  assert(measured.documentWidth <= measured.viewport + tolerance, `Document overflow: ${details}`);
  assert.equal(measured.coarse, profile.touch, `Pointer mismatch: ${details}`);
  // Linux WebKit and Playwright Firefox can report zero native touch points
  // while exposing coarse-pointer geometry. Record the real value; Chromium
  // alone provides the positive touch-point proof used by the mobile check.
  if (profile.touch && engine === "chromium")
    assert(measured.touchPoints > 0, `Chromium touch emulation unavailable: ${details}`);
  assert.equal(measured.sectionOverflow, false, `Projects section overflow: ${details}`);
  assert.equal(measured.listRole, "list", `Missing list semantics: ${details}`);
  assert(measured.guidanceValid, `Search lacks linked loaded-results guidance: ${details}`);
  assert(
    measured.live?.text && !measured.live.hidden && measured.live.live === "polite",
    `Result changes lack a polite visible status: ${details}`
  );
  assert.deepEqual(
    measured.rows.map((row) => row.id),
    expectedIds,
    `Incorrect local filter results: ${details}`
  );
  assert.equal(measured.busy, stage === "loading-more", `Incorrect updating state: ${details}`);
  for (const row of measured.rows) {
    assert.equal(row.role, "listitem", `Missing row list semantics: ${details}`);
    assert.equal(row.overflow, false, `Project row overflow: ${details}`);
    assert.deepEqual(
      row.values.map((value) => value.text),
      expectedMoney.get(row.id),
      `Money truncated or currencies merged: ${details}`
    );
    if (measured.section.width <= 759)
      assert.equal(row.columns, 1, `Narrow list did not stack: ${details}`);
    for (const value of [...row.values, ...row.links]) {
      assert(value.selectable, `Record data is not selectable: ${details}`);
      for (const fragment of value.fragments)
        assert(
          fragment.left >= row.rect.left - tolerance &&
            fragment.right <= row.rect.right + tolerance,
          `Text escapes project row: ${details}`
        );
    }
    for (const link of row.links) {
      if (profile.touch)
        assert(
          link.rect.height >= 44 - tolerance && link.rect.width >= 44 - tolerance,
          `Project link has a small touch target: ${details}`
        );
      if (link.target === "_blank") {
        assert(
          link.rel.includes("noopener") && link.rel.includes("noreferrer"),
          `Unsafe product shortcut: ${details}`
        );
        assert(link.labelLineCount <= 1, `Short product label wraps within its link: ${details}`);
      }
    }
  }
  const long = measured.rows.find((row) => row.id === "prj_projects_long");
  const short = measured.rows.find((row) => row.id === "prj_projects_short");
  if (long && short)
    assert(
      long.rect.height > short.rect.height + 20,
      `A long project stretches unrelated rows: ${details}`
    );
  if (measured.form) {
    assert.equal(measured.form.overflow, false, `Creation rail overflows: ${details}`);
    for (const control of measured.form.controls) {
      assert(
        control.rect.left >= measured.form.rect.left - tolerance &&
          control.rect.right <= measured.form.rect.right + tolerance,
        `Creation control escapes rail: ${details}`
      );
      if (profile.touch)
        assert(
          control.rect.height >= 44 - tolerance &&
            (!control.textInput || control.fontSize >= 16 - tolerance),
          `Creation control is too small for touch: ${details}`
        );
    }
  }
  return {
    stage,
    documentWidth: measured.documentWidth,
    listWidth: measured.section.width,
    coarse: measured.coarse,
    touchPoints: measured.touchPoints,
    ids: measured.rows.map((row) => row.id),
    rowHeights: measured.rows.map((row) => row.rect.height),
    headingFontSize: measured.headingFontSize,
    status: measured.live.text,
    creationRail: Boolean(measured.form),
  };
}

await access(join(root, "dist", "index.html"));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= join(root, "node_modules", ".cache", "ms-playwright");
const runtimeHome = await mkdtemp(join(tmpdir(), "pullwise-projects-layout-"));
const screenshotDir = join(root, "..", "work", "projects-layout");
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
        page.on("pageerror", (error) =>
          errors.push({
            message: error.message,
            afterStage: report.states.at(-1)?.stage || "startup",
          })
        );
        await page.goto(`${baseURL}/projects`, { waitUntil: "domcontentloaded" });
        const skeleton = page.locator(".ledger-project-skeleton");
        await skeleton.waitFor();
        await settle(page);
        assert.equal(
          await skeleton.locator(".panel").count(),
          1,
          "Projects skeleton has an unsolicited creation rail"
        );
        assert.equal(
          await skeleton.locator(".ledger-split").count(),
          0,
          "Projects skeleton uses two-column layout"
        );
        assert.equal(
          await skeleton.locator(".ledger-project-row").count(),
          3,
          "Projects skeleton lacks aligned record placeholders"
        );
        assert(await skeleton.getAttribute("aria-label"), "Projects loading status lacks a name");
        const skeletonWidth = await skeleton
          .locator(".panel")
          .evaluate((element) => element.getBoundingClientRect().width);
        fixture.releaseFirstRead();
        await page.locator(".ledger-project-link").first().waitFor();
        report.states.push(
          await measure(
            page,
            engine,
            profile,
            "loaded",
            firstPage.map((project) => project.id)
          )
        );
        assert(
          Math.abs(report.states[0].listWidth - skeletonWidth) <= tolerance,
          "Projects skeleton/list width shifts after loading"
        );
        const search = page.locator(".ledger-search input");
        const status = page.locator(".ledger-project-status select");
        await search.fill("Later page project");
        report.states.push(await measure(page, engine, profile, "not-yet-loaded", []));
        assert.equal(fixture.projectReads(), 1, "Typing search triggers a remote read");
        const more = page.locator(".ledger-your-projects > .panel-actions button");
        await more.waitFor();
        const nextResponse = page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/api/v1/projects"
        );
        await more.click();
        await page.locator('.ledger-your-projects [aria-busy="true"]').waitFor();
        report.states.push(await measure(page, engine, profile, "loading-more", []));
        assert.notEqual(
          report.states.at(-1).status,
          report.states.at(-2).status,
          "Loading another page is not announced"
        );
        fixture.releaseNextRead();
        await nextResponse;
        await page.locator('.ledger-project-link[href$="prj_projects_later"]').waitFor();
        report.states.push(
          await measure(page, engine, profile, "loaded-next-page", ["prj_projects_later"])
        );
        await search.fill("");
        await status.selectOption("archived");
        report.states.push(
          await measure(page, engine, profile, "archived", ["prj_projects_archived"])
        );
        await status.selectOption("active");
        report.states.push(
          await measure(page, engine, profile, "active", [
            "prj_projects_long",
            "prj_projects_short",
            "prj_projects_later",
          ])
        );
        await status.selectOption("all");
        assert.equal(fixture.projectReads(), 2, "Status filtering triggers a remote read");
        const allIds = [...firstPage, ...nextPage].map((project) => project.id);
        if (profile.name === "desktop-1440" || profile.name === "phone-320-en") {
          const originalSize = report.states[0].headingFontSize;
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "20px";
          });
          const enlarged = await measure(page, engine, profile, "larger-browser-font", allIds);
          assert(
            parseFloat(enlarged.headingFontSize) >= parseFloat(originalSize) * 1.24,
            "Typography ignores the enlarged root preference"
          );
          report.states.push(enlarged);
          await page.evaluate(() => {
            document.documentElement.style.removeProperty("font-size");
          });
        }
        await page.locator('.page-h button[aria-controls="add-repository"]').click();
        await page.locator("#add-repository").waitFor();
        report.states.push(await measure(page, engine, profile, "creation-rail", allIds));
        if (profile.width >= 900) {
          const divider = page.locator(".ledger-split-resizer");
          await divider.focus();
          for (const key of ["Home", "End"]) {
            await divider.press(key);
            report.states.push(
              await measure(page, engine, profile, `creation-rail-${key.toLowerCase()}`, allIds)
            );
          }
        }
        if (saveScreenshots && [1440, 390].includes(profile.width)) {
          const path = join(screenshotDir, `${engine}-${profile.name}-creation.png`);
          await page.screenshot({ path, fullPage: true });
          report.screenshot = path;
          if (profile.touch && engine === "chromium") {
            const session = await context.newCDPSession(page);
            await session.send("Emulation.setTouchEmulationEnabled", {
              enabled: true,
              maxTouchPoints: 1,
            });
          }
          report.states.push(await measure(page, engine, profile, "after-capture", allIds));
        }
        report.requests = fixture.assertClean();
        assert.deepEqual(errors, [], `${engine}/${profile.name}: browser errors`);
        reports.push(report);
        process.stderr.write(`${engine}/${profile.name}: ${report.states.length} states passed\n`);
      } catch (error) {
        process.stderr.write(JSON.stringify({ ...report, error: error.message }) + "\n");
        throw error;
      } finally {
        fixture.releaseFirstRead();
        fixture.releaseNextRead();
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
          "Bounded loopback GET-only synthetic Projects fixtures. Coarse-pointer geometry and native touch-point counts are recorded for simulated viewports/hasTouch contexts; only Chromium requires positive touch points. No remote API, business writes, polling or physical-device acceptance.",
        maxContexts: 27,
        perContextRequestCap: 100,
        perContextAPIReadCap: 14,
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
      "Projects cleanup failed"
    );
}
