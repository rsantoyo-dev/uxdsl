'use strict';
/**
 * FEAT-008, MIG-B6-29 phase 3 ("paso 8" of the story) — corrects a theme's own
 * Palette colors so `checkThemeContrast` passes, following the story's rules:
 *
 *   - Minimal change, in OKLCH: hold hue (H) and chroma (C) fixed, move only
 *     lightness (L), in 0.01 steps, searching both directions and keeping the
 *     smaller valid change. Re-measure on the final rounded hex. If a candidate
 *     falls outside the sRGB gamut, reduce C by the smallest deterministic
 *     amount instead of clipping channels, and report the deviation.
 *   - Touch `dark` and `contrast` first; only touch `main` if no `contrast` in
 *     {white, black} would satisfy every pair that checks against the CURRENT
 *     main — `main` is the family's brand identity.
 *   - Evaluate every pair a family participates in together, not one at a time.
 *   - A combination with no solution is recorded as unsupported with a reason,
 *     never silently oscillated on or force-fit.
 *
 * This script never re-implements color/contrast math beyond OKLCH conversion
 * itself (scripts/lib/oklch.js): every pass/fail decision, and the ratio used to
 * pick a winning candidate, comes from the real, shipped `checkThemeContrast`
 * (postcss-uxdsl/dist/ds-runtime), run against a full clone of the real theme at
 * each candidate — never a hand-derived model of which CSS field reads which
 * palette key. That mapping lives only in postcss-uxdsl's own surfaces/buttons/
 * inputs engines and theme/base.json; this script treats it as an oracle.
 */
const path = require('path');
const { hexToOklch, toHexInGamut } = require('./lib/oklch');
const {
  checkThemeContrast,
  resolveTheme,
  deepMergeTheme,
} = require(path.join(__dirname, '..', 'packages', 'postcss-uxdsl', 'dist', 'ds-runtime'));

const TEXT_MARGIN = 4.6; // story: >= 4.6:1 for text (gate itself requires 4.5:1)
const BORDER_MARGIN = 3.1; // story: >= 3.1:1 for borders (gate itself requires 3:1)
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function marginFor(required) {
  // `required` on a failure/checked entry is always exactly the gate's own
  // threshold (4.5 or 3) — map it to this story's own stricter target margin.
  return required >= 4.5 ? TEXT_MARGIN : BORDER_MARGIN;
}

function setPaletteColor(theme, mode, family, key, hex) {
  const t = clone(theme);
  if (mode === 'light') {
    t.palette = t.palette || {};
    t.palette[family] = t.palette[family] || {};
    t.palette[family][key] = hex;
  } else {
    t.modes = t.modes || {};
    t.modes.dark = t.modes.dark || {};
    t.modes.dark.palette = t.modes.dark.palette || {};
    t.modes.dark.palette[family] = t.modes.dark.palette[family] || {};
    t.modes.dark.palette[family][key] = hex;
  }
  return t;
}

function currentHexOf(theme, mode, family, key) {
  if (mode === 'light') {
    const v = theme.palette && theme.palette[family] && theme.palette[family][key];
    return typeof v === 'string' ? v : null;
  }
  const darkVal = theme.modes && theme.modes.dark && theme.modes.dark.palette && theme.modes.dark.palette[family] && theme.modes.dark.palette[family][key];
  if (typeof darkVal === 'string') return darkVal;
  const lightVal = theme.palette && theme.palette[family] && theme.palette[family][key];
  return typeof lightVal === 'string' ? lightVal : null; // inherited, same as deepMergeTheme's own per-key merge
}

function signatureOf(c) {
  return [c.mode, c.family, c.component, c.tone, c.state, c.pair, c.background, c.breakpoint].join('|');
}

