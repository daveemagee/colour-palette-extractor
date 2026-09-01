// Core colour-extraction logic for the palette extractor.
// Runs in both Node (for tests) and the browser (inlined into the HTML build).
(function (global) {
  'use strict';

  function rgbToHex(r, g, b) {
    const channel = (v) =>
      Math.round(v).toString(16).padStart(2, '0').toUpperCase();
    return '#' + channel(r) + channel(g) + channel(b);
  }

  // HSL lightness (0..1). Chosen over luma so saturated colours (e.g. pure
  // blue) sit at 0.5 and are never discarded by the shadow cutoff.
  function lightness(r, g, b) {
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  }

  // data: flat RGBA byte array (ImageData.data). Returns [r, g, b] triples
  // that survive the shadow/highlight cutoffs (fractions 0..1, inclusive)
  // and are at least half opaque.
  function filterPixels(data, { shadow, highlight }) {
    const kept = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 125) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = lightness(r, g, b);
      if (l < shadow || l > highlight) continue;
      kept.push([r, g, b]);
    }
    return kept;
  }

  // Deterministic PRNG so identical inputs always yield identical palettes.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dist2(p, c) {
    const dr = p[0] - c[0], dg = p[1] - c[1], db = p[2] - c[2];
    return dr * dr + dg * dg + db * db;
  }

  // pixels: array of [r, g, b]. Returns up to k clusters as
  // { r, g, b, count }, largest cluster first. Fully deterministic.
  function kmeans(pixels, k) {
    if (pixels.length === 0) return [];
    const rand = mulberry32(0xc0ffee);

    // k-means++ seeding; d2 tracks each pixel's distance to nearest seed.
    const centroids = [pixels[Math.floor(rand() * pixels.length)].slice()];
    const d2 = new Float64Array(pixels.length).fill(Infinity);
    while (centroids.length < k) {
      const latest = centroids[centroids.length - 1];
      let total = 0;
      for (let i = 0; i < pixels.length; i++) {
        const d = dist2(pixels[i], latest);
        if (d < d2[i]) d2[i] = d;
        total += d2[i];
      }
      if (total === 0) break; // fewer distinct colours than k
      let target = rand() * total;
      let idx = 0;
      for (; idx < pixels.length - 1; idx++) {
        target -= d2[idx];
        if (target <= 0) break;
      }
      centroids.push(pixels[idx].slice());
    }

    const assignment = new Int32Array(pixels.length).fill(-1);
    for (let iter = 0; iter < 30; iter++) {
      let changed = false;
      for (let i = 0; i < pixels.length; i++) {
        let best = 0, bestD = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const d = dist2(pixels[i], centroids[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        if (assignment[i] !== best) { assignment[i] = best; changed = true; }
      }
      if (!changed) break;
      const sums = centroids.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < pixels.length; i++) {
        const s = sums[assignment[i]];
        const p = pixels[i];
        s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      }
      for (let c = 0; c < centroids.length; c++) {
        if (sums[c][3] > 0) {
          centroids[c] = [
            sums[c][0] / sums[c][3],
            sums[c][1] / sums[c][3],
            sums[c][2] / sums[c][3],
          ];
        }
      }
    }

    const counts = new Array(centroids.length).fill(0);
    for (let i = 0; i < pixels.length; i++) counts[assignment[i]]++;

    return centroids
      .map((c, i) => ({
        r: Math.round(c[0]),
        g: Math.round(c[1]),
        b: Math.round(c[2]),
        count: counts[i],
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  const DEFAULTS = { shadow: 0.2, highlight: 0.85, count: 8 };

  // imageData: any object with a flat RGBA .data array (e.g. canvas
  // ImageData). Returns { ok: true, colors: [{ hex, r, g, b, share }] }
  // dominant-first, or { ok: false, reason: 'no-pixels' } when the
  // thresholds leave nothing to work with.
  function extractPalette(imageData, options) {
    const opts = Object.assign({}, DEFAULTS, options);
    const pixels = filterPixels(imageData.data, opts);
    if (pixels.length === 0) {
      return { ok: false, reason: 'no-pixels' };
    }
    const colors = kmeans(pixels, opts.count).map((c) => ({
      hex: rgbToHex(c.r, c.g, c.b),
      r: c.r,
      g: c.g,
      b: c.b,
      share: c.count / pixels.length,
    }));
    return { ok: true, colors };
  }

  const api = { rgbToHex, lightness, filterPixels, kmeans, extractPalette };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.PaletteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
