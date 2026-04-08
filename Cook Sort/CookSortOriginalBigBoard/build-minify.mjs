import { minify } from 'html-minifier-terser';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const arg    = process.argv[2];
if (!arg) { console.error('Usage: node build-minify.mjs <filename>'); process.exit(1); }
const name   = arg.replace(/\.html$/i, '');
const INPUT  = resolve(__dirname, `${name}.html`);
const OUTPUT = resolve(__dirname, `${name}.min.html`);

console.log('Reading:', INPUT);
const source = readFileSync(INPUT, 'utf-8');

console.log(`Input size: ${(source.length / 1024).toFixed(1)} KB`);

const result = await minify(source, {
  // HTML
  collapseWhitespace: true,
  collapseInlineTagWhitespace: false,
  conservativeCollapse: false,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,

  // CSS (inline <style> blocks)
  minifyCSS: true,

  // JS (inline <script> blocks) — terser with mangle
  minifyJS: {
    compress: {
      drop_console: false,   // keep console.* (used for debug checks)
      passes: 2,
    },
    mangle: {
      toplevel: false,       // don't rename top-level names (may be accessed via window.xxx)
      keep_fnames: false,
    },
    format: {
      comments: false,
    },
  },
});

writeFileSync(OUTPUT, result, 'utf-8');

const saved = source.length - result.length;
console.log(`Output size: ${(result.length / 1024).toFixed(1)} KB`);
console.log(`Saved: ${(saved / 1024).toFixed(1)} KB (${((saved / source.length) * 100).toFixed(1)}%)`);
console.log('Written:', OUTPUT);
