// One-shot cascade analyser for the @layer migration. Read-only.
// Reports cross-sheet property conflicts and, of those, how many would change
// winner if sheet order became @layer order (layers beat specificity).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
// Import order from src/main.jsx — later wins today on equal specificity.
const SHEETS = ["styles/base.css", "styles/screens.css", "src/app.css"];

function specificity(sel) {
  let s = sel
    .replace(/:where\([^)]*\)/g, "")
    .replace(/::[\w-]+/g, " EL ")
    .replace(/:(is|not|has)\(([^)]*)\)/g, (_, __, inner) => " " + inner + " ");
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const cls =
    (s.match(/\.[\w-]+/g) || []).length +
    (s.match(/\[[^\]]*\]/g) || []).length +
    (s.match(/:[\w-]+(?:\([^)]*\))?/g) || []).length;
  const el = (s.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
  return ids * 10000 + cls * 100 + el;
}

// Class tokens of the rightmost compound — what the rule actually targets.
function keyClasses(sel) {
  const parts = sel.trim().split(/[\s>+~]+/);
  const key = parts[parts.length - 1] || "";
  return new Set([...key.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]));
}

function parse(rel) {
  // Blank comments to spaces (keeping length so line numbers stay correct).
  // Left in place they land in selector text and inflate specificity.
  const text = readFileSync(join(ROOT, rel), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    (m) => m.replace(/[^\r\n]/g, " "),
  );
  const rules = [];
  const stack = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open === -1) break;
    const rawAll = text.slice(i, open);
    // Track at-rule exits so media context stays accurate.
    for (const ch of rawAll) if (ch === "}") stack.pop();
    const sel = rawAll.slice(rawAll.lastIndexOf("}") + 1).trim();
    const line = text.slice(0, open).split("\n").length;

    if (sel.startsWith("@")) {
      if (/^@(media|supports|layer)/.test(sel)) { stack.push(sel); i = open + 1; continue; }
      let d = 1, j = open + 1;
      while (j < text.length && d > 0) { if (text[j] === "{") d++; else if (text[j] === "}") d--; j++; }
      i = j;
      continue;
    }
    if (!sel) { i = open + 1; continue; }

    let d = 1, j = open + 1;
    while (j < text.length && d > 0) { if (text[j] === "{") d++; else if (text[j] === "}") d--; j++; }
    const body = text.slice(open + 1, j - 1);
    const props = new Map();
    for (const m of body.matchAll(/(^|;|\n)\s*(-{0,2}[\w-]+)\s*:\s*([^;}]+)/g)) {
      const name = m[2].trim();
      if (name.startsWith("--")) continue; // custom props: different cascade story
      props.set(name, m[3].trim().replace(/\s+/g, " "));
    }
    const media = stack.filter((s) => !s.startsWith("@layer")).join(" && ");
    for (const part of sel.split(",")) {
      const s = part.trim();
      if (!s) continue;
      rules.push({
        sheet: rel, line, sel: s, media,
        spec: specificity(s), key: keyClasses(s), props,
        important: /!important/.test(body),
      });
    }
    i = j;
  }
  return rules;
}

const all = SHEETS.flatMap(parse);
console.log("rules parsed:", all.length, SHEETS.map((s) => all.filter((r) => r.sheet === s).length));

// Ancestor context and element type of the key compound.
function context(sel) {
  const parts = sel.trim().split(/[\s>+~]+/);
  const key = parts.pop() || "";
  const tag = (key.match(/^([a-zA-Z][\w-]*)/) || [])[1] || "";
  const pseudo = (key.match(/::[\w-]+/) || [])[0] || "";
  const ancestors = new Set(
    [...parts.join(" ").matchAll(/\.(-?[A-Za-z_][\w-]*)/g)].map((m) => m[1]),
  );
  return { tag, pseudo, ancestors };
}

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// Two rules can only fight over a property if one element can match both.
// Requiring identical key compounds, identical pseudo-element, compatible tag,
// and ancestor contexts that are equal or one unconstrained keeps this to
// pairs that plausibly hit the same element. Broader matching produced mostly
// false pairs like `.page-h .actions .btn` vs `.hist-actions .btn`.
function overlaps(a, b) {
  if (a.media !== b.media && a.media !== "" && b.media !== "") return false;
  if (a.key.size === 0 || b.key.size === 0) return false;
  if (!sameSet(a.key, b.key)) return false;
  const ca = context(a.sel), cb = context(b.sel);
  if (ca.pseudo !== cb.pseudo) return false;
  if (ca.tag && cb.tag && ca.tag !== cb.tag) return false;
  if (ca.ancestors.size && cb.ancestors.size && !sameSet(ca.ancestors, cb.ancestors)) return false;
  return true;
}

const conflicts = [];
const flips = [];
for (let x = 0; x < all.length; x++) {
  for (let y = x + 1; y < all.length; y++) {
    const a = all[x], b = all[y];
    if (a.sheet === b.sheet) continue;
    if (!overlaps(a, b)) continue;
    for (const [p, va] of a.props) {
      const vb = b.props.get(p);
      if (vb === undefined || vb === va) continue;
      const earlier = SHEETS.indexOf(a.sheet) < SHEETS.indexOf(b.sheet) ? a : b;
      const later = earlier === a ? b : a;
      const rec = {
        prop: p, earlier: `${earlier.sheet}:${earlier.line} ${earlier.sel}`,
        later: `${later.sheet}:${later.line} ${later.sel}`,
        specEarlier: earlier.spec, specLater: later.spec,
      };
      conflicts.push(rec);
      // Today the more specific rule wins. Under @layer the later layer wins
      // outright, so a more-specific EARLIER rule loses ground it holds now.
      if (earlier.spec > later.spec && !earlier.important) flips.push(rec);
    }
  }
}

console.log(`cross-sheet property conflicts: ${conflicts.length}`);
console.log(`of those, winner FLIPS under @layer: ${flips.length}`);
const byProp = {};
for (const f of flips) byProp[f.prop] = (byProp[f.prop] || 0) + 1;
console.log("flip properties:", Object.entries(byProp).sort((a, b) => b[1] - a[1]).slice(0, 15));
writeFileSync(join(ROOT, "css-cascade.json"), JSON.stringify({ conflicts, flips }, null, 2));
