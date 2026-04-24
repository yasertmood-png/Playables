// One-time transformation: extract ASSETS from game script in source HTML
// so loading screen images are visible before the game script parses.
const fs   = require('fs');
const path = require('path');

const BASE = 'c:/MoodGames/Playable Ads/Playables/Coin Sort/CoinSortLongSlotV3';
const filename = process.argv[2] || 'Cos-LongSlotV3-60sec.html';
const INPUT = path.join(BASE, filename);

function findMatchingBrace(str, braceIdx) {
  let depth = 0, inString = false, stringChar = '';
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

let html = fs.readFileSync(INPUT, 'utf8');

// Check if already extracted
if (html.includes('const ASSETS=window.__AD_ASSETS') || html.includes('const ASSETS = window.__AD_ASSETS')) {
  console.log('Already extracted — skipping.');
  process.exit(0);
}

// Find ASSETS block
const ASSETS_MARKER = 'const ASSETS = {';
const assetsIdx = html.indexOf(ASSETS_MARKER);
if (assetsIdx === -1) { console.error('ERROR: const ASSETS = { not found'); process.exit(1); }

const braceOpen  = html.indexOf('{', assetsIdx);
const braceClose = findMatchingBrace(html, braceOpen);
const afterClose = html[braceClose + 1] === ';' ? braceClose + 2 : braceClose + 1;
const assetsBody = html.slice(braceOpen, afterClose); // "{ ... };" or "{ ... }"

console.log(`Found ASSETS block: ${(assetsBody.length / 1024).toFixed(1)} KB`);

// Replace ASSETS in game script with window reference
html = html.slice(0, assetsIdx) + 'const ASSETS = window.__AD_ASSETS;' + html.slice(afterClose);

// Find game script opening tag (the <script> tag that now contains ASSETS reference)
const refIdx       = html.indexOf('const ASSETS = window.__AD_ASSETS;');
const scriptTagIdx = html.lastIndexOf('<script', refIdx);

// Build the two new scripts to inject before game script
const assetsScript     = `  <script>window.__AD_ASSETS=${assetsBody}</script>\n`;
const loadingInitScript = `  <script>!function(){var a=window.__AD_ASSETS;if(!a)return;var m={'loadingGameName':'gameNameImage','loadingBarBgImg':'loadingBarBg','loadingBarFillImg':'loadingBarFill','loadingTextImg':'loadingTextImg'};Object.keys(m).forEach(function(k){var el=document.getElementById(k);if(el&&a[m[k]])el.src=a[m[k]];});}();</script>\n`;

html = html.slice(0, scriptTagIdx) + assetsScript + loadingInitScript + html.slice(scriptTagIdx);

fs.writeFileSync(INPUT, html, 'utf8');
console.log(`Done. Wrote ${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB → ${INPUT}`);