// Same shape, WITHOUT tone, paired with a rounded ratio. Two different palette
// families can legitimately hold the exact same hex (e.g. this theme's own
// `light.dark` and `surface.dark` are both "#e2e8f0") — the real gate's own
// dedup is tone-blind (it keys on resolved color, not on which family produced
// it), so it silently reports only ONE of two identically-broken tones. The
// moment a correction changes one of them, the other stops coinciding and
// starts being reported for the first time — which looks exactly like a brand
// new regression by signature alone, when it was really failing all along.
// Matching on (shape without tone) + ratio catches that case without masking a
// genuine regression, which would essentially never coincidentally match an
// unrelated ratio to this precision.
function looseSiblingKey(c, ratio) {
  return [c.mode, c.family, c.component, c.state, c.pair, c.background, c.breakpoint, Math.round(ratio * 1000)].join('|');
}

function runGate(theme, exceptions) {
  return checkThemeContrast(resolveTheme(theme), exceptions ? { exceptions } : undefined);
}

function ratioMap(report) {
  const m = new Map();
  for (const c of report.checked) m.set(signatureOf(c), c.ratio);
  return m;
}

function failingFor(report, mode) {
  return report.failures.filter((f) => f.mode === mode).map((f) => ({ sig: signatureOf(f), required: marginFor(f.required), gateRequired: f.required, ratio: f.ratio, entry: f }));
}

/** Perturbs (family, key) by a fixed, distinctive amount and reports which of `targetSigs` actually move, reusing an already-computed baseline ratio map instead of recomputing it. */
function sensitiveSigs(theme, exceptions, mode, family, key, targetSigs, baseline) {
  const start = currentHexOf(theme, mode, family, key);
  if (!start || !HEX_RE.test(start)) return [];
  const oklch = hexToOklch(start);
  const probeL = oklch.L > 0.5 ? oklch.L - 0.3 : oklch.L + 0.3;
  const { hex } = toHexInGamut({ L: Math.max(0, Math.min(1, probeL)), C: oklch.C, H: oklch.H });
  const probed = ratioMap(runGate(setPaletteColor(theme, mode, family, key, hex), exceptions));
  return targetSigs.filter((t) => {
    const before = baseline.get(t.sig);
    const after = probed.get(t.sig);
    return before !== undefined && after !== undefined && Math.abs(before - after) > 1e-6;
  });
}

/**
 * Multi-constraint minimal-|deltaL| search. Every candidate is verified by the real
 * gate (never skipped or assumed). Uses exponential bracketing (1,2,4,8,... steps)
 * to find any passing point cheaply, then binary search within the bracket to find
 * the smallest passing step — equivalent to the story's own "0.01 steps, both
 * directions, smallest valid change," just without linearly evaluating every one of
 * up to 100 steps (each evaluation re-runs the full theme-wide gate, ~150ms; a plain
 * linear scan over a handful of families quickly becomes minutes, verified empirically
 * against this same theme before this optimization was added).
 */
