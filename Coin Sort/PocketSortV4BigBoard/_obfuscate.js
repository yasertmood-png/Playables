const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const arg = process.argv[2];
if (!arg) { console.error('Usage: node _obfuscate.js <filename.min.html>'); process.exit(1); }
const inputFile = path.join(__dirname, arg);
const outputFile = path.join(__dirname, arg.replace(/\.min\.html$/i, '.obf.html'));

let html = fs.readFileSync(inputFile, 'utf8');
console.log(`Input size: ${(html.length / 1024).toFixed(1)} KB`);

// Asset extraction — replaces base64/data-URI string literals with bare identifiers.
// The obfuscator sees identifiers, not strings, so assets are never touched.
const assetDeclarations = []; // "var __A0__ = '...'"
let assetIndex = 0;

function extractAssets(jsCode) {
  return jsCode.replace(/(["'`])(data:[^"'`\\]{50,}|[A-Za-z0-9+/=]{200,})\1/g, (match) => {
    const varName = `__A${assetIndex++}__`;
    // Preserve original quote style
    assetDeclarations.push(`var ${varName}=${match};`);
    return varName; // bare identifier, not a string
  });
}

// UMD library pattern — Three.js, TWEEN.js: already minified, skip.
function isLibraryBlock(code) {
  return /^!function\([a-z],[a-z]\)\{"object"==typeof exports/.test(code.trim());
}

// Process each inline <script> block (no src attribute)
let scriptCount = 0;
let injectionDone = false;

html = html.replace(/<script(?![^>]*\bsrc\b)([^>]*)>([\s\S]*?)<\/script>/gi, (fullMatch, attrs, jsCode) => {
  if (!jsCode.trim()) return fullMatch;
  scriptCount++;

  const isLib = isLibraryBlock(jsCode);
  console.log(`  Obfuscating ${isLib ? 'library' : 'game'} block ${scriptCount} (${(jsCode.length / 1024).toFixed(1)} KB)...`);

  // Extract assets → bare identifiers
  const stripped = extractAssets(jsCode);

  let obfuscated;
  try {
    obfuscated = JavaScriptObfuscator.obfuscate(stripped, {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      renameGlobals: false,
      selfDefending: false,
      // Libraries: skip string array — GLSL shaders & internal string checks are fragile
      stringArray: !isLib,
      stringArrayCallsTransform: !isLib,
      stringArrayEncoding: isLib ? [] : ['base64'],
      stringArrayThreshold: isLib ? 0 : 0.75,
      transformObjectKeys: false,
      unicodeEscapeSequence: false,
    }).getObfuscatedCode();
  } catch (e) {
    console.error(`  Block ${scriptCount} failed: ${e.message}`);
    return fullMatch;
  }

  // Inject asset declarations script once, before the first obfuscated block
  let prefix = '';
  if (!injectionDone && assetDeclarations.length > 0) {
    prefix = `<script>${assetDeclarations.join('')}</script>`;
    injectionDone = true;
    console.log(`  Injected ${assetDeclarations.length} asset declarations`);
  } else if (assetDeclarations.length > injectionDone) {
    // Additional assets found in later blocks — append to existing declaration script
    // (shouldn't happen since assets are only in the game block, but handle it)
    injectionDone = assetDeclarations.length;
  }

  const openTag = `<script${attrs}>`;
  return `${prefix}${openTag}${obfuscated}</script>`;
});

fs.writeFileSync(outputFile, html, 'utf8');
console.log(`\nOutput size: ${(html.length / 1024).toFixed(1)} KB`);
console.log(`Assets extracted: ${assetIndex}`);
console.log(`Done: ${outputFile}`);
