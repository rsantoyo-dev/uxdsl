#!/usr/bin/env node
'use strict';

// compile() on Dart Sass, read in real Chrome: the rendering changes that the
// package CHANGELOG's "Visual changes" and the migration guide ("beta.9 — Sass
// inside compile()", items 1 and 2) describe, each checked on a computed style.
//
//   t1  `.x, #y { .c { … } }`: Dart Sass writes `.x .c, #y .c`, so `.x .c` has
//       its own specificity and loses to `.x .c.d`.
//   t2  `.q::before { & { … } }`: a second `.q::before` rule, which applies.
//   t3  `.a .b { .c & { … } }`: `.c .a .b`, which needs `.c` above `.a`.
//   t4  a partial `@import`ed twice: emitted twice, so its rule applies again
//       at the second `@import` and wins over the rule written between the two.
//   t5  a rule nested after `@ds-button`: it follows the directive's generated
//       state rules and wins a tie with them (here, `:hover`).
//
// Negative control: what a browser gets without each change — the same rules
// as native CSS nesting, the partial emitted once, the rule placed before the
// directive's state rules — must render the other value for every probe, so
// each check can fail.
//
//   node fixtures/mig-b9-13-compile-on-sass/browser.js [--package <dir>]
//
// compile() is the repository build (packages/uxdsl/dist), or the one in
// `--package <dir>` (a directory holding dist/entries/index.js, such as a build
// of another commit). Every check is printed; exit 1 when any fails. Needs
// playwright-core (fixtures/mig02-nextjs-cssmodules) and Chrome (macOS default
// path or UXDSL_CHROME_PATH).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '../..');
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? undefined : process.argv[i + 1]; };
const PACKAGE = path.resolve(arg('package') || path.join(ROOT, 'packages/uxdsl'));
const { compile } = require(path.join(PACKAGE, 'dist/entries/index.js'));
// Measuring instruments, from the repository.
const instrument = createRequire(path.join(ROOT, 'packages/uxdsl/package.json'));
const sass = instrument('sass');
const postcss = instrument('postcss');
const { chromium } = createRequire(path.join(ROOT, 'fixtures/mig02-nextjs-cssmodules/package.json'))('playwright-core');
const CHROME = process.env.UXDSL_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const RED = 'rgb(255, 0, 0)';
const BLUE = 'rgb(0, 0, 255)';
const BLACK = 'rgb(0, 0, 0)';

const NESTING = `.x, #y { .c { color: ${RED}; } }
.x .c.d { color: ${BLUE}; }
.q::before { content: "A"; & { content: "B"; } }
.a .b { .c & { outline-color: ${RED}; } }
`;
const SHARED = `.k { color: ${RED}; }\n`;
const A = `@import "./_shared.uxdsl";\n.k { color: ${BLUE}; }\n`;
const IMPORTS = '@import "./_a.uxdsl";\n@import "./_shared.uxdsl";\n';
const HOVER = `background-color: ${RED};`;
// The two button probes carry the theme (`@uxdsl theme;`): t5 reads the theme's hover background.
const BUTTON = `@uxdsl theme;\n.btn {\n  @ds-button(contained);\n  &:hover { ${HOVER} }\n}\n`;
const PLAIN_BUTTON = '@uxdsl theme;\n.btn {\n  @ds-button(contained);\n}\n';

const PAGE = (css) => `<!doctype html>
<style>p, button { outline: 1px solid ${BLACK}; }</style>
<style>${css}</style>
<div class="x"><p class="c d" id="t1">t1</p></div>
<p class="q" id="t2">t2</p>
<div class="a"><div class="c"><p class="b" id="t3">t3</p></div></div>
<p class="k" id="t4">t4</p>
<button class="btn" id="t5">t5</button>
<i id="hover-bg" style="background-color: var(--uxdsl__button__contained-hover-bg)"></i>`;

