#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

const REPOSITORY = "web";
// The checked-in Node/Pi target is the CI authority.
const TARGET_START_MARKER = "<!-- PULLWISE_REVIEWER_TARGET_START -->";
const TARGET_END_MARKER = "<!-- PULLWISE_REVIEWER_TARGET_END -->";
const TARGET_BLOCK_SHA256 = "4d6c70c6e661eadb241140bb56f111866088c3a87c55ec244c8e957bc08bcc13";

function occurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(needle, offset)) >= 0) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function report(status, errors, sha256 = null) {
  return {
    schema_id: "pullwise-current-reviewer-ci-authority-report/v1",
    repository: REPOSITORY,
    status,
    path: "AGENTS.md",
    errors,
    sha256,
  };
}

function validate() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const agentsPath = path.join(root, "AGENTS.md");
  let metadata;
  try {
    metadata = fs.lstatSync(agentsPath);
  } catch {
    return report("INDETERMINATE", ["agents_file_unreadable"]);
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    return report("INDETERMINATE", ["agents_file_not_regular"]);
  }

  let raw;
  let text;
  try {
    raw = fs.readFileSync(agentsPath);
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    return report("INDETERMINATE", ["agents_file_not_utf8"]);
  }

  const normalized = text.replace(/\r\n?/g, "\n");
  const errors = [];
  if (!normalized.startsWith(TARGET_START_MARKER + "\n")) errors.push("target_block_not_first");
  if (occurrences(normalized, TARGET_START_MARKER) !== 1 || occurrences(normalized, TARGET_END_MARKER) !== 1) {
    errors.push("target_block_count_mismatch");
  } else {
    const start = normalized.indexOf(TARGET_START_MARKER);
    const stop = normalized.indexOf(TARGET_END_MARKER) + TARGET_END_MARKER.length;
    if (normalized[stop] !== "\n") errors.push("target_block_missing_trailing_lf");
    const actual = crypto.createHash("sha256").update(normalized.slice(start, stop + 1), "utf8").digest("hex");
    if (actual !== TARGET_BLOCK_SHA256) errors.push("target_block_mismatch");
  }
  return report(
    errors.length ? "FAIL" : "PASS",
    [...new Set(errors)].sort(),
    crypto.createHash("sha256").update(raw).digest("hex"),
  );
}

const result = validate();
process.stdout.write(JSON.stringify(result) + "\n");
process.exitCode = result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2;
