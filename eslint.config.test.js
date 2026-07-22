import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const WEB_ROOT = process.cwd();
const pin = JSON.parse(readFileSync(join(WEB_ROOT, "contract-package-pin.json"), "utf8"));
const generatedWrapperPath = join(WEB_ROOT, ...pin.generated_artifact.path.split("/"), "index.js");

describe("eslint generated-artifact boundary", () => {
  it("does not lint the immutable Server-generated contract wrapper", async () => {
    const eslint = new ESLint({ cwd: WEB_ROOT });

    await expect(eslint.isPathIgnored(generatedWrapperPath)).resolves.toBe(true);
  });

  it("continues linting Web-owned source", async () => {
    const eslint = new ESLint({ cwd: WEB_ROOT });

    await expect(eslint.isPathIgnored(join(WEB_ROOT, "src", "main.jsx"))).resolves.toBe(false);
  });
});
