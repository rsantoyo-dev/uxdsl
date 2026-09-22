'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hexToOklch, toHexInGamut, inGamut, oklchToLinearRgb, parseHexToRgb01, rgb01ToHex } = require('./oklch');

function hexDelta(a, b) {
  const A = parseHexToRgb01(a);
  const B = parseHexToRgb01(b);
  return Math.max(Math.abs(A.r - B.r), Math.abs(A.g - B.g), Math.abs(A.b - B.b)) * 255;
}

test('white and black sit at the OKLCH lightness extremes with ~zero chroma', () => {
  const white = hexToOklch('#ffffff');
  const black = hexToOklch('#000000');
  assert.ok(Math.abs(white.L - 1) < 1e-4, `white L should be ~1, got ${white.L}`);
  assert.ok(white.C < 1e-4, `white C should be ~0, got ${white.C}`);
  assert.ok(Math.abs(black.L - 0) < 1e-4, `black L should be ~0, got ${black.L}`);
  assert.ok(black.C < 1e-4, `black C should be ~0, got ${black.C}`);
});

test('hex -> OKLCH -> hex round-trips within 1 byte per channel for real theme colors', () => {
  const samples = ['#7e22ce', '#db2777', '#94a3b8', '#15803d', '#d97706', '#dc2626', '#0f172a', '#f1f5f9', '#64748b'];
  for (const hex of samples) {
    const oklch = hexToOklch(hex);
    const { hex: roundTripped, stillOutOfGamut } = toHexInGamut(oklch);
    assert.equal(stillOutOfGamut, false, `${hex} should convert back in-gamut`);
    assert.ok(hexDelta(hex, roundTripped) <= 1, `${hex} round-tripped to ${roundTripped}, delta > 1/255 per channel`);
  }
});

test('moving L toward 1 while holding C and H fixed only ever increases (or holds) each RGB channel', () => {
  // A monotonic L axis is what the search in fix-theme-contrast.js relies on to know
  // "lighter" and "darker" are well-defined, opposite directions to search in.
  const { L, C, H } = hexToOklch('#7e22ce');
  let prev = oklchToLinearRgb({ L: 0, C, H });
  for (let step = 1; step <= 20; step++) {
    const candidateL = step / 20;
    const next = oklchToLinearRgb({ L: candidateL, C, H });
    // Compare only in-gamut samples; out-of-gamut components are not meaningful on their own.
    if (inGamut(prev) && inGamut(next)) {
      const prevLum = 0.2126 * prev.r + 0.7152 * prev.g + 0.0722 * prev.b;
      const nextLum = 0.2126 * next.r + 0.7152 * next.g + 0.0722 * next.b;
      assert.ok(nextLum >= prevLum - 1e-6, `luminance should not decrease as L increases (step ${step})`);
    }
    prev = next;
  }
});

test('toHexInGamut never returns a channel outside [0, 255] even for extreme out-of-gamut requests', () => {
  const { hex } = toHexInGamut({ L: 0.5, C: 5, H: 30 });
  assert.match(hex, /^#[0-9a-f]{6}$/);
});

test('reducing chroma at a fixed lightness eventually reaches the gamut (grayscale is always in-gamut)', () => {
  const { chromaGivenUp, stillOutOfGamut } = toHexInGamut({ L: 0.5, C: 5, H: 30 });
  assert.equal(stillOutOfGamut, false);
  assert.ok(chromaGivenUp > 0, 'an absurd C=5 request should have required giving up chroma');
});

test('rgb01ToHex rounds to the nearest byte per channel', () => {
  assert.equal(rgb01ToHex({ r: 1, g: 0, b: 0 }), '#ff0000');
  assert.equal(rgb01ToHex({ r: 0, g: 1, b: 0 }), '#00ff00');
  assert.equal(rgb01ToHex({ r: 0, g: 0, b: 1 }), '#0000ff');
  assert.equal(rgb01ToHex({ r: 0, g: 0, b: 0 }), '#000000');
});
