// Extract loading screen assets from ASSETS, compress them, and inline them
// directly as src attributes in the HTML img tags.
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const BASE     = 'c:/MoodGames/Playable Ads/Playables/Coin Sort/CoinSortLongSlotV3';
const filename = process.argv[2] || 'Cos-LongSlotV3-60sec.html';
const INPUT    = path.join(BASE, filename);

// Loading asset keys → element IDs
const LOADING_ASSETS = {
  loadingBarBg:   'loadingBarBgImg',
  loadingBarFill: 'loadingBarFillImg',
  loadingTextImg: 'loadingTextImg',
  gameNameImage:  'loadingGameName',
};

// Compression quality for each asset (WebP quality 0-100)
const QUALITY = {
  loadingBarBg:   72,
  loadingBarFill: 72,
  loadingTextImg: 75,
  gameNameImage:  78,
};

async function extractBase64(html, key) {
  // Match unquoted key: `key:"data:..."`
  const re = new RegExp(key + ':"(data:image/[^;]+;base64,([^"]+))"');
  const m  = html.match(re);
  if (!m) throw new Error(`Key not found: ${key}`);
  return { full: m[1], mime: m[1].split(';')[0].replace('data:', ''), b64: m[2] };
}

async function compress(b64, quality) {
  const buf = Buffer.from(b64, 'base64');
  const out  = await sharp(buf)
    .webp({ quality, effort: 6, lossless: false })
    .toBuffer();
  return out.toString('base64');
}

(async () => {
  let html = fs.readFileSync(INPUT, 'utf8');

  // Guard — check if already inlined
  if (html.includes('<!-- loading-assets-inlined -->')) {
    console.log('Already inlined — skipping.');
    process.exit(0);
  }

  console.log('Extracting and compressing loading assets...\n');

  for (const [key, elemId] of Object.entries(LOADING_ASSETS)) {
    // Extract from ASSETS
    let data;
    try { data = await extractBase64(html, key); }
    catch (e) {
      console.warn(`  SKIP ${key}: ${e.message}`);
      continue;
    }

    const origKB = (data.b64.length / 1024).toFixed(1);

    // Compress
    const newB64 = await compress(data.b64, QUALITY[key] || 75);
    const newKB  = (newB64.length / 1024).toFixed(1);
    const newSrc = `data:image/webp;base64,${newB64}`;

    console.log(`  ${key}: ${origKB} KB → ${newKB} KB`);

    // Inline: set src directly on the <img> tag
    // Replace: <img id="elemId" alt="">  →  <img id="elemId" src="data:..." alt="">
    const imgRe  = new RegExp(`(<img\\s+id="${elemId}")(\\s+alt="")`, 'g');
    const imgRe2 = new RegExp(`(<img\\s+id="${elemId}")(\\s+src="[^"]*")(\\s+alt="")`, 'g');

    if (imgRe2.test(html)) {
      // Already has src attr — replace it
      html = html.replace(imgRe2, `$1 src="${newSrc}"$3`);
    } else {
      html = html.replace(imgRe, `$1 src="${newSrc}"$2`);
    }

    // Remove from ASSETS block: `key:"data:..."` (with optional trailing comma+newline)
    const assetEntryRe = new RegExp(
      `\\s*${key}:"data:image/[^;]+;base64,[^"]+",?\\n?`,
      ''
    );
    html = html.replace(assetEntryRe, '\n');
  }

  // Remove the tiny loading-init script (no longer needed)
  html = html.replace(
    /\s*<script>!function\(\)\{var a=window\.__AD_ASSETS[\s\S]*?\};\}\(\);<\/script>\n?/,
    '\n'
  );

  // Remove the JS src-assignment lines for loading assets in game script
  const srcAssignLines = [
    /\s*if \(loadingGameNameEl\)\s+loadingGameNameEl\.src\s+=\s+ASSETS\.gameNameImage;\n?/,
    /\s*if \(loadingBarBgImgEl\)\s+loadingBarBgImgEl\.src\s+=\s+ASSETS\.loadingBarBg;\n?/,
    /\s*if \(loadingBarFillImgEl\)\s+loadingBarFillImgEl\.src\s+=\s+ASSETS\.loadingBarFill;\n?/,
    /\s*if \(loadingTextImgEl\)\s+loadingTextImgEl\.src\s+=\s+ASSETS\.loadingTextImg;\n?/,
  ];
  for (const re of srcAssignLines) html = html.replace(re, '');

  // Mark as done
  html = html.replace('<body>', '<body><!-- loading-assets-inlined -->');

  fs.writeFileSync(INPUT, html, 'utf8');
  console.log(`\nDone. Wrote ${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB → ${INPUT}`);
})();
