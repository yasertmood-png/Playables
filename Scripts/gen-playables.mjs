import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, "playables.json");

// Skip common folders we don't want to scan
const SKIP_DIRS = new Set([
  ".git", ".github", "node_modules", ".wrangler", ".next", "dist", "build"
]);

// Skip these files anywhere
const SKIP_BASENAMES = new Set(["index.html", "README.md", "playables.json"]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];

  for (const e of entries) {
    const full = path.join(dir, e.name);

    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...await walk(full));
      continue;
    }

    if (e.isFile()) {
      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      const base = path.basename(rel);

      if (SKIP_BASENAMES.has(base)) continue;
      if (rel.toLowerCase().endsWith(".html")) out.push(rel);
    }
  }

  return out;
}

const files = (await walk(ROOT)).sort((a, b) => a.localeCompare(b));
await fs.writeFile(OUT_FILE, JSON.stringify(files, null, 2) + "\n", "utf8");
console.log(`Wrote ${files.length} entries to playables.json`);
