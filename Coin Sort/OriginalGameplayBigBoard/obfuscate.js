const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');

const INPUT  = 'c:/MoodGames/Playable Ads/Playables/Coin Sort/Original Gameplay/OriginalGameplay-60Sec-min.html';
const OUTPUT = 'c:/MoodGames/Playable Ads/Playables/Coin Sort/Original Gameplay/OriginalGameplay-60Sec-obf.html';

const html = fs.readFileSync(INPUT, 'utf8');

const SCRIPT_RE = /(<script(?:[^>]*)>)([\s\S]*?)(<\/script>)/g;

let scriptIndex = 0;
const result = html.replace(SCRIPT_RE, (full, open, code, close) => {
  scriptIndex++;

  // Only obfuscate the game code (script 4); leave libraries intact
  if (scriptIndex !== 4) return full;

  console.log(`Obfuscating script ${scriptIndex} (${code.length} chars)...`);

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

  console.log(`Done — obfuscated size: ${obfuscated.length} chars`);
  return open + obfuscated + close;
});

fs.writeFileSync(OUTPUT, result, 'utf8');
console.log(`\nOutput written to: ${OUTPUT}`);

const inSize  = fs.statSync(INPUT).size;
const outSize = fs.statSync(OUTPUT).size;
console.log(`Input:  ${(inSize  / 1024).toFixed(1)} KB`);
console.log(`Output: ${(outSize / 1024).toFixed(1)} KB`);
