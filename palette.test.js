const test = require('node:test');
const assert = require('node:assert/strict');
const {
  rgbToHex,
  lightness,
  filterPixels,
  kmeans,
  extractPalette,
} = require('./palette.js');

// Flat RGBA byte array from a list of [r, g, b, a] pixels.
function rgba(...pixels) {
  return new Uint8ClampedArray(pixels.flat());
}

test('rgbToHex formats a colour as uppercase #RRGGBB', () => {
  assert.equal(rgbToHex(232, 161, 60), '#E8A13C');
});

test('rgbToHex pads single-digit channels with zeros', () => {
  assert.equal(rgbToHex(0, 7, 15), '#00070F');
});

test('rgbToHex rounds fractional channel values', () => {
  assert.equal(rgbToHex(127.6, 0, 255), '#8000FF');
});

test('lightness of black is 0 and white is 1', () => {
  assert.equal(lightness(0, 0, 0), 0);
  assert.equal(lightness(255, 255, 255), 1);
});

test('lightness of mid grey is about 0.5', () => {
  const l = lightness(128, 128, 128);
  assert.ok(Math.abs(l - 0.5) < 0.01, `expected ~0.5, got ${l}`);
});

test('saturated pure colours are mid-lightness, not shadows', () => {
  // HSL lightness: a vivid pure blue must survive a 20% shadow cutoff.
  assert.equal(lightness(0, 0, 255), 0.5);
  assert.equal(lightness(255, 0, 0), 0.5);
});

test('filterPixels keeps mid-lightness pixels and drops shadows and highlights', () => {
  const data = rgba(
    [232, 161, 60, 255], // mid orange, kept
    [20, 20, 20, 255],   // near-black, dropped by 20% shadow cutoff
    [250, 250, 250, 255] // near-white, dropped by 85% highlight cutoff
  );
  const kept = filterPixels(data, { shadow: 0.2, highlight: 0.85 });
  assert.deepEqual(kept, [[232, 161, 60]]);
});

test('filterPixels drops transparent pixels regardless of colour', () => {
  const data = rgba([255, 0, 0, 0], [255, 0, 0, 255]);
  const kept = filterPixels(data, { shadow: 0.2, highlight: 0.85 });
  assert.deepEqual(kept, [[255, 0, 0]]);
});

function repeat(pixel, n) {
  return Array.from({ length: n }, () => pixel.slice());
}

test('kmeans recovers exact block colours, most dominant first', () => {
  const pixels = [
    ...repeat([40, 200, 40], 3),
    ...repeat([200, 40, 40], 5),
    ...repeat([40, 40, 200], 2),
  ];
  assert.deepEqual(kmeans(pixels, 3), [
    { r: 200, g: 40, b: 40, count: 5 },
    { r: 40, g: 200, b: 40, count: 3 },
    { r: 40, g: 40, b: 200, count: 2 },
  ]);
});

test('kmeans is deterministic across runs', () => {
  const pixels = [];
  // 40 pseudo-random but fixed colours
  for (let i = 0; i < 40; i++) {
    pixels.push([(i * 97) % 256, (i * 53) % 256, (i * 211) % 256]);
  }
  assert.deepEqual(kmeans(pixels, 8), kmeans(pixels, 8));
});

test('kmeans returns only as many clusters as there are distinct colours', () => {
  const pixels = [...repeat([10, 20, 30], 4), ...repeat([200, 100, 50], 4)];
  const clusters = kmeans(pixels, 8);
  assert.equal(clusters.length, 2);
});

test('kmeans returns k clusters covering every pixel when colours abound', () => {
  const pixels = [];
  for (let i = 0; i < 200; i++) {
    pixels.push([(i * 97) % 256, (i * 53) % 256, (i * 211) % 256]);
  }
  const clusters = kmeans(pixels, 8);
  assert.equal(clusters.length, 8);
  const total = clusters.reduce((sum, c) => sum + c.count, 0);
  assert.equal(total, 200);
});

test('filterPixels keeps everything opaque when thresholds are 0 and 1', () => {
  const data = rgba([0, 0, 0, 255], [255, 255, 255, 255], [128, 40, 200, 255]);
  const kept = filterPixels(data, { shadow: 0, highlight: 1 });
  assert.equal(kept.length, 3);
});

// ImageData-like object from [r, g, b] pixels (all fully opaque).
function imageDataOf(pixels) {
  return { data: rgba(...pixels.map((p) => [...p, 255])) };
}

test('extractPalette returns the 8 block colours of an 8-colour image, dominant first', () => {
  const blocks = [
    [200, 60, 60], [60, 200, 60], [60, 60, 200], [200, 200, 60],
    [200, 60, 200], [60, 200, 200], [150, 100, 60], [100, 60, 150],
  ];
  // Block i gets 20 - i pixels so dominance order matches block order.
  const pixels = blocks.flatMap((b, i) => repeat(b, 20 - i));
  const result = extractPalette(imageDataOf(pixels));
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.colors.map((c) => c.hex),
    ['#C83C3C', '#3CC83C', '#3C3CC8', '#C8C83C',
     '#C83CC8', '#3CC8C8', '#96643C', '#643C96']
  );
});

test('extractPalette excludes shadows and highlights by default', () => {
  const pixels = [
    ...repeat([232, 161, 60], 4), // mid orange
    ...repeat([10, 10, 10], 4),   // deep shadow
    ...repeat([250, 250, 250], 4) // blown highlight
  ];
  const result = extractPalette(imageDataOf(pixels));
  assert.equal(result.ok, true);
  assert.deepEqual(result.colors.map((c) => c.hex), ['#E8A13C']);
});

test('extractPalette reports failure when no pixels survive the thresholds', () => {
  const result = extractPalette(imageDataOf(repeat([5, 5, 5], 10)));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-pixels');
});

test('extractPalette respects shadow, highlight and count options', () => {
  const pixels = [
    ...repeat([10, 10, 10], 3),
    ...repeat([200, 60, 60], 2),
    ...repeat([60, 200, 60], 1),
  ];
  const result = extractPalette(imageDataOf(pixels), {
    shadow: 0,
    highlight: 1,
    count: 2,
  });
  assert.equal(result.colors.length, 2);
  assert.equal(result.colors[0].hex, '#0A0A0A');
});

test('extractPalette reports each colour\'s share of kept pixels', () => {
  const pixels = [...repeat([200, 60, 60], 3), ...repeat([60, 60, 200], 1)];
  const result = extractPalette(imageDataOf(pixels));
  assert.equal(result.colors[0].share, 0.75);
  assert.equal(result.colors[1].share, 0.25);
});
