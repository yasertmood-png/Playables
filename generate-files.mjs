// Run with: node generate-files.mjs
// Scans for .html files and writes files.json for index.html to use.

import { readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const EXCLUDE_NAMES = new Set(["index.html", "README.md"]);
const SKIP_DIRS = new Set([".git", ".github", "node_modules", ".claude"]);
const ALLOWED_EXT = [".html"];

function scan(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      scan(full, files);
    } else if (
      ALLOWED_EXT.some(ext => entry.toLowerCase().endsWith(ext)) &&
      !EXCLUDE_NAMES.has(entry)
    ) {
      files.push(relative(ROOT, full).replace(/\\/g, "/"));
    }
  }
  return files;
}

const files = scan(ROOT);
writeFileSync(join(ROOT, "files.json"), JSON.stringify(files, null, 2) + "\n");
console.log(`Wrote files.json — ${files.length} file(s):`);
files.forEach(f => console.log("  " + f));
