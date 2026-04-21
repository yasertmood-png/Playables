const fs   = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const BASE     = 'c:/MoodGames/Playable Ads/Playables/Coin Sort/CoinSortLongSlotV2';
const filename = process.argv[2] || 'Cos-LongSlotV2-60sec.html';
const outName  = filename.replace(/\.html$/i, '.obf.html');
const INPUT    = path.join(BASE, filename);
const OUTPUT   = path.join(BASE, 'Obfuscated', outName);

(async () => {
  const html = fs.readFileSync(INPUT, 'utf8');
  const inSize = Buffer.byteLength(html, 'utf8');
  console.log(`Input:  ${(inSize / 1024).toFixed(1)} KB  (${INPUT})`);

  // ── Step 1: Minify HTML (collapse whitespace, minify inline CSS & JS) ──────
  console.log('\nStep 1 — Minifying HTML...');
  const minified = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true,          // terser on all <script> blocks
    conservativeCollapse: false,
  });
  const minSize = Buffer.byteLength(minified, 'utf8');
  console.log(`Minified: ${(minSize / 1024).toFixed(1)} KB  (saved ${((inSize - minSize) / 1024).toFixed(1)} KB)`);

  // ── Step 2: Obfuscate script #4 (game code) ──────────────────────────────
  console.log('\nStep 2 — Obfuscating game script (script #4)...');
  const SCRIPT_RE = /(<script(?:[^>]*)>)([\s\S]*?)(<\/script>)/g;
  let scriptIndex = 0;

  const result = minified.replace(SCRIPT_RE, (full, open, code, close) => {
    scriptIndex++;
    if (scriptIndex !== 4) return full;

    console.log(`  script ${scriptIndex}: ${code.length} chars → obfuscating...`);

    const obfuscated = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: false,
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: false,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayCallsTransformThreshold: 0.75,
      stringArrayEncoding: ['base64'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 2,
      stringArrayWrappersChained: true,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: 'function',
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false,
    }).getObfuscatedCode();

    console.log(`  Done — obfuscated: ${obfuscated.length} chars`);
    return open + obfuscated + close;
  });

  // ── Write output ──────────────────────────────────────────────────────────
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, result, 'utf8');

  const outSize = fs.statSync(OUTPUT).size;
  console.log(`\nOutput: ${(outSize / 1024).toFixed(1)} KB  (${OUTPUT})`);
  console.log('Done.');
})();
