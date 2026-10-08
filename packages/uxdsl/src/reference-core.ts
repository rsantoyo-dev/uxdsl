import valueParser from 'postcss-value-parser';
import { closestKey, formatKeyList } from './diagnostics';

// The reference-integrity engine, on declarations as plain records: property,
// value, the selector and at-rule conditions around it, and where it came
// from. No CSS parser: the theme paths (`generateThemeCss`, `validateTheme`,
// `applyTheme`) hand it the declarations the engines generated, straight from
// their blocks (css-blocks.ts), so the browser runtime never loads PostCSS.
// The PostCSS plugin reaches the same engine through `inspectReferences`
// (reference-integrity.ts), which turns its root into these records.

export interface ReferenceOptions {
  /** Strict by default. Warnings support an explicit migration period. */
  mode?: 'error' | 'warn' | 'off';
  /** Already compiled CSS from declared theme/dependency entries. Never emitted
   * again. Read by the PostCSS plugin (so by compile(), the CLI and the
   * bundler adapters); the theme paths, which have no CSS parser, reject it. */
  css?: string[];
  /** Exact custom properties guaranteed by the host; no inferred default tokens. */
  externalTokens?: string[];
  onWarning?: (issue: ReferenceIssue) => void;
}
export interface ReferenceIssue {
  code: 'UXD_REFERENCE_MISSING' | 'UXD_REFERENCE_CYCLE';
  message: string;
  consumer: string;
  reference: string;
  chain: string[];
  source?: string;
  line?: number;
  column?: number;
  /** The consumer declaration: the PostCSS node when the check ran on a stylesheet. */
  node?: unknown;
}

/** One declaration, as the engine reads it. */
export interface ReferenceDeclaration {
  prop: string;
  value: string;
  /** Exactly what PostCSS reports for the declaration: `true` with `!important`, absent otherwise. */
  important?: boolean;
  /** The selector of the outermost rule around it, `:root` when there is none. */
  selector: string;
  /** Every at-rule around it, outermost first, as `@<name> <params>`. */
  conditions: string[];
  source?: { file?: string; line?: number; column?: number };
  /** Handed back on an issue as `issue.node` (the plugin passes its PostCSS node). */
  node?: unknown;
}

// Architecture decision:
// `issue.source` is whatever PostCSS's `from` option resolved to (absolute,
// relative, or undefined) — never made relative to the working directory
// here. This engine is browser-safe (no Node-only globals, see the guard
// test below); working-directory-relative display is a CLI-only concern,
// already handled by `formatCliDiagnostic` in bin/uxdsl.js, which strips
// that prefix for terminal output. Do not reintroduce Node's path/cwd APIs here.
export function formatReferenceIssue(issue: ReferenceIssue): string {
  if (!issue.source) return issue.message;
  const position = issue.line === undefined ? '' : `:${issue.line}${issue.column === undefined ? '' : `:${issue.column}`}`;
  return `${issue.source}${position}: ${issue.message}`;
}

function missingTokenHint(reference: string, definitions: Iterable<string>): string {
  const match = reference.match(/^--uxdsl__(palette|color)__(.+)$/);
  if (!match) return '';
  const [, family, key] = match;
  const prefix = `--uxdsl__${family}__`;
  // Stability phase 1: never the missing name itself. A token defined only in
  // another scope (a dark-mode palette entry with no light-mode counterpart)
  // is in `definitions` under the very name that is missing here, and used to
  // come back as `Did you mean "neutral-dark"?` for `neutral-dark`.
  const candidates = Array.from(definitions).filter(name => name.startsWith(prefix) && name !== reference).map(name => name.slice(prefix.length));
  const candidate = closestKey(key, candidates);
  if (!candidate) return '';
  const written = family === 'palette' && key.endsWith('-main') && candidate.endsWith('-main')
    ? candidate.slice(0, -'-main'.length)
    : candidate;
  return ` Did you mean "${written}"?`;
}

/** How a consumer is named in a grouped message: its property, with the
 * stylesheet position when it has one (an author's declaration; generated
 * theme globals carry no source). */
