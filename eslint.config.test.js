import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const WEB_ROOT = process.cwd();

describe("eslint Web source boundary", () => {
  it("continues linting Web-owned source", async () => {
    const eslint = new ESLint({ cwd: WEB_ROOT });

    await expect(eslint.isPathIgnored(join(WEB_ROOT, "src", "main.jsx"))).resolves.toBe(false);
  }, 15000);
});
