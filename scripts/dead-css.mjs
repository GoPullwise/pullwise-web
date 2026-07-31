// One-shot dead-CSS detector. Analysis only, not part of the build.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const CSS_FILES = [
  "styles/base.css",
  "styles/screens.css",
  "src/app.css",
  "src/landing-seo.css",
];

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
  // Tests pin stylesheet contents with regex literals like
  // /\.audit-card\s*{[^}]*min-width:\s*0;/ — those are references too, and
  // they live outside string literals. Treat any escaped-dot class token in
  // the file as applied.
  for (const m of text.matchAll(/\\\.(-?[A-Za-z_][\w-]*)/g)) applied.add(m[1]);
}

function isLive(cls) {
  if (applied.has(cls)) return true;
  for (const p of prefixes) if (p.length > 1 && cls.startsWith(p)) return true;
  return false;
}

// Split a selector group on top-level commas (not inside :is()/:not()/[]).
function splitGroup(sel) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of sel) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

const CLASS_RE = /\.(-?[A-Za-z_][\w-]*)/g;
const report = {};
let totalDead = 0;
let totalPartial = 0;

for (const rel of CSS_FILES) {
  const text = readFileSync(join(ROOT, rel), "utf8");
  const lineAt = (i) => text.slice(0, i).split("\n").length;
  const dead = [];
  const partial = [];
  const liveClasses = new Set();
  const deadClasses = new Set();

  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open === -1) break;
    // Any `}` sitting between the previous rule and this selector closes an
    // at-rule block we descended into. It is not part of this selector, and
    // must not fall inside this rule's deletion range.
    const rawAll = text.slice(i, open);
    const afterBrace = rawAll.lastIndexOf("}") + 1;
    const rawSel = rawAll.slice(afterBrace);
    const selBase = i + afterBrace;
    const sel = rawSel.trim();

    // At-rules with blocks (@media, @supports, @keyframes): descend into them
    // for @media/@supports, skip @keyframes bodies entirely.
    if (sel.startsWith("@")) {
      if (/^@(media|supports|layer)/.test(sel)) { i = open + 1; continue; }
      let d = 1, j = open + 1;
      while (j < text.length && d > 0) { if (text[j] === "{") d++; else if (text[j] === "}") d--; j++; }
      i = j;
      continue;
    }
    if (!sel) { i = open + 1; continue; }

    let d = 1, j = open + 1;
    while (j < text.length && d > 0) { if (text[j] === "{") d++; else if (text[j] === "}") d--; j++; }

    const parts = splitGroup(sel);
    const deadParts = [];
    const liveParts = [];
    for (const part of parts) {
      const classes = [...part.matchAll(CLASS_RE)].map((m) => m[1]);
      if (classes.length === 0) { liveParts.push(part); continue; }
      const isDead = classes.every((c) => !isLive(c));
      if (isDead) { deadParts.push(part); classes.forEach((c) => deadClasses.add(c)); }
      else { liveParts.push(part); classes.forEach((c) => { if (isLive(c)) liveClasses.add(c); }); }
    }

    if (deadParts.length && liveParts.length === 0) {
      // Start at the selector's first non-whitespace char so we don't eat the
      // preceding rule's newline; end just past the rule's closing brace.
      const start = selBase + (rawSel.length - rawSel.trimStart().length);
      dead.push({
        start,
        end: j,
        line: lineAt(start),
        endLine: lineAt(j),
        selector: sel.replace(/\s+/g, " "),
      });
    } else if (deadParts.length) {
      partial.push({
        selStart: selBase + (rawSel.length - rawSel.trimStart().length),
        selEnd: open,
        line: lineAt(open),
        drop: deadParts,
        keep: liveParts,
      });
    }
    i = j;
  }

  report[rel] = { dead, partial, deadClasses: [...deadClasses].sort() };
  totalDead += dead.length;
  totalPartial += partial.length;
  console.log(
    `${rel}: ${dead.length} fully-dead rules, ${partial.length} partial, ` +
      `${deadClasses.size} distinct dead classes`,
  );
}

console.log(`\ntotal: ${totalDead} fully-dead rules, ${totalPartial} partial`);
console.log(`applied tokens: ${applied.size}, dynamic prefixes: ${prefixes.size}`);
writeFileSync(join(ROOT, "dead-css.json"), JSON.stringify(report, null, 2));
