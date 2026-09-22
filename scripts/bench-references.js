#!/usr/bin/env node
'use strict';

// MIG-B6-25 (FEAT-008): the benchmark behind this story's claim that
// reference validation grew quadratically. It compiles one synthetic
// stylesheet twice — once with `references: { mode: 'error' }` and once with
// `mode: 'off'` — so the difference is the validator's own cost and not
// PostCSS parsing, theme generation or directive expansion, all of which run
// identically in both passes.
//
// The numbers are only meaningful next to the machine that produced them, so
// every run prints Node, OS, CPU and the repository commit. Do not copy a
// table from one machine into a claim about another.

const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const pkgDir = path.join(root, 'packages', 'postcss-uxdsl');
const postcss = require(require.resolve('postcss', { paths: [pkgDir] }));
const postcssScss = require(require.resolve('postcss-scss', { paths: [pkgDir] }));
const uxdsl = require(path.join(pkgDir, 'dist', 'index.js'));
const plugin = uxdsl.default || uxdsl;

/** The block from the story, repeated verbatim except for the index. Eleven
 * lines of CSS plus a blank separator, so `blocks * 12` is the line count. */
function block(n) {
  return `.card-${n} {
  padding: density(2);
  margin: xs(space(1)) md(space(2)) lg(space(3));
  color: palette(primary);
  background: palette(surface);
  border-radius: radius(2);
  gap: xs(0.5rem) md(1rem);
  &:hover { color: palette(primary.dark); }
  .title-${n} { @ds-typo(h3); margin: 0; }
  @ds-surface(outlined primary);
}
`;
}

const LINES_PER_BLOCK = 12;

function sourceForLines(lines) {
  const blocks = Math.round(lines / LINES_PER_BLOCK);
  let css = '';
  for (let i = 0; i < blocks; i++) css += block(i);
  return css;
}

async function compileOnce(css, mode) {
  const result = await postcss([plugin({ includeTheme: true, references: { mode } })])
    .process(css, { from: 'bench.uxdsl', syntax: postcssScss });
  // Touching `css` forces the full stringification, so neither pass can look
  // faster merely by leaving work unfinished in PostCSS's lazy result.
  return result.css.length;
}

async function median(css, mode, samples) {
  const times = [];
  for (let i = 0; i < samples; i++) {
    const started = process.hrtime.bigint();
    await compileOnce(css, mode);
    times.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

/** Thousands with a dot, always — `Intl` leaves four-digit numbers ungrouped
 * in es-ES, which printed "3000" next to "12.000" in the same column. */
function group(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function gitCommit() {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

async function main() {
  const sizesArg = process.argv.find(arg => arg.startsWith('--lines='));
  const samplesArg = process.argv.find(arg => arg.startsWith('--samples='));
  const sizes = sizesArg ? sizesArg.slice('--lines='.length).split(',').map(Number) : [3000, 6000, 12000, 24000];
  const samples = samplesArg ? Number(samplesArg.slice('--samples='.length)) : 3;

  const cpu = os.cpus()[0];
  console.log(`commit ${gitCommit()} · node ${process.version} · ${os.type()} ${os.release()} ${os.arch()}`);
  console.log(`cpu    ${cpu ? cpu.model : 'unknown'} · ${os.cpus().length} threads · median of ${samples} samples after 1 warmup`);
  console.log('');

  // One warmup at the smallest size so JIT compilation of the pipeline is not
  // charged to the first measured row.
  await compileOnce(sourceForLines(Math.min(...sizes)), 'error');

  console.log('| Líneas | Con referencias | Sin referencias |');
  console.log('| --- | --- | --- |');
  const rows = [];
  for (const lines of sizes) {
    const css = sourceForLines(lines);
    const withRefs = await median(css, 'error', samples);
    const withoutRefs = await median(css, 'off', samples);
    rows.push({ lines, withRefs, withoutRefs });
    console.log(`| ${group(lines)} | ${group(withRefs)} ms | ${group(withoutRefs)} ms |`);
  }

  console.log('');
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1];
    const current = rows[i];
    const growth = current.withRefs / previous.withRefs;
    console.log(`  ${previous.lines} -> ${current.lines} lines: x${growth.toFixed(2)} with references ` +
      `(x${(current.withoutRefs / previous.withoutRefs).toFixed(2)} without)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
