'use strict';

// MIG-B6-14 (FEAT-008): a top-level value function that is neither a
// configured breakpoint nor a known CSS function used to reach compiled CSS
// as invalid, literal text (`padding: 1rem xxl(2rem);`) instead of failing.
// The check only fires when the function is suspicious — co-occurring with
// a real breakpoint function in the same value, or at edit distance 1 from
// a configured breakpoint name — so it never flags an ordinary CSS function
// used on its own.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const postcss = require('postcss');
const plugin = require('../dist');
const { KNOWN_CSS_FUNCTIONS } = require('../dist/language');

const file = path.join(process.cwd(), 'src', 'panel.uxdsl');

async function compile(css, opts = {}) {
  return postcss([plugin({ includeTheme: false, ...opts })]).process(css, { from: file });
}
async function compileFail(css, opts = {}) {
  return compile(css, opts).then(() => null, caught => caught);
}

test('MIG-B6-14: an unconfigured breakpoint-shaped function next to a real one fails as UXD_BREAKPOINT_UNKNOWN', async () => {
  const error = await compileFail('.a { padding: xs(1rem) xxl(2rem); }');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /UXD_BREAKPOINT_UNKNOWN: xxl\(\.\.\.\) is not a configured breakpoint/);
  assert.match(error.message, /configured breakpoints: xs, sm, md, lg, xl\./, 'lists the actually configured breakpoints, not just a fixed default string');
});

test('MIG-B6-14: an xxl breakpoint actually defined in the theme does not fail', async () => {
  const result = await compile('.a { padding: xs(1rem) xxl(2rem); }', { breakpoints: { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280, xxl: 1536 } });
  assert.match(result.css, /1rem/);
});

test('MIG-B6-14: a single typo\'d breakpoint at edit distance 1, alone (no real breakpoint co-occurring), still fails', async () => {
  const error = await compileFail('.a { padding: xd(1rem); }');
  assert.ok(error, 'compilation fails');
  assert.match(error.message, /UXD_BREAKPOINT_UNKNOWN: xd\(\.\.\.\)/);
});

test('MIG-B6-14 (known trap): log() is not misread as a typo of lg, alone or next to a real breakpoint', async () => {
  const alone = await compile('.a { width: log(1, 2); }');
  assert.match(alone.css, /log\(1, ?2\)/);

  const withRealBp = await compile('.a { width: lg(log(1, 2)); }');
  assert.match(withRealBp.css, /log\(1, ?2\)/);
});

test('MIG-B6-14 (positive control): every function in the known-CSS-functions list compiles cleanly next to a real breakpoint', async () => {
  const sampleArgsByFunction = {
    var: '--x', env: 'safe-area-inset-top', attr: 'data-x', url: '"x.png"', 'image-set': '"x.png" 1x',
    'linear-gradient': 'red, blue', 'radial-gradient': 'red, blue', 'conic-gradient': 'red, blue',
    'repeating-linear-gradient': 'red, blue', 'repeating-radial-gradient': 'red, blue', 'repeating-conic-gradient': 'red, blue',
    'fit-content': '10px', repeat: '2, 1fr', minmax: '10px, 1fr', 'cubic-bezier': '0.1, 0.2, 0.3, 0.4', steps: '4',
    rgb: '0, 0, 0', rgba: '0, 0, 0, 1', hsl: '0, 0%, 0%', hsla: '0, 0%, 0%, 1', hwb: '0 0% 0%',
    lab: '29% 39 20', lch: '52% 40 40', oklab: '40% 0.1 0.1', oklch: '40% 0.1 40', 'color-mix': 'in srgb, red, blue', 'light-dark': 'red, blue',
    round: 'up, 1, 2', mod: '10, 3', rem: '10, 3', abs: '1', sign: '1',
    sin: '1', cos: '1', tan: '1', asin: '1', acos: '1', atan: '1', atan2: '1, 1', pow: '2, 3', sqrt: '4', hypot: '3, 4', log: '2', exp: '1',
    translate: '1px', translateX: '1px', translateY: '1px', translateZ: '1px', translate3d: '1px, 1px, 1px',
    scale: '1', scaleX: '1', scaleY: '1', scaleZ: '1', scale3d: '1, 1, 1',
    rotate: '10deg', rotateX: '10deg', rotateY: '10deg', rotateZ: '10deg', rotate3d: '1, 1, 1, 10deg',
    skew: '10deg', skewX: '10deg', skewY: '10deg', matrix: '1, 0, 0, 1, 0, 0', matrix3d: '1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1', perspective: '10px',
    blur: '2px', brightness: '1.2', contrast: '1.2', 'drop-shadow': '2px 2px red', grayscale: '50%', 'hue-rotate': '90deg', invert: '50%', opacity: '50%', saturate: '150%', sepia: '50%',
    anchor: '--x', 'anchor-size': '--x',
    space: '1', density: '1', color: 'primary', palette: 'primary', radius: '1', rounded: '1', border: '1', shadow: '1', elevation: '1',
    calc: '1px + 1px', min: '1px, 2px', max: '1px, 2px', clamp: '1px, 2px, 3px',
  };
  for (const name of KNOWN_CSS_FUNCTIONS) {
    const args = sampleArgsByFunction[name];
    assert.ok(args !== undefined, `add a sample argument list for "${name}" so this control-negative actually exercises it`);
    const css = `.a { width: xs(1px) md(${name}(${args})); }`;
    // references: { mode: 'off' } — this control is only about whether
    // UXD_BREAKPOINT_UNKNOWN false-fires on a known function; palette()/
    // color() token references aren't declared in any theme here, which
    // would otherwise fail for the unrelated reason of an undefined token.
    await assert.doesNotReject(() => compile(css, { references: { mode: 'off' } }), `${name}(${args}) must not be flagged as UXD_BREAKPOINT_UNKNOWN`);
  }
});
