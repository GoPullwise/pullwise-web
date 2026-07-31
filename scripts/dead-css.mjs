// One-shot dead-CSS detector. Analysis only, not part of the build.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const CSS_FILES = ["styles/base.css", "styles/screens.css", "styles/app.css"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", "styles", "coverage"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const SRC_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".html", ".md"]);
const sources = walk(ROOT).filter((p) => SRC_EXT.has(extname(p)));

// Every token appearing in any string literal counts as "possibly applied".
// This deliberately over-collects: a false "used" keeps a live rule, while a
// false "dead" would delete one. Bias toward keeping.
const applied = new Set();
const prefixes = new Set();
const STRING_RE = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/gs;

for (const file of sources) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(STRING_RE)) {
    const raw = m[0];
    const body = raw.slice(1, -1);
    if (raw.startsWith("`")) {
      // Static text immediately before each ${...} hole is a dynamic prefix.
      const parts = body.split("${");
      for (let i = 0; i < parts.length - 1; i++) {
        const tail = parts[i].split(/[^\w-]+/).pop();
        if (tail) prefixes.add(tail);
      }
    }
    for (const tok of body.split(/[^\w-]+/)) {
      if (!tok) continue;
      applied.add(tok);
      if (tok.endsWith("-")) prefixes.add(tok); // "sev-" + level
    }
  }
}
