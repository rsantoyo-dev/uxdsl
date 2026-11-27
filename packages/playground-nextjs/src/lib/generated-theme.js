// What "Name a theme" on the home page does with the answer of a language model before the
// page sees it. The model writes fonts and colors; it does not know this site's Spacing scale,
// its breakpoints, which fields a Typography role emits, or which pairs of colors end up on top
// of each other. So its answer is never applied as written: it is read as a proposal, and this
// file turns it into an override that
//
//   1. changes values only (applyTheme can apply it to a running page: `checkPatch` says so),
//   2. keeps the site's layout: Spacing, Density, breakpoints and the type scale are not the
//      model's to change, so they never enter the override, and
//   3. passes `checkThemeContrast`, in both modes: every color is moved in lightness only
//      (OKLCH, same hue and chroma) until the pairs the roles draw are readable.
//
// `sanitizeGeneratedTheme(answer)` is the whole of it: `{ ok: true, name, theme }`, or
// `{ ok: false, reason }` when the answer has no color to work with (the route asks again).
//
// Plain JS so scripts/test-generated-theme.cjs can test it with node:test, against answers the
// model really gave (scripts/fixtures/generated-themes).

const { deepMergeTheme } = require('uxdsl/theme');
const { foundationBlocks, resolveExpression, parseLiteralColor, relativeLuminance, contrastRatio } = require('uxdsl/engine');
const { baseTheme } = require('../../themes');
const { checkPatch } = require('./theme-patch');

// ---------------------------------------------------------------------------------------
// Fonts the model may name: Google Fonts families, with the weights each one really has.
// A css2 request for a family that does not exist, or for none of its weights, is a 400 and
// the @import is lost, so a family outside this table is dropped and weights are intersected.
// ---------------------------------------------------------------------------------------

const range = (from, to) => Array.from({ length: (to - from) / 100 + 1 }, (_, index) => from + index * 100);
const FONTS = {
  Inter: ['sans-serif', range(100, 900)],
  Roboto: ['sans-serif', range(100, 900)],
  Poppins: ['sans-serif', range(100, 900)],
  'Open Sans': ['sans-serif', range(300, 800)],
  Montserrat: ['sans-serif', range(100, 900)],
  Lato: ['sans-serif', [100, 300, 400, 700, 900]],
  Raleway: ['sans-serif', range(100, 900)],
  'Noto Sans': ['sans-serif', range(100, 900)],
  Oswald: ['sans-serif', range(200, 700)],
  Quicksand: ['sans-serif', range(300, 700)],
  Fredoka: ['sans-serif', range(300, 700)],
  Merriweather: ['serif', range(300, 900)],
  'Playfair Display': ['serif', range(400, 900)],
  Lora: ['serif', range(400, 700)],
  'PT Serif': ['serif', [400, 700]],
  'Roboto Slab': ['serif', range(100, 900)],
  Cinzel: ['serif', range(400, 900)],
  'Cormorant Garamond': ['serif', range(300, 700)],
  'Roboto Mono': ['monospace', range(100, 700)],
  'Source Code Pro': ['monospace', range(200, 900)],
  'JetBrains Mono': ['monospace', range(100, 800)],
  'Fira Code': ['monospace', range(300, 700)],
  'Space Mono': ['monospace', [400, 700]],
  'Dancing Script': ['cursive', range(400, 700)],
  Pacifico: ['cursive', [400]],
  Lobster: ['cursive', [400]],
  'Abril Fatface': ['serif', [400]],
  Righteous: ['sans-serif', [400]],
  'Press Start 2P': ['monospace', [400]],
  Creepster: ['cursive', [400]],
  Rye: ['serif', [400]],
  Spirax: ['cursive', [400]],
  Bangers: ['cursive', [400]],
  'Permanent Marker': ['cursive', [400]],
};
const FONT_NAMES = Object.keys(FONTS);
// One line per family, as the model is told of them: `Lato (sans-serif; 100, 300, 400, 700, 900)`.
const FONT_CATALOG = FONT_NAMES.map((name) => `${name} (${FONTS[name][0]}; ${FONTS[name][1].join(', ')})`);
// A name the model may still write for a family that was renamed.
const FONT_ALIASES = { 'fredoka one': 'Fredoka' };
const FONT_BY_LOWER = Object.fromEntries(FONT_NAMES.map((name) => [name.toLowerCase(), name]));
// At most this many families are imported: text, headings, code.
const MAX_FONT_IMPORTS = 3;