const failures = [];
function check(label, actual, expected) {
  const ok = isDeepStrictEqual(actual, expected);
  if (!ok) failures.push(label);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `: ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

function write(dir, files) {
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
}

/** `rule` inserted right after the `.btn` rule, before the directive's generated state rules. */
function beforeStateRules(css, rule) {
  const root = postcss.parse(css);
  const button = root.nodes.find((node) => node.type === 'rule' && node.selector === '.btn');
  if (!button) throw new Error('the @ds-button output has no `.btn` rule');
  root.insertAfter(button, postcss.parse(rule).first);
  return root.toString();
}

async function read(page, css) {
  await page.setContent(PAGE(css));
  const styles = await page.evaluate(() => {
    const style = (id, pseudo) => getComputedStyle(document.getElementById(id), pseudo);
    return {
      t1: style('t1').color,
      t2: style('t2', '::before').content,
      t3: style('t3').outlineColor,
      t4: style('t4').color,
      hoverBg: style('hover-bg').backgroundColor,
    };
  });
  await page.hover('#t5');
  styles.t5 = await page.locator('#t5').evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.mouse.move(0, 0);
  return styles;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uxdsl-compile-rendering-'));
  try {
    write(dir, { 'nesting.uxdsl': NESTING, '_shared.uxdsl': SHARED, '_a.uxdsl': A, 'imports.uxdsl': IMPORTS, 'button.uxdsl': BUTTON, 'plain-button.uxdsl': PLAIN_BUTTON });
    const flat = { theme: {}, includeTheme: false };
    const nesting = (await compile({ entry: path.join(dir, 'nesting.uxdsl') }, flat)).css;
    const imports = (await compile({ entry: path.join(dir, 'imports.uxdsl') }, flat)).css;
    const button = (await compile({ entry: path.join(dir, 'button.uxdsl') }, { theme: {} })).css;
    const plainButton = (await compile({ entry: path.join(dir, 'plain-button.uxdsl') }, { theme: {} })).css;

    console.log(`compile() from ${PACKAGE.startsWith(`${ROOT}${path.sep}`) ? path.relative(ROOT, PACKAGE) : PACKAGE}`);
    // The probes without UXDSL syntax compile to Dart Sass's output.
    check('t1–t3: the nesting probe is Dart Sass\'s output', nesting, sass.compileString(NESTING, { style: 'expanded' }).css);
    const twins = path.join(dir, 'scss');
    fs.mkdirSync(twins);
    write(twins, { '_shared.scss': SHARED, '_a.scss': A.replace('.uxdsl', '.scss'), 'imports.scss': IMPORTS.replace(/\.uxdsl/g, '.scss') });
    check('t4: the import probe is Dart Sass\'s output', imports, sass.compile(path.join(twins, 'imports.scss'), { style: 'expanded', silenceDeprecations: ['import'] }).css);

    const browser = await chromium.launch({ executablePath: CHROME, headless: true });
    try {
      const page = await browser.newPage();
      console.log(`Chrome ${browser.version()}`);
      const after = await read(page, `${nesting}\n${imports}\n${button}`);
      // Native nesting as written, the partial once at its first @import, and the
      // nested rule before the generated state rules.
      const before = await read(page, `${NESTING}\n${SHARED}.k { color: ${BLUE}; }\n${beforeStateRules(plainButton, `.btn:hover { ${HOVER} }`)}`);
      console.log(`  compile():        ${JSON.stringify(after)}`);
      console.log(`  negative control: ${JSON.stringify(before)}`);
      check("t5: the theme's hover background resolves, and it is not the probe's red", [after.hoverBg !== RED, after.hoverBg !== 'rgba(0, 0, 0, 0)'], [true, true]);
      check('t1: `.x .c` loses to `.x .c.d`', after.t1, BLUE);
      check('t2: the `&` nested under `.q::before` applies', after.t2, '"B"');
      check('t3: `.c .a .b` does not match `.a > .c > .b`', after.t3, BLACK);
      check('t4: the second @import of the partial wins over the rule between the two', after.t4, RED);
      check('t5: the rule nested after @ds-button wins the :hover tie', after.t5, RED);
      check('negative control t1: native nesting weighs `.x .c` as `#y .c`', before.t1, RED);
      check('negative control t2: native nesting under a pseudo-element matches nothing', before.t2, '"A"');
      check('negative control t3: native nesting matches a `.c` between `.a` and `.b`', before.t3, RED);
      check('negative control t4: the partial emitted once loses to the rule after it', before.t4, BLUE);
      check('negative control t5: before the state rules, the nested rule loses the tie', before.t5, after.hoverBg);
    } finally {
      await browser.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (failures.length) {
    console.error(`FAIL: ${failures.length} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('PASS: MIG-B9-13: flattened nesting, a partial imported twice and a rule nested after @ds-button render in Chrome as the CHANGELOG and the migration guide say, and the negative control renders the other value for each.');
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
