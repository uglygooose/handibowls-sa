#!/usr/bin/env node
/**
 * Simple codemod to help migrate hardcoded brand colors to theme tokens.
 * This is optional; run only if you want it.
 *
 * Usage:
 *   node scripts/theme-codemod.mjs          # dry run
 *   node scripts/theme-codemod.mjs --write  # apply
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WRITE = process.argv.includes("--write");

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "out"]);
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const COLOR_MAP = [
  // adjust these to your old palette usage
  ["#6B0F1A", "theme.maroon"],
  ["#7A1F2B", "theme.maroon"],
  ["#111827", "theme.navy"],
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full);
    } else if (ent.isFile()) {
      const ext = path.extname(full);
      if (!EXT.has(ext)) continue;
      handleFile(full);
    }
  }
}

function handleFile(filePath) {
  let text = fs.readFileSync(filePath, "utf8");
  let next = text;

  for (const [hex, token] of COLOR_MAP) {
    // only replace exact string occurrences like "background: '#6B0F1A'"
    next = next.split(`"${hex}"`).join(token);
    next = next.split(`'${hex}'`).join(token);
  }

  if (next !== text) {
    if (WRITE) {
      fs.writeFileSync(filePath, next, "utf8");
      console.log(`updated: ${path.relative(ROOT, filePath)}`);
    } else {
      console.log(`[dry] would update: ${path.relative(ROOT, filePath)}`);
    }
  }
}

walk(ROOT);

if (!WRITE) console.log(`Dry run complete. Add --write to apply.`);