/** The family of the table a font-family list (or an import entry) starts with, or null. */
function knownFont(value) {
  if (typeof value !== 'string') return null;
  const first = value.split(/[,:]/)[0].trim().replace(/^['"]|['"]$/g, '').trim().toLowerCase();
  return FONT_BY_LOWER[FONT_ALIASES[first] ? FONT_ALIASES[first].toLowerCase() : first] || null;
}

/** `'Playfair Display', serif`: a name with a space or a digit-led word is not a CSS identifier. */
function fontStack(name) {
  const written = /^[A-Za-z][A-Za-z-]*$/.test(name) ? name : `'${name}'`;
  return `${written}, ${FONTS[name][0]}`;
}

function nearestWeight(name, weight) {
  return FONTS[name][1].reduce((best, each) => (Math.abs(each - weight) < Math.abs(best - weight) ? each : best));
}

function fontWeightOf(value) {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  return /^[1-9]00$/.test(text) ? Number(text) : null;
}

// ---------------------------------------------------------------------------------------
// Color: sRGB <-> OKLCH (Björn Ottosson, https://bottosson.github.io/posts/oklab/), the same
// conversion scripts/lib/oklch.js used to correct the base theme. Lightness is the only thing
// a repair moves; a color that leaves the sRGB gamut on the way gives up chroma, not hue.
// ---------------------------------------------------------------------------------------

const toLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const fromLinear = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function toOklch({ r, g, b }) {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, C: Math.hypot(A, B), H: Math.atan2(B, A) };
}

function linearOf({ L, C, H }) {
  const A = C * Math.cos(H);
  const B = C * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/** The 8-bit sRGB color at this lightness and hue, with as much of the chroma as sRGB holds. */
function fromOklch({ L, C, H }) {
  const lightness = Math.min(1, Math.max(0, L));
  let linear = linearOf({ L: lightness, C, H });
  if (!inGamut(linear)) {
    let inside = 0;
    let outside = C;
    for (let step = 0; step < 20; step += 1) {
      const middle = (inside + outside) / 2;
      if (inGamut(linearOf({ L: lightness, C: middle, H }))) inside = middle;
      else outside = middle;
    }
    linear = linearOf({ L: lightness, C: inside, H });
  }
  const [r, g, b] = linear.map((c) => Math.round(Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, c))))) * 255));
  return { r, g, b };
}

const hexOf = ({ r, g, b }) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
const luminance = relativeLuminance;
const ratio = contrastRatio;
const withLightness = (color, L) => fromOklch({ ...toOklch(color), L });

/**
 * `color` when it already satisfies `ok`; otherwise the color nearest to it in lightness,
 * moving toward black (`toward` 0) or white (1), that does. `ok` is asked about the 8-bit
 * color that will be written, so a rounding never undoes it. When not even the end satisfies
 * `ok`, the end is returned: the caller chose thresholds for which that does not happen.
 */
function shift(color, toward, ok) {
  if (ok(color)) return color;
  const { L, C, H } = toOklch(color);
  const at = (lightness) => fromOklch({ L: lightness, C, H });
  let failing = L;
  let passing = toward;
  if (!ok(at(passing))) return at(passing);
  for (let step = 0; step < 22; step += 1) {
    const middle = (failing + passing) / 2;
    if (ok(at(middle))) passing = middle;
    else failing = middle;
  }
  return at(passing);
}

// ---------------------------------------------------------------------------------------
// The palette. What each number is for (see checkThemeContrast, which the test runs):
//
//   * text on its background needs 4.5:1, an edge against the page 3:1. Colors are written as
//     8-bit values, so each repair aims a little past its requirement.
//   * `surface.dark` is the edge of a contained Surface (3:1 against the page) and the
//     background a `surface`-toned Button takes on hover (4.5:1 under `surface.contrast`).
//     Both hold only when the text is at least 3 × 4.5 = 13.5:1 from the page, which a page
//     darker than LIGHT_PAGE (light mode) or lighter than DARK_PAGE (dark mode) cannot give.
//   * an accent's `main` and `dark` are text on the page (outlined and flat roles, hover) and
//     backgrounds under its `contrast` (contained roles): past 4.5:1 from the page on the
//     text's side, which is also what leaves white (light mode) or black (dark mode) readable
//     on top of them.
//   * `light` and `dark` are canvas identities, used as a tone on contained roles only:
//     their `contrast` has to be readable on their `main` and on their `dark`.
// ---------------------------------------------------------------------------------------

