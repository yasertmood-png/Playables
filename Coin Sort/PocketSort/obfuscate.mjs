import { readFileSync, writeFileSync } from 'fs';
import { minify as htmlMinify } from 'html-minifier-terser';
import JavaScriptObfuscator from 'javascript-obfuscator';

const FILES = [
  'PocketSort-60Sec.html',
  'PocketSort-2clk.html',
];

async function processFile(filename) {
  const inputPath  = new URL('./' + filename, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1').replace(/%20/g, ' ');
  const outputPath = inputPath.replace('.html', '.min.html');

  console.log(`\nProcessing: ${filename}`);
  const raw = readFileSync(inputPath, 'utf8');

  // ── 1. Extract and obfuscate every <script> block ────────────────────────
  const scriptRegex = /<script(\b[^>]*)>([\s\S]*?)<\/script>/gi;
  let obfuscated = raw.replace(scriptRegex, (match, attrs, code) => {
    const trimmed = code.trim();
    if (!trimmed) return match; // empty block – keep as-is

    // Skip external src= scripts (no inline code to obfuscate)
    if (/\bsrc\s*=/.test(attrs)) return match;

    try {
      const result = JavaScriptObfuscator.obfuscate(trimmed, {
        compact: true,
        simplify: true,
        controlFlowFlattening: false,   // keep it safe / fast
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,           // don't rename globals shared across blocks
        selfDefending: false,
        splitStrings: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        transformObjectKeys: false,
        unicodeEscapeSequence: false,
      });
      return `<script${attrs}>${result.getObfuscatedCode()}</script>`;
    } catch (e) {
      console.warn(`  ⚠ Could not obfuscate a <script> block: ${e.message}`);
      return match;
    }
  });

  // ── 2. Minify the full HTML (including the now-obfuscated inline scripts) ─
  const minified = await htmlMinify(obfuscated, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: false,   // JS already obfuscated above
    continueOnParseError: true,
  });

  writeFileSync(outputPath, minified, 'utf8');

  const inKB  = (raw.length      / 1024).toFixed(1);
  const outKB = (minified.length / 1024).toFixed(1);
  console.log(`  Input : ${inKB} KB`);
  console.log(`  Output: ${outKB} KB  →  ${outputPath}`);
}

for (const file of FILES) {
  await processFile(file);
}
console.log('\nDone.');