function describeConsumer(issue: ReferenceIssue): string {
  if (!issue.source) return issue.consumer;
  const position = issue.line === undefined ? '' : `:${issue.line}${issue.column === undefined ? '' : `:${issue.column}`}`;
  return `${issue.consumer} (${issue.source}${position})`;
}

/**
 * Stability phase 1 (audit finding "cascading errors"): one line per missing
 * token, not one per consumer. A Palette value that does not resolve is
 * referenced by every Surface, Button and Input variable built on it, so a
 * single typo used to come back as twelve `UXD_REFERENCE_MISSING` lines that
 * all named the same token. The lines list the consumers (an author's own
 * declaration with its position first, then the theme's), capped at `limit`;
 * `issues` itself stays one per consumer for tooling and warn mode.
 */
export function formatReferenceIssues(issues: ReferenceIssue[], limit = 5): string {
  const lines: string[] = [];
  const groups = new Map<string, ReferenceIssue[]>();
  for (const issue of issues) {
    if (issue.code !== 'UXD_REFERENCE_MISSING') { lines.push(formatReferenceIssue(issue)); continue; }
    const group = groups.get(issue.reference);
    if (group) group.push(issue); else groups.set(issue.reference, [issue]);
  }
  // `forEach`, not `for…of`: this module is part of `uxdsl/runtime`, which a
  // consumer may compile to ES5 (test/es5-consumer-compat.test.js).
  groups.forEach((group, reference) => {
    // One consumer: the message as it always was — the full chain
    // (`color -> --uxdsl__palette__primary-main -> --uxdsl__color__brand-500`)
    // behind the stylesheet position when there is one.
    if (group.length === 1) { lines.push(formatReferenceIssue(group[0])); return; }
    const located = group.filter(issue => issue.source);
    const ordered = located.concat(group.filter(issue => !issue.source));
    const consumers = Array.from(new Set(ordered.map(describeConsumer)));
    const shown = consumers.slice(0, limit);
    const more = consumers.length - shown.length;
    const where = consumers.length === 1
      ? `Referenced by ${consumers[0]}.`
      : `Referenced by ${consumers.length} definitions: ${shown.join(', ')}${more ? ` and ${more} more` : ''}.`;
    lines.push(`UXD_REFERENCE_MISSING: ${reference} has no definition in the active theme/scope. Define it or declare its external provider.${(group[0] as any).hint || ''} ${where}`);
  });
  return lines.join('\n');
}

export class ReferenceIntegrityError extends Error {
  constructor(public readonly issues: ReferenceIssue[]) {
    super(formatReferenceIssues(issues));
    this.name = 'ReferenceIntegrityError';
    const located = issues.find(issue => issue.source);
    if (located) {
      (this as any).file = located.source;
      (this as any).line = located.line;
      (this as any).column = located.column;
    }
  }
}

type Context = { selector: string; conditions: string[] };
type Entry = { node: ReferenceDeclaration; context: Context; order: number };
function parseMinWidth(condition: string): number | null {
  const match = condition.match(/^@media \(min-width:\s*([\d.]+)px\)$/);
  return match ? Number(match[1]) : null;
}
// The min-width regex used to run on every condition of
// every pair compared, which at 24k lines meant millions of identical matches
// against a handful of distinct strings. The caller passes a memoized reader
// so the parse happens once per condition *per pass* — deliberately not a
// module-level cache, which would be exactly the cross-build process-global
// state the engine audit forbids.
function conditionsApply(definition: string[], consumer: string[], minWidthOf: (condition: string) => number | null = parseMinWidth) {
  return definition.every(condition => {
    if (consumer.includes(condition)) return true;
    const min = minWidthOf(condition);
    if (min === null) return false;
    return consumer.some(value => {
      const current = minWidthOf(value);
      return current !== null && current >= min;
    });
  });
}

/** Check the consumers against every definition, following dependencies
 * through the definitions when reached. `definitions` is every declaration in
 * document order (the dependency CSS first, then the stylesheet); a consumer
 * is the same record as its entry in `definitions`. Scope is conservative:
 * unconditional :root or an identical selector. Arbitrary selector ancestry
 * cannot be proven without a DOM; declare host tokens explicitly. `options.css`
 * is not read here — the caller turns compiled CSS into records first.
 */