const TEXT = 4.6;
const EDGE = 3.1;
const PAGE_TEXT = 14.4; // > TEXT × EDGE, so `surface.dark` has room between the page and its text
const LIGHT_PAGE = 0.8; // least relative luminance of the light page
const DARK_PAGE = 0.015; // most relative luminance of the dark page
const PAPER = 1.25; // `surface.light` (cards, panels) stays this close to the page
const APART = 0.04; // least OKLCH lightness between an accent's `main` and `dark`, so hover shows

const FAMILIES = ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error', 'neutral', 'surface', 'light', 'dark'];
const ACCENTS = ['primary', 'secondary', 'tertiary', 'success', 'info', 'warning', 'error', 'neutral'];
const VARIANTS = ['main', 'light', 'dark', 'contrast'];

/** One mode's palette, `{ family: { variant: {r,g,b} } }`, with every pair the roles draw readable. */
function repairMode(input, isDark) {
  const out = {};
  for (const family of FAMILIES) out[family] = { ...input[family] };
  const textEnd = isDark ? 1 : 0; // where text goes to gain contrast against the page
  const pageEnd = isDark ? 0 : 1;

  // The page. A light mode that is dark (or the reverse) is turned over; one that is only too
  // dim is moved as little as it takes.
  const surface = out.surface;
  const pageOk = (c) => (isDark ? luminance(c) <= DARK_PAGE : luminance(c) >= LIGHT_PAGE);
  if (!pageOk(surface.main)) {
    const inverted = isDark ? luminance(surface.main) > 0.25 : luminance(surface.main) < 0.4;
    surface.main = shift(inverted ? withLightness(surface.main, isDark ? 0.17 : 0.97) : surface.main, pageEnd, pageOk);
  }
  const page = surface.main;
  const pastPage = (c) => (isDark ? luminance(c) > luminance(page) : luminance(c) < luminance(page));

  surface.contrast = shift(surface.contrast, textEnd, (c) => pastPage(c) && ratio(c, page) >= PAGE_TEXT);
  const text = surface.contrast;
  surface.dark = shift(surface.dark, textEnd, (c) => pastPage(c) && ratio(c, page) >= EDGE);
  surface.dark = shift(surface.dark, pageEnd, (c) => ratio(text, c) >= TEXT);
  if (ratio(surface.light, page) > PAPER) {
    const { L } = toOklch(page);
    surface.light = withLightness(page, isDark ? L + 0.05 : L > 0.985 ? L - 0.02 : L + 0.025);
  }
  // An accent is drawn as text on the page and on what sits on it: a header, a card, a panel.
  const paper = surface.light;
  const readable = (c) => pastPage(c) && ratio(c, page) >= TEXT && ratio(c, paper) >= TEXT;

  for (const family of ACCENTS) {
    const tone = out[family];
    tone.main = shift(tone.main, textEnd, readable);
    tone.dark = shift(tone.dark, textEnd, readable);
    const mainL = toOklch(tone.main).L;
    if (Math.abs(toOklch(tone.dark).L - mainL) < APART) {
      // Hover has to show. Past `main` on the text's side always stays readable; in dark mode
      // the other side is tried first, because `dark` is expected to be the deeper of the two.
      const deeper = withLightness(tone.main, mainL - 0.08);
      tone.dark = isDark && !readable(deeper) ? shift(withLightness(tone.main, mainL + 0.08), textEnd, readable) : shift(deeper, textEnd, readable);
    }
    tone.contrast = shift(tone.contrast, pageEnd, (c) => ratio(c, tone.main) >= TEXT && ratio(c, tone.dark) >= TEXT);
  }

  for (const family of ['light', 'dark']) {
    const tone = out[family];
    // Black is readable on anything this light, white on anything darker.
    const end = luminance(tone.main) >= 0.18 ? 0 : 1;
    tone.contrast = shift(tone.contrast, end, (c) => ratio(c, tone.main) >= TEXT);
    tone.dark = shift(tone.dark, 1 - end, (c) => ratio(tone.contrast, c) >= TEXT);
  }
  return out;
}

