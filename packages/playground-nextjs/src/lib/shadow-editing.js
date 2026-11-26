// The Live theme handler's Shadows tab: a Shadow token as layers, one value per breakpoint.
//
// A shadow is a comma-separated list of layers, and a layer's color can hold commas of its
// own (rgba(0, 0, 0, 0.1), palette(primary.main, 0.3)), so the list is split at the top
// level only, never at every comma. Reading a definition per breakpoint is the library's
// (responsiveEntries, resolveResponsiveValue from uxdsl/language).
//
// Plain JS so scripts/test-shadow-editing.cjs can test it with node:test.

const { splitTop } = require('./edge-editing');

const LENGTH = /^(?:-?\d*\.?\d+(?:px|rem|em)?|space\([^()]*\)|var\([^()]*\))$/i;
const NEW_LAYER = '0 2px 6px color(black, 0.12)';

/** The layers of a shadow, split at the commas outside parentheses. */
function splitLayers(value) {
  const layers = [];
  let depth = 0;
  let current = '';
  for (const char of String(value || '')) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) layers.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) layers.push(current.trim());
  return layers;
}

/**
 * One layer as `{ inset, x, y, blur, spread, color }`, or null when it is not two to four
 * lengths and at most one color in any order (what CSS allows), so the editor shows it as written.
 */
function parseLayer(layer) {
  const words = splitTop(layer);
  let inset = false;
  const lengths = [];
  const others = [];
  for (const word of words) {
    if (word.toLowerCase() === 'inset') {
      if (inset) return null;
      inset = true;
    } else if (LENGTH.test(word)) lengths.push(word);
    else others.push(word);
  }
  if (lengths.length < 2 || lengths.length > 4 || others.length > 1) return null;
  const [x, y, blur = '0', spread = '0'] = lengths;
  return { inset, x, y, blur, spread, color: others[0] || '' };
}

/** A layer back to CSS; a zero spread is left out, as the theme writes it. */
function buildLayer({ inset, x, y, blur, spread, color }) {
  const parts = [inset ? 'inset' : '', x || '0', y || '0', blur || '0'];
  if (spread && spread !== '0' && spread !== '0px') parts.push(spread);
  parts.push(color || '');
  return parts.filter(Boolean).join(' ');
}

/** The layers back to one value; no layer at all is `none`. */
function buildShadow(layers) {
  const built = layers.map(buildLayer).filter(Boolean);
  return built.length ? built.join(', ') : 'none';
}

/** A shadow's layers, or null when one of them is not readable (or the value is `none`: []). */
function layersOf(value) {
  const text = String(value || '').trim();
  if (!text || text.toLowerCase() === 'none') return [];
  const layers = splitLayers(text).map(parseLayer);
  return layers.every(Boolean) ? layers : null;
}

/** A length in pixels for a slider: `0` and `Npx`; anything else is null (shown as text). */
function pxOf(length) {
  const text = String(length || '').trim();
  if (text === '0') return 0;
  const match = /^(-?\d*\.?\d+)px$/i.exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * One value per breakpoint as a definition. A value given at the base breakpoint only is
 * written plain, as the theme writes a shadow that does not change, not as `xs(…)`.
 */
function shadowDefinition(values, order) {
  const given = order.filter((name) => values[name] && String(values[name]).trim());
  if (given.length === 1 && given[0] === order[0]) return String(values[order[0]]).trim();
  return given.map((name) => `${name}(${String(values[name]).trim()})`).join(' ');
}

module.exports = { NEW_LAYER, splitLayers, parseLayer, buildLayer, buildShadow, layersOf, pxOf, shadowDefinition };
