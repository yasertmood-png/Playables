
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
