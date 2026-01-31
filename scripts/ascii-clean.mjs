// scripts/ascii-clean.mjs
// ASCII-only cleaner that removes mojibake + invisible chars repo-wide.
// Run: node scripts/ascii-clean.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const INCLUDE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".json",
  ".md",
]);

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out"]);

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (!INCLUDE_EXT.has(ext)) continue;
      out.push(full);
    }
  }
  return out;
}

function cleanText(text) {
  let out = text;

  // --- Remove invisible / BOM / NBSP
  out = out.replace(/\uFEFF/g, ""); // BOM
  out = out.replace(/\u00A0/g, " "); // NBSP
  out = out.replace(/[\u200B\u200C\u200D]/g, ""); // zero-width chars

  // --- Fix common mojibake sequences (UTF-8 bytes misread as cp1252)
  //  -   (E2 80 A2) -> use safe ASCII separator
  out = out.replace(/\u00E2\u20AC\u00A2/g, " - ");

  //  to  (E2 86 92) -> avoid '>' in JSX text nodes; use safe word
  out = out.replace(/\u00E2\u2020\u2019/g, " to ");

  // - / - (E2 80 93/94) -> hyphen
  out = out.replace(/\u00E2\u20AC\u201C/g, "-"); // -
  out = out.replace(/\u00E2\u20AC\u201D/g, "-"); // -
  // â€" fragment that shows up in your errors
  out = out.replace(/\u00E2\u20AC\u201D/g, "-");

  // " " / ' etc -> straight quotes/apostrophes
  out = out.replace(/\u00E2\u20AC\u0153/g, '"'); // "
  out = out.replace(/\u00E2\u20AC\u009D/g, '"'); // "
  out = out.replace(/\u00E2\u20AC\u2122/g, "'"); // '
  out = out.replace(/\u00E2\u20AC\u02DC/g, "'"); // '

  // ... (E2 80 A6) -> ...
  out = out.replace(/\u00E2\u20AC\u00A6/g, "...");

  //  (C2) -> remove
  out = out.replace(/\u00C2/g, "");

  return out;
}

let changed = 0;
const filesChanged = [];

for (const file of walk(ROOT)) {
  const raw = fs.readFileSync(file, "utf8");
  const cleaned = cleanText(raw);

  if (cleaned !== raw) {
    fs.writeFileSync(file, cleaned, "utf8");
    changed += 1;
    filesChanged.push(path.relative(ROOT, file));
  }
}

console.log(`ascii-clean: updated ${changed} file(s).`);
if (filesChanged.length) console.log(filesChanged.map((f) => ` - ${f}`).join("\n"));
