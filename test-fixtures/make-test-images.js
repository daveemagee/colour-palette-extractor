// Writes uncompressed 24-bit BMP test images with exactly known colours.
// Images are <= 320px wide so the app applies no downscaling/resampling.
const fs = require('fs');
const path = require('path');

function writeBmp(file, width, height, pixelAt) {
  const rowBytes = width * 3; // width chosen so rows are 4-byte aligned
  const dataSize = rowBytes * height;
  const buf = Buffer.alloc(54 + dataSize);
  buf.write('BM', 0);
  buf.writeUInt32LE(54 + dataSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22); // positive: bottom-up rows
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(dataSize, 34);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelAt(x, height - 1 - y);
      const off = 54 + y * rowBytes + x * 3;
      buf[off] = b; buf[off + 1] = g; buf[off + 2] = r;
    }
  }
  fs.writeFileSync(file, buf);
  console.log('wrote', file);
}

const here = __dirname;

// 8 vertical blocks, widths 44..16 so dominance order is unambiguous.
const blocks = [
  [200, 60, 60], [60, 200, 60], [60, 60, 200], [200, 200, 60],
  [200, 60, 200], [60, 200, 200], [150, 100, 60], [100, 60, 150],
];
const widths = [44, 40, 36, 32, 28, 24, 20, 16]; // total 240
const edges = [];
let acc = 0;
for (const w of widths) { acc += w; edges.push(acc); }
writeBmp(path.join(here, 'test-8blocks.bmp'), 240, 100, (x) => {
  for (let i = 0; i < edges.length; i++) if (x < edges[i]) return blocks[i];
  return blocks[blocks.length - 1];
});

// Left half deep shadow, right half mid orange.
writeBmp(path.join(here, 'test-shadow.bmp'), 240, 100, (x) =>
  x < 120 ? [10, 10, 10] : [232, 161, 60]
);