function searchFix(theme, exceptions, mode, family, key, targets, allFailingAtStart, { stepSize = 0.01, maxSteps = 100 } = {}) {
  const startHex = currentHexOf(theme, mode, family, key);
  if (!startHex || !HEX_RE.test(startHex)) return null;
  const start = hexToOklch(startHex);
  const preexistingFailureSigs = new Set(allFailingAtStart.map((f) => f.sig));
  const preexistingSiblingKeys = new Set(allFailingAtStart.map((f) => looseSiblingKey(f.entry, f.ratio)));
  const hexAt = (sign, step) => toHexInGamut({ L: start.L + sign * step * stepSize, C: start.C, H: start.H });

  function evaluate(candidateHex) {
    const report = runGate(setPaletteColor(theme, mode, family, key, candidateHex), exceptions);
    const rm = ratioMap(report);
    const targetsOk = targets.every((t) => {
      const r = rm.get(t.sig);
      return r !== undefined && r >= t.required;
    });
    const regressionFree = failingFor(report, mode).every(
      (f) => preexistingFailureSigs.has(f.sig) || preexistingSiblingKeys.has(looseSiblingKey(f.entry, f.ratio))
    );
    return { targetsOk, regressionFree };
  }

  if (evaluate(startHex).targetsOk) return { hex: startHex, deltaL: 0, steps: 0, chromaGivenUp: 0, startHex };

  // Finds the smallest step in [1, cap] where `predicate` first holds, assuming it
  // is monotonic (once true, stays true further in the same direction) — exponential
  // doubling to bracket any transition cheaply, then binary search to pinpoint it.
  function smallestStepWhere(predicate, cap) {
    if (cap < 1) return null;
    let lastFalse = 0;
    let firstTrue = null;
    let step = 1;
    while (step <= cap) {
      if (predicate(step)) {
        firstTrue = step;
        break;
      }
      lastFalse = step;
      if (step === cap) break;
      step = Math.min(step * 2, cap);
    }
    if (firstTrue === null) return null;
    let lo = lastFalse;
    let hi = firstTrue;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (predicate(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  function tryDirection(sign) {
    // The farthest step this direction can ever take without leaving [0, 1] —
    // NOT always `maxSteps` itself, since `start.L` is rarely exactly 0 or 1.
    const cap = Math.min(maxSteps, Math.floor((sign > 0 ? 1 - start.L : start.L) / stepSize));
    if (cap < 1) return null;
    const cache = new Map();
    const at = (step) => {
      if (!cache.has(step)) cache.set(step, evaluate(hexAt(sign, step).hex));
      return cache.get(step);
    };
    // Two separate, independently-monotonic criteria instead of one combined
    // pass/fail: the step where targets first clear the threshold, and the step
    // where a regression first appears elsewhere, can straddle the SAME exponential
    // bracket (e.g. target still unmet at step 8, already regressed by step 16,
    // with a real, narrow, regression-free, target-satisfying window at step 11) —
    // combining them into one boolean before bracketing would miss that window
    // entirely, since both step 8 and step 16 would look identically "false."
    const targetStep = smallestStepWhere((s) => at(s).targetsOk, cap);
    if (targetStep === null) return null;
    const firstRegressionStep = smallestStepWhere((s) => !at(s).regressionFree, cap);
    const regressionFreeCeiling = firstRegressionStep === null ? cap : firstRegressionStep - 1;
    if (targetStep > regressionFreeCeiling) return null; // targets are only satisfiable past where regressions start
    const hi = targetStep;
    const { hex, chromaGivenUp } = hexAt(sign, hi);
    // Belt and suspenders: the two-criterion search assumes monotonicity; confirm
    // the actual chosen candidate really does pass both, combined, for real.
    const finalCheck = at(hi);
    if (!finalCheck.targetsOk || !finalCheck.regressionFree) return null;
    return { hex, deltaL: sign * hi * stepSize, steps: hi, chromaGivenUp };
  }

  const up = tryDirection(1);
  const down = tryDirection(-1);
  if (up && down) return Math.abs(up.deltaL) <= Math.abs(down.deltaL) ? { ...up, startHex } : { ...down, startHex };
  if (up) return { ...up, startHex };
  if (down) return { ...down, startHex };
  return null;
}

/**
 * Last resort before declaring a family's `main` unsupported: `main` is checked
 * both as a BACKGROUND (paired with `contrast` as foreground) and, via an
 * `outlined`/`flat`/`underline` tone, directly AS a foreground against the
 * ambient — two roles a single `contrast` choice can't always reconcile even
 * once `main` itself moves (darkening `main` enough to read as text-on-white can
 * land it exactly where NEITHER white nor black clears the margin against it
 * anymore). This searches `main`'s lightness once per contrast candidate in
 * {current, white, black} and keeps the smallest |deltaL(main)| that, together
 * with SOME contrast choice, satisfies every target with no regressions —
 * still "touch contrast before main stays cheap, main moves only as far as
 * needed," just allowing contrast to be re-chosen at each candidate instead of
 * frozen at its original value.
 */
function searchMainWithContrastChoice(theme, exceptions, mode, family, targets, allFailingAtStart, { stepSize = 0.01, maxSteps = 100 } = {}) {
  const startMain = currentHexOf(theme, mode, family, 'main');
  if (!startMain || !HEX_RE.test(startMain)) return null;
  const start = hexToOklch(startMain);
  const currentContrast = currentHexOf(theme, mode, family, 'contrast');
  const preexistingFailureSigs = new Set(allFailingAtStart.map((f) => f.sig));
  const preexistingSiblingKeys = new Set(allFailingAtStart.map((f) => looseSiblingKey(f.entry, f.ratio)));
  const hexAt = (sign, step) => toHexInGamut({ L: start.L + sign * step * stepSize, C: start.C, H: start.H });

  function evaluate(mainHex, contrastHex) {
    const t = setPaletteColor(setPaletteColor(theme, mode, family, 'main', mainHex), mode, family, 'contrast', contrastHex);
    const report = runGate(t, exceptions);
    const rm = ratioMap(report);
    const targetsOk = targets.every((tg) => {
      const r = rm.get(tg.sig);
      return r !== undefined && r >= tg.required;
    });
    const regressionFree = failingFor(report, mode).every(
      (f) => preexistingFailureSigs.has(f.sig) || preexistingSiblingKeys.has(looseSiblingKey(f.entry, f.ratio))
    );
    return { targetsOk, regressionFree };
  }

  function smallestStepWhere(predicate, cap) {
    if (cap < 1) return null;
    let lastFalse = 0;
    let firstTrue = null;
    let step = 1;
    while (step <= cap) {
      if (predicate(step)) {
        firstTrue = step;
        break;
      }
      lastFalse = step;
      if (step === cap) break;
      step = Math.min(step * 2, cap);
    }
    if (firstTrue === null) return null;
    let lo = lastFalse;
    let hi = firstTrue;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (predicate(mid)) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  let best = null;
  for (const contrastCandidate of [...new Set([currentContrast, '#ffffff', '#000000'])]) {
    for (const sign of [1, -1]) {
      const cap = Math.min(maxSteps, Math.floor((sign > 0 ? 1 - start.L : start.L) / stepSize));
      if (cap < 1) continue;
      const cache = new Map();
      const at = (step) => {
        if (!cache.has(step)) cache.set(step, evaluate(hexAt(sign, step).hex, contrastCandidate));
        return cache.get(step);
      };
      const targetStep = smallestStepWhere((s) => at(s).targetsOk, cap);
      if (targetStep === null) continue;
      const firstRegressionStep = smallestStepWhere((s) => !at(s).regressionFree, cap);
      const ceiling = firstRegressionStep === null ? cap : firstRegressionStep - 1;
      if (targetStep > ceiling) continue;
      const final = at(targetStep);
      if (!final.targetsOk || !final.regressionFree) continue;
      const { hex, chromaGivenUp } = hexAt(sign, targetStep);
      const deltaL = sign * targetStep * stepSize;
      if (!best || Math.abs(deltaL) < Math.abs(best.deltaL)) {
        best = { hex, deltaL, steps: targetStep, chromaGivenUp, startHex: startMain, contrastUsed: contrastCandidate, contrastChanged: contrastCandidate !== currentContrast };
      }
    }
  }
  return best;
}

/**
 * Corrects one (theme, mode) in place (returns a new theme). `table` accumulates
 * one row per successful correction: { mode, family, key, before, after, deltaL,
 * chromaGivenUp }. `unsupported` accumulates combinations the search could not
 * resolve, each with the real, current failing signatures it left open.
 */
function correctMode(theme, exceptions, mode, table, unsupported, log = () => {}) {
  const families = Object.keys(theme.palette || {});
  let failing = failingFor(runGate(theme, exceptions), mode);
  let baseline = null;

  function refreshBaseline() {
    const report = runGate(theme, exceptions);
    failing = failingFor(report, mode);
    baseline = ratioMap(report);
  }
  refreshBaseline();
  log(`[${mode}] starting: ${failing.length} failing pairs`);

  // Phase A: dark and contrast, every family.
  for (const key of ['contrast', 'dark']) {
    for (const family of families) {
      if (failing.length === 0) return theme;
      const targets = sensitiveSigs(theme, exceptions, mode, family, key, failing, baseline);
      if (targets.length === 0) continue;
      log(`[${mode}] ${family}.${key}: ${targets.length} sensitive failing pair(s), searching...`);
      let fix = searchFix(theme, exceptions, mode, family, key, targets, failing);
      let fixedTargets = targets;
      let excludedSelfTone = [];
      if (!fix) {
        // A family used explicitly AS A TONE on itself (e.g. `@ds-button(outlined
        // surface)`) can ask its own `dark`/`contrast` to serve two roles at once:
        // its systemic, ambient-adjacent identity (surface.dark as a neutral
        // border; surface.contrast as the page's own body-text color) AND a
        // readable accent-tone foreground/background — for a family whose systemic
        // role requires staying near-white (surface) or near-black-on-white
        // (a body-text contrast), those two roles can genuinely conflict with no
        // shared solution. Retry excluding that self-tone subset before giving up
        // on this key entirely; the excluded pairs go to `unsupported` for the
        // same kind of justified, disclosed exception this story already ships
        // one of (the `light`-as-text case), not a silent gap.
        excludedSelfTone = targets.filter((t) => t.entry.tone === family);
        const coreTargets = targets.filter((t) => t.entry.tone !== family);
        if (excludedSelfTone.length > 0 && coreTargets.length > 0) {
          fix = searchFix(theme, exceptions, mode, family, key, coreTargets, failing);
          fixedTargets = coreTargets;
        }
      }
      if (fix) {
        theme = setPaletteColor(theme, mode, family, key, fix.hex);
        table.push({ mode, family, key, before: fix.startHex, after: fix.hex, deltaL: fix.deltaL, steps: fix.steps, chromaGivenUp: fix.chromaGivenUp, fixedCount: fixedTargets.length });
        log(`[${mode}] ${family}.${key}: ${fix.startHex} -> ${fix.hex} (deltaL=${fix.deltaL.toFixed(2)}, fixed ${fixedTargets.length}${excludedSelfTone.length ? `, ${excludedSelfTone.length} self-tone pair(s) deferred` : ''})`);
        if (excludedSelfTone.length) unsupported.push({ mode, family, key, reason: 'self-tone conflict', remaining: excludedSelfTone.map((t) => t.entry) });
        refreshBaseline();
      } else {
        log(`[${mode}] ${family}.${key}: no L-only fix found in range, deferring`);
      }
    }
  }

  // Phase B: main, only for families still failing, and only after confirming
  // no white/black contrast already satisfies every pair checked against the
  // CURRENT main (the story's own precondition for ever touching `main`).
  refreshBaseline();
  log(`[${mode}] phase A done: ${failing.length} failing pairs remain, checking 'main' as last resort`);
  for (const family of families) {
    if (failing.length === 0) return theme;
    // `surface.main` is the ambient/page background itself (AMBIENT_BACKGROUND_EXPRESSION
    // in contrast.ts) — it is always sensitive to almost every OTHER family's
    // main-as-text-vs-ambient failure, since moving it changes what "the ambient"
    // even is for every one of those checks. That makes it technically "sensitive"
    // to failures that are really some OTHER family's problem to fix, and moving
    // the page canvas color as a side-effect fix for one accent tone would be a
    // wildly disproportionate, unintended global change. It is treated as a fixed
    // anchor throughout this script; its OWN direct failures (e.g. a low-contrast
    // `surface.dark` border) are fixed in phase A via `dark`/`contrast`, never here.
    if (family === 'surface') continue;
    let targets = sensitiveSigs(theme, exceptions, mode, family, 'main', failing, baseline);
    if (targets.length === 0) continue;
    // `placeholder` is a LITERAL `palette(neutral.dark)` reference in theme/base.json's
    // own inputs.*.base.placeholder — unlike bg/color/border it is never tone-substituted
    // by the compiler, so a toned `contained` input's placeholder is always neutral.dark,
    // regardless of how the tone's own `main` was chosen. That is a real, structural
    // engine gap (documented in this story's evidence as follow-up work), not something
    // any single family's `main` can fix without moving so far it erases the color's own
    // identity — which happened to be mathematically reachable for some themes (e.g. a
    // near-white `success.main` in one playground variant's dark mode) purely because
    // nothing else blocked that specific direction there, not because it is a reasonable
    // fix. Excluded here so the outcome is the same documented, disclosed gap in every
    // theme instead of an inconsistent, identity-erasing "fix" in whichever theme's other
    // constraints happen not to get in the way.
    let excludedPlaceholder = targets.filter((t) => t.entry.pair === 'placeholder');
    if (excludedPlaceholder.length > 0 && excludedPlaceholder.length < targets.length) {
      targets = targets.filter((t) => t.entry.pair !== 'placeholder');
    } else if (excludedPlaceholder.length === targets.length) {
      unsupported.push({ mode, family, key: 'main', reason: 'placeholder not tone-aware (engine limitation)', remaining: excludedPlaceholder.map((t) => t.entry) });
      log(`[${mode}] ${family}.main: all ${excludedPlaceholder.length} remaining pair(s) are the placeholder engine limitation, deferring entirely`);
      continue;
    } else {
      excludedPlaceholder = [];
    }
    let excludedSelfTone = targets.filter((t) => t.entry.tone === family);
    if (excludedSelfTone.length > 0 && excludedSelfTone.length < targets.length) {
      targets = targets.filter((t) => t.entry.tone !== family);
    } else {
      excludedSelfTone = [];
    }
    if (targets.length === 0) {
      if (excludedPlaceholder.length) unsupported.push({ mode, family, key: 'main', reason: 'placeholder not tone-aware (engine limitation)', remaining: excludedPlaceholder.map((t) => t.entry) });
      if (excludedSelfTone.length) unsupported.push({ mode, family, key: 'main', reason: 'self-tone conflict', remaining: excludedSelfTone.map((t) => t.entry) });
      continue;
    }
    log(`[${mode}] ${family}.main: ${targets.length} sensitive failing pair(s) remain after contrast/dark`);

    const preexisting = new Set(failing.map((f) => f.sig));
    const preexistingSiblings = new Set(failing.map((f) => looseSiblingKey(f.entry, f.ratio)));
    let resolvedByContrastAlone = false;
    for (const candidate of ['#ffffff', '#000000']) {
      const currentContrast = currentHexOf(theme, mode, family, 'contrast');
      if (currentContrast === candidate) continue;
      const attempt = setPaletteColor(theme, mode, family, 'contrast', candidate);
      const attemptReport = runGate(attempt, exceptions);
      const rm = ratioMap(attemptReport);
      const noRegressions = failingFor(attemptReport, mode).every(
        (f) => preexisting.has(f.sig) || preexistingSiblings.has(looseSiblingKey(f.entry, f.ratio))
      );
      if (noRegressions && targets.every((t) => (rm.get(t.sig) ?? 0) >= t.required)) {
        table.push({ mode, family, key: 'contrast', before: currentContrast, after: candidate, deltaL: null, steps: null, chromaGivenUp: 0, fixedCount: targets.length, note: 'resolved by choosing white/black contrast instead of moving main' });
        log(`[${mode}] ${family}.main: resolved by setting contrast to ${candidate} instead of moving main`);
        theme = attempt;
        resolvedByContrastAlone = true;
        if (excludedPlaceholder.length) unsupported.push({ mode, family, key: 'main', reason: 'placeholder not tone-aware (engine limitation)', remaining: excludedPlaceholder.map((t) => t.entry) });
        if (excludedSelfTone.length) unsupported.push({ mode, family, key: 'main', reason: 'self-tone conflict', remaining: excludedSelfTone.map((t) => t.entry) });
        refreshBaseline();
        break;
      }
    }
    if (resolvedByContrastAlone) continue;

    let fix = searchFix(theme, exceptions, mode, family, 'main', targets, failing);
    let note = 'main moved: no white/black contrast satisfied every pair against the original main';
    if (!fix) {
      fix = searchMainWithContrastChoice(theme, exceptions, mode, family, targets, failing);
      if (fix) {
        note = fix.contrastChanged
          ? `main moved together with contrast (now ${fix.contrastUsed}): neither could resolve this alone`
          : 'main moved (contrast re-verified, unchanged): no single-key fix existed alone';
      }
    }
    if (fix) {
      theme = setPaletteColor(theme, mode, family, 'main', fix.hex);
      if (fix.contrastUsed && fix.contrastChanged) theme = setPaletteColor(theme, mode, family, 'contrast', fix.contrastUsed);
      table.push({ mode, family, key: 'main', before: fix.startHex, after: fix.hex, deltaL: fix.deltaL, steps: fix.steps, chromaGivenUp: fix.chromaGivenUp, fixedCount: targets.length, note });
      log(`[${mode}] ${family}.main: ${fix.startHex} -> ${fix.hex} (deltaL=${fix.deltaL.toFixed(2)})`);
      if (excludedPlaceholder.length) unsupported.push({ mode, family, key: 'main', reason: 'placeholder not tone-aware (engine limitation)', remaining: excludedPlaceholder.map((t) => t.entry) });
      if (excludedSelfTone.length) unsupported.push({ mode, family, key: 'main', reason: 'self-tone conflict', remaining: excludedSelfTone.map((t) => t.entry) });
      refreshBaseline();
    } else {
      unsupported.push({ mode, family, key: 'main', remaining: [...targets, ...excludedSelfTone, ...excludedPlaceholder].map((t) => t.entry) });
      log(`[${mode}] ${family}.main: UNSUPPORTED, no fix found (${targets.length + excludedSelfTone.length + excludedPlaceholder.length} pairs remain open)`);
    }
  }

  return theme;
}

module.exports = { correctMode, currentHexOf, setPaletteColor, runGate, failingFor, searchFix, searchMainWithContrastChoice, sensitiveSigs, ratioMap, signatureOf, looseSiblingKey };

if (require.main === module) {
  const fs = require('fs');
  const themeName = process.argv[2] || 'base';
  const baseTheme = require(path.join(__dirname, '..', 'packages', 'postcss-uxdsl', 'dist', 'theme', 'base.json'));
  const exceptions = require(path.join(__dirname, '..', 'packages', 'postcss-uxdsl', 'src', 'theme', 'base.contrast-exceptions.json'));
  let theme = themeName === 'base' ? clone(baseTheme) : deepMergeTheme(baseTheme, require(path.join(__dirname, '..', 'packages', 'playground-nextjs', `uxdsl.theme.${themeName}.json`)));

  const log = (msg) => console.error(new Date().toISOString().slice(11, 19), msg);
  const table = [];
  const unsupported = [];
  theme = correctMode(theme, exceptions, 'light', table, unsupported, log);
  if (theme.modes && theme.modes.dark) theme = correctMode(theme, exceptions, 'dark', table, unsupported, log);

  const finalReport = runGate(theme, exceptions);
  console.log(`\n=== ${themeName} ===`);
  console.log('corrections:', table.length, ' unsupported:', unsupported.length);
  console.table(table.map((r) => ({ mode: r.mode, family: r.family, key: r.key, before: r.before, after: r.after, deltaL: r.deltaL == null ? '-' : r.deltaL.toFixed(2), fixedCount: r.fixedCount, note: r.note || '' })));
  if (unsupported.length) console.log('UNSUPPORTED:', JSON.stringify(unsupported, null, 2));
  const outFile = path.join('/tmp', `uxdsl-contrast-fix-${themeName}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ themeName, table, unsupported, finalPassed: finalReport.passed, finalFailureCount: finalReport.failures.length, finalExceptionIssues: finalReport.exceptionIssues, palette: theme.palette, modes: theme.modes }, null, 2));
  console.log('wrote', outFile);
  console.log('final: passed=' + finalReport.passed, 'failures=' + finalReport.failures.length, 'exceptionIssues=' + finalReport.exceptionIssues.length);
  console.log('\nfinal palette:', JSON.stringify(theme.palette, null, 2));
  if (theme.modes && theme.modes.dark) console.log('\nfinal modes.dark.palette:', JSON.stringify(theme.modes.dark.palette, null, 2));
}
