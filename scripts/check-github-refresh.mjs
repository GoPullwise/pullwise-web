import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { preview } from "vite";
import {
  createDateLayoutFixture,
  EXPENSE_PURPOSE,
  PROJECT_ID,
  WORKSPACE_ID,
} from "./date-layout-fixtures.mjs";

// Build dist first. All API responses, including the only permitted POST per
// case, are intercepted fixtures. No Server, provider, remote API or business
// write is contacted. Browsers are installed separately and never downloaded.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:4248";
const cap = 64;
const cases = ["success", "temporary", "revoked"];
const workRoot = resolve(
  process.env.GITHUB_REFRESH_WORK_DIR || join(root, "..", "work", "github-refresh-browser")
);
const repositoryId = 990001;
const organizationId = 990002;
const repositoryName = "fixture-team/renewal-proof";
const repositoryHref = `https://github.com/${repositoryName}`;
const organizationHref = "https://github.com/fixture-team";
const evidencePath = join(workRoot, "evidence.json");

function normalizedPath(path) {
  return path
    .replace(/^\/api\/api\/v1(?=\/|$)/, "/api/v1")
    .replace(/^\/api\/auth(?=\/|$)/, "/auth")
    .replace(/^\/api\/integrations(?=\/|$)/, "/integrations");
}

function linkedProject(base, expired) {
  const githubAccess = expired ? "reauthorization_required" : "authorized";
  return {
    ...base,
    githubRepoId: repositoryId,
    githubRepoIds: [repositoryId],
    githubFullName: expired ? null : repositoryName,
    repositories: [
      {
        githubRepoId: repositoryId,
        githubFullName: expired ? null : repositoryName,
        githubAccess,
      },
    ],
    githubOrganizationId: organizationId,
    githubOrganization: {
      id: organizationId,
      login: expired ? null : "fixture-team",
      githubAccess,
    },
    githubAccess,
    githubRefreshRequired: expired,
    canCreateExpense: !expired,
  };
}

function createRenewalFixture(kind) {
  const fixture = createDateLayoutFixture({ baseURL, cap });
  const requests = [];
  const violations = [];
  const reads = new Map();
  let refreshPosts = 0;
  let renewed = false;
  const projectPath = `/api/v1/projects/${PROJECT_ID}`;
  return {
    recordResponse: fixture.recordResponse,
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());
      const path = normalizedPath(url.pathname);
      const record = {
        method: request.method(),
        url: url.href,
        path,
        workspace: request.headers()["x-pullwise-workspace"] || null,
        resourceType: request.resourceType(),
      };
      requests.push(record);
      try {
        assert(requests.length <= cap, `${kind}: intercepted request cap exceeded (${cap})`);
        if (record.method !== "GET") {
          assert.equal(url.origin, baseURL, "POST must stay on the loopback fixture origin");
          assert.equal(record.method, "POST", "No other mutation method is permitted");
          assert.equal(path, "/integrations/github/refresh", "Business writes are forbidden");
          assert.equal(url.search, "", "Unexpected refresh query");
          assert.equal(record.workspace, null, "Token refresh must use the actual actor account");
          assert.equal(
            request.postData(),
            "{}",
            "Refresh body must not carry credentials or targets"
          );
          refreshPosts += 1;
          assert.equal(refreshPosts, 1, "Only one simulated refresh POST is permitted per case");
          const status = kind === "success" ? 200 : kind === "temporary" ? 503 : 403;
          const body =
            kind === "success"
              ? { ok: true, refreshed: true }
              : {
                  error: {
                    code:
                      kind === "temporary"
                        ? "GITHUB_UNAVAILABLE"
                        : "GITHUB_REAUTHORIZATION_REQUIRED",
                  },
                };
          renewed = kind === "success";
          record.fixtureStatus = status;
          await route.fulfill({
            status,
            contentType: "application/json; charset=utf-8",
            headers: { "Cache-Control": "no-store" },
            body: JSON.stringify(body),
          });
          return;
        }
        assert(!path.startsWith("/auth/github"), "OAuth must never start automatically");
        const projectRead = path === "/api/v1/projects" || path === projectPath;
        if (projectRead) {
          const count = (reads.get(path) || 0) + 1;
          reads.set(path, count);
          assert(
            count <= (kind === "success" ? 2 : 1),
            `${kind}: repeated project GET exceeded bound`
          );
          if (count > 1) assert.equal(renewed, true, "Repeated GET requires a completed refresh");
          // Both first GETs model requests already started with the expired
          // token, including a late response after the shared POST completes.
          const expired = count === 1;
          const shim = {
            request: () => request,
            continue: (...args) => route.continue(...args),
            abort: (...args) => route.abort(...args),
            fulfill: async (options) => {
              const original = JSON.parse(options.body);
              const body =
                path === projectPath
                  ? linkedProject(original, expired)
                  : {
                      ...original,
                      items: original.items.map((item) => linkedProject(item, expired)),
                      githubRefreshRequired: expired,
                    };
              record.fixtureAccess = expired ? "reauthorization_required" : "authorized";
              await route.fulfill({ ...options, body: JSON.stringify(body) });
            },
          };
          await fixture.handle(shim);
        } else {
          await fixture.handle(route);
        }
      } catch (error) {
        violations.push({ ...record, reason: error.message });
        await route.abort("blockedbyclient").catch(() => {});
      }
    },
    assertClean() {
      const guarded = fixture.assertClean();
      assert.deepEqual(violations, [], `${kind}: unexpected request`);
      assert.equal(refreshPosts, 1, `${kind}: one shared refresh POST required`);
      for (const path of ["/api/v1/projects", projectPath])
        assert.equal(
          reads.get(path),
          kind === "success" ? 2 : 1,
          `${kind}: finite GET count ${path}`
        );
      assert.equal(requests.filter((request) => request.method !== "GET").length, 1);
      return {
        counts: {
          total: requests.length,
          refreshPosts,
          businessWrites: 0,
          projectReads: reads.get(projectPath),
          projectListReads: reads.get("/api/v1/projects"),
          externalDelivered: guarded.counts.externalDelivered,
          blockedFonts: guarded.counts.blockedFonts,
          violations: violations.length + guarded.counts.violations,
        },
        requests,
      };
    },
  };
}

