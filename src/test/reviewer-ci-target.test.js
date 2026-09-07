import { expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/check-reviewer-authority.mjs");
const text = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
const end = "<!-- PULLWISE_REVIEWER_TARGET_END -->";
const target = text.slice(0, text.indexOf(end) + end.length) + "\n";
function invoke(file) {
  const result = spawnSync(process.execPath, [file], { encoding: "utf8", timeout: 10000 });
  return { status: result.status, report: JSON.parse(result.stdout) };
}

test("current repository passes CI without a retired authority prefix", () => {
  const result = invoke(script);
  expect(result.status, JSON.stringify(result.report)).toBe(0);
});

test.each([
  ["local target", target, 0],
  ["CRLF target", target.replace(/\r?\n/g, "\r\n"), 0],
  ["wrong runtime", target.replace("@earendil-works/pi-coding-agent", "retired-sdk"), 1],
  ["duplicate target", target + target, 1],
  ["authority prefix", "# External authority\n" + target, 1],
  ["invalid UTF-8", Buffer.from([255]), 2],
])("CI validates %s", (_name, content, expected) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "pullwise-ci-target-"));
  try {
    const directory = path.join(temporary, "scripts");
    fs.mkdirSync(directory);
    const copy = path.join(directory, path.basename(script));
    fs.copyFileSync(script, copy);
    fs.writeFileSync(path.join(temporary, "AGENTS.md"), content);
    const result = invoke(copy);
    expect(result.status, JSON.stringify(result.report)).toBe(expected);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