/** The base theme's palette of one mode as colors, resolved through the engine's own blocks. */
function resolvedPalette(theme, isDark) {
  const dark = theme.modes && theme.modes.dark && theme.modes.dark.palette;
  const palette = isDark && dark ? deepMergeTheme(theme.palette || {}, dark) : theme.palette;
  const variables = {};
  for (const block of foundationBlocks({ ...theme, palette, modes: undefined })) {
    for (const [name, value] of block.declarations) if (name.startsWith('--')) variables[name] = value;
  }
  const out = {};
  for (const family of FAMILIES) {
    out[family] = {};
    for (const variant of VARIANTS) {
      const resolved = resolveExpression(`var(--uxdsl__palette__${family}-${variant})`, variables);
      // The base theme defines all of these; a neutral gray keeps a theme that does not usable.
      out[family][variant] = resolved.ok ? { r: Math.round(resolved.color.r), g: Math.round(resolved.color.g), b: Math.round(resolved.color.b) } : { r: 128, g: 128, b: 128 };
    }
  }
  return out;
}

let basePalettes = null;
function basePalette(isDark) {
  if (!basePalettes) basePalettes = { light: resolvedPalette(baseTheme, false), dark: resolvedPalette(baseTheme, true) };
  return basePalettes[isDark ? 'dark' : 'light'];
}

/** An opaque color the model wrote (hex, rgb(), hsl()), or null. */
function colorOf(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  const parsed = parseLiteralColor(value);
  if (!parsed || parsed.a !== 1 || ![parsed.r, parsed.g, parsed.b].every(Number.isFinite)) return null;
  return { r: Math.round(parsed.r), g: Math.round(parsed.g), b: Math.round(parsed.b) };
}

const leaf = (palette, family, variant) => colorOf(palette && typeof palette === 'object' && palette[family] && typeof palette[family] === 'object' ? palette[family][variant] : undefined);

/**
 * Both modes' palettes from what the model wrote: `{ colors, palette, dark }`, where `colors` is
 * how many of its values were usable and the two palettes are complete (11 families × 4
 * variants, hex) and repaired. A dark value the model left out follows its light one, so a
 * family it colored is the same family in both modes; what it did not write at all stays the
 * site's.
 */
function repairPalette(lightAnswer, darkAnswer) {
  let colors = 0;
  const light = {};
  const dark = {};
  for (const family of FAMILIES) {
    light[family] = {};
    dark[family] = {};
    for (const variant of VARIANTS) {
      const inLight = leaf(lightAnswer, family, variant);
      const inDark = leaf(darkAnswer, family, variant);
      colors += (inLight ? 1 : 0) + (inDark ? 1 : 0);
      light[family][variant] = inLight || basePalette(false)[family][variant];
      dark[family][variant] = inDark || inLight || basePalette(true)[family][variant];
    }
  }
  const written = (mode) => Object.fromEntries(Object.entries(mode).map(([family, variants]) => [
    family,
    Object.fromEntries(Object.entries(variants).map(([variant, color]) => [variant, hexOf(color)])),
  ]));
  return { colors, palette: written(repairMode(light, false)), dark: written(repairMode(dark, true)) };
}

// ---------------------------------------------------------------------------------------
// Fonts and Typography. The type scale (sizes, line heights, margins) is the site's: its
// layout is drawn for it, and the model's sizes are written for a Spacing scale that is not
// this one. A role takes the model's family, weight and letter spacing, and only where the
// role exists: a new field or role would change what the compiled CSS emits.
// ---------------------------------------------------------------------------------------

const LETTER_SPACING = /^-?(?:\d+|\d*\.\d+)em$/;
const MONOSPACE_ROLES = new Set(['code', 'pre']);

function letterSpacingOf(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'normal' || text === '0') return 'normal';
  if (!LETTER_SPACING.test(text)) return null;
  const size = parseFloat(text);
  return size >= -0.08 && size <= 0.25 ? text : null;
}

