# Colour Palette Extractor

A single-file colour palette extractor. **The only file you need is
`colour-palette-extractor.html`** — download it, double-click it, and it opens
in your browser. 

Drop (or paste, or browse for) an image and it shows the 8 most dominant
colours as swatches with hex codes. 
Click a swatch to copy its code, or click **Copy all 8 codes**. 

## Development

- `palette.js` — the colour engine (filtering, deterministic k-means,
  hex conversion). Pure functions, no dependencies; runs in Node and the
  browser.
- `palette.test.js` — unit tests. Run with `node --test`.
- `template.html` — the page, with a `//__PALETTE_CORE__` marker where the
  engine is injected.
- `build.js` — produces `colour-palette-extractor.html` from the template
  and engine. Run with `node build.js` after editing either source file.
- `test-fixtures/` — BMP images with exactly known colours for end-to-end
  checks, plus the script that generates them.

Requires only Node.js (any recent version) to test and build.