export function inspectDeclarationReferences(definitionsInOrder: ReferenceDeclaration[], consumers: ReferenceDeclaration[], options: ReferenceOptions = {}): ReferenceIssue[] {
  if (options.mode === 'off') return [];
  const externals = new Set(options.externalTokens || []);
  externals.forEach(token => { if (!/^--[\w-]+$/.test(token)) throw new Error(`UXD_REFERENCE_CONTEXT: Invalid external token ${token}.`); });
  // Every index below is built once per call and thrown
  // away with it. None of them changes what counts as an issue — they only
  // stop the same answer from being recomputed per consumer. See the frozen
  // oracle in test/fixtures/reference-integrity-oracle.js, which the
  // equivalence test runs against this one.
  const minWidths = new Map<string, number | null>();
  const minWidthOf = (condition: string): number | null => {
    let width = minWidths.get(condition);
    if (width === undefined) { width = parseMinWidth(condition); minWidths.set(condition, width); }
    return width;
  };
  const applies = (definition: string[], consumer: string[]) => conditionsApply(definition, consumer, minWidthOf);

  // One context object per declaration, so the keys below are computed once.
  const contextsByNode = new Map<ReferenceDeclaration, Context>();
  const contextFor = (node: ReferenceDeclaration): Context => {
    let context = contextsByNode.get(node);
    if (!context) { context = { selector: node.selector, conditions: node.conditions }; contextsByNode.set(node, context); }
    return context;
  };
  // Contexts are compared by their JSON form, so each distinct object's key is
  // computed once. `checkValue` builds `{ selector, conditions }` objects as it
  // descends; interning them by (conditions array, selector) keeps those keys
  // cached too instead of re-stringifying per `var()`.
  const contextKeys = new WeakMap<Context, string>();
  const keyOf = (context: Context): string => {
    let key = contextKeys.get(context);
    if (key === undefined) { key = JSON.stringify(context); contextKeys.set(context, key); }
    return key;
  };
  const internedContexts = new WeakMap<string[], Map<string, Context>>();
  const contextIn = (selector: string, conditions: string[]): Context => {
    let bySelector = internedContexts.get(conditions);
    if (!bySelector) { bySelector = new Map(); internedContexts.set(conditions, bySelector); }
    let context = bySelector.get(selector);
    if (!context) { context = { selector, conditions }; bySelector.set(selector, context); }
    return context;
  };

  const entries: Entry[] = [];
  for (const node of definitionsInOrder) entries.push({ node, context: contextFor(node), order: entries.length });
  const definitions = new Map<string, Entry[]>();
  for (const entry of entries) if (entry.node.prop.startsWith('--')) {
    // Appending in place: the previous `[...existing, entry]` rebuilt the whole
    // array per definition, which is quadratic on its own for a token the theme
    // overrides at many breakpoints.
    const existing = definitions.get(entry.node.prop);
    if (existing) existing.push(entry); else definitions.set(entry.node.prop, [entry]);
  }
  // The consumer loop only ever needs the *distinct* contexts, and always in
  // the order they first appear — the previous code rebuilt and re-deduplicated
  // the full per-entry list for every consumer, which is the O(consumers x
  // entries) term this story is about.
  //
  // Deduplicating alone is not enough: a stylesheet of N components declares
  // O(N) distinct selectors, so scanning every distinct context per consumer
  // stays quadratic, just with a smaller constant. A consumer only ever
  // matches contexts that share its selector — or, for a `:root` consumer, the
  // `:root`-prefixed mode scopes — so the distinct contexts are bucketed by
  // selector here, in first-appearance order within each bucket. Iterating a
  // bucket visits the same contexts in the same order the full scan did.
  const contextsBySelector = new Map<string, Context[]>();
  const rootScopedContexts: Context[] = [];
  const seenContexts = new Set<string>();
  for (const entry of entries) {
    const key = keyOf(entry.context);
    if (seenContexts.has(key)) continue;
    seenContexts.add(key);
    const selector = entry.context.selector;
    const bucket = contextsBySelector.get(selector);
    if (bucket) bucket.push(entry.context); else contextsBySelector.set(selector, [entry.context]);
    if (selector.startsWith(':root')) rootScopedContexts.push(entry.context);
  }
  const contextsByBase = new Map<string, Context[]>();
  function contextsFor(base: Context): Context[] {
    const baseKey = keyOf(base);
    const cached = contextsByBase.get(baseKey);
    if (cached) return cached;
    // Also inspect overrides at declared media/mode contexts so an otherwise
    // valid base cannot hide a dependency that fails at another breakpoint.
    // `:root` reaches every `:root`-prefixed scope, which is how a dark-mode
    // override gets inspected; any other selector matches only itself.
    const unique = new Map<string, Context>([[baseKey, base]]);
    const candidates = base.selector === ':root' ? rootScopedContexts : (contextsBySelector.get(base.selector) || []);
    for (const context of candidates) {
      if (!applies(base.conditions, context.conditions)) continue;
      unique.set(keyOf(context), context);
    }
    const result = Array.from(unique.values());
    contextsByBase.set(baseKey, result);
    return result;
  }

  const issues: ReferenceIssue[] = [];
  const seen = new Set<string>();
  // `definitions` is complete before the first report and never changes after,
  // so both hint lists are built at most once instead of once per issue — a
  // file with thousands of missing tokens used to rebuild them thousands of
  // times.
  let spaceKeyHint: string | undefined;
  let hintNames: string[] | undefined;
  const report = (code: ReferenceIssue['code'], node: ReferenceDeclaration, chain: string[]) => {
    const reference = chain[chain.length - 1];
    const referenceHint = code === 'UXD_REFERENCE_MISSING' && /^--uxdsl__space__\d+$/.test(reference)
      ? ` Available space() keys: ${spaceKeyHint ??= formatKeyList(Array.from(definitions.keys()).filter(name => name.startsWith('--uxdsl__space__')).map(name => name.slice('--uxdsl__space__'.length)))}.`
      : code === 'UXD_REFERENCE_MISSING' ? missingTokenHint(reference, hintNames ??= Array.from(definitions.keys()).concat(Array.from(externals))) : '';
    const message = `${code}: ${chain.join(' -> ')}${code === 'UXD_REFERENCE_MISSING' ? ` has no definition in the active theme/scope. Define it or declare its external provider.${referenceHint}` : ' is a cyclic token dependency.'}`;
    const key = `${message}:${node.source?.file}:${node.source?.line}:${contextFor(node).selector}`;
    if (seen.has(key)) return;
    seen.add(key);
    const issue: ReferenceIssue = { code, message, consumer: node.prop, reference, chain,
      source: node.source?.file, line: node.source?.line, column: node.source?.column };
    Object.defineProperty(issue, 'node', { value: node.node === undefined ? node : node.node, enumerable: false });
    // The hint alone, for the grouped message (formatReferenceIssues); kept
    // off the enumerable shape the equivalence oracle compares.
    Object.defineProperty(issue, 'hint', { value: referenceHint, enumerable: false });
    issues.push(issue);
  };
  // A resolution depends on the name and on the context's selector/conditions —
  // nothing else — and `definitions` is immutable here, so the answer is
  // memoized per (name, context). The sort comparator is kept verbatim,
  // including `Number(undefined)` being NaN for a declaration without an
  // `important` flag: that quirk decides real orderings today.
  const resolutions = new Map<string, Entry | undefined>();
  function resolve(name: string, context: Context): Entry | undefined {
    const key = `${name}\u0000${keyOf(context)}`;
    if (resolutions.has(key)) return resolutions.get(key);
    const resolved = (definitions.get(name) || []).filter(entry =>
      (entry.context.selector === ':root' || entry.context.selector === context.selector) &&
      applies(entry.context.conditions, context.conditions)
    ).sort((a, b) => Number(a.node.important) - Number(b.node.important) ||
      Number(a.context.selector === context.selector) - Number(b.context.selector === context.selector) || a.order - b.order).pop();
    resolutions.set(key, resolved);
    return resolved;
  }
  // Which `var()` references a value contains is a property of the text alone,
  // so it is parsed once and reused across every context and every path that
  // reaches it. The *results* are deliberately not cached: they depend on
  // `chain` and `stack`, and the recursion below is kept as it was so cycles
  // and fallbacks keep behaving identically.
  type VarReference = { name: string; fallback: string | null };
  const varReferences = new Map<string, VarReference[]>();
  function referencesIn(value: string): VarReference[] {
    const cached = varReferences.get(value);
    if (cached) return cached;
    const references: VarReference[] = [];
    function visit(nodes: any[]) {
      for (const node of nodes) {
        if (node.type !== 'function') continue;
        if (node.value !== 'var') { visit(node.nodes); continue; }
        const comma = node.nodes.findIndex((item: any) => item.type === 'div' && item.value === ',');
        const name = valueParser.stringify(comma < 0 ? node.nodes : node.nodes.slice(0, comma)).trim();
        if (!name.startsWith('--')) continue;
        references.push({ name, fallback: comma < 0 ? null : valueParser.stringify(node.nodes.slice(comma + 1)) });
      }
    }
    visit(valueParser(value).nodes);
    varReferences.set(value, references);
    return references;
  }
  type Failure = { code: ReferenceIssue['code']; chain: string[] };
  function checkValue(value: string, context: Context, chain: string[], stack: Entry[]): Failure[] {
    const failures: Failure[] = [];
    for (const { name, fallback: fallbackValue } of referencesIn(value)) {
      const nextChain = [...chain, name];
      const entry = resolve(name, context);
      let dependency: Failure[] = [];
      if (!entry) {
        if (!externals.has(name)) dependency = [{ code: 'UXD_REFERENCE_MISSING', chain: nextChain }];
      } else if (stack.includes(entry)) {
        dependency = [{ code: 'UXD_REFERENCE_CYCLE', chain: nextChain }];
      } else {
        dependency = checkValue(entry.node.value, contextIn(entry.context.selector, context.conditions), nextChain, [...stack, entry]);
      }
      if (dependency.length && fallbackValue !== null) {
        // A fallback can recover an absent/invalid primary token. A cycle
        // inside a custom property still invalidates that property in CSS.
        const fallback = checkValue(fallbackValue, context, chain, stack);
        failures.push(...(dependency.some(issue => issue.code === 'UXD_REFERENCE_CYCLE') && stack.length ? dependency : fallback));
      } else failures.push(...dependency);
    }
    return failures;
  }
  for (const node of consumers) {
    const base = contextFor(node);
    for (const context of contextsFor(base)) {
      const effective = node.prop.startsWith('--') ? resolve(node.prop, context)?.node : node;
      if (effective !== node) continue;
      for (const failure of checkValue(node.value, context, [node.prop], [])) report(failure.code, node, failure.chain);
    }
  }
  return issues;
}

