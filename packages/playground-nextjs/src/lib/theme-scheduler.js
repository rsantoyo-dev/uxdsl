// MIG-B6-30 (FEAT-008), phase 3: batching theme patches, outside `applyTheme`.
//
// `applyTheme` is synchronous and deliberately has no requestAnimationFrame
// inside it: the library cannot know what a "frame of input" means for a given
// editor. A colour picker dragged across a gradient can emit sixty patches a
// second, and generating a stylesheet for each one is wasted work — so the
// coalescing lives here, in the layer that knows the input.
//
// Two behaviours matter more than the batching itself:
//
//   * Pending work is cancellable. A patch queued while the user was editing
//     the "custom" theme must not land after they have switched to another
//     theme, reset, or navigated away — it would silently re-apply an edit they
//     abandoned. `cancel()` drops the queue, and every caller that changes the
//     active theme calls it.
//   * Patches accumulate rather than overwrite. Two independent edits inside
//     one frame (a palette colour and a spacing value) must both survive, so
//     they are merged with the same `deepMergeTheme` the runtime uses.
//
// Written as plain JS rather than TypeScript so the behaviour above can be
// exercised by `node --test` directly (see scripts/test-theme-scheduler.cjs);
// the playground has no component-test harness.

/**
 * @param {object} options
 * @param {(patch: object) => any} options.apply      Applies a merged patch. Synchronous.
 * @param {(a: object, b: object) => object} options.merge  Usually `deepMergeTheme`.
 * @param {(cb: () => void) => any} [options.requestFrame]  Defaults to `requestAnimationFrame`.
 * @param {(handle: any) => void} [options.cancelFrame]     Defaults to `cancelAnimationFrame`.
 * @param {(result: any) => void} [options.onResult]        Receives each apply's result.
 */
function createThemeScheduler(options) {
  const { apply, merge, onResult } = options;
  const requestFrame =
    options.requestFrame ||
    (typeof requestAnimationFrame === 'function' ? (cb) => requestAnimationFrame(cb) : null);
  const cancelFrame =
    options.cancelFrame ||
    (typeof cancelAnimationFrame === 'function' ? (handle) => cancelAnimationFrame(handle) : null);

  let pending = null;
  let handle = null;
  let applyCount = 0;

  function run() {
    handle = null;
    const patch = pending;
    pending = null;
    if (!patch) return undefined;
    applyCount += 1;
    const result = apply(patch);
    if (onResult) onResult(result);
    return result;
  }

  return {
    /** Queues a patch. Returns the result immediately when there is no frame
     * scheduler to defer to (a test environment, or SSR), matching the
     * "without rAF, apply directly" rule rather than silently dropping it. */
    schedule(patch) {
      pending = pending && patch ? merge(pending, patch) : (patch || pending);
      if (!requestFrame) return run();
      if (handle === null) handle = requestFrame(run);
      return undefined;
    },
    /** Applies whatever is queued right now. */
    flush() {
      if (handle !== null && cancelFrame) cancelFrame(handle);
      handle = null;
      return run();
    },
    /** Drops queued work without applying it. */
    cancel() {
      if (handle !== null && cancelFrame) cancelFrame(handle);
      handle = null;
      pending = null;
    },
    /** For assertions and debugging: the queued patch, or null. */
    get pending() {
      return pending;
    },
    /** How many times `apply` has actually run. */
    get applyCount() {
      return applyCount;
    },
  };
}

module.exports = { createThemeScheduler };
