import JavaScriptObfuscator from 'javascript-obfuscator';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const arg    = process.argv[2];
if (!arg) { console.error('Usage: node build-obfuscate.mjs <filename>'); process.exit(1); }
const name   = arg.replace(/\.min\.html$|\.html$/i, '');
const INPUT  = resolve(__dirname, `${name}.min.html`);
const OUTPUT = resolve(__dirname, `${name}.obf.html`);

console.log('Reading:', INPUT);
let html = readFileSync(INPUT, 'utf-8');
console.log(`Input size: ${(html.length / 1024).toFixed(1)} KB`);

let blockIndex = 0;

// Profile: full obfuscation for logic blocks
const LOGIC_OPTIONS = {
  compact: true,
  simplify: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['none'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.75,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: 'function',
  debugProtection: false,
  selfDefending: false,
  disableConsoleOutput: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

// Profile: asset blocks (base64 data) — no string array to avoid massive inflation
const ASSET_OPTIONS = {
  ...LOGIC_OPTIONS,
  stringArray: false,
  stringArrayCallsTransform: false,
};

html = html.replace(/<script>([\s\S]*?)<\/script>/g, (match, js) => {
  blockIndex++;

  // Blocks with large base64 strings (assets/libs): obfuscate identifiers only,
  // no string array — hoisting huge base64 blobs inflates the file massively.
  const hasHugeStrings = /var\s+ASSETS\s*=/.test(js) ||
    (/TWEEN|THREE\./.test(js) && !/function\s+animateCoin/.test(js));

  const profile = hasHugeStrings ? ASSET_OPTIONS : LOGIC_OPTIONS;
  const tag     = hasHugeStrings ? 'light' : 'full';

  console.log(`  Block ${blockIndex} [${tag}] (${(js.length / 1024).toFixed(1)} KB)...`);
  const obfuscated = JavaScriptObfuscator.obfuscate(js, profile);
  const code = obfuscated.getObfuscatedCode();
  console.log(`    -> ${(code.length / 1024).toFixed(1)} KB`);
  return `<script>${code}</script>`;
});

writeFileSync(OUTPUT, html, 'utf-8');

const inputSize  = readFileSync(INPUT,  'utf-8').length;
const outputSize = html.length;
console.log(`\nOutput size: ${(outputSize / 1024).toFixed(1)} KB`);
console.log(`Delta: ${((outputSize - inputSize) / 1024).toFixed(1)} KB`);
console.log('Written:', OUTPUT);