/** Throws `ReferenceIntegrityError` on an issue (or warns, in `warn` mode) — the
 * enforcement both the plugin and the theme paths apply to the result. */
export function reportReferenceIssues(issues: ReferenceIssue[], options: ReferenceOptions = {}): ReferenceIssue[] {
  if (issues.length && options.mode !== 'warn') throw new ReferenceIntegrityError(issues);
  for (const issue of issues) (options.onWarning || ((item: ReferenceIssue) => console.warn(item.message)))(issue);
  return issues;
}

/** The theme paths' check: the generated theme against itself and the host's
 * external tokens. They have no CSS parser, so compiled dependency CSS
 * (`references.css`) belongs to the PostCSS plugin and is refused here rather
 * than silently ignored. */
export function enforceDeclarationReferences(declarations: ReferenceDeclaration[], options: ReferenceOptions = {}): ReferenceIssue[] {
  if (options.css && options.css.length) {
    const error = new Error(
      'UXD_REFERENCE_CONTEXT: references.css (compiled CSS another entry provides) is read by the PostCSS plugin — ' +
      'compile(), uxdsl build and the bundler adapters pass it there. generateThemeCss and validateTheme check the ' +
      'theme against itself; name tokens a stylesheet outside the theme provides in references.externalTokens.'
    );
    (error as any).code = 'UXD_REFERENCE_CONTEXT';
    throw error;
  }
  return reportReferenceIssues(inspectDeclarationReferences(declarations, declarations, options), options);
}