await access(join(root, "dist", "index.html"));
await mkdir(workRoot, { recursive: true });
const runtimeRoot = await mkdtemp(join(workRoot, "runtime-"));
const indexHtml = await readFile(join(root, "dist", "index.html"), "utf8");
const evidence = {
  kind: "bounded-local-browser-fixtures",
  timestamp: new Date().toISOString(),
  baseURL,
  requestCapPerCase: cap,
  totalRequestCap: cap * cases.length,
  productionOrProviderAcceptance: false,
  builtEntryAssets: [...indexHtml.matchAll(/src="([^"]+\.js)"/g)].map((match) => match[1]),
  cases: [],
};
let server;
let browser;
try {
  server = await preview({
    configFile: false,
    root,
    appType: "spa",
    logLevel: "warn",
    server: { proxy: {} },
    preview: { host: "127.0.0.1", port: 4248, strictPort: true, proxy: {} },
  });
  const playwright = await import(
    process.env.PLAYWRIGHT_MODULE_PATH
      ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href
      : "playwright"
  );
  browser = await playwright.chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
    ],
    env: {
      ...process.env,
      XDG_CACHE_HOME: join(runtimeRoot, "cache"),
      XDG_CONFIG_HOME: join(runtimeRoot, "config"),
      XDG_DATA_HOME: join(runtimeRoot, "data"),
    },
  });
  evidence.engine = "chromium";
  evidence.browserVersion = browser.version();
  for (const kind of cases) {
    const fixture = createRenewalFixture(kind);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: "en-US",
      serviceWorkers: "block",
    });
    const pageErrors = [];
    try {
      await context.route("**/*", (route) => fixture.handle(route));
      context.on("response", fixture.recordResponse);
      await context.addInitScript(() => {
        localStorage.setItem("pw-lang", "en");
        localStorage.setItem("pw-theme", "dark");
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(`${baseURL}/projects/${PROJECT_ID}`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: `Edit ${EXPENSE_PURPOSE}`, exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: `Edit ${EXPENSE_PURPOSE}`, exact: true })
          .isEnabled(),
        true
      );
      assert.equal(
        await page.getByRole("heading", { name: EXPENSE_PURPOSE, exact: true }).isVisible(),
        true
      );
      const reconnect = page.getByRole("button", { name: "Reconnect GitHub", exact: true });
      if (kind === "success") {
        await page.locator(`a[href="${repositoryHref}"]`).waitFor();
        assert.equal(await page.locator(`a[href="${organizationHref}"]`).isVisible(), true);
        assert.equal(await reconnect.count(), 0);
        assert.equal(
          await page.getByRole("button", { name: "Add expense", exact: true }).isEnabled(),
          true
        );
      } else {
        assert.equal(await page.locator(`a[href="${repositoryHref}"]`).count(), 0);
        assert.equal(await page.locator(`a[href="${organizationHref}"]`).count(), 0);
        assert.equal(
          await page.getByRole("button", { name: "Add expense", exact: true }).count(),
          0
        );
        assert.equal(
          await page.getByText(`Repository #${repositoryId}`, { exact: true }).first().isVisible(),
          true
        );
        if (kind === "temporary") {
          assert.equal(await reconnect.count(), 0);
          assert.match(
            await page.getByRole("alert").innerText(),
            /GitHub is temporarily unavailable/
          );
        } else {
          assert.equal(await reconnect.isVisible(), true);
          assert.match(await page.getByRole("alert").innerText(), /expired or been revoked/);
        }
      }
      assert.deepEqual(pageErrors, [], `${kind}: unhandled browser error`);
      const report = fixture.assertClean();
      const screenshot = join(workRoot, `${kind}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      // Capturing must not send another API or mutation request.
      assert.deepEqual(fixture.assertClean().counts, report.counts);
      evidence.cases.push({
        kind,
        passed: true,
        financialHistoryVisible: true,
        historicalEditEnabled: true,
        repositoryRestored: kind === "success",
        organizationRestored: kind === "success",
        manualReconnectVisible: kind === "revoked",
        automaticOAuthRequests: 0,
        screenshot,
        ...report,
      });
    } finally {
      await context.close();
    }
  }
  assert(evidence.cases.reduce((sum, item) => sum + item.counts.total, 0) <= cap * cases.length);
  evidence.passed = true;
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({ evidencePath, passed: true, cases: evidence.cases.map(({ kind, counts }) => ({ kind, counts })) }, null, 2)}\n`
  );
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server?.httpServer.close(resolveClose) || resolveClose());
  await rm(runtimeRoot, { recursive: true, force: true });
}
