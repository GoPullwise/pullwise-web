// Applies the deletions listed in dead-css.json. Run dead-css.mjs first.
// Usage: node scripts/dead-css-apply.mjs [--write] [--partial] [file...]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const PARTIAL = argv.includes("--partial");
const only = argv.filter((a) => !a.startsWith("--"));
const report = JSON.parse(readFileSync(join(ROOT, "dead-css.json"), "utf8"));

function balanced(text) {
  let d = 0;
  for (const ch of text) {
    if (ch === "{") d++;
    else if (ch === "}") { d--; if (d < 0) return false; }
  }
  return d === 0;
}

for (const [rel, data] of Object.entries(report)) {
  if (only.length && !only.includes(rel)) continue;
  const edits = PARTIAL
    ? data.partial.map((p) => ({ ...p, kind: "partial", start: p.selStart, end: p.selEnd }))
    : data.dead.map((d) => ({ ...d, kind: "dead" }));
  if (!edits.length) continue;

  const path = join(ROOT, rel);
  const original = readFileSync(path, "utf8");
  let text = original;
  let applied = 0;

  // Descending by offset so earlier edits never shift later ones.
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    const slice = text.slice(e.start, e.end);
    if (e.kind === "dead") {
      if (!slice.trimEnd().endsWith("}")) {
        console.error(`${rel}:${e.line} SKIP (not a complete rule): ${e.selector}`);
        continue;
      }
      // Also swallow trailing blank space up to and including one newline so
      // deletions don't leave a growing gap.
      let end = e.end;
      while (end < text.length && (text[end] === " " || text[end] === "\t")) end++;
      if (text[end] === "\r") end++;
      if (text[end] === "\n") end++;
      text = text.slice(0, e.start) + text.slice(end);
    } else {
      const rebuilt = e.keep.join(",\n");
      if (!slice.includes(e.keep[0].split(/\s+/)[0])) {
        console.error(`${rel}:${e.line} SKIP (selector drifted)`);
        continue;
      }
      text = text.slice(0, e.start) + rebuilt + " " + text.slice(e.end);
    }
    applied++;
  }

  if (!balanced(text)) {
    console.error(`${rel}: ABORT — unbalanced braces after edit, file left untouched`);
    continue;
  }

  const bytes = original.length - text.length;
  console.log(
    `${rel}: ${applied}/${edits.length} ${PARTIAL ? "partial" : "dead"} edits, ` +
      `-${bytes} bytes${WRITE ? "" : " (dry run)"}`,
  );
  if (WRITE) writeFileSync(path, text);
}
