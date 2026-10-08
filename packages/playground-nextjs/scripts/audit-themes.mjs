import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Audits the playground's four named themes.
//
// MIG-B7-17 (FEAT-009), phase B (5): this script used to carry its own responsive
// parser, its own px conversion, its own hex parser and its own WCAG luminance, and
// checked 11 palette `main`/`contrast` pairs with them. That is exactly what AGENTS.md
// asks nobody to do ("Do not add separate parsers"), and it gave a narrower verdict than
// the shared gate: PASSED while `checkThemeContrast` reported hundreds of failing pairs
// for the same themes (MIG-B7-09). Everything below now comes from the engine:
//
//   - contrast: `checkThemeContrast(resolveTheme(theme), { exceptions })`, the same call
//     and the same shipped exceptions as `uxdsl theme --contrast`. It is the verdict: the
//     script exits 1 while the gate fails, as the CLI does.
//   - typography: `resolveTypographyRole` (a role's fields over `default`, exactly as
//     `@ds-typo` emits them) and `resolveResponsiveValue` (the value a breakpoint
//     receives, persistence included). Sizes are compared only when they resolve to a
//     `space(n)` token or a plain `px`/`rem` length; anything else is reported as not
//     comparable instead of being guessed.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { checkThemeContrast, resolveTheme } = require('uxdsl/theme');
const { resolveTypographyRole } = require('uxdsl/engine');
const { resolveResponsiveValue } = require('uxdsl/language');
const contrastExceptions = require('uxdsl/theme/base.contrast-exceptions.json');
const { themes } = require(path.join(ROOT, 'themes.js'));

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

/** A length a person can compare, in px, or null. `space(n)` is looked up in the theme's
 * own Spacing (never assumed to be a pixel count); `1rem` is taken as 16px. */
function comparablePx(value, theme, depth = 0) {
  const text = String(value ?? '').trim();
  const space = /^space\(\s*['"]?([\w-]+)['"]?\s*\)$/.exec(text);
  if (space && depth < 4) return comparablePx(theme.spacing?.[space[1]], theme, depth + 1);
  const length = /^(-?\d+(?:\.\d+)?)(px|rem)$/.exec(text);
  if (!length) return null;
  return Number(length[1]) * (length[2] === 'rem' ? 16 : 1);
}

function auditTypography(theme) {
  const warnings = [];
  const details = theme.typography_details || {};
  const bps = theme.breakpoints;
  const names = Object.keys(bps).sort((a, b) => bps[a] - bps[b]);
  const sizes = {};
  for (const role of Object.keys(details)) {
    const style = resolveTypographyRole(details, role);
    if (!style) continue;
    sizes[role] = {};
    for (const bp of names) {
      if (style.fontSize) {
        const resolved = resolveResponsiveValue(style.fontSize, bp, bps);
        const px = comparablePx(resolved, theme);
        if (px === null) warnings.push(`typography: ${role}.fontSize at ${bp} is not a comparable length (${resolved})`);
        sizes[role][bp] = px;
      }
      if (style.lineHeight) {
        const resolved = resolveResponsiveValue(style.lineHeight, bp, bps);
        const n = Number(resolved);
        if (!Number.isFinite(n)) warnings.push(`typography: ${role}.lineHeight at ${bp} is not unitless (${resolved})`);
        else if (n < 1.05 || n > 2.2) warnings.push(`typography: ${role}.lineHeight at ${bp} looks odd (${n})`);
      }
    }
    const seq = names.map((bp) => sizes[role][bp]).filter((n) => typeof n === 'number');
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] < seq[i - 1]) { warnings.push(`typography: ${role}.fontSize decreases across breakpoints (${seq[i - 1]}px -> ${seq[i]}px)`); break; }
    }
  }
  for (const bp of names) {
    const row = HEADINGS.map((h) => ({ h, px: sizes[h]?.[bp] }));
    if (!row.every((r) => typeof r.px === 'number')) continue;
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i].px < row[i + 1].px) { warnings.push(`typography: hierarchy inverted at ${bp}: ${row[i].h} (${row[i].px}px) < ${row[i + 1].h} (${row[i + 1].px}px)`); break; }
    }
  }
  return warnings;
}

function summarize(report) {
  const groups = new Map();
  for (const f of report.failures) {
    const key = `${f.mode} ${f.family} ${f.pair}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => `${key}: ${n}`);
}

export function contrastVerdict(reports) {
  const failures = reports.reduce((sum, report) => sum + report.failures.length, 0);
  const excepted = reports.reduce((sum, report) => sum + (report.excepted ? report.excepted.length : 0), 0);
  const exceptionIssues = reports.reduce((sum, report) => sum + report.exceptionIssues.length, 0);
  return { failures, excepted, exceptionIssues, passed: reports.every((report) => report.passed) };
}

function main() {
  const reports = [];
  for (const name of Object.keys(themes)) {
    const theme = themes[name];
    const report = checkThemeContrast(resolveTheme(theme), { exceptions: contrastExceptions });
    reports.push(report);
    console.log(`\n=== Theme: ${name} ===`);
    console.log(`Contrast (checkThemeContrast, shipped exceptions applied): ${report.passed ? 'PASS' : 'FAIL'} — ${report.checked.length} pairs checked, ${report.failures.length} failing, ${report.excepted.length} excepted (failing, covered by an exception, not counted as passing).`);
    for (const line of summarize(report)) console.log(`  - ${line}`);
    for (const exception of report.exceptions) console.log(`  - exception ${exception.id} (${exception.kind}): ${exception.matched ? `covers ${exception.covered}` : 'matches nothing'}`);
    for (const issue of report.exceptionIssues) console.log(`  - exception issue: ${issue}`);
    const warnings = auditTypography(theme);
    if (warnings.length) {
      console.log('Typography warnings:');
      for (const w of warnings) console.log(`  - ${w}`);
    } else {
      console.log('Typography: sizes grow across breakpoints and headings keep their order.');
    }
  }
  const verdict = contrastVerdict(reports);
  if (!verdict.passed) {
    console.error(`\nTheme audit FAILED: ${verdict.failures} failing contrast pair(s), ${verdict.exceptionIssues} exception issue(s) across these themes (${verdict.excepted} more excepted). Details per pair: \`uxdsl theme --contrast\`.`);
    process.exitCode = 1;
  } else {
    console.log(`\nTheme audit PASSED: 0 failing contrast pairs; ${verdict.excepted} excepted pair(s) across these themes are listed by \`uxdsl theme --contrast\`, not counted as passing.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
