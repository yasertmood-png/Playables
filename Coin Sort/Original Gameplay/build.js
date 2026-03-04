/**
 * Minify + Obfuscate pipeline for single-file HTML playable ads.
 *
 * Steps:
 *  1. Minify HTML + inline CSS + inline JS  (html-minifier-terser)
 *  2. Obfuscate every <script> block        (javascript-obfuscator)
 */

const fs   = require('fs');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const JavaScriptObfuscator    = require('javascript-obfuscator');

const INPUT  = path.join(__dirname, 'OriginalGameplay.html');
const OUTPUT = path.join(__dirname, 'OriginalGameplay.min.obf.html');

// ── javascript-obfuscator options ──────────────────────────────────────────
// Tuned for playable ads: strong enough to deter copy-cats, but still small
// and fast to run in an ad iframe.
const OBFUSCATOR_OPTIONS = {
  compact: true,
  simplify: true,
  controlFlowFlattening: false,      // keep file size down
  deadCodeInjection: false,          // keep file size down
  debugProtection: false,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,              // safer for multi-script files
  selfDefending: false,              // can break some ad networks
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  rotateStringArray: true,
  shuffleStringArray: true,
  splitStrings: false,               // keep size manageable
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

// ── html-minifier-terser options ───────────────────────────────────────────
const MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: {                        // terser options for inline <script>
    compress: { drop_console: false, passes: 2 },
    mangle: true,
  },
};

async function run() {
  console.log('Reading input file …');
  const html = fs.readFileSync(INPUT, 'utf8');
  console.log(`  Input size : ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);

  // ── Step 1: Minify ──────────────────────────────────────────────────────
  console.log('\nStep 1 — Minifying HTML / CSS / JS …');
  let minified;
  try {
    minified = await minifyHtml(html, MINIFY_OPTIONS);
  } catch (err) {
    console.error('Minification failed:', err.message);
    process.exit(1);
  }
  console.log(`  After minify: ${(Buffer.byteLength(minified) / 1024).toFixed(1)} KB`);

  // ── Step 2: Obfuscate every <script> block ──────────────────────────────
  console.log('\nStep 2 — Obfuscating <script> blocks …');

  // Match <script> … </script> blocks that have no src="" attribute
  // (inline scripts only — we don't want to touch external-src tags).
  const SCRIPT_RE = /(<script(?:\s[^>]*)?>)([\s\S]*?)(<\/script>)/gi;
  let scriptCount = 0;

  const obfuscated = minified.replace(SCRIPT_RE, (match, openTag, code, closeTag) => {
    // Skip empty blocks or blocks that are clearly not JS (e.g. type="text/template")
    const typeMatch = openTag.match(/type\s*=\s*["']([^"']+)["']/i);
    if (typeMatch && !typeMatch[1].includes('javascript')) return match;
    if (!code.trim()) return match;

    scriptCount++;
    console.log(`  Obfuscating script block #${scriptCount} (${code.length} chars) …`);

    try {
      const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);
      return openTag + result.getObfuscatedCode() + closeTag;
    } catch (err) {
      console.warn(`  ⚠  Block #${scriptCount} obfuscation failed (kept as-is): ${err.message}`);
      return match;
    }
  });

  console.log(`  Obfuscated ${scriptCount} script block(s).`);
  console.log(`  After obfuscate: ${(Buffer.byteLength(obfuscated) / 1024).toFixed(1)} KB`);

  // ── Write output ────────────────────────────────────────────────────────
  fs.writeFileSync(OUTPUT, obfuscated, 'utf8');
  console.log(`\nDone! Output written to:\n  ${OUTPUT}`);
}

run().catch(err => { console.error(err); process.exit(1); });
