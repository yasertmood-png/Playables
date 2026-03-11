const { minify } = require('html-minifier-terser');
const fs = require('fs');
const path = require('path');

const arg = process.argv[2];
if (!arg) { console.error('Usage: node _minify.js <filename.html>'); process.exit(1); }
const inputFile = path.join(__dirname, arg);
const outputFile = path.join(__dirname, arg.replace(/\.html$/i, '.min.html'));

const html = fs.readFileSync(inputFile, 'utf8');
console.log(`Input size: ${(html.length / 1024).toFixed(1)} KB`);

minify(html, {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: {
    compress: {
      passes: 2,
      drop_console: false,
    },
    mangle: true,
    format: {
      comments: false,
    },
  },
}).then(minified => {
  fs.writeFileSync(outputFile, minified, 'utf8');
  console.log(`Output size: ${(minified.length / 1024).toFixed(1)} KB`);
  console.log(`Reduction: ${((1 - minified.length / html.length) * 100).toFixed(1)}%`);
  console.log(`Done: ${outputFile}`);
}).catch(err => {
  console.error('Minification failed:', err.message);
  process.exit(1);
});
