'use strict';

// sRGB <-> OKLCH conversion (Björn Ottosson, https://bottosson.github.io/posts/oklab/),
// used only by scripts/fix-theme-contrast.js (FEAT-008 MIG-B6-29 phase 3, "paso 8") to
// search for the minimal-lightness-change color that clears a WCAG contrast requirement
// while preserving hue and chroma. This is NOT part of postcss-uxdsl's shipped runtime:
// the compiler itself never converts colors to OKLCH, only composes/measures colors that
// are already hex/rgb/hsl (see packages/postcss-uxdsl/src/ds-runtime/contrast.ts).

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function parseHexToRgb01(hex) {
  const h = String(hex).trim().replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`Not a plain 3/6-digit hex color: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

function rgb01ToHex({ r, g, b }) {
  const toByte = (c) => Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

function linearRgbToOklab({ r, g, b }) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function oklabToLinearRgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function hexToOklch(hex) {
  const { r, g, b } = parseHexToRgb01(hex);
  const lab = linearRgbToOklab({ r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) });
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: lab.L, C, H };
}

function oklchToLinearRgb({ L, C, H }) {
  const hr = (H * Math.PI) / 180;
  return oklabToLinearRgb({ L, a: C * Math.cos(hr), b: C * Math.sin(hr) });
}

const GAMUT_EPS = 1e-4;
function inGamut({ r, g, b }) {
  return r >= -GAMUT_EPS && r <= 1 + GAMUT_EPS && g >= -GAMUT_EPS && g <= 1 + GAMUT_EPS && b >= -GAMUT_EPS && b <= 1 + GAMUT_EPS;
}

/**
 * Converts an OKLCH triple to a hex color that is guaranteed to be inside the sRGB
 * gamut. If {L, C, H} itself falls outside sRGB, chroma is reduced in fixed, small,
 * deterministic steps (at the same L and H) until it re-enters the gamut — hue and
 * lightness are never touched to force it in, and channels are never clipped without
 * first trying to desaturate, which would distort the hue unpredictably. Returns how
 * much chroma had to be given up so the caller can disclose the deviation.
 */
function toHexInGamut({ L, C, H }, chromaStep = 0.001) {
  let c = C;
  let candidate = oklchToLinearRgb({ L, C: c, H });
  while (!inGamut(candidate) && c > 0) {
    c = Math.max(0, c - chromaStep);
    candidate = oklchToLinearRgb({ L, C: c, H });
  }
  const clamped = { r: clamp(candidate.r, 0, 1), g: clamp(candidate.g, 0, 1), b: clamp(candidate.b, 0, 1) };
  const srgb = { r: linearToSrgb(clamped.r), g: linearToSrgb(clamped.g), b: linearToSrgb(clamped.b) };
  return { hex: rgb01ToHex(srgb), chromaGivenUp: C - c, stillOutOfGamut: !inGamut(candidate) };
}

module.exports = {
  clamp,
  srgbToLinear,
  linearToSrgb,
  parseHexToRgb01,
  rgb01ToHex,
  linearRgbToOklab,
  oklabToLinearRgb,
  hexToOklch,
  oklchToLinearRgb,
  inGamut,
  toHexInGamut,
};
