// Resize + re-compress the inlined loading screen images in the source HTML
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const BASE     = 'c:/MoodGames/Playable Ads/Playables/Coin Sort/CoinSortLongSlotV3';
const filename = process.argv[2] || 'Cos-LongSlotV3-60sec.html';
const INPUT    = path.join(BASE, filename);

// Max width to resize to (null = keep original), quality 0-100
const TARGETS = {
  loadingGameName:   { maxW: 800, quality: 78 },
  loadingBarBgImg:   { maxW: 800, quality: 72 },
  loadingBarFillImg: { maxW: null, quality: 72 }, // already tiny
  loadingTextImg:    { maxW: 650, quality: 75 },
};

async function processImage(html, id, { maxW, quality }) {
  const tagStart = html.indexOf(`id="${id}"`);
  if (tagStart === -1) return { html, skipped: true };

  const srcStart = html.indexOf('src="data:', tagStart);
  if (srcStart === -1) return { html, skipped: true };

  const dataStart = srcStart + 5;
  const dataEnd   = html.indexOf('"', dataStart);
  const dataUri   = html.slice(dataStart, dataEnd);
  const b64       = dataUri.split(',')[1];

  const origBuf = Buffer.from(b64, 'base64');
  const meta    = await sharp(origBuf).metadata();

  let pipeline = sharp(origBuf);
  if (maxW && meta.width > maxW) {
    pipeline = pipeline.resize(maxW, null, { fit: 'inside', withoutEnlargement: true });
  }
  const newBuf  = await pipeline.webp({ quality, effort: 6 }).toBuffer();
  const newB64  = newBuf.toString('base64');
  const newUri  = `data:image/webp;base64,${newB64}`;

  const savedKB = ((origBuf.length - newBuf.length) / 1024).toFixed(1);
  console.log(`  ${id}: ${(origBuf.length/1024).toFixed(1)} KB ${meta.width}×${meta.height} → ${(newBuf.length/1024).toFixed(1)} KB ${maxW||meta.width}px  (saved ${savedKB} KB)`);

  html = html.slice(0, dataStart) + newUri + html.slice(dataEnd);
  return { html, skipped: false };
}

(async () => {
  let html = fs.readFileSync(INPUT, 'utf8');
  console.log(`Input: ${(Buffer.byteLength(html,'utf8')/1024).toFixed(1)} KB\n`);

  for (const [id, opts] of Object.entries(TARGETS)) {
    const res = await processImage(html, id, opts);
    html = res.html;
    if (res.skipped) console.log(`  ${id}: SKIPPED (not found)`);
  }

  fs.writeFileSync(INPUT, html, 'utf8');
  console.log(`\nDone. Wrote ${(Buffer.byteLength(html,'utf8')/1024).toFixed(1)} KB → ${INPUT}`);
})();
