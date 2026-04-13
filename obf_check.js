(() => {
  // ── State ──────────────────────────────────────────────────────────────
  let fileContent = null;
  let fileName = null;
  let detectionResult = null;
  let processedContent = null;
  let activeWorker = null;
  let baseHTML = null;
  let workingDetection = null;

  // ── DOM ────────────────────────────────────────────────────────────────
  const dropZone      = document.getElementById('drop-zone');
  const fileInput     = document.getElementById('file-input');
  const fileLoaded    = document.getElementById('file-loaded');
  const fiName        = document.getElementById('fi-name');
  const fiSize        = document.getElementById('fi-size');
  const fiClear       = document.getElementById('fi-clear');
  const detectionEl   = document.getElementById('detection');
  const uploadError   = document.getElementById('upload-error');
  const startBtn      = document.getElementById('start-btn');
  const progressSec   = document.getElementById('progress-section');
  const progressFill  = document.getElementById('progress-fill');
  const progressText  = document.getElementById('progress-text');
  const progressPct   = document.getElementById('progress-pct');
  const statusMsg     = document.getElementById('status-msg');
  const processError  = document.getElementById('process-error');
  const resultCard    = document.getElementById('result-card');
  const sizeBefore    = document.getElementById('size-before');
  const sizeAfter     = document.getElementById('size-after');
  const sizeDelta     = document.getElementById('size-delta');
  const downloadBtn   = document.getElementById('download-btn');
  const resetBtn      = document.getElementById('reset-btn');

  // ── Option highlight ───────────────────────────────────────────────────
  document.querySelectorAll('.options').forEach(group => {
    group.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        group.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        if (group.id === 'mode-options') {
          const isMinifyOnly = opt.querySelector('input').value === 'minify-only';
          document.getElementById('pre-minify-section').hidden = isMinifyOnly;
          document.getElementById('strength-section').hidden = isMinifyOnly;
        }
      });
    });
  });
  document.getElementById('pre-minify').addEventListener('change', function() {
    document.getElementById('pre-minify-opt').classList.toggle('selected', this.checked);
  });

  // ── File handling ──────────────────────────────────────────────────────
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
  fiClear.addEventListener('click', clearFile);

  function loadFile(file) {
    if (!file.name.toLowerCase().endsWith('.html')) {
      showErr(uploadError, 'Only .html files are supported.');
      return;
    }
    hideErr(uploadError);
    const reader = new FileReader();
    reader.onload = e => {
      fileContent = e.target.result;
      fileName = file.name;
      fiName.textContent = file.name;
      fiSize.textContent = fmtSize(fileContent.length);
      dropZone.hidden = true;
      fileLoaded.hidden = false;
      detectionResult = analyzeHTML(fileContent);
      renderDetection(detectionResult);
      startBtn.disabled = false;
      resultCard.hidden = true;
      processedContent = null;
    };
    reader.readAsText(file);
  }

  function clearFile() {
    fileContent = fileName = detectionResult = processedContent = null;
    baseHTML = workingDetection = null;
    dropZone.hidden = false;
    fileLoaded.hidden = true;
    fileInput.value = '';
    startBtn.disabled = true;
    progressSec.hidden = true;
    resultCard.hidden = true;
    if (activeWorker) { activeWorker.terminate(); activeWorker = null; }
    hideErr(uploadError); hideErr(processError);
  }

  function showErr(el, msg) { el.textContent = msg; el.hidden = false; }
  function hideErr(el) { el.hidden = true; }

  // ── Section detection ──────────────────────────────────────────────────
  const LIB_SIGS = [
    { re: /three\.js/i,    name: 'Three.js'  },
    { re: /tween\.js/i,    name: 'TWEEN.js'  },
    { re: /\bgsap\b/i,     name: 'GSAP'      },
    { re: /pixi\.js/i,     name: 'Pixi.js'   },
    { re: /stats\.js/i,    name: 'Stats.js'  },
    { re: /matter\.js/i,   name: 'Matter.js' },
    { re: /howler/i,       name: 'Howler'    },
    { re: /phaser/i,       name: 'Phaser'    },
    { re: /cannon\.js/i,   name: 'Cannon.js' },
    { re: /\bspine\b/i,    name: 'Spine'     },
  ];

  function analyzeHTML(html) {
    const re = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
    const scripts = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const full = m[0];
      const openTag = full.match(/<script[^>]*>/i)[0];
      if (/\ssrc\s*=/i.test(openTag)) continue; // skip external scripts
      const content = full.slice(openTag.length, -('<\/script>'.length));
      if (!content.trim()) continue;
      scripts.push({
        openTag,
        content,
        start: m.index,
        end: m.index + full.length,
        info: classifyScript(content),
      });
    }
    const libCount    = scripts.filter(s => s.info.type === 'library').length;
    const gameCount   = scripts.filter(s => s.info.type === 'game').length;
    const totalAssets = scripts.reduce((n, s) => n + s.info.assetCount, 0);
    return { scripts, libCount, gameCount, totalAssets };
  }

  function classifyScript(content) {
    const head = content.slice(0, 2500);
    for (const sig of LIB_SIGS) {
      if (sig.re.test(head)) {
        return { type: 'library', name: sig.name, assetCount: countAssets(content) };
      }
    }
    // Size heuristic: unlabelled scripts > 350 KB are likely bundled libraries
    if (content.length > 350000) {
      return { type: 'library', name: 'Bundled Library', assetCount: countAssets(content) };
    }
    return { type: 'game', name: 'Game Code', assetCount: countAssets(content) };
  }

  function countAssets(content) {
    return (content.match(/"[A-Za-z0-9+/]{2000,}={0,2}"/g) || []).length;
  }

  function renderDetection({ scripts, libCount, gameCount, totalAssets }) {
    detectionEl.innerHTML = '';
    const add = (cls, text) => {
      const b = document.createElement('span');
      b.className = 'det-badge ' + cls;
      b.textContent = text;
      detectionEl.appendChild(b);
    };
    if (libCount)      add('lib',   libCount  + ' librar' + (libCount === 1 ? 'y' : 'ies') + ' detected');
    if (gameCount)     add('game',  gameCount + ' game script' + (gameCount !== 1 ? 's' : ''));
    if (totalAssets)   add('asset', totalAssets + ' embedded asset' + (totalAssets !== 1 ? 's' : ''));
    if (!scripts.length) add('warn', 'No inline scripts found');
  }

  // ── Processing ─────────────────────────────────────────────────────────
  startBtn.addEventListener('click', startProcessing);

  function startProcessing() {
    if (!fileContent || !detectionResult) return;
    hideErr(processError);
    startBtn.disabled = true;
    resultCard.hidden = true;
    progressSec.hidden = false;
    setProgress(0, 'Starting…', true);

    const mode = document.querySelector('input[name="mode"]:checked').value;

    if (mode === 'minify-only') { runMinifyOnly(); return; }

    const strength  = document.querySelector('input[name="strength"]:checked').value;
    const preMinify = document.getElementById('pre-minify').checked;

    // Apply CSS pre-minification first if requested, then re-detect script positions
    if (preMinify) {
      baseHTML = fileContent.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs, css) =>
        '<style' + attrs + '>' + minifyCSS(css) + '<\/style>');
      workingDetection = analyzeHTML(baseHTML);
    } else {
      baseHTML = fileContent;
      workingDetection = detectionResult;
    }

    // Build sections for the worker
    const sections = workingDetection.scripts.map((s, i) => {
      const isLib = s.info.type === 'library';
      const shouldObfuscate = mode === 'all' ? true : !isLib;
      const encodeAssets    = (mode === 'base-assets' || mode === 'all') && !isLib;
      const { cleaned, blobs } = extractBase64(s.content);
      return {
        index: i,
        openTag: s.openTag,
        cleaned,
        blobs,
        shouldObfuscate,
        encodeAssets,
        preMinify: preMinify && !isLib,
        name: s.info.name,
      };
    });

    const obfOptions = buildObfOptions(strength);

    if (activeWorker) activeWorker.terminate();
    activeWorker = spawnWorker();

    activeWorker.onmessage = ({ data: msg }) => {
      switch (msg.type) {
        case 'status':
          setStatus(msg.text);
          break;
        case 'ready':
          setProgress(10, 'Obfuscating…', false);
          activeWorker.postMessage({ type: 'process', sections, obfOptions });
          break;
        case 'progress': {
          const pct = 10 + Math.round((msg.done / msg.total) * 82);
          setProgress(pct, 'Processing: ' + msg.name + '…', false);
          break;
        }
        case 'done':
          setProgress(100, 'Done!', false);
          finalizeOutput(msg.results);
          break;
        case 'error':
          showErr(processError, msg.text);
          startBtn.disabled = false;
          break;
      }
    };

    activeWorker.onerror = err => {
      showErr(processError, 'Worker error: ' + (err.message || err));
      startBtn.disabled = false;
    };

    activeWorker.postMessage({ type: 'init' });
  }

  function finalizeOutput(results) {
    // Reassemble HTML — process in reverse so positions stay valid
    let output = baseHTML;
    const origScripts = workingDetection.scripts;
    [...results].sort((a, b) => b.index - a.index).forEach(r => {
      const orig = origScripts[r.index];
      const newTag = orig.openTag + r.processed + '<\/script>';
      output = output.slice(0, orig.start) + newTag + output.slice(orig.end);
    });
    processedContent = output;

    const before = fileContent.length;
    const after  = output.length;
    sizeBefore.textContent = fmtSize(before);
    sizeAfter.textContent  = fmtSize(after);
    const diff = after - before;
    const pct  = Math.abs(Math.round((diff / before) * 100));
    sizeDelta.textContent = (diff < 0 ? '−' : '+') + pct + '%';
    sizeDelta.className   = 'size-delta ' + (diff < 0 ? 'smaller' : 'larger');

    resultCard.hidden = false;
    startBtn.disabled = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Download ───────────────────────────────────────────────────────────
  downloadBtn.addEventListener('click', () => {
    if (!processedContent) return;
    const outName = fileName.replace(/\.html$/i, '') + '.obf.html';
    const blob = new Blob([processedContent], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = outName; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  resetBtn.addEventListener('click', clearFile);

  // ── Base64 extraction ──────────────────────────────────────────────────
  function extractBase64(code) {
    const blobs = [];
    let idx = 0;
    const cleaned = code.replace(/"([A-Za-z0-9+/]{2000,}={0,2})"/g, (match, b64) => {
      const token = '__ASSET_' + (idx++) + '_PLACEHOLDER__';
      blobs.push({ token, original: match, b64 });
      return '"' + token + '"';
    });
    return { cleaned, blobs };
  }

  // ── Obfuscator config ──────────────────────────────────────────────────
  function buildObfOptions(strength) {
    const base = {
      compact: true,
      controlFlowFlattening: false,
      deadCodeInjection: false,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      renameGlobals: false,
      rotateStringArray: true,
      selfDefending: false,
      splitStrings: false,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false,
      reservedStrings: ['__ASSET_\\d+_PLACEHOLDER__'],
    };
    if (strength !== 'aggressive') return base;
    return {
      ...base,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.4,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.1,
      stringArrayEncoding: ['rc4'],
      stringArrayThreshold: 0.85,
      selfDefending: true,
    };
  }

  // ── Minifiers ──────────────────────────────────────────────────────────
  function minifyCSS(css) {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,>~+])\s*/g, '$1')
      .replace(/;\s*}/g, '}')
      .trim();
  }

  function minifyJS(code) {
    let r = code.replace(/\/\*(?!!)([\s\S]*?)\*\//g, ''); // strip block comments (keep /*!)
    r = r.replace(/\/\/[^\n]*/g, '');                      // strip line comments
    return r.replace(/\s+/g, ' ').trim();
  }

  function runMinifyOnly() {
    setTimeout(() => {
      try {
        let output = fileContent;
        output = output.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi,
          (m, a, css) => '<style' + a + '>' + minifyCSS(css) + '<\/style>');
        output = output.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi,
          (m, a, js) => /\ssrc\s*=/i.test(a) || !js.trim() ? m
            : '<script' + a + '>' + minifyJS(js) + '<\/script>');
        processedContent = output;
        setProgress(100, 'Done!', false);
        const before = fileContent.length, after = output.length;
        sizeBefore.textContent = fmtSize(before);
        sizeAfter.textContent  = fmtSize(after);
        const diff = after - before;
        sizeDelta.textContent = (diff < 0 ? '−' : '+') + Math.abs(Math.round(diff / before * 100)) + '%';
        sizeDelta.className   = 'size-delta ' + (diff < 0 ? 'smaller' : 'larger');
        resultCard.hidden = false;
        startBtn.disabled = false;
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch(err) {
        showErr(processError, 'Minification error: ' + err.message);
        startBtn.disabled = false;
      }
    }, 20);
  }

  // ── Web Worker ─────────────────────────────────────────────────────────
  function spawnWorker() {
    const src = `
const CDN = 'https://cdn.jsdelivr.net/npm/javascript-obfuscator@4/dist/index.browser.js';

self.onmessage = function(e) {
  var msg = e.data;

  if (msg.type === 'init') {
    self.postMessage({ type: 'status', text: 'Loading obfuscator library…' });
    try {
      importScripts(CDN);
      self.postMessage({ type: 'ready' });
    } catch(err) {
      self.postMessage({ type: 'error', text: 'Could not load obfuscator: ' + (err.message || err) });
    }
    return;
  }

  if (msg.type === 'process') {
    var sections   = msg.sections;
    var obfOptions = msg.obfOptions;
    var results    = [];
    var done       = 0;

    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      self.postMessage({ type: 'progress', done: done, total: sections.length, name: sec.name });

      var processed = sec.cleaned;

      if (sec.shouldObfuscate && sec.cleaned.trim().length > 10) {
        try {
          var codeToObf = sec.preMinify ? preMinifyJS(sec.cleaned) : sec.cleaned;
          processed = JavaScriptObfuscator.obfuscate(codeToObf, obfOptions).getObfuscatedCode();
        } catch(err) {
          processed = sec.cleaned;
        }
      }

      // Restore / encode asset blobs
      for (var j = 0; j < sec.blobs.length; j++) {
        var blob = sec.blobs[j];
        var token = '"' + blob.token + '"';
        var replacement = sec.encodeAssets ? splitBlob(blob.b64) : blob.original;
        processed = processed.split(token).join(replacement);
      }

      results.push({ index: sec.index, processed: processed });
      done++;
    }

    self.postMessage({ type: 'done', results: results });
  }
};

function splitBlob(b64) {
  var SIZE = 8192;
  if (b64.length <= SIZE) return '"' + b64 + '"';
  var chunks = [];
  for (var i = 0; i < b64.length; i += SIZE) {
    chunks.push('"' + b64.slice(i, i + SIZE) + '"');
  }
  return '[' + chunks.join(',') + '].join("")';
}

function preMinifyJS(code) {
  var r = code.replace(/\/\*(?!!)([\s\S]*?)\*\//g, '');
  r = r.replace(/\/\/[^\n]*/g, '');
  return r.replace(/\s+/g, ' ').trim();
}
`;
    const blob = new Blob([src], { type: 'application/javascript' });
    const url  = URL.createObjectURL(blob);
    const w    = new Worker(url);
    URL.revokeObjectURL(url); // safe to revoke after Worker is created
    return w;
  }

  // ── Progress ───────────────────────────────────────────────────────────
  function setProgress(pct, text, indeterminate) {
    progressText.textContent = text;
    progressPct.textContent  = indeterminate ? '' : pct + '%';
    if (indeterminate) {
      progressFill.classList.add('indeterminate');
      progressFill.style.width = '';
    } else {
      progressFill.classList.remove('indeterminate');
      progressFill.style.width = pct + '%';
    }
  }
  function setStatus(text) { statusMsg.textContent = text; }

  // ── Utils ──────────────────────────────────────────────────────────────
  function fmtSize(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

})();