function fontsAndTypography(answer) {
  const families = answer.fonts && typeof answer.fonts === 'object' && answer.fonts.families && typeof answer.fonts.families === 'object' ? answer.fonts.families : {};
  const ui = knownFont(families.ui);
  const code = knownFont(families.code);
  // family -> the weights to import
  const imports = new Map();
  const use = (name, weights) => {
    if (!imports.has(name) && imports.size >= MAX_FONT_IMPORTS) return false;
    const set = imports.get(name) || new Set();
    for (const weight of weights) set.add(nearestWeight(name, weight));
    imports.set(name, set);
    return true;
  };
  // The site's own roles are written in these four weights.
  if (ui) use(ui, [400, 500, 600, 700]);

  const typography = {};
  const roles = answer.typography_details && typeof answer.typography_details === 'object' ? answer.typography_details : {};
  for (const [role, fields] of Object.entries(roles)) {
    if (role === 'default' || !Object.prototype.hasOwnProperty.call(baseTheme.typography_details, role)) continue;
    if (!fields || typeof fields !== 'object') continue;
    const next = {};
    const weight = fontWeightOf(fields.fontWeight);
    // `code` and `pre` stay in the code font, whatever the answer says of them.
    const family = MONOSPACE_ROLES.has(role) ? null : knownFont(fields.fontFamily);
    // A role in the text font needs no family of its own: it follows `fonts.families.ui`.
    const own = family && family !== ui && use(family, [weight || 400]) ? family : null;
    if (own) next.fontFamily = fontStack(own);
    // The weight is one its family has, and one that is imported: a missing weight is drawn
    // as the nearest one loaded, or as a synthetic bold.
    const follows = own || (MONOSPACE_ROLES.has(role) ? code : ui);
    if (weight && follows) {
      use(follows, [weight]);
      next.fontWeight = String(nearestWeight(follows, weight));
    } else if (weight) {
      next.fontWeight = String(weight);
    }
    const spacing = letterSpacingOf(fields.letterSpacing);
    if (spacing) next.letterSpacing = spacing;
    if (Object.keys(next).length) typography[role] = next;
  }
  if (code) use(code, [400]);

  const out = {};
  if (imports.size) {
    out.fonts = {
      google: [...imports].map(([name, weights]) => `${name}:wght@${[...weights].sort((a, b) => a - b).join(';')}`),
      families: { ...(ui ? { ui: fontStack(ui) } : {}), ...(code ? { code: fontStack(code) } : {}) },
    };
    if (!Object.keys(out.fonts.families).length) delete out.fonts.families;
  }
  if (Object.keys(typography).length) out.typography_details = typography;
  return out;
}

// ---------------------------------------------------------------------------------------

function nameOf(value, fallback) {
  const text = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return (text || String(fallback || '').trim() || 'Custom theme').slice(0, 48);
}

/**
 * The model's answer (JSON text or the parsed object) as an override for this site.
 * `{ ok: true, name, theme, dropped }`: `theme` holds `palette` and `modes.dark.palette`
 * always, `fonts` and `typography_details` when the answer had usable ones, and nothing else;
 * `dropped` names what was left out for being refused. `{ ok: false, reason }` when the answer
 * is not a JSON object or has no color in it.
 */
function sanitizeGeneratedTheme(answer, options = {}) {
  let data = answer;
  if (typeof answer === 'string') {
    try {
      // A model that ignores "no markdown" wraps the object in a code fence.
      data = JSON.parse(answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    } catch {
      return { ok: false, reason: 'The answer is not JSON.' };
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'The answer is not a JSON object.' };

  const darkAnswer = data.modes && typeof data.modes === 'object' && data.modes.dark && typeof data.modes.dark === 'object' ? data.modes.dark.palette : undefined;
  const repaired = repairPalette(data.palette, darkAnswer);
  if (!repaired.colors) return { ok: false, reason: 'The answer has no colors.' };

  const colors = { palette: repaired.palette, modes: { dark: { palette: repaired.dark } } };
  const { fonts, typography_details } = fontsAndTypography(data);
  // From everything the answer gave down to its colors alone: the first the runtime accepts.
  const attempts = [
    { theme: { ...(fonts ? { fonts } : {}), ...(typography_details ? { typography_details } : {}), ...colors }, dropped: [] },
    { theme: { ...(fonts ? { fonts } : {}), ...colors }, dropped: ['typography_details'] },
    { theme: colors, dropped: ['fonts', 'typography_details'] },
  ];
  let refusal = '';
  for (const attempt of attempts) {
    const checked = checkPatch(baseTheme, attempt.theme);
    if (checked.ok) return { ok: true, name: nameOf(data.name, options.fallbackName), theme: attempt.theme, dropped: attempt.dropped };
    refusal = checked.message;
  }
  return { ok: false, reason: refusal };
}

module.exports = { sanitizeGeneratedTheme, repairPalette, FONT_NAMES, FONT_CATALOG, FONTS };
