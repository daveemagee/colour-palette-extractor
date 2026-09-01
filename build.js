// Injects palette.js into template.html to produce the single-file app.
// Usage: node build.js
const fs = require('fs');
const path = require('path');

const here = __dirname;
const template = fs.readFileSync(path.join(here, 'template.html'), 'utf8');
const core = fs.readFileSync(path.join(here, 'palette.js'), 'utf8');

const MARKER = '//__PALETTE_CORE__';
if (!template.includes(MARKER)) {
  console.error('build failed: marker not found in template.html');
  process.exit(1);
}

const out = template.split(MARKER).join(core);
const outPath = path.join(here, 'colour-palette-extractor.html');
fs.writeFileSync(outPath, out);
console.log('built ' + outPath + ' (' + out.length + ' bytes)');
