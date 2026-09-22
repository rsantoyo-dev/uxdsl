// MIG-B6-30 (FEAT-008), phase 3: the editor's batching, tested directly.
//
// The scheduler is the layer that keeps a dragged colour picker from
// generating sixty stylesheets a second, and — more importantly — keeps an
// abandoned edit from landing after the user switched themes. Both are
// asserted here against a controllable frame clock rather than a real one.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deepMergeTheme } = require('postcss-uxdsl/ds-runtime');
const { createThemeScheduler } = require('../src/lib/theme-scheduler');

/** A frame clock the test drives by hand. */
function makeFrames() {
  let next = 1;
  const queued = new Map();
  return {
    requestFrame(cb) { const id = next++; queued.set(id, cb); return id; },
    cancelFrame(id) { queued.delete(id); },
    /** Runs everything queued for "this frame". */
    tick() {
      const callbacks = Array.from(queued.values());
      queued.clear();
      callbacks.forEach((cb) => cb());
    },
    get size() { return queued.size; },
  };
}

function makeScheduler(extra = {}) {
  const applied = [];
  const frames = makeFrames();
  const scheduler = createThemeScheduler({
    apply: (patch) => { applied.push(patch); return { ok: true, override: patch, warnings: [] }; },
    merge: deepMergeTheme,
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    ...extra,
  });
  return { scheduler, frames, applied };
}

test('MIG-B6-30: sixty inputs in one frame produce a single application', () => {
  const { scheduler, frames, applied } = makeScheduler();
  for (let i = 0; i < 60; i++) {
    scheduler.schedule({ palette: { primary: { main: `#0000${String(i % 100).padStart(2, '0')}` } } });
  }
  assert.equal(applied.length, 0, 'nothing is applied before the frame runs');
  frames.tick();
  assert.equal(applied.length, 1, 'sixty patches coalesced into one apply');
  assert.equal(scheduler.applyCount, 1);
  assert.equal(applied[0].palette.primary.main, '#000059', 'the last value wins');
});

test('MIG-B6-30: independent patches in one frame are combined, not overwritten', () => {
  const { scheduler, frames, applied } = makeScheduler();
  scheduler.schedule({ palette: { primary: { main: '#111111' } } });
  scheduler.schedule({ spacing: { 4: '0.8rem' } });
  scheduler.schedule({ palette: { secondary: { main: '#222222' } } });
  frames.tick();

  assert.equal(applied.length, 1);
  assert.equal(applied[0].palette.primary.main, '#111111', 'the first edit survived the later ones');
  assert.equal(applied[0].palette.secondary.main, '#222222');
  assert.equal(applied[0].spacing['4'], '0.8rem');
});

test('MIG-B6-30: cancel drops queued work so an abandoned edit never lands', () => {
  const { scheduler, frames, applied } = makeScheduler();
  scheduler.schedule({ palette: { primary: { main: '#111111' } } });
  scheduler.cancel();
  frames.tick();
  assert.equal(applied.length, 0, 'a cancelled patch must not be applied');
  assert.equal(scheduler.pending, null);
  assert.equal(frames.size, 0, 'and the frame callback was unregistered');

  // The scheduler stays usable afterwards.
  scheduler.schedule({ palette: { primary: { main: '#222222' } } });
  frames.tick();
  assert.equal(applied.length, 1);
  assert.equal(applied[0].palette.primary.main, '#222222');
});

test('MIG-B6-30: a cancel between frames does not carry the old patch into the next one', () => {
  const { scheduler, frames, applied } = makeScheduler();
  scheduler.schedule({ spacing: { 4: '9rem' } });
  scheduler.cancel();
  scheduler.schedule({ spacing: { 5: '1rem' } });
  frames.tick();
  assert.equal(applied.length, 1);
  assert.equal(applied[0].spacing['4'], undefined, 'the cancelled edit is gone, not merged in');
  assert.equal(applied[0].spacing['5'], '1rem');
});

test('MIG-B6-30: flush applies immediately and leaves nothing queued', () => {
  const { scheduler, frames, applied } = makeScheduler();
  scheduler.schedule({ palette: { primary: { main: '#111111' } } });
  const result = scheduler.flush();
  assert.equal(applied.length, 1);
  assert.equal(result.ok, true);
  assert.equal(scheduler.pending, null);
  frames.tick();
  assert.equal(applied.length, 1, 'the frame callback did not apply it a second time');
});

test('MIG-B6-30: without a frame scheduler, patches apply directly instead of being dropped', () => {
  const applied = [];
  const scheduler = createThemeScheduler({
    apply: (patch) => { applied.push(patch); return { ok: true, override: patch, warnings: [] }; },
    merge: deepMergeTheme,
    requestFrame: null,
    cancelFrame: null,
  });
  const result = scheduler.schedule({ palette: { primary: { main: '#111111' } } });
  assert.equal(applied.length, 1, 'no rAF means apply now, not never');
  assert.equal(result.ok, true);
});

test('MIG-B6-30: the result of each application is reported to the caller', () => {
  const seen = [];
  const { scheduler, frames } = makeScheduler({
    apply: () => ({ ok: false, error: new Error('UXD_THEME_STRUCTURE: nope') }),
    onResult: (result) => seen.push(result),
  });
  scheduler.schedule({ breakpoints: { md: 900 } });
  frames.tick();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].ok, false, 'a rejection is surfaced, not swallowed by the batching layer');
});

test('MIG-B6-30: flushing or ticking with nothing queued applies nothing', () => {
  const { scheduler, frames, applied } = makeScheduler();
  assert.equal(scheduler.flush(), undefined);
  frames.tick();
  assert.equal(applied.length, 0);
  assert.equal(scheduler.applyCount, 0);
});
