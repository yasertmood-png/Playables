const fs   = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const BASE     = 'c:/MoodGames/Playable Ads/Playables/Coin Sort/CoinSortLongSlotV3';
const filename = process.argv[2] || 'Cos-LongSlotV3-60sec.html';
const outName  = filename.replace(/\.html$/i, '.obf.html');
const INPUT    = path.join(BASE, filename);
const OUTPUT   = path.join(BASE, 'Obfuscated', outName);

// Returns the index of the closing brace matching the opening brace at braceIdx
function findMatchingBrace(str, braceIdx) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = braceIdx; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === stringChar) inString = false;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; }
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return i; }
    }
  }
  return -1;
}

(async () => {
  let html = fs.readFileSync(INPUT, 'utf8');
  const inSize = Buffer.byteLength(html, 'utf8');
  console.log(`Input:  ${(inSize / 1024).toFixed(1)} KB  (${INPUT})`);

  // ── Step 0: Extract ASSETS block out of game script ───────────────────────
  console.log('\nStep 0 — Extracting ASSETS block...');
  const ASSETS_MARKER = 'const ASSETS = {';
  const assetsIdx = html.indexOf(ASSETS_MARKER);
  const alreadyExtracted = assetsIdx === -1 && html.includes('window.__AD_ASSETS');

  if (!alreadyExtracted) {
    if (assetsIdx === -1) { console.error('ERROR: const ASSETS = { not found'); process.exit(1); }
    const braceOpen = html.indexOf('{', assetsIdx);
    const braceClose = findMatchingBrace(html, braceOpen);
    // Include the trailing semicolon if present
    const afterClose = html[braceClose + 1] === ';' ? braceClose + 2 : braceClose + 1;
    const assetsBody = html.slice(braceOpen, afterClose); // "{ ... };" or "{ ... }"
    const assetsBlockKB = (assetsBody.length / 1024).toFixed(1);

    // Remove ASSETS from game script, replace with window reference
    html = html.slice(0, assetsIdx) + 'const ASSETS=window.__AD_ASSETS;' + html.slice(afterClose);

    // Insert a new <script> with the ASSETS data just before the game script tag
    const refIdx   = html.indexOf('const ASSETS=window.__AD_ASSETS;');
    const scriptTagIdx = html.lastIndexOf('<script', refIdx);
    const loadingInitScript = `<script>!function(){var a=window.__AD_ASSETS;if(!a)return;var m={'loadingGameName':'gameNameImage','loadingBarBgImg':'loadingBarBg','loadingBarFillImg':'loadingBarFill','loadingTextImg':'loadingTextImg'};Object.keys(m).forEach(function(k){var el=document.getElementById(k);if(el&&a[m[k]])el.src=a[m[k]];});}();</script>\n`;
    const assetsScript = `<script>window.__AD_ASSETS=${assetsBody}</script>\n`;
    html = html.slice(0, scriptTagIdx) + assetsScript + loadingInitScript + html.slice(scriptTagIdx);
    console.log(`  Extracted ${assetsBlockKB} KB — game script is now script #6`);
  } else {
    console.log('  ASSETS already extracted in source — skipping.');
  }

  // ── Step 1: Minify HTML ────────────────────────────────────────────────────
  console.log('\nStep 1 — Minifying HTML...');
  const minified = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: true,
    minifyJS: true,
    conservativeCollapse: false,
  });
  const minSize = Buffer.byteLength(minified, 'utf8');
  console.log(`Minified: ${(minSize / 1024).toFixed(1)} KB  (saved ${((inSize - minSize) / 1024).toFixed(1)} KB)`);

  // ── Step 2: Obfuscate script #5 (game logic only, no ASSETS) ──────────────
  console.log('\nStep 2 — Obfuscating game script (script #6)...');
  const SCRIPT_RE = /(<script(?:[^>]*)>)([\s\S]*?)(<\/script>)/g;
  let scriptIndex = 0;

  const result = minified.replace(SCRIPT_RE, (full, open, code, close) => {
    scriptIndex++;
    if (scriptIndex !== 6) return full;

    console.log(`  script ${scriptIndex} (game logic): ${code.length} chars → obfuscating...`);

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
      stringArrayCallsTransform: false,
      stringArrayEncoding: ['none'],
      stringArrayIndexShift: false,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 1,
      stringArrayWrappersChained: false,
      stringArrayWrappersParametersMaxCount: 2,
      stringArrayWrappersType: 'function',
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false,
    }).getObfuscatedCode();

    console.log(`  Done — obfuscated: ${obfuscated.length} chars`);
    return open + obfuscated + close;
  });

  // ── Write output ───────────────────────────────────────────────────────────
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, result, 'utf8');

  const outSize = fs.statSync(OUTPUT).size;
  console.log(`\nOutput: ${(outSize / 1024).toFixed(1)} KB  (${OUTPUT})`);
  console.log('Done.');
})();
